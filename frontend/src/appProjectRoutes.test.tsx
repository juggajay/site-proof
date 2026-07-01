import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes, useLocation } from 'react-router-dom';
import { renderWithProviders, screen, waitFor } from '@/test/renderWithProviders';
import { removeLocalStorageItem } from '@/lib/storagePreferences';

const authState = vi.hoisted(() => ({
  user: {
    id: 'subbie-1',
    email: 'subbie@example.com',
    role: 'subcontractor',
    roleInCompany: 'subcontractor',
    companyId: null,
    hasSubcontractorPortalAccess: true,
  } as Record<string, unknown> | null,
  loading: false,
}));

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: authState.user, loading: authState.loading }),
}));

vi.mock('@/lib/api', () => ({
  apiFetch: apiFetchMock,
}));

vi.mock('./appLazyPages', () => ({
  ProjectDetailPage: () => <div>Project detail</div>,
}));

import { ProjectDetailRoute } from './appProjectRoutes';

const FLAG_KEY = 'siteproof.shell.v2';
let mobileViewport = true;

function setMobileViewport(isMobile: boolean) {
  mobileViewport = isMobile;
}

function LocationProbe({ label }: { label: string }) {
  const location = useLocation();
  return <div>{`${label}: ${location.pathname}${location.search}`}</div>;
}

function renderProjectRoute(initialEntry = '/projects/project-1') {
  return renderWithProviders(
    <Routes>
      <Route path="/projects/:projectId" element={<ProjectDetailRoute />} />
      <Route path="/p/work" element={<LocationProbe label="Subbie shell work" />} />
      <Route
        path="/subcontractor-portal/work"
        element={<LocationProbe label="Classic portal work" />}
      />
    </Routes>,
    { initialEntries: [initialEntry] },
  );
}

beforeEach(() => {
  apiFetchMock.mockReset();
  apiFetchMock.mockResolvedValue(true);
  authState.loading = false;
  authState.user = {
    id: 'subbie-1',
    email: 'subbie@example.com',
    role: 'subcontractor',
    roleInCompany: 'subcontractor',
    companyId: null,
    hasSubcontractorPortalAccess: true,
  };
  removeLocalStorageItem(FLAG_KEY);
  setMobileViewport(true);
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: mobileViewport,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

describe('ProjectDetailRoute subcontractor redirects', () => {
  it('sends mobile subcontractors to the subbie shell work route', async () => {
    renderProjectRoute();

    expect(
      await screen.findByText('Subbie shell work: /p/work?projectId=project-1'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Classic portal work/)).not.toBeInTheDocument();
  });

  it('keeps desktop subcontractors on the classic portal work route', async () => {
    setMobileViewport(false);
    renderProjectRoute();

    expect(
      await screen.findByText(
        'Classic portal work: /subcontractor-portal/work?projectId=project-1',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Subbie shell work/)).not.toBeInTheDocument();
  });

  it('preserves subcontractor company scope when bridging project URLs into the subbie shell', async () => {
    renderProjectRoute('/projects/project-1?subcontractorCompanyId=subbie-company-1');

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        '/api/subcontractors/my-company?projectId=project-1&subcontractorCompanyId=subbie-company-1',
      );
    });
    expect(
      await screen.findByText(
        'Subbie shell work: /p/work?projectId=project-1&subcontractorCompanyId=subbie-company-1',
      ),
    ).toBeInTheDocument();
  });
});
