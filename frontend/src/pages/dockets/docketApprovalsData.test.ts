import { describe, expect, it } from 'vitest';
import {
  buildDocketApprovalsPath,
  canApproveDocketsForProjectRole,
  getDocketApprovedTotalCost,
  getDocketDisplayTotalCost,
  getDocketSubmittedTotalCost,
  hasDocketCostAdjustment,
  normalizeDockets,
  type Docket,
} from './docketApprovalsData';

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
  it('normalizes the legacy array response shape', () => {
    expect(normalizeDockets([baseDocket])).toEqual([baseDocket]);
  });

  it('normalizes the wrapped dockets response shape', () => {
    expect(normalizeDockets({ dockets: [baseDocket] })).toEqual([baseDocket]);
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

  it('uses the current project role for docket approval permission checks', () => {
    expect(canApproveDocketsForProjectRole('project_manager')).toBe(true);
    expect(canApproveDocketsForProjectRole('site_manager')).toBe(true);
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
