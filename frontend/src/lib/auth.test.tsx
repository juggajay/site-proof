// Focused tests for signOut's offline-data handling and signUp's auto
// sign-in. The signOut safety property: an AUTOMATIC sign-out
// (preserveOfflineData) must NOT wipe locally stored offline work, while a
// normal/manual sign-out still wipes it. The signUp property: a register
// response carrying a session token signs the new user straight in (even
// while email verification is pending), and a token-less response falls back
// to no session. The dynamic './offlineDb' import, the auth-storage helpers,
// and the network are mocked so the tests are purely about which calls fire —
// no IndexedDB, real storage, or HTTP involved.
import { act, render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  clearAllOfflineData,
  clearOfflineOwnerId,
  clearAuthFromAllStorages,
  readAuthFromStorage,
  writeAuthToStorage,
} = vi.hoisted(() => ({
  clearAllOfflineData: vi.fn(),
  clearOfflineOwnerId: vi.fn(),
  clearAuthFromAllStorages: vi.fn(),
  readAuthFromStorage: vi.fn((): { source: 'local' | 'session'; value: string } | null => null),
  writeAuthToStorage: vi.fn(() => true),
}));

const fetchWithTimeout = vi.hoisted(() => vi.fn());

vi.mock('./offlineDb', () => ({
  clearAllOfflineData,
}));

vi.mock('./authStorage', () => ({
  AUTH_SESSION_EXPIRED_EVENT: 'auth-session-expired',
  clearOfflineOwnerId,
  clearAuthFromAllStorages,
  getOfflineOwnerId: vi.fn(() => null),
  setOfflineOwnerId: vi.fn(),
  readAuthFromStorage,
  writeAuthToStorage,
  writeRememberMePreference: vi.fn(() => true),
}));

vi.mock('./fetchWithTimeout', () => ({
  fetchWithTimeout,
}));

import { AuthProvider, useAuth, type SignOutOptions } from './auth';

let triggerSignOut: (options?: SignOutOptions) => Promise<void>;
let triggerSignUp: ReturnType<typeof useAuth>['signUp'];

function AuthHarness() {
  const { signOut, signUp } = useAuth();
  triggerSignOut = signOut;
  triggerSignUp = signUp;
  return null;
}

function renderAuth() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

function jsonResponse(body: unknown, status = 201): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
  readAuthFromStorage.mockReturnValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('signOut offline-data handling', () => {
  it('revokes the stored server session before clearing local auth', async () => {
    renderAuth();
    readAuthFromStorage.mockReturnValue({
      source: 'local',
      value: JSON.stringify({
        user: { id: 'user-1', email: 'user@example.com' },
        token: 'session-token',
      }),
    });
    fetchWithTimeout.mockResolvedValue(jsonResponse({}, 200));

    await act(async () => {
      await triggerSignOut();
    });

    expect(fetchWithTimeout).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/logout'),
      expect.objectContaining({
        method: 'POST',
        headers: { Authorization: 'Bearer session-token' },
      }),
    );
    expect(clearAuthFromAllStorages).toHaveBeenCalled();
  });

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

describe('signUp auto sign-in', () => {
  it('persists the session from the register response even while email verification is pending', async () => {
    fetchWithTimeout.mockResolvedValue(
      jsonResponse({
        user: { id: 'new-user', email: 'new-user@example.com', emailVerified: false },
        token: 'registration-session-token',
        verificationRequired: true,
        message: 'Account created. Please check your email to verify your account.',
      }),
    );

    renderAuth();

    let result: Awaited<ReturnType<typeof triggerSignUp>> = null;
    await act(async () => {
      result = await triggerSignUp('new-user@example.com', 'StrongPass123!');
    });

    // The caller gets the signed-in user back so it can navigate into the app.
    expect(result).toMatchObject({ id: 'new-user', email: 'new-user@example.com' });
    // And the session is persisted exactly like a login would persist it.
    expect(writeAuthToStorage).toHaveBeenCalledWith(
      'local',
      expect.stringContaining('registration-session-token'),
    );
  });

  it('falls back to no session when the register response carries no token', async () => {
    fetchWithTimeout.mockResolvedValue(
      jsonResponse({
        verificationRequired: true,
        message: 'Account created. Please check your email to verify your account.',
      }),
    );

    renderAuth();

    let result: Awaited<ReturnType<typeof triggerSignUp>> = null;
    await act(async () => {
      result = await triggerSignUp('new-user@example.com', 'StrongPass123!');
    });

    // Registration still succeeded (no throw), but there is nothing to sign
    // in with — the caller shows the manual sign-in screen instead.
    expect(result).toBeNull();
    expect(writeAuthToStorage).not.toHaveBeenCalled();
    expect(clearAuthFromAllStorages).toHaveBeenCalled();
  });
});
