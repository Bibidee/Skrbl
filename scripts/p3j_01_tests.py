"""
Phase 3J – Script 1
Creates:
  - apps/web/vitest.config.ts
  - apps/web/tests/unit/bag.test.ts
  - apps/web/tests/unit/commitments.test.ts
"""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent

# --- vitest.config.ts ---
VITE_TARGET = ROOT / "apps" / "web" / "vitest.config.ts"

VITE_CONTENT = """\
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    globals: false,
  },
  resolve: {
    alias: {
      '@wordcourt/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@': path.resolve(__dirname),
    },
  },
});
"""

VITE_TARGET.write_text(VITE_CONTENT, encoding="utf-8")
print(f"[OK] Created {VITE_TARGET}")

# --- bag.test.ts ---
BAG_TARGET = ROOT / "apps" / "web" / "tests" / "unit" / "bag.test.ts"
BAG_TARGET.parent.mkdir(parents=True, exist_ok=True)

BAG_CONTENT = """\
import { describe, expect, it } from 'vitest';
import { dealInitial, drawFromBag, exchangeFromRack, shuffleBag } from '../../lib/tiles/bag';

describe('shuffleBag', () => {
  it('returns the same length as input', () => {
    const bag = ['A', 'B', 'C', 'D', 'E'];
    expect(shuffleBag(bag, 42)).toHaveLength(bag.length);
  });

  it('is deterministic for the same seed', () => {
    const bag = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    const a = shuffleBag(bag, 12345);
    const b = shuffleBag(bag, 12345);
    expect(a).toEqual(b);
  });

  it('produces different order for different seeds', () => {
    const bag = Array.from({ length: 20 }, (_, i) => String.fromCharCode(65 + (i % 26)));
    const a = shuffleBag(bag, 1);
    const b = shuffleBag(bag, 2);
    expect(a).not.toEqual(b);
  });

  it('contains all original elements', () => {
    const bag = ['A', 'B', 'C', 'D'];
    const shuffled = shuffleBag(bag, 999);
    expect(shuffled.sort()).toEqual(bag.sort());
  });
});

describe('drawFromBag', () => {
  it('draws the requested number of tiles', () => {
    const remaining = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    const { drawn, remaining: left } = drawFromBag(remaining, 3);
    expect(drawn).toHaveLength(3);
    expect(left).toHaveLength(4);
  });

  it('draws fewer tiles when bag is small', () => {
    const remaining = ['A', 'B'];
    const { drawn, remaining: left } = drawFromBag(remaining, 7);
    expect(drawn).toHaveLength(2);
    expect(left).toHaveLength(0);
  });

  it('draws from the front of the bag in order', () => {
    const remaining = ['X', 'Y', 'Z', 'Q'];
    const { drawn } = drawFromBag(remaining, 2);
    expect(drawn[0]!.letter).toBe('X');
    expect(drawn[1]!.letter).toBe('Y');
  });

  it('returns empty when bag is empty', () => {
    const { drawn, remaining: left } = drawFromBag([], 7);
    expect(drawn).toHaveLength(0);
    expect(left).toHaveLength(0);
  });
});

describe('dealInitial', () => {
  it('deals 7 tiles per player', () => {
    const deal = dealInitial(2, 42);
    expect(deal.initialRacks).toHaveLength(2);
    deal.initialRacks.forEach((rack) => expect(rack).toHaveLength(7));
  });

  it('leaves correct number of tiles remaining for 2 players', () => {
    const deal = dealInitial(2, 42);
    // Standard bag = 100 tiles; 2 players × 7 = 14 dealt → 86 remaining.
    expect(deal.remaining).toHaveLength(100 - 14);
  });

  it('leaves correct number of tiles remaining for 4 players', () => {
    const deal = dealInitial(4, 42);
    expect(deal.remaining).toHaveLength(100 - 28);
  });

  it('is deterministic', () => {
    const a = dealInitial(2, 99);
    const b = dealInitial(2, 99);
    expect(a.initialRacks[0]!.map((t) => t.letter)).toEqual(
      b.initialRacks[0]!.map((t) => t.letter),
    );
  });

  it('throws for invalid player count', () => {
    expect(() => dealInitial(1, 1)).toThrow('PLAYER_COUNT_OUT_OF_RANGE');
    expect(() => dealInitial(5, 1)).toThrow('PLAYER_COUNT_OUT_OF_RANGE');
  });
});

describe('exchangeFromRack', () => {
  it('returns selected tiles and draws replacements', () => {
    const deal = dealInitial(2, 1);
    const rack = deal.initialRacks[0]!;
    const remaining = deal.remaining;
    const idsToExchange = [rack[0]!.id, rack[1]!.id];
    const { newRack, newBag } = exchangeFromRack(rack, idsToExchange, remaining, 42);
    expect(newRack).toHaveLength(rack.length);
    expect(newBag).toHaveLength(remaining.length - 2);
  });

  it('throws when no tiles are selected', () => {
    const deal = dealInitial(2, 1);
    expect(() =>
      exchangeFromRack(deal.initialRacks[0]!, [], deal.remaining, 42),
    ).toThrow('NO_TILES_SELECTED_FOR_EXCHANGE');
  });
});
"""

BAG_TARGET.write_text(BAG_CONTENT, encoding="utf-8")
print(f"[OK] Created {BAG_TARGET}")

# --- commitments.test.ts ---
# commitments.ts imports 'server-only' which vitest can handle by mocking
COMMIT_TARGET = ROOT / "apps" / "web" / "tests" / "unit" / "commitments.test.ts"

COMMIT_CONTENT = """\
/**
 * Tests for tile commitment hashing.
 *
 * 'server-only' is a no-op package at runtime so vitest handles it correctly
 * in Node environment. TILE_COMMITMENT_SECRET must be set; we override via
 * the env stub below.
 */
import { beforeAll, describe, expect, it } from 'vitest';

// Stub the server env so commitments.ts doesn't throw assertServerConfigured.
process.env['TILE_COMMITMENT_SECRET'] = 'test-secret-for-unit-tests';

// Dynamically import after env is set.
const { hashRackCommitment, hashBagCommitment, hashExchangeCommitment } =
  await import('../../lib/tiles/commitments');

describe('hashRackCommitment', () => {
  it('returns a 0x-prefixed 64-char hex string', () => {
    const result = hashRackCommitment(
      '0xabc',
      [{ letter: 'A', isBlank: false }],
      1,
    );
    expect(result).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('is deterministic', () => {
    const tiles = [
      { letter: 'A', isBlank: false },
      { letter: 'B', isBlank: false },
    ];
    const a = hashRackCommitment('0xabc', tiles, 1);
    const b = hashRackCommitment('0xabc', tiles, 1);
    expect(a).toBe(b);
  });

  it('changes when version changes', () => {
    const tiles = [{ letter: 'A', isBlank: false }];
    const v1 = hashRackCommitment('0xabc', tiles, 1);
    const v2 = hashRackCommitment('0xabc', tiles, 2);
    expect(v1).not.toBe(v2);
  });

  it('changes when wallet changes', () => {
    const tiles = [{ letter: 'A', isBlank: false }];
    const a = hashRackCommitment('0xabc', tiles, 1);
    const b = hashRackCommitment('0xdef', tiles, 1);
    expect(a).not.toBe(b);
  });

  it('normalises wallet to lowercase', () => {
    const tiles = [{ letter: 'A', isBlank: false }];
    const lower = hashRackCommitment('0xabc', tiles, 1);
    const upper = hashRackCommitment('0xABC', tiles, 1);
    expect(lower).toBe(upper);
  });
});

describe('hashBagCommitment', () => {
  it('returns a 0x-prefixed 64-char hex string', () => {
    expect(hashBagCommitment(['A', 'B', 'C'])).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('changes when bag order changes', () => {
    const a = hashBagCommitment(['A', 'B', 'C']);
    const b = hashBagCommitment(['C', 'B', 'A']);
    expect(a).not.toBe(b);
  });
});

describe('hashExchangeCommitment', () => {
  it('returns a 0x-prefixed 64-char hex string', () => {
    const result = hashExchangeCommitment('0xabc', ['A', 'B'], ['C', 'D']);
    expect(result).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('changes when returned tiles change', () => {
    const a = hashExchangeCommitment('0xabc', ['A'], ['C']);
    const b = hashExchangeCommitment('0xabc', ['B'], ['C']);
    expect(a).not.toBe(b);
  });
});
"""

COMMIT_TARGET.write_text(COMMIT_CONTENT, encoding="utf-8")
print(f"[OK] Created {COMMIT_TARGET}")
