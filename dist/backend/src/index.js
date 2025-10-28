"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.socketsByGame = exports.games = exports.server = exports.app = void 0;
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const ws_1 = require("ws");
const uuid_1 = require("uuid");
const game_1 = require("./game");
exports.app = (0, express_1.default)();
exports.app.use(express_1.default.json());
exports.server = http_1.default.createServer(exports.app);
const wss = new ws_1.WebSocketServer({ server: exports.server });
exports.games = {};
exports.socketsByGame = {};
exports.app.post('/api/game', (req, res) => {
    const id = (0, uuid_1.v4)();
    const game = (0, game_1.createGame)(id);
    exports.games[id] = game;
    exports.socketsByGame[id] = new Set();
    res.json({ gameId: id });
});
exports.app.post('/api/game/:id/join', (req, res) => {
    const { id } = req.params;
    const game = exports.games[id];
    if (!game)
        return res.status(404).json({ error: 'Game not found' });
    res.json({ success: true });
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
wss.on('connection', (ws, req) => {
    const url = req.url || '';
    const params = new URLSearchParams(url.replace(/^\/?\?/, ''));
    const gameId = params.get('gameId');
    if (!gameId)
        return ws.close();
    const set = exports.socketsByGame[gameId];
    if (!set)
        return ws.close();
    set.add(ws);
    ws.on('close', () => set.delete(ws));
});
const PORT = process.env.PORT || 4000;
if (require.main === module) {
    exports.server.listen(PORT, () => console.log(`Server running on ${PORT}`));
}
exports.default = { app: exports.app, server: exports.server, games: exports.games, socketsByGame: exports.socketsByGame };
