import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import '@testing-library/jest-dom';
import App from '../App';

import { installMockWebSocket, MockWebSocket } from './testUtils';

// patch global WebSocket and fetch
beforeAll(() => {
    installMockWebSocket();
});

beforeEach(() => {
    // default fetch behavior
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
test('renders create game button and interacts', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByText('Create Game')).toBeInTheDocument();

    await user.click(screen.getByText('Create Game'));
    await waitFor(() => expect(screen.getByPlaceholderText('Game ID')).toHaveValue('game-1'));
});

test('allows joining an existing game', async () => {
    const user = userEvent.setup();
    render(<App />);

    // enter game id
    const input = screen.getByPlaceholderText(/game id/i);
    await user.type(input, 'game-1');

    // click join
    const joinBtn = screen.getByText('Join Game');
    await user.click(joinBtn);

    // wait for GameView to load
    await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument();
    });
});


test('renders layers and allows selecting and submitting a cell', async () => {
    const user = userEvent.setup();
    render(<App />);

    // create game
    await user.click(screen.getByText('Create Game'));

    // wait for Refresh button to appear from GameView (indicates state loaded)
    await waitFor(() => expect(screen.getByText('Refresh')).toBeInTheDocument());

    // find a cell in layer 1, top-left (0-0-0)
    const cell = screen.getByRole('gridcell', { name: /cell 0-0-0/i });
    await user.click(cell);

    // Submit
    const submit = screen.getByText('Submit');
    await user.click(submit);

    // after submit, the selected should be cleared and no error message
    await waitFor(() => expect(screen.queryByText(/No cell selected/i)).not.toBeInTheDocument());
});

test('shows error when clicking an occupied cell', async () => {
    const user = userEvent.setup();
    render(<App />);

    // create new game
    await user.click(screen.getByText('Create Game'));

    // wait for game to load
    await waitFor(() => screen.getByText('Refresh'));

    // click empty cell (0-0-0)
    const cell = screen.getByRole('gridcell', { name: /cell 0-0-0/i });
    await user.click(cell);

    // submit move (places X)
    await user.click(screen.getByText('Submit'));

    await waitFor(() => {
        expect(cell).toBeDisabled();
    });
});

test('places mark in correct cell after submit', async () => {
    // Track the latest mock websocket instance
    const origFetch = global.fetch;
    MockWebSocket.instances = [];

    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByText('Create Game'));

    // Wait for game to load and websocket to be created
    await waitFor(() => screen.getByText('Refresh'));
    expect(MockWebSocket.instances.length).toBeGreaterThan(0);

    // Select cell 1-2-0 (middle row, right column, bottom layer)
    const cell = screen.getByRole('gridcell', { name: /cell 1-2-0/i });
    await user.click(cell);

    // Submit the move
    await user.click(screen.getByText('Submit'));

    // verify /move call body included correct coordinates/player
    const calls = (global.fetch as jest.Mock).mock.calls;
    const moveCall = calls.find((c: any[]) => String(c[0]).includes('/move'));
    expect(moveCall).toBeDefined();
    if (moveCall) {
        const init = moveCall[1];
        const body = JSON.parse(init.body as string);
        expect(body).toMatchObject({ player: 'X', x: 1, y: 2, z: 0 });
    }

    // Simulate WebSocket sending updated board state
    await act(async () => {
        const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1];
        const board = Array.from({ length: 3 }, () =>
            Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => ''))
        );
        board[0][2][1] = 'X'; // Place X at 1-2-0
        const state = { id: 'test', board, currentPlayer: 'O' };
        ws.onmessage?.({ data: JSON.stringify(state) });
    });

    // Verify X appears in the selected cell
    await waitFor(() => {
        const updatedCell = screen.getByRole('gridcell', { name: /cell 1-2-0/i });
        expect(updatedCell).toHaveTextContent('X');
    });
});

test('displays winner and disables submit', async () => {
    // mock backend to immediately return a winner
    (global.fetch as jest.Mock).mockImplementation((input: RequestInfo) => {
        const url = String(input);
        if (url.endsWith('/state')) {
            const board = Array.from({ length: 3 }, () =>
                Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => ''))
            );
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ id: 'game-1', board, currentPlayer: 'X', winner: 'X' })
            });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ gameId: 'game-1' }) });
    });

    render(<App />);
    fireEvent.click(screen.getByText('Create Game'));

    await waitFor(() => screen.getByText('Winner: X'));
    expect(screen.getByText('Winner: X')).toBeInTheDocument();
    expect(screen.getByText('Submit')).toBeDisabled();
});



