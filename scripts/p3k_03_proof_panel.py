"""
Creates apps/web/components/scrabble/GenLayerProofPanel.tsx
and patches game page to show it in the aside.
"""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

# --- Component ---
COMP = ROOT / "apps" / "web" / "components" / "scrabble" / "GenLayerProofPanel.tsx"

COMP_CONTENT = """\
'use client';

import { ExternalLink, Shield, ShieldCheck } from 'lucide-react';
import { clientEnv } from '@/lib/env/client';
import type { OnChainGame } from '@/lib/genlayer';

type Props = {
  game: OnChainGame;
};

export function GenLayerProofPanel({ game }: Props) {
  const explorerBase = clientEnv.NEXT_PUBLIC_GENLAYER_EXPLORER_URL;
  const lastMove = game.last_move;

  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-text-muted">
        <Shield size={14} className="text-primary" />
        GenLayer verification
      </h3>

      <div className="mt-3 space-y-2 text-xs">
        {/* Contract address */}
        <div className="flex items-start justify-between gap-2">
          <span className="text-text-muted shrink-0">Contract</span>
          <a
            href={`${explorerBase}/address/${clientEnv.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS ?? ''}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-primary hover:underline flex items-center gap-1 truncate"
          >
            {clientEnv.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS
              ? `${clientEnv.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS.slice(0, 8)}…${clientEnv.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS.slice(-6)}`
              : 'not configured'}
            <ExternalLink size={10} className="shrink-0" />
          </a>
        </div>

        {/* Game status */}
        <div className="flex items-center justify-between">
          <span className="text-text-muted">Status</span>
          <span className="flex items-center gap-1 font-semibold text-text-dark capitalize">
            <ShieldCheck size={12} className="text-green-500" />
            {game.status}
          </span>
        </div>

        {/* Move count */}
        <div className="flex items-center justify-between">
          <span className="text-text-muted">Moves</span>
          <span className="tabular-nums text-text-dark">{game.move_count}</span>
        </div>

        {/* Last move transaction */}
        {lastMove && (
          <div className="flex items-start justify-between gap-2">
            <span className="text-text-muted shrink-0">Last move</span>
            <span className="text-right">
              <span className="block text-text-dark">
                #{lastMove.moveNumber} · {lastMove.moveType.replace('_', ' ')}
              </span>
              {lastMove.formedWords && lastMove.formedWords.length > 0 && (
                <span className="block text-accent-gold font-semibold">
                  {lastMove.formedWords.join(', ')}
                  {typeof lastMove.officialScore === 'number' ? ` (+${lastMove.officialScore})` : ''}
                </span>
              )}
            </span>
          </div>
        )}

        {/* Pending challenge */}
        {game.pending_challenge && (
          <div className="rounded-md border border-accent-gold/30 bg-accent-gold/5 px-2 py-1.5">
            <p className="text-accent-gold font-semibold">
              Challenge pending on move #{game.pending_challenge.move_number}
            </p>
          </div>
        )}

        {/* Winner */}
        {game.status === 'completed' && game.winner && (
          <div className="rounded-md border border-green-200 bg-green-50 px-2 py-1.5 dark:border-green-900 dark:bg-green-950">
            <p className="text-green-700 dark:text-green-300 font-semibold text-xs">
              Winner: {game.winner.slice(0, 8)}…{game.winner.slice(-6)}
            </p>
            {game.end_reason && (
              <p className="text-green-600 dark:text-green-400 text-[10px] capitalize">
                {game.end_reason.replace(/_/g, ' ')}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
"""

COMP.write_text(COMP_CONTENT, encoding="utf-8")
print(f"[OK] Created {COMP}")

# --- Wire into game page ---
TARGET = ROOT / "apps" / "web" / "app" / "game" / "[gameId]" / "page.tsx"
text = TARGET.read_text(encoding="utf-8")
original = text

# 1. Add import
OLD1 = "import { ChallengeModal } from '@/components/scrabble/ChallengeModal';"
NEW1 = """\
import { ChallengeModal } from '@/components/scrabble/ChallengeModal';
import { GenLayerProofPanel } from '@/components/scrabble/GenLayerProofPanel';"""
if OLD1 not in text: print("[FAIL] Patch 1"); sys.exit(1)
text = text.replace(OLD1, NEW1, 1)

# 2. Add panel to aside after score panel
OLD2 = """\
              <ScorePanel
                players={playersWithScore}
                currentTurnWallet={currentTurnWallet}
                winnerWallet={game.winner}
              />"""
NEW2 = """\
              <ScorePanel
                players={playersWithScore}
                currentTurnWallet={currentTurnWallet}
                winnerWallet={game.winner}
              />
              <GenLayerProofPanel game={game} />"""
if OLD2 not in text: print("[FAIL] Patch 2"); sys.exit(1)
text = text.replace(OLD2, NEW2, 1)

TARGET.write_text(text, encoding="utf-8")
added = len(text.splitlines()) - len(original.splitlines())
print(f"[OK] GenLayerProofPanel wired into game page (+{added} lines)")
