import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { ProjectControlLine, ProjectLotGeometry } from './lotMapData';

// jsdom cannot run real Leaflet — mock the react-leaflet primitives as
// passthrough elements so we can assert our own layer/popup/empty-state logic.
vi.mock('react-leaflet', () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const LayersControl = Object.assign(Passthrough, { BaseLayer: Passthrough });
  return {
    MapContainer: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="map-container">{children}</div>
    ),
    TileLayer: () => <div data-testid="tile-layer" />,
    LayersControl,
    Polygon: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="polygon">{children}</div>
    ),
    Polyline: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="polyline">{children}</div>
    ),
    CircleMarker: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="circle-marker">{children}</div>
    ),
    Popup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Tooltip: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Rectangle: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="rectangle">{children}</div>
    ),
    useMap: () => ({ fitBounds: vi.fn() }),
  };
});

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));

// Force desktop view so jsdom doesn't need a matchMedia polyfill.
vi.mock('@/hooks/useMediaQuery', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useMediaQuery')>();
  return { ...actual, useIsMobile: () => false };
});

// The find-by-area mutation is exercised in its own tests; stub it here so
// LotMapView renders without a QueryClientProvider.
const spatialSearchMutation = {
  mutate: vi.fn(),
  reset: vi.fn(),
  data: undefined,
  isLoading: false,
  error: null,
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

const useProjectLotGeometries = vi.fn();
const useProjectControlLines = vi.fn();
const backfillLotGeometries = vi.fn();
vi.mock('./lotMapData', () => ({
  useProjectLotGeometries: (...args: unknown[]) => useProjectLotGeometries(...args),
  useProjectControlLines: (...args: unknown[]) => useProjectControlLines(...args),
  backfillLotGeometries: (...args: unknown[]) => backfillLotGeometries(...args),
}));

import { ApiError } from '@/lib/api';
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

beforeEach(() => {
  vi.clearAllMocks();
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
    // formatStatusLabel turns in_progress -> "In Progress"
    expect(within(popup).getByText(/In Progress/)).toBeInTheDocument();
    expect(screen.getByTestId('lot-popup-view-lot-1')).toBeInTheDocument();
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

  it('shows an access-denied message on a 403', () => {
    mockQueries({ error: new ApiError(403, 'Forbidden') });
    render(<LotMapView projectId="proj-1" filteredLotIds={new Set()} canManageSettings={false} />);
    expect(screen.getByText(/do not have access/i)).toBeInTheDocument();
  });
});
