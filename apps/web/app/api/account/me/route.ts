/**
 * GET /api/account/me
 * Returns the signed-in profile (wallet address, display name) and the
 * encrypted wallet blob so the client can unlock signing after a reload
 * (password is still required to decrypt — the blob alone is useless).
 */
import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ walletAddress: null, displayName: null, encryptedWallet: null });
  }
  const supabase = getAdminSupabase();
  const { data } = await supabase
    .from('profiles')
    .select('display_name, encrypted_wallet')
    .eq('wallet_address', session.walletAddress)
    .maybeSingle();
  return NextResponse.json({
    walletAddress: session.walletAddress,
    displayName: data?.display_name ?? null,
    encryptedWallet: data?.encrypted_wallet ?? null,
  });
}
