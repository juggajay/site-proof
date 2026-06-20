import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/renderWithProviders';
import { SubcontractorDocumentsPage } from './SubcontractorDocumentsPage';

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { id: 'subbie-1', email: 'subbie@example.com' } }),
}));

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(async (url: string) => {
    if (url === '/api/subcontractors/my-company') {
      return {
        company: {
          id: 'subbie-company-1',
          companyName: 'QA Subbie',
          projectId: 'project-1',
          projectName: 'QA Project',
          portalAccess: { documents: true },
        },
      };
    }

    if (url === '/api/documents/project-1?subcontractorView=true') {
      return {
        documents: [
          {
            id: 'document-1',
            filename: 'uncategorised-drawing.pdf',
            fileUrl: 'supabase://documents/drawings/project-1/uncategorised-drawing.pdf',
            category: null,
            description: null,
            uploadedAt: '2026-06-20T10:00:00.000Z',
            fileSize: 2048,
          },
        ],
      };
    }

    throw new Error(`Unexpected apiFetch ${url}`);
  }),
}));

vi.mock('@/lib/documentAccess', () => ({ openDocumentAccessUrl: vi.fn() }));
vi.mock('@/components/ui/toaster', () => ({ toast: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }));

describe('SubcontractorDocumentsPage', () => {
  it('renders uncategorised documents under Other instead of crashing', async () => {
    renderWithProviders(<SubcontractorDocumentsPage />, {
      initialEntries: ['/subcontractor-portal/documents?projectId=project-1&shell=off'],
    });

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Documents' })).toBeInTheDocument(),
    );

    expect(screen.getByText('Other (1)')).toBeInTheDocument();
    expect(screen.getByText('uncategorised-drawing.pdf')).toBeInTheDocument();
    expect(screen.getByText('2.0 KB')).toBeInTheDocument();
  });
});
