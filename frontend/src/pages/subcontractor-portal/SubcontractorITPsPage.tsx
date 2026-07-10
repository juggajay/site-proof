import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ClipboardList,
  AlertCircle,
  CheckCircle2,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { Skeleton } from '@/components/ui/Skeleton';
import { apiFetch } from '@/lib/api';
import { fetchAllLotPages } from '@/lib/lots';
import { useAuth } from '@/lib/auth';
import { extractErrorMessage } from '@/lib/errorHandling';
import { PortalAccessDenied } from './portalAccess';
import { isPortalModuleEnabled, type PortalAccess } from './portalAccessModel';
import { buildPortalCompanyQuery, buildPortalCompanyScopedPath } from './portalCompanyScope';

interface LotAssignment {
  id: string;
  canCompleteITP: boolean;
  itpRequiresVerification: boolean;
}

interface ITPInstance {
  id: string;
  status: string;
  template: {
    id: string;
    name: string;
    activityType: string;
  };
  completionPercentage?: number;
}

interface Lot {
  id: string;
  lotNumber: string;
  description?: string;
  status: string;
  activityType?: string;
  itpInstances?: ITPInstance[];
  subcontractorAssignments?: LotAssignment[];
}

interface SubcontractorCompany {
  id: string;
  companyName: string;
  projectId: string;
  projectName: string;
  portalAccess?: PortalAccess;
}

function getITPStatusBadge(status: string, percentage?: number) {
  if (status === 'completed') {
    return (
      <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-muted text-foreground">
        <CheckCircle2 className="h-3 w-3" />
        Complete
      </span>
    );
  }
  if (status === 'in_progress' || (percentage && percentage > 0)) {
    return (
      <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-muted text-foreground">
        <Clock className="h-3 w-3" />
        {percentage ? `${percentage}%` : 'In Progress'}
      </span>
    );
  }
  return (
    <span className="px-2 py-1 text-xs font-medium rounded-full bg-muted text-foreground">
      Not Started
    </span>
  );
}

export function SubcontractorITPsPage() {
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
  const canViewITPs = isPortalModuleEnabled(company, 'itps');

  const {
    data: lots = [],
    isLoading: lotsLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.portalITPs(user?.id, company?.projectId, company?.id),
    queryFn: async () => {
      const lots = await fetchAllLotPages<Lot>(
        `/api/lots${buildPortalCompanyQuery({
          projectId: company!.projectId,
          subcontractorCompanyId: company!.id,
        })}&includeITP=true&portalModule=itps`,
      );
      return lots.filter((lot: Lot) => {
        return lot.itpInstances && lot.itpInstances.length > 0;
      });
    },
    enabled: !!user?.id && !!company?.projectId && canViewITPs,
  });

  const loading = companyLoading || (canViewITPs && lotsLoading);
  const portalPath = buildPortalCompanyScopedPath('/subcontractor-portal', {
    projectId: company?.projectId ?? requestedProjectId,
    subcontractorCompanyId: company?.id ?? requestedSubcontractorCompanyId,
  });
  const projectQuery = buildPortalCompanyQuery({
    projectId: company?.projectId ?? requestedProjectId,
    subcontractorCompanyId: company?.id ?? requestedSubcontractorCompanyId,
  });

  // Group by ITP status
  const inProgress = lots.filter((l) =>
    l.itpInstances?.some((itp) => itp.status === 'in_progress'),
  );
  const notStarted = lots.filter((l) =>
    l.itpInstances?.every((itp) => itp.status === 'not_started'),
  );
  const completed = lots.filter((l) => l.itpInstances?.every((itp) => itp.status === 'completed'));

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

  if (!canViewITPs) {
    return <PortalAccessDenied moduleName="ITPs" backTo={portalPath} />;
  }

  if (error) {
    return (
      <div className="container max-w-2xl mx-auto p-4">
        <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p>{extractErrorMessage(error, 'Failed to load ITPs')}</p>
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
          <h1 className="text-lg font-semibold text-foreground">ITPs</h1>
          <p className="text-sm text-muted-foreground">{company?.projectName}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="border border-border rounded-lg bg-card p-3">
          <p className="text-2xl font-bold text-foreground">{lots.length}</p>
          <p className="text-xs text-muted-foreground">Total ITPs</p>
        </div>
        <div className="border border-border rounded-lg bg-card p-3">
          <p className="text-2xl font-bold text-foreground">{inProgress.length}</p>
          <p className="text-xs text-muted-foreground">In Progress</p>
        </div>
        <div className="border border-border rounded-lg bg-card p-3">
          <p className="text-2xl font-bold text-foreground">{completed.length}</p>
          <p className="text-xs text-muted-foreground">Completed</p>
        </div>
      </div>

      {lots.length === 0 ? (
        <div className="border border-border rounded-lg bg-card">
          <div className="p-8 text-center">
            <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-2">No ITPs assigned yet</p>
            <p className="text-sm text-muted-foreground">
              ITPs will appear here when you're assigned to lots with ITP completion permission
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
                  <ITPLotCard key={lot.id} lot={lot} projectQuery={projectQuery} />
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
                  <ITPLotCard key={lot.id} lot={lot} projectQuery={projectQuery} />
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
                  <ITPLotCard key={lot.id} lot={lot} projectQuery={projectQuery} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ITPLotCard({ lot, projectQuery }: { lot: Lot; projectQuery: string }) {
  const itp = lot.itpInstances?.[0];
  const canComplete = lot.subcontractorAssignments?.some((a) => a.canCompleteITP) ?? false;

  return (
    <Link
      to={`/subcontractor-portal/lots/${encodeURIComponent(lot.id)}/itp${projectQuery}`}
      className="block border border-border rounded-lg bg-card hover:border-primary transition-colors"
    >
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">{lot.lotNumber}</p>
              {itp && <p className="text-sm text-muted-foreground">{itp.template.name}</p>}
              {!canComplete && (
                <p className="text-xs text-muted-foreground mt-1">
                  View only - contact PM for completion access
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {itp && getITPStatusBadge(itp.status, itp.completionPercentage)}
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </div>
    </Link>
  );
}
