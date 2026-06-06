import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  PendingApprovalsAlert,
  SubcontractorSummaryCards,
  SubcontractorsLoadErrorAlert,
  SubcontractorsPageHeader,
} from './SubcontractorsPageSections';

describe('SubcontractorsPageHeader', () => {
  it('shows removed count only when removed records are visible', () => {
    const { rerender } = render(
      <SubcontractorsPageHeader
        showRemoved={false}
        removedCount={3}
        onShowRemovedChange={vi.fn()}
        onInviteSubcontractor={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Subcontractors' })).toBeInTheDocument();
    expect(screen.getByText('Show removed')).toBeInTheDocument();

    rerender(
      <SubcontractorsPageHeader
        showRemoved
        removedCount={3}
        onShowRemovedChange={vi.fn()}
        onInviteSubcontractor={vi.fn()}
      />,
    );

    expect(screen.getByText('Show removed (3)')).toBeInTheDocument();
  });

  it('calls the header actions', async () => {
    const onShowRemovedChange = vi.fn();
    const onInviteSubcontractor = vi.fn();
    const user = userEvent.setup();

    render(
      <SubcontractorsPageHeader
        showRemoved={false}
        removedCount={0}
        onShowRemovedChange={onShowRemovedChange}
        onInviteSubcontractor={onInviteSubcontractor}
      />,
    );

    await user.click(screen.getByRole('switch', { name: 'Show removed subcontractors' }));
    await user.click(screen.getByRole('button', { name: 'Invite Subcontractor' }));

    expect(onShowRemovedChange).toHaveBeenCalledWith(true);
    expect(onInviteSubcontractor).toHaveBeenCalledTimes(1);
  });
});

describe('SubcontractorsLoadErrorAlert', () => {
  it('renders nothing without an error', () => {
    const { container } = render(
      <SubcontractorsLoadErrorAlert loadError={null} onRetry={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('calls retry from the load error alert', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();

    render(
      <SubcontractorsLoadErrorAlert loadError="Could not load subcontractors." onRetry={onRetry} />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Could not load subcontractors.');
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('PendingApprovalsAlert', () => {
  it('renders only when a summary is present', async () => {
    const onReviewPendingApprovals = vi.fn();
    const user = userEvent.setup();
    const { container, rerender } = render(
      <PendingApprovalsAlert summary="" onReviewPendingApprovals={onReviewPendingApprovals} />,
    );

    expect(container).toBeEmptyDOMElement();

    rerender(
      <PendingApprovalsAlert
        summary="1 subcontractor pending approval"
        onReviewPendingApprovals={onReviewPendingApprovals}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Review pending approvals' }));

    expect(screen.getByText('1 subcontractor pending approval')).toBeInTheDocument();
    expect(onReviewPendingApprovals).toHaveBeenCalledTimes(1);
  });
});

describe('SubcontractorSummaryCards', () => {
  it('renders subcontractor, employee, and cost totals', () => {
    render(
      <SubcontractorSummaryCards
        subcontractorCount={4}
        totalEmployees={12}
        totalCostLabel="$34,000"
      />,
    );

    expect(screen.getByText('Total Subcontractors')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('Total Employees')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Total Cost to Date')).toBeInTheDocument();
    expect(screen.getByText('$34,000')).toBeInTheDocument();
  });
});
