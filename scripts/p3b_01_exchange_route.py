"""
Phase 3B – Script 1
Creates apps/web/app/api/tiles/exchange/route.ts

Same two-phase pattern as /api/tiles/draw:
  prepare  – compute new rack + commitments, NO DB writes
             Call before recordExchange on GenLayer.
  finalize – persist new rack + bag to Supabase after GenLayer accepted.
"""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
TARGET = ROOT / "apps" / "web" / "app" / "api" / "tiles" / "exchange" / "route.ts"
TARGET.parent.mkdir(parents=True, exist_ok=True)

CONTENT = """\
/**
 * POST /api/tiles/exchange
 *
 * Returns selected tiles to the bag and draws fresh replacements.
 * Requires >= 7 tiles remaining in the bag (standard Scrabble rule).
 *
 * Body: {
 *   genlayerGameId:    string,
 *   tileIdsToExchange: string[],  // rack tile IDs to return (1–7)
 *   phase:             'prepare' | 'finalize'
 * }
 *
 * Two-phase flow:
 *   prepare  – computes the new rack + two commitments; no DB writes.
 *              Call BEFORE recordExchange on GenLayer so you have the real
 *              exchangeCommitment and nextRackCommitment to submit.
 *   finalize – persists the new rack and updated bag; call only after
 *              GenLayer has accepted the record_exchange transaction.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { RackTile } from '@wordcourt/shared';
import { getAdminSupabase } from '@/lib/supabase';
import { requireWallet, UnauthorisedError } from '@/lib/auth/session';
import { exchangeFromRack, freshSeed } from '@/lib/tiles/bag';
import { hashExchangeCommitment, hashRackCommitment } from '@/lib/tiles/commitments';

const Body = z.object({
  genlayerGameId: z.string().min(1),
  tileIdsToExchange: z.array(z.string()).min(1).max(7),
  phase: z.enum(['prepare', 'finalize']),
});

const MIN_BAG_FOR_EXCHANGE = 7;

export async function POST(req: Request) {
  try {
    const wallet = await requireWallet();
    const json = (await req.json().catch(() => ({}))) as unknown;
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
    }
    const { genlayerGameId, tileIdsToExchange, phase } = parsed.data;
    const supabase = getAdminSupabase();

    // Resolve genlayer_game_id → Supabase UUID
    const { data: game, error: gameErr } = await supabase
      .from('games')
      .select('id')
      .eq('genlayer_game_id', genlayerGameId)
      .maybeSingle();
    if (gameErr) return NextResponse.json({ error: gameErr.message }, { status: 500 });
    if (!game) return NextResponse.json({ error: 'game_not_found' }, { status: 404 });

    // Load caller's rack
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
      .select('remaining_tiles, used_tiles, exchanged_tiles, draw_count')
      .eq('game_id', game.id)
      .maybeSingle();
    if (bagErr) return NextResponse.json({ error: bagErr.message }, { status: 500 });
    if (!bagRow) return NextResponse.json({ error: 'bag_not_found' }, { status: 404 });

    const currentRack = (rackRow.tiles as RackTile[]) ?? [];
    const remaining = (bagRow.remaining_tiles as string[]) ?? [];
    const usedTiles = (bagRow.used_tiles as string[]) ?? [];
    const exchangedTiles = (bagRow.exchanged_tiles as string[]) ?? [];
    const drawCount = (bagRow.draw_count as number) ?? 0;
    const currentVersion = (rackRow.rack_version as number) ?? 1;

    // Enforce minimum bag size
    if (remaining.length < MIN_BAG_FOR_EXCHANGE) {
      return NextResponse.json(
        { error: 'bag_too_small', bagRemaining: remaining.length, required: MIN_BAG_FOR_EXCHANGE },
        { status: 409 },
      );
    }

    // Validate that every requested tile ID exists in the rack
    const idsSet = new Set(tileIdsToExchange);
    const missing = tileIdsToExchange.filter((id) => !currentRack.some((t) => t.id === id));
    if (missing.length > 0) {
      return NextResponse.json({ error: 'tile_ids_not_in_rack', missing }, { status: 400 });
    }

    // Perform the exchange (deterministic with a fresh seed)
    const seed = freshSeed();
    const { newRack, newBag, returnedLetters, drawnLetters } = exchangeFromRack(
      currentRack,
      tileIdsToExchange,
      remaining,
      seed.seedNumeric,
    );

    const newVersion = currentVersion + 1;
    const exchangeCommitment = hashExchangeCommitment(wallet, returnedLetters, drawnLetters);
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
          remaining_tiles: newBag,
          used_tiles: [...usedTiles, ...drawnLetters],
          exchanged_tiles: [...exchangedTiles, ...returnedLetters],
          draw_count: drawCount + drawnLetters.length,
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
        .update({ tile_bag_remaining: newBag.length })
        .eq('id', game.id);
    }

    return NextResponse.json({
      newRack,
      exchangeCommitment,
      newRackCommitment,
      rackVersion: newVersion,
      drawnCount: drawnLetters.length,
      tileBagRemaining: newBag.length,
    });
  } catch (e) {
    if (e instanceof UnauthorisedError) {
      return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
    }
    return NextResponse.json({ error: 'unknown', detail: (e as Error).message }, { status: 500 });
  }
}
"""

TARGET.write_text(CONTENT, encoding="utf-8")
print(f"[OK] Created {TARGET}")
