import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { fireEvent, renderWithProviders, screen, waitFor } from '@/test/renderWithProviders';

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: apiFetchMock };
});

vi.mock('@/lib/auth', () => ({
  getAuthToken: () => 'token',
}));

vi.mock('@/hooks/useMediaQuery', () => ({
  useIsMobile: () => false,
}));

import { VariationsPage } from './VariationsPage';
import type { Variation } from './types';

const LOTS_RESPONSE = {
  lots: [
    { id: 'lot-1', lotNumber: 'LOT-001', description: 'North abutment' },
    { id: 'lot-2', lotNumber: 'LOT-002', description: 'South abutment' },
  ],
};

const VARIATIONS: Variation[] = [
  {
    id: 'var-approved',
    projectId: 'project-1',
    variationNumber: 'VAR-0002',
    title: 'Extra drainage outlet',
    description: 'Added outlet at chainage 120.',
    status: 'approved',
    approvedAmount: 12500,
    clientReference: 'SI-17',
    lotId: 'lot-1',
    claimedInId: null,
    submittedAt: '2026-07-01T00:00:00.000Z',
    approvedAt: '2026-07-02T00:00:00.000Z',
    rejectedAt: null,
    rejectionReason: null,
    createdById: 'user-1',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-02T00:00:00.000Z',
    evidence: [],
  },
  {
    id: 'var-submitted',
    projectId: 'project-1',
    variationNumber: 'VAR-0001',
    title: 'Night shift traffic control',
    description: null,
    status: 'submitted',
    approvedAmount: null,
    clientReference: null,
    lotId: 'lot-2',
    claimedInId: null,
    submittedAt: '2026-07-03T00:00:00.000Z',
    approvedAt: null,
    rejectedAt: null,
    rejectionReason: null,
    createdById: 'user-1',
    createdAt: '2026-07-03T00:00:00.000Z',
    updatedAt: '2026-07-03T00:00:00.000Z',
    evidence: [],
  },
];

function mockVariationApis(variations: Variation[]) {
  apiFetchMock.mockImplementation((path: string, options?: RequestInit) => {
    if (options?.method === 'POST') {
      return Promise.resolve({ variation: { ...VARIATIONS[0], id: 'var-created' } });
    }
    if (path === '/api/projects/project-1/variations') {
      return Promise.resolve({ variations });
    }
    if (path === '/api/lots?projectId=project-1') {
      return Promise.resolve(LOTS_RESPONSE);
    }
    return Promise.reject(new Error(`Unexpected request: ${path}`));
  });
}

function renderPage() {
  // renderWithProviders mounts children directly in a MemoryRouter — the page
  // reads :projectId via useParams, so it needs a real Route wrapper or its
  // queries stay disabled forever.
  return renderWithProviders(
    <Routes>
      <Route path="/projects/:projectId/variations" element={<VariationsPage />} />
    </Routes>,
    {
      initialEntries: ['/projects/project-1/variations'],
    },
  );
}

beforeEach(() => {
  apiFetchMock.mockReset();
});

describe('VariationsPage', () => {
  it('renders register rows and filters by status', async () => {
    mockVariationApis(VARIATIONS);

    renderPage();

    expect(await screen.findByText('VAR-0002')).toBeInTheDocument();
    expect(screen.getByText('Extra drainage outlet')).toBeInTheDocument();
    expect(screen.getByText('SI-17')).toBeInTheDocument();
    expect(screen.getByText('LOT-001')).toBeInTheDocument();
    expect(screen.getByText('$12,500.00')).toBeInTheDocument();
    expect(screen.getByText('Submitted')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Approved 1/i }));

    expect(screen.getByText('Extra drainage outlet')).toBeInTheDocument();
    expect(screen.queryByText('Night shift traffic control')).not.toBeInTheDocument();
  });

  it('shows the empty-state teaching copy and opens the create modal', async () => {
    mockVariationApis([]);

    renderPage();

    expect(await screen.findByText('No variations yet')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Track changed or extra work, get it approved, claim it in a progress claim',
      ),
    ).toBeInTheDocument();

    // Header and empty-state CTA both say "New Variation" — either works.
    fireEvent.click(screen.getAllByRole('button', { name: /New Variation/i })[0]);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'New Variation' })).toBeInTheDocument();
  });

  it('creates a variation with an optional amount omitted from the POST body', async () => {
    mockVariationApis([]);

    renderPage();

    fireEvent.click((await screen.findAllByRole('button', { name: /New Variation/i }))[0]);
    fireEvent.change(screen.getByLabelText(/Title/i), {
      target: { value: 'Client-directed kerb change' },
    });
    fireEvent.change(screen.getByLabelText(/Description/i), {
      target: { value: 'Change from mountable to barrier kerb.' },
    });
    fireEvent.change(screen.getByLabelText(/Client reference/i), {
      target: { value: 'VO-42' },
    });
    fireEvent.change(screen.getByLabelText(/Lot/i), { target: { value: 'lot-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Variation' }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith('/api/projects/project-1/variations', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Client-directed kerb change',
          description: 'Change from mountable to barrier kerb.',
          clientReference: 'VO-42',
          lotId: 'lot-1',
        }),
      });
    });
  });
});
