import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { ChatMessage } from '@questline/shared';
import { ChatBubble } from '../ChatBubble/ChatBubble';
import { MochiAvatar } from '../MochiAvatar';

export type ChatWindowProps = {
  messages: ChatMessage[];
  loading?: boolean;
  sending?: boolean;
  error?: string | null;
  onSend: (content: string) => void | Promise<void>;
};

export function ChatWindow({
  messages,
  loading = false,
  sending = false,
  error = null,
  onSend,
}: ChatWindowProps) {
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const composingRef = useRef(false);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, sending, loading]);

  async function submit() {
    const trimmed = draft.trim();
    if (!trimmed || sending || loading) return;
    setDraft('');
    await onSend(trimmed);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void submit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter') return;
    if (event.shiftKey) return;
    if (composingRef.current || event.nativeEvent.isComposing) return;
    event.preventDefault();
    void submit();
  }

  return (
    <section
      className="flex w-full max-w-[640px] flex-col overflow-hidden rounded-window border-[3px] border-pink bg-pink-pale shadow-window animate-rise-in"
      aria-label="Mochi Messenger"
    >
      <header className="flex items-center justify-between gap-3 bg-gel-pink px-4 py-[0.7rem] font-display text-[1.05rem] tracking-[0.01em] text-white">
        <span className="inline-flex items-center gap-1.5">✉ Mochi Messenger</span>
        <span className="inline-flex gap-1 text-[0.85rem] opacity-90" aria-hidden="true">
          ♡ ♡
        </span>
      </header>

      <div
        ref={listRef}
        className="flex max-h-[min(52vh,420px)] min-h-[220px] flex-col gap-3 overflow-y-auto bg-panel/70 px-4 py-4"
        aria-live="polite"
        aria-relevant="additions"
      >
        {loading && messages.length === 0 ? (
          <p className="m-0 text-center text-ink-soft">Opening Mochi Messenger…</p>
        ) : null}

        {messages.map((message) => (
          <ChatBubble key={message.id} message={message} />
        ))}

        {sending ? (
          <div className="flex items-start gap-2.5" data-testid="mochi-typing" aria-label="Mochi is typing">
            <div className="mt-0.5 h-11 w-11 shrink-0 overflow-hidden rounded-full border-2 border-pink/40 bg-panel [&>svg]:block [&>svg]:h-full [&>svg]:w-full">
              <MochiAvatar mood="think" />
            </div>
            <div className="rounded-[18px_18px_18px_6px] border border-pink/35 bg-panel px-3.5 py-3 text-ink-soft">
              <p className="mb-1 font-display text-[0.82rem] text-pink-ink">Mochi ♡</p>
              <span className="inline-flex gap-1" aria-hidden="true">
                <span className="h-2 w-2 animate-bounce rounded-full bg-pink [animation-delay:0ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-pink [animation-delay:120ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-pink [animation-delay:240ms]" />
              </span>
              <span className="sr-only">Mochi is typing</span>
            </div>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="m-0 border-t border-pink/20 bg-pink-pale px-4 py-2 text-[0.9rem] text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <form
        className="flex items-end gap-2 border-t border-pink/25 bg-pink-pale/80 px-3 py-3"
        onSubmit={handleSubmit}
      >
        <label className="sr-only" htmlFor="mochi-chat-input">
          Message Mochi
        </label>
        <textarea
          id="mochi-chat-input"
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => {
            composingRef.current = true;
          }}
          onCompositionEnd={() => {
            composingRef.current = false;
          }}
          placeholder="What would you like to start?"
          disabled={sending}
          className="min-h-[2.75rem] flex-1 resize-none rounded-pill border-2 border-pink/25 bg-panel px-4 py-2.5 text-[0.95rem] text-ink outline-none placeholder:text-ink-soft/70 focus:border-pink"
        />
        <button
          type="submit"
          disabled={sending || draft.trim().length === 0}
          className="shrink-0 rounded-pill bg-gel-pink px-4 py-2.5 font-bold text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.45)] disabled:cursor-not-allowed disabled:opacity-55"
        >
          Send ♡
        </button>
      </form>

      <p className="m-0 bg-pink-pale px-4 pb-3 text-center text-[0.78rem] text-ink-soft">
        Chat a little first. Goal interview details arrive in a later issue.
      </p>
    </section>
  );
}
