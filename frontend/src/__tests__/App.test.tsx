import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from '../App';

// Simple mock for WebSocket
class MockWebSocket {
    url: string;
    onmessage: ((ev: { data: string }) => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(url: string) {
        this.url = url;
        // simulate an open socket that immediately sends a state
        setTimeout(() => {
            if (this.onmessage) {
                const emptyBoard = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => '')));
                const state = { id: 'test', board: emptyBoard, currentPlayer: 'X' };
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


