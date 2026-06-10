import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Link, Route, Routes } from 'react-router-dom';
import { fireEvent, renderWithProviders, screen } from '@/test/renderWithProviders';

// MainLayout's chrome isn't under test here — only the <main> route outlet.
vi.mock('./Sidebar', () => ({ Sidebar: () => null }));
vi.mock('./Header', () => ({ Header: () => null }));
vi.mock('./MobileNav', () => ({ MobileNav: () => null }));

vi.mock('@/lib/auth', () => ({ useAuth: vi.fn() }));
vi.mock('@/hooks/useEffectiveProjectId', () => ({ useEffectiveProjectId: vi.fn() }));

import { MainLayout } from './MainLayout';
import { useAuth } from '@/lib/auth';
import { useEffectiveProjectId } from '@/hooks/useEffectiveProjectId';

const useAuthMock = vi.mocked(useAuth);
const useEffectiveProjectIdMock = vi.mocked(useEffectiveProjectId);

function renderTwoPagesInLayout() {
  return renderWithProviders(
    <Routes>
      <Route element={<MainLayout />}>
        <Route
          path="/page-a"
          element={
            <div>
              <p>Page A content</p>
              <Link to="/page-b">Go to page B</Link>
            </div>
          }
        />
        <Route path="/page-b" element={<p>Page B content</p>} />
      </Route>
    </Routes>,
    { initialEntries: ['/page-a'] },
  );
}

beforeEach(() => {
  useAuthMock.mockReturnValue({
    user: { id: 'u1', fullName: 'Pat Manager', role: 'project_manager' },
  } as unknown as ReturnType<typeof useAuth>);
  useEffectiveProjectIdMock.mockReturnValue({
    projectId: 'p1',
    isResolving: false,
    hasNoProject: false,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('MainLayout renders route content immediately (no transition fade)', () => {
  // A previous version faded <main> to opacity-0 for 150ms on every pathname
  // change (including initial mount), hiding content ~300ms per navigation
  // with no reduced-motion guard. These tests pin the fix: content is visible
  // right away and <main> carries no opacity transition classes.
  it('shows route content on mount without an opacity fade on <main>', () => {
    renderTwoPagesInLayout();

    expect(screen.getByText('Page A content')).toBeVisible();

    const main = document.querySelector('main');
    expect(main).not.toBeNull();
    expect(main!.className).not.toMatch(/opacity-0|transition-opacity/);
  });

  it('keeps content visible immediately after navigating — no hidden frame', () => {
    renderTwoPagesInLayout();

    fireEvent.click(screen.getByText('Go to page B'));

    // Synchronously after navigation the new route's content is on screen and
    // <main> is not hidden behind a fade (the old effect set opacity-0 here).
    expect(screen.getByText('Page B content')).toBeVisible();
    const main = document.querySelector('main');
    expect(main!.className).not.toMatch(/opacity-0|transition-opacity/);
  });
});
