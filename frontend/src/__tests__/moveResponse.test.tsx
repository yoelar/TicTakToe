import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import App from '../App';

beforeEach(() => {
  // simple WebSocket mock that does nothing (no broadcasts)
  // @ts-ignore
  global.WebSocket = class {
    static instances: any[] = [];
    url: string;
    onmessage: any = null;
    onerror: any = null;
    onclose: any = null;
    constructor(url: string) {
      this.url = url;
      // @ts-ignore
      global.WebSocket.instances.push(this);
    }
    close() {}
  };

  // @ts-ignore
  global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/api/game') && init?.method === 'POST') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ gameId: 'game-2' }) });
    }
    if (url.endsWith('/state')) {
      const emptyBoard = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => "")));
      const state = { id: 'game-2', board: emptyBoard, currentPlayer: 'X' };
      return Promise.resolve({ ok: true, json: () => Promise.resolve(state) });
    }
    if (url.includes('/move')) {
      // server returns authoritative state including winner
      const board = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => "")));
      board[0][0][0] = 'X';
      const state = { id: 'game-2', board, currentPlayer: 'O', winner: 'X' };
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, state }) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
});

afterEach(() => {
  // @ts-ignore
  jest.clearAllMocks();
});

test('applies server /move response so winner shows immediately after submit', async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByText('Create Game'));
  await waitFor(() => screen.getByText('Refresh'));

  // select cell 0-0-0 and submit
  await user.click(screen.getByRole('gridcell', { name: /cell 0-0-0/i }));
  await user.click(screen.getByText('Submit'));

  // server returned a state with winner X; UI should show Winner: X without needing Refresh
  await waitFor(() => expect(screen.getByText(/Winner: X/)).toBeInTheDocument());
  expect(screen.getByText('Submit')).toBeDisabled();
});
