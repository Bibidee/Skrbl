/**
 * Official 15x15 Scrabble premium-square layout (PDF section 12).
 *
 * Legend used in PREMIUM_LAYOUT:
 *   .  normal
 *   d  double_letter
 *   t  triple_letter
 *   D  double_word
 *   T  triple_word
 *   *  centre (treated as double_word for the first move)
 */
import type { PremiumSquare } from './types';

export const BOARD_SIZE = 15;
export const CENTRE = { row: 7, col: 7 } as const;

const PREMIUM_LAYOUT: readonly string[] = [
  'T..d...T...d..T',
  '.D...t...t...D.',
  '..D...d.d...D..',
  'd..D...d...D..d',
  '....D.....D....',
  '.t...t...t...t.',
  '..d...d.d...d..',
  'T..d...*...d..T',
  '..d...d.d...d..',
  '.t...t...t...t.',
  '....D.....D....',
  'd..D...d...D..d',
  '..D...d.d...D..',
  '.D...t...t...D.',
  'T..d...T...d..T',
] as const;

const SYMBOL_TO_PREMIUM: Readonly<Record<string, PremiumSquare>> = {
  '.': 'normal',
  d: 'double_letter',
  t: 'triple_letter',
  D: 'double_word',
  T: 'triple_word',
  '*': 'centre',
};

/** Returns the premium type for a board coordinate. Out-of-range => 'normal'. */
export function getPremiumSquare(row: number, col: number): PremiumSquare {
  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
    return 'normal';
  }
  const symbol = PREMIUM_LAYOUT[row]?.[col] ?? '.';
  return SYMBOL_TO_PREMIUM[symbol] ?? 'normal';
}

/** Letter multiplier contributed by a premium square (applies to newly placed tiles only). */
export function letterMultiplier(premium: PremiumSquare): number {
  if (premium === 'double_letter') return 2;
  if (premium === 'triple_letter') return 3;
  return 1;
}

/** Word multiplier contributed by a premium square (applies to newly placed tiles only). */
export function wordMultiplier(premium: PremiumSquare): number {
  if (premium === 'double_word' || premium === 'centre') return 2;
  if (premium === 'triple_word') return 3;
  return 1;
}

/** Stable "row,col" key used by BoardState and the GenLayer board JSON. */
export function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

export function isCentre(row: number, col: number): boolean {
  return row === CENTRE.row && col === CENTRE.col;
}
