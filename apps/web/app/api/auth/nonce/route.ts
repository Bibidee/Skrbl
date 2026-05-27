/**
 * POST /api/auth/nonce
 *
 * Body: { walletAddress: string }
 * Returns: { nonce: string, expiresAt: string }
 *
 * Generates a one-time SIWE nonce, stores it in `siwe_nonces` so /verify can
 * mark it consumed, and returns it to the client. The client builds the SIWE
 * message client-side using this nonce and signs it with the connected wallet.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSupabase } from '@/lib/supabase';
import { clientLogger } from '@/lib/logger/client';

const NONCE_TTL_MINUTES = 10;

const Body = z.object({
  walletAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'wallet_address_invalid'),
  domain: z.string().min(1).optional(),
});

function randomNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(req: Request) {
  const json = (await req.json().catch(() => ({}))) as unknown;
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_body', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const wallet = parsed.data.walletAddress.toLowerCase();
  const domain = parsed.data.domain ?? new URL(req.url).host;
  const nonce = randomNonce();
  const expiresAt = new Date(Date.now() + NONCE_TTL_MINUTES * 60_000).toISOString();

  const supabase = getAdminSupabase();
  const { error } = await supabase.from('siwe_nonces').insert({
    wallet_address: wallet,
    nonce,
    domain,
    expires_at: expiresAt,
  });
  if (error) {
    clientLogger.error('siwe nonce insert failed', { code: error.code, msg: error.message });
    return NextResponse.json({ error: 'nonce_store_failed' }, { status: 500 });
  }

  return NextResponse.json({ nonce, expiresAt, domain });
}
