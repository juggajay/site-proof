import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LotHeader, type LotHeaderProps } from './LotHeader';
import type { Lot } from '../types';

afterEach(() => {
  cleanup();
});

const baseLot: Lot = {
  id: 'lot-1',
  lotNumber: 'LOT-001',
  description: 'Bulk earthworks',
  status: 'in_progress',
  activityType: 'Earthworks',
  chainageStart: 0,
  chainageEnd: 100,
  offset: null,
  layer: null,
  areaZone: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  conformedAt: null,
  conformedBy: null,
  assignedSubcontractorId: null,
  assignedSubcontractor: null,
};

function renderHeader(overrides: Partial<LotHeaderProps> = {}) {
  const props: LotHeaderProps = {
    lot: baseLot,
    projectId: 'project-1',
    lotId: 'lot-1',
    canConformLots: false,
    canManageLot: false,
    isEditable: true,
    linkCopied: false,
    assignments: [],
    removeAssignmentPending: false,
    onCopyLink: vi.fn(),
    onPrint: vi.fn(),
    onEdit: vi.fn(),
    onAssignSubcontractorLegacy: vi.fn(),
    onOverrideStatus: vi.fn(),
    onAddSubcontractor: vi.fn(),
    onEditAssignment: vi.fn(),
    onRemoveAssignment: vi.fn(),
    ...overrides,
  };
  return render(<LotHeader {...props} />);
}

describe('LotHeader lot-configuration permissions', () => {
  it('hides Edit Lot and Assign Subcontractor for a foreman (canManageLot=false)', () => {
    // A foreman is a non-viewer, so the old broad canEdit/viewer permission was
    // true for them — yet they cannot reach the lot-edit route or assign
    // subcontractors. The configuration actions must follow canManageLot.
    renderHeader({ canManageLot: false });

    expect(screen.queryByRole('button', { name: 'Edit Lot' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Assign Subcontractor/i })).not.toBeInTheDocument();

    // Field/non-configuration controls stay available to every non-viewer.
    expect(screen.getByRole('button', { name: 'Copy Link' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Print' })).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('shows Edit Lot and Assign Subcontractor for a manager (canManageLot=true)', () => {
    renderHeader({ canManageLot: true });

    expect(screen.getByRole('button', { name: 'Edit Lot' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Assign Subcontractor/i })).toBeInTheDocument();
  });
});

describe('LotHeader mobile layout', () => {
  it('stacks the title and actions and wraps the action cluster so it does not overflow at 390px', () => {
    renderHeader({ canManageLot: true });

    const actionCluster = screen.getByRole('button', { name: 'Copy Link' }).parentElement;
    // The action buttons wrap onto multiple lines instead of overflowing.
    expect(actionCluster).toHaveClass('flex-wrap');

    const headerRow = actionCluster?.parentElement;
    // Title block and actions stack vertically on mobile, side-by-side on >= sm.
    expect(headerRow).toHaveClass('flex-col');
    expect(headerRow).toHaveClass('sm:flex-row');
  });
});
