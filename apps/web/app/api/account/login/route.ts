/**
 * POST /api/account/login
 * Body: { email, password }
 *
 * Verifies the password, returns the encrypted wallet blob (decrypted only in
 * the browser), and issues a session JWT bound to the wallet address.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSupabase } from '@/lib/supabase';
import { verifyPassword } from '@/lib/auth/password';
import { signSessionJwt, SESSION_COOKIE } from '@/lib/auth/jwt';
import { serverEnv } from '@/lib/env';

export const runtime = 'nodejs';

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  const json = (await req.json().catch(() => ({}))) as unknown;
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const { email, password } = parsed.data;
  const supabase = getAdminSupabase();

  const { data: profile } = await supabase
    .from('profiles')
    .select('wallet_address, password_hash, encrypted_wallet, display_name')
    .ilike('email', email)
    .maybeSingle();

  // Same generic error whether the email is unknown or the password is wrong.
  if (!profile || !profile.password_hash) {
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }
  const ok = await verifyPassword(password, profile.password_hash as string);
  if (!ok) {
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }

  const wallet = String(profile.wallet_address).toLowerCase();
  const token = await signSessionJwt(wallet);
  const res = NextResponse.json({
    walletAddress: wallet,
    displayName: profile.display_name ?? null,
    encryptedWallet: profile.encrypted_wallet,
  });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: serverEnv.SIWE_SESSION_TTL_SECONDS,
  });
  return res;
}
