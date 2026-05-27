'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { History } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { getRecentGames, type OnChainGame } from '@/lib/genlayer';

export default function HistoryPage() {
  const [games, setGames] = useState<OnChainGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await getRecentGames(50);
        if (!cancelled) setGames(data);
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
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-text-dark">
          <History size={22} className="text-primary" /> Match history
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Past WordCourt games ranked by length. Click any to inspect the official board.
        </p>

        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          {loading && <p className="p-6 text-sm text-text-muted">Loading from GenLayer…</p>}
          {error && <p className="p-6 text-sm text-danger">{error}</p>}
          {!loading && !error && games.length === 0 && (
            <p className="p-6 text-sm text-text-muted">No completed games yet.</p>
          )}
          {games.map((g) => (
            <Link
              key={g.game_id}
              href={`/game/${g.game_id}`}
              className="grid grid-cols-2 gap-4 border-b border-border/40 px-5 py-4 hover:bg-surface-soft sm:grid-cols-5"
            >
              <div className="font-mono text-xs">{g.game_id}</div>
              <div className="text-sm">
                {g.word_mode}
                {g.theme !== 'none' ? ` / ${g.theme}` : ''}
              </div>
              <div className="text-sm tabular-nums">{g.move_count} moves</div>
              <div className="text-sm">
                {g.winner ? (
                  <span className="font-mono">
                    Winner {g.winner.slice(0, 6)}…{g.winner.slice(-4)}
                  </span>
                ) : (
                  <span className="text-text-muted">In progress</span>
                )}
              </div>
              <div className="text-sm text-text-muted">{g.end_reason ?? ''}</div>
            </Link>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
