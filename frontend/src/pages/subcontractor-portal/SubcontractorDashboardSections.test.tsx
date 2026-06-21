import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PortalQuickLinks } from './SubcontractorDashboardSections';
import type { Company } from './SubcontractorDashboard';

const company: Company = {
  id: 'company-1',
  companyName: 'Subbie Civil',
  projectId: 'project-1',
  projectName: 'Demo Project',
  employees: [],
  plant: [],
  portalAccess: {
    lots: true,
    itps: true,
    holdPoints: true,
    testResults: true,
    ncrs: false,
    documents: true,
  },
};

function renderQuickLinks(currentCompany: Company | undefined = company) {
  return render(
    <MemoryRouter>
      <PortalQuickLinks
        company={currentCompany}
        currentProjectQuery="?projectId=project-1"
        myCompanyLink="/my-company?projectId=project-1"
      />
    </MemoryRouter>,
  );
}

describe('PortalQuickLinks', () => {
  it('always renders company and docket navigation', () => {
    renderQuickLinks(undefined);

    expect(screen.getByRole('link', { name: /My Company/i })).toHaveAttribute(
      'href',
      '/my-company?projectId=project-1',
    );
    expect(screen.getByRole('link', { name: /All Dockets/i })).toHaveAttribute(
      'href',
      '/subcontractor-portal/dockets',
    );
  });

  it('shows only portal-module links enabled for the subcontractor', () => {
    renderQuickLinks();

    expect(screen.getByRole('link', { name: /ITPs/i })).toHaveAttribute(
      'href',
      '/subcontractor-portal/itps',
    );
    expect(screen.getByRole('link', { name: /Hold Points/i })).toHaveAttribute(
      'href',
      '/subcontractor-portal/holdpoints',
    );
    expect(screen.getByRole('link', { name: /Test Results/i })).toHaveAttribute(
      'href',
      '/subcontractor-portal/tests',
    );
    expect(screen.getByRole('link', { name: /Documents/i })).toHaveAttribute(
      'href',
      '/subcontractor-portal/documents?projectId=project-1',
    );
    expect(screen.queryByRole('link', { name: /NCRs/i })).not.toBeInTheDocument();
  });
});
