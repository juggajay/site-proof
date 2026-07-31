/**
 * Wave C5-b — the register's honesty rules, tested without a table.
 *
 * The three that matter: the docket filter reaches the SERVER, changing a
 * filter drops the offset, and the CSV says what it actually contains.
 */
import { describe, expect, it } from 'vitest';

import {
  buildDeliveryCsvRows,
  buildDeliveryRegisterPath,
  EMPTY_DELIVERY_FILTERS,
  formatDeliveryQuantity,
  hasActiveDeliveryFilters,
  readFiltersFromParams,
  readOffsetFromParams,
  writeFiltersToParams,
  type DeliveryRow,
} from './deliveryRegisterData';

function makeDelivery(overrides: Partial<DeliveryRow> = {}): DeliveryRow {
  return {
    id: 'del-1',
    diaryId: 'diary-1',
    description: '32 MPa concrete',
    supplier: 'Boral Concrete',
    docketNumber: 'BCB-884213',
    quantity: '12.5',
    unit: 'm3',
    lotId: 'lot-1',
    batchRef: 'MIX-32-14',
    docketDocumentId: 'doc-1',
    lot: { id: 'lot-1', lotNumber: 'LOT-014' },
    docketDocument: { id: 'doc-1', filename: 'BCB-884213.pdf', mimeType: 'application/pdf' },
    diary: {
      id: 'diary-1',
      date: '2026-07-28T00:00:00.000Z',
      projectId: 'p1',
      status: 'submitted',
    },
    ...overrides,
  };
}

describe('buildDeliveryRegisterPath', () => {
  it('sends the docket filter to the server rather than filtering the page', () => {
    const path = buildDeliveryRegisterPath(
      'p1',
      { ...EMPTY_DELIVERY_FILTERS, docket: 'not_filed' },
      0,
    );
    expect(path).toContain('docket=not_filed');
  });

  it('carries every filter plus the page bounds', () => {
    const path = buildDeliveryRegisterPath(
      'p1',
      {
        supplier: 'Boral',
        lotId: 'lot-1',
        link: 'unlinked',
        docket: 'filed',
        from: '2026-07-01',
        to: '2026-07-31',
      },
      50,
    );

    const query = new URLSearchParams(path.split('?')[1]);
    expect(query.get('supplier')).toBe('Boral');
    expect(query.get('lotId')).toBe('lot-1');
    expect(query.get('linked')).toBe('unlinked');
    expect(query.get('docket')).toBe('filed');
    expect(query.get('from')).toBe('2026-07-01');
    expect(query.get('to')).toBe('2026-07-31');
    expect(query.get('limit')).toBe('50');
    expect(query.get('offset')).toBe('50');
  });

  it('omits filters that are not set, so the default view is the whole register', () => {
    const path = buildDeliveryRegisterPath('p1', EMPTY_DELIVERY_FILTERS, 0);
    expect(path).not.toContain('docket=');
    expect(path).not.toContain('linked=');
    expect(path).not.toContain('offset=');
  });
});

describe('filters in the URL', () => {
  it('round-trips through the address bar', () => {
    const params = writeFiltersToParams(
      new URLSearchParams(),
      { ...EMPTY_DELIVERY_FILTERS, supplier: 'Boral', docket: 'not_filed' },
      100,
    );

    expect(readFiltersFromParams(params)).toMatchObject({ supplier: 'Boral', docket: 'not_filed' });
    expect(readOffsetFromParams(params)).toBe(100);
  });

  it('drops the offset when the caller resets it on a filter change', () => {
    const paged = writeFiltersToParams(new URLSearchParams(), EMPTY_DELIVERY_FILTERS, 100);
    expect(paged.get('offset')).toBe('100');

    const refiltered = writeFiltersToParams(
      paged,
      { ...EMPTY_DELIVERY_FILTERS, docket: 'not_filed' },
      0,
    );
    expect(refiltered.has('offset')).toBe(false);
  });

  it('leaves nothing behind when the filters are cleared', () => {
    const filtered = writeFiltersToParams(
      new URLSearchParams(),
      { ...EMPTY_DELIVERY_FILTERS, supplier: 'Boral', link: 'unlinked' },
      0,
    );
    const cleared = writeFiltersToParams(filtered, EMPTY_DELIVERY_FILTERS, 0);

    expect(cleared.toString()).toBe('');
    expect(hasActiveDeliveryFilters(readFiltersFromParams(cleared))).toBe(false);
  });

  it('ignores a junk offset instead of paging into nowhere', () => {
    expect(readOffsetFromParams(new URLSearchParams('offset=-5'))).toBe(0);
    expect(readOffsetFromParams(new URLSearchParams('offset=banana'))).toBe(0);
  });

  it('keeps unrelated query params (deep links) intact', () => {
    const params = writeFiltersToParams(
      new URLSearchParams('highlight=del-9'),
      EMPTY_DELIVERY_FILTERS,
      0,
    );
    expect(params.get('highlight')).toBe('del-9');
  });
});

describe('buildDeliveryCsvRows', () => {
  it('says a docket is not filed rather than leaving the cell blank', () => {
    const rows = buildDeliveryCsvRows([
      makeDelivery(),
      makeDelivery({ id: 'del-2', docketDocumentId: null, docketDocument: null, lot: null }),
    ]);

    expect(rows[0]).toContain('Docket');
    expect(rows[1]).toEqual([
      '2026-07-28',
      '32 MPa concrete',
      'Boral Concrete',
      '12.5 m3',
      'LOT-014',
      'MIX-32-14',
      'BCB-884213.pdf',
    ]);
    expect(rows[2][6]).toBe('Not filed in CIVOS');
    expect(rows[2][4]).toBe('');
  });
});

describe('formatDeliveryQuantity', () => {
  it('joins the number and the unit, and survives either being absent', () => {
    expect(formatDeliveryQuantity(makeDelivery())).toBe('12.5 m3');
    expect(formatDeliveryQuantity(makeDelivery({ unit: null }))).toBe('12.5');
    expect(formatDeliveryQuantity(makeDelivery({ quantity: null, unit: null }))).toBe('');
  });
});
