'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useWalletClient } from 'wagmi';
import { Sparkles } from 'lucide-react';
import {
  isValidModeTheme,
  THEME_LABELS,
  WORD_MODE_LABELS,
  type Theme,
  type WordMode,
} from '@wordcourt/shared';
import { createGame } from '@/lib/genlayer';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { useWalletAuth } from '@/hooks/useWalletAuth';
import { clientLogger } from '@/lib/logger/client';

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function randomRoomCode() {
  let out = '';
  for (let i = 0; i < 6; i += 1) {
    out += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
  }
  return out;
}

function placeholderRackCommitment(wallet: string, gameId: string) {
  // Real commitment is set by /api/tiles/deal once the bag is dealt; this is
  // just a non-empty placeholder the contract accepts at create_game time.
  return `pending_${gameId}_${wallet.slice(2, 10)}`;
}

export function CreateGameDialog() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { walletAddress, signIn } = useWalletAuth();
  const [wordMode, setWordMode] = useState<WordMode>('classic');
  const [theme, setTheme] = useState<Theme>('none');
  const [maxPlayers, setMaxPlayers] = useState<2 | 3 | 4>(2);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function setModeAndResetTheme(next: WordMode) {
    setWordMode(next);
    setTheme(next === 'themed' ? 'crypto' : 'none');
  }

  async function handleCreate() {
    setError(null);
    if (!isConnected || !walletClient) {
      setError('Connect a wallet first.');
      return;
    }
    if (!walletAddress) {
      setStatus('Signing in with your wallet...');
      const ok = await signIn();
      if (!ok) {
        setError('Wallet sign-in failed.');
        setStatus(null);
        return;
      }
    }
    if (!isValidModeTheme(wordMode, theme)) {
      setError('Invalid (mode, theme) combination.');
      return;
    }

    if (!walletClient.account?.address) {
      setError('Wallet account is still loading. Try again in a moment.');
      return;
    }

    const gameId = `wc_${randomRoomCode().toLowerCase()}${Math.floor(Math.random() * 1000)}`;
    const roomCode = randomRoomCode();
    const wallet = walletClient.account.address.toLowerCase();
    const rackCommitment = placeholderRackCommitment(wallet, gameId);

    setBusy(true);
    try {
      setStatus('Submitting create_game to GenLayer...');
      await createGame(walletClient, {
        gameId,
        wordMode,
        theme,
        maxPlayers,
        rackCommitment,
      });

      setStatus('Saving room to Supabase...');
      const roomRes = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          roomCode,
          genlayerGameId: gameId,
          wordMode,
          theme,
          maxPlayers,
        }),
      });
      if (!roomRes.ok) {
        const detail = (await roomRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(`room_save_failed:${detail.error ?? roomRes.status}`);
      }
      router.push(`/game/${gameId}`);
    } catch (e) {
      clientLogger.error('create game failed', { msg: (e as Error).message });
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <h3 className="flex items-center gap-2 text-lg font-bold text-text-dark">
        <Sparkles size={18} className="text-primary" /> Create a game
      </h3>
      <p className="mt-1 text-sm text-text-muted">
        Pick a word mode, then GenLayer judges the rest.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Field label="Word mode">
          <Select
            value={wordMode}
            onChange={(v) => setModeAndResetTheme(v as WordMode)}
            options={[
              { label: WORD_MODE_LABELS.classic + ' (LLM-judged)', value: 'classic' },
              { label: WORD_MODE_LABELS.themed + ' (curated)', value: 'themed' },
              { label: WORD_MODE_LABELS.custom + ' (LLM-judged)', value: 'custom' },
            ]}
          />
        </Field>
        <Field label="Theme">
          <Select
            value={theme}
            onChange={(v) => setTheme(v as Theme)}
            disabled={wordMode !== 'themed'}
            options={
              wordMode === 'themed'
                ? [
                    { label: THEME_LABELS.crypto, value: 'crypto' },
                    { label: THEME_LABELS.genlayer, value: 'genlayer' },
                  ]
                : [{ label: 'None (required)', value: 'none' }]
            }
          />
        </Field>
        <Field label="Players">
          <Select
            value={String(maxPlayers)}
            onChange={(v) => setMaxPlayers(Number(v) as 2 | 3 | 4)}
            options={[
              { label: '2 players', value: '2' },
              { label: '3 players', value: '3' },
              { label: '4 players', value: '4' },
            ]}
          />
        </Field>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <div className="text-xs text-text-muted">
          {!walletAddress && isConnected && 'You’ll be asked to sign in with your wallet.'}
          {!isConnected && 'Connect a wallet to create a game.'}
        </div>
        <Button onClick={handleCreate} disabled={busy || !isConnected}>
          {busy ? 'Working...' : 'Create game'}
        </Button>
      </div>

      {status && (
        <p className="mt-3 text-xs text-text-muted" role="status">
          {status}
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold uppercase tracking-wide text-text-muted">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
