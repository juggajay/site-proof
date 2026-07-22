import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';

import { cn } from '@/lib/utils';

const MAX_CHARS = 2000;
const COUNTER_AT = 1800;
const MAX_ROWS = 5;

/** Single-line auto-growing composer. Enter sends, Shift+Enter newlines. */
export function ClancyComposer({
  disabled,
  onSend,
}: {
  disabled: boolean;
  onSend: (text: string) => void;
}) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Grow up to MAX_ROWS, then scroll internally.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
    const maxHeight = lineHeight * MAX_ROWS + 16; // + vertical padding
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [value]);

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const overCounter = value.length >= COUNTER_AT;

  const canSend = !disabled && value.trim().length > 0;

  return (
    <div className="border-t border-border bg-card px-3 py-3">
      {/* Single-surface composer (ChatGPT/Claude idiom): one soft filled shape,
          borderless textarea inside, monochrome send that only comes alive with
          input. No inner borders, no rings-on-rings, no standing brand colour —
          the header sparkle is the accent; the composer stays quiet. */}
      <div className="flex items-end gap-1.5 rounded-2xl bg-muted px-3.5 py-2 transition-colors focus-within:bg-background focus-within:shadow-[inset_0_0_0_1px_hsl(var(--border))]">
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          maxLength={MAX_CHARS}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask Clancy…"
          aria-label="Message Clancy"
          className="flex-1 resize-none appearance-none border-0 bg-transparent py-0.5 text-sm leading-5 text-foreground outline-none ring-0 placeholder:text-muted-foreground focus:outline-none focus:ring-0"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!canSend}
          aria-label="Send message"
          className={cn(
            'mb-px flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors',
            canSend
              ? 'bg-foreground text-background hover:opacity-90'
              : 'cursor-default bg-transparent text-muted-foreground/40',
          )}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M12 19V5M6 11l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      {overCounter && (
        <p
          className={cn(
            'mt-1 text-right text-[10px]',
            value.length >= MAX_CHARS ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {value.length} / {MAX_CHARS}
        </p>
      )}
    </div>
  );
}
