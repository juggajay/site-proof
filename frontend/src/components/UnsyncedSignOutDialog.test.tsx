// A MANUAL sign-out must warn before wiping unsynced offline work. These tests
// pin the gating: no pending work -> sign out immediately; pending work -> show
// a confirm dialog with the real count, wipe only on confirm, keep the session
// on cancel. useAuth.signOut and the offline work counter are mocked.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

const { signOut, getUnsyncedWorkCount } = vi.hoisted(() => ({
  signOut: vi.fn().mockResolvedValue(undefined),
  getUnsyncedWorkCount: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ useAuth: () => ({ signOut }) }));
vi.mock('@/lib/offlineDb', () => ({ getUnsyncedWorkCount }));

import { useUnsyncedSignOut } from './UnsyncedSignOutDialog';

const onSignedOut = vi.fn();

function Harness() {
  const { requestSignOut, dialog } = useUnsyncedSignOut();
  return (
    <div>
      <button onClick={() => requestSignOut(onSignedOut)}>trigger</button>
      {dialog}
    </div>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useUnsyncedSignOut', () => {
  it('signs out immediately with no dialog when there is no unsynced work', async () => {
    getUnsyncedWorkCount.mockResolvedValue(0);
    render(<Harness />);

    await act(async () => {
      fireEvent.click(screen.getByText('trigger'));
    });

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(onSignedOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('unsynced-signout-confirm')).not.toBeInTheDocument();
  });

  it('shows a confirm dialog with the real count and only wipes on confirm', async () => {
    getUnsyncedWorkCount.mockResolvedValue(3);
    render(<Harness />);

    await act(async () => {
      fireEvent.click(screen.getByText('trigger'));
    });

    // Dialog appears, session NOT yet ended.
    await waitFor(() => expect(screen.getByTestId('unsynced-signout-confirm')).toBeInTheDocument());
    expect(screen.getByText(/3 items that haven't synced/)).toBeInTheDocument();
    expect(signOut).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByTestId('unsynced-signout-confirm'));
    });

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(onSignedOut).toHaveBeenCalledTimes(1);
  });

  it('keeps the session when the user cancels', async () => {
    getUnsyncedWorkCount.mockResolvedValue(1);
    render(<Harness />);

    await act(async () => {
      fireEvent.click(screen.getByText('trigger'));
    });
    await waitFor(() => expect(screen.getByTestId('unsynced-signout-cancel')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByTestId('unsynced-signout-cancel'));
    });

    expect(signOut).not.toHaveBeenCalled();
    expect(onSignedOut).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByTestId('unsynced-signout-confirm')).not.toBeInTheDocument(),
    );
  });
});
