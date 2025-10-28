import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import App from '../App';

// Minimal MockWebSocket copied from App.test to control server messages
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  onmessage?: ((ev: { data: string }) => void) | null = null;
  onerror?: (() => void) | null = null;
  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }
  close() {}
}

beforeAll(() => {
  // @ts-ignore
  global.WebSocket = MockWebSocket;
});

beforeEach(() => {
  MockWebSocket.instances = [];
  // @ts-ignore
  global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/api/game') && init?.method === 'POST') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ gameId: 'game-1' }) });
    }
    if (url.endsWith('/state')) {
      const emptyBoard = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => "")));
      const state = { id: 'game-1', board: emptyBoard, currentPlayer: 'X' };
      return Promise.resolve({ ok: true, json: () => Promise.resolve(state) });
    }
    if (url.includes('/move')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
});

afterEach(() => {
  // @ts-ignore
  jest.clearAllMocks();
});

// Helper to send server state via websocket
function sendServerState(ws: MockWebSocket, board: string[][][], currentPlayer: 'X' | 'O', winner?: 'X' | 'O' | 'Draw') {
  const state: any = { id: 'game-1', board, currentPlayer };
  if (winner) state.winner = winner;
  ws.onmessage?.({ data: JSON.stringify(state) });
}

function makeEmptyBoard() {
  return Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => '')));
}

test('full game flow leads to X winning (space diagonal)', async () => {
  render(<App />);
  const user = userEvent.setup();

  // Create game
  await user.click(screen.getByText('Create Game'));
  await waitFor(() => screen.getByText('Refresh'));
  expect(MockWebSocket.instances.length).toBeGreaterThan(0);
  const ws = MockWebSocket.instances[0];

  // We'll simulate three X moves forming the space diagonal: (0,0,0), (1,1,1), (2,2,2)
  // Interleave O moves that don't block the diagonal.

  // 1) X at 0-0-0
  await user.click(screen.getByRole('gridcell', { name: /cell 0-0-0/i }));
  await user.click(screen.getByText('Submit'));
  // server responds with X at 0-0-0 and currentPlayer O
  let board = makeEmptyBoard();
  board[0][0][0] = 'X'; // z=0,y=0,x=0
  await act(async () => sendServerState(ws, board, 'O'));
  await waitFor(() => expect(screen.getByRole('gridcell', { name: /cell 0-0-0/i })).toHaveTextContent('X'));

  // 2) O at 0-1-0 (some other cell)
  // simulate opponent move delivered by server
  board[0][1][0] = 'O';
  await act(async () => sendServerState(ws, board, 'X'));
  await waitFor(() => expect(screen.getByRole('gridcell', { name: /cell 0-1-0/i })).toHaveTextContent('O'));

  // 3) X at 1-1-1
  await user.click(screen.getByRole('gridcell', { name: /cell 1-1-1/i }));
  await user.click(screen.getByText('Submit'));
  board[1][1][1] = 'X';
  await act(async () => sendServerState(ws, board, 'O'));
  await waitFor(() => expect(screen.getByRole('gridcell', { name: /cell 1-1-1/i })).toHaveTextContent('X'));

  // 4) O random
  board[0][2][0] = 'O';
  await act(async () => sendServerState(ws, board, 'X'));
  await waitFor(() => expect(screen.getByRole('gridcell', { name: /cell 0-2-0/i })).toHaveTextContent('O'));

  // 5) X at 2-2-2 winning move
  await user.click(screen.getByRole('gridcell', { name: /cell 2-2-2/i }));
  await user.click(screen.getByText('Submit'));
  board[2][2][2] = 'X';
  // server announces winner
  await act(async () => sendServerState(ws, board, 'X', 'X'));

  // Winner UI appears
  await waitFor(() => expect(screen.getByText(/Winner: X/)).toBeInTheDocument());
  expect(screen.getByText('Submit')).toBeDisabled();
});
