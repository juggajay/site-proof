import { X } from 'lucide-react';

import { NativeSelect } from '@/components/ui/native-select';
import { cn } from '@/lib/utils';

import {
  ALL_WORK_TYPES,
  selectCoverageGroup,
  type CoverageGap,
  type CoverageLine,
} from './coverageData';

interface CoveragePanelProps {
  lines: CoverageLine[];
  // Project-wide (not per line) — rendered once at the foot of the panel.
  unmappedLotCount: number;
  isLoading: boolean;
  error: unknown;
  isMobile: boolean;
  selection: Record<string, string>;
  onSelectActivity: (lineId: string, activityType: string) => void;
  onGapClick: (gap: CoverageGap) => void;
  onClear: () => void;
  onRetry: () => void;
}

function metres(value: number): string {
  return `${Math.round(value).toLocaleString()} m`;
}

// A labelled percent bar. Green fill for conformed, blue for lotted.
function PercentBar({
  label,
  percent,
  tone,
}: {
  label: string;
  percent: number;
  tone: 'lotted' | 'conformed';
}) {
  const fill = tone === 'conformed' ? 'bg-emerald-500' : 'bg-blue-500';
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{percent}%</span>
      </div>
      <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full', fill)}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
    </div>
  );
}

function LineSection({
  line,
  activityType,
  onSelectActivity,
  onGapClick,
}: {
  line: CoverageLine;
  activityType: string;
  onSelectActivity: (lineId: string, activityType: string) => void;
  onGapClick: (gap: CoverageGap) => void;
}) {
  if (line.error || !line.groups) {
    return (
      <section className="border-b px-3 py-2" data-testid={`coverage-line-${line.id}`}>
        <h4 className="text-sm font-semibold">{line.name}</h4>
        <p className="mt-1 text-xs text-destructive">
          {line.error ?? 'Coverage is unavailable for this line.'}
        </p>
      </section>
    );
  }

  const group = selectCoverageGroup(line, activityType);
  if (!group) return null;

  return (
    <section className="border-b px-3 py-2" data-testid={`coverage-line-${line.id}`}>
      <div className="flex items-center justify-between gap-2">
        <h4 className="truncate text-sm font-semibold">{line.name}</h4>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          Ch {Math.round(line.extentStart ?? 0)}–{Math.round(line.extentEnd ?? 0)}
        </span>
      </div>

      <NativeSelect
        className="mt-2 h-8 text-xs"
        value={activityType}
        onChange={(e) => onSelectActivity(line.id, e.target.value)}
        aria-label={`Work type for ${line.name}`}
        data-testid={`coverage-activity-${line.id}`}
      >
        {line.groups.map((g) => (
          <option key={g.activityType} value={g.activityType}>
            {g.activityType} ({g.lotCount})
          </option>
        ))}
      </NativeSelect>

      <div className="mt-2 space-y-2">
        <PercentBar label="Lotted" percent={group.percentLotted} tone="lotted" />
        <PercentBar label="Conformed" percent={group.percentConformed} tone="conformed" />
      </div>

      <p className="mt-1.5 text-xs text-muted-foreground">
        {metres(group.coveredLengthM)} of {metres((line.extentEnd ?? 0) - (line.extentStart ?? 0))}{' '}
        lotted
        {' · '}
        {metres(group.conformedLengthM)} conformed
      </p>

      <div className="mt-2">
        <p className="text-xs font-medium">Gaps ({group.gaps.length})</p>
        {group.gaps.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">No gaps — full coverage.</p>
        ) : (
          <ul className="mt-1 space-y-0.5">
            {group.gaps.map((gap) => (
              <li key={`${gap.start}-${gap.end}`}>
                <button
                  type="button"
                  onClick={() => onGapClick(gap)}
                  className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs hover:bg-muted"
                  data-testid={`coverage-gap-${line.id}-${gap.start}`}
                >
                  <span className="font-medium tabular-nums">
                    Ch {Math.round(gap.start)}–{Math.round(gap.end)}
                  </span>
                  <span className="text-muted-foreground tabular-nums">{metres(gap.lengthM)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function CoveragePanel({
  lines,
  unmappedLotCount,
  isLoading,
  error,
  isMobile,
  selection,
  onSelectActivity,
  onGapClick,
  onClear,
  onRetry,
}: CoveragePanelProps) {
  const containerClass = isMobile
    ? 'absolute inset-x-0 bottom-0 max-h-[70%] rounded-t-2xl border-t shadow-2xl'
    : 'absolute inset-y-0 right-0 w-80 max-w-[85%] border-l shadow-xl';

  return (
    <div
      className={cn('z-[1000] flex flex-col bg-background pointer-events-auto', containerClass)}
      data-testid="coverage-panel"
      role="dialog"
      aria-label="Coverage report"
    >
      <div className="flex items-center justify-between border-b px-3 py-2">
        <h3 className="text-sm font-semibold">Coverage</h3>
        <button
          type="button"
          onClick={onClear}
          className="rounded p-1 text-muted-foreground hover:bg-muted"
          aria-label="Close coverage"
          data-testid="coverage-clear"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading && (
          <p className="p-4 text-sm text-muted-foreground" role="status">
            Computing coverage…
          </p>
        )}

        {!isLoading && error != null && (
          <div className="p-4 text-sm" role="alert">
            <p className="font-medium text-destructive">Could not load coverage</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
            >
              Try again
            </button>
          </div>
        )}

        {!isLoading && !error && lines.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">
            No control lines yet — add one in Project Settings to compute coverage.
          </p>
        )}

        {!isLoading &&
          !error &&
          lines.map((line) => (
            <LineSection
              key={line.id}
              line={line}
              activityType={selection[line.id] ?? ALL_WORK_TYPES}
              onSelectActivity={onSelectActivity}
              onGapClick={onGapClick}
            />
          ))}

        {!isLoading && !error && unmappedLotCount > 0 && (
          <p className="border-t px-3 py-2 text-xs text-amber-600" data-testid="coverage-unmapped">
            {unmappedLotCount} lot{unmappedLotCount === 1 ? '' : 's'} in this project have no mapped
            geometry and are excluded from coverage.
          </p>
        )}
      </div>
    </div>
  );
}

export default CoveragePanel;
