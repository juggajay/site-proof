import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { extractErrorMessage } from '@/lib/errorHandling';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';
import {
  FolderKanban,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

interface Project {
  id: string;
  name: string;
  projectNumber: string;
  status: string;
  startDate?: string;
  targetCompletion?: string;
  contractValue?: number;
}

interface PortfolioStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  archivedProjects: number;
  totalContractValue: number;
  projectsOnTrack: number;
  projectsAtRisk: number;
}

interface CashFlowSummary {
  totalClaimed: number;
  totalCertified: number;
  totalPaid: number;
  outstanding: number;
}

interface CriticalNCR {
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

interface RiskIndicator {
  type: string;
  severity: 'critical' | 'warning';
  message: string;
  explanation: string;
}

interface ProjectAtRisk {
  id: string;
  name: string;
  projectNumber: string;
  riskIndicators: RiskIndicator[];
  riskLevel: 'critical' | 'warning';
  link: string;
}

const currencyFormatter = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function formatCurrencyValue(value: unknown): string {
  const amount = Number(value);
  return currencyFormatter.format(Number.isFinite(amount) ? amount : 0);
}

function getValidDate(date: string | undefined): Date | null {
  if (!date) return null;
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateLabel(date: string | undefined): string | null {
  const parsed = getValidDate(date);
  if (!parsed) return null;
  return parsed.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getSafeInternalLink(link: string | undefined, fallback: string): string {
  if (link?.startsWith('/') && !link.startsWith('//')) {
    return link;
  }
  return fallback;
}

function getProjectPath(projectId: string | undefined, suffix = ''): string {
  return projectId ? `/projects/${encodeURIComponent(projectId)}${suffix}` : '/projects';
}

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
  ].filter((item): item is { label: string; error: Error; fallback: string } =>
    Boolean(item.error),
  );

  const retryPortfolioData = () => {
    void projectsQuery.refetch();
    void cashFlowQuery.refetch();
    void ncrsQuery.refetch();
    void risksQuery.refetch();
  };

  // Calculate aggregate metrics
  const stats: PortfolioStats = {
    totalProjects: projects.length,
    activeProjects: projects.filter((p) => p.status === 'active').length,
    completedProjects: projects.filter((p) => p.status === 'completed').length,
    archivedProjects: projects.filter((p) => p.status === 'archived').length,
    totalContractValue: projects.reduce((sum, p) => sum + (Number(p.contractValue) || 0), 0),
    projectsOnTrack: projects.filter((p) => {
      const targetCompletion = getValidDate(p.targetCompletion);
      if (p.status !== 'active' || !targetCompletion) return false;
      return targetCompletion > new Date();
    }).length,
    projectsAtRisk: projects.filter((p) => {
      const targetCompletion = getValidDate(p.targetCompletion);
      if (p.status !== 'active' || !targetCompletion) return false;
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

      {dataErrors.length > 0 && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-medium">Some portfolio data could not be loaded.</p>
              <ul className="mt-2 list-disc list-inside space-y-1 text-sm">
                {dataErrors.map((item) => (
                  <li key={item.label}>
                    {item.label}: {extractErrorMessage(item.error, item.fallback)}
                  </li>
                ))}
              </ul>
            </div>
            <button
              type="button"
              onClick={retryPortfolioData}
              className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium hover:bg-red-100 sm:shrink-0"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Aggregate Metrics */}
      {hasProjectsData ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="bg-card rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <FolderKanban className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Projects</p>
                  <p className="text-2xl font-bold">{stats.totalProjects}</p>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Projects</p>
                  <p className="text-2xl font-bold">{stats.activeProjects}</p>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold">{stats.completedProjects}</p>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <DollarSign className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Contract Value</p>
                  <p className="text-2xl font-bold">
                    {formatCurrencyValue(stats.totalContractValue)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Project Status Breakdown */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="bg-card rounded-lg border p-4">
              <h2 className="text-lg font-semibold mb-4">Project Status</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="text-sm">Active</span>
                  </div>
                  <span className="font-medium">{stats.activeProjects}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                    <span className="text-sm">Completed</span>
                  </div>
                  <span className="font-medium">{stats.completedProjects}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-muted-foreground"></div>
                    <span className="text-sm">Archived</span>
                  </div>
                  <span className="font-medium">{stats.archivedProjects}</span>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-lg border p-4">
              <h2 className="text-lg font-semibold mb-4">Timeline Health</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm">On Track</span>
                  </div>
                  <span className="font-medium">{stats.projectsOnTrack}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span className="text-sm">At Risk (due within 30 days)</span>
                  </div>
                  <span className="font-medium">{stats.projectsAtRisk}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">No Target Date</span>
                  </div>
                  <span className="font-medium">
                    {
                      projects.filter(
                        (p) => p.status === 'active' && !getValidDate(p.targetCompletion),
                      ).length
                    }
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          Project portfolio metrics are unavailable until project data loads successfully.
        </div>
      )}

      {/* Cash Flow Summary */}
      {hasCashFlowData ? (
        <div className="bg-card rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-4">Cash Flow Summary</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="text-center p-3 bg-primary/5 rounded-lg">
              <p className="text-sm text-muted-foreground">Total Claimed</p>
              <p className="text-xl font-bold text-primary">
                {formatCurrencyValue(cashFlow.totalClaimed)}
              </p>
            </div>
            <div className="text-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <p className="text-sm text-muted-foreground">Total Certified</p>
              <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
                {formatCurrencyValue(cashFlow.totalCertified)}
              </p>
            </div>
            <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-sm text-muted-foreground">Total Paid</p>
              <p className="text-xl font-bold text-green-600 dark:text-green-400">
                {formatCurrencyValue(cashFlow.totalPaid)}
              </p>
            </div>
            <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <p className="text-sm text-muted-foreground">Outstanding</p>
              <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                {formatCurrencyValue(cashFlow.outstanding)}
              </p>
            </div>
          </div>
        </div>
      ) : cashFlowQuery.error ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          Cash flow metrics are unavailable until cash flow data loads successfully.
        </div>
      ) : null}

      {/* Critical NCRs Section */}
      {criticalNCRs.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="p-4 border-b border-red-200 dark:border-red-800 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <h2 className="text-lg font-semibold text-red-700 dark:text-red-400">
              Critical NCRs Across Projects
            </h2>
            <span className="ml-auto bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300 text-sm font-medium px-2.5 py-0.5 rounded-full">
              {criticalNCRs.length}
            </span>
          </div>
          <div className="divide-y divide-red-200 dark:divide-red-800">
            {criticalNCRs.map((ncr) => (
              <Link
                key={ncr.id}
                to={getSafeInternalLink(ncr.link, getProjectPath(ncr.project.id, '/ncr'))}
                aria-label={`Open ${ncr.ncrNumber} for ${ncr.project.name}`}
                className="block p-4 hover:bg-red-100/50 dark:hover:bg-red-900/30 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-red-700 dark:text-red-400">
                        {ncr.ncrNumber}
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300 rounded">
                        {ncr.status}
                      </span>
                      {ncr.isOverdue && (
                        <span className="text-xs px-2 py-0.5 bg-red-600 text-white rounded">
                          OVERDUE
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-red-600/80 dark:text-red-300/80 mt-1">
                      {ncr.description}
                    </p>
                    <p className="text-xs text-red-500/70 dark:text-red-400/70 mt-1">
                      {ncr.project.name} ({ncr.project.projectNumber})
                      {formatDateLabel(ncr.dueDate) && ` • Due: ${formatDateLabel(ncr.dueDate)}`}
                    </p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-red-400" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Projects at Risk Section */}
      {projectsAtRisk.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="p-4 border-b border-amber-200 dark:border-amber-800 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-amber-700 dark:text-amber-400">
              Projects at Risk
            </h2>
            <span className="ml-auto bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-300 text-sm font-medium px-2.5 py-0.5 rounded-full">
              {projectsAtRisk.length}
            </span>
          </div>
          <div className="divide-y divide-amber-200 dark:divide-amber-800">
            {projectsAtRisk.map((project) => (
              <Link
                key={project.id}
                to={getSafeInternalLink(project.link, getProjectPath(project.id))}
                aria-label={`Open risk summary for ${project.name}`}
                className="block p-4 hover:bg-amber-100/50 dark:hover:bg-amber-900/30 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-amber-700 dark:text-amber-400">
                        {project.name}
                      </span>
                      <span className="text-xs text-amber-600/70 dark:text-amber-400/70">
                        ({project.projectNumber})
                      </span>
                      {project.riskLevel === 'critical' && (
                        <span className="text-xs px-2 py-0.5 bg-red-600 text-white rounded">
                          CRITICAL
                        </span>
                      )}
                    </div>
                    <div className="mt-2 space-y-1">
                      {project.riskIndicators.map((indicator, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              indicator.severity === 'critical'
                                ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                                : 'bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            {indicator.message}
                          </span>
                          <span className="text-xs text-amber-500/70 dark:text-amber-400/70 italic">
                            {indicator.explanation}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-amber-400 mt-1" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* All Projects List */}
      {hasProjectsData && (
        <div className="bg-card rounded-lg border">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">All Company Projects</h2>
          </div>
          {projects.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No projects found. Create your first project to get started.
            </div>
          ) : (
            <div className="divide-y">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  to={getProjectPath(project.id)}
                  className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        'w-2 h-10 rounded-full',
                        project.status === 'active'
                          ? 'bg-green-500'
                          : project.status === 'completed'
                            ? 'bg-purple-500'
                            : 'bg-muted-foreground',
                      )}
                    ></div>
                    <div>
                      <p className="font-medium">{project.name}</p>
                      <p className="text-sm text-muted-foreground">{project.projectNumber}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    {project.contractValue && (
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Contract Value</p>
                        <p className="font-medium">{formatCurrencyValue(project.contractValue)}</p>
                      </div>
                    )}
                    {formatDateLabel(project.targetCompletion) && (
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Target Completion</p>
                        <p className="font-medium">{formatDateLabel(project.targetCompletion)}</p>
                      </div>
                    )}
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        project.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : project.status === 'completed'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-muted text-foreground'
                      }`}
                    >
                      {project.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
