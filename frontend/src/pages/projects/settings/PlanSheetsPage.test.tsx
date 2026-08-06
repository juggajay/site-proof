import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fireEvent,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from '@/test/renderWithProviders';
import { PlanSheetsPage } from './PlanSheetsPage';

const apiFetchMock = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: apiFetchMock };
});
vi.mock('@/components/ui/toaster', () => ({ toast: toastMock }));
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }));

// jsdom has no matchMedia; drive the viewport branch explicitly (desktop table
// vs phone card list) instead of relying on a polyfill default.
const viewport = vi.hoisted(() => ({ isMobile: false }));
vi.mock('@/hooks/useMediaQuery', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useMediaQuery')>();
  return { ...actual, useIsMobile: () => viewport.isMobile };
});

const SHEET = {
  id: 'ps-1',
  name: 'C-101 Rev D',
  pageNumber: 1,
  imageWidth: 4200,
  imageHeight: 2970,
  coordinateSystem: 'EPSG:7856',
  hasRegistration: true,
  createdAt: '2026-07-13T00:00:00.000Z',
  updatedAt: '2026-07-13T00:00:00.000Z',
};

function mockApi({
  role = 'admin',
  status = 'active',
  planSheets = [] as unknown[],
  controlLines = [] as unknown[],
}: {
  role?: string;
  status?: string;
  planSheets?: unknown[];
  controlLines?: unknown[];
} = {}) {
  apiFetchMock.mockImplementation(async (path: string, options?: RequestInit) => {
    if (path === '/api/projects/project-1') {
      return { project: { id: 'project-1', name: 'QA Project', status, currentUserRole: role } };
    }
    if (path.endsWith('/plan-sheets/ps-1') && options?.method === 'PATCH') {
      return { planSheet: { ...SHEET, name: 'Renamed' } };
    }
    if (path.endsWith('/plan-sheets/ps-1') && options?.method === 'DELETE') {
      return undefined;
    }
    if (path === '/api/projects/project-1/plan-sheets') {
      return { planSheets };
    }
    if (path === '/api/projects/project-1/control-lines') {
      return { controlLines };
    }
    return {};
  });
}

function renderPage() {
  renderWithProviders(
    <Routes>
      <Route path="/projects/:projectId/plan-sheets" element={<PlanSheetsPage />} />
    </Routes>,
    { initialEntries: ['/projects/project-1/plan-sheets'] },
  );
}

describe('PlanSheetsPage', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    toastMock.mockReset();
    viewport.isMobile = false;
  });

  it('renders sheets with dimensions, coordinate system, and registration badge', async () => {
    mockApi({ planSheets: [SHEET] });
    renderPage();

    expect(await screen.findByText('C-101 Rev D')).toBeInTheDocument();
    expect(screen.getByText('4200 × 2970')).toBeInTheDocument();
    expect(screen.getByText('GDA2020 / MGA Zone 56 (EPSG:7856)')).toBeInTheDocument();
    expect(screen.getByText('Registered')).toBeInTheDocument();
    // Registered sheet exposes Re-register.
    expect(screen.getByRole('button', { name: /Re-register/ })).toBeInTheDocument();
  });

  it('shows the empty state when there are no sheets', async () => {
    mockApi({ planSheets: [] });
    renderPage();

    expect(await screen.findByText('No plan sheets yet')).toBeInTheDocument();
  });

  it('renames a sheet via PATCH', async () => {
    mockApi({ planSheets: [SHEET] });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Rename C-101/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Renamed' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      const patch = apiFetchMock.mock.calls.find(
        ([p, o]) => p === '/api/projects/project-1/plan-sheets/ps-1' && o?.method === 'PATCH',
      );
      expect(patch).toBeTruthy();
      expect(JSON.parse((patch![1] as RequestInit).body as string)).toEqual({ name: 'Renamed' });
    });
  });

  it('shows the control-line-first ordering tip when there are no control lines', async () => {
    mockApi({ planSheets: [SHEET], controlLines: [] });
    renderPage();

    expect(
      await screen.findByText(/to register a sheet by chainage, add a control line first/i),
    ).toBeInTheDocument();
  });

  it('hides the ordering tip once a control line exists', async () => {
    mockApi({ planSheets: [SHEET], controlLines: [{ id: 'cl-1', coordinateSystem: 'EPSG:7856' }] });
    renderPage();

    expect(await screen.findByText('C-101 Rev D')).toBeInTheDocument();
    expect(
      screen.queryByText(/to register a sheet by chainage, add a control line first/i),
    ).not.toBeInTheDocument();
  });

  it('renders cards instead of the table on a phone', async () => {
    viewport.isMobile = true;
    mockApi({ planSheets: [SHEET] });
    renderPage();

    expect(await screen.findByText('C-101 Rev D')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    // Every column the table showed is still reachable on the card.
    expect(screen.getByText('4200 × 2970')).toBeInTheDocument();
    expect(screen.getByText(/GDA2020 \/ MGA Zone 56 \(EPSG:7856\)/)).toBeInTheDocument();
    expect(screen.getByText('Registered')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Rename C-101/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete C-101/ })).toBeInTheDocument();
  });

  it('hides card write actions for a read-only internal role on a phone', async () => {
    viewport.isMobile = true;
    mockApi({ role: 'viewer', planSheets: [SHEET] });
    renderPage();

    expect(await screen.findByText('C-101 Rev D')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Re-register/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete C-101/ })).not.toBeInTheDocument();
  });

  it('hides write actions for a read-only internal role', async () => {
    mockApi({ role: 'viewer', planSheets: [SHEET] });
    renderPage();

    expect(await screen.findByText('C-101 Rev D')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add plan sheets' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Re-register/ })).not.toBeInTheDocument();
  });
});
