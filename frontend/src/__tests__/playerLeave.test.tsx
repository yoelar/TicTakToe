import React from 'react';
import { render, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import '@testing-library/jest-dom';
import App from '../App';

// Mock WebSocket that records instances so tests can simulate server broadcasts
import { installMockWebSocket, MockWebSocket, makeEmptyBoard, sendServerStateToAll } from './testUtils';

// Define game counter on global with type
declare global {
  var gameCounter: number;
}

beforeEach(() => {
  installMockWebSocket();

  // @ts-ignore
  global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/api/game') && init?.method === 'POST') {
      if (!global.gameCounter) global.gameCounter = 1;
      const gameId = `leave-${global.gameCounter++}`;
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ gameId }) });
    }
    if (url.endsWith('/state')) {
      const emptyBoard = makeEmptyBoard();
      const state = { id: 'leave-1', board: emptyBoard, currentPlayer: 'X' };
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

test('players connected count updates when player leaves by creating new game', async () => {
  const user = userEvent.setup();

  // render two app instances (simulates two browser tabs)
  const app1 = render(<App />);
  const app2 = render(<App />);

  // Client 1 creates initial game
  await user.click(within(app1.container).getByText('Create Game'));
  await waitFor(() => within(app1.container).getByText('Refresh'));

  // Send assign message to client 1 to simulate server assignment
  await act(async () => {
    MockWebSocket.instances[0].onmessage?.({ 
      data: JSON.stringify({ type: 'assign', player: 'X' })
    });
    MockWebSocket.instances[0].onmessage?.({ 
      data: JSON.stringify({ type: 'players', players: [{ player: 'X', connected: true }] })
    });
  });

  const header = within(app1.container).getByText(/Game:/i);
  const gameId = header.textContent?.replace(/Game:\s*/i, '').trim() || '';
  expect(gameId).toBe('leave-1');

  // Initially one player connected
  await waitFor(() => expect(within(app1.container).getByText('Players connected: 1')).toBeInTheDocument());

  // Client 2 joins
  await user.type(within(app2.container).getByPlaceholderText('Game ID'), gameId);
  await user.click(within(app2.container).getByText('Join Game'));
  
  // Send assign message to client 2 and update players for both
  await act(async () => {
    MockWebSocket.instances[1].onmessage?.({ 
      data: JSON.stringify({ type: 'assign', player: 'O' })
    });
    const players = [
      { player: 'X', connected: true },
      { player: 'O', connected: true }
    ];
    // Broadcast to both clients that 2 players are now connected
    MockWebSocket.instances.forEach(ws => {
      ws.onmessage?.({ data: JSON.stringify({ type: 'players', players }) });
    });
  });

  await waitFor(() => within(app2.container).getByText('Refresh'));

  // Both clients should show 2 players connected
  await waitFor(() => expect(within(app1.container).getByText('Players connected: 2')).toBeInTheDocument());
  expect(within(app2.container).getByText('Players connected: 2')).toBeInTheDocument();

  // Player 2 creates a new game (leaving the first game)
  await user.click(within(app2.container).getByText('Create Game'));
  
  // Server notifies remaining client (app1) that a player left and closes Player 2's socket
  await act(async () => {
    // Simulate old socket being closed by server
    MockWebSocket.instances[1].onclose?.();
    
    // Then server sends updated player list to remaining client
    MockWebSocket.instances[0].onmessage?.({ 
      data: JSON.stringify({ type: 'players', players: [{ player: 'X', connected: true }] })
    });
  });

  // App2 gets assigned to new game with new socket
  await act(async () => {
    const latestSocket = MockWebSocket.instances[MockWebSocket.instances.length - 1];
    latestSocket.onmessage?.({
      data: JSON.stringify({ type: 'assign', player: 'X' })
    });
    latestSocket.onmessage?.({
      data: JSON.stringify({ type: 'players', players: [{ player: 'X', connected: true }] })
    });
  });

  await waitFor(() => {
    // Player 1's UI should update to show only 1 player connected
    expect(within(app1.container).getByText('Players connected: 1')).toBeInTheDocument();
  });

  // Player 1 should now be able to play both X and O
  // First make a move as X
  await user.click(within(app1.container).getByRole('gridcell', { name: /cell 0-0-0/i }));
  await user.click(within(app1.container).getByText('Submit'));
  let board = makeEmptyBoard();
  board[0][0][0] = 'X';
  
  // Simulate server accepting X's move and updating state
  await act(async () => {
    // First get the move response
    MockWebSocket.instances[0].onmessage?.({
      data: JSON.stringify({ 
        success: true,
        state: {
          id: 'leave-1',
          board,
          currentPlayer: 'O'
        }
      })
    });
  });
  
  await waitFor(() => expect(within(app1.container).getByRole('gridcell', { name: /cell 0-0-0/i })).toHaveTextContent('X'));

  // Then make a move as O by the same player since we're alone now
  await user.click(within(app1.container).getByRole('gridcell', { name: /cell 1-1-0/i }));
  await user.click(within(app1.container).getByText('Submit'));
  board[1][1][0] = 'O';
  
  // Simulate server accepting O's move and updating state
  await act(async () => {
    // First get the move response
    MockWebSocket.instances[0].onmessage?.({
      data: JSON.stringify({ 
        success: true,
        state: {
          id: 'leave-1',
          board,
          currentPlayer: 'X'
        }
      })
    });
  });

  await waitFor(() => expect(within(app1.container).getByRole('gridcell', { name: /cell 1-1-0/i })).toHaveTextContent('O'));
});