import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch, ApiError, authFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type { SetoutExtractionCandidate } from '../settings/controlLinesData';

/** The Wave-1 copilot stages, in setup order. */
export const COPILOT_STAGES = [
  'project_facts',
  'control_line',
  'plan_sheets',
  'lot_breakdown',
] as const;
export type CopilotStage = (typeof COPILOT_STAGES)[number];

export type ProposalStatus =
  | 'proposed'
  | 'accepted'
  | 'edited'
  | 'rejected'
  | 'superseded'
  | 'rolled_back';

export interface ProposalSourceRef {
  documentId?: string;
  fileName?: string;
  page?: number;
  note?: string;
}

export interface CopilotProposal {
  id: string;
  projectId: string;
  stage: string;
  status: ProposalStatus;
  model: string;
  sourceRefs: ProposalSourceRef[];
  payload: unknown;
  warnings: unknown;
  editedPayload: unknown;
  decidedAt: string | null;
  createdAt: string;
}

/** The reviewed project-facts candidate the stage-1 extractor returns. */
export interface ProjectFactsCandidate {
  projectName: string | null;
  projectNumber: string | null;
  clientName: string | null;
  state: string | null;
  specificationSet: string;
}

export interface ProjectFactsExtractionResult {
  proposalId: string;
  candidate: ProjectFactsCandidate;
  warnings: string[];
}

/** The subset of the project fields a project-facts accept can edit. */
export interface ProjectFactsEdit {
  projectName?: string | null;
  projectNumber?: string | null;
  clientName?: string | null;
  state?: string | null;
}

const COPILOT_STALE_TIME_MS = 15_000;
const EMPTY_PROPOSALS: CopilotProposal[] = [];

function copilotPath(projectId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/copilot`;
}

/** All proposals for a project, newest first (the rail derives per-stage status). */
export function useCopilotProposals(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.copilotProposals(projectId ?? 'none'),
    queryFn: async () => {
      const data = await apiFetch<{ proposals: CopilotProposal[] }>(
        `${copilotPath(projectId!)}/proposals`,
      );
      return data.proposals ?? EMPTY_PROPOSALS;
    },
    enabled: Boolean(projectId),
    staleTime: COPILOT_STALE_TIME_MS,
  });
}

/**
 * Whether the project already has any lots — the "Done" signal for the
 * lot_breakdown stage. Uses the existing lots list endpoint with limit=1 so it
 * never downloads the whole register just to answer a boolean.
 */
export function useProjectLotPresence(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.copilotLotPresence(projectId ?? 'none'),
    queryFn: async () => {
      const data = await apiFetch<{
        lots?: unknown[];
        data?: unknown[];
        pagination?: { totalItems?: number; total?: number };
      }>(`/api/lots?projectId=${encodeURIComponent(projectId!)}&page=1&limit=1`);
      const rows = data.lots ?? data.data ?? [];
      const total = data.pagination?.totalItems ?? data.pagination?.total ?? rows.length;
      return total > 0;
    },
    enabled: Boolean(projectId),
    staleTime: COPILOT_STALE_TIME_MS,
  });
}

/**
 * Read the project facts off a drawing title block. authFetch (not apiFetch) so
 * the browser sets the multipart boundary itself. Writes nothing — it persists a
 * 'proposed' proposal for review and returns the candidate to show.
 */
export function useExtractProjectFacts(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File): Promise<ProjectFactsExtractionResult> => {
      const form = new FormData();
      form.append('file', file, file.name);
      const response = await authFetch(`${copilotPath(projectId!)}/project_facts/extract`, {
        method: 'POST',
        body: form,
      });
      if (!response.ok) {
        throw new ApiError(response.status, await response.text());
      }
      return (await response.json()) as ProjectFactsExtractionResult;
    },
    onSuccess: () => {
      if (projectId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.copilotProposals(projectId) });
      }
    },
  });
}

/** The reviewed control-line candidate the stage-2 extractor returns. */
export interface ControlLineExtractionResult {
  proposalId: string;
  candidate: SetoutExtractionCandidate;
  warnings: string[];
}

/**
 * Read the survey control line(s) off a setout sheet. authFetch (not apiFetch)
 * so the browser sets the multipart boundary itself. Writes nothing — it
 * persists a 'proposed' proposal for review and returns the candidate to show.
 */
export function useExtractControlLine(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File): Promise<ControlLineExtractionResult> => {
      const form = new FormData();
      form.append('file', file, file.name);
      const response = await authFetch(`${copilotPath(projectId!)}/control_line/extract`, {
        method: 'POST',
        body: form,
      });
      if (!response.ok) {
        throw new ApiError(response.status, await response.text());
      }
      return (await response.json()) as ControlLineExtractionResult;
    },
    onSuccess: () => {
      if (projectId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.copilotProposals(projectId) });
      }
    },
  });
}

/** Accept (optionally with edits) or reject a proposal via the decision endpoint. */
export function useDecideProposal(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      proposalId,
      action,
      editedPayload,
    }: {
      proposalId: string;
      action: 'accept' | 'reject';
      editedPayload?: unknown;
    }) => {
      const data = await apiFetch<{ proposal: CopilotProposal }>(
        `${copilotPath(projectId!)}/proposals/${encodeURIComponent(proposalId)}/decision`,
        {
          method: 'POST',
          body: JSON.stringify(
            editedPayload === undefined ? { action } : { action, editedPayload },
          ),
        },
      );
      return data.proposal;
    },
    onSuccess: () => invalidateAfterDecision(queryClient, projectId),
  });
}

/** Roll back an applied proposal, restoring the prior project state. */
export function useRollbackProposal(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (proposalId: string) => {
      const data = await apiFetch<{ proposal: CopilotProposal }>(
        `${copilotPath(projectId!)}/proposals/${encodeURIComponent(proposalId)}/rollback`,
        { method: 'POST' },
      );
      return data.proposal;
    },
    onSuccess: () => invalidateAfterDecision(queryClient, projectId),
  });
}

// A decision/rollback can change the project record, control lines (+ the lot
// geometries a control line drives), and lot presence, and always changes
// proposal status — refresh every consumer the rail reads.
function invalidateAfterDecision(
  queryClient: ReturnType<typeof useQueryClient>,
  projectId: string | undefined,
): void {
  if (!projectId) return;
  void queryClient.invalidateQueries({ queryKey: queryKeys.copilotProposals(projectId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.copilotLotPresence(projectId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.controlLines(projectId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.projectLotGeometries(projectId) });
}

/** Newest proposal for a stage, or null. Proposals arrive newest-first. */
export function newestProposalForStage(
  proposals: CopilotProposal[] | undefined,
  stage: CopilotStage,
): CopilotProposal | null {
  return proposals?.find((p) => p.stage === stage) ?? null;
}
