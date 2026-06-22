import { describe, expect, it } from 'vitest';
import { shapeLotDetailResponse } from './detailPresentation.js';

// Plain fixture mirroring the GET /api/lots/:id Prisma select shape (no DB).
const makeLot = (overrides: Record<string, unknown> = {}) => ({
  id: 'lot-1',
  lotNumber: 'LOT-001',
  status: 'open',
  projectId: 'proj-1',
  budgetAmount: 1250,
  assignedSubcontractorId: 'sub-A' as string | null,
  assignedSubcontractor: { id: 'sub-A', companyName: 'Acme' } as {
    id: string;
    companyName: string;
  } | null,
  subcontractorAssignments: [
    { id: 'asg-1', subcontractorCompanyId: 'sub-A', canCompleteITP: true },
    { id: 'asg-2', subcontractorCompanyId: 'sub-B', canCompleteITP: false },
  ],
  ...overrides,
});

describe('shapeLotDetailResponse (pure)', () => {
  it('head contractor: keeps edit contract fields, all assignments, and assignedSubcontractor', () => {
    const result = shapeLotDetailResponse(makeLot(), {
      isSubcontractor: false,
      subcontractorCompanyIds: null,
      canViewBudgetAmount: true,
    });

    expect(result.projectId).toBe('proj-1');
    expect(result.assignedSubcontractorId).toBe('sub-A');
    expect(result.budgetAmount).toBe(1250);
    expect(result.subcontractorAssignments.map((a) => a.subcontractorCompanyId)).toEqual([
      'sub-A',
      'sub-B',
    ]);
    expect(result.assignedSubcontractor).toEqual({ id: 'sub-A', companyName: 'Acme' });
    // Untouched fields survive.
    expect(result.id).toBe('lot-1');
    expect((result as Record<string, unknown>).lotNumber).toBe('LOT-001');
  });

  it('subcontractor: filters assignments to the matching company', () => {
    const result = shapeLotDetailResponse(makeLot(), {
      isSubcontractor: true,
      subcontractorCompanyIds: ['sub-B'],
      canViewBudgetAmount: false,
    });

    expect(result.projectId).toBe('proj-1');
    expect(result.budgetAmount).toBeNull();
    expect(result.assignedSubcontractorId).toBeNull();
    expect(result.subcontractorAssignments.map((a) => a.subcontractorCompanyId)).toEqual(['sub-B']);
  });

  it('subcontractor: nulls assignedSubcontractor when the legacy assigned company differs', () => {
    const result = shapeLotDetailResponse(makeLot(), {
      isSubcontractor: true,
      subcontractorCompanyIds: ['sub-B'], // lot.assignedSubcontractorId is 'sub-A'
      canViewBudgetAmount: false,
    });

    expect(result.assignedSubcontractor).toBeNull();
  });

  it('subcontractor: keeps assignedSubcontractor when the legacy assigned company matches', () => {
    const result = shapeLotDetailResponse(makeLot(), {
      isSubcontractor: true,
      subcontractorCompanyIds: ['sub-A'],
      canViewBudgetAmount: false,
    });

    expect(result.assignedSubcontractorId).toBe('sub-A');
    expect(result.assignedSubcontractor).toEqual({ id: 'sub-A', companyName: 'Acme' });
    expect(result.subcontractorAssignments.map((a) => a.subcontractorCompanyId)).toEqual(['sub-A']);
  });

  it('subcontractor with no resolved company: empty assignments and null assignedSubcontractor', () => {
    // Gated on isSubcontractor, not on a non-null company id.
    const result = shapeLotDetailResponse(makeLot(), {
      isSubcontractor: true,
      subcontractorCompanyIds: null,
      canViewBudgetAmount: false,
    });

    expect(result.subcontractorAssignments).toEqual([]);
    expect(result.assignedSubcontractorId).toBeNull();
    expect(result.assignedSubcontractor).toBeNull();
  });

  it('does not mutate the input lot', () => {
    const lot = makeLot();
    shapeLotDetailResponse(lot, {
      isSubcontractor: true,
      subcontractorCompanyIds: ['sub-B'],
      canViewBudgetAmount: false,
    });

    expect(lot.projectId).toBe('proj-1');
    expect(lot.assignedSubcontractorId).toBe('sub-A');
    expect(lot.subcontractorAssignments).toHaveLength(2);
    expect(lot.assignedSubcontractor).toEqual({ id: 'sub-A', companyName: 'Acme' });
  });
});
