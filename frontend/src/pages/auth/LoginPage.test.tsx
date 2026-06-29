import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen, waitFor } from '@/test/renderWithProviders';

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  navigate: vi.fn(),
  signIn: vi.fn(),
  user: null as null | {
    id: string;
    email: string;
    role: string;
    roleInCompany: string;
    companyId: string;
  },
  authLoading: false,
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    apiFetch: mocks.apiFetch,
  };
});

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ signIn: mocks.signIn, user: mocks.user, loading: mocks.authLoading }),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mocks.navigate };
});

import { LoginPage } from './LoginPage';

afterEach(() => {
  vi.clearAllMocks();
  mocks.user = null;
  mocks.authLoading = false;
});

describe('LoginPage authenticated redirect', () => {
  it('redirects an already-authenticated user away from the login form', async () => {
    mocks.user = {
      id: 'user-1',
      email: 'owner@example.com',
      role: 'owner',
      roleInCompany: 'owner',
      companyId: 'company-1',
    };
    const redirect = encodeURIComponent('/projects/project-1/lots?tab=quality');

    renderWithProviders(<LoginPage />, { initialEntries: [`/login?redirect=${redirect}`] });

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith('/projects/project-1/lots?tab=quality', {
        replace: true,
      });
    });

    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it('preserves the intended redirect when requesting a magic link', async () => {
    mocks.apiFetch.mockResolvedValue({ message: 'sent' });
    const redirect = encodeURIComponent('/subcontractor-portal/accept-invite?id=invite-1');

    renderWithProviders(<LoginPage />, { initialEntries: [`/login?redirect=${redirect}`] });

    expect(screen.getByRole('link', { name: /continue with google/i })).toHaveAttribute(
      'href',
      expect.stringContaining(
        `redirect=${encodeURIComponent('/subcontractor-portal/accept-invite?id=invite-1')}`,
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: /email me a magic link/i }));
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: 'subbie@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send magic link/i }));

    await waitFor(() => {
      expect(mocks.apiFetch).toHaveBeenCalledWith('/api/auth/magic-link/request', {
        method: 'POST',
        body: JSON.stringify({
          email: 'subbie@example.com',
          redirect: '/subcontractor-portal/accept-invite?id=invite-1',
        }),
      });
    });
  });

  it('does not flash the sign-in form while the existing session is still loading', () => {
    mocks.authLoading = true;

    renderWithProviders(<LoginPage />, { initialEntries: ['/login'] });

    expect(screen.getByRole('status', { name: /checking existing session/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^sign in$/i })).not.toBeInTheDocument();
    expect(mocks.signIn).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('shows a one-time success message passed from account deletion', () => {
    renderWithProviders(<LoginPage />, {
      initialEntries: [
        {
          pathname: '/login',
          state: { message: 'Your account has been permanently deleted.' },
        } as unknown as string,
      ],
    });

    expect(screen.getByRole('status')).toHaveTextContent(
      /your account has been permanently deleted/i,
    );
  });
});
