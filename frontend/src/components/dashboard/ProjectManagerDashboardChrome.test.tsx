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

  it('falls quick actions back to the project list when no project is selected', () => {
    render(
      <MemoryRouter>
        <ProjectManagerQuickActions projectId={undefined} />
      </MemoryRouter>,
    );

    for (const link of screen.getAllByRole('link')) {
      expect(link).toHaveAttribute('href', '/projects');
    }
  });
});
