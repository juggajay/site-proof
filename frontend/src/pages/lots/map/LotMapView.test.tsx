import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi, afterEach, beforeAll, beforeEach } from 'vitest';

import type { ProjectControlLine, ProjectLotGeometry } from './lotMapData';

// jsdom cannot run real Leaflet — mock the react-leaflet primitives as
// passthrough elements so we can assert our own layer/popup/empty-state logic.
const fakeMap = {
  fitBounds: vi.fn(),
  getBounds: () => ({
    intersects: () => true,
    getWest: () => 151.0,
    getSouth: () => -33.81,
    getEast: () => 151.01,
    getNorth: () => -33.8,
  }),
  on: vi.fn(),
  off: vi.fn(),
  // AreaDrawLayer/DrawLotLayer swap the container's cursor and suspend map
  // dragging while armed, so a test that ARMS a tool needs both of these.
  getContainer: () => document.createElement('div'),
  dragging: { disable: vi.fn(), enable: vi.fn() },
};
// Captures the options passed to MapContainer (they are Leaflet OPTIONS, not
// DOM attributes — the mock must record them, never spread them onto the DOM).
const mapContainerProps = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
// Same capture pattern for TileLayer so tests can fire its tileerror handler.
const tileLayerProps = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
// `position` is a Leaflet control option, so it never reaches the DOM — record it.
const layersControlProps = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('react-leaflet', () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const RecordingLayersControl = ({ children, ...props }: { children?: React.ReactNode }) => {
    layersControlProps.current = props;
    // A testid so its ABSENCE on mobile is assertable — the recorded props
    // object survives across tests and cannot prove a non-render.
    return <div data-testid="layers-control">{children}</div>;
  };
  const LayersControl = Object.assign(RecordingLayersControl, { BaseLayer: Passthrough });
  return {
    MapContainer: ({ children, ...props }: { children?: React.ReactNode }) => {
      mapContainerProps.current = props;
      return <div data-testid="map-container">{children}</div>;
    },
    TileLayer: (props: Record<string, unknown>) => {
      tileLayerProps.current = props;
      // `data-url` is the only tell for WHICH basemap is mounted — the url is a
      // Leaflet option, so it never reaches the DOM on its own.
      return <div data-testid="tile-layer" data-url={String(props.url)} />;
    },
    ScaleControl: () => <div data-testid="scale-control" />,
    ZoomControl: (props: { position?: string }) => (
      <div data-testid="zoom-control" data-position={props.position} />
    ),
    ImageOverlay: () => <div data-testid="image-overlay" />,
    LayersControl,
    // `data-fill` exposes the resolved fill so the C3 `fillOverride` recolour is
    // assertable without a real Leaflet layer.
    Polygon: ({
      children,
      pathOptions,
    }: {
      children?: React.ReactNode;
      pathOptions?: { fillColor?: string };
    }) => (
      <div data-testid="polygon" data-fill={pathOptions?.fillColor}>
        {children}
      </div>
    ),
    Polyline: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="polyline">{children}</div>
    ),
    Circle: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="circle">{children}</div>
    ),
    CircleMarker: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="circle-marker">{children}</div>
    ),
    Marker: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="marker">{children}</div>
    ),
    Popup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    // The collapsed lots layer. The mock re-renders each feature as a div with
    // the SAME testids the per-lot components used ('polygon'/'polyline'/
    // 'circle-marker'), exposes the resolved fill, and wires click through the
    // layer-level eventHandlers exactly as Leaflet propagates it.
    GeoJSON: ({
      data,
      style,
      eventHandlers,
    }: {
      data?: { features?: GeoJSON.Feature[] };
      style?: (f: GeoJSON.Feature) => { fillColor?: string; color?: string };
      eventHandlers?: {
        click?: (e: {
          propagatedFrom: { feature: GeoJSON.Feature };
          latlng: { lat: number; lng: number };
        }) => void;
      };
    }) => (
      <div data-testid="lots-geojson">
        {(data?.features ?? []).map((f, i) => {
          const opts = style?.(f) ?? {};
          const type = f.geometry?.type;
          const kind =
            type === 'LineString' ? 'polyline' : type === 'Point' ? 'circle-marker' : 'polygon';
          const geom = f.geometry as {
            type: string;
            coordinates: number[] | number[][] | number[][][];
          };
          const first =
            type === 'Polygon'
              ? (geom.coordinates as number[][][])[0]?.[0]
              : type === 'LineString'
                ? (geom.coordinates as number[][])[0]
                : (geom.coordinates as number[]);
          const latlng = { lat: (first?.[1] as number) ?? 0, lng: (first?.[0] as number) ?? 0 };
          const props = f.properties as { lotId?: string } | undefined;
          return (
            <div
              key={props?.lotId ?? i}
              data-testid={kind}
              data-lot-id={props?.lotId}
              data-fill={opts.fillColor ?? opts.color}
              onClick={() => eventHandlers?.click?.({ propagatedFrom: { feature: f }, latlng })}
            />
          );
        })}
      </div>
    ),
    Tooltip: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Rectangle: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="rectangle">{children}</div>
    ),
    useMap: () => fakeMap,
    useMapEvents: () => fakeMap,
  };
});

// The labels layer drives imperative Leaflet markers (panes, container-point
// projection) that jsdom cannot host — stub it and assert the candidates fed in.
vi.mock('./LotLabelsLayer', () => ({
  LotLabelsLayer: ({ lots, selectedLotId }: { lots: unknown[]; selectedLotId: string | null }) => (
    <div data-testid="lot-labels" data-count={lots.length} data-selected={selectedLotId ?? ''} />
  ),
}));

// The plan canvas is a second real Leaflet map (CRS.Simple) — stub it and
// assert the props the workspace hands it.
vi.mock('./PlanModeCanvas', () => ({
  PlanModeCanvas: ({
    sheet,
    geometries,
    children,
  }: {
    sheet: { id: string };
    geometries: unknown[];
    children?: React.ReactNode;
  }) => (
    <div data-testid="plan-mode-canvas" data-sheet={sheet.id} data-count={geometries.length}>
      {children}
    </div>
  ),
}));

// usePlanSheets hits useQuery; the map renders without a QueryClientProvider, so
// stub it. DrawLotLayer/overlays only mount when armed/shown, so no leaflet.
const planSheetsQuery = { data: [] as unknown[] };
vi.mock('@/pages/projects/settings/planSheetsData', () => ({
  usePlanSheets: () => planSheetsQuery,
  fetchPlanSheet: vi.fn(),
}));

// createDrawnLotGeometry is exercised via its own path; the map only needs the
// invalidate on success. QueryClient is stubbed below. PlanModeBar's sheet
// detail query (registration confidence) resolves to "loading" in tests.
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useQuery: () => ({ data: undefined, isLoading: true, error: null }),
}));

const navigate = vi.fn();
const setSearchParamsMock = vi.hoisted(() => vi.fn());
const searchParamsValue = vi.hoisted(() => ({ current: new URLSearchParams() }));
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  useSearchParams: () => [searchParamsValue.current, setSearchParamsMock],
}));

// SecureDocumentImage does an authenticated fetch on mount — stub it so the
// photo-pin popups render a deterministic thumbnail with no network.
vi.mock('@/components/documents/SecureDocumentImage', () => ({
  SecureDocumentImage: ({ documentId, alt }: { documentId: string; alt?: string }) => (
    <img data-testid={`secure-img-${documentId}`} alt={alt} />
  ),
}));

// Capture toasts so the offline suppression of the tile-error toast is testable.
const toastMock = vi.hoisted(() => vi.fn());
vi.mock('@/components/ui/toaster', () => ({ toast: toastMock }));

// Force a deterministic viewport so jsdom doesn't need a matchMedia polyfill.
// Mutable so individual tests can exercise the mobile branch.
let isMobileValue = false;
vi.mock('@/hooks/useMediaQuery', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useMediaQuery')>();
  return { ...actual, useIsMobile: () => isMobileValue };
});

// The find-by-area mutation is exercised in its own tests; stub it here so
// LotMapView renders without a QueryClientProvider.
const spatialSearchMutation = {
  mutate: vi.fn(),
  reset: vi.fn(),
  data: undefined as import('./spatialSearchData').SpatialSearchResult | undefined,
  isLoading: false,
  error: null as unknown,
};
vi.mock('./spatialSearchData', () => ({
  useSpatialSearch: () => spatialSearchMutation,
}));

// Coverage query calls useQuery; stub it so LotMapView renders without a
// QueryClientProvider. The pure selectors stay real.
const coverageQuery = {
  data: undefined,
  isLoading: false,
  error: null,
  refetch: vi.fn(),
};
vi.mock('./coverageData', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./coverageData')>();
  return { ...actual, useProjectCoverage: () => coverageQuery };
});

// The status-timeline hook calls useQuery; stub it so LotMapView renders without
// a QueryClientProvider. The pure replay/date helpers stay real.
const timelineQuery = {
  data: undefined as import('./statusTimelineData').StatusTimeline | undefined,
  isLoading: false,
  error: null as unknown,
  refetch: vi.fn(),
};
vi.mock('./statusTimelineData', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./statusTimelineData')>();
  return { ...actual, useLotStatusTimeline: () => timelineQuery };
});

// C3 Phase A. The testing-overlay query calls useQuery; stub it. The pure
// palette/label helpers stay real so the colour assertions test the shipped map.
const testCoverageQuery = {
  data: undefined as import('./testCoverageData').TestCoverageResponse | undefined,
  isLoading: false,
  isFetching: false,
  error: null as unknown,
  dataUpdatedAt: 0,
  refetch: vi.fn(),
};
vi.mock('./testCoverageData', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./testCoverageData')>();
  return { ...actual, useTestCoverage: () => testCoverageQuery };
});

const useProjectLotGeometries = vi.fn();
const useProjectControlLines = vi.fn();
const backfillLotGeometries = vi.fn();
// Spread the real module so pure helpers (chainageLabel, …) keep working; only
// the data hooks are stubbed.
vi.mock('./lotMapData', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./lotMapData')>()),
  useProjectLotGeometries: (...args: unknown[]) => useProjectLotGeometries(...args),
  useProjectControlLines: (...args: unknown[]) => useProjectControlLines(...args),
  backfillLotGeometries: (...args: unknown[]) => backfillLotGeometries(...args),
}));

import { ApiError } from '@/lib/api';
import { readLocalStorageItem, writeLocalStorageItem } from '@/lib/storagePreferences';
import { LotMapView } from './LotMapView';

// Radix's DropdownMenu (the desktop Layers chooser) calls the Pointer Capture
// API and scrollIntoView, neither of which jsdom implements. Stubbing them is
// what lets the menu actually open in a test instead of throwing.
beforeAll(() => {
  const proto = window.HTMLElement.prototype as unknown as Record<string, unknown>;
  proto.hasPointerCapture ??= () => false;
  proto.setPointerCapture ??= () => {};
  proto.releasePointerCapture ??= () => {};
  proto.scrollIntoView ??= () => {};
});

/**
 * Open the Layers chooser and return its container. One helper for both
 * surfaces: Radix opens on pointerdown, the mobile sheet on a plain tap.
 */
async function openLayers(): Promise<HTMLElement> {
  // Toggling a pin layer leaves the chooser OPEN (arming two layers is one
  // errand), so re-entering must not close it.
  const already = screen.queryByTestId(isMobileValue ? 'map-layers-sheet' : 'map-layers-menu');
  if (already) return already;
  const trigger = screen.getByTestId('layers-button');
  if (isMobileValue) {
    fireEvent.click(trigger);
    return screen.findByTestId('map-layers-sheet');
  }
  // Enter on the trigger, not a synthetic pointerdown: jsdom has no PointerEvent
  // so Radix never sees a real button-0 press, and the keyboard path is the one
  // that has to work anyway.
  fireEvent.keyDown(trigger, { key: 'Enter' });
  return screen.findByTestId('map-layers-menu');
}

/** Toggle a pin layer through the chooser, the way a user reaches it. */
async function toggleLayer(id: 'photos' | 'testPins') {
  await openLayers();
  fireEvent.click(await screen.findByTestId(`map-layer-${id}`));
}

/**
 * A pin layer's armed state as a user reads it: `aria-checked` on its row, which
 * is the accessible state — not a colour, and not a class.
 */
async function expectLayerChecked(id: 'photos' | 'testPins', checked: boolean) {
  await openLayers();
  expect(await screen.findByTestId(`map-layer-${id}`)).toHaveAttribute(
    'aria-checked',
    String(checked),
  );
}

/** Open a panel through the chooser. */
async function openPanel(id: 'plans' | 'coverage' | 'testCoverage') {
  await openLayers();
  fireEvent.click(await screen.findByTestId(`map-panel-${id}`));
}

function polygonGeometry(over: Partial<ProjectLotGeometry> = {}): ProjectLotGeometry {
  return {
    id: 'geo-1',
    lotId: 'lot-1',
    lotNumber: 'LOT-001',
    status: 'in_progress',
    activityType: 'Earthworks',
    kind: 'chainage_offset',
    controlLineId: 'cl-1',
    geometryWgs84: {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [151.0, -33.8],
            [151.001, -33.8],
            [151.001, -33.801],
            [151.0, -33.8],
          ],
        ],
      },
    },
    areaM2: 1234.6,
    lengthM: 100,
    chainageStart: 0,
    chainageEnd: 100,
    ...over,
  };
}

const controlLine: ProjectControlLine = {
  id: 'cl-1',
  projectId: 'proj-1',
  name: 'MC00 Mainline',
  coordinateSystem: 'EPSG:7856',
  points: [
    { chainage: 0, easting: 334000, northing: 6252000 },
    { chainage: 1000, easting: 334000, northing: 6253000 },
  ],
  geometryWgs84: {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: [
        [151.0, -33.8],
        [151.01, -33.81],
      ],
    },
  },
};

function mockQueries({
  geometries = [] as ProjectLotGeometry[],
  controlLines = [] as ProjectControlLine[],
  isLoading = false,
  error = null as unknown,
  refetch = vi.fn(),
} = {}) {
  useProjectLotGeometries.mockReturnValue({ data: { geometries }, isLoading, error, refetch });
  useProjectControlLines.mockReturnValue({
    // Unwrapped array — the hook caches the same shape settings' useControlLines does.
    data: controlLines,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  });
  return { refetch };
}

function setNavigatorOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { value, configurable: true });
}

beforeEach(() => {
  vi.clearAllMocks();
  isMobileValue = false;
  setNavigatorOnline(true);
  planSheetsQuery.data = [];
  searchParamsValue.current = new URLSearchParams();
  // Stateful like the real router: a write is visible to the next render.
  setSearchParamsMock.mockImplementation((next: URLSearchParams) => {
    searchParamsValue.current = next;
  });
  timelineQuery.data = undefined;
  timelineQuery.isLoading = false;
  timelineQuery.error = null;
  // clearAllMocks does not reset a plain data property; the photo-pin tests set
  // it and it must not leak. Reset the persisted Photos toggle via the safe
  // storage helper (raw localStorage access is banned by a readiness guardrail).
  spatialSearchMutation.data = undefined;
  spatialSearchMutation.error = null;
  writeLocalStorageItem('siteproof.mapPhotos.proj-1', 'false');
  writeLocalStorageItem('siteproof.mapTests.proj-1', 'false');
  testCoverageQuery.data = undefined;
  testCoverageQuery.isLoading = false;
  testCoverageQuery.isFetching = false;
  testCoverageQuery.error = null;
  testCoverageQuery.dataUpdatedAt = 0;
});

describe('LotMapView', () => {
  it('renders a polygon for each filtered geometry and opens the popup on click', () => {
    mockQueries({ geometries: [polygonGeometry()], controlLines: [controlLine] });

    render(
      <LotMapView
        projectId="proj-1"
        filteredLotIds={new Set(['lot-1'])}
        canManageSettings={false}
      />,
    );

    expect(screen.getByTestId('map-container')).toBeInTheDocument();
    expect(screen.getByTestId('polygon')).toBeInTheDocument();

    // One selection-driven popup now, not one per lot: nothing until a click.
    expect(screen.queryByTestId('lot-popup-lot-1')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('polygon'));
    const popup = screen.getByTestId('lot-popup-lot-1');
    expect(within(popup).getByText('LOT-001')).toBeInTheDocument();
    // formatStatusLabel turns in_progress -> "In Progress"; the chainage range
    // is what locates a strip among dozens of identical ones (Wave 1 test-drive
    // feedback).
    expect(within(popup).getByText(/In Progress.*Ch 0–100/)).toBeInTheDocument();
    expect(screen.getByTestId('lot-popup-view-lot-1')).toBeInTheDocument();
  });

  it('renders a Directions link to the lot centroid for a lot with geometry', () => {
    mockQueries({ geometries: [polygonGeometry()] });
    render(
      <LotMapView
        projectId="proj-1"
        filteredLotIds={new Set(['lot-1'])}
        canManageSettings={false}
      />,
    );
    fireEvent.click(screen.getByTestId('polygon'));
    const link = screen.getByTestId('lot-popup-directions-lot-1');
    // Centroid of the fixture ring [[151,-33.8],[151.001,-33.8],[151.001,-33.801],[151,-33.8]]
    // is a degenerate/triangular ring; assert the Google Maps universal URL shape.
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    const href = link.getAttribute('href') ?? '';
    expect(href).toMatch(
      /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=-?\d+\.?\d*,-?\d+\.?\d*$/,
    );
  });

  it('omits the Directions link when the lot has no geometry to route to', () => {
    // An empty ring yields no renderable shape (and no centroid) -> no dead button.
    mockQueries({
      geometries: [
        polygonGeometry({
          geometryWgs84: {
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [[]] },
          },
        }),
      ],
    });
    render(
      <LotMapView
        projectId="proj-1"
        filteredLotIds={new Set(['lot-1'])}
        canManageSettings={false}
      />,
    );
    fireEvent.click(screen.getByTestId('polygon'));
    expect(screen.getByTestId('lot-popup-lot-1')).toBeInTheDocument();
    expect(screen.queryByTestId('lot-popup-directions-lot-1')).not.toBeInTheDocument();
  });

  it('navigates to the lot detail page from the popup', () => {
    mockQueries({ geometries: [polygonGeometry()] });
    render(
      <LotMapView
        projectId="proj-1"
        filteredLotIds={new Set(['lot-1'])}
        canManageSettings={false}
      />,
    );
    fireEvent.click(screen.getByTestId('polygon'));
    fireEvent.click(screen.getByTestId('lot-popup-view-lot-1'));
    expect(navigate).toHaveBeenCalledWith('/projects/proj-1/lots/lot-1');
  });

  it('routes popup View Details through linkTargets so the foreman shell never escapes to desktop', () => {
    mockQueries({ geometries: [polygonGeometry()] });
    render(
      <LotMapView
        projectId="proj-1"
        filteredLotIds={new Set(['lot-1'])}
        canManageSettings={false}
        linkTargets={{ lot: (lotId) => `/m/lots/${lotId}?projectId=proj-1` }}
      />,
    );
    fireEvent.click(screen.getByTestId('polygon'));
    fireEvent.click(screen.getByTestId('lot-popup-view-lot-1'));
    expect(navigate).toHaveBeenCalledWith('/m/lots/lot-1?projectId=proj-1');
  });

  it('excludes geometries whose lot is filtered out of the register', () => {
    mockQueries({ geometries: [polygonGeometry({ lotId: 'lot-1' })] });
    render(
      <LotMapView projectId="proj-1" filteredLotIds={new Set(['lot-999'])} canManageSettings />,
    );
    // filtered set has no matching lot but geometries exist -> "no lots match filter"
    expect(screen.getByTestId('lot-map-filtered-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('polygon')).not.toBeInTheDocument();
  });

  it('offers a backfill callout when there are control lines but no geometries and the user can manage settings', async () => {
    backfillLotGeometries.mockResolvedValue({ created: 3, skipped: [] });
    const { refetch } = mockQueries({ geometries: [], controlLines: [controlLine] });

    render(<LotMapView projectId="proj-1" filteredLotIds={new Set()} canManageSettings />);

    expect(screen.getByTestId('lot-map-empty')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('backfill-run'));

    await waitFor(() => {
      expect(backfillLotGeometries).toHaveBeenCalledWith('proj-1', 'cl-1', {
        offsetLeft: 6,
        offsetRight: 6,
      });
    });
    await waitFor(() => expect(refetch).toHaveBeenCalled());
    expect(screen.getByText(/Generated 3 lot geometries/)).toBeInTheDocument();
  });

  it('points to project settings when there are no control lines', () => {
    mockQueries({ geometries: [], controlLines: [] });
    render(<LotMapView projectId="proj-1" filteredLotIds={new Set()} canManageSettings />);
    const link = screen.getByRole('link', { name: /Project Settings/i });
    expect(link).toHaveAttribute('href', '/projects/proj-1/settings');
    expect(screen.queryByTestId('backfill-run')).not.toBeInTheDocument();
  });

  it('opens the Plans panel from the Layers chooser and shows the no-registered-sheets hint', async () => {
    mockQueries({ geometries: [polygonGeometry()], controlLines: [controlLine] });
    render(
      <LotMapView
        projectId="proj-1"
        filteredLotIds={new Set(['lot-1'])}
        canManageSettings={false}
      />,
    );

    expect(screen.queryByTestId('plans-panel')).not.toBeInTheDocument();
    await openPanel('plans');
    const panel = await screen.findByTestId('plans-panel');
    expect(within(panel).getByText(/No registered plan sheets yet/i)).toBeInTheDocument();
    // DG-4b. Opened from a chooser that closed behind it, the panel has to carry
    // its own way out — there is no toolbar toggle to press again.
    fireEvent.click(within(panel).getByTestId('plans-close'));
    expect(screen.queryByTestId('plans-panel')).not.toBeInTheDocument();
  });

  it('shows the Draw lot button only when the user can manage settings', () => {
    mockQueries({ geometries: [polygonGeometry()] });
    const { rerender } = render(
      <LotMapView
        projectId="proj-1"
        filteredLotIds={new Set(['lot-1'])}
        canManageSettings={false}
      />,
    );
    expect(screen.queryByTestId('draw-lot-button')).not.toBeInTheDocument();

    rerender(
      <LotMapView projectId="proj-1" filteredLotIds={new Set(['lot-1'])} canManageSettings />,
    );
    expect(screen.getByTestId('draw-lot-button')).toBeInTheDocument();
  });

  it('toggles History mode, showing the scrubber panel and pressing the button', () => {
    mockQueries({ geometries: [polygonGeometry()], controlLines: [controlLine] });
    render(
      <LotMapView
        projectId="proj-1"
        filteredLotIds={new Set(['lot-1'])}
        canManageSettings={false}
      />,
    );

    expect(screen.queryByTestId('history-panel')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('history-button'));
    expect(screen.getByTestId('history-button')).toHaveAttribute('aria-pressed', 'true');
    // No timeline data yet -> empty-history hint.
    expect(
      within(screen.getByTestId('history-panel')).getByText(/No recorded history/i),
    ).toBeInTheDocument();
  });

  it('entering History closes the Plans panel (mutually exclusive tools)', async () => {
    mockQueries({ geometries: [polygonGeometry()], controlLines: [controlLine] });
    render(
      <LotMapView
        projectId="proj-1"
        filteredLotIds={new Set(['lot-1'])}
        canManageSettings={false}
      />,
    );
    await openPanel('plans');
    expect(await screen.findByTestId('plans-panel')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('history-button'));
    expect(screen.queryByTestId('plans-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('history-panel')).toBeInTheDocument();
  });

  it('renders the date slider once the timeline has loaded', () => {
    timelineQuery.data = {
      earliest: '2026-01-10T00:00:00.000Z',
      lots: [
        {
          lotId: 'lot-1',
          createdAt: '2026-01-10T00:00:00.000Z',
          currentStatus: 'in_progress',
          events: [],
        },
      ],
    };
    mockQueries({ geometries: [polygonGeometry()], controlLines: [controlLine] });
    render(
      <LotMapView
        projectId="proj-1"
        filteredLotIds={new Set(['lot-1'])}
        canManageSettings={false}
      />,
    );
    fireEvent.click(screen.getByTestId('history-button'));
    expect(screen.getByTestId('history-slider')).toBeInTheDocument();
    expect(screen.getByTestId('history-date')).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------
  // Wave C3 Phase A — the tested/under-tested overlay.
  // ---------------------------------------------------------------------

  function renderWithTesting() {
    mockQueries({ geometries: [polygonGeometry()], controlLines: [controlLine] });
    render(
      <LotMapView
        projectId="proj-1"
        filteredLotIds={new Set(['lot-1'])}
        canManageSettings={false}
      />,
    );
  }

  it('recolours a lot from its status fill to its testing verdict when armed', async () => {
    // in_progress -> #56B4E9 on the status palette; insufficient -> #E69F00.
    testCoverageQuery.data = {
      lots: [{ lotId: 'lot-1', state: 'insufficient', lotNumber: 'LOT-001', rules: [] }],
      lotsWithoutGeometry: 0,
    };
    renderWithTesting();

    expect(screen.getByTestId('polygon')).toHaveAttribute('data-fill', '#56B4E9');
    await openPanel('testCoverage');
    expect(screen.getByTestId('polygon')).toHaveAttribute('data-fill', '#E69F00');
    expect(screen.getByTestId('testing-legend')).toBeInTheDocument();
    expect(screen.getByTestId('test-coverage-panel')).toBeInTheDocument();
  });

  it('AT-86 an in-flight or failed fetch keeps STATUS colours — never grey', async () => {
    // Grey is the `unknown` VERDICT. Painting it while the answer is unknown to
    // the CLIENT would be CIVOS asserting it has no rule when it has no answer.
    testCoverageQuery.isLoading = true;
    renderWithTesting();
    await openPanel('testCoverage');
    expect(screen.getByTestId('polygon')).toHaveAttribute('data-fill', '#56B4E9');

    testCoverageQuery.isLoading = false;
    testCoverageQuery.error = new ApiError(500, 'boom');
    fireEvent.click(screen.getByTestId('test-coverage-clear')); // off
    await openPanel('testCoverage'); // on again, now errored
    expect(screen.getByTestId('polygon')).toHaveAttribute('data-fill', '#56B4E9');
    expect(screen.getByTestId('test-coverage-error')).toBeInTheDocument();
  });

  it('AT-95 Past view disarms Test coverage and withdraws its row, saying why', async () => {
    testCoverageQuery.data = {
      lots: [{ lotId: 'lot-1', state: 'satisfied' }],
      lotsWithoutGeometry: 0,
    };
    renderWithTesting();

    await openPanel('testCoverage');
    expect(screen.getByTestId('polygon')).toHaveAttribute('data-fill', '#009E73');

    fireEvent.click(screen.getByTestId('history-button'));
    // Disarmed, its panel gone, and the map back on the historical STATUS
    // colours — one date in the picture, not two.
    expect(screen.queryByTestId('test-coverage-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('polygon')).toHaveAttribute('data-fill', '#56B4E9');
    expect(screen.getByTestId('history-panel')).toBeInTheDocument();

    // DG-4b: the row is withdrawn from the chooser, and the chooser SAYS so
    // rather than silently dropping it — a missing row otherwise reads as a
    // missing feature.
    const menu = await openLayers();
    expect(within(menu).queryByTestId('map-panel-testCoverage')).not.toBeInTheDocument();
    expect(within(menu).queryByTestId('map-panel-coverage')).not.toBeInTheDocument();
    expect(within(menu).getByTestId('map-layers-live-only')).toHaveTextContent(
      /Test pins, Coverage and Test coverage are live-only/i,
    );
    fireEvent.keyDown(menu, { key: 'Escape' });

    // Leaving Past view restores the row, still disarmed (never re-armed for you).
    fireEvent.click(screen.getByTestId('history-button'));
    const live = await openLayers();
    expect(within(live).getByTestId('map-panel-testCoverage')).toBeInTheDocument();
    expect(screen.queryByTestId('test-coverage-panel')).not.toBeInTheDocument();
  });

  it('shows an access-denied message on a 403', () => {
    mockQueries({ error: new ApiError(403, 'Forbidden') });
    render(<LotMapView projectId="proj-1" filteredLotIds={new Set()} canManageSettings={false} />);
    expect(screen.getByText(/do not have access/i)).toBeInTheDocument();
  });

  it('DG-4b every mobile control is a CAPTIONED tile — no unlabelled icon', () => {
    isMobileValue = true;
    mockQueries({ geometries: [polygonGeometry()], controlLines: [controlLine] });
    render(<LotMapView projectId="proj-1" filteredLotIds={new Set(['lot-1'])} canManageSettings />);

    // The caption is the point: a bare icon on a jobsite is a guess. The short
    // caption is visible; the full accessible name is unchanged.
    const findButton = screen.getByTestId('find-by-area-button');
    expect(findButton).toHaveAttribute('aria-label', 'Find by area');
    expect(within(findButton).getByText('Area')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'My location' })).toBeInTheDocument();
    expect(within(screen.getByTestId('locate-me-button')).getByText('Locate')).toBeInTheDocument();

    // Armed, the control says how to get OUT of the mode it just entered.
    fireEvent.click(findButton);
    expect(
      within(screen.getByTestId('find-by-area-button')).getByText('Cancel'),
    ).toBeInTheDocument();
  });

  it('uses touch wording for the draw-lot hint on mobile', () => {
    isMobileValue = true;
    mockQueries({ geometries: [polygonGeometry()], controlLines: [controlLine] });
    render(<LotMapView projectId="proj-1" filteredLotIds={new Set(['lot-1'])} canManageSettings />);

    fireEvent.click(screen.getByTestId('draw-lot-button'));
    expect(
      screen.getByText(/Tap to place polygon corners; double-tap to finish/i),
    ).toBeInTheDocument();
  });

  it('drops the +/- zoom control on mobile (pinch zooms; the control hid the first toolbar button)', () => {
    isMobileValue = true;
    mockQueries({ geometries: [polygonGeometry()], controlLines: [controlLine] });
    render(<LotMapView projectId="proj-1" filteredLotIds={new Set(['lot-1'])} canManageSettings />);
    expect(mapContainerProps.current.zoomControl).toBe(false);
    expect(screen.queryByTestId('zoom-control')).not.toBeInTheDocument();
  });

  it('desktop: the +/- control lives bottom-right, out from under the toolbar column', () => {
    mockQueries({ geometries: [polygonGeometry()], controlLines: [controlLine] });
    render(<LotMapView projectId="proj-1" filteredLotIds={new Set(['lot-1'])} canManageSettings />);
    // The default top-left control is off (the toolbar spans both top corners);
    // an explicit control is re-added clear of it.
    expect(mapContainerProps.current.zoomControl).toBe(false);
    expect(screen.getByTestId('zoom-control')).toHaveAttribute('data-position', 'bottomright');
  });

  it('isolates the map stacking context so leaflet z-indexes cannot paint over app chrome', () => {
    mockQueries({ geometries: [polygonGeometry()], controlLines: [controlLine] });
    render(<LotMapView projectId="proj-1" filteredLotIds={new Set(['lot-1'])} canManageSettings />);
    // The wrapper's `isolate` keeps the internal z-400–1000 (leaflet panes,
    // toolbar) below fixed z-50 page UI like OfflineIndicator and dialog
    // overlays. Removing it re-breaks the offline pill on the map page.
    expect(screen.getByTestId('lot-map-stacking-root')).toHaveClass('isolate');
  });

  // ── QA-02. The toolbar has to WIN the hit-test against Leaflet's own controls.
  // jsdom cannot hit-test, so these lock the CSS/option contract that decides it;
  // only a real-viewport Playwright tap proves the tap itself.
  it('stacks the toolbar column above leaflet control containers (z-index 1000)', () => {
    mockQueries({ geometries: [polygonGeometry()], controlLines: [controlLine] });
    render(<LotMapView projectId="proj-1" filteredLotIds={new Set(['lot-1'])} canManageSettings />);
    // At an exact z-1000 tie Leaflet wins on DOM order and eats taps meant for
    // the rightmost tile ("Past").
    expect(screen.getByTestId('lot-map-toolbar-column')).toHaveClass('z-[1001]');
  });

  it('keeps the leaflet layers control at the top-right on desktop', () => {
    mockQueries({ geometries: [polygonGeometry()], controlLines: [controlLine] });
    render(<LotMapView projectId="proj-1" filteredLotIds={new Set(['lot-1'])} canManageSettings />);
    expect(screen.getByTestId('layers-control')).toBeInTheDocument();
    expect(layersControlProps.current.position).toBe('topright');
  });

  it('suppresses the tile-error toast while offline (the global OfflineIndicator pill covers it)', () => {
    setNavigatorOnline(false);
    mockQueries({ geometries: [polygonGeometry()], controlLines: [controlLine] });
    render(<LotMapView projectId="proj-1" filteredLotIds={new Set(['lot-1'])} canManageSettings />);
    const handlers = tileLayerProps.current.eventHandlers as { tileerror: () => void };
    handlers.tileerror();
    expect(toastMock).not.toHaveBeenCalled();
  });

  it('still toasts on tile errors while online', () => {
    mockQueries({ geometries: [polygonGeometry()], controlLines: [controlLine] });
    render(<LotMapView projectId="proj-1" filteredLotIds={new Set(['lot-1'])} canManageSettings />);
    const handlers = tileLayerProps.current.eventHandlers as { tileerror: () => void };
    handlers.tileerror();
    handlers.tileerror();
    expect(toastMock).toHaveBeenCalledTimes(1);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Map imagery failed to load' }),
    );
  });

  // ── QA/RT-02: the basemap picker ──────────────────────────────────────────
  //
  // On a 390px phone the CIVOS toolbar column is `inset-x-3` — it spans the whole
  // top strip, so Leaflet's native basemap switcher was covered in EVERY top
  // corner (top-right by "Past", then top-left by "Area" after PR #1744 moved
  // it). Relocating corners is whack-a-mole, so mobile drops the control and the
  // Layers sheet owns the choice. jsdom cannot hit-test; these lock the contract
  // that a real-viewport tap then proves.
  describe('Basemap picker', () => {
    const SATELLITE = /api\.maptiler\.com/;
    const STREET = /tile\.openstreetmap\.org/;

    function renderMap() {
      mockQueries({ geometries: [polygonGeometry()], controlLines: [controlLine] });
      render(
        <LotMapView
          projectId="proj-1"
          filteredLotIds={new Set(['lot-1'])}
          canManageSettings={false}
        />,
      );
    }

    /** Every basemap tile layer currently mounted, by url. */
    function mountedTileUrls(): string[] {
      return screen.getAllByTestId('tile-layer').map((el) => el.getAttribute('data-url') ?? '');
    }

    beforeEach(() => {
      vi.stubEnv('VITE_MAPTILER_KEY', 'test-maptiler-key');
    });
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('mobile: no leaflet layers control at all, and exactly one basemap tile', () => {
      isMobileValue = true;
      renderMap();

      // The whole point: nothing for the toolbar to cover, in any corner.
      expect(screen.queryByTestId('layers-control')).not.toBeInTheDocument();
      const urls = mountedTileUrls();
      expect(urls).toHaveLength(1);
      // Same default the checked BaseLayer had — satellite when a key exists.
      expect(urls[0]).toMatch(SATELLITE);
    });

    it('mobile: the Layers sheet offers the basemap as a radio choice with the active one marked', async () => {
      isMobileValue = true;
      renderMap();

      const sheet = await openLayers();
      const satellite = within(sheet).getByTestId('map-basemap-satellite');
      const street = within(sheet).getByTestId('map-basemap-street');
      // Radios, not ticks: exactly one basemap is drawn, so a checkbox would lie.
      expect(satellite).toHaveAttribute('role', 'menuitemradio');
      expect(satellite).toHaveAttribute('aria-checked', 'true');
      expect(street).toHaveAttribute('aria-checked', 'false');
      // Captioned and thumb-sized, like every other row on this sheet.
      expect(satellite).toHaveTextContent('Satellite');
      expect(street).toHaveTextContent('Street');
      expect(street.className).toMatch(/min-h-\[56px\]/);
      expect(street.className).toMatch(/\bw-full\b/);
    });

    it('mobile: choosing Street swaps the single tile layer and re-arms the tile-error toast', async () => {
      isMobileValue = true;
      renderMap();

      // Arm the one-shot tile-error toast against the satellite layer.
      (tileLayerProps.current.eventHandlers as { tileerror: () => void }).tileerror();
      expect(toastMock).toHaveBeenCalledTimes(1);

      fireEvent.click(within(await openLayers()).getByTestId('map-basemap-street'));

      const urls = mountedTileUrls();
      expect(urls).toHaveLength(1);
      expect(urls[0]).toMatch(STREET);
      expect(within(await openLayers()).getByTestId('map-basemap-street')).toHaveAttribute(
        'aria-checked',
        'true',
      );

      // The toast re-arms for the newly drawn layer — all the `baselayerchange`
      // listener ever did, now that there is no LayersControl to fire it.
      (tileLayerProps.current.eventHandlers as { tileerror: () => void }).tileerror();
      expect(toastMock).toHaveBeenCalledTimes(2);
    });

    it('mobile: with no MapTiler key there is one basemap, so no choice is offered', async () => {
      vi.stubEnv('VITE_MAPTILER_KEY', '');
      isMobileValue = true;
      renderMap();

      const urls = mountedTileUrls();
      expect(urls).toHaveLength(1);
      expect(urls[0]).toMatch(STREET);

      const sheet = await openLayers();
      expect(within(sheet).queryByTestId('map-basemap-section')).not.toBeInTheDocument();
      // The pin rows are untouched — the sheet did not lose its other sections.
      expect(within(sheet).getByTestId('map-layer-photos')).toBeInTheDocument();
    });

    it('desktop: the native control still holds both base layers at the top-right, and the sheet adds nothing', async () => {
      renderMap();

      expect(screen.getByTestId('layers-control')).toBeInTheDocument();
      expect(layersControlProps.current.position).toBe('topright');
      // Both BaseLayers mount their tile layer in the mock; Leaflet shows the
      // checked one. Unchanged from what shipped.
      const urls = mountedTileUrls();
      expect(urls).toHaveLength(2);
      expect(urls.some((u) => SATELLITE.test(u))).toBe(true);
      expect(urls.some((u) => STREET.test(u))).toBe(true);

      // Desktop's dropdown deliberately does NOT duplicate the native control.
      const menu = await openLayers();
      expect(within(menu).queryByTestId('map-basemap-section')).not.toBeInTheDocument();
      expect(within(menu).queryByTestId('map-basemap-satellite')).not.toBeInTheDocument();
    });
  });

  describe('Photos layer', () => {
    function setPhotos(photos: import('./spatialSearchData').SpatialPhoto[]) {
      spatialSearchMutation.data = {
        lots: [],
        lotsTruncated: false,
        photos,
        photosTruncated: false,
        testResults: [],
        testResultsTruncated: false,
      };
    }
    const photo = (
      over: Partial<import('./spatialSearchData').SpatialPhoto> = {},
    ): import('./spatialSearchData').SpatialPhoto => ({
      id: 'photo-1',
      filename: 'IMG_1.jpg',
      caption: 'Footing rebar',
      captureTimestamp: null,
      lotId: 'lot-1',
      gpsLatitude: -33.8,
      gpsLongitude: 151.0,
      ...over,
    });

    it('renders pins only for photos with coords once the Photos layer is on', async () => {
      setPhotos([photo(), photo({ id: 'photo-2', gpsLatitude: null, gpsLongitude: null })]);
      mockQueries({ geometries: [polygonGeometry()] });
      render(
        <LotMapView
          projectId="proj-1"
          filteredLotIds={new Set(['lot-1'])}
          canManageSettings={false}
        />,
      );

      // Off by default — no pins.
      expect(screen.queryByTestId('photo-pin-photo-1')).not.toBeInTheDocument();

      await toggleLayer('photos');
      await expectLayerChecked('photos', true);
      expect(screen.getByTestId('photo-pin-photo-1')).toBeInTheDocument();
      // The null-coord photo is skipped.
      expect(screen.queryByTestId('photo-pin-photo-2')).not.toBeInTheDocument();
    });

    it('routes a pin View through linkTargets so the foreman shell stays under /m', async () => {
      setPhotos([photo()]);
      mockQueries({ geometries: [polygonGeometry()] });
      render(
        <LotMapView
          projectId="proj-1"
          filteredLotIds={new Set(['lot-1'])}
          canManageSettings={false}
          linkTargets={{ lot: (lotId) => `/m/lots/${lotId}?projectId=proj-1` }}
        />,
      );
      await toggleLayer('photos');
      fireEvent.click(screen.getByTestId('photo-pin-view-photo-1'));
      expect(navigate).toHaveBeenCalledWith('/m/lots/lot-1?projectId=proj-1');
    });

    it('renders an unlinked pin (no View) when the shell photo has no lot destination', async () => {
      setPhotos([photo({ lotId: null })]);
      mockQueries({ geometries: [polygonGeometry()] });
      render(
        <LotMapView
          projectId="proj-1"
          filteredLotIds={new Set(['lot-1'])}
          canManageSettings={false}
          linkTargets={{ lot: (lotId) => `/m/lots/${lotId}?projectId=proj-1` }}
        />,
      );
      await toggleLayer('photos');
      expect(screen.getByTestId('photo-pin-photo-1')).toBeInTheDocument();
      expect(screen.queryByTestId('photo-pin-view-photo-1')).not.toBeInTheDocument();
    });

    it('AT-94 an armed marker layer whose fetch failed says so instead of showing an empty map', async () => {
      setPhotos([]);
      spatialSearchMutation.error = new ApiError(0, 'offline');
      mockQueries({ geometries: [polygonGeometry()] });
      render(
        <LotMapView
          projectId="proj-1"
          filteredLotIds={new Set(['lot-1'])}
          canManageSettings={false}
        />,
      );
      expect(screen.queryByTestId('map-pin-layers-unavailable')).not.toBeInTheDocument();

      await toggleLayer('photos');
      await toggleLayer('testPins');
      // Named, not silent: `spatial-search` is a POST and deliberately uncached
      // (AT-94 `[C3S-d]`), so offline there is nothing to show — and a blank map
      // reads as "no tests here", which is a different and false statement.
      expect(screen.getByTestId('map-pin-layers-unavailable')).toHaveTextContent(
        /Photos and Test pins are unavailable/i,
      );
      spatialSearchMutation.error = null;
    });

    it('persists the Photos toggle per project', async () => {
      mockQueries({ geometries: [polygonGeometry()] });
      const { unmount } = render(
        <LotMapView
          projectId="proj-1"
          filteredLotIds={new Set(['lot-1'])}
          canManageSettings={false}
        />,
      );
      await expectLayerChecked('photos', false);
      await toggleLayer('photos');
      expect(readLocalStorageItem('siteproof.mapPhotos.proj-1')).toBe('true');

      // A fresh mount reads the persisted preference back as on.
      unmount();
      render(
        <LotMapView
          projectId="proj-1"
          filteredLotIds={new Set(['lot-1'])}
          canManageSettings={false}
        />,
      );
      await expectLayerChecked('photos', true);
    });
  });

  // ── C3 Phase B2: test pins ────────────────────────────────────────────────
  describe('Test pins layer', () => {
    type SpatialTest = import('./spatialSearchData').SpatialTestResult;

    function setTests(testResults: SpatialTest[]) {
      spatialSearchMutation.data = {
        lots: [],
        lotsTruncated: false,
        photos: [],
        photosTruncated: false,
        testResults,
        testResultsTruncated: false,
      };
    }
    const located = (over: Partial<SpatialTest> = {}): SpatialTest => ({
      id: 'tr-1',
      status: 'verified',
      passFail: 'pass',
      lotId: 'lot-1',
      lotNumber: 'LOT-001',
      testType: 'Density Ratio',
      testRequestNumber: 'TR-1',
      sampleLatitude: -33.8005,
      sampleLongitude: 151.0005,
      sampleLocationSource: 'gps',
      sampleLocationAccuracyM: 6.2,
      ...over,
    });

    function renderMap(linkTargets?: { lot: (lotId: string) => string }) {
      mockQueries({ geometries: [polygonGeometry()] });
      render(
        <LotMapView
          projectId="proj-1"
          filteredLotIds={new Set(['lot-1'])}
          canManageSettings={false}
          linkTargets={linkTargets}
        />,
      );
    }

    it('renders a pin with provenance and accuracy once the layer is on', async () => {
      setTests([located()]);
      renderMap();

      // Default off.
      expect(screen.queryByTestId('test-pin-tr-1')).not.toBeInTheDocument();

      await toggleLayer('testPins');
      await expectLayerChecked('testPins', true);
      const pin = screen.getByTestId('test-pin-tr-1');
      expect(pin).toHaveTextContent('Density Ratio');
      expect(pin).toHaveTextContent('Verified');
      expect(pin).toHaveTextContent('Pass');
      // `[C3R-A5]` a pin whose accuracy is unstated invites more trust than it earns.
      expect(screen.getByTestId('test-pin-point-tr-1')).toHaveTextContent(
        '-33.800500, 151.000500 · GPS ±6 m',
      );
    });

    it('says "Picked on map" and no radius for a map pick', async () => {
      setTests([located({ sampleLocationSource: 'map_pick', sampleLocationAccuracyM: null })]);
      renderMap();
      await toggleLayer('testPins');
      expect(screen.getByTestId('test-pin-point-tr-1')).toHaveTextContent('Picked on map');
      expect(screen.getByTestId('test-pin-point-tr-1')).not.toHaveTextContent('±');
    });

    it('AT-84 an unlocated test is never drawn — no centroid, no text-derived pin', async () => {
      // The lot HAS a polygon (so a centroid was available) and the test HAS free
      // text a parser could have read a chainage out of. Neither may become a
      // marker `[C3S-B1]`. A third row carries half a coordinate — also not a
      // location. This test is the guard: add a fallback and it fails.
      setTests([
        located({
          id: 'tr-unlocated',
          sampleLatitude: null,
          sampleLongitude: null,
          sampleLocationSource: null,
          sampleLocationAccuracyM: null,
        }),
        located({ id: 'tr-half', sampleLongitude: null }),
      ]);
      renderMap();
      await toggleLayer('testPins');

      expect(screen.queryByTestId('test-pin-tr-unlocated')).not.toBeInTheDocument();
      expect(screen.queryByTestId('test-pin-tr-half')).not.toBeInTheDocument();
      expect(screen.queryByTestId('marker')).not.toBeInTheDocument();
    });

    it('routes a pin View through linkTargets so the foreman shell stays under /m', async () => {
      setTests([located()]);
      renderMap({ lot: (lotId) => `/m/lots/${lotId}?projectId=proj-1` });
      await toggleLayer('testPins');
      fireEvent.click(screen.getByTestId('test-pin-view-tr-1'));
      expect(navigate).toHaveBeenCalledWith('/m/lots/lot-1?projectId=proj-1');
    });

    it('renders an unlinked pin (no View) when the shell test has no lot destination', async () => {
      setTests([located({ lotId: null, lotNumber: null })]);
      renderMap({ lot: (lotId) => `/m/lots/${lotId}?projectId=proj-1` });
      await toggleLayer('testPins');
      expect(screen.getByTestId('test-pin-tr-1')).toBeInTheDocument();
      expect(screen.queryByTestId('test-pin-view-tr-1')).not.toBeInTheDocument();
    });

    it('persists the Test pins toggle per project', async () => {
      setTests([located()]);
      const { unmount } = render(
        <LotMapView
          projectId="proj-1"
          filteredLotIds={new Set(['lot-1'])}
          canManageSettings={false}
        />,
      );
      mockQueries({ geometries: [polygonGeometry()] });
      await toggleLayer('testPins');
      expect(readLocalStorageItem('siteproof.mapTests.proj-1')).toBe('true');

      unmount();
      mockQueries({ geometries: [polygonGeometry()] });
      render(
        <LotMapView
          projectId="proj-1"
          filteredLotIds={new Set(['lot-1'])}
          canManageSettings={false}
        />,
      );
      await expectLayerChecked('testPins', true);
    });

    it('AT-95 Past view disarms the pin layer and withdraws its row from the chooser', async () => {
      setTests([located()]);
      testCoverageQuery.data = {
        lots: [{ lotId: 'lot-1', state: 'satisfied' }],
        lotsWithoutGeometry: 0,
      };
      renderMap();

      // Both C3 layers armed at once.
      await openPanel('testCoverage');
      await toggleLayer('testPins');
      expect(screen.getByTestId('test-pin-tr-1')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('history-button'));
      // `[C3R-B5]` today's captures have no place on a map showing a past date.
      expect(screen.queryByTestId('test-pin-tr-1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('test-coverage-panel')).not.toBeInTheDocument();

      const past = await openLayers();
      expect(within(past).queryByTestId('map-layer-testPins')).not.toBeInTheDocument();
      // Photo pins are NOT live-only, so that row survives — the withdrawal is a
      // rule about the data, not a blanket "menu is smaller in Past view".
      expect(within(past).getByTestId('map-layer-photos')).toBeInTheDocument();
      expect(within(past).getByTestId('map-layers-live-only')).toHaveTextContent(/live-only/i);
      fireEvent.keyDown(past, { key: 'Escape' });

      // Leaving Past view restores the row, still disarmed — never re-armed for you.
      fireEvent.click(screen.getByTestId('history-button'));
      await expectLayerChecked('testPins', false);
    });

    /**
     * DG-4b, replacing `[C3R-A10]`. jsdom has no layout, so this asserts the
     * rule that DECIDES the 390px outcome rather than measuring it: every tile
     * is `flex-1` between a 48px floor and a 56px ceiling, so N tiles share one
     * row instead of wrapping, scrolling, or hiding. Six tiles (foreman) land at
     * 56px; seven (canManageSettings) at 48px. Break the rule and this fails.
     */
    it('DG-4b tiles share one row at phone width, and Draw lot is the only role difference', () => {
      isMobileValue = true;
      setTests([located()]);
      testCoverageQuery.data = { lots: [], lotsWithoutGeometry: 0 };
      mockQueries({ geometries: [polygonGeometry()] });
      const { rerender } = render(
        <LotMapView
          projectId="proj-1"
          filteredLotIds={new Set(['lot-1'])}
          canManageSettings={false}
        />,
      );

      // Foreman: six captioned tiles, no Draw lot.
      const foremanTiles = [
        'find-by-area-button',
        'locate-me-button',
        'photos-button',
        'layers-button',
        'snapshot-button',
        'history-button',
      ];
      for (const id of foremanTiles) {
        const tile = screen.getByTestId(id);
        expect(tile).toHaveAttribute('aria-label');
        // The one rule: share the row, never below 48px, never above 56px.
        expect(tile.className).toMatch(/\bflex-1\b/);
        expect(tile.className).toMatch(/\bmin-w-12\b/);
        expect(tile.className).toMatch(/\bmax-w-14\b/);
        // A caption, always — no unlabelled icon at any width.
        expect(tile.textContent?.trim()).not.toBe('');
      }
      expect(screen.queryByTestId('draw-lot-button')).not.toBeInTheDocument();
      expect(screen.getByTestId('lot-map-toolbar').className).not.toMatch(/flex-wrap/);

      // canManageSettings: the same row, one tile longer.
      rerender(
        <LotMapView projectId="proj-1" filteredLotIds={new Set(['lot-1'])} canManageSettings />,
      );
      const drawLot = screen.getByTestId('draw-lot-button');
      expect(drawLot.className).toMatch(/\bflex-1\b/);
      expect(drawLot).toHaveAttribute('aria-label', 'Draw lot');
      expect(within(drawLot).getByText('Draw lot')).toBeInTheDocument();
      // Armed, the tile says how to get out — caption short, accessible name full.
      fireEvent.click(drawLot);
      const armed = screen.getByTestId('draw-lot-button');
      expect(armed).toHaveAttribute('aria-label', 'Cancel draw');
      expect(within(armed).getByText('Cancel')).toBeInTheDocument();

      expect(mapContainerProps.current.style).toMatchObject({ height: 'min(520px, 60dvh)' });
    });
  });

  // ── DG-4b: the Layers chooser ─────────────────────────────────────────────
  describe('Layers chooser', () => {
    function renderMap(over: { canManageSettings?: boolean } = {}) {
      mockQueries({ geometries: [polygonGeometry()] });
      render(
        <LotMapView
          projectId="proj-1"
          filteredLotIds={new Set(['lot-1'])}
          canManageSettings={over.canManageSettings ?? false}
        />,
      );
    }

    function setPins({
      photos = [] as import('./spatialSearchData').SpatialPhoto[],
      photosTruncated = false,
      testResultsTruncated = false,
    }) {
      spatialSearchMutation.data = {
        lots: [],
        lotsTruncated: false,
        photos,
        photosTruncated,
        testResults: [],
        testResultsTruncated,
      };
    }

    const photo = (id: string): import('./spatialSearchData').SpatialPhoto => ({
      id,
      filename: `${id}.jpg`,
      caption: null,
      captureTimestamp: null,
      lotId: 'lot-1',
      gpsLatitude: -33.8,
      gpsLongitude: 151.0,
    });

    it('a pin row is a menuitemcheckbox whose whole row is the target (mobile sheet)', async () => {
      isMobileValue = true;
      setPins({ photos: [photo('p-1'), photo('p-2')] });
      renderMap();

      const sheet = await openLayers();
      const row = within(sheet).getByTestId('map-layer-photos');
      // A switch would say "this is a setting that stays". A checkbox on the
      // whole 56px row is what a gloved thumb can actually hit.
      expect(row.tagName).toBe('BUTTON');
      expect(row).toHaveAttribute('role', 'menuitemcheckbox');
      expect(row).toHaveAttribute('aria-checked', 'false');
      expect(row.className).toMatch(/min-h-\[56px\]/);
      expect(row.className).toMatch(/\bw-full\b/);

      fireEvent.click(row);
      expect(within(await openLayers()).getByTestId('map-layer-photos')).toHaveAttribute(
        'aria-checked',
        'true',
      );
      // Armed, the row states what it is drawing — a count, not a verdict.
      expect(within(await openLayers()).getByTestId('map-layer-photos')).toHaveTextContent(
        '2 in view',
      );
    });

    it('panel rows are NOT checkboxes and they close the sheet behind them', async () => {
      isMobileValue = true;
      renderMap();

      const sheet = await openLayers();
      const panelRow = within(sheet).getByTestId('map-panel-coverage');
      expect(panelRow).not.toHaveAttribute('role', 'menuitemcheckbox');
      expect(panelRow).not.toHaveAttribute('aria-checked');

      fireEvent.click(panelRow);
      await waitFor(() => expect(screen.queryByTestId('map-layers-sheet')).not.toBeInTheDocument());
      expect(screen.getByTestId('coverage-panel')).toBeInTheDocument();
    });

    it('the desktop chooser closes on Escape and toggling a pin leaves it open', async () => {
      setPins({ photos: [photo('p-1')] });
      renderMap();

      const menu = await openLayers();
      fireEvent.click(within(menu).getByTestId('map-layer-photos'));
      // Arming two layers is one errand — the menu must survive the first.
      expect(screen.getByTestId('map-layers-menu')).toBeInTheDocument();

      fireEvent.keyDown(screen.getByTestId('map-layers-menu'), { key: 'Escape' });
      await waitFor(() => expect(screen.queryByTestId('map-layers-menu')).not.toBeInTheDocument());
      // Closing the chooser does not disarm what it armed.
      expect(screen.getByTestId('photo-pin-p-1')).toBeInTheDocument();
    });

    it('counts armed pin layers on the trigger', async () => {
      setPins({ photos: [photo('p-1')] });
      renderMap();

      expect(screen.queryByTestId('layers-button-count')).not.toBeInTheDocument();
      await toggleLayer('photos');
      expect(screen.getByTestId('layers-button-count')).toHaveTextContent('1');
      await toggleLayer('testPins');
      expect(screen.getByTestId('layers-button-count')).toHaveTextContent('2');
    });

    it('AT-94 a failed layer marks the trigger AND keeps its notice on the map', async () => {
      setPins({});
      spatialSearchMutation.error = new ApiError(0, 'offline');
      renderMap();

      expect(screen.queryByTestId('layers-button-alert')).not.toBeInTheDocument();
      await toggleLayer('photos');
      fireEvent.keyDown(screen.getByTestId('map-layers-menu'), { key: 'Escape' });
      await waitFor(() => expect(screen.queryByTestId('map-layers-menu')).not.toBeInTheDocument());

      // The dot survives the chooser closing; the words stay on the map, because
      // a notice that only exists while a menu is open is a notice nobody reads.
      expect(screen.getByTestId('layers-button-alert')).toBeInTheDocument();
      expect(screen.getByTestId('map-pin-layers-unavailable')).toHaveTextContent(
        /Photos is unavailable/i,
      );
      spatialSearchMutation.error = null;
    });

    it('says when the backend capped the answer instead of quietly dropping pins', async () => {
      // `truncated` has been on the wire since spatialSearch shipped and the map
      // has never rendered it: a capped map and a sparse map looked identical.
      setPins({ photos: [photo('p-1')], photosTruncated: true });
      renderMap();

      expect(screen.queryByTestId('map-pin-layers-truncated')).not.toBeInTheDocument();
      await toggleLayer('photos');
      expect(screen.getByTestId('map-pin-layers-truncated')).toHaveTextContent(
        /500\+.*Showing the first 500 photo pins in this view\. Zoom in to see the rest\./,
      );
    });
  });

  describe('Plan mode', () => {
    const registeredSheet = {
      id: 'sheet-1',
      name: 'Sheet 05 — Drainage',
      pageNumber: 5,
      imageWidth: 1000,
      imageHeight: 500,
      coordinateSystem: 'EPSG:7856',
      hasRegistration: true,
      cornersWgs84: {
        topLeft: [151.0, -33.8],
        topRight: [151.01, -33.8],
        bottomRight: [151.01, -33.81],
        bottomLeft: [151.0, -33.81],
      },
      perimeter: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    it('offers Plan only when a registered sheet exists', () => {
      mockQueries({ geometries: [polygonGeometry()], controlLines: [controlLine] });
      const { rerender } = render(
        <LotMapView projectId="proj-1" filteredLotIds={new Set(['lot-1'])} canManageSettings />,
      );
      expect(screen.getByTestId('mode-plan-button')).toBeDisabled();

      planSheetsQuery.data = [registeredSheet];
      rerender(
        <LotMapView projectId="proj-1" filteredLotIds={new Set(['lot-1'])} canManageSettings />,
      );
      expect(screen.getByTestId('mode-plan-button')).toBeEnabled();
    });

    it('entering Plan mode swaps to the sheet canvas, shows identity + registration, and collapses the toolbar', () => {
      planSheetsQuery.data = [registeredSheet];
      mockQueries({ geometries: [polygonGeometry()], controlLines: [controlLine] });
      render(
        <LotMapView projectId="proj-1" filteredLotIds={new Set(['lot-1'])} canManageSettings />,
      );

      fireEvent.click(screen.getByTestId('mode-plan-button'));

      // The sheet canvas replaces the geographic map, fed the displayed lots.
      const canvas = screen.getByTestId('plan-mode-canvas');
      expect(canvas).toHaveAttribute('data-sheet', 'sheet-1');
      expect(canvas).toHaveAttribute('data-count', '1');
      expect(screen.queryByTestId('map-container')).not.toBeInTheDocument();

      // Sheet identity + registration confidence are always visible.
      const bar = screen.getByTestId('plan-mode-bar');
      expect(within(bar).getByText('Sheet 05 — Drainage')).toBeInTheDocument();
      expect(within(bar).getByText(/p\.5 · EPSG:7856/)).toBeInTheDocument();
      expect(screen.getByTestId('plan-registration-confidence')).toBeInTheDocument();

      // Geographic tools withdraw; Save map stays.
      expect(screen.queryByTestId('find-by-area-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('locate-me-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('layers-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('history-button')).not.toBeInTheDocument();
      expect(screen.getByTestId('snapshot-button')).toBeInTheDocument();

      // And back.
      fireEvent.click(screen.getByTestId('mode-map-button'));
      expect(screen.queryByTestId('plan-mode-canvas')).not.toBeInTheDocument();
      expect(screen.getByTestId('map-container')).toBeInTheDocument();
    });

    it('deep link ?view=plan&sheet= opens Plan mode on that sheet', () => {
      planSheetsQuery.data = [registeredSheet, { ...registeredSheet, id: 'sheet-2', name: 'S2' }];
      searchParamsValue.current = new URLSearchParams('view=plan&sheet=sheet-2');
      mockQueries({ geometries: [polygonGeometry()], controlLines: [controlLine] });
      render(
        <LotMapView projectId="proj-1" filteredLotIds={new Set(['lot-1'])} canManageSettings />,
      );
      expect(screen.getByTestId('plan-mode-canvas')).toHaveAttribute('data-sheet', 'sheet-2');
    });

    it('mirrors workspace state to the URL and clears it on the way back', () => {
      planSheetsQuery.data = [registeredSheet];
      mockQueries({ geometries: [polygonGeometry()], controlLines: [controlLine] });
      render(
        <LotMapView projectId="proj-1" filteredLotIds={new Set(['lot-1'])} canManageSettings />,
      );

      fireEvent.click(screen.getByTestId('mode-plan-button'));
      const written = setSearchParamsMock.mock.calls.at(-1)?.[0] as URLSearchParams;
      expect(written.get('view')).toBe('plan');
      expect(written.get('sheet')).toBe('sheet-1');

      fireEvent.click(screen.getByTestId('mode-map-button'));
      const cleared = setSearchParamsMock.mock.calls.at(-1)?.[0] as URLSearchParams;
      expect(cleared.get('view')).toBeNull();
      expect(cleared.get('sheet')).toBeNull();
    });

    it('deep link ?lot= selects the lot and opens its popup once geometry loads', async () => {
      searchParamsValue.current = new URLSearchParams('lot=lot-1');
      mockQueries({ geometries: [polygonGeometry()], controlLines: [controlLine] });
      render(
        <LotMapView projectId="proj-1" filteredLotIds={new Set(['lot-1'])} canManageSettings />,
      );
      expect(await screen.findByTestId('lot-popup-lot-1')).toBeInTheDocument();
    });

    it('entering Plan mode disarms geographic tools (draw, history)', () => {
      planSheetsQuery.data = [registeredSheet];
      mockQueries({ geometries: [polygonGeometry()], controlLines: [controlLine] });
      render(
        <LotMapView projectId="proj-1" filteredLotIds={new Set(['lot-1'])} canManageSettings />,
      );

      fireEvent.click(screen.getByTestId('history-button'));
      expect(screen.getByTestId('history-panel')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('mode-plan-button'));
      expect(screen.queryByTestId('history-panel')).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId('mode-map-button'));
      // Leaving Plan restores the toolbar with History disarmed, not re-armed.
      expect(screen.getByTestId('history-button')).toHaveAttribute('aria-pressed', 'false');
    });
  });
});
