import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DrawingMobileList } from './DrawingMobileList';
import type { Drawing } from '../drawingsUploadData';

afterEach(() => {
  cleanup();
});

const baseDrawing: Drawing = {
  id: 'drawing-1',
  drawingNumber: 'DWG-001',
  title: 'Site Plan',
  revision: 'A',
  issueDate: '2026-05-01T00:00:00.000Z',
  status: 'for_construction',
  createdAt: '2026-05-01T00:00:00.000Z',
  document: {
    id: 'doc-1',
    filename: 'site-plan.pdf',
    fileUrl: '/uploads/drawings/site-plan.pdf',
    fileSize: 2048,
    mimeType: 'application/pdf',
    uploadedAt: '2026-05-01T00:00:00.000Z',
    uploadedBy: { id: 'user-1', fullName: 'QA Owner', email: 'qa@example.com' },
  },
  supersededBy: null,
  supersedes: [],
};

function renderList(overrides: Partial<Parameters<typeof DrawingMobileList>[0]> = {}) {
  const props: Parameters<typeof DrawingMobileList>[0] = {
    drawings: [baseDrawing],
    hasActiveFilters: false,
    canManageDrawings: true,
    statusChangePending: false,
    handleStatusChange: vi.fn(),
    handleOpenDrawing: vi.fn().mockResolvedValue(undefined),
    openRevisionModal: vi.fn(),
    setDrawingPendingDelete: vi.fn(),
    ...overrides,
  };
  render(<DrawingMobileList {...props} />);
  return props;
}

describe('DrawingMobileList', () => {
  it('renders a card for each drawing with drawing number and title', () => {
    renderList();

    expect(screen.getByText('DWG-001')).toBeInTheDocument();
    expect(screen.getByText('Site Plan')).toBeInTheDocument();
  });

  it('shows the revision chip when a revision is set', () => {
    renderList();

    expect(screen.getByText('Rev A')).toBeInTheDocument();
  });

  it('shows the status selector for managers', () => {
    renderList();

    expect(screen.getByLabelText('Status for DWG-001')).toBeInTheDocument();
  });

  it('shows a static status badge for read-only users', () => {
    renderList({ canManageDrawings: false });

    expect(screen.queryByLabelText('Status for DWG-001')).not.toBeInTheDocument();
    expect(screen.getByText('For Construction')).toBeInTheDocument();
  });

  it('calls handleOpenDrawing when the download button is tapped', () => {
    const { handleOpenDrawing } = renderList();

    fireEvent.click(screen.getByRole('button', { name: 'Download DWG-001' }));

    expect(handleOpenDrawing).toHaveBeenCalledTimes(1);
    expect(handleOpenDrawing).toHaveBeenCalledWith(baseDrawing);
  });

  it('shows the More-actions menu button and opens it on click', () => {
    renderList();

    const moreButton = screen.getByRole('button', { name: 'More actions for DWG-001' });
    expect(moreButton).toBeInTheDocument();

    fireEvent.click(moreButton);
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('calls openRevisionModal from the More menu for a non-superseded drawing', () => {
    const { openRevisionModal } = renderList();

    fireEvent.click(screen.getByRole('button', { name: 'More actions for DWG-001' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /new revision/i }));

    expect(openRevisionModal).toHaveBeenCalledTimes(1);
    expect(openRevisionModal).toHaveBeenCalledWith(baseDrawing);
  });

  it('calls setDrawingPendingDelete from the More menu', () => {
    const { setDrawingPendingDelete } = renderList();

    fireEvent.click(screen.getByRole('button', { name: 'More actions for DWG-001' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /delete/i }));

    expect(setDrawingPendingDelete).toHaveBeenCalledTimes(1);
    expect(setDrawingPendingDelete).toHaveBeenCalledWith(baseDrawing);
  });

  it('hides the New Revision menu item for a superseded drawing', () => {
    const superseded: Drawing = {
      ...baseDrawing,
      supersededBy: { id: 'drawing-2', drawingNumber: 'DWG-001', revision: 'B' },
    };
    renderList({ drawings: [superseded] });

    fireEvent.click(screen.getByRole('button', { name: 'More actions for DWG-001' }));

    expect(screen.queryByRole('menuitem', { name: /new revision/i })).not.toBeInTheDocument();
    // Delete is still present
    expect(screen.getByRole('menuitem', { name: /delete/i })).toBeInTheDocument();
  });

  it('hides the More menu entirely for read-only users', () => {
    renderList({ canManageDrawings: false });

    expect(
      screen.queryByRole('button', { name: 'More actions for DWG-001' }),
    ).not.toBeInTheDocument();
  });

  it('shows the superseded label and applies opacity on superseded cards', () => {
    const superseded: Drawing = {
      ...baseDrawing,
      supersededBy: { id: 'drawing-2', drawingNumber: 'DWG-001', revision: 'B' },
    };
    renderList({ drawings: [superseded] });

    expect(screen.getByText('(Superseded)')).toBeInTheDocument();
    const card = screen.getByTestId('drawing-card-drawing-1');
    expect(card.className).toContain('opacity-60');
  });

  it('shows the first-upload empty state when drawings is empty and no filters', () => {
    renderList({ drawings: [], hasActiveFilters: false });

    expect(screen.getByText('No drawings found')).toBeInTheDocument();
    expect(screen.getByText('Upload your first drawing to get started.')).toBeInTheDocument();
  });

  it('shows the filtered empty state when drawings is empty and filters are active', () => {
    renderList({ drawings: [], hasActiveFilters: true });

    expect(screen.getByText('No drawings found')).toBeInTheDocument();
    expect(screen.getByText('No drawings match the current filters.')).toBeInTheDocument();
  });

  it('passes drawing id and new value to handleStatusChange', () => {
    const { handleStatusChange } = renderList();

    fireEvent.change(screen.getByLabelText('Status for DWG-001'), {
      target: { value: 'as_built' },
    });

    expect(handleStatusChange).toHaveBeenCalledWith('drawing-1', 'as_built');
  });
});
