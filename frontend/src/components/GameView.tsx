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
    setState: (js: GameState) => void;
}

// --- Header Component ---
const GameHeader: React.FC<{ state: GameState }> = ({ state }) => (
    <div className="header">
        <div>Game: {state.id}</div>
        {state.winner ? (
            <div>Winner: {state.winner}</div>
        ) : (
            <>
                <div>Current Turn: {state.currentPlayer}</div>
                <div>Status: Ongoing</div>
            </>
        )}
    </div>
);

// --- Board Component ---
const BoardLayers: React.FC<{
    state: GameState;
    selected: [number, number, number] | null;
    setSelected: (s: [number, number, number] | null) => void;
    setMessage: (m: string | null) => void;
}> = ({ state, selected, setSelected, setMessage }) => (
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
);

// --- Actions Component ---
const GameActions: React.FC<{
    state: GameState;
    selected: [number, number, number] | null;
    submitMove: () => Promise<void> | void;
    createGame: () => Promise<void> | void;
    setState: (js: GameState) => void;
    setMessage: (m: string | null) => void;
}> = ({ state, selected, submitMove, createGame, setState, setMessage }) => (
    <div className="actions">
        <button onClick={submitMove} disabled={!selected || !!state.winner}>
            Submit
        </button>

        <button
            onClick={async () => {
                try {
                    const res = await fetch(`/api/game/${state.id}/state`);
                    const m = await res.json();
                    setState(m as GameState);
                    setMessage(typeof m === 'string' ? m : JSON.stringify(m));
                } catch (err) {
                    setMessage(`Error fetching game state: ${err}`);
                }
            }}
        >
            Refresh
        </button>

        {state.winner && <button onClick={createGame}>Play Again</button>}
    </div>
);

// --- Main GameView Component ---
export default function GameView(props: GameViewProps) {
    return (
        <div className="game-view">
            <GameHeader state={props.state} />
            <BoardLayers
                state={props.state}
                selected={props.selected}
                setSelected={props.setSelected}
                setMessage={props.setMessage}
            />
            <GameActions
                state={props.state}
                selected={props.selected}
                submitMove={props.submitMove}
                createGame={props.createGame}
                setState={props.setState}
                setMessage={props.setMessage}
            />
        </div>
    );
}
