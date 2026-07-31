/**
 * Wave C5-b — the register's async states, which are the whole difference
 * between "the page renders" and "the page is usable on a bad day".
 *
 * Five states, one test each: loading, empty, no filter match, hard error, and
 * error-with-stale-rows. Plus the server-side docket filter, asserted on the
 * URL the page actually requests.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiFetch } from '@/lib/api';

import { DeliveryRegisterPage } from './DeliveryRegisterPage';
import type { DeliveryRegisterResponse, DeliveryRow } from './deliveryRegisterData';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn(), authFetch: vi.fn() };
});

const apiFetchMock = vi.mocked(apiFetch);

function makeDelivery(overrides: Partial<DeliveryRow> = {}): DeliveryRow {
  return {
    id: 'del-1',
    diaryId: 'diary-1',
    description: '32 MPa concrete',
    supplier: 'Boral Concrete',
    docketNumber: null,
    quantity: '12.5',
    unit: 'm3',
    lotId: null,
    batchRef: null,
    docketDocumentId: null,
    lot: null,
    docketDocument: null,
    diary: {
      id: 'diary-1',
      date: '2026-07-28T00:00:00.000Z',
      projectId: 'p1',
      status: 'submitted',
    },
    ...overrides,
  };
}

function makeResponse(overrides: Partial<DeliveryRegisterResponse> = {}): DeliveryRegisterResponse {
  return {
    deliveries: [makeDelivery()],
    total: 1,
    limit: 50,
    offset: 0,
    hasMore: false,
    unlinkedCount: 0,
    missingDocketCount: 0,
    ...overrides,
  };
}

/** Route the mocked apiFetch by path so the project/lots lookups don't matter. */
function respondWith(register: () => unknown) {
  apiFetchMock.mockImplementation((path: string) => {
    if (path.includes('/deliveries')) return Promise.resolve(register()) as never;
    if (path.startsWith('/api/lots')) return Promise.resolve({ lots: [] }) as never;
    return Promise.resolve({ currentUserRole: 'quality_manager' }) as never;
  });
}

function renderPage(initialEntry = '/projects/p1/deliveries') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/projects/:projectId/deliveries" element={<DeliveryRegisterPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function registerRequestPaths(): string[] {
  return apiFetchMock.mock.calls
    .map(([path]) => String(path))
    .filter((path) => path.includes('/deliveries'));
}

describe('DeliveryRegisterPage async states', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('shows a skeleton while the first page loads, with the filters disabled', async () => {
    respondWith(() => new Promise(() => {}) as never);
    renderPage();

    expect(await screen.findByTestId('delivery-skeleton')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search supplier')).toBeDisabled();
  });

  it('names the empty register and points at where deliveries come from', async () => {
    respondWith(() => makeResponse({ deliveries: [], total: 0 }));
    renderPage();

    expect(await screen.findByText('No deliveries recorded yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /daily diary/i })).toHaveAttribute(
      'href',
      '/projects/p1/diary',
    );
  });

  it('distinguishes "no match" from "nothing here", and keeps the filters', async () => {
    respondWith(() => makeResponse({ deliveries: [], total: 0 }));
    renderPage('/projects/p1/deliveries?docket=not_filed');

    expect(await screen.findByText('No deliveries match these filters')).toBeInTheDocument();
    expect(screen.queryByText('No deliveries recorded yet')).not.toBeInTheDocument();
    // The filter that produced the empty result is still selected, so the user
    // can see WHY it is empty.
    expect(screen.getByDisplayValue('Not filed in CIVOS')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Clear filters' }).length).toBeGreaterThan(0);
  });

  it('offers a retry when nothing loaded at all', async () => {
    respondWith(() => {
      throw new Error('network down');
    });
    renderPage();

    expect(await screen.findByText(/Couldn.t load deliveries$/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('keeps the rows that did load when a refresh fails', async () => {
    let calls = 0;
    respondWith(() => {
      calls += 1;
      if (calls === 1) return makeResponse();
      throw new Error('network down');
    });
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('32 MPa concrete')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Docket'), 'not_filed');

    await waitFor(() =>
      expect(screen.getByText(/Showing the last results that loaded/)).toBeInTheDocument(),
    );
    // The stale row survives the failed refresh — an old answer beats none.
    expect(screen.getByText('32 MPa concrete')).toBeInTheDocument();
  });

  it('asks the server for the docket filter instead of filtering the loaded page', async () => {
    respondWith(() => makeResponse({ total: 120, hasMore: true, missingDocketCount: 17 }));
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('32 MPa concrete')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Docket'), 'not_filed');

    await waitFor(() =>
      expect(registerRequestPaths().some((path) => path.includes('docket=not_filed'))).toBe(true),
    );
  });

  it('resets the offset when a filter changes, so page 3 of one view is not page 3 of another', async () => {
    respondWith(() => makeResponse({ total: 120, hasMore: true }));
    const user = userEvent.setup();
    renderPage('/projects/p1/deliveries?offset=100');

    expect(await screen.findByText('32 MPa concrete')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Lot link'), 'unlinked');

    await waitFor(() => {
      const latest = registerRequestPaths().at(-1) ?? '';
      expect(latest).toContain('linked=unlinked');
      expect(latest).not.toContain('offset=');
    });
  });

  it('labels the export as the current page, because the API pages', async () => {
    respondWith(() => makeResponse({ total: 214, hasMore: true }));
    renderPage();

    expect(await screen.findByRole('button', { name: 'Export current page' })).toBeEnabled();
  });

  it('surfaces the project-wide missing-docket count as a one-click filter', async () => {
    respondWith(() => makeResponse({ total: 214, hasMore: true, missingDocketCount: 17 }));
    const user = userEvent.setup();
    renderPage();

    const showAll = await screen.findByRole('button', { name: 'Show the 17' });
    await user.click(showAll);

    await waitFor(() =>
      expect(registerRequestPaths().some((path) => path.includes('docket=not_filed'))).toBe(true),
    );
  });

  it('never renders the accusatory "NO DOCKET" wording', async () => {
    respondWith(() => makeResponse({ missingDocketCount: 1 }));
    renderPage();

    expect(await screen.findAllByText('Not filed in CIVOS')).not.toHaveLength(0);
    expect(screen.queryByText(/NO DOCKET/i)).not.toBeInTheDocument();
  });
});
