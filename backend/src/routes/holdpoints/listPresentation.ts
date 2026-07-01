/**
 * Hold-point list presentation helper, extracted verbatim from
 * backend/src/routes/holdpoints.ts (the GET /project/:projectId hold-point list
 * route) as a slice of the holdpoints route split (engineering-health
 * Workstream 1).
 *
 * The route loads each lot's ITP checklist items, completions, and persisted
 * hold-point rows, then builds one list item per hold-point checklist item —
 * reusing the persisted HoldPoint row when one exists, otherwise synthesising a
 * virtual entry keyed `virtual-${lot.id}-${item.id}` — and sorts by lot number
 * then sequence number. This is the pure, DB-free piece: given the already-loaded
 * lots it returns the same list, in the same shape and order, as the inline code.
 *
 * The release-gated filter lives here so the helper is self-contained and
 * correct regardless of caller. Release-gated items include explicit hold
 * points plus superintendent-responsible non-witness sign-off items, matching
 * the ITP completion guard.
 *
 * Input types are minimal structural subsets of the Prisma rows actually read, so
 * the real Prisma objects pass unchanged. Unit-tested DB-free in
 * listPresentation.test.ts.
 */

import { isReleaseGatedChecklistItem } from '../../lib/holdPointReleaseGating.js';
import { getHoldPointChecklistItemsForInstance } from './itpSnapshot.js';
import {
  buildHoldPointPrerequisites,
  getIncompletePrerequisites,
  getPrecedingChecklistItems,
} from './prerequisites.js';
import type { ChecklistItem } from '../itp/helpers/templateSnapshot.js';

// Shape of each item in the list response (formerly inline in holdpoints.ts).
export interface HoldPointListItem {
  id: string;
  lotId: string;
  lotNumber: string;
  itpChecklistItemId: string;
  description: string;
  pointType: string | null;
  status: string;
  notificationSentAt: Date | null | undefined;
  scheduledDate: Date | null | undefined;
  releasedAt: Date | null | undefined;
  releasedByName: string | null | undefined;
  releasedByOrg: string | null | undefined;
  releaseMethod: string | null | undefined;
  releaseRecipientEmail: string | null | undefined;
  releaseNotes: string | null | undefined;
  sequenceNumber: number;
  isCompleted: boolean;
  isVerified: boolean;
  canRequestRelease: boolean;
  incompletePrerequisiteCount: number;
  createdAt: Date;
}

export type HoldPointListChecklistItem = ChecklistItem;

export type HoldPointListCompletion = {
  checklistItemId: string;
  status: string;
  verificationStatus: string;
  completedAt?: Date | null;
};

export type HoldPointListPersistedHoldPoint = {
  id: string;
  itpChecklistItemId: string;
  status: string;
  notificationSentAt: Date | null;
  scheduledDate: Date | null;
  releasedAt: Date | null;
  releasedByName: string | null;
  releasedByOrg?: string | null;
  releaseMethod?: string | null;
  releaseTokens?: Array<{
    recipientEmail: string;
    usedAt: Date | null;
  }>;
  releaseNotes: string | null;
  createdAt: Date;
};

export type HoldPointListLot = {
  id: string;
  lotNumber: string;
  createdAt: Date;
  itpInstance: {
    templateSnapshot?: string | null;
    template: {
      checklistItems: HoldPointListChecklistItem[];
    } | null;
    completions: HoldPointListCompletion[];
  } | null;
  holdPoints: HoldPointListPersistedHoldPoint[];
};

export function buildHoldPointListResponse<TPagination>(
  holdPoints: HoldPointListItem[],
  pagination: TPagination,
) {
  return {
    holdPoints,
    pagination,
  };
}

export function buildEmptyHoldPointListResponse() {
  return { holdPoints: [] };
}

// Build the sorted hold-point list from the loaded lots. One item per hold-point
// checklist item: the persisted HoldPoint row when present, otherwise a virtual
// entry keyed `virtual-${lot.id}-${item.id}`. Sorted by lot number then sequence.
export function buildHoldPointListItems(lots: HoldPointListLot[]): HoldPointListItem[] {
  const holdPoints: HoldPointListItem[] = [];

  for (const lot of lots) {
    if (!lot.itpInstance) continue;

    const checklistItems = getHoldPointChecklistItemsForInstance(lot.itpInstance);

    for (const item of checklistItems) {
      if (!isReleaseGatedChecklistItem(item)) continue;

      // Find existing hold point record or create virtual one
      const existingHP = lot.holdPoints.find((hp) => hp.itpChecklistItemId === item.id);

      // Find the completion status for this item
      const completion = lot.itpInstance.completions.find((c) => c.checklistItemId === item.id);
      const precedingItems = getPrecedingChecklistItems(checklistItems, item.sequenceNumber);
      const prerequisites = buildHoldPointPrerequisites(
        precedingItems,
        lot.itpInstance.completions,
      );
      const incompletePrerequisiteCount = getIncompletePrerequisites(prerequisites).length;

      holdPoints.push({
        id: existingHP?.id || `virtual-${lot.id}-${item.id}`,
        lotId: lot.id,
        lotNumber: lot.lotNumber,
        itpChecklistItemId: item.id,
        description: item.description,
        pointType: item.pointType,
        status: existingHP?.status || 'pending',
        notificationSentAt: existingHP?.notificationSentAt,
        scheduledDate: existingHP?.scheduledDate,
        releasedAt: existingHP?.releasedAt,
        releasedByName: existingHP?.releasedByName,
        releasedByOrg: existingHP?.releasedByOrg,
        releaseMethod: existingHP?.releaseMethod,
        releaseRecipientEmail:
          existingHP?.releaseTokens?.find((token) => token.usedAt)?.recipientEmail ?? null,
        releaseNotes: existingHP?.releaseNotes,
        sequenceNumber: item.sequenceNumber,
        isCompleted: completion?.status === 'completed',
        isVerified: completion?.verificationStatus === 'verified',
        canRequestRelease: incompletePrerequisiteCount === 0,
        incompletePrerequisiteCount,
        createdAt: existingHP?.createdAt || lot.createdAt,
      });
    }
  }

  // Sort by lot number, then sequence number
  holdPoints.sort((a, b) => {
    if (a.lotNumber !== b.lotNumber) return a.lotNumber.localeCompare(b.lotNumber);
    return a.sequenceNumber - b.sequenceNumber;
  });

  return holdPoints;
}
