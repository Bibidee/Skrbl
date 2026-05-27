/**
 * POST /api/tiles/deal
 *
 * Body: { genlayerGameId: string, roomCode: string }
 *
 * Caller must be the room creator (verified via SIWE cookie). Generates a
 * fresh shuffled tile bag, deals 7 tiles to each player in seat order, writes
 * private racks + tile_bags rows, and returns the commitments the client must
 * submit to GenLayer (commit_tile_bag, commit_rack-per-player, then start_game).
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSupabase } from '@/lib/supabase';
import { requireWallet, UnauthorisedError } from '@/lib/auth/session';
import { dealLimiter } from '@/lib/rate-limit';
import { dealInitial, freshSeed } from '@/lib/tiles/bag';
import { hashBagCommitment, hashRackCommitment } from '@/lib/tiles/commitments';

const Body = z.object({
  genlayerGameId: z.string().min(1),
  roomCode: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const wallet = await requireWallet();
    const rl = dealLimiter.check(`deal:${wallet}`);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'rate_limited', resetAt: rl.resetAt }, { status: 429 });
    }
    const json = (await req.json().catch(() => ({}))) as unknown;
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
    }
    const supabase = getAdminSupabase();

    const { data: room, error: roomErr } = await supabase
      .from('rooms')
      .select('*, room_players(wallet_address, seat_index)')
      .eq('room_code', parsed.data.roomCode)
      .maybeSingle();
    if (roomErr) return NextResponse.json({ error: roomErr.message }, { status: 500 });
    if (!room) return NextResponse.json({ error: 'room_not_found' }, { status: 404 });
    if (room.creator_wallet.toLowerCase() !== wallet) {
      return NextResponse.json({ error: 'only_creator_can_deal' }, { status: 403 });
    }
    if (room.genlayer_game_id !== parsed.data.genlayerGameId) {
      return NextResponse.json({ error: 'game_id_mismatch' }, { status: 400 });
    }

    const seats = (room.room_players ?? []).sort(
      (a: { seat_index: number }, b: { seat_index: number }) => a.seat_index - b.seat_index,
    ) as Array<{ wallet_address: string; seat_index: number }>;
    if (seats.length < 2) {
      return NextResponse.json({ error: 'need_two_players' }, { status: 400 });
    }

    // Build the game row first so player_racks can reference games.id.
    const { data: game, error: gameErr } = await supabase
      .from('games')
      .upsert(
        {
          genlayer_game_id: room.genlayer_game_id,
          room_id: room.id,
          status: 'dealing',
          word_mode: room.word_mode,
          theme: room.theme,
          dictionary_mode: room.dictionary_mode,
          creator_wallet: room.creator_wallet,
          tile_bag_remaining: 100,
        },
        { onConflict: 'genlayer_game_id' },
      )
      .select('*')
      .single();
    if (gameErr || !game) {
      return NextResponse.json({ error: 'game_upsert_failed', detail: gameErr?.message }, { status: 500 });
    }

    const seed = freshSeed();
    const deal = dealInitial(seats.length, seed.seedNumeric);
    const bagCommitment = hashBagCommitment(deal.orderedBag);

    // Player racks
    type RackInsert = {
      game_id: string;
      wallet_address: string;
      tiles: ReturnType<typeof dealInitial>['initialRacks'][number];
      rack_commitment: string;
      rack_version: number;
    };
    const rackInserts: RackInsert[] = seats.map((seat, i) => ({
      game_id: game.id,
      wallet_address: seat.wallet_address.toLowerCase(),
      tiles: deal.initialRacks[i] ?? [],
      rack_commitment: hashRackCommitment(seat.wallet_address, deal.initialRacks[i] ?? [], 1),
      rack_version: 1,
    }));

    const { error: racksErr } = await supabase
      .from('player_racks')
      .upsert(rackInserts, { onConflict: 'game_id,wallet_address' });
    if (racksErr) {
      return NextResponse.json({ error: 'racks_upsert_failed', detail: racksErr.message }, { status: 500 });
    }

    // Tile bag (private). Stores the *post-deal* remaining order so draw-tiles
    // simply slices from the front.
    const { error: bagErr } = await supabase
      .from('tile_bags')
      .upsert(
        {
          game_id: game.id,
          remaining_tiles: deal.remaining,
          used_tiles: [],
          exchanged_tiles: [],
          bag_commitment: bagCommitment,
          draw_count: seats.length * 7,
        },
        { onConflict: 'game_id' },
      );
    if (bagErr) {
      return NextResponse.json({ error: 'bag_upsert_failed', detail: bagErr.message }, { status: 500 });
    }

    // Game players seed rows so /api/games can join them.
    await supabase.from('game_players').upsert(
      seats.map((s) => ({
        game_id: game.id,
        wallet_address: s.wallet_address.toLowerCase(),
        seat_index: s.seat_index,
        score: 0,
        rack_count: 7,
      })),
      { onConflict: 'game_id,wallet_address' },
    );

    await supabase
      .from('games')
      .update({ tile_bag_remaining: deal.remaining.length })
      .eq('id', game.id);

    return NextResponse.json({
      gameId: game.id,
      genlayerGameId: room.genlayer_game_id,
      bagCommitment,
      rackCommitments: rackInserts.map((r) => ({
        walletAddress: r.wallet_address,
        rackCommitment: r.rack_commitment,
      })),
      remainingTiles: deal.remaining.length,
    });
  } catch (e) {
    if (e instanceof UnauthorisedError) {
      return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
    }
    return NextResponse.json({ error: 'unknown', detail: (e as Error).message }, { status: 500 });
  }
}
