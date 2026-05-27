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
    // Exchange shuffles the 2 returned tiles back in then draws 2 fresh ones
    // so the bag size is unchanged: remaining.length + 2 returned - 2 drawn = remaining.length
    expect(newBag).toHaveLength(remaining.length);
  });

  it('throws when no tiles are selected', () => {
    const deal = dealInitial(2, 1);
    expect(() =>
      exchangeFromRack(deal.initialRacks[0]!, [], deal.remaining, 42),
    ).toThrow('NO_TILES_SELECTED_FOR_EXCHANGE');
  });
});
