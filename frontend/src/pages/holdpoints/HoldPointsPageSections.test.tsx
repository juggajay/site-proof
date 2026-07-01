import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { HoldPointsLoadErrorAlert, HoldPointsPageHeader } from './HoldPointsPageSections';

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
  return { props, ...render(<HoldPointsPageHeader {...props} />) };
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
