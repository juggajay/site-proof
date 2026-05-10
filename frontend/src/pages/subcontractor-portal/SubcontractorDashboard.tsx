import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin,
  Bell,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  MessageSquare,
  ChevronRight,
  Plus,
  RefreshCw,
  Building2,
  Calendar,
  ClipboardList,
  FlaskConical,
  FolderOpen,
  Hand,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { isPortalModuleEnabled } from './portalAccessModel';

interface PortalAccess {
  lots: boolean;
  itps: boolean;
  holdPoints: boolean;
  testResults: boolean;
  ncrs: boolean;
  documents: boolean;
}

interface Company {
  id: string;
  companyName: string;
  projectId: string;
  projectName: string;
  employees: Array<{
    id: string;
    name: string;
    status: string;
  }>;
  plant: Array<{
    id: string;
    type: string;
    status: string;
  }>;
  portalAccess?: PortalAccess;
}

interface Docket {
  id: string;
  docketNumber: string;
  date: string;
  status: string;
  totalLabourSubmitted: number;
  totalPlantSubmitted: number;
  foremanNotes?: string;
}

interface Lot {
  id: string;
  lotNumber: string;
  activity?: string;
  status: string;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  linkUrl?: string;
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function getDocketStatusIcon(status: string) {
  switch (status) {
    case 'draft':
      return <Clock className="h-5 w-5 text-muted-foreground" />;
    case 'pending_approval':
      return <Clock className="h-5 w-5 text-amber-500" />;
    case 'approved':
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case 'rejected':
      return <XCircle className="h-5 w-5 text-red-500" />;
    case 'queried':
      return <MessageSquare className="h-5 w-5 text-amber-500" />;
    default:
      return <Clock className="h-5 w-5 text-muted-foreground" />;
  }
}

function getDocketStatusBadge(status: string) {
  const variants: Record<string, string> = {
    draft: 'bg-muted text-foreground',
    pending_approval: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100',
    approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
    rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
    queried: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100',
  };
  const labels: Record<string, string> = {
    draft: 'Draft',
    pending_approval: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    queried: 'Queried',
  };
  return (
    <span
      className={cn(
        'px-2 py-1 text-xs font-medium rounded-full',
        variants[status] || variants.draft,
      )}
    >
      {labels[status] || status}
    </span>
  );
}

export function SubcontractorDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: queryKeys.portalCompanies,
    queryFn: async () => {
      const res = await apiFetch<{ company: Company }>('/api/subcontractors/my-company');
      return res.company;
    },
  });

  const { data: docketsData } = useQuery({
    queryKey: queryKeys.portalDockets,
    queryFn: async () => {
      const res = await apiFetch<{ dockets: Docket[] }>(
        `/api/dockets?projectId=${company!.projectId}`,
      );
      return res.dockets || [];
    },
    enabled: !!company?.projectId,
  });

  const today = getToday();
  const todaysDocket = docketsData?.find((d: Docket) => d.date === today) ?? null;
  const recentDockets = docketsData?.filter((d: Docket) => d.date !== today).slice(0, 5) ?? [];
  const canViewAssignedLots = isPortalModuleEnabled(company, 'lots');

  const { data: assignedLots = [] } = useQuery({
    queryKey: queryKeys.portalAssignedWork,
    queryFn: async () => {
      const res = await apiFetch<{ lots: Lot[] }>(
        `/api/lots?projectId=${company!.projectId}&portalModule=lots`,
      );
      return res.lots.slice(0, 5);
    },
    enabled: !!company?.projectId && canViewAssignedLots,
  });

  const { data: notifData } = useQuery({
    queryKey: queryKeys.portalDashboard,
    queryFn: () =>
      apiFetch<{ notifications: Notification[]; unreadCount: number }>(
        '/api/notifications?limit=10',
      ),
    enabled: !!company,
  });

  const notifications = notifData?.notifications || [];
  const unreadCount = notifData?.unreadCount || 0;

  const loading = companyLoading;

  const handleRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: queryKeys.portalCompanies });
    await queryClient.invalidateQueries({ queryKey: queryKeys.portalDockets });
    await queryClient.invalidateQueries({ queryKey: queryKeys.portalAssignedWork });
    await queryClient.invalidateQueries({ queryKey: queryKeys.portalDashboard });
    setRefreshing(false);
  };

  // Get items needing attention
  const needsAttention = [
    // Queried dockets
    ...recentDockets
      .filter((d) => d.status === 'queried')
      .map((d) => ({
        id: d.id,
        type: 'docket_queried',
        title: 'Docket Queried',
        message: d.foremanNotes || 'Please review and respond',
        date: d.date,
        link: `/subcontractor-portal/docket/${d.id}`,
      })),
    // Rejected dockets
    ...recentDockets
      .filter((d) => d.status === 'rejected')
      .map((d) => ({
        id: d.id,
        type: 'docket_rejected',
        title: 'Docket Rejected',
        message: d.foremanNotes || 'Please review and resubmit',
        date: d.date,
        link: `/subcontractor-portal/docket/${d.id}`,
      })),
    // Rate counter-proposals from notifications
    ...notifications
      .filter((n) => n.type === 'rate_counter' && !n.isRead)
      .map((n) => ({
        id: n.id,
        type: 'rate_counter',
        title: n.title,
        message: n.message,
        date: n.createdAt,
        link: '/my-company',
      })),
  ];

  if (loading) {
    return (
      <div className="container max-w-2xl mx-auto p-4 pb-20 md:pb-4 space-y-6">
        {/* Header skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        {/* Today's docket skeleton */}
        <Skeleton className="h-48 w-full rounded-lg" />
        {/* Needs attention skeleton */}
        <Skeleton className="h-32 w-full rounded-lg" />
        {/* Lots skeleton */}
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto p-4 pb-20 md:pb-4 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {getGreeting()}, {user?.fullName?.split(' ')[0] || 'there'}
          </h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
            <Building2 className="h-4 w-4" />
            {company?.companyName || 'Your Company'}
          </p>
          <p className="text-sm text-muted-foreground">{company?.projectName || 'Project'}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw
              className={cn('h-5 w-5 text-muted-foreground', refreshing && 'animate-spin')}
            />
          </Button>
          <Link to="/settings" className="relative p-2 rounded-lg hover:bg-muted transition-colors">
            <Bell className="h-5 w-5 text-muted-foreground" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-white text-xs flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Today's Docket Card */}
      <div className="border-2 border-border rounded-lg bg-card">
        <div className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Today's Docket</h2>
            </div>
            {todaysDocket && getDocketStatusBadge(todaysDocket.status)}
          </div>
          <p className="text-sm text-muted-foreground mt-1">{formatDate(getToday())}</p>
        </div>
        <div className="p-4 pt-2">
          {todaysDocket ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Labour</p>
                  <p className="text-lg font-semibold text-foreground">
                    {formatCurrency(todaysDocket.totalLabourSubmitted)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Plant</p>
                  <p className="text-lg font-semibold text-foreground">
                    {formatCurrency(todaysDocket.totalPlantSubmitted)}
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-border">
                <p className="text-sm text-muted-foreground mb-1">Total</p>
                <p className="text-xl font-bold text-foreground">
                  {formatCurrency(
                    todaysDocket.totalLabourSubmitted + todaysDocket.totalPlantSubmitted,
                  )}
                </p>
              </div>
              <Link
                to={`/subcontractor-portal/docket/${todaysDocket.id}`}
                className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-primary hover:bg-primary/90 text-white font-medium rounded-lg transition-colors"
              >
                {todaysDocket.status === 'draft' ? 'Continue Docket' : 'View Docket'}
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-4">No docket started for today</p>
              <Link
                to="/subcontractor-portal/docket/new"
                className="inline-flex items-center gap-2 py-2.5 px-4 bg-primary hover:bg-primary/90 text-white font-medium rounded-lg transition-colors"
              >
                <Plus className="h-4 w-4" />
                Start Today's Docket
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Needs Attention */}
      {needsAttention.length > 0 && (
        <div className="border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 rounded-lg">
          <div className="p-4 pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <h2 className="text-lg font-semibold text-foreground">
                Needs Attention ({needsAttention.length})
              </h2>
            </div>
          </div>
          <div className="p-4 pt-2 space-y-3">
            {needsAttention.slice(0, 3).map((item) => (
              <Link
                key={item.id}
                to={item.link}
                className="block p-3 bg-card rounded-lg border border-border hover:border-primary transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground">{item.title}</p>
                    <p className="text-sm text-muted-foreground truncate">{item.message}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Assigned Lots - Only show if portal access allows */}
      {canViewAssignedLots && (
        <div className="border border-border rounded-lg bg-card">
          <div className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold text-foreground">Assigned Lots</h2>
              </div>
              <span className="px-2 py-1 text-xs font-medium bg-muted text-muted-foreground rounded-full">
                {assignedLots.length}
              </span>
            </div>
          </div>
          <div className="p-4 pt-2">
            {assignedLots.length > 0 ? (
              <div className="space-y-2">
                {assignedLots.map((lot) => (
                  <div
                    key={lot.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-foreground">{lot.lotNumber}</span>
                      {lot.activity && (
                        <span className="text-sm text-muted-foreground">- {lot.activity}</span>
                      )}
                    </div>
                  </div>
                ))}
                <Link
                  to="/subcontractor-portal/work"
                  className="flex items-center justify-center gap-2 w-full py-2 text-sm text-muted-foreground hover:text-primary transition-colors mt-2"
                >
                  View All Work
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">
                No lots assigned yet. Contact your project manager.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Recent Dockets */}
      <div className="border border-border rounded-lg bg-card">
        <div className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Recent Dockets</h2>
            <Link
              to="/subcontractor-portal/dockets"
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              View All
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
        <div className="p-4 pt-2">
          {recentDockets.length > 0 ? (
            <div className="space-y-2">
              {recentDockets.slice(0, 3).map((docket) => (
                <Link
                  key={docket.id}
                  to={`/subcontractor-portal/docket/${docket.id}`}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {getDocketStatusIcon(docket.status)}
                    <div>
                      <p className="font-medium text-foreground">{formatDate(docket.date)}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(docket.totalLabourSubmitted + docket.totalPlantSubmitted)}
                      </p>
                    </div>
                  </div>
                  {getDocketStatusBadge(docket.status)}
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">No previous dockets</p>
          )}
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/my-company"
          className="border border-border rounded-lg bg-card hover:border-primary transition-colors cursor-pointer"
        >
          <div className="p-4 flex items-center gap-3">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium text-foreground">My Company</p>
              <p className="text-xs text-muted-foreground">Manage roster & plant</p>
            </div>
          </div>
        </Link>
        <Link
          to="/subcontractor-portal/dockets"
          className="border border-border rounded-lg bg-card hover:border-primary transition-colors cursor-pointer"
        >
          <div className="p-4 flex items-center gap-3">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium text-foreground">All Dockets</p>
              <p className="text-xs text-muted-foreground">View history</p>
            </div>
          </div>
        </Link>
        {/* Portal Access - ITPs */}
        {company?.portalAccess?.itps && (
          <Link
            to="/subcontractor-portal/itps"
            className="border border-border rounded-lg bg-card hover:border-primary transition-colors cursor-pointer"
          >
            <div className="p-4 flex items-center gap-3">
              <ClipboardList className="h-5 w-5 text-green-500" />
              <div>
                <p className="font-medium text-foreground">ITPs</p>
                <p className="text-xs text-muted-foreground">Inspection & Test Plans</p>
              </div>
            </div>
          </Link>
        )}
        {/* Portal Access - Hold Points */}
        {company?.portalAccess?.holdPoints && (
          <Link
            to="/subcontractor-portal/holdpoints"
            className="border border-border rounded-lg bg-card hover:border-primary transition-colors cursor-pointer"
          >
            <div className="p-4 flex items-center gap-3">
              <Hand className="h-5 w-5 text-amber-500" />
              <div>
                <p className="font-medium text-foreground">Hold Points</p>
                <p className="text-xs text-muted-foreground">View hold points</p>
              </div>
            </div>
          </Link>
        )}
        {/* Portal Access - Test Results */}
        {company?.portalAccess?.testResults && (
          <Link
            to="/subcontractor-portal/tests"
            className="border border-border rounded-lg bg-card hover:border-primary transition-colors cursor-pointer"
          >
            <div className="p-4 flex items-center gap-3">
              <FlaskConical className="h-5 w-5 text-blue-500" />
              <div>
                <p className="font-medium text-foreground">Test Results</p>
                <p className="text-xs text-muted-foreground">View test results</p>
              </div>
            </div>
          </Link>
        )}
        {/* Portal Access - NCRs */}
        {company?.portalAccess?.ncrs && (
          <Link
            to="/subcontractor-portal/ncrs"
            className="border border-border rounded-lg bg-card hover:border-primary transition-colors cursor-pointer"
          >
            <div className="p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <div>
                <p className="font-medium text-foreground">NCRs</p>
                <p className="text-xs text-muted-foreground">Non-conformance reports</p>
              </div>
            </div>
          </Link>
        )}
        {/* Portal Access - Documents */}
        {company?.portalAccess?.documents && (
          <Link
            to="/subcontractor-portal/documents"
            className="border border-border rounded-lg bg-card hover:border-primary transition-colors cursor-pointer"
          >
            <div className="p-4 flex items-center gap-3">
              <FolderOpen className="h-5 w-5 text-purple-500" />
              <div>
                <p className="font-medium text-foreground">Documents</p>
                <p className="text-xs text-muted-foreground">Project documents</p>
              </div>
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
