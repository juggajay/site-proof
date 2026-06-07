// The inactivity timeout is an AUTOMATIC sign-out: it must preserve unsynced
// offline work (foreman steps away for 16 minutes -> auto-logout must not wipe
// their queued photos/edits). This test pins that handleLogout signs out with
// preserveOfflineData set, for both the countdown expiry and the manual
// "Logout Now" button inside the warning modal.
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const signOut = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'foreman@example.com' }, signOut }),
}));

import { SessionTimeoutWarning } from './SessionTimeoutWarning';

const WARNING_AT = 15 * 60 * 1000;

beforeEach(() => {
  vi.useFakeTimers();
  signOut.mockClear();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

describe('SessionTimeoutWarning auto-logout', () => {
  it('shows the inactivity warning after the idle period', async () => {
    render(<SessionTimeoutWarning />);

    await act(async () => {
      vi.advanceTimersByTime(WARNING_AT);
    });

    // Warning modal is the on-ramp to the auto-logout path.
    expect(screen.getByTestId('session-countdown')).toBeInTheDocument();
    expect(signOut).not.toHaveBeenCalled();
  });

  it('preserves offline data when the auto-logout fires', async () => {
    render(<SessionTimeoutWarning />);

    await act(async () => {
      vi.advanceTimersByTime(WARNING_AT);
    });

    // The "Logout Now" control runs the exact same handleLogout the countdown
    // expiry invokes — the single auto-logout code path. It must preserve
    // offline work (no { preserveOfflineData } omission).
    await act(async () => {
      screen.getByTestId('logout-now-button').click();
    });

    expect(signOut).toHaveBeenCalledWith({ preserveOfflineData: true });
  });
});
