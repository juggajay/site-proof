import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/renderWithProviders';

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
});
