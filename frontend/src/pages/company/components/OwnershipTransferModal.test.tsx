import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OwnershipTransferModal } from './OwnershipTransferModal';
import type { CompanyMember } from '../companySettingsData';

const MEMBERS: CompanyMember[] = [
  { id: 'member-1', email: 'jane@example.com', fullName: 'Jane Smith', roleInCompany: 'admin' },
  { id: 'member-2', email: 'noname@example.com', fullName: null, roleInCompany: 'foreman' },
];

function renderModal(overrides: Partial<Parameters<typeof OwnershipTransferModal>[0]> = {}) {
  const props = {
    members: [] as CompanyMember[],
    loadingMembers: false,
    selectedNewOwner: '',
    onSelectedNewOwnerChange: vi.fn(),
    transferring: false,
    transferError: '',
    onRetryLoadMembers: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn(),
    onTransfer: vi.fn(),
    ...overrides,
  };
  const view = render(<OwnershipTransferModal {...props} />);
  return { props, view };
}

describe('OwnershipTransferModal', () => {
  it('shows the empty state when there is nobody to transfer to', () => {
    renderModal();

    expect(
      screen.getByText('No other members in your company to transfer ownership to.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Invite team members first before transferring ownership.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Transfer Ownership' })).not.toBeInTheDocument();
  });

  it('hides the member select while members are loading', () => {
    renderModal({ loadingMembers: true });

    expect(screen.queryByLabelText('Select New Owner')).not.toBeInTheDocument();
    expect(
      screen.queryByText('No other members in your company to transfer ownership to.'),
    ).not.toBeInTheDocument();
  });

  it('shows the error alert with a retry action when the member load failed', () => {
    const { props } = renderModal({ transferError: 'Failed to load company members' });

    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load company members');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(props.onRetryLoadMembers).toHaveBeenCalledTimes(1);
  });

  it('lists members with role labels and email fallback, reporting selection changes', () => {
    const { props } = renderModal({ members: MEMBERS });

    expect(screen.getByText('Jane Smith (admin)')).toBeInTheDocument();
    expect(screen.getByText('noname@example.com (foreman)')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Select New Owner'), {
      target: { value: 'member-1' },
    });
    expect(props.onSelectedNewOwnerChange).toHaveBeenCalledWith('member-1');

    expect(screen.getByRole('button', { name: 'Transfer Ownership' })).toBeDisabled();
  });

  it('confirms the chosen member by name and enables the transfer action', () => {
    const { props } = renderModal({ members: MEMBERS, selectedNewOwner: 'member-1' });

    expect(screen.getByText(/You are about to transfer ownership to/)).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();

    const transferButton = screen.getByRole('button', { name: 'Transfer Ownership' });
    expect(transferButton).toBeEnabled();
    fireEvent.click(transferButton);
    expect(props.onTransfer).toHaveBeenCalledTimes(1);
  });

  it('locks the dialog while the transfer is in flight', () => {
    renderModal({ members: MEMBERS, selectedNewOwner: 'member-1', transferring: true });

    expect(screen.getByRole('button', { name: 'Transferring...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByLabelText('Select New Owner')).toBeDisabled();
  });

  it('closes via Cancel', () => {
    const { props } = renderModal({ members: MEMBERS });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});
