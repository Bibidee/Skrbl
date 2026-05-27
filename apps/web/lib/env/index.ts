/**
 * Server environment variables. NEVER import from a client component or anything
 * marked 'use client' — the bundler will fail you, and rightly so.
 *
 * Same phase-aware policy as `./client.ts`: every secret is "optional at boot,
 * required at use". Call `assertServerConfigured('FOO')` at the point where the
 * value is actually needed (e.g. creating the admin Supabase client) and you'll
 * get a precise, actionable error if the value is missing.
 */
import 'server-only';
import { z } from 'zod';
import { clientEnv, type ClientEnv } from './client';

const optionalString = z
  .string()
  .optional()
  .or(z.literal('').transform(() => undefined));

const optionalUrl = z
  .string()
  .url()
  .optional()
  .or(z.literal('').transform(() => undefined));

const ServerEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Supabase server keys
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  // Supabase JWT signing secret (Dashboard -> Project Settings -> API -> JWT Secret).
  // Used to mint Supabase-compatible session JWTs from the SIWE flow so RLS recognises
  // the connected wallet. Filled in Phase 3b.
  SUPABASE_JWT_SECRET: optionalString,

  // Commitment salts and SIWE secrets
  TILE_COMMITMENT_SECRET: optionalString,
  SIWE_JWT_SECRET: optionalString,
  SIWE_SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(86400),

  // GenLayer server operator (used for read-only sync; never used to sign player moves).
  // Filled when the contract goes live and a sync worker is provisioned.
  GENLAYER_OPERATOR_PRIVATE_KEY: optionalString,

  // Optional Upstash rate-limit credentials (fallback to in-memory when unset)
  UPSTASH_REDIS_REST_URL: optionalUrl,
  UPSTASH_REDIS_REST_TOKEN: optionalString,
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

function parseServer(): ServerEnv {
  const parsed = ServerEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid server environment variables:\n${issues}`);
  }
  return parsed.data;
}

export const serverEnv: ServerEnv = parseServer();

/**
 * Throws a precise error if a server env var is not configured. Use at the point
 * where a feature actually needs the value (e.g. creating the admin Supabase
 * client), not at module load.
 */
export function assertServerConfigured<K extends keyof ServerEnv>(
  key: K,
  value: ServerEnv[K] | undefined,
): NonNullable<ServerEnv[K]> {
  if (value === undefined || value === null || value === '') {
    throw new Error(
      `Server environment variable ${String(key)} is not configured. Add it to apps/web/.env.local and restart.`,
    );
  }
  return value as NonNullable<ServerEnv[K]>;
}

/** Convenience re-export so server code can grab everything from one import. */
export const env = { ...clientEnv, ...serverEnv } as ClientEnv & ServerEnv;
export type { ClientEnv };
