import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { createGame, GameState, makeMove } from './game';
import { GameWebSocket, WSQueryParams } from './types';

export const app = express();
app.use(express.json());

export const server = http.createServer(app);
// Ensure we can handle different ws export shapes across environments (CJS/ESM)
let WebSocketServerCtor: any = (WebSocketServer as any) || undefined;
if (!WebSocketServerCtor) {
  try {
    // try require fallback
    const wsReq = require('ws');
    WebSocketServerCtor = wsReq.WebSocketServer || wsReq.Server || undefined;
  } catch (e) {
    WebSocketServerCtor = undefined;
  }
}

let wss: any = undefined;
if (typeof WebSocketServerCtor === 'function') {
  wss = new WebSocketServerCtor({ server });
} else {
  // ws server unavailable in this environment (tests/mock). We'll still export server and allow
  // HTTP endpoints to be exercised. WebSocket-related features will be no-ops.
  wss = null as any;
}

export const games: Record<string, GameState> = {};
export const socketsByGame: Record<string, Set<GameWebSocket>> = {};
export type Player = 'X' | 'O';

// Track player slots and their websocket (if connected) per game
export const playersByGame: Record<
  string,
  Array<{ player: Player; ws?: GameWebSocket; connected: boolean; clientId?: string }>
> = {};

// Track client ID to game ID mapping to detect clients joining multiple games
const clientGameMap: Record<string, string> = {};

app.post('/api/game', (req, res) => {
  const id = uuidv4();
  const game = createGame(id);
  games[id] = game;
  socketsByGame[id] = new Set();
  playersByGame[id] = [];
  res.json({ gameId: id });
});

app.post('/api/game/:id/join', (req, res) => {
  const { id } = req.params;
  const game = games[id];
  if (!game) return res.status(404).json({ error: 'Game not found' });
  const players = playersByGame[id] || [];
  // Count connected players
  const connectedCount = players.filter((p) => p.connected).length;
  if (connectedCount >= 2) return res.status(400).json({ error: 'Game full' });

  // Determine assignment: if no players yet, first is X, second is O
  let assignment: Player = 'X';
  if (players.length === 0) assignment = 'X';
  else if (players.length === 1) assignment = players[0].player === 'X' ? 'O' : 'X';
  else {
    // If there are reserved slots, find a disconnected slot
    const free = players.find((p) => !p.connected);
    assignment = free ? free.player : 'O';
  }

  // Reserve slot (ws will be attached when socket connects)
  players.push({ player: assignment, ws: undefined, connected: false });
  playersByGame[id] = players;

  // notify existing connected sockets that someone reserved/joined
  const set = socketsByGame[id] || new Set();
  const payload = JSON.stringify({ type: 'players', players: players.map(p => ({ player: p.player, connected: p.connected })) });
  set.forEach((s) => { try { s.send(payload); } catch (e) {} });

  res.json({ success: true, player: assignment });
});

app.post('/api/game/:id/move', (req, res) => {
  const { id } = req.params;
  const move = req.body;
  const game = games[id];
  if (!game) return res.status(404).json({ error: 'Game not found' });
  const result = makeMove(game, move);
  if (!result.success) return res.status(400).json({ error: result.error });
  // broadcast
  const set = socketsByGame[id];
  // Keep backwards-compat: send raw state object for state updates
  const payload = JSON.stringify(game);
  set.forEach((s) => {
    try { s.send(payload); } catch (e) { /* ignore */ }
  });
  res.json({ success: true, state: game });
});

app.get('/api/game/:id/state', (req, res) => {
  const { id } = req.params;
  const game = games[id];
  if (!game) return res.status(404).json({ error: 'Game not found' });
  res.json(game);
});

if (wss) {
  wss.on('connection', (ws: GameWebSocket, req: any) => {
  const url = req.url || '';
  const params = new URLSearchParams(url.replace(/^\/?\?/, ''));
  const gameId = params.get('gameId') as string;
  const clientId = params.get('clientId') || undefined;
  if (!gameId) return ws.close();
  const set = socketsByGame[gameId];
  if (!set) return ws.close();

  // Store IDs on the socket instance for easy access
  ws.gameId = gameId;
  if (clientId) {
    ws.clientId = clientId;
    
    // If this client was previously in a different game, force disconnect their socket
    const previousGameId = clientGameMap[clientId];
    if (previousGameId && previousGameId !== gameId) {
      const previousGame = socketsByGame[previousGameId];
      if (previousGame) {
        // Find and disconnect client's old socket from previous game
        for (const socket of previousGame) {
          if (socket.clientId === clientId) {
            try { socket.close(); } catch (e) {}
            previousGame.delete(socket);
            // Clean up player slot too
            const players = playersByGame[previousGameId];
            const slot = players?.find(p => p.clientId === clientId);
            if (slot) {
              slot.ws = undefined;
              slot.connected = false;
              slot.clientId = undefined;
            }
            // Notify remaining players in the previous game
            const notif = JSON.stringify({
              type: 'notification',
              message: `Player ${slot?.player} left`,
            });
            previousGame.forEach(s => { try { s.send(notif); } catch (e) {} });
            // Update players list for remaining clients
            const playersPayload = JSON.stringify({
              type: 'players',
              players: players.map(p => ({ player: p.player, connected: p.connected })),
            });
            previousGame.forEach(s => { try { s.send(playersPayload); } catch (e) {} });
            break;
          }
        }
      }
    }
    // Update the client's current game mapping
    clientGameMap[clientId] = gameId;
  }

  // Ensure players array exists for this game
  if (!playersByGame[gameId]) playersByGame[gameId] = [];
  const players = playersByGame[gameId];

  // Assign this websocket to an existing reserved slot if any
  // First try to find this client's existing slot
  let assignedSlot = clientId ? players.find(p => p.clientId === clientId) : undefined;
  if (!assignedSlot) {
    // Then look for any available slot
    assignedSlot = players.find((p) => !p.connected && !p.ws);
  }
  if (assignedSlot) {
    assignedSlot.ws = ws;
    assignedSlot.connected = true;
    if (clientId) assignedSlot.clientId = clientId;
  } else if (players.length < 2) {
    // Create a new slot
    const assignment: Player = players.length === 0 ? 'X' : 'O';
  assignedSlot = { player: assignment, ws, connected: true, clientId } as any;
  players.push(assignedSlot!);
  } else {
    // If there's a disconnected slot (someone left), reuse it
    const disconnected = players.find((p) => !p.connected);
    if (disconnected) {
      disconnected.ws = ws;
      disconnected.connected = true;
      if (clientId) disconnected.clientId = clientId;
      assignedSlot = disconnected;
    } else {
      // Game full
      try { ws.send(JSON.stringify({ type: 'reject', message: 'Game full' })); } catch (e) {}
      try { ws.close(); } catch (e) {}
      return;
    }
  }

  set.add(ws as GameWebSocket);

  // Inform this socket of its assignment
  try { if (assignedSlot) ws.send(JSON.stringify({ type: 'assign', player: assignedSlot.player })); } catch (e) {}

  // Broadcast updated players list to all sockets
  try {
    const playersPayload = JSON.stringify({ type: 'players', players: players.map(p => ({ player: p.player, connected: p.connected })) });
    set.forEach((s) => { try { s.send(playersPayload); } catch (e) {} });
  } catch (e) {}

  // Also notify others a player joined
  try {
    if (assignedSlot) {
      const notif = JSON.stringify({ type: 'notification', message: `Player ${assignedSlot.player} joined` });
      set.forEach((s) => { if (s !== ws) try { s.send(notif); } catch (e) {} });
    }
  } catch (e) {}

  // Handle messages from client
  try {
    const onMessage = (data: any) => {
      try {
        const message = JSON.parse(data);
        if (message.type === 'leave') {
          // Immediately process leave message before socket closes
          const slot = players.find((p) => p.ws === ws);
          if (slot) {
            slot.ws = undefined;
            slot.connected = false;
            slot.clientId = undefined;
            // notify remaining sockets immediately
            const notif = JSON.stringify({ type: 'notification', message: `Player ${slot.player} left` });
            set.forEach((s) => { if (s !== ws) try { s.send(notif); } catch (e) {} });
            // broadcast updated players list
            const playersPayload = JSON.stringify({ type: 'players', players: players.map(p => ({ player: p.player, connected: p.connected })) });
            set.forEach((s) => { if (s !== ws) try { s.send(playersPayload); } catch (e) {} });
          }
        }
      } catch (e) {}
    };
    // Attempt both APIs depending on environment
    try {
      (ws as any).on('message', onMessage);
    } catch (e) {
      try { ws.addEventListener('message', (e: any) => onMessage(e.data)); } catch (e) {}
    }
  } catch (e) {}

  // ws in this environment is the ws returned by the 'ws' package which uses
  // the EventEmitter API. It exposes 'on' in Node runtime, but for typings we
  // can also listen with 'close' event via addEventListener in browser-like mocks.
  const onClose = () => {
    set.delete(ws as GameWebSocket);
    // find assigned slot and mark disconnected
    const slot = players.find((p) => p.ws === ws);
    if (slot) {
      slot.ws = undefined;
      slot.connected = false;
      slot.clientId = undefined;
      // notify remaining sockets
      const notif = JSON.stringify({ type: 'notification', message: `Player ${slot.player} left` });
      set.forEach((s) => { try { s.send(notif); } catch (e) {} });
      // broadcast updated players list
      const playersPayload = JSON.stringify({ type: 'players', players: players.map(p => ({ player: p.player, connected: p.connected })) });
      set.forEach((s) => { try { s.send(playersPayload); } catch (e) {} });
    }
  };
  // Attempt both APIs depending on environment
  try {
    (ws as any).on('close', onClose);
  } catch (e) {
    try { ws.addEventListener('close', onClose as any); } catch (e) {}
  }
  });
}

const PORT = process.env.PORT || 4000;
if (require.main === module) {
  server.listen(PORT, () => console.log(`Server running on ${PORT}`));
}

export default { app, server, games, socketsByGame };
