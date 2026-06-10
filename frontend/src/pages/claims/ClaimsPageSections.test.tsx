import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QueryClient } from '@tanstack/react-query';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { ProjectClaimReadiness } from '@/types/evidenceReadiness';

const apiFetchMock = vi.hoisted(() => vi.fn());

// Keep the real ApiError/extractErrorMessage behaviour but drive apiFetch
// directly: the ClaimsPage tests below exercise the TanStack Query wiring
// (cache, invalidation), not the network layer.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: apiFetchMock };
});

import {
  ClaimsAccessDeniedState,
  ClaimsLoadErrorAlert,
  ClaimsLoadingState,
  ClaimsPageHeader,
} from './ClaimsPageSections';
import { ClaimsPage } from './ClaimsPage';
import { ClaimsTable } from './components/ClaimsTable';
import type { Claim } from './types';

describe('ClaimsPageHeader', () => {
  it('hides CSV export when there are no claims', () => {
    render(<ClaimsPageHeader claimCount={0} onExportCSV={vi.fn()} onCreateClaim={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Progress Claims' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Export CSV' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New Claim' })).toBeInTheDocument();
  });

  it('calls header actions when claims exist', async () => {
    const onExportCSV = vi.fn();
    const onCreateClaim = vi.fn();
    const user = userEvent.setup();

    render(
      <ClaimsPageHeader claimCount={2} onExportCSV={onExportCSV} onCreateClaim={onCreateClaim} />,
    );

    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    await user.click(screen.getByRole('button', { name: 'New Claim' }));

    expect(onExportCSV).toHaveBeenCalledTimes(1);
    expect(onCreateClaim).toHaveBeenCalledTimes(1);
  });
});

describe('ClaimsLoadErrorAlert', () => {
  it('renders nothing without an error', () => {
    const { container } = render(<ClaimsLoadErrorAlert loadError={null} onRetry={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('calls retry from the load error alert', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();

    render(<ClaimsLoadErrorAlert loadError="Could not load claims." onRetry={onRetry} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Could not load claims.');
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('ClaimsLoadingState', () => {
  it('renders the loading spinner shell', () => {
    const { container } = render(<ClaimsLoadingState />);

    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });
});

describe('ClaimsTable empty state', () => {
  it('teaches the conformed-lot prerequisite and keeps the create CTA', async () => {
    const onCreateClaim = vi.fn();
    const user = userEvent.setup();

    render(
      <ClaimsTable
        claims={[]}
        loadingCompleteness={false}
        showCompletenessModal={null}
        generatingEvidence={null}
        onCreateClaim={onCreateClaim}
        onSubmitClaim={vi.fn()}
        onDisputeClaim={vi.fn()}
        onCertifyClaim={vi.fn()}
        onRecordPayment={vi.fn()}
        onCompletenessCheck={vi.fn()}
        onEvidencePackage={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'No claims yet' })).toBeInTheDocument();
    expect(screen.getByText(/Claims are built from conformed lots/)).toBeInTheDocument();
    expect(screen.queryByText(/Create your first progress claim/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Create Claim' }));
    expect(onCreateClaim).toHaveBeenCalledTimes(1);
  });
});

describe('ClaimsAccessDeniedState', () => {
  it('passes through the access denied message', () => {
    render(
      <MemoryRouter>
        <ClaimsAccessDeniedState message="Claims are not available for this project." />
      </MemoryRouter>,
    );

    expect(screen.getByText('Claims are not available for this project.')).toBeInTheDocument();
  });
});

const SEEDED_CLAIM: Claim = {
  id: 'claim-1',
  claimNumber: 7,
  periodStart: '2026-05-01',
  periodEnd: '2026-05-31',
  status: 'draft',
  totalClaimedAmount: 120000,
  certifiedAmount: null,
  paidAmount: null,
  submittedAt: null,
  disputeNotes: null,
  disputedAt: null,
  lotCount: 3,
};

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

function renderClaimsPage(queryClient?: QueryClient) {
  return renderWithProviders(
    <Routes>
      <Route path="/projects/:projectId/claims" element={<ClaimsPage />} />
    </Routes>,
    { initialEntries: ['/projects/p1/claims'], ...(queryClient ? { queryClient } : {}) },
  );
}

function countRegisterLoads() {
  return apiFetchMock.mock.calls.filter(
    (call) =>
      call[0] === '/api/projects/p1/claims' &&
      (call[1] as RequestInit | undefined)?.method !== 'POST',
  ).length;
}

describe('ClaimsPage TanStack Query register', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('renders revisits instantly from cache without refetching inside staleTime', async () => {
    apiFetchMock.mockResolvedValue({ claims: [SEEDED_CLAIM] });

    const first = renderClaimsPage();
    expect(await screen.findByText('Claim 7')).toBeInTheDocument();
    expect(countRegisterLoads()).toBe(1);
    first.unmount();

    // Revisit with the same QueryClient: the fresh cache renders the register
    // synchronously — no full-page spinner and no second network request.
    const second = renderClaimsPage(first.queryClient);
    expect(screen.getByText('Claim 7')).toBeInTheDocument();
    expect(second.container.querySelector('.animate-spin')).not.toBeInTheDocument();
    expect(countRegisterLoads()).toBe(1);
  });

  it('invalidates the claims key after create so the register refetches', async () => {
    let claimsResponse: { claims: Claim[] } = { claims: [] };
    apiFetchMock.mockImplementation((path: string, options?: RequestInit) => {
      if (path === '/api/projects/p1/claim-readiness') {
        return Promise.resolve(READY_LOT_READINESS);
      }
      if (path === '/api/projects/p1/claims' && options?.method === 'POST') {
        claimsResponse = { claims: [SEEDED_CLAIM] };
        return Promise.resolve({ claim: SEEDED_CLAIM });
      }
      if (path === '/api/projects/p1/claims') {
        return Promise.resolve(claimsResponse);
      }
      return Promise.reject(new Error(`Unexpected apiFetch path: ${path}`));
    });

    renderClaimsPage();
    expect(await screen.findByRole('heading', { name: 'No claims yet' })).toBeInTheDocument();
    expect(countRegisterLoads()).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: 'New Claim' }));
    const modal = await screen.findByRole('dialog');
    fireEvent.click(await within(modal).findByLabelText('Select LOT-001'));
    fireEvent.click(within(modal).getByRole('button', { name: 'Create Claim' }));

    // onClaimCreated invalidates queryKeys.claims('p1'): the register refetches
    // and shows the new claim without a manual reload.
    expect(await screen.findByText('Claim 7')).toBeInTheDocument();
    expect(countRegisterLoads()).toBe(2);
  });
});
