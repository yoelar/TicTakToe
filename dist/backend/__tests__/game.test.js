"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const game_1 = require("../src/game");
describe('3D Tic-Tac-Toe game logic', () => {
    test('creates empty board', () => {
        const b = (0, game_1.createEmptyBoard)();
        expect(b.length).toBe(3);
    });
    test('winning lines count 49', () => {
        const lines = (0, game_1.generateWinningLines)();
        expect(lines.length).toBe(49);
    });
    test('detects a space diagonal win', () => {
        const game = (0, game_1.createGame)('g1');
        (0, game_1.makeMove)(game, { player: 'X', x: 0, y: 0, z: 0 });
        (0, game_1.makeMove)(game, { player: 'O', x: 0, y: 1, z: 0 });
        (0, game_1.makeMove)(game, { player: 'X', x: 1, y: 1, z: 1 });
        (0, game_1.makeMove)(game, { player: 'O', x: 0, y: 2, z: 0 });
        (0, game_1.makeMove)(game, { player: 'X', x: 2, y: 2, z: 2 });
        expect(game.winner).toBe('X');
    });
});
