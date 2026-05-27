/**
 * POST /api/genlayer/sync-game
 *
 * Syncs the authoritative GenLayer game state into Supabase.
 * Called by the client after game-state-changing transactions
 * (submit_move, end_game, forfeit_game) to keep the Supabase cache
 * consistent for read-heavy queries (history page, leaderboard).
 *
 * Body: { genlayerGameId: string }
 *
 * Idempotent — can be called multiple times safely.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSupabase } from '@/lib/supabase';
import { requireWallet, UnauthorisedError } from '@/lib/auth/session';
import { getGame } from '@/lib/genlayer';

const Body = z.object({
  genlayerGameId: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    await requireWallet();
    const json = (await req.json().catch(() => ({}))) as unknown;
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
    }
    const { genlayerGameId } = parsed.data;

    // Fetch authoritative state from GenLayer
    const onChainGame = await getGame(genlayerGameId);
    if (!onChainGame) {
      return NextResponse.json({ error: 'game_not_found_on_chain' }, { status: 404 });
    }

    const supabase = getAdminSupabase();

    // Upsert games row with latest status + scores
    const { data: game, error: gameErr } = await supabase
      .from('games')
      .upsert(
        {
          genlayer_game_id: genlayerGameId,
          status: onChainGame.status,
          winner_wallet: onChainGame.winner ?? null,
          end_reason: onChainGame.end_reason ?? null,
          current_turn_wallet: onChainGame.status === 'active'
            ? (onChainGame.players[onChainGame.current_turn_index] ?? null)
            : null,
        },
        { onConflict: 'genlayer_game_id' },
      )
      .select('id')
      .single();
    if (gameErr || !game) {
      return NextResponse.json({ error: 'game_upsert_failed', detail: gameErr?.message }, { status: 500 });
    }

    // Upsert move history rows
    if (onChainGame.move_history.length > 0) {
      const moveRows = onChainGame.move_history.map((m) => ({
        game_id: game.id,
        genlayer_game_id: genlayerGameId,
        move_number: m.moveNumber,
        player_wallet: m.playerWallet.toLowerCase(),
        move_type: m.moveType,
        placements: m.placements ?? [],
        formed_words: m.formedWords ?? [],
        official_score: m.officialScore ?? 0,
      }));
      await supabase.from('moves').upsert(moveRows, { onConflict: 'game_id,move_number' });
    }

    // Upsert board_cells from the current board state
    const boardEntries = Object.entries(onChainGame.board);
    if (boardEntries.length > 0) {
      const cellRows = boardEntries.map(([key, tile]) => {
        const [rowStr, colStr] = key.split(',');
        return {
          game_id: game.id,
          row: Number(rowStr),
          col: Number(colStr),
          letter: (tile as { letter: string }).letter,
          is_blank: (tile as { isBlank?: boolean }).isBlank ?? false,
          placed_by: ((tile as { placedBy?: string }).placedBy ?? '').toLowerCase() || null,
        };
      });
      await supabase.from('board_cells').upsert(cellRows, { onConflict: 'game_id,row,col' });
    }

    // If the game is completed, update leaderboard for all players
    if (onChainGame.status === 'completed') {
      for (const playerWallet of onChainGame.players) {
        const playerScore = onChainGame.scores[playerWallet] ?? 0;
        const isWinner = onChainGame.winner?.toLowerCase() === playerWallet.toLowerCase();
        // Increment wins/losses and update scores using a raw upsert.
        // Supabase doesn't support increment-on-conflict natively, so we
        // read-then-write for correctness (single-writer assumption is fine here).
        const { data: existing } = await supabase
          .from('leaderboard')
          .select('*')
          .eq('wallet_address', playerWallet.toLowerCase())
          .maybeSingle();
        const prev = existing ?? {
          games_played: 0, wins: 0, losses: 0, total_score: 0,
          highest_word_score: 0, average_score: 0, rank_points: 0,
        };
        const gamesPlayed = (prev.games_played as number) + 1;
        const wins = (prev.wins as number) + (isWinner ? 1 : 0);
        const losses = (prev.losses as number) + (isWinner ? 0 : 1);
        const totalScore = (prev.total_score as number) + playerScore;
        const rankPoints = (prev.rank_points as number) + (isWinner ? 25 : -10);
        await supabase.from('leaderboard').upsert(
          {
            wallet_address: playerWallet.toLowerCase(),
            games_played: gamesPlayed,
            wins,
            losses,
            total_score: totalScore,
            average_score: gamesPlayed > 0 ? Math.round(totalScore / gamesPlayed) : 0,
            highest_word_score: Math.max((prev.highest_word_score as number), playerScore),
            rank_points: Math.max(0, rankPoints),
          },
          { onConflict: 'wallet_address' },
        );
      }
    }

    return NextResponse.json({ ok: true, status: onChainGame.status });
  } catch (e) {
    if (e instanceof UnauthorisedError) {
      return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
    }
    return NextResponse.json({ error: 'unknown', detail: (e as Error).message }, { status: 500 });
  }
}
