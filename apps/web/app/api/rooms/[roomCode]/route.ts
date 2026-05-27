/**
 * GET  /api/rooms/[roomCode]      - read room + roster + game cache
 * POST /api/rooms/[roomCode]/join - add caller to room_players at next free seat
 */
import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase';
import { requireWallet, UnauthorisedError } from '@/lib/auth/session';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ roomCode: string }> },
) {
  const { roomCode } = await params;
  const supabase = getAdminSupabase();
  const { data: room, error } = await supabase
    .from('rooms')
    .select('*, room_players(wallet_address, seat_index, is_ready, joined_at)')
    .eq('room_code', roomCode)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!room) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  let game = null;
  if (room.genlayer_game_id) {
    const { data: gameRow } = await supabase
      .from('games')
      .select('*')
      .eq('genlayer_game_id', room.genlayer_game_id)
      .maybeSingle();
    game = gameRow;
  }
  return NextResponse.json({ room, game });
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ roomCode: string }> },
) {
  try {
    const wallet = await requireWallet();
    const { roomCode } = await params;
    const supabase = getAdminSupabase();

    // Accept either a room_code or a genlayer_game_id (e.g. "wc_xxx"). The game
    // page only has the genlayer id, so we resolve it here.
    const isGameId = roomCode.startsWith('wc_');
    const { data: room, error: roomErr } = await supabase
      .from('rooms')
      .select('*, room_players(wallet_address, seat_index)')
      .eq(isGameId ? 'genlayer_game_id' : 'room_code', roomCode)
      .maybeSingle();
    if (roomErr) return NextResponse.json({ error: roomErr.message }, { status: 500 });
    if (!room) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    if (room.status !== 'waiting') {
      return NextResponse.json({ error: 'room_not_joinable' }, { status: 400 });
    }

    const players = (room.room_players ?? []) as Array<{ wallet_address: string; seat_index: number }>;
    if (players.some((p) => p.wallet_address.toLowerCase() === wallet)) {
      return NextResponse.json({ room });
    }
    if (players.length >= room.max_players) {
      return NextResponse.json({ error: 'room_full' }, { status: 400 });
    }
    const takenSeats = new Set(players.map((p) => p.seat_index));
    let seat = 0;
    while (takenSeats.has(seat)) seat += 1;

    const { error: joinErr } = await supabase.from('room_players').insert({
      room_id: room.id,
      wallet_address: wallet,
      seat_index: seat,
      is_ready: false,
    });
    if (joinErr) {
      return NextResponse.json({ error: 'join_failed', detail: joinErr.message }, { status: 500 });
    }
    await supabase
      .from('rooms')
      .update({ current_players: players.length + 1 })
      .eq('id', room.id);
    return NextResponse.json({ joined: true, seat });
  } catch (e) {
    if (e instanceof UnauthorisedError) {
      return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
    }
    return NextResponse.json({ error: 'unknown', detail: (e as Error).message }, { status: 500 });
  }
}
