import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

import { getStatusColor, LOT_STATUS_LEGEND } from '@/components/lots/linearMapViewHelpers';

import { getTestCoverageColor, TEST_COVERAGE_LEGEND } from './testCoverageData';

interface MapLegendProps {
  /** Canonical status → displayed-lot count; zero-count statuses are omitted. */
  statusCounts: Map<string, number>;
  /** Testing overlay armed with data: legend switches to coverage states. */
  testing: boolean;
  testingCounts: Map<string, number>;
}

/**
 * The legend as a compact floating overlay: colour dot + count per status
 * actually on the map, expandable to full labels. Replaces the full-width
 * strip under the map — in a full-height workspace the map owns that space,
 * and counts carry more information than a swatch key alone.
 */
export function MapLegend({ statusCounts, testing, testingCounts }: MapLegendProps) {
  const [expanded, setExpanded] = useState(false);

  const entries = testing
    ? TEST_COVERAGE_LEGEND.map(({ state, label }) => ({
        key: state as string,
        label,
        color: getTestCoverageColor(state),
        count: testingCounts.get(state) ?? 0,
      }))
    : LOT_STATUS_LEGEND.map(({ key, label }) => ({
        key: key as string,
        label,
        color: getStatusColor(key),
        count: statusCounts.get(key) ?? 0,
      }));
  const present = entries.filter((e) => e.count > 0);
  if (present.length === 0) return null;

  return (
    <div
      className="pointer-events-auto absolute bottom-9 left-3 z-[1001] rounded-md border bg-background/95 text-xs shadow-sm"
      data-testid={testing ? 'testing-legend' : 'map-legend'}
    >
      {expanded ? (
        <div className="p-2">
          <div className="flex items-center justify-between gap-4 pb-1">
            <span className="font-medium">{testing ? 'Testing' : 'Status'}</span>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              aria-label="Collapse legend"
              className="rounded p-0.5 hover:bg-muted"
              data-testid="map-legend-collapse"
            >
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
          <ul className="space-y-1">
            {present.map((e) => (
              <li key={e.key} className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded" style={{ backgroundColor: e.color }} />
                <span>{e.label}</span>
                <span className="ml-auto pl-3 font-mono text-[10px] font-semibold">{e.count}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label="Expand legend"
          title="Legend"
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted/60"
          data-testid="map-legend-expand"
        >
          {present.map((e) => (
            <span key={e.key} className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded" style={{ backgroundColor: e.color }} />
              <span className="font-mono text-[10px] font-semibold">{e.count}</span>
            </span>
          ))}
          <ChevronUp className="h-3 w-3 text-muted-foreground" aria-hidden />
        </button>
      )}
    </div>
  );
}

export default MapLegend;
