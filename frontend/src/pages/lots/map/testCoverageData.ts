import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

// Wave C3 Phase A. The three-valued testing verdict, straight from the engine —
// `SufficiencyEvaluation.state`. Never a fourth value, never a percentage.
export type TestCoverageState = 'satisfied' | 'insufficient' | 'unknown';

export type TestCoverageUnknownCause =
  | 'no_ruleset_for_project'
  | 'no_rule_for_activity'
  | 'activity_not_canonical'
  | 'scale_not_selected'
  | 'scale_not_recognised'
  | 'quantity_missing';

export interface TestCoverageRule {
  testType: string;
  state: TestCoverageState;
  requiredCount: number | null;
  passingCount: number;
  pendingCount: number;
  failedCount: number;
  citation: { authority: string; document: string; clause: string } | null;
}

export interface TestCoverageLot {
  lotId: string;
  state: TestCoverageState;
  // Present only for `insufficient` and `unknown` — the states the panel lists.
  lotNumber?: string;
  ruleset?: { id: string; status: string } | null;
  rules?: TestCoverageRule[];
  unknownCauses?: TestCoverageUnknownCause[];
}

export interface TestCoverageResponse {
  lots: TestCoverageLot[];
  lotsWithoutGeometry: number;
}

// Okabe-Ito, matching the shipped lot-status palette's colour-blind safety.
// Grey is a VERDICT here ("CIVOS has no rule"), which is why a loading or failed
// fetch must never render it — see LotMapView's fillOverride guard [C3S-B7].
const TEST_COVERAGE_COLORS: Record<TestCoverageState, string> = {
  satisfied: '#009E73',
  insufficient: '#E69F00',
  unknown: '#9ca3af',
};

export const TEST_COVERAGE_LEGEND: Array<{ state: TestCoverageState; label: string }> = [
  { state: 'satisfied', label: 'Testing satisfied' },
  { state: 'insufficient', label: 'Fewer tests than required' },
  { state: 'unknown', label: 'No rule' },
];

export const getTestCoverageColor = (state: TestCoverageState) => TEST_COVERAGE_COLORS[state];

/** Why CIVOS has no opinion — the overlay's most useful setup diagnostic. */
export const UNKNOWN_CAUSE_LABELS: Record<TestCoverageUnknownCause, string> = {
  no_ruleset_for_project: 'No test-frequency pack for this authority',
  no_rule_for_activity: 'No rule for this activity',
  activity_not_canonical: 'Lot has no classified activity',
  scale_not_selected: 'No testing scale selected',
  scale_not_recognised: 'Testing scale not one the specification uses',
  quantity_missing: 'No quantity recorded',
};

// lotId → verdict. Built once per response so the map's per-geometry lookup is
// O(1) and the panel and the polygons read the same object.
export function testCoverageByLot(data: TestCoverageResponse | undefined) {
  const out = new Map<string, TestCoverageLot>();
  for (const lot of data?.lots ?? []) out.set(lot.lotId, lot);
  return out;
}

/**
 * Lazily fetched only when the Testing overlay is first armed — same shape as
 * `useLotStatusTimeline`. TanStack Query v4 here (`cacheTime`, not `gcTime`).
 *
 * The 5-minute cache is why `TestCoveragePanel` stamps `dataUpdatedAt` as
 * "as at HH:MM" and offers a Refresh: a cached compliance verdict is fine, one
 * that LOOKS live is not [C3R-A9].
 */
export function useTestCoverage(projectId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.projectTestCoverage(projectId ?? ''),
    queryFn: () => {
      if (!projectId) throw new Error('Project not found');
      return apiFetch<TestCoverageResponse>(
        `/api/projects/${encodeURIComponent(projectId)}/lots/test-coverage`,
      );
    },
    enabled: enabled && !!projectId,
    cacheTime: 5 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
  });
}
