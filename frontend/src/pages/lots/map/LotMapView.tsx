import 'leaflet/dist/leaflet.css';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatActivityLabel } from '@/lib/activityTaxonomy';
import {
  Circle,
  CircleMarker,
  LayersControl,
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  Popup,
  Rectangle,
  ScaleControl,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
  ZoomControl,
} from 'react-leaflet';
import L from 'leaflet';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ExternalLink, Navigation } from 'lucide-react';

import { SecureDocumentImage } from '@/components/documents/SecureDocumentImage';
import { getStatusColor } from '@/components/lots/linearMapViewHelpers';
import { formatStatusLabel } from '@/lib/statusLabels';
import {
  formatCoordinate,
  formatProvenance,
  readSamplePoint,
  type SamplePoint,
} from '@/lib/samplePoint';
import { extractErrorMessage, isForbidden } from '@/lib/errorHandling';
import { formatDateKey } from '@/lib/localDate';
import { authFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { toast } from '@/components/ui/toaster';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { readLocalStorageItem, writeLocalStorageItem } from '@/lib/storagePreferences';
import { usePlanSheets } from '@/pages/projects/settings/planSheetsData';

import { AreaDrawLayer } from './AreaDrawLayer';
import { LotsGeoJsonLayer, POLYGON_STROKE_COLOR, type LotSelectEvent } from './LotsGeoJsonLayer';
import { chooseCamera, readSavedViewport, writeSavedViewport } from './cameraPolicy';
import { LotLabelsLayer, type LabelLot } from './LotLabelsLayer';
import { PlanModeCanvas } from './PlanModeCanvas';
import { PlanModeBar } from './PlanModeBar';
import { applyMapUrlState, readMapUrlState } from './mapUrlState';
import { FindByAreaPanel } from './FindByAreaPanel';
import { CoveragePanel } from './CoveragePanel';
import { PlansPanel } from './PlansPanel';
import { PlanSheetOverlay } from './PlanSheetOverlay';
import { DrawLotLayer } from './DrawLotLayer';
import { AssignDrawnLotDialog } from './AssignDrawnLotDialog';
import { HistoryPanel } from './HistoryPanel';
import { TestCoveragePanel } from './TestCoveragePanel';
import { MapToolbar } from './MapToolbar';
import {
  buildMapLayerRows,
  type MapBasemapId,
  type MapPanelId,
  type MapPinLayerId,
} from './mapLayerRows';
import { getTestCoverageColor, testCoverageByLot, useTestCoverage } from './testCoverageData';
import { MapLegend } from './MapLegend';
import { useSpatialSearch, type SpatialPhoto, type SpatialTestResult } from './spatialSearchData';
import { historicalStatusByLot, useLotStatusTimeline } from './statusTimelineData';
import { orthoTileUrl, readyOrthoLayers, useOrthoLayers } from './orthoData';
import {
  ALL_WORK_TYPES,
  selectCoverageGroup,
  useProjectCoverage,
  type CoverageGap,
} from './coverageData';
import {
  backfillLotGeometries,
  chainageLabel,
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
  featureCentroid,
  featureToShape,
  filterGeometriesByLotIds,
  polygonAreaM2,
  type LatLng,
  type SearchBounds,
} from './lotMapHelpers';

const CONTROL_LINE_COLOR = '#f59e0b'; // amber — neutral against status fills
// Gap overlay: dashed red outline + light red fill (see PR note — SVG hatch
// patterns fight react-leaflet, so a semi-transparent fill is the pragmatic tell).
const GAP_COLOR = '#dc2626';

// DG-4b. Both marker layers wear the SAME neutral shell — a white face with the
// constant POLYGON_STROKE_COLOR casing already used for every lot boundary — and
// are told apart by SHAPE and glyph, not hue: a circle is a photo, a diamond is a
// test. The shipped violet (#7c3aed) and magenta (#db2777) discs read as two more
// categories on a map whose fills already carry eight Okabe-Ito status colours,
// and they were the only two marks whose identity died in greyscale, in direct
// sunlight, or for a colour-blind reader.
const PIN_GLYPH_STROKE = POLYGON_STROKE_COLOR;
const PHOTO_GLYPH =
  '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>' +
  '<circle cx="12" cy="13" r="3"/>';
const TEST_GLYPH =
  '<path d="M10 2v7.5L4.6 18A2 2 0 0 0 6.3 21h11.4a2 2 0 0 0 1.7-3L14 9.5V2"/>' +
  '<path d="M8.5 2h7"/><path d="M7 15h10"/>';

function pinGlyph(paths: string, size: number): string {
  return (
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${PIN_GLYPH_STROKE}" ` +
    `stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`
  );
}

// GPS photo pin: a CIRCLE.
const PHOTO_PIN_ICON = L.divIcon({
  className: 'siteproof-photo-pin',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  popupAnchor: [0, -13],
  html:
    `<div style="width:26px;height:26px;border-radius:9999px;background:#ffffff;border:2px solid ${POLYGON_STROKE_COLOR};box-shadow:0 1px 3px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center">` +
    `${pinGlyph(PHOTO_GLYPH, 14)}</div>`,
});

// C3 Phase B2. A captured sample point: a DIAMOND. The face is a square rotated
// 45°; the glyph rides above it unrotated so it stays readable.
const TEST_PIN_ICON = L.divIcon({
  className: 'siteproof-test-pin',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  popupAnchor: [0, -13],
  html:
    '<div style="position:relative;width:26px;height:26px">' +
    `<div style="position:absolute;left:4px;top:4px;width:18px;height:18px;background:#ffffff;border:2px solid ${POLYGON_STROKE_COLOR};box-shadow:0 1px 3px rgba(0,0,0,.4);transform:rotate(45deg)"></div>` +
    `<div style="position:absolute;left:6px;top:6px;width:14px;height:14px">${pinGlyph(TEST_GLYPH, 14)}</div>` +
    '</div>',
});

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
  /**
   * 'workspace': the map fills whatever height its parent gives it (the classic
   * lots page hands it the rest of the viewport — the spatial workspace).
   * 'embedded' (default): the shipped fixed-height strip, still used by the
   * foreman shell's card.
   */
  variant?: 'workspace' | 'embedded';
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

// The ONE lot popup, opened by selection on the collapsed GeoJSON layer (there
// is no per-lot Popup component any more — that per-feature React overhead was
// the measured map bottleneck).
function LotPopup({
  geometry,
  position,
  onViewDetails,
  onClose,
}: {
  geometry: ProjectLotGeometry;
  position: LatLng;
  onViewDetails: () => void;
  onClose: () => void;
}) {
  const destination = featureCentroid(geometry.geometryWgs84);
  return (
    <Popup position={position} eventHandlers={{ remove: onClose }}>
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
          {geometry.activityType ? ` · ${formatActivityLabel(geometry.activityType)}` : ''}
          {(() => {
            // With dozens of identical strips, the chainage range is what tells a
            // human WHICH bit of road this is — the number alone doesn't.
            const ch = chainageLabel(geometry.chainageStart, geometry.chainageEnd);
            return ch ? ` · ${ch}` : '';
          })()}
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
        <div className="mt-2 flex flex-col items-start gap-1.5">
          <button
            type="button"
            onClick={onViewDetails}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            data-testid={`lot-popup-view-${geometry.lotId}`}
          >
            <ExternalLink className="h-3.5 w-3.5" /> View Details
          </button>
          {/* Turn-by-turn to the lot in the phone's native maps app. The Google
              Maps universal URL opens the app on iOS/Android and the web on
              desktop. It is a genuine external link (not in-app nav), so it is
              identical in the classic map and the foreman shell — no linkPaths
              plumbing. Only shown when the geometry yields a destination. */}
          {destination && (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${destination[0]},${destination[1]}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              data-testid={`lot-popup-directions-${geometry.lotId}`}
            >
              <Navigation className="h-3.5 w-3.5" /> Directions
            </a>
          )}
        </div>
      </div>
    </Popup>
  );
}

// One GPS-tagged photo as a map marker with a thumbnail popup. Coords are
// guaranteed non-null by the caller. `onView` navigates through linkPaths.photo
// (null when the photo has no shell/desktop destination → no link rendered).
function PhotoPin({ photo, onView }: { photo: SpatialPhoto; onView: (() => void) | null }) {
  const label = photo.caption ?? photo.filename;
  return (
    <Marker position={[photo.gpsLatitude!, photo.gpsLongitude!]} icon={PHOTO_PIN_ICON}>
      <Popup>
        <div className="w-40" data-testid={`photo-pin-${photo.id}`}>
          <SecureDocumentImage
            documentId={photo.id}
            variant="thumb"
            alt={label}
            className="h-28 w-full rounded object-cover"
          />
          <div className="mt-1 truncate text-xs font-medium" title={label}>
            {label}
          </div>
          {onView && (
            <button
              type="button"
              onClick={onView}
              className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              data-testid={`photo-pin-view-${photo.id}`}
            >
              <ExternalLink className="h-3.5 w-3.5" /> View photo
            </button>
          )}
        </div>
      </Popup>
    </Marker>
  );
}

// C3 Phase B2 §5.5. One test whose sample point a human captured. Coords are
// guaranteed non-null by the caller — there is no fallback position, because a
// test with no captured location is counted, never drawn `[C3S-B1]`.
//
// The popup states PROVENANCE and ACCURACY alongside the result `[C3R-A5]`: a pin
// whose accuracy is unstated invites a reader to trust it more than it deserves.
function TestPin({
  test,
  point,
  onView,
}: {
  test: SpatialTestResult;
  point: SamplePoint;
  onView: (() => void) | null;
}) {
  return (
    <Marker position={[point.lat, point.lng]} icon={TEST_PIN_ICON}>
      <Popup>
        <div className="w-48 space-y-1" data-testid={`test-pin-${test.id}`}>
          <div className="truncate text-sm font-medium" title={test.testType}>
            {test.testType}
          </div>
          <div className="text-xs text-muted-foreground">
            {[
              formatStatusLabel(test.status),
              test.passFail && test.passFail !== 'pending'
                ? formatStatusLabel(test.passFail)
                : null,
              test.lotNumber ?? test.testRequestNumber,
            ]
              .filter(Boolean)
              .join(' · ')}
          </div>
          <div className="text-xs text-muted-foreground" data-testid={`test-pin-point-${test.id}`}>
            {formatCoordinate(point)} · {formatProvenance(point)}
          </div>
          {onView && (
            <button
              type="button"
              onClick={onView}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              data-testid={`test-pin-view-${test.id}`}
            >
              <ExternalLink className="h-3.5 w-3.5" /> View test
            </button>
          )}
        </div>
      </Popup>
    </Marker>
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

export function LotMapView({
  projectId,
  filteredLotIds,
  canManageSettings,
  projectName,
  lots = [],
  linkTargets,
  variant = 'embedded',
}: LotMapViewProps) {
  const navigate = useNavigate();
  const workspace = variant === 'workspace';
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
  const orthoLayersQuery = useOrthoLayers(projectId);

  const search = useSpatialSearch(projectId);
  const { mutate: runSearch, reset: resetSearch } = search;
  const [drawArmed, setDrawArmed] = useState(false);
  const [searchBounds, setSearchBounds] = useState<SearchBounds | null>(null);

  // Photo pins layer: an independent spatial-search instance (own data, so it
  // never clobbers find-by-area's results). Toggle persisted per project,
  // default OFF; when on we refetch the current viewport's photos (debounced).
  const photoSearch = useSpatialSearch(projectId, { only: 'photos' });
  const { mutate: runPhotoSearch, reset: resetPhotoSearch } = photoSearch;
  const photosStorageKey = `siteproof.mapPhotos.${projectId}`;
  const [photosArmed, setPhotosArmed] = useState<boolean>(
    () => readLocalStorageItem(photosStorageKey) === 'true',
  );
  useEffect(() => {
    writeLocalStorageItem(photosStorageKey, String(photosArmed));
  }, [photosStorageKey, photosArmed]);
  const togglePhotos = useCallback(() => {
    setPhotosArmed((on) => {
      if (on) resetPhotoSearch();
      return !on;
    });
  }, [resetPhotoSearch]);

  // C3 Phase B2: the test-pin layer. Its own spatial-search instance in `tests`
  // mode, modelled on the photo layer above — same toggle, same per-project
  // localStorage key, same viewport-debounced refetch, and like Photos it is NOT
  // in the mutually-exclusive tool set (a passive marker layer). It IS in
  // `toggleHistory`'s disarm list `[C3R-B5]`: a sample point captured today has no
  // place on a map showing last month.
  const testPinSearch = useSpatialSearch(projectId, { only: 'tests' });
  const { mutate: runTestPinSearch, reset: resetTestPinSearch } = testPinSearch;
  const testPinsStorageKey = `siteproof.mapTests.${projectId}`;
  const [testPinsArmed, setTestPinsArmed] = useState<boolean>(
    () => readLocalStorageItem(testPinsStorageKey) === 'true',
  );
  useEffect(() => {
    writeLocalStorageItem(testPinsStorageKey, String(testPinsArmed));
  }, [testPinsStorageKey, testPinsArmed]);
  const toggleTestPins = useCallback(() => {
    setTestPinsArmed((on) => {
      if (on) resetTestPinSearch();
      return !on;
    });
  }, [resetTestPinSearch]);

  // C3 Phase A: the testing overlay. Lazy — nothing is fetched until it is
  // armed. Deliberately NOT in the mutually-exclusive tool set (it is a passive
  // recolour, like Photos) but it IS in `toggleHistory`'s disarm list below
  // `[C3R-B5]`: today's verdict must never be painted over a past map.
  const [testingArmed, setTestingArmed] = useState(false);
  const testCoverageQuery = useTestCoverage(projectId, testingArmed);
  const [coverageArmed, setCoverageArmed] = useState(false);
  const [coverageSelection, setCoverageSelection] = useState<Record<string, string>>({});
  const [gapFocusBounds, setGapFocusBounds] = useState<[LatLng, LatLng] | null>(null);
  const coverageQuery = useProjectCoverage(projectId, coverageArmed);

  // DG-4b. The Layers chooser (DropdownMenu on desktop, BottomSheet on mobile).
  const [layersOpen, setLayersOpen] = useState(false);

  // Plan overlays.
  const [plansOpen, setPlansOpen] = useState(false);
  const [planShown, setPlanShown] = useState<Record<string, boolean>>({});
  const [planOpacity, setPlanOpacity] = useState(0.85);
  const [orthoShown, setOrthoShown] = useState<Record<string, boolean>>({});
  const [orthoOpacity, setOrthoOpacity] = useState<Record<string, number>>({});
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

  // Tile-error toast: one debounced message per layer, re-armed on layer change.
  const tileErrorShownRef = useRef(false);
  const handleTileError = useCallback(() => {
    // Offline grey tiles are expected — the app-wide OfflineIndicator pill is
    // already showing, and the SW serves previously viewed tiles/sheets/data
    // (see lib/pwaRuntimeCaching.ts). Only toast while we believe we're online.
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

  // QA/RT-02. Read at render, not module scope, so the satellite branch is
  // reachable from a test that stubs the env.
  const maptilerKey = import.meta.env.VITE_MAPTILER_KEY as string | undefined;
  const satelliteAvailable = Boolean(maptilerKey);
  // Mobile has no Leaflet LayersControl to hold the choice (see the tile block
  // below), so the choice lives here and the Layers sheet drives it. Same
  // default the control's `checked` BaseLayer had.
  const [basemap, setBasemap] = useState<MapBasemapId>(satelliteAvailable ? 'satellite' : 'street');
  const changeBasemap = useCallback(
    (next: MapBasemapId) => {
      setBasemap(next);
      // All the `baselayerchange` listener ever did: re-arm the tile-error toast
      // for the layer now on screen.
      resetTileError();
    },
    [resetTileError],
  );

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
  const readyOrthos = useMemo(
    () => readyOrthoLayers(orthoLayersQuery.data),
    [orthoLayersQuery.data],
  );

  const activeOrthoCount = readyOrthos.filter((ortho) => orthoShown[ortho.id]).length;
  const toggleOrtho = useCallback(
    (id: string) => {
      if (!orthoShown[id] && activeOrthoCount >= 2) {
        toast({
          title: 'Two drone layers already shown',
          description: 'Turn one off before showing another layer.',
          variant: 'error',
        });
        return;
      }
      setOrthoShown((shown) => ({ ...shown, [id]: !shown[id] }));
    },
    [activeOrthoCount, orthoShown],
  );
  const changeOrthoOpacity = useCallback((id: string, opacity: number) => {
    setOrthoOpacity((current) => ({ ...current, [id]: opacity }));
  }, []);

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

  // While the photo layer is on, (re)fetch the photos in the current viewport.
  // MapBoundsWatcher already lifts bounds on move/zoom; a 600ms debounce keeps a
  // pan-and-zoom from firing a request per frame. Turning the layer off clears
  // the data via resetPhotoSearch, so no fetch runs here.
  useEffect(() => {
    if (!photosArmed || !mapBounds) return;
    const timer = setTimeout(() => {
      runPhotoSearch({
        west: mapBounds.getWest(),
        south: mapBounds.getSouth(),
        east: mapBounds.getEast(),
        north: mapBounds.getNorth(),
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [photosArmed, mapBounds, runPhotoSearch]);

  // Same shape for the test-pin layer. `only=tests` bboxes the test's OWN captured
  // coordinate, so an unlocated test is never returned and never drawn.
  useEffect(() => {
    if (!testPinsArmed || !mapBounds) return;
    const timer = setTimeout(() => {
      runTestPinSearch({
        west: mapBounds.getWest(),
        south: mapBounds.getSouth(),
        east: mapBounds.getEast(),
        north: mapBounds.getNorth(),
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [testPinsArmed, mapBounds, runTestPinSearch]);

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

  // The testing overlay is a passive recolour, so it is NOT in the
  // mutually-exclusive tool set — but its PANEL shares one slot with
  // Find-by-area's and Coverage's. Arming Testing takes that slot; opening
  // either of those takes it back (the render guard at the panel). Last opened
  // wins, and the recolour itself survives either way.
  const toggleTesting = useCallback(() => {
    setTestingArmed((on) => {
      if (on) return false;
      clearSearch();
      setCoverageArmed(false);
      setGapFocusBounds(null);
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
      // `[C3R-B5]` The testing overlay's verdict is computed NOW, from today's
      // verified tests. Painted over a historical map it would be two different
      // dates in one picture. The reverse is deliberately not wired: History is
      // the stricter mode and owns the map.
      setTestingArmed(false);
      // Same reason, same list: a sample point captured today is not evidence
      // about a past date. B2's pins join the overlay here `[C3R-B5]`.
      setTestPinsArmed(false);
      resetTestPinSearch();
      setHistoryDateKey(formatDateKey());
      return true;
    });
  }, [clearSearch, resetTestPinSearch]);

  // DG-4b. The chooser's two kinds of row land on two different verbs.
  //
  // A PIN row toggles its layer and leaves the chooser open — arming Photo pins
  // and Test pins is one errand. A PANEL row is navigation: it closes the
  // chooser and hands the map to a panel that owns its own state (and its own
  // close), which is why panels never carry a checkbox here.
  const handleTogglePin = useCallback(
    (id: MapPinLayerId) => {
      if (id === 'photos') togglePhotos();
      else toggleTestPins();
    },
    [togglePhotos, toggleTestPins],
  );

  const handleOpenPanel = useCallback(
    (id: MapPanelId) => {
      setLayersOpen(false);
      if (id === 'plans') {
        setPlansOpen(true);
        return;
      }
      // Coverage and Testing keep their shipped mutual-exclusion rules — going
      // through their existing toggles is what preserves them. Already open is
      // not a reason to close: the row is a way BACK to the panel, and each
      // panel has its own close.
      if (id === 'coverage') {
        if (!coverageArmed) toggleCoverage();
      } else if (!testingArmed) {
        toggleTesting();
      }
    },
    [coverageArmed, testingArmed, toggleCoverage, toggleTesting],
  );

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

  // C3 Phase A. lotId → testing verdict, populated ONLY once the fetch has
  // resolved. In flight or failed it stays empty, so every polygon keeps its
  // status colour: grey is a verdict ("CIVOS has no rule"), never a loading or
  // an error state `[C3S-B7]` `[C3R-A13]`.
  // Armed marker layers whose viewport fetch failed. Named so the map never
  // presents "fetch failed" as "nothing here" (AT-94).
  const unavailablePinLayers = useMemo(() => {
    const layers: string[] = [];
    if (photosArmed && photoSearch.error) layers.push('Photos');
    if (testPinsArmed && testPinSearch.error) layers.push('Test pins');
    return layers;
  }, [photosArmed, photoSearch.error, testPinsArmed, testPinSearch.error]);

  // Pins actually DRAWN in the current viewport — what the chooser counts, and
  // what the truncation notice is about. For tests this is the located subset:
  // an unlocated test is counted by the register, never by the map `[C3S-B1]`.
  const drawnPhotos = useMemo(
    () =>
      photosArmed
        ? (photoSearch.data?.photos ?? []).filter(
            (p) => p.gpsLatitude != null && p.gpsLongitude != null,
          )
        : [],
    [photosArmed, photoSearch.data],
  );
  const drawnTestPins = useMemo(
    () =>
      testPinsArmed
        ? (testPinSearch.data?.testResults ?? []).filter((t) => readSamplePoint(t) !== null)
        : [],
    [testPinsArmed, testPinSearch.data],
  );

  // The backend capped this viewport's answer. The flag has been on the wire
  // since spatialSearch shipped and the map has never rendered it.
  const truncatedPinLayers = useMemo(() => {
    const layers: string[] = [];
    if (photosArmed && photoSearch.data?.photosTruncated) layers.push('photo pins');
    if (testPinsArmed && testPinSearch.data?.testResultsTruncated) layers.push('test pins');
    return layers;
  }, [photosArmed, photoSearch.data, testPinsArmed, testPinSearch.data]);

  const layerMenuModel = useMemo(
    () =>
      buildMapLayerRows({
        historyArmed,
        photosArmed,
        photoCount: drawnPhotos.length,
        testPinsArmed,
        testPinCount: drawnTestPins.length,
        registeredSheetCount: registeredSheets.length,
        plansOpen,
        coverageArmed,
        testingArmed,
        orthos: readyOrthos,
        orthoShown,
        orthoOpacity,
      }),
    [
      historyArmed,
      photosArmed,
      drawnPhotos.length,
      testPinsArmed,
      drawnTestPins.length,
      registeredSheets.length,
      plansOpen,
      coverageArmed,
      testingArmed,
      readyOrthos,
      orthoShown,
      orthoOpacity,
    ],
  );

  const testCoverageLots = useMemo(
    () => testCoverageByLot(testingArmed ? testCoverageQuery.data : undefined),
    [testingArmed, testCoverageQuery.data],
  );

  // Selection drives the ONE popup over the collapsed lots layer. A selected lot
  // that leaves the display set (filter change, history replay) closes it.
  const [selectedLot, setSelectedLot] = useState<LotSelectEvent | null>(null);
  const selectedGeometry = useMemo(
    () =>
      selectedLot ? (displayGeometries.find((g) => g.lotId === selectedLot.lotId) ?? null) : null,
    [selectedLot, displayGeometries],
  );

  // C3 Phase A `[C3S-g]`: the testing overlay recolour, resolved per lot here so
  // the layer stays dumb. Polygon/point use it as FILL behind the constant
  // casing; a linear lot takes it as STROKE (how status always reached lines).
  const colorForLot = useCallback(
    (lotId: string, status: string) => {
      const verdict = testCoverageLots.get(lotId);
      return verdict ? getTestCoverageColor(verdict.state) : getStatusColor(status);
    },
    [testCoverageLots],
  );

  // ── Plan mode (plan consensus #2): the sheet as a first-class canvas ──────
  const [mapMode, setMapMode] = useState<'map' | 'plan'>('map');
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
  const activeSheet = useMemo(
    () => registeredSheets.find((s) => s.id === activeSheetId) ?? registeredSheets[0] ?? null,
    [registeredSheets, activeSheetId],
  );
  const planAvailable = registeredSheets.length > 0;

  const handleModeChange = useCallback(
    (mode: 'map' | 'plan') => {
      if (mode === mapMode) return;
      // Selection latlngs are canvas-specific (sheet px vs WGS84) — clear.
      setSelectedLot(null);
      if (mode === 'plan') {
        // Geographic tools have no meaning on the sheet canvas.
        clearSearch();
        setCoverageArmed(false);
        setGapFocusBounds(null);
        setDrawLotArmed(false);
        setHistoryArmed(false);
        setPlansOpen(false);
      }
      setMapMode(mode);
    },
    [mapMode, clearSearch],
  );

  const earliestKey = timelineQuery.data?.earliest
    ? formatDateKey(new Date(timelineQuery.data.earliest))
    : null;

  const bounds = useMemo<L.LatLngBoundsExpression | null>(() => {
    const fromShapes = computeBounds([
      ...filteredGeometries.map((g) => g.geometryWgs84),
      ...controlLines.map((c) => c.geometryWgs84),
    ]);
    if (fromShapes) return fromShapes;
    // Drawings-first fallback: no geometry or control line yet — open on the
    // first registered plan sheet so the drawing is in view.
    const corners = registeredSheets[0]?.cornersWgs84;
    if (corners) {
      return cornersToLatLngBounds([
        corners.topLeft,
        corners.topRight,
        corners.bottomRight,
        corners.bottomLeft,
      ]);
    }
    const orthoBounds = readyOrthos[0]?.boundsWgs84;
    return orthoBounds
      ? [
          [orthoBounds[1], orthoBounds[0]],
          [orthoBounds[3], orthoBounds[2]],
        ]
      : null;
  }, [filteredGeometries, controlLines, registeredSheets, readyOrthos]);

  // ── Camera policy (plan consensus #3) ────────────────────────────────────
  // Applied ONCE when the map and its data are both ready: saved viewport →
  // filtered lots → active work fronts → project extent (the `bounds` memo,
  // which already knows the registered-sheet fallback). After that the camera
  // belongs to the user; the explicit Fit control re-fits on demand.
  const dataReady =
    !geometriesQuery.isLoading &&
    !controlLinesQuery.isLoading &&
    !planSheetsQuery.isLoading &&
    !orthoLayersQuery.isLoading;
  const cameraAppliedRef = useRef(false);
  useEffect(() => {
    if (mapMode !== 'map') return;
    if (!map || !dataReady || cameraAppliedRef.current) return;
    cameraAppliedRef.current = true;
    const target = chooseCamera({
      saved: readSavedViewport(projectId),
      isFiltered: filteredGeometries.length < (allGeometries?.length ?? 0),
      filteredGeometries,
      allGeometries: allGeometries ?? [],
      extentFeatures: controlLines.map((c) => c.geometryWgs84),
    });
    if (target?.kind === 'viewport') {
      map.setView(target.center, target.zoom);
    } else if (target?.kind === 'bounds') {
      map.fitBounds(target.bounds, { padding: [24, 24], maxZoom: 18 });
    } else if (bounds) {
      // Nothing but a registered sheet — open on the drawing.
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 18 });
    }
  }, [mapMode, map, dataReady, projectId, filteredGeometries, allGeometries, controlLines, bounds]);

  // Persist the viewport per project/device so reopening the map resumes where
  // the user left off (tier 1 of the policy). Debounced against pan momentum.
  // Geographic canvas only — plan-mode "latlngs" are sheet pixels.
  useEffect(() => {
    if (!map || mapMode !== 'map') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const save = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const center = map.getCenter();
        writeSavedViewport(projectId, { lat: center.lat, lng: center.lng, zoom: map.getZoom() });
      }, 600);
    };
    map.on('moveend', save);
    return () => {
      clearTimeout(timer);
      map.off('moveend', save);
    };
  }, [map, mapMode, projectId]);

  // A register-filter change after open is an explicit "show me these" — refit
  // to the new subset (the pre-workspace map did the same via its fit effect).
  const prevFilterRef = useRef(filteredLotIds);
  useEffect(() => {
    if (prevFilterRef.current === filteredLotIds) return;
    prevFilterRef.current = filteredLotIds;
    if (!map || mapMode !== 'map' || !cameraAppliedRef.current) return;
    const b = computeBounds(filteredGeometries.map((g) => g.geometryWgs84));
    if (b) map.fitBounds(b, { padding: [24, 24], maxZoom: 18 });
  }, [map, mapMode, filteredLotIds, filteredGeometries]);

  // ── URL state (view/sheet/lot/date): any workspace state is linkable ─────
  const [searchParams, setSearchParams] = useSearchParams();
  // Track the live params via a ref, not an effect dependency — the mirror
  // effect writes them, which would otherwise feed back into itself.
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  const urlInitRef = useRef(false);
  const pendingUrlLotRef = useRef<string | null>(null);
  useEffect(() => {
    if (urlInitRef.current) return;
    urlInitRef.current = true;
    const initial = readMapUrlState(searchParamsRef.current);
    if (initial.view === 'plan') setMapMode('plan');
    if (initial.sheet) setActiveSheetId(initial.sheet);
    if (initial.lot) pendingUrlLotRef.current = initial.lot;
    if (initial.date && initial.view !== 'plan') {
      setHistoryArmed(true);
      setHistoryDateKey(initial.date);
    }
  }, []);

  // Deep-linked lot: select once its geometry arrives. Map canvas only — the
  // popup needs a position in the active canvas's coordinate space.
  useEffect(() => {
    const lotId = pendingUrlLotRef.current;
    if (!lotId || !dataReady || mapMode !== 'map') return;
    pendingUrlLotRef.current = null;
    const g = (allGeometries ?? []).find((x) => x.lotId === lotId);
    const centre = g ? featureCentroid(g.geometryWgs84) : null;
    if (centre) setSelectedLot({ lotId, latlng: { lat: centre[0], lng: centre[1] } });
  }, [dataReady, mapMode, allGeometries]);

  // Mirror state → URL (replace: no history spam), leaving foreign keys alone.
  // First run is skipped so the deep-link read above wins over default state.
  const urlMirrorReadyRef = useRef(false);
  useEffect(() => {
    if (!urlMirrorReadyRef.current) {
      urlMirrorReadyRef.current = true;
      return;
    }
    const next = applyMapUrlState(searchParamsRef.current, {
      mode: mapMode,
      activeSheetId: mapMode === 'plan' ? (activeSheet?.id ?? null) : null,
      selectedLotId: selectedLot?.lotId ?? null,
      historyArmed,
      historyDateKey,
      todayKey: formatDateKey(),
    });
    if (next.toString() !== searchParamsRef.current.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [mapMode, activeSheet, selectedLot, historyArmed, historyDateKey, setSearchParams]);

  // Legend counts: what is actually drawn (post-filter, post-history).
  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of displayGeometries) counts.set(g.status, (counts.get(g.status) ?? 0) + 1);
    return counts;
  }, [displayGeometries]);
  const testingCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const verdict of testCoverageLots.values()) {
      counts.set(verdict.state, (counts.get(verdict.state) ?? 0) + 1);
    }
    return counts;
  }, [testCoverageLots]);

  // Zoom-tiered labels: one candidate per displayed lot with a usable centroid.
  const labelLots = useMemo<LabelLot[]>(
    () =>
      displayGeometries.flatMap((g) => {
        const position = featureCentroid(g.geometryWgs84);
        return position
          ? [
              {
                lotId: g.lotId,
                lotNumber: g.lotNumber,
                status: g.status,
                chainage: chainageLabel(g.chainageStart, g.chainageEnd),
                position,
              },
            ]
          : [];
      }),
    [displayGeometries],
  );

  // The explicit Fit control: filtered lots + control lines (or the first
  // registered sheet when nothing else has geometry); the sheet in Plan mode.
  const handleFit = useCallback(() => {
    if (!map) return;
    if (mapMode === 'plan') {
      if (activeSheet) {
        map.fitBounds([
          [0, 0],
          [activeSheet.imageHeight, activeSheet.imageWidth],
        ]);
      }
      return;
    }
    if (bounds) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 18 });
  }, [map, mapMode, activeSheet, bounds]);

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

  if (geometriesQuery.isLoading || controlLinesQuery.isLoading || orthoLayersQuery.isLoading) {
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

  // One definition per basemap, used by both surfaces. Only ever ONE of these is
  // mounted at a time (mobile picks one; the desktop control mounts the checked
  // BaseLayer), so this adds no tile fetches over what shipped.
  const satelliteTile = satelliteAvailable ? (
    <TileLayer
      url={`https://api.maptiler.com/maps/satellite/{z}/{x}/{y}.jpg?key=${maptilerKey}`}
      attribution='&copy; <a href="https://www.maptiler.com/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      maxZoom={20}
      crossOrigin="anonymous"
      eventHandlers={{ tileerror: handleTileError }}
    />
  ) : null;
  const streetTile = (
    <TileLayer
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      maxZoom={19}
      crossOrigin="anonymous"
      eventHandlers={{ tileerror: handleTileError }}
    />
  );

  return (
    <div
      className={workspace ? 'flex h-full min-h-0 flex-col bg-background' : 'bg-background'}
      data-testid="lot-map-view"
    >
      {/* A registered plan sheet is a reason to render the map even with zero
          geometries — drawings-first projects trace their lots off the sheet. */}
      {showEmptyState &&
      (allGeometries?.length ?? 0) === 0 &&
      registeredSheets.length === 0 &&
      readyOrthos.length === 0 ? (
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
          {/* isolate: Leaflet panes and the toolbar use z-index 400–1000, far
              above the app chrome's z-50 (OfflineIndicator, dialog overlays,
              toasts). Containing them in their own stacking context keeps the
              map from painting over fixed page-level UI — the offline pill was
              80% hidden behind the map before this. */}
          <div
            className={workspace ? 'relative isolate min-h-0 flex-1' : 'relative isolate'}
            data-testid="lot-map-stacking-root"
          >
            {/* DG-4b. One column: the Past bar (when armed) above the control
                row above the notices. `pointer-events-none` on the column with
                `auto` on each control is what keeps the transparent gaps between
                controls draggable — the map has to stay usable underneath its
                own toolbar. */}
            {/* z-[1001], not 1000: Leaflet's own `.leaflet-top`/`.leaflet-bottom`
                control containers are z-index 1000, and the MapContainer comes
                later in DOM order, so at 1000 Leaflet wins the tie and its
                controls take the tap. One above them, still inside the
                `relative isolate` root, so nothing leaks over app chrome. */}
            <div
              className="pointer-events-none absolute inset-x-3 top-3 z-[1001] flex flex-col gap-2"
              data-testid="lot-map-toolbar-column"
            >
              {/* Past view is not an action, it is a MODE: it changes the date
                  the whole map is about. So it gets a permanent bar stating that
                  date, not a popover that closes and leaves you unable to tell
                  what you are looking at. */}
              {historyArmed && (
                <div className="pointer-events-auto">
                  <HistoryPanel
                    earliestKey={earliestKey}
                    todayKey={formatDateKey()}
                    valueKey={historyDateKey}
                    onChange={setHistoryDateKey}
                    onExit={toggleHistory}
                    isLoading={timelineQuery.isLoading}
                    error={timelineQuery.error}
                    onRetry={() => timelineQuery.refetch()}
                  />
                </div>
              )}

              <MapToolbar
                isMobile={isMobile}
                mode={mapMode}
                onModeChange={handleModeChange}
                planAvailable={planAvailable}
                drawArmed={drawArmed}
                onFindByArea={armFindByArea}
                locating={locating}
                canLocate={Boolean(map)}
                onLocate={handleLocate}
                canFit={Boolean(map && bounds)}
                onFit={handleFit}
                photosArmed={photosArmed}
                onTogglePhotos={togglePhotos}
                layersOpen={layersOpen}
                onLayersOpenChange={setLayersOpen}
                layerModel={layerMenuModel}
                onTogglePin={handleTogglePin}
                onOpenPanel={handleOpenPanel}
                onToggleOrtho={toggleOrtho}
                onOrthoOpacityChange={changeOrthoOpacity}
                basemap={basemap}
                onBasemapChange={changeBasemap}
                satelliteAvailable={satelliteAvailable}
                unavailablePinLayers={unavailablePinLayers}
                truncatedPinLayers={truncatedPinLayers}
                canManageSettings={canManageSettings}
                drawLotArmed={drawLotArmed}
                onDrawLot={armDrawLot}
                snapshotting={snapshotting}
                onSnapshot={handleSnapshot}
                historyArmed={historyArmed}
                onToggleHistory={toggleHistory}
              />
              {/* Which sheet, and how far to trust it — always on in Plan mode. */}
              {mapMode === 'plan' && activeSheet && (
                <PlanModeBar
                  projectId={projectId}
                  sheet={activeSheet}
                  sheets={registeredSheets}
                  onSheetChange={setActiveSheetId}
                />
              )}
              {/* `w-fit` so the panel's wrapper does not stretch across the
                  column and swallow map drags either side of it. */}
              {plansOpen && (
                <div className="pointer-events-auto w-fit">
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
                    onClose={() => setPlansOpen(false)}
                  />
                </div>
              )}
            </div>

            {mapMode === 'plan' && activeSheet ? (
              <div
                style={
                  workspace
                    ? { height: '100%', width: '100%' }
                    : { height: isMobile ? 'min(520px, 60dvh)' : 520, width: '100%' }
                }
                data-testid="plan-mode-root"
              >
                <PlanModeCanvas
                  projectId={projectId}
                  sheet={activeSheet}
                  geometries={displayGeometries}
                  colorFor={colorForLot}
                  selectedLotId={selectedLot?.lotId ?? null}
                  onSelect={setSelectedLot}
                  onMapRef={setMap}
                  showZoom={!isMobile}
                >
                  {selectedLot && selectedGeometry && (
                    <LotPopup
                      geometry={selectedGeometry}
                      position={[selectedLot.latlng.lat, selectedLot.latlng.lng]}
                      onViewDetails={() => navigate(linkPaths.lot(selectedGeometry.lotId))}
                      onClose={() => setSelectedLot(null)}
                    />
                  )}
                </PlanModeCanvas>
              </div>
            ) : (
              <MapContainer
                ref={setMap}
                center={AU_DEFAULT_CENTER}
                zoom={AU_DEFAULT_ZOOM}
                scrollWheelZoom
                // The default +/- control is OFF everywhere: its top-left corner
                // sat exactly under the toolbar column (inset-x-3 spans both top
                // corners), covering the "+" on desktop and "Find by area" on a
                // phone. Desktop re-adds the control bottom-right below; mobile
                // pinches.
                zoomControl={false}
                // Mobile: cap at 60% of the (dynamic) viewport so toolbar + legend
                // fit without a fiddly inner scroll. Desktop keeps a fixed 520px.
                style={
                  // Workspace: the map takes every pixel its flex parent resolves.
                  // Embedded (foreman shell card): the shipped fixed-height strip.
                  workspace
                    ? { height: '100%', width: '100%' }
                    : { height: isMobile ? 'min(520px, 60dvh)' : 520, width: '100%' }
                }
              >
                {/* QA/RT-02. On mobile there is no Leaflet LayersControl at all.
                  Wherever it was cornered it lost: the CIVOS toolbar column is
                  `inset-x-3`, so it spans the full top strip and covers both top
                  corners — top-right sat under the "Past" tile, top-left under
                  "Area", and the tap never reached Leaflet. So the basemap
                  choice moves into the Layers sheet (a control the toolbar
                  cannot cover, because the toolbar opens it) and exactly one
                  TileLayer is rendered here, the same one the checked BaseLayer
                  drew. Desktop keeps the native control, untouched. */}
                {isMobile ? (
                  basemap === 'satellite' && satelliteAvailable ? (
                    satelliteTile
                  ) : (
                    streetTile
                  )
                ) : (
                  <LayersControl position="topright">
                    {satelliteAvailable && (
                      <LayersControl.BaseLayer checked name="Satellite">
                        {satelliteTile}
                      </LayersControl.BaseLayer>
                    )}
                    <LayersControl.BaseLayer checked={!satelliteAvailable} name="Street">
                      {streetTile}
                    </LayersControl.BaseLayer>
                  </LayersControl>
                )}

                {readyOrthos.map((ortho, index) => {
                  if (!orthoShown[ortho.id]) return null;
                  const [west, south, east, north] = ortho.boundsWgs84;
                  return (
                    <TileLayer
                      key={ortho.id}
                      url={orthoTileUrl(ortho)}
                      bounds={[
                        [south, west],
                        [north, east],
                      ]}
                      minZoom={ortho.minZoom}
                      maxZoom={ortho.maxZoom}
                      opacity={orthoOpacity[ortho.id] ?? 0.85}
                      zIndex={100 + index}
                      crossOrigin="anonymous"
                      eventHandlers={{ tileerror: handleTileError }}
                    />
                  );
                })}

                <ScaleControl position="bottomleft" imperial={false} />
                {!isMobile && <ZoomControl position="bottomright" />}
                <NorthArrow />

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

                <LotsGeoJsonLayer
                  geometries={displayGeometries}
                  colorFor={colorForLot}
                  selectedLotId={selectedLot?.lotId ?? null}
                  onSelect={setSelectedLot}
                />
                <LotLabelsLayer
                  lots={labelLots}
                  colorFor={colorForLot}
                  selectedLotId={selectedLot?.lotId ?? null}
                />
                {selectedLot && selectedGeometry && (
                  <LotPopup
                    geometry={selectedGeometry}
                    position={[selectedLot.latlng.lat, selectedLot.latlng.lng]}
                    onViewDetails={() => navigate(linkPaths.lot(selectedGeometry.lotId))}
                    onClose={() => setSelectedLot(null)}
                  />
                )}

                {/* `drawnPhotos` is already the located subset — the same array the
                  chooser counts, so "51 in view" can never disagree with what is
                  on the map. */}
                {drawnPhotos.map((photo) => {
                  const to = linkPaths.photo(photo);
                  return (
                    <PhotoPin
                      key={photo.id}
                      photo={photo}
                      onView={to ? () => navigate(to) : null}
                    />
                  );
                })}

                {/* C3 Phase B2. `readSamplePoint` returning null is the only gate:
                  no captured pair, no marker. There is no fallback position — a
                  centroid pin would assert a sample was taken in the middle of a
                  lot, which is a claim CIVOS never received `[C3S-B1]`, AT-84. */}
                {drawnTestPins.map((test) => {
                  const point = readSamplePoint(test);
                  if (!point) return null;
                  const to = linkPaths.test(test);
                  return (
                    <TestPin
                      key={test.id}
                      test={test}
                      point={point}
                      onView={to ? () => navigate(to) : null}
                    />
                  );
                })}

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
            )}

            <MapLegend
              statusCounts={statusCounts}
              testing={testingArmed && testCoverageLots.size > 0}
              testingCounts={testingCounts}
            />

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
            {testingArmed && !coverageArmed && !searchBounds && (
              <TestCoveragePanel
                lots={testCoverageQuery.data?.lots ?? []}
                lotsWithoutGeometry={testCoverageQuery.data?.lotsWithoutGeometry ?? 0}
                isLoading={testCoverageQuery.isLoading}
                error={testCoverageQuery.error}
                isMobile={isMobile}
                updatedAt={testCoverageQuery.dataUpdatedAt}
                isFetching={testCoverageQuery.isFetching}
                onOpenLot={(lotId) => navigate(linkPaths.lot(lotId))}
                onClear={toggleTesting}
                onRefresh={() => testCoverageQuery.refetch()}
              />
            )}
          </div>

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
