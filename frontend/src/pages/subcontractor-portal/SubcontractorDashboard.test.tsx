import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DEFAULT_PORTAL_ACCESS } from './portalAccessModel';
import { SubcontractorDashboard, type Company } from './SubcontractorDashboard';

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { id: 'u1', fullName: 'Mick Hargraves', role: 'subcontractor' } }),
}));

const apiFetchMock = vi.fn();
vi.mock('@/lib/api', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

const noLotsText = /no lots assigned yet/i;

function makeCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: 'c1',
    companyName: 'Hargraves Earthmoving',
    projectId: 'proj-1',
    projectName: 'Demo Project',
    availableProjects: [],
    employees: [{ id: 'e1', name: 'Mick Hargraves', status: 'approved' }],
    plant: [],
    portalAccess: { ...DEFAULT_PORTAL_ACCESS, lots: true },
    ...overrides,
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SubcontractorDashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SubcontractorDashboard assigned lots loading state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not show the no-lots warning before the assigned lots response arrives', async () => {
    const lotsDeferred = createDeferred<{ lots: [] }>();
    apiFetchMock.mockImplementation((url: string) => {
      if (url.startsWith('/api/subcontractors/my-company')) {
        return Promise.resolve({ company: makeCompany() });
      }
      if (url.startsWith('/api/dockets')) return Promise.resolve({ dockets: [] });
      if (url.startsWith('/api/lots')) return lotsDeferred.promise;
      if (url.startsWith('/api/notifications')) return Promise.resolve({ notifications: [] });
      return Promise.resolve({});
    });

    renderDashboard();

    expect(await screen.findByText('Hargraves Earthmoving')).toBeInTheDocument();
    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith(expect.stringMatching(/^\/api\/lots/)),
    );
    expect(screen.queryByText(noLotsText)).not.toBeInTheDocument();

    lotsDeferred.resolve({ lots: [] });
    expect(await screen.findAllByText(noLotsText)).not.toHaveLength(0);
  });
});
