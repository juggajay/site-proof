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

export interface AuditRowForTimeline {
  entityId: string; // lotId
  action: string;
  changes: string | null; // JSON string
  createdAt: Date;
}

export interface LotStatusEvent {
  at: string; // ISO instant
  from: string | null;
  to: string;
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
    if (!LOT_STATUS_ACTIONS.has(row.action)) continue;
    if (!row.changes) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(row.changes);
    } catch {
      continue;
    }

    const status = (parsed as { status?: unknown })?.status;
    if (!status || typeof status !== 'object') continue;
    const to = (status as { to?: unknown }).to;
    if (typeof to !== 'string') continue;
    const fromRaw = (status as { from?: unknown }).from;
    const from = typeof fromRaw === 'string' ? fromRaw : null;

    const list = byLot.get(row.entityId) ?? [];
    list.push({ at: row.createdAt.toISOString(), from, to });
    byLot.set(row.entityId, list);
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
