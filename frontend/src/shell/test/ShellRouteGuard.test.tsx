import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ShellRouteGuard } from '../ShellRouteGuard';

vi.mock('../shellFlag', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../shellFlag')>();
  return {
    ...actual,
    useShellV2Enabled: vi.fn(),
  };
});

import { useShellV2Enabled } from '../shellFlag';
const mockUseShellV2Enabled = useShellV2Enabled as ReturnType<typeof vi.fn>;

function DashboardProbe() {
  const location = useLocation();
  return <div data-testid="dashboard-location">{location.pathname}</div>;
}

function renderWithRouter(shellEnabled: boolean) {
  mockUseShellV2Enabled.mockReturnValue(shellEnabled);

  return render(
    <MemoryRouter initialEntries={['/m/lots']}>
      <Routes>
        <Route
          path="/m/*"
          element={
            <ShellRouteGuard>
              <div data-testid="shell-route">Shell route</div>
            </ShellRouteGuard>
          }
        />
        <Route path="/dashboard" element={<DashboardProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ShellRouteGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders shell routes when the shell is enabled', () => {
    renderWithRouter(true);
    expect(screen.getByTestId('shell-route')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-location')).not.toBeInTheDocument();
  });

  it('redirects direct /m route access back to dashboard when the shell is disabled', () => {
    renderWithRouter(false);
    expect(screen.getByTestId('dashboard-location')).toHaveTextContent('/dashboard');
    expect(screen.queryByTestId('shell-route')).not.toBeInTheDocument();
  });
});
