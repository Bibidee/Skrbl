"""
Phase 3E – Script 2
Creates apps/web/hooks/useChat.ts and apps/web/components/scrabble/ChatPanel.tsx
"""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent

# --- Hook ---
HOOK_TARGET = ROOT / "apps" / "web" / "hooks" / "useChat.ts"

HOOK_CONTENT = """\
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
"""

HOOK_TARGET.write_text(HOOK_CONTENT, encoding="utf-8")
print(f"[OK] Created {HOOK_TARGET}")

# --- Component ---
COMP_TARGET = ROOT / "apps" / "web" / "components" / "scrabble" / "ChatPanel.tsx"

COMP_CONTENT = """\
'use client';

import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { useChat } from '@/hooks/useChat';

type Props = {
  genlayerGameId: string;
  walletAddress: string | null;
};

export function ChatPanel({ genlayerGameId, walletAddress }: Props) {
  const { messages, sending, sendMessage } = useChat(genlayerGameId);
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    if (!draft.trim() || sending) return;
    const ok = await sendMessage(draft);
    if (ok) setDraft('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  return (
    <div className="flex flex-col rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
      <div className="border-b border-border px-4 py-2">
        <h3 className="text-sm font-semibold text-text-muted">Chat</h3>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto max-h-48 px-3 py-2 space-y-2">
        {messages.length === 0 && (
          <p className="text-xs text-text-muted text-center py-4">No messages yet. Say hello!</p>
        )}
        {messages.map((m) => {
          const isMe = walletAddress && m.wallet_address.toLowerCase() === walletAddress.toLowerCase();
          return (
            <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <span className="text-[10px] text-text-muted font-mono mb-0.5">
                {m.wallet_address.slice(0, 6)}…{m.wallet_address.slice(-4)}
              </span>
              <span className={`rounded-lg px-2.5 py-1.5 text-xs max-w-[85%] break-words ${
                isMe
                  ? 'bg-primary text-white'
                  : 'bg-surface-soft text-text-dark border border-border'
              }`}>
                {m.message}
              </span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {walletAddress ? (
        <div className="border-t border-border flex items-center gap-1.5 px-2 py-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending}
            placeholder="Type a message…"
            maxLength={2000}
            className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-text-dark placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={sending || !draft.trim()}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-white hover:bg-primary-dark disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Send message"
          >
            <Send size={13} />
          </button>
        </div>
      ) : (
        <p className="border-t border-border px-3 py-2 text-xs text-text-muted">
          Sign in to chat.
        </p>
      )}
    </div>
  );
}
"""

COMP_TARGET.write_text(COMP_CONTENT, encoding="utf-8")
print(f"[OK] Created {COMP_TARGET}")
