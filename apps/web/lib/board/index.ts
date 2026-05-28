/**
 * Client-side board utilities for instant placement feedback.
 *
 * These functions are used for UX purposes only. GenLayer is the
 * authoritative validator and scorer — never trust these results
 * for anything that matters on-chain.
 */
import {
  BOARD_SIZE,
  getPremiumSquare,
  isCentre,
  LETTER_POINTS,
  RACK_SIZE,
} from '@wordcourt/shared';
import type { BoardState, Placement } from '@wordcourt/shared';

// ---------------------------------------------------------------------------
// Placement shape validation
// ---------------------------------------------------------------------------

export type PlacementError =
  | 'no_tiles'
  | 'not_in_line'
  | 'has_gap'
  | 'overlaps_existing'
  | 'not_connected'
  | 'too_many_tiles';

export type PlacementValidation =
  | { valid: true }
  | { valid: false; error: PlacementError };

// ---------------------------------------------------------------------------
// Deterministic official scorer — an exact port of the GenLayer contract's
// `_formed_words` + `_score_move` (contracts/genlayer/wordcourt.py). Used to
// pass `claimed_score` on submit_move, which the contract requires to match its
// own computation exactly. Keeping this byte-for-byte in sync with the contract
// lets us skip the slow/nondeterministic on-chain `preview_move` view.
// ---------------------------------------------------------------------------

const BINGO_BONUS = 50;

/**
 * Computes the official score for a set of placements against the committed
 * board, matching the contract's algorithm exactly (premiums on newly-placed
 * tiles only, all formed words, +50 bingo for using all 7 tiles).
 */
export function computeOfficialScore(board: BoardState, placements: Placement[]): number {
  if (placements.length === 0) return 0;

  // board_after = committed board overlaid with the new placements.
  const after = new Map<string, { letter: string; isBlank: boolean }>();
  const boardBefore = new Set<string>();
  for (const k of Object.keys(board)) {
    const t = board[k]!;
    after.set(k, { letter: t.letter, isBlank: t.isBlank });
    boardBefore.add(k);
  }
  const placed = new Set<string>();
  for (const p of placements) {
    const k = `${p.row},${p.col}`;
    after.set(k, { letter: p.letter, isBlank: p.isBlank });
    placed.add(k);
  }

  // Orientation: horizontal iff every placement shares the same row (matches
  // the contract's `_check_line`, which treats a single tile as horizontal).
  const horizontal = new Set(placements.map((p) => p.row)).size === 1;

  const inside = (r: number, c: number) => r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
  const occupied = (r: number, c: number) => after.has(`${r},${c}`);

  function walk(sr: number, sc: number, dr: number, dc: number): Array<[number, number]> {
    let r = sr;
    let c = sc;
    while (inside(r - dr, c - dc) && occupied(r - dr, c - dc)) {
      r -= dr;
      c -= dc;
    }
    const cells: Array<[number, number]> = [];
    while (inside(r, c) && occupied(r, c)) {
      cells.push([r, c]);
      r += dr;
      c += dc;
    }
    return cells;
  }

  const words: Array<Array<[number, number]>> = [];
  const seen = new Set<string>();
  const addWord = (cells: Array<[number, number]>) => {
    if (cells.length < 2) return;
    const key = cells.map(([r, c]) => `${r},${c}`).join('|');
    if (seen.has(key)) return;
    seen.add(key);
    words.push(cells);
  };

  // Main word along the placement axis.
  if (horizontal) {
    const row = placements[0]!.row;
    const startCol = Math.min(...placements.map((p) => p.col));
    addWord(walk(row, startCol, 0, 1));
  } else {
    const col = placements[0]!.col;
    const startRow = Math.min(...placements.map((p) => p.row));
    addWord(walk(startRow, col, 1, 0));
  }

  // Cross words formed perpendicular to each placed tile.
  for (const p of placements) {
    addWord(horizontal ? walk(p.row, p.col, 1, 0) : walk(p.row, p.col, 0, 1));
  }

  let total = 0;
  for (const cells of words) {
    let wordTotal = 0;
    let wordMultiplier = 1;
    for (const [r, c] of cells) {
      const k = `${r},${c}`;
      const tile = after.get(k)!;
      let letterScore = tile.isBlank ? 0 : (LETTER_POINTS[tile.letter.toUpperCase()] ?? 0);
      // Premiums apply only to tiles placed this move.
      if (placed.has(k) && !boardBefore.has(k)) {
        const prem = getPremiumSquare(r, c);
        if (prem === 'double_letter') letterScore *= 2;
        else if (prem === 'triple_letter') letterScore *= 3;
        else if (prem === 'double_word' || prem === 'centre') wordMultiplier *= 2;
        else if (prem === 'triple_word') wordMultiplier *= 3;
      }
      wordTotal += letterScore;
    }
    total += wordTotal * wordMultiplier;
  }

  if (placements.length === RACK_SIZE) total += BINGO_BONUS;
  return total;
}

/** Returns true if all placements are in the same row. */
function allSameRow(ps: Placement[]): boolean {
  return ps.every((p) => p.row === ps[0]!.row);
}

/** Returns true if all placements are in the same column. */
function allSameCol(ps: Placement[]): boolean {
  return ps.every((p) => p.col === ps[0]!.col);
}

/**
 * Checks that a set of placements is valid in shape (ignoring word validity).
 * Does NOT verify that words are real words — that's GenLayer's job.
 */
export function validatePlacementShape(
  placements: Placement[],
  board: BoardState,
): PlacementValidation {
  if (placements.length === 0) return { valid: false, error: 'no_tiles' };
  if (placements.length > RACK_SIZE) return { valid: false, error: 'too_many_tiles' };

  // Check for overlaps with committed board tiles.
  for (const p of placements) {
    if (board[`${p.row},${p.col}`]) return { valid: false, error: 'overlaps_existing' };
  }

  // Single tile is always in-line (no gap possible).
  if (placements.length === 1) {
    // Must connect to an existing tile or be the centre square.
    const isFirstMove = Object.keys(board).length === 0;
    if (isFirstMove) {
      if (!isCentre(placements[0]!.row, placements[0]!.col)) {
        return { valid: false, error: 'not_connected' };
      }
    } else {
      if (!isAdjacentToBoard(placements[0]!.row, placements[0]!.col, board)) {
        return { valid: false, error: 'not_connected' };
      }
    }
    return { valid: true };
  }

  const inRow = allSameRow(placements);
  const inCol = allSameCol(placements);
  if (!inRow && !inCol) return { valid: false, error: 'not_in_line' };

  // Check for gaps in the placement direction.
  if (inRow) {
    const row = placements[0]!.row;
    const cols = placements.map((p) => p.col).sort((a, b) => a - b);
    for (let c = cols[0]!; c <= cols[cols.length - 1]!; c++) {
      const isPlaced = placements.some((p) => p.col === c);
      const isOnBoard = Boolean(board[`${row},${c}`]);
      if (!isPlaced && !isOnBoard) return { valid: false, error: 'has_gap' };
    }
  } else {
    const col = placements[0]!.col;
    const rows = placements.map((p) => p.row).sort((a, b) => a - b);
    for (let r = rows[0]!; r <= rows[rows.length - 1]!; r++) {
      const isPlaced = placements.some((p) => p.row === r);
      const isOnBoard = Boolean(board[`${r},${col}`]);
      if (!isPlaced && !isOnBoard) return { valid: false, error: 'has_gap' };
    }
  }

  // Must connect to the existing board (or include the centre square on first move).
  const isFirstMove = Object.keys(board).length === 0;
  if (isFirstMove) {
    const touchesCentre = placements.some((p) => isCentre(p.row, p.col));
    if (!touchesCentre) return { valid: false, error: 'not_connected' };
  } else {
    const connected = placements.some((p) =>
      isAdjacentToBoard(p.row, p.col, board),
    );
    if (!connected) return { valid: false, error: 'not_connected' };
  }

  return { valid: true };
}

function isAdjacentToBoard(row: number, col: number, board: BoardState): boolean {
  const neighbours = [
    [row - 1, col],
    [row + 1, col],
    [row, col - 1],
    [row, col + 1],
  ];
  return neighbours.some(([r, c]) => {
    if (r === undefined || c === undefined) return false;
    if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return false;
    return Boolean(board[`${r},${c}`]);
  });
}

// ---------------------------------------------------------------------------
// Local score estimate (UX only — not authoritative)
// ---------------------------------------------------------------------------

type CommittedTile = { letter: string; isBlank?: boolean };

/**
 * Returns a rough score estimate for a placement.
 * This is a best-effort client-side calculation for instant feedback.
 * The definitive score comes from GenLayer's preview_move.
 */
export function estimateScore(
  placements: Placement[],
  board: BoardState,
): number {
  if (placements.length === 0) return 0;

  const inRow = placements.length === 1 || allSameRow(placements);
  const primaryWord = extractPrimaryWord(placements, board, inRow);
  if (primaryWord.length === 0) return 0;

  let wordScore = 0;
  let wordMultiplier = 1;

  for (const { letter, isBlank, row, col, isNew } of primaryWord) {
    const basePoints = isBlank ? 0 : (LETTER_POINTS[letter.toUpperCase()] ?? 0);
    let tileScore = basePoints;
    if (isNew) {
      const premium = getPremiumSquare(row, col);
      if (premium === 'double_letter') tileScore *= 2;
      if (premium === 'triple_letter') tileScore *= 3;
      if (premium === 'double_word' || premium === 'centre') wordMultiplier *= 2;
      if (premium === 'triple_word') wordMultiplier *= 3;
    }
    wordScore += tileScore;
  }

  return wordScore * wordMultiplier + (placements.length === RACK_SIZE ? 50 : 0);
}

type ExtractedTile = { letter: string; isBlank: boolean; row: number; col: number; isNew: boolean };

function extractPrimaryWord(
  placements: Placement[],
  board: BoardState,
  inRow: boolean,
): ExtractedTile[] {
  const result: ExtractedTile[] = [];
  const sorted = [...placements].sort((a, b) => inRow ? a.col - b.col : a.row - b.row);
  const fixed = inRow ? sorted[0]!.row : sorted[0]!.col;
  const min = inRow ? sorted[0]!.col : sorted[0]!.row;
  const max = inRow ? sorted[sorted.length - 1]!.col : sorted[sorted.length - 1]!.row;

  for (let i = min; i <= max; i++) {
    const row = inRow ? fixed : i;
    const col = inRow ? i : fixed;
    const placed = placements.find((p) => p.row === row && p.col === col);
    if (placed) {
      result.push({ letter: placed.letter, isBlank: placed.isBlank, row, col, isNew: true });
    } else {
      const existing = board[`${row},${col}`] as CommittedTile | undefined;
      if (existing) {
        result.push({ letter: existing.letter, isBlank: existing.isBlank ?? false, row, col, isNew: false });
      }
    }
  }
  return result;
}
