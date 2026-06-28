import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NCRMobileDetailSheet } from './NCRMobileDetailSheet';
import type { NCR, UserRole } from '../types';

// Render the desktop Modal branch of ResponsiveSheet so the test does not depend
// on the BottomSheet's framer-motion drag machinery. The sheet's action gating
// is identical on both branches.
vi.mock('@/hooks/useMediaQuery', () => ({ useIsMobile: () => false }));

function makeNcr(overrides: Partial<NCR> = {}): NCR {
  return {
    id: 'ncr-1',
    ncrNumber: 'NCR-001',
    description: 'Cracked slab',
    category: 'workmanship',
    severity: 'minor',
    status: 'open',
    qmApprovalRequired: false,
    qmApprovedAt: null,
    raisedBy: { fullName: 'Raiser', email: 'r@x.test' },
    createdAt: '2026-06-01T00:00:00.000Z',
    project: { name: 'Proj', projectNumber: 'P-1' },
    ncrLots: [],
    ...overrides,
  };
}

function role(overrides: Partial<UserRole> = {}): UserRole {
  return { role: 'viewer', isQualityManager: false, canApproveNCRs: false, ...overrides };
}

function handlers() {
  return {
    onClose: vi.fn(),
    onAssign: vi.fn(),
    onRespond: vi.fn(),
    onReviewResponse: vi.fn(),
    onQmApprove: vi.fn(),
    onNotifyClient: vi.fn(),
    onRectify: vi.fn(),
    onRejectRectification: vi.fn(),
    onCloseNcr: vi.fn(),
    onConcession: vi.fn(),
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('NCRMobileDetailSheet (H7)', () => {
  it('renders nothing without an NCR', () => {
    render(<NCRMobileDetailSheet isOpen ncr={null} userRole={role()} {...handlers()} />);
    expect(screen.queryByText(/NCR-001/)).not.toBeInTheDocument();
  });

  it('shows the detail and Respond for the responsible user on an open NCR, and fires onRespond', () => {
    const h = handlers();
    render(
      <NCRMobileDetailSheet
        isOpen
        ncr={makeNcr({ status: 'open', responsibleUserId: 'user-1' })}
        userRole={role({ role: 'foreman' })}
        currentUserId="user-1"
        {...h}
      />,
    );

    expect(screen.getByText('Cracked slab')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Respond' }));
    expect(h.onRespond).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Close NCR' })).not.toBeInTheDocument();
  });

  it('offers Close / Concession / Reject Rectification to a manager in verification', () => {
    const h = handlers();
    render(
      <NCRMobileDetailSheet
        isOpen
        ncr={makeNcr({ status: 'verification', severity: 'minor' })}
        userRole={role({ role: 'project_manager' })}
        {...h}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close NCR' }));
    expect(h.onCloseNcr).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Close with Concession' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject Rectification' })).toBeInTheDocument();
  });

  it('disables Close for a major NCR pending QM approval and offers QM Approve to the QM', () => {
    const h = handlers();
    render(
      <NCRMobileDetailSheet
        isOpen
        ncr={makeNcr({ status: 'verification', severity: 'major', qmApprovedAt: null })}
        userRole={role({ role: 'quality_manager', isQualityManager: true })}
        {...h}
      />,
    );

    const closeButton = screen.getByRole('button', { name: 'Close NCR' });
    expect(closeButton).toBeDisabled();
    expect(closeButton).toHaveAttribute('title', 'Requires QM approval first');

    fireEvent.click(screen.getByRole('button', { name: 'QM Approve' }));
    expect(h.onQmApprove).toHaveBeenCalledWith('ncr-1');
  });

  it('explains when no actions are available', () => {
    render(
      <NCRMobileDetailSheet
        isOpen
        ncr={makeNcr({ status: 'closed' })}
        userRole={role()}
        {...handlers()}
      />,
    );
    expect(screen.getByText(/No actions are available/i)).toBeInTheDocument();
  });
});
