/**
 * POST /api/tiles/draw
 *
 * Replenishes the caller's tile rack after a move or pass.
 *
 * Body: {
 *   genlayerGameId: string,   // wc_xxx — GenLayer game ID from the URL
 *   placedTileIds:  string[], // IDs of tiles placed on the board (empty for pass)
 *   phase:          'prepare' | 'finalize'
 * }
 *
 * Two-phase flow (needed because GenLayer must receive the commitment BEFORE
 * the tiles are written to the DB):
 *
 *   prepare  – computes the new rack + commitment; no DB writes.
 *              Call this BEFORE submitting the move to GenLayer so you have
 *              the real nextRackCommitment to pass into submit_move / pass_turn.
 *
 *   finalize – persists the new rack + updated bag to Supabase.
 *              Call this only after GenLayer has accepted the move.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { RACK_SIZE } from '@wordcourt/shared';
import type { RackTile } from '@wordcourt/shared';
import { getAdminSupabase } from '@/lib/supabase';
import { requireWallet, UnauthorisedError } from '@/lib/auth/session';
import { tileOpLimiter } from '@/lib/rate-limit';
import { drawFromBag } from '@/lib/tiles/bag';
import { hashRackCommitment } from '@/lib/tiles/commitments';

const Body = z.object({
  genlayerGameId: z.string().min(1),
  placedTileIds: z.array(z.string()),
  phase: z.enum(['prepare', 'finalize']),
});

export async function POST(req: Request) {
  try {
    const wallet = await requireWallet();
    const rl = tileOpLimiter.check(`draw:${wallet}`);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'rate_limited', resetAt: rl.resetAt }, { status: 429 });
    }
    const json = (await req.json().catch(() => ({}))) as unknown;
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
    }
    const { genlayerGameId, placedTileIds, phase } = parsed.data;
    const supabase = getAdminSupabase();

    // Resolve genlayer_game_id → Supabase UUID (player_racks.game_id is UUID)
    const { data: game, error: gameErr } = await supabase
      .from('games')
      .select('id')
      .eq('genlayer_game_id', genlayerGameId)
      .maybeSingle();
    if (gameErr) return NextResponse.json({ error: gameErr.message }, { status: 500 });
    if (!game) return NextResponse.json({ error: 'game_not_found' }, { status: 404 });

    // Load caller's current rack
    const { data: rackRow, error: rackErr } = await supabase
      .from('player_racks')
      .select('tiles, rack_version')
      .eq('game_id', game.id)
      .eq('wallet_address', wallet)
      .maybeSingle();
    if (rackErr) return NextResponse.json({ error: rackErr.message }, { status: 500 });
    if (!rackRow) return NextResponse.json({ error: 'rack_not_found' }, { status: 404 });

    // Load tile bag
    const { data: bagRow, error: bagErr } = await supabase
      .from('tile_bags')
      .select('remaining_tiles, used_tiles, draw_count')
      .eq('game_id', game.id)
      .maybeSingle();
    if (bagErr) return NextResponse.json({ error: bagErr.message }, { status: 500 });
    if (!bagRow) return NextResponse.json({ error: 'bag_not_found' }, { status: 404 });

    const currentRack = (rackRow.tiles as RackTile[]) ?? [];
    const remaining = (bagRow.remaining_tiles as string[]) ?? [];
    const usedTiles = (bagRow.used_tiles as string[]) ?? [];
    const drawCount = (bagRow.draw_count as number) ?? 0;
    const currentVersion = (rackRow.rack_version as number) ?? 1;

    // Remove placed tiles from rack (tiles now committed to the board)
    const rackAfterPlacement = currentRack.filter((t) => !placedTileIds.includes(t.id));
    const needCount = Math.min(RACK_SIZE - rackAfterPlacement.length, remaining.length);

    // Draw tiles from the front of the ordered bag
    const { drawn, remaining: newRemaining } = drawFromBag(remaining, needCount);
    const newRack = [...rackAfterPlacement, ...drawn];
    const newVersion = currentVersion + 1;
    const newRackCommitment = hashRackCommitment(wallet, newRack, newVersion);

    if (phase === 'finalize') {
      const { error: rackUpdateErr } = await supabase
        .from('player_racks')
        .update({
          tiles: newRack,
          rack_commitment: newRackCommitment,
          rack_version: newVersion,
        })
        .eq('game_id', game.id)
        .eq('wallet_address', wallet);
      if (rackUpdateErr) {
        return NextResponse.json(
          { error: 'rack_update_failed', detail: rackUpdateErr.message },
          { status: 500 },
        );
      }

      const { error: bagUpdateErr } = await supabase
        .from('tile_bags')
        .update({
          remaining_tiles: newRemaining,
          used_tiles: [...usedTiles, ...drawn.map((t) => (t.isBlank ? '_' : t.letter))],
          draw_count: drawCount + drawn.length,
        })
        .eq('game_id', game.id);
      if (bagUpdateErr) {
        return NextResponse.json(
          { error: 'bag_update_failed', detail: bagUpdateErr.message },
          { status: 500 },
        );
      }

      await supabase
        .from('games')
        .update({ tile_bag_remaining: newRemaining.length })
        .eq('id', game.id);
    }

    return NextResponse.json({
      newRack,
      newRackCommitment,
      rackVersion: newVersion,
      drawnCount: drawn.length,
      tileBagRemaining: newRemaining.length,
    });
  } catch (e) {
    if (e instanceof UnauthorisedError) {
      return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
    }
    return NextResponse.json({ error: 'unknown', detail: (e as Error).message }, { status: 500 });
  }
}
