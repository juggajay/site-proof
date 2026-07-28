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
  /** B3 §4.5 — what a corporate master would change in this project's copy.
   *  Present only when the project already has this ITP AND it differs. */
  diff?: {
    added: number;
    removed: number;
    changed: number;
    items: { change: 'added' | 'removed' | 'changed'; description: string }[];
  };
  collidesWith?: { sheet: string; rowIndex: number }[];
  overLength?: { field: string; length: number; max: number };
  proposedActivitySlug?: string;
  activityFold?: 'exact' | 'family' | 'none';
  declaredStateSpec?: string | null;
  specAffirmed?: boolean;
  checklistItemCount?: number;
  /** This row is really in the payload Apply would write. */
  willImport?: boolean;
  /** For a `checklist_row`, the ledger key of the template it belongs to — the
   *  key a `skipRows` resolution has to be written against. */
  parentKey?: string;
}

export interface DryRunResult {
  counts: {
    willCreate: number;
    willUpdate: number;
    willSkip: number;
    needsReview: number;
    ambiguous: number;
    blocked: number;
    /** How many records Apply would create. Server-derived from the payload —
     *  do NOT recompute it from the outcomes, which is what used to leave
     *  `template_not_found` rows out of the CTA while still creating them. */
    willImport: number;
  };
  rows: DryRunRow[];
  unmappedHeaders: { sheet: string; headers: string[] }[];
  canApply: boolean;
  /** The map that produced this dry run. Stored with it by the server, so a
   *  resumed batch can re-run without the reviewer re-picking the mapping. */
  fieldMap?: unknown[];
}

export interface ParsedSheet {
  name: string;
  headers: string[];
  rows: string[][];
}

export interface ParsedGrid {
  sheets: ParsedSheet[];
  /** Something about the READ itself the reviewer has to know — how much of a
   *  PDF was actually read, merges too large to check. */
  notice?: string;
}

export interface ImportBatchDetail {
  batch: ImportBatchSummary & {
    sourceAvailable: boolean;
    mappingProfileId: string | null;
  };
  grid: ParsedGrid | null;
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
 * Upload a source file. authFetch (not apiFetch) so the browser sets the
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

/**
 * B3 §4.5 — ITP sets already applied on another project this user can read.
 * Rolling one out here creates a controlled COPY, reviewed like any other
 * import; the dry run shows what it would change against what is already here.
 */
export interface CorporateMaster {
  id: string;
  projectId: string;
  projectName: string;
  sourceFileName: string | null;
  sourceFormat: string;
  appliedAt: string;
  templateCount: number;
}

export function useCorporateMasters(projectId: string | undefined, kind: ImportKind) {
  return useQuery({
    queryKey: queryKeys.importMasters(projectId ?? 'none', kind),
    queryFn: async () => {
      const data = await apiFetch<{ masters: CorporateMaster[] }>(
        `/api/projects/${encodeURIComponent(projectId!)}/copilot/import-masters?kind=${kind}`,
      );
      return data.masters ?? [];
    },
    // Only ITP sets travel between projects; a lot register never does.
    enabled: Boolean(projectId) && kind === 'itp_template',
    staleTime: IMPORT_STALE_TIME_MS,
  });
}

/** Open a batch in THIS project from a master applied elsewhere. Writes no
 *  templates — it is the upload step, with the master's grid instead of a file. */
export function useImportFromMaster(projectId: string | undefined, kind: ImportKind) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (masterBatchId: string) =>
      apiFetch<UploadImportResult>(`${importPath(projectId!)}/from-master?kind=${kind}`, {
        method: 'POST',
        body: JSON.stringify({ masterBatchId }),
      }),
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
      fieldMap,
      resolutions,
      saveProfileName,
      saveProfileScope,
    }: {
      batchId: string;
      /** A saved or built-in profile. Omitted when `fieldMap` is sent instead. */
      profileId?: string;
      /** The columns read straight off the file — what a PDF and an
       *  unrecognised sheet layout both map with. */
      fieldMap?: unknown[];
      resolutions?: Resolutions;
      saveProfileName?: string;
      saveProfileScope?: 'project' | 'company';
    }) =>
      apiFetch<{ batch: { id: string; status: ImportBatchStatus }; dryRun: DryRunResult }>(
        `${importPath(projectId!)}/${encodeURIComponent(batchId)}/dry-run`,
        {
          method: 'POST',
          body: JSON.stringify({
            ...(fieldMap ? { fieldMap } : { profileId }),
            resolutions,
            saveProfileName,
            saveProfileScope,
          }),
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
