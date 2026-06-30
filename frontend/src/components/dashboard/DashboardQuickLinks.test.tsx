import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { DashboardQuickLinks } from './DashboardQuickLinks';

describe('DashboardQuickLinks', () => {
  it('renders project-scoped quick links and quick action routes', () => {
    render(
      <MemoryRouter>
        <DashboardQuickLinks
          reportsQuickLink="/projects/project-1/reports"
          quickActionProjectId="project-1"
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /projects/i })).toHaveAttribute('href', '/projects');
    expect(screen.getByRole('link', { name: /portfolio/i })).toHaveAttribute('href', '/portfolio');
    expect(screen.getByRole('link', { name: /reports/i })).toHaveAttribute(
      'href',
      '/projects/project-1/reports',
    );
    expect(screen.getByRole('link', { name: /settings/i })).toHaveAttribute('href', '/settings');
    expect(screen.getByRole('link', { name: /create lot/i })).toHaveAttribute(
      'href',
      '/projects/project-1/lots',
    );
    expect(screen.getByRole('link', { name: /add test/i })).toHaveAttribute(
      'href',
      '/projects/project-1/tests',
    );
    expect(screen.queryByRole('link', { name: /quick photo/i })).not.toBeInTheDocument();
  });

  it('omits quick actions until a project-scoped route is available', () => {
    render(
      <MemoryRouter>
        <DashboardQuickLinks reportsQuickLink="/projects" />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('heading', { name: /quick actions/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /create lot/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /add test/i })).not.toBeInTheDocument();
  });
});
