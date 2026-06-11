/**
 * LotsListScreen — /m/lots — the lot register for the foreman shell.
 *
 * Design spec: docs/design-foreman-shell-mock-v4.html #lots.
 * Cards show mono LOT-### + description, a status pill, ITP total, an animated
 * progress bar, and a "N due" chip when the foreman worklist has checks due on
 * the lot. Lots sort actionable-first via the pure `sortLotsForShell`.
 *
 * Foreman-truth (doc 14): read + inspect only — no create, no edit, no budget.
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ShellScreen } from '../../components/ShellScreen';
import { useLotsShellContext } from './lotsShellContext';
import {
  deriveLotShellMeta,
  sortLotsForShell,
  type LotPillTone,
  type LotShellMeta,
} from './lotsShellState';

const PILL_TONE_CLASS: Record<LotPillTone, string> = {
  attention: 'shell-pill shell-pill-attention',
  bad: 'shell-pill shell-pill-bad',
  good: 'shell-pill shell-pill-good',
  neutral: 'shell-pill',
};

/** Rough progress for the lot bar: resolved/total isn't on the register, so we
 * show a conservative bar from status + checks-due — full for done states, a
 * partial nudge for in-progress, empty otherwise. Never a fabricated ratio. */
function lotProgressPct(meta: LotShellMeta): number {
  if (meta.tone === 'good') return 100;
  if (meta.itpCount === 0) return 0;
  // In-progress lots get a visible-but-honest partial bar; checks due pull it
  // down a little so "more to do" reads as less full.
  const base = meta.tone === 'attention' ? 60 : 45;
  return meta.checksDue > 0 ? Math.max(base - 10, 20) : base;
}

function LotCard({ meta, onPress }: { meta: LotShellMeta; onPress: () => void }) {
  const pct = lotProgressPct(meta);
  return (
    <button
      type="button"
      className="shell-card"
      onClick={onPress}
      aria-label={`Lot ${meta.lotNumber}${meta.description ? ` — ${meta.description}` : ''}, ${meta.statusLabel}${
        meta.checksDue > 0 ? `, ${meta.checksDue} checks due` : ''
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1">
          <span className="shell-mono text-[15px] font-semibold text-foreground">
            {meta.lotNumber}
          </span>
          {meta.description && (
            <span className="ml-2 text-[14px] font-semibold text-muted-foreground">
              — {meta.description}
            </span>
          )}
        </span>
        <ChevronRight size={16} className="flex-shrink-0 text-muted-foreground/50" aria-hidden />
      </div>

      <div className="mt-[10px] flex flex-wrap gap-[7px]">
        <span className={PILL_TONE_CLASS[meta.tone]}>{meta.statusLabel.toUpperCase()}</span>
        {meta.itpCount > 0 && <span className="shell-pill">ITP {meta.itpCount}</span>}
        {meta.checksDue > 0 && (
          <span className="shell-pill shell-pill-attention">{meta.checksDue} DUE</span>
        )}
        {meta.ncrCount > 0 && (
          <span className="shell-pill shell-pill-bad">
            {meta.ncrCount} NCR{meta.ncrCount === 1 ? '' : 'S'}
          </span>
        )}
      </div>

      <div className="shell-lotprog" aria-hidden>
        <i style={{ '--shell-prog-w': `${pct}%` } as React.CSSProperties} />
      </div>
    </button>
  );
}

export function LotsListScreen() {
  const navigate = useNavigate();
  const { projectId, lots, loading, error, checksDue } = useLotsShellContext();

  const sorted = useMemo(() => {
    const metas = lots.map((lot) => deriveLotShellMeta(lot, checksDue[lot.id] ?? 0));
    return sortLotsForShell(metas);
  }, [lots, checksDue]);

  const totalDue = useMemo(() => sorted.reduce((acc, m) => acc + m.checksDue, 0), [sorted]);

  const sub = (
    <span className="flex items-center gap-2">
      <span>
        {sorted.length} lot{sorted.length === 1 ? '' : 's'}
      </span>
      {totalDue > 0 && (
        <span
          className={cn(
            'shell-mono text-[12px] font-semibold uppercase tracking-[0.1em] text-warning',
          )}
        >
          {totalDue} CHECKS DUE
        </span>
      )}
    </span>
  );

  const lotHref = (lotId: string) =>
    projectId ? `/m/lots/${lotId}?projectId=${projectId}` : `/m/lots/${lotId}`;

  if (loading) {
    return (
      <ShellScreen variant="inner" title="Lots" parent="/m" sub={<span>Loading…</span>}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-[120px] animate-pulse rounded-2xl bg-muted" />
        ))}
      </ShellScreen>
    );
  }

  return (
    <ShellScreen variant="inner" title="Lots" parent="/m" sub={sub}>
      {error && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] font-semibold text-destructive">
          Couldn’t load lots. Pull back and try again.
        </div>
      )}

      {!error && sorted.length === 0 && (
        <div className="py-16 text-center text-[14px] leading-relaxed text-muted-foreground">
          No lots on this project yet.
          <br />
          They’ll show here once the office sets them up.
        </div>
      )}

      {sorted.map((meta) => (
        <LotCard key={meta.id} meta={meta} onPress={() => navigate(lotHref(meta.id))} />
      ))}
    </ShellScreen>
  );
}
