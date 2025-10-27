import React, { useEffect, useState } from 'react';
import './styles.css';
import Controls from './components/Controls';
import GameView from './components/GameView';
import { GameState, Board, Player } from './types';

export default function App(): React.ReactElement {
    const [gameId, setGameId] = useState<string>('');
    const [state, setState] = useState<GameState | null>(null);
    const [selected, setSelected] = useState<[number, number, number] | null>(null);
    const [ws, setWs] = useState<WebSocket | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    useEffect(() => () => { ws?.close(); }, [ws]);

    const connectWs = (id: string) => {
        ws?.close();
        const socket = new WebSocket(`ws://${location.host}/?gameId=${id}`);
        socket.onmessage = (ev) => {
            const newState = JSON.parse(ev.data);
            setState((prev) => ({
                ...prev,
                ...newState,
                // preserve winner if server update doesn’t include one
                winner:
                    newState.winner !== undefined && newState.winner !== null
                        ? newState.winner
                        : prev?.winner ?? null,
            }));
        };
        socket.onerror = () => setMessage('WebSocket error');
        setWs(socket);
    };

    const createGame = async () => {
        const res = await fetch('/api/game', { method: 'POST' });
        const data = await res.json();
        setGameId(data.gameId);
        const s = await fetch(`/api/game/${data.gameId}/state`);
        const js = await s.json();
        setState(js as GameState);
        connectWs(data.gameId);
    };

    const joinGame = async () => {
        if (!gameId) return setMessage('Enter game ID');
        const joinRes = await fetch(`/api/game/${gameId}/join`, { method: 'POST' });
        if (!joinRes.ok) return setMessage('Game not found');
        const s = await fetch(`/api/game/${gameId}/state`);
        const js = await s.json();
        setState(js as GameState);
        connectWs(gameId);
    };

    const submitMove = async () => {
        if (!selected || !state) return setMessage('No cell selected');
        const [x, y, z] = selected;
        const player: Player = state.currentPlayer;
        const prevState = state;
        const newBoard: Board = state.board.map((plane) => plane.map((row) => row.slice()));
        newBoard[x][y][z] = player;
        setState({
            ...state,
            board: newBoard,
            currentPlayer: player === 'X' ? 'O' : 'X',
        });

        const res = await fetch(`/api/game/${state.id}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ player, x, y, z }),
        });

        if (!res.ok) {
            const err = await res.json();
            setMessage(err.error);
            setState(prevState); // rollback
        } else {
            setMessage(null);
        }
        setSelected(null);
    };

    const resetLocal = () => {
        setState(null);
        setGameId('');
        setSelected(null);
        setMessage(null);
        ws?.close();
        setWs(null);
    };

    return (
        <div className="app">
            <Controls
                gameId={gameId}
                setGameId={setGameId}
                createGame={createGame}
                joinGame={joinGame}
                resetLocal={resetLocal}
            />
            {message && <div className="message">{message}</div>}

            {state?.board && (
                <GameView
                    state={state}
                    selected={selected}
                    setSelected={setSelected}
                    setMessage={setMessage}
                    submitMove={submitMove}
                    createGame={createGame}
                    setState={setState} 
                />
            )}
        </div>
    );
}
