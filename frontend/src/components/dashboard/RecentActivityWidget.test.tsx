import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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

  it('links safe internal activity targets and ignores unsafe links', () => {
    render(
      <MemoryRouter>
        <RecentActivityWidget
          activities={[
            {
              id: 'activity-1',
              type: 'lot_created',
              description: 'Lot EW-001 was created',
              timestamp: '2026-06-05T10:00:00.000Z',
              link: '/projects/project-1/lots/lot-1',
            },
            {
              id: 'activity-2',
              type: 'ncr_created',
              description: 'NCR was raised',
              timestamp: '2026-06-05T10:00:00.000Z',
              link: 'https://example.com/phishing',
            },
          ]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Lot EW-001 was created' })).toHaveAttribute(
      'href',
      '/projects/project-1/lots/lot-1',
    );
    expect(screen.getByText('NCR was raised')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'NCR was raised' })).not.toBeInTheDocument();
  });
});
