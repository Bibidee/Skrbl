/**
 * Tile-bag service. Pure logic, no I/O. Used by /api/tiles/deal, /api/tiles/draw,
 * /api/tiles/exchange. Deterministic and cross-platform so a future Deno Edge
 * Function port is a copy-paste.
 */
import { BLANK, createOrderedBag, LETTER_POINTS, RACK_SIZE, TILE_DISTRIBUTION } from '@wordcourt/shared';
import type { RackTile } from '@wordcourt/shared';

/**
 * Fisher-Yates shuffle seeded by a number sequence. The seed is rolled forward
 * with mulberry32 so we can audit-reproduce a shuffle later if needed.
 */
function mulberry32(seed: number) {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromBytes(buf: Uint8Array): number {
  let acc = 0;
  for (let i = 0; i < buf.length; i += 1) {
    acc = (acc * 31 + buf[i]!) | 0;
  }
  return acc >>> 0;
}

export type ShuffleSeed = { seedNumeric: number; seedHex: string };

export function freshSeed(): ShuffleSeed {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return {
    seedNumeric: seedFromBytes(bytes),
    seedHex: Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(''),
  };
}

export function shuffleBag(bag: string[], seed: number): string[] {
  const rng = mulberry32(seed);
  const a = [...bag];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

export type Deal = {
  /** Shuffled tile order. */
  orderedBag: string[];
  /** Tiles already dealt to players, in seat order. */
  initialRacks: RackTile[][];
  /** Remaining tiles in the bag after the initial deal. */
  remaining: string[];
};

let tileIdCounter = 0;
function newTileId(): string {
  tileIdCounter = (tileIdCounter + 1) | 0;
  return `t_${Date.now().toString(36)}_${tileIdCounter.toString(36)}`;
}

function letterToRackTile(letter: string): RackTile {
  const isBlank = letter === BLANK;
  return {
    id: newTileId(),
    letter: isBlank ? BLANK : letter.toUpperCase(),
    points: isBlank ? 0 : (LETTER_POINTS[letter.toUpperCase()] ?? 0),
    isBlank,
  };
}

/** Builds the initial deal: shuffled bag + 7 tiles per seat. */
export function dealInitial(playerCount: number, seed: number): Deal {
  if (playerCount < 2 || playerCount > 4) {
    throw new Error('PLAYER_COUNT_OUT_OF_RANGE');
  }
  const shuffled = shuffleBag(createOrderedBag(), seed);
  const initialRacks: RackTile[][] = [];
  let cursor = 0;
  for (let p = 0; p < playerCount; p += 1) {
    const slice = shuffled.slice(cursor, cursor + RACK_SIZE);
    cursor += RACK_SIZE;
    initialRacks.push(slice.map(letterToRackTile));
  }
  return {
    orderedBag: shuffled,
    initialRacks,
    remaining: shuffled.slice(cursor),
  };
}

/** Number of distinct letters in TILE_DISTRIBUTION; used for sanity checks. */
export const UNIQUE_LETTER_COUNT = TILE_DISTRIBUTION.length;

/** Draw up to `count` tiles from the front of `remaining`. */
export function drawFromBag(remaining: string[], count: number): { drawn: RackTile[]; remaining: string[] } {
  const taken = remaining.slice(0, count).map(letterToRackTile);
  return { drawn: taken, remaining: remaining.slice(taken.length) };
}

/** Returns selected tiles to the bag and draws fresh ones for an exchange. */
export function exchangeFromRack(
  rack: RackTile[],
  tileIdsToExchange: string[],
  remainingBag: string[],
  seed: number,
): { newRack: RackTile[]; newBag: string[]; returnedLetters: string[]; drawnLetters: string[] } {
  const toReturn = rack.filter((t) => tileIdsToExchange.includes(t.id));
  if (toReturn.length === 0) {
    throw new Error('NO_TILES_SELECTED_FOR_EXCHANGE');
  }
  if (toReturn.length > rack.length) {
    throw new Error('EXCHANGE_COUNT_TOO_LARGE');
  }
  const kept = rack.filter((t) => !tileIdsToExchange.includes(t.id));
  const returnedLetters = toReturn.map((t) => (t.isBlank ? BLANK : t.letter));

  // Shuffle bag + returned letters together, then draw `toReturn.length`.
  const mixed = shuffleBag([...remainingBag, ...returnedLetters], seed);
  const draw = mixed.slice(0, toReturn.length);
  const newBag = mixed.slice(toReturn.length);
  const drawn = draw.map(letterToRackTile);

  return {
    newRack: [...kept, ...drawn],
    newBag,
    returnedLetters,
    drawnLetters: draw,
  };
}
