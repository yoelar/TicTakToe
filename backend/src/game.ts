export type Player = 'X' | 'O';

export interface Move {
    player: Player;
    x: number;
    y: number;
    z: number;
}

export interface GameState {
    id: string;
    board: string[][][]; // [z][y][x]
    currentPlayer: Player;
    winner?: Player | 'Draw';
}

// Create empty 3x3x3 board
export function createEmptyBoard(): string[][][] {
    return Array.from({ length: 3 }, () =>
        Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => ''))
    );
}

// optional: sanitize before sending to clients
export function sanitizeBoard(board: string[][][]): string[][][] {
    return board.map(layer =>
        layer.map(row => row.map(cell => (cell === null || cell === undefined ? '' : cell)))
    );
}
export function createGame(id: string): GameState {
    return {
        id,
        board: createEmptyBoard(),
        currentPlayer: 'X',
    };
}

type Coord = [number, number, number]; // [x, y, z]

// Generate winning lines using frontend-friendly orientation (z outermost)
export function generateWinningLines(): Coord[][] {
    const lines: Coord[][] = [];

    // Straight lines within each layer (z fixed)
    for (let z = 0; z < 3; z++) {
        // Rows (x changes)
        for (let y = 0; y < 3; y++) {
            lines.push([
                [0, y, z],
                [1, y, z],
                [2, y, z],
            ]);
        }
        // Columns (y changes)
        for (let x = 0; x < 3; x++) {
            lines.push([
                [x, 0, z],
                [x, 1, z],
                [x, 2, z],
            ]);
        }
        // Diagonals in this layer
        lines.push([
            [0, 0, z],
            [1, 1, z],
            [2, 2, z],
        ]);
        lines.push([
            [2, 0, z],
            [1, 1, z],
            [0, 2, z],
        ]);
    }

    // Vertical lines (through layers)
    for (let x = 0; x < 3; x++) {
        for (let y = 0; y < 3; y++) {
            lines.push([
                [x, y, 0],
                [x, y, 1],
                [x, y, 2],
            ]);
        }
    }

    // Diagonals through layers
    for (let x = 0; x < 3; x++) {
        lines.push([
            [x, 0, 0],
            [x, 1, 1],
            [x, 2, 2],
        ]);
        lines.push([
            [x, 2, 0],
            [x, 1, 1],
            [x, 0, 2],
        ]);
    }

    for (let y = 0; y < 3; y++) {
        lines.push([
            [0, y, 0],
            [1, y, 1],
            [2, y, 2],
        ]);
        lines.push([
            [2, y, 0],
            [1, y, 1],
            [0, y, 2],
        ]);
    }

    // Main 3D diagonals
    lines.push([
        [0, 0, 0],
        [1, 1, 1],
        [2, 2, 2],
    ]);
    lines.push([
        [2, 0, 0],
        [1, 1, 1],
        [0, 2, 2],
    ]);
    lines.push([
        [0, 2, 0],
        [1, 1, 1],
        [2, 0, 2],
    ]);
    lines.push([
        [2, 2, 0],
        [1, 1, 1],
        [0, 0, 2],
    ]);

    return lines;
}

const WINNING_LINES = generateWinningLines();

export function checkWinner(board: string[][][]): Player | 'Draw' | undefined {
    for (const line of WINNING_LINES) {
        const [a, b, c] = line;
        const v1 = board[a[2]][a[1]][a[0]];
        const v2 = board[b[2]][b[1]][b[0]];
        const v3 = board[c[2]][c[1]][c[0]];
        if (v1 && v1 === v2 && v1 === v3) return v1 as Player;
    }
    const anyEmpty = board.some((layer) =>
        layer.some((row) => row.some((cell) => !cell))
    );
    if (!anyEmpty) return 'Draw';
    return undefined;
}

export function makeMove(
    state: GameState,
    move: Move
): { success: boolean; error?: string } {
    if (state.winner) return { success: false, error: 'Game already finished' };
    //if (move.player !== state.currentPlayer) return { success: false, error: "Not this player's turn" };

    const x = move.x; const y = move.y; const z = move.z;
    console.log(`Making move at (x=${x}, y=${y}, z=${z}) by player ${move.player}`);
    if (![0, 1, 2].includes(x) || ![0, 1, 2].includes(y) || ![0, 1, 2].includes(z)) {
        return { success: false, error: 'Invalid coordinates' };
    }

    if (state.board[z][y][x]) return { success: false, error: 'Cell already occupied' };
    state.board[z][y][x] = move.player;

    const winner = checkWinner(state.board);
    if (winner) state.winner = winner;
    else state.currentPlayer = state.currentPlayer === 'X' ? 'O' : 'X';

    return { success: true };
}
