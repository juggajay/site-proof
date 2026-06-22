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
      subcontractorCompanyIds: null,
      includeITP: false,
    });
    expect(lot.budgetAmount).toBe(1000);
  });

  it('nulls budgetAmount when canViewBudgetAmount is false', () => {
    const [lot] = presentLotList([makeLot()], {
      canViewBudgetAmount: false,
      subcontractorCompanyIds: null,
      includeITP: false,
    });
    expect(lot.budgetAmount).toBeNull();
  });

  it('returns all active assignments when no subcontractorCompanyId', () => {
    const [lot] = presentLotList([makeLot()], {
      canViewBudgetAmount: true,
      subcontractorCompanyIds: null,
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
      subcontractorCompanyIds: ['sub-B'],
      includeITP: false,
    });
    expect(lot.subcontractorAssignments.map((a) => a.subcontractorCompanyId)).toEqual(['sub-B']);
  });

  it('hides legacy assigned subcontractor fields when they belong to a different subcontractor', () => {
    const [lot] = presentLotList(
      [
        makeLot({
          assignedSubcontractorId: 'sub-A',
          assignedSubcontractor: { companyName: 'Alpha Civil' },
        }),
      ],
      {
        canViewBudgetAmount: true,
        subcontractorCompanyIds: ['sub-B'],
        includeITP: false,
      },
    );

    expect((lot as Record<string, unknown>).assignedSubcontractorId).toBeNull();
    expect((lot as Record<string, unknown>).assignedSubcontractor).toBeNull();
  });

  it('includeITP true wraps a present itpInstance into itpInstances', () => {
    const itpInstance = { id: 'itp-1', templateId: 't-1', status: 'in_progress' };
    const [lot] = presentLotList([makeLot({ itpInstance })], {
      canViewBudgetAmount: true,
      subcontractorCompanyIds: null,
      includeITP: true,
    });
    expect((lot as Record<string, unknown>).itpInstances).toEqual([
      { ...itpInstance, completionPercentage: 0 },
    ]);
  });

  it('derives in_progress ITP status from completed checklist rows even when the stored instance status is stale', () => {
    const [lot] = presentLotList(
      [
        makeLot({
          itpInstance: {
            id: 'itp-1',
            templateId: 't-1',
            status: 'not_started',
            templateSnapshot: JSON.stringify({
              id: 't-1',
              name: 'Earthworks ITP',
              checklistItems: [{ id: 'item-1' }, { id: 'item-2' }],
            }),
            template: {
              id: 't-1',
              name: 'Earthworks ITP',
              activityType: 'earthworks',
              checklistItems: [{ id: 'live-item-ignored' }],
            },
            completions: [{ checklistItemId: 'item-1', status: 'completed' }],
          },
        }),
      ],
      {
        canViewBudgetAmount: true,
        subcontractorCompanyIds: null,
        includeITP: true,
      },
    );

    const [itp] = (lot as Record<string, unknown>).itpInstances as Record<string, unknown>[];
    expect(itp.status).toBe('in_progress');
    expect(itp.completionPercentage).toBe(50);
    expect('completions' in itp).toBe(false);
    expect('templateSnapshot' in itp).toBe(false);
    expect((itp.template as Record<string, unknown>).checklistItems).toBeUndefined();
  });

  it('derives completed ITP status when every checklist item is completed or N/A', () => {
    const [lot] = presentLotList(
      [
        makeLot({
          itpInstance: {
            id: 'itp-1',
            templateId: 't-1',
            status: 'not_started',
            template: {
              id: 't-1',
              name: 'Earthworks ITP',
              activityType: 'earthworks',
              checklistItems: [{ id: 'item-1' }, { id: 'item-2' }],
            },
            completions: [
              { checklistItemId: 'item-1', status: 'completed' },
              { checklistItemId: 'item-2', status: 'not_applicable' },
            ],
          },
        }),
      ],
      {
        canViewBudgetAmount: true,
        subcontractorCompanyIds: null,
        includeITP: true,
      },
    );

    const [itp] = (lot as Record<string, unknown>).itpInstances as Record<string, unknown>[];
    expect(itp.status).toBe('completed');
    expect(itp.completionPercentage).toBe(100);
  });

  it('treats failed ITP rows as started, but not complete', () => {
    const [lot] = presentLotList(
      [
        makeLot({
          itpInstance: {
            id: 'itp-1',
            templateId: 't-1',
            status: 'not_started',
            template: {
              id: 't-1',
              name: 'Earthworks ITP',
              activityType: 'earthworks',
              checklistItems: [{ id: 'item-1' }, { id: 'item-2' }],
            },
            completions: [{ checklistItemId: 'item-1', status: 'failed' }],
          },
        }),
      ],
      {
        canViewBudgetAmount: true,
        subcontractorCompanyIds: null,
        includeITP: true,
      },
    );

    const [itp] = (lot as Record<string, unknown>).itpInstances as Record<string, unknown>[];
    expect(itp.status).toBe('in_progress');
    expect(itp.completionPercentage).toBe(0);
  });

  it('preserves a completed legacy instance when checklist shape is unavailable', () => {
    const [lot] = presentLotList(
      [makeLot({ itpInstance: { id: 'itp-1', templateId: 't-1', status: 'completed' } })],
      {
        canViewBudgetAmount: true,
        subcontractorCompanyIds: null,
        includeITP: true,
      },
    );

    const [itp] = (lot as Record<string, unknown>).itpInstances as Record<string, unknown>[];
    expect(itp.status).toBe('completed');
    expect(itp.completionPercentage).toBe(100);
  });

  it('includeITP true produces an empty itpInstances array when itpInstance is null', () => {
    const [lot] = presentLotList([makeLot({ itpInstance: null })], {
      canViewBudgetAmount: true,
      subcontractorCompanyIds: null,
      includeITP: true,
    });
    expect((lot as Record<string, unknown>).itpInstances).toEqual([]);
  });

  it('includeITP false leaves the itpInstances compatibility key absent', () => {
    const [lot] = presentLotList([makeLot()], {
      canViewBudgetAmount: true,
      subcontractorCompanyIds: null,
      includeITP: false,
    });
    expect('itpInstances' in lot).toBe(false);
  });

  it('preserves all other lot fields and their key order via the spread', () => {
    const [lot] = presentLotList([makeLot({ description: 'Bridge deck', status: 'open' })], {
      canViewBudgetAmount: false,
      subcontractorCompanyIds: null,
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
