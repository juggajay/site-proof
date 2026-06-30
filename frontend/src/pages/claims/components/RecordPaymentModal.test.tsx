import { describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen, waitFor } from '@/test/renderWithProviders';
import type { Claim } from '../types';
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
