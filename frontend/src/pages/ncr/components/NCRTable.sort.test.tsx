import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { NcrSortDirection, NcrSortField } from '../ncrRegisterSort';
import { canManageNcrClosure } from '../ncrClosureAccess';
import { NCRTable } from './NCRTable';

interface RenderTableOptions {
  sortField?: string;
  sortDirection?: NcrSortDirection;
  onSort?: ReturnType<typeof vi.fn<(field: NcrSortField) => void>>;
}

function renderTable({
  sortField = '',
  sortDirection = 'asc',
  onSort = vi.fn<(field: NcrSortField) => void>(),
}: RenderTableOptions = {}) {
  render(
    <NCRTable
      ncrs={[]}
      userRole={null}
      actionLoading={false}
      copiedNcrId={null}
      highlightedNcrId={null}
      sortField={sortField}
      sortDirection={sortDirection}
      onSort={onSort}
      onCopyLink={vi.fn()}
      onAssign={vi.fn()}
      onRespond={vi.fn()}
      onReviewResponse={vi.fn()}
      onQmApprove={vi.fn()}
      onNotifyClient={vi.fn()}
      onRectify={vi.fn()}
      onRejectRectification={vi.fn()}
      onClose={vi.fn()}
      onConcession={vi.fn()}
    />,
  );
  return { onSort };
}

describe('NCRTable sortable headers', () => {
  it('exposes raised/due/severity/status as clickable sort headers', () => {
    const { onSort } = renderTable();

    fireEvent.click(screen.getByTestId('ncr-column-header-raised'));
    fireEvent.click(screen.getByTestId('ncr-column-header-due'));
    fireEvent.click(screen.getByTestId('ncr-column-header-severity'));
    fireEvent.click(screen.getByTestId('ncr-column-header-status'));

    expect(onSort.mock.calls.map(([field]) => field)).toEqual([
      'raised',
      'due',
      'severity',
      'status',
    ]);
  });

  it('marks the active column with aria-sort for the current direction', () => {
    renderTable({ sortField: 'due', sortDirection: 'desc' });

    expect(screen.getByTestId('ncr-column-header-due')).toHaveAttribute('aria-sort', 'descending');
    expect(screen.getByTestId('ncr-column-header-status')).not.toHaveAttribute('aria-sort');
  });
});

describe('canManageNcrClosure', () => {
  it('matches the backend close roles', () => {
    for (const role of ['owner', 'admin', 'project_manager', 'site_manager', 'quality_manager']) {
      expect(canManageNcrClosure({ role, isQualityManager: false, canApproveNCRs: false })).toBe(
        true,
      );
    }
  });

  it('hides close actions from field roles that can read the register but cannot close', () => {
    for (const role of ['foreman', 'site_engineer', 'viewer']) {
      expect(canManageNcrClosure({ role, isQualityManager: false, canApproveNCRs: false })).toBe(
        false,
      );
    }
  });
});
