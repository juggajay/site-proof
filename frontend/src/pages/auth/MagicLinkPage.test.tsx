import { StrictMode } from 'react';
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

import { MagicLinkPage } from './MagicLinkPage';

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  window.history.replaceState(null, document.title, '/');
});

describe('MagicLinkPage', () => {
  it('consumes the one-time token only once when StrictMode reruns effects', async () => {
    const trustedUser = {
      id: 'user-1',
      email: 'user@example.com',
      role: 'owner',
      roleInCompany: 'owner',
      companyId: 'company-1',
    };
    mocks.apiFetch.mockResolvedValue({ token: 'jwt-token', user: trustedUser });
    mocks.setToken.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      role: 'owner',
      roleInCompany: 'owner',
      companyId: 'company-1',
    });

    renderWithProviders(
      <StrictMode>
        <MagicLinkPage />
      </StrictMode>,
      { initialEntries: ['/auth/magic-link?token=magic_once'] },
    );

    await waitFor(() => {
      expect(mocks.setToken).toHaveBeenCalledWith('jwt-token', trustedUser);
    });

    expect(mocks.apiFetch).toHaveBeenCalledTimes(1);
    expect(mocks.apiFetch).toHaveBeenCalledWith('/api/auth/magic-link/verify', {
      method: 'POST',
      body: JSON.stringify({ token: 'magic_once' }),
    });
    expect(window.location.pathname + window.location.search).toBe('/auth/magic-link');
    expect(screen.getByRole('status')).toHaveTextContent(/success/i);
  });

  it('shows an error without calling the API when the token is missing', () => {
    renderWithProviders(<MagicLinkPage />, { initialEntries: ['/auth/magic-link'] });

    expect(screen.getByRole('alert')).toHaveTextContent(/invalid or missing magic link token/i);
    expect(mocks.apiFetch).not.toHaveBeenCalled();
    expect(mocks.setToken).not.toHaveBeenCalled();
  });

  it('preserves safe invite redirects after successful verification', async () => {
    const trustedUser = {
      id: 'user-1',
      email: 'user@example.com',
      role: 'member',
      roleInCompany: 'member',
      companyId: 'company-1',
    };
    mocks.apiFetch.mockResolvedValue({ token: 'jwt-token', user: trustedUser });
    mocks.setToken.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      role: 'member',
      roleInCompany: 'member',
      companyId: 'company-1',
    });

    renderWithProviders(<MagicLinkPage />, {
      initialEntries: [
        '/auth/magic-link?token=magic_once&redirect=%2Fsubcontractor-portal%2Faccept-invite%3Fid%3Dinvite-1',
      ],
    });

    await waitFor(() => {
      expect(mocks.setToken).toHaveBeenCalledWith('jwt-token', trustedUser);
    });

    await waitFor(
      () => {
        expect(mocks.navigate).toHaveBeenCalledWith(
          '/subcontractor-portal/accept-invite?id=invite-1',
          {
            replace: true,
          },
        );
      },
      { timeout: 3000 },
    );
  }, 8000);

  it('scrubs the one-time token from the URL before server verification finishes', async () => {
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');
    mocks.apiFetch.mockRejectedValue(new Error('network failed'));

    renderWithProviders(<MagicLinkPage />, {
      initialEntries: ['/auth/magic-link?token=magic_once&redirect=%2Fprojects'],
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(/failed to verify magic link/i);
    expect(mocks.setToken).not.toHaveBeenCalled();
    expect(replaceStateSpy).toHaveBeenCalledWith(
      null,
      document.title,
      '/auth/magic-link?redirect=%2Fprojects',
    );
    expect(window.location.pathname + window.location.search).toBe(
      '/auth/magic-link?redirect=%2Fprojects',
    );
  });
});
