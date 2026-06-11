/**
 * Tests for ShellRoutes — the /m/* route map.
 *
 * THE LOAD-BEARING ASSERTION (PR-7): no ComingSoonScreen is reachable from any
 * Home tile / camera-bar destination. Every Home surface — diary, lots, dockets,
 * issues, photos, AND docs (the last placeholder, removed in PR-7) — must resolve
 * to its real sub-tree, never the placeholder.
 *
 * Each sub-tree is mocked to a sentinel so this test asserts the ROUTE MAPPING in
 * isolation (no data hooks / network). ComingSoonScreen is mocked to a loud
 * sentinel that fails the test if it ever renders.
 *
 * MOCKS @/lib/useOfflineStatus is unnecessary here because every screen is a
 * sentinel, but kept defensive in case a real screen leaks in.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi } from 'vitest';

vi.mock('@/lib/useOfflineStatus', () => ({
  useOfflineStatus: () => ({ isOnline: true, pendingSyncCount: 0, isSyncing: false }),
}));

// Home tile destinations — each mocked to a labelled sentinel.
vi.mock('../screens/HomeScreen', () => ({
  HomeScreen: () => <div data-testid="screen-home" />,
}));
vi.mock('../screens/diary/DiaryShellRoutes', () => ({
  DiaryShellRoutes: () => <div data-testid="screen-diary" />,
}));
vi.mock('../screens/lots/LotsShellRoutes', () => ({
  LotsShellRoutes: () => <div data-testid="screen-lots" />,
}));
vi.mock('../screens/dockets/DocketsShellRoutes', () => ({
  DocketsShellRoutes: () => <div data-testid="screen-dockets" />,
}));
vi.mock('../screens/issues/IssuesShellRoutes', () => ({
  IssuesShellRoutes: () => <div data-testid="screen-issues" />,
}));
vi.mock('../screens/photos/PhotosShellRoutes', () => ({
  PhotosShellRoutes: () => <div data-testid="screen-photos" />,
}));
vi.mock('../screens/docs/DocsShellRoutes', () => ({
  DocsShellRoutes: () => <div data-testid="screen-docs" />,
}));

// ComingSoonScreen — loud sentinel. If any route renders it, tests fail.
vi.mock('../screens/ComingSoonScreen', () => ({
  ComingSoonScreen: () => <div data-testid="coming-soon" />,
}));

import { ShellRoutes } from '../ShellRoutes';

function renderAt(path: string) {
  // ShellRoutes is mounted under a parent /m/* route in the app, so its internal
  // routes resolve relative to /m. Mirror that here.
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/m/*" element={<ShellRoutes />} />
      </Routes>
    </MemoryRouter>,
  );
}

// Every Home tile / camera-bar destination and the screen it must resolve to.
const HOME_DESTINATIONS: Array<{ path: string; testid: string }> = [
  { path: '/m', testid: 'screen-home' },
  { path: '/m/diary', testid: 'screen-diary' },
  { path: '/m/lots', testid: 'screen-lots' },
  { path: '/m/dockets', testid: 'screen-dockets' },
  { path: '/m/issues', testid: 'screen-issues' },
  { path: '/m/photos', testid: 'screen-photos' },
  { path: '/m/docs', testid: 'screen-docs' },
];

describe('ShellRoutes', () => {
  it.each(HOME_DESTINATIONS)('routes $path to its real surface', ({ path, testid }) => {
    renderAt(path);
    expect(screen.getByTestId(testid)).toBeInTheDocument();
  });

  it.each(HOME_DESTINATIONS)('never renders ComingSoon at $path', ({ path }) => {
    renderAt(path);
    expect(screen.queryByTestId('coming-soon')).toBeNull();
  });

  it('routes /m/docs (the former placeholder) to the real Drawings & Docs surface', () => {
    renderAt('/m/docs');
    expect(screen.getByTestId('screen-docs')).toBeInTheDocument();
    expect(screen.queryByTestId('coming-soon')).toBeNull();
  });

  it('the route map source no longer wires ComingSoonScreen as a <Route>', () => {
    // Static guard complementing the render assertions: a regression that
    // re-adds a ComingSoon route would reintroduce a <ComingSoonScreen .../>
    // element in the source. ComingSoonScreen may still exist as a primitive,
    // but it must not appear inside ShellRoutes' JSX.
    // vitest runs with cwd at the frontend package root.
    const sourcePath = resolve(process.cwd(), 'src/shell/ShellRoutes.tsx');
    const source = readFileSync(sourcePath, 'utf8');
    expect(source).not.toMatch(/<ComingSoonScreen/);
    expect(source).not.toMatch(/import\s+\{\s*ComingSoonScreen/);
  });
});
