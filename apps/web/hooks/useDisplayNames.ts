'use client';

/**
 * Resolves wallet addresses to display names (batch). Returns a map and a
 * `label(wallet)` helper that falls back to a shortened address.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

function short(addr: string): string {
  if (!addr) return '';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function useDisplayNames(wallets: Array<string | null | undefined>) {
  const [names, setNames] = useState<Record<string, string>>({});

  // Stable, de-duplicated, lowercased key list.
  const key = useMemo(() => {
    const set = [...new Set(wallets.filter(Boolean).map((w) => (w as string).toLowerCase()))];
    set.sort();
    return set.join(',');
  }, [wallets]);

  useEffect(() => {
    const list = key ? key.split(',') : [];
    if (list.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/account/names', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ wallets: list }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { names: Record<string, string> };
        if (!cancelled) setNames(data.names ?? {});
      } catch {
        // non-fatal; fall back to addresses
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  const label = useCallback(
    (wallet: string | null | undefined): string => {
      if (!wallet) return '';
      return names[wallet.toLowerCase()] ?? short(wallet);
    },
    [names],
  );

  return { names, label, short };
}
