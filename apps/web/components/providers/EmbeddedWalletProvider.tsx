'use client';

/**
 * Embedded-wallet auth context.
 *
 * - Identity (wallet address + display name) comes from the session cookie via
 *   /api/account/me, so a reload keeps the user signed in.
 * - The signing key lives ONLY in memory (`account`). After a reload the user
 *   is signed in but "locked" until they re-enter their password to decrypt the
 *   stored blob (unlock). This keeps the plaintext key off disk.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { PrivateKeyAccount } from 'viem';
import {
  accountFromPrivateKey,
  decryptPrivateKey,
  encryptPrivateKey,
  generateWallet,
  type EncryptedWallet,
} from '@/lib/wallet/crypto';

type WalletContextValue = {
  walletAddress: string | null;
  displayName: string | null;
  /** True once the signing key is decrypted into memory. */
  isUnlocked: boolean;
  loading: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Decrypt the stored blob into memory (after a reload). */
  unlock: (password: string) => Promise<void>;
  setDisplayName: (name: string) => Promise<void>;
  /** Returns the plaintext private key after verifying the password. Never stored/logged. */
  exportPrivateKey: (password: string) => Promise<`0x${string}`>;
  /** The in-memory signing account, or null if locked. */
  getAccount: () => PrivateKeyAccount | null;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within EmbeddedWalletProvider');
  return ctx;
}

export function EmbeddedWalletProvider({ children }: { children: ReactNode }) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [displayName, setDisplayNameState] = useState<string | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);

  // In-memory only. The account holds the private key; the blob is kept so we
  // can unlock/export after a reload without another network round-trip.
  const accountRef = useRef<PrivateKeyAccount | null>(null);
  const blobRef = useRef<EncryptedWallet | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/account/me', { credentials: 'include' });
      const data = (await res.json()) as {
        walletAddress: string | null;
        displayName: string | null;
        encryptedWallet: EncryptedWallet | null;
      };
      setWalletAddress(data.walletAddress);
      setDisplayNameState(data.displayName);
      blobRef.current = data.encryptedWallet;
    } catch {
      setWalletAddress(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signUp = useCallback(async (email: string, password: string, name?: string) => {
    const { privateKey, address } = generateWallet();
    const encryptedWallet = await encryptPrivateKey(privateKey, password);
    const res = await fetch('/api/account/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password, displayName: name, walletAddress: address, encryptedWallet }),
    });
    if (!res.ok) {
      const detail = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(detail.error ?? `signup_failed_${res.status}`);
    }
    accountRef.current = accountFromPrivateKey(privateKey);
    blobRef.current = encryptedWallet;
    setWalletAddress(address.toLowerCase());
    setDisplayNameState(name ?? null);
    setIsUnlocked(true);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/account/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const detail = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(detail.error ?? `login_failed_${res.status}`);
    }
    const data = (await res.json()) as {
      walletAddress: string;
      displayName: string | null;
      encryptedWallet: EncryptedWallet;
    };
    const privateKey = await decryptPrivateKey(data.encryptedWallet, password);
    accountRef.current = accountFromPrivateKey(privateKey);
    blobRef.current = data.encryptedWallet;
    setWalletAddress(data.walletAddress);
    setDisplayNameState(data.displayName);
    setIsUnlocked(true);
  }, []);

  const unlock = useCallback(async (password: string) => {
    if (!blobRef.current) throw new Error('no_wallet_to_unlock');
    const privateKey = await decryptPrivateKey(blobRef.current, password);
    accountRef.current = accountFromPrivateKey(privateKey);
    setIsUnlocked(true);
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    accountRef.current = null;
    blobRef.current = null;
    setWalletAddress(null);
    setDisplayNameState(null);
    setIsUnlocked(false);
  }, []);

  const setDisplayName = useCallback(async (name: string) => {
    const res = await fetch('/api/account/name', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ displayName: name }),
    });
    if (!res.ok) throw new Error('name_update_failed');
    setDisplayNameState(name);
  }, []);

  const exportPrivateKey = useCallback(async (password: string) => {
    if (!blobRef.current) throw new Error('no_wallet');
    return decryptPrivateKey(blobRef.current, password);
  }, []);

  const getAccount = useCallback(() => accountRef.current, []);

  const value = useMemo<WalletContextValue>(
    () => ({
      walletAddress,
      displayName,
      isUnlocked,
      loading,
      signUp,
      login,
      logout,
      unlock,
      setDisplayName,
      exportPrivateKey,
      getAccount,
    }),
    [walletAddress, displayName, isUnlocked, loading, signUp, login, logout, unlock, setDisplayName, exportPrivateKey, getAccount],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
