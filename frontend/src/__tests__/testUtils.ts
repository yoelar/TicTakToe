export class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  onmessage?: ((ev: { data: string }) => void) | null = null;
  onclose?: (() => void) | null = null;
  onerror?: (() => void) | null = null;
  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }
  close() {
    // Simulate closing the socket: call onclose and remove from instances so tests
    // behave more like a real WebSocket where closed sockets no longer receive messages.
    try {
      if (this.onclose) this.onclose();
    } catch (e) {
      // ignore
    }
    // Note: do not remove from instances array; tests rely on historical instances
    // being available for inspection. Closed sockets will have had their onclose
    // invoked and should not receive further messages if test code avoids calling
    // their onmessage handlers.
  }
}

export function installMockWebSocket() {
  // @ts-ignore
  global.WebSocket = MockWebSocket;
  MockWebSocket.instances = [];
}

export function makeEmptyBoard() {
  return Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => '')));
}

export function sendServerStateToAll(board: string[][][], currentPlayer: 'X' | 'O', winner?: 'X' | 'O' | 'Draw', gameId: string = 'game-1') {
  const state: any = { id: gameId, board, currentPlayer };
  if (winner) state.winner = winner;
  MockWebSocket.instances.forEach((ws) => ws.onmessage && ws.onmessage({ data: JSON.stringify(state) }));
}
