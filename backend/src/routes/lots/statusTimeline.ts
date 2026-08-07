/** Pure response assembly for the ledger-backed map time scrubber. */

export interface LotStatusEvent {
  at: string; // ISO instant
  from: string | null;
  to: string;
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
