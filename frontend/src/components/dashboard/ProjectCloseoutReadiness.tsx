// Wave D `D1a` — the project quality closeout readiness section (spec Rev 3
// §4.2, §9).
//
// QUALITY closeout, not "handover readiness" `[DR-A1]`: conformance, ITP, tests,
// hold points and NCRs. It deliberately says nothing about the commercial or
// record dimensions a handover pack also needs, and it gates nothing — no
// action anywhere in the app starts refusing because this panel is red.
//
// It groups BLOCKED LOTS BY REASON CODE. It does not name the lots: the payload
// carries verdicts keyed by lot id, and a dashboard section that lists 5,000 lot
// numbers is a lots page wearing a card. A per-code count plus a route to the
// lots list is the whole of what this surface owes the reader today.

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

/**
 * MIRRORED from the backend registry. The frontend cannot import backend code
 * (`frontend/tsconfig.json` includes `src` only), so this follows the sanctioned
 * pattern used by `frontend/src/lib/readinessPredicates.ts`: re-state it, and
 * keep it in lockstep with the single source of truth —
 * `backend/src/lib/readiness/contracts/reasonCodes.ts`
 * (`HANDOVER_BLOCKING_REASON_CODES`).
 *
 * Lockstep is ENFORCED, not merely requested: a backend unit test
 * (`backend/src/routes/projectCloseoutReadiness.test.ts`) reads this file and
 * fails if the two lists diverge. `[DH-B5]` — the registry cannot drift, and a
 * hand-mirror guarded only by a comment is exactly the drift it forbids.
 */
export const HANDOVER_BLOCKING_REASON_CODES = [
  'no_itp_assigned',
  'itp_incomplete',
  'no_passing_verified_test',
  'open_ncrs',
  'hp_conditions_open',
  'na_hold_point_not_released',
  'insufficient_test_count',
  'not_conformed',
  'open_major_ncrs',
  'unreleased_hold_points',
] as const;

export type HandoverReasonCode = (typeof HANDOVER_BLOCKING_REASON_CODES)[number];

/** A missing entry is a compile error, so a new code cannot ship unlabelled. */
const REASON_CODE_LABELS: Record<HandoverReasonCode, string> = {
  no_itp_assigned: 'No ITP assigned',
  itp_incomplete: 'ITP not complete',
  no_passing_verified_test: 'No passing verified test',
  open_ncrs: 'Open NCRs',
  hp_conditions_open: 'Release conditions not yet satisfied',
  na_hold_point_not_released: 'N/A hold point not released',
  insufficient_test_count: 'Not enough tests',
  not_conformed: 'Not conformed',
  open_major_ncrs: 'Open major NCRs',
  unreleased_hold_points: 'Hold points unreleased',
};

export interface HandoverReadinessVerdict {
  subjectType: 'lot' | 'project';
  subjectId: string;
  ready: boolean;
  reasonCodes: HandoverReasonCode[];
}

export interface CloseoutReadinessResponse {
  verdicts: HandoverReadinessVerdict[];
  unplacedLots: number;
  unclassifiedLots: number;
}

/**
 * Widened by ASSIGNMENT, not by a cast: a `Record<HandoverReasonCode, string>`
 * is assignable to this, and indexing it with an arbitrary string honestly
 * yields `string | undefined`. Casting the key would claim a code is registered
 * in order to look up whether it is registered.
 */
const LABEL_BY_CODE: Partial<Record<string, string>> = REASON_CODE_LABELS;

/** An unregistered code is shown, humanised — never silently dropped `[DH-B1]`. */
function labelFor(code: string): string {
  return LABEL_BY_CODE[code] ?? code.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

/**
 * Takes the structural minimum rather than `HandoverReadinessVerdict[]`, so a
 * response carrying a code this build has never heard of is a normal input
 * instead of something a caller has to cast away. `[DH-B1]`: it gets counted and
 * labelled, not dropped.
 */
export function groupBlockedLotsByReason(
  verdicts: readonly { subjectType: string; reasonCodes: readonly string[] }[],
): { code: string; label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const verdict of verdicts) {
    if (verdict.subjectType !== 'lot') continue;
    for (const code of verdict.reasonCodes) {
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
  }
  return [...counts]
    .map(([code, count]) => ({ code, label: labelFor(code), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function ProjectCloseoutReadiness({
  projectId,
  projectRouteBase,
}: {
  projectId: string;
  projectRouteBase: string;
}) {
  const { data, isLoading, error } = useQuery<CloseoutReadinessResponse>({
    queryKey: queryKeys.projectCloseoutReadiness(projectId),
    queryFn: () =>
      apiFetch<CloseoutReadinessResponse>(
        `/api/projects/${encodeURIComponent(projectId)}/closeout-readiness`,
      ),
    enabled: Boolean(projectId),
    staleTime: 5 * 60 * 1000,
    cacheTime: 5 * 60 * 1000,
  });

  const lotVerdicts = (data?.verdicts ?? []).filter((v) => v.subjectType === 'lot');
  const blocked = lotVerdicts.filter((v) => !v.ready).length;
  const groups = groupBlockedLotsByReason(lotVerdicts);

  return (
    <div className="bg-card rounded-lg border p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          Quality Closeout Readiness
        </h2>
        <Link
          to={`${projectRouteBase}/lots`}
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          View lots <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {isLoading ? (
        <div className="text-center py-6 text-muted-foreground text-sm">Checking lots…</div>
      ) : error ? (
        <div className="text-center py-6 text-muted-foreground text-sm">
          Closeout readiness is unavailable right now.
        </div>
      ) : lotVerdicts.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-sm">
          <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          No lots to assess yet
        </div>
      ) : blocked === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-sm">
          <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          All {lotVerdicts.length} lots are quality-closeout ready
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold">{blocked}</span>
            <span className="text-xs text-muted-foreground">
              blocked of {lotVerdicts.length} lots
            </span>
          </div>
          <div className="space-y-2">
            {groups.map((group) => (
              <div key={group.code} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{group.label}</span>
                <span className="font-medium tabular-nums">{group.count}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground pt-1">
            Quality only — conformance, ITPs, tests, hold points and NCRs. It does not assess
            commercial or record completeness.
          </p>
        </div>
      )}
    </div>
  );
}
