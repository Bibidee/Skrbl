/**
 * Slim client-side logger. Quietly gated by NODE_ENV so production builds don't ship
 * noisy debug output. Replace with a real client-shipping logger (Sentry, LogRocket)
 * later by editing this file only; call sites are stable.
 */

type Level = 'debug' | 'info' | 'warn' | 'error';

const enabled: Record<Level, boolean> =
  process.env.NODE_ENV === 'production'
    ? { debug: false, info: false, warn: true, error: true }
    : { debug: true, info: true, warn: true, error: true };

function emit(level: Level, message: string, context?: Record<string, unknown>): void {
  if (!enabled[level]) return;
  const payload = context ? [message, context] : [message];
  (console[level === 'debug' ? 'log' : level] as (...args: unknown[]) => void)(...payload);
}

export const clientLogger = {
  debug: (msg: string, ctx?: Record<string, unknown>) => emit('debug', msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => emit('info', msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => emit('warn', msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => emit('error', msg, ctx),
};
