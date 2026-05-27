/**
 * Official Scrabble tile distribution and letter values (PDF section 11).
 * Total: 100 tiles. The blank tile is represented by the underscore character '_'.
 */

export const BLANK = '_' as const;

export type TileSpec = {
  letter: string;
  count: number;
  points: number;
};

export const TILE_DISTRIBUTION: readonly TileSpec[] = [
  { letter: 'A', count: 9, points: 1 },
  { letter: 'B', count: 2, points: 3 },
  { letter: 'C', count: 2, points: 3 },
  { letter: 'D', count: 4, points: 2 },
  { letter: 'E', count: 12, points: 1 },
  { letter: 'F', count: 2, points: 4 },
  { letter: 'G', count: 3, points: 2 },
  { letter: 'H', count: 2, points: 4 },
  { letter: 'I', count: 9, points: 1 },
  { letter: 'J', count: 1, points: 8 },
  { letter: 'K', count: 1, points: 5 },
  { letter: 'L', count: 4, points: 1 },
  { letter: 'M', count: 2, points: 3 },
  { letter: 'N', count: 6, points: 1 },
  { letter: 'O', count: 8, points: 1 },
  { letter: 'P', count: 2, points: 3 },
  { letter: 'Q', count: 1, points: 10 },
  { letter: 'R', count: 6, points: 1 },
  { letter: 'S', count: 4, points: 1 },
  { letter: 'T', count: 6, points: 1 },
  { letter: 'U', count: 4, points: 1 },
  { letter: 'V', count: 2, points: 4 },
  { letter: 'W', count: 2, points: 4 },
  { letter: 'X', count: 1, points: 8 },
  { letter: 'Y', count: 2, points: 4 },
  { letter: 'Z', count: 1, points: 10 },
  { letter: BLANK, count: 2, points: 0 },
] as const;

/** Map of letter -> point value. Blank ('_') is 0. */
export const LETTER_POINTS: Readonly<Record<string, number>> = Object.fromEntries(
  TILE_DISTRIBUTION.map((t) => [t.letter, t.points]),
);

export const TOTAL_TILES = TILE_DISTRIBUTION.reduce((sum, t) => sum + t.count, 0); // 100

/** Returns the point value of a letter (blank => 0, unknown => 0). */
export function letterPoints(letter: string): number {
  return LETTER_POINTS[letter.toUpperCase()] ?? 0;
}

/**
 * Builds the full ordered (un-shuffled) bag of 100 tile letters. Shuffling is performed
 * server-side with a seed so the tile-bag commitment can be reproduced and audited.
 */
export function createOrderedBag(): string[] {
  const bag: string[] = [];
  for (const spec of TILE_DISTRIBUTION) {
    for (let i = 0; i < spec.count; i += 1) {
      bag.push(spec.letter);
    }
  }
  return bag;
}
