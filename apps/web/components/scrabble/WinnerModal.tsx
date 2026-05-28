'use client';

import { Trophy, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PLAYER_COLORS } from '@wordcourt/shared';
import { cn } from '@/lib/utils/cn';
import { useDisplayNames } from '@/hooks/useDisplayNames';

type PlayerResult = {
  walletAddress: string;
  score: number;
  seatIndex: number;
};

type Props = {
  isOpen: boolean;
  winner: string | null;
  players: PlayerResult[];
  endReason: string | null;
  walletAddress: string | null;
  onClose: () => void;
  onBackToLobby: () => void;
};

export function WinnerModal({
  isOpen,
  winner,
  players,
  endReason,
  walletAddress,
  onClose,
  onBackToLobby,
}: Props) {
  const { label } = useDisplayNames([...players.map((p) => p.walletAddress), winner]);
  if (!isOpen) return null;

  const sorted = [...players].sort((a, b) => b.score - a.score);
  const iWon = winner && walletAddress && winner.toLowerCase() === walletAddress.toLowerCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-background shadow-2xl">
        {/* Header */}
        <div className="relative flex flex-col items-center px-5 pt-8 pb-4">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-md p-1 text-text-muted hover:text-text-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Dismiss"
          >
            <X size={18} />
          </button>
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-gold/10 text-accent-gold">
            <Trophy size={32} />
          </span>
          <h2 className="mt-3 text-xl font-bold text-text-dark">
            {iWon ? '🎉 You won!' : 'Game over'}
          </h2>
          {winner && (
            <p className="mt-1 text-sm text-text-muted">
              Winner:{' '}
              <span className="font-semibold text-accent-gold">{label(winner)}</span>
            </p>
          )}
          {!winner && endReason && (
            <p className="mt-1 text-sm text-text-muted capitalize">{endReason.replace(/_/g, ' ')}</p>
          )}
        </div>

        {/* Scores */}
        <div className="px-5 pb-4 space-y-1">
          {sorted.map((p, rank) => {
            const color = PLAYER_COLORS[p.seatIndex] ?? 'text-text-dark';
            const isWinner = winner && p.walletAddress.toLowerCase() === winner.toLowerCase();
            return (
              <div
                key={p.walletAddress}
                className={cn(
                  'flex items-center justify-between rounded-lg px-3 py-2 text-sm',
                  rank === 0 ? 'bg-accent-gold/10' : 'bg-surface-soft',
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted w-4 text-right">{rank + 1}.</span>
                  {isWinner && <Trophy size={13} className="text-accent-gold" />}
                  <span className={cn('text-xs font-semibold', color)}>
                    {label(p.walletAddress)}
                  </span>
                </div>
                <span className="font-bold tabular-nums">{p.score}</span>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex gap-2 border-t border-border px-5 py-4">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            View board
          </Button>
          <Button className="flex-1" onClick={onBackToLobby}>
            New game
          </Button>
        </div>
      </div>
    </div>
  );
}
