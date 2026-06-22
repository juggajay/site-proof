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
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    apiFetch: mocks.apiFetch,
  };
});

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ signIn: mocks.signIn, user: mocks.user, loading: false }),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mocks.navigate };
});

import { LoginPage } from './LoginPage';

afterEach(() => {
  vi.clearAllMocks();
  mocks.user = null;
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
});
