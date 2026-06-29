import { useState, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { apiFetch } from '@/lib/api';
import { extractErrorMessage } from '@/lib/errorHandling';
import { logError } from '@/lib/logger';
import {
  DATE_RANGE_PRESETS,
  type DateRangePreset,
  formatDateForApi,
} from '@/lib/dashboardDateRanges';
import { EMPTY_LOT_STATUS_COUNTS, type LotStatusCounts } from '@/lib/lotStatusOverview';
import { ForemanDashboard } from '@/components/dashboard/ForemanDashboard';
import { ForemanMobileDashboard } from '@/components/foreman/ForemanMobileDashboard';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { useDashboardWidgets } from '@/hooks/useDashboardWidgets';
import { DashboardDateRangePicker } from '@/components/dashboard/DashboardDateRangePicker';
import { DashboardKpiTiles } from '@/components/dashboard/DashboardKpiTiles';
import { DashboardWidgetCustomizer } from '@/components/dashboard/DashboardWidgetCustomizer';
import {
  HoldPointsSummaryWidget,
  NcrSummaryWidget,
} from '@/components/dashboard/DashboardIssueSummaryWidgets';
import { LotStatusOverview } from '@/components/dashboard/LotStatusOverview';
import {
  RecentActivityWidget,
  type DashboardRecentActivity,
} from '@/components/dashboard/RecentActivityWidget';
import {
  ItemsRequiringAttentionWidget,
  type DashboardAttentionItems,
} from '@/components/dashboard/ItemsRequiringAttentionWidget';
import { DashboardQuickLinks } from '@/components/dashboard/DashboardQuickLinks';
import {
  DashboardMemberSetupNotice,
  DashboardSetupChecklist,
} from '@/components/dashboard/DashboardSetupChecklist';
import { QualityManagerDashboard } from '@/components/dashboard/QualityManagerDashboard';
import { ProjectManagerDashboard } from '@/components/dashboard/ProjectManagerDashboard';
import { SubcontractorDashboard } from '@/pages/subcontractor-portal/SubcontractorDashboard';
import {
  getCompanyRole,
  getDashboardRole,
  hasSubcontractorPortalIdentity,
} from '@/lib/subcontractorIdentity';
import { ROLE_GROUPS, hasRoleInGroup } from '@/lib/roles';
import { Button } from '@/components/ui/button';
import { ContextHelp, HELP_CONTENT } from '@/components/ContextHelp';
import {
  Settings2,
  Download,
  Calendar,
  RefreshCw,
  MailCheck,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';

interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  totalLots: number;
  lotStatusCounts?: Partial<LotStatusCounts>;
  openHoldPoints: number;
  openNCRs: number;
  attentionItems: DashboardAttentionItems;
  recentActivities: DashboardRecentActivity[];
}

interface DashboardProject {
  id: string;
  status?: string | null;
}

type DashboardUser = ReturnType<typeof useAuth>['user'];

interface PendingInvitation {
  id: string;
  companyName: string;
  projectName: string;
  headContractorName: string;
  primaryContactEmail: string;
  primaryContactName?: string | null;
  status: string;
}

export function DashboardPage() {
  const { user } = useAuth();
  const isMobile = useIsMobile();

  // Feature #292, #293, #294: Check user role for role-specific dashboards
  const dashboardRole = getDashboardRole(user);
  const isSubcontractor = hasSubcontractorPortalIdentity(user);
  const isForeman = dashboardRole === 'foreman';
  const isQualityManager = dashboardRole === 'quality_manager';
  const isProjectManager = dashboardRole === 'project_manager';

  if (isSubcontractor) {
    return <SubcontractorDashboard />;
  }

  // Render mobile or desktop foreman dashboard based on screen size
  if (isForeman) {
    return isMobile ? <ForemanMobileDashboard /> : <ForemanDashboard />;
  }

  // Feature #293: Render quality manager dashboard for QM role
  if (isQualityManager) {
    return <QualityManagerDashboard />;
  }

  // Feature #294: Render project manager dashboard for PM role
  if (isProjectManager) {
    return <ProjectManagerDashboard />;
  }

  return <DefaultDashboard user={user} />;
}

function DefaultDashboard({ user }: { user: DashboardUser }) {
  const navigate = useNavigate();

  // Date range filter state
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('last30days');
  const [showDateRangeDropdown, setShowDateRangeDropdown] = useState(false);

  const { data: projectsData } = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => apiFetch<{ projects: DashboardProject[] }>('/api/projects'),
    staleTime: 30_000,
  });

  const reportsProject = useMemo(() => {
    const projects = projectsData?.projects ?? [];
    return projects.find((project) => project.status === 'active') ?? projects[0];
  }, [projectsData?.projects]);
  const reportsQuickLink = reportsProject
    ? `/projects/${encodeURIComponent(reportsProject.id)}/reports`
    : '/projects';

  // Get current date range based on preset
  const currentDateRange = useMemo(() => {
    const preset = DATE_RANGE_PRESETS.find((p) => p.value === dateRangePreset);
    if (preset) {
      const range = preset.getRange();
      return {
        preset: dateRangePreset,
        startDate: formatDateForApi(range.start),
        endDate: formatDateForApi(range.end),
        label: preset.label,
      };
    }
    // Default to last 30 days
    const defaultPreset = DATE_RANGE_PRESETS.find((p) => p.value === 'last30days')!;
    const range = defaultPreset.getRange();
    return {
      preset: 'last30days' as DateRangePreset,
      startDate: formatDateForApi(range.start),
      endDate: formatDateForApi(range.end),
      label: defaultPreset.label,
    };
  }, [dateRangePreset]);

  const defaultStats: DashboardStats = {
    totalProjects: 0,
    activeProjects: 0,
    totalLots: 0,
    lotStatusCounts: EMPTY_LOT_STATUS_COUNTS,
    openHoldPoints: 0,
    openNCRs: 0,
    attentionItems: {
      overdueNCRs: [],
      staleHoldPoints: [],
      total: 0,
    },
    recentActivities: [],
  };

  const { visibleWidgets, isWidgetVisible, toggleWidget } = useDashboardWidgets();

  const [showWidgetSettings, setShowWidgetSettings] = useState(false);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Primary dashboard stats query
  const {
    data: statsData,
    isLoading: statsLoading,
    error: statsError,
    refetch: refetchStats,
  } = useQuery({
    queryKey: queryKeys.dashboardStats(currentDateRange.startDate, currentDateRange.endDate),
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: currentDateRange.startDate,
        endDate: currentDateRange.endDate,
      });
      const result = await apiFetch<DashboardStats>(`/api/dashboard/stats?${params}`);
      return {
        totalProjects: result.totalProjects || 0,
        activeProjects: result.activeProjects || 0,
        totalLots: result.totalLots || 0,
        lotStatusCounts: result.lotStatusCounts || EMPTY_LOT_STATUS_COUNTS,
        openHoldPoints: result.openHoldPoints || 0,
        openNCRs: result.openNCRs || 0,
        attentionItems: result.attentionItems || {
          overdueNCRs: [],
          staleHoldPoints: [],
          total: 0,
        },
        recentActivities: result.recentActivities || [],
      } as DashboardStats;
    },
  });

  const stats = statsData ?? defaultStats;
  const loading = statsLoading;
  const hasStatsData = Boolean(statsData);

  // First-run detection: only ever decided from loaded stats (never while the
  // query is still in flight) so an established company never sees the setup
  // state flash before its real numbers arrive. The projects list feeds the
  // checklist's "done" ticks because it refreshes independently of stats.
  const knownProjectCount = projectsData?.projects.length ?? 0;
  const showFirstRunSetup = hasStatsData && stats.totalProjects === 0;
  const companyRole = getCompanyRole(user);
  const canCreateProjects = hasRoleInGroup(companyRole, ROLE_GROUPS.ADMIN);
  const canManageCompanySettings = companyRole === 'owner' || companyRole === 'admin';
  const statsErrorMessage = statsError
    ? extractErrorMessage(statsError, 'Failed to load dashboard data')
    : null;
  const hasHardStatsError = Boolean(statsErrorMessage && !hasStatsData);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    refetchStats().finally(() => {
      setIsRefreshing(false);
    });
  }, [refetchStats]);

  const handleExportPDF = useCallback(async () => {
    setPdfError(null);
    setIsExportingPDF(true);

    try {
      const { generateDashboardPDF } = await import('@/lib/pdfGenerator');
      await generateDashboardPDF({
        generatedAt: new Date().toISOString(),
        exportedBy: user?.fullName || user?.name || user?.email || null,
        dateRange: {
          label: currentDateRange.label,
          startDate: currentDateRange.startDate,
          endDate: currentDateRange.endDate,
        },
        stats,
      });
    } catch (err) {
      logError('Failed to generate dashboard PDF:', err);
      setPdfError(extractErrorMessage(err, 'Failed to generate dashboard PDF'));
    } finally {
      setIsExportingPDF(false);
    }
  }, [
    currentDateRange.endDate,
    currentDateRange.label,
    currentDateRange.startDate,
    stats,
    user?.email,
    user?.fullName,
    user?.name,
  ]);

  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-64"
        role="status"
        aria-label="Loading dashboard"
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // A company with zero projects has nothing to chart, so the KPI grid and
  // export chrome would be an all-zero wall. Show a path to first value
  // instead: a setup checklist for roles that can create projects, and a
  // plain "you'll be added" notice for everyone else.
  if (showFirstRunSetup) {
    return (
      <div className="space-y-6 dashboard-content">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Welcome{user?.name ? `, ${user.name}` : user?.fullName ? `, ${user.fullName}` : ''}!{' '}
            {canCreateProjects
              ? "Let's get your first project set up."
              : 'Your dashboard fills in once you are working on a project.'}
          </p>
        </div>

        <PendingInvitationBanner user={user} />

        {canCreateProjects ? (
          <DashboardSetupChecklist
            projectCreated={knownProjectCount > 0}
            lotsAdded={stats.totalLots > 0}
          />
        ) : (
          <DashboardMemberSetupNotice />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 dashboard-content">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            <ContextHelp
              title={HELP_CONTENT.dashboard.title}
              content={HELP_CONTENT.dashboard.content}
            />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Welcome back{user?.name ? `, ${user.name}` : user?.fullName ? `, ${user.fullName}` : ''}
            ! Here's an overview of your projects.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="grid w-full grid-cols-2 gap-2 no-print sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end lg:flex-nowrap">
          {/* Date Range Filter */}
          <DashboardDateRangePicker
            selectedPreset={dateRangePreset}
            label={currentDateRange.label}
            isOpen={showDateRangeDropdown}
            onToggle={() => setShowDateRangeDropdown((isOpen) => !isOpen)}
            onClose={() => setShowDateRangeDropdown(false)}
            onSelectPreset={setDateRangePreset}
          />

          {/* Refresh Button */}
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Refresh dashboard data"
            className="w-full sm:w-auto"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>

          {/* Export PDF Button */}
          <Button
            variant="outline"
            onClick={handleExportPDF}
            title="Export to PDF"
            disabled={isExportingPDF || hasHardStatsError}
            className="w-full sm:w-auto"
          >
            <Download className="h-4 w-4" />
            {isExportingPDF ? 'Exporting...' : 'Export PDF'}
          </Button>

          {/* Widget Settings Dropdown */}
          <DashboardWidgetCustomizer
            isOpen={showWidgetSettings}
            isWidgetVisible={isWidgetVisible}
            onToggle={() => setShowWidgetSettings((isOpen) => !isOpen)}
            onClose={() => setShowWidgetSettings(false)}
            onToggleWidget={toggleWidget}
          />
        </div>
      </div>

      <PendingInvitationBanner user={user} />

      {statsErrorMessage && (
        <div
          role="alert"
          className="rounded-lg border border-l-2 border-l-destructive bg-card px-4 py-3 text-foreground"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div>
                <p className="font-medium">Dashboard data could not be loaded.</p>
                <p className="mt-1 text-sm text-muted-foreground">{statsErrorMessage}</p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="sm:shrink-0"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Try again
            </Button>
          </div>
        </div>
      )}

      {pdfError && (
        <div
          role="alert"
          className="rounded-lg border border-l-2 border-l-warning bg-card px-4 py-3 text-foreground"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            <div>
              <p className="font-medium">Dashboard PDF could not be generated.</p>
              <p className="mt-1 text-sm text-muted-foreground">{pdfError}</p>
            </div>
          </div>
        </div>
      )}

      {hasHardStatsError ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          Dashboard metrics are unavailable until the data loads successfully.
        </div>
      ) : (
        <>
          {/* Date Range Indicator */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>
              Showing data from{' '}
              <span className="font-mono tabular-nums text-foreground">
                {currentDateRange.startDate}
              </span>{' '}
              to{' '}
              <span className="font-mono tabular-nums text-foreground">
                {currentDateRange.endDate}
              </span>
            </span>
          </div>

          {/* Items Requiring Attention Widget */}
          {isWidgetVisible('attentionItems') && (
            <ItemsRequiringAttentionWidget
              attentionItems={stats.attentionItems}
              onNavigate={navigate}
            />
          )}

          {/* Project Summary Widget */}
          {isWidgetVisible('projectSummary') && (
            <DashboardKpiTiles
              totalProjects={stats.totalProjects}
              activeProjects={stats.activeProjects}
              totalLots={stats.totalLots}
              canManageCompanySettings={canManageCompanySettings}
              onNavigate={navigate}
            />
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Recent Activity Widget */}
            {isWidgetVisible('recentActivity') && (
              <RecentActivityWidget activities={stats.recentActivities} />
            )}

            {/* Lot Status Widget */}
            {isWidgetVisible('lotStatus') && (
              <LotStatusOverview
                counts={stats.lotStatusCounts}
                onStatusClick={(status) => navigate(`/projects?lotStatus=${status}`)}
              />
            )}

            {/* Hold Points Widget */}
            {isWidgetVisible('holdPoints') && (
              <HoldPointsSummaryWidget
                openHoldPoints={stats.openHoldPoints}
                onNavigate={navigate}
              />
            )}

            {/* NCRs Widget */}
            {isWidgetVisible('ncrs') && (
              <NcrSummaryWidget openNCRs={stats.openNCRs} onNavigate={navigate} />
            )}
          </div>

          {/* Quick Links Widget */}
          {isWidgetVisible('quickLinks') && (
            <DashboardQuickLinks
              reportsQuickLink={reportsQuickLink}
              quickActionProjectId={reportsProject?.id}
            />
          )}

          {/* No widgets visible message */}
          {visibleWidgets.length === 0 && (
            <div className="bg-muted/50 rounded-lg border-2 border-dashed p-8 text-center">
              <Settings2 className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">
                No widgets visible. Click "Customize" above to add widgets to your dashboard.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PendingInvitationBanner({ user }: { user: DashboardUser }) {
  const { data } = useQuery({
    queryKey: queryKeys.pendingSubcontractorInvitation(user?.id),
    queryFn: () =>
      apiFetch<{ invitation: PendingInvitation | null }>(
        '/api/subcontractors/my-pending-invitation',
      ),
    enabled: Boolean(user?.id),
    retry: false,
  });

  const invitation = data?.invitation;
  if (!invitation) {
    return null;
  }

  return (
    <section
      role="region"
      aria-label="Pending subcontractor invitation"
      className="rounded-lg border border-l-2 border-l-warning bg-card px-4 py-3 text-foreground"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div>
            <p className="font-medium">Pending subcontractor invitation</p>
            <p className="text-sm text-muted-foreground">
              Accept your invite to {invitation.companyName} on {invitation.projectName}.
            </p>
          </div>
        </div>
        <Link
          to="/invitations"
          className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:shrink-0"
        >
          Accept Invitation
        </Link>
      </div>
    </section>
  );
}
