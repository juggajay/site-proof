/**
 * IssuesListScreen — /m/issues — the foreman's NCRs & defects surface.
 *
 * Design spec: docs/design-foreman-shell-mock-v4.html #issues.
 * Cards show a mono NCR-### number + a clamped description line, then severity +
 * status pills and a mono raised date. Open issues sort first. Filter chips
 * (Open/Closed/All) follow the existing NCR status vocabulary. The mock's empty
 * state ("No open issues. Good. / Spot something wrong? Photo first — words
 * later.") shows when the Open filter has nothing.
 *
 * Foreman-truth (research doc 14): the foreman RAISES NCRs (photo first, words
 * later). The bottom "Raise an issue" primary opens the EXISTING CaptureModal
 * pre-set to NCR mode — capture-first machinery reused verbatim, including its
 * own POST /api/ncrs create path. There is deliberately no Close / QM affordance
 * anywhere on this surface.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffectiveProjectId } from '@/hooks/useEffectiveProjectId';
import { CaptureModal } from '@/components/foreman/CaptureModal';
import { ShellScreen } from '../../components/ShellScreen';
import { withProjectQuery } from '../../shellPaths';
import { useIssuesShellContext } from './issuesShellContext';
import {
  ISSUE_FILTERS,
  type IssueFilterKey,
  type IssuePillTone,
  filterIssues,
  issueSeverityLabel,
  issueSeverityTone,
  issueStatusLabel,
  issueStatusTone,
  sortIssuesForShell,
} from './issuesShellState';
import type { NCR } from '@/pages/ncr/types';

const PILL_TONE_CLASS: Record<IssuePillTone, string> = {
  attention: 'shell-pill shell-pill-attention',
  bad: 'shell-pill shell-pill-bad',
  good: 'shell-pill shell-pill-good',
  neutral: 'shell-pill',
};

function formatRaisedDate(dateStr: string): string {
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short' }).format(parsed);
}

function IssueCard({ ncr, onPress }: { ncr: NCR; onPress: () => void }) {
  return (
    <button
      type="button"
      className="shell-card"
      onClick={onPress}
      aria-label={`Issue ${ncr.ncrNumber} — ${ncr.description}, ${issueSeverityLabel(
        ncr.severity,
      )}, ${issueStatusLabel(ncr.status)}`}
    >
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1">
          <span className="shell-mono text-[15px] font-semibold text-foreground">
            {ncr.ncrNumber}
          </span>
        </span>
        <ChevronRight size={16} className="flex-shrink-0 text-muted-foreground/50" aria-hidden />
      </div>

      <p className="mt-[5px] line-clamp-2 text-[14px] leading-snug text-muted-foreground">
        {ncr.description}
      </p>

      <div className="mt-[10px] flex flex-wrap items-center gap-[7px]">
        <span className={PILL_TONE_CLASS[issueSeverityTone(ncr.severity)]}>
          {issueSeverityLabel(ncr.severity).toUpperCase()}
        </span>
        <span className={PILL_TONE_CLASS[issueStatusTone(ncr.status)]}>
          {issueStatusLabel(ncr.status).toUpperCase()}
        </span>
        <span className="shell-mono ml-auto text-[12px] text-muted-foreground/70">
          {formatRaisedDate(ncr.createdAt)}
        </span>
      </div>
    </button>
  );
}

export function IssuesListScreen() {
  const navigate = useNavigate();
  const {
    projectId: ctxProjectId,
    ncrs,
    loading,
    loadError,
    openCount,
    refetch,
  } = useIssuesShellContext();
  // CaptureModal needs a concrete projectId string; fall back to the effective
  // hook (the context value originates there) so the raise-issue flow works even
  // before the shell context settles.
  const { projectId: effectiveProjectId } = useEffectiveProjectId();
  const projectId = ctxProjectId ?? effectiveProjectId;

  const [filter, setFilter] = useState<IssueFilterKey>('open');
  const [captureOpen, setCaptureOpen] = useState(false);

  const visible = useMemo(() => sortIssuesForShell(filterIssues(ncrs, filter)), [ncrs, filter]);

  const issueHref = (ncrId: string) => withProjectQuery(`/m/issues/${ncrId}`, projectId);

  const sub = (
    <span className="flex items-center gap-2">
      {openCount > 0 ? (
        <span className="shell-mono text-[12px] font-semibold uppercase tracking-[0.1em] text-destructive">
          {openCount} open
        </span>
      ) : (
        <span>NCRs &amp; defects on your lots</span>
      )}
    </span>
  );

  const raiseBar = (
    <div className="shell-cambar">
      <button
        type="button"
        onClick={() => setCaptureOpen(true)}
        disabled={!projectId}
        className={cn('shell-cambar-btn', !projectId && 'opacity-50')}
        aria-label="Raise an issue"
      >
        <Camera size={20} aria-hidden="true" />
        Raise an issue
      </button>
    </div>
  );

  if (loading) {
    return (
      <ShellScreen variant="inner" title="Issues" parent="/m" sub={<span>Loading…</span>}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-[104px] animate-pulse rounded-2xl bg-muted" />
        ))}
      </ShellScreen>
    );
  }

  return (
    <>
      <ShellScreen variant="inner" title="Issues" parent="/m" sub={sub} bottom={raiseBar}>
        {/* Filter chips */}
        <div
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
          role="group"
          aria-label="Filter issues by status"
        >
          {ISSUE_FILTERS.map((f) => {
            const active = filter === f.key;
            const showCount = f.key === 'open' && openCount > 0;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                aria-pressed={active}
                className={cn(
                  'min-h-[40px] whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-semibold touch-manipulation',
                  active
                    ? 'bg-foreground text-[hsl(40_33%_98%)]'
                    : 'bg-secondary text-muted-foreground',
                )}
              >
                {f.label}
                {showCount ? ` (${openCount})` : ''}
              </button>
            );
          })}
        </div>

        {loadError && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] font-semibold text-destructive">
            {loadError}
          </div>
        )}

        {!loadError && visible.length === 0 && (
          <div className="py-16 text-center text-[14px] leading-relaxed text-muted-foreground">
            {filter === 'open' ? (
              <>
                No open issues. Good.
                <br />
                Spot something wrong? Photo first — words later.
              </>
            ) : (
              <>
                No {filter === 'closed' ? 'closed ' : ''}issues here.
                <br />
                Raise one with a photo when something’s wrong.
              </>
            )}
          </div>
        )}

        {visible.map((ncr) => (
          <IssueCard key={ncr.id} ncr={ncr} onPress={() => navigate(issueHref(ncr.id))} />
        ))}
      </ShellScreen>

      {/* Raise-issue flow — the EXISTING CaptureModal, pre-set to NCR (Defect)
          mode. Capture-first: camera opens immediately; the foreman adds a few
          words after the shot; CaptureModal's own POST /api/ncrs raises the NCR.
          On capture we refetch so the new issue appears without a manual reload. */}
      {projectId && (
        <CaptureModal
          projectId={projectId}
          isOpen={captureOpen}
          onClose={() => setCaptureOpen(false)}
          defaultCaptureType="ncr"
          onCapture={(result) => {
            // A raised defect creates a real NCR — refetch so it lands in the
            // list. Plain photos don't change the register, so skip the refetch.
            if (result.type === 'ncr') void refetch();
          }}
        />
      )}
    </>
  );
}
