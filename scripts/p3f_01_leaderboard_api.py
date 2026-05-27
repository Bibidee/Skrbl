"""
Phase 3F – Script 1
Creates apps/web/app/api/leaderboard/route.ts

GET – returns leaderboard from Supabase (persisted stats from sync-game),
      with a fallback to GenLayer contract data.
POST – upsert one player's stats (called by sync-game after a game ends).
"""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
TARGET = ROOT / "apps" / "web" / "app" / "api" / "leaderboard" / "route.ts"
TARGET.parent.mkdir(parents=True, exist_ok=True)

CONTENT = """\
/**
 * GET  /api/leaderboard         – top-100 from Supabase leaderboard table
 * POST /api/leaderboard         – upsert player stats (called by sync-game)
 *
 * The Supabase leaderboard table is kept in sync by the sync-game route
 * whenever a game ends. This endpoint lets the frontend consume it as a
 * standard REST endpoint instead of hitting GenLayer directly (which adds
 * LLM round-trip latency).
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSupabase } from '@/lib/supabase';
import { requireWallet, UnauthorisedError } from '@/lib/auth/session';

export async function GET() {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from('leaderboard')
    .select('*')
    .order('rank_points', { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ leaderboard: data ?? [] });
}

const UpsertBody = z.object({
  walletAddress: z.string().min(1),
  gamesPlayed: z.number().int().min(0),
  wins: z.number().int().min(0),
  losses: z.number().int().min(0),
  totalScore: z.number().int().min(0),
  highestWordScore: z.number().int().min(0),
  averageScore: z.number().min(0),
  rankPoints: z.number().int(),
});

export async function POST(req: Request) {
  try {
    await requireWallet();
    const json = (await req.json().catch(() => ({}))) as unknown;
    const parsed = UpsertBody.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
    }
    const d = parsed.data;
    const supabase = getAdminSupabase();
    const { error } = await supabase
      .from('leaderboard')
      .upsert(
        {
          wallet_address: d.walletAddress.toLowerCase(),
          games_played: d.gamesPlayed,
          wins: d.wins,
          losses: d.losses,
          total_score: d.totalScore,
          highest_word_score: d.highestWordScore,
          average_score: d.averageScore,
          rank_points: d.rankPoints,
        },
        { onConflict: 'wallet_address' },
      );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
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
