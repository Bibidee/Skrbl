/**
 * Session JWT issued after a successful SIWE flow. Carries the lower-cased
 * wallet address in `sub` and `wallet_address` claims. Symmetric HS256 signed
 * with SIWE_JWT_SECRET. Server-only.
 */
import 'server-only';
import { SignJWT, jwtVerify } from 'jose';
import { assertServerConfigured, serverEnv } from '../env';

const ISSUER = 'wordcourt';
const AUDIENCE = 'wordcourt-web';
export const SESSION_COOKIE = 'wc_session';

function secretKey(): Uint8Array {
  const raw = assertServerConfigured('SIWE_JWT_SECRET', serverEnv.SIWE_JWT_SECRET);
  return new TextEncoder().encode(raw);
}

export type WordCourtSession = {
  walletAddress: string;
  /** Issued-at, unix seconds. */
  iat: number;
  /** Expiry, unix seconds. */
  exp: number;
};

export async function signSessionJwt(walletAddress: string): Promise<string> {
  const wallet = walletAddress.toLowerCase();
  const ttl = serverEnv.SIWE_SESSION_TTL_SECONDS;
  return await new SignJWT({ wallet_address: wallet })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(wallet)
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(secretKey());
}

export async function verifySessionJwt(token: string): Promise<WordCourtSession> {
  const { payload } = await jwtVerify(token, secretKey(), {
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  const wallet = String(payload.wallet_address ?? payload.sub ?? '').toLowerCase();
  if (!wallet || !wallet.startsWith('0x')) {
    throw new Error('SESSION_INVALID_CLAIM');
  }
  return {
    walletAddress: wallet,
    iat: Number(payload.iat ?? 0),
    exp: Number(payload.exp ?? 0),
  };
}
