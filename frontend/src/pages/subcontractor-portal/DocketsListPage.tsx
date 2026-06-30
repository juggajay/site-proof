import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  AlertCircle,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  MessageSquare,
  ChevronRight,
  Plus,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { Skeleton } from '@/components/ui/Skeleton';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { extractErrorMessage } from '@/lib/errorHandling';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { formatDateKey } from '@/lib/localDate';
import { formatStatusLabel } from '@/lib/statusLabels';
import { buildDocketEditRoute, getDocketDisplayTotalCost } from './docketEditData';
import { buildPortalCompanyQuery, portalCompanyQueryKeyParts } from './portalCompanyScope';

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

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
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

// Docket status pills earn colour: status is cash (approved = paid). Benign
// states (draft) stay neutral; colour carries decision/exception meaning.
function getDocketStatusBadge(status: string) {
  const variants: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground',
    pending_approval: 'bg-warning/10 text-warning',
    approved: 'bg-success/10 text-success',
    rejected: 'bg-destructive/10 text-destructive',
    queried: 'bg-warning/10 text-warning',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide rounded-full',
        variants[status] || variants.draft,
      )}
    >
      {formatStatusLabel(status)}
    </span>
  );
}

export function DocketsListPage() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [searchParams] = useSearchParams();
  const requestedProjectId = searchParams.get('projectId');
  const requestedSubcontractorCompanyId = searchParams.get('subcontractorCompanyId');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const {
    data: company,
    isLoading: companyLoading,
    error: companyError,
  } = useQuery({
    queryKey: [
      ...queryKeys.portalCompanies(user?.id),
      ...portalCompanyQueryKeyParts({
        projectId: requestedProjectId,
        subcontractorCompanyId: requestedSubcontractorCompanyId,
      }),
    ],
    queryFn: async () => {
      const res = await apiFetch<{ company: { id: string; projectId: string } }>(
        `/api/subcontractors/my-company${buildPortalCompanyQuery({
          projectId: requestedProjectId,
          subcontractorCompanyId: requestedSubcontractorCompanyId,
        })}`,
      );
      return res.company;
    },
    enabled: !!user?.id,
  });

  const {
    data: dockets = [],
    isLoading: docketsLoading,
    error: docketsError,
  } = useQuery({
    queryKey: queryKeys.portalDockets(user?.id, company?.projectId, company?.id),
    queryFn: async () => {
      const res = await apiFetch<{ dockets: Docket[] }>(
        `/api/dockets${buildPortalCompanyQuery({
          projectId: company!.projectId,
          subcontractorCompanyId: company!.id,
        })}`,
      );
      return res.dockets || [];
    },
    enabled: !!user?.id && !!company?.projectId,
  });

  // Today's docket drives the primary CTA: continue it if it exists, otherwise
  // start a new one. (`/docket/new` already redirects to today's docket when one
  // exists, so linking straight to it just keeps the label honest.)
  const today = formatDateKey();
  const todaysDocket = dockets.find((d) => d.date === today) ?? null;
  const projectIdForLinks = company?.projectId ?? requestedProjectId;
  const subcontractorCompanyIdForLinks = company?.id ?? requestedSubcontractorCompanyId;
  const portalBackLink = `/subcontractor-portal${buildPortalCompanyQuery({
    projectId: projectIdForLinks,
    subcontractorCompanyId: subcontractorCompanyIdForLinks,
  })}`;

  // Filter dockets
  const filteredDockets =
    statusFilter === 'all' ? dockets : dockets.filter((d) => d.status === statusFilter);

  // Group by month
  const groupedByMonth = filteredDockets.reduce(
    (groups, docket) => {
      const date = new Date(docket.date);
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      const monthLabel = date.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });

      if (!groups[monthKey]) {
        groups[monthKey] = { label: monthLabel, dockets: [] };
      }
      groups[monthKey].dockets.push(docket);
      return groups;
    },
    {} as Record<string, { label: string; dockets: Docket[] }>,
  );

  const monthGroups = Object.values(groupedByMonth);

  // Calculate stats
  const stats = {
    total: dockets.length,
    pending: dockets.filter((d) => d.status === 'pending_approval').length,
    approved: dockets.filter((d) => d.status === 'approved').length,
    queried: dockets.filter((d) => d.status === 'queried').length,
  };

  const loading = companyLoading || (Boolean(company?.projectId) && docketsLoading);
  const loadError = companyError ?? docketsError;

  if (loading) {
    return (
      <div className="container max-w-2xl mx-auto p-4 pb-20 md:pb-4 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-6 w-32" />
        </div>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="container max-w-2xl mx-auto p-4 pb-20 md:pb-4 space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p role="alert">{extractErrorMessage(loadError, 'Failed to load docket history')}</p>
        </div>
        <Link
          to={portalBackLink}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-muted-foreground transition-colors hover:bg-muted/50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Portal
        </Link>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto p-4 pb-20 md:pb-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={portalBackLink} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Docket History</h1>
          <p className="text-sm text-muted-foreground dark:text-muted-foreground">
            {stats.total} dockets
          </p>
        </div>
      </div>

      {/* Primary CTA: start (or continue) today's docket so this page is not a creation dead end */}
      <Link
        to={
          todaysDocket
            ? buildDocketEditRoute(
                todaysDocket.id,
                projectIdForLinks,
                subcontractorCompanyIdForLinks,
              )
            : buildDocketEditRoute('new', projectIdForLinks, subcontractorCompanyIdForLinks)
        }
        className="flex items-center justify-center gap-2 w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors touch-manipulation"
      >
        {todaysDocket ? (
          <>
            Continue today's docket
            <ChevronRight className="h-5 w-5" />
          </>
        ) : (
          <>
            <Plus className="h-5 w-5" />
            Start today's docket
          </>
        )}
      </Link>

      {/* Filter tabs - wraps on mobile */}
      <div
        className={cn(
          'p-1 bg-muted rounded-lg',
          isMobile ? 'grid grid-cols-2 gap-1' : 'flex gap-1 overflow-x-auto',
        )}
      >
        <button
          onClick={() => setStatusFilter('all')}
          className={cn(
            'flex items-center justify-center gap-1 px-3 py-2.5 text-sm font-medium rounded-md transition-colors touch-manipulation',
            statusFilter === 'all'
              ? 'bg-card text-foreground shadow'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          All
          <span className="px-1.5 py-0.5 text-xs bg-muted rounded">{stats.total}</span>
        </button>
        <button
          onClick={() => setStatusFilter('pending_approval')}
          className={cn(
            'flex items-center justify-center gap-1 px-3 py-2.5 text-sm font-medium rounded-md transition-colors touch-manipulation',
            statusFilter === 'pending_approval'
              ? 'bg-card text-foreground shadow'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Pending
          {stats.pending > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-muted rounded">{stats.pending}</span>
          )}
        </button>
        <button
          onClick={() => setStatusFilter('approved')}
          className={cn(
            'flex items-center justify-center gap-1 px-3 py-2.5 text-sm font-medium rounded-md transition-colors touch-manipulation',
            statusFilter === 'approved'
              ? 'bg-card text-foreground shadow'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Approved
          {stats.approved > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-muted rounded">{stats.approved}</span>
          )}
        </button>
        <button
          onClick={() => setStatusFilter('queried')}
          className={cn(
            'flex items-center justify-center gap-1 px-3 py-2.5 text-sm font-medium rounded-md transition-colors touch-manipulation',
            statusFilter === 'queried'
              ? 'bg-card text-foreground shadow'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Queried
          {stats.queried > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-muted rounded">{stats.queried}</span>
          )}
        </button>
      </div>

      {/* Docket list */}
      {filteredDockets.length === 0 ? (
        <div className="border border-border rounded-lg bg-card">
          <div className="p-8 text-center">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground dark:text-muted-foreground">
              {statusFilter === 'all'
                ? 'No dockets yet'
                : `No ${formatStatusLabel(statusFilter)} dockets`}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {monthGroups.map((group) => (
            <div key={group.label}>
              <h3 className="text-sm font-medium text-muted-foreground dark:text-muted-foreground mb-2">
                {group.label}
              </h3>
              <div className="space-y-2">
                {group.dockets.map((docket) => (
                  <Link
                    key={docket.id}
                    to={buildDocketEditRoute(
                      docket.id,
                      projectIdForLinks,
                      subcontractorCompanyIdForLinks,
                    )}
                  >
                    <div className="border border-border rounded-lg bg-card hover:border-primary transition-colors">
                      <div className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {getDocketStatusIcon(docket.status)}
                            <div>
                              <p className="font-medium text-foreground">
                                {formatDate(docket.date)}
                              </p>
                              <p className="font-mono text-sm tabular-nums text-muted-foreground">
                                {formatCurrency(getDocketDisplayTotalCost(docket))}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getDocketStatusBadge(docket.status)}
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                        {(docket.status === 'queried' || docket.status === 'rejected') &&
                          docket.foremanNotes && (
                            <p className="text-sm text-muted-foreground dark:text-muted-foreground mt-2 pl-8 truncate">
                              {docket.foremanNotes}
                            </p>
                          )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
