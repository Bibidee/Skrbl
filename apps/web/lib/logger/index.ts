/**
 * Server-side structured logger. Uses pino in JSON mode for production, pino-pretty
 * in development for readable output. Import only from server code.
 */
import 'server-only';
import pino, { type Logger } from 'pino';

const level = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

export const logger: Logger = pino({
  level,
  base: { app: 'wordcourt-web' },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.serviceRoleKey',
      '*.privateKey',
      '*.SUPABASE_SERVICE_ROLE_KEY',
      '*.GENLAYER_OPERATOR_PRIVATE_KEY',
      '*.SIWE_JWT_SECRET',
      '*.TILE_COMMITMENT_SECRET',
    ],
    censor: '[REDACTED]',
  },
  ...(process.env.NODE_ENV !== 'production'
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard' },
        },
      }
    : {}),
});

export function childLogger(bindings: Record<string, unknown>): Logger {
  return logger.child(bindings);
}
