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
    const [assignedPlayer, setAssignedPlayer] = useState<Player | null>(null);
    const [playersConnected, setPlayersConnected] = useState<number>(0);

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
                    try {
                        const parsed = JSON.parse(ev.data);
                        if (parsed && parsed.type) {
                            // envelope messages
                            if (parsed.type === 'assign') {
                                setAssignedPlayer(parsed.player as Player);
                            } else if (parsed.type === 'players') {
                                const count = Array.isArray(parsed.players)
                                    ? parsed.players.filter((p: any) => p.connected).length
                                    : 0;
                                setPlayersConnected(count);
                            } else if (parsed.type === 'notification') {
                                setMessage(parsed.message);
                            }
                        } else {
                            const newState = parsed as GameState;
                            setState((prev) => ({
                                ...prev,
                                ...newState,
                                winner: newState.winner !== undefined && newState.winner !== null
                                    ? newState.winner
                                    : prev?.winner ?? undefined,
                            }));
                        }
                    } catch (e) {
                        // ignore non-JSON or unexpected messages
                    }
                };

                socket.onclose = () => {
                    setWs(null);
                    // Only try to reconnect if we still have the same game ID
                    // (don't reconnect if we're switching games)
                    if (!isReconnecting && state?.id) {
                        isReconnecting = true;
                        reconnectTimer = setTimeout(() => {
                            isReconnecting = false;
                            if (state?.id) { // double check game ID hasn't changed
                                connect();
                            }
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
                try {
                    const parsed = JSON.parse(ev.data);
                    if (parsed && parsed.type) {
                        if (parsed.type === 'assign') setAssignedPlayer(parsed.player as Player);
                        else if (parsed.type === 'players') {
                            const count = Array.isArray(parsed.players)
                                ? parsed.players.filter((p: any) => p.connected).length
                                : 0;
                            setPlayersConnected(count);
                        } else if (parsed.type === 'notification') setMessage(parsed.message);
                    } else {
                        const newState = parsed as GameState;
                        setState((prev) => ({
                            ...prev,
                            ...newState,
                            winner:
                                newState.winner !== undefined && newState.winner !== null
                                    ? newState.winner
                                    : prev?.winner ?? undefined,
                        }));
                    }
                } catch (e) {
                    // ignore
                }
            };
            s.onclose = () => {
                setWs(null);
                // Reset player count if this was not a voluntary disconnect
                // (voluntary disconnects will get player count updates from server)
                if (state?.id === id) {
                    setPlayersConnected(prev => Math.max(0, prev - 1));
                }
            };
            setWs(s);
        };

        makeSocket(primary);
    };

    const createGame = async () => {
        const oldGameId = state?.id;
        
        // Clear current game state first to avoid reconnection attempts
        setState(null);
        setAssignedPlayer(null);
        setPlayersConnected(0);
        
        // Ensure any existing websocket is closed before creating a new game
        if (ws) {
            // Keep a reference to send a final message
            const socket = ws;
            // Ensure onclose handles cleanup before we create new game
            await new Promise<void>((resolve) => {
                try {
                    const onclose = () => resolve();
                    // attach temporary close handler if none exists
                    const prev = socket.onclose;
                    socket.onclose = () => {
                        try { if (prev) (prev as any).call(socket); } catch (e) {}
                        onclose();
                    };
                    // Tell server we're leaving before closing
                    if (oldGameId) {
                        try { 
                            socket.send(JSON.stringify({ type: 'leave', gameId: oldGameId })); 
                        } catch (e) {}
                    }
                    try { socket.close(1000, 'Leaving game'); } catch (e) { resolve(); }
                } catch (e) { resolve(); }
            });
            setWs(null);
        }

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
        // Close any existing websocket first so server will update other clients
        // that this client has left the previous game.
        await new Promise<void>((resolve) => {
            try {
                if (!ws) return resolve();
                const onclose = () => resolve();
                const prev = ws.onclose;
                ws.onclose = () => {
                    try { if (prev) (prev as any).call(ws); } catch (e) {}
                    onclose();
                };
                try { ws.close(); } catch (e) { resolve(); }
            } catch (e) { resolve(); }
        });

        const joinRes = await fetch(`/api/game/${gameId}/join`, { method: 'POST' });
        if (!joinRes.ok) {
            const err = await joinRes.json().catch(() => null);
            return setMessage(err?.error || 'Game not found or full');
        }
        const joinJson = await joinRes.json();
        if (joinJson.player) setAssignedPlayer(joinJson.player as Player);
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
            // Use returned authoritative state from the server when available.
            // Apply it regardless of WS presence to ensure UI reflects server-evaluated
            // winner/currentPlayer immediately after a move. If a websocket broadcast
            // arrives later it will be consistent with this state.
            if (json.state) {
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
                    assignedPlayer={assignedPlayer}
                    playersConnected={playersConnected}
                />
            )}
        </div>
    );
}
