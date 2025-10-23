import React from 'react';
import LayerGrid from './LayerGrid';
import { GameState } from '../types';

interface GameViewProps {
    state: GameState;
    selected: [number, number, number] | null;
    setSelected: (s: [number, number, number] | null) => void;
    setMessage: (m: string | null) => void;
    submitMove: () => Promise<void> | void;
    createGame: () => Promise<void> | void;
}

export default function GameView({ state, selected, setSelected, setMessage, submitMove, createGame }: GameViewProps) {
    return (
        <div>
            <div>Game: {state.id}</div>
            <div>Current Turn: {state.currentPlayer}</div>
            <div>Status: {state.winner ?? 'Ongoing'}</div>

            <div className="layers">
                {[0, 1, 2].map((z) => (
                    <LayerGrid
                        key={z}
                        z={z}
                        state={state}
                        selected={selected}
                        setSelected={setSelected}
                        setMessage={setMessage}
                    />
                ))}
            </div>

            <div className="actions">
                <button onClick={submitMove} disabled={!selected || !!state.winner}>
                    Submit
                </button>
                <button onClick={() => fetch(`/api/game/${state.id}/state`).then((r) => r.json()).then((m) => setMessage(String(m)))}>
                    Refresh
                </button>
                {state.winner && <button onClick={createGame}>Play Again</button>}
            </div>
        </div>
    );
}

