'use client';

import { use, useEffect, useState } from 'react';
import { User } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { getPlayerStats, type PlayerStats } from '@/lib/genlayer';

export default function ProfilePage({ params }: { params: Promise<{ wallet: string }> }) {
  const { wallet } = use(params);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await getPlayerStats(wallet);
        if (!cancelled) setStats(data);
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
  }, [wallet]);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-text-dark">
          <User size={22} className="text-primary" /> Profile
        </h1>
        <p className="mt-1 font-mono text-sm text-text-muted">{wallet}</p>

        <div className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
          {loading && <p className="text-sm text-text-muted">Loading from GenLayer…</p>}
          {error && <p className="text-sm text-danger">{error}</p>}
          {stats && (
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Stat label="Rank points" value={stats.rank_points} accent />
              <Stat label="Games" value={stats.games_played} />
              <Stat label="Wins" value={stats.wins} />
              <Stat label="Losses" value={stats.losses} />
              <Stat label="Total score" value={stats.total_score} />
              <Stat label="Highest score" value={stats.highest_score} />
            </dl>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-text-muted">{label}</dt>
      <dd className={`mt-1 text-2xl font-bold tabular-nums ${accent ? 'text-primary' : 'text-text-dark'}`}>
        {value}
      </dd>
    </div>
  );
}
