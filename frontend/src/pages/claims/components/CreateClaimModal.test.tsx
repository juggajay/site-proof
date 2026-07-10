import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  createTestQueryClient,
  renderWithProviders,
  screen,
  fireEvent,
  waitFor,
} from '@/test/renderWithProviders';
import { queryKeys } from '@/lib/queryKeys';
import type { ProjectClaimReadiness } from '@/types/evidenceReadiness';

const apiFetchMock = vi.hoisted(() => vi.fn());

// Keep the real ApiError/extractErrorMessage behaviour but drive apiFetch
// directly: these tests isolate the modal's client-side guidance, not the
// network layer.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: apiFetchMock };
});

import { CreateClaimModal } from './CreateClaimModal';

const READY_LOT_READINESS: ProjectClaimReadiness = {
  lots: [
    {
      lotId: 'lot-1',
      lotNumber: 'LOT-001',
      activityType: 'Earthworks',
      claim: {
        state: 'ready',
        blockers: [],
        warnings: [],
        support: [],
        budgetAmount: 100000,
        claimedPercentage: 0,
        remainingPercentage: 100,
      },
    },
  ],
};

const APPROVED_VARIATIONS_RESPONSE = {
  variations: [
    {
      id: '11111111-1111-4111-8111-111111111111',
      variationNumber: 'VAR-0007',
      title: 'Client-directed drainage change',
      status: 'approved',
      approvedAmount: 5500,
      clientReference: 'SI-7',
      lotId: null,
      claimedInId: null,
      evidence: [],
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      variationNumber: 'VAR-0008',
      title: 'Unapproved traffic control',
      status: 'submitted',
      approvedAmount: 1200,
      clientReference: null,
      lotId: null,
      claimedInId: null,
      evidence: [],
    },
  ],
};

function mockClaimReadinessAndVariations({
  readiness = READY_LOT_READINESS,
  variations = APPROVED_VARIATIONS_RESPONSE,
  postResponse = { claim: { id: 'claim-1' } },
}: {
  readiness?: ProjectClaimReadiness;
  variations?: { variations: unknown[] };
  postResponse?: unknown;
} = {}) {
  apiFetchMock.mockImplementation((path: string, options?: RequestInit) => {
    if (options?.method === 'POST') {
      return Promise.resolve(postResponse);
    }
    if (path === '/api/projects/p1/claim-readiness') {
      return Promise.resolve(readiness);
    }
    if (path === '/api/projects/p1/variations') {
      return Promise.resolve(variations);
    }
    return Promise.reject(new Error(`Unexpected request: ${path}`));
  });
}

function renderModal() {
  return renderWithProviders(
    <CreateClaimModal projectId="p1" onClose={vi.fn()} onClaimCreated={vi.fn()} />,
  );
}

beforeEach(() => {
  apiFetchMock.mockReset();
});

describe('CreateClaimModal conformed-lot zero state', () => {
  it('explains the conformed-lot prerequisite and links to lots instead of dead-ending', async () => {
    mockClaimReadinessAndVariations({
      readiness: { lots: [] },
      variations: { variations: [] },
    });

    renderModal();

    expect(await screen.findByText('No conformed lots to claim yet')).toBeInTheDocument();
    expect(screen.getByText(/Claims are built from conformed lots/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Lots' })).toHaveAttribute(
      'href',
      '/projects/p1/lots',
    );
  });
});

describe('CreateClaimModal claim period validation', () => {
  it('shows an inline error and disables Create Claim when the period ends before it starts', async () => {
    mockClaimReadinessAndVariations({ variations: { variations: [] } });

    renderModal();

    expect(await screen.findByText('LOT-001')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Select LOT-001'));
    expect(screen.getByRole('button', { name: 'Create Claim' })).toBeEnabled();

    fireEvent.change(screen.getByLabelText('Period Start'), {
      target: { value: '2026-06-10' },
    });
    fireEvent.change(screen.getByLabelText('Period End'), {
      target: { value: '2026-06-01' },
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Period end must be on or after period start.',
    );
    expect(screen.getByRole('button', { name: 'Create Claim' })).toBeDisabled();
    // Only the initial readiness/variation loads hit the API — no claim POST was attempted.
    expect(apiFetchMock).toHaveBeenCalledTimes(2);
  });

  it('requires both period dates before a claim can be created', async () => {
    mockClaimReadinessAndVariations({ variations: { variations: [] } });

    renderModal();

    expect(await screen.findByText('LOT-001')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Select LOT-001'));
    fireEvent.change(screen.getByLabelText('Period End'), { target: { value: '' } });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Period start and period end are required.',
    );
    expect(screen.getByRole('button', { name: 'Create Claim' })).toBeDisabled();
  });
});

describe('CreateClaimModal create flow', () => {
  it('gives each selected lot percentage input a lot-specific accessible name', async () => {
    mockClaimReadinessAndVariations({
      readiness: {
        lots: [
          READY_LOT_READINESS.lots[0],
          {
            ...READY_LOT_READINESS.lots[0],
            lotId: 'lot-2',
            lotNumber: 'LOT-002',
          },
        ],
      },
      variations: { variations: [] },
    });

    renderModal();

    expect(await screen.findByText('LOT-001')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Select LOT-001'));
    fireEvent.click(screen.getByLabelText('Select LOT-002'));

    expect(screen.getByLabelText(/claim this time.*LOT-001/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/claim this time.*LOT-002/i)).toBeInTheDocument();
  });

  it('requires selected lot claim increments to be greater than zero', async () => {
    mockClaimReadinessAndVariations({ variations: { variations: [] } });

    renderModal();

    expect(await screen.findByText('LOT-001')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Select LOT-001'));
    fireEvent.change(screen.getByLabelText(/claim this time.*LOT-001/i), {
      target: { value: '0' },
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Claim percentage must be greater than 0.');
    expect(screen.getByRole('button', { name: 'Create Claim' })).toBeDisabled();
  });

  it('notifies the parent after a successful create so it can invalidate the claims cache', async () => {
    const onClaimCreated = vi.fn();
    const onClose = vi.fn();
    mockClaimReadinessAndVariations({ variations: { variations: [] } });

    renderWithProviders(
      <CreateClaimModal projectId="p1" onClose={onClose} onClaimCreated={onClaimCreated} />,
    );

    expect(await screen.findByText('LOT-001')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Select LOT-001'));
    fireEvent.click(screen.getByRole('button', { name: 'Create Claim' }));

    // The parent (ClaimsPage) invalidates queryKeys.claims(projectId) inside
    // onClaimCreated — this pins that a successful POST actually reaches it.
    await waitFor(() => expect(onClaimCreated).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalledTimes(1);

    const postCall = apiFetchMock.mock.calls.find(
      (call) => (call[1] as RequestInit | undefined)?.method === 'POST',
    );
    expect(postCall?.[0]).toBe('/api/projects/p1/claims');
  });

  it('reuses the same requestKey across a retry after a failed create (F-03)', async () => {
    // F-03: a lost-response retry must carry the SAME requestKey so the server
    // treats it as a replay of one operation, not a second billable claim.
    let postCount = 0;
    apiFetchMock.mockImplementation((path: string, options?: RequestInit) => {
      if (options?.method === 'POST') {
        postCount += 1;
        return postCount === 1
          ? Promise.reject(new Error('network dropped the response'))
          : Promise.resolve({ claim: { id: 'claim-1' } });
      }
      if (path === '/api/projects/p1/claim-readiness') {
        return Promise.resolve(READY_LOT_READINESS);
      }
      if (path === '/api/projects/p1/variations') {
        return Promise.resolve({ variations: [] });
      }
      return Promise.reject(new Error(`Unexpected request: ${path}`));
    });

    renderModal();

    expect(await screen.findByText('LOT-001')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Select LOT-001'));

    fireEvent.click(screen.getByRole('button', { name: 'Create Claim' }));
    await waitFor(() => expect(postCount).toBe(1));

    fireEvent.click(screen.getByRole('button', { name: 'Create Claim' }));
    await waitFor(() => expect(postCount).toBe(2));

    const bodies = apiFetchMock.mock.calls
      .filter((call) => (call[1] as RequestInit | undefined)?.method === 'POST')
      .map((call) => JSON.parse(String((call[1] as RequestInit).body)));
    expect(bodies).toHaveLength(2);
    expect(bodies[0].requestKey).toBeTruthy();
    expect(bodies[1].requestKey).toBe(bodies[0].requestKey);
  });

  it('renders approved variations, includes selected variationIds, and folds them into the total', async () => {
    mockClaimReadinessAndVariations();

    renderModal();

    expect(await screen.findByText('Approved variations')).toBeInTheDocument();
    expect(screen.getByText('VAR-0007')).toBeInTheDocument();
    expect(screen.getByText('Client-directed drainage change')).toBeInTheDocument();
    expect(screen.queryByText('Unapproved traffic control')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Select LOT-001'));
    fireEvent.click(screen.getByLabelText('Select variation VAR-0007'));

    expect(screen.getByText('$105,500')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Create Claim' }));

    await waitFor(() => {
      const postCall = apiFetchMock.mock.calls.find(
        (call) => (call[1] as RequestInit | undefined)?.method === 'POST',
      );
      expect(JSON.parse(String((postCall?.[1] as RequestInit).body))).toMatchObject({
        variationIds: ['11111111-1111-4111-8111-111111111111'],
      });
    });
  });

  it('shares the variations cache key with the register page using the bare-array shape', async () => {
    mockClaimReadinessAndVariations();
    const queryClient = createTestQueryClient();
    // useVariationsData (the Variations register) stores the BARE ARRAY under
    // this key. The modal shares the key, so it must read and write the same
    // shape — a mismatch either hides approved variations here or crashes the
    // register page's `.filter` with the modal's stale object still cached.
    queryClient.setQueryData(queryKeys.variations('p1'), APPROVED_VARIATIONS_RESPONSE.variations);

    renderWithProviders(
      <CreateClaimModal projectId="p1" onClose={vi.fn()} onClaimCreated={vi.fn()} />,
      { queryClient },
    );

    // Read side: the register-shaped cache must surface approved variations.
    expect(await screen.findByText('Approved variations')).toBeInTheDocument();
    expect(screen.getByText('VAR-0007')).toBeInTheDocument();

    // Write side: force the modal's own queryFn to run and confirm it stores
    // the array back, not the raw API response object.
    await queryClient.invalidateQueries({ queryKey: queryKeys.variations('p1') });
    await waitFor(() => {
      expect(Array.isArray(queryClient.getQueryData(queryKeys.variations('p1')))).toBe(true);
    });
  });

  it('hides the approved variations section when there are no approved variations', async () => {
    mockClaimReadinessAndVariations({
      variations: { variations: [APPROVED_VARIATIONS_RESPONSE.variations[1]] },
    });

    renderModal();

    expect(await screen.findByText('LOT-001')).toBeInTheDocument();
    expect(screen.queryByText('Approved variations')).not.toBeInTheDocument();
  });
});
