import http from 'http';
import type { AddressInfo } from 'net';
// make sure ws exports the constructor name expected by backend/src/index.ts
const wsModule: any = require('ws');
if (!wsModule.WebSocketServer && wsModule.Server) wsModule.WebSocketServer = wsModule.Server;
const WsClient: any = wsModule;
let server: any;

function httpRequest(port: number, method: string, path: string, body?: any): Promise<any> {
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

describe('multi-game join/cleanup', () => {
  let port: number;
  beforeAll((done) => {
    jest.resetModules();
    jest.doMock('ws', () => {
      const real = jest.requireActual('ws');
      if (!real.WebSocketServer && real.Server) real.WebSocketServer = real.Server;
      return real;
    });
    server = require('../src/index').server;
    server.listen(0, () => {
      const addr = server.address() as AddressInfo;
      port = addr.port;
      done();
    });
  });

  afterAll((done) => {
    if (server && typeof server.close === 'function') {
      server.close(() => done());
    } else {
      done();
    }
  });

  test('player slot cleanup when joining new game or creating game', async () => {
    // create first game with client ID
    const clientId = 'test-client-1';
    const create1 = await httpRequest(port, 'POST', `/api/game?clientId=${clientId}`);
    expect(create1.statusCode).toBe(200);
    const game1Id = create1.body.gameId as string;
    expect(game1Id).toBeTruthy();

    // join first game with player 1
    const join1 = await httpRequest(port, 'POST', `/api/game/${game1Id}/join?clientId=${clientId}`);
    expect(join1.statusCode).toBe(200);
    expect(join1.body.player).toBe('X');

    // simulate websocket connection for player 1
    const serverModule: any = require('../src/index');
    const socketsByGame = serverModule.socketsByGame as Record<string, Set<any>>;
    const playersByGame = serverModule.playersByGame as Record<string, Array<any>>;
    
    const msgs1: any[] = [];
    const fakeSocket1 = { 
      send: (payload: any) => { try { msgs1.push(JSON.parse(payload)); } catch (e) { msgs1.push(payload); } },
      clientId,
      gameId: game1Id
    };
    socketsByGame[game1Id].add(fakeSocket1);
    // attach to first slot in game1
    playersByGame[game1Id][0].ws = fakeSocket1;
    playersByGame[game1Id][0].connected = true;
    playersByGame[game1Id][0].clientId = clientId;
    serverModule.clientGameMap[clientId] = game1Id;

    console.log('Game1 player slot before creating game2:', playersByGame[game1Id][0]);
    
    // create second game
    const create2 = await httpRequest(port, 'POST', `/api/game?clientId=${clientId}`);
    expect(create2.statusCode).toBe(200);
    const game2Id = create2.body.gameId as string;
    expect(game2Id).toBeTruthy();

    // attempt to join second game with same player (should trigger cleanup of first game slot)
    const join2 = await httpRequest(port, 'POST', `/api/game/${game2Id}/join?clientId=${clientId}`);
    expect(join2.statusCode).toBe(200);
    
    // Verify: player's slot in first game should be marked disconnected
    expect(playersByGame[game1Id][0].connected).toBe(false);
    expect(playersByGame[game1Id][0].ws).toBeUndefined();

    // remaining player in game1 should have received a notification that player X left
    const leftNotif = msgs1.find((m) => m && m.type === 'notification' && /left/.test(m.message));
    expect(leftNotif).toBeTruthy();

    // simulate websocket connection for player 1 in game2
    const msgs2: any[] = [];
    const fakeSocket2 = { 
      send: (payload: any) => { try { msgs2.push(JSON.parse(payload)); } catch (e) { msgs2.push(payload); } },
      clientId,
      gameId: game2Id
    };
    socketsByGame[game2Id].add(fakeSocket2);
    playersByGame[game2Id][0].ws = fakeSocket2;
    playersByGame[game2Id][0].connected = true;
    playersByGame[game2Id][0].clientId = clientId;
    serverModule.clientGameMap[clientId] = game2Id;

    // create third game and verify cleanup of game2
    console.log('Creating game3 for client', clientId);
    const create3 = await httpRequest(port, 'POST', `/api/game?clientId=${clientId}`);
    console.log('Game2 player slot after cleanup:', playersByGame[game2Id][0]);
    expect(create3.statusCode).toBe(200);
    const game3Id = create3.body.gameId as string;

    console.log('Game1 player slot after creating game2:', playersByGame[game1Id][0]);
    console.log('Game2 player slot before creating game3:', playersByGame[game2Id][0]);
    
    // verify player slot in game2 was cleaned up when creating game3
    expect(playersByGame[game2Id][0].connected).toBe(false);
    expect(playersByGame[game2Id][0].ws).toBeUndefined();
  });
});