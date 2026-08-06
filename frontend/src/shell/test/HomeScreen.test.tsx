/**
 * Tests for HomeScreen — the diary hero, the tile set, and the camera bar.
 *
 * This file drives the screen by SEEDING THE QUERY CACHE (queries disabled),
 * which is why the hero-state coverage lives here. The chip grammar itself —
 * which counts produce which chip, and the rule that a zero count produces NO
 * chip — is covered in src/shell/screens/HomeScreen.test.tsx against the
 * apiFetch boundary; it is not duplicated here.
 *
 * Covers:
 *   - Renders hero in "start" state (no diary) with correct copy
 *   - Renders hero in "in-progress" state with progress percentage
 *   - Renders hero in "submitted" state
 *   - The four permanent tiles render: Lots, Dockets, Issues, Drawings & Docs
 *   - Camera button present + opens CaptureModal
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ── Module mocks — all at top level ──────────────────────────────────────────

vi.mock('../components/SyncChip', () => ({
  SyncChip: () => <span data-testid="sync-chip" />,
}));

vi.mock('../hooks/useTimeGreeting', () => ({
  useTimeGreeting: () => 'Morning, Jay',
}));

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: { fullName: 'Jay Ryan', roleInCompany: 'foreman' },
  }),
  getAuthToken: () => null,
}));

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn((url: string) => {
    if (url.startsWith('/api/dashboard/')) return Promise.resolve({ blocking: [], dueToday: [] });
    if (url.startsWith('/api/diary/')) return Promise.resolve(null);
    if (url.startsWith('/api/dockets')) return Promise.resolve({ data: [] });
    if (url.startsWith('/api/ncrs')) return Promise.resolve({ data: [] });
    if (url.startsWith('/api/projects')) return Promise.resolve({ projects: [] });
    return Promise.resolve({});
  }),
}));

vi.mock('@/hooks/useEffectiveProjectId', () => ({
  useEffectiveProjectId: vi.fn().mockReturnValue({
    projectId: 'proj-abc',
    isResolving: false,
    hasNoProject: false,
  }),
}));

// CaptureModal spy
vi.mock('@/components/foreman/CaptureModal', () => ({
  CaptureModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="capture-modal">modal open</div> : null,
}));

// ── Render helper ─────────────────────────────────────────────────────────────

function renderWithQueryClient(queryClient: QueryClient, ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/m']}>
        <Routes>
          <Route path="*" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ── Lazily import HomeScreen so mocks are in place first ──────────────────────

async function getHomeScreen() {
  const mod = await import('../screens/HomeScreen');
  return mod.HomeScreen;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('HomeScreen — diary hero states (data via QueryClient cache)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows "Start today\'s diary" when no diary exists (empty cache)', async () => {
    const HomeScreen = await getHomeScreen();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });

    renderWithQueryClient(qc, <HomeScreen />);

    // When queries are disabled (no project-id dependent data), the hero
    // defaults to the "start" state
    expect(screen.getByText("Start today's diary")).toBeInTheDocument();
  });

  it('shows "Diary submitted" when diary is submitted (seeded cache)', async () => {
    const HomeScreen = await getHomeScreen();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });

    const todayKey = new Intl.DateTimeFormat('en-CA').format(new Date());
    // The hero query now caches the diary object directly (canonical by-date
    // endpoint with ?missing=null), not a { data: [...] } list wrapper.
    qc.setQueryData(['diaries', 'proj-abc', todayKey], { id: 'd1', status: 'submitted' });

    renderWithQueryClient(qc, <HomeScreen />);

    expect(screen.getByText('Diary submitted')).toBeInTheDocument();
  });

  it('shows "Finish today\'s diary" in-progress state (seeded cache)', async () => {
    const HomeScreen = await getHomeScreen();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });

    const todayKey = new Intl.DateTimeFormat('en-CA').format(new Date());
    qc.setQueryData(['diaries', 'proj-abc', todayKey], {
      id: 'd1',
      status: 'draft',
      weatherConditions: 'Fine',
      personnel: [{ id: 'p1' }],
      activities: [],
      delays: [],
    });

    renderWithQueryClient(qc, <HomeScreen />);

    expect(screen.getByText("Finish today's diary")).toBeInTheDocument();
    // 2 of 4 steps done = 50%
    expect(screen.getByText('50%')).toBeInTheDocument();
  });
});

describe('HomeScreen — hub tiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Four permanent cards = four permanent jobs. "Drawings & Docs" is the one
  // added in hub v2: finding the detail on a pit is a real standalone site job
  // that previously had no path off this screen. Photos is deliberately NOT a
  // card — capture is the camera bar, and filing is a notice card.
  it('renders the four permanent hub tiles', async () => {
    const HomeScreen = await getHomeScreen();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });

    renderWithQueryClient(qc, <HomeScreen />);

    expect(screen.getByRole('button', { name: /lots/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dockets/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /issues/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /drawings/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^photos/i })).not.toBeInTheDocument();
  });
});

describe('HomeScreen — camera bar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the "Take a photo" button', async () => {
    const HomeScreen = await getHomeScreen();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });

    renderWithQueryClient(qc, <HomeScreen />);

    expect(screen.getByRole('button', { name: /take a photo/i })).toBeInTheDocument();
  });

  it('opens CaptureModal when camera button is clicked', async () => {
    const HomeScreen = await getHomeScreen();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });

    renderWithQueryClient(qc, <HomeScreen />);

    const btn = screen.getByRole('button', { name: /take a photo/i });
    fireEvent.click(btn);

    expect(screen.getByTestId('capture-modal')).toBeInTheDocument();
  });
});
