import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { logError } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import type { DocketDetailResponse, LabourEntry, PlantEntry } from './docketApprovalsData';

// Data + pure helpers backing the docket approve/reject/query/view action modal.
// Extracted verbatim from DocketApprovalsPage so the create-docket flow (page
// submit + CreateDocketModal) and the action modal share one implementation.

export type DocketActionType = 'approve' | 'reject' | 'query' | 'view';
export type DocketActionEndpoint = 'approve' | 'reject' | 'query';

export type DocketApprovalDiarySyncOutcome =
  | {
      status: 'synced';
      message: string;
    }
  | {
      status: 'skipped' | 'failed';
      code: string;
      message: string;
    };

export interface DocketActionResponse {
  diarySync?: DocketApprovalDiarySyncOutcome;
}

// ===== Shared docket status display maps =====
// Page-private constants on DocketApprovalsPage, now shared with the modal.
// (DocketApprovalsMobileView keeps its own copies — intentionally untouched.)

export const statusColors: Record<string, string> = {
  draft: 'bg-muted text-foreground',
  pending_approval: 'bg-muted text-muted-foreground',
  approved: 'bg-muted text-muted-foreground',
  rejected: 'bg-destructive/10 text-destructive',
  queried: 'bg-warning/10 text-warning',
};

export const statusLabels: Record<string, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
  queried: 'Queried',
};

// ===== Hours validation =====
// Shared by the create-docket flow (CreateDocketModal inputs, page submit) and
// the approve adjustment inputs (DocketActionModal).

export const HOURS_INPUT_ERROR = 'Hours must be a non-negative decimal number.';
export const HOURS_INPUT_PATTERN = /^\d+(?:\.\d+)?$/;

export function parseHoursInput(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) {
    return 0;
  }

  if (!HOURS_INPUT_PATTERN.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function hasHoursChanged(value: string, submittedHours: number): boolean {
  const parsed = parseHoursInput(value);
  return parsed !== null && parsed !== submittedHours;
}

export function validateHours(hours: string): { isValid: boolean; warning: string | null } {
  const normalizedHours = hours.trim();
  if (!normalizedHours) {
    return { isValid: true, warning: null };
  }
  if (normalizedHours.startsWith('-')) {
    return { isValid: false, warning: 'Hours cannot be negative' };
  }
  const numHours = parseHoursInput(hours);
  if (numHours === null) {
    return { isValid: false, warning: HOURS_INPUT_ERROR };
  }
  if (numHours > 24) {
    return { isValid: true, warning: 'Warning: Hours exceed 24 - please verify this is correct' };
  }
  return { isValid: true, warning: null };
}

// ===== Action endpoint + payload shaping =====
// Mirrors the original inline ternaries exactly: approve/reject map to their own
// endpoints, everything else falls through to query; the payload shape branches
// on approve / query / (else) reject.

export function resolveDocketActionEndpoint(actionType: DocketActionType): DocketActionEndpoint {
  return actionType === 'approve' ? 'approve' : actionType === 'reject' ? 'reject' : 'query';
}

export function buildDocketDetailPath(docketId: string): string {
  return `/api/dockets/${encodeURIComponent(docketId)}`;
}

export function buildDocketActionPath(docketId: string, endpoint: DocketActionEndpoint): string {
  return `/api/dockets/${encodeURIComponent(docketId)}/${endpoint}`;
}

export interface DocketApprovePayload {
  foremanNotes: string | null;
  adjustedLabourHours: number | undefined;
  adjustedPlantHours: number | undefined;
  adjustmentReason: string | null;
}

export interface DocketQueryPayload {
  questions: string;
}

export interface DocketRejectPayload {
  reason: string;
}

export type DocketActionPayload = DocketApprovePayload | DocketQueryPayload | DocketRejectPayload;

export function buildDocketActionPayload(
  actionType: DocketActionType,
  params: {
    actionNotes: string;
    adjustedLabourHours?: number;
    adjustedPlantHours?: number;
    adjustmentReason: string;
  },
): DocketActionPayload {
  const { actionNotes, adjustedLabourHours, adjustedPlantHours, adjustmentReason } = params;

  if (actionType === 'approve') {
    return {
      foremanNotes: actionNotes.trim() || null,
      adjustedLabourHours,
      adjustedPlantHours,
      adjustmentReason: adjustmentReason.trim() || null,
    };
  }

  if (actionType === 'query') {
    return { questions: actionNotes.trim() };
  }

  return { reason: actionNotes.trim() };
}

export function getDocketApprovalDiarySyncWarning(
  response: DocketActionResponse | null | undefined,
): string | null {
  const diarySync = response?.diarySync;
  if (!diarySync || diarySync.status === 'synced') {
    return null;
  }

  return diarySync.message || 'Docket approved, but diary auto-population did not complete.';
}

// ===== Detail entries query =====
// Fetched when the action modal opens, keyed by docket id. cacheTime/staleTime 0
// reproduce the original "fetch fresh on every open" behaviour, and retry:false
// preserves the single-attempt, log-and-swallow error handling (no toast, empty
// entries fall back to the "No entries found" message).

export interface DocketDetailEntries {
  adjustmentReason: string | null;
  labourEntries: LabourEntry[];
  plantEntries: PlantEntry[];
}

async function fetchDocketDetailEntries(docketId: string): Promise<DocketDetailEntries> {
  try {
    const data = await apiFetch<DocketDetailResponse>(buildDocketDetailPath(docketId));
    return {
      adjustmentReason: data.docket?.adjustmentReason ?? null,
      labourEntries: data.docket?.labourEntries || [],
      plantEntries: data.docket?.plantEntries || [],
    };
  } catch (err) {
    logError('Error fetching docket detail:', err);
    throw err;
  }
}

export function useDocketDetailEntriesQuery(docketId: string | null) {
  return useQuery({
    queryKey: queryKeys.docketDetail(docketId ?? ''),
    queryFn: () => fetchDocketDetailEntries(docketId!),
    enabled: Boolean(docketId),
    staleTime: 0,
    cacheTime: 0,
    retry: false,
  });
}
