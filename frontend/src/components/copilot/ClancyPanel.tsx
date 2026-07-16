import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';
import { ClancyAvatar } from './ClancyAvatar';
import { ClancyComposer } from './ClancyComposer';
import { ClancyMessageRow } from './ClancyMessage';
import { CLANCY_SUGGESTED_PROMPTS, clancyIntro } from './clancyIntro';
import { useClancyStore, type ClancyAction } from './clancyChatState';

const FOCUSABLE = 'a[href],button:not([disabled]),textarea,input,[tabindex]:not([tabindex="-1"])';

/**
 * The Clancy conversation surface. Desktop: a card anchored above the bubble.
 * Mobile (<768px): a full-width bottom sheet. Focus is trapped while open and
 * Esc closes; the widget restores focus to the bubble.
 */
export function ClancyPanel({
  firstName,
  onClose,
  onOpenStage,
  onSend,
}: {
  firstName: string;
  onClose: () => void;
  onOpenStage: (action: Extract<ClancyAction, { type: 'open_stage' }>) => void;
  onSend: (text: string) => void;
}) {
  const { messages, inFlight } = useClancyStore();
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerFocusRef = useRef<HTMLTextAreaElement | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [slowHint, setSlowHint] = useState(false);

  // Esc-to-close + focus trap within the panel.
  useEffect(() => {
    const node = panelRef.current;
    if (!node) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    node.addEventListener('keydown', onKeyDown);
    return () => node.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // Focus the composer on open.
  useEffect(() => {
    composerFocusRef.current =
      panelRef.current?.querySelector<HTMLTextAreaElement>('textarea') ?? null;
    composerFocusRef.current?.focus();
  }, []);

  // Lock body scroll while the mobile bottom sheet is open.
  useEffect(() => {
    if (!window.matchMedia?.('(max-width: 767px)').matches) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Auto-scroll to newest unless the user scrolled up.
  useLayoutEffect(() => {
    if (atBottom) scrollRef.current?.scrollTo?.({ top: scrollRef.current.scrollHeight });
  }, [messages, inFlight, atBottom]);

  // "Checking your project…" after 3s of waiting; reset when a reply lands.
  useEffect(() => {
    if (!inFlight) {
      setSlowHint(false);
      return;
    }
    const t = setTimeout(() => setSlowHint(true), 3000);
    return () => clearTimeout(t);
  }, [inFlight]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 48);
  };

  const jumpToLatest = () => {
    setAtBottom(true);
    scrollRef.current?.scrollTo?.({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  };

  const isEmpty = messages.length === 0;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Clancy, your CIVOS copilot"
      className={cn(
        'clancy-panel pointer-events-auto flex flex-col overflow-hidden border border-border bg-card shadow-2xl',
        // Desktop: anchored card above the bubble.
        'fixed bottom-24 right-4 z-40 h-[560px] max-h-[calc(100dvh-7rem)] w-[380px] max-w-[calc(100vw-2rem)] rounded-xl',
        // Mobile: full-width bottom sheet.
        'max-md:inset-x-0 max-md:bottom-0 max-md:right-0 max-md:h-[85dvh] max-md:w-full max-md:max-w-none max-md:rounded-b-none max-md:rounded-t-2xl',
      )}
    >
      {/* Mobile drag-handle affordance */}
      <div className="flex justify-center pt-2 md:hidden" aria-hidden="true">
        <span className="h-1 w-9 rounded-full bg-border" />
      </div>

      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
        <ClancyAvatar className="h-9 w-9" letterClassName="text-base" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight text-foreground">Clancy</p>
          <p className="truncate text-xs text-muted-foreground">Your CIVOS copilot</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Clancy"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Transcript */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="relative flex-1 space-y-3 overflow-y-auto px-4 py-4"
      >
        <div aria-live="polite" className="space-y-3">
          {isEmpty ? (
            <div className="flex flex-col items-start gap-3">
              <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-muted px-3.5 py-2 text-sm leading-relaxed text-foreground">
                {clancyIntro(firstName)}
              </div>
              <div className="flex flex-col items-start gap-1.5">
                {CLANCY_SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => onSend(prompt)}
                    className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-[#2563EB] hover:text-[#2563EB]"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <ClancyMessageRow
                key={message.id}
                message={message}
                onOpenStage={onOpenStage}
                onRetry={(text) => onSend(text)}
              />
            ))
          )}

          {inFlight && (
            <div className="flex flex-col items-start gap-1">
              <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-muted px-3.5 py-3">
                <span className="clancy-dot h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                <span className="clancy-dot h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                <span className="clancy-dot h-1.5 w-1.5 rounded-full bg-muted-foreground" />
              </div>
              {slowHint && (
                <span className="px-1 text-[11px] text-muted-foreground">
                  Checking your project…
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {!atBottom && (
        <button
          type="button"
          onClick={jumpToLatest}
          className="absolute bottom-[4.75rem] left-1/2 -translate-x-1/2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground shadow-md"
        >
          Jump to latest
        </button>
      )}

      <ClancyComposer disabled={inFlight} onSend={onSend} />
    </div>
  );
}
