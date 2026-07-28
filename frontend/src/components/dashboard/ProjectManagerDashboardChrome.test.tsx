import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import {
  ProjectManagerProjectContext,
  ProjectManagerQuickActions,
} from './ProjectManagerDashboardChrome';

describe('ProjectManagerDashboardChrome', () => {
  it('renders active project context with project number and status', () => {
    render(
      <ProjectManagerProjectContext
        project={{
          id: 'project-1',
          name: 'Northern Bypass',
          projectNumber: 'NB-001',
          status: 'active',
        }}
      />,
    );

    expect(screen.getByText('Northern Bypass')).toBeInTheDocument();
    expect(screen.getByText(/\(NB-001\)/)).toBeInTheDocument();
    expect(screen.getByText('active')).toHaveClass('bg-success/10');
  });

  it('links quick actions to the current project modules', () => {
    render(
      <MemoryRouter>
        <ProjectManagerQuickActions projectId="project 1/2" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /manage lots/i })).toHaveAttribute(
      'href',
      '/projects/project%201%2F2/lots',
    );
    expect(screen.getByRole('link', { name: /progress claims/i })).toHaveAttribute(
      'href',
      '/projects/project%201%2F2/claims',
    );
    expect(screen.getByRole('link', { name: /reports/i })).toHaveAttribute(
      'href',
      '/projects/project%201%2F2/reports',
    );
    expect(screen.getByRole('link', { name: /docket approvals/i })).toHaveAttribute(
      'href',
      '/projects/project%201%2F2/dockets',
    );
  });

  // M8 (review 2026-07-28) — DashboardPage returns early for project_manager, so
  // the ONLY link to /dashboard/needs-attention (the widget header on the default
  // dashboard) was unreachable for the role the screen was built for.
  it('reaches Needs Attention regardless of the selected project', () => {
    render(
      <MemoryRouter>
        <ProjectManagerQuickActions projectId={undefined} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /needs attention/i })).toHaveAttribute(
      'href',
      '/dashboard/needs-attention',
    );
  });

  it('falls project-scoped quick actions back to the project list when no project is selected', () => {
    render(
      <MemoryRouter>
        <ProjectManagerQuickActions projectId={undefined} />
      </MemoryRouter>,
    );

    const projectScoped = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href') !== '/dashboard/needs-attention');
    expect(projectScoped.length).toBeGreaterThan(0);
    for (const link of projectScoped) {
      expect(link).toHaveAttribute('href', '/projects');
    }
  });
});
