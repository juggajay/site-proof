import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { extractErrorMessage, isForbidden } from '@/lib/errorHandling';
import { formatStatusLabel } from '@/lib/statusLabels';
import { logError } from '@/lib/logger';
import { formatCents, formatCurrency } from './utils';
import { ClaimsAccessDeniedState } from './ClaimsPageSections';
import { ClaimBandsTable } from './components/ClaimBandsTable';
import type { ClaimDetail } from './types';

/**
 * The lines behind one progress claim: `/projects/:projectId/claims/:claimId`.
 *
 * Everything on this page is either stored or derived server-side on Decimal
 * arithmetic; nothing is computed in the browser. Two rules shape the layout:
 *
 * - Certification is recorded at CLAIM level (`ProgressClaim.certifiedAmount`),
 *   so it appears once, in the header, labelled as claim-level. There are no
 *   per-line certified figures because no per-line certification exists — a
 *   defaulted one would record an assessment nobody made.
 * - The lot lines are a SUBTOTAL, not a reconciliation of the claim total: a
 *   claim can also carry approved variations. The two are shown as separate,
 *   individually true figures rather than forced to add up.
 */

interface ClaimDetailResponse {
  claim: ClaimDetail;
}

function formatPeriod(start: string, end: string): string {
  const format = (value: string) => new Date(value).toLocaleDateString('en-AU');
  return `${format(start)} – ${format(end)}`;
}

/** A claim-level money figure. Null renders as an em-dash with the reason, so a
 * claim nobody has certified never displays $0 certified. */
function ClaimLevelFigure({
  label,
  cents,
  emptyReason,
}: {
  label: string;
  cents: number | null;
  emptyReason: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      {cents === null ? (
        <div className="mt-1 text-xl font-semibold text-muted-foreground" title={emptyReason}>
          —
        </div>
      ) : (
        <div className="mt-1 text-xl font-semibold tabular-nums">{formatCents(cents)}</div>
      )}
      {cents === null && <div className="mt-1 text-xs text-muted-foreground">{emptyReason}</div>}
    </div>
  );
}

export function ClaimDetailPage() {
  const { projectId, claimId } = useParams();

  const claimQuery = useQuery({
    queryKey: queryKeys.claimDetail(projectId ?? '', claimId ?? ''),
    enabled: Boolean(projectId && claimId),
    queryFn: () =>
      apiFetch<ClaimDetailResponse>(
        `/api/projects/${encodeURIComponent(projectId ?? '')}/claims/${encodeURIComponent(claimId ?? '')}`,
      ),
    onError: (error) => logError('Error fetching claim detail:', error),
  });

  if (claimQuery.isError && isForbidden(claimQuery.error)) {
    return (
      <ClaimsAccessDeniedState message="You do not have access to progress claims for this project." />
    );
  }

  const backLink = (
    <Link
      to={`/projects/${projectId}/claims`}
      className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" /> Back to progress claims
    </Link>
  );

  if (claimQuery.isLoading) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        {backLink}
        <p className="text-muted-foreground">Loading claim…</p>
      </div>
    );
  }

  if (claimQuery.isError || !claimQuery.data) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        {backLink}
        <div
          className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-medium">
              {extractErrorMessage(claimQuery.error, 'Could not load this claim.')}
            </p>
            <button
              type="button"
              onClick={() => void claimQuery.refetch()}
              className="rounded-md border border-destructive/40 bg-background px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const claim = claimQuery.data.claim;
  const { bands } = claim;
  const variations = claim.variations ?? [];

  return (
    <div className="space-y-6 p-4 md:p-6">
      {backLink}

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold md:text-3xl">Claim {claim.claimNumber}</h1>
          <p className="mt-1 text-muted-foreground">
            {formatPeriod(claim.claimPeriodStart, claim.claimPeriodEnd)} ·{' '}
            {formatStatusLabel(claim.status)}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <ClaimLevelFigure
          label="Claimed (recorded on this claim)"
          cents={bands.claimLevel.totalClaimedCents}
          emptyReason="No claimed total recorded."
        />
        <ClaimLevelFigure
          label="Certified — claim level"
          cents={bands.claimLevel.certifiedCents}
          emptyReason="Not yet certified. Certification is recorded against the whole claim, not per lot."
        />
        <ClaimLevelFigure
          label="Paid — claim level"
          cents={bands.claimLevel.paidCents}
          emptyReason="No payment recorded against this claim."
        />
      </div>

      <p className="text-sm text-muted-foreground">
        Certified and paid figures are recorded against the whole claim. This product does not hold
        a certified amount per lot, so none is shown or inferred against the lines below.
      </p>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Lot lines</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {bands.priorClaimCount === 0
              ? 'No earlier claims include these lots, so "Previously claimed" is nil.'
              : `"Previously claimed" is derived from ${bands.priorClaimCount} earlier ${
                  bands.priorClaimCount === 1 ? 'claim' : 'claims'
                } on these lots (${bands.historyStatuses.join(', ')}; drafts excluded).`}{' '}
            These bands are derived live — they recompute if the claim history changes.
          </p>
        </div>
        <ClaimBandsTable bands={bands} />
      </section>

      {variations.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Variations on this claim</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Approved variations carry their own value and are not broken down by lot, so they are
              not part of the lot-line subtotal above.
            </p>
          </div>
          <ul className="divide-y rounded-lg border">
            {variations.map((variation) => (
              <li key={variation.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="font-medium">{variation.variationNumber}</div>
                  <div className="truncate text-sm text-muted-foreground">{variation.title}</div>
                  {variation.clientReference && (
                    <div className="text-xs text-muted-foreground">
                      Client ref {variation.clientReference}
                    </div>
                  )}
                </div>
                <span className="font-medium tabular-nums">
                  {formatCurrency(variation.approvedAmount)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
