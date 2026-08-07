/**
 * The lot inspector's content cards (Wave 2), split from LotInspector.tsx so
 * each card owns its own load/error/empty states. Order and content follow the
 * m6 evidence: the BLOCKING card is the panel's reason to exist; evidence,
 * ledger history, and provenance follow.
 */

import { SecureDocumentImage } from '@/components/documents/SecureDocumentImage';
import { formatStatusLabel } from '@/lib/statusLabels';
import type { HoldPoint } from '@/pages/holdpoints/types';
import { useLotSurveys } from '@/pages/lots/hooks/useLotSurveyMaterials';
import type { ConformStatus, ITPAttachmentDocument } from '@/pages/lots/types';

import { daysOpen, provenanceLabel, type LotStatusEventRow } from './lotInspectorData';
import { chainageLabel, type ProjectLotGeometry } from './lotMapData';

const TEST_STATE_LABELS: Record<string, string> = {
  no_result: 'No result',
  awaiting_verification: 'Awaiting verification',
  failing: 'Failing',
  unmatched_result_exists: 'Result not matched',
};

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </h3>
  );
}

export function SkeletonLines({ count = 2 }: { count?: number }) {
  return (
    <div className="space-y-2" role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="h-3 animate-pulse rounded bg-muted" />
      ))}
    </div>
  );
}

function RetryNote({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="text-sm">
      <p className="text-muted-foreground">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-1 text-sm font-medium text-primary hover:underline"
      >
        Try again
      </button>
    </div>
  );
}

interface QueryLike {
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
}

// ── Blocking conformance ────────────────────────────────────────────────────

export function BlockingCard({
  readinessQuery,
  conformStatus,
  openHoldPoints,
  holdPointsLoading,
  showConformCta,
  onOpenLotPage,
}: {
  readinessQuery: QueryLike;
  conformStatus: ConformStatus | null;
  openHoldPoints: HoldPoint[];
  holdPointsLoading: boolean;
  /** Server-derived (check-role) — never a client-side role guess. */
  showConformCta: boolean;
  onOpenLotPage: () => void;
}) {
  const prerequisites = conformStatus?.prerequisites ?? null;
  const outstandingTests = prerequisites?.outstandingTestItems ?? [];
  const openNcrs = prerequisites?.openNcrs ?? [];
  const checklistIncomplete =
    prerequisites != null && prerequisites.itpAssigned && !prerequisites.itpCompleted;
  const hasStructuredBlockers =
    openHoldPoints.length > 0 ||
    outstandingTests.length > 0 ||
    openNcrs.length > 0 ||
    checklistIncomplete ||
    prerequisites?.itpAssigned === false;

  return (
    <section className="rounded-lg border p-3" data-testid="lot-inspector-blocking">
      {readinessQuery.isLoading ? (
        <SkeletonLines count={3} />
      ) : readinessQuery.error ? (
        <RetryNote message="Couldn’t load QA state." onRetry={readinessQuery.refetch} />
      ) : conformStatus?.canConform ? (
        <div data-testid="lot-inspector-ready">
          <p className="text-sm font-medium text-success">Ready to conform</p>
          <p className="mt-0.5 text-xs text-muted-foreground">All prerequisites are satisfied.</p>
          {showConformCta && (
            <button
              type="button"
              onClick={onOpenLotPage}
              className="mt-2 w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              data-testid="lot-inspector-conform-cta"
            >
              Review &amp; conform
            </button>
          )}
        </div>
      ) : (
        <div>
          <SectionTitle>Blocking conformance</SectionTitle>
          <ul className="mt-2 space-y-2">
            {holdPointsLoading && <SkeletonLines count={1} />}
            {openHoldPoints.map((hp) => (
              <li
                key={hp.id}
                className="flex items-baseline gap-2 text-sm"
                data-testid={`lot-inspector-hp-${hp.id}`}
              >
                <span className="min-w-0 flex-1 truncate" title={hp.description}>
                  <span className="font-medium">Hold point</span> — {hp.description}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {daysOpen(hp.createdAt)}d
                </span>
              </li>
            ))}
            {outstandingTests.map((item) => (
              <li
                key={item.itemId}
                className="flex items-baseline gap-2 text-sm"
                data-testid={`lot-inspector-test-${item.itemId}`}
              >
                <span className="min-w-0 flex-1 truncate" title={item.description}>
                  <span className="font-medium">Test</span> — {item.description}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {TEST_STATE_LABELS[item.state] ?? formatStatusLabel(item.state)}
                </span>
              </li>
            ))}
            {openNcrs.map((ncr) => (
              <li
                key={ncr.id}
                className="flex items-baseline gap-2 text-sm"
                data-testid={`lot-inspector-ncr-${ncr.id}`}
              >
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{ncr.ncrNumber}</span>
                  {ncr.description ? ` — ${ncr.description}` : ''}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatStatusLabel(ncr.status)}
                </span>
              </li>
            ))}
            {prerequisites?.itpAssigned === false && (
              <li className="text-sm" data-testid="lot-inspector-no-itp">
                <span className="font-medium">No ITP assigned</span>
              </li>
            )}
            {checklistIncomplete && prerequisites && (
              <li className="text-sm" data-testid="lot-inspector-checklist">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">Checklist</span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {prerequisites.itpCompletedCount} of {prerequisites.itpTotalCount}
                  </span>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded bg-muted">
                  <div
                    className="h-full rounded bg-primary"
                    style={{
                      width: `${
                        prerequisites.itpTotalCount > 0
                          ? Math.round(
                              (prerequisites.itpCompletedCount / prerequisites.itpTotalCount) * 100,
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </li>
            )}
            {/* Backend-worded fallback so an unmodelled blocker is never silent. */}
            {!hasStructuredBlockers &&
              (conformStatus?.blockingReasons ?? []).map((reason) => (
                <li key={reason} className="text-sm">
                  {reason}
                </li>
              ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// ── Evidence: completion photos + test tally ────────────────────────────────

export function EvidenceCard({
  photos,
  prerequisites,
}: {
  photos: ITPAttachmentDocument[];
  prerequisites: ConformStatus['prerequisites'] | null;
}) {
  const results = prerequisites?.testResults ?? [];
  const testSummary =
    results.length > 0
      ? { total: results.length, passing: results.filter((r) => r.passFail === 'pass').length }
      : null;
  if (photos.length === 0 && !testSummary) return null;

  return (
    <section className="rounded-lg border p-3" data-testid="lot-inspector-evidence">
      <SectionTitle>Evidence</SectionTitle>
      {photos.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {photos.map((photo) => (
            <SecureDocumentImage
              key={photo.id}
              documentId={photo.id}
              variant="thumb"
              alt={photo.caption ?? photo.filename}
              className="h-12 w-12 rounded object-cover"
            />
          ))}
        </div>
      )}
      {testSummary && (
        <p className="mt-2 text-sm" data-testid="lot-inspector-tests-summary">
          Tests — {testSummary.passing} of {testSummary.total} passing
        </p>
      )}
    </section>
  );
}

// ── Status history: the #1800 ledger, complete including NCR flips ──────────

function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  });
}

export function HistoryCard({
  eventsQuery,
  events,
}: {
  eventsQuery: QueryLike;
  events: LotStatusEventRow[];
}) {
  return (
    <section className="rounded-lg border p-3" data-testid="lot-inspector-history">
      <SectionTitle>Status history</SectionTitle>
      {eventsQuery.isLoading ? (
        <div className="mt-2">
          <SkeletonLines count={2} />
        </div>
      ) : eventsQuery.error ? (
        <div className="mt-2">
          <RetryNote message="Couldn’t load history." onRetry={eventsQuery.refetch} />
        </div>
      ) : events.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No recorded changes yet.</p>
      ) : (
        <ol className="mt-2 space-y-1.5">
          {[...events].reverse().map((event, i) => (
            <li
              key={`${event.effectiveAt}-${i}`}
              className="flex items-baseline gap-2 text-sm"
              data-testid={`lot-inspector-event-${i}`}
            >
              <span className="w-16 shrink-0 text-xs tabular-nums text-muted-foreground">
                {formatEventDate(event.effectiveAt)}
              </span>
              <span className="min-w-0 flex-1">
                {event.fromStatus
                  ? `${formatStatusLabel(event.fromStatus)} → ${formatStatusLabel(event.toStatus)}`
                  : `Created — ${formatStatusLabel(event.toStatus)}`}
                {event.source === 'backfill' && (
                  <span
                    className="ml-1 text-xs text-muted-foreground"
                    title="Reconstructed from historical records"
                  >
                    (reconstructed)
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

// ── Details: geometry provenance + physical extent ──────────────────────────

/**
 * "Surveyed" only when a live (non-superseded) survey record exists. Its own
 * component so the 404-tolerant survey read (feature-flagged tenants) never
 * blocks the rest of the panel.
 */
function SurveyedBadge({ lotId }: { lotId: string }) {
  const surveysQuery = useLotSurveys(lotId);
  const liveRecords = (surveysQuery.data?.surveys ?? []).filter((s) => s.supersededById === null);
  if (liveRecords.length === 0) return null;
  return (
    <span
      className="rounded border px-1.5 py-0.5 text-xs text-muted-foreground"
      data-testid="lot-inspector-surveyed"
    >
      Surveyed
    </span>
  );
}

export function DetailsCard({
  geometry,
  controlLineName,
}: {
  geometry: ProjectLotGeometry;
  controlLineName: string | null;
}) {
  const chainage = chainageLabel(geometry.chainageStart, geometry.chainageEnd);
  return (
    <section className="rounded-lg border p-3" data-testid="lot-inspector-details">
      <SectionTitle>Details</SectionTitle>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span
          className="rounded border px-1.5 py-0.5 text-xs text-muted-foreground"
          data-testid="lot-inspector-provenance"
        >
          {provenanceLabel(geometry.kind)}
          {controlLineName ? ` · ${controlLineName}` : ''}
        </span>
        <SurveyedBadge lotId={geometry.lotId} />
      </div>
      {(chainage || geometry.areaM2 != null || geometry.lengthM != null) && (
        <p className="mt-2 text-xs text-muted-foreground">
          {[
            chainage,
            geometry.areaM2 != null ? `${Math.round(geometry.areaM2).toLocaleString()} m²` : null,
            geometry.lengthM != null ? `${Math.round(geometry.lengthM).toLocaleString()} m` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}
    </section>
  );
}
