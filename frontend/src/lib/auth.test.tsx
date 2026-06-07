// Focused tests for signOut's offline-data handling. The key safety property:
// an AUTOMATIC sign-out (preserveOfflineData) must NOT wipe locally stored
// offline work, while a normal/manual sign-out still wipes it. The dynamic
// './offlineDb' import and the auth-storage helpers are mocked so the test is
// purely about which clears fire — no IndexedDB or real storage involved.
import { act, render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { clearAllOfflineData, clearOfflineOwnerId, clearAuthFromAllStorages } = vi.hoisted(() => ({
  clearAllOfflineData: vi.fn(),
  clearOfflineOwnerId: vi.fn(),
  clearAuthFromAllStorages: vi.fn(),
}));

vi.mock('./offlineDb', () => ({
  clearAllOfflineData,
}));

vi.mock('./authStorage', () => ({
  AUTH_SESSION_EXPIRED_EVENT: 'auth-session-expired',
  clearOfflineOwnerId,
  clearAuthFromAllStorages,
  getOfflineOwnerId: vi.fn(() => null),
  setOfflineOwnerId: vi.fn(),
  readAuthFromStorage: vi.fn(() => null),
  writeAuthToStorage: vi.fn(() => true),
  writeRememberMePreference: vi.fn(() => true),
}));

import { AuthProvider, useAuth, type SignOutOptions } from './auth';

let triggerSignOut: (options?: SignOutOptions) => Promise<void>;

function SignOutHarness() {
  const { signOut } = useAuth();
  triggerSignOut = signOut;
  return null;
}

function renderAuth() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SignOutHarness />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('signOut offline-data handling', () => {
  it('wipes offline data on a manual (default) sign-out', async () => {
    renderAuth();

    await act(async () => {
      await triggerSignOut();
    });

    expect(clearAuthFromAllStorages).toHaveBeenCalled();
    expect(clearAllOfflineData).toHaveBeenCalledTimes(1);
    expect(clearOfflineOwnerId).toHaveBeenCalledTimes(1);
  });

  it('preserves offline data when preserveOfflineData is set (automatic sign-out)', async () => {
    renderAuth();

    await act(async () => {
      await triggerSignOut({ preserveOfflineData: true });
    });

    // Session still ends...
    expect(clearAuthFromAllStorages).toHaveBeenCalled();
    // ...but offline work and its owner marker survive so the same user can
    // resume after re-login (and a different user still triggers the wipe).
    expect(clearAllOfflineData).not.toHaveBeenCalled();
    expect(clearOfflineOwnerId).not.toHaveBeenCalled();
  });
});
