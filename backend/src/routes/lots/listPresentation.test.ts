import { describe, expect, it } from 'vitest';
import { presentLotList } from './listPresentation.js';

// Plain fixtures mirroring the GET /api/lots Prisma select shape (no DB needed).
const makeLot = (overrides: Record<string, unknown> = {}) => ({
  id: 'lot-1',
  lotNumber: 'LOT-001',
  budgetAmount: 1000,
  subcontractorAssignments: [
    { id: 'a1', subcontractorCompanyId: 'sub-A' },
    { id: 'a2', subcontractorCompanyId: 'sub-B' },
  ],
  ...overrides,
});

describe('presentLotList (pure)', () => {
  it('keeps budgetAmount when canViewBudgetAmount is true', () => {
    const [lot] = presentLotList([makeLot()], {
      canViewBudgetAmount: true,
      subcontractorCompanyId: null,
      includeITP: false,
    });
    expect(lot.budgetAmount).toBe(1000);
  });

  it('nulls budgetAmount when canViewBudgetAmount is false', () => {
    const [lot] = presentLotList([makeLot()], {
      canViewBudgetAmount: false,
      subcontractorCompanyId: null,
      includeITP: false,
    });
    expect(lot.budgetAmount).toBeNull();
  });

  it('returns all active assignments when no subcontractorCompanyId', () => {
    const [lot] = presentLotList([makeLot()], {
      canViewBudgetAmount: true,
      subcontractorCompanyId: null,
      includeITP: false,
    });
    expect(lot.subcontractorAssignments.map((a) => a.subcontractorCompanyId)).toEqual([
      'sub-A',
      'sub-B',
    ]);
  });

  it('filters assignments to the given subcontractorCompanyId', () => {
    const [lot] = presentLotList([makeLot()], {
      canViewBudgetAmount: true,
      subcontractorCompanyId: 'sub-B',
      includeITP: false,
    });
    expect(lot.subcontractorAssignments.map((a) => a.subcontractorCompanyId)).toEqual(['sub-B']);
  });

  it('includeITP true wraps a present itpInstance into itpInstances', () => {
    const itpInstance = { id: 'itp-1', templateId: 't-1', status: 'in_progress' };
    const [lot] = presentLotList([makeLot({ itpInstance })], {
      canViewBudgetAmount: true,
      subcontractorCompanyId: null,
      includeITP: true,
    });
    expect((lot as Record<string, unknown>).itpInstances).toEqual([itpInstance]);
  });

  it('includeITP true produces an empty itpInstances array when itpInstance is null', () => {
    const [lot] = presentLotList([makeLot({ itpInstance: null })], {
      canViewBudgetAmount: true,
      subcontractorCompanyId: null,
      includeITP: true,
    });
    expect((lot as Record<string, unknown>).itpInstances).toEqual([]);
  });

  it('includeITP false leaves the itpInstances compatibility key absent', () => {
    const [lot] = presentLotList([makeLot()], {
      canViewBudgetAmount: true,
      subcontractorCompanyId: null,
      includeITP: false,
    });
    expect('itpInstances' in lot).toBe(false);
  });

  it('preserves all other lot fields and their key order via the spread', () => {
    const [lot] = presentLotList([makeLot({ description: 'Bridge deck', status: 'open' })], {
      canViewBudgetAmount: false,
      subcontractorCompanyId: null,
      includeITP: false,
    });
    // Spread preserves untouched fields and the original insertion order;
    // re-assigned keys (budgetAmount) keep their original position.
    expect(Object.keys(lot)).toEqual([
      'id',
      'lotNumber',
      'budgetAmount',
      'subcontractorAssignments',
      'description',
      'status',
    ]);
    expect(lot.id).toBe('lot-1');
    expect((lot as Record<string, unknown>).description).toBe('Bridge deck');
  });
});
