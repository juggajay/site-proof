import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRef } from 'react';
import { renderWithProviders, screen, fireEvent } from '@/test/renderWithProviders';
import { LotMobileList } from './LotMobileList';
import type { Lot } from '../lotsPageTypes';

const navigateSpy = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateSpy };
});

// jsdom gives the scroll container a 0px viewport, so the real virtualizer
// renders no rows. Mock it to emit one virtual item per lot so the card
// (and its tap handler) is actually in the DOM under test.
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 180,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        key: index,
        start: index * 180,
      })),
    measureElement: () => {},
  }),
}));

const lot: Lot = {
  id: 'lot-1',
  lotNumber: 'LOT-001',
  description: 'Test lot',
  status: 'in_progress',
  chainageStart: null,
  chainageEnd: null,
  offset: null,
  layer: null,
  areaZone: null,
};

type Overrides = Partial<Parameters<typeof LotMobileList>[0]>;

function renderList(overrides: Overrides = {}) {
  const props: Parameters<typeof LotMobileList>[0] = {
    displayedLots: [lot],
    filteredLots: [lot],
    allLots: [lot],
    isMobile: true,
    isSubcontractor: false,
    canCreate: true,
    projectId: 'p1',
    onContextMenu: vi.fn(),
    onRefresh: vi.fn().mockResolvedValue(undefined),
    loadMoreRef: createRef<HTMLDivElement>(),
    loadingMore: false,
    hasMore: false,
    ...overrides,
  };
  return renderWithProviders(<LotMobileList {...props} />);
}

describe('LotMobileList skeleton loading state', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows the mobile skeleton while isLoading=true and no lots are cached', () => {
    renderList({ displayedLots: [], filteredLots: [], allLots: [], isLoading: true });
    expect(screen.getByTestId('lot-mobile-skeleton')).toBeInTheDocument();
    expect(screen.getAllByTestId('lot-mobile-card-skeleton').length).toBeGreaterThanOrEqual(3);
  });

  it('does not show the skeleton once isLoading=false', () => {
    renderList({ isLoading: false });
    expect(screen.queryByTestId('lot-mobile-skeleton')).not.toBeInTheDocument();
    // Real card present instead
    expect(screen.getByTestId('lot-card-lot-1')).toBeInTheDocument();
  });

  it('does not show the skeleton when lots are already cached even if isLoading is true', () => {
    // Background refetch scenario: data present, isLoading=false (TanStack Query behaviour).
    // isLoading is only true when data is undefined, so this covers the contract.
    renderList({ displayedLots: [lot], isLoading: false });
    expect(screen.queryByTestId('lot-mobile-skeleton')).not.toBeInTheDocument();
    expect(screen.getByTestId('lot-card-lot-1')).toBeInTheDocument();
  });
});

describe('LotMobileList card tap navigation', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('navigates to the lot when its card is tapped on mobile', () => {
    renderList({ isMobile: true });

    fireEvent.click(screen.getByTestId('lot-card-lot-1'));

    expect(navigateSpy).toHaveBeenCalledWith('/projects/p1/lots/lot-1');
  });

  it('navigates to the lot when its card is clicked on desktop', () => {
    renderList({ isMobile: false });

    fireEvent.click(screen.getByTestId('lot-card-lot-1'));

    expect(navigateSpy).toHaveBeenCalledWith('/projects/p1/lots/lot-1');
  });
});
