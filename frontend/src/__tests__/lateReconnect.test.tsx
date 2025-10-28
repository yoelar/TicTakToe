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
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ gameId: 'reconnect-1' }) });
    }
    if (url.endsWith('/state')) {
      const emptyBoard = makeEmptyBoard();
      const state = { id: 'reconnect-1', board: emptyBoard, currentPlayer: 'X' };
      return Promise.resolve({ ok: true, json: () => Promise.resolve(state) });
    }
    if (url.includes('/move')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
});

afterEach(() => {
  // @ts-ignore
  jest.clearAllMocks();
});

test('tries fallback websocket when primary fails and receives broadcast', async () => {
  const user = userEvent.setup();
  render(<App />);

  // create game
  await user.click(screen.getByText('Create Game'));
  await waitFor(() => screen.getByText('Refresh'));

  // initial websocket instance created (primary)
  expect(MockWebSocket.instances.length).toBeGreaterThan(0);

  // simulate primary websocket failing
  const primaryWs = MockWebSocket.instances[0];
  act(() => {
    primaryWs.onerror && primaryWs.onerror();
  });

  // now client should attempt fallback and create another instance
  await waitFor(() => expect(MockWebSocket.instances.length).toBeGreaterThanOrEqual(2));

  // submit a move on the UI
  await user.click(screen.getByRole('gridcell', { name: /cell 0-0-0/i }));
  await user.click(screen.getByText('Submit'));

  // server broadcasts via the new websocket(s)
  const board = makeEmptyBoard();
  board[0][0][0] = 'X';
  await act(async () => sendServerStateToAll(board, 'O', undefined, 'reconnect-1'));

  // UI should show X without requiring Refresh
  await waitFor(() => expect(screen.getByRole('gridcell', { name: /cell 0-0-0/i })).toHaveTextContent('X'));
});
