import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  AuditLogDismissibleErrorAlert,
  AuditLogEmptyState,
  AuditLogFilters,
  AuditLogHeader,
  AuditLogPaginationControls,
  AuditLogResultsSummary,
  type AuditLogFilterState,
} from './AuditLogControls';

const filters: AuditLogFilterState = {
  projectId: '',
  entityType: '',
  action: 'lot_created',
  userId: '',
  search: 'qa dogfood',
  startDate: '',
  endDate: '',
};

describe('AuditLogHeader', () => {
  it('exports when logs are available and no errors are active', () => {
    const onExport = vi.fn();
    render(
      <AuditLogHeader
        loading={false}
        exporting={false}
        hasError={false}
        total={3}
        onExport={onExport}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it('describes scoped access instead of claiming every project is visible', () => {
    render(
      <AuditLogHeader
        loading={false}
        exporting={false}
        hasError={false}
        total={0}
        onExport={vi.fn()}
      />,
    );

    expect(
      screen.getByText('View system activity and changes you have access to'),
    ).toBeInTheDocument();
  });

  it('disables export while unavailable', () => {
    render(
      <AuditLogHeader loading={false} exporting hasError={false} total={3} onExport={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: 'Exporting...' })).toBeDisabled();
  });
});

describe('AuditLogFilters', () => {
  it('renders active filters, formats action labels, and reports changes', () => {
    const onFilterChange = vi.fn();
    render(
      <AuditLogFilters
        filters={filters}
        actions={['lot_created']}
        entityTypes={['lot']}
        users={[{ id: 'user-1', email: 'qa@example.com', fullName: 'QA User' }]}
        showFilters
        hasActiveFilters
        actionsError={null}
        entityTypesError={null}
        usersError={null}
        onToggleFilters={vi.fn()}
        onFilterChange={onFilterChange}
        onClearFilters={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /Filters/ })).toHaveTextContent('2');
    expect(screen.getByRole('option', { name: 'Lot created' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search audit logs'), {
      target: { value: 'hold point' },
    });
    expect(onFilterChange).toHaveBeenCalledWith('search', 'hold point');
  });

  it('clears active filters', () => {
    const onClearFilters = vi.fn();
    render(
      <AuditLogFilters
        filters={filters}
        actions={[]}
        entityTypes={[]}
        users={[]}
        showFilters
        hasActiveFilters
        actionsError={null}
        entityTypesError={null}
        usersError={null}
        onToggleFilters={vi.fn()}
        onFilterChange={vi.fn()}
        onClearFilters={onClearFilters}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear all filters' }));

    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });
});

describe('AuditLogPaginationControls', () => {
  it('pages backward and forward within bounds', () => {
    const onPreviousPage = vi.fn();
    const onNextPage = vi.fn();
    render(
      <AuditLogPaginationControls
        page={2}
        totalPages={3}
        onPreviousPage={onPreviousPage}
        onNextPage={onNextPage}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(onPreviousPage).toHaveBeenCalledTimes(1);
    expect(onNextPage).toHaveBeenCalledTimes(1);
  });
});

describe('AuditLog alerts and empty states', () => {
  it('renders dismissible export errors', () => {
    const onDismiss = vi.fn();
    render(<AuditLogDismissibleErrorAlert error="Failed to export" onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders result counts and filtered empty-state copy', () => {
    render(
      <>
        <AuditLogResultsSummary visibleCount={0} total={0}>
          <span>no pages</span>
        </AuditLogResultsSummary>
        <AuditLogEmptyState hasActiveFilters />
      </>,
    );

    expect(screen.getByText('Showing 0 of 0 audit log entries')).toBeInTheDocument();
    expect(screen.getByText(/No logs match your current filters/)).toBeInTheDocument();
  });
});
