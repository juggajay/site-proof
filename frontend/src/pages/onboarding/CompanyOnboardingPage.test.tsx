import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen, waitFor } from '@/test/renderWithProviders';
import type { User } from '@/lib/auth';

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  refreshUser: vi.fn<() => Promise<User | null>>(),
  navigate: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  apiFetch: mocks.apiFetch,
}));

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ refreshUser: mocks.refreshUser }),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mocks.navigate };
});

import { CompanyOnboardingPage } from './CompanyOnboardingPage';

async function submitCompanySetup() {
  fireEvent.input(screen.getByLabelText(/company name/i), {
    target: { value: 'Acme Civil Pty Ltd' },
  });
  fireEvent.input(screen.getByLabelText(/abn/i), { target: { value: '12345678901' } });
  fireEvent.input(screen.getByLabelText(/business address/i), {
    target: { value: '1 Site Road' },
  });
  fireEvent.click(screen.getByRole('button', { name: /create company/i }));
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('CompanyOnboardingPage', () => {
  it('stays on setup and explains the problem when company creation succeeds but session refresh fails', async () => {
    mocks.apiFetch.mockResolvedValue({
      company: {
        id: 'company-1',
        name: 'Acme Civil Pty Ltd',
        abn: '12345678901',
        address: '1 Site Road',
        subscriptionTier: 'starter',
      },
    });
    mocks.refreshUser.mockResolvedValue(null);

    renderWithProviders(<CompanyOnboardingPage />);
    await submitCompanySetup();

    expect(mocks.apiFetch).toHaveBeenCalledWith('/api/company', expect.any(Object));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        "Company was created, but we couldn't refresh your session. Please reload and continue.",
      ),
    );
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('only navigates to projects once the refreshed user has a company', async () => {
    mocks.apiFetch.mockResolvedValue({
      company: {
        id: 'company-1',
        name: 'Acme Civil Pty Ltd',
        abn: '12345678901',
        address: '1 Site Road',
        subscriptionTier: 'starter',
      },
    });
    mocks.refreshUser.mockResolvedValue({
      id: 'user-1',
      email: 'owner@example.com',
      companyId: 'company-1',
    });

    renderWithProviders(<CompanyOnboardingPage />);
    await submitCompanySetup();

    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith('/projects', { replace: true }),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
