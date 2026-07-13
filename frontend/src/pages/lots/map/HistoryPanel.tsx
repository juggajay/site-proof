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
 * Toolbar popover for the time scrubber: a date slider that recolours every lot
 * polygon to its status on the chosen date, drawn from recorded audit history.
 */
export function HistoryPanel({
  earliestKey,
  todayKey,
  valueKey,
  onChange,
  isLoading,
  error,
  onRetry,
}: HistoryPanelProps) {
  return (
    <div
      className="mt-2 w-72 rounded-md border bg-background p-3 shadow-lg"
      data-testid="history-panel"
    >
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading history…</p>
      ) : error ? (
        <div className="text-xs">
          <p className="text-destructive">Could not load status history.</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 rounded border px-2 py-1 hover:bg-muted"
            data-testid="history-retry"
          >
            Try again
          </button>
        </div>
      ) : !earliestKey ? (
        <p className="text-xs text-muted-foreground">No recorded history for this project yet.</p>
      ) : (
        <>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Showing status as of</p>
          <p className="mb-2 text-sm font-semibold" data-testid="history-date">
            {formatReadable(valueKey)}
          </p>
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
            className="w-full"
            aria-label="Select date"
            data-testid="history-slider"
          />
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>{formatReadable(earliestKey)}</span>
            <span>Today</span>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Based on recorded status history — as far back as the audit trail goes.
          </p>
        </>
      )}
    </div>
  );
}
