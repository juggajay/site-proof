import { describe, expect, it } from 'vitest';

import {
  buildClearedFilterValues,
  buildInitialFilterValues,
  countActiveFilters,
} from './filterSheetHelpers';
import type { FilterConfig, FilterValues } from './FilterBottomSheet';

const filters: FilterConfig[] = [
  {
    type: 'select',
    id: 'status',
    label: 'Status',
    options: [{ value: 'open', label: 'Open' }],
    value: null,
  },
  {
    type: 'multiselect',
    id: 'types',
    label: 'Types',
    options: [{ value: 'ncr', label: 'NCR' }],
    value: [],
  },
  {
    type: 'range',
    id: 'cost',
    label: 'Cost',
    min: 0,
    max: 100,
    value: { min: 0, max: 100 },
  },
  {
    type: 'date',
    id: 'submitted',
    label: 'Submitted',
    value: { start: null, end: null },
  },
];

describe('filterSheetHelpers', () => {
  it('builds default and provided initial values', () => {
    expect(buildInitialFilterValues(filters)).toEqual({
      status: null,
      types: [],
      cost: { min: 0, max: 100 },
      submitted: { start: null, end: null },
    });

    const provided: FilterValues = { status: 'open' };
    expect(buildInitialFilterValues(filters, provided)).toBe(provided);
  });

  it('clears each filter type to the existing default state', () => {
    expect(buildClearedFilterValues(filters)).toEqual({
      status: null,
      types: [],
      cost: { min: 0, max: 100 },
      submitted: { start: null, end: null },
    });
  });

  it('counts active select, multiselect, range, and date filters', () => {
    expect(
      countActiveFilters(filters, {
        status: 'open',
        types: ['ncr'],
        cost: { min: 25, max: 100 },
        submitted: { start: '2026-06-01', end: null },
      }),
    ).toBe(4);

    expect(
      countActiveFilters(filters, {
        status: '',
        types: [],
        cost: { min: 0, max: 100 },
        submitted: { start: null, end: null },
      }),
    ).toBe(0);
  });
});
