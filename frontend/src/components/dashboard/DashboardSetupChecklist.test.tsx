import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import {
  fireEvent,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from '@/test/renderWithProviders';
import { apiFetch } from '@/lib/api';
import { DashboardMemberSetupNotice, DashboardSetupChecklist } from './DashboardSetupChecklist';
import type { SetupCounts } from './setupChecklistState';

const navigateSpy = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateSpy };
});

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn() };
});

const ZERO_COUNTS: SetupCounts = {
  projects: 0,
  controlLines: 0,
  planSheets: 0,
  lots: 0,
  lotsWithItp: 0,
  teamMembers: 0,
};

function renderChecklist(
  props: { counts?: Partial<SetupCounts>; soleProjectId?: string | null } = {},
) {
  return renderWithProviders(
    <DashboardSetupChecklist
      counts={{ ...ZERO_COUNTS, ...props.counts }}
      soleProjectId={props.soleProjectId ?? null}
    />,
  );
}

function getStep(title: string): HTMLAnchorElement {
  const link = screen.getByText(title).closest('a');
  expect(link).not.toBeNull();
  return link as HTMLAnchorElement;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('DashboardSetupChecklist', () => {
  it('renders the ordered setup steps with generic targets when there is no sole project', () => {
    renderChecklist();

    expect(screen.getByText('Getting started')).toBeInTheDocument();
    expect(getStep('Create your first project')).toHaveAttribute('href', '/projects');
    expect(getStep('Add a control line')).toHaveAttribute('href', '/projects');
    expect(getStep('Add plan sheets')).toHaveAttribute('href', '/projects');
    expect(getStep('Add lots')).toHaveAttribute('href', '/projects');
    expect(getStep('Assign an ITP')).toHaveAttribute('href', '/projects');
    expect(getStep('Add your team to the project')).toHaveAttribute('href', '/company-settings');
  });

  it('deep-links spatial and team steps into the sole project when there is exactly one', () => {
    renderChecklist({ counts: { projects: 1 }, soleProjectId: 'p1' });

    expect(getStep('Add a control line')).toHaveAttribute('href', '/projects/p1/control-lines');
    expect(getStep('Add plan sheets')).toHaveAttribute('href', '/projects/p1/plan-sheets');
    expect(getStep('Add lots')).toHaveAttribute('href', '/projects/p1/lots');
    expect(getStep('Assign an ITP')).toHaveAttribute('href', '/projects/p1/itp');
    // Team links to the project users page (where membership is granted, which is what ticks it).
    expect(getStep('Add your team to the project')).toHaveAttribute('href', '/projects/p1/users');
    // Project step keeps its fixed route.
    expect(getStep('Create your first project')).toHaveAttribute('href', '/projects');
  });

  it('leaves every step unticked for a brand-new company', () => {
    renderChecklist();

    expect(screen.queryByText('(done)')).not.toBeInTheDocument();
    // Unfinished steps show their position number instead of a tick.
    expect(within(getStep('Create your first project')).getByText('1')).toBeInTheDocument();
    expect(within(getStep('Add a control line')).getByText('2')).toBeInTheDocument();
  });

  it('marks each step done from its own count', () => {
    renderChecklist({
      counts: {
        projects: 1,
        controlLines: 1,
        planSheets: 1,
        lots: 3,
        lotsWithItp: 0,
        teamMembers: 1,
      },
    });

    expect(within(getStep('Create your first project')).getByText('(done)')).toBeInTheDocument();
    expect(within(getStep('Add a control line')).getByText('(done)')).toBeInTheDocument();
    expect(within(getStep('Add plan sheets')).getByText('(done)')).toBeInTheDocument();
    expect(within(getStep('Add lots')).getByText('(done)')).toBeInTheDocument();
    expect(within(getStep('Add your team to the project')).getByText('(done)')).toBeInTheDocument();
    // The numbered marker is replaced by the tick for completed steps.
    expect(within(getStep('Create your first project')).queryByText('1')).not.toBeInTheDocument();
    // ITP has no attached instance yet, so it stays unticked.
    expect(within(getStep('Assign an ITP')).queryByText('(done)')).not.toBeInTheDocument();
  });
});

describe('DashboardSetupChecklist example project action', () => {
  it('seeds the example project and navigates into it', async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      project: { id: 'sample-1', name: 'Example Project — Riverside Estate Stage 1' },
      alreadyExisted: false,
    });

    renderChecklist();

    fireEvent.click(screen.getByRole('button', { name: /explore an example project/i }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/api/projects/sample', { method: 'POST' });
    });
    await waitFor(() => {
      expect(navigateSpy).toHaveBeenCalledWith('/projects/sample-1');
    });
  });

  it('disables the action while the example project is being seeded', async () => {
    let resolveRequest: (value: unknown) => void = () => {};
    vi.mocked(apiFetch).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );

    renderChecklist();

    fireEvent.click(screen.getByRole('button', { name: /explore an example project/i }));

    const pendingButton = await screen.findByRole('button', {
      name: /setting up example project/i,
    });
    expect(pendingButton).toBeDisabled();

    resolveRequest({ project: { id: 'sample-1' }, alreadyExisted: true });
    await waitFor(() => {
      expect(navigateSpy).toHaveBeenCalledWith('/projects/sample-1');
    });
  });

  it('surfaces an error and stays usable when seeding fails', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error('Sample seeding failed'));

    renderChecklist();

    fireEvent.click(screen.getByRole('button', { name: /explore an example project/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Sample seeding failed');
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /explore an example project/i })).not.toBeDisabled();
  });
});

describe('DashboardMemberSetupNotice', () => {
  it('tells members without create permission their team will add them', () => {
    render(<DashboardMemberSetupNotice />);

    expect(screen.getByText('No projects yet')).toBeInTheDocument();
    expect(
      screen.getByText(/Your projects will appear here once your team adds you/),
    ).toBeInTheDocument();
    // No create CTA for roles whose POST /api/projects the API would reject.
    expect(screen.queryByText('Create your first project')).not.toBeInTheDocument();
  });
});
