// Wave C5.1 §4.4 / §4.6 — the delivery register's one readiness contribution.
//
// `[C5S-B5]` is a blocker, not a default: C5 adds NO member to
// `HANDOVER_BLOCKING_REASON_CODES`, moves no lot to conformed and gates no
// claim. An unlinked delivery is a prompt to link it — through
// `PATCH /api/deliveries/:deliveryId/evidence`, which works on a delivery whose
// diary was submitted months ago — never a reason to refuse anything.

import type { EvidenceReadinessItem } from './core.js';

export function buildUnlinkedDeliveryItem(unlinkedCount: number): EvidenceReadinessItem | null {
  if (unlinkedCount <= 0) {
    return null;
  }

  return {
    code: 'delivery_not_lot_linked',
    severity: 'support',
    // Deliveries reuse the existing `diary` area rather than minting a second
    // one — they are diary rows, and that is where a user goes to find them.
    area: 'diary',
    title: 'Deliveries not linked to a lot',
    detail:
      unlinkedCount === 1
        ? '1 delivery is recorded without a lot. Link it so the lot answers what material went into it.'
        : `${unlinkedCount} deliveries are recorded without a lot. Link them so the lot answers what material went into it.`,
    blocksAction: false,
    actionLabel: 'Review deliveries',
    count: unlinkedCount,
  };
}
