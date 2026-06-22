import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/renderWithProviders';

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    apiFetch: mocks.apiFetch,
  };
});

import { VerifyEmailPage } from './VerifyEmailPage';

afterEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, document.title, '/');
});

describe('VerifyEmailPage', () => {
  it('scrubs the one-time token from the URL and verifies it once in StrictMode', async () => {
    mocks.apiFetch
      .mockResolvedValueOnce({ valid: true, email: 'user@example.com' })
      .mockResolvedValueOnce({ verified: true });

    renderWithProviders(
      <StrictMode>
        <VerifyEmailPage />
      </StrictMode>,
      { initialEntries: ['/verify-email?token=verify_once'] },
    );

    await screen.findByRole('status');
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Email Verified');
    });

    expect(mocks.apiFetch).toHaveBeenCalledTimes(2);
    expect(mocks.apiFetch).toHaveBeenNthCalledWith(
      1,
      '/api/auth/verify-email-status?token=verify_once',
    );
    expect(mocks.apiFetch).toHaveBeenNthCalledWith(2, '/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token: 'verify_once' }),
    });
    expect(window.location.pathname + window.location.search).toBe('/verify-email');
  });

  it('shows the resend form without calling the API when the token is missing', async () => {
    renderWithProviders(<VerifyEmailPage />, { initialEntries: ['/verify-email'] });

    await screen.findByRole('heading', { name: 'Verify Your Email' });
    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });
});
