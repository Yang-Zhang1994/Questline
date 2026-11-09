import type { ChatMessage } from '@questline/shared';
import { MochiAvatar } from '../MochiAvatar';

export type ChatBubbleProps = {
  message: ChatMessage;
};

export function ChatBubble({ message }: ChatBubbleProps) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end animate-rise-in" data-testid={`chat-bubble-user-${message.id}`}>
        <div className="max-w-[85%] rounded-[18px_18px_6px_18px] bg-blue-pale px-3.5 py-2.5 text-[0.95rem] leading-snug text-ink shadow-[0_2px_0_rgba(28,127,200,0.12)]">
          <p className="m-0 whitespace-pre-wrap break-words">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-start gap-2.5 animate-rise-in"
      data-testid={`chat-bubble-mochi-${message.id}`}
    >
      <div className="mt-0.5 h-11 w-11 shrink-0 overflow-hidden rounded-full border-2 border-pink/40 bg-panel shadow-polaroid [&>svg]:block [&>svg]:h-full [&>svg]:w-full [&>svg]:-translate-y-0.5">
        <MochiAvatar mood="happy" />
      </div>
      <div className="max-w-[85%] rounded-[18px_18px_18px_6px] border border-pink/35 bg-panel px-3.5 py-2.5 text-[0.95rem] leading-snug text-ink shadow-[0_2px_0_rgba(255,111,177,0.15)]">
        <p className="mb-1 font-display text-[0.82rem] text-pink-ink">Mochi ♡</p>
        <p className="m-0 whitespace-pre-wrap break-words">{message.content}</p>
      </div>
    </div>
  );
}
