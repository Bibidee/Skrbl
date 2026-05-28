'use client';

import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { getLeaderboard, type PlayerStats } from '@/lib/genlayer';
import { useDisplayNames } from '@/hooks/useDisplayNames';

export default function LeaderboardPage() {
  const [rows, setRows] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { label, short } = useDisplayNames(rows.map((r) => r.player));

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await getLeaderboard(100);
        if (!cancelled) setRows(data);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-text-dark">
          <Trophy size={22} className="text-accent-gold" /> Leaderboard
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Ranked by GenLayer rank points (wins +25, losses -10). Live from the contract.
        </p>

        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-soft text-left text-xs uppercase tracking-wide text-text-muted">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3 text-right">Rank pts</th>
                <th className="px-4 py-3 text-right">Wins</th>
                <th className="px-4 py-3 text-right">Losses</th>
                <th className="px-4 py-3 text-right">High score</th>
                <th className="px-4 py-3 text-right">Games</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td className="px-4 py-6 text-text-muted" colSpan={7}>
                    Loading from GenLayer…
                  </td>
                </tr>
              )}
              {error && (
                <tr>
                  <td className="px-4 py-6 text-danger" colSpan={7}>
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && rows.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-text-muted" colSpan={7}>
                    No completed games yet. Be the first.
                  </td>
                </tr>
              )}
              {rows.map((r, i) => (
                <tr key={r.player} className="border-b border-border/40">
                  <td className="px-4 py-3 font-mono text-text-muted">{i + 1}</td>
                  <td className="px-4 py-3 text-xs text-text-dark">
                    <span className="font-semibold">{label(r.player)}</span>
                    <span className="ml-2 font-mono text-[10px] text-text-muted">{short(r.player)}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-primary tabular-nums">
                    {r.rank_points}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.wins}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.losses}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.highest_score}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.games_played}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
      <Footer />
    </>
  );
}
