/**
 * Server Supabase client for React Server Components, Server Actions, and
 * Route Handlers. Uses the anon key + Next's `cookies()` bridge so RLS sees
 * the authenticated wallet (after SIWE) just like the browser client does.
 *
 * Do NOT use this from a Route Handler that mutates cookies during a static
 * render; use it inside dynamic handlers (which we always do for /api/*).
 */
import 'server-only';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { assertConfigured, clientEnv } from '../env/client';
import type { Database } from './types';

export async function getServerSupabase() {
  const url = assertConfigured('NEXT_PUBLIC_SUPABASE_URL', clientEnv.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = assertConfigured(
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
        // setAll is only valid inside route handlers / server actions; the cookies()
        // store is read-only inside RSCs. Wrap in try/catch so RSC reads don't crash.
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // RSC context: ignore.
        }
      },
    },
  });
}
