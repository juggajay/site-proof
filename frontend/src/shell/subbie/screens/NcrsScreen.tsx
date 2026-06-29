/**
 * NcrsScreen — /p/ncrs — the subbie shell's non-conformance surface.
 *
 * MODULE-CONDITIONAL: the `ncrs` portal module defaults OFF (auto-enabled server
 * side on first NCR assignment), so the Home NCR tile + this route only matter
 * when the module is on. When off, the screen shows the shared access-denied
 * notice (defence-in-depth — the tile is already hidden).
 *
 * NEW PRESENTATION over EXISTING LOGIC. Reuses the SAME query the classic
 * SubcontractorNCRsPage uses (queryKeys.portalNCRs, cache shared):
 *   GET /api/ncrs?projectId=&subcontractorView=true
 * Responsible subcontractors can respond and submit rectification; lot-linked
 * non-responsible NCRs remain read-only.
 */
import { useState } from 'react';
import { Flag, ShieldOff } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ShellScreen } from '@/shell/components/ShellScreen';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from '@/lib/auth';
import { extractErrorMessage, handleApiError } from '@/lib/errorHandling';
import { formatStatusLabel } from '@/lib/statusLabels';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toaster';
import { NCREvidenceList } from '@/pages/ncr/components/NCREvidenceList';
import { RespondNCRModal } from '@/pages/ncr/components/RespondNCRModal';
import { RectifyNCRModal } from '@/pages/ncr/components/RectifyNCRModal';
import type { NCR as WorkflowNCR } from '@/pages/ncr/types';
import { buildPortalCompanyQuery } from '@/pages/subcontractor-portal/portalCompanyScope';
import { useSubbieShellContext } from '../subbieShellContext';
import { useModuleAccessRevoked } from '../useModuleAccessRevoked';
import { ModuleAccessChangedNotice } from '../ModuleAccessChangedNotice';

interface NCR {
  id: string;
  ncrNumber: string;
  description: string;
  category?: string;
  status: string;
  severity: 'minor' | 'major' | 'critical';
  raisedAt: string;
  raisedBy?: { fullName: string };
  responsibleUserId?: string | null;
  responsibleSubcontractorId?: string | null;
  responsibleSubcontractor?: { id: string; companyName: string } | null;
  ncrLots?: Array<{ lot?: { lotNumber?: string; description?: string | null } }>;
  ncrEvidence?: Array<{
    id: string;
    evidenceType: string;
    uploadedAt?: string | null;
    document: {
      id: string;
      filename: string;
      fileUrl?: string | null;
      mimeType?: string | null;
      uploadedAt?: string | null;
    } | null;
  }>;
}

function isResponsibleNcr(ncr: NCR, companyId?: string | null, userId?: string) {
  return (
    (!!companyId &&
      (ncr.responsibleSubcontractorId === companyId ||
        ncr.responsibleSubcontractor?.id === companyId)) ||
    (!!userId && ncr.responsibleUserId === userId)
  );
}

function toWorkflowNcr(
  ncr: NCR,
  projectId?: string | null,
  projectName?: string | null,
): WorkflowNCR {
  return {
    id: ncr.id,
    ncrNumber: ncr.ncrNumber,
    description: ncr.description,
    category: ncr.category ?? 'Workmanship',
    severity: ncr.severity === 'major' || ncr.severity === 'critical' ? 'major' : 'minor',
    status: ncr.status,
    qmApprovalRequired: false,
    qmApprovedAt: null,
    raisedBy: {
      fullName: ncr.raisedBy?.fullName ?? 'SiteProof',
      email: '',
    },
    responsibleUser: null,
    responsibleSubcontractor: ncr.responsibleSubcontractor ?? null,
    responsibleUserId: ncr.responsibleUserId ?? null,
    responsibleSubcontractorId: ncr.responsibleSubcontractorId ?? null,
    createdAt: ncr.raisedAt,
    project: { id: projectId ?? undefined, name: projectName ?? '', projectNumber: '' },
    ncrLots:
      ncr.ncrLots?.map((ncrLot) => ({
        lot: {
          lotNumber: ncrLot.lot?.lotNumber ?? '',
          description: ncrLot.lot?.description ?? '',
        },
      })) ?? [],
    ncrEvidence: ncr.ncrEvidence,
  };
}

// Classic grouping (SubcontractorNCRsPage): Open / In Progress / Closed.
function isClosedStatus(status: string) {
  return status === 'closed' || status === 'closed_concession' || status === 'rejected';
}
function isOpenStatus(status: string) {
  return status === 'open';
}

const SEVERITY_BADGE: Record<NCR['severity'], { label: string; cls: string }> = {
  critical: { label: 'CRITICAL', cls: 'shell-badge-bad' },
  major: { label: 'MAJOR', cls: 'shell-badge-pend' },
  minor: { label: 'MINOR', cls: 'shell-badge-draft' },
};

function statusBadge(status: string): { label: string; cls: string } {
  if (isClosedStatus(status)) {
    return {
      label: formatStatusLabel(status).toUpperCase(),
      cls: status === 'rejected' ? 'shell-badge-draft' : 'shell-badge-ok',
    };
  }
  if (isOpenStatus(status)) {
    return { label: 'OPEN', cls: 'shell-badge-bad' };
  }
  return { label: formatStatusLabel(status).toUpperCase(), cls: 'shell-badge-pend' };
}

function formatRaisedDate(dateStr: string): string {
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short' }).format(parsed);
}

function NcrCard({
  ncr,
  responsible,
  onRespond,
  onRectify,
}: {
  ncr: NCR;
  responsible: boolean;
  onRespond: (ncr: NCR) => void;
  onRectify: (ncr: NCR) => void;
}) {
  const lotNumbers = ncr.ncrLots
    ?.map((l) => l.lot?.lotNumber)
    .filter(Boolean)
    .join(', ');
  const evidence = ncr.ncrEvidence ?? [];
  const severity = SEVERITY_BADGE[ncr.severity] ?? SEVERITY_BADGE.minor;
  const status = statusBadge(ncr.status);
  const canRespond = responsible && ncr.status === 'open';
  const canRectify =
    responsible && (ncr.status === 'investigating' || ncr.status === 'rectification');

  return (
    <div className="shell-card">
      <div className="flex items-start gap-3">
        <Flag size={19} className="mt-px shrink-0 text-warning" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="shell-mono text-[15px] font-semibold text-foreground">
              {ncr.ncrNumber}
            </span>
            <span className={cn('shell-badge', severity.cls)}>{severity.label}</span>
          </div>
          {lotNumbers && (
            <div className="mt-[3px] text-[13px] text-muted-foreground">Lot: {lotNumbers}</div>
          )}
          <p className="mt-[3px] line-clamp-2 text-[13.5px] leading-snug text-muted-foreground">
            {ncr.description}
          </p>
          <div className="mt-[3px] text-[12px] text-muted-foreground/70">
            Raised {formatRaisedDate(ncr.raisedAt)}
            {ncr.raisedBy ? ` by ${ncr.raisedBy.fullName}` : ''}
          </div>
          {evidence.length > 0 && (
            <div className="mt-3">
              <NCREvidenceList evidence={evidence} title="Evidence" variant="inline" />
            </div>
          )}
          {(canRespond || canRectify) && (
            <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
              {canRespond && (
                <button
                  type="button"
                  onClick={() => onRespond(ncr)}
                  className="min-h-[40px] rounded-lg bg-primary px-3 py-2 text-[13px] font-semibold text-primary-foreground"
                >
                  Respond
                </button>
              )}
              {canRectify && (
                <button
                  type="button"
                  onClick={() => onRectify(ncr)}
                  className="min-h-[40px] rounded-lg border border-border px-3 py-2 text-[13px] font-semibold text-foreground"
                >
                  Submit Rectification
                </button>
              )}
            </div>
          )}
        </div>
        <span className={cn('shell-badge', status.cls)}>{status.label}</span>
      </div>
    </div>
  );
}

function SectionLabel({ children, count }: { children: React.ReactNode; count: number }) {
  return (
    <div className="mt-1 flex items-baseline justify-between">
      <span className="font-mono text-[11.5px] font-semibold tracking-[0.12em] text-muted-foreground">
        {children}
      </span>
      <span className="font-mono text-[11.5px] font-medium text-muted-foreground/70">{count}</span>
    </div>
  );
}

export function NcrsScreen() {
  const { user } = useAuth();
  const { projectId, subcontractorCompanyId, projectName, isModuleEnabled } =
    useSubbieShellContext();
  const [respondingNcr, setRespondingNcr] = useState<NCR | null>(null);
  const [rectifyingNcr, setRectifyingNcr] = useState<NCR | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const canViewNCRs = isModuleEnabled('ncrs');
  const projectQuery = buildPortalCompanyQuery({ projectId, subcontractorCompanyId });
  const parentPath = `/p${projectQuery}`;

  const {
    data: ncrs = [],
    isLoading,
    error,
    refetch: refetchNcrs,
  } = useQuery({
    queryKey: queryKeys.portalNCRs(user?.id, projectId, subcontractorCompanyId),
    queryFn: async () => {
      const res = await apiFetch<{ ncrs: NCR[] }>(
        `/api/ncrs${projectQuery}${projectQuery ? '&' : '?'}subcontractorView=true`,
      );
      return res.ncrs || [];
    },
    enabled: !!user?.id && !!projectId && canViewNCRs,
  });
  const accessRevoked = useModuleAccessRevoked(error);

  const sub = (
    <span className="text-muted-foreground">Read-only — non-conformances on your lots</span>
  );

  if (!canViewNCRs) {
    return (
      <ShellScreen variant="inner" title="NCRs" parent={parentPath} sub={sub}>
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <ShieldOff size={28} className="text-muted-foreground/50" aria-hidden="true" />
          <p className="max-w-[280px] text-[14px] leading-relaxed text-muted-foreground">
            No non-conformances have been shared with your company on this project.
          </p>
        </div>
      </ShellScreen>
    );
  }

  const open = ncrs.filter((n) => isOpenStatus(n.status));
  const inProgress = ncrs.filter((n) => !isOpenStatus(n.status) && !isClosedStatus(n.status));
  const closed = ncrs.filter((n) => isClosedStatus(n.status));

  const handleRespond = async (
    ncrId: string,
    responseData: {
      rootCauseCategory: string;
      rootCauseDescription: string;
      proposedCorrectiveAction: string;
    },
  ) => {
    setActionLoading(true);
    try {
      await apiFetch(`/api/ncrs/${encodeURIComponent(ncrId)}/respond`, {
        method: 'POST',
        body: JSON.stringify({
          rootCauseCategory: responseData.rootCauseCategory,
          rootCauseDescription: responseData.rootCauseDescription.trim(),
          proposedCorrectiveAction: responseData.proposedCorrectiveAction.trim(),
        }),
      });
      setRespondingNcr(null);
      toast({
        title: 'NCR response submitted',
        description: 'The NCR has moved to investigating.',
      });
      await refetchNcrs();
    } catch (err) {
      handleApiError(err, 'Failed to submit NCR response');
    } finally {
      setActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <ShellScreen variant="inner" title="NCRs" parent={parentPath} sub={sub}>
        {[1, 2].map((i) => (
          <div key={i} className="h-[112px] animate-pulse rounded-2xl bg-muted" />
        ))}
      </ShellScreen>
    );
  }

  return (
    <ShellScreen variant="inner" title="NCRs" parent={parentPath} sub={sub}>
      {accessRevoked ? (
        <ModuleAccessChangedNotice />
      ) : error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] font-semibold text-destructive">
          {extractErrorMessage(error, 'Failed to load NCRs')}
        </div>
      ) : ncrs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center text-[14px] leading-relaxed text-muted-foreground">
          <Flag size={28} className="text-muted-foreground/50" aria-hidden="true" />
          <span>Non-conformance reports related to your work will appear here.</span>
        </div>
      ) : (
        <>
          {open.length > 0 && (
            <>
              <SectionLabel count={open.length}>OPEN</SectionLabel>
              {open.map((ncr) => (
                <NcrCard
                  key={ncr.id}
                  ncr={ncr}
                  responsible={isResponsibleNcr(ncr, subcontractorCompanyId, user?.id)}
                  onRespond={setRespondingNcr}
                  onRectify={setRectifyingNcr}
                />
              ))}
            </>
          )}
          {inProgress.length > 0 && (
            <>
              <SectionLabel count={inProgress.length}>IN PROGRESS</SectionLabel>
              {inProgress.map((ncr) => (
                <NcrCard
                  key={ncr.id}
                  ncr={ncr}
                  responsible={isResponsibleNcr(ncr, subcontractorCompanyId, user?.id)}
                  onRespond={setRespondingNcr}
                  onRectify={setRectifyingNcr}
                />
              ))}
            </>
          )}
          {closed.length > 0 && (
            <>
              <SectionLabel count={closed.length}>CLOSED</SectionLabel>
              {closed.map((ncr) => (
                <NcrCard
                  key={ncr.id}
                  ncr={ncr}
                  responsible={isResponsibleNcr(ncr, subcontractorCompanyId, user?.id)}
                  onRespond={setRespondingNcr}
                  onRectify={setRectifyingNcr}
                />
              ))}
            </>
          )}
        </>
      )}
      <RespondNCRModal
        isOpen={!!respondingNcr}
        ncr={respondingNcr ? toWorkflowNcr(respondingNcr, projectId, projectName) : null}
        onClose={() => setRespondingNcr(null)}
        onSubmit={handleRespond}
        loading={actionLoading}
      />
      <RectifyNCRModal
        isOpen={!!rectifyingNcr}
        ncr={rectifyingNcr ? toWorkflowNcr(rectifyingNcr, projectId, projectName) : null}
        projectId={projectId ?? undefined}
        onClose={() => setRectifyingNcr(null)}
        onSuccess={async () => {
          setRectifyingNcr(null);
          await refetchNcrs();
        }}
      />
    </ShellScreen>
  );
}
