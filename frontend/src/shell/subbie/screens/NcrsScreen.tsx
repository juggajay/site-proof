/**
 * NcrsScreen — /p/ncrs — the subbie shell's read-only non-conformance surface.
 *
 * MODULE-CONDITIONAL: the `ncrs` portal module defaults OFF (auto-enabled server
 * side on first NCR assignment), so the Home NCR tile + this route only matter
 * when the module is on. When off, the screen shows the shared access-denied
 * notice (defence-in-depth — the tile is already hidden).
 *
 * NEW PRESENTATION over EXISTING LOGIC. Reuses the SAME query the classic
 * SubcontractorNCRsPage uses (queryKeys.portalNCRs, cache shared):
 *   GET /api/ncrs?projectId=&subcontractorView=true
 * Read-only: severity minor/major/critical pills; statuses grouped Open / In
 * Progress / Closed (classic grouping); lot numbers from `ncrLots`.
 */
import { Flag, ShieldOff } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ShellScreen } from '@/shell/components/ShellScreen';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from '@/lib/auth';
import { extractErrorMessage } from '@/lib/errorHandling';
import { formatStatusLabel } from '@/lib/statusLabels';
import { cn } from '@/lib/utils';
import { buildPortalCompanyQuery } from '@/pages/subcontractor-portal/portalCompanyScope';
import { useSubbieShellContext } from '../subbieShellContext';
import { useModuleAccessRevoked } from '../useModuleAccessRevoked';
import { ModuleAccessChangedNotice } from '../ModuleAccessChangedNotice';

interface NCR {
  id: string;
  ncrNumber: string;
  description: string;
  status: string;
  severity: 'minor' | 'major' | 'critical';
  raisedAt: string;
  raisedBy?: { fullName: string };
  ncrLots?: Array<{ lot?: { lotNumber?: string } }>;
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

function NcrCard({ ncr }: { ncr: NCR }) {
  const lotNumbers = ncr.ncrLots
    ?.map((l) => l.lot?.lotNumber)
    .filter(Boolean)
    .join(', ');
  const severity = SEVERITY_BADGE[ncr.severity] ?? SEVERITY_BADGE.minor;
  const status = statusBadge(ncr.status);

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
  const { projectId, subcontractorCompanyId, isModuleEnabled } = useSubbieShellContext();
  const canViewNCRs = isModuleEnabled('ncrs');
  const projectQuery = buildPortalCompanyQuery({ projectId, subcontractorCompanyId });
  const parentPath = `/p${projectQuery}`;

  const {
    data: ncrs = [],
    isLoading,
    error,
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
                <NcrCard key={ncr.id} ncr={ncr} />
              ))}
            </>
          )}
          {inProgress.length > 0 && (
            <>
              <SectionLabel count={inProgress.length}>IN PROGRESS</SectionLabel>
              {inProgress.map((ncr) => (
                <NcrCard key={ncr.id} ncr={ncr} />
              ))}
            </>
          )}
          {closed.length > 0 && (
            <>
              <SectionLabel count={closed.length}>CLOSED</SectionLabel>
              {closed.map((ncr) => (
                <NcrCard key={ncr.id} ncr={ncr} />
              ))}
            </>
          )}
        </>
      )}
    </ShellScreen>
  );
}
