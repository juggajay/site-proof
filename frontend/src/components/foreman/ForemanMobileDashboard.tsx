// ForemanMobileDashboard - Mobile-optimized dashboard for foreman role
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { extractErrorMessage } from '@/lib/errorHandling';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import {
  RefreshCw,
  Calendar,
  FileText,
  ClipboardCheck,
  Clock,
  CheckCircle2,
  Plus,
  ChevronRight,
  Users,
  Truck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DashboardCard, DashboardStat } from './DashboardCard';
import { WeatherWidget } from './WeatherWidget';
import { QuickCaptureButton } from './QuickCaptureButton';
import { PhotoCaptureModal } from './PhotoCaptureModal';
import { useForemanMobileStore } from '@/stores/foremanMobileStore';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

interface DashboardData {
  todayDiary: {
    exists: boolean;
    status: 'draft' | 'submitted' | null;
    id: string | null;
  };
  pendingDockets: {
    count: number;
    totalLabourHours: number;
    totalPlantHours: number;
  };
  inspectionsDueToday: {
    count: number;
    items: Array<{
      id: string;
      type: string;
      description: string;
      lotNumber: string;
      link: string;
    }>;
  };
  weather: {
    conditions: string | null;
    temperatureMin: number | null;
    temperatureMax: number | null;
    rainfallMm: number | null;
  };
  project: {
    id: string;
    name: string;
    projectNumber: string;
  } | null;
}

function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

function formatDateForUrl(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getSafeInternalLink(link: string | undefined, fallback: string): string {
  if (link?.startsWith('/') && !link.startsWith('//')) {
    return link;
  }
  return fallback;
}

export function ForemanMobileDashboard() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isCameraOpen, setIsCameraOpen } = useForemanMobileStore();
  useOnlineStatus(); // Initialize online status tracking

  const [refreshing, setRefreshing] = useState(false);

  const defaultData: DashboardData = {
    todayDiary: { exists: false, status: null, id: null },
    pendingDockets: { count: 0, totalLabourHours: 0, totalPlantHours: 0 },
    inspectionsDueToday: { count: 0, items: [] },
    weather: { conditions: null, temperatureMin: null, temperatureMax: null, rainfallMm: null },
    project: null,
  };

  const queryKeyId = projectId || 'default';

  const {
    data: dashboardData,
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.foremanDashboard(queryKeyId),
    queryFn: () => apiFetch<DashboardData>('/api/dashboard/foreman'),
  });
  const data = dashboardData ?? defaultData;
  const errorMessage = error
    ? extractErrorMessage(error, 'Failed to load foreman dashboard')
    : null;
  const hasHardError = Boolean(errorMessage && !dashboardData);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const today = new Date().toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });

  // Quick action handlers - use effectiveProjectId (from URL or API) for navigation
  const getProjectPath = (path: string) => {
    const pid = projectId || data.project?.id;
    return pid ? `/projects/${encodeURIComponent(pid)}/${path}` : '/projects';
  };
  const handleCapturePhoto = () => setIsCameraOpen(true);
  const handleAddDelay = () => navigate(getProjectPath('diary?tab=delays'));
  const handleRaiseNCR = () => navigate(getProjectPath('ncr?create=1'));
  const handleAddNote = () => navigate(getProjectPath('diary'));
  const handleRequestHoldPoint = () => navigate(getProjectPath('hold-points'));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const effectiveProjectId = projectId || data.project?.id;

  if (hasHardError) {
    return (
      <div className="pb-28 md:pb-6 overflow-x-hidden">
        <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 md:px-6 md:py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl md:text-2xl font-bold">
                Good {getTimeOfDay()}, {user?.fullName?.split(' ')[0] || 'Foreman'}!
              </h1>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {today}
              </p>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={refreshing}
              className="touch-manipulation min-h-[44px] min-w-[44px]"
              aria-label="Try again"
            >
              <RefreshCw className={cn('h-5 w-5', refreshing && 'animate-spin')} />
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-4 md:p-6 md:space-y-6">
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            <p className="font-medium">Foreman dashboard could not be loaded.</p>
            <p className="mt-1 text-sm">{errorMessage}</p>
          </div>
        </div>
      </div>
    );
  }

  // If no project is available, show a message to select/join a project
  if (!effectiveProjectId) {
    return (
      <div className="pb-28 md:pb-6 overflow-x-hidden">
        <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 md:px-6 md:py-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">
              Good {getTimeOfDay()}, {user?.fullName?.split(' ')[0] || 'Foreman'}!
            </h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {today}
            </p>
          </div>
        </div>

        <div className="p-4 space-y-4 md:p-6 md:space-y-6">
          <div className="bg-card rounded-lg border p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <ClipboardCheck className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold mb-2">No Project Assigned</h2>
            <p className="text-muted-foreground mb-4">
              You need to be assigned to a project before you can access the foreman dashboard
              features.
            </p>
            <Button
              onClick={() => navigate('/projects')}
              className="touch-manipulation min-h-[44px]"
            >
              View Projects
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-28 md:pb-6 overflow-x-hidden">
      {/* Header - optimized for mobile */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 md:px-6 md:py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">
              Good {getTimeOfDay()}, {user?.fullName?.split(' ')[0] || 'Foreman'}!
            </h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {today}
            </p>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
            className="touch-manipulation min-h-[44px] min-w-[44px]"
          >
            <RefreshCw className={cn('h-5 w-5', refreshing && 'animate-spin')} />
          </Button>
        </div>

        {/* Project context */}
        {data.project && (
          <div className="mt-2 text-sm text-muted-foreground border-l-4 border-primary pl-2">
            {data.project.name}
            {data.project.projectNumber && ` (${data.project.projectNumber})`}
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="p-4 space-y-4 md:p-6 md:space-y-6">
        {errorMessage && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            <p className="font-medium">Foreman dashboard data could not be refreshed.</p>
            <p className="mt-1 text-sm">{errorMessage}</p>
          </div>
        )}

        {/* Weather Widget */}
        <WeatherWidget weather={data.weather} />

        {/* Diary & Dockets Grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Today's Diary */}
          <DashboardCard
            title="Today's Diary"
            icon={<FileText className="h-5 w-5" />}
            badge={
              data.todayDiary.status === 'submitted'
                ? 'Submitted'
                : data.todayDiary.exists
                  ? 'Draft'
                  : 'Not Started'
            }
            badgeVariant={
              data.todayDiary.status === 'submitted'
                ? 'success'
                : data.todayDiary.exists
                  ? 'warning'
                  : 'default'
            }
            onClick={() =>
              navigate(
                effectiveProjectId
                  ? `/projects/${effectiveProjectId}/diary?date=${formatDateForUrl(new Date())}`
                  : `/diary?date=${formatDateForUrl(new Date())}`,
              )
            }
          >
            {data.todayDiary.exists ? (
              <p className="text-sm text-muted-foreground">
                {data.todayDiary.status === 'submitted'
                  ? 'Diary submitted for today'
                  : 'Diary started but not submitted'}
              </p>
            ) : (
              <div className="flex items-center gap-2 text-primary">
                <Plus className="h-4 w-4" />
                <span className="text-sm font-medium">Start Today's Diary</span>
              </div>
            )}
          </DashboardCard>

          {/* Pending Dockets */}
          <DashboardCard
            title="Pending Dockets"
            icon={<ClipboardCheck className="h-5 w-5" />}
            badge={
              data.pendingDockets.count > 0 ? `${data.pendingDockets.count} pending` : undefined
            }
            badgeVariant="warning"
            onClick={() =>
              navigate(
                effectiveProjectId
                  ? `/projects/${effectiveProjectId}/dockets?status=pending_approval`
                  : '/dockets?status=pending_approval',
              )
            }
          >
            {data.pendingDockets.count > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                <DashboardStat
                  label="Labour"
                  value={`${data.pendingDockets.totalLabourHours}h`}
                  icon={<Users className="h-4 w-4" />}
                />
                <DashboardStat
                  label="Plant"
                  value={`${data.pendingDockets.totalPlantHours}h`}
                  icon={<Truck className="h-4 w-4" />}
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-sm">All dockets reviewed</span>
              </div>
            )}
          </DashboardCard>
        </div>

        {/* Inspections Due */}
        <DashboardCard
          title="Inspections Due Today"
          icon={<Clock className="h-5 w-5" />}
          badge={
            data.inspectionsDueToday.count > 0 ? `${data.inspectionsDueToday.count} due` : undefined
          }
          badgeVariant="warning"
        >
          {data.inspectionsDueToday.count > 0 ? (
            <div className="space-y-2">
              {data.inspectionsDueToday.items.slice(0, 3).map((item) => (
                <button
                  key={item.id}
                  onClick={() =>
                    navigate(getSafeInternalLink(item.link, getProjectPath('hold-points')))
                  }
                  className={cn(
                    'w-full flex items-center justify-between p-3',
                    'bg-muted/30 rounded-lg',
                    'active:bg-muted/50 transition-colors',
                    'touch-manipulation min-h-[48px]',
                  )}
                >
                  <div className="text-left">
                    <p className="font-medium text-sm">{item.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.type} • Lot {item.lotNumber}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </button>
              ))}
              {data.inspectionsDueToday.count > 3 && (
                <Link
                  to={
                    effectiveProjectId
                      ? `/projects/${effectiveProjectId}/hold-points`
                      : '/hold-points'
                  }
                  className="block text-center text-sm text-primary py-2"
                >
                  View all {data.inspectionsDueToday.count} inspections
                </Link>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm">No inspections scheduled for today</span>
            </div>
          )}
        </DashboardCard>
      </div>

      {/* Quick Capture FAB */}
      <QuickCaptureButton
        onCapturePhoto={handleCapturePhoto}
        onAddDelay={handleAddDelay}
        onRaiseNCR={handleRaiseNCR}
        onAddNote={handleAddNote}
        onRequestHoldPointRelease={handleRequestHoldPoint}
      />

      {/* Photo Capture Modal */}
      {isCameraOpen && effectiveProjectId && (
        <PhotoCaptureModal projectId={effectiveProjectId} onClose={() => setIsCameraOpen(false)} />
      )}

      {/* Bottom Navigation is rendered by MobileNav in MainLayout for foreman users */}
    </div>
  );
}
