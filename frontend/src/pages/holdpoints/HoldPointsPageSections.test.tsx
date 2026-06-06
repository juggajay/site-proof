import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { HoldPointsLoadErrorAlert, HoldPointsPageHeader } from './HoldPointsPageSections';

describe('HoldPointsPageHeader', () => {
  it('renders the filter only when hold points exist', () => {
    const { rerender } = render(
      <HoldPointsPageHeader
        holdPointCount={0}
        isMobile={false}
        statusFilter="all"
        onStatusFilterChange={vi.fn()}
        onExportCSV={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Hold Points' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();

    rerender(
      <HoldPointsPageHeader
        holdPointCount={1}
        isMobile={false}
        statusFilter="all"
        onStatusFilterChange={vi.fn()}
        onExportCSV={vi.fn()}
      />,
    );

    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument();
  });

  it('hides CSV export on mobile', () => {
    render(
      <HoldPointsPageHeader
        holdPointCount={1}
        isMobile
        statusFilter="all"
        onStatusFilterChange={vi.fn()}
        onExportCSV={vi.fn()}
      />,
    );

    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Export CSV' })).not.toBeInTheDocument();
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
