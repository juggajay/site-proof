import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
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
import {
  newestProposalForStage,
  useCopilotProposals,
  useProjectLotPresence,
  useRollbackProposal,
} from './copilotData';
import { STAGE_META, deriveStageStatus } from './copilotStageStatus';

// The project detail endpoint returns clientName even though the shared settings
// `Project` type omits it; widen locally for the facts diff.
type CopilotProject = Project & { clientName?: string | null };

export function CopilotPage() {
  const { projectId } = useParams();
  const [factsOpen, setFactsOpen] = useState(false);

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

  const cards: StageCard[] = useMemo(() => {
    const dataExists: Record<string, boolean> = {
      project_facts: Boolean(project?.name && project?.state),
      control_line: (controlLinesQuery.data?.length ?? 0) > 0,
      plan_sheets: (planSheetsQuery.data?.length ?? 0) > 0,
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

  const factsProposal = newestProposalForStage(proposals, 'project_facts');
  const factsCurrent: ProjectFactsCurrent = {
    projectName: project?.name ?? null,
    projectNumber: project?.code ?? null,
    clientName: project?.clientName ?? null,
    state: project?.state ?? null,
  };

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
        onProjectFactsAction={() => setFactsOpen(true)}
        onRollback={(id) => void handleRollback(id)}
        rollbackBusy={rollbackMutation.isLoading}
      />

      {factsOpen && projectId && (
        <ProjectFactsReviewModal
          projectId={projectId}
          current={factsCurrent}
          existingProposal={factsProposal?.status === 'proposed' ? factsProposal : null}
          onClose={() => setFactsOpen(false)}
        />
      )}
    </div>
  );
}
