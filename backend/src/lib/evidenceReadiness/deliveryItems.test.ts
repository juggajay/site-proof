// Wave C5.1 — AT-177's contract half. `[C5S-B5]` is a blocker: C5 blocks no
// conformance, no claim, no hold-point release and no folio.

import { describe, it, expect } from 'vitest';

import { buildUnlinkedDeliveryItem } from './deliveryItems.js';
import {
  HANDOVER_BLOCKING_REASON_CODES,
  READINESS_REASON_CODES,
  REASON_CODE_PROVENANCE,
} from '../readiness/contracts/reasonCodes.js';

describe('buildUnlinkedDeliveryItem', () => {
  it('emits nothing when every delivery is linked', () => {
    expect(buildUnlinkedDeliveryItem(0)).toBeNull();
    expect(buildUnlinkedDeliveryItem(-1)).toBeNull();
  });

  it('emits a support item that blocks nothing', () => {
    const item = buildUnlinkedDeliveryItem(3);
    expect(item).toMatchObject({
      code: 'delivery_not_lot_linked',
      severity: 'support',
      area: 'diary',
      blocksAction: false,
      count: 3,
    });
    expect(item?.detail).toContain('3 deliveries');
  });

  it('reads as a singular sentence for one delivery', () => {
    expect(buildUnlinkedDeliveryItem(1)?.detail).toContain('1 delivery is');
  });

  it('is a registered code with provenance, and is NOT a handover blocker', () => {
    expect(READINESS_REASON_CODES).toContain('delivery_not_lot_linked');
    expect(REASON_CODE_PROVENANCE.delivery_not_lot_linked).toBeDefined();
    expect(HANDOVER_BLOCKING_REASON_CODES as readonly string[]).not.toContain(
      'delivery_not_lot_linked',
    );
  });
});
