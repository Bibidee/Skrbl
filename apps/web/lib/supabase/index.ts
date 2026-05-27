/**
 * Public entry for the Supabase client trio. Each accessor lazily constructs
 * its own client and throws a precise "X is not configured" error if env
 * variables aren't set, so the app can still build before Supabase is wired.
 */
export { getBrowserSupabase } from './browser';
export { getServerSupabase } from './server';
export { getAdminSupabase } from './admin';
export type {
  Database,
  Json,
  ProfileRow,
  RoomRow,
  RoomPlayerRow,
  GameRow,
  GamePlayerRow,
  PlayerRackRow,
  TileBagRow,
  BoardCellRow,
  MoveRow,
  ChallengeRow,
  ChatMessageRow,
  LeaderboardRow,
  TransactionRow,
  SiweNonceRow,
} from './types';
