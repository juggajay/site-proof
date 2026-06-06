import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { StatusBadge } from './myCompanyDisplay';
import { formatCompanyRate } from './myCompanyDisplayHelpers';

afterEach(() => {
  cleanup();
});

describe('myCompanyDisplay', () => {
  it('formats subcontractor rates as Australian currency', () => {
    expect(formatCompanyRate(0)).toBe('$0');
    expect(formatCompanyRate(125.49)).toBe('$125.49');
    expect(formatCompanyRate(125.5)).toBe('$125.5');
  });

  it('renders known status labels', () => {
    const { rerender } = render(<StatusBadge status="pending" />);
    expect(screen.getByText('Pending Approval')).toBeInTheDocument();

    rerender(<StatusBadge status="approved" />);
    expect(screen.getByText('Approved')).toBeInTheDocument();

    rerender(<StatusBadge status="active" />);
    expect(screen.getByText('Approved')).toBeInTheDocument();

    rerender(<StatusBadge status="inactive" />);
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('renders unknown statuses verbatim', () => {
    render(<StatusBadge status="needs_review" />);

    expect(screen.getByText('needs_review')).toBeInTheDocument();
  });
});
