import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryKeys';
import { toast } from '@/components/ui/toaster';
import { extractErrorMessage } from '@/lib/errorHandling';
import { logError } from '@/lib/logger';
import { useAiStatus } from '@/hooks/useAiStatus';
import { useControlLines } from '../settings/controlLinesData';
import { usePlanSheets } from '../settings/planSheetsData';
import { fetchProjectForAdminPage } from '../settings/projectPageAccess';
import type { Project } from '../settings/types';
import { CopilotPanel, type StageCard } from './CopilotPanel';
import { ProjectFactsReviewModal, type ProjectFactsCurrent } from './ProjectFactsReviewModal';
import { ControlLineReviewModal } from './ControlLineReviewModal';
import { PlanSheetRegistrationReviewModal } from './PlanSheetRegistrationReviewModal';
import { LotBreakdownReviewModal } from './LotBreakdownReviewModal';
import {
  newestProposalForStage,
  useCopilotProposals,
  useProjectLotPresence,
  useRollbackProposal,
  type CopilotStage,
} from './copilotData';
import { Button } from '@/components/ui/button';
import { STAGE_META, deriveStageStatus } from './copilotStageStatus';

// The project detail endpoint returns clientName even though the shared settings
// `Project` type omits it; widen locally for the facts diff.
type CopilotProject = Project & { clientName?: string | null };

/**
 * After a stage's proposal is applied, offer the next incomplete stage so the
 * user never has to hunt for what's next. Skips the just-applied stage because
 * its card status may still lag the query invalidation.
 */
function HandoffCard({
  appliedTitle,
  next,
  onGo,
  onDismiss,
}: {
  appliedTitle: string;
  next: StageCard | null;
  onGo: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      className="mt-4 flex items-center gap-3 rounded-lg border border-success/30 bg-success/5 p-4"
    >
      <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
      {next ? (
        <>
          <p className="min-w-0 flex-1 text-sm">
            <span className="font-medium">{appliedTitle} done.</span>{' '}
            <span className="text-muted-foreground">Next: {next.title.toLowerCase()}.</span>
          </p>
          <Button type="button" size="sm" onClick={onGo}>
            Go
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </>
      ) : (
        <p className="min-w-0 flex-1 text-sm font-medium">
          Setup complete — your project is field-ready.
        </p>
      )}
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
      >
        Dismiss
      </button>
    </div>
  );
}

export function CopilotPage() {
  const { projectId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [openStage, setOpenStage] = useState<CopilotStage | null>(null);
  // The stage whose proposal was just applied, driving the next-step hand-off.
  const [appliedStage, setAppliedStage] = useState<CopilotStage | null>(null);
  const deepLinkConsumed = useRef(false);

  const projectQuery = useQuery({
    queryKey: queryKeys.project(projectId ?? 'none'),
    queryFn: () => fetchProjectForAdminPage(projectId!) as Promise<CopilotProject>,
    enabled: Boolean(projectId),
    staleTime: 30_000,
  });
  const proposalsQuery = useCopilotProposals(projectId);
  const controlLinesQuery = useControlLines(projectId);
  const planSheetsQuery = usePlanSheets(projectId);
  const lotPresenceQuery = useProjectLotPresence(projectId);
  const { aiConfigured } = useAiStatus();
  const rollbackMutation = useRollbackProposal(projectId);

  const project = projectQuery.data ?? null;
  const proposals = proposalsQuery.data;

  const openStageFlow = (stage: CopilotStage) => {
    setAppliedStage(null);
    setOpenStage(stage);
  };

  // Deep link (`?stage=…`): open that stage's flow as if its CTA was clicked, then
  // strip the param (replace) so refresh/back doesn't re-fire. Wait for proposals so
  // a pending proposal routes to review, matching a real CTA click. Ignore junk or
  // an AI-gated stage on a server with no AI — the page just renders normally.
  useEffect(() => {
    if (deepLinkConsumed.current) return;
    const stageParam = searchParams.get('stage');
    if (!stageParam) return;
    if (proposalsQuery.isLoading) return;
    deepLinkConsumed.current = true;

    const meta = STAGE_META.find((m) => m.stage === stageParam);
    if (meta?.active && !(meta.requiresAi && !aiConfigured)) {
      openStageFlow(meta.stage as CopilotStage);
    }

    const next = new URLSearchParams(searchParams);
    next.delete('stage');
    setSearchParams(next, { replace: true });
    // openStageFlow is stable enough for this one-shot; deps cover the real inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, proposalsQuery.isLoading, aiConfigured, setSearchParams]);

  const cards: StageCard[] = useMemo(() => {
    const dataExists: Record<string, boolean> = {
      project_facts: Boolean(project?.name && project?.state),
      control_line: (controlLinesQuery.data?.length ?? 0) > 0,
      // "Done" means at least one sheet is registered — an unregistered upload is
      // not yet on the map, which is what this stage delivers.
      plan_sheets: (planSheetsQuery.data ?? []).some((sheet) => sheet.hasRegistration),
      lot_breakdown: Boolean(lotPresenceQuery.data),
    };
    return STAGE_META.map((meta) => {
      const proposal = newestProposalForStage(proposals, meta.stage);
      return {
        ...meta,
        proposal,
        status: deriveStageStatus(proposal, dataExists[meta.stage] ?? false),
      };
    });
  }, [
    project?.name,
    project?.state,
    controlLinesQuery.data,
    planSheetsQuery.data,
    lotPresenceQuery.data,
    proposals,
  ]);

  const appliedCard = appliedStage ? (cards.find((c) => c.stage === appliedStage) ?? null) : null;
  // The next thing to do after the applied stage: first incomplete stage in order,
  // skipping the one just applied (its "done" may still be settling in the cache).
  const nextIncomplete = appliedStage
    ? (cards.find((c) => c.status !== 'done' && c.stage !== appliedStage) ?? null)
    : null;

  const factsProposal = newestProposalForStage(proposals, 'project_facts');
  const factsCurrent: ProjectFactsCurrent = {
    projectName: project?.name ?? null,
    projectNumber: project?.code ?? null,
    clientName: project?.clientName ?? null,
    state: project?.state ?? null,
  };

  const controlLineProposal = newestProposalForStage(proposals, 'control_line');
  // Seed the review modal's fallback zone from an existing control line's datum.
  const defaultCoordinateSystem = controlLinesQuery.data?.[0]?.coordinateSystem;

  const planSheetProposal = newestProposalForStage(proposals, 'plan_sheets');

  const lotBreakdownProposal = newestProposalForStage(proposals, 'lot_breakdown');

  const handleRollback = async (proposalId: string) => {
    try {
      await rollbackMutation.mutateAsync(proposalId);
      toast({ title: 'Rolled back', description: 'The earlier values have been restored.' });
    } catch (error) {
      logError('Failed to roll back proposal:', error);
      toast({
        title: 'Could not roll back',
        description: extractErrorMessage(error, 'Please try again.'),
        variant: 'error',
      });
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Link
        to={projectId ? `/projects/${projectId}/settings` : '/projects'}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to settings
      </Link>
      <h1 className="text-2xl font-bold">Setup copilot</h1>
      <p className="mb-6 text-muted-foreground">{project ? project.name : 'Loading…'}</p>

      <CopilotPanel
        cards={cards}
        aiConfigured={aiConfigured}
        onStageAction={openStageFlow}
        onRollback={(id) => void handleRollback(id)}
        rollbackBusy={rollbackMutation.isLoading}
      />

      {appliedStage && appliedCard && (
        <HandoffCard
          appliedTitle={appliedCard.title}
          next={nextIncomplete}
          onGo={() => nextIncomplete && openStageFlow(nextIncomplete.stage)}
          onDismiss={() => setAppliedStage(null)}
        />
      )}

      {openStage === 'project_facts' && projectId && (
        <ProjectFactsReviewModal
          projectId={projectId}
          current={factsCurrent}
          existingProposal={factsProposal?.status === 'proposed' ? factsProposal : null}
          onApplied={() => setAppliedStage('project_facts')}
          onClose={() => setOpenStage(null)}
        />
      )}

      {openStage === 'control_line' && projectId && (
        <ControlLineReviewModal
          projectId={projectId}
          defaultCoordinateSystem={defaultCoordinateSystem}
          existingProposal={controlLineProposal?.status === 'proposed' ? controlLineProposal : null}
          onApplied={() => setAppliedStage('control_line')}
          onClose={() => setOpenStage(null)}
        />
      )}

      {openStage === 'plan_sheets' && projectId && (
        <PlanSheetRegistrationReviewModal
          projectId={projectId}
          sheets={planSheetsQuery.data ?? []}
          defaultCoordinateSystem={defaultCoordinateSystem}
          existingProposal={planSheetProposal?.status === 'proposed' ? planSheetProposal : null}
          onApplied={() => setAppliedStage('plan_sheets')}
          onClose={() => setOpenStage(null)}
        />
      )}

      {openStage === 'lot_breakdown' && projectId && (
        <LotBreakdownReviewModal
          projectId={projectId}
          controlLines={controlLinesQuery.data ?? []}
          existingProposal={
            lotBreakdownProposal?.status === 'proposed' ? lotBreakdownProposal : null
          }
          onApplied={() => setAppliedStage('lot_breakdown')}
          onClose={() => setOpenStage(null)}
        />
      )}
    </div>
  );
}
