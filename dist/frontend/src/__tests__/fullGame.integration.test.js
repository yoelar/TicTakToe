"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("@testing-library/react");
const react_2 = require("react");
const user_event_1 = __importDefault(require("@testing-library/user-event"));
require("@testing-library/jest-dom");
const App_1 = __importDefault(require("../App"));
// Minimal MockWebSocket copied from App.test to control server messages
class MockWebSocket {
    constructor(url) {
        this.onmessage = null;
        this.onerror = null;
        this.url = url;
        MockWebSocket.instances.push(this);
    }
    close() { }
}
MockWebSocket.instances = [];
beforeAll(() => {
    // @ts-ignore
    global.WebSocket = MockWebSocket;
});
beforeEach(() => {
    MockWebSocket.instances = [];
    // @ts-ignore
    global.fetch = jest.fn((input, init) => {
        const url = String(input);
        if (url.endsWith('/api/game') && init?.method === 'POST') {
            return Promise.resolve({ ok: true, json: () => Promise.resolve({ gameId: 'game-1' }) });
        }
        if (url.endsWith('/state')) {
            const emptyBoard = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => "")));
            const state = { id: 'game-1', board: emptyBoard, currentPlayer: 'X' };
            return Promise.resolve({ ok: true, json: () => Promise.resolve(state) });
        }
        if (url.includes('/move')) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
});
afterEach(() => {
    // @ts-ignore
    jest.clearAllMocks();
});
// Helper to send server state via websocket
function sendServerState(ws, board, currentPlayer, winner) {
    const state = { id: 'game-1', board, currentPlayer };
    if (winner)
        state.winner = winner;
    ws.onmessage?.({ data: JSON.stringify(state) });
}
function makeEmptyBoard() {
    return Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => '')));
}
test('full game flow leads to X winning (space diagonal)', async () => {
    (0, react_1.render)((0, jsx_runtime_1.jsx)(App_1.default, {}));
    const user = user_event_1.default.setup();
    // Create game
    await user.click(react_1.screen.getByText('Create Game'));
    await (0, react_1.waitFor)(() => react_1.screen.getByText('Refresh'));
    expect(MockWebSocket.instances.length).toBeGreaterThan(0);
    const ws = MockWebSocket.instances[0];
    // We'll simulate three X moves forming the space diagonal: (0,0,0), (1,1,1), (2,2,2)
    // Interleave O moves that don't block the diagonal.
    // 1) X at 0-0-0
    await user.click(react_1.screen.getByRole('gridcell', { name: /cell 0-0-0/i }));
    await user.click(react_1.screen.getByText('Submit'));
    // server responds with X at 0-0-0 and currentPlayer O
    let board = makeEmptyBoard();
    board[0][0][0] = 'X'; // z=0,y=0,x=0
    await (0, react_2.act)(async () => sendServerState(ws, board, 'O'));
    await (0, react_1.waitFor)(() => expect(react_1.screen.getByRole('gridcell', { name: /cell 0-0-0/i })).toHaveTextContent('X'));
    // 2) O at 0-1-0 (some other cell)
    // simulate opponent move delivered by server
    board[0][1][0] = 'O';
    await (0, react_2.act)(async () => sendServerState(ws, board, 'X'));
    await (0, react_1.waitFor)(() => expect(react_1.screen.getByRole('gridcell', { name: /cell 0-1-0/i })).toHaveTextContent('O'));
    // 3) X at 1-1-1
    await user.click(react_1.screen.getByRole('gridcell', { name: /cell 1-1-1/i }));
    await user.click(react_1.screen.getByText('Submit'));
    board[1][1][1] = 'X';
    await (0, react_2.act)(async () => sendServerState(ws, board, 'O'));
    await (0, react_1.waitFor)(() => expect(react_1.screen.getByRole('gridcell', { name: /cell 1-1-1/i })).toHaveTextContent('X'));
    // 4) O random
    board[0][2][0] = 'O';
    await (0, react_2.act)(async () => sendServerState(ws, board, 'X'));
    await (0, react_1.waitFor)(() => expect(react_1.screen.getByRole('gridcell', { name: /cell 0-2-0/i })).toHaveTextContent('O'));
    // 5) X at 2-2-2 winning move
    await user.click(react_1.screen.getByRole('gridcell', { name: /cell 2-2-2/i }));
    await user.click(react_1.screen.getByText('Submit'));
    board[2][2][2] = 'X';
    // server announces winner
    await (0, react_2.act)(async () => sendServerState(ws, board, 'X', 'X'));
    // Winner UI appears
    await (0, react_1.waitFor)(() => expect(react_1.screen.getByText(/Winner: X/)).toBeInTheDocument());
    expect(react_1.screen.getByText('Submit')).toBeDisabled();
});
