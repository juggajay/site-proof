import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { DashboardQuickLinks } from './DashboardQuickLinks';

describe('DashboardQuickLinks', () => {
  it('renders the existing quick links and quick action routes', () => {
    render(
      <MemoryRouter>
        <DashboardQuickLinks reportsQuickLink="/projects/project-1/reports" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /projects/i })).toHaveAttribute('href', '/projects');
    expect(screen.getByRole('link', { name: /portfolio/i })).toHaveAttribute('href', '/portfolio');
    expect(screen.getByRole('link', { name: /reports/i })).toHaveAttribute(
      'href',
      '/projects/project-1/reports',
    );
    expect(screen.getByRole('link', { name: /settings/i })).toHaveAttribute('href', '/settings');
    expect(screen.getByRole('link', { name: /quick photo/i })).toHaveAttribute(
      'href',
      '/projects?action=photo',
    );
    expect(screen.getByRole('link', { name: /create lot/i })).toHaveAttribute(
      'href',
      '/projects?action=create-lot',
    );
    expect(screen.getByRole('link', { name: /add test/i })).toHaveAttribute(
      'href',
      '/projects?action=add-test',
    );
  });
});
