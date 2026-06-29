import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '@/lib/api';
import {
  buildDocketApprovalsPath,
  canApproveDocketsForProjectRole,
  fetchDocketApprovals,
  getDocketApprovedTotalCost,
  getDocketDisplayTotalCost,
  getDocketSubmittedTotalCost,
  hasDocketCostAdjustment,
  normalizeDockets,
  type Docket,
} from './docketApprovalsData';

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }));

const apiFetchMock = vi.mocked(apiFetch);

const baseDocket: Docket = {
  id: 'docket-1',
  docketNumber: 'DKT-001',
  subcontractor: 'QA Civil',
  subcontractorId: 'subbie-1',
  date: '2026-06-03',
  status: 'pending_approval',
  notes: null,
  labourHours: 8,
  plantHours: 2,
  totalLabourSubmitted: 600,
  totalLabourApproved: 8,
  totalPlantSubmitted: 200,
  totalPlantApproved: 2,
  totalLabourApprovedCost: null,
  totalPlantApprovedCost: null,
  submittedAt: '2026-06-03T01:00:00.000Z',
  approvedAt: null,
  foremanNotes: null,
};

describe('docket approvals data helpers', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('normalizes the legacy array response shape', () => {
    expect(normalizeDockets([baseDocket])).toEqual([baseDocket]);
  });

  it('normalizes the wrapped dockets response shape', () => {
    expect(normalizeDockets({ dockets: [baseDocket] })).toEqual([baseDocket]);
  });

  it('normalizes the wrapped data response shape', () => {
    expect(normalizeDockets({ data: [baseDocket] })).toEqual([baseDocket]);
  });

  it('treats a wrapped response without dockets as empty', () => {
    expect(normalizeDockets({})).toEqual([]);
  });

  it('builds the unfiltered dockets endpoint when no project is scoped', () => {
    expect(buildDocketApprovalsPath(undefined, 'all')).toBe('/api/dockets');
  });

  it('includes projectId and non-all status filters in the API path', () => {
    expect(buildDocketApprovalsPath('project 1', 'pending_approval')).toBe(
      '/api/dockets?projectId=project+1&status=pending_approval',
    );
  });

  it('includes page and limit when requesting a complete approvals list', () => {
    expect(buildDocketApprovalsPath('project 1', 'approved', 2, 100)).toBe(
      '/api/dockets?projectId=project+1&status=approved&page=2&limit=100',
    );
  });

  it('fetches every backend page for docket approvals', async () => {
    const firstPageDocket: Docket = { ...baseDocket, id: 'docket-page-1' };
    const secondPageDocket: Docket = { ...baseDocket, id: 'docket-page-2' };

    apiFetchMock.mockImplementation((path) => {
      const requestUrl = new URL(path, 'https://siteproof.test');
      expect(requestUrl.searchParams.get('limit')).toBe('100');
      const page = requestUrl.searchParams.get('page');

      return Promise.resolve({
        dockets: page === '2' ? [secondPageDocket] : [firstPageDocket],
        pagination: {
          page: Number(page ?? 1),
          limit: 100,
          total: 2,
          totalPages: 2,
        },
      });
    });

    await expect(fetchDocketApprovals('project-1', 'all')).resolves.toEqual([
      firstPageDocket,
      secondPageDocket,
    ]);
    expect(apiFetchMock).toHaveBeenCalledTimes(2);
  });

  it('uses the current project role for docket approval permission checks', () => {
    expect(canApproveDocketsForProjectRole('project_manager')).toBe(true);
    expect(canApproveDocketsForProjectRole('site_manager')).toBe(true);
    expect(canApproveDocketsForProjectRole('quality_manager')).toBe(true);
    expect(canApproveDocketsForProjectRole('viewer')).toBe(false);
    expect(canApproveDocketsForProjectRole(null)).toBe(false);
  });

  it('uses approved dollar totals for approved dockets when cost totals are present', () => {
    const docket: Docket = {
      ...baseDocket,
      status: 'approved',
      totalLabourApprovedCost: 450,
      totalPlantApprovedCost: 100,
    };

    expect(getDocketSubmittedTotalCost(docket)).toBe(800);
    expect(getDocketApprovedTotalCost(docket)).toBe(550);
    expect(getDocketDisplayTotalCost(docket)).toBe(550);
    expect(hasDocketCostAdjustment(docket)).toBe(true);
  });

  it('does not mark approved dockets as adjusted when approved cost matches submitted cost', () => {
    const docket: Docket = {
      ...baseDocket,
      status: 'approved',
      totalLabourApprovedCost: 600,
      totalPlantApprovedCost: 200,
    };

    expect(getDocketApprovedTotalCost(docket)).toBe(800);
    expect(getDocketDisplayTotalCost(docket)).toBe(800);
    expect(hasDocketCostAdjustment(docket)).toBe(false);
  });

  it('falls back to submitted dollars for legacy approved dockets without approved cost totals', () => {
    const docket: Docket = {
      ...baseDocket,
      status: 'approved',
      totalLabourApprovedCost: null,
      totalPlantApprovedCost: undefined,
    };

    expect(getDocketApprovedTotalCost(docket)).toBeNull();
    expect(getDocketDisplayTotalCost(docket)).toBe(800);
    expect(hasDocketCostAdjustment(docket)).toBe(false);
  });
});
