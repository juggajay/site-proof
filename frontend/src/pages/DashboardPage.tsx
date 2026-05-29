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
import { QualityManagerDashboard } from '@/components/dashboard/QualityManagerDashboard';
import { ProjectManagerDashboard } from '@/components/dashboard/ProjectManagerDashboard';
import { SubcontractorDashboard } from '@/pages/subcontractor-portal/SubcontractorDashboard';
import { hasSubcontractorPortalIdentity } from '@/lib/subcontractorIdentity';
import { Button } from '@/components/ui/button';
import {
  FolderKanban,
  AlertTriangle,
  Clock,
  FileText,
  Settings2,
  Download,
  AlertCircle,
  ChevronRight,
  Calendar,
  RefreshCw,
  Camera,
  Plus,
  FlaskConical,
  MailCheck,
} from 'lucide-react';

function getSafeInternalLink(link: string | undefined, fallback: string): string {
  if (link?.startsWith('/') && !link.startsWith('//')) {
    return link;
  }
  return fallback;
}

interface AttentionItem {
  id: string;
  type: 'ncr' | 'holdpoint';
  title: string;
  description: string;
  status: string;
  daysOverdue?: number;
  daysStale?: number;
  dueDate?: string;
  project: {
    id: string;
    name: string;
    projectNumber: string;
  };
  link: string;
}

interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  totalLots: number;
  lotStatusCounts?: Partial<LotStatusCounts>;
  openHoldPoints: number;
  openNCRs: number;
  attentionItems: {
    overdueNCRs: AttentionItem[];
    staleHoldPoints: AttentionItem[];
    total: number;
  };
  recentActivities: DashboardRecentActivity[];
}

interface DashboardProject {
  id: string;
  status?: string | null;
}

type DashboardUser = ReturnType<typeof useAuth>['user'];
type DashboardRoleUser = NonNullable<DashboardUser> & {
  roleInCompany?: string | null;
  dashboardRole?: 'project_manager' | 'quality_manager' | 'foreman' | null;
};

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
  const roleUser = user as DashboardRoleUser | null;
  const userRole = roleUser?.roleInCompany || roleUser?.role;
  const dashboardRole = roleUser?.dashboardRole || userRole;
  const isSubcontractor = hasSubcontractorPortalIdentity(roleUser);
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

  return (
    <div className="space-y-6 dashboard-content">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
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
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-medium">Dashboard data could not be loaded.</p>
              <p className="text-sm mt-1">{statsErrorMessage}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="border-red-200 hover:bg-red-100 sm:shrink-0"
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
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800"
        >
          <p className="font-medium">Dashboard PDF could not be generated.</p>
          <p className="text-sm mt-1">{pdfError}</p>
        </div>
      )}

      {hasHardStatsError ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          Dashboard metrics are unavailable until the data loads successfully.
        </div>
      ) : (
        <>
          {/* Date Range Indicator */}
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>
              Showing data from {currentDateRange.startDate} to {currentDateRange.endDate}
            </span>
          </div>

          {/* Items Requiring Attention Widget */}
          {isWidgetVisible('attentionItems') && stats.attentionItems.total > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg">
              <div className="p-4 border-b border-red-200 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <h2 className="text-lg font-semibold text-red-700">Items Requiring Attention</h2>
                <span className="ml-auto bg-red-100 text-red-700 text-sm font-medium px-2.5 py-0.5 rounded-full">
                  {stats.attentionItems.total}
                </span>
              </div>
              <div className="divide-y divide-red-100">
                {/* Overdue NCRs */}
                {stats.attentionItems.overdueNCRs.length > 0 && (
                  <div className="p-4">
                    <h3 className="text-sm font-semibold text-red-600 mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Overdue NCRs ({stats.attentionItems.overdueNCRs.length})
                    </h3>
                    <div className="space-y-2">
                      {stats.attentionItems.overdueNCRs.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => navigate(getSafeInternalLink(item.link, '/projects'))}
                          className="w-full flex items-center justify-between p-3 bg-white rounded-lg border border-red-100 hover:border-red-300 hover:bg-red-50 transition-colors text-left"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{item.title}</span>
                              <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">
                                {item.daysOverdue} day{item.daysOverdue !== 1 ? 's' : ''} overdue
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-1">
                              {item.project.name} • {item.description}
                            </p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Stale Hold Points */}
                {stats.attentionItems.staleHoldPoints.length > 0 && (
                  <div className="p-4">
                    <h3 className="text-sm font-semibold text-amber-600 mb-2 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Stale Hold Points ({stats.attentionItems.staleHoldPoints.length})
                    </h3>
                    <div className="space-y-2">
                      {stats.attentionItems.staleHoldPoints.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => navigate(getSafeInternalLink(item.link, '/projects'))}
                          className="w-full flex items-center justify-between p-3 bg-white rounded-lg border border-amber-100 hover:border-amber-300 hover:bg-amber-50 transition-colors text-left"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{item.title}</span>
                              <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded">
                                {item.daysStale} day{item.daysStale !== 1 ? 's' : ''} waiting
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-1">
                              {item.project.name} • {item.description}
                            </p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Project Summary Widget */}
          {isWidgetVisible('projectSummary') && (
            <DashboardKpiTiles
              totalProjects={stats.totalProjects}
              activeProjects={stats.activeProjects}
              totalLots={stats.totalLots}
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
            <div className="bg-card rounded-lg border">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold">Quick Links</h2>
              </div>
              <div className="p-4 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                <Link
                  to="/projects"
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors"
                >
                  <FolderKanban className="h-5 w-5 text-blue-600" />
                  <span className="font-medium">Projects</span>
                </Link>
                <Link
                  to="/portfolio"
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors"
                >
                  <FileText className="h-5 w-5 text-purple-600" />
                  <span className="font-medium">Portfolio</span>
                </Link>
                <Link
                  to={reportsQuickLink}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors"
                >
                  <FileText className="h-5 w-5 text-green-600" />
                  <span className="font-medium">Reports</span>
                </Link>
                <Link
                  to="/settings"
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors"
                >
                  <Settings2 className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">Settings</span>
                </Link>
              </div>
              {/* Feature #500: Quick Actions */}
              <div className="px-4 pb-4">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Quick Actions</h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Link
                    to="/projects?action=photo"
                    className="flex items-center gap-3 p-3 rounded-lg bg-orange-50 border border-orange-200 hover:bg-orange-100 transition-colors"
                  >
                    <Camera className="h-5 w-5 text-orange-600" />
                    <span className="font-medium text-orange-700">Quick Photo</span>
                  </Link>
                  <Link
                    to="/projects?action=create-lot"
                    className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors"
                  >
                    <Plus className="h-5 w-5 text-blue-600" />
                    <span className="font-medium text-blue-700">Create Lot</span>
                  </Link>
                  <Link
                    to="/projects?action=add-test"
                    className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200 hover:bg-green-100 transition-colors"
                  >
                    <FlaskConical className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-700">Add Test</span>
                  </Link>
                </div>
              </div>
            </div>
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
      className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-medium">Pending subcontractor invitation</p>
            <p className="text-sm">
              Accept your invite to {invitation.companyName} on {invitation.projectName}.
            </p>
          </div>
        </div>
        <Link
          to="/invitations"
          className="inline-flex items-center justify-center rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700 sm:shrink-0"
        >
          Accept Invitation
        </Link>
      </div>
    </section>
  );
}
