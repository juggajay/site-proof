import { fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/renderWithProviders';
import {
  PortfolioCashFlowSection,
  PortfolioDataErrorAlert,
  PortfolioMetricsSection,
  PortfolioProjectsList,
  PortfolioRiskSections,
} from './PortfolioSections';
import type {
  CashFlowSummary,
  CriticalNCR,
  PortfolioStats,
  Project,
  ProjectAtRisk,
} from '../portfolioPageData';

const projects: Project[] = [
  {
    id: 'project-1',
    name: 'Eastern Bypass',
    projectNumber: 'EB-001',
    status: 'active',
    contractValue: 1200000,
    targetCompletion: '2026-07-15T00:00:00.000Z',
  },
  {
    id: 'project-2',
    name: 'Western Drainage',
    projectNumber: 'WD-002',
    status: 'completed',
    contractValue: 850000,
  },
];

const stats: PortfolioStats = {
  totalProjects: 2,
  activeProjects: 1,
  completedProjects: 1,
  archivedProjects: 0,
  totalContractValue: 2050000,
  projectsOnTrack: 1,
  projectsAtRisk: 0,
};

const cashFlow: CashFlowSummary = {
  totalClaimed: 250000,
  totalCertified: 200000,
  totalPaid: 150000,
  outstanding: 50000,
};

const criticalNcr: CriticalNCR = {
  id: 'ncr-1',
  ncrNumber: 'NCR-001',
  description: 'Failed compaction test',
  category: 'Quality',
  status: 'open',
  dueDate: '2026-06-20T00:00:00.000Z',
  isOverdue: true,
  daysUntilDue: -2,
  project: {
    id: 'project-1',
    name: 'Eastern Bypass',
    projectNumber: 'EB-001',
  },
  link: 'https://external.example.com/not-allowed',
};

const projectAtRisk: ProjectAtRisk = {
  id: 'project-2',
  name: 'Western Drainage',
  projectNumber: 'WD-002',
  riskLevel: 'critical',
  link: '/projects/project-2',
  riskIndicators: [
    {
      type: 'timeline',
      severity: 'critical',
      message: 'Due soon',
      explanation: 'Target completion is inside the risk window.',
    },
  ],
};

describe('PortfolioDataErrorAlert', () => {
  it('renders error details and retries portfolio queries', () => {
    const onRetry = vi.fn();
    renderWithProviders(
      <PortfolioDataErrorAlert
        dataErrors={[
          {
            label: 'Projects',
            error: new Error('Request failed'),
            fallback: 'Failed to load projects',
          },
        ]}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Projects: Request failed');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('PortfolioMetricsSection', () => {
  it('renders aggregate project metrics and timeline health', () => {
    renderWithProviders(
      <PortfolioMetricsSection hasProjectsData stats={stats} projects={projects} />,
    );

    expect(screen.getByText('Total Projects')).toBeInTheDocument();
    expect(screen.getByText('$2,050,000')).toBeInTheDocument();
    expect(screen.getByText('Timeline Health')).toBeInTheDocument();
    expect(screen.getByText('On Track')).toBeInTheDocument();
  });

  it('renders the project-data fallback when project loading failed', () => {
    renderWithProviders(
      <PortfolioMetricsSection hasProjectsData={false} stats={stats} projects={[]} />,
    );

    expect(
      screen.getByText(
        'Project portfolio metrics are unavailable until project data loads successfully.',
      ),
    ).toBeInTheDocument();
  });
});

describe('PortfolioCashFlowSection', () => {
  it('renders cash flow totals with Australian currency formatting', () => {
    renderWithProviders(
      <PortfolioCashFlowSection hasCashFlowData hasCashFlowError={false} cashFlow={cashFlow} />,
    );

    expect(screen.getByText('Cash Flow Summary')).toBeInTheDocument();
    expect(screen.getByText('$250,000')).toBeInTheDocument();
    expect(screen.getByText('$50,000')).toBeInTheDocument();
  });

  it('renders a fallback only when the cash-flow query errored', () => {
    const { rerender } = renderWithProviders(
      <PortfolioCashFlowSection
        hasCashFlowData={false}
        hasCashFlowError={false}
        cashFlow={cashFlow}
      />,
    );

    expect(screen.queryByText('Cash Flow Summary')).not.toBeInTheDocument();

    rerender(
      <PortfolioCashFlowSection hasCashFlowData={false} hasCashFlowError cashFlow={cashFlow} />,
    );

    expect(
      screen.getByText(
        'Cash flow metrics are unavailable until cash flow data loads successfully.',
      ),
    ).toBeInTheDocument();
  });
});

describe('PortfolioRiskSections', () => {
  it('renders critical NCRs and falls back from unsafe NCR links', () => {
    renderWithProviders(<PortfolioRiskSections criticalNCRs={[criticalNcr]} projectsAtRisk={[]} />);

    expect(screen.getByText('Critical NCRs Across Projects')).toBeInTheDocument();
    expect(screen.getByText('OVERDUE')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open NCR-001 for Eastern Bypass' })).toHaveAttribute(
      'href',
      '/projects/project-1/ncr',
    );
  });

  it('renders project risk indicators with safe internal links', () => {
    renderWithProviders(
      <PortfolioRiskSections criticalNCRs={[]} projectsAtRisk={[projectAtRisk]} />,
    );

    expect(screen.getByText('Projects at Risk')).toBeInTheDocument();
    expect(screen.getByText('Due soon')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Open risk summary for Western Drainage' }),
    ).toHaveAttribute('href', '/projects/project-2');
  });
});

describe('PortfolioProjectsList', () => {
  it('renders the company project list with project links', () => {
    renderWithProviders(<PortfolioProjectsList hasProjectsData projects={projects} />);

    expect(screen.getByText('All Company Projects')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Eastern Bypass/ })).toHaveAttribute(
      'href',
      '/projects/project-1',
    );
  });

  it('renders an empty state when project data is loaded but empty', () => {
    renderWithProviders(<PortfolioProjectsList hasProjectsData projects={[]} />);

    expect(
      screen.getByText('No projects found. Create your first project to get started.'),
    ).toBeInTheDocument();
  });
});
