import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch, ApiError, authFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type { CopilotProposal } from './copilotData';

/** What is being migrated. Server-owned; see backend `importKinds.ts`. */
export type ImportKind = 'itp_template' | 'lot_register';

/** Where an import batch is in its lifecycle (server-owned; see batchState.ts). */
export type ImportBatchStatus =
  | 'uploaded'
  | 'parsed'
  | 'mapped'
  | 'dry_run'
  | 'review'
  | 'applied'
  | 'rolled_back'
  | 'cancelled'
  | 'failed';

export interface ImportBatchSummary {
  id: string;
  kind: string;
  status: ImportBatchStatus;
  failedReason: string | null;
  createdAt: string;
  sourceFileName: string | null;
  proposalId: string | null;
  proposalStatus: string | null;
}

export type DryRunOutcome = 'create' | 'update' | 'skip' | 'needs_review' | 'blocked';

export interface DryRunRow {
  key: string;
  unit: 'template' | 'checklist_row' | 'lot';
  rowRef: { sheet: string; rowIndex: number };
  label: string;
  outcome: DryRunOutcome;
  reason?: string;
  /** Free text the reason code cannot carry — the server's own wording. */
  detail?: string;
  duplicateOf?: { model: string; id: string; matchedOn: string };
  collidesWith?: { sheet: string; rowIndex: number }[];
  overLength?: { field: string; length: number; max: number };
  proposedActivitySlug?: string;
  activityFold?: 'exact' | 'family' | 'none';
  declaredStateSpec?: string | null;
  specAffirmed?: boolean;
  checklistItemCount?: number;
}

export interface DryRunResult {
  counts: {
    willCreate: number;
    willUpdate: number;
    willSkip: number;
    needsReview: number;
    ambiguous: number;
    blocked: number;
  };
  rows: DryRunRow[];
  unmappedHeaders: { sheet: string; headers: string[] }[];
  canApply: boolean;
}

export interface ParsedSheet {
  name: string;
  headers: string[];
  rows: string[][];
}

export interface ImportBatchDetail {
  batch: ImportBatchSummary & {
    sourceAvailable: boolean;
    mappingProfileId: string | null;
  };
  grid: { sheets: ParsedSheet[] } | null;
  dryRun: DryRunResult | null;
}

export interface UploadImportResult {
  batch: { id: string; status: ImportBatchStatus; kind: string };
  sheets: { name: string; headers: string[]; rowCount: number }[];
  suggestedProfile: { key: string; name: string } | null;
  suggestedFieldMap: unknown[];
}

/** What the reviewer decided about one proposed record. */
export interface ImportResolution {
  activitySlug?: string;
  affirmSpec?: boolean;
  skip?: boolean;
  skipRows?: number[];
  milestoneAs?: 'hold_point' | 'witness' | 'standard';
}

export type Resolutions = Record<string, ImportResolution>;

const IMPORT_STALE_TIME_MS = 15_000;

function importPath(projectId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/copilot/imports`;
}

/**
 * A single proposal WITH its payload. The list route deliberately returns a
 * payload-free projection (an import proposal carries every proposed record),
 * so a review surface reads the full record from here.
 */
export function useCopilotProposalDetail(
  projectId: string | undefined,
  proposalId: string | undefined,
) {
  return useQuery({
    queryKey: queryKeys.copilotProposal(projectId ?? 'none', proposalId ?? 'none'),
    queryFn: async () => {
      const data = await apiFetch<{ proposal: CopilotProposal }>(
        `/api/projects/${encodeURIComponent(projectId!)}/copilot/proposals/${encodeURIComponent(proposalId!)}`,
      );
      return data.proposal;
    },
    enabled: Boolean(projectId && proposalId),
    staleTime: IMPORT_STALE_TIME_MS,
  });
}

export function useImportBatches(projectId: string | undefined, kind: ImportKind) {
  return useQuery({
    queryKey: queryKeys.importBatches(projectId ?? 'none', kind),
    queryFn: async () => {
      const data = await apiFetch<{ batches: ImportBatchSummary[] }>(
        `${importPath(projectId!)}?kind=${kind}`,
      );
      return data.batches ?? [];
    },
    enabled: Boolean(projectId),
    staleTime: IMPORT_STALE_TIME_MS,
  });
}

export function useImportBatch(projectId: string | undefined, batchId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.importBatch(projectId ?? 'none', batchId ?? 'none'),
    queryFn: () =>
      apiFetch<ImportBatchDetail>(`${importPath(projectId!)}/${encodeURIComponent(batchId!)}`),
    enabled: Boolean(projectId && batchId),
    staleTime: IMPORT_STALE_TIME_MS,
  });
}

export function useImportProfiles(projectId: string | undefined, kind: ImportKind) {
  return useQuery({
    queryKey: queryKeys.importProfiles(projectId ?? 'none', kind),
    queryFn: () =>
      apiFetch<{
        builtIn: { key: string; name: string; fieldMap: unknown[] }[];
        saved: { id: string; name: string; fieldMap: unknown[]; isBuiltIn: boolean }[];
      }>(`/api/projects/${encodeURIComponent(projectId!)}/copilot/imports-profiles?kind=${kind}`),
    enabled: Boolean(projectId),
    staleTime: IMPORT_STALE_TIME_MS,
  });
}

/**
 * Upload a spreadsheet. authFetch (not apiFetch) so the browser sets the
 * multipart boundary itself. Writes nothing — it parses the file and opens a
 * batch for review.
 */
export function useUploadImport(projectId: string | undefined, kind: ImportKind) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File): Promise<UploadImportResult> => {
      const form = new FormData();
      form.append('file', file, file.name);
      const response = await authFetch(`${importPath(projectId!)}?kind=${kind}`, {
        method: 'POST',
        body: form,
      });
      if (!response.ok) {
        throw new ApiError(response.status, await response.text());
      }
      return (await response.json()) as UploadImportResult;
    },
    onSuccess: () => invalidateImports(queryClient, projectId, kind),
  });
}

/** Map the columns and compute the dry run. Re-callable — that IS the re-map loop. */
export function useImportDryRun(projectId: string | undefined, kind: ImportKind) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      batchId,
      profileId,
      resolutions,
      saveProfileName,
      saveProfileScope,
    }: {
      batchId: string;
      profileId: string;
      resolutions?: Resolutions;
      saveProfileName?: string;
      saveProfileScope?: 'project' | 'company';
    }) =>
      apiFetch<{ batch: { id: string; status: ImportBatchStatus }; dryRun: DryRunResult }>(
        `${importPath(projectId!)}/${encodeURIComponent(batchId)}/dry-run`,
        {
          method: 'POST',
          body: JSON.stringify({ profileId, resolutions, saveProfileName, saveProfileScope }),
        },
      ),
    onSuccess: () => invalidateImports(queryClient, projectId, kind),
  });
}

/** Create the batch's ONE proposal — the record a human then decides on. */
export function useSendImportToReview(projectId: string | undefined, kind: ImportKind) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ batchId, resolutions }: { batchId: string; resolutions?: Resolutions }) =>
      apiFetch<{ proposalId: string; dryRun: DryRunResult; itemCount: number }>(
        `${importPath(projectId!)}/${encodeURIComponent(batchId)}/proposal`,
        { method: 'POST', body: JSON.stringify({ resolutions }) },
      ),
    onSuccess: () => invalidateImports(queryClient, projectId, kind),
  });
}

export function useCancelImport(projectId: string | undefined, kind: ImportKind) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (batchId: string) =>
      apiFetch<{ batch: { id: string; status: ImportBatchStatus } }>(
        `${importPath(projectId!)}/${encodeURIComponent(batchId)}/cancel`,
        { method: 'POST' },
      ),
    onSuccess: () => invalidateImports(queryClient, projectId, kind),
  });
}

export function reconciliationCsvPath(projectId: string, batchId: string): string {
  return `${importPath(projectId)}/${encodeURIComponent(batchId)}/reconciliation?format=csv`;
}

function invalidateImports(
  queryClient: ReturnType<typeof useQueryClient>,
  projectId: string | undefined,
  kind: ImportKind,
): void {
  if (!projectId) return;
  void queryClient.invalidateQueries({ queryKey: queryKeys.importBatches(projectId, kind) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.copilotProposals(projectId) });
}

/** The one open batch a reviewer should be sent to, if any. */
export function activeImportBatch(batches: ImportBatchSummary[] | undefined) {
  return (
    batches?.find(
      (batch) => !['applied', 'rolled_back', 'cancelled', 'failed'].includes(batch.status),
    ) ?? null
  );
}
