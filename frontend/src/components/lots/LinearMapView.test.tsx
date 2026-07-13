import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { LOT_STATUS_OVERVIEW_ITEMS } from '@/lib/lotStatusOverview';

import { LinearMapView } from './LinearMapView';
import type { LinearMapLot } from './linearMapViewHelpers';

const lot = (overrides: Partial<LinearMapLot>): LinearMapLot => ({
  id: 'lot-1',
  lotNumber: 'LOT-001',
  description: null,
  status: 'in_progress',
  activityType: 'Earthworks',
  chainageStart: 0,
  chainageEnd: 100,
  layer: null,
  areaZone: null,
  ...overrides,
});

describe('LinearMapView', () => {
  it('shows every canonical lot status in the legend', () => {
    render(<LinearMapView lots={[lot({})]} onLotClick={vi.fn()} />);

    LOT_STATUS_OVERVIEW_ITEMS.forEach((item) => {
      expect(screen.getByText(item.label)).toBeInTheDocument();
    });
  });

  it('stacks overlapping lots in the same row into separate lanes', () => {
    render(
      <LinearMapView
        lots={[
          lot({ id: 'subgrade', lotNumber: 'SUB-01', chainageStart: 0, chainageEnd: 200 }),
          lot({ id: 'basecourse', lotNumber: 'BASE-01', chainageStart: 50, chainageEnd: 150 }),
        ]}
        onLotClick={vi.fn()}
      />,
    );

    const first = screen.getByTestId('lot-block-subgrade');
    const second = screen.getByTestId('lot-block-basecourse');
    expect(first.style.top).not.toBe(second.style.top);
  });

  it('reports lots that are missing chainage instead of hiding them silently', () => {
    render(
      <LinearMapView
        lots={[lot({}), lot({ id: 'no-ch', chainageStart: null, chainageEnd: null })]}
        onLotClick={vi.fn()}
      />,
    );

    expect(screen.getByTestId('linear-map-unmapped-count')).toHaveTextContent(
      '1 lot without chainage not shown',
    );
  });
});
