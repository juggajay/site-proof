import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import {
  PortfolioCashFlowSection,
  PortfolioDataErrorAlert,
  PortfolioMetricsSection,
  PortfolioProjectsList,
  PortfolioRiskSections,
} from './components/PortfolioSections';
import {
  getValidDate,
  type CashFlowSummary,
  type CriticalNCR,
  type PortfolioDataError,
  type PortfolioStats,
  type Project,
  type ProjectAtRisk,
} from './portfolioPageData';

export function PortfolioPage() {
  const projectsQuery = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => apiFetch<{ projects: Project[] }>('/api/projects'),
  });

  const cashFlowQuery = useQuery({
    queryKey: [...queryKeys.portfolio, 'cashflow'] as const,
    queryFn: () => apiFetch<CashFlowSummary>('/api/dashboard/portfolio-cashflow'),
  });

  const ncrsQuery = useQuery({
    queryKey: [...queryKeys.portfolio, 'ncrs'] as const,
    queryFn: () => apiFetch<{ ncrs: CriticalNCR[] }>('/api/dashboard/portfolio-ncrs'),
  });

  const risksQuery = useQuery({
    queryKey: [...queryKeys.portfolio, 'risks'] as const,
    queryFn: () => apiFetch<{ projectsAtRisk: ProjectAtRisk[] }>('/api/dashboard/portfolio-risks'),
  });

  const hasProjectsData = Boolean(projectsQuery.data);
  const hasCashFlowData = Boolean(cashFlowQuery.data);
  const projects = projectsQuery.data?.projects || [];
  const cashFlow: CashFlowSummary = cashFlowQuery.data || {
    totalClaimed: 0,
    totalCertified: 0,
    totalPaid: 0,
    outstanding: 0,
  };
  const criticalNCRs = ncrsQuery.data?.ncrs || [];
  const projectsAtRisk = risksQuery.data?.projectsAtRisk || [];
  const loading =
    projectsQuery.isLoading ||
    cashFlowQuery.isLoading ||
    ncrsQuery.isLoading ||
    risksQuery.isLoading;
  const dataErrors = [
    { label: 'Projects', error: projectsQuery.error, fallback: 'Failed to load projects' },
    {
      label: 'Cash flow',
      error: cashFlowQuery.error,
      fallback: 'Failed to load portfolio cash flow',
    },
    { label: 'Critical NCRs', error: ncrsQuery.error, fallback: 'Failed to load critical NCRs' },
    { label: 'Risk indicators', error: risksQuery.error, fallback: 'Failed to load project risks' },
  ].filter((item): item is PortfolioDataError => Boolean(item.error));

  const retryPortfolioData = () => {
    void projectsQuery.refetch();
    void cashFlowQuery.refetch();
    void ncrsQuery.refetch();
    void risksQuery.refetch();
  };

  const stats: PortfolioStats = {
    totalProjects: projects.length,
    activeProjects: projects.filter((project) => project.status === 'active').length,
    completedProjects: projects.filter((project) => project.status === 'completed').length,
    archivedProjects: projects.filter((project) => project.status === 'archived').length,
    totalContractValue: projects.reduce(
      (sum, project) => sum + (Number(project.contractValue) || 0),
      0,
    ),
    projectsOnTrack: projects.filter((project) => {
      const targetCompletion = getValidDate(project.targetCompletion);
      if (project.status !== 'active' || !targetCompletion) return false;
      return targetCompletion > new Date();
    }).length,
    projectsAtRisk: projects.filter((project) => {
      const targetCompletion = getValidDate(project.targetCompletion);
      if (project.status !== 'active' || !targetCompletion) return false;
      const daysUntilTarget = (targetCompletion.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      return daysUntilTarget < 30 && daysUntilTarget > 0;
    }).length,
  };

  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-64"
        role="status"
        aria-label="Loading portfolio"
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Portfolio Overview</h1>
        <p className="text-muted-foreground mt-1">Multi-project view across all company projects</p>
      </div>

      <PortfolioDataErrorAlert dataErrors={dataErrors} onRetry={retryPortfolioData} />
      <PortfolioMetricsSection
        hasProjectsData={hasProjectsData}
        stats={stats}
        projects={projects}
      />
      <PortfolioCashFlowSection
        hasCashFlowData={hasCashFlowData}
        hasCashFlowError={Boolean(cashFlowQuery.error)}
        cashFlow={cashFlow}
      />
      <PortfolioRiskSections criticalNCRs={criticalNCRs} projectsAtRisk={projectsAtRisk} />
      <PortfolioProjectsList hasProjectsData={hasProjectsData} projects={projects} />
    </div>
  );
}
