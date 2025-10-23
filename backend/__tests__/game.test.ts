import { createEmptyBoard, createGame, generateWinningLines, makeMove, checkWinner } from '../src/game';

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

  test('detects draw', () => {
    const game = createGame('g2');
    const players: ('X' | 'O')[] = ['X','O'];
    let p = 0;
    for (let x=0;x<3;x++) for (let y=0;y<3;y++) for (let z=0;z<3;z++) {
      game.board[x][y][z] = players[p%2];
      p++;
    }
    const winner = checkWinner(game.board);
    expect(winner).toBe('Draw');
  });
});
