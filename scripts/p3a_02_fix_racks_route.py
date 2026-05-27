"""
Phase 3A – Script 2
Fixes apps/web/app/api/racks/[gameId]/route.ts

BUG: The [gameId] URL param is the GenLayer game ID (e.g. wc_abc123), but
player_racks.game_id is the Supabase UUID. The original code queried
player_racks directly with the string game ID, which never matched.

FIX: First look up games.id (UUID) by genlayer_game_id, then query
player_racks with the UUID. Also returns rackCommitment so the game page
can use it for pass_turn without a placeholder.
"""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
TARGET = ROOT / "apps" / "web" / "app" / "api" / "racks" / "[gameId]" / "route.ts"

CONTENT = """\
/**
 * GET /api/racks/[gameId]
 *
 * Returns the caller's private tile rack for the given game.
 * [gameId] is the GenLayer game ID (e.g. wc_abc123), not the Supabase UUID.
 * Authenticated via SIWE session cookie; never returns another wallet's rack.
 */
import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase';
import { requireWallet, UnauthorisedError } from '@/lib/auth/session';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  try {
    const wallet = await requireWallet();
    const { gameId } = await params;
    const supabase = getAdminSupabase();

    // gameId from URL is genlayer_game_id; player_racks.game_id is a Supabase UUID.
    const { data: game, error: gameErr } = await supabase
      .from('games')
      .select('id')
      .eq('genlayer_game_id', gameId)
      .maybeSingle();
    if (gameErr) return NextResponse.json({ error: gameErr.message }, { status: 500 });
    if (!game) {
      // Game row may not exist yet (e.g. deal hasn't happened); return empty rack.
      return NextResponse.json({ tiles: [], rackCommitment: null, rackVersion: 0 });
    }

    const { data, error } = await supabase
      .from('player_racks')
      .select('tiles, rack_commitment, rack_version, updated_at')
      .eq('game_id', game.id)
      .eq('wallet_address', wallet)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ tiles: [], rackCommitment: null, rackVersion: 0 });

    return NextResponse.json({
      tiles: data.tiles,
      rackCommitment: data.rack_commitment,
      rackVersion: data.rack_version,
      updatedAt: data.updated_at,
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
print(f"[OK] Wrote {TARGET}")
