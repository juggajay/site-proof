import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import {
  fireEvent,
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
} from '@/test/renderWithProviders';

// Mutable auth user, hoisted so the vi.mock factory below (which runs before the
// imports) can close over it. ProjectsPage only reads `user` from useAuth.
const authState = vi.hoisted(() => ({ user: null as Record<string, unknown> | null }));
const navigateMock = vi.hoisted(() => vi.fn());
const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock('../../lib/auth', () => ({
  useAuth: () => ({ user: authState.user }),
}));

vi.mock('@/lib/api', () => ({
  apiFetch: apiFetchMock,
}));

// Keep the real router (MemoryRouter, Link) but capture navigation so we can
// assert the company-setup CTA routes to /onboarding.
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

import { ProjectsPage } from './ProjectsPage';

beforeEach(() => {
  authState.user = null;
  navigateMock.mockReset();
  apiFetchMock.mockReset();
  apiFetchMock.mockResolvedValue({ projects: [] });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('ProjectsPage company-onboarding gating', () => {
  it('shows the company-setup CTA for a logged-in user with no company', async () => {
    authState.user = { id: 'u1', email: 'owner@example.com', role: 'member', companyId: null };

    renderWithProviders(<ProjectsPage />);

    // Both the header button and the empty-state CTA route to onboarding,
    // never the project-create modal that would 403.
    const setupButtons = await screen.findAllByRole('button', { name: 'Set up your company' });
    expect(setupButtons.length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'New Project' })).not.toBeInTheDocument();

    setupButtons[0].click();
    expect(navigateMock).toHaveBeenCalledWith('/onboarding');
  });

  it('shows the normal New Project button for a user who already has a company', async () => {
    authState.user = {
      id: 'u2',
      email: 'pm@example.com',
      role: 'project_manager',
      companyId: 'c1',
    };

    renderWithProviders(<ProjectsPage />);

    expect(await screen.findByRole('button', { name: 'New Project' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Help for Projects' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Set up your company' })).not.toBeInTheDocument();
  });

  it('shows honest guidance (no New Project button) for a company member who cannot create projects and has no project membership', async () => {
    // Invited foreman/member: has a company, but roleInCompany is not in the
    // backend PROJECT_CREATOR_ROLES, and GET /api/projects returns nothing
    // because they are on no project team yet.
    authState.user = {
      id: 'u4',
      email: 'foreman@example.com',
      role: 'foreman',
      roleInCompany: 'foreman',
      companyId: 'c1',
      companyName: 'Acme Civil',
    };
    apiFetchMock.mockResolvedValue({ projects: [] });

    renderWithProviders(<ProjectsPage />);

    // The guidance empty state names the company and explains the recovery path,
    // instead of a dead-end create button on a blank page.
    expect(await screen.findByText('No projects yet')).toBeInTheDocument();
    expect(screen.getByText(/Acme Civil/)).toBeInTheDocument();
    expect(
      screen.getByText(/Ask your project admin to add you to a project team/),
    ).toBeInTheDocument();

    // No create affordance anywhere (header or empty state) since the API would
    // reject their POST /api/projects.
    expect(screen.queryByRole('button', { name: 'New Project' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create Project' })).not.toBeInTheDocument();
  });

  it('falls back to "your company" guidance when the member has no company name', async () => {
    authState.user = {
      id: 'u5',
      email: 'member@example.com',
      role: 'member',
      roleInCompany: 'member',
      companyId: 'c1',
      companyName: null,
    };
    apiFetchMock.mockResolvedValue({ projects: [] });

    renderWithProviders(<ProjectsPage />);

    expect(await screen.findByText('No projects yet')).toBeInTheDocument();
    // Fallback copy reads "...part of your company, but you haven't been added...".
    // The company name is interpolated as its own text node, so match against the
    // paragraph's full textContent (and use a curly-quote-tolerant fragment).
    expect(
      screen.getByText(
        (_content, element) =>
          element?.tagName === 'P' && (element.textContent ?? '').includes('part of your company'),
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New Project' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create Project' })).not.toBeInTheDocument();
  });

  it('shows the create-project empty state for an admin/PM with zero projects', async () => {
    authState.user = {
      id: 'u6',
      email: 'pm@example.com',
      role: 'project_manager',
      roleInCompany: 'project_manager',
      companyId: 'c1',
    };
    apiFetchMock.mockResolvedValue({ projects: [] });

    renderWithProviders(<ProjectsPage />);

    // Project creators keep the existing New Project / Create Project empty
    // state and never see the "added to a project team" guidance.
    expect(await screen.findByText('No projects found')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New Project' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Project' })).toBeInTheDocument();
    // Plus the secondary self-serve path: a one-click example project.
    expect(screen.getByRole('button', { name: 'Explore an example project' })).toBeInTheDocument();
    expect(screen.queryByText('No projects yet')).not.toBeInTheDocument();
  });

  it('seeds the example project from the empty state and navigates into it', async () => {
    authState.user = {
      id: 'u6',
      email: 'pm@example.com',
      role: 'project_manager',
      roleInCompany: 'project_manager',
      companyId: 'c1',
    };
    apiFetchMock.mockImplementation((path: string) => {
      if (path === '/api/projects/sample') {
        return Promise.resolve({ project: { id: 'sample-1' }, alreadyExisted: false });
      }
      return Promise.resolve({ projects: [] });
    });

    renderWithProviders(<ProjectsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Explore an example project' }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith('/api/projects/sample', { method: 'POST' });
    });
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/projects/sample-1');
    });
  });

  it('defaults the specification set from state and removes unrelated state specs', async () => {
    const user = userEvent.setup();
    authState.user = {
      id: 'u7',
      email: 'admin@example.com',
      role: 'admin',
      roleInCompany: 'admin',
      companyId: 'c1',
    };

    renderWithProviders(<ProjectsPage />);

    await user.click(await screen.findByRole('button', { name: 'New Project' }));
    const stateSelect = screen.getByLabelText('State *') as HTMLSelectElement;
    const specSelect = screen.getByLabelText('Specification Set') as HTMLSelectElement;

    await user.selectOptions(stateSelect, 'QLD');

    expect(specSelect.value).toBe('MRTS');
    const optionValues = Array.from(specSelect.options).map((option) => option.value);
    expect(optionValues).toContain('Austroads');
    expect(optionValues).toContain('MRTS');
    expect(optionValues).toContain('custom');
    expect(optionValues).not.toContain('TfNSW');
    expect(optionValues).not.toContain('VicRoads');
    expect(optionValues).not.toContain('DIT');
    expect(optionValues).not.toContain('MRWA');
  });

  it('keeps Austroads when the user intentionally selected it before changing state', async () => {
    const user = userEvent.setup();
    authState.user = {
      id: 'u8',
      email: 'admin@example.com',
      role: 'admin',
      roleInCompany: 'admin',
      companyId: 'c1',
    };

    renderWithProviders(<ProjectsPage />);

    await user.click(await screen.findByRole('button', { name: 'New Project' }));
    const stateSelect = screen.getByLabelText('State *') as HTMLSelectElement;
    const specSelect = screen.getByLabelText('Specification Set') as HTMLSelectElement;

    await user.selectOptions(stateSelect, 'NSW');
    expect(specSelect.value).toBe('TfNSW');

    await user.selectOptions(specSelect, 'Austroads');
    await user.selectOptions(stateSelect, 'WA');

    expect(specSelect.value).toBe('Austroads');
    const optionValues = Array.from(specSelect.options).map((option) => option.value);
    expect(optionValues).toContain('Austroads');
    expect(optionValues).toContain('MRWA');
    expect(optionValues).not.toContain('TfNSW');
  });

  it('redirects subcontractor portal users away instead of offering the company-setup CTA', async () => {
    authState.user = {
      id: 'u3',
      email: 'subbie@example.com',
      role: 'subcontractor',
      companyId: null,
      hasSubcontractorPortalAccess: true,
    };

    // Render inside a real route table so the component's <Navigate> redirect
    // actually resolves against the router. The /subcontractor-portal sentinel
    // only appears if ProjectsPage hits its `if (isSubcontractor) return
    // <Navigate>` branch.
    renderWithProviders(
      <Routes>
        <Route path="/projects" element={<ProjectsPage />} />
        <Route
          path="/subcontractor-portal"
          element={<div data-testid="portal-sentinel">Subcontractor portal</div>}
        />
      </Routes>,
      { initialEntries: ['/projects'] },
    );

    // Pin the REAL exclusion path: subcontractors land on the portal route via
    // the <Navigate> redirect. This fails if the redirect ever stops firing
    // (e.g. if it were gated behind the perpetual loading skeleton, or removed).
    // Asserting only the absence of the CTA would pass even if subbies were
    // wrongly offered it, because their projects query is disabled and isLoading
    // stays true forever on TanStack Query v4 -> the page would otherwise sit on
    // the skeleton and render no buttons regardless of the gating.
    expect(await screen.findByTestId('portal-sentinel')).toBeInTheDocument();

    // And they are never offered the head-contractor company-setup CTA or the
    // New Project button while being redirected.
    expect(screen.queryByRole('button', { name: 'Set up your company' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New Project' })).not.toBeInTheDocument();
  });
});
