import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LotBreakdownReviewModal } from './LotBreakdownReviewModal';
import type { CopilotProposal, LotBreakdownCandidate } from './copilotData';
import type { ControlLine } from '../settings/controlLinesData';

const extractMutateAsync = vi.hoisted(() => vi.fn());
const decideMutateAsync = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => vi.fn());

vi.mock('./copilotData', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./copilotData')>()),
  useExtractLotBreakdown: () => ({ mutateAsync: extractMutateAsync, isLoading: false }),
  useDecideProposal: () => ({ mutateAsync: decideMutateAsync, isLoading: false }),
}));
vi.mock('@/components/ui/toaster', () => ({ toast: toastMock }));
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }));
vi.mock('@/lib/api', () => ({ apiFetch: vi.fn().mockResolvedValue({ templates: [] }) }));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  // BulkActivityRow calls useTemplateMatch (useQuery); no match data here means
  // the picker just shows the full template list.
  useQuery: () => ({ data: undefined }),
}));

const CONTROL_LINES: ControlLine[] = [
  {
    id: 'cl-1',
    projectId: 'project-1',
    name: 'MC01',
    coordinateSystem: 'EPSG:7856',
    points: [
      { chainage: 0, easting: 500000, northing: 6250000 },
      { chainage: 200, easting: 500200, northing: 6250000 },
    ],
    createdById: null,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
];

const CANDIDATE: LotBreakdownCandidate = {
  controlLineId: 'cl-1',
  startChainage: 0,
  endChainage: 200,
  interval: 100,
  lotPrefix: 'RD',
  activities: [{ activityType: 'Earthworks' }],
  offsetLeft: 5,
  offsetRight: 5,
};

const PROPOSAL = {
  id: 'p-1',
  status: 'proposed',
  payload: CANDIDATE,
  warnings: ['Derived from the control line only — add activities in review.'],
  sourceRefs: [{ note: 'From control line MC01' }],
} as unknown as CopilotProposal;

describe('LotBreakdownReviewModal', () => {
  beforeEach(() => {
    extractMutateAsync.mockReset();
    decideMutateAsync.mockReset();
    toastMock.mockReset();
  });

  it('reviews an existing candidate and applies concrete lots + geometry', async () => {
    decideMutateAsync.mockResolvedValue({ id: 'p-1', status: 'edited' });
    const onClose = vi.fn();

    render(
      <LotBreakdownReviewModal
        projectId="project-1"
        controlLines={CONTROL_LINES}
        existingProposal={PROPOSAL}
        onClose={onClose}
      />,
    );

    // 2 intervals × 1 activity = 2 lots, surfaced live and on the apply button.
    await waitFor(() => expect(screen.getByDisplayValue('RD')).toBeInTheDocument());
    expect(screen.getByText(/= 2 lots/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Create 2 lots/ }));

    await waitFor(() => expect(decideMutateAsync).toHaveBeenCalledTimes(1));
    const arg = decideMutateAsync.mock.calls[0][0];
    expect(arg.proposalId).toBe('p-1');
    expect(arg.action).toBe('accept');
    expect(arg.editedPayload.geometry).toEqual({
      controlLineId: 'cl-1',
      offsetLeft: 5,
      offsetRight: 5,
    });
    expect(arg.editedPayload.lots).toHaveLength(2);
    expect(arg.editedPayload.lots[0]).toMatchObject({
      lotNumber: 'RD-001',
      chainageStart: 0,
      chainageEnd: 100,
      activityType: 'Earthworks',
      lotType: 'chainage',
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('dismisses via the reject action', async () => {
    decideMutateAsync.mockResolvedValue({ id: 'p-1', status: 'rejected' });
    render(
      <LotBreakdownReviewModal
        projectId="project-1"
        controlLines={CONTROL_LINES}
        existingProposal={PROPOSAL}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByDisplayValue('RD')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    await waitFor(() =>
      expect(decideMutateAsync).toHaveBeenCalledWith({ proposalId: 'p-1', action: 'reject' }),
    );
  });
});
