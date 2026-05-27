'use client';

/**
 * Manages chat messages for a game. Polls every 4 s for new messages and
 * exposes sendMessage(). Uses the /api/games/[gameId]/chat API routes so
 * that service-role Supabase access is handled server-side.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type ChatMessage = {
  id: string;
  wallet_address: string;
  message: string;
  created_at: string;
};

export function useChat(genlayerGameId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const lastFetch = useRef(0);

  const fetchMessages = useCallback(async () => {
    if (!genlayerGameId) return;
    try {
      const res = await fetch(`/api/games/${genlayerGameId}/chat`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { messages: ChatMessage[] };
      setMessages(data.messages ?? []);
      lastFetch.current = Date.now();
    } catch {
      // Non-fatal; keep previous messages.
    }
  }, [genlayerGameId]);

  useEffect(() => {
    void fetchMessages();
    const t = setInterval(fetchMessages, 4000);
    return () => clearInterval(t);
  }, [fetchMessages]);

  const sendMessage = useCallback(async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || sending) return false;
    setSending(true);
    try {
      const res = await fetch(`/api/games/${genlayerGameId}/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: trimmed }),
      });
      if (!res.ok) return false;
      // Optimistically add to local state; fetchMessages will reconcile.
      const data = (await res.json()) as { message: ChatMessage };
      setMessages((prev) => {
        const exists = prev.some((m) => m.id === data.message.id);
        return exists ? prev : [...prev, data.message];
      });
      return true;
    } catch {
      return false;
    } finally {
      setSending(false);
    }
  }, [genlayerGameId, sending]);

  return { messages, sending, sendMessage, refresh: fetchMessages };
}
