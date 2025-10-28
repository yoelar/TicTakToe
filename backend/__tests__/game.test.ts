import { createEmptyBoard, createGame, generateWinningLines, makeMove, Move } from '../src/game';

describe('3D Tic-Tac-Toe game logic', () => {
  test('creates empty board', () => {
    const b = createEmptyBoard();
    expect(b.length).toBe(3);
  });

  test('winning lines count 49', () => {
    const lines = generateWinningLines();
    expect(lines.length).toBe(49);
  });

  test('detects a space diagonal win', () => {
    const game = createGame('g1');
    makeMove(game, { player: 'X', x: 0, y: 0, z: 0 });
    makeMove(game, { player: 'O', x: 0, y: 1, z: 0 });
    makeMove(game, { player: 'X', x: 1, y: 1, z: 1 });
    makeMove(game, { player: 'O', x: 0, y: 2, z: 0 });
    makeMove(game, { player: 'X', x: 2, y: 2, z: 2 });
    expect(game.winner).toBe('X');
  });

  test('submit places the current player mark in the selected cell', () => {
    const game = createGame('g3');
    // initial currentPlayer should be X
    expect(game.currentPlayer).toBe('X');
    const move: Move = { player: 'X', x: 1, y: 2, z: 0 };
    const res = makeMove(game, move);
    expect(res.success).toBe(true);
    // the board must have the player's mark at the selected coordinates
    expect(game.board[0][2][1]).toBe('X');
    // and the current player should have switched to O
    expect(game.currentPlayer).toBe('O');
  });
});
