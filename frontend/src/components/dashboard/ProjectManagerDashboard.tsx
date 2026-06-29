// Feature #294: Project Manager Dashboard
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { apiFetch } from '@/lib/api';
import { extractErrorMessage } from '@/lib/errorHandling';
import {
  AlertTriangle,
  ClipboardCheck,
  DollarSign,
  TrendingUp,
  RefreshCw,
  FileText,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  defaultPMData,
  formatCurrency,
  getProjectRoute,
  getSafeInternalLink,
  type PMDashboardData,
} from './ProjectManagerDashboardHelpers';
import {
  ProjectManagerProjectContext,
  ProjectManagerQuickActions,
} from './ProjectManagerDashboardChrome';
import { ProjectSwitcher } from './ProjectSwitcher';
import { useDashboardProjectId } from '@/hooks/useDashboardProjectId';
import { ProjectManagerAttentionItems } from './ProjectManagerAttentionItems';

export function ProjectManagerDashboard() {
  useAuth(); // Auth check
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);

  const { requestedProjectId, setProjectId, syncResolvedProjectId } = useDashboardProjectId();
  const {
    data: dashboardData,
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: [...queryKeys.pmDashboard, requestedProjectId ?? null],
    queryFn: () =>
      apiFetch<PMDashboardData>(
        `/api/dashboard/project-manager${requestedProjectId ? `?projectId=${encodeURIComponent(requestedProjectId)}` : ''}`,
      ),
  });
  const data = dashboardData ?? defaultPMData;
  const errorMessage = error
    ? extractErrorMessage(error, 'Failed to load project manager dashboard')
    : null;
  const hasHardError = Boolean(errorMessage && !dashboardData);

  const handleRefresh = () => {
    setRefreshing(true);
    refetch().finally(() => {
      setRefreshing(false);
    });
  };

  const projectId = data.project?.id;

  useEffect(() => {
    syncResolvedProjectId(dashboardData?.project?.id);
  }, [dashboardData?.project?.id, syncResolvedProjectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (hasHardError) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Project Dashboard</h1>
            <p className="text-muted-foreground">Project overview and key metrics</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Try again
          </Button>
        </div>
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive"
        >
          <p className="font-medium">Project manager dashboard could not be loaded.</p>
          <p className="mt-1 text-sm">{errorMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Project Dashboard</h1>
          <p className="text-muted-foreground">Project overview and key metrics</p>
        </div>
        <div className="flex items-center gap-3">
          <ProjectSwitcher
            projects={data.projects ?? []}
            value={data.project?.id}
            onChange={setProjectId}
          />
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-medium">Project manager dashboard data could not be refreshed.</p>
              <p className="mt-1 text-sm">{errorMessage}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Try again
            </Button>
          </div>
        </div>
      )}

      {/* Project Context */}
      {data.project && <ProjectManagerProjectContext project={data.project} />}

      <ProjectManagerAttentionItems
        items={data.attentionItems}
        onOpenItem={(link) => navigate(getSafeInternalLink(link, getProjectRoute(projectId, '')))}
      />

      {/* Top Metrics Row */}
      <div className="grid gap-4 md:grid-cols-4">
        {/* Lot Progress */}
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-muted rounded-lg">
              <Layers className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Lot Progress</p>
              <p className="text-2xl font-bold font-mono tabular-nums">
                {data.lotProgress.progressPercentage.toFixed(0)}%
              </p>
            </div>
          </div>
          <div className="mt-3">
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full"
                style={{ width: `${data.lotProgress.progressPercentage}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.lotProgress.completed} of {data.lotProgress.total} lots complete
            </p>
          </div>
        </div>

        {/* Open NCRs */}
        <button
          onClick={() => navigate(getProjectRoute(projectId, '/ncr'))}
          className="bg-card rounded-lg border p-4 text-left hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-muted rounded-lg">
              <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Open NCRs</p>
              <p className="text-2xl font-bold font-mono tabular-nums">{data.openNCRs.total}</p>
            </div>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            {data.openNCRs.major > 0 && (
              <span className="text-destructive">{data.openNCRs.major} major • </span>
            )}
            {data.openNCRs.overdue > 0 && (
              <span className="text-warning">{data.openNCRs.overdue} overdue</span>
            )}
            {data.openNCRs.total === 0 && <span className="text-success">All clear</span>}
          </div>
        </button>

        {/* Claim Status */}
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-muted rounded-lg">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Outstanding</p>
              <p className="text-2xl font-bold font-mono tabular-nums">
                {formatCurrency(data.claimStatus.outstanding)}
              </p>
            </div>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            Certified: {formatCurrency(data.claimStatus.totalCertified)}
          </div>
        </div>

        {/* Cost Variance */}
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-muted rounded-lg">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cost Variance</p>
              <p
                className={`text-2xl font-bold font-mono tabular-nums ${
                  data.costTracking.variance < 0
                    ? 'text-success'
                    : data.costTracking.variance > 0
                      ? 'text-destructive'
                      : ''
                }`}
              >
                {data.costTracking.variance >= 0 ? '+' : ''}
                {data.costTracking.variancePercentage.toFixed(1)}%
              </p>
            </div>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            {data.costTracking.trend === 'under'
              ? 'Under budget'
              : data.costTracking.trend === 'over'
                ? 'Over budget'
                : 'On track'}
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Lot Progress Breakdown */}
        <div className="bg-card rounded-lg border">
          <div className="p-4 border-b flex items-center gap-2">
            <Layers className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Lot Status Breakdown</h2>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-muted-foreground/30"></div>
                <span className="text-sm">Not Started</span>
              </div>
              <span className="font-medium font-mono tabular-nums">
                {data.lotProgress.notStarted}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-muted-foreground/60"></div>
                <span className="text-sm">In Progress</span>
              </div>
              <span className="font-medium font-mono tabular-nums">
                {data.lotProgress.inProgress}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-warning"></div>
                <span className="text-sm">On Hold</span>
              </div>
              <span className="font-medium font-mono tabular-nums">{data.lotProgress.onHold}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-foreground/70"></div>
                <span className="text-sm">Completed</span>
              </div>
              <span className="font-medium font-mono tabular-nums">
                {data.lotProgress.completed}
              </span>
            </div>
          </div>
        </div>

        {/* HP Pipeline */}
        <div className="bg-card rounded-lg border">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Hold Point Pipeline</h2>
            </div>
            <span className="text-sm text-muted-foreground">
              {data.holdPointPipeline.thisWeek} this week
            </span>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-4 gap-2 text-center mb-4">
              <div className="bg-muted rounded p-2">
                <p className="text-lg font-bold font-mono tabular-nums">
                  {data.holdPointPipeline.pending}
                </p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
              <div className="bg-muted rounded p-2">
                <p className="text-lg font-bold font-mono tabular-nums">
                  {data.holdPointPipeline.scheduled}
                </p>
                <p className="text-xs text-muted-foreground">Scheduled</p>
              </div>
              <div className="bg-muted rounded p-2">
                <p className="text-lg font-bold font-mono tabular-nums">
                  {data.holdPointPipeline.requested}
                </p>
                <p className="text-xs text-muted-foreground">Requested</p>
              </div>
              <div className="bg-muted rounded p-2">
                <p className="text-lg font-bold font-mono tabular-nums">
                  {data.holdPointPipeline.released}
                </p>
                <p className="text-xs text-muted-foreground">Released</p>
              </div>
            </div>
            {data.holdPointPipeline.items.length > 0 && (
              <div className="space-y-2 border-t pt-3">
                {data.holdPointPipeline.items.slice(0, 3).map((hp) => (
                  <button
                    key={hp.id}
                    onClick={() =>
                      navigate(
                        getSafeInternalLink(hp.link, getProjectRoute(projectId, '/hold-points')),
                      )
                    }
                    className="w-full flex items-center justify-between p-2 bg-muted/30 rounded hover:bg-muted/50 text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{hp.description}</p>
                      <p className="text-xs text-muted-foreground">Lot {hp.lotNumber}</p>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded border ${
                        hp.status === 'pending'
                          ? 'bg-muted text-muted-foreground border-transparent'
                          : hp.status === 'scheduled'
                            ? 'bg-info/10 text-info border-info/30'
                            : hp.status === 'requested'
                              ? 'bg-warning/10 text-warning border-warning/30'
                              : 'bg-success/10 text-success border-success/30'
                      }`}
                    >
                      {hp.status}
                    </span>
                  </button>
                ))}
                <Link
                  to={getProjectRoute(projectId, '/hold-points')}
                  className="block text-sm text-primary hover:underline pt-1"
                >
                  View all hold points →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Cost Tracking */}
        <div className="bg-card rounded-lg border">
          <div className="p-4 border-b flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Cost Tracking</h2>
          </div>
          <div className="p-4">
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Budget</span>
                  <span className="font-medium">
                    {formatCurrency(data.costTracking.budgetTotal)}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-muted-foreground/40 h-2 rounded-full"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Actual Spend</span>
                  <span className="font-medium">
                    {formatCurrency(data.costTracking.actualSpend)}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${data.costTracking.trend === 'over' ? 'bg-destructive' : 'bg-success'}`}
                    style={{
                      width: `${Math.min(100, data.costTracking.budgetTotal > 0 ? (data.costTracking.actualSpend / data.costTracking.budgetTotal) * 100 : 0)}%`,
                    }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                <div className="text-center">
                  <p className="text-lg font-bold">
                    {formatCurrency(data.costTracking.labourCost)}
                  </p>
                  <p className="text-xs text-muted-foreground">Labour</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold">{formatCurrency(data.costTracking.plantCost)}</p>
                  <p className="text-xs text-muted-foreground">Plant</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Claims */}
        <div className="bg-card rounded-lg border">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Claims Status</h2>
            </div>
            {data.claimStatus.pendingClaims > 0 && (
              <span className="bg-warning text-warning-foreground text-sm font-medium px-2.5 py-0.5 rounded-full">
                {data.claimStatus.pendingClaims} pending
              </span>
            )}
          </div>
          <div className="p-4">
            <div className="grid grid-cols-3 gap-2 text-center mb-4">
              <div>
                <p className="text-lg font-bold">{formatCurrency(data.claimStatus.totalClaimed)}</p>
                <p className="text-xs text-muted-foreground">Claimed</p>
              </div>
              <div>
                <p className="text-lg font-bold">
                  {formatCurrency(data.claimStatus.totalCertified)}
                </p>
                <p className="text-xs text-muted-foreground">Certified</p>
              </div>
              <div>
                <p className="text-lg font-bold">{formatCurrency(data.claimStatus.totalPaid)}</p>
                <p className="text-xs text-muted-foreground">Paid</p>
              </div>
            </div>
            {data.claimStatus.recentClaims.length > 0 && (
              <div className="space-y-2 border-t pt-3">
                {data.claimStatus.recentClaims.slice(0, 3).map((claim) => (
                  <button
                    key={claim.id}
                    onClick={() =>
                      navigate(
                        getSafeInternalLink(claim.link, getProjectRoute(projectId, '/claims')),
                      )
                    }
                    className="w-full flex items-center justify-between p-2 bg-muted/30 rounded hover:bg-muted/50 text-left"
                  >
                    <span className="text-sm font-medium">{claim.claimNumber}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{formatCurrency(claim.amount)}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded border ${
                          claim.status === 'paid'
                            ? 'bg-success/10 text-success border-success/30'
                            : claim.status === 'certified'
                              ? 'bg-info/10 text-info border-info/30'
                              : 'bg-muted text-muted-foreground border-transparent'
                        }`}
                      >
                        {claim.status}
                      </span>
                    </div>
                  </button>
                ))}
                <Link
                  to={getProjectRoute(projectId, '/claims')}
                  className="block text-sm text-primary hover:underline pt-1"
                >
                  View all claims →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      <ProjectManagerQuickActions projectId={projectId} />
    </div>
  );
}
