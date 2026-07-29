import { describe, expect, it } from 'vitest';
import {
  calculatePendingDocketStats,
  calculateItpVerificationRate,
  buildItpInspectionItems,
  buildOpenNcrItems,
} from './roleDashboards.js';

describe('calculatePendingDocketStats', () => {
  it('uses docket entry hours instead of submitted cost totals', () => {
    const stats = calculatePendingDocketStats([
      {
        totalLabourSubmitted: 800,
        totalPlantSubmitted: 200,
        labourEntries: [{ submittedHours: 8 }],
        plantEntries: [{ hoursOperated: 2 }],
      },
    ]);

    expect(stats).toEqual({
      count: 1,
      totalLabourHours: 8,
      totalPlantHours: 2,
    });
  });
});

describe('calculateItpVerificationRate', () => {
  it('returns the verified share of recorded completions as a percentage', () => {
    expect(calculateItpVerificationRate(3, 4)).toBe(75);
  });

  it('returns 100 when there are no recorded completions yet', () => {
    expect(calculateItpVerificationRate(0, 0)).toBe(100);
  });

  it('never exceeds 100 even if the numerator outruns the denominator', () => {
    // Guards the old bug where per-lot verified completions were divided by a
    // per-template item count, producing rates above 100%.
    expect(calculateItpVerificationRate(12, 8)).toBe(100);
  });

  it('never goes below 0', () => {
    expect(calculateItpVerificationRate(-1, 4)).toBe(0);
  });
});

describe('buildItpInspectionItems', () => {
  it('maps an outstanding ITP completion to an inspection item linked to the lot ITP tab', () => {
    const items = buildItpInspectionItems(
      [
        {
          id: 'completion-1',
          checklistItem: { description: 'Compaction test' },
          itpInstance: { lot: { id: 'lot-9', lotNumber: 'L-09' } },
        },
      ],
      'project-1',
    );

    expect(items).toEqual([
      {
        id: 'completion-1',
        type: 'ITP',
        description: 'Compaction test',
        lotNumber: 'L-09',
        link: '/projects/project-1/lots/lot-9?tab=itp',
      },
    ]);
  });

  it('falls back to the project ITP link and Unknown lot when the lot is missing', () => {
    const items = buildItpInspectionItems(
      [{ id: 'c2', checklistItem: { description: 'Levels' }, itpInstance: { lot: null } }],
      'project-1',
    );

    expect(items[0].lotNumber).toBe('Unknown');
    expect(items[0].link).toBe('/projects/project-1/itp');
  });
});

// L11 — `daysOpen` was computed by a byte-identical inline expression here and in
// `roleDashboardResponses.ts:259`, neither routed through the shared day helper.
// These pins were written against the ORIGINAL expression
// (`Math.floor((now - createdAt) / 86_400_000)`) and survive the swap onto
// `daysOverdue()` unchanged.
describe('buildOpenNcrItems day count (L11 characterization)', () => {
  const NOW = new Date('2026-06-06T09:30:00.000Z');
  const ncr = (createdAt: string, dueDate: string | null = null) => ({
    id: 'ncr-1',
    ncrNumber: 'NCR-001',
    description: 'Fix edge drain',
    category: 'major',
    status: 'open',
    dueDate: dueDate ? new Date(dueDate) : null,
    createdAt: new Date(createdAt),
  });

  const daysOpenFor = (createdAt: string) =>
    buildOpenNcrItems([ncr(createdAt)], 'project-1', NOW)[0].daysOpen;

  it('floors partial days rather than rounding them up', () => {
    expect(daysOpenFor('2026-06-06T09:30:00.000Z')).toBe(0); // same instant
    expect(daysOpenFor('2026-06-05T09:30:00.001Z')).toBe(0); // one ms short of a day
    expect(daysOpenFor('2026-06-05T09:30:00.000Z')).toBe(1); // exactly one day
    expect(daysOpenFor('2026-05-30T09:30:00.000Z')).toBe(7);
    expect(daysOpenFor('2026-06-04T00:00:00.000Z')).toBe(2); // the sibling site's fixture
  });

  it('carries the rest of the row through unchanged', () => {
    expect(
      buildOpenNcrItems([ncr('2026-06-04T00:00:00.000Z', '2026-06-10T00:00:00.000Z')], 'p9', NOW),
    ).toEqual([
      {
        id: 'ncr-1',
        ncrNumber: 'NCR-001',
        description: 'Fix edge drain',
        category: 'major',
        status: 'open',
        dueDate: '2026-06-10T00:00:00.000Z',
        daysOpen: 2,
        link: '/projects/p9/ncr?ncr=ncr-1',
      },
    ]);
  });

  it('leaves a null due date null', () => {
    expect(buildOpenNcrItems([ncr('2026-06-04T00:00:00.000Z')], 'p9', NOW)[0].dueDate).toBeNull();
  });
});
