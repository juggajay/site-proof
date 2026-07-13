import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fireEvent,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from '@/test/renderWithProviders';
import { ControlLinesPage } from './ControlLinesPage';

const apiFetchMock = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', () => ({ apiFetch: apiFetchMock }));
vi.mock('@/components/ui/toaster', () => ({ toast: toastMock }));
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }));

const CONTROL_LINE = {
  id: 'cl-1',
  projectId: 'project-1',
  name: 'MC00 Mainline',
  coordinateSystem: 'EPSG:7856',
  points: [
    { chainage: 0, easting: 500000, northing: 6250000 },
    { chainage: 1500, easting: 500010, northing: 6251500 },
  ],
  createdById: 'user-1',
  createdAt: '2026-07-13T00:00:00.000Z',
  updatedAt: '2026-07-13T00:00:00.000Z',
};

function mockApi({
  role = 'admin',
  status = 'active',
  controlLines = [] as unknown[],
}: { role?: string; status?: string; controlLines?: unknown[] } = {}) {
  apiFetchMock.mockImplementation(async (path: string, options?: RequestInit) => {
    if (path === '/api/projects/project-1') {
      return { project: { id: 'project-1', name: 'QA Project', status, currentUserRole: role } };
    }
    if (path === '/api/projects/project-1/control-lines' && options?.method === 'POST') {
      return { controlLine: { ...CONTROL_LINE, id: 'cl-new' } };
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
      <Route path="/projects/:projectId/control-lines" element={<ControlLinesPage />} />
    </Routes>,
    { initialEntries: ['/projects/project-1/control-lines'] },
  );
}

function getPostCalls() {
  return apiFetchMock.mock.calls.filter(([, options]) => options?.method === 'POST');
}

describe('ControlLinesPage', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    toastMock.mockReset();
  });

  it('renders control lines with coordinate system, point count, and chainage range', async () => {
    mockApi({ controlLines: [CONTROL_LINE] });
    renderPage();

    expect(await screen.findByText('MC00 Mainline')).toBeInTheDocument();
    expect(screen.getByText('GDA2020 / MGA Zone 56 (EPSG:7856)')).toBeInTheDocument();
    // Point count.
    expect(screen.getByText('2')).toBeInTheDocument();
    // Chainage range min – max.
    expect(screen.getByText('0 – 1,500')).toBeInTheDocument();
  });

  it('creates a control line from pasted points', async () => {
    mockApi({ controlLines: [] });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Add Control Line' }));
    const dialog = await screen.findByRole('dialog');

    fireEvent.change(within(dialog).getByLabelText('Name *'), {
      target: { value: 'Drainage Line A' },
    });
    fireEvent.change(within(dialog).getByLabelText('Paste control points'), {
      target: { value: '0,500000,6250000\n100,500010,6250100' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /Use 2 rows/ }));

    fireEvent.click(within(dialog).getByRole('button', { name: 'Add Control Line' }));

    await waitFor(() => expect(getPostCalls()).toHaveLength(1));
    expect(getPostCalls()[0]).toEqual([
      '/api/projects/project-1/control-lines',
      {
        method: 'POST',
        body: JSON.stringify({
          name: 'Drainage Line A',
          coordinateSystem: 'EPSG:7856',
          points: [
            { chainage: 0, easting: 500000, northing: 6250000 },
            { chainage: 100, easting: 500010, northing: 6250100 },
          ],
        }),
      },
    ]);
  });

  it('hides write actions for a read-only internal role', async () => {
    mockApi({ role: 'viewer', controlLines: [CONTROL_LINE] });
    renderPage();

    expect(await screen.findByText('MC00 Mainline')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add Control Line' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit MC00/ })).not.toBeInTheDocument();
  });
});
