'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, KeyRound, LogOut, Lock, Pencil } from 'lucide-react';
import { useWallet } from '@/components/providers/EmbeddedWalletProvider';
import { Button } from '@/components/ui/Button';

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function AccountMenu() {
  const { walletAddress, displayName, isUnlocked, loading, logout } = useWallet();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<null | 'name' | 'export' | 'unlock'>(null);

  if (loading) {
    return <div className="h-9 w-24 animate-pulse rounded-lg bg-surface-soft" />;
  }

  if (!walletAddress) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/login" className="text-sm font-medium text-text-muted hover:text-text-dark">
          Log in
        </Link>
        <Link href="/signup">
          <Button size="sm">Sign up</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm hover:border-primary/40"
      >
        {!isUnlocked && <Lock size={12} className="text-accent-gold" />}
        <span className="font-semibold text-text-dark">{displayName || shortAddr(walletAddress)}</span>
        <span className="font-mono text-[10px] text-text-muted">{shortAddr(walletAddress)}</span>
        <ChevronDown size={14} className="text-text-muted" />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-border bg-surface p-2 shadow-lg">
          {!isUnlocked && (
            <button
              onClick={() => { setPanel('unlock'); setOpen(false); }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-accent-gold hover:bg-surface-soft"
            >
              <Lock size={14} /> Unlock wallet to play
            </button>
          )}
          <button
            onClick={() => { setPanel('name'); setOpen(false); }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-text-dark hover:bg-surface-soft"
          >
            <Pencil size={14} /> {displayName ? 'Edit display name' : 'Set display name'}
          </button>
          <button
            onClick={() => { setPanel('export'); setOpen(false); }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-text-dark hover:bg-surface-soft"
          >
            <KeyRound size={14} /> Export private key
          </button>
          <button
            onClick={async () => { await logout(); setOpen(false); router.push('/'); }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-danger hover:bg-danger/5"
          >
            <LogOut size={14} /> Log out
          </button>
        </div>
      )}

      {panel === 'name' && <NamePanel onClose={() => setPanel(null)} />}
      {panel === 'export' && <ExportPanel onClose={() => setPanel(null)} />}
      {panel === 'unlock' && <UnlockPanel onClose={() => setPanel(null)} />}
    </div>
  );
}

function Backdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function NamePanel({ onClose }: { onClose: () => void }) {
  const { displayName, setDisplayName } = useWallet();
  const [name, setName] = useState(displayName ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Backdrop onClose={onClose}>
      <h3 className="text-base font-bold text-text-dark">Display name</h3>
      <p className="mt-1 text-xs text-text-muted">Shown next to your wallet address in games, history, and the leaderboard.</p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={40}
        placeholder="e.g. WordSmith"
        className="mt-3 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-dark focus:outline-none focus:ring-2 focus:ring-primary"
      />
      {err && <p className="mt-2 text-xs text-danger">{err}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button
          size="sm"
          disabled={busy || !name.trim()}
          onClick={async () => {
            setBusy(true); setErr(null);
            try { await setDisplayName(name.trim()); onClose(); }
            catch (e) { setErr((e as Error).message); }
            finally { setBusy(false); }
          }}
        >
          Save
        </Button>
      </div>
    </Backdrop>
  );
}

function ExportPanel({ onClose }: { onClose: () => void }) {
  const { exportPrivateKey } = useWallet();
  const [password, setPassword] = useState('');
  const [key, setKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Backdrop onClose={onClose}>
      <h3 className="text-base font-bold text-text-dark">Export private key</h3>
      <p className="mt-1 text-xs text-danger font-semibold">
        Never share this key. Anyone with it controls your wallet and all its games.
      </p>
      {!key ? (
        <>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Re-enter your password"
            className="mt-3 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-dark focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {err && <p className="mt-2 text-xs text-danger">{err}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button
              size="sm"
              disabled={busy || !password}
              onClick={async () => {
                setBusy(true); setErr(null);
                try { setKey(await exportPrivateKey(password)); }
                catch { setErr('Wrong password.'); }
                finally { setBusy(false); }
              }}
            >
              Reveal
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-3 break-all rounded-md border border-border bg-background px-3 py-2 font-mono text-xs text-text-dark select-all">
            {key}
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => navigator.clipboard.writeText(key)}>Copy</Button>
            <Button size="sm" onClick={onClose}>Done</Button>
          </div>
        </>
      )}
    </Backdrop>
  );
}

function UnlockPanel({ onClose }: { onClose: () => void }) {
  const { unlock } = useWallet();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Backdrop onClose={onClose}>
      <h3 className="text-base font-bold text-text-dark">Unlock wallet</h3>
      <p className="mt-1 text-xs text-text-muted">
        Enter your password to unlock signing for this session.
      </p>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        className="mt-3 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-dark focus:outline-none focus:ring-2 focus:ring-primary"
      />
      {err && <p className="mt-2 text-xs text-danger">{err}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button
          size="sm"
          disabled={busy || !password}
          onClick={async () => {
            setBusy(true); setErr(null);
            try { await unlock(password); onClose(); }
            catch { setErr('Wrong password.'); }
            finally { setBusy(false); }
          }}
        >
          Unlock
        </Button>
      </div>
    </Backdrop>
  );
}
