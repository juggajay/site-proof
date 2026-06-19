import { describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen, waitFor } from '@/test/renderWithProviders';
import type { Claim } from '../types';
import { RecordCertificationModal } from './RecordCertificationModal';

const CLAIM: Claim = {
  id: 'claim-1',
  claimNumber: 12,
  periodStart: '2026-06-01',
  periodEnd: '2026-06-30',
  status: 'submitted',
  totalClaimedAmount: 1000,
  certifiedAmount: null,
  paidAmount: null,
  submittedAt: '2026-06-30T00:00:00.000Z',
  disputeNotes: null,
  disputedAt: null,
  lotCount: 2,
};

describe('RecordCertificationModal', () => {
  it('requires variation notes when the external schedule reduces the certified amount', async () => {
    const onCertify = vi.fn().mockResolvedValue(undefined);

    renderWithProviders(
      <RecordCertificationModal
        claim={CLAIM}
        projectId="project-1"
        onClose={vi.fn()}
        onCertify={onCertify}
      />,
    );

    fireEvent.change(screen.getByLabelText('Certified Amount'), { target: { value: '900' } });

    const recordButton = screen.getByRole('button', { name: 'Record Payment Schedule' });
    expect(
      screen.getByText('Required when the certified amount is less than claimed.'),
    ).toBeInTheDocument();
    expect(recordButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Variation Notes'), {
      target: { value: 'Principal schedule reduced quantity' },
    });

    expect(recordButton).toBeEnabled();
    fireEvent.click(recordButton);

    await waitFor(() => expect(onCertify).toHaveBeenCalledTimes(1));
    expect(onCertify).toHaveBeenCalledWith(
      'claim-1',
      expect.objectContaining({
        certifiedAmount: 900,
        variationNotes: 'Principal schedule reduced quantity',
      }),
    );
  });
});
