import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent, waitFor } from '@/test/renderWithProviders';
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
    apiFetchMock.mockResolvedValue({ lots: [] });

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
    apiFetchMock.mockResolvedValue(READY_LOT_READINESS);

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
    // Only the readiness load hit the API — no claim POST was attempted.
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });

  it('requires both period dates before a claim can be created', async () => {
    apiFetchMock.mockResolvedValue(READY_LOT_READINESS);

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
  it('notifies the parent after a successful create so it can invalidate the claims cache', async () => {
    const onClaimCreated = vi.fn();
    const onClose = vi.fn();
    apiFetchMock.mockImplementation((_path: string, options?: RequestInit) => {
      if (options?.method === 'POST') {
        return Promise.resolve({ claim: { id: 'claim-1' } });
      }
      return Promise.resolve(READY_LOT_READINESS);
    });

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
});
