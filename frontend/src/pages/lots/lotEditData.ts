import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { logError } from '@/lib/logger';
import { parseOptionalNonNegativeDecimalInput } from '@/lib/numericInput';
import type { OfflineLotEdit } from '@/lib/offlineDb';

// ===== Data contract =====
// Response/contract shapes for the lot edit page (server lot read, project
// subcontractors read, the editable form buffer, and the PATCH payload).

export interface Lot {
  id: string;
  lotNumber: string;
  description: string | null;
  status: string;
  activityType: string | null;
  chainageStart: number | null;
  chainageEnd: number | null;
  offset: string | null;
  offsetCustom: string | null;
  layer: string | null;
  areaZone: string | null;
  budgetAmount?: number | null;
  assignedSubcontractorId?: string | null;
}

export interface Subcontractor {
  id: string;
  companyName: string;
  status: string;
}

export interface LotResponse {
  lot: Lot & { updatedAt: string };
}

export interface SubcontractorsResponse {
  subcontractors: Subcontractor[];
}

export interface LotUpdatePayload {
  lotNumber?: string;
  description?: string | null;
  activityType?: string | null;
  chainageStart?: number | null;
  chainageEnd?: number | null;
  offset?: string | null;
  offsetCustom?: string | null;
  layer?: string | null;
  areaZone?: string | null;
  status?: string | null;
  budgetAmount?: number | null;
  assignedSubcontractorId?: string | null;
  expectedUpdatedAt?: string;
}

// The editable form buffer. Every field is a string because it is bound to a
// controlled input/select/textarea; parsing happens at submit time.
export interface LotEditFormData {
  lotNumber: string;
  description: string;
  activityType: string;
  chainageStart: string;
  chainageEnd: string;
  offset: string;
  offsetCustom: string;
  layer: string;
  areaZone: string;
  status: string;
  budgetAmount: string;
  assignedSubcontractorId: string;
}

// ===== Path builders =====
// Kept byte-identical to the original inline fetches: neither endpoint encodes
// its (cuid) route params, exactly as before.

export function buildLotDetailPath(lotId: string): string {
  return `/api/lots/${lotId}`;
}

export function buildProjectSubcontractorsPath(projectId: string): string {
  return `/api/subcontractors/for-project/${projectId}`;
}

// ===== Validation =====

export function getOptionalDecimalValidationError(
  value: string,
  fieldLabel: string,
): string | null {
  if (!value.trim()) return null;
  return parseOptionalNonNegativeDecimalInput(value) === null
    ? `${fieldLabel} must be a non-negative decimal number.`
    : null;
}

// ===== Form / lot mappers =====
// Pure shape transforms. The string coercions (`|| ''`, `?.toString()`) and the
// null/undefined fallbacks are preserved exactly from the original inline code,
// including the deliberate difference between the form default ('') and the lot
// status default ('not_started') in the offline path.

export function mapLotToFormData(lot: Lot): LotEditFormData {
  return {
    lotNumber: lot.lotNumber || '',
    description: lot.description || '',
    activityType: lot.activityType || '',
    chainageStart: lot.chainageStart?.toString() || '',
    chainageEnd: lot.chainageEnd?.toString() || '',
    offset: lot.offset || '',
    offsetCustom: lot.offsetCustom || '',
    layer: lot.layer || '',
    areaZone: lot.areaZone || '',
    status: lot.status || '',
    budgetAmount: lot.budgetAmount?.toString() || '',
    assignedSubcontractorId: lot.assignedSubcontractorId || '',
  };
}

export function mapOfflineLotToFormData(offlineLot: OfflineLotEdit): LotEditFormData {
  // Note: OfflineLotEdit stores offset as number but we display as string option
  const offlineOffsetStr = offlineLot.offset !== undefined ? String(offlineLot.offset) : '';
  return {
    lotNumber: offlineLot.lotNumber || '',
    description: offlineLot.description || '',
    activityType: offlineLot.activityType || '',
    chainageStart: offlineLot.chainageStart?.toString() || '',
    chainageEnd: offlineLot.chainageEnd?.toString() || '',
    offset: offlineOffsetStr,
    offsetCustom: '', // OfflineLotEdit uses offsetLeft/offsetRight instead
    layer: offlineLot.layer || '',
    areaZone: offlineLot.areaZone || '',
    status: offlineLot.status || '',
    budgetAmount: offlineLot.budget?.toString() || '',
    assignedSubcontractorId: '',
  };
}

export function mapOfflineLotToLot(offlineLot: OfflineLotEdit): Lot {
  const offlineOffsetStr = offlineLot.offset !== undefined ? String(offlineLot.offset) : '';
  return {
    id: offlineLot.id,
    lotNumber: offlineLot.lotNumber,
    description: offlineLot.description || null,
    status: offlineLot.status || 'not_started',
    activityType: offlineLot.activityType || null,
    chainageStart: offlineLot.chainageStart ?? null,
    chainageEnd: offlineLot.chainageEnd ?? null,
    offset: offlineOffsetStr || null,
    offsetCustom: null, // OfflineLotEdit uses offsetLeft/offsetRight instead
    layer: offlineLot.layer || null,
    areaZone: offlineLot.areaZone || null,
    budgetAmount: offlineLot.budget,
    assignedSubcontractorId: null,
  };
}

// Shapes the object passed to cacheLotForOfflineEdit after a successful server
// read (the lot's updatedAt is supplied separately as the serverUpdatedAt arg).
export function buildOfflineLotCacheInput(
  lot: Lot,
  projectId: string,
): Partial<OfflineLotEdit> & { id: string; projectId: string; lotNumber: string } {
  return {
    id: lot.id,
    projectId,
    lotNumber: lot.lotNumber,
    description: lot.description ?? undefined,
    chainageStart: lot.chainageStart ?? undefined,
    chainageEnd: lot.chainageEnd ?? undefined,
    layer: lot.layer ?? undefined,
    areaZone: lot.areaZone ?? undefined,
    activityType: lot.activityType ?? undefined,
    status: lot.status ?? undefined,
    budget: lot.budgetAmount ?? undefined,
  };
}

// Shapes the offline edit record queued for sync when saving while offline.
// Mirrors the (previously duplicated) inline object at both offline-save sites.
export function buildOfflineLotEditInput(params: {
  lotId: string;
  projectId: string;
  formData: LotEditFormData;
  parsedChainageStart: number | null;
  parsedChainageEnd: number | null;
  parsedBudgetAmount: number | null;
  serverUpdatedAt: string | null;
  userId: string;
}): OfflineLotEdit {
  const {
    lotId,
    projectId,
    formData,
    parsedChainageStart,
    parsedChainageEnd,
    parsedBudgetAmount,
    serverUpdatedAt,
    userId,
  } = params;
  return {
    id: lotId,
    projectId,
    lotNumber: formData.lotNumber,
    description: formData.description || undefined,
    chainage: parsedChainageStart ?? undefined,
    chainageStart: parsedChainageStart ?? undefined,
    chainageEnd: parsedChainageEnd ?? undefined,
    offset: formData.offset ? parseFloat(formData.offset) || undefined : undefined,
    layer: formData.layer || undefined,
    areaZone: formData.areaZone || undefined,
    activityType: formData.activityType || undefined,
    status: formData.status || undefined,
    budget: parsedBudgetAmount ?? undefined,
    notes: undefined,
    syncStatus: 'pending',
    localUpdatedAt: new Date().toISOString(),
    serverUpdatedAt: serverUpdatedAt || undefined,
    editedBy: userId,
  };
}

// Shapes the PATCH body sent to /api/lots/:id. In conformed-budget-only mode the
// QA fields are intentionally omitted so only the budget (and the optimistic
// concurrency token) are sent.
export function buildLotUpdatePayload(params: {
  formData: LotEditFormData;
  parsedChainageStart: number | null;
  parsedChainageEnd: number | null;
  parsedBudgetAmount: number | null;
  isConformedBudgetOnlyMode: boolean;
  canViewBudgets: boolean;
  serverUpdatedAt: string | null;
}): LotUpdatePayload {
  const {
    formData,
    parsedChainageStart,
    parsedChainageEnd,
    parsedBudgetAmount,
    isConformedBudgetOnlyMode,
    canViewBudgets,
    serverUpdatedAt,
  } = params;

  const updatePayload: LotUpdatePayload = isConformedBudgetOnlyMode
    ? {}
    : {
        lotNumber: formData.lotNumber,
        description: formData.description || null,
        activityType: formData.activityType || null,
        chainageStart: parsedChainageStart,
        chainageEnd: parsedChainageEnd,
        offset: formData.offset || null,
        offsetCustom: formData.offset === 'custom' ? formData.offsetCustom || null : null,
        layer: formData.layer || null,
        areaZone: formData.areaZone || null,
        status: formData.status || null,
      };

  // Only include budget if user has access
  if (canViewBudgets && (parsedBudgetAmount !== null || isConformedBudgetOnlyMode)) {
    updatePayload.budgetAmount = parsedBudgetAmount;
  }

  // Include subcontractor assignment (can be null to unassign)
  if (canViewBudgets && !isConformedBudgetOnlyMode) {
    updatePayload.assignedSubcontractorId = formData.assignedSubcontractorId || null;
  }

  // Feature #871: Include expected version for concurrent edit detection
  if (serverUpdatedAt) {
    updatePayload.expectedUpdatedAt = serverUpdatedAt;
  }

  return updatePayload;
}

// ===== Lock rules =====
// Conformed lots keep QA fields locked but allow commercial budget repair before
// claiming; claimed lots are fully locked.
export function deriveLotEditLocks(lot: Lot, canViewBudgets: boolean) {
  const isClaimed = lot.status === 'claimed';
  const isConformed = lot.status === 'conformed';
  const canEditConformedBudget = isConformed && canViewBudgets;
  const detailsLocked = isConformed || isClaimed;
  const budgetLocked = isClaimed || (isConformed && !canViewBudgets);
  const canSubmit = !isClaimed && (!isConformed || canEditConformedBudget);
  return { isClaimed, isConformed, canEditConformedBudget, detailsLocked, budgetLocked, canSubmit };
}

// ===== Response normalizers =====

export function normalizeSubcontractors(data: SubcontractorsResponse): Subcontractor[] {
  return data.subcontractors || [];
}

// ===== Fetchers =====

async function fetchProjectSubcontractors(projectId: string): Promise<Subcontractor[]> {
  try {
    const data = await apiFetch<SubcontractorsResponse>(buildProjectSubcontractorsPath(projectId));
    return normalizeSubcontractors(data);
  } catch (err) {
    logError('Failed to fetch subcontractors:', err);
    throw err;
  }
}

// ===== Query hooks =====
// Project-scoped read; the page ignores the error state and falls back to an
// empty list (the assignment select simply shows no options), matching the
// original effect that swallowed failures.

export function useProjectSubcontractorsQuery(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.subcontractors(projectId ?? ''),
    queryFn: () => fetchProjectSubcontractors(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });
}
