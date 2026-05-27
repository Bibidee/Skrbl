'use client';

import Link from 'next/link';
import { Users2 } from 'lucide-react';
import { THEME_LABELS, WORD_MODE_LABELS, type Theme, type WordMode } from '@wordcourt/shared';
import { Button } from '@/components/ui/Button';

type Props = {
  roomCode: string;
  creatorWallet: string;
  wordMode: WordMode;
  theme: Theme;
  maxPlayers: number;
  currentPlayers: number;
  genlayerGameId: string | null;
};

export function RoomCard({
  roomCode,
  creatorWallet,
  wordMode,
  theme,
  maxPlayers,
  currentPlayers,
  genlayerGameId,
}: Props) {
  const modeLabel =
    wordMode === 'themed'
      ? `${WORD_MODE_LABELS.themed} · ${THEME_LABELS[theme]}`
      : WORD_MODE_LABELS[wordMode];

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-sm font-semibold tracking-wider text-text-dark">{roomCode}</p>
          <p className="mt-1 text-xs text-text-muted">
            {creatorWallet.slice(0, 6)}…{creatorWallet.slice(-4)}
          </p>
        </div>
        <span className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
          {modeLabel}
        </span>
      </div>
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <Users2 size={14} />
        <span>
          {currentPlayers} / {maxPlayers} players
        </span>
      </div>
      <Link href={genlayerGameId ? `/game/${genlayerGameId}` : `/lobby?code=${roomCode}`}>
        <Button variant="secondary" size="sm" className="w-full">
          {currentPlayers >= maxPlayers ? 'View' : 'Join'}
        </Button>
      </Link>
    </div>
  );
}
