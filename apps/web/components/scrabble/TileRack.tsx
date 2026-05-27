'use client';

import type { RackTile } from '@wordcourt/shared';
import { cn } from '@/lib/utils/cn';
import { Tile } from './Tile';

type Props = {
  tiles: RackTile[];
  selectedTileId: string | null;
  /** ids of tiles already placed on the board this turn (greyed-out). */
  placedTileIds: ReadonlySet<string>;
  onSelect: (tileId: string) => void;
};

export function TileRack({ tiles, selectedTileId, placedTileIds, onSelect }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl border border-border bg-surface-soft p-3 shadow-sm">
      {tiles.length === 0 && (
        <span className="text-sm text-text-muted">Your rack is empty.</span>
      )}
      {tiles.map((tile) => {
        const placed = placedTileIds.has(tile.id);
        const selected = selectedTileId === tile.id;
        return (
          <button
            key={tile.id}
            type="button"
            onClick={() => !placed && onSelect(tile.id)}
            disabled={placed}
            className={cn(
              'block',
              placed && 'opacity-30 cursor-not-allowed',
              selected && 'ring-2 ring-primary rounded-md',
            )}
            aria-pressed={selected}
            aria-label={`Tile ${tile.letter} worth ${tile.points} points`}
          >
            <Tile
              letter={tile.isBlank ? '_' : tile.letter}
              points={tile.points}
              isBlank={tile.isBlank}
              variant={selected ? 'selected' : 'rack'}
            />
          </button>
        );
      })}
    </div>
  );
}
