import React from 'react';
import { render, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import '@testing-library/jest-dom';
import App from '../App';

// Mock WebSocket that records instances so tests can simulate server broadcasts
import { installMockWebSocket, MockWebSocket, makeEmptyBoard, sendServerStateToAll } from './testUtils';

beforeEach(() => {
  installMockWebSocket();

  // @ts-ignore
  global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/api/game') && init?.method === 'POST') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ gameId: 'multi-1' }) });
    }
    if (url.endsWith('/state')) {
      const emptyBoard = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => "")));
      const state = { id: 'multi-1', board: emptyBoard, currentPlayer: 'X' };
      return Promise.resolve({ ok: true, json: () => Promise.resolve(state) });
    }
    if (url.includes('/move')) {
      // Return success; tests will simulate broadcast separately
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) });
    }
    if (url.includes('/join')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
});

afterEach(() => {
  // @ts-ignore
  jest.clearAllMocks();
});

test('two clients receive broadcasts so moves and winner appear without refresh', async () => {
  const user = userEvent.setup();

  // render two app instances (simulates two browser tabs)
  const a1 = render(<App />);
  const a2 = render(<App />);

  // Client 1 creates a game
  await user.click(within(a1.container).getByText('Create Game'));
  await waitFor(() => within(a1.container).getByText('Refresh'));

  // extract game id shown in header of client1
  const header = within(a1.container).getByText(/Game:/i);
  const idText = header.textContent || '';
  const gameId = idText.replace(/Game:\s*/i, '').trim();
  expect(gameId).toBe('multi-1');

  // Client 2 joins using the ID
  await user.type(within(a2.container).getByPlaceholderText('Game ID'), gameId);
  await user.click(within(a2.container).getByText('Join Game'));
  await waitFor(() => within(a2.container).getByText('Refresh'));

  // ensure two websocket instances connected
  expect(MockWebSocket.instances.length).toBeGreaterThanOrEqual(2);

  // Client1 places X at 0-0-0
  await user.click(within(a1.container).getByRole('gridcell', { name: /cell 0-0-0/i }));
  await user.click(within(a1.container).getByText('Submit'));

  // Server broadcasts the new board to all clients
  let board = makeEmptyBoard();
  board[0][0][0] = 'X';
  await act(async () => sendServerStateToAll(board, 'O', undefined, 'multi-1'));

  // Client2 should display the X without pressing Refresh
  await waitFor(() => expect(within(a2.container).getByRole('gridcell', { name: /cell 0-0-0/i })).toHaveTextContent('X'));

  // Now simulate further moves and a winning broadcast
  board[1][1][1] = 'X';
  board[2][2][2] = 'X';
  await act(async () => sendServerStateToAll(board, 'X', 'X', 'multi-1'));

  // Both clients should show Winner and have Submit disabled
  await waitFor(() => expect(within(a1.container).getByText(/Winner: X/)).toBeInTheDocument());
  expect(within(a1.container).getByText('Submit')).toBeDisabled();
  await waitFor(() => expect(within(a2.container).getByText(/Winner: X/)).toBeInTheDocument());
  expect(within(a2.container).getByText('Submit')).toBeDisabled();
});
