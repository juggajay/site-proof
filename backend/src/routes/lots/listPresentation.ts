// =============================================================================
// Lot list presentation: the pure response-mapping behind GET /api/lots.
// Extracted from lots.ts to isolate the post-fetch transform (budget
// visibility, subcontractor-assignment filtering, and the singular->array
// `itpInstances` compatibility shape) from the route's auth + Prisma fetches.
// Behaviour is preserved exactly:
//   - `budgetAmount` is replaced with `null` unless `canViewBudgetAmount`.
//   - when `subcontractorCompanyId` is set, `subcontractorAssignments` is
//     filtered to that company; otherwise the query's assignments pass through.
//   - when `subcontractorCompanyId` is set, the legacy assigned subcontractor
//     fields are hidden unless they refer to that same company.
//   - when `includeITP` is true, the singular `itpInstance` is exposed as
//     `itpInstances: [itpInstance]` (or `[]`); otherwise no ITP transform.
// The spread (`...lot`) is intentional: it preserves every selected lot field
// AND its original key order, so the serialized response stays byte-identical.
// =============================================================================

import { getChecklistItemsForInstance } from '../itp/helpers/templateSnapshot.js';

/** Minimal shape the presenter needs from each lot's active assignment row. */
export type LotListAssignment = { subcontractorCompanyId: string };

type LotListItpCompletion = {
  checklistItemId?: string | null;
  status?: string | null;
};

type LotListItpTemplate = {
  checklistItems?: { id: string }[] | null;
  [key: string]: unknown;
};

type LotListItpInstance = {
  status?: string | null;
  templateSnapshot?: string | null;
  template?: LotListItpTemplate | null;
  completions?: LotListItpCompletion[] | null;
  [key: string]: unknown;
};

const DONE_COMPLETION_STATUSES = new Set(['completed', 'not_applicable']);
const STARTED_COMPLETION_STATUSES = new Set(['completed', 'not_applicable', 'failed']);

export interface PresentLotListOptions {
  /** When false, `budgetAmount` is nulled out for the caller. */
  canViewBudgetAmount: boolean;
  /** When set, assignments are filtered to this company; null leaves them as-is. */
  subcontractorCompanyId: string | null;
  /** When true, adds the `itpInstances` compatibility array. */
  includeITP: boolean;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function deriveItpListProgress(instance: LotListItpInstance): {
  status: 'not_started' | 'in_progress' | 'completed';
  completionPercentage: number;
} {
  const checklistItems = getChecklistItemsForInstance(instance);
  const completions = instance.completions ?? [];
  const totalItems = checklistItems.length;

  const doneItemIds = new Set(
    completions
      .filter((completion) => DONE_COMPLETION_STATUSES.has(completion.status ?? ''))
      .map((completion) => completion.checklistItemId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
  );
  const startedItemIds = new Set(
    completions
      .filter((completion) => STARTED_COMPLETION_STATUSES.has(completion.status ?? ''))
      .map((completion) => completion.checklistItemId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
  );

  const doneCount =
    totalItems > 0
      ? checklistItems.filter((item) => doneItemIds.has(item.id)).length
      : doneItemIds.size;
  const completionPercentage =
    totalItems > 0 ? Math.round((doneCount / totalItems) * 100) : doneCount > 0 ? 100 : 0;

  if (totalItems > 0 && doneCount === totalItems) {
    return { status: 'completed', completionPercentage };
  }

  if (totalItems === 0 && instance.status === 'completed') {
    return { status: 'completed', completionPercentage: 100 };
  }

  if (startedItemIds.size > 0 || instance.status === 'in_progress') {
    return { status: 'in_progress', completionPercentage };
  }

  return { status: 'not_started', completionPercentage };
}

function presentItpInstanceForLotList(instance: unknown): unknown {
  if (!isObject(instance)) {
    return instance;
  }

  const {
    completions: _completions,
    templateSnapshot: _templateSnapshot,
    template,
    ...rest
  } = instance as LotListItpInstance;
  const { status, completionPercentage } = deriveItpListProgress(instance as LotListItpInstance);

  let publicTemplate = template;
  if (isObject(template)) {
    const { checklistItems: _checklistItems, ...templateRest } = template;
    publicTemplate = templateRest;
  }

  const publicInstance = {
    ...rest,
    status,
    completionPercentage,
  };

  return template === undefined ? publicInstance : { ...publicInstance, template: publicTemplate };
}

/**
 * Transform the lots returned by Prisma `findMany` into the GET /api/lots
 * response items. Pure — no I/O, no access checks; the route owns those.
 */
export function presentLotList<
  TLot extends {
    budgetAmount: unknown;
    subcontractorAssignments: LotListAssignment[];
    assignedSubcontractorId?: string | null;
    assignedSubcontractor?: unknown;
    itpInstance?: unknown;
  },
>(lots: TLot[], options: PresentLotListOptions) {
  const { canViewBudgetAmount, subcontractorCompanyId, includeITP } = options;

  // Apply budget visibility + subcontractor assignment filtering.
  const visibleLots = lots.map((lot) => {
    const visibleLot = {
      ...lot,
      budgetAmount: canViewBudgetAmount ? lot.budgetAmount : null,
      subcontractorAssignments: subcontractorCompanyId
        ? lot.subcontractorAssignments.filter(
            (assignment) => assignment.subcontractorCompanyId === subcontractorCompanyId,
          )
        : lot.subcontractorAssignments,
    };

    if (subcontractorCompanyId && lot.assignedSubcontractorId !== subcontractorCompanyId) {
      if ('assignedSubcontractorId' in visibleLot) {
        visibleLot.assignedSubcontractorId = null;
      }
      if ('assignedSubcontractor' in visibleLot) {
        visibleLot.assignedSubcontractor = null;
      }
    }

    return visibleLot;
  });

  // Frontend expects itpInstances array, but we have singular itpInstance.
  return includeITP
    ? visibleLots.map((lot) => ({
        ...lot,
        itpInstances: lot.itpInstance ? [presentItpInstanceForLotList(lot.itpInstance)] : [],
      }))
    : visibleLots;
}
