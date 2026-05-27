/**
 * Service-role Supabase client. Bypasses RLS. Server-only — never import from
 * a 'use client' file or expose its key over the network.
 *
 * Use this for:
 *  - Tile-bag service (private tile_bags table)
 *  - Player rack writes (write side of player_racks)
 *  - Syncing GenLayer official_state into the games/board_cells/moves cache
 *  - Any cross-wallet maintenance task (leaderboard rollups, etc.)
 */
import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { clientEnv, assertConfigured } from '../env/client';
import { assertServerConfigured, serverEnv } from '../env';

/**
 * Admin client returns a permissively-typed SupabaseClient.
 *
 * We *intentionally* drop the `<Database>` generic here. Our row types use
 * computed Pick/Omit shapes that supabase-js v2.46's Insert/Update extractor
 * cannot simplify (it collapses to `never`). The browser and server clients
 * (which are read-mostly through narrower call sites) keep the typed Database.
 *
 * Safety isn't lost: every API route that uses this client validates inputs
 * with zod before calling, so the loose types here cannot leak unvalidated
 * data into the database.
 */
let cached: SupabaseClient | null = null;

export function getAdminSupabase(): SupabaseClient {
  if (cached) return cached;
  const url = assertConfigured('NEXT_PUBLIC_SUPABASE_URL', clientEnv.NEXT_PUBLIC_SUPABASE_URL);
  const serviceRoleKey = assertServerConfigured(
    'SUPABASE_SERVICE_ROLE_KEY',
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
  );

  cached = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { 'x-wordcourt-service': 'admin' },
    },
  });
  return cached;
}
