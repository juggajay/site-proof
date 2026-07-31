// Wave F increment F1 — the project-level blocked-value panel
// (`docs/plans/wave-f-claim-readiness-spec-2026-07-31.md` §1.2).
//
// The one claim-readiness surface that did not exist: "how much of this
// project's lot budget cannot be claimed right now, and what is blocking it?"
// Everything it renders is computed by the backend aggregate over the SAME
// readiness engine `CreateClaimModal` reads — this component adds no readiness
// logic of its own, and no dollar arithmetic beyond formatting.
//
// Two rules this panel must never lose (both tested):
//   - §1.4 label, verbatim, in the same visual block as the figures.
//   - §1.2 `[FR-B2]` overlap disclosure: a lot sits in every group that blocks
//     it, so the group values legitimately exceed the blocked total.

import { useEffect, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { formatStatusLabel } from '@/lib/statusLabels';
import type { EvidenceReadinessItem } from '@/types/evidenceReadiness';
import { formatCurrency } from '../utils';

/** The §1.4 label. Exported so a test can assert the exact string. */
export const CLAIM_READINESS_INDICATOR_LABEL =
  'Project-management indicator — not an accounting balance or entitlement.';

interface ClaimReadinessSummaryGroup {
  code: string;
  lotCount: number;
  blockedValue: number;
}

interface ClaimReadinessSummary {
  totalBudget: number;
  claimableValue: number;
  blockedValue: number;
  lotsInScope: number;
  lotsBlocked: number;
  lotsWithNullBudget: number;
  groups: ClaimReadinessSummaryGroup[];
}

interface BlockedLot {
  lotId: string;
  lotNumber: string;
  activityType: string | null;
  budgetAmount: number | null;
  blockedValue: number | null;
  claimedPercentage: number;
  remainingPercentage: number;
  items: EvidenceReadinessItem[];
}

interface BlockedLotsPage {
  reasonCode: string;
  items: BlockedLot[];
  nextCursor: string | null;
}

function BlockedLotRows({
  projectId,
  group,
}: {
  projectId: string;
  group: ClaimReadinessSummaryGroup;
}) {
  const query = useInfiniteQuery({
    queryKey: queryKeys.claimReadinessBlockedLots(projectId, group.code),
    queryFn: ({ pageParam }: { pageParam?: string }) => {
      const params = new URLSearchParams({ reasonCode: group.code, limit: '500' });
      if (pageParam) params.set('cursor', pageParam);
      return apiFetch<BlockedLotsPage>(
        `/api/projects/${encodeURIComponent(projectId)}/claim-readiness/blocked-lots?${params.toString()}`,
      );
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 60_000,
    cacheTime: 5 * 60 * 1000,
  });

  const lots = (query.data?.pages ?? []).flatMap((page) => page.items);

  // The server filters on a COMPUTED code, so a page of the register can hold
  // no matches at all. The summary already told us how many lots this group
  // has, so keep walking the cursor until they are all in hand rather than
  // showing a half-empty list behind a "load more" the user cannot interpret.
  useEffect(() => {
    if (query.hasNextPage && !query.isFetching && lots.length < group.lotCount) {
      void query.fetchNextPage();
    }
  }, [query, lots.length, group.lotCount]);

  if (query.isLoading) {
    return <p className="px-3 py-2 text-xs text-muted-foreground">Finding the lots…</p>;
  }
  if (query.error) {
    return (
      <p className="px-3 py-2 text-xs text-muted-foreground">
        These lots could not be loaded right now.
      </p>
    );
  }

  return (
    <ul className="divide-y">
      {lots.map((lot) => (
        <li key={lot.lotId} className="px-3 py-2">
          <div className="flex items-baseline justify-between gap-3">
            <Link
              to={`/projects/${projectId}/lots/${lot.lotId}`}
              className="text-xs font-medium text-primary hover:underline"
            >
              {lot.lotNumber}
            </Link>
            <span className="flex-1 truncate text-xs text-muted-foreground">
              {lot.activityType ?? 'Unknown activity'}
            </span>
            <span className="text-xs font-medium tabular-nums">
              {lot.budgetAmount === null ? 'No budget' : formatCurrency(lot.blockedValue)}
            </span>
          </div>
          {lot.items.map((item) => (
            <p key={`${lot.lotId}-${item.code}`} className="mt-1 text-[11px] text-muted-foreground">
              {item.title} — {item.detail}
              {item.actionHref && item.actionLabel ? (
                <Link to={item.actionHref} className="ml-1 text-primary hover:underline">
                  {item.actionLabel}
                </Link>
              ) : null}
            </p>
          ))}
        </li>
      ))}
      {lots.length === 0 && !query.hasNextPage && (
        <li className="px-3 py-2 text-xs text-muted-foreground">No lots to show.</li>
      )}
    </ul>
  );
}

export function ClaimBlockedValuePanel({ projectId }: { projectId: string }) {
  const [expandedCode, setExpandedCode] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<ClaimReadinessSummary>({
    queryKey: queryKeys.claimReadinessSummary(projectId),
    queryFn: () =>
      apiFetch<ClaimReadinessSummary>(
        `/api/projects/${encodeURIComponent(projectId)}/claim-readiness/summary`,
      ),
    enabled: Boolean(projectId),
    staleTime: 60_000,
    cacheTime: 5 * 60 * 1000,
  });

  return (
    <div className="bg-card rounded-lg border p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          Value Blocked From Claiming
        </h2>
      </div>

      {isLoading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Checking lot readiness…</p>
      ) : // A malformed body must degrade to "unavailable", never render a
      // half-built dollar figure and never take `ClaimsPage` down with it.
      error || typeof data?.lotsInScope !== 'number' ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Blocked value is unavailable right now.
        </p>
      ) : data.lotsInScope === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No lots to assess yet.</p>
      ) : (
        <div className="space-y-3">
          <dl className="grid grid-cols-3 gap-3">
            <div>
              <dt className="text-xs text-muted-foreground">Lot budget in scope</dt>
              <dd className="text-lg font-semibold tabular-nums">
                {formatCurrency(data.totalBudget)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Claimable now</dt>
              <dd className="text-lg font-semibold tabular-nums text-success">
                {formatCurrency(data.claimableValue)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Blocked</dt>
              <dd className="text-lg font-semibold tabular-nums text-destructive">
                {formatCurrency(data.blockedValue)}
              </dd>
            </div>
          </dl>

          <p className="text-xs text-muted-foreground">
            {data.lotsBlocked} of {data.lotsInScope} lots cannot be put on a claim right now.
            Claimable and blocked values are what is still left to claim, so anything already
            claimed sits outside both.
          </p>

          {data.lotsWithNullBudget > 0 && (
            <p className="text-xs text-muted-foreground">
              Lots with no budget set: {data.lotsWithNullBudget}. They are counted above but carry
              no value.
            </p>
          )}

          {(data.groups ?? []).length > 0 && (
            <div className="space-y-1">
              {data.groups.map((group) => {
                const expanded = expandedCode === group.code;
                return (
                  <div key={group.code} className="rounded border">
                    <button
                      type="button"
                      aria-expanded={expanded}
                      onClick={() => setExpandedCode(expanded ? null : group.code)}
                      className="touch-target flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted/50"
                    >
                      {expanded ? (
                        <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
                      )}
                      <span className="flex-1">{formatStatusLabel(group.code)}</span>
                      <span className="text-muted-foreground">
                        {group.lotCount} lot{group.lotCount === 1 ? '' : 's'}
                      </span>
                      <span className="font-medium tabular-nums">
                        {formatCurrency(group.blockedValue)}
                      </span>
                    </button>
                    {expanded && <BlockedLotRows projectId={projectId} group={group} />}
                  </div>
                );
              })}
              <p className="pt-1 text-[11px] text-muted-foreground">
                A lot can be blocked by more than one thing, so these add up to more than the total.
              </p>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">{CLAIM_READINESS_INDICATOR_LABEL}</p>
        </div>
      )}
    </div>
  );
}
