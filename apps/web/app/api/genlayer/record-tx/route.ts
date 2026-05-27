/**
 * POST /api/genlayer/record-tx
 *
 * Records a GenLayer transaction hash to the transactions table.
 * Provides an audit trail for every on-chain game action.
 *
 * Body: {
 *   txHash:          string,
 *   genlayerGameId:  string,
 *   actionType:      string,   // 'submit_move' | 'challenge' | 'exchange' | ...
 * }
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSupabase } from '@/lib/supabase';
import { requireWallet, UnauthorisedError } from '@/lib/auth/session';

const Body = z.object({
  txHash: z.string().min(1),
  genlayerGameId: z.string().min(1),
  actionType: z.string().min(1).max(64),
});

export async function POST(req: Request) {
  try {
    const wallet = await requireWallet();
    const json = (await req.json().catch(() => ({}))) as unknown;
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
    }
    const { txHash, genlayerGameId, actionType } = parsed.data;
    const supabase = getAdminSupabase();

    // Resolve genlayer_game_id → Supabase UUID for the FK reference
    const { data: game } = await supabase
      .from('games')
      .select('id')
      .eq('genlayer_game_id', genlayerGameId)
      .maybeSingle();

    const { error } = await supabase.from('transactions').insert({
      wallet_address: wallet,
      tx_hash: txHash,
      action_type: actionType,
      genlayer_game_id: genlayerGameId,
      game_id: game?.id ?? null,
      status: 'confirmed',
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    if (e instanceof UnauthorisedError) {
      return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
    }
    return NextResponse.json({ error: 'unknown', detail: (e as Error).message }, { status: 500 });
  }
}
