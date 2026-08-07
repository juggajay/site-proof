import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MapLegend } from './MapLegend';

const counts = (entries: [string, number][]) => new Map(entries);

describe('MapLegend', () => {
  it('renders nothing with no lots on the map', () => {
    render(<MapLegend statusCounts={counts([])} testing={false} testingCounts={counts([])} />);
    expect(screen.queryByTestId('map-legend')).not.toBeInTheDocument();
  });

  it('starts compact (dots + counts), expands to labels, collapses again', () => {
    render(
      <MapLegend
        statusCounts={counts([
          ['in_progress', 3],
          ['conformed', 2],
        ])}
        testing={false}
        testingCounts={counts([])}
      />,
    );

    const legend = screen.getByTestId('map-legend');
    // Compact: counts only, no status words.
    expect(within(legend).getByText('3')).toBeInTheDocument();
    expect(within(legend).queryByText('In Progress')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('map-legend-expand'));
    expect(within(legend).getByText('In Progress')).toBeInTheDocument();
    expect(within(legend).getByText('Conformed')).toBeInTheDocument();
    // Zero-count statuses stay omitted even expanded.
    expect(within(legend).queryByText('Claimed')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('map-legend-collapse'));
    expect(within(legend).queryByText('In Progress')).not.toBeInTheDocument();
  });

  it('switches to the testing palette when the overlay is armed', () => {
    render(
      <MapLegend
        statusCounts={counts([['in_progress', 3]])}
        testing
        testingCounts={counts([['satisfied', 4]])}
      />,
    );
    const legend = screen.getByTestId('testing-legend');
    fireEvent.click(screen.getByTestId('map-legend-expand'));
    expect(within(legend).getByText('Testing')).toBeInTheDocument();
    expect(within(legend).getByText('4')).toBeInTheDocument();
  });
});
