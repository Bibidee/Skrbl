'use client';

/**
 * Drives the WordCourt SIWE sign-in flow. Reads the current Supabase session
 * via /api/auth/session and exposes `signIn()` / `signOut()` actions that wire
 * the connected wagmi wallet through nonce -> SIWE message -> verify.
 */
import { useCallback, useEffect, useState } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { SiweMessage } from 'siwe';
import { clientLogger } from '@/lib/logger/client';

type State = {
  walletAddress: string | null;
  loading: boolean;
  error: string | null;
};

export function useWalletAuth() {
  const { address, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [state, setState] = useState<State>({ walletAddress: null, loading: true, error: null });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session', { credentials: 'include' });
      const data = (await res.json()) as { walletAddress: string | null };
      setState({ walletAddress: data.walletAddress, loading: false, error: null });
    } catch (e) {
      setState({ walletAddress: null, loading: false, error: (e as Error).message });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = useCallback(async () => {
    if (!address) {
      setState((s) => ({ ...s, error: 'connect_wallet_first' }));
      return false;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const domain = window.location.host;
      const origin = window.location.origin;
      const wallet = address.toLowerCase() as `0x${string}`;

      const nonceRes = await fetch('/api/auth/nonce', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ walletAddress: wallet, domain }),
      });
      if (!nonceRes.ok) throw new Error(`nonce_failed:${nonceRes.status}`);
      const { nonce } = (await nonceRes.json()) as { nonce: string };

      const message = new SiweMessage({
        domain,
        address: wallet,
        statement: 'Sign in to WordCourt. Every word has to stand in court.',
        uri: origin,
        version: '1',
        chainId: chainId ?? 1,
        nonce,
      });
      const prepared = message.prepareMessage();
      const signature = await signMessageAsync({ message: prepared });

      const verifyRes = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: prepared, signature }),
      });
      if (!verifyRes.ok) {
        const detail = await verifyRes.json().catch(() => ({ error: 'verify_failed' }));
        throw new Error(`verify_failed:${(detail as { error?: string }).error ?? verifyRes.status}`);
      }
      await refresh();
      return true;
    } catch (e) {
      const msg = (e as Error).message;
      clientLogger.error('siwe sign-in failed', { msg });
      setState((s) => ({ ...s, loading: false, error: msg }));
      return false;
    }
  }, [address, chainId, refresh, signMessageAsync]);

  const signOut = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    await refresh();
  }, [refresh]);

  return { ...state, signIn, signOut, refresh };
}
