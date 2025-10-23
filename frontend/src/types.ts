export type Player = 'X' | 'O';

export type Row = string[];
export type Plane = Row[];
export type Board = Plane[];

export interface GameState {
    id: string;
    board: Board;
    currentPlayer: Player;
    winner?: Player | 'Draw';
}