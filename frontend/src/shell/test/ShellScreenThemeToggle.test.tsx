/**
 * Tests for the shell home-header theme toggle.
 *
 * The shell has no classic app Header, so this toggle is the only way a
 * shell-default user (foreman or subbie) can leave dark mode once their device
 * stored it from the classic app.
 *
 * MOCKS @/lib/useOfflineStatus (ShellScreen mounts SyncChip → Dexie fails
 * unmocked under CI coverage). window.matchMedia is stubbed (jsdom lacks it;
 * ThemeProvider queries prefers-color-scheme).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/lib/theme';

vi.mock('@/lib/useOfflineStatus', () => ({
  useOfflineStatus: () => ({ isOnline: true, pendingSyncCount: 0, isSyncing: false }),
}));
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { id: 'u1', fullName: 'Mick', role: 'subcontractor' } }),
}));
vi.mock('@/hooks/useEffectiveProjectId', () => ({
  useEffectiveProjectId: () => ({ projectId: null, isResolving: false }),
}));

import { ShellScreen } from '../components/ShellScreen';

// jsdom has no matchMedia; ThemeProvider reads prefers-color-scheme through it.
beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false, // system = light
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  document.documentElement.classList.remove('light', 'dark');
});

function renderHome(withProvider: boolean) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = (
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ShellScreen variant="home">
          <div>content</div>
        </ShellScreen>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return render(withProvider ? <ThemeProvider>{tree}</ThemeProvider> : tree);
}

describe('shell home-header theme toggle', () => {
  it('flips light → dark on the document root and back', () => {
    renderHome(true);

    // System resolves light → the toggle offers dark.
    const toDark = screen.getByRole('button', { name: 'Switch to dark mode' });
    fireEvent.click(toDark);
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    // Now it offers light — the stuck-in-dark escape this exists for.
    const toLight = screen.getByRole('button', { name: 'Switch to light mode' });
    fireEvent.click(toLight);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });

  it('renders nothing outside a ThemeProvider (bare mounts stay valid)', () => {
    renderHome(false);
    expect(screen.queryByRole('button', { name: /Switch to .* mode/ })).toBeNull();
  });
});
