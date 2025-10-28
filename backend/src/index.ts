import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { createGame, GameState, makeMove } from './game';

export const app = express();
app.use(express.json());

export const server = http.createServer(app);
const wss = new WebSocketServer({ server });

export const games: Record<string, GameState> = {};
export const socketsByGame: Record<string, Set<any>> = {};

app.post('/api/game', (req, res) => {
  const id = uuidv4();
  const game = createGame(id);
  games[id] = game;
  socketsByGame[id] = new Set();
  res.json({ gameId: id });
});

app.post('/api/game/:id/join', (req, res) => {
  const { id } = req.params;
  const game = games[id];
  if (!game) return res.status(404).json({ error: 'Game not found' });
  res.json({ success: true });
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

wss.on('connection', (ws, req) => {
  const url = req.url || '';
  const params = new URLSearchParams(url.replace(/^\/?\?/, ''));
  const gameId = params.get('gameId');
  if (!gameId) return ws.close();
  const set = socketsByGame[gameId];
  if (!set) return ws.close();
  set.add(ws);
  ws.on('close', () => set.delete(ws));
});

const PORT = process.env.PORT || 4000;
if (require.main === module) {
  server.listen(PORT, () => console.log(`Server running on ${PORT}`));
}

export default { app, server, games, socketsByGame };
