import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DashboardMemberSetupNotice, DashboardSetupChecklist } from './DashboardSetupChecklist';

function renderChecklist(props: { projectCreated?: boolean; lotsAdded?: boolean } = {}) {
  return render(
    <MemoryRouter>
      <DashboardSetupChecklist
        projectCreated={props.projectCreated ?? false}
        lotsAdded={props.lotsAdded ?? false}
      />
    </MemoryRouter>,
  );
}

function getStep(title: string): HTMLAnchorElement {
  const link = screen.getByText(title).closest('a');
  expect(link).not.toBeNull();
  return link as HTMLAnchorElement;
}

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
