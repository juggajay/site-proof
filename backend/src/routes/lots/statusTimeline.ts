/**
 * Pure audit-row → status-timeline derivation for the map time scrubber.
 *
 * The `GET /api/projects/:projectId/lots/status-timeline` route ships clean,
 * sorted status-change events per lot; the client replays them to colour the map
 * as of any past date. This module owns only the transformation (audit rows in,
 * events out) so it is unit-testable without a DB.
 *
 * Only these audit actions carry an authoritative lot-status transition in
 * `changes.status = { from, to }`. Other `entityType: 'lot'` rows (e.g. a
 * subcontractor-assignment status change) ALSO have a `changes.status` field —
 * they are excluded by matching the action, never by the field's presence.
 */

// Audit actions whose `changes.status` is a real lot-status transition.
const LOT_STATUS_ACTIONS = new Set(['lot_updated', 'lot_status_changed', 'lot_force_conformed']);

/**
 * F0.4b PR 5 collapsed claim create into ONE decision audit row, replacing the
 * per-lot `lot_status_changed` rows it used to emit for every lot the claim took
 * to 100%. The transition itself is unchanged, and the row still carries which
 * lots it was — as `changes.fullyClaimedLotIds` — so this reader expands that
 * array back into conformed -> claimed events rather than losing them.
 *
 * The array is the ONLY place the correlation survives, which is the point of
 * `[R3.1-R4]`: one decision, one row, membership carried explicitly.
 */
export const CLAIM_INCLUSION_ACTION = 'claim_created';

export interface AuditRowForTimeline {
  /** lotId — or, for `claim_created`, the ProgressClaim id. */
  entityId: string;
  action: string;
  changes: string | null; // JSON string
  createdAt: Date;
}

export interface LotStatusEvent {
  at: string; // ISO instant
  from: string | null;
  to: string;
}

/** One event and the lot it belongs to. */
type AttributedEvent = [lotId: string, event: LotStatusEvent];

/** `null` for a missing or unparseable payload — never a throw. */
function parseChanges(changes: string | null): Record<string, unknown> | null {
  if (!changes) return null;
  try {
    const parsed: unknown = JSON.parse(changes);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** The single transition a lot-status row carries, in `changes.status`. */
function lotStatusRowEvents(
  row: AuditRowForTimeline,
  changes: Record<string, unknown>,
): AttributedEvent[] {
  const status = changes.status;
  if (!status || typeof status !== 'object') return [];
  const to = (status as { to?: unknown }).to;
  if (typeof to !== 'string') return [];
  const fromRaw = (status as { from?: unknown }).from;
  return [
    [
      row.entityId,
      { at: row.createdAt.toISOString(), from: typeof fromRaw === 'string' ? fromRaw : null, to },
    ],
  ];
}

/**
 * conformed -> claimed for every lot the claim took to 100%. The row's own
 * `entityId` is the CLAIM, so the lots come from `changes.fullyClaimedLotIds`;
 * a claim that completed no lot legitimately has none.
 */
function claimInclusionRowEvents(
  row: AuditRowForTimeline,
  changes: Record<string, unknown>,
): AttributedEvent[] {
  const lotIds = changes.fullyClaimedLotIds;
  if (!Array.isArray(lotIds)) return [];
  const at = row.createdAt.toISOString();
  return lotIds
    .filter((lotId): lotId is string => typeof lotId === 'string')
    .map((lotId) => [lotId, { at, from: 'conformed', to: 'claimed' }]);
}

function eventsFromRow(row: AuditRowForTimeline): AttributedEvent[] {
  const isClaimInclusion = row.action === CLAIM_INCLUSION_ACTION;
  if (!isClaimInclusion && !LOT_STATUS_ACTIONS.has(row.action)) return [];

  const changes = parseChanges(row.changes);
  if (!changes) return [];

  return isClaimInclusion
    ? claimInclusionRowEvents(row, changes)
    : lotStatusRowEvents(row, changes);
}

/**
 * Group status-change events by lotId, sorted ascending by time. Rows with a
 * non-status action, unparseable `changes`, or a missing/invalid `status.to`
 * are skipped defensively (a malformed audit row must not break the timeline).
 */
export function lotStatusEventsFromAudit(
  rows: AuditRowForTimeline[],
): Map<string, LotStatusEvent[]> {
  const byLot = new Map<string, LotStatusEvent[]>();

  for (const row of rows) {
    for (const [lotId, event] of eventsFromRow(row)) {
      const list = byLot.get(lotId) ?? [];
      list.push(event);
      byLot.set(lotId, list);
    }
  }

  for (const list of byLot.values()) {
    list.sort((a, b) => a.at.localeCompare(b.at));
  }
  return byLot;
}

export interface LotTimeline {
  lotId: string;
  createdAt: string; // ISO
  currentStatus: string;
  events: LotStatusEvent[];
}

/**
 * Assemble the per-lot timeline payload and the earliest reachable instant
 * (min of every lot's createdAt and every event time). `earliest` is null when
 * there are no lots.
 */
export function buildStatusTimeline(
  lots: { id: string; status: string; createdAt: Date }[],
  eventsByLot: Map<string, LotStatusEvent[]>,
): { earliest: string | null; lots: LotTimeline[] } {
  let earliest: string | null = null;
  const consider = (iso: string) => {
    if (earliest === null || iso < earliest) earliest = iso;
  };

  const out: LotTimeline[] = lots.map((lot) => {
    const createdAt = lot.createdAt.toISOString();
    consider(createdAt);
    const events = eventsByLot.get(lot.id) ?? [];
    for (const ev of events) consider(ev.at);
    return { lotId: lot.id, createdAt, currentStatus: lot.status, events };
  });

  return { earliest, lots: out };
}
