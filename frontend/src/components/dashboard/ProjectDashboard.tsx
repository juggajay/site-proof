// ProjectDashboard - Landing page when entering a project
// Shows project health at a glance: attention items, progress, stats ribbon, activity
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { apiFetch, ApiError } from '@/lib/api';
import { extractErrorMessage, isForbidden } from '@/lib/errorHandling';
import {
  MapPin,
  Calendar,
  AlertTriangle,
  ClipboardCheck,
  FileCheck,
  Clock,
  FlaskConical,
  FileText,
  Settings,
  RefreshCw,
  Activity,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  XCircle,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ActivityRow, NCRCategoryBar, StatPill, StatusCount } from './ProjectDashboardParts';
import {
  formatStatusLabel,
  getAttentionFallbackRoute,
  getSafeProjectLink,
  type ProjectDashboardData,
} from './ProjectDashboardHelpers';

export function ProjectDashboard() {
  const { projectId } = useParams();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const encodedProjectId = projectId ? encodeURIComponent(projectId) : '';

  const {
    data,
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.dashboard(projectId),
    queryFn: () => apiFetch<ProjectDashboardData>(`/api/projects/${encodedProjectId}/dashboard`),
    enabled: !!projectId,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
        return false;
      }
      return failureCount < 3;
    },
  });

  const error = queryError
    ? isForbidden(queryError)
      ? `Access Denied. ${extractErrorMessage(queryError, 'You do not have access to this project')}`
      : queryError instanceof ApiError && queryError.status === 404
        ? 'Project not found'
        : extractErrorMessage(queryError, 'Failed to load project dashboard')
    : null;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(projectId) });
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-64"
        role="status"
        aria-label="Loading project dashboard"
      >
        <span className="sr-only">Loading project dashboard...</span>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div
          role="alert"
          className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{error || 'Failed to load project dashboard'}</span>
            {projectId && (
              <Button type="button" variant="outline" size="sm" onClick={handleRefresh}>
                Try again
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const { project, stats, attentionItems, recentActivity } = data;
  const projectRouteBase = `/projects/${encodedProjectId}`;

  // Quiet Authority: benign project lifecycle states are MONOCHROME. Only the
  // soft-exception `on_hold` carries a status colour (warning).
  const statusColors: Record<string, string> = {
    active: 'bg-muted text-foreground',
    completed: 'bg-muted text-muted-foreground',
    on_hold: 'bg-warning/10 text-warning',
    pending: 'bg-muted text-muted-foreground',
    draft: 'bg-muted text-muted-foreground',
  };

  const getDiaryLabel = () => {
    switch (stats.diary.todayStatus) {
      case 'submitted':
        return 'Submitted';
      case 'draft':
        return 'Draft';
      default:
        return 'No';
    }
  };

  const getDiaryColor = () => {
    switch (stats.diary.todayStatus) {
      case 'submitted':
        // Benign "done" state — monochrome per INV-3.
        return 'text-foreground';
      case 'draft':
        // Soft exception: started but not submitted today.
        return 'text-warning';
      default:
        return 'text-muted-foreground';
    }
  };

  const hasAttentionItems = attentionItems.length > 0;
  const criticalCount = attentionItems.filter((i) => i.urgency === 'critical').length;

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{project.name}</h1>
            <span
              className={cn(
                'px-2.5 py-0.5 rounded-full text-xs font-medium',
                statusColors[project.status?.toLowerCase()] || statusColors.draft,
              )}
            >
              {formatStatusLabel(project.status)}
            </span>
          </div>
          <p className="text-muted-foreground mt-1">
            {project.projectNumber}
            {project.client && ` \u2022 ${project.client}`}
            {project.state && ` \u2022 ${project.state}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            Refresh
          </Button>
          <Link
            to={`${projectRouteBase}/settings`}
            className="flex items-center gap-2 px-3 py-2 text-sm border rounded-md hover:bg-muted"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </div>
      </div>

      {/* Attention Banner */}
      {hasAttentionItems && (
        <div
          className={cn(
            'rounded-lg border p-4',
            criticalCount > 0
              ? 'bg-destructive/10 border-destructive/20'
              : 'bg-warning/10 border-warning/20',
          )}
        >
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle
              className={cn('h-5 w-5', criticalCount > 0 ? 'text-destructive' : 'text-warning')}
            />
            <h2
              className={cn(
                'text-sm font-semibold',
                criticalCount > 0 ? 'text-destructive' : 'text-warning',
              )}
            >
              {attentionItems.length} item{attentionItems.length !== 1 ? 's' : ''} need
              {attentionItems.length === 1 ? 's' : ''} attention
            </h2>
          </div>
          <div className="space-y-2">
            {attentionItems.slice(0, 4).map((item) => (
              <Link
                key={item.id}
                to={getSafeProjectLink(
                  item.link,
                  projectRouteBase,
                  getAttentionFallbackRoute(item.type, projectRouteBase),
                )}
                className={cn(
                  'flex items-center justify-between p-2.5 rounded-md transition-colors text-sm',
                  item.urgency === 'critical'
                    ? 'bg-destructive/10 hover:bg-destructive/20'
                    : 'bg-warning/10 hover:bg-warning/20',
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {item.urgency === 'critical' ? (
                    <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" />
                  )}
                  <span
                    className={cn(
                      'font-medium truncate',
                      item.urgency === 'critical' ? 'text-destructive' : 'text-warning',
                    )}
                  >
                    {item.title}
                  </span>
                </div>
                <span
                  className={cn(
                    'text-xs flex-shrink-0 ml-3',
                    item.urgency === 'critical' ? 'text-destructive' : 'text-warning',
                  )}
                >
                  {item.daysOverdue}d overdue
                </span>
              </Link>
            ))}
            {attentionItems.length > 4 && (
              <p
                className={cn(
                  'text-xs pl-2',
                  criticalCount > 0 ? 'text-destructive' : 'text-warning',
                )}
              >
                + {attentionItems.length - 4} more
              </p>
            )}
          </div>
        </div>
      )}

      {/* Compact Stat Ribbon */}
      <div className="grid grid-cols-4 md:grid-cols-8 gap-px bg-border rounded-lg overflow-hidden border">
        <StatPill
          label="lots complete"
          value={`${stats.lots.progressPct}%`}
          sub={`${stats.lots.completed} of ${stats.lots.total} lots`}
          icon={<MapPin className="h-3.5 w-3.5" />}
          color="text-muted-foreground"
        />
        <StatPill
          label="open NCRs"
          value={stats.ncrs.open}
          sub={stats.ncrs.overdue > 0 ? `${stats.ncrs.overdue} late` : 'open'}
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          color="text-muted-foreground"
          alert={stats.ncrs.overdue > 0}
        />
        <StatPill
          label="pending hold points"
          value={stats.holdPoints.pending}
          icon={<Clock className="h-3.5 w-3.5" />}
          color="text-muted-foreground"
        />
        <StatPill
          label="ITPs complete"
          value={stats.itps.completed}
          sub={`${stats.itps.pending} in progress`}
          icon={<ClipboardCheck className="h-3.5 w-3.5" />}
          color="text-muted-foreground"
        />
        <StatPill
          label="dockets pending"
          value={stats.dockets.pendingApproval}
          icon={<FileCheck className="h-3.5 w-3.5" />}
          color="text-muted-foreground"
        />
        <StatPill
          label="test results"
          value={stats.tests.total}
          icon={<FlaskConical className="h-3.5 w-3.5" />}
          color="text-muted-foreground"
        />
        <StatPill
          label="documents"
          value={stats.documents.total}
          icon={<FileText className="h-3.5 w-3.5" />}
          color="text-muted-foreground"
        />
        <StatPill
          label="diary entry today"
          value={getDiaryLabel()}
          icon={<Calendar className="h-3.5 w-3.5" />}
          color={getDiaryColor()}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-5 md:grid-cols-2">
        {/* Left Column - Project Progress */}
        <div className="space-y-5">
          {/* Lot Progress */}
          <div className="bg-card rounded-lg border p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                Lot Progress
              </h2>
              <Link
                to={`${projectRouteBase}/lots`}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {stats.lots.total === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                No lots created yet.{' '}
                <Link to={`${projectRouteBase}/lots`} className="text-primary hover:underline">
                  Create your first lot
                </Link>
              </div>
            ) : (
              <>
                {/* Progress bar */}
                <div className="mb-4">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-2xl font-bold">{stats.lots.progressPct}%</span>
                    <span className="text-xs text-muted-foreground">
                      {stats.lots.completed} of {stats.lots.total} lots completed
                    </span>
                  </div>
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden flex">
                    {stats.lots.completed > 0 && (
                      <div
                        className="bg-primary transition-all"
                        style={{ width: `${(stats.lots.completed / stats.lots.total) * 100}%` }}
                      />
                    )}
                    {stats.lots.inProgress > 0 && (
                      <div
                        className="bg-muted-foreground transition-all"
                        style={{ width: `${(stats.lots.inProgress / stats.lots.total) * 100}%` }}
                      />
                    )}
                    {stats.lots.onHold > 0 && (
                      <div
                        className="bg-warning transition-all"
                        style={{ width: `${(stats.lots.onHold / stats.lots.total) * 100}%` }}
                      />
                    )}
                  </div>
                </div>

                {/* Status breakdown */}
                <div className="grid grid-cols-4 gap-3 text-center">
                  <StatusCount
                    label="Not Started"
                    count={stats.lots.notStarted}
                    color="bg-muted-foreground/40"
                  />
                  <StatusCount
                    label="In Progress"
                    count={stats.lots.inProgress}
                    color="bg-muted-foreground"
                  />
                  <StatusCount label="On Hold" count={stats.lots.onHold} color="bg-warning" />
                  <StatusCount label="Complete" count={stats.lots.completed} color="bg-primary" />
                </div>
              </>
            )}
          </div>

          {/* Quality Overview */}
          <div className="bg-card rounded-lg border p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                Quality Overview
              </h2>
              <Link
                to={`${projectRouteBase}/ncr`}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                View NCRs <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {stats.ncrs.total === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                No non-conformances recorded
              </div>
            ) : (
              <div className="space-y-3">
                {/* Open NCR summary */}
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold">{stats.ncrs.open}</span>
                  <span className="text-xs text-muted-foreground">
                    open of {stats.ncrs.total} total
                  </span>
                </div>

                {/* Category breakdown */}
                {stats.ncrs.open > 0 && (
                  <div className="space-y-2">
                    {stats.ncrs.major > 0 && (
                      <NCRCategoryBar
                        label="Major"
                        count={stats.ncrs.major}
                        total={stats.ncrs.open}
                        color="bg-destructive"
                      />
                    )}
                    {stats.ncrs.minor > 0 && (
                      <NCRCategoryBar
                        label="Minor"
                        count={stats.ncrs.minor}
                        total={stats.ncrs.open}
                        color="bg-warning"
                      />
                    )}
                    {stats.ncrs.observation > 0 && (
                      <NCRCategoryBar
                        label="Observation"
                        count={stats.ncrs.observation}
                        total={stats.ncrs.open}
                        color="bg-muted-foreground"
                      />
                    )}
                  </div>
                )}

                {/* Overdue warning */}
                {stats.ncrs.overdue > 0 && (
                  <div className="flex items-center gap-2 text-xs text-destructive pt-1">
                    <XCircle className="h-3.5 w-3.5" />
                    {stats.ncrs.overdue} overdue NCR{stats.ncrs.overdue !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Activity */}
        <div className="bg-card rounded-lg border">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Recent Activity
            </h2>
          </div>
          <div className="divide-y">
            {recentActivity.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No recent activity
              </div>
            ) : (
              recentActivity.slice(0, 10).map((activity) => (
                <div key={activity.id} className="hover:bg-muted/50 transition-colors">
                  <ActivityRow activity={activity} projectRouteBase={projectRouteBase} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
