'use client';

import { BOARD_SIZE, cellKey } from '@wordcourt/shared';
import type { BoardState, Placement } from '@wordcourt/shared';
import { BoardSquare } from './BoardSquare';

type Props = {
  board: BoardState;
  /** Temporary placements (this turn) keyed by "row,col". */
  preview: Record<string, Placement>;
  onSquareClick: (row: number, col: number) => void;
};

export function ScrabbleBoard({ board, preview, onSquareClick }: Props) {
  const rows = Array.from({ length: BOARD_SIZE });
  const cols = Array.from({ length: BOARD_SIZE });
  return (
    <div
      className="mx-auto rounded-xl border-4 border-board-border bg-board-base p-2 shadow-lg"
      style={{ width: 'min(75vmin, 600px)' }}
    >
      <div
        className="grid w-full gap-[2px]"
        style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))` }}
      >
        {rows.map((_, row) =>
          cols.map((__, col) => {
            const key = cellKey(row, col);
            return (
              <BoardSquare
                key={key}
                row={row}
                col={col}
                tile={board[key]}
                preview={preview[key]}
                onClick={() => onSquareClick(row, col)}
              />
            );
          }),
        )}
      </div>
    </div>
  );
}
