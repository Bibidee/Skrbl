/**
 * GET  /api/games/[gameId]/chat  – fetch last 100 messages
 * POST /api/games/[gameId]/chat  – send a message
 *
 * [gameId] may be a genlayer_game_id (wc_...) or a Supabase UUID.
 * Uses the service-role client so RLS does not block reads; auth on write
 * is enforced via requireWallet().
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSupabase } from '@/lib/supabase';
import { requireWallet, UnauthorisedError } from '@/lib/auth/session';

const PostBody = z.object({
  message: z.string().min(1).max(2000),
});

async function resolveGameId(rawId: string): Promise<{ id: string; roomId: string | null } | null> {
  const supabase = getAdminSupabase();
  // `id` is a UUID column; querying it with a genlayer id like "wc_xxx" throws a
  // Postgres uuid-parse error and fails the whole .or() query. Pick the right
  // column up front based on the genlayer "wc_" prefix.
  const isGenlayerId = rawId.startsWith('wc_');
  const { data } = await supabase
    .from('games')
    .select('id, room_id')
    .eq(isGenlayerId ? 'genlayer_game_id' : 'id', rawId)
    .maybeSingle();
  return data ? { id: data.id as string, roomId: data.room_id as string | null } : null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  const { gameId } = await params;
  const game = await resolveGameId(gameId);
  if (!game) return NextResponse.json({ messages: [] });

  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, wallet_address, message, created_at')
    .eq('game_id', game.id)
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: data ?? [] });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  try {
    const wallet = await requireWallet();
    const { gameId } = await params;
    const json = (await req.json().catch(() => ({}))) as unknown;
    const parsed = PostBody.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
    }

    const game = await resolveGameId(gameId);
    if (!game) return NextResponse.json({ error: 'game_not_found' }, { status: 404 });

    const supabase = getAdminSupabase();
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        game_id: game.id,
        room_id: game.roomId,
        wallet_address: wallet,
        message: parsed.data.message,
      })
      .select('id, wallet_address, message, created_at')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ message: data }, { status: 201 });
  } catch (e) {
    if (e instanceof UnauthorisedError) {
      return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
    }
    return NextResponse.json({ error: 'unknown', detail: (e as Error).message }, { status: 500 });
  }
}
