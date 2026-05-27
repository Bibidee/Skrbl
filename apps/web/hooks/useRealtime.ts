'use client';

/**
 * Subscribes to Supabase Realtime for live game-state updates.
 *
 * When the `games` row for the given genlayer_game_id changes (e.g. a move
 * is mined and synced, or the status flips to completed), `onUpdate` fires
 * immediately. The game page uses this to call its `refresh()` function
 * so players see the updated board without waiting for the poll interval.
 *
 * The hook falls back gracefully when Supabase is not configured: `status`
 * will be 'not_configured' and the polling-based fallback takes over.
 */
import { useEffect, useState } from 'react';
import { getBrowserSupabase } from '@/lib/supabase/browser';
import { clientLogger } from '@/lib/logger/client';

export type RealtimeStatus = 'connecting' | 'connected' | 'error' | 'not_configured';

export function useRealtime(genlayerGameId: string, onUpdate: () => void): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>('connecting');

  useEffect(() => {
    if (!genlayerGameId) return;

    let supabase: ReturnType<typeof getBrowserSupabase>;
    try {
      supabase = getBrowserSupabase();
    } catch {
      setStatus('not_configured');
      return;
    }

    const channel = supabase
      .channel(`game-realtime:${genlayerGameId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'games',
          filter: `genlayer_game_id=eq.${genlayerGameId}`,
        },
        () => {
          clientLogger.info('realtime: game row changed', { genlayerGameId });
          onUpdate();
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_players',
        },
        () => {
          onUpdate();
        },
      )
      .subscribe((s) => {
        if (s === 'SUBSCRIBED') {
          setStatus('connected');
        } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') {
          setStatus('error');
          clientLogger.error('realtime subscription failed', { state: s, genlayerGameId });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  // onUpdate intentionally omitted — it changes every render and we don't want to re-subscribe.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genlayerGameId]);

  return status;
}
