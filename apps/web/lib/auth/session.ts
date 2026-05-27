/**
 * Server-only helpers for reading the WordCourt session cookie inside API
 * routes / server actions / RSCs. `requireWallet()` throws a 401-style error
 * when the request is unauthenticated, so route handlers can use it directly
 * and let Next's error boundary surface a clean response.
 */
import 'server-only';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySessionJwt, type WordCourtSession } from './jwt';

export class UnauthorisedError extends Error {
  status = 401;
  constructor() {
    super('UNAUTHORISED');
  }
}

export async function getSession(): Promise<WordCourtSession | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    return await verifySessionJwt(token);
  } catch {
    return null;
  }
}

export async function requireWallet(): Promise<string> {
  const session = await getSession();
  if (!session) throw new UnauthorisedError();
  return session.walletAddress;
}
