export interface Project {
  id: string;
  name: string;
  projectNumber: string;
  status: string;
  startDate?: string;
  targetCompletion?: string;
  contractValue?: number;
}

export interface PortfolioStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  archivedProjects: number;
  totalContractValue: number;
  projectsOnTrack: number;
  projectsAtRisk: number;
}

export interface CashFlowSummary {
  totalClaimed: number;
  totalCertified: number;
  totalPaid: number;
  outstanding: number;
}

export interface CriticalNCR {
  id: string;
  ncrNumber: string;
  description: string;
  category: string;
  status: string;
  dueDate?: string;
  isOverdue: boolean;
  daysUntilDue: number | null;
  project: {
    id: string;
    name: string;
    projectNumber: string;
  };
  link: string;
}

export interface RiskIndicator {
  type: string;
  severity: 'critical' | 'warning';
  message: string;
  explanation: string;
}

export interface ProjectAtRisk {
  id: string;
  name: string;
  projectNumber: string;
  riskIndicators: RiskIndicator[];
  riskLevel: 'critical' | 'warning';
  link: string;
}

export interface PortfolioDataError {
  label: string;
  error: Error;
  fallback: string;
}

export function getValidDate(date: string | undefined): Date | null {
  if (!date) return null;
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
