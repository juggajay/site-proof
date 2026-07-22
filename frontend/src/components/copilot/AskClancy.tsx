import { Sparkles } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useClancyEnabled } from './clancyAccess';
import { askClancy } from './clancyChatState';

/**
 * Contextual "Ask Clancy" entry points that live on the data surface they ask
 * about (the Stripe suggested-prompts pattern). A tap queues the question and
 * opens the drawer, where it runs through the same send path as the composer.
 * Both variants render nothing unless Clancy is reachable for this user.
 */

export function AskClancyButton({
  question,
  label,
  className,
}: {
  question: string;
  label: string;
  className?: string;
}) {
  const enabled = useClancyEnabled();
  if (!enabled) return null;
  return (
    <button
      type="button"
      onClick={() => askClancy(question)}
      aria-label={`Ask Clancy: ${label}`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
        className,
      )}
    >
      <Sparkles className="h-3.5 w-3.5 text-[#2563EB]" aria-hidden="true" />
      {label}
    </button>
  );
}

export function AskClancyChips({
  prompts,
}: {
  prompts: Array<{ label: string; question: string }>;
}) {
  const enabled = useClancyEnabled();
  if (!enabled) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {prompts.map((p) => (
        <button
          key={p.label}
          type="button"
          onClick={() => askClancy(p.question)}
          aria-label={`Ask Clancy: ${p.label}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Sparkles className="h-3.5 w-3.5 text-[#2563EB]" aria-hidden="true" />
          {p.label}
        </button>
      ))}
    </div>
  );
}
