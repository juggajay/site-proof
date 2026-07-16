import { cn } from '@/lib/utils';
import type { ClancyAction, ClancyMessage as ClancyMessageType } from './clancyChatState';

const STAGE_CHIP_LABEL: Record<string, string> = {
  project_facts: 'Read project facts',
  control_line: 'Read setout sheets',
  plan_sheets: 'Register plan sheets',
  lot_breakdown: 'Break into lots',
};

function stageChipLabel(stage: string): string {
  return STAGE_CHIP_LABEL[stage] ?? 'Open setup step';
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/**
 * One transcript row. User messages sit right in a brand-tinted bubble; Clancy's
 * sit left on a muted surface. Only `open_stage` actions render as chips —
 * `navigate` actions are executed by the widget the moment they arrive.
 */
export function ClancyMessageRow({
  message,
  onOpenStage,
  onRetry,
}: {
  message: ClancyMessageType;
  onOpenStage: (action: Extract<ClancyAction, { type: 'open_stage' }>) => void;
  onRetry: (text: string) => void;
}) {
  const isUser = message.role === 'user';
  const stageActions = (message.actions ?? [])
    .filter((a): a is Extract<ClancyAction, { type: 'open_stage' }> => a.type === 'open_stage')
    .slice(0, 3);

  return (
    <div className={cn('group flex flex-col gap-1', isUser ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
          isUser
            ? 'bg-[#2563EB] text-white rounded-br-md'
            : message.error
              ? 'bg-destructive/10 text-foreground rounded-bl-md'
              : 'bg-muted text-foreground rounded-bl-md',
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>

        {message.error && message.retryOf && (
          <button
            type="button"
            onClick={() => onRetry(message.retryOf!)}
            className="mt-1.5 text-xs font-medium text-[#2563EB] underline-offset-2 hover:underline"
          >
            Try again
          </button>
        )}
      </div>

      {stageActions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {stageActions.map((action, i) => (
            <button
              key={`${action.stage}-${i}`}
              type="button"
              onClick={() => onOpenStage(action)}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground transition-colors hover:border-[#2563EB] hover:text-[#2563EB]"
            >
              Open: {stageChipLabel(action.stage)}
              <span aria-hidden="true">→</span>
            </button>
          ))}
        </div>
      )}

      <span className="px-1 text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
        {formatTime(message.ts)}
      </span>
    </div>
  );
}
