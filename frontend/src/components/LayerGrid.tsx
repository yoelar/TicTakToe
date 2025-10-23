import React from 'react';
import { GameState, Board, Plane, Row } from '../types';

interface LayerGridProps {
    z: number;
    state: GameState;
    selected: [number, number, number] | null;
    setSelected: (s: [number, number, number] | null) => void;
    setMessage: (m: string | null) => void;
}

export default function LayerGrid({ z, state, selected, setSelected, setMessage }: LayerGridProps) {
    if (!state?.board) return null;

    const board: Board = state.board;

    return (
        <div className="layer">
            <div className="layer-title">Layer {z + 1}</div>
            <div className="grid" role="grid" aria-label={`Layer ${z + 1}`}>
                {board.map((plane: Plane, x: number) =>
                    plane.map((row: Row, y: number) => {
                        const occupied = !!board[x][y][z];
                        const isSelected =
                            selected && selected[0] === x && selected[1] === y && selected[2] === z;

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
                                {board[x][y][z]}
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );
}
