import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/renderWithProviders';
import { PendingItpVerificationsSection } from './PendingItpVerificationsSection';
import * as data from '../pendingItpVerifications';
import type { PendingItpVerification } from '../pendingItpVerifications';

vi.mock('@/components/ui/toaster', () => ({ toast: vi.fn() }));

vi.mock('../pendingItpVerifications', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../pendingItpVerifications')>();
  return {
    ...actual,
    usePendingItpVerificationsQuery: vi.fn(),
    verifyItpCompletionRequest: vi.fn(),
    rejectItpCompletionRequest: vi.fn(),
  };
});

const useQueryMock = vi.mocked(data.usePendingItpVerificationsQuery);
const verifyMock = vi.mocked(data.verifyItpCompletionRequest);
const rejectMock = vi.mocked(data.rejectItpCompletionRequest);

const pendingItem: PendingItpVerification = {
  id: 'completion-1',
  status: 'completed',
  verificationStatus: 'pending_verification',
  completedAt: '2026-06-20T03:00:00.000Z',
  notes: null,
  completedBy: { id: 'subbie-1', fullName: 'Sub Bie', email: 's@x.test' },
  checklistItem: { id: 'item-1', description: 'Place bedding', responsibleParty: 'subcontractor' },
  lot: { id: 'lot-1', lotNumber: 'EW-001', description: null },
  template: { id: 't1', name: 'Earthworks ITP' },
  subcontractor: { id: 'sc-1', companyName: 'Acme Civil' },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function queryResult(overrides: Record<string, unknown> = {}): any {
  return {
    isError: false,
    isLoading: false,
    data: { pendingVerifications: [], count: 0 },
    refetch: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('PendingItpVerificationsSection (H4 queue)', () => {
  it('renders nothing when the query errors (non-reviewer 403)', () => {
    useQueryMock.mockReturnValue(queryResult({ isError: true, data: undefined }));

    renderWithProviders(<PendingItpVerificationsSection projectId="p1" currentUserId="v1" />);

    expect(screen.queryByText(/awaiting verification/i)).not.toBeInTheDocument();
  });

  it('shows an empty-state message when there is nothing to verify', () => {
    useQueryMock.mockReturnValue(queryResult());

    renderWithProviders(<PendingItpVerificationsSection projectId="p1" currentUserId="v1" />);

    expect(screen.getByText(/No ITP items are awaiting verification/i)).toBeInTheDocument();
  });

  it('lists pending items with Verify/Reject for a different reviewer', () => {
    useQueryMock.mockReturnValue(
      queryResult({ data: { pendingVerifications: [pendingItem], count: 1 } }),
    );

    renderWithProviders(
      <PendingItpVerificationsSection projectId="p1" currentUserId="verifier-1" />,
    );

    expect(screen.getByText('Place bedding')).toBeInTheDocument();
    expect(screen.getByText(/Lot EW-001/)).toBeInTheDocument();
    expect(screen.getByText(/Acme Civil/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verify' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
  });

  it('hides the actions on the reviewer’s own completion', () => {
    useQueryMock.mockReturnValue(
      queryResult({ data: { pendingVerifications: [pendingItem], count: 1 } }),
    );

    renderWithProviders(<PendingItpVerificationsSection projectId="p1" currentUserId="subbie-1" />);

    expect(screen.queryByRole('button', { name: 'Verify' })).not.toBeInTheDocument();
    expect(screen.getByText(/another reviewer must verify/i)).toBeInTheDocument();
  });

  it('verifies an item through the request', () => {
    verifyMock.mockResolvedValue(undefined);
    useQueryMock.mockReturnValue(
      queryResult({ data: { pendingVerifications: [pendingItem], count: 1 } }),
    );

    renderWithProviders(
      <PendingItpVerificationsSection projectId="p1" currentUserId="verifier-1" />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    expect(verifyMock).toHaveBeenCalledWith('completion-1');
  });

  it('rejects with a required reason via the modal', () => {
    rejectMock.mockResolvedValue(undefined);
    useQueryMock.mockReturnValue(
      queryResult({ data: { pendingVerifications: [pendingItem], count: 1 } }),
    );

    renderWithProviders(
      <PendingItpVerificationsSection projectId="p1" currentUserId="verifier-1" />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    fireEvent.change(screen.getByLabelText(/Reason for rejection/i), {
      target: { value: 'Photo missing chainage marker' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reject item' }));

    expect(rejectMock).toHaveBeenCalledWith('completion-1', 'Photo missing chainage marker');
  });
});
