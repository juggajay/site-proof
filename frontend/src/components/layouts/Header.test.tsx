import { screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/renderWithProviders';

// The header was decluttered to two labelled pills, two icons and an avatar-only
// user-menu trigger. These tests lock in the three behaviours that carry the
// restraint: the avatar trigger shows no inline email, the theme toggle lives
// inside the user menu (and toggling keeps the menu open for instant feedback),
// and Ask Clancy still exposes its ⌘J shortcut via aria/title rather than an
// inline kbd chip. All external boundaries are mocked.
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

function setup(resolvedTheme: 'light' | 'dark' = 'light') {
  const setTheme = vi.fn();
  useAuthMock.mockReturnValue({
    user: { email: 'jay@ryox.com.au', companyId: 'c1' },
  } as unknown as ReturnType<typeof useAuth>);
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
  it('avatar trigger shows no inline email text', () => {
    setup();
    // The dropdown (which does show the email) is closed, so the email must not
    // appear anywhere in the collapsed header.
    expect(screen.queryByText('jay@ryox.com.au')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'User menu' })).toBeInTheDocument();
  });

  it('toggles theme from the user menu without closing it', () => {
    const { setTheme } = setup('light');
    fireEvent.click(screen.getByRole('button', { name: 'User menu' }));

    fireEvent.click(screen.getByRole('menuitem', { name: 'Switch to dark mode' }));
    expect(setTheme).toHaveBeenCalledWith('dark');

    // Menu stays open for instant feedback — Profile is still reachable.
    expect(screen.getByRole('menuitem', { name: 'Profile' })).toBeInTheDocument();
  });

  it('Ask Clancy keeps the ⌘J shortcut hint in aria/title, not an inline kbd', () => {
    setup();
    const clancy = screen.getByRole('button', { name: 'Ask Clancy (⌘J)' });
    expect(clancy).toHaveAttribute('title', 'Ask Clancy (⌘J)');
    expect(clancy.querySelector('kbd')).toBeNull();
  });
});
