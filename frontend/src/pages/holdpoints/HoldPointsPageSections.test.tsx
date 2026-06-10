import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { HoldPointsLoadErrorAlert, HoldPointsPageHeader } from './HoldPointsPageSections';

function renderHeader(overrides: Partial<Parameters<typeof HoldPointsPageHeader>[0]> = {}) {
  const props = {
    holdPointCount: 1,
    isMobile: false,
    statusFilter: 'all' as const,
    searchQuery: '',
    onStatusFilterChange: vi.fn(),
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
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();

    rerender(<HoldPointsPageHeader {...props} holdPointCount={1} />);

    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument();
  });

  it('hides CSV export on mobile', () => {
    renderHeader({ isMobile: true });

    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Export CSV' })).not.toBeInTheDocument();
  });

  it('offers the awaiting-release notice-expired view in the status filter', async () => {
    const user = userEvent.setup();
    const { props } = renderHeader();

    await user.selectOptions(screen.getByRole('combobox'), 'Awaiting Release — Notice Expired');

    expect(props.onStatusFilterChange).toHaveBeenCalledWith('notice-expired');
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
