/**
 * POST /api/account/signup
 * Body: { email, password, displayName?, walletAddress, encryptedWallet }
 *
 * The wallet is generated and encrypted client-side; we only store the
 * ciphertext blob. We hash the password (scrypt) for login verification and
 * issue a session JWT bound to the generated wallet address.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSupabase } from '@/lib/supabase';
import { hashPassword } from '@/lib/auth/password';
import { signSessionJwt, SESSION_COOKIE } from '@/lib/auth/jwt';
import { serverEnv } from '@/lib/env';

export const runtime = 'nodejs';

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  displayName: z.string().trim().min(1).max(40).optional(),
  walletAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  encryptedWallet: z.object({
    ciphertext: z.string(),
    iv: z.string(),
    salt: z.string(),
    iterations: z.number().int().positive(),
    v: z.literal(1),
  }),
});

export async function POST(req: Request) {
  const json = (await req.json().catch(() => ({}))) as unknown;
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  }
  const { email, password, displayName, walletAddress, encryptedWallet } = parsed.data;
  const wallet = walletAddress.toLowerCase();
  const supabase = getAdminSupabase();

  // Reject duplicate email.
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .ilike('email', email)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: 'email_taken' }, { status: 409 });
  }

  const password_hash = await hashPassword(password);
  const { error } = await supabase.from('profiles').insert({
    wallet_address: wallet,
    email,
    password_hash,
    encrypted_wallet: encryptedWallet,
    display_name: displayName ?? null,
    username: displayName ?? null,
  });
  if (error) {
    const code = error.message.includes('duplicate') ? 409 : 500;
    return NextResponse.json({ error: 'signup_failed', detail: error.message }, { status: code });
  }

  const token = await signSessionJwt(wallet);
  const res = NextResponse.json({ walletAddress: wallet, displayName: displayName ?? null });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: serverEnv.SIWE_SESSION_TTL_SECONDS,
  });
  return res;
}
