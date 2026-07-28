import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

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
};
// Captures the options passed to MapContainer (they are Leaflet OPTIONS, not
// DOM attributes — the mock must record them, never spread them onto the DOM).
const mapContainerProps = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
// Same capture pattern for TileLayer so tests can fire its tileerror handler.
const tileLayerProps = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('react-leaflet', () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const LayersControl = Object.assign(Passthrough, { BaseLayer: Passthrough });
  return {
    MapContainer: ({ children, ...props }: { children?: React.ReactNode }) => {
      mapContainerProps.current = props;
      return <div data-testid="map-container">{children}</div>;
    },
    TileLayer: (props: Record<string, unknown>) => {
      tileLayerProps.current = props;
      return <div data-testid="tile-layer" />;
    },
    ScaleControl: () => <div data-testid="scale-control" />,
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
    Tooltip: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Rectangle: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="rectangle">{children}</div>
    ),
    useMap: () => fakeMap,
    useMapEvents: () => fakeMap,
  };
});

// usePlanSheets hits useQuery; the map renders without a QueryClientProvider, so
// stub it. DrawLotLayer/overlays only mount when armed/shown, so no leaflet.
const planSheetsQuery = { data: [] as unknown[] };
vi.mock('@/pages/projects/settings/planSheetsData', () => ({
  usePlanSheets: () => planSheetsQuery,
}));

// createDrawnLotGeometry is exercised via its own path; the map only needs the
// invalidate on success. QueryClient is stubbed below.
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));

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
  it('renders a polygon layer with a popup for each filtered geometry', () => {
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

  it('toggles the Plans panel and shows the no-registered-sheets hint', () => {
    mockQueries({ geometries: [polygonGeometry()], controlLines: [controlLine] });
    render(
      <LotMapView
        projectId="proj-1"
        filteredLotIds={new Set(['lot-1'])}
        canManageSettings={false}
      />,
    );

    expect(screen.queryByTestId('plans-panel')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('plans-button'));
    const panel = screen.getByTestId('plans-panel');
    expect(within(panel).getByText(/No registered plan sheets yet/i)).toBeInTheDocument();
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

  it('entering History closes the Plans panel (mutually exclusive tools)', () => {
    mockQueries({ geometries: [polygonGeometry()], controlLines: [controlLine] });
    render(
      <LotMapView
        projectId="proj-1"
        filteredLotIds={new Set(['lot-1'])}
        canManageSettings={false}
      />,
    );
    fireEvent.click(screen.getByTestId('plans-button'));
    expect(screen.getByTestId('plans-panel')).toBeInTheDocument();
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

  it('recolours a lot from its status fill to its testing verdict when armed', () => {
    // in_progress -> #56B4E9 on the status palette; insufficient -> #E69F00.
    testCoverageQuery.data = {
      lots: [{ lotId: 'lot-1', state: 'insufficient', lotNumber: 'LOT-001', rules: [] }],
      lotsWithoutGeometry: 0,
    };
    renderWithTesting();

    expect(screen.getByTestId('polygon')).toHaveAttribute('data-fill', '#56B4E9');
    fireEvent.click(screen.getByTestId('testing-button'));
    expect(screen.getByTestId('polygon')).toHaveAttribute('data-fill', '#E69F00');
    expect(screen.getByTestId('testing-legend')).toBeInTheDocument();
    expect(screen.getByTestId('test-coverage-panel')).toBeInTheDocument();
  });

  it('AT-86 an in-flight or failed fetch keeps STATUS colours — never grey', () => {
    // Grey is the `unknown` VERDICT. Painting it while the answer is unknown to
    // the CLIENT would be CIVOS asserting it has no rule when it has no answer.
    testCoverageQuery.isLoading = true;
    renderWithTesting();
    fireEvent.click(screen.getByTestId('testing-button'));
    expect(screen.getByTestId('polygon')).toHaveAttribute('data-fill', '#56B4E9');

    testCoverageQuery.isLoading = false;
    testCoverageQuery.error = new ApiError(500, 'boom');
    fireEvent.click(screen.getByTestId('testing-button')); // off
    fireEvent.click(screen.getByTestId('testing-button')); // on again, now errored
    expect(screen.getByTestId('polygon')).toHaveAttribute('data-fill', '#56B4E9');
    expect(screen.getByTestId('test-coverage-error')).toBeInTheDocument();
  });

  it('AT-95 History disarms Testing, and the toggle is unavailable in History', () => {
    testCoverageQuery.data = {
      lots: [{ lotId: 'lot-1', state: 'satisfied' }],
      lotsWithoutGeometry: 0,
    };
    renderWithTesting();

    fireEvent.click(screen.getByTestId('testing-button'));
    expect(screen.getByTestId('testing-button')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('polygon')).toHaveAttribute('data-fill', '#009E73');

    fireEvent.click(screen.getByTestId('history-button'));
    // Disarmed, its panel gone, its toggle gone, and the map back on the
    // historical STATUS colours — one date in the picture, not two.
    expect(screen.queryByTestId('testing-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('test-coverage-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('polygon')).toHaveAttribute('data-fill', '#56B4E9');
    expect(screen.getByTestId('history-panel')).toBeInTheDocument();

    // Leaving History restores the toggle, still disarmed (never re-armed for you).
    fireEvent.click(screen.getByTestId('history-button'));
    expect(screen.getByTestId('testing-button')).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows an access-denied message on a 403', () => {
    mockQueries({ error: new ApiError(403, 'Forbidden') });
    render(<LotMapView projectId="proj-1" filteredLotIds={new Set()} canManageSettings={false} />);
    expect(screen.getByText(/do not have access/i)).toBeInTheDocument();
  });

  it('collapses toolbar buttons to icon-only (accessible name preserved) on mobile', () => {
    isMobileValue = true;
    mockQueries({ geometries: [polygonGeometry()], controlLines: [controlLine] });
    render(<LotMapView projectId="proj-1" filteredLotIds={new Set(['lot-1'])} canManageSettings />);

    // Icon-only: no visible caption text, but the button is still reachable by
    // its accessible name (aria-label) and carries a ≥44px (h-11 w-11) hit area.
    const findButton = screen.getByTestId('find-by-area-button');
    expect(findButton).toHaveAttribute('aria-label', 'Find by area');
    expect(findButton.className).toMatch(/\bh-11\b/);
    expect(findButton.className).toMatch(/\bw-11\b/);
    expect(within(findButton).queryByText('Find by area')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'My location' })).toBeInTheDocument();
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
  });

  it('keeps the +/- zoom control on desktop', () => {
    mockQueries({ geometries: [polygonGeometry()], controlLines: [controlLine] });
    render(<LotMapView projectId="proj-1" filteredLotIds={new Set(['lot-1'])} canManageSettings />);
    expect(mapContainerProps.current.zoomControl).toBe(true);
  });

  it('isolates the map stacking context so leaflet z-indexes cannot paint over app chrome', () => {
    mockQueries({ geometries: [polygonGeometry()], controlLines: [controlLine] });
    render(<LotMapView projectId="proj-1" filteredLotIds={new Set(['lot-1'])} canManageSettings />);
    // The wrapper's `isolate` keeps the internal z-400–1000 (leaflet panes,
    // toolbar) below fixed z-50 page UI like OfflineIndicator and dialog
    // overlays. Removing it re-breaks the offline pill on the map page.
    expect(screen.getByTestId('lot-map-stacking-root')).toHaveClass('isolate');
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

    it('renders pins only for photos with coords once the Photos layer is on', () => {
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

      fireEvent.click(screen.getByTestId('photos-button'));
      expect(screen.getByTestId('photos-button')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('photo-pin-photo-1')).toBeInTheDocument();
      // The null-coord photo is skipped.
      expect(screen.queryByTestId('photo-pin-photo-2')).not.toBeInTheDocument();
    });

    it('routes a pin View through linkTargets so the foreman shell stays under /m', () => {
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
      fireEvent.click(screen.getByTestId('photos-button'));
      fireEvent.click(screen.getByTestId('photo-pin-view-photo-1'));
      expect(navigate).toHaveBeenCalledWith('/m/lots/lot-1?projectId=proj-1');
    });

    it('renders an unlinked pin (no View) when the shell photo has no lot destination', () => {
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
      fireEvent.click(screen.getByTestId('photos-button'));
      expect(screen.getByTestId('photo-pin-photo-1')).toBeInTheDocument();
      expect(screen.queryByTestId('photo-pin-view-photo-1')).not.toBeInTheDocument();
    });

    it('AT-94 an armed marker layer whose fetch failed says so instead of showing an empty map', () => {
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

      fireEvent.click(screen.getByTestId('photos-button'));
      fireEvent.click(screen.getByTestId('test-pins-button'));
      // Named, not silent: `spatial-search` is a POST and deliberately uncached
      // (AT-94 `[C3S-d]`), so offline there is nothing to show — and a blank map
      // reads as "no tests here", which is a different and false statement.
      expect(screen.getByTestId('map-pin-layers-unavailable')).toHaveTextContent(
        /Photos and Test pins are unavailable/i,
      );
      spatialSearchMutation.error = null;
    });

    it('persists the Photos toggle per project', () => {
      mockQueries({ geometries: [polygonGeometry()] });
      const { unmount } = render(
        <LotMapView
          projectId="proj-1"
          filteredLotIds={new Set(['lot-1'])}
          canManageSettings={false}
        />,
      );
      expect(screen.getByTestId('photos-button')).toHaveAttribute('aria-pressed', 'false');
      fireEvent.click(screen.getByTestId('photos-button'));
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
      expect(screen.getByTestId('photos-button')).toHaveAttribute('aria-pressed', 'true');
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

    it('renders a pin with provenance and accuracy once the layer is on', () => {
      setTests([located()]);
      renderMap();

      // Default off.
      expect(screen.queryByTestId('test-pin-tr-1')).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId('test-pins-button'));
      expect(screen.getByTestId('test-pins-button')).toHaveAttribute('aria-pressed', 'true');
      const pin = screen.getByTestId('test-pin-tr-1');
      expect(pin).toHaveTextContent('Density Ratio');
      expect(pin).toHaveTextContent('Verified');
      expect(pin).toHaveTextContent('Pass');
      // `[C3R-A5]` a pin whose accuracy is unstated invites more trust than it earns.
      expect(screen.getByTestId('test-pin-point-tr-1')).toHaveTextContent(
        '-33.800500, 151.000500 · GPS ±6 m',
      );
    });

    it('says "Picked on map" and no radius for a map pick', () => {
      setTests([located({ sampleLocationSource: 'map_pick', sampleLocationAccuracyM: null })]);
      renderMap();
      fireEvent.click(screen.getByTestId('test-pins-button'));
      expect(screen.getByTestId('test-pin-point-tr-1')).toHaveTextContent('Picked on map');
      expect(screen.getByTestId('test-pin-point-tr-1')).not.toHaveTextContent('±');
    });

    it('AT-84 an unlocated test is never drawn — no centroid, no text-derived pin', () => {
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
      fireEvent.click(screen.getByTestId('test-pins-button'));

      expect(screen.queryByTestId('test-pin-tr-unlocated')).not.toBeInTheDocument();
      expect(screen.queryByTestId('test-pin-tr-half')).not.toBeInTheDocument();
      expect(screen.queryByTestId('marker')).not.toBeInTheDocument();
    });

    it('routes a pin View through linkTargets so the foreman shell stays under /m', () => {
      setTests([located()]);
      renderMap({ lot: (lotId) => `/m/lots/${lotId}?projectId=proj-1` });
      fireEvent.click(screen.getByTestId('test-pins-button'));
      fireEvent.click(screen.getByTestId('test-pin-view-tr-1'));
      expect(navigate).toHaveBeenCalledWith('/m/lots/lot-1?projectId=proj-1');
    });

    it('renders an unlinked pin (no View) when the shell test has no lot destination', () => {
      setTests([located({ lotId: null, lotNumber: null })]);
      renderMap({ lot: (lotId) => `/m/lots/${lotId}?projectId=proj-1` });
      fireEvent.click(screen.getByTestId('test-pins-button'));
      expect(screen.getByTestId('test-pin-tr-1')).toBeInTheDocument();
      expect(screen.queryByTestId('test-pin-view-tr-1')).not.toBeInTheDocument();
    });

    it('persists the Test pins toggle per project', () => {
      setTests([located()]);
      const { unmount } = render(
        <LotMapView
          projectId="proj-1"
          filteredLotIds={new Set(['lot-1'])}
          canManageSettings={false}
        />,
      );
      mockQueries({ geometries: [polygonGeometry()] });
      fireEvent.click(screen.getByTestId('test-pins-button'));
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
      expect(screen.getByTestId('test-pins-button')).toHaveAttribute('aria-pressed', 'true');
    });

    it('AT-95 History disarms the pin layer too, and its toggle is unavailable there', () => {
      setTests([located()]);
      testCoverageQuery.data = {
        lots: [{ lotId: 'lot-1', state: 'satisfied' }],
        lotsWithoutGeometry: 0,
      };
      renderMap();

      // Both C3 layers armed at once.
      fireEvent.click(screen.getByTestId('testing-button'));
      fireEvent.click(screen.getByTestId('test-pins-button'));
      expect(screen.getByTestId('test-pin-tr-1')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('history-button'));
      // `[C3R-B5]` today's captures have no place on a map showing a past date.
      expect(screen.queryByTestId('testing-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('test-pins-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('test-pin-tr-1')).not.toBeInTheDocument();

      // Leaving History restores both toggles, still disarmed.
      fireEvent.click(screen.getByTestId('history-button'));
      expect(screen.getByTestId('testing-button')).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByTestId('test-pins-button')).toHaveAttribute('aria-pressed', 'false');
    });

    // Exit item 13 `[C3R-A10]`. jsdom has no layout, so this asserts the two things
    // that DECIDE the 360px outcome: every toolbar item is icon-only at a ≥44px hit
    // area, and the container wraps. 10 items x 44px + 9 gaps x 8px = 512px, so at
    // 360px the toolbar takes exactly two rows (~96px) and the map keeps its
    // min(520px, 60dvh) height — a stolen row, never a clipped or hidden button.
    it('[C3R-A10] all ten toolbar items stay reachable and icon-only at phone width', () => {
      isMobileValue = true;
      setTests([located()]);
      testCoverageQuery.data = { lots: [], lotsWithoutGeometry: 0 };
      mockQueries({ geometries: [polygonGeometry()] });
      render(
        <LotMapView projectId="proj-1" filteredLotIds={new Set(['lot-1'])} canManageSettings />,
      );

      const ids = [
        'find-by-area-button',
        'coverage-button',
        'plans-button',
        'testing-button',
        'test-pins-button',
        'photos-button',
        'draw-lot-button',
        'snapshot-button',
        'locate-me-button',
        'history-button',
      ];
      for (const id of ids) {
        const button = screen.getByTestId(id);
        expect(button).toHaveAttribute('aria-label');
        expect(button.className).toMatch(/\bh-11\b/);
        expect(button.className).toMatch(/\bw-11\b/);
      }
      expect(screen.getByRole('button', { name: 'Test pins' })).toBeInTheDocument();
      // flex-wrap is what makes the failure mode "a second row", not "a hidden button".
      expect(screen.getByTestId('find-by-area-button').parentElement?.className).toMatch(
        /flex-wrap/,
      );
      expect(mapContainerProps.current.style).toMatchObject({ height: 'min(520px, 60dvh)' });
    });
  });
});
