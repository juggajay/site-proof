/**
 * Tests for ShellGuard.
 *
 * Covers:
 *   - Redirects to /m when shell is enabled
 *   - Renders children when shell is disabled
 *   - ?shell=off restores the normal dashboard (by disabling the flag)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ShellGuard } from '../ShellGuard';

// Mock useShellV2Enabled
vi.mock('../shellFlag', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../shellFlag')>();
  return {
    ...actual,
    useShellV2Enabled: vi.fn(),
  };
});

import { useShellV2Enabled } from '../shellFlag';
const mockUseShellV2Enabled = useShellV2Enabled as ReturnType<typeof vi.fn>;

function renderWithRouter(shellEnabled: boolean) {
  mockUseShellV2Enabled.mockReturnValue(shellEnabled);
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route
          path="/dashboard"
          element={
            <ShellGuard>
              <div data-testid="dashboard">Dashboard</div>
            </ShellGuard>
          }
        />
        <Route path="/m" element={<div data-testid="shell-home">Shell Home</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="shell-location">{`${location.pathname}${location.search}${location.hash}`}</div>
  );
}

describe('ShellGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to /m when shell is enabled', () => {
    renderWithRouter(true);
    expect(screen.getByTestId('shell-home')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard')).not.toBeInTheDocument();
  });

  it('preserves project query and hash when redirecting to the shell', () => {
    mockUseShellV2Enabled.mockReturnValue(true);

    render(
      <MemoryRouter initialEntries={['/dashboard?projectId=project-2#today']}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <ShellGuard>
                <div data-testid="dashboard">Dashboard</div>
              </ShellGuard>
            }
          />
          <Route path="/m" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('shell-location')).toHaveTextContent('/m?projectId=project-2#today');
  });

  it('renders children when shell is disabled', () => {
    renderWithRouter(false);
    expect(screen.getByTestId('dashboard')).toBeInTheDocument();
    expect(screen.queryByTestId('shell-home')).not.toBeInTheDocument();
  });

  it('restores dashboard when ?shell=off disables the flag (shell disabled)', () => {
    // When ?shell=off was applied, useShellV2Enabled returns false
    renderWithRouter(false);
    expect(screen.getByTestId('dashboard')).toBeInTheDocument();
  });
});
