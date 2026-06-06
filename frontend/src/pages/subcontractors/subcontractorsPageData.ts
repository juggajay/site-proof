import type { Subcontractor } from './types';

export interface SubcontractorPageMetrics {
  pendingApprovalCount: number;
  pendingEmployees: number;
  pendingPlant: number;
  firstPendingApprovalSubcontractor: Subcontractor | null;
  totalEmployees: number;
  totalCost: number;
  pendingApprovalSummary: string;
}

export function buildSubcontractorPageMetrics(
  subcontractors: Subcontractor[],
): SubcontractorPageMetrics {
  const pendingApprovalCount = subcontractors.filter((s) => s.status === 'pending_approval').length;
  const pendingEmployees = subcontractors.reduce(
    (sum, s) => sum + s.employees.filter((e) => e.status === 'pending').length,
    0,
  );
  const pendingPlant = subcontractors.reduce(
    (sum, s) => sum + s.plant.filter((p) => p.status === 'pending').length,
    0,
  );
  const firstPendingApprovalSubcontractor =
    subcontractors.find((s) => s.status === 'pending_approval') ??
    subcontractors.find(
      (s) =>
        s.employees.some((employee) => employee.status === 'pending') ||
        s.plant.some((plant) => plant.status === 'pending'),
    ) ??
    null;
  const totalEmployees = subcontractors.reduce((sum, s) => sum + s.employees.length, 0);
  const totalCost = subcontractors.reduce((sum, s) => sum + s.totalCost, 0);
  const summaryParts: string[] = [];

  if (pendingApprovalCount > 0) {
    summaryParts.push(
      `${pendingApprovalCount} subcontractor${pendingApprovalCount === 1 ? '' : 's'} pending approval`,
    );
  }
  if (pendingEmployees > 0) {
    summaryParts.push(
      `${pendingEmployees} employee rate${pendingEmployees === 1 ? '' : 's'} pending approval`,
    );
  }
  if (pendingPlant > 0) {
    summaryParts.push(
      `${pendingPlant} plant rate${pendingPlant === 1 ? '' : 's'} pending approval`,
    );
  }

  return {
    pendingApprovalCount,
    pendingEmployees,
    pendingPlant,
    firstPendingApprovalSubcontractor,
    totalEmployees,
    totalCost,
    pendingApprovalSummary: summaryParts.join(' • '),
  };
}
