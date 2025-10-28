import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import GameView from '../GameView';
import { GameState } from '../../types';

function makeEmptyBoard() {
    return Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => '')));
}

describe('GameView component', () => {
    test('renders header with current turn when no winner', () => {
        const state: GameState = { id: 'g1', board: makeEmptyBoard(), currentPlayer: 'X' };
        const setState = jest.fn();
        const setMessage = jest.fn();
        const submitMove = jest.fn();
        const createGame = jest.fn();
        render(
            <GameView
                state={state}
                selected={null}
                setSelected={() => {}}
                setMessage={setMessage}
                submitMove={submitMove}
                createGame={createGame}
                setState={setState}
            />
        );

        expect(screen.getByText(/Game: g1/)).toBeInTheDocument();
        expect(screen.getByText(/Current Turn: X/)).toBeInTheDocument();
        expect(screen.getByText(/Status: Ongoing/)).toBeInTheDocument();
    });

    test('shows winner and Play Again button and disables submit', () => {
        const state: GameState = { id: 'g2', board: makeEmptyBoard(), currentPlayer: 'O', winner: 'O' };
        const setState = jest.fn();
        const setMessage = jest.fn();
        const submitMove = jest.fn();
        const createGame = jest.fn();
        render(
            <GameView
                state={state}
                selected={[0, 0, 0]}
                setSelected={() => {}}
                setMessage={setMessage}
                submitMove={submitMove}
                createGame={createGame}
                setState={setState}
            />
        );

        expect(screen.getByText(/Winner: O/)).toBeInTheDocument();
        const playAgain = screen.getByText(/Play Again/);
        fireEvent.click(playAgain);
        expect(createGame).toHaveBeenCalled();

        // Submit should be disabled because winner exists
        expect(screen.getByText('Submit')).toBeDisabled();
    });

    test('refresh button fetches state and calls setState/setMessage', async () => {
        const state: GameState = { id: 'g3', board: makeEmptyBoard(), currentPlayer: 'X' };
        const setState = jest.fn();
        const setMessage = jest.fn();
        const submitMove = jest.fn();
        const createGame = jest.fn();

        // mock fetch for refresh endpoint
        (global.fetch as jest.Mock) = jest.fn((input: RequestInfo) => {
            const url = String(input);
            if (url.endsWith('/state')) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'g3', board: makeEmptyBoard(), currentPlayer: 'O' }) });
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
        });

        render(
            <GameView
                state={state}
                selected={null}
                setSelected={() => {}}
                setMessage={setMessage}
                submitMove={submitMove}
                createGame={createGame}
                setState={setState}
            />
        );

        const refresh = screen.getByText('Refresh');
        fireEvent.click(refresh);

        await waitFor(() => expect(setState).toHaveBeenCalled());
        expect(setMessage).toHaveBeenCalled();
    });

    test('submit enabled when selected and no winner calls submitMove', () => {
        const state: GameState = { id: 'g4', board: makeEmptyBoard(), currentPlayer: 'X' };
        const setState = jest.fn();
        const setMessage = jest.fn();
        const submitMove = jest.fn();
        const createGame = jest.fn();
        render(
            <GameView
                state={state}
                selected={[2, 2, 2]}
                setSelected={() => {}}
                setMessage={setMessage}
                submitMove={submitMove}
                createGame={createGame}
                setState={setState}
            />
        );

        const submitBtn = screen.getByText('Submit');
        expect(submitBtn).toBeEnabled();
        fireEvent.click(submitBtn);
        expect(submitMove).toHaveBeenCalled();
    });
});
