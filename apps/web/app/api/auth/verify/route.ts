/**
 * POST /api/auth/verify
 *
 * Body: { message: string, signature: string }
 *
 * Validates a SIWE message against the nonce we issued, marks the nonce
 * consumed, then mints a WordCourt session JWT and sets it as an httpOnly
 * cookie. Returns the wallet address that authenticated.
 */
import { NextResponse } from 'next/server';
import { SiweMessage } from 'siwe';
import { z } from 'zod';
import { getAdminSupabase } from '@/lib/supabase';
import { signSessionJwt, SESSION_COOKIE } from '@/lib/auth/jwt';
import { serverEnv } from '@/lib/env';
import { clientLogger } from '@/lib/logger/client';

const Body = z.object({
  message: z.string().min(1),
  signature: z.string().min(1),
});

export async function POST(req: Request) {
  const json = (await req.json().catch(() => ({}))) as unknown;
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_body', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const supabase = getAdminSupabase();

  let siwe: SiweMessage;
  try {
    siwe = new SiweMessage(parsed.data.message);
  } catch (e) {
    return NextResponse.json(
      { error: 'siwe_parse_failed', detail: (e as Error).message },
      { status: 400 },
    );
  }

  const wallet = siwe.address.toLowerCase();

  const { data: nonceRow, error: nonceFetchErr } = await supabase
    .from('siwe_nonces')
    .select('*')
    .eq('nonce', siwe.nonce)
    .maybeSingle();

  if (nonceFetchErr || !nonceRow) {
    return NextResponse.json({ error: 'nonce_not_found' }, { status: 400 });
  }
  if (nonceRow.consumed_at) {
    return NextResponse.json({ error: 'nonce_already_used' }, { status: 400 });
  }
  if (new Date(nonceRow.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: 'nonce_expired' }, { status: 400 });
  }
  if (nonceRow.wallet_address.toLowerCase() !== wallet) {
    return NextResponse.json({ error: 'nonce_wallet_mismatch' }, { status: 400 });
  }

  try {
    const verification = await siwe.verify({ signature: parsed.data.signature });
    if (!verification.success) {
      return NextResponse.json({ error: 'signature_invalid' }, { status: 401 });
    }
  } catch (e) {
    clientLogger.error('siwe verify threw', { msg: (e as Error).message });
    return NextResponse.json({ error: 'signature_invalid' }, { status: 401 });
  }

  // Mark nonce consumed (best-effort; double-consumption already prevented by
  // the maybeSingle()/consumed_at check above).
  await supabase
    .from('siwe_nonces')
    .update({ consumed_at: new Date().toISOString() })
    .eq('nonce', siwe.nonce);

  // Make sure a profile row exists so the lobby and leaderboard can join.
  await supabase
    .from('profiles')
    .upsert({ wallet_address: wallet }, { onConflict: 'wallet_address', ignoreDuplicates: true });

  const jwt = await signSessionJwt(wallet);

  const res = NextResponse.json({ walletAddress: wallet });
  res.cookies.set({
    name: SESSION_COOKIE,
    value: jwt,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: serverEnv.SIWE_SESSION_TTL_SECONDS,
  });
  return res;
}
