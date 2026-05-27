'use client';

/**
 * Client-only state for the current player's in-progress move. Temporary
 * placements live here until the player commits via submit_move. Cleared on
 * every successful move or pass.
 */
import { create } from 'zustand';
import type { Placement, RackTile } from '@wordcourt/shared';

type PlacementSlice = {
  selectedTileId: string | null;
  /** Map of "row,col" -> Placement to keep ordering insertion-order-independent. */
  temporary: Record<string, Placement>;

  selectTile: (tileId: string | null) => void;
  placeAt: (row: number, col: number, tile: RackTile, blankLetter?: string) => void;
  removeAt: (row: number, col: number) => void;
  clear: () => void;
};

export const usePlacementStore = create<PlacementSlice>((set) => ({
  selectedTileId: null,
  temporary: {},

  selectTile: (tileId) => set({ selectedTileId: tileId }),

  placeAt: (row, col, tile, blankLetter) =>
    set((state) => {
      const key = `${row},${col}`;
      const next: Placement = {
        row,
        col,
        tileId: tile.id,
        letter: tile.isBlank ? (blankLetter ?? '?').toUpperCase() : tile.letter,
        points: tile.points,
        isBlank: tile.isBlank,
        blankLetter: tile.isBlank ? (blankLetter ?? '').toUpperCase() : undefined,
      };
      return {
        temporary: { ...state.temporary, [key]: next },
        selectedTileId: null,
      };
    }),

  removeAt: (row, col) =>
    set((state) => {
      const key = `${row},${col}`;
      if (!(key in state.temporary)) return state;
      const { [key]: _, ...rest } = state.temporary;
      return { temporary: rest };
    }),

  clear: () => set({ temporary: {}, selectedTileId: null }),
}));

export function placementsArray(record: Record<string, Placement>): Placement[] {
  return Object.values(record).sort((a, b) => a.row - b.row || a.col - b.col);
}
