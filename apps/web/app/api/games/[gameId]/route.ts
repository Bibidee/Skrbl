/** GET /api/games/[gameId] - returns the public Supabase cache for a game. */
import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  const { gameId } = await params;
  const supabase = getAdminSupabase();
  const { data: game, error } = await supabase
    .from('games')
    .select('*, game_players(wallet_address, seat_index, score, rack_count, final_rank, has_finished)')
    .or(`id.eq.${gameId},genlayer_game_id.eq.${gameId}`)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!game) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data: cells } = await supabase
    .from('board_cells')
    .select('*')
    .eq('game_id', game.id);

  return NextResponse.json({ game, board: cells ?? [] });
}
