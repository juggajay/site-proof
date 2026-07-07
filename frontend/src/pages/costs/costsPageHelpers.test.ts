// Characterization tests for the CostsPage data/export helpers. These pin the
// exact AUD formatting, filter matching, totals, and CSV section
// order/labels/values the page shipped with, so the extraction (and any later
// "cleanup") cannot silently change the export output. Per house convention
// the dynamic bits are not asserted literally: the generated date row is
// matched by prefix (locale dates differ UTC vs Sydney) and the dated
// filename stays in the page with downloadCsv.
import { describe, expect, it } from 'vitest';

import {
  buildCostReportRows,
  createEmptyCostSummary,
  filterLotCosts,
  filterSubcontractorCosts,
  formatCurrency,
  sumSubcontractorCosts,
  type CostSummary,
  type LotCost,
  type SubcontractorCost,
} from './costsPageHelpers';

const subs: SubcontractorCost[] = [
  {
    id: 'sub-1',
    companyName: 'Ryox Carpentry',
    labourCost: 12000,
    plantCost: 3000,
    totalCost: 15000,
    approvedDockets: 4,
  },
  {
    id: 'sub-2',
    companyName: 'Apex Earthmoving',
    labourCost: 8000,
    plantCost: 9000,
    totalCost: 17000,
    approvedDockets: 3,
  },
];

const lots: LotCost[] = [
  {
    id: 'lot-1',
    lotNumber: 'LOT-001',
    activity: 'Earthworks',
    budgetAmount: 20000,
    actualCost: 18000,
    variance: 2000,
  },
  {
    id: 'lot-2',
    lotNumber: 'LOT-002',
    activity: 'Drainage',
    budgetAmount: 10000,
    actualCost: 10500,
    variance: -500,
  },
];

describe('formatCurrency', () => {
  it('formats australian dollars with cents', () => {
    expect(formatCurrency(1234)).toBe('$1,234.00');
  });

  it('formats negative variances with a leading minus', () => {
    expect(formatCurrency(-500)).toBe('-$500.00');
  });

  it('keeps fractional cents instead of rounding', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
  });
});

describe('createEmptyCostSummary', () => {
  it('returns the all-zero summary used when the server omits one', () => {
    expect(createEmptyCostSummary()).toEqual({
      totalLabourCost: 0,
      totalPlantCost: 0,
      totalCost: 0,
      budgetTotal: 0,
      budgetVariance: 0,
      approvedDockets: 0,
      pendingDockets: 0,
    });
  });
});

describe('filterSubcontractorCosts', () => {
  it('returns the same array reference when the search is empty', () => {
    expect(filterSubcontractorCosts(subs, '')).toBe(subs);
  });

  it('matches company names case-insensitively against the normalized search', () => {
    expect(filterSubcontractorCosts(subs, 'ryox')).toEqual([subs[0]]);
    expect(filterSubcontractorCosts(subs, 'earthmoving')).toEqual([subs[1]]);
    expect(filterSubcontractorCosts(subs, 'no-match')).toEqual([]);
  });
});

describe('filterLotCosts', () => {
  it('matches lot number or activity against the normalized search', () => {
    expect(filterLotCosts(lots, 'lot-001', false)).toEqual([lots[0]]);
    expect(filterLotCosts(lots, 'drainage', false)).toEqual([lots[1]]);
    expect(filterLotCosts(lots, '', false)).toEqual(lots);
  });

  it('keeps only over-budget lots (negative variance) when the flag is on', () => {
    expect(filterLotCosts(lots, '', true)).toEqual([lots[1]]);
  });

  it('combines search and over-budget filtering', () => {
    expect(filterLotCosts(lots, 'earthworks', true)).toEqual([]);
    expect(filterLotCosts(lots, 'lot-002', true)).toEqual([lots[1]]);
  });
});

describe('sumSubcontractorCosts', () => {
  it('sums labour, plant, total, and approved docket counts', () => {
    expect(sumSubcontractorCosts(subs)).toEqual({
      labourCost: 20000,
      plantCost: 12000,
      totalCost: 32000,
      approvedDockets: 7,
    });
  });

  it('returns zeros for an empty list', () => {
    expect(sumSubcontractorCosts([])).toEqual({
      labourCost: 0,
      plantCost: 0,
      totalCost: 0,
      approvedDockets: 0,
    });
  });
});

describe('buildCostReportRows', () => {
  const summary: CostSummary = {
    totalLabourCost: 20000,
    totalPlantCost: 12000,
    totalCost: 32000,
    budgetTotal: 30000,
    budgetVariance: -2000,
    approvedDockets: 7,
    pendingDockets: 2,
  };

  it('emits the report sections in order with the shipped labels and values', () => {
    const rows = buildCostReportRows(summary, [subs[0]], lots);

    expect(rows[0]).toEqual(['Project Cost Report']);
    expect(rows[1]).toHaveLength(1);
    expect(rows[1][0]).toMatch(/^Generated: /);
    expect(rows.slice(2)).toEqual([
      [],
      ['COST SUMMARY'],
      ['Metric', 'Value'],
      ['Total Cost', '$32,000.00'],
      ['Labour Cost', '$20,000.00'],
      ['Plant Cost', '$12,000.00'],
      ['Budget Total', '$30,000.00'],
      ['Budget Variance', '-$2,000.00'],
      ['Approved Dockets', '7'],
      ['Pending Dockets', '2'],
      [],
      ['COSTS BY SUBCONTRACTOR'],
      ['Subcontractor', 'Labour Cost', 'Plant Cost', 'Total Cost', 'Approved Dockets'],
      ['Ryox Carpentry', '$12,000.00', '$3,000.00', '$15,000.00', '4'],
      [],
      ['COSTS BY LOT'],
      ['Lot', 'Activity', 'Budget', 'Actual Cost', 'Variance'],
      ['LOT-001', 'Earthworks', '$20,000.00', '$18,000.00', '+$2,000.00'],
      ['LOT-002', 'Drainage', '$10,000.00', '$10,500.00', '-$500.00'],
    ]);
  });

  it('prefixes zero variance with + like any non-negative variance', () => {
    const rows = buildCostReportRows(summary, [], [{ ...lots[0], variance: 0 }]);

    expect(rows[rows.length - 1][4]).toBe('+$0.00');
  });

  it('keeps the section headers when the filtered lists are empty', () => {
    const rows = buildCostReportRows(summary, [], []);

    expect(rows).toContainEqual(['COSTS BY SUBCONTRACTOR']);
    expect(rows).toContainEqual(['COSTS BY LOT']);
    expect(rows[rows.length - 1]).toEqual(['Lot', 'Activity', 'Budget', 'Actual Cost', 'Variance']);
  });
});
