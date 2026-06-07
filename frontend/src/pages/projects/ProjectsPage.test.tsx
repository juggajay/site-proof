import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/renderWithProviders';

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
    expect(screen.queryByRole('button', { name: 'Set up your company' })).not.toBeInTheDocument();
  });

  it('does not show the company-setup CTA to subcontractor portal users', async () => {
    authState.user = {
      id: 'u3',
      email: 'subbie@example.com',
      role: 'subcontractor',
      companyId: null,
      hasSubcontractorPortalAccess: true,
    };

    renderWithProviders(<ProjectsPage />);

    // Subcontractors are redirected to their portal and must not be offered the
    // head-contractor company-setup CTA.
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Set up your company' })).not.toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'New Project' })).not.toBeInTheDocument();
  });
});
