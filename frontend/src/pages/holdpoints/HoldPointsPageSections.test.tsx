import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import {
  HoldPointsBatchSelectionBar,
  HoldPointsLoadErrorAlert,
  HoldPointsPageHeader,
  HoldPointsTrends,
} from './HoldPointsPageSections';
import { HoldPointSummaryLine } from './components/HoldPointStatusFilter';
import type { HoldPointChartData } from './holdPointsPageData';

function renderHeader(overrides: Partial<Parameters<typeof HoldPointsPageHeader>[0]> = {}) {
  const props = {
    holdPointCount: 1,
    isMobile: false,
    statusFilter: 'all' as const,
    selectedLotId: 'all',
    searchQuery: '',
    lotOptions: [
      { lotId: 'lot-1', lotNumber: 'LOT-001', holdPointCount: 2 },
      { lotId: 'lot-2', lotNumber: 'LOT-002', holdPointCount: 1 },
    ],
    onStatusFilterChange: vi.fn(),
    onLotFilterChange: vi.fn(),
    onSearchChange: vi.fn(),
    onExportCSV: vi.fn(),
    ...overrides,
  };
  // The status filter bar now embeds the router-aware SavedViewsMenu, so the
  // header must render inside a Router. RTL applies the wrapper to rerender too.
  return { props, ...render(<HoldPointsPageHeader {...props} />, { wrapper: MemoryRouter }) };
}

describe('HoldPointsPageHeader', () => {
  it('renders the filter only when hold points exist', () => {
    const { rerender, props } = renderHeader({ holdPointCount: 0 });

    expect(screen.getByRole('heading', { name: 'Hold Points' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Help for Hold Points' })).toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: 'Filter hold points by status' }),
    ).not.toBeInTheDocument();

    rerender(<HoldPointsPageHeader {...props} holdPointCount={1} />);

    expect(
      screen.getByRole('combobox', { name: 'Filter hold points by status' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument();
  });

  it('stacks the filters full-width and 44px tall below md', () => {
    renderHeader();

    // Wrapped side by side they split across three ragged rows, squeezing the
    // status select to ~110px — narrower than the option text naming it.
    for (const control of [
      screen.getByRole('combobox', { name: 'Filter hold points by status' }),
      screen.getByRole('combobox', { name: 'Filter hold points by lot' }),
      screen.getByRole('textbox', { name: 'Search hold points by lot or description' }),
    ]) {
      expect(control).toHaveClass('h-11');
      expect(control).toHaveClass('w-full');
    }
  });

  it('hides CSV export on mobile', () => {
    renderHeader({ isMobile: true });

    expect(
      screen.getByRole('combobox', { name: 'Filter hold points by status' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Export CSV' })).not.toBeInTheDocument();
  });

  it('offers the awaiting-release notice-expired view in the status filter', async () => {
    const user = userEvent.setup();
    const { props } = renderHeader();

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Filter hold points by status' }),
      'Awaiting Release — Notice Expired',
    );

    expect(props.onStatusFilterChange).toHaveBeenCalledWith('notice-expired');
  });

  it('offers an all-lots option and reports selected lots', async () => {
    const user = userEvent.setup();
    const { props } = renderHeader();

    const lotFilter = screen.getByRole('combobox', { name: 'Filter hold points by lot' });
    expect(lotFilter).toHaveValue('all');
    expect(screen.getByRole('option', { name: 'All lots' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'LOT-001' })).toBeInTheDocument();

    await user.selectOptions(lotFilter, 'LOT-002');

    expect(props.onLotFilterChange).toHaveBeenCalledWith('lot-2');
  });

  it('renders the lot search box and reports typed queries', async () => {
    const user = userEvent.setup();
    const { props } = renderHeader();

    const search = screen.getByRole('textbox', {
      name: 'Search hold points by lot or description',
    });
    await user.type(search, 'LOT-2');

    expect(props.onSearchChange).toHaveBeenCalled();
    expect(props.onSearchChange).toHaveBeenLastCalledWith(expect.stringContaining('2'));
  });
});

function renderBatchBar(
  overrides: Partial<Parameters<typeof HoldPointsBatchSelectionBar>[0]> = {},
) {
  const props = {
    eligibleCount: 0,
    selectedCount: 0,
    selectedLotNumber: null,
    onSelectAll: vi.fn(),
    onClear: vi.fn(),
    onRequestSelected: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<HoldPointsBatchSelectionBar {...props} />) };
}

describe('HoldPointsBatchSelectionBar', () => {
  it('renders nothing with no lot filtered and nothing selected', () => {
    // The default register view. This band used to sit between the filters and
    // the first row carrying three disabled buttons and a filled-grey
    // "Request selected (0)".
    const { container } = renderBatchBar();

    expect(container).toBeEmptyDOMElement();
  });

  it('offers select-all once a lot with pending hold points is filtered', async () => {
    const user = userEvent.setup();
    const { props } = renderBatchBar({ eligibleCount: 3, selectedLotNumber: 'LOT-001' });

    expect(screen.getByText(/3 pending hold points in LOT-001/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Request selected/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Select all pending/i }));

    expect(props.onSelectAll).toHaveBeenCalledTimes(1);
  });

  it('offers request and clear once rows are selected', async () => {
    const user = userEvent.setup();
    const { props } = renderBatchBar({
      eligibleCount: 3,
      selectedCount: 2,
      selectedLotNumber: 'LOT-001',
    });

    expect(screen.getByText('2 hold points selected in LOT-001')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Request selected (2)' }));
    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(props.onRequestSelected).toHaveBeenCalledTimes(1);
    expect(props.onClear).toHaveBeenCalledTimes(1);
  });

  it('drops select-all once everything eligible is selected', () => {
    renderBatchBar({ eligibleCount: 2, selectedCount: 2, selectedLotNumber: 'LOT-001' });

    expect(screen.queryByRole('button', { name: /Select all pending/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Request selected (2)' })).toBeEnabled();
  });

  it('never renders a disabled request button', () => {
    // "Request selected (0)" rendered filled-grey and read as a broken action.
    for (const selectedCount of [0, 1, 5]) {
      const { unmount } = render(
        <HoldPointsBatchSelectionBar
          eligibleCount={5}
          selectedCount={selectedCount}
          selectedLotNumber="LOT-001"
          onSelectAll={vi.fn()}
          onClear={vi.fn()}
          onRequestSelected={vi.fn()}
        />,
      );
      const request = screen.queryByRole('button', { name: /Request selected/i });
      if (request) expect(request).toBeEnabled();
      else expect(selectedCount).toBe(0);
      unmount();
    }
  });
});

function buildChartData(releases: number[]): HoldPointChartData {
  return {
    releasesOverTime: releases.map((count, index) => ({
      date: `Jul ${index + 1}`,
      releases: count,
    })),
    avgTimeToRelease: 12,
  };
}

describe('HoldPointsTrends', () => {
  it('replaces the charts with one line when nothing was released in the window', () => {
    render(
      <HoldPointsTrends chartData={buildChartData([0, 0, 0, 0, 0, 0, 0])} releasedCount={1} />,
    );

    expect(screen.getByTestId('hp-trends-empty')).toHaveTextContent(
      'No hold point releases in the last 7 days.',
    );
    expect(screen.queryByText(/HP Releases/i)).not.toBeInTheDocument();
  });

  it('renders the charts once there is a release to plot', () => {
    render(
      <HoldPointsTrends chartData={buildChartData([0, 0, 2, 0, 0, 1, 0])} releasedCount={3} />,
    );

    expect(screen.queryByTestId('hp-trends-empty')).not.toBeInTheDocument();
    // The chart bundle is lazy; the Suspense fallback proves it was requested.
    expect(screen.getByText('Loading chart...')).toBeInTheDocument();
  });
});

describe('HoldPointSummaryLine', () => {
  const stats = {
    total: 10,
    pending: 7,
    notified: 2,
    refused: 1,
    conditionsOpen: 1,
    releasedThisWeek: 0,
    overdue: 0,
  };

  it('shows only the counts that name work, and filters on click', async () => {
    const user = userEvent.setup();
    const onStatusFilterChange = vi.fn();

    render(
      <HoldPointSummaryLine
        stats={stats}
        statusFilter="all"
        onStatusFilterChange={onStatusFilterChange}
      />,
    );

    const line = screen.getByTestId('hp-summary-line');
    expect(line).toHaveTextContent('7 pending');
    expect(line).toHaveTextContent('2 awaiting release');
    // The KPI cards showed "Total 1728 / Pending 1727" plus two zeros.
    expect(line).not.toHaveTextContent('10');
    expect(line).not.toHaveTextContent('released this week');

    await user.click(screen.getByRole('button', { name: '7 pending' }));

    expect(onStatusFilterChange).toHaveBeenCalledWith('pending');
  });

  it('toggles an active count back to the all view', async () => {
    const user = userEvent.setup();
    const onStatusFilterChange = vi.fn();

    render(
      <HoldPointSummaryLine
        stats={stats}
        statusFilter="pending"
        onStatusFilterChange={onStatusFilterChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: '7 pending' }));

    expect(onStatusFilterChange).toHaveBeenCalledWith('all');
  });

  it('calls out overdue hold points and drops zero counts', () => {
    render(
      <HoldPointSummaryLine
        stats={{
          total: 10,
          pending: 0,
          notified: 3,
          refused: 0,
          conditionsOpen: 0,
          releasedThisWeek: 4,
          overdue: 2,
        }}
        statusFilter="all"
        onStatusFilterChange={vi.fn()}
      />,
    );

    const line = screen.getByTestId('hp-summary-line');
    expect(line).toHaveTextContent('3 awaiting release');
    expect(line).toHaveTextContent('2 overdue');
    expect(line).toHaveTextContent('4 released this week');
    expect(line).not.toHaveTextContent('pending');
  });

  it('says so when there is nothing left to action', () => {
    render(
      <HoldPointSummaryLine
        stats={{
          total: 6,
          pending: 0,
          notified: 0,
          refused: 0,
          conditionsOpen: 0,
          releasedThisWeek: 6,
          overdue: 0,
        }}
        statusFilter="all"
        onStatusFilterChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId('hp-summary-line')).toHaveTextContent('All 6 hold points released.');
  });
});

describe('HoldPointsLoadErrorAlert', () => {
  it('renders nothing without an error', () => {
    const { container } = render(<HoldPointsLoadErrorAlert loadError={null} onRetry={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('calls retry from the load error alert', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();

    render(<HoldPointsLoadErrorAlert loadError="Could not load hold points." onRetry={onRetry} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Could not load hold points.');
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
