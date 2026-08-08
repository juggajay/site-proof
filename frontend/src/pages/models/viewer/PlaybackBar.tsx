import { History, RotateCcw, X } from 'lucide-react';
import { Link } from 'react-router-dom';

import { dateKeyToUtcDayNumber, parseDateKey } from '@/lib/localDate';
import { formatStatusLabel } from '@/lib/statusLabels';
import { getLotStatusSwatch } from '@/lib/statusColors';
import { dateKeySpan, dayNumberToDateKey } from '@/pages/lots/map/statusTimelineData';
import type { ModelElementLinksResponse } from '@/lib/models/designModelsApi';
import { GHOST_LAYER, type PaintPlan } from './playbackPaint';

interface PlaybackBarProps {
  projectId: string;
  /** Earliest reachable date (YYYY-MM-DD, Sydney) or null while loading/empty. */
  earliestKey: string | null;
  /** Today (YYYY-MM-DD, Sydney) — the slider maximum. */
  todayKey: string;
  dateKey: string;
  onDateChange: (dateKey: string) => void;
  compare: boolean;
  onCompareChange: (compare: boolean) => void;
  /** Current paint plan (drives the labelled legend counts), null while loading. */
  plan: PaintPlan | null;
  /** The version's link coverage, null while loading. */
  linkCounts: ModelElementLinksResponse['counts'] | null;
  /** True for roles that can open the Setup copilot to run lot linking. */
  canLinkLots: boolean;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  onResetView: () => void;
  onClose: () => void;
}

function formatReadable(dateKey: string): string {
  const parsed = parseDateKey(dateKey);
  if (!parsed) return dateKey;
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)));
}

/**
 * Wave 6 — the 4D playback bar. Same temporal-mode rules as the 2D map's Past
 * view: the date is always stated, the scrubber is always visible, and there is
 * always an obvious way out. Status is never colour-only — every legend entry
 * pairs its swatch with the shared status label and a count.
 */
export function PlaybackBar({
  projectId,
  earliestKey,
  todayKey,
  dateKey,
  onDateChange,
  compare,
  onCompareChange,
  plan,
  linkCounts,
  canLinkLots,
  isLoading,
  error,
  onRetry,
  onResetView,
  onClose,
}: PlaybackBarProps) {
  const nothingLinked = linkCounts !== null && linkCounts.linked === 0;
  // Everything ghosted right now: standing unlinked geometry plus linked
  // elements whose lot had no QA record on the scrubbed date.
  const ghostCount = (linkCounts?.unlinked ?? 0) + (plan?.noRecordCount ?? 0);

  return (
    <div
      className="pointer-events-auto rounded-lg border bg-background/95 p-3 shadow-lg backdrop-blur-sm"
      data-testid="playback-bar"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2.5">
          <History className="h-5 w-5 flex-none text-muted-foreground" aria-hidden />
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              QA playback
            </p>
            <p className="text-sm font-semibold" data-testid="playback-date">
              {isLoading || error || !earliestKey ? '—' : formatReadable(dateKey)}
            </p>
          </div>
        </div>

        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading status history…</p>
        ) : error ? (
          <div className="flex items-center gap-2 text-xs">
            <span>Could not load status history.</span>
            <button
              type="button"
              onClick={onRetry}
              className="rounded border px-2 py-1 hover:bg-muted"
              data-testid="playback-retry"
            >
              Try again
            </button>
          </div>
        ) : !earliestKey ? (
          <p className="text-xs text-muted-foreground">
            No recorded status history for this project yet.
          </p>
        ) : (
          <div className="min-w-[10rem] flex-1">
            <input
              type="range"
              min={0}
              max={Math.max(0, dateKeySpan(earliestKey, todayKey))}
              step={1}
              value={Math.max(0, dateKeySpan(earliestKey, dateKey))}
              onChange={(e) => {
                const base = dateKeyToUtcDayNumber(earliestKey);
                if (base === null) return;
                onDateChange(dayNumberToDateKey(base + Number(e.target.value)));
              }}
              className="w-full accent-primary"
              aria-label="Select date"
              data-testid="playback-slider"
            />
            <div className="mt-0.5 flex justify-between font-mono text-[10px] text-muted-foreground">
              <span>{formatReadable(earliestKey)}</span>
              <span>today</span>
            </div>
          </div>
        )}

        <label className="flex cursor-pointer items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={compare}
            onChange={(e) => onCompareChange(e.target.checked)}
            className="h-3.5 w-3.5 accent-primary"
            data-testid="playback-compare"
          />
          Changes since this date
        </label>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={onResetView}
            aria-label="Reset view"
            title="Reset view"
            className="rounded p-2 text-muted-foreground hover:bg-muted"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Exit QA playback"
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-md border px-3 text-sm font-medium hover:bg-muted"
            data-testid="playback-exit"
          >
            <X className="h-4 w-4" aria-hidden /> Exit
          </button>
        </div>
      </div>

      <div
        className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-2 text-xs"
        data-testid="playback-legend"
      >
        {compare && plan && (
          <span className="font-medium" data-testid="playback-changed-count">
            {plan.changedCount ?? 0} changed since {formatReadable(dateKey)}
          </span>
        )}
        {plan &&
          [...plan.statusCounts.entries()].map(([status, count]) => (
            <span key={status} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: getLotStatusSwatch(status) }}
              />
              <span>{formatStatusLabel(status)}</span>
              <span className="font-mono font-semibold">{count}</span>
            </span>
          ))}
        {ghostCount > 0 && (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span
              className="h-2.5 w-2.5 rounded-sm border border-muted-foreground/40"
              style={{ backgroundColor: GHOST_LAYER.color, opacity: 0.4 }}
            />
            <span>No QA record</span>
            <span className="font-mono font-semibold">{ghostCount}</span>
          </span>
        )}

        {linkCounts && (
          <span
            className={`ml-auto ${nothingLinked ? 'font-medium text-warning' : 'text-muted-foreground'}`}
            data-testid="playback-coverage"
          >
            {nothingLinked
              ? 'No elements are linked to lots yet.'
              : `${linkCounts.linked} of ${linkCounts.elements} elements linked to lots.`}
            {canLinkLots && linkCounts.unlinked > 0 && (
              <>
                {' '}
                <Link
                  to={`/projects/${projectId}/copilot?stage=model_lot_linking`}
                  className="underline hover:text-foreground"
                >
                  Link lots
                </Link>
              </>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
