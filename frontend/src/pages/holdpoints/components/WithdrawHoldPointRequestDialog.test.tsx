import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { apiFetch } from '@/lib/api';
import { WithdrawHoldPointRequestDialog } from './WithdrawHoldPointRequestDialog';
import type { HoldPoint } from '../types';

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/hooks/useMediaQuery', () => ({ useIsMobile: () => false }));

const holdPoint: HoldPoint = {
  id: 'hp-1',
  lotId: 'lot-1',
  lotNumber: 'LOT-1',
  itpChecklistItemId: 'item-1',
  description: 'Proof roll',
  pointType: 'hold_point',
  status: 'notified',
  notificationSentAt: null,
  scheduledDate: null,
  releasedAt: null,
  releasedByName: null,
  releaseNotes: null,
  sequenceNumber: 1,
  isCompleted: false,
  isVerified: false,
  createdAt: '2026-08-01T00:00:00.000Z',
};

describe('WithdrawHoldPointRequestDialog', () => {
  it('posts the required trimmed reason and refreshes before closing', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ success: true } as never);
    const onWithdrawn = vi.fn();
    const onClose = vi.fn();
    render(
      <WithdrawHoldPointRequestDialog
        holdPoint={holdPoint}
        onWithdrawn={onWithdrawn}
        onClose={onClose}
      />,
    );

    expect(screen.getByRole('button', { name: 'Withdraw request' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Reason (required)'), '  Request sent in error  ');
    await userEvent.click(screen.getByRole('button', { name: 'Withdraw request' }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith('/api/holdpoints/hp-1/withdraw-request', {
        method: 'POST',
        body: JSON.stringify({ reason: 'Request sent in error' }),
      }),
    );
    expect(onWithdrawn).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
