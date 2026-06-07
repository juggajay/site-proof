/**
 * Reconstructs the "failed ITP item -> NCR" traceability link on the read path.
 *
 * When a checklist item is marked Failed, POST /api/itp/completions creates an NCR for
 * the item's lot and returns it as `completion.linkedNcr` in the create response only.
 * There is no NCR<->completion relation in the schema, so on the next page reload the
 * GET ITP instance endpoint had no way to re-attach that NCR and the "View NCR"
 * breadcrumb vanished. The only durable back-reference stored on the NCR is a marker
 * inside its free-text `rectificationNotes`.
 *
 * To make matching robust the failed-item creation writes a structured, machine-parseable
 * marker line in addition to the existing human-readable sentence:
 *
 *   [itp-item:<checklistItemId>]
 *
 * The marker contains the full checklist-item UUID bounded by `[itp-item:` and `]`, so
 * matching is exact (never a substring collision across items or lots). Legacy NCRs that
 * predate the marker still carry the human-readable `(Item ID: <checklistItemId>)` form,
 * which we also match for backwards compatibility.
 *
 * Reconstruction is batched: one lot-scoped `findMany` returns every NCR linked to the
 * lot, and each completion's checklist-item id is matched against the markers in memory.
 * That is one extra query per instance GET (acceptable), never one query per completion.
 */

/** Structured marker line written into NCR.rectificationNotes for a failed ITP item. */
export function buildChecklistItemNcrMarker(checklistItemId: string): string {
  return `[itp-item:${checklistItemId}]`;
}

/**
 * True if `rectificationNotes` references the exact checklist-item id, via either the
 * structured marker (`[itp-item:<id>]`) or the legacy human-readable form
 * (`(Item ID: <id>)`). Both are exact, full-uuid matches so a different item's id can
 * never match by accident.
 */
export function rectificationNotesReferencesChecklistItem(
  rectificationNotes: string | null | undefined,
  checklistItemId: string,
): boolean {
  if (!rectificationNotes || !checklistItemId) {
    return false;
  }
  return (
    rectificationNotes.includes(buildChecklistItemNcrMarker(checklistItemId)) ||
    rectificationNotes.includes(`(Item ID: ${checklistItemId})`)
  );
}

/** Minimal NCR shape needed to render the "View NCR" breadcrumb. */
export interface LinkedNcr {
  id: string;
  ncrNumber: string;
}

/** Structural slice of the Prisma client used by the reconstruction helper. */
export interface NcrLinkClient {
  nCR: {
    findMany: (args: {
      where: { ncrLots: { some: { lotId: string } } };
      select: { id: true; ncrNumber: true; rectificationNotes: true; raisedAt: true };
      orderBy: { raisedAt: 'desc' };
    }) => Promise<
      Array<{
        id: string;
        ncrNumber: string;
        rectificationNotes: string | null;
        raisedAt: Date;
      }>
    >;
  };
}

/**
 * Returns a map from checklist-item id to its linked NCR for the failed completions of a
 * single lot. The lot's NCRs are fetched once (newest first), then each requested
 * checklist-item id is matched against the NCR markers. When multiple NCRs reference the
 * same item the newest is returned. Item ids with no matching NCR are simply absent from
 * the map.
 */
export async function findLinkedNcrsForChecklistItems(
  client: NcrLinkClient,
  lotId: string,
  checklistItemIds: string[],
): Promise<Map<string, LinkedNcr>> {
  const result = new Map<string, LinkedNcr>();
  const uniqueItemIds = [...new Set(checklistItemIds.filter(Boolean))];
  if (!lotId || uniqueItemIds.length === 0) {
    return result;
  }

  const ncrs = await client.nCR.findMany({
    where: { ncrLots: { some: { lotId } } },
    select: { id: true, ncrNumber: true, rectificationNotes: true, raisedAt: true },
    orderBy: { raisedAt: 'desc' },
  });

  // NCRs are newest-first; the first match for an item wins, so later (older) NCRs that
  // reference the same item do not overwrite it.
  for (const ncr of ncrs) {
    for (const checklistItemId of uniqueItemIds) {
      if (result.has(checklistItemId)) {
        continue;
      }
      if (rectificationNotesReferencesChecklistItem(ncr.rectificationNotes, checklistItemId)) {
        result.set(checklistItemId, { id: ncr.id, ncrNumber: ncr.ncrNumber });
      }
    }
  }

  return result;
}
