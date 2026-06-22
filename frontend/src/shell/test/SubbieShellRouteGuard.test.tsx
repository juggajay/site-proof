import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { SubbieShellRouteGuard } from '../SubbieShellRouteGuard';

vi.mock('../shellFlag', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../shellFlag')>();
  return {
    ...actual,
    useSubbieShellActive: vi.fn(),
  };
});

import { useSubbieShellActive } from '../shellFlag';
const mockUseSubbieShellActive = useSubbieShellActive as ReturnType<typeof vi.fn>;

function LocationProbe({ label }: { label: string }) {
  const location = useLocation();
  return (
    <div data-testid="location">
      {label}:{location.pathname}
      {location.search}
    </div>
  );
}

function renderGuard(initialEntry: string, active: boolean) {
  mockUseSubbieShellActive.mockReturnValue(active);
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/p/*"
          element={
            <SubbieShellRouteGuard>
              <LocationProbe label="shell" />
            </SubbieShellRouteGuard>
          }
        />
        <Route path="/subcontractor-portal" element={<LocationProbe label="classic" />} />
        <Route
          path="/subcontractor-portal/docket/:docketId"
          element={<LocationProbe label="classic-docket" />}
        />
        <Route
          path="/subcontractor-portal/lots/:lotId/itp"
          element={<LocationProbe label="classic-itp" />}
        />
        <Route path="/subcontractor-portal/documents" element={<LocationProbe label="docs" />} />
        <Route path="/my-company" element={<LocationProbe label="company" />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SubbieShellRouteGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders /p routes when the subbie shell is active', () => {
    renderGuard('/p/dockets?projectId=project-1', true);
    expect(screen.getByTestId('location')).toHaveTextContent(
      'shell:/p/dockets?projectId=project-1',
    );
  });

  it('redirects inactive /p home back to the classic portal and preserves search', () => {
    renderGuard('/p?shell=off&projectId=project-1', false);
    expect(screen.getByTestId('location')).toHaveTextContent(
      'classic:/subcontractor-portal?shell=off&projectId=project-1',
    );
  });

  it('redirects inactive docket deep links to the classic docket route', () => {
    renderGuard('/p/docket/docket-1?projectId=project-1', false);
    expect(screen.getByTestId('location')).toHaveTextContent(
      'classic-docket:/subcontractor-portal/docket/docket-1?projectId=project-1',
    );
  });

  it('redirects inactive ITP deep links to the classic lot ITP route', () => {
    renderGuard('/p/lots/lot-1/itp?projectId=project-1', false);
    expect(screen.getByTestId('location')).toHaveTextContent(
      'classic-itp:/subcontractor-portal/lots/lot-1/itp?projectId=project-1',
    );
  });

  it('redirects inactive docs and company routes to their classic surfaces', () => {
    renderGuard('/p/docs?projectId=project-1', false);
    expect(screen.getByTestId('location')).toHaveTextContent(
      'docs:/subcontractor-portal/documents?projectId=project-1',
    );

    renderGuard('/p/company?projectId=project-1', false);
    expect(screen.getAllByTestId('location').at(-1)).toHaveTextContent(
      'company:/my-company?projectId=project-1',
    );
  });
});
