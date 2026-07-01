import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, MapPin, AlertCircle, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { Skeleton } from '@/components/ui/Skeleton';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { extractErrorMessage } from '@/lib/errorHandling';
import { formatStatusLabel } from '@/lib/statusLabels';
import { cn } from '@/lib/utils';
import { getAssignedWorkStatusGroup } from './assignedWorkStatus';
import { PortalAccessDenied } from './portalAccess';
import { isPortalModuleEnabled, type PortalAccess } from './portalAccessModel';
import {
  applyPortalCompanyOptionToParams,
  buildPortalCompanyQuery,
  buildPortalCompanyScopedPath,
  findPortalCompanyOptionByValue,
  getPortalCompanyOptionLabel,
  getPortalCompanyOptionValue,
  type PortalCompanyOption,
} from './portalCompanyScope';

interface Lot {
  id: string;
  lotNumber: string;
  activity?: string;
  status: string;
  area?: number;
}

function getStatusBadge(status: string) {
  // Lot status pills: in_progress/completed are informational, on_hold is the
  // exception that needs a human's eye. Benign not_started stays neutral.
  const variants: Record<string, string> = {
    not_started: 'bg-muted text-muted-foreground',
    in_progress: 'bg-info/10 text-info',
    awaiting_test: 'bg-warning/10 text-warning',
    hold_point: 'bg-warning/10 text-warning',
    ncr_raised: 'bg-warning/10 text-warning',
    on_hold: 'bg-warning/10 text-warning',
    completed: 'bg-success/10 text-success',
    conformed: 'bg-success/10 text-success',
    claimed: 'bg-success/10 text-success',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide rounded-full',
        variants[status] || variants.not_started,
      )}
    >
      {formatStatusLabel(status, { fallback: 'Not Started' })}
    </span>
  );
}

export function AssignedWorkPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedProjectId = searchParams.get('projectId');
  const requestedSubcontractorCompanyId = searchParams.get('subcontractorCompanyId');
  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: [
      ...queryKeys.portalCompanies(user?.id),
      requestedProjectId ?? 'default',
      requestedSubcontractorCompanyId ?? 'default-company',
    ],
    queryFn: async () => {
      const res = await apiFetch<{
        company: {
          id: string;
          projectName: string;
          projectId: string;
          portalAccess?: PortalAccess;
          availableProjects?: Array<{
            id?: string | null;
            subcontractorCompanyId?: string | null;
            projectId: string;
            projectName: string;
            companyName?: string | null;
          }>;
        };
      }>(
        `/api/subcontractors/my-company${buildPortalCompanyQuery({
          projectId: requestedProjectId,
          subcontractorCompanyId: requestedSubcontractorCompanyId,
        })}`,
      );
      return res.company;
    },
    enabled: !!user?.id,
  });
  const canViewAssignedWork = isPortalModuleEnabled(company, 'lots');

  const {
    data: lots = [],
    isLoading: lotsLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.portalAssignedWork(user?.id, company?.projectId, company?.id),
    queryFn: async () => {
      const res = await apiFetch<{ lots: Lot[] }>(
        `/api/lots${buildPortalCompanyQuery({
          projectId: company!.projectId,
          subcontractorCompanyId: company!.id,
        })}&portalModule=lots`,
      );
      return res.lots || [];
    },
    enabled: !!user?.id && !!company?.projectId && canViewAssignedWork,
  });

  const loading = companyLoading || (canViewAssignedWork && lotsLoading);
  const projectName = company?.projectName || '';
  const projectOptions: PortalCompanyOption[] = company?.availableProjects || [];
  const showProjectSwitcher = projectOptions.length > 1;
  const portalScope = {
    projectId: company?.projectId ?? requestedProjectId,
    subcontractorCompanyId: company?.id ?? requestedSubcontractorCompanyId,
  };
  const portalPath = buildPortalCompanyScopedPath('/subcontractor-portal', portalScope);
  const lotItpPath = (lotId: string) =>
    buildPortalCompanyScopedPath(
      `/subcontractor-portal/lots/${encodeURIComponent(lotId)}/itp`,
      portalScope,
    );

  const handleProjectChange = (value: string) => {
    const selected = findPortalCompanyOptionByValue(projectOptions, value);
    if (!selected) return;
    setSearchParams(applyPortalCompanyOptionToParams(searchParams, selected));
  };

  // Group lots by status
  const inProgress = lots.filter((l) => getAssignedWorkStatusGroup(l.status) === 'inProgress');
  const notStarted = lots.filter((l) => getAssignedWorkStatusGroup(l.status) === 'notStarted');
  const completed = lots.filter((l) => getAssignedWorkStatusGroup(l.status) === 'completed');
  const onHold = lots.filter((l) => getAssignedWorkStatusGroup(l.status) === 'onHold');
  const other = lots.filter((l) => getAssignedWorkStatusGroup(l.status) === 'other');

  if (loading) {
    return (
      <div className="container max-w-2xl mx-auto p-4 pb-20 md:pb-4 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-6 w-32" />
        </div>
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    );
  }

  if (!canViewAssignedWork) {
    return <PortalAccessDenied moduleName="Assigned work" backTo={portalPath} />;
  }

  if (error) {
    return (
      <div className="container max-w-2xl mx-auto p-4">
        <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p>{extractErrorMessage(error, 'Failed to load assigned work')}</p>
        </div>
        <Link
          to={portalPath}
          className="inline-flex items-center gap-2 mt-4 px-4 py-2 border border-border rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground"
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
          <h1 className="text-lg font-semibold text-foreground">Assigned Work</h1>
          <p className="text-sm text-muted-foreground">{projectName}</p>
        </div>
      </div>

      {showProjectSwitcher && (
        <div className="rounded-lg border border-border bg-card p-4">
          <label
            htmlFor="assigned-work-project-switcher"
            className="mb-2 block text-sm font-medium text-foreground"
          >
            Project
          </label>
          <select
            id="assigned-work-project-switcher"
            value={company?.id || company?.projectId || ''}
            onChange={(event) => handleProjectChange(event.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          >
            {projectOptions.map((option) => (
              <option
                key={getPortalCompanyOptionValue(option)}
                value={getPortalCompanyOptionValue(option)}
              >
                {getPortalCompanyOptionLabel(option, projectOptions)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="border border-border rounded-lg bg-card shadow-sm">
          <div className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg border border-border bg-muted">
              <MapPin className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-mono text-2xl font-medium tabular-nums text-foreground">
                {lots.length}
              </p>
              <p className="text-sm text-muted-foreground">Assigned Lots</p>
            </div>
          </div>
        </div>
        <div className="border border-border rounded-lg bg-card shadow-sm">
          <div className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg border border-border bg-muted">
              <Clock className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-mono text-2xl font-medium tabular-nums text-foreground">
                {inProgress.length}
              </p>
              <p className="text-sm text-muted-foreground">In Progress</p>
            </div>
          </div>
        </div>
      </div>

      {lots.length === 0 ? (
        <div className="border border-border rounded-lg bg-card">
          <div className="p-8 text-center">
            <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-2">No lots assigned yet</p>
            <p className="text-sm text-muted-foreground">
              Contact your project manager to get lot assignments
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* In Progress */}
          {inProgress.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-muted-foreground mb-2">
                In Progress ({inProgress.length})
              </h2>
              <div className="space-y-2">
                {inProgress.map((lot) => (
                  <LotCard key={lot.id} lot={lot} to={lotItpPath(lot.id)} />
                ))}
              </div>
            </div>
          )}

          {/* Not Started */}
          {notStarted.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-muted-foreground mb-2">
                Not Started ({notStarted.length})
              </h2>
              <div className="space-y-2">
                {notStarted.map((lot) => (
                  <LotCard key={lot.id} lot={lot} to={lotItpPath(lot.id)} />
                ))}
              </div>
            </div>
          )}

          {/* On Hold */}
          {onHold.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-muted-foreground mb-2">
                On Hold ({onHold.length})
              </h2>
              <div className="space-y-2">
                {onHold.map((lot) => (
                  <LotCard key={lot.id} lot={lot} to={lotItpPath(lot.id)} />
                ))}
              </div>
            </div>
          )}

          {/* Completed */}
          {completed.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-muted-foreground mb-2">
                Completed ({completed.length})
              </h2>
              <div className="space-y-2">
                {completed.map((lot) => (
                  <LotCard key={lot.id} lot={lot} to={lotItpPath(lot.id)} />
                ))}
              </div>
            </div>
          )}

          {other.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-muted-foreground mb-2">
                Other ({other.length})
              </h2>
              <div className="space-y-2">
                {other.map((lot) => (
                  <LotCard key={lot.id} lot={lot} to={lotItpPath(lot.id)} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function LotCard({ lot, to }: { lot: Lot; to: string }) {
  return (
    <Link
      to={to}
      className="block border border-border rounded-lg bg-card shadow-sm transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg border border-border bg-muted">
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">{lot.lotNumber}</p>
              {lot.activity && <p className="text-sm text-muted-foreground">{lot.activity}</p>}
              {lot.area && (
                <p className="text-xs text-muted-foreground mt-1">
                  Area: {lot.area.toLocaleString()} m²
                </p>
              )}
            </div>
          </div>
          {getStatusBadge(lot.status)}
        </div>
      </div>
    </Link>
  );
}
