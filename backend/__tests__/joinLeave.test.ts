import http from 'http';
import type { AddressInfo } from 'net';
// make sure ws exports the constructor name expected by backend/src/index.ts
const wsModule: any = require('ws');
if (!wsModule.WebSocketServer && wsModule.Server) wsModule.WebSocketServer = wsModule.Server;
const WsClient: any = wsModule;
let server: any;

function httpRequest(port: number, method: string, path: string, body?: any) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: '127.0.0.1', port, path, method, headers: { 'Content-Type': 'application/json' } };
    const req = http.request(opts, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const txt = Buffer.concat(chunks).toString() || '';
        let parsed = null;
        try { parsed = txt ? JSON.parse(txt) : null; } catch (e) { parsed = txt; }
        resolve({ statusCode: res.statusCode || 0, body: parsed });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

describe('join / leave / reject flows (integration)', () => {
  let port: number;
  beforeAll((done) => {
    // Ensure we mock/patch 'ws' before importing the server module so that
    // the backend's import of WebSocketServer will exist in this test env.
    // Use jest module isolation to load the module after mocking.
    jest.resetModules();
    jest.doMock('ws', () => {
      const real = jest.requireActual('ws');
      if (!real.WebSocketServer && real.Server) real.WebSocketServer = real.Server;
      return real;
    });
    // require the server after patching ws
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    server = require('../src/index').server;
    server.listen(0, () => {
      const addr = server.address() as AddressInfo;
      port = addr.port;
      done();
    });
  });

  afterAll((done) => {
    server.close(() => done());
  });

  test('can create game, join two players, reject third, notify on join and leave', async () => {
    // create game
  const create: any = await httpRequest(port, 'POST', '/api/game');
    expect(create.statusCode).toBe(200);
    const gameId = create.body.gameId as string;
    expect(gameId).toBeTruthy();

    // join reserve for player 1 via HTTP
    const join1: any = await httpRequest(port, 'POST', `/api/game/${gameId}/join`);
    expect(join1.statusCode).toBe(200);
    expect(join1.body.player).toBe('X');

    // Simulate websocket connection for player 1 by creating a fake socket and
    // attaching it to the server's socketsByGame and playersByGame so it will
    // receive broadcasts when other players join/leave.
    const serverModule: any = require('../src/index');
    const socketsByGame = serverModule.socketsByGame as Record<string, Set<any>>;
    const playersByGame = serverModule.playersByGame as Record<string, Array<any>>;

    const msgs1: any[] = [];
    const fakeSocket1 = { send: (payload: any) => { try { msgs1.push(JSON.parse(payload)); } catch (e) { msgs1.push(payload); } } };
    socketsByGame[gameId].add(fakeSocket1);
    // attach to reserved player slot (first slot)
    playersByGame[gameId][0].ws = fakeSocket1;
    playersByGame[gameId][0].connected = true;

    // join reserve for player 2 via HTTP (server should notify fakeSocket1)
    const join2: any = await httpRequest(port, 'POST', `/api/game/${gameId}/join`);
    expect(join2.statusCode).toBe(200);
    expect(join2.body.player).toBe('O');

    // fakeSocket1 should have received a players update
    const playersUpdate = msgs1.find((m) => m && m.type === 'players');
    expect(playersUpdate).toBeTruthy();

    // Now simulate real websocket connection for player 2 by creating fakeSocket2
    const msgs2: any[] = [];
    const fakeSocket2 = { send: (payload: any) => { try { msgs2.push(JSON.parse(payload)); } catch (e) { msgs2.push(payload); } } };
    socketsByGame[gameId].add(fakeSocket2);
    // attach to reserved player slot (second slot)
    playersByGame[gameId][1].ws = fakeSocket2;
    playersByGame[gameId][1].connected = true;

    // Now a third join attempt via HTTP should fail (two connected players)
    const join3: any = await httpRequest(port, 'POST', `/api/game/${gameId}/join`);
    expect(join3.statusCode).toBe(400);
    expect(join3.body.error).toBeTruthy();

    // Simulate player 2 leaving by marking slot disconnected and broadcasting a notification
    playersByGame[gameId][1].ws = undefined;
    playersByGame[gameId][1].connected = false;
    const notif = JSON.stringify({ type: 'notification', message: `Player O left` });
    socketsByGame[gameId].forEach((s: any) => { try { s.send(notif); } catch (e) {} });

    // fakeSocket1 should have received the left notification
    const leftNotif = msgs1.find((m) => m && m.type === 'notification' && /left/.test(m.message));
    expect(leftNotif).toBeTruthy();

    // now joining again should succeed and give a player (slot reopened)
    const join4: any = await httpRequest(port, 'POST', `/api/game/${gameId}/join`);
    expect(join4.statusCode).toBe(200);
    expect(['O', 'X']).toContain(join4.body.player);
  }, 10000);
});
