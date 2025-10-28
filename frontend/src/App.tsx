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

    // WebSocket connection and reconnection logic
    useEffect(() => {
        if (!state?.id) return;
        
        let reconnectTimer: ReturnType<typeof setTimeout>;
        let isReconnecting = false;

        const connect = () => {
            if (isReconnecting) return;
            ws?.close();
            const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
            const primary = `${protocol}://${location.host}/?gameId=${state.id}`;
            const fallback = `${protocol}://${location.hostname}:4000/?gameId=${state.id}`;
            let triedFallback = false;
            const makeSocket = (url: string) => {
                const s = new WebSocket(url);
                // if primary fails, try fallback once
                s.onerror = () => {
                    if (!triedFallback && url === primary) {
                        triedFallback = true;
                        try { s.close(); } catch (e) {}
                        makeSocket(fallback);
                    } else {
                        setMessage('WebSocket error');
                        s.close();
                    }
                };
                attachHandlers(s);
                setWs(s);
            };
            const attachHandlers = (socket: WebSocket) => {
                socket.onmessage = (ev) => {
                    const newState = JSON.parse(ev.data);
                    setState((prev) => ({
                        ...prev,
                        ...newState,
                        winner: newState.winner !== undefined && newState.winner !== null
                            ? newState.winner
                            : prev?.winner ?? null,
                    }));
                };

                socket.onclose = () => {
                    setWs(null);
                    if (!isReconnecting) {
                        isReconnecting = true;
                        reconnectTimer = setTimeout(() => {
                            isReconnecting = false;
                            connect();
                        }, 2000);
                    }
                };
            };

            makeSocket(primary);
        };

        connect();

        return () => {
            clearTimeout(reconnectTimer);
            ws?.close();
        };
    }, [state?.id]);

    // Poll fallback: if WebSocket isn't available, periodically refresh state
    useEffect(() => {
        if (!state || !state.id) return;
        if (ws) return; // websocket connected
        let cancelled = false;
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/game/${state.id}/state`);
                if (!res.ok) return;
                const js = await res.json();
                if (!cancelled) setState(js as GameState);
            } catch (e) {
                // ignore polling errors
            }
        }, 2000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [state, ws]);

    const connectWs = (id: string) => {
        ws?.close();
        const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
        const primary = `${protocol}://${location.host}/?gameId=${id}`;
        const fallback = `${protocol}://${location.hostname}:4000/?gameId=${id}`;
        let triedFallback = false;

        const makeSocket = (url: string) => {
            const s = new WebSocket(url);
            s.onerror = () => {
                if (!triedFallback && url === primary) {
                    triedFallback = true;
                    try { s.close(); } catch (e) {}
                    makeSocket(fallback);
                } else {
                    setMessage('WebSocket error');
                    s.close();
                }
            };
            s.onmessage = (ev) => {
                const newState = JSON.parse(ev.data);
                setState((prev) => ({
                    ...prev,
                    ...newState,
                    // preserve winner if server update doesn�t include one
                    winner:
                        newState.winner !== undefined && newState.winner !== null
                            ? newState.winner
                            : prev?.winner ?? null,
                }));
            };
            s.onclose = () => setWs(null);
            setWs(s);
        };

        makeSocket(primary);
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
        // board is [z][y][x]
        newBoard[z][y][x] = player;
        setState({
            ...state,
            board: newBoard,
            currentPlayer: player === 'X' ? 'O' : 'X',
        });

        const res = await fetch(`/api/game/${state.id}/move`, {
            method: 'POST',
            body: JSON.stringify({ x, y, z, player: player }),
            headers: { 'Content-Type': 'application/json' },
        });

        if (!res.ok) {
            const err = await res.json();
            setMessage(err.error);
            setState(prevState); // rollback
        } else {
            setMessage(null);
            const json = await res.json();
            if (json.state && !ws) { // Use returned state if no WebSocket
                setState(json.state as GameState);
            }
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
