/**
 * ShellScreen sign-out control.
 *
 * Field crews share site devices and neither mobile shell had any way off the
 * account (the shells have no classic Header/UserMenu). The control lives in
 * the shared home header, so ONE test covers both /m and /p.
 *
 * Pins:
 *   - renders on the home header of both shells (foreman default + subbie
 *     roleLabel/projectLabel call shape), and NOT on inner screens
 *   - clean offline queue -> signs out and lands on /login
 *   - unsynced work -> warns instead of signing out (launch-blocker C2)
 *
 * Dexie boundaries are mocked: useOfflineStatus (SyncChip) and
 * getUnsyncedWorkCount (the sign-out guard).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { signOut, getUnsyncedWorkCount } = vi.hoisted(() => ({
  signOut: vi.fn().mockResolvedValue(undefined),
  getUnsyncedWorkCount: vi.fn(),
}));

vi.mock('@/lib/useOfflineStatus', () => ({
  useOfflineStatus: () => ({ isOnline: true, pendingSyncCount: 0, isSyncing: false }),
}));
vi.mock('@/lib/offlineDb', () => ({ getUnsyncedWorkCount }));
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { fullName: 'Jay Foreman', roleInCompany: 'foreman' }, signOut }),
}));
vi.mock('@/hooks/useEffectiveProjectId', () => ({
  useEffectiveProjectId: () => ({ projectId: null, isResolving: false, hasNoProject: true }),
}));

import { ShellScreen } from './ShellScreen';

function LocationProbe() {
  return <span data-testid="path">{useLocation().pathname}</span>;
}

function renderShell(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/m']}>
        <Routes>
          <Route path="/m" element={<>{ui}</>} />
          <Route path="/login" element={<span>login screen</span>} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const foremanHome = <ShellScreen variant="home">body</ShellScreen>;
// Same call shape the subbie shell (/p) uses: role + project label overrides.
const subbieHome = (
  <ShellScreen variant="home" roleLabel="SUBCONTRACTOR" projectLabel="Hargraves Civil">
    body
  </ShellScreen>
);

beforeEach(() => {
  vi.clearAllMocks();
  getUnsyncedWorkCount.mockResolvedValue(0);
});

describe('ShellScreen sign out', () => {
  it('renders on the foreman shell home header', () => {
    renderShell(foremanHome);
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
  });

  it('renders on the subbie shell home header', () => {
    renderShell(subbieHome);
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
  });

  it('is not on inner screens (one back-tap from home)', () => {
    renderShell(
      <ShellScreen variant="inner" title="Lots" parent="/m">
        body
      </ShellScreen>,
    );
    expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument();
  });

  it('signs out and lands on /login when the offline queue is clean', async () => {
    renderShell(foremanHome);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
    });

    expect(signOut).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByTestId('path').textContent).toBe('/login'));
  });

  it('warns instead of signing out when there is unsynced work', async () => {
    getUnsyncedWorkCount.mockResolvedValue(2);
    renderShell(foremanHome);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
    });

    expect(screen.getByTestId('unsynced-signout-confirm')).toBeInTheDocument();
    expect(signOut).not.toHaveBeenCalled();
    expect(screen.getByTestId('path').textContent).toBe('/m');
  });
});

// ── Back chevron tap target ──────────────────────────────────────────────────

describe('ShellScreen back chevron', () => {
  // jsdom applies no Tailwind, so the box cannot be measured here — this pins
  // the sizing utilities instead. The chevron used to be a 40x40 element with a
  // 48px ::after hit area (.shell-tap48): tappable, but every tool that
  // measures the element itself saw an under-size target. h-12/w-12 makes the
  // measured box and the tappable box the same 48x48; -ml-3.5 absorbs the extra
  // 8px so the icon does not move.
  it('is a real 48x48 box, not a 40px box with a pseudo-element hit area', () => {
    renderShell(
      <ShellScreen variant="inner" title="Lots" parent="/m">
        body
      </ShellScreen>,
    );

    const back = screen.getByRole('button', { name: /go back/i });
    expect(back.className).toContain('h-12');
    expect(back.className).toContain('w-12');
    expect(back.className).toContain('-ml-3.5');
    expect(back.className).not.toContain('shell-tap48');
  });

  it('navigates to the declared parent', () => {
    renderShell(
      <ShellScreen variant="inner" title="Lots" parent="/login">
        body
      </ShellScreen>,
    );

    fireEvent.click(screen.getByRole('button', { name: /go back/i }));
    expect(screen.getByTestId('path').textContent).toBe('/login');
  });
});
