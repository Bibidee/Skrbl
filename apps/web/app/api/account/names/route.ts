/**
 * POST /api/account/names
 * Body: { wallets: string[] }
 * Returns { names: { [walletLower]: displayName } } for any wallets that have
 * a display name set. Public read (no auth) so names render anywhere a wallet
 * address is shown.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSupabase } from '@/lib/supabase';

export const runtime = 'nodejs';

const Body = z.object({ wallets: z.array(z.string()).max(200) });

export async function POST(req: Request) {
  const json = (await req.json().catch(() => ({}))) as unknown;
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ names: {} });
  }
  const wallets = [...new Set(parsed.data.wallets.map((w) => w.toLowerCase()))];
  if (wallets.length === 0) return NextResponse.json({ names: {} });

  const supabase = getAdminSupabase();
  const { data } = await supabase
    .from('profiles')
    .select('wallet_address, display_name')
    .in('wallet_address', wallets);

  const names: Record<string, string> = {};
  for (const row of data ?? []) {
    if (row.display_name) names[String(row.wallet_address).toLowerCase()] = row.display_name as string;
  }
  return NextResponse.json({ names });
}
