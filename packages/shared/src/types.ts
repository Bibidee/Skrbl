/**
 * Canonical WordCourt domain types. These mirror the GenLayer official state and the
 * Supabase cache, and are the single source of truth for shapes used across the app.
 */

/**
 * The deployed v0.3.0 contract uses (word_mode, theme) instead of the older
 * `dictionary_mode`. The legacy alias is kept for any non-contract UI cache,
 * but the canonical pair is WordMode + Theme.
 */
export type WordMode = 'classic' | 'themed' | 'custom';
export type Theme = 'none' | 'crypto' | 'genlayer';

/** @deprecated use WordMode + Theme. */
export type DictionaryMode = 'classic' | 'crypto' | 'genlayer' | 'naija' | 'custom' | 'themed';

export type GameMode = 'classic' | 'blitz' | 'crypto' | 'naija' | 'custom';

/** True if the (mode, theme) combination matches the contract's validation. */
export function isValidModeTheme(mode: WordMode, theme: Theme): boolean {
  if (mode === 'themed') return theme === 'crypto' || theme === 'genlayer';
  return theme === 'none';
}

export type RoomStatus = 'waiting' | 'dealing' | 'active' | 'completed' | 'cancelled';

export type GameStatus =
  | 'waiting'
  | 'dealing'
  | 'active'
  | 'challenge_pending'
  | 'completed'
  | 'cancelled';

export type PremiumSquare =
  | 'normal'
  | 'double_letter'
  | 'triple_letter'
  | 'double_word'
  | 'triple_word'
  | 'centre';

export type MoveType = 'play_word' | 'pass' | 'exchange' | 'challenge' | 'forfeit' | 'end_game';

export type ChallengeStatus = 'open' | 'resolved' | 'rejected';

export type TransactionStatus = 'pending' | 'confirmed' | 'failed';

/** A tile sitting in a player's private rack (Supabase-owned, never public). */
export type RackTile = {
  id: string;
  letter: string;
  points: number;
  isBlank: boolean;
  /** For blank tiles: the letter the player has chosen to represent. */
  chosenLetter?: string;
};

/** A tile placed permanently on the official board (GenLayer-owned). */
export type BoardTile = {
  letter: string;
  points: number;
  ownerWallet: string;
  turnPlaced: number;
  isBlank: boolean;
  blankLetter?: string;
};

/** A single tile placement submitted as part of a move. */
export type Placement = {
  row: number;
  col: number;
  tileId: string;
  letter: string;
  points: number;
  isBlank: boolean;
  blankLetter?: string;
};

/** Board keyed by "row,col" -> tile. Matches the GenLayer board JSON layout. */
export type BoardState = Record<string, BoardTile>;

export type PlayerState = {
  walletAddress: string;
  seatIndex: number;
  score: number;
  rackCount: number;
  isConnected: boolean;
};

export type GameState = {
  gameId: string;
  genlayerGameId: string;
  status: GameStatus;
  dictionaryMode: DictionaryMode;
  players: PlayerState[];
  currentTurnWallet: string;
  board: BoardState;
  scores: Record<string, number>;
  moveCount: number;
  passCount: number;
  tileBagRemaining: number;
  winnerWallet?: string;
};

export type MoveRecord = {
  moveNumber: number;
  playerWallet: string;
  moveType: MoveType;
  placements?: Placement[];
  formedWords?: string[];
  officialScore?: number;
  reasoning?: string;
  txHash?: string;
};

export type ChallengeRecord = {
  challengeId: string;
  moveNumber: number;
  raisedByWallet: string;
  challengedPlayerWallet: string;
  reason: string;
  status: ChallengeStatus;
  ruling?: string;
  reasoning?: string;
  txHash?: string;
};

/** Move payload sent to GenLayer submit_move (matches PDF section 22). */
export type MovePayload = {
  gameId: string;
  placements: Array<Pick<Placement, 'row' | 'col' | 'letter' | 'points' | 'isBlank'> & {
    blankLetter?: string;
  }>;
  claimedWords: string[];
  claimedScore: number;
};

/** GenLayer submit_move response. */
export type MoveResult = {
  accepted: boolean;
  officialScore: number;
  formedWords: string[];
  reasoning: string;
};
