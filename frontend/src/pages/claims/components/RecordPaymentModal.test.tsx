import { describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen, waitFor } from '@/test/renderWithProviders';
import type { Claim, ClaimPaymentFormData } from '../types';
import { RecordPaymentModal } from './RecordPaymentModal';

const CLAIM: Claim = {
  id: 'claim-1',
  claimNumber: 12,
  periodStart: '2026-06-01',
  periodEnd: '2026-06-30',
  status: 'certified',
  totalClaimedAmount: 1000,
  certifiedAmount: 1000,
  paidAmount: 250,
  submittedAt: '2026-06-30T00:00:00.000Z',
  disputeNotes: null,
  disputedAt: null,
  lotCount: 2,
};

describe('RecordPaymentModal', () => {
  it('reuses the same operationKey across repeated submissions from one dialog (F-04)', async () => {
    // F-04: onRecordPayment (ClaimsPage) swallows errors, so the dialog stays
    // open after a lost response. A second submit must carry the SAME
    // operationKey so the server replays the payment instead of double-recording
    // it. The key is minted once per dialog instance and never cleared.
    const onRecordPayment = vi.fn((_claimId: string, _payment: ClaimPaymentFormData) =>
      Promise.resolve(),
    );

    renderWithProviders(
      <RecordPaymentModal claim={CLAIM} onClose={vi.fn()} onRecordPayment={onRecordPayment} />,
    );

    const button = screen.getByRole('button', { name: 'Record Payment' });
    fireEvent.click(button);
    await waitFor(() => expect(onRecordPayment).toHaveBeenCalledTimes(1));
    fireEvent.click(button);
    await waitFor(() => expect(onRecordPayment).toHaveBeenCalledTimes(2));

    const firstKey = onRecordPayment.mock.calls[0][1].operationKey;
    const secondKey = onRecordPayment.mock.calls[1][1].operationKey;
    expect(firstKey).toBeTruthy();
    expect(secondKey).toBe(firstKey);
  });

  it('keeps cancel disabled while payment is recording', async () => {
    const onRecordPayment = vi.fn(
      () =>
        new Promise<void>(() => {
          // Keep the mutation in flight.
        }),
    );

    renderWithProviders(
      <RecordPaymentModal claim={CLAIM} onClose={vi.fn()} onRecordPayment={onRecordPayment} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Record Payment' }));

    await waitFor(() => expect(onRecordPayment).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});
