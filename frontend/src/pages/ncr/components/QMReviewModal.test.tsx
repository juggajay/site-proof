import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// apiFetch/toast/errorHandling are only used on submit, not on render; mock the
// api boundary lightly so module load never touches the network.
vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/components/ui/toaster', () => ({ toast: vi.fn() }));
vi.mock('@/lib/errorHandling', () => ({ handleApiError: vi.fn() }));

import { QMReviewModal } from './QMReviewModal';
import type { NCR } from '../types';

const baseNcr: NCR = {
  id: 'ncr-1',
  ncrNumber: 'NCR-001',
  description: 'Cracked slab in bay 3',
  category: 'workmanship',
  severity: 'major',
  status: 'verification',
  qmApprovalRequired: true,
  qmApprovedAt: null,
  raisedBy: { fullName: 'Raiser', email: 'r@example.com' },
  createdAt: '2026-06-01T00:00:00.000Z',
  project: { name: 'Hwy Upgrade', projectNumber: 'P-1' },
  ncrLots: [],
};

describe('QMReviewModal', () => {
  it('renders the submitted root cause and corrective action so the QM does not review blind', () => {
    const ncr: NCR = {
      ...baseNcr,
      rootCauseCategory: 'Process',
      rootCauseDescription: 'Concrete poured below the specified temperature.',
      proposedCorrectiveAction: 'Re-pour the affected bay and add a temperature hold point.',
    };

    render(<QMReviewModal isOpen ncr={ncr} onClose={vi.fn()} onSuccess={vi.fn()} />);

    expect(
      screen.getByText('Concrete poured below the specified temperature.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Re-pour the affected bay and add a temperature hold point.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Process/)).toBeInTheDocument();
  });

  it('shows a clear placeholder when the response details are missing instead of crashing', () => {
    const ncr: NCR = {
      ...baseNcr,
      rootCauseCategory: null,
      rootCauseDescription: null,
      proposedCorrectiveAction: null,
    };

    render(<QMReviewModal isOpen ncr={ncr} onClose={vi.fn()} onSuccess={vi.fn()} />);

    expect(screen.getByText(/no response details/i)).toBeInTheDocument();
  });
});
