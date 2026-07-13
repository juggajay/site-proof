import 'leaflet/dist/leaflet.css';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CircleMarker,
  LayersControl,
  MapContainer,
  Polygon,
  Polyline,
  Popup,
  Rectangle,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import { Camera, ExternalLink, Layers, Square } from 'lucide-react';

import { getStatusColor, LOT_STATUS_LEGEND } from '@/components/lots/linearMapViewHelpers';
import { formatStatusLabel } from '@/lib/statusLabels';
import { extractErrorMessage, isForbidden } from '@/lib/errorHandling';
import { formatDateKey } from '@/lib/localDate';
import { authFetch } from '@/lib/api';
import { toast } from '@/components/ui/toaster';
import { useIsMobile } from '@/hooks/useMediaQuery';

import { AreaDrawLayer } from './AreaDrawLayer';
import { FindByAreaPanel } from './FindByAreaPanel';
import { CoveragePanel } from './CoveragePanel';
import { useSpatialSearch } from './spatialSearchData';
import {
  ALL_WORK_TYPES,
  selectCoverageGroup,
  useProjectCoverage,
  type CoverageGap,
} from './coverageData';
import {
  backfillLotGeometries,
  useProjectControlLines,
  useProjectLotGeometries,
  type ProjectLotGeometry,
} from './lotMapData';
import {
  AU_DEFAULT_CENTER,
  AU_DEFAULT_ZOOM,
  boundsToLatLngRect,
  computeBounds,
  featureToShape,
  filterGeometriesByLotIds,
  type LatLng,
  type SearchBounds,
} from './lotMapHelpers';

const CONTROL_LINE_COLOR = '#f59e0b'; // amber — neutral against status fills
// Gap overlay: dashed red outline + light red fill (see PR note — SVG hatch
// patterns fight react-leaflet, so a semi-transparent fill is the pragmatic tell).
const GAP_COLOR = '#dc2626';
const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY as string | undefined;

interface LotMapViewProps {
  projectId: string;
  filteredLotIds: Set<string>;
  canManageSettings: boolean;
  /** For the snapshot document caption; falls back to the id when absent. */
  projectName?: string;
}

function FitBounds({ bounds }: { bounds: [LatLng, LatLng] | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 18 });
    }
  }, [map, bounds]);
  return null;
}

function LotPopup({
  geometry,
  onViewDetails,
}: {
  geometry: ProjectLotGeometry;
  onViewDetails: () => void;
}) {
  return (
    <Popup>
      <div className="min-w-[180px]" data-testid={`lot-popup-${geometry.lotId}`}>
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-3 h-3 rounded"
            style={{ backgroundColor: getStatusColor(geometry.status) }}
          />
          <span className="font-semibold">{geometry.lotNumber}</span>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {formatStatusLabel(geometry.status)}
          {geometry.activityType ? ` · ${geometry.activityType}` : ''}
        </div>
        {(geometry.areaM2 != null || geometry.lengthM != null) && (
          <div className="mt-1 text-xs text-muted-foreground">
            {geometry.areaM2 != null && (
              <span>{Math.round(geometry.areaM2).toLocaleString()} m²</span>
            )}
            {geometry.areaM2 != null && geometry.lengthM != null && <span> · </span>}
            {geometry.lengthM != null && (
              <span>{Math.round(geometry.lengthM).toLocaleString()} m</span>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={onViewDetails}
          className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          data-testid={`lot-popup-view-${geometry.lotId}`}
        >
          <ExternalLink className="h-3.5 w-3.5" /> View Details
        </button>
      </div>
    </Popup>
  );
}

// One lot geometry as the right Leaflet layer for its GeoJSON type, coloured by
// canonical lot status. Popup content mirrors LinearMapView's.
function LotGeometryLayer({
  geometry,
  onViewDetails,
}: {
  geometry: ProjectLotGeometry;
  onViewDetails: () => void;
}) {
  const shape = featureToShape(geometry.geometryWgs84);
  if (!shape) return null;

  const color = getStatusColor(geometry.status);
  const pathOptions = { color, weight: 2, fillColor: color, fillOpacity: 0.4 };
  const popup = <LotPopup geometry={geometry} onViewDetails={onViewDetails} />;

  if (shape.kind === 'polygon') {
    return (
      <Polygon positions={shape.positions} pathOptions={pathOptions}>
        {popup}
      </Polygon>
    );
  }
  if (shape.kind === 'line') {
    return (
      <Polyline positions={shape.positions} pathOptions={{ color, weight: 4 }}>
        {popup}
      </Polyline>
    );
  }
  return (
    <CircleMarker center={shape.position} radius={7} pathOptions={pathOptions}>
      {popup}
    </CircleMarker>
  );
}

function StatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 p-3 border-t bg-muted/20 text-xs">
      <span className="font-medium">Status:</span>
      {LOT_STATUS_LEGEND.map(({ key, label }) => (
        <div key={key} className="flex items-center gap-1">
          <span className="w-3 h-3 rounded" style={{ backgroundColor: getStatusColor(key) }} />
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

// Self-bootstrapping empty state: with a control line and a write role, offer to
// generate geometries from lot chainage; otherwise point at settings.
function EmptyStateCallout({
  projectId,
  hasControlLines,
  controlLineId,
  canManageSettings,
  onBackfilled,
}: {
  projectId: string;
  hasControlLines: boolean;
  controlLineId: string | null;
  canManageSettings: boolean;
  onBackfilled: () => void;
}) {
  const [offsetLeft, setOffsetLeft] = useState(6);
  const [offsetRight, setOffsetRight] = useState(6);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runBackfill = async () => {
    if (!controlLineId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await backfillLotGeometries(projectId, controlLineId, {
        offsetLeft,
        offsetRight,
      });
      const skippedNote = result.skipped.length > 0 ? `, ${result.skipped.length} skipped` : '';
      setMessage(
        `Generated ${result.created} lot geometr${result.created === 1 ? 'y' : 'ies'}${skippedNote}.`,
      );
      onBackfilled();
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not generate lot geometries. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-8 text-center" data-testid="lot-map-empty">
      <h3 className="text-lg font-semibold text-foreground">No lots on the map yet</h3>
      {hasControlLines && canManageSettings ? (
        <div className="mt-3 max-w-md mx-auto text-left">
          <p className="text-sm text-muted-foreground">
            Generate lot footprints from each lot&apos;s chainage against your control line. Adjust
            the default offsets (metres either side) if needed.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="block text-xs text-muted-foreground">Offset left (m)</span>
              <input
                type="number"
                min={0}
                value={offsetLeft}
                onChange={(e) => setOffsetLeft(Number(e.target.value))}
                className="mt-1 w-24 rounded border px-2 py-1"
                data-testid="backfill-offset-left"
              />
            </label>
            <label className="text-sm">
              <span className="block text-xs text-muted-foreground">Offset right (m)</span>
              <input
                type="number"
                min={0}
                value={offsetRight}
                onChange={(e) => setOffsetRight(Number(e.target.value))}
                className="mt-1 w-24 rounded border px-2 py-1"
                data-testid="backfill-offset-right"
              />
            </label>
            <button
              type="button"
              onClick={runBackfill}
              disabled={busy}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              data-testid="backfill-run"
            >
              {busy ? 'Generating…' : 'Generate geometries'}
            </button>
          </div>
          {message && <p className="mt-2 text-sm text-success">{message}</p>}
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </div>
      ) : hasControlLines ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Lot geometries have not been generated yet. Ask a project manager to generate them from
          the control line.
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          Add a control line in{' '}
          <a
            href={`/projects/${encodeURIComponent(projectId)}/settings`}
            className="text-primary hover:underline"
          >
            Project Settings → Control Lines
          </a>{' '}
          to place lots on the map.
        </p>
      )}
    </div>
  );
}

export function LotMapView({
  projectId,
  filteredLotIds,
  canManageSettings,
  projectName,
}: LotMapViewProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [snapshotting, setSnapshotting] = useState(false);
  const geometriesQuery = useProjectLotGeometries(projectId);
  const controlLinesQuery = useProjectControlLines(projectId);

  const search = useSpatialSearch(projectId);
  const { mutate: runSearch, reset: resetSearch } = search;
  const [drawArmed, setDrawArmed] = useState(false);
  const [searchBounds, setSearchBounds] = useState<SearchBounds | null>(null);

  const [coverageArmed, setCoverageArmed] = useState(false);
  const [coverageSelection, setCoverageSelection] = useState<Record<string, string>>({});
  const [gapFocusBounds, setGapFocusBounds] = useState<[LatLng, LatLng] | null>(null);
  const coverageQuery = useProjectCoverage(projectId, coverageArmed);

  const handleAreaComplete = useCallback(
    (bounds: SearchBounds) => {
      setSearchBounds(bounds);
      setDrawArmed(false);
      runSearch(bounds);
    },
    [runSearch],
  );

  const clearSearch = useCallback(() => {
    setSearchBounds(null);
    setDrawArmed(false);
    resetSearch();
  }, [resetSearch]);

  // Find-by-area and Coverage are mutually exclusive tools — arming one disarms
  // the other so their overlays and panels never fight for the map.
  const armFindByArea = useCallback(() => {
    if (drawArmed) {
      setDrawArmed(false);
      return;
    }
    clearSearch();
    setCoverageArmed(false);
    setGapFocusBounds(null);
    setDrawArmed(true);
  }, [drawArmed, clearSearch]);

  const toggleCoverage = useCallback(() => {
    setCoverageArmed((armed) => {
      if (armed) {
        setGapFocusBounds(null);
        return false;
      }
      clearSearch();
      return true;
    });
  }, [clearSearch]);

  // Escape cancels an armed draw.
  useEffect(() => {
    if (!drawArmed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawArmed(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawArmed]);

  const allGeometries = geometriesQuery.data?.geometries;
  const controlLines = useMemo(() => controlLinesQuery.data ?? [], [controlLinesQuery.data]);

  const filteredGeometries = useMemo(
    () => filterGeometriesByLotIds(allGeometries ?? [], filteredLotIds),
    [allGeometries, filteredLotIds],
  );

  const bounds = useMemo(
    () =>
      computeBounds([
        ...filteredGeometries.map((g) => g.geometryWgs84),
        ...controlLines.map((c) => c.geometryWgs84),
      ]),
    [filteredGeometries, controlLines],
  );

  const coverageLines = useMemo(() => coverageQuery.data?.controlLines ?? [], [coverageQuery.data]);

  // Gap polygons for each line's currently-selected work type (default "All work
  // types"), flattened for rendering as hatched overlays.
  const coverageGaps = useMemo(() => {
    if (!coverageArmed) return [];
    const out: { key: string; shape: ReturnType<typeof featureToShape> }[] = [];
    for (const line of coverageLines) {
      if (!line.groups) continue;
      const group = selectCoverageGroup(line, coverageSelection[line.id] ?? ALL_WORK_TYPES);
      if (!group) continue;
      for (const gap of group.gaps) {
        out.push({
          key: `${line.id}-${gap.start}-${gap.end}`,
          shape: featureToShape(gap.polygonWgs84),
        });
      }
    }
    return out;
  }, [coverageArmed, coverageLines, coverageSelection]);

  const handleGapClick = useCallback((gap: CoverageGap) => {
    setGapFocusBounds(computeBounds([gap.polygonWgs84]));
  }, []);

  // Capture the map to a PNG and store it as a normal project document. Landing
  // it in Documents IS the integration — from there it is already attachable to
  // conformance packs and claims through the existing evidence flows; no new
  // attachment mechanism. html-to-image is imported lazily at click time.
  const handleSnapshot = useCallback(async () => {
    const node = document.querySelector<HTMLElement>('[data-testid="lot-map-container"]');
    if (!node) return;
    setSnapshotting(true);
    try {
      const { toBlob } = await import('html-to-image');
      const blob = await toBlob(node, { cacheBust: true, pixelRatio: 2 });
      if (!blob) {
        throw new Error('Could not capture the map image');
      }
      const dateKey = formatDateKey();
      const label = projectName || projectId;
      const file = new File([blob], `map-snapshot-${dateKey}.png`, { type: 'image/png' });

      const form = new FormData();
      form.append('file', file);
      form.append('projectId', projectId);
      form.append('documentType', 'map_snapshot');
      form.append('caption', `Map snapshot — ${label} — ${dateKey}`);

      const res = await authFetch('/api/documents/upload', { method: 'POST', body: form });
      if (!res.ok) {
        throw new Error((await res.text()) || 'Upload failed');
      }
      toast({
        title: 'Snapshot saved',
        description: 'Saved to project Documents — attach it to a conformance pack or claim there.',
        variant: 'success',
      });
    } catch (err) {
      toast({
        title: 'Snapshot failed',
        description: extractErrorMessage(
          err,
          'Could not capture the map. Satellite/base tiles may block cross-origin capture.',
        ),
        variant: 'error',
      });
    } finally {
      setSnapshotting(false);
    }
  }, [projectId, projectName]);

  if (geometriesQuery.isLoading || controlLinesQuery.isLoading) {
    return (
      <div className="p-12 text-center text-sm text-muted-foreground" role="status">
        Loading map…
      </div>
    );
  }

  if (geometriesQuery.error) {
    const denied = isForbidden(geometriesQuery.error);
    return (
      <div className="p-8 text-center" role="alert">
        <p className="font-medium text-destructive">Could not load the map</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {denied
            ? 'You do not have access to this project’s lot geometries.'
            : extractErrorMessage(geometriesQuery.error, 'Please try again.')}
        </p>
        {!denied && (
          <button
            type="button"
            onClick={() => geometriesQuery.refetch()}
            className="mt-3 rounded-md border px-4 py-2 text-sm hover:bg-muted"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  const showEmptyState = filteredGeometries.length === 0;

  return (
    <div className="bg-background" data-testid="lot-map-view">
      {showEmptyState && (allGeometries?.length ?? 0) === 0 ? (
        <EmptyStateCallout
          projectId={projectId}
          hasControlLines={controlLines.length > 0}
          controlLineId={controlLines[0]?.id ?? null}
          canManageSettings={canManageSettings}
          onBackfilled={() => geometriesQuery.refetch()}
        />
      ) : (
        <>
          {showEmptyState && (
            <p
              className="p-3 text-center text-sm text-muted-foreground border-b"
              data-testid="lot-map-filtered-empty"
            >
              No lots in the current filter have geometry.
            </p>
          )}
          <div className="relative">
            <div className="absolute left-3 top-3 z-[1000] pointer-events-auto">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={armFindByArea}
                  aria-pressed={drawArmed}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium shadow-sm ${
                    drawArmed
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background hover:bg-muted'
                  }`}
                  data-testid="find-by-area-button"
                >
                  <Square className="h-3.5 w-3.5" />
                  {drawArmed ? 'Cancel' : 'Find by area'}
                </button>
                <button
                  type="button"
                  onClick={toggleCoverage}
                  aria-pressed={coverageArmed}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium shadow-sm ${
                    coverageArmed
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background hover:bg-muted'
                  }`}
                  data-testid="coverage-button"
                >
                  <Layers className="h-3.5 w-3.5" />
                  Coverage
                </button>
                <button
                  type="button"
                  onClick={handleSnapshot}
                  disabled={snapshotting}
                  className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-muted disabled:opacity-50"
                  data-testid="snapshot-button"
                >
                  <Camera className="h-3.5 w-3.5" />
                  {snapshotting ? 'Saving…' : 'Snapshot'}
                </button>
              </div>
              {drawArmed && (
                <p className="mt-1 max-w-[12rem] rounded bg-background/90 px-2 py-1 text-xs text-muted-foreground shadow">
                  Drag a box on the map. Press Esc to cancel.
                </p>
              )}
            </div>

            <MapContainer
              center={AU_DEFAULT_CENTER}
              zoom={AU_DEFAULT_ZOOM}
              scrollWheelZoom
              style={{ height: 520, width: '100%' }}
              data-testid="lot-map-container"
            >
              <LayersControl position="topright">
                {MAPTILER_KEY && (
                  <LayersControl.BaseLayer checked name="Satellite">
                    <TileLayer
                      url={`https://api.maptiler.com/maps/satellite/{z}/{x}/{y}.jpg?key=${MAPTILER_KEY}`}
                      attribution='&copy; <a href="https://www.maptiler.com/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      maxZoom={20}
                      crossOrigin="anonymous"
                    />
                  </LayersControl.BaseLayer>
                )}
                <LayersControl.BaseLayer checked={!MAPTILER_KEY} name="Street">
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    maxZoom={19}
                    crossOrigin="anonymous"
                  />
                </LayersControl.BaseLayer>
              </LayersControl>

              <FitBounds bounds={bounds} />

              {controlLines.map((line) => {
                const shape = featureToShape(line.geometryWgs84);
                if (!shape || shape.kind !== 'line') return null;
                return (
                  <Polyline
                    key={line.id}
                    positions={shape.positions}
                    pathOptions={{ color: CONTROL_LINE_COLOR, weight: 2, dashArray: '6 4' }}
                  >
                    <Tooltip sticky>{line.name}</Tooltip>
                  </Polyline>
                );
              })}

              {filteredGeometries.map((geometry) => (
                <LotGeometryLayer
                  key={geometry.id}
                  geometry={geometry}
                  onViewDetails={() =>
                    navigate(
                      `/projects/${encodeURIComponent(projectId)}/lots/${encodeURIComponent(
                        geometry.lotId,
                      )}`,
                    )
                  }
                />
              ))}

              {coverageArmed &&
                coverageGaps.map(({ key, shape }) =>
                  shape && shape.kind === 'polygon' ? (
                    <Polygon
                      key={key}
                      positions={shape.positions}
                      pathOptions={{
                        color: GAP_COLOR,
                        weight: 2,
                        dashArray: '6 4',
                        fillColor: GAP_COLOR,
                        fillOpacity: 0.2,
                      }}
                    />
                  ) : null,
                )}
              {coverageArmed && <FitBounds bounds={gapFocusBounds} />}

              <AreaDrawLayer active={drawArmed} onComplete={handleAreaComplete} />
              {searchBounds && (
                <Rectangle
                  bounds={boundsToLatLngRect(searchBounds)}
                  pathOptions={{
                    color: '#2563eb',
                    weight: 2,
                    fillColor: '#2563eb',
                    fillOpacity: 0.08,
                  }}
                />
              )}
            </MapContainer>

            {searchBounds && (
              <FindByAreaPanel
                projectId={projectId}
                result={search.data}
                isLoading={search.isLoading}
                error={search.error}
                isMobile={isMobile}
                onClear={clearSearch}
                onRetry={() => runSearch(searchBounds)}
              />
            )}

            {coverageArmed && (
              <CoveragePanel
                lines={coverageLines}
                isLoading={coverageQuery.isLoading}
                error={coverageQuery.error}
                isMobile={isMobile}
                selection={coverageSelection}
                onSelectActivity={(lineId, activityType) =>
                  setCoverageSelection((prev) => ({ ...prev, [lineId]: activityType }))
                }
                onGapClick={handleGapClick}
                onClear={() => toggleCoverage()}
                onRetry={() => coverageQuery.refetch()}
              />
            )}
          </div>
          <StatusLegend />
        </>
      )}
    </div>
  );
}

export default LotMapView;
