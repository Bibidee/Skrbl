// Supabase Edge Function: update-leaderboard
// Upserts player stats when a game ends.
// Triggered via POST { genlayerGameId, players, scores, winner }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function cors(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const body = await req.json().catch(() => ({})) as {
    players?: string[];
    scores?: Record<string, number>;
    winner?: string | null;
  };

  if (!body.players || !body.scores) {
    return cors(400, { error: 'missing players or scores' });
  }

  const results: Array<{ wallet: string; ok: boolean }> = [];

  for (const wallet of body.players) {
    const score = body.scores[wallet] ?? 0;
    const isWinner = body.winner && wallet.toLowerCase() === body.winner.toLowerCase();

    const { data: existing } = await supabase
      .from('leaderboard')
      .select('*')
      .eq('wallet_address', wallet.toLowerCase())
      .maybeSingle();

    const prev = existing ?? {
      games_played: 0, wins: 0, losses: 0, total_score: 0,
      highest_word_score: 0, average_score: 0, rank_points: 0,
    };

    const gamesPlayed = (prev.games_played as number) + 1;
    const wins = (prev.wins as number) + (isWinner ? 1 : 0);
    const losses = (prev.losses as number) + (isWinner ? 0 : 1);
    const totalScore = (prev.total_score as number) + score;
    const rankPoints = Math.max(0, (prev.rank_points as number) + (isWinner ? 25 : -10));

    const { error } = await supabase.from('leaderboard').upsert(
      {
        wallet_address: wallet.toLowerCase(),
        games_played: gamesPlayed,
        wins,
        losses,
        total_score: totalScore,
        average_score: Math.round(totalScore / gamesPlayed),
        highest_word_score: Math.max(prev.highest_word_score as number, score),
        rank_points: rankPoints,
      },
      { onConflict: 'wallet_address' },
    );
    results.push({ wallet: wallet.slice(0, 8), ok: !error });
  }

  return cors(200, { ok: true, results });
});
