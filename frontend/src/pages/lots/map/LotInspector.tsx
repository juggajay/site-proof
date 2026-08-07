/**
 * Wave 2 — the lot inspector. Selection-driven panel over the map workspace:
 * a right-hand drawer on desktop, a bottom sheet on mobile. NON-modal on
 * purpose — the map stays live beside it, so clicking another lot, walking
 * next/prev along the alignment, or searching all re-target the same panel.
 *
 * Content order follows the m6 field evidence: lot number + work type, status
 * in plain words, then WHAT IS BLOCKING (hold points with age, outstanding
 * tests, open NCRs, checklist progress), then evidence/history/meta. The
 * blocking block is the point of the panel — no competitor shows it on a map.
 *
 * The full lot page stays one tap away (footer) — the inspector is the fast
 * path, not the only path. The only gated action (Review & conform) is shown
 * from the server's own check-role answer, never a client-side role guess.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ExternalLink, Navigation, Search, X } from 'lucide-react';

import { SecureDocumentImage } from '@/components/documents/SecureDocumentImage';
import { getStatusColor } from '@/components/lots/linearMapViewHelpers';
import { formatActivityLabel } from '@/lib/activityTaxonomy';
import { formatStatusLabel } from '@/lib/statusLabels';
import { useLotQualityAccessQuery } from '@/pages/lots/lotDetailData';
import { useLotSurveys } from '@/pages/lots/hooks/useLotSurveyMaterials';

import {
  completionPhotos,
  daysOpen,
  neighbouringLotIds,
  openHoldPointsForLot,
  provenanceLabel,
  searchLotGeometries,
  useLotItpInstance,
  useLotReadiness,
  useLotStatusEvents,
  useProjectHoldPoints,
} from './lotInspectorData';
import { chainageLabel, type ProjectControlLine, type ProjectLotGeometry } from './lotMapData';
import { featureCentroid, type MapLinkPaths } from './lotMapHelpers';

const TEST_STATE_LABELS: Record<string, string> = {
  no_result: 'No result',
  awaiting_verification: 'Awaiting verification',
  failing: 'Failing',
  unmatched_result_exists: 'Result not matched',
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </h3>
  );
}

function SkeletonLines({ count = 2 }: { count?: number }) {
  return (
    <div className="space-y-2" role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="h-3 animate-pulse rounded bg-muted" />
      ))}
    </div>
  );
}

export interface LotInspectorProps {
  projectId: string;
  geometry: ProjectLotGeometry;
  /** The display set — powers next/prev along the alignment and search. */
  geometries: ProjectLotGeometry[];
  controlLines: ProjectControlLine[];
  linkPaths: MapLinkPaths;
  isMobile: boolean;
  /**
   * Past view (history scrubber) armed: the live QA blocks are withdrawn — the
   * readiness verdict is computed NOW and painting it beside a historical
   * status would put two dates in one panel (same rule as the map overlays).
   */
  pastView: boolean;
  onClose: () => void;
  onSelectLot: (lotId: string) => void;
}

export function LotInspector({
  projectId,
  geometry,
  geometries,
  controlLines,
  linkPaths,
  isMobile,
  pastView,
  onClose,
  onSelectLot,
}: LotInspectorProps) {
  const navigate = useNavigate();
  const lotId = geometry.lotId;

  const readinessQuery = useLotReadiness(lotId);
  const eventsQuery = useLotStatusEvents(lotId);
  const holdPointsQuery = useProjectHoldPoints(projectId);
  const itpQuery = useLotItpInstance(pastView ? undefined : lotId);
  const { data: qualityAccess } = useLotQualityAccessQuery(projectId);

  const [searchText, setSearchText] = useState('');
  // Re-targeting the panel to another lot is a completed search.
  useEffect(() => setSearchText(''), [lotId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const { prevId, nextId } = useMemo(
    () => neighbouringLotIds(geometries, lotId),
    [geometries, lotId],
  );
  const searchResults = useMemo(
    () => searchLotGeometries(geometries, searchText).filter((g) => g.lotId !== lotId),
    [geometries, searchText, lotId],
  );

  const conformStatus = readinessQuery.data?.readiness.conformStatus ?? null;
  const prerequisites = conformStatus?.prerequisites ?? null;
  const openHoldPoints = openHoldPointsForLot(holdPointsQuery.data, lotId);
  const photos = completionPhotos(itpQuery.data?.instance);
  const events = eventsQuery.data?.events ?? [];

  const controlLineName = geometry.controlLineId
    ? (controlLines.find((line) => line.id === geometry.controlLineId)?.name ?? null)
    : null;
  const chainage = chainageLabel(geometry.chainageStart, geometry.chainageEnd);
  const destination = featureCentroid(geometry.geometryWgs84);
  const activityLabel = geometry.activityType ? formatActivityLabel(geometry.activityType) : null;

  const testSummary = useMemo(() => {
    const results = prerequisites?.testResults ?? [];
    if (results.length === 0) return null;
    const passing = results.filter((r) => r.passFail === 'pass').length;
    return { total: results.length, passing };
  }, [prerequisites]);

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

  const openLotPage = () => navigate(linkPaths.lot(lotId));

  const formatEventDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: '2-digit' });

  return (
    <aside
      data-testid="lot-inspector"
      aria-label={`Lot ${geometry.lotNumber}`}
      className={
        isMobile
          ? 'absolute inset-x-0 bottom-0 z-[1002] flex max-h-[60dvh] flex-col rounded-t-xl border-t bg-background shadow-[0_-4px_16px_rgba(0,0,0,0.18)]'
          : 'absolute inset-y-0 right-0 z-[1002] flex w-[360px] max-w-[85%] flex-col border-l bg-background shadow-xl'
      }
    >
      {/* ── Header: identity, status in plain words, panel navigation ── */}
      <div className="border-b px-4 pb-3 pt-3">
        {isMobile && (
          <div aria-hidden className="mx-auto mb-2 h-1 w-10 rounded-full bg-muted-foreground/30" />
        )}
        <div className="flex items-start gap-1">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block h-3 w-3 shrink-0 rounded"
                style={{ backgroundColor: getStatusColor(geometry.status) }}
              />
              <h2
                className="truncate text-base font-semibold text-foreground"
                data-testid={`lot-inspector-title-${lotId}`}
              >
                {geometry.lotNumber}
              </h2>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {[formatStatusLabel(geometry.status), activityLabel, chainage]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => prevId && onSelectLot(prevId)}
            disabled={!prevId}
            title="Previous lot along alignment"
            aria-label="Previous lot"
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
            data-testid="lot-inspector-prev"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => nextId && onSelectLot(nextId)}
            disabled={!nextId}
            title="Next lot along alignment"
            aria-label="Next lot"
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
            data-testid="lot-inspector-next"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close inspector"
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            data-testid="lot-inspector-close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Jump to another lot without leaving the panel. */}
        <div className="mt-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Find lot, chainage, activity…"
              className="h-8 w-full rounded-md border bg-background pl-7 pr-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              data-testid="lot-inspector-search"
            />
          </div>
          {searchText.trim() !== '' && (
            <ul
              className="mt-1 overflow-hidden rounded-md border"
              data-testid="lot-inspector-search-results"
            >
              {searchResults.length === 0 && (
                <li className="px-2 py-1.5 text-xs text-muted-foreground">No matching lots</li>
              )}
              {searchResults.map((g) => (
                <li key={g.lotId}>
                  <button
                    type="button"
                    onClick={() => onSelectLot(g.lotId)}
                    className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-muted"
                    data-testid={`lot-inspector-result-${g.lotId}`}
                  >
                    <span
                      aria-hidden
                      className="inline-block h-2 w-2 shrink-0 rounded-sm"
                      style={{ backgroundColor: getStatusColor(g.status) }}
                    />
                    <span className="truncate font-medium">{g.lotNumber}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {chainageLabel(g.chainageStart, g.chainageEnd) ?? formatStatusLabel(g.status)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── Scrolling body ── */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {/* The blocking block — the highest-value thing on the panel. */}
        {pastView ? (
          <p className="text-xs text-muted-foreground" data-testid="lot-inspector-past-note">
            Past view — live QA state hidden. Exit Past view to see what is blocking this lot today.
          </p>
        ) : (
          <section className="rounded-lg border p-3" data-testid="lot-inspector-blocking">
            {readinessQuery.isLoading ? (
              <SkeletonLines count={3} />
            ) : readinessQuery.error ? (
              <div className="text-sm">
                <p className="text-muted-foreground">Couldn’t load QA state.</p>
                <button
                  type="button"
                  onClick={() => readinessQuery.refetch()}
                  className="mt-1 text-sm font-medium text-primary hover:underline"
                >
                  Try again
                </button>
              </div>
            ) : conformStatus?.canConform ? (
              <div data-testid="lot-inspector-ready">
                <p className="text-sm font-medium text-success">Ready to conform</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  All prerequisites are satisfied.
                </p>
                {qualityAccess?.canConformLots && (
                  <button
                    type="button"
                    onClick={openLotPage}
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
                  {holdPointsQuery.isLoading && <SkeletonLines count={1} />}
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
                                    (prerequisites.itpCompletedCount /
                                      prerequisites.itpTotalCount) *
                                      100,
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
        )}

        {/* Evidence — completion photos + test tally. Live-only, like blocking. */}
        {!pastView && (photos.length > 0 || testSummary) && (
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
        )}

        {/* Status history — the #1800 ledger, complete including NCR flips. */}
        <section className="rounded-lg border p-3" data-testid="lot-inspector-history">
          <SectionTitle>Status history</SectionTitle>
          {eventsQuery.isLoading ? (
            <div className="mt-2">
              <SkeletonLines count={2} />
            </div>
          ) : eventsQuery.error ? (
            <div className="mt-2 text-sm">
              <p className="text-muted-foreground">Couldn’t load history.</p>
              <button
                type="button"
                onClick={() => eventsQuery.refetch()}
                className="mt-1 text-sm font-medium text-primary hover:underline"
              >
                Try again
              </button>
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

        {/* Where the footprint came from + physical extent. */}
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
            <SurveyedBadge lotId={lotId} />
          </div>
          {(chainage || geometry.areaM2 != null || geometry.lengthM != null) && (
            <p className="mt-2 text-xs text-muted-foreground">
              {[
                chainage,
                geometry.areaM2 != null
                  ? `${Math.round(geometry.areaM2).toLocaleString()} m²`
                  : null,
                geometry.lengthM != null
                  ? `${Math.round(geometry.lengthM).toLocaleString()} m`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </section>
      </div>

      {/* ── Footer: the fast path out ── */}
      <div className="flex gap-2 border-t px-4 py-3">
        <button
          type="button"
          onClick={openLotPage}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          data-testid="lot-inspector-open-lot"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Open lot page
        </button>
        {destination && (
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${destination[0]},${destination[1]}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
            data-testid="lot-inspector-directions"
          >
            <Navigation className="h-3.5 w-3.5" /> Directions
          </a>
        )}
      </div>
    </aside>
  );
}

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
