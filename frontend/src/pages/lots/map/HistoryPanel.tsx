import { History, X } from 'lucide-react';

import { dateKeyToUtcDayNumber, parseDateKey } from '@/lib/localDate';

import { dateKeySpan, dayNumberToDateKey } from './statusTimelineData';

interface HistoryPanelProps {
  /** Earliest reachable date (YYYY-MM-DD, Sydney) or null while loading/empty. */
  earliestKey: string | null;
  /** Today (YYYY-MM-DD, Sydney) — the slider maximum. */
  todayKey: string;
  /** Currently selected date (YYYY-MM-DD). */
  valueKey: string;
  onChange: (dateKey: string) => void;
  /** Leaves Past view entirely. Drag is never the only way out; nor is a toggle. */
  onExit: () => void;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
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
 * DG-4b. The Past view bar.
 *
 * Past is a temporal MODE, not a tool: it changes the date every polygon on the
 * map is about. So the date is stated permanently and the slider lives in the
 * bar — you can never be in Past view and not know it, and you can never be in
 * it without an obvious way out. (Rev 1 hid both inside a popover that closed,
 * which left a historical map looking exactly like a live one.)
 */
export function HistoryPanel({
  earliestKey,
  todayKey,
  valueKey,
  onChange,
  onExit,
  isLoading,
  error,
  onRetry,
}: HistoryPanelProps) {
  return (
    <div
      className="rounded-md bg-primary px-3 py-2.5 text-primary-foreground shadow-lg"
      data-testid="history-panel"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2.5">
          <History className="h-5 w-5 flex-none" aria-hidden />
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-widest opacity-75">
              Past view
            </p>
            <p className="text-sm font-semibold" data-testid="history-date">
              {isLoading || error || !earliestKey ? '—' : formatReadable(valueKey)}
            </p>
          </div>
        </div>

        {isLoading ? (
          <p className="text-xs opacity-80">Loading history…</p>
        ) : error ? (
          <div className="flex items-center gap-2 text-xs">
            <span>Could not load status history.</span>
            <button
              type="button"
              onClick={onRetry}
              className="rounded border border-primary-foreground/50 px-2 py-1 hover:bg-primary-foreground/10"
              data-testid="history-retry"
            >
              Try again
            </button>
          </div>
        ) : !earliestKey ? (
          <p className="text-xs opacity-80">No recorded history for this project yet.</p>
        ) : (
          <div className="min-w-[10rem] flex-1">
            <input
              type="range"
              min={0}
              max={Math.max(0, dateKeySpan(earliestKey, todayKey))}
              step={1}
              value={Math.max(0, dateKeySpan(earliestKey, valueKey))}
              onChange={(e) => {
                const base = dateKeyToUtcDayNumber(earliestKey);
                if (base === null) return;
                onChange(dayNumberToDateKey(base + Number(e.target.value)));
              }}
              className="w-full accent-primary-foreground"
              aria-label="Select date"
              data-testid="history-slider"
            />
            <div className="mt-0.5 flex justify-between font-mono text-[10px] opacity-75">
              <span>{formatReadable(earliestKey)}</span>
              <span>today</span>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onExit}
          className="ml-auto inline-flex min-h-[48px] items-center justify-center gap-2 rounded-md border border-primary-foreground/50 px-3 text-sm font-medium hover:bg-primary-foreground/10"
          data-testid="history-exit"
        >
          <X className="h-4 w-4" aria-hidden /> Exit Past view
        </button>
      </div>

      <p className="mt-1.5 text-[11px] opacity-75">
        Status as recorded in the audit trail — a lot absent from the map did not exist yet.
      </p>
    </div>
  );
}
