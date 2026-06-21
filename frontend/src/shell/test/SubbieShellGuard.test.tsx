/**
 * Tests for SubbieShellGuard.
 *
 * Covers:
 *   - Redirects /subcontractor-portal → /p when the subbie shell is active
 *   - Renders the classic dashboard when the subbie shell is inactive
 *     (?shell=off, desktop viewport, or unauthenticated)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { SubbieShellGuard } from '../SubbieShellGuard';

vi.mock('../shellFlag', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../shellFlag')>();
  return {
    ...actual,
    useSubbieShellActive: vi.fn(),
  };
});

import { useSubbieShellActive } from '../shellFlag';
const mockUseSubbieShellActive = useSubbieShellActive as ReturnType<typeof vi.fn>;

function ShellHomeProbe() {
  const location = useLocation();
  return (
    <div data-testid="subbie-shell-home">
      Subbie Shell Home
      <span data-testid="shell-location">{`${location.pathname}${location.search}`}</span>
    </div>
  );
}

function renderWithRouter(active: boolean, initialEntry = '/subcontractor-portal') {
  mockUseSubbieShellActive.mockReturnValue(active);
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/subcontractor-portal"
          element={
            <SubbieShellGuard>
              <div data-testid="classic-dashboard">Classic Portal</div>
            </SubbieShellGuard>
          }
        />
        <Route path="/p" element={<ShellHomeProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SubbieShellGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to /p when the subbie shell is active', () => {
    renderWithRouter(true);
    expect(screen.getByTestId('subbie-shell-home')).toBeInTheDocument();
    expect(screen.queryByTestId('classic-dashboard')).not.toBeInTheDocument();
  });

  it('preserves the selected project query when redirecting into the shell', () => {
    renderWithRouter(true, '/subcontractor-portal?projectId=project-2');
    expect(screen.getByTestId('shell-location')).toHaveTextContent('/p?projectId=project-2');
  });

  it('renders the classic dashboard when the subbie shell is inactive (?shell=off / desktop)', () => {
    renderWithRouter(false);
    expect(screen.getByTestId('classic-dashboard')).toBeInTheDocument();
    expect(screen.queryByTestId('subbie-shell-home')).not.toBeInTheDocument();
  });
});
