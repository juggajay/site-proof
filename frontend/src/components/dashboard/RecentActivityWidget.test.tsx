import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RecentActivityWidget } from './RecentActivityWidget';

afterEach(() => {
  cleanup();
});

describe('RecentActivityWidget', () => {
  it('renders an empty state when no activities are available', () => {
    render(<RecentActivityWidget activities={[]} />);

    expect(screen.getByRole('heading', { name: 'Recent Activity' })).toBeInTheDocument();
    expect(screen.getByText('No recent activity')).toBeInTheDocument();
  });

  it('renders activity descriptions and invalid timestamp fallbacks', () => {
    render(
      <RecentActivityWidget
        activities={[
          {
            id: 'activity-1',
            type: 'lot_created',
            description: 'Lot EW-001 was created',
            timestamp: 'not-a-date',
          },
        ]}
      />,
    );

    expect(screen.getByText('Lot EW-001 was created')).toBeInTheDocument();
    expect(screen.getByText('Unknown time')).toBeInTheDocument();
  });
});
