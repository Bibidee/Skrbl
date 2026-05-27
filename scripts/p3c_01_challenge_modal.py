"""
Phase 3C – Script 1
Creates apps/web/components/scrabble/ChallengeModal.tsx

Two modes:
  challenge  – lets an opponent enter a reason and challenge the last move
  pending    – shows the active challenge details + Resolve button
"""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
TARGET = ROOT / "apps" / "web" / "components" / "scrabble" / "ChallengeModal.tsx"

CONTENT = """\
'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils/cn';
import type { OnChainChallenge, OnChainMove } from '@/lib/genlayer';

type Props = {
  isOpen: boolean;
  /** The most recent move that can still be challenged. */
  lastMove: OnChainMove | null;
  /** Non-null when a challenge is already in flight. */
  pendingChallenge: OnChainChallenge | null;
  walletAddress: string | null;
  busy: boolean;
  onClose: () => void;
  /** Called with the reason string when the user confirms a new challenge. */
  onChallenge: (reason: string) => void;
  /** Called when the user requests GenLayer to resolve the pending challenge. */
  onResolve: () => void;
};

export function ChallengeModal({
  isOpen,
  lastMove,
  pendingChallenge,
  walletAddress,
  busy,
  onClose,
  onChallenge,
  onResolve,
}: Props) {
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  const mode = pendingChallenge ? 'pending' : 'challenge';
  const canResolve = mode === 'pending';

  function handleChallenge() {
    if (busy || reason.trim().length === 0) return;
    onChallenge(reason.trim());
    setReason('');
  }

  function handleClose() {
    setReason('');
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-background shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className={cn(
            'flex items-center gap-2 text-base font-bold',
            mode === 'pending' ? 'text-accent-gold' : 'text-danger',
          )}>
            {mode === 'pending'
              ? <><CheckCircle size={17} /> Challenge Pending</>
              : <><AlertTriangle size={17} /> Challenge Move</>}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            className="rounded-md p-1 text-text-muted hover:text-text-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Pending challenge details */}
          {mode === 'pending' && pendingChallenge && (
            <div className="rounded-lg border border-accent-gold/30 bg-accent-gold/5 p-3 space-y-1 text-sm">
              <p className="font-semibold text-text-dark">
                Challenged by{' '}
                <span className="font-mono text-xs">
                  {pendingChallenge.challenger.slice(0, 8)}…{pendingChallenge.challenger.slice(-4)}
                </span>
              </p>
              <p className="text-text-muted">
                Move #{pendingChallenge.move_number} ·{' '}
                {pendingChallenge.invalid_words && pendingChallenge.invalid_words.length > 0
                  ? `Contested: ${pendingChallenge.invalid_words.join(', ')}`
                  : 'Reason not specified'}
              </p>
              <p className="text-xs text-text-muted">
                GenLayer will verify word validity on-chain. Click Resolve to trigger
                the LLM adjudication.
              </p>
            </div>
          )}

          {/* Challenge form */}
          {mode === 'challenge' && lastMove && (
            <>
              <div className="rounded-lg border border-border bg-surface-soft p-3 text-sm">
                <p className="font-semibold text-text-dark">Last move:</p>
                {lastMove.formedWords && lastMove.formedWords.length > 0 ? (
                  <p className="mt-1 text-text-muted">
                    Words played:{' '}
                    <span className="font-semibold text-text-dark">
                      {lastMove.formedWords.join(', ')}
                    </span>{' '}
                    (+{lastMove.officialScore ?? '?'} pts)
                  </p>
                ) : (
                  <p className="mt-1 text-text-muted">No word details available.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-text-dark mb-1">
                  Why are these words invalid?
                </label>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={busy}
                  placeholder="e.g. ZYMURGY is not a valid Scrabble word"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-dark placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <Button variant="secondary" onClick={handleClose} disabled={busy}>
            {canResolve ? 'Close' : 'Cancel'}
          </Button>
          {canResolve ? (
            <Button onClick={onResolve} disabled={busy}>
              <CheckCircle size={15} />
              {busy ? 'Resolving…' : 'Resolve Challenge'}
            </Button>
          ) : (
            <Button
              variant="danger"
              onClick={handleChallenge}
              disabled={busy || reason.trim().length === 0}
            >
              <AlertTriangle size={15} />
              {busy ? 'Challenging…' : 'Challenge Move'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
"""

TARGET.write_text(CONTENT, encoding="utf-8")
print(f"[OK] Created {TARGET}")
