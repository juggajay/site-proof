/**
 * HomeScreen (foreman shell /m) — the hub v2 grammar.
 *
 * Two groups:
 *   1. the no-project first-run state
 *   2. the hub itself: which cards exist, and the ONE rule the design turns on —
 *      a zero count renders NO chip at all (not a grey one, not an amber "0
 *      waiting"), because silence is what tells the foreman nothing needs him.
 *
 * ShellScreen mounts SyncChip → useOfflineStatus, so that (Dexie/IndexedDB)
 * boundary is mocked. useEffectiveProjectId is mocked to drive the hasNoProject
 * branch. usePhotosShellData is mocked at the hook boundary (the real one reads
 * Dexie + pages the documents endpoint) so the notice card's condition is
 * exercised directly.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/useOfflineStatus', () => ({
  useOfflineStatus: () => ({ isOnline: true, pendingSyncCount: 0, isSyncing: false }),
}));
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { fullName: 'Jay Foreman', roleInCompany: 'foreman' } }),
}));

const mockUseEffectiveProjectId = vi.fn();
vi.mock('@/hooks/useEffectiveProjectId', () => ({
  useEffectiveProjectId: () => mockUseEffectiveProjectId(),
}));

// The capture sheet is exercised on its own; the hub only needs to mount.
vi.mock('@/components/foreman/CaptureModal', () => ({ CaptureModal: () => null }));

let _unfiledCount = 0;
vi.mock('./photos/usePhotosShellData', () => ({
  usePhotosShellData: () => ({ unfiledCount: _unfiledCount }),
}));

const mockApiFetch = vi.fn();
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

import { HomeScreen } from './HomeScreen';

// Day payload the /foreman/today endpoint returns; only the array lengths matter.
let _blocking: unknown[] = [];
let _dueToday: unknown[] = [];
let _pendingDockets: unknown[] = [];
let _openNcrs: unknown[] = [];

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="loc">{`${location.pathname}${location.search}`}</div>;
}

function renderHome() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/m']}>
        <Routes>
          <Route path="/m" element={<HomeScreen />} />
          <Route path="/m/*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  _blocking = [];
  _dueToday = [];
  _pendingDockets = [];
  _openNcrs = [];
  _unfiledCount = 0;
  mockApiFetch.mockImplementation((url: string) => {
    if (url.includes('/foreman/today'))
      return Promise.resolve({ blocking: _blocking, dueToday: _dueToday });
    if (url.includes('/api/diary/')) return Promise.resolve(null);
    if (url.includes('/api/dockets')) return Promise.resolve({ data: _pendingDockets });
    if (url.includes('/api/ncrs')) return Promise.resolve({ data: _openNcrs });
    if (url.includes('/api/projects')) return Promise.resolve({ projects: [] });
    return Promise.resolve({});
  });
});

describe('HomeScreen no-project state', () => {
  it('shows a guided empty state instead of dead tiles when the foreman has no project', () => {
    mockUseEffectiveProjectId.mockReturnValue({
      projectId: null,
      isResolving: false,
      hasNoProject: true,
    });

    renderHome();

    // A clear explanation + a way forward, mirroring ForemanMobileDashboard.
    expect(screen.getByRole('heading', { name: /no project assigned/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view projects/i })).toBeInTheDocument();
    // The inert camera/capture affordance must NOT render in this state.
    expect(screen.queryByLabelText(/take a photo/i)).not.toBeInTheDocument();
  });
});

describe('HomeScreen hub v2', () => {
  beforeEach(() => {
    mockUseEffectiveProjectId.mockReturnValue({
      projectId: 'proj-1',
      isResolving: false,
      hasNoProject: false,
    });
  });

  it('renders the four permanent hub cards', async () => {
    renderHome();

    expect(await screen.findByRole('button', { name: /^Lots/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Dockets/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Issues/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Drawings and documents/i })).toBeInTheDocument();
    // Photos is NOT a hub tile: capture is the camera bar, viewing goes via the lot.
    expect(screen.queryByRole('button', { name: /^Photos/ })).not.toBeInTheDocument();
  });

  it('navigates to the docs register from the Drawings & Docs tile', async () => {
    renderHome();

    fireEvent.click(await screen.findByRole('button', { name: /Drawings and documents/i }));

    expect(screen.getByTestId('loc').textContent).toContain('/m/docs');
  });

  // The rule: a zero count is ABSENT. The old screen shipped an amber
  // "0 waiting" docket chip, which cried wolf every morning.
  it('renders NO docket chip when nothing is waiting for approval', async () => {
    renderHome();

    await screen.findByRole('button', { name: /^Dockets$/ });
    expect(screen.queryByText(/waiting/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/to approve/i)).not.toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('chips dockets only once dockets actually await approval', async () => {
    _pendingDockets = [{ status: 'pending_approval' }, { status: 'pending_approval' }];
    renderHome();

    expect(await screen.findByText('2 to approve')).toBeInTheDocument();
  });

  it('renders NO issues chip at zero open, and "N open" above it', async () => {
    renderHome();
    await screen.findByRole('button', { name: /^Issues$/ });
    expect(screen.queryByText(/open$/i)).not.toBeInTheDocument();
  });

  it('chips issues with the open count', async () => {
    _openNcrs = [{ status: 'open' }, { status: 'open' }];
    renderHome();

    expect(await screen.findByText('2 open')).toBeInTheDocument();
  });

  // The Lots chip is the one real upgrade: the foreman's day, known at 6:40am.
  it('says what the day expects — checks only', async () => {
    _dueToday = [{}, {}, {}];
    renderHome();

    expect(await screen.findByText('3 checks today')).toBeInTheDocument();
  });

  it('leads with the hold point when one is ready, and keeps the check count', async () => {
    _blocking = [{}];
    _dueToday = [{}];
    renderHome();

    expect(await screen.findByText('HP ready · 1 check')).toBeInTheDocument();
  });

  it('renders NO lots chip when the day asks nothing', async () => {
    renderHome();

    await screen.findByRole('button', { name: /^Lots$/ });
    expect(screen.queryByText(/check/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/HP ready/i)).not.toBeInTheDocument();
  });

  it('never chips Drawings & Docs — a reference does not demand', async () => {
    _blocking = [{}];
    _pendingDockets = [{ status: 'pending_approval' }];
    renderHome();

    const docs = await screen.findByRole('button', { name: /Drawings and documents/i });
    // Its accessible name is the title alone: no count was folded in.
    expect(docs.textContent).toBe('Drawings & Docs');
  });
});

describe('HomeScreen unfiled-photos notice', () => {
  beforeEach(() => {
    mockUseEffectiveProjectId.mockReturnValue({
      projectId: 'proj-1',
      isResolving: false,
      hasNoProject: false,
    });
  });

  // An occasional job: the card exists only while the job does.
  it('is absent when every photo is already on a lot', async () => {
    _unfiledCount = 0;
    renderHome();

    await screen.findByRole('button', { name: /^Lots$/ });
    expect(screen.queryByText(/aren't on a lot yet/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/isn't on a lot yet/i)).not.toBeInTheDocument();
  });

  it('appears while photos are unfiled and taps through to the photo register', async () => {
    _unfiledCount = 2;
    renderHome();

    const notice = await screen.findByRole('button', { name: /2 photos are not on a lot yet/i });
    expect(notice).toHaveTextContent("2 photos aren't on a lot yet.");
    expect(notice).toHaveTextContent('Tap to file them.');

    fireEvent.click(notice);
    expect(screen.getByTestId('loc').textContent).toContain('/m/photos');
  });

  it('reads as one photo in the singular', async () => {
    _unfiledCount = 1;
    renderHome();

    expect(
      await screen.findByRole('button', { name: /1 photo is not on a lot yet/i }),
    ).toBeInTheDocument();
  });
});
