"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.playersByGame = exports.socketsByGame = exports.games = exports.server = exports.app = void 0;
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const ws_1 = require("ws");
const uuid_1 = require("uuid");
const game_1 = require("./game");
exports.app = (0, express_1.default)();
exports.app.use(express_1.default.json());
exports.server = http_1.default.createServer(exports.app);
// Ensure we can handle different ws export shapes across environments (CJS/ESM)
let WebSocketServerCtor = ws_1.WebSocketServer || undefined;
if (!WebSocketServerCtor) {
    try {
        // try require fallback
        const wsReq = require('ws');
        WebSocketServerCtor = wsReq.WebSocketServer || wsReq.Server || undefined;
    }
    catch (e) {
        WebSocketServerCtor = undefined;
    }
}
let wss = undefined;
if (typeof WebSocketServerCtor === 'function') {
    wss = new WebSocketServerCtor({ server: exports.server });
}
else {
    // ws server unavailable in this environment (tests/mock). We'll still export server and allow
    // HTTP endpoints to be exercised. WebSocket-related features will be no-ops.
    wss = null;
}
exports.games = {};
exports.socketsByGame = {};
// Track player slots and their websocket (if connected) per game
exports.playersByGame = {};
exports.app.post('/api/game', (req, res) => {
    const id = (0, uuid_1.v4)();
    const game = (0, game_1.createGame)(id);
    exports.games[id] = game;
    exports.socketsByGame[id] = new Set();
    exports.playersByGame[id] = [];
    res.json({ gameId: id });
});
exports.app.post('/api/game/:id/join', (req, res) => {
    const { id } = req.params;
    const game = exports.games[id];
    if (!game)
        return res.status(404).json({ error: 'Game not found' });
    const players = exports.playersByGame[id] || [];
    // Count connected players
    const connectedCount = players.filter((p) => p.connected).length;
    if (connectedCount >= 2)
        return res.status(400).json({ error: 'Game full' });
    // Determine assignment: if no players yet, first is X, second is O
    let assignment = 'X';
    if (players.length === 0)
        assignment = 'X';
    else if (players.length === 1)
        assignment = players[0].player === 'X' ? 'O' : 'X';
    else {
        // If there are reserved slots, find a disconnected slot
        const free = players.find((p) => !p.connected);
        assignment = free ? free.player : 'O';
    }
    // Reserve slot (ws will be attached when socket connects)
    players.push({ player: assignment, ws: undefined, connected: false });
    exports.playersByGame[id] = players;
    // notify existing connected sockets that someone reserved/joined
    const set = exports.socketsByGame[id] || new Set();
    const payload = JSON.stringify({ type: 'players', players: players.map(p => ({ player: p.player, connected: p.connected })) });
    set.forEach((s) => { try {
        s.send(payload);
    }
    catch (e) { } });
    res.json({ success: true, player: assignment });
});
exports.app.post('/api/game/:id/move', (req, res) => {
    const { id } = req.params;
    const move = req.body;
    const game = exports.games[id];
    if (!game)
        return res.status(404).json({ error: 'Game not found' });
    const result = (0, game_1.makeMove)(game, move);
    if (!result.success)
        return res.status(400).json({ error: result.error });
    // broadcast
    const set = exports.socketsByGame[id];
    // Keep backwards-compat: send raw state object for state updates
    const payload = JSON.stringify(game);
    set.forEach((s) => {
        try {
            s.send(payload);
        }
        catch (e) { /* ignore */ }
    });
    res.json({ success: true, state: game });
});
exports.app.get('/api/game/:id/state', (req, res) => {
    const { id } = req.params;
    const game = exports.games[id];
    if (!game)
        return res.status(404).json({ error: 'Game not found' });
    res.json(game);
});
if (wss) {
    wss.on('connection', (ws, req) => {
        const url = req.url || '';
        const params = new URLSearchParams(url.replace(/^\/?\?/, ''));
        const gameId = params.get('gameId');
        if (!gameId)
            return ws.close();
        const set = exports.socketsByGame[gameId];
        if (!set)
            return ws.close();
        // Ensure players array exists for this game
        if (!exports.playersByGame[gameId])
            exports.playersByGame[gameId] = [];
        const players = exports.playersByGame[gameId];
        // Assign this websocket to an existing reserved slot if any
        let assignedSlot = players.find((p) => !p.connected && !p.ws);
        if (assignedSlot) {
            assignedSlot.ws = ws;
            assignedSlot.connected = true;
        }
        else if (players.length < 2) {
            // Create a new slot
            const assignment = players.length === 0 ? 'X' : 'O';
            assignedSlot = { player: assignment, ws, connected: true };
            players.push(assignedSlot);
        }
        else {
            // If there's a disconnected slot (someone left), reuse it
            const disconnected = players.find((p) => !p.connected);
            if (disconnected) {
                disconnected.ws = ws;
                disconnected.connected = true;
                assignedSlot = disconnected;
            }
            else {
                // Game full
                try {
                    ws.send(JSON.stringify({ type: 'reject', message: 'Game full' }));
                }
                catch (e) { }
                try {
                    ws.close();
                }
                catch (e) { }
                return;
            }
        }
        set.add(ws);
        // Inform this socket of its assignment
        try {
            ws.send(JSON.stringify({ type: 'assign', player: assignedSlot.player }));
        }
        catch (e) { }
        // Broadcast updated players list to all sockets
        try {
            const playersPayload = JSON.stringify({ type: 'players', players: players.map(p => ({ player: p.player, connected: p.connected })) });
            set.forEach((s) => { try {
                s.send(playersPayload);
            }
            catch (e) { } });
        }
        catch (e) { }
        // Also notify others a player joined
        try {
            const notif = JSON.stringify({ type: 'notification', message: `Player ${assignedSlot.player} joined` });
            set.forEach((s) => { if (s !== ws)
                try {
                    s.send(notif);
                }
                catch (e) { } });
        }
        catch (e) { }
        ws.on('close', () => {
            set.delete(ws);
            // find assigned slot and mark disconnected
            const slot = players.find((p) => p.ws === ws);
            if (slot) {
                slot.ws = undefined;
                slot.connected = false;
                // notify remaining sockets
                const notif = JSON.stringify({ type: 'notification', message: `Player ${slot.player} left` });
                set.forEach((s) => { try {
                    s.send(notif);
                }
                catch (e) { } });
                // broadcast updated players list
                const playersPayload = JSON.stringify({ type: 'players', players: players.map(p => ({ player: p.player, connected: p.connected })) });
                set.forEach((s) => { try {
                    s.send(playersPayload);
                }
                catch (e) { } });
            }
        });
    });
}
const PORT = process.env.PORT || 4000;
if (require.main === module) {
    exports.server.listen(PORT, () => console.log(`Server running on ${PORT}`));
}
exports.default = { app: exports.app, server: exports.server, games: exports.games, socketsByGame: exports.socketsByGame };
