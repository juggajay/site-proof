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

function mockMatchMedia() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe('SubcontractorNCRsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMatchMedia();
    testDoubles.apiFetch.mockImplementation(async (url: string, options?: { method?: string }) => {
      if (url === '/api/ncrs/ncr-open/respond' && options?.method === 'POST') {
        return { ncr: { id: 'ncr-open', status: 'investigating' } };
      }

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
              id: 'ncr-open',
              ncrNumber: 'NCR-000',
              description: 'Respond to the cold joint',
              category: 'workmanship',
              status: 'open',
              severity: 'minor',
              raisedAt: '2026-06-29T00:00:00.000Z',
              raisedBy: { fullName: 'Quality Manager' },
              responsibleSubcontractorId: 'subbie-company-1',
              responsibleSubcontractor: {
                id: 'subbie-company-1',
                companyName: 'QA Subbie',
              },
              ncrLots: [{ lot: { lotNumber: 'LOT-013' } }],
              ncrEvidence: [],
            },
            {
              id: 'ncr-1',
              ncrNumber: 'NCR-001',
              description: 'Repair the failed concrete edge',
              category: 'workmanship',
              status: 'rectification',
              severity: 'major',
              raisedAt: '2026-06-29T00:00:00.000Z',
              raisedBy: { fullName: 'Quality Manager' },
              responsibleSubcontractorId: 'subbie-company-1',
              responsibleSubcontractor: {
                id: 'subbie-company-1',
                companyName: 'QA Subbie',
              },
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

  it('lets a responsible subcontractor submit an NCR response', async () => {
    const user = userEvent.setup();

    renderWithProviders(<SubcontractorNCRsPage />, {
      initialEntries: ['/subcontractor-portal/ncrs?projectId=project-1&shell=off'],
    });

    await waitFor(() => expect(screen.getByText('NCR-000')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Respond' }));

    await user.selectOptions(screen.getByLabelText(/Root Cause Category/i), 'process');
    await user.type(
      screen.getByLabelText(/Root Cause Description/i),
      'The install sequence was missed.',
    );
    await user.type(
      screen.getByLabelText(/Proposed Corrective Action/i),
      'Rework the affected edge and brief the crew.',
    );
    await user.click(screen.getByRole('button', { name: 'Submit Response' }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        '/api/ncrs/ncr-open/respond',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            rootCauseCategory: 'process',
            rootCauseDescription: 'The install sequence was missed.',
            proposedCorrectiveAction: 'Rework the affected edge and brief the crew.',
          }),
        }),
      ),
    );
  });
});
