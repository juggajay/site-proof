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

type UserEvent = ReturnType<typeof userEvent.setup>;

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
    canRequestRelease: true,
    incompletePrerequisiteCount: 0,
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

function buildBatchRegister(): HoldPoint[] {
  return [
    makeHoldPoint({
      id: 'hp-batch-1',
      lotId: 'lot-1',
      lotNumber: 'LOT-001',
      itpChecklistItemId: 'item-1',
      description: 'Formation inspection',
    }),
    makeHoldPoint({
      id: 'hp-batch-2',
      lotId: 'lot-1',
      lotNumber: 'LOT-001',
      itpChecklistItemId: 'item-2',
      description: 'Basecourse inspection',
      sequenceNumber: 2,
    }),
    makeHoldPoint({
      id: 'hp-other-lot',
      lotId: 'lot-2',
      lotNumber: 'LOT-002',
      itpChecklistItemId: 'item-3',
      description: 'Other lot inspection',
      sequenceNumber: 3,
    }),
  ];
}

function getHoldPointsApiResponse(path: string, register: HoldPoint[]) {
  const url = new URL(path, 'http://localhost');
  if (url.pathname === '/api/projects/p1') {
    return Promise.resolve({
      project: {
        id: 'p1',
        name: 'Hold Point Test Project',
        currentUserRole: 'project_manager',
      },
    });
  }
  if (url.pathname === '/api/holdpoints/project/p1') {
    return Promise.resolve({
      holdPoints: register,
      pagination: {
        page: 1,
        totalPages: 1,
        hasNextPage: false,
      },
    });
  }
  return null;
}

function mockHoldPointsApi(register: HoldPoint[]) {
  apiFetchMock.mockImplementation((path: string) => {
    const response = getHoldPointsApiResponse(path, register);
    if (response) {
      return response;
    }
    return Promise.reject(new Error(`Unhandled apiFetch path in test: ${path}`));
  });
}

function mockBatchHoldPointsApi(register: HoldPoint[]) {
  apiFetchMock.mockImplementation((path: string, options?: RequestInit) => {
    const url = new URL(path, 'http://localhost');
    const response = getHoldPointsApiResponse(path, register);
    if (response) {
      return response;
    }
    if (url.pathname === '/api/holdpoints/request-release/batch') {
      return Promise.resolve({
        success: true,
        holdPoints: [],
        receivedBody: options?.body,
      });
    }
    return Promise.reject(new Error(`Unhandled apiFetch path in test: ${path}`));
  });
}

async function selectLotForBatch(user: UserEvent, lotNumber = 'LOT-001') {
  expect((await screen.findAllByRole('heading', { name: lotNumber })).length).toBeGreaterThan(0);
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Filter hold points by lot' }),
    lotNumber,
  );
}

async function sendBatchReleaseRequest(
  user: UserEvent,
  requestButtonName: RegExp,
  recipientName?: string,
) {
  await user.click(screen.getByRole('button', { name: requestButtonName }));
  await user.type(screen.getByLabelText(/Scheduled Date/i), '2026-07-10');
  await user.type(screen.getByLabelText(/Scheduled Time/i), '09:30');
  await user.type(screen.getByLabelText(/Recipient Email/i), 'reviewer@example.com');
  if (recipientName) {
    await user.type(screen.getByLabelText(/Recipient Name/i), recipientName);
  }
  await user.click(screen.getByRole('button', { name: /Send batch request/i }));
}

async function expectBatchRequestBody() {
  await waitFor(() => {
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/holdpoints/request-release/batch',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  const batchCall = apiFetchMock.mock.calls.find(
    ([path]) => path === '/api/holdpoints/request-release/batch',
  );
  expect(batchCall).toBeDefined();
  return JSON.parse((batchCall?.[1] as RequestInit).body as string);
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

function findLotCard(lotNumber: string) {
  return screen.findByRole('heading', { name: lotNumber });
}

function getLotCard(lotNumber: string) {
  return screen.getByRole('heading', { name: lotNumber });
}

function queryLotCard(lotNumber: string) {
  return screen.queryByRole('heading', { name: lotNumber });
}

beforeEach(() => {
  apiFetchMock.mockReset();
});

describe('HoldPointsPage register data layer', () => {
  it('loads the full backend register through the cached query', async () => {
    const bigRegister = Array.from({ length: 150 }, (_, index) =>
      makeHoldPoint({
        id: `hp-${index + 1}`,
        lotId: `lot-${index + 1}`,
        lotNumber: `LOT-${String(index + 1).padStart(3, '0')}`,
      }),
    );
    mockHoldPointsApi(bigRegister);

    renderPage();

    expect(await findLotCard('LOT-001')).toBeInTheDocument();
    expect(getLotCard('LOT-150')).toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenCalledWith('/api/holdpoints/project/p1?all=true');
  });

  it('applies a status filter arriving via the URL', async () => {
    mockHoldPointsApi(buildRegister());

    renderPage('/projects/p1/hold-points?status=released');

    expect(await findLotCard('LOT-004')).toBeInTheDocument();
    expect(queryLotCard('LOT-001')).not.toBeInTheDocument();
    expect(queryLotCard('LOT-002')).not.toBeInTheDocument();
  });

  it('persists status filter changes to the URL', async () => {
    mockHoldPointsApi(buildRegister());
    const user = userEvent.setup();

    renderPage();

    expect(await findLotCard('LOT-001')).toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Filter hold points by status' }),
      'Released',
    );

    expect(screen.getByTestId('location-search')).toHaveTextContent('?status=released');
    expect(getLotCard('LOT-004')).toBeInTheDocument();
    expect(queryLotCard('LOT-001')).not.toBeInTheDocument();
  });

  it('shows only awaiting-release hold points with elapsed notice in the notice-expired view', async () => {
    mockHoldPointsApi(buildRegister());
    const user = userEvent.setup();

    renderPage();

    expect(await findLotCard('LOT-001')).toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Filter hold points by status' }),
      'Awaiting Release — Notice Expired',
    );

    expect(screen.getByTestId('location-search')).toHaveTextContent('?status=notice-expired');
    // hp-3 was notified long ago (expired); hp-2 was notified just now (fresh).
    expect(getLotCard('LOT-003')).toBeInTheDocument();
    expect(queryLotCard('LOT-002')).not.toBeInTheDocument();
    expect(queryLotCard('LOT-001')).not.toBeInTheDocument();
  });

  it('filters by lot search and records the query in the URL', async () => {
    mockHoldPointsApi(buildRegister());
    const user = userEvent.setup();

    renderPage();

    expect(await findLotCard('LOT-001')).toBeInTheDocument();
    const search = screen.getByRole('textbox', {
      name: 'Search hold points by lot or description',
    });
    await user.type(search, 'LOT-002');

    expect(screen.getByTestId('location-search')).toHaveTextContent('search=LOT-002');
    expect(getLotCard('LOT-002')).toBeInTheDocument();
    expect(queryLotCard('LOT-001')).not.toBeInTheDocument();
    expect(queryLotCard('LOT-004')).not.toBeInTheDocument();
  });

  it('filters the register by selected lot and records the lot in the URL', async () => {
    mockHoldPointsApi(buildRegister());
    const user = userEvent.setup();

    renderPage();

    expect(await findLotCard('LOT-001')).toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Filter hold points by lot' }),
      'LOT-002',
    );

    expect(screen.getByTestId('location-search')).toHaveTextContent('lotId=lot-2');
    expect(getLotCard('LOT-002')).toBeInTheDocument();
    expect(queryLotCard('LOT-001')).not.toBeInTheDocument();
    expect(queryLotCard('LOT-003')).not.toBeInTheDocument();
  });

  it('still resolves ?hp= deep links from the full register once data loads', async () => {
    mockHoldPointsApi(buildRegister());

    const { container } = renderPage('/projects/p1/hold-points?hp=hp-3');

    await waitFor(() => {
      expect(container.querySelector('[data-deep-linked="true"]')).not.toBeNull();
    });
    // The param is cleared via setSearchParams, which React Router v7 wraps in
    // React.startTransition — that commit can land a frame after the highlight
    // commit above, so the URL assertion must also wait.
    await waitFor(() => {
      expect(screen.getByTestId('location-search')).not.toHaveTextContent('hp=hp-3');
    });
  });

  it('submits one batch release request for selected pending hold points in the selected lot', async () => {
    mockBatchHoldPointsApi(buildBatchRegister());
    const user = userEvent.setup();

    renderPage();

    await selectLotForBatch(user);
    await user.click(
      screen.getByRole('checkbox', { name: /Select Formation inspection for batch release/i }),
    );
    await user.click(
      screen.getByRole('checkbox', { name: /Select Basecourse inspection for batch release/i }),
    );
    await sendBatchReleaseRequest(user, /Request selected/i, 'Site Reviewer');

    const body = await expectBatchRequestBody();
    expect(body).toEqual({
      lotId: 'lot-1',
      items: [{ itpChecklistItemId: 'item-1' }, { itpChecklistItemId: 'item-2' }],
      sharedEvidenceDocumentIds: [],
      scheduledDate: '2026-07-10',
      scheduledTime: '09:30',
      recipientEmail: 'reviewer@example.com',
      recipientName: 'Site Reviewer',
      noticeHours: 24,
    });
  });

  it('includes prerequisite-blocked pending hold points in batch release packages', async () => {
    const register = [
      makeHoldPoint({
        id: 'hp-ready',
        lotId: 'lot-1',
        lotNumber: 'LOT-001',
        itpChecklistItemId: 'item-ready',
        description: 'Formation inspection',
        sequenceNumber: 1,
        canRequestRelease: true,
        incompletePrerequisiteCount: 0,
      }),
      makeHoldPoint({
        id: 'hp-blocked',
        lotId: 'lot-1',
        lotNumber: 'LOT-001',
        itpChecklistItemId: 'item-blocked',
        description: 'Basecourse inspection',
        sequenceNumber: 2,
        canRequestRelease: false,
        incompletePrerequisiteCount: 1,
      }),
    ];
    mockBatchHoldPointsApi(register);
    const user = userEvent.setup();

    renderPage();

    await selectLotForBatch(user);

    const blockedCheckbox = screen.getByRole('checkbox', {
      name: /Select Basecourse inspection for batch release/i,
    });
    expect(blockedCheckbox).toBeEnabled();
    expect(screen.getByText(/2 pending hold points in this lot/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Select all pending/i }));
    await sendBatchReleaseRequest(user, /Request selected \(2\)/i);

    const body = await expectBatchRequestBody();
    expect(body.items).toEqual([
      { itpChecklistItemId: 'item-ready' },
      { itpChecklistItemId: 'item-blocked' },
    ]);
  });
});
