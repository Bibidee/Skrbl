/**
 * Typed schema for the WordCourt Supabase database. Hand-written to match
 * `supabase/migrations/0001_initial_schema.sql`. Keep this in sync any time
 * the schema changes (or generate via `supabase gen types typescript` once
 * the Supabase CLI is wired in).
 */

import type {
  ChallengeStatus,
  DictionaryMode,
  GameStatus,
  MoveType,
  Placement,
  Theme,
  TransactionStatus,
  WordMode,
} from '@wordcourt/shared';

export type Json = string | number | boolean | null | { [k: string]: Json } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: ProfileInsert;
        Update: Partial<ProfileInsert>;
      };
      rooms: {
        Row: RoomRow;
        Insert: RoomInsert;
        Update: Partial<RoomInsert>;
      };
      room_players: {
        Row: RoomPlayerRow;
        Insert: RoomPlayerInsert;
        Update: Partial<RoomPlayerInsert>;
      };
      games: {
        Row: GameRow;
        Insert: GameInsert;
        Update: Partial<GameInsert>;
      };
      game_players: {
        Row: GamePlayerRow;
        Insert: GamePlayerInsert;
        Update: Partial<GamePlayerInsert>;
      };
      player_racks: {
        Row: PlayerRackRow;
        Insert: PlayerRackInsert;
        Update: Partial<PlayerRackInsert>;
      };
      tile_bags: {
        Row: TileBagRow;
        Insert: TileBagInsert;
        Update: Partial<TileBagInsert>;
      };
      board_cells: {
        Row: BoardCellRow;
        Insert: BoardCellInsert;
        Update: Partial<BoardCellInsert>;
      };
      moves: {
        Row: MoveRow;
        Insert: MoveInsert;
        Update: Partial<MoveInsert>;
      };
      challenges: {
        Row: ChallengeRow;
        Insert: ChallengeInsert;
        Update: Partial<ChallengeInsert>;
      };
      chat_messages: {
        Row: ChatMessageRow;
        Insert: ChatMessageInsert;
        Update: Partial<ChatMessageInsert>;
      };
      leaderboard: {
        Row: LeaderboardRow;
        Insert: LeaderboardInsert;
        Update: Partial<LeaderboardInsert>;
      };
      transactions: {
        Row: TransactionRow;
        Insert: TransactionInsert;
        Update: Partial<TransactionInsert>;
      };
      siwe_nonces: {
        Row: SiweNonceRow;
        Insert: SiweNonceInsert;
        Update: Partial<SiweNonceInsert>;
      };
    };
    Functions: {
      current_wallet: { Args: Record<string, never>; Returns: string | null };
    };
    Enums: Record<string, never>;
  };
};

// ---------- Row types ----------

export type ProfileRow = {
  id: string;
  wallet_address: string;
  username: string | null;
  avatar_url: string | null;
  games_played: number;
  wins: number;
  losses: number;
  total_score: number;
  highest_word_score: number;
  bingos_played: number;
  challenges_won: number;
  challenges_lost: number;
  fair_play_score: number;
  created_at: string;
  updated_at: string;
};
export type ProfileInsert = Pick<ProfileRow, 'wallet_address'> &
  Partial<Omit<ProfileRow, 'wallet_address'>>;

export type RoomRow = {
  id: string;
  room_code: string;
  creator_wallet: string;
  max_players: 2 | 3 | 4;
  mode: 'classic' | 'blitz' | 'crypto' | 'naija' | 'custom';
  /** @deprecated use word_mode + theme. */
  dictionary_mode: DictionaryMode;
  word_mode: WordMode;
  theme: Theme;
  status: 'waiting' | 'dealing' | 'active' | 'completed' | 'cancelled';
  genlayer_game_id: string | null;
  current_players: number;
  is_private: boolean;
  turn_seconds: number;
  created_at: string;
  updated_at: string;
};
export type RoomInsert = Pick<
  RoomRow,
  'room_code' | 'creator_wallet' | 'max_players' | 'mode' | 'status'
> &
  Partial<Omit<RoomRow, 'room_code' | 'creator_wallet' | 'max_players' | 'mode' | 'status'>>;

export type RoomPlayerRow = {
  id: string;
  room_id: string;
  wallet_address: string;
  seat_index: number;
  is_ready: boolean;
  joined_at: string;
};
export type RoomPlayerInsert = Pick<
  RoomPlayerRow,
  'room_id' | 'wallet_address' | 'seat_index'
> &
  Partial<Omit<RoomPlayerRow, 'room_id' | 'wallet_address' | 'seat_index'>>;

export type GameRow = {
  id: string;
  genlayer_game_id: string;
  room_id: string | null;
  status: GameStatus;
  /** @deprecated use word_mode + theme. */
  dictionary_mode: DictionaryMode;
  word_mode: WordMode;
  theme: Theme;
  creator_wallet: string;
  current_turn_wallet: string | null;
  move_count: number;
  pass_count: number;
  tile_bag_remaining: number;
  winner_wallet: string | null;
  official_state: Json | null;
  last_tx_hash: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
};
export type GameInsert = Pick<
  GameRow,
  'genlayer_game_id' | 'status' | 'creator_wallet'
> &
  Partial<Omit<GameRow, 'genlayer_game_id' | 'status' | 'creator_wallet'>>;

export type GamePlayerRow = {
  id: string;
  game_id: string;
  wallet_address: string;
  seat_index: number;
  score: number;
  rack_count: number;
  final_rank: number | null;
  has_finished: boolean;
  created_at: string;
  updated_at: string;
};
export type GamePlayerInsert = Pick<
  GamePlayerRow,
  'game_id' | 'wallet_address' | 'seat_index'
> &
  Partial<Omit<GamePlayerRow, 'game_id' | 'wallet_address' | 'seat_index'>>;

export type PlayerRackRow = {
  id: string;
  game_id: string;
  wallet_address: string;
  /** A JSON array of RackTile shape. Stored privately. */
  tiles: Json;
  rack_commitment: string | null;
  rack_version: number;
  updated_at: string;
};
export type PlayerRackInsert = Pick<PlayerRackRow, 'game_id' | 'wallet_address' | 'tiles'> &
  Partial<Omit<PlayerRackRow, 'game_id' | 'wallet_address' | 'tiles'>>;

export type TileBagRow = {
  id: string;
  game_id: string;
  /** Remaining tile letters as a JSON array of single-character strings. */
  remaining_tiles: Json;
  used_tiles: Json;
  exchanged_tiles: Json;
  bag_commitment: string;
  draw_count: number;
  created_at: string;
  updated_at: string;
};
export type TileBagInsert = Pick<
  TileBagRow,
  'game_id' | 'remaining_tiles' | 'bag_commitment'
> &
  Partial<Omit<TileBagRow, 'game_id' | 'remaining_tiles' | 'bag_commitment'>>;

export type BoardCellRow = {
  id: string;
  game_id: string;
  row: number;
  col: number;
  letter: string;
  tile_id: string | null;
  owner_wallet: string;
  points: number;
  is_blank: boolean;
  blank_letter: string | null;
  turn_placed: number;
  created_at: string;
};
export type BoardCellInsert = Pick<
  BoardCellRow,
  'game_id' | 'row' | 'col' | 'letter' | 'owner_wallet' | 'points' | 'turn_placed'
> &
  Partial<Omit<BoardCellRow, 'game_id' | 'row' | 'col' | 'letter' | 'owner_wallet' | 'points' | 'turn_placed'>>;

export type MoveRow = {
  id: string;
  game_id: string;
  genlayer_game_id: string;
  move_number: number;
  player_wallet: string;
  move_type: MoveType;
  /** A JSON array of Placement. */
  placements: Json | null;
  formed_words: Json | null;
  score_delta: number;
  claimed_score: number | null;
  official_score: number | null;
  challenge_status: string | null;
  tx_hash: string | null;
  proof: Json | null;
  created_at: string;
};
export type MoveInsert = Pick<
  MoveRow,
  'game_id' | 'genlayer_game_id' | 'move_number' | 'player_wallet' | 'move_type'
> &
  Partial<Omit<MoveRow, 'game_id' | 'genlayer_game_id' | 'move_number' | 'player_wallet' | 'move_type'>> & {
    placements?: Placement[] | null;
  };

export type ChallengeRow = {
  id: string;
  game_id: string;
  move_id: string;
  genlayer_game_id: string;
  raised_by_wallet: string;
  challenged_player_wallet: string;
  reason: string;
  status: ChallengeStatus;
  ruling: string | null;
  genlayer_ruling: Json | null;
  tx_hash: string | null;
  created_at: string;
  resolved_at: string | null;
};
export type ChallengeInsert = Pick<
  ChallengeRow,
  | 'game_id'
  | 'move_id'
  | 'genlayer_game_id'
  | 'raised_by_wallet'
  | 'challenged_player_wallet'
  | 'reason'
  | 'status'
> &
  Partial<Omit<ChallengeRow,
    'game_id' | 'move_id' | 'genlayer_game_id' | 'raised_by_wallet' | 'challenged_player_wallet' | 'reason' | 'status'>>;

export type ChatMessageRow = {
  id: string;
  room_id: string | null;
  game_id: string | null;
  wallet_address: string;
  message: string;
  created_at: string;
};
export type ChatMessageInsert = Pick<ChatMessageRow, 'wallet_address' | 'message'> &
  Partial<Omit<ChatMessageRow, 'wallet_address' | 'message'>>;

export type LeaderboardRow = {
  wallet_address: string;
  games_played: number;
  wins: number;
  losses: number;
  total_score: number;
  average_score: number;
  highest_word_score: number;
  bingos_played: number;
  challenges_won: number;
  challenges_lost: number;
  fair_play_score: number;
  updated_at: string;
};
export type LeaderboardInsert = Pick<LeaderboardRow, 'wallet_address'> &
  Partial<Omit<LeaderboardRow, 'wallet_address'>>;

export type TransactionRow = {
  id: string;
  wallet_address: string;
  genlayer_game_id: string | null;
  action: string;
  tx_hash: string | null;
  status: TransactionStatus;
  request_payload: Json | null;
  response_payload: Json | null;
  created_at: string;
  updated_at: string;
};
export type TransactionInsert = Pick<TransactionRow, 'wallet_address' | 'action' | 'status'> &
  Partial<Omit<TransactionRow, 'wallet_address' | 'action' | 'status'>>;

export type SiweNonceRow = {
  wallet_address: string;
  nonce: string;
  domain: string;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
};
export type SiweNonceInsert = Pick<SiweNonceRow, 'wallet_address' | 'nonce' | 'domain' | 'expires_at'> &
  Partial<Omit<SiweNonceRow, 'wallet_address' | 'nonce' | 'domain' | 'expires_at'>>;
