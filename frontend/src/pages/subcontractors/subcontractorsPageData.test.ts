import { describe, expect, it } from 'vitest';
import type { Subcontractor } from './types';
import { buildSubcontractorPageMetrics } from './subcontractorsPageData';

function makeSubcontractor(overrides: Partial<Subcontractor>): Subcontractor {
  return {
    id: 'sub-1',
    companyName: 'Civil Subbie Co',
    abn: '51 824 753 556',
    primaryContact: 'Sam Supervisor',
    email: 'sam@example.com',
    phone: '0400000000',
    status: 'approved',
    employees: [],
    plant: [],
    totalApprovedDockets: 0,
    totalCost: 0,
    ...overrides,
  };
}

describe('buildSubcontractorPageMetrics', () => {
  it('counts pending approvals, employees, plant, employees, and total cost', () => {
    const metrics = buildSubcontractorPageMetrics([
      makeSubcontractor({
        id: 'company-pending',
        status: 'pending_approval',
        employees: [
          { id: 'emp-1', name: 'Alex', role: 'Operator', hourlyRate: 90, status: 'pending' },
        ],
        plant: [
          {
            id: 'plant-1',
            type: 'Excavator',
            description: '30t excavator',
            idRego: 'EX-001',
            dryRate: 160,
            wetRate: 220,
            status: 'pending',
          },
        ],
        totalCost: 1200,
      }),
      makeSubcontractor({
        id: 'approved',
        status: 'approved',
        employees: [
          { id: 'emp-2', name: 'Jamie', role: 'Leading Hand', hourlyRate: 100, status: 'approved' },
        ],
        totalCost: 300,
      }),
    ]);

    expect(metrics).toMatchObject({
      pendingApprovalCount: 1,
      pendingEmployees: 1,
      pendingPlant: 1,
      totalEmployees: 2,
      totalCost: 1500,
      pendingApprovalSummary:
        '1 subcontractor pending approval • 1 employee rate pending approval • 1 plant rate pending approval',
    });
    expect(metrics.firstPendingApprovalSubcontractor?.id).toBe('company-pending');
  });

  it('selects a subcontractor with pending rates when no company approval is pending', () => {
    const metrics = buildSubcontractorPageMetrics([
      makeSubcontractor({ id: 'ready', status: 'approved' }),
      makeSubcontractor({
        id: 'rate-pending',
        status: 'approved',
        employees: [
          { id: 'emp-1', name: 'Alex', role: 'Operator', hourlyRate: 90, status: 'pending' },
        ],
      }),
    ]);

    expect(metrics.pendingApprovalSummary).toBe('1 employee rate pending approval');
    expect(metrics.firstPendingApprovalSubcontractor?.id).toBe('rate-pending');
  });
});
