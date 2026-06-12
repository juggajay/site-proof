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
import { MemoryRouter, Routes, Route } from 'react-router-dom';
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

function renderWithRouter(active: boolean) {
  mockUseSubbieShellActive.mockReturnValue(active);
  return render(
    <MemoryRouter initialEntries={['/subcontractor-portal']}>
      <Routes>
        <Route
          path="/subcontractor-portal"
          element={
            <SubbieShellGuard>
              <div data-testid="classic-dashboard">Classic Portal</div>
            </SubbieShellGuard>
          }
        />
        <Route path="/p" element={<div data-testid="subbie-shell-home">Subbie Shell Home</div>} />
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

  it('renders the classic dashboard when the subbie shell is inactive (?shell=off / desktop)', () => {
    renderWithRouter(false);
    expect(screen.getByTestId('classic-dashboard')).toBeInTheDocument();
    expect(screen.queryByTestId('subbie-shell-home')).not.toBeInTheDocument();
  });
});
