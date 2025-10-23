"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEmptyBoard = createEmptyBoard;
exports.createGame = createGame;
exports.generateWinningLines = generateWinningLines;
exports.checkWinner = checkWinner;
exports.makeMove = makeMove;
function createEmptyBoard() {
    return Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => '')));
}
function createGame(id) {
    return {
        id,
        board: createEmptyBoard(),
        currentPlayer: 'X',
    };
}
function generateWinningLines() {
    const lines = [];
    // Straight lines in layers (rows and columns)
    for (let z = 0; z < 3; z++) {
        for (let y = 0; y < 3; y++) {
            lines.push([
                [0, y, z],
                [1, y, z],
                [2, y, z],
            ]);
        }
        for (let x = 0; x < 3; x++) {
            lines.push([
                [x, 0, z],
                [x, 1, z],
                [x, 2, z],
            ]);
        }
    }
    // verticals through z
    for (let x = 0; x < 3; x++) {
        for (let y = 0; y < 3; y++) {
            lines.push([
                [x, y, 0],
                [x, y, 1],
                [x, y, 2],
            ]);
        }
    }
    // plane diagonals
    for (let z = 0; z < 3; z++) {
        lines.push([[0, 0, z], [1, 1, z], [2, 2, z]]);
        lines.push([[2, 0, z], [1, 1, z], [0, 2, z]]);
    }
    for (let x = 0; x < 3; x++) {
        lines.push([[x, 0, 0], [x, 1, 1], [x, 2, 2]]);
        lines.push([[x, 2, 0], [x, 1, 1], [x, 0, 2]]);
    }
    for (let y = 0; y < 3; y++) {
        lines.push([[0, y, 0], [1, y, 1], [2, y, 2]]);
        lines.push([[2, y, 0], [1, y, 1], [0, y, 2]]);
    }
    // space diagonals
    lines.push([[0, 0, 0], [1, 1, 1], [2, 2, 2]]);
    lines.push([[2, 0, 0], [1, 1, 1], [0, 2, 2]]);
    lines.push([[0, 2, 0], [1, 1, 1], [2, 0, 2]]);
    lines.push([[2, 2, 0], [1, 1, 1], [0, 0, 2]]);
    return lines;
}
const WINNING_LINES = generateWinningLines();
function checkWinner(board) {
    for (const line of WINNING_LINES) {
        const [a, b, c] = line;
        const v1 = board[a[0]][a[1]][a[2]];
        const v2 = board[b[0]][b[1]][b[2]];
        const v3 = board[c[0]][c[1]][c[2]];
        if (v1 && v1 === v2 && v1 === v3)
            return v1;
    }
    const anyEmpty = board.some((plane) => plane.some((row) => row.some((cell) => !cell)));
    if (!anyEmpty)
        return 'Draw';
    return undefined;
}
function makeMove(state, move) {
    if (state.winner)
        return { success: false, error: 'Game already finished' };
    if (move.player !== state.currentPlayer)
        return { success: false, error: "Not this player's turn" };
    const { x, y, z } = move;
    if (![0, 1, 2].includes(x) || ![0, 1, 2].includes(y) || ![0, 1, 2].includes(z)) {
        return { success: false, error: 'Invalid coordinates' };
    }
    if (state.board[x][y][z])
        return { success: false, error: 'Cell already occupied' };
    state.board[x][y][z] = move.player;
    const winner = checkWinner(state.board);
    if (winner)
        state.winner = winner;
    else
        state.currentPlayer = state.currentPlayer === 'X' ? 'O' : 'X';
    return { success: true };
}
