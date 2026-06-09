import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CompanyUsageSection } from './CompanyUsageSection';
import type { Company } from '../companySettingsData';

afterEach(() => {
  cleanup();
});

const baseCompany: Company = {
  id: 'company-1',
  name: 'Ryox Carpentry',
  abn: null,
  address: null,
  logoUrl: null,
  subscriptionTier: 'professional',
  projectCount: 2,
  projectLimit: 10,
  userCount: 5,
  userLimit: 25,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

// With the other side's limit set to null (Unlimited), exactly one progress
// bar renders, so this selects unambiguously.
function getOnlyProgressBar(container: HTMLElement): HTMLElement {
  const bars = container.querySelectorAll<HTMLElement>('.h-full.rounded-full');
  expect(bars).toHaveLength(1);
  return bars[0];
}

describe('CompanyUsageSection', () => {
  it('shows the capitalized subscription tier in a disabled input', () => {
    render(<CompanyUsageSection company={baseCompany} />);

    const tierInput = screen.getByLabelText('Subscription Tier');
    expect(tierInput).toHaveValue('Professional');
    expect(tierInput).toBeDisabled();
    expect(screen.getByText('Contact support to upgrade')).toBeInTheDocument();
  });

  it('shows finite project and user usage counts', () => {
    render(<CompanyUsageSection company={baseCompany} />);

    expect(screen.getByText('2 of 10 projects used')).toBeInTheDocument();
    expect(screen.getByText('5 of 25 users in company')).toBeInTheDocument();
  });

  it('falls back to Basic tier, zero counts, and default limits when company is null', () => {
    const { container } = render(<CompanyUsageSection company={null} />);

    expect(screen.getByLabelText('Subscription Tier')).toHaveValue('Basic');
    expect(screen.getByText('0 of 3 projects used')).toBeInTheDocument();
    expect(screen.getByText('0 of 5 users in company')).toBeInTheDocument();
    expect(container.querySelectorAll('.h-full.rounded-full')).toHaveLength(0);
  });

  it('shows Unlimited with no progress bar or warning when limits are null', () => {
    const { container } = render(
      <CompanyUsageSection
        company={{ ...baseCompany, projectLimit: null, userLimit: null, projectCount: 50 }}
      />,
    );

    expect(screen.getByText('50 of Unlimited projects used')).toBeInTheDocument();
    expect(screen.getByText('5 of Unlimited users in company')).toBeInTheDocument();
    expect(container.querySelectorAll('.h-full.rounded-full')).toHaveLength(0);
    expect(screen.queryByText(/reached your project limit/)).not.toBeInTheDocument();
  });

  it('colors the project bar success below 80%, warning at 80%, and destructive at the limit', () => {
    const noUserBar = { ...baseCompany, userLimit: null };

    const green = render(
      <CompanyUsageSection company={{ ...noUserBar, projectCount: 2, projectLimit: 10 }} />,
    );
    let bar = getOnlyProgressBar(green.container);
    expect(bar).toHaveClass('bg-success');
    expect(bar).toHaveStyle({ width: '20%' });
    green.unmount();

    const amber = render(
      <CompanyUsageSection company={{ ...noUserBar, projectCount: 8, projectLimit: 10 }} />,
    );
    bar = getOnlyProgressBar(amber.container);
    expect(bar).toHaveClass('bg-warning');
    amber.unmount();

    const red = render(
      <CompanyUsageSection company={{ ...noUserBar, projectCount: 10, projectLimit: 10 }} />,
    );
    bar = getOnlyProgressBar(red.container);
    expect(bar).toHaveClass('bg-destructive');
    expect(
      screen.getByText(
        "You've reached your project limit. Upgrade your plan to create more projects.",
      ),
    ).toBeInTheDocument();
  });

  it('clamps the project bar width at 100% when count exceeds the limit', () => {
    const { container } = render(
      <CompanyUsageSection
        company={{ ...baseCompany, projectCount: 15, projectLimit: 10, userLimit: null }}
      />,
    );

    expect(getOnlyProgressBar(container)).toHaveStyle({ width: '100%' });
  });

  it('shows the user limit warning at the user limit', () => {
    render(
      <CompanyUsageSection
        company={{ ...baseCompany, projectLimit: null, userCount: 25, userLimit: 25 }}
      />,
    );

    expect(
      screen.getByText(
        "You've reached your user limit. Upgrade your plan to add more team members.",
      ),
    ).toBeInTheDocument();
  });
});
