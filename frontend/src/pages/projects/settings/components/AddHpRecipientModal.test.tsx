import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AddHpRecipientModal } from './AddHpRecipientModal';

afterEach(() => {
  cleanup();
});

function renderModal(overrides: Partial<Parameters<typeof AddHpRecipientModal>[0]> = {}) {
  const props = {
    newRecipientRole: '',
    setNewRecipientRole: vi.fn(),
    newRecipientEmail: '',
    setNewRecipientEmail: vi.fn(),
    recipientError: '',
    savingRecipients: false,
    closeRecipientModal: vi.fn(),
    handleAddRecipient: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  render(<AddHpRecipientModal {...props} />);
  return props;
}

describe('AddHpRecipientModal', () => {
  it('renders the title, description, and field placeholders', () => {
    renderModal();

    expect(screen.getByText('Add HP Recipient')).toBeInTheDocument();
    expect(
      screen.getByText('Add a default recipient for hold point release notifications.'),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('e.g., Superintendent, Quality Manager'),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('email@example.com')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('reports role and email input changes to the tab', () => {
    const props = renderModal();

    fireEvent.change(screen.getByLabelText('Role/Title'), { target: { value: 'Engineer' } });
    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'eng@example.com' },
    });

    expect(props.setNewRecipientRole).toHaveBeenCalledWith('Engineer');
    expect(props.setNewRecipientEmail).toHaveBeenCalledWith('eng@example.com');
  });

  it('shows the recipient error as an alert', () => {
    renderModal({ recipientError: 'Recipient already exists.' });

    expect(screen.getByRole('alert')).toHaveTextContent('Recipient already exists.');
  });

  it('disables Add when role or email is blank and submits when both are set', () => {
    const props = renderModal({
      newRecipientRole: 'Superintendent',
      newRecipientEmail: '   ',
    });
    expect(screen.getByRole('button', { name: 'Add Recipient' })).toBeDisabled();
    cleanup();

    const filled = renderModal({
      newRecipientRole: 'Superintendent',
      newRecipientEmail: 'super@example.com',
    });
    const addButton = screen.getByRole('button', { name: 'Add Recipient' });
    expect(addButton).toBeEnabled();
    fireEvent.click(addButton);
    expect(filled.handleAddRecipient).toHaveBeenCalledTimes(1);
    expect(props.handleAddRecipient).not.toHaveBeenCalled();
  });

  it('disables both buttons and shows Adding... while saving', () => {
    const props = renderModal({
      newRecipientRole: 'Superintendent',
      newRecipientEmail: 'super@example.com',
      savingRecipients: true,
    });

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Adding...' })).toBeDisabled();
    expect(props.handleAddRecipient).not.toHaveBeenCalled();
  });

  it('closes via the Cancel button', () => {
    const props = renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(props.closeRecipientModal).toHaveBeenCalledTimes(1);
  });
});
