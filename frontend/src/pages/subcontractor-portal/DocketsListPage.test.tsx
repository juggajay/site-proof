import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/renderWithProviders';
import { apiFetch } from '@/lib/api';
import { DocketsListPage } from './DocketsListPage';

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { id: 'subbie-1', email: 'subbie@example.com' } }),
}));

vi.mock('@/hooks/useMediaQuery', () => ({
  useIsMobile: () => false,
}));

vi.mock('@/lib/api', () => ({
  ApiError: class ApiError extends Error {},
  apiFetch: vi.fn(async (url: string) => {
    if (url === '/api/subcontractors/my-company?projectId=project-1') {
      return {
        company: {
          id: 'subbie-company-1',
          projectId: 'project-1',
        },
      };
    }

    if (url === '/api/dockets?projectId=project-1&subcontractorCompanyId=subbie-company-1') {
      return { dockets: [] };
    }

    throw new Error(`Unexpected apiFetch ${url}`);
  }),
}));

describe('DocketsListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error instead of an empty docket history when dockets fail to load', async () => {
    vi.mocked(apiFetch).mockImplementation(async (url: string) => {
      if (url === '/api/subcontractors/my-company?projectId=project-1') {
        return {
          company: {
            id: 'subbie-company-1',
            projectId: 'project-1',
          },
        };
      }
      if (url.startsWith('/api/dockets')) {
        throw new Error('Docket API unavailable');
      }
      throw new Error(`Unexpected apiFetch ${url}`);
    });

    renderWithProviders(<DocketsListPage />, {
      initialEntries: ['/subcontractor-portal/dockets?projectId=project-1&shell=off'],
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Docket API unavailable');
    expect(screen.queryByText('No dockets yet')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to portal/i })).toHaveAttribute(
      'href',
      '/subcontractor-portal?projectId=project-1&subcontractorCompanyId=subbie-company-1',
    );
  });
});
