import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ModelLotLinkingReviewModal } from './ModelLotLinkingReviewModal';
import type { CopilotProposal, ModelLotLinkingCandidate } from './copilotData';

const extractMutateAsync = vi.hoisted(() => vi.fn());
const decideMutateAsync = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => vi.fn());
const fetchAllLotPagesMock = vi.hoisted(() => vi.fn());
const fetchDesignModelsMock = vi.hoisted(() => vi.fn());

vi.mock('./copilotData', () => ({
  useExtractModelLotLinking: () => ({ mutateAsync: extractMutateAsync, isLoading: false }),
  useDecideProposal: () => ({ mutateAsync: decideMutateAsync, isLoading: false }),
}));
vi.mock('@/components/ui/toaster', () => ({ toast: toastMock }));
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }));
vi.mock('@/lib/lots', () => ({ fetchAllLotPages: fetchAllLotPagesMock }));
vi.mock('@/lib/models/designModelsApi', () => ({ fetchDesignModels: fetchDesignModelsMock }));

const CANDIDATE: ModelLotLinkingCandidate = {
  versionId: 'version-1',
  links: [
    {
      elementId: 'el-1',
      ifcGuid: 'guid-1',
      lotNumberValue: 'EW-001',
      lotId: 'lot-a',
    },
    {
      elementId: 'el-2',
      ifcGuid: 'guid-2',
      lotNumberValue: 'EW-002',
      lotId: 'lot-b',
      source: 'manual',
      carriedForward: true,
    },
  ],
  ambiguous: [
    {
      elementId: 'el-3',
      ifcGuid: 'guid-3',
      lotNumberValue: 'DR-010',
      candidateLotIds: ['lot-c', 'lot-d'],
    },
  ],
  unlinked: [{ elementId: 'el-4', ifcGuid: 'guid-4', lotNumberValue: 'ZZ-999' }],
  unlinkedCount: 1,
  orphanedManual: [],
  counts: {
    elements: 4,
    linked: 2,
    ambiguous: 1,
    unlinked: 1,
    carriedForward: 1,
    orphanedManual: 0,
  },
};

const PROPOSAL: CopilotProposal = {
  id: 'proposal-1',
  projectId: 'project-1',
  stage: 'model_lot_linking',
  status: 'proposed',
  model: 'deterministic',
  sourceRefs: [{ fileName: 'bridge.ifc', note: 'Model Bridge, version 1' }],
  payload: CANDIDATE,
  warnings: [],
  editedPayload: null,
  decidedAt: null,
  createdAt: '2026-08-01T00:00:00.000Z',
};

function renderModal(props: Partial<Parameters<typeof ModelLotLinkingReviewModal>[0]> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ModelLotLinkingReviewModal
        projectId="project-1"
        existingProposal={PROPOSAL}
        onClose={vi.fn()}
        {...props}
      />
    </QueryClientProvider>,
  );
}

describe('ModelLotLinkingReviewModal', () => {
  beforeEach(() => {
    extractMutateAsync.mockReset();
    decideMutateAsync.mockReset();
    toastMock.mockReset();
    fetchAllLotPagesMock.mockReset();
    fetchDesignModelsMock.mockReset();
    fetchAllLotPagesMock.mockResolvedValue([
      { id: 'lot-c', lotNumber: 'DR-010' },
      { id: 'lot-d', lotNumber: 'DR-010A' },
    ]);
  });

  it('shows the coverage summary and the ambiguous decision bucket', async () => {
    renderModal();

    expect(screen.getByTestId('linking-summary')).toHaveTextContent('2 of 4 elements matched');
    expect(screen.getByTestId('linking-summary')).toHaveTextContent('1 need a decision');
    expect(screen.getByTestId('linking-summary')).toHaveTextContent(
      '1 manual links carried forward',
    );
    expect(screen.getByText(/had no matching lot number/)).toHaveTextContent('ZZ-999');

    // The candidate lots resolve to their lot numbers once the register loads.
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'DR-010A' })).toBeInTheDocument(),
    );
  });

  it('appends a resolved ambiguous element as a manual link in editedPayload', async () => {
    decideMutateAsync.mockResolvedValue({ id: 'proposal-1', status: 'edited' });
    const onClose = vi.fn();
    renderModal({ onClose });

    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'DR-010A' })).toBeInTheDocument(),
    );
    fireEvent.change(screen.getByLabelText('Lot for DR-010'), { target: { value: 'lot-d' } });

    fireEvent.click(screen.getByTestId('linking-apply'));
    await waitFor(() => expect(decideMutateAsync).toHaveBeenCalledTimes(1));
    expect(decideMutateAsync).toHaveBeenCalledWith({
      proposalId: 'proposal-1',
      action: 'accept',
      editedPayload: {
        versionId: 'version-1',
        links: [
          ...CANDIDATE.links,
          {
            elementId: 'el-3',
            ifcGuid: 'guid-3',
            lotNumberValue: 'DR-010',
            lotId: 'lot-d',
            source: 'manual',
          },
        ],
      },
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('an undecided ambiguous element stays unlinked and the button says so', async () => {
    decideMutateAsync.mockResolvedValue({ id: 'proposal-1', status: 'edited' });
    renderModal();

    expect(screen.getByTestId('linking-apply')).toHaveTextContent(
      'Apply 2 links (1 left unlinked)',
    );
    fireEvent.click(screen.getByTestId('linking-apply'));
    await waitFor(() => expect(decideMutateAsync).toHaveBeenCalledTimes(1));
    expect(decideMutateAsync.mock.calls[0][0].editedPayload.links).toHaveLength(2);
  });

  it('with no proposal, proposes links for the picked ready version', async () => {
    fetchDesignModelsMock.mockResolvedValue([
      {
        id: 'model-1',
        projectId: 'project-1',
        name: 'Bridge deck',
        createdAt: '',
        updatedAt: '',
        latestVersion: { id: 'version-9', versionNumber: 3, status: 'ready', fragSizeBytes: null },
      },
      {
        id: 'model-2',
        projectId: 'project-1',
        name: 'Still converting',
        createdAt: '',
        updatedAt: '',
        latestVersion: { id: 'version-x', versionNumber: 1, status: 'converting' },
      },
    ]);
    extractMutateAsync.mockResolvedValue({
      proposalId: 'proposal-2',
      candidate: CANDIDATE,
      warnings: [],
    });
    renderModal({ existingProposal: null });

    // Only the ready version is offered; a single option preselects itself.
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'Bridge deck — v3' })).toBeInTheDocument(),
    );
    expect(screen.queryByRole('option', { name: /Still converting/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Propose links' }));
    await waitFor(() => expect(extractMutateAsync).toHaveBeenCalledWith('version-9'));
    await waitFor(() => expect(screen.getByTestId('linking-summary')).toBeInTheDocument());
  });

  it('dismiss routes through the decision endpoint as a reject', async () => {
    decideMutateAsync.mockResolvedValue({ id: 'proposal-1', status: 'rejected' });
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    await waitFor(() =>
      expect(decideMutateAsync).toHaveBeenCalledWith({
        proposalId: 'proposal-1',
        action: 'reject',
      }),
    );
  });
});
