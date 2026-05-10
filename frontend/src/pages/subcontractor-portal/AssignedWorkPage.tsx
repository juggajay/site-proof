import { Link } from 'react-router-dom';
import { ArrowLeft, MapPin, AlertCircle, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { Skeleton } from '@/components/ui/Skeleton';
import { apiFetch } from '@/lib/api';
import { extractErrorMessage } from '@/lib/errorHandling';
import { cn } from '@/lib/utils';
import { PortalAccessDenied } from './portalAccess';
import { isPortalModuleEnabled, type PortalAccess } from './portalAccessModel';

interface Lot {
  id: string;
  lotNumber: string;
  activity?: string;
  status: string;
  area?: number;
}

function getStatusBadge(status: string) {
  const variants: Record<string, string> = {
    not_started: 'bg-muted text-foreground',
    in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
    on_hold: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100',
  };
  const labels: Record<string, string> = {
    not_started: 'Not Started',
    in_progress: 'In Progress',
    completed: 'Completed',
    on_hold: 'On Hold',
  };
  return (
    <span
      className={cn(
        'px-2 py-1 text-xs font-medium rounded-full',
        variants[status] || variants.not_started,
      )}
    >
      {labels[status] || status}
    </span>
  );
}

export function AssignedWorkPage() {
  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: queryKeys.portalCompanies,
    queryFn: async () => {
      const res = await apiFetch<{
        company: { projectName: string; projectId: string; portalAccess?: PortalAccess };
      }>('/api/subcontractors/my-company');
      return res.company;
    },
  });
  const canViewAssignedWork = isPortalModuleEnabled(company, 'lots');

  const {
    data: lots = [],
    isLoading: lotsLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.portalAssignedWork,
    queryFn: async () => {
      const res = await apiFetch<{ lots: Lot[] }>(
        `/api/lots?projectId=${company!.projectId}&portalModule=lots`,
      );
      return res.lots || [];
    },
    enabled: !!company?.projectId && canViewAssignedWork,
  });

  const loading = companyLoading || (canViewAssignedWork && lotsLoading);
  const projectName = company?.projectName || '';

  // Group lots by status
  const inProgress = lots.filter((l) => l.status === 'in_progress');
  const notStarted = lots.filter((l) => l.status === 'not_started' || !l.status);
  const completed = lots.filter((l) => l.status === 'completed');
  const onHold = lots.filter((l) => l.status === 'on_hold');

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
    return <PortalAccessDenied moduleName="Assigned work" />;
  }

  if (error) {
    return (
      <div className="container max-w-2xl mx-auto p-4">
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p>{extractErrorMessage(error, 'Failed to load assigned work')}</p>
        </div>
        <Link
          to="/subcontractor-portal"
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
        <Link
          to="/subcontractor-portal"
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Assigned Work</h1>
          <p className="text-sm text-muted-foreground">{projectName}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="border border-border rounded-lg bg-card">
          <div className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{lots.length}</p>
              <p className="text-sm text-muted-foreground">Assigned Lots</p>
            </div>
          </div>
        </div>
        <div className="border border-border rounded-lg bg-card">
          <div className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-300" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{inProgress.length}</p>
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
                  <LotCard key={lot.id} lot={lot} />
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
                  <LotCard key={lot.id} lot={lot} />
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
                  <LotCard key={lot.id} lot={lot} />
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
                  <LotCard key={lot.id} lot={lot} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LotCard({ lot }: { lot: Lot }) {
  return (
    <div className="border border-border rounded-lg bg-card">
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-muted">
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
    </div>
  );
}
