"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("@testing-library/react");
require("@testing-library/jest-dom");
const GameView_1 = __importDefault(require("../GameView"));
function makeEmptyBoard() {
    return Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => '')));
}
describe('GameView component', () => {
    test('renders header with current turn when no winner', () => {
        const state = { id: 'g1', board: makeEmptyBoard(), currentPlayer: 'X' };
        const setState = jest.fn();
        const setMessage = jest.fn();
        const submitMove = jest.fn();
        const createGame = jest.fn();
        (0, react_1.render)((0, jsx_runtime_1.jsx)(GameView_1.default, { state: state, selected: null, setSelected: () => { }, setMessage: setMessage, submitMove: submitMove, createGame: createGame, setState: setState }));
        expect(react_1.screen.getByText(/Game: g1/)).toBeInTheDocument();
        expect(react_1.screen.getByText(/Current Turn: X/)).toBeInTheDocument();
        expect(react_1.screen.getByText(/Status: Ongoing/)).toBeInTheDocument();
    });
    test('shows winner and Play Again button and disables submit', () => {
        const state = { id: 'g2', board: makeEmptyBoard(), currentPlayer: 'O', winner: 'O' };
        const setState = jest.fn();
        const setMessage = jest.fn();
        const submitMove = jest.fn();
        const createGame = jest.fn();
        (0, react_1.render)((0, jsx_runtime_1.jsx)(GameView_1.default, { state: state, selected: [0, 0, 0], setSelected: () => { }, setMessage: setMessage, submitMove: submitMove, createGame: createGame, setState: setState }));
        expect(react_1.screen.getByText(/Winner: O/)).toBeInTheDocument();
        const playAgain = react_1.screen.getByText(/Play Again/);
        react_1.fireEvent.click(playAgain);
        expect(createGame).toHaveBeenCalled();
        // Submit should be disabled because winner exists
        expect(react_1.screen.getByText('Submit')).toBeDisabled();
    });
    test('refresh button fetches state and calls setState/setMessage', async () => {
        const state = { id: 'g3', board: makeEmptyBoard(), currentPlayer: 'X' };
        const setState = jest.fn();
        const setMessage = jest.fn();
        const submitMove = jest.fn();
        const createGame = jest.fn();
        // mock fetch for refresh endpoint
        global.fetch = jest.fn((input) => {
            const url = String(input);
            if (url.endsWith('/state')) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'g3', board: makeEmptyBoard(), currentPlayer: 'O' }) });
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
        });
        (0, react_1.render)((0, jsx_runtime_1.jsx)(GameView_1.default, { state: state, selected: null, setSelected: () => { }, setMessage: setMessage, submitMove: submitMove, createGame: createGame, setState: setState }));
        const refresh = react_1.screen.getByText('Refresh');
        react_1.fireEvent.click(refresh);
        await (0, react_1.waitFor)(() => expect(setState).toHaveBeenCalled());
        expect(setMessage).toHaveBeenCalled();
    });
    test('submit enabled when selected and no winner calls submitMove', () => {
        const state = { id: 'g4', board: makeEmptyBoard(), currentPlayer: 'X' };
        const setState = jest.fn();
        const setMessage = jest.fn();
        const submitMove = jest.fn();
        const createGame = jest.fn();
        (0, react_1.render)((0, jsx_runtime_1.jsx)(GameView_1.default, { state: state, selected: [2, 2, 2], setSelected: () => { }, setMessage: setMessage, submitMove: submitMove, createGame: createGame, setState: setState }));
        const submitBtn = react_1.screen.getByText('Submit');
        expect(submitBtn).toBeEnabled();
        react_1.fireEvent.click(submitBtn);
        expect(submitMove).toHaveBeenCalled();
    });
});
