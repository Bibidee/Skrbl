import { describe, expect, it } from 'vitest';
import { BOARD_SIZE, getPremiumSquare, isCentre } from './board';
import type { PremiumSquare } from './types';

describe('premium board layout', () => {
  it('matches the official Scrabble premium-square counts', () => {
    const counts: Record<PremiumSquare, number> = {
      normal: 0,
      double_letter: 0,
      triple_letter: 0,
      double_word: 0,
      triple_word: 0,
      centre: 0,
    };
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        counts[getPremiumSquare(row, col)] += 1;
      }
    }

    expect(counts.triple_word).toBe(8);
    expect(counts.double_word).toBe(16);
    expect(counts.triple_letter).toBe(12);
    expect(counts.double_letter).toBe(24);
    expect(counts.centre).toBe(1);
    // 8 + 16 + 12 + 24 + 1 = 61 premium squares; remaining 164 are normal.
    expect(counts.normal).toBe(BOARD_SIZE * BOARD_SIZE - 61);
  });

  it('places the centre star at (7,7)', () => {
    expect(getPremiumSquare(7, 7)).toBe('centre');
    expect(isCentre(7, 7)).toBe(true);
  });

  it('is symmetric across both diagonals', () => {
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        const base = getPremiumSquare(row, col);
        expect(getPremiumSquare(col, row)).toBe(base);
        expect(getPremiumSquare(BOARD_SIZE - 1 - row, BOARD_SIZE - 1 - col)).toBe(base);
      }
    }
  });
});
