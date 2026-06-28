import { beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen, waitFor } from '@/test/renderWithProviders';
import { apiFetch } from '@/lib/api';
import { openDocumentAccessUrl } from '@/lib/documentAccess';
import { SubcontractorNCRsPage } from './SubcontractorNCRsPage';

const testDoubles = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  openDocumentAccessUrl: vi.fn(async () => undefined),
}));

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { id: 'ncr-subbie-1', email: 'ncr-subbie@example.com' } }),
}));

vi.mock('@/lib/api', () => ({
  ApiError: class ApiError extends Error {},
  apiFetch: testDoubles.apiFetch,
}));

vi.mock('@/lib/documentAccess', () => ({
  openDocumentAccessUrl: testDoubles.openDocumentAccessUrl,
}));
vi.mock('@/components/ui/toaster', () => ({ toast: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }));

describe('SubcontractorNCRsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testDoubles.apiFetch.mockImplementation(async (url: string) => {
      if (url === '/api/subcontractors/my-company?projectId=project-1') {
        return {
          company: {
            id: 'subbie-company-1',
            companyName: 'QA Subbie',
            projectId: 'project-1',
            projectName: 'QA Project',
            portalAccess: { ncrs: true },
          },
        };
      }

      if (
        url ===
        '/api/ncrs?projectId=project-1&subcontractorCompanyId=subbie-company-1&subcontractorView=true'
      ) {
        return {
          ncrs: [
            {
              id: 'ncr-1',
              ncrNumber: 'NCR-001',
              description: 'Repair the failed concrete edge',
              status: 'rectification',
              severity: 'major',
              raisedAt: '2026-06-29T00:00:00.000Z',
              raisedBy: { fullName: 'Quality Manager' },
              ncrLots: [{ lot: { lotNumber: 'LOT-014' } }],
              ncrEvidence: [
                {
                  id: 'evidence-1',
                  evidenceType: 'photo',
                  document: {
                    id: 'document-1',
                    filename: 'rectification-photo.jpg',
                    mimeType: 'image/jpeg',
                  },
                },
              ],
            },
          ],
        };
      }

      throw new Error(`Unexpected apiFetch ${url}`);
    });
  });

  it('renders NCR evidence links returned by the scoped subcontractor NCR API', async () => {
    const user = userEvent.setup();

    renderWithProviders(<SubcontractorNCRsPage />, {
      initialEntries: ['/subcontractor-portal/ncrs?projectId=project-1&shell=off'],
    });

    await waitFor(() => expect(screen.getByRole('heading', { name: 'NCRs' })).toBeInTheDocument());

    expect(screen.getByText('QA Project')).toBeInTheDocument();
    expect(screen.getByText('NCR-001')).toBeInTheDocument();
    expect(screen.getByText('rectification-photo.jpg')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /rectification-photo\.jpg/i }));

    expect(openDocumentAccessUrl).toHaveBeenCalledWith('document-1', undefined);
    expect(apiFetch).toHaveBeenCalledWith('/api/subcontractors/my-company?projectId=project-1');
    expect(apiFetch).toHaveBeenCalledWith(
      '/api/ncrs?projectId=project-1&subcontractorCompanyId=subbie-company-1&subcontractorView=true',
    );
  });
});
