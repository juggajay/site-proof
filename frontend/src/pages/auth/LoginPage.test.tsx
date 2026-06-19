import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, waitFor } from '@/test/renderWithProviders';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  signIn: vi.fn(),
  user: {
    id: 'user-1',
    email: 'owner@example.com',
    role: 'owner',
    roleInCompany: 'owner',
    companyId: 'company-1',
  },
}));

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
});

describe('LoginPage authenticated redirect', () => {
  it('redirects an already-authenticated user away from the login form', async () => {
    const redirect = encodeURIComponent('/projects/project-1/lots?tab=quality');

    renderWithProviders(<LoginPage />, { initialEntries: [`/login?redirect=${redirect}`] });

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith('/projects/project-1/lots?tab=quality', {
        replace: true,
      });
    });

    expect(mocks.signIn).not.toHaveBeenCalled();
  });
});
