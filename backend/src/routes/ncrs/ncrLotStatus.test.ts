import { describe, expect, it } from 'vitest';

import {
  assertNcrLinkableLots,
  getLotStatusAfterNcrClosure,
  isTerminalNcrLotStatus,
} from './ncrLotStatus.js';

describe('ncr lot status guards', () => {
  it('identifies terminal lot statuses that must not be reopened by NCR linkage', () => {
    expect(isTerminalNcrLotStatus('conformed')).toBe(true);
    expect(isTerminalNcrLotStatus('claimed')).toBe(true);
    expect(isTerminalNcrLotStatus('completed')).toBe(false);
    expect(isTerminalNcrLotStatus('ncr_raised')).toBe(false);
  });

  it('rejects linking NCRs to terminal lots', () => {
    expect(() =>
      assertNcrLinkableLots([
        { id: 'lot-1', lotNumber: 'LOT-001', status: 'conformed' },
        { id: 'lot-2', lotNumber: 'LOT-002', status: 'claimed' },
      ]),
    ).toThrow('Cannot link NCRs to conformed or claimed lots: LOT-001, LOT-002');
  });

  it('allows active closeout statuses to be linked to NCRs', () => {
    expect(() =>
      assertNcrLinkableLots([
        { id: 'lot-1', lotNumber: 'LOT-001', status: 'completed' },
        { id: 'lot-2', lotNumber: 'LOT-002', status: 'in_progress' },
      ]),
    ).not.toThrow();
  });

  it('only clears ncr_raised lots to in_progress when the final open NCR closes', () => {
    expect(getLotStatusAfterNcrClosure('ncr_raised')).toBe('in_progress');
    expect(getLotStatusAfterNcrClosure('conformed')).toBeNull();
    expect(getLotStatusAfterNcrClosure('claimed')).toBeNull();
    expect(getLotStatusAfterNcrClosure('completed')).toBeNull();
  });
});
