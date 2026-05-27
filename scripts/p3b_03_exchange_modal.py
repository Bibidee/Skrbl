"""
Phase 3B – Script 3
Creates apps/web/components/scrabble/ExchangeTilesModal.tsx

A modal dialog that lets the player select which tiles to return to the bag.
Internal selection state; calls onConfirm(selectedIds) when the player
clicks "Exchange". Validates that >= 1 tile is selected and warns when
the bag is too small.
"""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
TARGET = ROOT / "apps" / "web" / "components" / "scrabble" / "ExchangeTilesModal.tsx"

CONTENT = """\
'use client';

import { useState } from 'react';
import { ArrowLeftRight, X } from 'lucide-react';
import type { RackTile } from '@wordcourt/shared';
import { Button } from '@/components/ui/Button';
import { Tile } from '@/components/scrabble/Tile';
import { cn } from '@/lib/utils/cn';

const MIN_BAG_FOR_EXCHANGE = 7;

type Props = {
  isOpen: boolean;
  rack: RackTile[];
  /** IDs of tiles currently placed on the board (cannot be exchanged). */
  placedTileIds: ReadonlySet<string>;
  tileBagRemaining: number;
  busy: boolean;
  onClose: () => void;
  onConfirm: (tileIdsToExchange: string[]) => void;
};

export function ExchangeTilesModal({
  isOpen,
  rack,
  placedTileIds,
  tileBagRemaining,
  busy,
  onClose,
  onConfirm,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  if (!isOpen) return null;

  const canExchange = tileBagRemaining >= MIN_BAG_FOR_EXCHANGE;
  const exchangableTiles = rack.filter((t) => !placedTileIds.has(t.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleConfirm() {
    if (selected.size === 0 || !canExchange || busy) return;
    onConfirm(Array.from(selected));
    setSelected(new Set());
  }

  function handleClose() {
    setSelected(new Set());
    onClose();
  }

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-background shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-text-dark">
            <ArrowLeftRight size={17} className="text-primary" />
            Exchange Tiles
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            className="rounded-md p-1 text-text-muted hover:text-text-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Bag warning */}
          {!canExchange && (
            <p className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
              The bag has only {tileBagRemaining} tile{tileBagRemaining === 1 ? '' : 's'} remaining
              — you need at least {MIN_BAG_FOR_EXCHANGE} to exchange.
            </p>
          )}

          <p className="text-sm text-text-muted">
            Select the tiles you want to return. They will be shuffled back into the bag and
            you will draw the same number of fresh tiles.{' '}
            <span className="font-medium text-text-dark">{tileBagRemaining} tiles left in bag.</span>
          </p>

          {/* Tile grid */}
          <div className="flex flex-wrap gap-2 justify-center min-h-[60px]">
            {exchangableTiles.length === 0 && (
              <p className="text-sm text-text-muted">No tiles available to exchange.</p>
            )}
            {exchangableTiles.map((tile) => {
              const isSelected = selected.has(tile.id);
              return (
                <button
                  key={tile.id}
                  type="button"
                  onClick={() => toggle(tile.id)}
                  disabled={!canExchange || busy}
                  aria-pressed={isSelected}
                  aria-label={`${isSelected ? 'Deselect' : 'Select'} tile ${tile.letter}`}
                  className={cn(
                    'h-12 w-12 rounded-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    isSelected
                      ? 'ring-2 ring-primary scale-110'
                      : 'opacity-80 hover:opacity-100 hover:-translate-y-0.5',
                    (!canExchange || busy) && 'cursor-not-allowed',
                  )}
                >
                  <Tile
                    letter={tile.isBlank ? '_' : tile.letter}
                    points={tile.points}
                    isBlank={tile.isBlank}
                    variant={isSelected ? 'selected' : 'rack'}
                  />
                </button>
              );
            })}
          </div>

          {/* Selection count */}
          {selected.size > 0 && (
            <p className="text-center text-sm text-text-muted">
              {selected.size} tile{selected.size === 1 ? '' : 's'} selected
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <Button variant="secondary" onClick={handleClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selected.size === 0 || !canExchange || busy}
          >
            <ArrowLeftRight size={15} />
            {busy ? 'Exchanging…' : `Exchange ${selected.size > 0 ? selected.size : ''} tile${selected.size === 1 ? '' : 's'}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
"""

TARGET.write_text(CONTENT, encoding="utf-8")
print(f"[OK] Created {TARGET}")
