/**
 * POST /api/rooms     - create a new room (creator becomes seat 0)
 * GET  /api/rooms     - list open public rooms (status='waiting', not private)
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isValidModeTheme } from '@wordcourt/shared';
import { getAdminSupabase } from '@/lib/supabase';
import { requireWallet, UnauthorisedError } from '@/lib/auth/session';

const CreateBody = z.object({
  roomCode: z.string().regex(/^[A-Z0-9]{4,12}$/, 'room_code_format'),
  genlayerGameId: z.string().min(1),
  wordMode: z.enum(['classic', 'themed', 'custom']),
  theme: z.enum(['none', 'crypto', 'genlayer']),
  maxPlayers: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  isPrivate: z.boolean().optional(),
  turnSeconds: z.number().int().positive().max(900).optional(),
});

export async function POST(req: Request) {
  try {
    const wallet = await requireWallet();
    const json = (await req.json().catch(() => ({}))) as unknown;
    const parsed = CreateBody.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'invalid_body', issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const body = parsed.data;
    if (!isValidModeTheme(body.wordMode, body.theme)) {
      return NextResponse.json({ error: 'mode_theme_mismatch' }, { status: 400 });
    }

    const supabase = getAdminSupabase();

    const { data: room, error: roomErr } = await supabase
      .from('rooms')
      .insert({
        room_code: body.roomCode,
        creator_wallet: wallet,
        max_players: body.maxPlayers,
        // Map the new (word_mode, theme) onto the legacy `mode` field for
        // back-compat: classic/custom both map to 'classic', themed maps to
        // its theme. New code reads word_mode + theme directly.
        mode: body.wordMode === 'themed' ? (body.theme === 'crypto' ? 'crypto' : 'classic') : 'classic',
        word_mode: body.wordMode,
        theme: body.theme,
        dictionary_mode: body.wordMode === 'themed' ? body.theme : body.wordMode,
        status: 'waiting',
        genlayer_game_id: body.genlayerGameId,
        is_private: body.isPrivate ?? false,
        turn_seconds: body.turnSeconds ?? 120,
        current_players: 1,
      })
      .select('*')
      .single();
    if (roomErr || !room) {
      return NextResponse.json(
        { error: 'room_insert_failed', detail: roomErr?.message ?? 'unknown' },
        { status: 500 },
      );
    }

    const { error: playerErr } = await supabase.from('room_players').insert({
      room_id: room.id,
      wallet_address: wallet,
      seat_index: 0,
      is_ready: true,
    });
    if (playerErr) {
      // Roll back the room so the creator can retry without "room_code_taken".
      await supabase.from('rooms').delete().eq('id', room.id);
      return NextResponse.json(
        { error: 'room_player_insert_failed', detail: playerErr.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ room });
  } catch (e) {
    if (e instanceof UnauthorisedError) {
      return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
    }
    return NextResponse.json({ error: 'unknown', detail: (e as Error).message }, { status: 500 });
  }
}

export async function GET() {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from('rooms')
    .select('*, room_players(wallet_address, seat_index, is_ready)')
    .eq('status', 'waiting')
    .eq('is_private', false)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) {
    return NextResponse.json({ error: 'list_failed', detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ rooms: data ?? [] });
}
