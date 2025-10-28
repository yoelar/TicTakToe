import React from 'react';
import { GameState } from '../types';

interface BoardLayersProps {
    state: GameState;
    selected: [number, number, number] | null;
    setSelected: (s: [number, number, number] | null) => void;
    setMessage: (m: string | null) => void;
}

export default function BoardLayers({ state, selected, setSelected, setMessage }: BoardLayersProps) {
    const handleCellClick = (x: number, y: number, z: number) => {
        if (state.board[z][y][x]) {
            setMessage('Cell is already occupied');
            return;
        }
        setSelected([x, y, z]);
        setMessage(null);
    };

    return (
        <div className="layers">
            {state.board.map((layer, z) => (
                <div key={z} className="layer">
                    <div className="layer-title">Layer {z}</div>
                    {layer.map((row, y) => (
                        <div key={y} className="row">
                            {row.map((cell, x) => {
                                const isSelected =
                                    selected?.[0] === x &&
                                    selected?.[1] === y &&
                                    selected?.[2] === z;

                                return (
                                    <button
                                        key={x}
                                        role="gridcell"
                                        aria-label={`cell ${x}-${y}-${z}`}
                                        className={`cell ${cell ? 'occupied' : ''} ${isSelected ? 'selected' : ''}`}
                                        onClick={() => handleCellClick(x, y, z)}
                                        disabled={!!cell}
                                    >
                                        {cell}
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}
