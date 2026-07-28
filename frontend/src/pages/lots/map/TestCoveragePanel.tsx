import { RefreshCw, X } from 'lucide-react';

import { cn } from '@/lib/utils';

import {
  UNKNOWN_CAUSE_LABELS,
  getTestCoverageColor,
  TEST_COVERAGE_LEGEND,
  type TestCoverageLot,
  type TestCoverageRule,
} from './testCoverageData';

interface TestCoveragePanelProps {
  lots: TestCoverageLot[];
  /** Counted, never drawn — the honesty line of §4.2. */
  lotsWithoutGeometry: number;
  isLoading: boolean;
  error: unknown;
  isMobile: boolean;
  /** `dataUpdatedAt` from the query. 0 while nothing has resolved yet. */
  updatedAt: number;
  isFetching: boolean;
  onOpenLot: (lotId: string) => void;
  onClear: () => void;
  onRefresh: () => void;
}

/** "as at 14:32" — a compliance verdict on a 5-minute cache says how old it is. */
function asAt(updatedAt: number): string | null {
  if (!updatedAt) return null;
  return new Date(updatedAt).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function shortfallLine(rule: TestCoverageRule): string {
  const required = rule.requiredCount ?? 0;
  const cite = rule.citation ? ` (${rule.citation.document}, clause ${rule.citation.clause})` : '';
  return `${rule.passingCount} of ${required} ${rule.testType} verified${cite}`;
}

function LotRow({ lot, onOpenLot }: { lot: TestCoverageLot; onOpenLot: (id: string) => void }) {
  const short = (lot.rules ?? []).filter((rule) => rule.state === 'insufficient');
  const causes = lot.unknownCauses ?? [];
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpenLot(lot.lotId)}
        className="w-full border-b px-3 py-2 text-left hover:bg-muted"
        data-testid={`test-coverage-lot-${lot.lotId}`}
      >
        <div className="flex items-center gap-2">
          <span
            className="h-3 w-3 shrink-0 rounded"
            style={{ backgroundColor: getTestCoverageColor(lot.state) }}
          />
          <span className="truncate text-sm font-medium">{lot.lotNumber ?? lot.lotId}</span>
        </div>
        {short.length > 0 && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {short.map(shortfallLine).join(' · ')}
          </p>
        )}
        {lot.state === 'unknown' && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {causes.length > 0
              ? causes.map((cause) => UNKNOWN_CAUSE_LABELS[cause]).join(' · ')
              : 'No test-frequency rule resolved for this lot.'}
          </p>
        )}
      </button>
    </li>
  );
}

/**
 * Wave C3 Phase A. The shortfall list behind the Testing overlay.
 *
 * It lists only the lots the overlay is telling you something about —
 * `insufficient` and `unknown`. A satisfied lot is already saying everything it
 * has to say with its colour.
 */
export function TestCoveragePanel({
  lots,
  lotsWithoutGeometry,
  isLoading,
  error,
  isMobile,
  updatedAt,
  isFetching,
  onOpenLot,
  onClear,
  onRefresh,
}: TestCoveragePanelProps) {
  const containerClass = isMobile
    ? 'absolute inset-x-0 bottom-0 max-h-[70%] rounded-t-2xl border-t shadow-2xl'
    : 'absolute inset-y-0 right-0 w-80 max-w-[85%] border-l shadow-xl';

  const listed = lots.filter((lot) => lot.state !== 'satisfied');
  const satisfiedCount = lots.length - listed.length;
  const stamp = asAt(updatedAt);

  return (
    <div
      className={cn('z-[1000] flex flex-col bg-background pointer-events-auto', containerClass)}
      data-testid="test-coverage-panel"
      role="dialog"
      aria-label="Testing coverage"
    >
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Testing</h3>
          {stamp && (
            <p className="text-xs text-muted-foreground" data-testid="test-coverage-stamp">
              as at {stamp}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isFetching}
            className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-50"
            aria-label="Refresh testing coverage"
            data-testid="test-coverage-refresh"
          >
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          </button>
          <button
            type="button"
            onClick={onClear}
            className="rounded p-1 text-muted-foreground hover:bg-muted"
            aria-label="Close testing coverage"
            data-testid="test-coverage-clear"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading && (
          <p className="p-4 text-sm text-muted-foreground" role="status">
            Checking test frequency…
          </p>
        )}

        {/* A failed fetch is NOT `unknown` [C3S-B7]: the map keeps its status
            colours and the panel says the overlay is the thing that is missing. */}
        {!isLoading && error != null && (
          <div className="p-4 text-sm" role="alert" data-testid="test-coverage-error">
            <p className="font-medium text-destructive">
              Testing coverage is unavailable — the map is showing lot status
            </p>
            <button
              type="button"
              onClick={onRefresh}
              className="mt-2 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
            >
              Try again
            </button>
          </div>
        )}

        {!isLoading && !error && (
          <>
            <div className="flex flex-wrap gap-3 border-b px-3 py-2 text-xs">
              {TEST_COVERAGE_LEGEND.map(({ state, label }) => (
                <span key={state} className="flex items-center gap-1">
                  <span
                    className="h-3 w-3 rounded"
                    style={{ backgroundColor: getTestCoverageColor(state) }}
                  />
                  {label}
                </span>
              ))}
            </div>

            {listed.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                Every mapped lot has the tests its specification requires.
              </p>
            ) : (
              <ul>
                {listed.map((lot) => (
                  <LotRow key={lot.lotId} lot={lot} onOpenLot={onOpenLot} />
                ))}
              </ul>
            )}

            <p
              className="px-3 py-2 text-xs text-muted-foreground"
              data-testid="test-coverage-tally"
            >
              {satisfiedCount} satisfied · {listed.length} to review
            </p>

            {lotsWithoutGeometry > 0 && (
              <p
                className="border-t px-3 py-2 text-xs text-amber-600"
                data-testid="test-coverage-unmapped"
              >
                {lotsWithoutGeometry} lot{lotsWithoutGeometry === 1 ? '' : 's'} not on the map — not
                drawn, so not coloured.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
