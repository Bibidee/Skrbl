/**
 * Strongly-typed argument and return shapes for every call on the deployed
 * WordCourt v0.3.0 contract (address 0x2FAD9...C8a9). Keep these in sync with
 * `contracts/genlayer/wordcourt.py`. The Python contract returns JSON strings
 * for most calls; the typed return shapes here describe the parsed JSON.
 */
import type {
  BoardState,
  ChallengeRecord,
  GameStatus,
  MoveRecord,
  Placement,
  Theme,
  WordMode,
} from '@wordcourt/shared';

// ---------- Write call arg shapes ----------

export type CreateGameArgs = {
  gameId: string;
  wordMode: WordMode;
  theme: Theme;
  maxPlayers: 2 | 3 | 4;
  rackCommitment: string;
};

export type JoinGameArgs = { gameId: string; rackCommitment: string };
export type CommitTileBagArgs = { gameId: string; bagCommitment: string };
export type CommitRackArgs = { gameId: string; rackCommitment: string };
export type StartGameArgs = { gameId: string };

export type SubmitMoveArgs = {
  gameId: string;
  placements: Placement[];
  claimedWords: string[];
  claimedScore: number;
  nextRackCommitment: string;
};

export type ChallengeMoveArgs = { gameId: string; moveNumber: number; reason: string };
export type ResolveChallengeArgs = { gameId: string; challengeId: string };
export type PassTurnArgs = { gameId: string; nextRackCommitment: string };
export type RecordExchangeArgs = {
  gameId: string;
  exchangeCommitment: string;
  nextRackCommitment: string;
};

export type ResignGameArgs = { gameId: string };
export type EndGameArgs = { gameId: string; finalRacksCommitment: string };
export type CancelGameArgs = { gameId: string };

// ---------- View return shapes ----------

/** Full official GenLayer game state, decoded from `get_game(...)`. */
export type OnChainGame = {
  game_id: string;
  ruleset: string;
  creator: string;
  status: GameStatus;
  word_mode: WordMode;
  theme: Theme;
  max_players: number;
  players: string[];
  current_turn_index: number;
  board: BoardState;
  scores: Record<string, number>;
  rack_commitments: Record<string, string>;
  tile_bag_commitment: string;
  move_count: number;
  pass_count: number;
  last_move: OnChainMove | null;
  move_history: OnChainMove[];
  pending_challenge: OnChainChallenge | null;
  challenge_history: OnChainChallenge[];
  winner: string | null;
  end_reason: string | null;
  final_racks_commitment: string;
};

export type OnChainMove = MoveRecord & {
  status?: string;
  rack_commitment_after?: string;
  word_details?: Array<{ word: string; cells: Array<{ row: number; col: number }>; axis: string }>;
};

export type OnChainChallenge = ChallengeRecord & {
  challenge_id: string;
  challenger: string;
  challenged_player: string;
  move_number: number;
  invalid_words?: string[];
  result?: string;
};

export type MovePreview = {
  formed_words: string[];
  word_details: Array<{ word: string; cells: Array<{ row: number; col: number }>; axis: string }>;
  official_score: number;
};

export type PlayerStats = {
  player: string;
  games_played: number;
  wins: number;
  losses: number;
  total_score: number;
  highest_score: number;
  rank_points: number;
  last_result: string;
};

// ---------- Write call return ----------

export type WriteResult = {
  txHash: string;
  /** The JSON receipt the contract returned (parsed). */
  result: Record<string, unknown>;
};
