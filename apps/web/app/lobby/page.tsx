'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { CreateGameDialog } from '@/components/lobby/CreateGameDialog';
import { RoomCard } from '@/components/lobby/RoomCard';
import type { Theme, WordMode } from '@wordcourt/shared';

type LobbyRoom = {
  id: string;
  room_code: string;
  creator_wallet: string;
  word_mode: WordMode;
  theme: Theme;
  max_players: number;
  current_players: number;
  genlayer_game_id: string | null;
  room_players: Array<{ wallet_address: string; seat_index: number; is_ready: boolean }>;
};

export default function LobbyPage() {
  const [rooms, setRooms] = useState<LobbyRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/rooms', { cache: 'no-store' });
        if (!res.ok) throw new Error(`status_${res.status}`);
        const data = (await res.json()) as { rooms: LobbyRoom[] };
        if (!cancelled) setRooms(data.rooms);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    const interval = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section>
            <h1 className="text-2xl font-bold text-text-dark">Open games</h1>
            <p className="mt-1 text-sm text-text-muted">
              Pick a game to join, or create one of your own. Public rooms refresh every 5s.
            </p>

            <div className="mt-6">
              {loading && <p className="text-sm text-text-muted">Loading rooms...</p>}
              {error && (
                <p className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
                  {error}
                </p>
              )}
              {!loading && rooms.length === 0 && (
                <div className="rounded-xl border border-dashed border-border bg-surface-soft/60 p-10 text-center">
                  <p className="text-sm text-text-muted">
                    No open games yet. Create one on the right.
                  </p>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {rooms.map((r) => (
                  <RoomCard
                    key={r.id}
                    roomCode={r.room_code}
                    creatorWallet={r.creator_wallet}
                    wordMode={r.word_mode}
                    theme={r.theme}
                    maxPlayers={r.max_players}
                    currentPlayers={r.current_players}
                    genlayerGameId={r.genlayer_game_id}
                  />
                ))}
              </div>
            </div>
          </section>
          <aside>
            <CreateGameDialog />
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}
