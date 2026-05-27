"""
Phase 3J – Fix tests
1. bag.test.ts: exchangeFromRack - newBag stays same size (returned tiles are
   shuffled BACK in before drawing), not remaining.length - 2.
2. commitments.test.ts: use vi.mock('server-only') to avoid Node-environment errors.
"""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent

# --- Fix bag test ---
BAG_TARGET = ROOT / "apps" / "web" / "tests" / "unit" / "bag.test.ts"
text = BAG_TARGET.read_text(encoding="utf-8")

OLD = "    expect(newBag).toHaveLength(remaining.length - 2);"
NEW = "    // Exchange shuffles the 2 returned tiles back in then draws 2 fresh ones\n    // so the bag size is unchanged: remaining.length + 2 returned - 2 drawn = remaining.length\n    expect(newBag).toHaveLength(remaining.length);"
text = text.replace(OLD, NEW, 1)
BAG_TARGET.write_text(text, encoding="utf-8")
print("[OK] Fixed bag test: newBag size stays same in exchange")

# --- Fix commitments test ---
COMMIT_TARGET = ROOT / "apps" / "web" / "tests" / "unit" / "commitments.test.ts"

COMMIT_CONTENT = """\
/**
 * Tests for tile commitment hashing.
 *
 * vi.mock('server-only') is required so the import guard in lib/tiles/commitments.ts
 * doesn't throw in the Node test environment.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';

// Mock 'server-only' so the import guard is a no-op in Node/vitest.
vi.mock('server-only', () => ({}));

// Mock the env module so assertServerConfigured resolves to our test secret.
vi.mock('../../lib/env', () => ({
  assertServerConfigured: (_key: string, value: string | undefined) => {
    return value ?? 'test-secret-for-unit-tests';
  },
  serverEnv: {
    TILE_COMMITMENT_SECRET: 'test-secret-for-unit-tests',
  },
}));

// Import AFTER mocks are set up.
import { hashBagCommitment, hashExchangeCommitment, hashRackCommitment } from '../../lib/tiles/commitments';

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
print(f"[OK] Rewrote {COMMIT_TARGET} to use vi.mock")
