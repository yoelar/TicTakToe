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
  close() {}
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
