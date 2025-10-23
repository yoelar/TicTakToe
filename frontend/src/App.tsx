import React, { useEffect, useState } from 'react';
import './styles.css';

type Player = 'X' | 'O';

interface GameState {
  id: string;
  board: string[][][];
  currentPlayer: Player;
  winner?: Player | 'Draw';
}

export default function App() {
  const [gameId, setGameId] = useState<string>('');
  const [state, setState] = useState<GameState | null>(null);
  const [selected, setSelected] = useState<[number, number, number] | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => () => { if (ws) ws.close(); }, [ws]);

  const connectWs = (id: string) => {
    if (ws) ws.close();
    const socket = new WebSocket(`ws://${location.host}/?gameId=${id}`);
    socket.onmessage = (ev) => setState(JSON.parse(ev.data));
    socket.onerror = () => setMessage('WebSocket error');
    setWs(socket);
  };

  const createGame = async () => {
    const res = await fetch('/api/game', { method: 'POST' });
    const data = await res.json();
    setGameId(data.gameId);
    const s = await fetch(`/api/game/${data.gameId}/state`);
    const js = await s.json();
    setState(js);
    connectWs(data.gameId);
  };

  const joinGame = async () => {
    if (!gameId) return setMessage('Enter game ID');
    const joinRes = await fetch(`/api/game/${gameId}/join`, { method: 'POST' });
    if (!joinRes.ok) return setMessage('Game not found');
    const s = await fetch(`/api/game/${gameId}/state`);
    const js = await s.json();
    setState(js);
    connectWs(gameId);
  };

  const submitMove = async () => {
    if (!selected || !state) return setMessage('No cell selected');
    const [x, y, z] = selected;
    const player = state.currentPlayer;
    const res = await fetch(`/api/game/${state.id}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player, x, y, z }),
    });
    if (!res.ok) {
      const err = await res.json();
      setMessage(err.error);
    } else {
      setMessage(null);
    }
    setSelected(null);
  };

  const resetLocal = () => { setState(null); setGameId(''); setSelected(null); setMessage(null); if (ws) { ws.close(); setWs(null); } };

  return (
    <div className="app">
      <div className="controls">
        <button onClick={createGame}>Create Game</button>
        <input value={gameId} onChange={(e) => setGameId(e.target.value)} placeholder="Game ID" />
        <button onClick={joinGame}>Join Game</button>
        <button onClick={resetLocal}>New Game (local)</button>
      </div>
      {message && <div className="message">{message}</div>}
      {state && (
        <div>
          <div>Game: {state.id}</div>
          <div>Current Turn: {state.currentPlayer}</div>
          <div>Status: {state.winner ? state.winner : 'Ongoing'}</div>
          <div className="layers">
            {[0, 1, 2].map((z) => (
              <div key={z} className="layer">
                <div className="layer-title">Layer {z + 1}</div>
                <div className="grid" role="grid" aria-label={`Layer ${z + 1}`}>
                  {state.board.map((plane, x) =>
                    plane.map((row, y) => {
                      const occupied = !!state.board[x][y][z];
                      const isSelected = selected && selected[0] === x && selected[1] === y && selected[2] === z;
                      return (
                        <button
                          key={`${x}-${y}-${z}`}
                          role="gridcell"
                          aria-label={`cell ${x}-${y}-${z}`}
                          className={`cell ${occupied ? 'occupied' : ''} ${isSelected ? 'selected' : ''}`}
                          onClick={() => {
                            if (state.winner) return setMessage('Game finished');
                            if (occupied) return setMessage('Cell already occupied');
                            setSelected([x, y, z]);
                            setMessage(null);
                          }}
                          disabled={!!state.winner || occupied}
                        >
                          {state.board[x][y][z]}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="actions">
            <button onClick={submitMove} disabled={!selected || !!state.winner}>Submit</button>
            <button onClick={() => { if (state) { fetch(`/api/game/${state.id}/state`).then(r=>r.json()).then(setState); } }}>Refresh</button>
            {state.winner && <button onClick={() => { createGame(); }}>Play Again</button>}
          </div>
        </div>
      )}
    </div>
  );
}
