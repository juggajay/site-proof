import { Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { CopilotProposal } from './copilotData';
import { STAGE_STATUS_LABEL, type StageMeta, type StageStatus } from './copilotStageStatus';

export interface StageCard extends StageMeta {
  status: StageStatus;
  /** Newest proposal for this stage, if any (drives rollback affordance). */
  proposal: CopilotProposal | null;
}

interface CopilotPanelProps {
  cards: StageCard[];
  aiConfigured: boolean;
  /** Open the read/review flow for an active stage (project_facts, control_line). */
  onStageAction: (stage: StageCard['stage']) => void;
  onRollback: (proposalId: string) => void;
  rollbackBusy: boolean;
}

const STATUS_CHIP_CLASS: Record<StageStatus, string> = {
  not_started: 'bg-muted text-muted-foreground',
  review_ready: 'bg-primary/10 text-primary',
  done: 'bg-success/10 text-success',
};

function StatusChip({ status }: { status: StageStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CHIP_CLASS[status]}`}
    >
      {STAGE_STATUS_LABEL[status]}
    </span>
  );
}

function StageActions({
  card,
  aiConfigured,
  onAction,
  onRollback,
  rollbackBusy,
}: {
  card: StageCard;
  aiConfigured: boolean;
  onAction: () => void;
  onRollback: (proposalId: string) => void;
  rollbackBusy: boolean;
}) {
  const applied =
    card.proposal && (card.proposal.status === 'accepted' || card.proposal.status === 'edited');
  // Only AI-dependent stages are gated on server AI config; lot_breakdown has a
  // deterministic path and stays actionable regardless.
  const aiBlocked = card.requiresAi && !aiConfigured;

  return (
    <div className="flex items-center gap-2">
      {applied && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={rollbackBusy}
          onClick={() => onRollback(card.proposal!.id)}
        >
          Roll back
        </Button>
      )}
      <Button
        type="button"
        variant={card.status === 'review_ready' ? 'default' : 'outline'}
        size="sm"
        disabled={aiBlocked}
        title={aiBlocked ? 'AI reading is not configured on this server' : undefined}
        onClick={onAction}
      >
        {card.status === 'review_ready'
          ? 'Review'
          : card.status === 'done'
            ? 'Read again'
            : card.readLabel}
      </Button>
    </div>
  );
}

/**
 * The copilot rail: a quiet card per Wave-1 setup stage in order. Each card shows
 * its derived status and a read/review CTA. AI-dependent stages are disabled when
 * the server has no AI configured; lot_breakdown stays actionable regardless.
 */
export function CopilotPanel({
  cards,
  aiConfigured,
  onStageAction,
  onRollback,
  rollbackBusy,
}: CopilotPanelProps) {
  return (
    <section aria-label="Setup copilot" className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b p-4">
        <Sparkles className="h-4 w-4 text-primary" />
        <div>
          <h2 className="text-sm font-semibold">Setup copilot</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Read project setup from your drawings. Every suggestion is reviewed before it is
            applied.
          </p>
        </div>
      </div>
      <ol className="divide-y">
        {cards.map((card) => (
          <li key={card.stage} className="flex items-center gap-4 p-4">
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="text-sm font-medium">{card.title}</span>
                <StatusChip status={card.status} />
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{card.description}</span>
            </span>
            {card.active ? (
              <StageActions
                card={card}
                aiConfigured={aiConfigured}
                onAction={() => onStageAction(card.stage)}
                onRollback={onRollback}
                rollbackBusy={rollbackBusy}
              />
            ) : (
              <span className="shrink-0 text-xs font-medium text-muted-foreground">
                Coming soon
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
