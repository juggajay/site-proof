import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen } from '@/test/renderWithProviders';

// jsdom has no window.matchMedia — mock the media-query hook like the page test does.
vi.mock('@/hooks/useMediaQuery', () => ({
  useIsMobile: () => false,
}));

import { VariationDetailSheet } from './VariationDetailSheet';
import type { Variation } from '../types';

const SUBMITTED_VARIATION: Variation = {
  id: 'var-1',
  projectId: 'project-1',
  variationNumber: 'VAR-0001',
  title: 'Additional excavation',
  description: 'Hard rock removal outside original scope.',
  status: 'submitted',
  approvedAmount: null,
  clientReference: 'SI-11',
  lotId: null,
  claimedInId: null,
  submittedAt: '2026-07-01T00:00:00.000Z',
  approvedAt: null,
  rejectedAt: null,
  rejectionReason: null,
  createdById: 'user-1',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  evidence: [],
};

function renderDetail(overrides: Partial<React.ComponentProps<typeof VariationDetailSheet>> = {}) {
  const props = {
    isOpen: true,
    variation: SUBMITTED_VARIATION,
    lotsById: new Map(),
    actionLoading: false,
    onClose: vi.fn(),
    onEdit: vi.fn(),
    onSubmitVariation: vi.fn(),
    onApprove: vi.fn(),
    onReject: vi.fn(),
    onDelete: vi.fn(),
    onAddEvidence: vi.fn(),
    onRemoveEvidence: vi.fn(),
    ...overrides,
  };
  renderWithProviders(<VariationDetailSheet {...props} />);
  return props;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('VariationDetailSheet transitions', () => {
  it('requires a positive amount before approving a submitted variation', () => {
    const props = renderDetail();

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    fireEvent.click(screen.getByRole('button', { name: 'Approve Variation' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Approved amount must be greater than 0.');
    expect(props.onApprove).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Final approved amount/i), {
      target: { value: '2500.50' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Approve Variation' }));

    expect(props.onApprove).toHaveBeenCalledWith('var-1', 2500.5);
  });

  it('sends the rejection reason when rejecting a submitted variation', () => {
    const props = renderDetail();

    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    fireEvent.change(screen.getByLabelText(/Rejection reason/i), {
      target: { value: 'Client rejected the instruction.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reject Variation' }));

    expect(props.onReject).toHaveBeenCalledWith('var-1', 'Client rejected the instruction.');
  });
});
