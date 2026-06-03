import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ITPTemplate } from './itpPageData';
import { renderWithProviders, screen } from '@/test/renderWithProviders';

// Mutable auth role + a controllable bootstrap query, hoisted so the vi.mock
// factories below (which run before the imports) can close over them.
const authState = vi.hoisted(() => ({ actualRole: null as string | null }));
const useItpTemplatesQueryMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ actualRole: authState.actualRole }),
  getAuthToken: () => 'test-token',
}));

// Keep the real router (MemoryRouter, Link) but pin the project route param so
// the page renders as if mounted at /projects/p1/itp.
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useParams: () => ({ projectId: 'p1' }) };
});

// Drive the page's bootstrap query directly: this test isolates role-aware
// action visibility, not the data/network layer.
vi.mock('./itpPageData', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./itpPageData')>();
  return { ...actual, useItpTemplatesQuery: useItpTemplatesQueryMock };
});

import { ITPPage } from './ITPPage';

const LOCAL_TEMPLATE: ITPTemplate = {
  id: 't1',
  name: 'Earthworks ITP',
  description: 'Seeded local template',
  activityType: 'Earthworks',
  createdAt: '2026-01-15T00:00:00.000Z',
  isGlobalTemplate: false,
  stateSpec: null,
  isActive: true,
  checklistItems: [
    {
      id: 'ci-1',
      description: 'Verify formation is ready',
      category: 'Preparation',
      responsibleParty: 'contractor',
      isHoldPoint: true,
      pointType: 'hold_point',
      evidenceRequired: 'photo',
      order: 1,
    },
  ],
};

function mockTemplates(templates: ITPTemplate[]) {
  useItpTemplatesQueryMock.mockReturnValue({
    data: { templates, projectSpecificationSet: 'TfNSW' },
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  });
}

beforeEach(() => {
  useItpTemplatesQueryMock.mockReset();
  authState.actualRole = null;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('ITPPage role-aware template management', () => {
  it('shows template-management actions for a manager (project_manager)', () => {
    authState.actualRole = 'project_manager';
    mockTemplates([LOCAL_TEMPLATE]);

    renderWithProviders(<ITPPage />);

    expect(screen.getByText('Earthworks ITP')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create ITP Template' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import from Project' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Active' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Back to Lots' })).not.toBeInTheDocument();
  });

  it('hides template-management actions for a foreman but keeps templates visible', () => {
    authState.actualRole = 'foreman';
    mockTemplates([LOCAL_TEMPLATE]);

    renderWithProviders(<ITPPage />);

    // Read-only field context is preserved.
    expect(screen.getByText('Earthworks ITP')).toBeInTheDocument();
    expect(screen.getByText('1 checklist items')).toBeInTheDocument();

    // No template setup/admin controls are offered.
    expect(screen.queryByRole('button', { name: 'Create ITP Template' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Import from Project' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Active' })).not.toBeInTheDocument();

    // Clear route back to the field workflow.
    expect(screen.getByRole('link', { name: 'Back to Lots' })).toHaveAttribute(
      'href',
      '/projects/p1/lots',
    );
  });

  it('gives a foreman field guidance and a lots route on the empty state', () => {
    authState.actualRole = 'foreman';
    mockTemplates([]);

    renderWithProviders(<ITPPage />);

    expect(
      screen.getByText(/No ITP templates are available for this project/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Create Your First Template' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Lots' })).toHaveAttribute(
      'href',
      '/projects/p1/lots',
    );
  });

  it('keeps the create-first CTA on the empty state for a manager (admin)', () => {
    authState.actualRole = 'admin';
    mockTemplates([]);

    renderWithProviders(<ITPPage />);

    expect(screen.getByRole('button', { name: 'Create Your First Template' })).toBeInTheDocument();
  });
});
