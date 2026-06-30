import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QueryClient } from '@tanstack/react-query';
import { createTestQueryClient, renderWithProviders } from '@/test/renderWithProviders';
import type { ProjectClaimReadiness } from '@/types/evidenceReadiness';
import { queryKeys } from '@/lib/queryKeys';

const apiFetchMock = vi.hoisted(() => vi.fn());
const downloadCsvMock = vi.hoisted(() => vi.fn());
const openDocumentAccessUrlMock = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => vi.fn());

// Keep the real ApiError/extractErrorMessage behaviour but drive apiFetch
// directly: the ClaimsPage tests below exercise the TanStack Query wiring
// (cache, invalidation), not the network layer.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: apiFetchMock };
});

vi.mock('@/lib/csv', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/csv')>();
  return { ...actual, downloadCsv: downloadCsvMock };
});

vi.mock('@/lib/documentAccess', () => ({
  openDocumentAccessUrl: openDocumentAccessUrlMock,
}));

vi.mock('@/components/ui/toaster', () => ({
  toast: toastMock,
}));

import {
  ClaimsAccessDeniedState,
  ClaimsLoadErrorAlert,
  ClaimsLoadingState,
  ClaimsPageHeader,
} from './ClaimsPageSections';
import { ClaimsPage } from './ClaimsPage';
import { ClaimsTable } from './components/ClaimsTable';
import { SubmitClaimModal } from './components/SubmitClaimModal';
import type { Claim } from './types';
import { calculatePaymentDueDate } from './utils';

beforeEach(() => {
  openDocumentAccessUrlMock.mockReset();
  toastMock.mockReset();
});

describe('ClaimsPageHeader', () => {
  it('hides CSV export when there are no claims', () => {
    render(<ClaimsPageHeader claimCount={0} onExportCSV={vi.fn()} onCreateClaim={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Progress Claims' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Help for Progress Claims' })).toBeInTheDocument();
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
        onDeleteDraftClaim={vi.fn()}
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

describe('ClaimsTable draft delete action', () => {
  it('shows a delete action for drafts only', async () => {
    const onDeleteDraftClaim = vi.fn();
    const user = userEvent.setup();

    render(
      <ClaimsTable
        claims={[
          SEEDED_CLAIM,
          {
            ...SEEDED_CLAIM,
            id: 'claim-2',
            claimNumber: 8,
            status: 'submitted',
            submittedAt: '2026-06-01T00:00:00.000Z',
          },
        ]}
        loadingCompleteness={false}
        showCompletenessModal={null}
        generatingEvidence={null}
        onCreateClaim={vi.fn()}
        onSubmitClaim={vi.fn()}
        onDeleteDraftClaim={onDeleteDraftClaim}
        onDisputeClaim={vi.fn()}
        onCertifyClaim={vi.fn()}
        onRecordPayment={vi.fn()}
        onCompletenessCheck={vi.fn()}
        onEvidencePackage={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('button', { name: 'Delete Draft Claim' })).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Delete Draft Claim' }));

    expect(onDeleteDraftClaim).toHaveBeenCalledWith('claim-1');
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

describe('ClaimsTable payment schedule wording', () => {
  it('labels the response deadline as payment schedule due, not certification due', () => {
    render(
      <ClaimsTable
        claims={[
          {
            ...SEEDED_CLAIM,
            status: 'submitted',
            submittedAt: '2026-06-01T00:00:00.000Z',
          },
        ]}
        loadingCompleteness={false}
        showCompletenessModal={null}
        generatingEvidence={null}
        onCreateClaim={vi.fn()}
        onSubmitClaim={vi.fn()}
        onDeleteDraftClaim={vi.fn()}
        onDisputeClaim={vi.fn()}
        onCertifyClaim={vi.fn()}
        onRecordPayment={vi.fn()}
        onCompletenessCheck={vi.fn()}
        onEvidencePackage={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('columnheader', { name: 'Indicative Payment Schedule Due' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Indicative Certification Due' })).toBeNull();
  });

  it('allows a partially paid claim to be disputed as well as paid further', () => {
    render(
      <ClaimsTable
        claims={[
          {
            ...SEEDED_CLAIM,
            status: 'partially_paid',
            certifiedAmount: 1000,
            paidAmount: 400,
            submittedAt: '2026-06-01T00:00:00.000Z',
          },
        ]}
        loadingCompleteness={false}
        showCompletenessModal={null}
        generatingEvidence={null}
        onCreateClaim={vi.fn()}
        onSubmitClaim={vi.fn()}
        onDeleteDraftClaim={vi.fn()}
        onDisputeClaim={vi.fn()}
        onCertifyClaim={vi.fn()}
        onRecordPayment={vi.fn()}
        onCompletenessCheck={vi.fn()}
        onEvidencePackage={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Mark as Disputed' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Record Payment' })).toBeInTheDocument();
  });
});

describe('ClaimsTable row CSV export', () => {
  beforeEach(() => {
    downloadCsvMock.mockReset();
  });

  it('falls back to calculated project-state payment due date when the claim omits one', async () => {
    const submittedAt = '2026-06-01T00:00:00.000Z';
    const expectedDueDate = new Date(
      calculatePaymentDueDate(submittedAt, 'WA') ?? '',
    ).toLocaleDateString('en-AU');

    render(
      <ClaimsTable
        claims={[
          {
            ...SEEDED_CLAIM,
            status: 'submitted',
            submittedAt,
            projectState: 'WA',
            paymentDueDate: null,
          },
        ]}
        loadingCompleteness={false}
        showCompletenessModal={null}
        generatingEvidence={null}
        onCreateClaim={vi.fn()}
        onSubmitClaim={vi.fn()}
        onDeleteDraftClaim={vi.fn()}
        onDisputeClaim={vi.fn()}
        onCertifyClaim={vi.fn()}
        onRecordPayment={vi.fn()}
        onCompletenessCheck={vi.fn()}
        onEvidencePackage={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Download CSV' }));

    expect(downloadCsvMock).toHaveBeenCalledWith(
      'claim-7.csv',
      expect.arrayContaining([expect.arrayContaining([expectedDueDate])]),
    );
  });
});

describe('SubmitClaimModal copy', () => {
  it('describes the CSV register export without implying an evidence package is included', () => {
    render(<SubmitClaimModal claim={SEEDED_CLAIM} onClose={vi.fn()} onSubmitted={vi.fn()} />);

    expect(screen.getByText(/claim summary CSV/i)).toBeInTheDocument();
    expect(screen.getAllByText(/register export/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/claim package/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/evidence package/i)).not.toBeInTheDocument();
  });
});

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
    downloadCsvMock.mockReset();
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

  it('invalidates claims, claim readiness, and lots after lifecycle mutations', async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    apiFetchMock.mockImplementation((path: string, options?: RequestInit) => {
      if (path === '/api/projects/p1/claims/claim-1' && options?.method === 'PUT') {
        return Promise.resolve({ claim: { ...SEEDED_CLAIM, status: 'submitted' } });
      }
      if (path === '/api/projects/p1/claims') {
        return Promise.resolve({ claims: [SEEDED_CLAIM] });
      }
      return Promise.reject(new Error(`Unexpected apiFetch path: ${path}`));
    });

    renderClaimsPage(queryClient);
    expect(await screen.findByText('Claim 7')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Submit Claim' }));
    fireEvent.click(await screen.findByRole('button', { name: /Download/ }));

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.claims('p1') }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.claimReadiness('p1') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.lots('p1') });
  });

  it('deletes a draft claim and releases related register caches', async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    let claimsResponse: Claim[] = [SEEDED_CLAIM];
    apiFetchMock.mockImplementation((path: string, options?: RequestInit) => {
      if (path === '/api/projects/p1/claims/claim-1' && options?.method === 'DELETE') {
        claimsResponse = [];
        return Promise.resolve({ message: 'Draft claim deleted' });
      }
      if (path === '/api/projects/p1/claims') {
        return Promise.resolve({ claims: claimsResponse });
      }
      return Promise.reject(new Error(`Unexpected apiFetch path: ${path}`));
    });

    renderClaimsPage(queryClient);
    expect(await screen.findByText('Claim 7')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete Draft Claim' }));
    const modal = await screen.findByRole('dialog');
    fireEvent.click(within(modal).getByRole('button', { name: 'Delete draft' }));

    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith('/api/projects/p1/claims/claim-1', {
        method: 'DELETE',
      }),
    );
    expect(await screen.findByRole('heading', { name: 'No claims yet' })).toBeInTheDocument();
    expect(queryClient.getQueryData<Claim[]>(queryKeys.claims('p1'))).toEqual([]);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.claims('p1') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.claimReadiness('p1') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.lots('p1') });
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Draft claim deleted',
        variant: 'success',
      }),
    );
  });

  it('uses the server submittedAt when optimistically updating a submitted claim', async () => {
    const queryClient = createTestQueryClient();
    const serverSubmittedAt = '2026-06-07T03:30:00.000Z';
    let claimsResponse: Claim[] = [SEEDED_CLAIM];
    apiFetchMock.mockImplementation((path: string, options?: RequestInit) => {
      if (path === '/api/projects/p1/claims/claim-1' && options?.method === 'PUT') {
        claimsResponse = [{ ...SEEDED_CLAIM, status: 'submitted', submittedAt: serverSubmittedAt }];
        return Promise.resolve({
          claim: { ...SEEDED_CLAIM, status: 'submitted', submittedAt: serverSubmittedAt },
        });
      }
      if (path === '/api/projects/p1/claims') {
        return Promise.resolve({ claims: claimsResponse });
      }
      return Promise.reject(new Error(`Unexpected apiFetch path: ${path}`));
    });

    renderClaimsPage(queryClient);
    expect(await screen.findByText('Claim 7')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Submit Claim' }));
    fireEvent.click(await screen.findByRole('button', { name: /Download/ }));

    await waitFor(() => {
      const cachedClaims = queryClient.getQueryData<Claim[]>(queryKeys.claims('p1'));
      expect(cachedClaims?.[0]?.submittedAt).toBe(serverSubmittedAt);
    });
  });

  it('keeps the evidence package modal open with an inline error when generation fails', async () => {
    apiFetchMock.mockImplementation((path: string) => {
      if (path === '/api/projects/p1/claims') {
        return Promise.resolve({ claims: [SEEDED_CLAIM] });
      }
      if (path === '/api/projects/p1/claims/claim-1/evidence-package') {
        return Promise.reject(new Error('Evidence service unavailable'));
      }
      return Promise.reject(new Error(`Unexpected apiFetch path: ${path}`));
    });

    renderClaimsPage();
    expect(await screen.findByText('Claim 7')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Generate Evidence Package' }));
    const modal = await screen.findByRole('dialog');
    fireEvent.click(within(modal).getByRole('button', { name: 'Generate Package' }));

    expect(await within(modal).findByRole('alert')).toHaveTextContent(
      'Evidence service unavailable',
    );
    expect(within(modal).getByRole('button', { name: 'Generate Package' })).toBeEnabled();
  });

  it('shows certification notes and certificate link from the optimistic cache immediately', async () => {
    const submittedClaim: Claim = {
      ...SEEDED_CLAIM,
      status: 'submitted',
      submittedAt: '2026-06-01T00:00:00.000Z',
    };
    let claimsLoads = 0;
    apiFetchMock.mockImplementation((path: string, options?: RequestInit) => {
      if (path === '/api/projects/p1/claims/claim-1/certify' && options?.method === 'POST') {
        return Promise.resolve({
          claim: {
            id: 'claim-1',
            status: 'certified',
            certifiedAmount: 90000,
            certifiedAt: '2026-06-10T00:00:00.000Z',
            variationNotes: 'Reduced after principal assessment',
            certificationDocumentId: 'doc-1',
          },
        });
      }
      if (path === '/api/projects/p1/claims') {
        claimsLoads += 1;
        if (claimsLoads > 1) {
          return new Promise(() => {});
        }
        return Promise.resolve({ claims: [submittedClaim] });
      }
      return Promise.reject(new Error(`Unexpected apiFetch path: ${path}`));
    });

    renderClaimsPage();
    expect(await screen.findByText('Claim 7')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Record Payment Schedule' }));
    const modal = await screen.findByRole('dialog');
    fireEvent.change(within(modal).getByLabelText('Certified Amount'), {
      target: { value: '90000' },
    });
    fireEvent.change(within(modal).getByLabelText('Variation Notes'), {
      target: { value: 'Reduced after principal assessment' },
    });
    fireEvent.click(within(modal).getByRole('button', { name: 'Record Payment Schedule' }));

    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith(
        '/api/projects/p1/claims/claim-1/certify',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    expect(await screen.findByText('Reduced after principal assessment')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View certificate' })).toBeInTheDocument();
  });

  it('shows a visible error when a certification document link cannot open', async () => {
    openDocumentAccessUrlMock.mockRejectedValue(new Error('signed URL failed'));

    render(
      <ClaimsTable
        claims={[
          {
            ...SEEDED_CLAIM,
            status: 'certified',
            certification: {
              certifiedByName: 'Principal Rep',
              variationNotes: null,
              certificationDocumentId: 'doc-1',
            },
          },
        ]}
        loadingCompleteness={false}
        showCompletenessModal={null}
        generatingEvidence={null}
        onCreateClaim={vi.fn()}
        onSubmitClaim={vi.fn()}
        onDeleteDraftClaim={vi.fn()}
        onDisputeClaim={vi.fn()}
        onCertifyClaim={vi.fn()}
        onRecordPayment={vi.fn()}
        onCompletenessCheck={vi.fn()}
        onEvidencePackage={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'View certificate' }));

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Certificate unavailable',
          variant: 'error',
        }),
      ),
    );
  });

  it('opens the recorded certification document when the view link succeeds', async () => {
    openDocumentAccessUrlMock.mockResolvedValue(undefined);

    render(
      <ClaimsTable
        claims={[
          {
            ...SEEDED_CLAIM,
            status: 'certified',
            certification: {
              certifiedByName: 'Principal Rep',
              variationNotes: null,
              certificationDocumentId: 'doc-1',
            },
          },
        ]}
        loadingCompleteness={false}
        showCompletenessModal={null}
        generatingEvidence={null}
        onCreateClaim={vi.fn()}
        onSubmitClaim={vi.fn()}
        onDeleteDraftClaim={vi.fn()}
        onDisputeClaim={vi.fn()}
        onCertifyClaim={vi.fn()}
        onRecordPayment={vi.fn()}
        onCompletenessCheck={vi.fn()}
        onEvidencePackage={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'View certificate' }));

    await waitFor(() =>
      expect(openDocumentAccessUrlMock).toHaveBeenCalledWith('doc-1', null, {
        disposition: 'inline',
      }),
    );
    expect(toastMock).not.toHaveBeenCalled();
  });
});
