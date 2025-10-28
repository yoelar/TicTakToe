import React from 'react';
import { GameState, Board, Plane, Row } from '../types';

interface LayerGridProps {
    z: number;
    state: GameState;
    selected: [number, number, number] | null;
    onCellClick: (x: number, y: number, z: number) => void;
}

export default function LayerGrid({ z, state, selected, onCellClick }: LayerGridProps) {

    return (
        <div className="layer-grid">
            {state.board[z].map((row, y) =>
                row.map((cell, x) => {
                    const isSelected = selected?.[0] === x && selected?.[1] === y && selected?.[2] === z;
                    return (
                        <div
                            key={`${x}-${y}`}
                            className={`cell ${isSelected ? 'selected' : ''}`}
                            onClick={() => onCellClick(x, y, z)}
                        >
                            {cell}
                        </div>
                    );
                })
            )}
        </div>
    );
}
