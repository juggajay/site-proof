import { describe, expect, it } from 'vitest';
import { formatHoldPointStatusLabel } from '@/lib/statusLabels';
import { normalizeSubcontractorHoldPoint } from './subcontractorHoldPointData';

describe('subcontractor hold-point lifecycle projection', () => {
  it('preserves refused and conditional latest-round labels without exposing extra detail', () => {
    const refused = normalizeSubcontractorHoldPoint({
      id: 'hp-1',
      lotId: 'lot-1',
      lotNumber: 'LOT-001',
      description: 'Proof roll',
      status: 'pending',
      latestRound: {
        outcome: 'rejected',
        decidedAt: '2026-08-07T00:00:00.000Z',
        decisionReason: null,
        ncrId: 'ncr-1',
        ncrNumber: 'NCR-0042',
        ncrStatus: 'open',
        openConditionCount: 0,
      },
    });
    const conditional = normalizeSubcontractorHoldPoint({
      id: 'hp-2',
      lotId: 'lot-1',
      lotNumber: 'LOT-001',
      description: 'Level survey',
      status: 'released',
      latestRound: {
        outcome: 'released_with_conditions',
        decidedAt: '2026-08-07T00:00:00.000Z',
        decisionReason: null,
        ncrId: null,
        ncrNumber: null,
        ncrStatus: null,
        openConditionCount: 2,
      },
    });

    expect(formatHoldPointStatusLabel(refused)).toBe('Release refused — NCR-0042 open');
    expect(formatHoldPointStatusLabel(conditional)).toBe('Released — 2 conditions open');
  });
});
