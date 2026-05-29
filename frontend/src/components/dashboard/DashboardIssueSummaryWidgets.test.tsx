import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HoldPointsSummaryWidget, NcrSummaryWidget } from './DashboardIssueSummaryWidgets';

afterEach(() => {
  cleanup();
});

describe('DashboardIssueSummaryWidgets', () => {
  it('renders hold point counts and reports navigation', () => {
    const onNavigate = vi.fn();

    render(
      <MemoryRouter>
        <HoldPointsSummaryWidget openHoldPoints={4} onNavigate={onNavigate} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Hold Points' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open Hold Points\s+4/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View all hold points →' })).toHaveAttribute(
      'href',
      '/projects?view=holdpoints',
    );

    fireEvent.click(screen.getByRole('button', { name: /Open Hold Points\s+4/i }));

    expect(onNavigate).toHaveBeenCalledWith('/projects?view=holdpoints');
  });

  it('renders NCR counts and reports navigation', () => {
    const onNavigate = vi.fn();

    render(
      <MemoryRouter>
        <NcrSummaryWidget openNCRs={2} onNavigate={onNavigate} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Non-Conformance Reports' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open NCRs\s+2/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View all NCRs →' })).toHaveAttribute(
      'href',
      '/projects?view=ncrs',
    );

    fireEvent.click(screen.getByRole('button', { name: /Open NCRs\s+2/i }));

    expect(onNavigate).toHaveBeenCalledWith('/projects?view=ncrs');
  });
});
