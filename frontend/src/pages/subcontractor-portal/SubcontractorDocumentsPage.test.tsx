import { beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen, waitFor } from '@/test/renderWithProviders';
import { apiFetch } from '@/lib/api';
import { openDocumentAccessUrl } from '@/lib/documentAccess';
import { SubcontractorDocumentsPage } from './SubcontractorDocumentsPage';

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { id: 'subbie-1', email: 'subbie@example.com' } }),
}));

vi.mock('@/lib/api', () => ({
  ApiError: class ApiError extends Error {},
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

    if (url === '/api/subcontractors/my-company?projectId=project-1') {
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

    if (url === '/api/subcontractors/my-company?projectId=project-2') {
      return {
        company: {
          id: 'subbie-company-1',
          companyName: 'QA Subbie',
          projectId: 'project-2',
          projectName: 'Second QA Project',
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

    if (url === '/api/documents/project-2?subcontractorView=true') {
      return {
        documents: [
          {
            id: 'document-2',
            filename: 'sanitised-specification.pdf',
            category: 'Specification',
            description: null,
            uploadedAt: '2026-06-20T10:00:00.000Z',
            fileSize: 4096,
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it('uses the selected portal project when loading documents', async () => {
    renderWithProviders(<SubcontractorDocumentsPage />, {
      initialEntries: ['/subcontractor-portal/documents?projectId=project-2&shell=off'],
    });

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Documents' })).toBeInTheDocument(),
    );

    expect(screen.getByText('Second QA Project')).toBeInTheDocument();
    expect(screen.getByText('sanitised-specification.pdf')).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith('/api/subcontractors/my-company?projectId=project-2');
    expect(apiFetch).toHaveBeenCalledWith('/api/documents/project-2?subcontractorView=true');
  });

  it('shows an access error instead of an empty state when the selected project is denied', async () => {
    vi.mocked(apiFetch).mockImplementationOnce(async () => {
      throw new Error('Selected project is unavailable');
    });

    renderWithProviders(<SubcontractorDocumentsPage />, {
      initialEntries: ['/subcontractor-portal/documents?projectId=project-2&shell=off'],
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Selected project is unavailable');
    expect(screen.queryByText('No documents available')).not.toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalledWith('/api/documents/project-2?subcontractorView=true');
    expect(screen.getByRole('link', { name: /back to portal/i })).toHaveAttribute(
      'href',
      '/subcontractor-portal?projectId=project-2',
    );
  });

  it('preserves selected project context when documents portal access is disabled', async () => {
    vi.mocked(apiFetch).mockImplementationOnce(async () => ({
      company: {
        id: 'subbie-company-1',
        companyName: 'QA Subbie',
        projectId: 'project-2',
        projectName: 'Second QA Project',
        portalAccess: { documents: false },
      },
    }));

    renderWithProviders(<SubcontractorDocumentsPage />, {
      initialEntries: ['/subcontractor-portal/documents?projectId=project-2&shell=off'],
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Documents portal access is not enabled for your company.',
    );
    expect(apiFetch).not.toHaveBeenCalledWith('/api/documents/project-2?subcontractorView=true');
    expect(screen.getByRole('link', { name: /back to portal/i })).toHaveAttribute(
      'href',
      '/subcontractor-portal?projectId=project-2',
    );
  });

  it('opens sanitised document responses by id when fileUrl is absent', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SubcontractorDocumentsPage />, {
      initialEntries: ['/subcontractor-portal/documents?projectId=project-2&shell=off'],
    });

    await user.click(await screen.findByRole('button', { name: /view document/i }));

    expect(openDocumentAccessUrl).toHaveBeenCalledWith('document-2', undefined);
  });
});
