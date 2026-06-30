import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  HoldPointRecipientsSection,
  SettingsFeedbackMessages,
  SubcontractorVerificationSection,
} from './NotificationsTabSections';

describe('NotificationsTabSections', () => {
  it('renders alert and status feedback messages', () => {
    render(<SettingsFeedbackMessages error="Save failed" status="Saved" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Save failed');
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
  });

  it('renders empty hold point recipients and delegates add', async () => {
    const onAddRecipient = vi.fn();
    const user = userEvent.setup();

    render(
      <HoldPointRecipientsSection
        hpRecipients={[]}
        savingRecipients={false}
        savingSetting={null}
        onAddRecipient={onAddRecipient}
        onRemoveRecipient={vi.fn()}
      />,
    );

    expect(screen.getByText('No default recipients configured.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add Recipient' }));
    expect(onAddRecipient).toHaveBeenCalledTimes(1);
  });

  it('renders hold point recipients and delegates remove by index', async () => {
    const onRemoveRecipient = vi.fn();
    const user = userEvent.setup();

    render(
      <HoldPointRecipientsSection
        hpRecipients={[
          { role: 'Superintendent', email: 'super@example.com' },
          { role: 'Quality Manager', email: 'qa@example.com' },
        ]}
        savingRecipients={false}
        savingSetting={null}
        onAddRecipient={vi.fn()}
        onRemoveRecipient={onRemoveRecipient}
      />,
    );

    expect(screen.getByText('super@example.com')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove Superintendent' }));
    expect(onRemoveRecipient).toHaveBeenCalledWith(0);
  });

  it('disables recipient writes while a recipient save is in flight', () => {
    render(
      <HoldPointRecipientsSection
        hpRecipients={[
          { role: 'Superintendent', email: 'super@example.com' },
          { role: 'Quality Manager', email: 'qa@example.com' },
        ]}
        savingRecipients
        savingSetting="removeRecipient-1"
        onAddRecipient={vi.fn()}
        onRemoveRecipient={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Remove Superintendent' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Removing Quality Manager...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add Recipient' })).toBeDisabled();
  });

  it('renders subcontractor verification status and delegates toggles', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <SubcontractorVerificationSection
        requireSubcontractorVerification
        savingSetting={null}
        onToggle={onToggle}
      />,
    );

    expect(
      screen.getByText('Subcontractor completions need supervisor verification'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /require verification/i }));
    expect(onToggle).toHaveBeenCalledTimes(1);

    rerender(
      <SubcontractorVerificationSection
        requireSubcontractorVerification={false}
        savingSetting="requireSubcontractorVerification"
        onToggle={onToggle}
      />,
    );
    expect(
      screen.getByText('Subcontractor completions are automatically verified'),
    ).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /require verification/i })).toBeDisabled();
  });
});
