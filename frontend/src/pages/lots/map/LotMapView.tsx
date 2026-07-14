import 'leaflet/dist/leaflet.css';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  Circle,
  CircleMarker,
  LayersControl,
  MapContainer,
  Polygon,
  Polyline,
  Popup,
  Rectangle,
  ScaleControl,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
  Crosshair,
  ExternalLink,
  History,
  Layers,
  Map as MapIcon,
  PencilRuler,
  Square,
  type LucideIcon,
} from 'lucide-react';

import { getStatusColor, LOT_STATUS_LEGEND } from '@/components/lots/linearMapViewHelpers';
import { formatStatusLabel } from '@/lib/statusLabels';
import { extractErrorMessage, isForbidden } from '@/lib/errorHandling';
import { formatDateKey } from '@/lib/localDate';
import { authFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { readLocalStorageItem, writeLocalStorageItem } from '@/lib/storagePreferences';
import { usePlanSheets } from '@/pages/projects/settings/planSheetsData';

import { AreaDrawLayer } from './AreaDrawLayer';
import { FindByAreaPanel } from './FindByAreaPanel';
import { CoveragePanel } from './CoveragePanel';
import { PlansPanel } from './PlansPanel';
import { PlanSheetOverlay } from './PlanSheetOverlay';
import { DrawLotLayer } from './DrawLotLayer';
import { AssignDrawnLotDialog } from './AssignDrawnLotDialog';
import { HistoryPanel } from './HistoryPanel';
import { useSpatialSearch } from './spatialSearchData';
import { historicalStatusByLot, useLotStatusTimeline } from './statusTimelineData';
import {
  ALL_WORK_TYPES,
  selectCoverageGroup,
  useProjectCoverage,
  type CoverageGap,
} from './coverageData';
import {
  backfillLotGeometries,
  createDrawnLotGeometry,
  useProjectControlLines,
  useProjectLotGeometries,
  type GeoJsonFeature,
  type ProjectLotGeometry,
} from './lotMapData';
import {
  AU_DEFAULT_CENTER,
  buildMapLinkPaths,
  type MapLinkTargets,
  AU_DEFAULT_ZOOM,
  boundsToLatLngRect,
  computeBounds,
  cornersToLatLngBounds,
  featureToShape,
  filterGeometriesByLotIds,
  polygonAreaM2,
  type LatLng,
  type SearchBounds,
} from './lotMapHelpers';

const CONTROL_LINE_COLOR = '#f59e0b'; // amber — neutral against status fills
// Constant dark casing for lot boundaries so the status colour lives in the fill
// only and the outline stays crisp on satellite imagery (see UX audit Q4).
const POLYGON_STROKE_COLOR = '#1f2937';
// Gap overlay: dashed red outline + light red fill (see PR note — SVG hatch
// patterns fight react-leaflet, so a semi-transparent fill is the pragmatic tell).
const GAP_COLOR = '#dc2626';
const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY as string | undefined;

// Online/offline as an external store so the banner re-renders on the
// browser's connectivity events without any polling.
function subscribeToOnlineStatus(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

export interface MapLot {
  id: string;
  lotNumber: string;
}

interface LotMapViewProps {
  projectId: string;
  filteredLotIds: Set<string>;
  canManageSettings: boolean;
  /** For the snapshot document caption; falls back to the id when absent. */
  projectName?: string;
  /** Project lots, for assigning a drawn polygon. Optional so tests stay lean. */
  lots?: MapLot[];
  /**
   * Where map entities link. The foreman shell passes a /m/* lot-path builder so
   * navigation never escapes the shell; classic surfaces omit it and get the
   * desktop routes (see buildMapLinkPaths).
   */
  linkTargets?: MapLinkTargets;
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

// Lifts the map's current bounds up so the Plans panel can tell which shown
// sheets sit off-screen (and offer "Zoom to sheet"). Also relays base-layer
// changes so the tile-error toast can re-arm for the newly selected layer.
function MapBoundsWatcher({
  onBounds,
  onBaseLayerChange,
}: {
  onBounds: (bounds: L.LatLngBounds) => void;
  onBaseLayerChange: () => void;
}) {
  const map = useMapEvents({
    moveend: () => onBounds(map.getBounds()),
    zoomend: () => onBounds(map.getBounds()),
    baselayerchange: () => onBaseLayerChange(),
  });
  useEffect(() => {
    onBounds(map.getBounds());
  }, [map, onBounds]);
  return null;
}

// A fixed north indicator pinned inside the captured map container so it also
// appears in snapshot PNGs (the base imagery is north-up, so a static glyph is
// honest). Plain DOM overlay — no Leaflet control — to stay light and testable.
function NorthArrow() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute right-3 top-16 z-[900] flex flex-col items-center rounded-md border bg-background/90 px-1.5 py-1 text-foreground shadow-sm"
      data-testid="map-north-arrow"
    >
      <svg width="14" height="16" viewBox="0 0 14 16" fill="none" aria-hidden>
        <path d="M7 1 L12 14 L7 11 L2 14 Z" fill="currentColor" />
      </svg>
      <span className="text-[10px] font-semibold leading-none">N</span>
    </div>
  );
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
  const popup = <LotPopup geometry={geometry} onViewDetails={onViewDetails} />;

  if (shape.kind === 'polygon') {
    // Decouple stroke from fill: a constant dark casing keeps every lot boundary
    // legible over satellite imagery, where the light Okabe-Ito fills (grey /
    // yellow / sky) otherwise wash out. Fill still carries the status colour.
    return (
      <Polygon
        positions={shape.positions}
        pathOptions={{
          color: POLYGON_STROKE_COLOR,
          weight: 2,
          opacity: 0.9,
          fillColor: color,
          fillOpacity: 0.45,
        }}
      >
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
    <CircleMarker
      center={shape.position}
      radius={7}
      pathOptions={{
        color: POLYGON_STROKE_COLOR,
        weight: 2,
        opacity: 0.9,
        fillColor: color,
        fillOpacity: 0.45,
      }}
    >
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
  settingsHref,
  onBackfilled,
}: {
  projectId: string;
  hasControlLines: boolean;
  controlLineId: string | null;
  canManageSettings: boolean;
  /** null (foreman shell): mention settings as plain text, never link out. */
  settingsHref: string | null;
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
          {settingsHref ? (
            <a href={settingsHref} className="text-primary hover:underline">
              Project Settings → Control Lines
            </a>
          ) : (
            <span className="font-medium">Project Settings → Control Lines</span>
          )}{' '}
          to place lots on the map.
        </p>
      )}
    </div>
  );
}

// Map toolbar control. On mobile it collapses to an icon-only button with a
// ≥44px hit area (label carried by aria-label + title); on desktop it shows the
// icon alongside text. `label` is the stable accessible name; `text` is the
// dynamic desktop caption (e.g. "Cancel" while armed).
function ToolbarButton({
  icon: Icon,
  label,
  text,
  onClick,
  pressed,
  disabled,
  compact,
  testId,
}: {
  icon: LucideIcon;
  label: string;
  text?: string;
  onClick: () => void;
  pressed?: boolean;
  disabled?: boolean;
  compact: boolean;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-md border text-sm font-medium shadow-sm disabled:opacity-50',
        compact ? 'h-11 w-11' : 'px-3 py-1.5',
        pressed ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
      )}
      data-testid={testId}
    >
      <Icon className="h-3.5 w-3.5" />
      {!compact && <span>{text ?? label}</span>}
    </button>
  );
}

export function LotMapView({
  projectId,
  filteredLotIds,
  canManageSettings,
  projectName,
  lots = [],
  linkTargets,
}: LotMapViewProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const linkPaths = useMemo(
    () => buildMapLinkPaths(projectId, linkTargets),
    [projectId, linkTargets],
  );
  const queryClient = useQueryClient();
  const [snapshotting, setSnapshotting] = useState(false);
  const geometriesQuery = useProjectLotGeometries(projectId);
  const controlLinesQuery = useProjectControlLines(projectId);
  const planSheetsQuery = usePlanSheets(projectId);

  const search = useSpatialSearch(projectId);
  const { mutate: runSearch, reset: resetSearch } = search;
  const [drawArmed, setDrawArmed] = useState(false);
  const [searchBounds, setSearchBounds] = useState<SearchBounds | null>(null);

  const [coverageArmed, setCoverageArmed] = useState(false);
  const [coverageSelection, setCoverageSelection] = useState<Record<string, string>>({});
  const [gapFocusBounds, setGapFocusBounds] = useState<[LatLng, LatLng] | null>(null);
  const coverageQuery = useProjectCoverage(projectId, coverageArmed);

  // Plan overlays.
  const [plansOpen, setPlansOpen] = useState(false);
  const [planShown, setPlanShown] = useState<Record<string, boolean>>({});
  const [planOpacity, setPlanOpacity] = useState(0.85);
  // Blend keys the sheet's paper white to transparent so only the linework
  // overlays the imagery. Default on; persisted per project.
  const blendStorageKey = `siteproof.planBlend.${projectId}`;
  const [planBlend, setPlanBlend] = useState<boolean>(
    () => readLocalStorageItem(blendStorageKey) !== 'false',
  );
  useEffect(() => {
    writeLocalStorageItem(blendStorageKey, String(planBlend));
  }, [blendStorageKey, planBlend]);
  const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(null);
  const [zoomTarget, setZoomTarget] = useState<[LatLng, LatLng] | null>(null);

  // History time scrubber. Timeline is fetched lazily only when History opens.
  const [historyArmed, setHistoryArmed] = useState(false);
  const [historyDateKey, setHistoryDateKey] = useState(() => formatDateKey());
  const timelineQuery = useLotStatusTimeline(projectId, historyArmed);

  // Draw-new-lot.
  const [drawLotArmed, setDrawLotArmed] = useState(false);
  const [pendingDraw, setPendingDraw] = useState<{
    feature: GeoJsonFeature;
    areaM2: number;
  } | null>(null);
  const [savingDraw, setSavingDraw] = useState(false);

  // Locate-me: the map instance (via MapContainer ref) plus a one-shot fix to
  // render a temporary accuracy circle. No watch/tracking — a single lookup.
  const [map, setMap] = useState<L.Map | null>(null);
  const [locating, setLocating] = useState(false);
  const [locatedFix, setLocatedFix] = useState<{ center: LatLng; accuracy: number } | null>(null);

  // Offline: the service worker serves previously viewed tiles/sheets/data
  // (see lib/pwaRuntimeCaching.ts); the banner explains any gaps.
  const isOnline = useSyncExternalStore(
    subscribeToOnlineStatus,
    () => navigator.onLine,
    () => true,
  );

  // Tile-error toast: one debounced message per layer, re-armed on layer change.
  const tileErrorShownRef = useRef(false);
  const handleTileError = useCallback(() => {
    // Offline grey tiles are expected and already explained by the banner —
    // only toast when errors happen while we believe we're online.
    if (!navigator.onLine) return;
    if (tileErrorShownRef.current) return;
    tileErrorShownRef.current = true;
    toast({
      title: 'Map imagery failed to load',
      description: 'Map imagery failed to load — check your connection.',
      variant: 'error',
    });
  }, []);
  const resetTileError = useCallback(() => {
    tileErrorShownRef.current = false;
  }, []);

  const handleLocate = useCallback(() => {
    if (!map) return;
    if (!('geolocation' in navigator)) {
      toast({
        title: 'Location unavailable',
        description: 'This device does not support location.',
        variant: 'error',
      });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const center: LatLng = [position.coords.latitude, position.coords.longitude];
        setLocatedFix({ center, accuracy: position.coords.accuracy });
        map.flyTo(center, 18);
        setLocating(false);
      },
      (error) => {
        setLocating(false);
        const description =
          error.code === error.PERMISSION_DENIED
            ? 'Location permission was denied. Enable it in your browser to use this.'
            : 'Could not get your location. Check your GPS/connection and try again.';
        toast({ title: 'Location unavailable', description, variant: 'error' });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }, [map]);

  const registeredSheets = useMemo(
    () => (planSheetsQuery.data ?? []).filter((s) => s.hasRegistration && s.cornersWgs84),
    [planSheetsQuery.data],
  );

  // Drawings-first projects: with no lot geometry yet, show the first registered
  // sheet automatically so the map opens on the drawing and lots can be traced
  // straight off it. Only seeds the initial state — user toggles are never
  // overridden (planShown stays empty until this or the user sets it).
  const geometryCount = geometriesQuery.data?.geometries?.length ?? 0;
  const planShownSeeded = useRef(false);
  useEffect(() => {
    if (planShownSeeded.current) return;
    if (geometriesQuery.isLoading || planSheetsQuery.isLoading) return;
    planShownSeeded.current = true;
    if (geometryCount === 0 && registeredSheets.length > 0) {
      setPlanShown({ [registeredSheets[0].id]: true });
    }
  }, [geometriesQuery.isLoading, planSheetsQuery.isLoading, geometryCount, registeredSheets]);

  const handleMapBounds = useCallback((bounds: L.LatLngBounds) => setMapBounds(bounds), []);

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
    setDrawLotArmed(false);
    setHistoryArmed(false);
    setDrawArmed(true);
  }, [drawArmed, clearSearch]);

  const toggleCoverage = useCallback(() => {
    setCoverageArmed((armed) => {
      if (armed) {
        setGapFocusBounds(null);
        return false;
      }
      clearSearch();
      setDrawLotArmed(false);
      setHistoryArmed(false);
      return true;
    });
  }, [clearSearch]);

  // Draw-lot is mutually exclusive with the find-by-area / coverage tools.
  const armDrawLot = useCallback(() => {
    setDrawLotArmed((armed) => {
      if (armed) return false;
      clearSearch();
      setCoverageArmed(false);
      setGapFocusBounds(null);
      setHistoryArmed(false);
      return true;
    });
  }, [clearSearch]);

  // History (time scrubber) is mutually exclusive with the draw/find/coverage
  // tools — entering it disarms them and closes the Plans panel so nothing that
  // does not make sense against a past date stays open.
  const toggleHistory = useCallback(() => {
    setHistoryArmed((armed) => {
      if (armed) return false;
      clearSearch();
      setCoverageArmed(false);
      setGapFocusBounds(null);
      setDrawLotArmed(false);
      setPlansOpen(false);
      setHistoryDateKey(formatDateKey());
      return true;
    });
  }, [clearSearch]);

  const togglePlanShown = useCallback((id: string) => {
    setPlanShown((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const zoomToSheet = useCallback(
    (id: string) => {
      const corners = registeredSheets.find((s) => s.id === id)?.cornersWgs84;
      if (!corners) return;
      const bounds = cornersToLatLngBounds([
        corners.topLeft,
        corners.topRight,
        corners.bottomRight,
        corners.bottomLeft,
      ]);
      // Fresh tuple each click so FitBounds re-fits even for the same sheet.
      if (bounds) setZoomTarget([bounds[0], bounds[1]]);
    },
    [registeredSheets],
  );

  const handleDrawComplete = useCallback((feature: GeoJsonFeature) => {
    setDrawLotArmed(false);
    const ring =
      feature.geometry.type === 'Polygon'
        ? (feature.geometry.coordinates[0] as [number, number][])
        : [];
    setPendingDraw({ feature, areaM2: polygonAreaM2(ring) });
  }, []);

  const handleDrawCancel = useCallback(() => setDrawLotArmed(false), []);

  const confirmAssignDraw = useCallback(
    async (lotId: string) => {
      if (!pendingDraw) return;
      setSavingDraw(true);
      try {
        await createDrawnLotGeometry(lotId, pendingDraw.feature);
        await queryClient.invalidateQueries({
          queryKey: queryKeys.projectLotGeometries(projectId),
        });
        toast({
          title: 'Lot placed',
          description: 'The drawn footprint was saved to the lot.',
          variant: 'success',
        });
        setPendingDraw(null);
      } catch (err) {
        toast({
          title: 'Could not save lot',
          description: extractErrorMessage(err, 'Please try again.'),
          variant: 'error',
        });
      } finally {
        setSavingDraw(false);
      }
    },
    [pendingDraw, projectId, queryClient],
  );

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

  // Split lots by whether they already have geometry — the assign dialog lists
  // ungeoreferenced lots first (the common draw-a-new-lot case).
  const geometryLotIds = useMemo(
    () => new Set((allGeometries ?? []).map((g) => g.lotId)),
    [allGeometries],
  );
  const lotsWithoutGeometry = useMemo(
    () => lots.filter((lot) => !geometryLotIds.has(lot.id)),
    [lots, geometryLotIds],
  );
  const lotsWithGeometry = useMemo(
    () => lots.filter((lot) => geometryLotIds.has(lot.id)),
    [lots, geometryLotIds],
  );

  // Shown sheets whose footprint is outside the current view → offer a zoom.
  const offscreenSheetIds = useMemo(() => {
    const ids = new Set<string>();
    if (!mapBounds) return ids;
    for (const sheet of registeredSheets) {
      const corners = sheet.cornersWgs84;
      if (!planShown[sheet.id] || !corners) continue;
      const bounds = cornersToLatLngBounds([
        corners.topLeft,
        corners.topRight,
        corners.bottomRight,
        corners.bottomLeft,
      ]);
      if (!bounds) continue;
      if (!mapBounds.intersects(L.latLngBounds(bounds[0], bounds[1]))) ids.add(sheet.id);
    }
    return ids;
  }, [mapBounds, registeredSheets, planShown]);

  const filteredGeometries = useMemo(
    () => filterGeometriesByLotIds(allGeometries ?? [], filteredLotIds),
    [allGeometries, filteredLotIds],
  );

  // History mode: lotId → status as of the selected date. null = not in history
  // mode; a lot absent from the map means it did not exist yet (hide it).
  const historicalStatus = useMemo(() => {
    if (!historyArmed || !timelineQuery.data) return null;
    return historicalStatusByLot(timelineQuery.data, historyDateKey);
  }, [historyArmed, timelineQuery.data, historyDateKey]);

  const displayGeometries = useMemo(() => {
    if (!historicalStatus) return filteredGeometries;
    const out: ProjectLotGeometry[] = [];
    for (const g of filteredGeometries) {
      const status = historicalStatus.get(g.lotId);
      if (status === undefined) continue; // not created as of the selected date
      out.push(status === g.status ? g : { ...g, status });
    }
    return out;
  }, [filteredGeometries, historicalStatus]);

  const earliestKey = timelineQuery.data?.earliest
    ? formatDateKey(new Date(timelineQuery.data.earliest))
    : null;

  const bounds = useMemo(() => {
    const fromShapes = computeBounds([
      ...filteredGeometries.map((g) => g.geometryWgs84),
      ...controlLines.map((c) => c.geometryWgs84),
    ]);
    if (fromShapes) return fromShapes;
    // Drawings-first fallback: no geometry or control line yet — open on the
    // first registered plan sheet so the drawing is in view.
    const corners = registeredSheets[0]?.cornersWgs84;
    if (!corners) return null;
    return cornersToLatLngBounds([
      corners.topLeft,
      corners.topRight,
      corners.bottomRight,
      corners.bottomLeft,
    ]);
  }, [filteredGeometries, controlLines, registeredSheets]);

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
    // Capture via the Leaflet instance, not a DOM query: react-leaflet's
    // MapContainer treats unknown props as Leaflet options, so a data-testid
    // prop never reaches the DOM (the mocked container in tests DID render it,
    // which is how a selector-based lookup passed CI but no-oped in prod).
    const node = map?.getContainer();
    if (!node) {
      toast({
        title: 'Snapshot failed',
        description: 'The map is not ready yet — try again in a moment.',
        variant: 'error',
      });
      return;
    }
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
  }, [map, projectId, projectName]);

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
      {/* A registered plan sheet is a reason to render the map even with zero
          geometries — drawings-first projects trace their lots off the sheet. */}
      {showEmptyState && (allGeometries?.length ?? 0) === 0 && registeredSheets.length === 0 ? (
        <EmptyStateCallout
          projectId={projectId}
          hasControlLines={controlLines.length > 0}
          controlLineId={controlLines[0]?.id ?? null}
          canManageSettings={canManageSettings}
          settingsHref={linkPaths.settings}
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
            {!isOnline && (
              <div
                className="pointer-events-none absolute left-1/2 top-3 z-[1000] -translate-x-1/2 whitespace-nowrap rounded-full bg-zinc-900/80 px-3 py-1 text-xs font-medium text-white shadow"
                data-testid="map-offline-banner"
              >
                Offline — showing saved map data
              </div>
            )}
            <div className="absolute left-3 top-3 z-[1000] pointer-events-auto">
              <div className="flex flex-wrap items-center gap-2">
                <ToolbarButton
                  icon={Square}
                  label="Find by area"
                  text={drawArmed ? 'Cancel' : 'Find by area'}
                  onClick={armFindByArea}
                  pressed={drawArmed}
                  compact={isMobile}
                  testId="find-by-area-button"
                />
                <ToolbarButton
                  icon={Layers}
                  label="Coverage"
                  onClick={toggleCoverage}
                  pressed={coverageArmed}
                  compact={isMobile}
                  testId="coverage-button"
                />
                <ToolbarButton
                  icon={MapIcon}
                  label="Plans"
                  onClick={() => setPlansOpen((open) => !open)}
                  pressed={plansOpen}
                  compact={isMobile}
                  testId="plans-button"
                />
                {canManageSettings && (
                  <ToolbarButton
                    icon={PencilRuler}
                    label="Draw lot"
                    text={drawLotArmed ? 'Cancel draw' : 'Draw lot'}
                    onClick={armDrawLot}
                    pressed={drawLotArmed}
                    compact={isMobile}
                    testId="draw-lot-button"
                  />
                )}
                <ToolbarButton
                  icon={Camera}
                  label="Snapshot"
                  text={snapshotting ? 'Saving…' : 'Snapshot'}
                  onClick={handleSnapshot}
                  disabled={snapshotting}
                  compact={isMobile}
                  testId="snapshot-button"
                />
                <ToolbarButton
                  icon={Crosshair}
                  label="My location"
                  text={locating ? 'Locating…' : 'My location'}
                  onClick={handleLocate}
                  disabled={locating || !map}
                  compact={isMobile}
                  testId="locate-me-button"
                />
                <ToolbarButton
                  icon={History}
                  label="History"
                  text={historyArmed ? 'Exit history' : 'History'}
                  onClick={toggleHistory}
                  pressed={historyArmed}
                  compact={isMobile}
                  testId="history-button"
                />
              </div>
              {drawArmed && (
                <p className="mt-1 max-w-[12rem] rounded bg-background/90 px-2 py-1 text-xs text-muted-foreground shadow">
                  {isMobile
                    ? 'Drag a box on the map. Tap the button again to cancel.'
                    : 'Drag a box on the map. Press Esc to cancel.'}
                </p>
              )}
              {drawLotArmed && (
                <p className="mt-1 max-w-[14rem] rounded bg-background/90 px-2 py-1 text-xs text-muted-foreground shadow">
                  {isMobile
                    ? 'Tap to place polygon corners; double-tap to finish. Tap the button again to cancel.'
                    : 'Click to place polygon corners; double-click to finish. Press Esc to cancel.'}
                </p>
              )}
              {plansOpen && (
                <PlansPanel
                  settingsHref={linkPaths.settings}
                  sheets={registeredSheets}
                  shown={planShown}
                  opacity={planOpacity}
                  blend={planBlend}
                  offscreenIds={offscreenSheetIds}
                  onToggle={togglePlanShown}
                  onOpacityChange={setPlanOpacity}
                  onBlendChange={setPlanBlend}
                  onZoom={zoomToSheet}
                />
              )}
              {historyArmed && (
                <HistoryPanel
                  earliestKey={earliestKey}
                  todayKey={formatDateKey()}
                  valueKey={historyDateKey}
                  onChange={setHistoryDateKey}
                  isLoading={timelineQuery.isLoading}
                  error={timelineQuery.error}
                  onRetry={() => timelineQuery.refetch()}
                />
              )}
            </div>

            <MapContainer
              ref={setMap}
              center={AU_DEFAULT_CENTER}
              zoom={AU_DEFAULT_ZOOM}
              scrollWheelZoom
              // No +/- control on mobile: pinch covers zoom, and the control's
              // top-left corner is exactly where the toolbar's first button sits
              // at phone width (it hid "Find by area" under itself on a real
              // device). Creation-time Leaflet option — set from the viewport at
              // mount, which is when it matters.
              zoomControl={!isMobile}
              // Mobile: cap at 60% of the (dynamic) viewport so toolbar + legend
              // fit without a fiddly inner scroll. Desktop keeps a fixed 520px.
              style={{ height: isMobile ? 'min(520px, 60dvh)' : 520, width: '100%' }}
            >
              <LayersControl position="topright">
                {MAPTILER_KEY && (
                  <LayersControl.BaseLayer checked name="Satellite">
                    <TileLayer
                      url={`https://api.maptiler.com/maps/satellite/{z}/{x}/{y}.jpg?key=${MAPTILER_KEY}`}
                      attribution='&copy; <a href="https://www.maptiler.com/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      maxZoom={20}
                      crossOrigin="anonymous"
                      eventHandlers={{ tileerror: handleTileError }}
                    />
                  </LayersControl.BaseLayer>
                )}
                <LayersControl.BaseLayer checked={!MAPTILER_KEY} name="Street">
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    maxZoom={19}
                    crossOrigin="anonymous"
                    eventHandlers={{ tileerror: handleTileError }}
                  />
                </LayersControl.BaseLayer>
              </LayersControl>

              <ScaleControl position="bottomleft" imperial={false} />
              <NorthArrow />

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

              {displayGeometries.map((geometry) => (
                <LotGeometryLayer
                  key={geometry.id}
                  geometry={geometry}
                  onViewDetails={() => navigate(linkPaths.lot(geometry.lotId))}
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

              <MapBoundsWatcher onBounds={handleMapBounds} onBaseLayerChange={resetTileError} />
              <FitBounds bounds={zoomTarget} />

              {locatedFix && (
                <>
                  <Circle
                    center={locatedFix.center}
                    radius={locatedFix.accuracy}
                    pathOptions={{
                      color: '#2563eb',
                      weight: 1,
                      fillColor: '#2563eb',
                      fillOpacity: 0.12,
                    }}
                  />
                  <CircleMarker
                    center={locatedFix.center}
                    radius={6}
                    pathOptions={{
                      color: '#ffffff',
                      weight: 2,
                      fillColor: '#2563eb',
                      fillOpacity: 1,
                    }}
                  />
                </>
              )}

              {registeredSheets.map((sheet) =>
                planShown[sheet.id] ? (
                  <PlanSheetOverlay
                    key={sheet.id}
                    projectId={projectId}
                    sheet={sheet}
                    opacity={planOpacity}
                    blend={planBlend}
                  />
                ) : null,
              )}

              <DrawLotLayer
                active={drawLotArmed}
                onComplete={handleDrawComplete}
                onCancel={handleDrawCancel}
              />
            </MapContainer>

            {searchBounds && (
              <FindByAreaPanel
                linkPaths={linkPaths}
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
                unmappedLotCount={coverageQuery.data?.unmappedLotCount ?? 0}
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

          {pendingDraw && (
            <AssignDrawnLotDialog
              lotsWithoutGeometry={lotsWithoutGeometry}
              lotsWithGeometry={lotsWithGeometry}
              areaM2={pendingDraw.areaM2}
              saving={savingDraw}
              onConfirm={(lotId) => void confirmAssignDraw(lotId)}
              onCancel={() => setPendingDraw(null)}
            />
          )}
        </>
      )}
    </div>
  );
}

export default LotMapView;
