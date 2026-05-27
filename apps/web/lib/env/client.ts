/**
 * Client-safe environment variables. Only NEXT_PUBLIC_* values live here.
 *
 * Imported from both server and client code. Schema is permissive in development
 * (so the app can boot before secrets are filled in) and strict in production.
 */
import { z } from 'zod';

/**
 * Phase-aware validation: every variable is "optional at boot, required at use".
 * The schema only refuses to load when a value is *present but malformed* (e.g. a
 * Supabase URL set to "not-a-url"). Consumers (`lib/supabase`, `lib/genlayer`, etc.)
 * call `assertConfigured(...)` from this module when they need a real value, which
 * throws a precise, actionable error pointing at the missing env var.
 *
 * This avoids the prerender-time crash you get if you require Supabase at build
 * time before Supabase is provisioned.
 */
const optionalUrl = z
  .string()
  .url()
  .optional()
  .or(z.literal('').transform(() => undefined));

const optionalUrlOrPath = z
  .string()
  .trim()
  .refine((value) => {
    if (value.startsWith('/')) return true;
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Must be an absolute http(s) URL or a same-origin path beginning with /')
  .optional()
  .or(z.literal('').transform(() => undefined));

const optionalString = z
  .string()
  .optional()
  .or(z.literal('').transform(() => undefined));

const ClientEnvSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().default('WordCourt'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),

  // Browser code must use the same-origin proxy to avoid upstream RPC CORS.
  NEXT_PUBLIC_GENLAYER_RPC_PROXY_URL: optionalUrlOrPath.default('/api/genlayer/rpc'),
  NEXT_PUBLIC_CHAIN_ID: z.coerce.number().int().positive().default(61999),
  NEXT_PUBLIC_GENLAYER_EXPLORER_URL: z
    .string()
    .url()
    .default('https://explorer-studio.genlayer.com'),
  // Empty until the contract is deployed and the user supplies the address.
  NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS: optionalString,

  // Filled in during Phase 3 (Supabase). Consumers must call assertConfigured().
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalString,

});

export type ClientEnv = z.infer<typeof ClientEnvSchema>;

function parse(): ClientEnv {
  const parsed = ClientEnvSchema.safeParse({
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_GENLAYER_RPC_PROXY_URL: process.env.NEXT_PUBLIC_GENLAYER_RPC_PROXY_URL,
    NEXT_PUBLIC_CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID,
    NEXT_PUBLIC_GENLAYER_EXPLORER_URL: process.env.NEXT_PUBLIC_GENLAYER_EXPLORER_URL,
    NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS: process.env.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid client environment variables:\n${issues}`);
  }
  return parsed.data;
}

export const clientEnv: ClientEnv = parse();

/**
 * Throws a precise error if an env var is not configured. Use at the point where
 * a feature actually needs the value (e.g. creating the Supabase client), not at
 * module load — this lets the app boot and surface clear errors only when the
 * affected feature is exercised.
 */
export function assertConfigured<K extends keyof ClientEnv>(
  key: K,
  value: ClientEnv[K] | undefined,
): NonNullable<ClientEnv[K]> {
  if (value === undefined || value === null || value === '') {
    throw new Error(
      `Environment variable ${String(key)} is not configured. Add it to apps/web/.env.local and restart the dev server.`,
    );
  }
  return value as NonNullable<ClientEnv[K]>;
}
