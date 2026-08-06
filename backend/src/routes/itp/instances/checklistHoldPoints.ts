// Benchmark T1 — the ITP checklist row needs more than "released or not".
// A foreman standing at a hold point has to be able to tell, from the row,
// whether someone already asked for the release, who it went to and when it is
// due. This shapes the lot's hold points into a per-checklist-item payload the
// lot ITP tab renders directly.
//
// Only the INTERNAL (head-contractor) view gets this block: it carries the
// authority's email address, which the subcontractor portal view must not see.
// The released-attribution block on each completion (`holdPointRelease`) is
// unchanged and still served to both views.

export interface ChecklistHoldPointSource {
  id: string;
  itpChecklistItemId: string;
  status: string;
  scheduledDate: Date | null;
  scheduledTime: string | null;
  notificationSentAt: Date | null;
  notificationSentTo: string | null;
  releasedByName: string | null;
  releasedByOrg: string | null;
  releaseMethod: string | null;
  releasedAt: Date | null;
  releaseNotes: string | null;
}

export interface ChecklistHoldPointState {
  id: string;
  itpChecklistItemId: string;
  status: string;
  scheduledDate: Date | null;
  scheduledTime: string | null;
  notificationSentAt: Date | null;
  notificationSentTo: string | null;
  releasedByName: string | null;
  releasedByOrg: string | null;
  releaseMethod: string | null;
  releasedAt: Date | null;
  releaseNotes: string | null;
}

/**
 * One entry per checklist item that has a hold point, restricted to the items
 * this viewer can already see. When several hold points share a checklist item
 * (legacy rows predating the unique constraint), the last one in `holdPoints`
 * wins — callers pass them oldest-first, so that is the most recent.
 */
export function buildChecklistHoldPointStates(
  holdPoints: ChecklistHoldPointSource[],
  visibleChecklistItemIds: Set<string>,
): ChecklistHoldPointState[] {
  const byItem = new Map<string, ChecklistHoldPointState>();

  for (const holdPoint of holdPoints) {
    if (!visibleChecklistItemIds.has(holdPoint.itpChecklistItemId)) {
      continue;
    }

    byItem.set(holdPoint.itpChecklistItemId, {
      id: holdPoint.id,
      itpChecklistItemId: holdPoint.itpChecklistItemId,
      status: holdPoint.status,
      scheduledDate: holdPoint.scheduledDate,
      scheduledTime: holdPoint.scheduledTime,
      notificationSentAt: holdPoint.notificationSentAt,
      notificationSentTo: holdPoint.notificationSentTo,
      releasedByName: holdPoint.releasedByName,
      releasedByOrg: holdPoint.releasedByOrg,
      releaseMethod: holdPoint.releaseMethod,
      releasedAt: holdPoint.releasedAt,
      releaseNotes: holdPoint.releaseNotes,
    });
  }

  return Array.from(byItem.values());
}
