import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react';
import '@testing-library/jest-dom';
import App from '../App';

interface WebSocketHandler {
    onmessage?: ((ev: { data: string }) => void) | null;
    onerror?: (() => void) | null;
}

// Simple mock for WebSocket
class MockWebSocket implements WebSocketHandler {
    static instances: MockWebSocket[] = [];
    url: string;
    onmessage?: ((ev: { data: string }) => void) | null = null;
    onerror?: (() => void) | null = null;

    constructor(url: string) {
        this.url = url;
        MockWebSocket.instances.push(this);

        // initial empty board message
        setTimeout(() => {
            if (this.onmessage) {
                const emptyBoard = Array.from({ length: 3 }, () =>
                    Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => ''))
                );
                const state = { id: 'test', board: emptyBoard, currentPlayer: 'O' };
                this.onmessage({ data: JSON.stringify(state) });
            }
        }, 0);
    }

    close() { }
}

// patch global WebSocket and fetch
beforeAll(() => {
    // @ts-ignore
    global.WebSocket = MockWebSocket;
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
    render(<App />);
    expect(screen.getByText('Create Game')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Create Game'));
    await waitFor(() => expect(screen.getByPlaceholderText('Game ID')).toHaveValue('game-1'));
});

test('allows joining an existing game', async () => {
    render(<App />);

    // enter game id
    const input = screen.getByPlaceholderText(/game id/i);
    fireEvent.change(input, { target: { value: 'game-1' } });

    // click join
    const joinBtn = screen.getByText('Join Game');
    fireEvent.click(joinBtn);

    // wait for GameView to load
    await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument();
    });
});


test('renders layers and allows selecting and submitting a cell', async () => {
    render(<App />);

    // create game
    const createBtn = screen.getByText('Create Game');
    fireEvent.click(createBtn);

    // wait for Refresh button to appear from GameView (indicates state loaded)
    await waitFor(() => expect(screen.getByText('Refresh')).toBeInTheDocument());

    // find a cell in layer 1, top-left (0-0-0)
    const cell = screen.getByRole('gridcell', { name: /cell 0-0-0/i });
    fireEvent.click(cell);

    // Submit
    const submit = screen.getByText('Submit');
    fireEvent.click(submit);

    // after submit, the selected should be cleared and no error message
    await waitFor(() => expect(screen.queryByText(/No cell selected/i)).not.toBeInTheDocument());
});

test('shows error when clicking an occupied cell', async () => {
    render(<App />);

    // create new game
    fireEvent.click(screen.getByText('Create Game'));

    // wait for game to load
    await waitFor(() => screen.getByText('Refresh'));

    // click empty cell (0-0-0)
    const cell = screen.getByRole('gridcell', { name: /cell 0-0-0/i });
    fireEvent.click(cell);

    // submit move (places X)
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
        expect(cell).toBeDisabled();
    });
});

test('places mark in correct cell after submit', async () => {
    // Track the latest mock websocket instance
    const origFetch = global.fetch;
    MockWebSocket.instances = [];

    render(<App />);
    fireEvent.click(screen.getByText('Create Game'));

    // Wait for game to load and websocket to be created
    await waitFor(() => screen.getByText('Refresh'));
    expect(MockWebSocket.instances.length).toBeGreaterThan(0);

    // Select cell 1-2-0 (middle row, right column, bottom layer)
    const cell = screen.getByRole('gridcell', { name: /cell 1-2-0/i });
    fireEvent.click(cell);

    // Submit the move
    fireEvent.click(screen.getByText('Submit'));

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



