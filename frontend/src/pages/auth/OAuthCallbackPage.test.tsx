import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/renderWithProviders';

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  navigate: vi.fn(),
  setToken: vi.fn(),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    apiFetch: mocks.apiFetch,
  };
});

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ setToken: mocks.setToken }),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

import { OAuthCallbackPage } from './OAuthCallbackPage';

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  window.history.replaceState(null, document.title, '/');
});

describe('OAuthCallbackPage', () => {
  it('scrubs the one-time code and preserves the requested redirect after exchange', async () => {
    const trustedUser = {
      id: 'user-1',
      email: 'oauth@example.com',
      role: 'admin',
      roleInCompany: 'admin',
      companyId: 'company-1',
    };
    const redirect = '/projects/project-1/ncr?ncrId=ncr-123';
    mocks.apiFetch.mockResolvedValue({ token: 'oauth-jwt', user: trustedUser });
    mocks.setToken.mockResolvedValue(trustedUser);

    renderWithProviders(<OAuthCallbackPage />, {
      initialEntries: [
        `/auth/oauth-callback?code=oauth_once&provider=google&redirect=${encodeURIComponent(
          redirect,
        )}`,
      ],
    });

    expect(screen.getByRole('status', { name: /completing sign in/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(mocks.apiFetch).toHaveBeenCalledWith('/api/auth/oauth/exchange', {
        method: 'POST',
        body: JSON.stringify({ code: 'oauth_once' }),
      });
    });
    await waitFor(() => {
      expect(mocks.setToken).toHaveBeenCalledWith('oauth-jwt', trustedUser);
    });

    expect(window.location.pathname + window.location.search).toBe(
      `/auth/oauth-callback?redirect=${encodeURIComponent(redirect)}`,
    );
    expect(mocks.navigate).toHaveBeenCalledWith(redirect, { replace: true });
  });
});
