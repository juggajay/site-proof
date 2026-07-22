import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/renderWithProviders';

// The desktop sidebar now owns identity (see Sidebar/UserMenu). At md+ the
// header no longer shows an avatar; below md — where the sidebar is hidden and
// MobileNav has no Profile/Sign out — the header keeps the UserMenu, wrapped in
// md:hidden. These tests lock in: the header UserMenu is below-md only, the
// avatar trigger shows no inline email, and Ask Clancy keeps its ⌘J hint in
// aria/title. Menu contents + gating live in UserMenu.test.tsx. Boundaries mocked.
vi.mock('@/lib/auth', () => ({ useAuth: vi.fn() }));
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn().mockResolvedValue({ projects: [], count: 0 }) };
});
vi.mock('@/lib/theme', () => ({ useTheme: vi.fn() }));
vi.mock('@/components/copilot/clancyAccess', () => ({ useClancyEnabled: () => true }));
vi.mock('@/components/copilot/clancyChatState', () => ({
  useClancyStore: () => ({ open: false, unseen: false }),
  toggleClancy: vi.fn(),
}));
vi.mock('@/components/OnboardingTour', () => ({
  useOnboarding: () => ({ resetOnboarding: vi.fn() }),
  startOnboardingTour: vi.fn(),
}));
vi.mock('@/components/UnsyncedSignOutDialog', () => ({
  useUnsyncedSignOut: () => ({ requestSignOut: vi.fn(), dialog: null }),
}));
vi.mock('@/components/GlobalSearch', () => ({ GlobalSearch: () => null }));

import { Header } from './Header';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';

const useAuthMock = vi.mocked(useAuth);
const useThemeMock = vi.mocked(useTheme);

function setup(
  resolvedTheme: 'light' | 'dark' = 'light',
  user: Record<string, unknown> = { email: 'jay@ryox.com.au', companyId: 'c1' },
) {
  const setTheme = vi.fn();
  useAuthMock.mockReturnValue({ user } as unknown as ReturnType<typeof useAuth>);
  useThemeMock.mockReturnValue({ setTheme, resolvedTheme } as unknown as ReturnType<
    typeof useTheme
  >);
  renderWithProviders(<Header />);
  return { setTheme };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('Header', () => {
  it('renders the user menu only below md (sidebar owns identity at md+)', () => {
    setup();
    // The header UserMenu wrapper carries md:hidden so it disappears once the
    // sidebar is visible.
    const trigger = screen.getByRole('button', { name: 'User menu' });
    expect(trigger.parentElement).toHaveClass('md:hidden');
  });

  it('avatar trigger shows no inline email text', () => {
    setup();
    // The popover (which does show the email) is closed, so the email must not
    // appear anywhere in the collapsed header.
    expect(screen.queryByText('jay@ryox.com.au')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'User menu' })).toBeInTheDocument();
  });

  it('Ask Clancy keeps the ⌘J shortcut hint in aria/title, not an inline kbd', () => {
    setup();
    const clancy = screen.getByRole('button', { name: 'Ask Clancy (⌘J)' });
    expect(clancy).toHaveAttribute('title', 'Ask Clancy (⌘J)');
    expect(clancy.querySelector('kbd')).toBeNull();
  });
});
