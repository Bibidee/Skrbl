'use client';

import { Trophy } from 'lucide-react';
import { PLAYER_COLORS } from '@wordcourt/shared';
import { cn } from '@/lib/utils/cn';

type PanelPlayer = {
  walletAddress: string;
  score: number;
  seatIndex: number;
};

type Props = {
  players: PanelPlayer[];
  currentTurnWallet: string | null;
  winnerWallet?: string | null;
};

export function ScorePanel({ players, currentTurnWallet, winnerWallet }: Props) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-text-muted">Scores</h3>
      <ul className="mt-3 space-y-2">
        {players
          .slice()
          .sort((a, b) => a.seatIndex - b.seatIndex)
          .map((p) => {
            const isTurn = p.walletAddress.toLowerCase() === (currentTurnWallet ?? '').toLowerCase();
            const isWinner = p.walletAddress.toLowerCase() === (winnerWallet ?? '').toLowerCase();
            const color = PLAYER_COLORS[p.seatIndex % PLAYER_COLORS.length];
            return (
              <li
                key={p.walletAddress}
                className={cn(
                  'flex items-center justify-between rounded-md border border-transparent px-3 py-2',
                  isTurn && 'border-primary/40 bg-primary/5',
                  isWinner && 'border-accent-gold bg-accent-gold/10',
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: color }}
                    aria-hidden
                  />
                  <span className="font-mono text-xs text-text-dark">
                    {p.walletAddress.slice(0, 6)}…{p.walletAddress.slice(-4)}
                  </span>
                  {isWinner && <Trophy size={14} className="text-accent-gold" />}
                </div>
                <span className="text-lg font-bold tabular-nums text-text-dark">{p.score}</span>
              </li>
            );
          })}
      </ul>
    </div>
  );
}
