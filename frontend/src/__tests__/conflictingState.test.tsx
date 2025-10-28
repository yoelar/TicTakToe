import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import '@testing-library/jest-dom';
import App from '../App';
import { installMockWebSocket, MockWebSocket, makeEmptyBoard, sendServerStateToAll } from './testUtils';

beforeEach(() => {
  installMockWebSocket();
  // @ts-ignore
  global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/api/game') && init?.method === 'POST') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ gameId: 'conflict-1' }) });
    }
    if (url.endsWith('/state')) {
      const emptyBoard = makeEmptyBoard();
      const state = { id: 'conflict-1', board: emptyBoard, currentPlayer: 'X' };
      return Promise.resolve({ ok: true, json: () => Promise.resolve(state) });
    }
    if (url.includes('/move')) {
      // server returns authoritative state without winner
      const board = makeEmptyBoard();
      board[0][0][0] = 'X';
      const state = { id: 'conflict-1', board, currentPlayer: 'O' };
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, state }) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
});

afterEach(() => {
  // @ts-ignore
  jest.clearAllMocks();
});

test('server /move response applied, later broadcast overrides if different', async () => {
  const user = userEvent.setup();
  render(<App />);

  // create game
  await user.click(screen.getByText('Create Game'));
  await waitFor(() => screen.getByText('Refresh'));

  // submit a move which returns state with X but no winner
  await user.click(screen.getByRole('gridcell', { name: /cell 0-0-0/i }));
  await user.click(screen.getByText('Submit'));

  // after move response, UI should show X (from response)
  await waitFor(() => expect(screen.getByRole('gridcell', { name: /cell 0-0-0/i })).toHaveTextContent('X'));

  // now server broadcasts a different state that includes winner X
  const board = makeEmptyBoard();
  board[0][0][0] = 'X';
  board[1][1][1] = 'X';
  board[2][2][2] = 'X';
  await act(async () => sendServerStateToAll(board, 'X', 'X', 'conflict-1'));

  // UI should update to show Winner: X (broadcast overrides previous response)
  await waitFor(() => expect(screen.getByText(/Winner: X/)).toBeInTheDocument());
  expect(screen.getByText('Submit')).toBeDisabled();
});
