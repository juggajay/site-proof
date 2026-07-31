import { describe, expect, it } from 'vitest';

import { formatDeliveryLabel } from './linkedDelivery';

const base = {
  id: 'd1',
  description: '32 MPa concrete',
  supplier: 'Boral',
  docketNumber: 'DK-1180',
  diary: { id: 'diary-1', date: '2026-08-11T00:00:00.000Z' },
};

describe('formatDeliveryLabel', () => {
  it('reads supplier, material, docket and date', () => {
    expect(formatDeliveryLabel(base)).toBe('Boral — 32 MPa concrete · docket DK-1180 · 11/08/2026');
  });

  it('drops the supplier and docket when the delivery has neither', () => {
    expect(formatDeliveryLabel({ ...base, supplier: null, docketNumber: null })).toBe(
      '32 MPa concrete · 11/08/2026',
    );
  });

  it('pins the date to the app timezone, not the reader clock', () => {
    // UTC midnight is still the 11th in AEST; a reader-local render would show
    // the 10th west of Greenwich.
    expect(formatDeliveryLabel(base)).toContain('11/08/2026');
  });
});
