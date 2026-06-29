import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DrawingRegisterTable } from './DrawingRegisterTable';
import type { Drawing } from '../drawingsUploadData';

afterEach(() => {
  cleanup();
});

// Wiring tests for the table region moved out of DrawingsPage. The Issue Date
// cell is deliberately not asserted — formatDate uses toLocaleDateString('en-AU'),
// which is timezone/locale dependent.
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

function renderTable(overrides: Partial<Parameters<typeof DrawingRegisterTable>[0]> = {}) {
  const props: Parameters<typeof DrawingRegisterTable>[0] = {
    loading: false,
    error: null,
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
  render(<DrawingRegisterTable {...props} />);
  return props;
}

describe('DrawingRegisterTable', () => {
  it('shows the first-upload empty state when there are no drawings and no filters', () => {
    renderTable({ drawings: [], hasActiveFilters: false });

    expect(screen.getByText('No drawings found')).toBeInTheDocument();
    expect(screen.getByText('Upload your first drawing to get started.')).toBeInTheDocument();
  });

  it('uses read-only empty-state copy for viewers', () => {
    renderTable({ drawings: [], hasActiveFilters: false, canManageDrawings: false });

    expect(screen.getByText('No drawings found')).toBeInTheDocument();
    expect(screen.getByText('No project drawings are available yet.')).toBeInTheDocument();
    expect(screen.queryByText(/upload/i)).not.toBeInTheDocument();
  });

  it('shows the filtered empty state when filters are active', () => {
    renderTable({ drawings: [], hasActiveFilters: true });

    expect(screen.getByText('No drawings found')).toBeInTheDocument();
    expect(screen.getByText('No drawings match the current filters.')).toBeInTheDocument();
  });

  it('marks a superseded drawing row and hides its revision action', () => {
    const superseded: Drawing = {
      ...baseDrawing,
      supersededBy: { id: 'drawing-2', drawingNumber: 'DWG-001', revision: 'B' },
    };
    renderTable({ drawings: [superseded] });

    const supersededLabel = screen.getByText('(Superseded)');
    expect(supersededLabel).toBeInTheDocument();
    expect(supersededLabel.closest('tr')?.className).toContain('opacity-60');
    expect(
      screen.queryByRole('button', { name: 'Upload new revision for DWG-001' }),
    ).not.toBeInTheDocument();
  });

  it('passes the drawing id and selected value to the status change callback', () => {
    const { handleStatusChange } = renderTable();

    fireEvent.change(screen.getByLabelText('Status for DWG-001'), {
      target: { value: 'as_built' },
    });

    expect(handleStatusChange).toHaveBeenCalledTimes(1);
    expect(handleStatusChange).toHaveBeenCalledWith('drawing-1', 'as_built');
  });

  // Desktop unchanged: isMobile defaults to false, table DOM is present.
  it('renders the overflow table on desktop (isMobile omitted)', () => {
    renderTable();

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.queryByTestId('drawing-mobile-list')).not.toBeInTheDocument();
  });

  it('renders the mobile card list when isMobile is true', () => {
    renderTable({ isMobile: true });

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByTestId('drawing-mobile-list')).toBeInTheDocument();
    // Key fields visible in card
    expect(screen.getByText('DWG-001')).toBeInTheDocument();
    expect(screen.getByText('Site Plan')).toBeInTheDocument();
  });

  it('mobile: shows loading state', () => {
    renderTable({ loading: true, isMobile: true });

    expect(screen.getByText('Loading drawings...')).toBeInTheDocument();
  });

  it('mobile: returns null when error is set', () => {
    const { container } = render(
      <DrawingRegisterTable
        loading={false}
        error="Failed"
        drawings={[baseDrawing]}
        hasActiveFilters={false}
        canManageDrawings={true}
        statusChangePending={false}
        handleStatusChange={vi.fn()}
        handleOpenDrawing={vi.fn().mockResolvedValue(undefined)}
        openRevisionModal={vi.fn()}
        setDrawingPendingDelete={vi.fn()}
        isMobile={true}
      />,
    );

    expect(container.firstChild).toBeNull();
  });
});
