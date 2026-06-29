import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '@/test/renderWithProviders';

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    apiFetch: mocks.apiFetch,
  };
});

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

import { ResetPasswordPage } from './ResetPasswordPage';

afterEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, document.title, '/');
});

describe('ResetPasswordPage', () => {
  it('scrubs the one-time token from the URL and validates it once in StrictMode', async () => {
    mocks.apiFetch.mockResolvedValue({ valid: true });

    renderWithProviders(
      <StrictMode>
        <ResetPasswordPage />
      </StrictMode>,
      { initialEntries: ['/reset-password?token=reset_once'] },
    );

    await screen.findByRole('heading', { name: 'Create New Password' });

    await waitFor(() => {
      expect(mocks.apiFetch).toHaveBeenCalledTimes(1);
    });
    expect(mocks.apiFetch).toHaveBeenCalledWith('/api/auth/validate-reset-token?token=reset_once');
    expect(window.location.pathname + window.location.search).toBe('/reset-password');
  });

  it('shows an invalid-link state without calling the API when the token is missing', async () => {
    renderWithProviders(<ResetPasswordPage />, { initialEntries: ['/reset-password'] });

    await screen.findByRole('alert');
    expect(screen.getByText('No reset token provided')).toBeInTheDocument();
    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });

  it('lets the user retry token validation after a transient failure without putting the token back in the URL', async () => {
    mocks.apiFetch.mockRejectedValueOnce(new Error('Network unavailable'));
    mocks.apiFetch.mockResolvedValueOnce({ valid: true });
    const user = userEvent.setup();

    renderWithProviders(<ResetPasswordPage />, {
      initialEntries: ['/reset-password?token=retry_token'],
    });

    await screen.findByRole('alert');
    expect(screen.getByText('Failed to validate token. Please try again.')).toBeInTheDocument();
    expect(window.location.pathname + window.location.search).toBe('/reset-password');

    await user.click(screen.getByRole('button', { name: /try again/i }));

    await screen.findByRole('heading', { name: 'Create New Password' });
    expect(mocks.apiFetch).toHaveBeenCalledTimes(2);
    expect(mocks.apiFetch).toHaveBeenLastCalledWith(
      '/api/auth/validate-reset-token?token=retry_token',
    );
    expect(window.location.pathname + window.location.search).toBe('/reset-password');
  });

  it('requires Terms acceptance when the reset token is activating a company invite', async () => {
    mocks.apiFetch.mockResolvedValueOnce({ valid: true, requiresTosAcceptance: true });
    mocks.apiFetch.mockResolvedValueOnce({});
    const user = userEvent.setup();

    renderWithProviders(<ResetPasswordPage />, {
      initialEntries: ['/reset-password?token=invite_setup_token'],
    });

    await screen.findByRole('heading', { name: 'Create New Password' });

    await user.type(screen.getByLabelText(/^new password$/i), 'NewPassword123!');
    await user.type(screen.getByLabelText(/confirm password/i), 'NewPassword123!');
    await user.click(screen.getByRole('button', { name: /^reset password$/i }));

    await screen.findByText(/accept the terms of service/i);
    expect(mocks.apiFetch).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('checkbox', { name: /terms of service/i }));
    await user.click(screen.getByRole('button', { name: /^reset password$/i }));

    await screen.findByRole('heading', { name: 'Password Reset Successfully!' });
    expect(mocks.apiFetch).toHaveBeenCalledTimes(2);
    expect(mocks.apiFetch).toHaveBeenLastCalledWith('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        token: 'invite_setup_token',
        password: 'NewPassword123!',
        tosAccepted: true,
      }),
    });
  });
});
