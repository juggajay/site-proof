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
 * Cards live in LotInspectorCards.tsx.
 *
 * The full lot page stays one tap away (footer) — the inspector is the fast
 * path, not the only path. The only gated action (Review & conform) is shown
 * from the server's own check-role answer, never a client-side role guess.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ExternalLink, Navigation, Search, X } from 'lucide-react';

import { getStatusColor } from '@/components/lots/linearMapViewHelpers';
import { formatActivityLabel } from '@/lib/activityTaxonomy';
import { formatStatusLabel } from '@/lib/statusLabels';
import { useLotQualityAccessQuery } from '@/pages/lots/lotDetailData';

import { BlockingCard, DetailsCard, EvidenceCard, HistoryCard } from './LotInspectorCards';
import {
  completionPhotos,
  neighbouringLotIds,
  openHoldPointsForLot,
  searchLotGeometries,
  useLotItpInstance,
  useLotReadiness,
  useLotStatusEvents,
  useProjectHoldPoints,
} from './lotInspectorData';
import { chainageLabel, type ProjectControlLine, type ProjectLotGeometry } from './lotMapData';
import { featureCentroid, type MapLinkPaths } from './lotMapHelpers';

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
  const controlLineName = geometry.controlLineId
    ? (controlLines.find((line) => line.id === geometry.controlLineId)?.name ?? null)
    : null;
  const chainage = chainageLabel(geometry.chainageStart, geometry.chainageEnd);
  const destination = featureCentroid(geometry.geometryWgs84);
  const activityLabel = geometry.activityType ? formatActivityLabel(geometry.activityType) : null;

  const openLotPage = () => navigate(linkPaths.lot(lotId));

  return (
    <aside
      data-testid="lot-inspector"
      aria-label={`Lot ${geometry.lotNumber}`}
      className={
        isMobile
          ? // 75% of the MAP AREA, not the viewport — the sheet is positioned
            // inside the stacking root, and a viewport-relative cap can exceed
            // the whole map strip on a phone, hiding the map it inspects.
            'absolute inset-x-0 bottom-0 z-[1002] flex max-h-[75%] flex-col rounded-t-xl border-t bg-background shadow-[0_-4px_16px_rgba(0,0,0,0.18)]'
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
        {pastView ? (
          <p className="text-xs text-muted-foreground" data-testid="lot-inspector-past-note">
            Past view — live QA state hidden. Exit Past view to see what is blocking this lot today.
          </p>
        ) : (
          <>
            <BlockingCard
              readinessQuery={readinessQuery}
              conformStatus={conformStatus}
              openHoldPoints={openHoldPointsForLot(holdPointsQuery.data, lotId)}
              holdPointsLoading={holdPointsQuery.isLoading}
              showConformCta={Boolean(qualityAccess?.canConformLots)}
              onOpenLotPage={openLotPage}
            />
            <EvidenceCard
              photos={completionPhotos(itpQuery.data?.instance)}
              prerequisites={conformStatus?.prerequisites ?? null}
            />
          </>
        )}

        <HistoryCard eventsQuery={eventsQuery} events={eventsQuery.data?.events ?? []} />
        <DetailsCard geometry={geometry} controlLineName={controlLineName} />
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
