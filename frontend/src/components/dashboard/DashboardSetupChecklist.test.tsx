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

const navigateSpy = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateSpy };
});

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn() };
});

function renderChecklist(props: { projectCreated?: boolean; lotsAdded?: boolean } = {}) {
  return renderWithProviders(
    <DashboardSetupChecklist
      projectCreated={props.projectCreated ?? false}
      lotsAdded={props.lotsAdded ?? false}
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
  it('renders the four setup steps with their navigation targets', () => {
    renderChecklist();

    expect(screen.getByText('Getting started')).toBeInTheDocument();
    expect(getStep('Create your first project')).toHaveAttribute('href', '/projects');
    expect(getStep('Add lots')).toHaveAttribute('href', '/projects');
    expect(getStep('Assign an ITP template')).toHaveAttribute('href', '/projects');
    expect(getStep('Invite your team')).toHaveAttribute('href', '/company-settings');
  });

  it('leaves every step unticked for a brand-new company', () => {
    renderChecklist();

    expect(screen.queryByText('(done)')).not.toBeInTheDocument();
    // Unfinished steps show their position number instead of a tick.
    expect(within(getStep('Create your first project')).getByText('1')).toBeInTheDocument();
    expect(within(getStep('Add lots')).getByText('2')).toBeInTheDocument();
  });

  it('marks the project and lot steps done as their counts become non-zero', () => {
    renderChecklist({ projectCreated: true, lotsAdded: true });

    expect(within(getStep('Create your first project')).getByText('(done)')).toBeInTheDocument();
    expect(within(getStep('Add lots')).getByText('(done)')).toBeInTheDocument();
    // The numbered marker is replaced by the tick for completed steps.
    expect(within(getStep('Create your first project')).queryByText('1')).not.toBeInTheDocument();
    // Steps without cheap counts on the dashboard stay as static links.
    expect(within(getStep('Assign an ITP template')).queryByText('(done)')).not.toBeInTheDocument();
    expect(within(getStep('Invite your team')).queryByText('(done)')).not.toBeInTheDocument();
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
