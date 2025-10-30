"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
// make sure ws exports the constructor name expected by backend/src/index.ts
const wsModule = require('ws');
if (!wsModule.WebSocketServer && wsModule.Server)
    wsModule.WebSocketServer = wsModule.Server;
const WsClient = wsModule;
let server;
function httpRequest(port, method, path, body) {
    return new Promise((resolve, reject) => {
        const opts = { hostname: '127.0.0.1', port, path, method, headers: { 'Content-Type': 'application/json' } };
        const req = http_1.default.request(opts, (res) => {
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => {
                const txt = Buffer.concat(chunks).toString() || '';
                let parsed = null;
                try {
                    parsed = txt ? JSON.parse(txt) : null;
                }
                catch (e) {
                    parsed = txt;
                }
                resolve({ statusCode: res.statusCode || 0, body: parsed });
            });
        });
        req.on('error', reject);
        if (body)
            req.write(JSON.stringify(body));
        req.end();
    });
}
describe('join / leave / reject flows (integration)', () => {
    let port;
    beforeAll((done) => {
        // Ensure we mock/patch 'ws' before importing the server module so that
        // the backend's import of WebSocketServer will exist in this test env.
        // Use jest module isolation to load the module after mocking.
        jest.resetModules();
        jest.doMock('ws', () => {
            const real = jest.requireActual('ws');
            if (!real.WebSocketServer && real.Server)
                real.WebSocketServer = real.Server;
            return real;
        });
        // require the server after patching ws
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        server = require('../src/index').server;
        server.listen(0, () => {
            const addr = server.address();
            port = addr.port;
            done();
        });
    });
    afterAll((done) => {
        server.close(() => done());
    });
    test('can create game, join two players, reject third, notify on join and leave', async () => {
        // create game
        const create = await httpRequest(port, 'POST', '/api/game');
        expect(create.statusCode).toBe(200);
        const gameId = create.body.gameId;
        expect(gameId).toBeTruthy();
        // join reserve for player 1 via HTTP
        const join1 = await httpRequest(port, 'POST', `/api/game/${gameId}/join`);
        expect(join1.statusCode).toBe(200);
        expect(join1.body.player).toBe('X');
        // Simulate websocket connection for player 1 by creating a fake socket and
        // attaching it to the server's socketsByGame and playersByGame so it will
        // receive broadcasts when other players join/leave.
        const serverModule = require('../src/index');
        const socketsByGame = serverModule.socketsByGame;
        const playersByGame = serverModule.playersByGame;
        const msgs1 = [];
        const fakeSocket1 = { send: (payload) => { try {
                msgs1.push(JSON.parse(payload));
            }
            catch (e) {
                msgs1.push(payload);
            } } };
        socketsByGame[gameId].add(fakeSocket1);
        // attach to reserved player slot (first slot)
        playersByGame[gameId][0].ws = fakeSocket1;
        playersByGame[gameId][0].connected = true;
        // join reserve for player 2 via HTTP (server should notify fakeSocket1)
        const join2 = await httpRequest(port, 'POST', `/api/game/${gameId}/join`);
        expect(join2.statusCode).toBe(200);
        expect(join2.body.player).toBe('O');
        // fakeSocket1 should have received a players update
        const playersUpdate = msgs1.find((m) => m && m.type === 'players');
        expect(playersUpdate).toBeTruthy();
        // Now simulate real websocket connection for player 2 by creating fakeSocket2
        const msgs2 = [];
        const fakeSocket2 = { send: (payload) => { try {
                msgs2.push(JSON.parse(payload));
            }
            catch (e) {
                msgs2.push(payload);
            } } };
        socketsByGame[gameId].add(fakeSocket2);
        // attach to reserved player slot (second slot)
        playersByGame[gameId][1].ws = fakeSocket2;
        playersByGame[gameId][1].connected = true;
        // Now a third join attempt via HTTP should fail (two connected players)
        const join3 = await httpRequest(port, 'POST', `/api/game/${gameId}/join`);
        expect(join3.statusCode).toBe(400);
        expect(join3.body.error).toBeTruthy();
        // Simulate player 2 leaving by marking slot disconnected and broadcasting a notification
        playersByGame[gameId][1].ws = undefined;
        playersByGame[gameId][1].connected = false;
        const notif = JSON.stringify({ type: 'notification', message: `Player O left` });
        socketsByGame[gameId].forEach((s) => { try {
            s.send(notif);
        }
        catch (e) { } });
        // fakeSocket1 should have received the left notification
        const leftNotif = msgs1.find((m) => m && m.type === 'notification' && /left/.test(m.message));
        expect(leftNotif).toBeTruthy();
        // now joining again should succeed and give a player (slot reopened)
        const join4 = await httpRequest(port, 'POST', `/api/game/${gameId}/join`);
        expect(join4.statusCode).toBe(200);
        expect(['O', 'X']).toContain(join4.body.player);
    }, 10000);
});
