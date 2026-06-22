import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, AlertCircle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { Skeleton } from '@/components/ui/Skeleton';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { extractErrorMessage } from '@/lib/errorHandling';
import { formatStatusLabel } from '@/lib/statusLabels';
import { PortalAccessDenied } from './portalAccess';
import { isPortalModuleEnabled, type PortalAccess } from './portalAccessModel';
import { buildPortalCompanyQuery, buildPortalCompanyScopedPath } from './portalCompanyScope';

interface NCR {
  id: string;
  ncrNumber: string;
  description: string;
  status: string;
  severity: 'minor' | 'major' | 'critical';
  raisedAt: string;
  raisedBy?: { fullName: string };
  closedAt?: string;
  ncrLots?: Array<{
    lot?: {
      lotNumber?: string;
      description?: string | null;
    };
  }>;
}

interface SubcontractorCompany {
  id: string;
  companyName: string;
  projectId: string;
  projectName: string;
  portalAccess?: PortalAccess;
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'closed':
    case 'closed_concession':
      return (
        <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-muted text-foreground">
          <CheckCircle2 className="h-3 w-3" />
          {formatStatusLabel(status)}
        </span>
      );
    case 'investigating':
    case 'rectification':
    case 'verification':
      return (
        <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-muted text-foreground">
          <Clock className="h-3 w-3" />
          {formatStatusLabel(status)}
        </span>
      );
    case 'rejected':
      return (
        <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-muted text-foreground">
          <XCircle className="h-3 w-3" />
          Rejected
        </span>
      );
    default:
      return (
        <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-3 w-3" />
          {formatStatusLabel(status, { fallback: 'Open' })}
        </span>
      );
  }
}

function isClosedStatus(status: string) {
  return status === 'closed' || status === 'closed_concession' || status === 'rejected';
}

function isOpenStatus(status: string) {
  return status === 'open';
}

function getSeverityBadge(severity: string) {
  switch (severity) {
    case 'critical':
      return (
        <span className="px-2 py-0.5 text-xs font-medium rounded bg-destructive/10 text-destructive">
          Critical
        </span>
      );
    case 'major':
      return (
        <span className="px-2 py-0.5 text-xs font-medium rounded bg-warning/10 text-warning">
          Major
        </span>
      );
    default:
      return (
        <span className="px-2 py-0.5 text-xs font-medium rounded bg-muted text-foreground">
          Minor
        </span>
      );
  }
}

export function SubcontractorNCRsPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const requestedProjectId = searchParams.get('projectId');
  const requestedSubcontractorCompanyId = searchParams.get('subcontractorCompanyId');
  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: [
      ...queryKeys.portalCompanies(user?.id),
      requestedProjectId ?? 'default',
      requestedSubcontractorCompanyId ?? 'default-company',
    ],
    queryFn: async () => {
      const res = await apiFetch<{ company: SubcontractorCompany }>(
        `/api/subcontractors/my-company${buildPortalCompanyQuery({
          projectId: requestedProjectId,
          subcontractorCompanyId: requestedSubcontractorCompanyId,
        })}`,
      );
      return res.company;
    },
    enabled: !!user?.id,
  });
  const canViewNCRs = isPortalModuleEnabled(company, 'ncrs');

  const {
    data: ncrs = [],
    isLoading: ncrsLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.portalNCRs(user?.id, company?.projectId, company?.id),
    queryFn: async () => {
      const res = await apiFetch<{ ncrs: NCR[] }>(
        `/api/ncrs${buildPortalCompanyQuery({
          projectId: company!.projectId,
          subcontractorCompanyId: company!.id,
        })}&subcontractorView=true`,
      );
      return res.ncrs || [];
    },
    enabled: !!user?.id && !!company?.projectId && canViewNCRs,
  });

  const loading = companyLoading || (canViewNCRs && ncrsLoading);
  const portalPath = buildPortalCompanyScopedPath('/subcontractor-portal', {
    projectId: company?.projectId ?? requestedProjectId,
    subcontractorCompanyId: company?.id ?? requestedSubcontractorCompanyId,
  });

  const open = ncrs.filter((n) => isOpenStatus(n.status));
  const inProgress = ncrs.filter((n) => !isOpenStatus(n.status) && !isClosedStatus(n.status));
  const closed = ncrs.filter((n) => isClosedStatus(n.status));

  if (loading) {
    return (
      <div className="container max-w-2xl mx-auto p-4 pb-20 md:pb-4 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-6 w-32" />
        </div>
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    );
  }

  if (!canViewNCRs) {
    return <PortalAccessDenied moduleName="NCRs" backTo={portalPath} />;
  }

  if (error) {
    return (
      <div className="container max-w-2xl mx-auto p-4">
        <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p>{extractErrorMessage(error, 'Failed to load NCRs')}</p>
        </div>
        <Link
          to={portalPath}
          className="inline-flex items-center gap-2 mt-4 px-4 py-2 border border-border rounded-lg hover:bg-muted/50 transition-colors text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Portal
        </Link>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto p-4 pb-20 md:pb-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={portalPath} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-foreground">NCRs</h1>
          <p className="text-sm text-muted-foreground">{company?.projectName}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="border border-border rounded-lg bg-card p-3">
          <p className="text-2xl font-bold text-destructive">{open.length}</p>
          <p className="text-xs text-muted-foreground">Open</p>
        </div>
        <div className="border border-border rounded-lg bg-card p-3">
          <p className="text-2xl font-bold text-foreground">{inProgress.length}</p>
          <p className="text-xs text-muted-foreground">In Progress</p>
        </div>
        <div className="border border-border rounded-lg bg-card p-3">
          <p className="text-2xl font-bold text-foreground">{closed.length}</p>
          <p className="text-xs text-muted-foreground">Closed</p>
        </div>
      </div>

      {ncrs.length === 0 ? (
        <div className="border border-border rounded-lg bg-card">
          <div className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-2">No NCRs</p>
            <p className="text-sm text-muted-foreground">
              Non-conformance reports related to your work will appear here
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Open - show first as priority */}
          {open.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-destructive mb-2">Open ({open.length})</h2>
              <div className="space-y-2">
                {open.map((ncr) => (
                  <NCRCard key={ncr.id} ncr={ncr} />
                ))}
              </div>
            </div>
          )}

          {/* In Progress */}
          {inProgress.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-muted-foreground mb-2">
                In Progress ({inProgress.length})
              </h2>
              <div className="space-y-2">
                {inProgress.map((ncr) => (
                  <NCRCard key={ncr.id} ncr={ncr} />
                ))}
              </div>
            </div>
          )}

          {/* Closed */}
          {closed.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-muted-foreground mb-2">
                Closed ({closed.length})
              </h2>
              <div className="space-y-2">
                {closed.map((ncr) => (
                  <NCRCard key={ncr.id} ncr={ncr} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function NCRCard({ ncr }: { ncr: NCR }) {
  const lotNumbers = ncr.ncrLots
    ?.map((ncrLot) => ncrLot.lot?.lotNumber)
    .filter(Boolean)
    .join(', ');

  return (
    <div className="border border-border rounded-lg bg-card">
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-foreground">{ncr.ncrNumber}</p>
                {getSeverityBadge(ncr.severity)}
              </div>
              {lotNumbers && <p className="text-sm text-muted-foreground">Lot: {lotNumbers}</p>}
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{ncr.description}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Raised {new Date(ncr.raisedAt).toLocaleDateString('en-AU')}
                {ncr.raisedBy && ` by ${ncr.raisedBy.fullName}`}
              </p>
            </div>
          </div>
          {getStatusBadge(ncr.status)}
        </div>
      </div>
    </div>
  );
}
