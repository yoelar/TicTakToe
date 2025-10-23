import React from 'react';

interface ControlsProps {
    gameId: string;
    setGameId: (id: string) => void;
    createGame: () => Promise<void> | void;
    joinGame: () => Promise<void> | void;
    resetLocal: () => void;
}

export default function Controls({ gameId, setGameId, createGame, joinGame, resetLocal }: ControlsProps) {
    return (
        <div className="controls">
            <button onClick={createGame}>Create Game</button>
            <input value={gameId} onChange={(e) => setGameId(e.target.value)} placeholder="Game ID" />
            <button onClick={joinGame}>Join Game</button>
            <button onClick={resetLocal}>New Game (local)</button>
        </div>
    );
}
