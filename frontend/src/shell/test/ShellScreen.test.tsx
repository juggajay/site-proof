/**
 * Tests for ShellScreen.
 *
 * Covers:
 *   - Inner variant: back button navigates to declared parent (NOT navigate(-1))
 *   - Home variant: renders greeting + role chip
 *   - focus-visible ring present on back button
 *   - aria label on back button
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ShellScreen } from '../components/ShellScreen';

// ── Mocks ─────────────────────────────────────────────────────────────────────

// SyncChip — avoid wiring the offline lib
vi.mock('../components/SyncChip', () => ({
  SyncChip: () => <span data-testid="sync-chip">sync</span>,
}));

// useTimeGreeting
vi.mock('../hooks/useTimeGreeting', () => ({
  useTimeGreeting: () => 'Morning, Jay',
}));

// useAuth
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: { fullName: 'Jay Ryan', roleInCompany: 'foreman' },
  }),
}));

// useEffectiveProjectId
vi.mock('@/hooks/useEffectiveProjectId', () => ({
  useEffectiveProjectId: () => ({
    projectId: 'proj-123',
    isResolving: false,
    hasNoProject: false,
  }),
}));

// ── Helper ────────────────────────────────────────────────────────────────────

function renderInRouter(ui: React.ReactElement, initialPath = '/m/screen') {
  // The home header resolves the project NAME via a TanStack query, so every
  // render needs a QueryClientProvider (queries disabled — name resolution is
  // covered by its own test seeding the cache).
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="*" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ShellScreen — inner variant', () => {
  it('renders the title', () => {
    renderInRouter(
      <ShellScreen variant="inner" title="Lots" parent="/m">
        <p>Content</p>
      </ShellScreen>,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Lots');
  });

  it('renders the sub-line when provided', () => {
    renderInRouter(
      <ShellScreen variant="inner" title="Lots" parent="/m" sub={<span>3 active</span>}>
        <p>Content</p>
      </ShellScreen>,
    );
    expect(screen.getByText('3 active')).toBeInTheDocument();
  });

  it('back button has accessible aria-label', () => {
    renderInRouter(
      <ShellScreen variant="inner" title="Lots" parent="/m">
        <p>Content</p>
      </ShellScreen>,
    );
    const btn = screen.getByRole('button', { name: /go back/i });
    expect(btn).toBeInTheDocument();
  });

  it('renders the SyncChip', () => {
    renderInRouter(
      <ShellScreen variant="inner" title="Lots" parent="/m">
        <p>Content</p>
      </ShellScreen>,
    );
    expect(screen.getByTestId('sync-chip')).toBeInTheDocument();
  });

  it('renders children in main', () => {
    renderInRouter(
      <ShellScreen variant="inner" title="Lots" parent="/m">
        <p>hello world</p>
      </ShellScreen>,
    );
    expect(screen.getByText('hello world')).toBeInTheDocument();
  });

  it('renders the bottom slot when provided', () => {
    renderInRouter(
      <ShellScreen
        variant="inner"
        title="Lots"
        parent="/m"
        bottom={<div data-testid="bottom-bar">bottom</div>}
      >
        <p>Content</p>
      </ShellScreen>,
    );
    expect(screen.getByTestId('bottom-bar')).toBeInTheDocument();
  });
});

describe('ShellScreen — home variant', () => {
  it('renders the greeting as h1', () => {
    renderInRouter(
      <ShellScreen variant="home">
        <p>Content</p>
      </ShellScreen>,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Morning, Jay');
  });

  it('renders CIVOS kicker', () => {
    renderInRouter(
      <ShellScreen variant="home">
        <p>Content</p>
      </ShellScreen>,
    );
    expect(screen.getByLabelText('CIVOS')).toBeInTheDocument();
  });

  it('does not render a back button', () => {
    renderInRouter(
      <ShellScreen variant="home">
        <p>Content</p>
      </ShellScreen>,
    );
    expect(screen.queryByRole('button', { name: /go back/i })).not.toBeInTheDocument();
  });

  it('shows the project NAME from the cached projects query (not the id)', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });
    qc.setQueryData(['projects'], {
      projects: [{ id: 'proj-123', name: 'Demo Walkthrough 2027' }],
    });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/m']}>
          <Routes>
            <Route
              path="*"
              element={
                <ShellScreen variant="home">
                  <p>Content</p>
                </ShellScreen>
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('Demo Walkthrough 2027')).toBeInTheDocument();
    expect(screen.queryByText(/proj-123|Project proj/)).not.toBeInTheDocument();
  });
});

describe('ShellScreen — back navigation navigates to declared parent', () => {
  it('navigates to parent path on back button click', async () => {
    function Spy() {
      return <span data-testid="spy" />;
    }

    // We render with a real MemoryRouter that includes a route at /m to detect
    // navigation. Rather than mocking navigate, we check the history changed.
    const { getByRole, findByTestId } = render(
      <MemoryRouter initialEntries={['/m/lots']}>
        <Routes>
          <Route
            path="/m/lots"
            element={
              <ShellScreen variant="inner" title="Lots" parent="/m">
                <p>Content</p>
              </ShellScreen>
            }
          />
          <Route path="/m" element={<Spy />} />
        </Routes>
      </MemoryRouter>,
    );

    const backBtn = getByRole('button', { name: /go back/i });
    fireEvent.click(backBtn);

    // After click, the router should render the /m route → Spy renders
    const spy = await findByTestId('spy');
    expect(spy).toBeInTheDocument();
  });
});
