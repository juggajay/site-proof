import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ITPTemplate } from './itpPageData';
import { renderWithProviders, screen, fireEvent } from '@/test/renderWithProviders';

// Mutable auth role + a controllable bootstrap query, hoisted so the vi.mock
// factories below (which run before the imports) can close over them.
const authState = vi.hoisted(() => ({ actualRole: null as string | null }));
const useItpTemplatesQueryMock = vi.hoisted(() => vi.fn());
const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ actualRole: authState.actualRole }),
  getAuthToken: () => 'test-token',
}));

// Keep the real ApiError (so extractErrorMessage parses the server body) but
// drive apiFetch directly to exercise the template-save error path.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: apiFetchMock };
});

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
import { ApiError } from '@/lib/api';

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

const LIBRARY_TEMPLATE: ITPTemplate = {
  id: 'g1',
  name: 'TfNSW Earthworks ITP',
  description: 'Seeded library template',
  activityType: 'Earthworks',
  createdAt: '2026-01-10T00:00:00.000Z',
  isGlobalTemplate: true,
  stateSpec: 'TfNSW',
  isActive: true,
  checklistItems: [
    {
      id: 'ci-g1',
      description: 'Confirm survey conformance',
      category: 'Survey',
      responsibleParty: 'contractor',
      isHoldPoint: false,
      pointType: 'standard',
      evidenceRequired: 'none',
      order: 1,
    },
  ],
};

function mockTemplates(templates: ITPTemplate[], projectSpecificationSet: string | null = 'TfNSW') {
  useItpTemplatesQueryMock.mockReturnValue({
    data: { templates, projectSpecificationSet },
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  });
}

beforeEach(() => {
  useItpTemplatesQueryMock.mockReset();
  apiFetchMock.mockReset();
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
    expect(
      screen.getByRole('button', { name: 'Help for Inspection & Test Plans (ITPs)' }),
    ).toBeInTheDocument();
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

  it('labels the library filter with the project spec set when one is configured', () => {
    authState.actualRole = 'project_manager';
    mockTemplates([LOCAL_TEMPLATE]);

    renderWithProviders(<ITPPage />);

    expect(screen.getByText('Include TfNSW library templates')).toBeInTheDocument();
  });

  it('falls back to neutral library wording when the project has no spec set', () => {
    authState.actualRole = 'project_manager';
    mockTemplates([LOCAL_TEMPLATE], null);

    renderWithProviders(<ITPPage />);

    expect(screen.getByText('Include state spec library templates')).toBeInTheDocument();
    expect(screen.queryByText('Include MRTS library templates')).not.toBeInTheDocument();
  });
});

describe('ITPPage empty state leads with the spec library', () => {
  it('leads with the library when the project owns no templates but the library has some', () => {
    authState.actualRole = 'project_manager';
    mockTemplates([LIBRARY_TEMPLATE]);

    renderWithProviders(<ITPPage />);

    // Library-led lead-in panel, with build-from-scratch demoted to secondary.
    expect(
      screen.getByRole('heading', { name: 'Start from the TfNSW library' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Build a template from scratch' }),
    ).toBeInTheDocument();

    // The pre-filtered library list is right below, ready to copy.
    expect(screen.getByText('TfNSW Earthworks ITP')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();

    // The old build-from-scratch-first empty state is gone.
    expect(
      screen.queryByRole('button', { name: 'Create Your First Template' }),
    ).not.toBeInTheDocument();
  });

  it('drops the library lead-in once the project has templates of its own', () => {
    authState.actualRole = 'project_manager';
    mockTemplates([LOCAL_TEMPLATE, LIBRARY_TEMPLATE]);

    renderWithProviders(<ITPPage />);

    expect(screen.getByText('Earthworks ITP')).toBeInTheDocument();
    expect(screen.getByText('TfNSW Earthworks ITP')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Start from the TfNSW library' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Build a template from scratch' }),
    ).not.toBeInTheDocument();
  });

  it('never leads a foreman into template setup, even when only library templates exist', () => {
    authState.actualRole = 'foreman';
    mockTemplates([LIBRARY_TEMPLATE]);

    renderWithProviders(<ITPPage />);

    expect(screen.getByText('TfNSW Earthworks ITP')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Start from the TfNSW library' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Build a template from scratch' }),
    ).not.toBeInTheDocument();
  });

  it('shows honest guidance when the library has nothing for the project spec set', () => {
    authState.actualRole = 'admin';
    mockTemplates([], 'MRTS');

    renderWithProviders(<ITPPage />);

    expect(
      screen.getByRole('heading', { name: 'No MRTS library templates yet' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/The template library has nothing for MRTS yet/i)).toBeInTheDocument();
    // Header + guidance both offer the import path.
    expect(screen.getAllByRole('button', { name: 'Import from Project' })).toHaveLength(2);
    expect(
      screen.queryByRole('button', { name: 'Create Your First Template' }),
    ).not.toBeInTheDocument();

    // Build from scratch still works as the fallback.
    fireEvent.click(screen.getByRole('button', { name: 'Build a template from scratch' }));
    expect(screen.getByRole('heading', { name: 'Create ITP Template' })).toBeInTheDocument();
  });

  it('points an admin at project settings when no spec set is chosen', () => {
    authState.actualRole = 'admin';
    mockTemplates([], null);

    renderWithProviders(<ITPPage />);

    expect(
      screen.getByRole('heading', { name: 'Start from the state spec ITP library' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Choose a specification standard' })).toHaveAttribute(
      'href',
      '/projects/p1/settings',
    );
    expect(
      screen.getByRole('button', { name: 'Build a template from scratch' }),
    ).toBeInTheDocument();
  });

  it('omits the settings link for template managers who cannot open project settings', () => {
    // site_manager can manage ITP templates but the settings route is
    // admin-gated, so the guidance must not link there.
    authState.actualRole = 'site_manager';
    mockTemplates([], null);

    renderWithProviders(<ITPPage />);

    expect(
      screen.getByRole('heading', { name: 'Start from the state spec ITP library' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Choose a specification standard' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/ask a project admin/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Build a template from scratch' }),
    ).toBeInTheDocument();
  });

  it('reveals the spec-set library list when the include-library filter is off', () => {
    authState.actualRole = 'project_manager';
    // The bootstrap query already carries library availability: with the
    // filter on it returns the library list, with it off nothing.
    useItpTemplatesQueryMock.mockImplementation(
      (_projectId: string | undefined, includeGlobal: boolean) => ({
        data: {
          templates: includeGlobal ? [LIBRARY_TEMPLATE] : [],
          projectSpecificationSet: 'TfNSW',
        },
        isFetching: false,
        error: null,
        refetch: vi.fn(),
      }),
    );

    renderWithProviders(<ITPPage />);

    // Filter defaults to on: the library list is already visible.
    expect(screen.getByText('TfNSW Earthworks ITP')).toBeInTheDocument();

    // Turn the filter off: no dead "create from scratch" wall — the empty
    // state's primary CTA brings the library back.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include TfNSW library templates' }));
    expect(screen.queryByText('TfNSW Earthworks ITP')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'No project templates yet' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Browse TfNSW library templates' }));
    expect(screen.getByText('TfNSW Earthworks ITP')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Start from the TfNSW library' }),
    ).toBeInTheDocument();
  });
});

describe('ITPPage template edit error handling', () => {
  const TEMPLATE_IN_USE_MESSAGE =
    "This template is in use by 2 lots with recorded sign-offs, so its checklist items can't be changed. Duplicate the template and edit the copy.";

  it('surfaces the 409 TEMPLATE_IN_USE message inside the edit modal and keeps it open', async () => {
    authState.actualRole = 'project_manager';
    mockTemplates([LOCAL_TEMPLATE]);
    apiFetchMock.mockRejectedValue(
      new ApiError(
        409,
        JSON.stringify({
          error: { message: TEMPLATE_IN_USE_MESSAGE, code: 'TEMPLATE_IN_USE' },
        }),
      ),
    );

    renderWithProviders(<ITPPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('heading', { name: 'Edit ITP Template' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    // The server's explanation appears verbatim, in an alert, inside the modal.
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(TEMPLATE_IN_USE_MESSAGE);

    // The modal stays open so the admin can read the next step.
    expect(screen.getByRole('heading', { name: 'Edit ITP Template' })).toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });
});
