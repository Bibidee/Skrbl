/**
 * POST /api/account/name
 * Body: { displayName }
 * Saves the display name against the signed-in wallet address.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSupabase } from '@/lib/supabase';
import { requireWallet, UnauthorisedError } from '@/lib/auth/session';

export const runtime = 'nodejs';

const Body = z.object({ displayName: z.string().trim().min(1).max(40) });

export async function POST(req: Request) {
  try {
    const wallet = await requireWallet();
    const json = (await req.json().catch(() => ({}))) as unknown;
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    }
    const supabase = getAdminSupabase();
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: parsed.data.displayName, username: parsed.data.displayName })
      .eq('wallet_address', wallet);
    if (error) {
      return NextResponse.json({ error: 'update_failed', detail: error.message }, { status: 500 });
    }
    return NextResponse.json({ displayName: parsed.data.displayName });
  } catch (e) {
    if (e instanceof UnauthorisedError) {
      return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
    }
    return NextResponse.json({ error: 'unknown', detail: (e as Error).message }, { status: 500 });
  }
}
