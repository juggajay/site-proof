import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { CostSummary } from '../costsPageHelpers';
import { CostSummaryCards, DocketStatusSummary } from './CostSummaryCards';

afterEach(() => {
  cleanup();
});

const summary: CostSummary = {
  totalLabourCost: 20000,
  totalPlantCost: 10000,
  totalCost: 30000,
  budgetTotal: 35000,
  budgetVariance: 5000,
  approvedDockets: 7,
  pendingDockets: 2,
};

describe('CostSummaryCards', () => {
  it('renders the desktop cost cards and percentage breakdowns', () => {
    renderWithProviders(<CostSummaryCards summary={summary} isMobile={false} />);

    expect(screen.getByText('Total Cost')).toBeInTheDocument();
    expect(screen.getByText('$30,000.00')).toBeInTheDocument();
    expect(screen.getByText('Labour Cost')).toBeInTheDocument();
    expect(screen.getByText('$20,000.00')).toBeInTheDocument();
    expect(screen.getByText('67% of total')).toBeInTheDocument();
    expect(screen.getByText('Plant Cost')).toBeInTheDocument();
    expect(screen.getByText('$10,000.00')).toBeInTheDocument();
    expect(screen.getByText('33% of total')).toBeInTheDocument();
  });

  it('folds labour, plant, and docket counts into mobile summary cards', () => {
    renderWithProviders(<CostSummaryCards summary={summary} isMobile />);

    expect(screen.queryByText('Labour Cost')).not.toBeInTheDocument();
    expect(screen.queryByText('Plant Cost')).not.toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders over-budget wording for negative budget variance', () => {
    renderWithProviders(
      <CostSummaryCards summary={{ ...summary, budgetVariance: -2500 }} isMobile={false} />,
    );

    expect(screen.getByText(/Over budget by/i)).toHaveTextContent('Over budget by $2,500.00');
  });
});

describe('DocketStatusSummary', () => {
  it('renders approved and pending docket counts for desktop', () => {
    renderWithProviders(<DocketStatusSummary summary={summary} />);

    expect(screen.getByText('Docket Status')).toBeInTheDocument();
    expect(screen.getByText('Approved Dockets')).toBeInTheDocument();
    expect(screen.getByText('Pending Approval')).toBeInTheDocument();
  });
});
