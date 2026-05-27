'use client';

/**
 * Browser Supabase client. Uses the anon key + cookie-based auth (via
 * @supabase/ssr) so the same session works across server components, server
 * actions, and the browser. RLS policies apply.
 *
 * The client is created lazily on first call. We throw a precise error if the
 * Supabase env vars haven't been configured yet — the rest of the app can
 * still mount without Supabase configured (Phase 3a tolerance).
 */
import { createBrowserClient } from '@supabase/ssr';
import { assertConfigured, clientEnv } from '../env/client';
import type { Database } from './types';

let cached: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function getBrowserSupabase() {
  if (cached) return cached;
  const url = assertConfigured('NEXT_PUBLIC_SUPABASE_URL', clientEnv.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = assertConfigured(
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  cached = createBrowserClient<Database>(url, anonKey);
  return cached;
}
