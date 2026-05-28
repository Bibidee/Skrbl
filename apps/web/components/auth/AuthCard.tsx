'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/components/providers/EmbeddedWalletProvider';
import { Button } from '@/components/ui/Button';

const ERR: Record<string, string> = {
  email_taken: 'That email is already registered. Try logging in.',
  invalid_credentials: 'Wrong email or password.',
  WRONG_PASSWORD: 'Wrong password.',
};

export function AuthCard({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const { login, signUp } = useWallet();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSignup = mode === 'signup';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (isSignup) {
        await signUp(email.trim(), password, name.trim() || undefined);
      } else {
        await login(email.trim(), password);
      }
      router.push('/lobby');
    } catch (err) {
      const msg = (err as Error).message;
      setError(ERR[msg] ?? msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-16 w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h1 className="text-xl font-bold text-text-dark">
        {isSignup ? 'Create your Skrbl account' : 'Welcome back'}
      </h1>
      <p className="mt-1 text-sm text-text-muted">
        {isSignup
          ? 'Your wallet is generated and encrypted on this device. Only you can unlock it with your password.'
          : 'Log in to unlock your embedded wallet and play.'}
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-3">
        {isSignup && (
          <div>
            <label className="text-xs font-medium text-text-muted">Display name (optional)</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              placeholder="WordSmith"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-dark focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        )}
        <div>
          <label className="text-xs font-medium text-text-muted">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-dark focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-text-muted">Password</label>
          <input
            type="password"
            required
            minLength={isSignup ? 8 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isSignup ? 'At least 8 characters' : 'Your password'}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-dark focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {isSignup && (
          <p className="rounded-md border border-accent-gold/30 bg-accent-gold/5 px-3 py-2 text-[11px] text-text-muted">
            Important: your wallet is derived from your account and can only be unlocked with this
            password. We cannot reset it for you — keep it safe.
          </p>
        )}

        {error && <p className="text-xs text-danger">{error}</p>}

        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Please wait…' : isSignup ? 'Create account' : 'Log in'}
        </Button>
      </form>

      <p className="mt-4 text-center text-xs text-text-muted">
        {isSignup ? (
          <>Already have an account? <Link href="/login" className="text-primary hover:underline">Log in</Link></>
        ) : (
          <>New to Skrbl? <Link href="/signup" className="text-primary hover:underline">Create an account</Link></>
        )}
      </p>
    </div>
  );
}
