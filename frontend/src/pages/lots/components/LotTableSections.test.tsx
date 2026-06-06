import type { RefObject } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  LotExpandedDetailsRow,
  LotTableEmptyState,
  LotTableLoadMoreIndicator,
} from './LotTableSections';
import type { Lot } from '../lotsPageTypes';

const lot: Lot = {
  id: 'lot-1',
  lotNumber: 'EW-001',
  description: 'Earthworks lot',
  status: 'in_progress',
  activityType: 'earthworks',
  chainageStart: 0,
  chainageEnd: 100,
  offset: null,
  layer: null,
  areaZone: 'Zone A',
  createdAt: '2026-05-21T00:00:00.000Z',
  updatedAt: '2026-05-22T00:00:00.000Z',
  itpCount: 2,
  testCount: 3,
  documentCount: 4,
  ncrCount: 1,
  holdPointCount: 5,
  notes: 'Requires access check',
};

describe('LotTableSections', () => {
  it('renders the owner empty state and delegates first-lot creation', async () => {
    const onOpenCreateModal = vi.fn();
    const user = userEvent.setup();

    render(
      <table>
        <tbody>
          <LotTableEmptyState
            allLotsCount={0}
            colSpanCount={9}
            canCreate
            isSubcontractor={false}
            onOpenCreateModal={onOpenCreateModal}
          />
        </tbody>
      </table>,
    );

    expect(screen.getByRole('heading', { name: 'No lots yet' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create your first lot' }));
    expect(onOpenCreateModal).toHaveBeenCalledTimes(1);
  });

  it('renders the subcontractor empty state without create actions', () => {
    render(
      <table>
        <tbody>
          <LotTableEmptyState
            allLotsCount={0}
            colSpanCount={7}
            canCreate
            isSubcontractor
            onOpenCreateModal={vi.fn()}
          />
        </tbody>
      </table>,
    );

    expect(screen.getByRole('heading', { name: 'No lots assigned yet' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create your first lot' })).not.toBeInTheDocument();
  });

  it('renders the filtered empty state when lots exist outside the current filters', () => {
    render(
      <table>
        <tbody>
          <LotTableEmptyState
            allLotsCount={3}
            colSpanCount={9}
            canCreate={false}
            isSubcontractor={false}
            onOpenCreateModal={vi.fn()}
          />
        </tbody>
      </table>,
    );

    expect(screen.getByText('No lots match the current filters.')).toBeInTheDocument();
  });

  it('renders expanded lot details and quality counts', () => {
    render(
      <table>
        <tbody>
          <LotExpandedDetailsRow lot={lot} colSpanCount={9} />
        </tbody>
      </table>,
    );

    expect(screen.getByText('Dates')).toBeInTheDocument();
    expect(screen.getByText('ITPs: 2')).toBeInTheDocument();
    expect(screen.getByText('Test Results: 3')).toBeInTheDocument();
    expect(screen.getByText('Documents: 4')).toBeInTheDocument();
    expect(screen.getByText('NCRs: 1')).toBeInTheDocument();
    expect(screen.getByText('Hold Points: 5')).toBeInTheDocument();
    expect(screen.getByText('Area/Zone: Zone A')).toBeInTheDocument();
    expect(screen.getByText('Requires access check')).toBeInTheDocument();
  });

  it('renders infinite-scroll loading and count states', () => {
    const loadMoreRef = { current: null } as RefObject<HTMLDivElement>;
    const { rerender } = render(
      <LotTableLoadMoreIndicator
        displayedCount={20}
        filteredCount={40}
        hasMore
        loadingMore
        loadMoreRef={loadMoreRef}
      />,
    );

    expect(screen.getByText('Loading more lots...')).toBeInTheDocument();

    rerender(
      <LotTableLoadMoreIndicator
        displayedCount={20}
        filteredCount={40}
        hasMore
        loadingMore={false}
        loadMoreRef={loadMoreRef}
      />,
    );
    expect(
      screen.getByText('Showing 20 of 40 lots - Scroll down to load more'),
    ).toBeInTheDocument();

    rerender(
      <LotTableLoadMoreIndicator
        displayedCount={40}
        filteredCount={40}
        hasMore={false}
        loadingMore={false}
        loadMoreRef={loadMoreRef}
      />,
    );
    expect(screen.getByText('Showing all 40 lots')).toBeInTheDocument();
  });
});
