import React from 'react';
import BoardLayers from './BoardLayers';
import { GameState } from '../types';

interface GameViewProps {
    state: GameState;
    selected: [number, number, number] | null;
    setSelected: (s: [number, number, number] | null) => void;
    setMessage: (m: string | null) => void;
    submitMove: () => Promise<void> | void;
    createGame: () => Promise<void> | void;
    setState: (js: GameState) => void;
    assignedPlayer?: 'X' | 'O' | null;
    playersConnected?: number;
}

const GameHeader: React.FC<{ state: GameState; assignedPlayer?: 'X' | 'O' | null; playersConnected?: number }> = ({ state, assignedPlayer, playersConnected }) => (
    <div className="header">
        <div>Game: {state.id}</div>
        {typeof assignedPlayer !== 'undefined' && (
            <div>Your side: {assignedPlayer ?? 'unassigned'}</div>
        )}
        {typeof playersConnected !== 'undefined' && (
            <div>Players connected: {playersConnected}</div>
        )}
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

const GameActions: React.FC<{
    state: GameState;
    selected: [number, number, number] | null;
    submitMove: () => Promise<void> | void;
    createGame: () => Promise<void> | void;
    setState: (js: GameState) => void;
    setMessage: (m: string | null) => void;
    assignedPlayer?: 'X' | 'O' | null;
    playersConnected?: number;
}> = ({ state, selected, submitMove, createGame, setState, setMessage, assignedPlayer, playersConnected }) => (
    <div className="actions">
        <button onClick={submitMove} disabled={!selected || !!state.winner || (playersConnected === 2 && assignedPlayer !== state.currentPlayer)}>
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

export default function GameView(props: GameViewProps) {
    return (
        <div className="game-view">
            <GameHeader state={props.state} assignedPlayer={props.assignedPlayer} playersConnected={props.playersConnected} />
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
                assignedPlayer={props.assignedPlayer}
                playersConnected={props.playersConnected}
            />
        </div>
    );
}
