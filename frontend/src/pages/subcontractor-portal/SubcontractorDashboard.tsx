import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  MapPin,
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { isPortalModuleEnabled } from './portalAccessModel';
import {
  buildNeedsAttentionItems,
  formatCurrency,
  formatDate,
  getDocketPrerequisiteState,
  getDocketStatusMeta,
  getGreeting,
  getToday,
  LOTS_MODULE_DISABLED_DOCKET_MESSAGE,
} from './subcontractorDashboardHelpers';
import {
  buildDocketEditRoute,
  getDocketDisplayLabourCost,
  getDocketDisplayPlantCost,
  getDocketDisplayTotalCost,
} from './docketEditData';
import { PortalQuickLinks } from './SubcontractorDashboardSections';

interface PortalAccess {
  lots: boolean;
  itps: boolean;
  holdPoints: boolean;
  testResults: boolean;
  ncrs: boolean;
  documents: boolean;
}

interface PortalProjectOption {
  id: string;
  companyName: string;
  projectId: string;
  projectName: string;
  status: string;
  portalAccess?: PortalAccess;
}

export interface Company {
  id: string;
  companyName: string;
  projectId: string;
  projectName: string;
  availableProjects?: PortalProjectOption[];
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
  totalLabourApprovedCost?: number | null;
  totalPlantApprovedCost?: number | null;
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

function getDocketStatusIcon(status: string) {
  switch (status) {
    case 'draft':
      return <Clock className="h-5 w-5 text-muted-foreground" />;
    case 'pending_approval':
      return <Clock className="h-5 w-5 text-warning" />;
    case 'approved':
      return <CheckCircle className="h-5 w-5 text-success" />;
    case 'rejected':
      return <XCircle className="h-5 w-5 text-destructive" />;
    case 'queried':
      return <MessageSquare className="h-5 w-5 text-warning" />;
    default:
      return <Clock className="h-5 w-5 text-muted-foreground" />;
  }
}

// Status pills earn colour because docket status literally means cash for the
// subbie (approved = paid). Map each status to the semantic token pair; benign
// states (draft/submitted) stay neutral.
const DOCKET_STATUS_PILL_CLASSES: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  pending_approval: 'bg-warning/10 text-warning',
  approved: 'bg-success/10 text-success',
  rejected: 'bg-destructive/10 text-destructive',
  queried: 'bg-warning/10 text-warning',
};

function getDocketStatusBadge(status: string) {
  const { label } = getDocketStatusMeta(status);
  const className = DOCKET_STATUS_PILL_CLASSES[status] ?? DOCKET_STATUS_PILL_CLASSES.draft;
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide rounded-full',
        className,
      )}
    >
      {label}
    </span>
  );
}

export function SubcontractorDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedProjectId = searchParams.get('projectId');
  const [refreshing, setRefreshing] = useState(false);

  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: [...queryKeys.portalCompanies(user?.id), requestedProjectId ?? 'default'],
    queryFn: async () => {
      const query = requestedProjectId
        ? `?projectId=${encodeURIComponent(requestedProjectId)}`
        : '';
      const res = await apiFetch<{ company: Company }>(`/api/subcontractors/my-company${query}`);
      return res.company;
    },
    enabled: !!user?.id,
  });

  const { data: docketsData } = useQuery({
    queryKey: queryKeys.portalDockets(user?.id, company?.projectId),
    queryFn: async () => {
      const res = await apiFetch<{ dockets: Docket[] }>(
        `/api/dockets?projectId=${company!.projectId}`,
      );
      return res.dockets || [];
    },
    enabled: !!user?.id && !!company?.projectId,
  });

  const today = getToday();
  const todaysDocket = docketsData?.find((d: Docket) => d.date === today) ?? null;
  const recentDockets = docketsData?.filter((d: Docket) => d.date !== today).slice(0, 5) ?? [];
  const canViewAssignedLots = isPortalModuleEnabled(company, 'lots');

  const { data: assignedLots = [] } = useQuery({
    queryKey: queryKeys.portalAssignedWork(user?.id, company?.projectId),
    queryFn: async () => {
      const res = await apiFetch<{ lots: Lot[] }>(
        `/api/lots?projectId=${company!.projectId}&portalModule=lots`,
      );
      return res.lots.slice(0, 5);
    },
    enabled: !!user?.id && !!company?.projectId && canViewAssignedLots,
  });

  const { data: notifData } = useQuery({
    queryKey: queryKeys.portalDashboard(user?.id),
    queryFn: () =>
      apiFetch<{ notifications: Notification[]; unreadCount: number }>(
        '/api/notifications?limit=10',
      ),
    enabled: !!user?.id && !!company,
  });

  const notifications = notifData?.notifications || [];
  const projectOptions = company?.availableProjects || [];
  const showProjectSwitcher = projectOptions.length > 1;
  const currentProjectQuery = company?.projectId
    ? `?projectId=${encodeURIComponent(company.projectId)}`
    : '';
  const myCompanyLink = `/my-company${currentProjectQuery}`;
  const newDocketLink = `/subcontractor-portal/docket/new${currentProjectQuery}`;

  // Docket prerequisites: a subbie needs at least one approved employee or plant
  // item (rates approved) to add anything, and — when the lots module is on — at
  // least one assigned lot to allocate labour against. When the lots module is
  // OFF, labour dockets are impossible (the backend 403s the lot list and the
  // submit guard requires a lot), so the empty state warns instead of silently
  // claiming the subbie is ready. When these are missing the "start docket"
  // empty state explains the next steps instead of dead-ending.
  const approvedEmployees = company?.employees?.filter((e) => e.status === 'approved') ?? [];
  const approvedPlant = company?.plant?.filter((p) => p.status === 'approved') ?? [];
  const {
    hasDocketResources,
    needsLotAssignment,
    lotsModuleDisabled,
    prerequisitesMet: docketPrerequisitesMet,
  } = getDocketPrerequisiteState({
    approvedEmployeeCount: approvedEmployees.length,
    approvedPlantCount: approvedPlant.length,
    lotsModuleEnabled: canViewAssignedLots,
    assignedLotCount: assignedLots.length,
  });

  const loading = companyLoading;

  const handleProjectChange = (projectId: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('projectId', projectId);
    setSearchParams(nextParams);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: queryKeys.portalCompanies(user?.id) });
    await queryClient.invalidateQueries({
      queryKey: queryKeys.portalDockets(user?.id, company?.projectId),
    });
    await queryClient.invalidateQueries({
      queryKey: queryKeys.portalAssignedWork(user?.id, company?.projectId),
    });
    await queryClient.invalidateQueries({ queryKey: queryKeys.portalDashboard(user?.id) });
    setRefreshing(false);
  };

  // Get items needing attention
  const needsAttention = buildNeedsAttentionItems({
    recentDockets,
    notifications,
    myCompanyLink,
  }).map((item) =>
    item.link.startsWith('/subcontractor-portal/docket/')
      ? { ...item, link: `${item.link}${currentProjectQuery}` }
      : item,
  );

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
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Refresh subcontractor portal"
          >
            <RefreshCw
              className={cn('h-5 w-5 text-muted-foreground', refreshing && 'animate-spin')}
            />
          </Button>
        </div>
      </div>

      {showProjectSwitcher && (
        <div className="rounded-lg border border-border bg-card p-4">
          <label
            htmlFor="portal-project-switcher"
            className="mb-2 block text-sm font-medium text-foreground"
          >
            Project
          </label>
          <select
            id="portal-project-switcher"
            value={company?.projectId || ''}
            onChange={(event) => handleProjectChange(event.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          >
            {projectOptions.map((option) => (
              <option key={option.projectId} value={option.projectId}>
                {option.projectName}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Today's Docket Card — the hero: submit today's docket */}
      <div className="border border-border rounded-lg bg-card shadow-sm">
        <div className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold text-foreground">Today's Docket</h2>
            </div>
            {todaysDocket && getDocketStatusBadge(todaysDocket.status)}
          </div>
          <p className="font-mono text-xs text-muted-foreground mt-1">{formatDate(getToday())}</p>
        </div>
        <div className="p-4 pt-2">
          {todaysDocket ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border">
                <div className="bg-card p-3">
                  <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Labour
                  </p>
                  <p className="mt-1.5 font-mono text-xl font-medium tabular-nums text-foreground">
                    {formatCurrency(getDocketDisplayLabourCost(todaysDocket))}
                  </p>
                </div>
                <div className="bg-card p-3">
                  <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Plant
                  </p>
                  <p className="mt-1.5 font-mono text-xl font-medium tabular-nums text-foreground">
                    {formatCurrency(getDocketDisplayPlantCost(todaysDocket))}
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-border">
                <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Total
                </p>
                <p className="font-mono text-xl font-semibold tabular-nums text-foreground">
                  {formatCurrency(getDocketDisplayTotalCost(todaysDocket))}
                </p>
              </div>
              <Link
                to={buildDocketEditRoute(todaysDocket.id, company?.projectId)}
                className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg transition-colors"
              >
                {todaysDocket.status === 'draft' ? 'Continue Docket' : 'View Docket'}
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="text-center py-4">
              {docketPrerequisitesMet ? (
                <p className="text-muted-foreground mb-4">No docket started for today</p>
              ) : (
                <div className="mb-4 text-left rounded-lg border border-warning/30 bg-warning/10 p-3 space-y-2">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                    <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                    Finish setup before filling out a docket
                  </p>
                  {!hasDocketResources && (
                    <p className="text-sm text-muted-foreground">
                      Add approved employees or plant in{' '}
                      <Link to={myCompanyLink} className="text-primary underline">
                        My Company
                      </Link>{' '}
                      and wait for rate approval.
                    </p>
                  )}
                  {needsLotAssignment && (
                    <p className="text-sm text-muted-foreground">
                      No lots assigned yet. Contact your project manager to get lot assignments.
                    </p>
                  )}
                  {lotsModuleDisabled && (
                    <p className="text-sm text-muted-foreground">
                      {LOTS_MODULE_DISABLED_DOCKET_MESSAGE}
                    </p>
                  )}
                </div>
              )}
              <Link
                to={newDocketLink}
                className="inline-flex items-center gap-2 py-2.5 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg transition-colors"
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
        <div className="border border-warning/30 bg-warning/10 rounded-lg">
          <div className="p-4 pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
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
              to={`/subcontractor-portal/dockets${currentProjectQuery}`}
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
                  to={buildDocketEditRoute(docket.id, company?.projectId)}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {getDocketStatusIcon(docket.status)}
                    <div>
                      <p className="font-medium text-foreground">{formatDate(docket.date)}</p>
                      <p className="font-mono text-sm tabular-nums text-muted-foreground">
                        {formatCurrency(getDocketDisplayTotalCost(docket))}
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

      <PortalQuickLinks
        company={company}
        currentProjectQuery={currentProjectQuery}
        myCompanyLink={myCompanyLink}
      />
    </div>
  );
}
