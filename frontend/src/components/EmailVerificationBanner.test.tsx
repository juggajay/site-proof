import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen, waitFor } from '@/test/renderWithProviders';

vi.mock('@/lib/auth', () => ({ useAuth: vi.fn() }));
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn() };
});

import { EmailVerificationBanner } from './EmailVerificationBanner';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';

const useAuthMock = vi.mocked(useAuth);
const apiFetchMock = vi.mocked(apiFetch);

function setUser(user: unknown) {
  useAuthMock.mockReturnValue({ user } as unknown as ReturnType<typeof useAuth>);
}

beforeEach(() => {
  sessionStorage.clear();
  apiFetchMock.mockResolvedValue(undefined as never);
});

afterEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
});

describe('EmailVerificationBanner', () => {
  it('renders for a signed-in user whose email is not verified', () => {
    setUser({ id: 'u1', email: 'unverified@example.com', emailVerified: false });
    renderWithProviders(<EmailVerificationBanner />);
    expect(screen.getByTestId('email-verification-banner')).toBeInTheDocument();
    expect(screen.getByText('Verify your email')).toBeInTheDocument();
  });

  it('does not render when the user is verified', () => {
    setUser({ id: 'u1', email: 'verified@example.com', emailVerified: true });
    renderWithProviders(<EmailVerificationBanner />);
    expect(screen.queryByTestId('email-verification-banner')).not.toBeInTheDocument();
  });

  it('does not render when verification status is unknown (older cached session)', () => {
    setUser({ id: 'u1', email: 'legacy@example.com' });
    renderWithProviders(<EmailVerificationBanner />);
    expect(screen.queryByTestId('email-verification-banner')).not.toBeInTheDocument();
  });

  it('does not render when there is no signed-in user', () => {
    setUser(null);
    renderWithProviders(<EmailVerificationBanner />);
    expect(screen.queryByTestId('email-verification-banner')).not.toBeInTheDocument();
  });

  it('resends the verification email for the signed-in address', async () => {
    setUser({ id: 'u1', email: 'unverified@example.com', emailVerified: false });
    renderWithProviders(<EmailVerificationBanner />);

    fireEvent.click(screen.getByRole('button', { name: /resend link/i }));

    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith('/api/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email: 'unverified@example.com' }),
      }),
    );
    expect(await screen.findByText(/we've sent a fresh verification link/i)).toBeInTheDocument();
  });

  it('can be dismissed and stays dismissed for the session', () => {
    setUser({ id: 'u1', email: 'unverified@example.com', emailVerified: false });
    const { unmount } = renderWithProviders(<EmailVerificationBanner />);

    fireEvent.click(screen.getByRole('button', { name: /dismiss verification reminder/i }));
    expect(screen.queryByTestId('email-verification-banner')).not.toBeInTheDocument();

    // A re-render in the same session (e.g. navigating pages) keeps it hidden.
    unmount();
    renderWithProviders(<EmailVerificationBanner />);
    expect(screen.queryByTestId('email-verification-banner')).not.toBeInTheDocument();
  });
});
