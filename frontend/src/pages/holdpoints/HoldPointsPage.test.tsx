import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes, useLocation } from 'react-router-dom';
import { renderWithProviders, screen, waitFor } from '@/test/renderWithProviders';
import userEvent from '@testing-library/user-event';
import type { HoldPoint } from './types';

const apiFetchMock = vi.hoisted(() => vi.fn());

// Keep ApiError, authFetch, etc. real — only the fetcher is stubbed.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: apiFetchMock };
});

// jsdom has no matchMedia; pin the mobile card list (the desktop table's
// virtualizer needs real layout, and the data layer under test is shared).
vi.mock('@/hooks/useMediaQuery', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useMediaQuery')>();
  return { ...actual, useIsMobile: () => true };
});

import { HoldPointsPage } from './HoldPointsPage';

// jsdom does not implement scrollIntoView; the mobile list calls it to bring
// the deep-linked card into view.
beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

function makeHoldPoint(overrides: Partial<HoldPoint>): HoldPoint {
  return {
    id: 'hp-1',
    lotId: 'lot-1',
    lotNumber: 'LOT-001',
    itpChecklistItemId: 'item-1',
    description: 'Inspection hold point',
    pointType: 'hold_point',
    status: 'pending',
    notificationSentAt: null,
    scheduledDate: null,
    releasedAt: null,
    releasedByName: null,
    releaseNotes: null,
    sequenceNumber: 1,
    isCompleted: false,
    isVerified: false,
    createdAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

// A register exercising every filter view: pending, fresh notification (sent
// "now", so the notice window has not elapsed), expired notification, released.
function buildRegister(): HoldPoint[] {
  return [
    makeHoldPoint({ id: 'hp-1', lotNumber: 'LOT-001', description: 'Formation inspection' }),
    makeHoldPoint({
      id: 'hp-2',
      lotId: 'lot-2',
      lotNumber: 'LOT-002',
      description: 'Basecourse release',
      status: 'notified',
      notificationSentAt: new Date().toISOString(),
      sequenceNumber: 2,
    }),
    makeHoldPoint({
      id: 'hp-3',
      lotId: 'lot-3',
      lotNumber: 'LOT-003',
      description: 'Subgrade proof roll',
      status: 'notified',
      notificationSentAt: '2026-06-01T00:00:00.000Z',
      sequenceNumber: 3,
    }),
    makeHoldPoint({
      id: 'hp-4',
      lotId: 'lot-4',
      lotNumber: 'LOT-004',
      description: 'Asphalt witness point',
      status: 'released',
      releasedAt: '2026-06-05T00:00:00.000Z',
      sequenceNumber: 4,
    }),
  ];
}

function mockHoldPointsApi(register: HoldPoint[]) {
  apiFetchMock.mockImplementation((path: string) => {
    const url = new URL(path, 'http://localhost');
    if (url.pathname === '/api/holdpoints/project/p1') {
      const page = Number(url.searchParams.get('page') || '1');
      const limit = Number(url.searchParams.get('limit') || '100');
      const start = (page - 1) * limit;
      return Promise.resolve({
        holdPoints: register.slice(start, start + limit),
        pagination: {
          page,
          totalPages: Math.max(1, Math.ceil(register.length / limit)),
          hasNextPage: page * limit < register.length,
        },
      });
    }
    return Promise.reject(new Error(`Unhandled apiFetch path in test: ${path}`));
  });
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
}

function renderPage(initialEntry = '/projects/p1/hold-points') {
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/projects/:projectId/hold-points" element={<HoldPointsPage />} />
      </Routes>
      <LocationProbe />
    </>,
    { initialEntries: [initialEntry] },
  );
}

beforeEach(() => {
  apiFetchMock.mockReset();
});

describe('HoldPointsPage register data layer', () => {
  it('aggregates every backend page through the cached query', async () => {
    const bigRegister = Array.from({ length: 150 }, (_, index) =>
      makeHoldPoint({
        id: `hp-${index + 1}`,
        lotNumber: `LOT-${String(index + 1).padStart(3, '0')}`,
      }),
    );
    mockHoldPointsApi(bigRegister);

    renderPage();

    expect(await screen.findByText('LOT-001')).toBeInTheDocument();
    expect(screen.getByText('LOT-150')).toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenCalledTimes(2);
    expect(apiFetchMock).toHaveBeenCalledWith('/api/holdpoints/project/p1?page=1&limit=100');
    expect(apiFetchMock).toHaveBeenCalledWith('/api/holdpoints/project/p1?page=2&limit=100');
  });

  it('applies a status filter arriving via the URL', async () => {
    mockHoldPointsApi(buildRegister());

    renderPage('/projects/p1/hold-points?status=released');

    expect(await screen.findByText('LOT-004')).toBeInTheDocument();
    expect(screen.queryByText('LOT-001')).not.toBeInTheDocument();
    expect(screen.queryByText('LOT-002')).not.toBeInTheDocument();
  });

  it('persists status filter changes to the URL', async () => {
    mockHoldPointsApi(buildRegister());
    const user = userEvent.setup();

    renderPage();

    expect(await screen.findByText('LOT-001')).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox'), 'Released');

    expect(screen.getByTestId('location-search')).toHaveTextContent('?status=released');
    expect(screen.getByText('LOT-004')).toBeInTheDocument();
    expect(screen.queryByText('LOT-001')).not.toBeInTheDocument();
  });

  it('shows only awaiting-release hold points with elapsed notice in the notice-expired view', async () => {
    mockHoldPointsApi(buildRegister());
    const user = userEvent.setup();

    renderPage();

    expect(await screen.findByText('LOT-001')).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox'), 'Awaiting Release — Notice Expired');

    expect(screen.getByTestId('location-search')).toHaveTextContent('?status=notice-expired');
    // hp-3 was notified long ago (expired); hp-2 was notified just now (fresh).
    expect(screen.getByText('LOT-003')).toBeInTheDocument();
    expect(screen.queryByText('LOT-002')).not.toBeInTheDocument();
    expect(screen.queryByText('LOT-001')).not.toBeInTheDocument();
  });

  it('filters by lot search and records the query in the URL', async () => {
    mockHoldPointsApi(buildRegister());
    const user = userEvent.setup();

    renderPage();

    expect(await screen.findByText('LOT-001')).toBeInTheDocument();
    const search = screen.getByRole('textbox', {
      name: 'Search hold points by lot or description',
    });
    await user.type(search, 'LOT-002');

    expect(screen.getByTestId('location-search')).toHaveTextContent('search=LOT-002');
    expect(screen.getByText('LOT-002')).toBeInTheDocument();
    expect(screen.queryByText('LOT-001')).not.toBeInTheDocument();
    expect(screen.queryByText('LOT-004')).not.toBeInTheDocument();
  });

  it('still resolves ?hp= deep links from the full register once data loads', async () => {
    mockHoldPointsApi(buildRegister());

    const { container } = renderPage('/projects/p1/hold-points?hp=hp-3');

    await waitFor(() => {
      expect(container.querySelector('[data-deep-linked="true"]')).not.toBeNull();
    });
    expect(screen.getByTestId('location-search')).not.toHaveTextContent('hp=hp-3');
  });
});
