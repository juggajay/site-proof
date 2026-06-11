/**
 * LotDetailsScreen — /m/lots/:lotId/details — read-only lot details + status.
 *
 * Design spec: docs/design-foreman-shell-mock-v4.html #lot ("Details & status"
 * tile → read-only fields). Foreman-truth (doc 14): READ ONLY — no edit fields,
 * no conform button, NO budget anywhere. Conformance is the office's call.
 *
 * Readiness trap (doc 14 / trap 3): the commercial conformance-readiness endpoint
 * is role-gated away from the foreman, so this screen NEVER calls it. Instead it
 * derives an honest "what's left" line from data the foreman can already see —
 * ITP resolution (from the loaded instance) + the lot's issue count — via the
 * pure `deriveLotReadinessLine`.
 */
import { useMemo } from 'react';
import { Check } from 'lucide-react';
import { ShellScreen } from '../../components/ShellScreen';
import { useLotsShellContext } from './lotsShellContext';
import { useShellItpRun } from './useShellItpRun';
import { useShellLotParam } from './useShellLotParam';
import { deriveLotReadinessLine, itpHubSummary, lotStatusTone } from './lotsShellState';
import { formatStatusLabel } from '@/lib/statusLabels';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-3 last:border-b-0">
      <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </span>
      <span className="text-right text-[14px] font-medium text-foreground">{value}</span>
    </div>
  );
}

function chainageText(start: number | null, end: number | null): string {
  if (start == null && end == null) return '—';
  if (start != null && end != null) {
    return start === end ? `${start}` : `${start}–${end}`;
  }
  return `${start ?? end}`;
}

export function LotDetailsScreen() {
  const { projectId, lots, checksDue } = useLotsShellContext();
  const lotId = useShellLotParam();
  const lot = useMemo(() => lots.find((l) => l.id === lotId), [lots, lotId]);
  const due = lotId ? (checksDue[lotId] ?? 0) : 0;

  const run = useShellItpRun(projectId ?? undefined, lotId);
  const summary = useMemo(() => itpHubSummary(run.instance, due), [run.instance, due]);
  const issues = lot?.ncrCount ?? 0;
  const readiness = useMemo(() => deriveLotReadinessLine(summary, issues), [summary, issues]);

  const status = lot?.status ?? '';
  const tone = lotStatusTone(status);

  if (!lot) {
    return (
      <ShellScreen
        variant="inner"
        title="Details"
        parent={`/m/lots/${lotId}`}
        sub={<span>Lot</span>}
      >
        <div className="py-16 text-center text-[14px] text-muted-foreground">Lot not found.</div>
      </ShellScreen>
    );
  }

  return (
    <ShellScreen
      variant="inner"
      title="Details"
      parent={`/m/lots/${lotId}`}
      sub={<span className="shell-mono font-semibold text-foreground">{lot.lotNumber}</span>}
    >
      {/* Status card */}
      <div className="shell-card">
        <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Status
        </div>
        <div
          className={
            tone === 'good'
              ? 'mt-1 text-[18px] font-bold text-success'
              : tone === 'attention' || tone === 'bad'
                ? 'mt-1 text-[18px] font-bold text-warning'
                : 'mt-1 text-[18px] font-bold text-foreground'
          }
          style={{ fontFamily: "'IBM Plex Sans Condensed', 'IBM Plex Sans', sans-serif" }}
        >
          {formatStatusLabel(status)}
        </div>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Conformance is set by the office — this is read-only.
        </p>
      </div>

      {/* Read-only fields */}
      <div className="shell-card">
        <Field label="Lot" value={lot.lotNumber} />
        <Field label="Description" value={lot.description || '—'} />
        {lot.activityType && <Field label="Activity" value={lot.activityType} />}
        <Field label="Chainage" value={chainageText(lot.chainageStart, lot.chainageEnd)} />
        {lot.areaZone && <Field label="Area / zone" value={lot.areaZone} />}
        <Field label="ITP items" value={`${summary.resolved} of ${summary.total} done`} />
        <Field label="Open issues" value={`${issues}`} />
      </div>

      {/* Honest readiness line — derived, NOT the gated commercial endpoint */}
      <div
        className={
          readiness.conformable
            ? 'flex items-start gap-2 rounded-2xl border border-success/30 bg-success/10 p-4'
            : 'rounded-2xl border border-border bg-secondary/40 p-4'
        }
      >
        {readiness.conformable && (
          <Check size={16} strokeWidth={2.4} className="mt-0.5 text-success" aria-hidden />
        )}
        <div>
          <div className="text-[13px] font-semibold text-foreground">What’s left</div>
          <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
            {readiness.summary}
          </p>
        </div>
      </div>
    </ShellScreen>
  );
}
