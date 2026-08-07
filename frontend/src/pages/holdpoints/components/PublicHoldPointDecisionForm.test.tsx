import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '@/lib/api';
import { PublicHoldPointDecisionForm } from './PublicHoldPointDecisionForm';

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/components/ui/SignaturePad', () => ({
  SignaturePad: ({ onChange }: { onChange: (value: string) => void }) => (
    <button type="button" onClick={() => onChange('data:image/png;base64,AAAA')}>
      Add signature
    </button>
  ),
}));

const apiFetchMock = vi.mocked(apiFetch);

function renderForm(onDecided = vi.fn()) {
  render(
    <PublicHoldPointDecisionForm
      token="secure-token"
      holdPointDescription="HP-7 pavement proof roll"
      lotNumber="LOT-12"
      recipientName="Alex Authority"
      canDecide
      onDecided={onDecided}
    />,
  );
  return onDecided;
}

beforeEach(() => apiFetchMock.mockReset());

describe('PublicHoldPointDecisionForm', () => {
  it('puts the outcome selector first and validates release identity before confirmation', async () => {
    renderForm();

    const selector = screen.getByLabelText('Outcome');
    expect(selector).toHaveValue('release');
    expect(screen.getAllByText(/Release with conditions \(a CIVOS convention\)/i).length).toBe(1);

    await userEvent.click(screen.getByRole('button', { name: 'Review decision' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/signature is required/i);

    await userEvent.click(screen.getByRole('button', { name: 'Add signature' }));
    await userEvent.click(screen.getByRole('button', { name: 'Review decision' }));
    expect(screen.getByText(/granting permission to proceed/i)).toBeInTheDocument();
    expect(screen.queryByText(/conform/i)).not.toBeInTheDocument();
  });

  it('shows the reject counter, enforces 25..5000 characters, and confirms before posting', async () => {
    const onDecided = renderForm();
    await userEvent.selectOptions(screen.getByLabelText('Outcome'), 'reject');
    await userEvent.click(screen.getByRole('button', { name: 'Add signature' }));

    const reason = screen.getByLabelText('Reason for refusing release');
    await userEvent.type(reason, 'Too short');
    expect(screen.getByText('9/5000 characters (minimum 25)')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Review decision' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/at least 25 characters/i);

    fireEvent.change(reason, { target: { value: 'x'.repeat(5001) } });
    await userEvent.click(screen.getByRole('button', { name: 'Review decision' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/5000 characters or fewer/i);

    const validReason = 'The pavement proof roll remains outside the accepted specification.';
    fireEvent.change(reason, { target: { value: validReason } });
    await userEvent.click(screen.getByRole('button', { name: 'Review decision' }));
    expect(screen.getByText(/You are rejecting HP-7 pavement proof roll/i)).toHaveTextContent(
      /re-request once the non-conformance is closed/i,
    );

    apiFetchMock.mockResolvedValue({
      success: true,
      message: 'Hold point release refused and NCR raised',
      holdPoint: { status: 'pending' },
      ncr: { id: 'ncr-1', ncrNumber: 'NCR-0042', status: 'open' },
    } as never);
    await userEvent.click(screen.getByRole('button', { name: 'Confirm decision' }));

    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith('/api/holdpoints/public/secure-token/reject', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Alex Authority',
          org: undefined,
          reason: validReason,
          signatureDataUrl: 'data:image/png;base64,AAAA',
        }),
      }),
    );
    expect(onDecided).toHaveBeenCalledWith('reject', expect.objectContaining({ success: true }));
  });

  it('splits one condition per line, enforces the 20-condition cap, and previews the list', async () => {
    renderForm();
    await userEvent.selectOptions(screen.getByLabelText('Outcome'), 'release_with_conditions');
    await userEvent.click(screen.getByRole('button', { name: 'Add signature' }));
    const input = screen.getByLabelText('Conditions (one per line)');

    fireEvent.change(input, {
      target: {
        value: Array.from({ length: 21 }, (_, index) => `Condition ${index + 1}`).join('\n'),
      },
    });
    expect(screen.getByText('21/20 conditions')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Review decision' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/No more than 20/i);

    fireEvent.change(input, { target: { value: 'Repair the shoulder\nProvide survey evidence' } });
    expect(screen.getByText('2/20 conditions')).toBeInTheDocument();
    expect(screen.getByText('Repair the shoulder')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Review decision' }));
    expect(screen.getByText(/subject to 2 recorded conditions/i)).toBeInTheDocument();
  });
});
