'use client';

import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { useChat } from '@/hooks/useChat';

type Props = {
  genlayerGameId: string;
  walletAddress: string | null;
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ChatPanel({ genlayerGameId, walletAddress }: Props) {
  const { messages, sending, sendMessage } = useChat(genlayerGameId);
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  // Only auto-scroll the message list (never the page) and only when the user
  // is already near the bottom of the list, so reading history isn't disrupted.
  const shouldAutoScroll = useRef(true);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => {
      shouldAutoScroll.current =
        el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!shouldAutoScroll.current) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
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
      <div ref={listRef} className="flex-1 overflow-y-auto max-h-48 px-3 py-2 space-y-2">
        {messages.length === 0 && (
          <p className="text-xs text-text-muted text-center py-4">No messages yet. Say hello!</p>
        )}
        {messages.map((m) => {
          const isMe = walletAddress && m.wallet_address.toLowerCase() === walletAddress.toLowerCase();
          return (
            <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <span className="text-[10px] text-text-muted font-mono mb-0.5">
                {m.wallet_address.slice(0, 6)}…{m.wallet_address.slice(-4)}
                {m.created_at && (
                  <span className="ml-1.5 text-text-muted/70">{formatTime(m.created_at)}</span>
                )}
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
