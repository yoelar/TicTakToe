"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = App;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
require("./styles.css");
function App() {
    const [gameId, setGameId] = (0, react_1.useState)('');
    const [state, setState] = (0, react_1.useState)(null);
    const [selected, setSelected] = (0, react_1.useState)(null);
    const [ws, setWs] = (0, react_1.useState)(null);
    const [message, setMessage] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => () => { if (ws)
        ws.close(); }, [ws]);
    const connectWs = (id) => {
        if (ws)
            ws.close();
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
        if (!gameId)
            return setMessage('Enter game ID');
        const joinRes = await fetch(`/api/game/${gameId}/join`, { method: 'POST' });
        if (!joinRes.ok)
            return setMessage('Game not found');
        const s = await fetch(`/api/game/${gameId}/state`);
        const js = await s.json();
        setState(js);
        connectWs(gameId);
    };
    const submitMove = async () => {
        if (!selected || !state)
            return setMessage('No cell selected');
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
        }
        else {
            setMessage(null);
        }
        setSelected(null);
    };
    const resetLocal = () => { setState(null); setGameId(''); setSelected(null); setMessage(null); if (ws) {
        ws.close();
        setWs(null);
    } };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "app", children: [(0, jsx_runtime_1.jsxs)("div", { className: "controls", children: [(0, jsx_runtime_1.jsx)("button", { onClick: createGame, children: "Create Game" }), (0, jsx_runtime_1.jsx)("input", { value: gameId, onChange: (e) => setGameId(e.target.value), placeholder: "Game ID" }), (0, jsx_runtime_1.jsx)("button", { onClick: joinGame, children: "Join Game" }), (0, jsx_runtime_1.jsx)("button", { onClick: resetLocal, children: "New Game (local)" })] }), message && (0, jsx_runtime_1.jsx)("div", { className: "message", children: message }), state && ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("div", { children: ["Game: ", state.id] }), (0, jsx_runtime_1.jsxs)("div", { children: ["Current Turn: ", state.currentPlayer] }), (0, jsx_runtime_1.jsxs)("div", { children: ["Status: ", state.winner ? state.winner : 'Ongoing'] }), (0, jsx_runtime_1.jsx)("div", { className: "layers", children: [0, 1, 2].map((z) => ((0, jsx_runtime_1.jsxs)("div", { className: "layer", children: [(0, jsx_runtime_1.jsxs)("div", { className: "layer-title", children: ["Layer ", z + 1] }), (0, jsx_runtime_1.jsx)("div", { className: "grid", role: "grid", "aria-label": `Layer ${z + 1}`, children: state.board.map((plane, x) => plane.map((row, y) => {
                                        const occupied = !!state.board[x][y][z];
                                        const isSelected = selected && selected[0] === x && selected[1] === y && selected[2] === z;
                                        return ((0, jsx_runtime_1.jsx)("button", { role: "gridcell", "aria-label": `cell ${x}-${y}-${z}`, className: `cell ${occupied ? 'occupied' : ''} ${isSelected ? 'selected' : ''}`, onClick: () => {
                                                if (state.winner)
                                                    return setMessage('Game finished');
                                                if (occupied)
                                                    return setMessage('Cell already occupied');
                                                setSelected([x, y, z]);
                                                setMessage(null);
                                            }, disabled: !!state.winner || occupied, children: state.board[x][y][z] }, `${x}-${y}-${z}`));
                                    })) })] }, z))) }), (0, jsx_runtime_1.jsxs)("div", { className: "actions", children: [(0, jsx_runtime_1.jsx)("button", { onClick: submitMove, disabled: !selected || !!state.winner, children: "Submit" }), (0, jsx_runtime_1.jsx)("button", { onClick: () => { if (state) {
                                    fetch(`/api/game/${state.id}/state`).then(r => r.json()).then(setState);
                                } }, children: "Refresh" }), state.winner && (0, jsx_runtime_1.jsx)("button", { onClick: () => { createGame(); }, children: "Play Again" })] })] }))] }));
}
