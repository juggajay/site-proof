import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { DocketApprovalsTable } from './DocketApprovalsTable';
import type { Docket } from '../docketApprovalsData';

function makeDocket(overrides: Partial<Docket> = {}): Docket {
  return {
    id: 'docket-1',
    docketNumber: 'DKT-001',
    subcontractor: 'Ryox Carpentry',
    subcontractorId: 'sub-1',
    date: '2026-06-04',
    status: 'pending_approval',
    notes: null,
    labourHours: 8,
    plantHours: 4,
    totalLabourSubmitted: 600,
    totalLabourApproved: 8,
    totalPlantSubmitted: 200,
    totalPlantApproved: 4,
    totalLabourApprovedCost: null,
    totalPlantApprovedCost: null,
    submittedAt: '2026-06-04T08:00:00.000Z',
    approvedAt: null,
    foremanNotes: null,
    ...overrides,
  };
}

function renderTable(overrides: Partial<Parameters<typeof DocketApprovalsTable>[0]> = {}) {
  const props = {
    loading: false,
    filteredDockets: [] as Docket[],
    submittedDockets: [] as Docket[],
    statusFilter: 'all',
    subcontractorSetupHref: '/projects/p1/subcontractors',
    canApprove: true,
    isSubcontractor: false,
    printingDocketId: null,
    onTapDocket: vi.fn(),
    onPrintDocket: vi.fn().mockResolvedValue(undefined),
    onSubmitDocket: vi.fn(),
    onApprove: vi.fn(),
    onQuery: vi.fn(),
    onReject: vi.fn(),
    ...overrides,
  };
  const view = render(
    <MemoryRouter>
      <DocketApprovalsTable {...props} />
    </MemoryRouter>,
  );
  return { props, view };
}

describe('DocketApprovalsTable', () => {
  it('shows the loading row while dockets load', () => {
    renderTable({ loading: true });
    expect(screen.getByText('Loading dockets...')).toBeInTheDocument();
  });

  it('shows the invite empty state when no dockets were ever submitted', () => {
    renderTable();

    expect(screen.getByText('No subcontractor dockets yet')).toBeInTheDocument();
    const invite = screen.getByRole('link', { name: 'Invite a subcontractor' });
    expect(invite).toHaveAttribute('href', '/projects/p1/subcontractors');
  });

  it('shows filter-specific empty states when submitted dockets exist', () => {
    const { view } = renderTable({
      submittedDockets: [makeDocket()],
      statusFilter: 'pending_approval',
    });
    expect(screen.getByText('All caught up')).toBeInTheDocument();

    view.unmount();
    renderTable({ submittedDockets: [makeDocket()], statusFilter: 'rejected' });
    expect(screen.getByText('No rejected dockets')).toBeInTheDocument();
  });

  it('renders docket rows with status label and notes fallback', () => {
    const docket = makeDocket();
    renderTable({ filteredDockets: [docket], submittedDockets: [docket] });

    expect(screen.getByText('DKT-001')).toBeInTheDocument();
    expect(screen.getByText('Ryox Carpentry')).toBeInTheDocument();
    expect(screen.getByText('Pending Approval')).toBeInTheDocument();
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('shows approved-hours adjustments with the submitted value struck through', () => {
    const docket = makeDocket({
      status: 'approved',
      labourHours: 8,
      totalLabourApproved: 6,
      totalLabourSubmitted: 364,
    });
    renderTable({ filteredDockets: [docket], submittedDockets: [docket] });

    expect(screen.getByText('6h')).toBeInTheDocument();
    expect(screen.getByText('8h').className).toContain('line-through');
  });

  it('does not treat submitted cost totals as hour adjustments', () => {
    const docket = makeDocket({
      status: 'approved',
      labourHours: 8,
      totalLabourSubmitted: 364,
      totalLabourApproved: 8,
      plantHours: 4,
      totalPlantSubmitted: 600,
      totalPlantApproved: 4,
    });
    renderTable({ filteredDockets: [docket], submittedDockets: [docket] });

    expect(screen.getByText('8h').className).not.toContain('line-through');
    expect(screen.getByText('4h').className).not.toContain('line-through');
  });

  it('shows approved dollar totals when approval reduced the submitted cost', () => {
    const docket = makeDocket({
      status: 'approved',
      totalLabourSubmitted: 1200,
      totalPlantSubmitted: 300,
      totalLabourApprovedCost: 900,
      totalPlantApprovedCost: 200,
    });
    renderTable({ filteredDockets: [docket], submittedDockets: [docket] });

    expect(screen.getByText('$1,100.00')).toBeInTheDocument();
    expect(screen.getByText('$1,500.00').className).toContain('line-through');
  });

  it('shows restricted instead of zero when docket costs are redacted', () => {
    const docket = makeDocket({
      totalLabourSubmitted: null,
      totalPlantSubmitted: null,
      totalLabourApprovedCost: null,
      totalPlantApprovedCost: null,
    });
    renderTable({ filteredDockets: [docket], submittedDockets: [docket] });

    expect(screen.getByText('Restricted')).toBeInTheDocument();
    expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
  });

  it('gates approve/query/reject on pending status and approver role', () => {
    const docket = makeDocket();
    const { props, view } = renderTable({ filteredDockets: [docket], submittedDockets: [docket] });

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    fireEvent.click(screen.getByRole('button', { name: 'Query' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    expect(props.onApprove).toHaveBeenCalledWith(docket);
    expect(props.onQuery).toHaveBeenCalledWith(docket);
    expect(props.onReject).toHaveBeenCalledWith(docket);

    view.unmount();
    renderTable({ filteredDockets: [docket], submittedDockets: [docket], canApprove: false });
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  });

  it('shows Submit only for subcontractors viewing draft dockets', () => {
    const draft = makeDocket({ status: 'draft' });
    const { props, view } = renderTable({
      filteredDockets: [draft],
      submittedDockets: [draft],
      isSubcontractor: true,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(props.onSubmitDocket).toHaveBeenCalledWith(draft);

    view.unmount();
    renderTable({ filteredDockets: [draft], submittedDockets: [draft], isSubcontractor: false });
    expect(screen.queryByRole('button', { name: 'Submit' })).not.toBeInTheDocument();
  });

  it('disables print only for the docket currently printing', () => {
    const docket = makeDocket();
    const { props } = renderTable({
      filteredDockets: [docket],
      submittedDockets: [docket],
      printingDocketId: 'docket-1',
    });

    const printButton = screen.getByRole('button', { name: 'Print docket' });
    expect(printButton).toBeDisabled();
    expect(props.onPrintDocket).not.toHaveBeenCalled();
  });

  it('opens the docket on row click but not when clicking action buttons', () => {
    const docket = makeDocket();
    const { props } = renderTable({ filteredDockets: [docket], submittedDockets: [docket] });

    fireEvent.click(screen.getByText('DKT-001'));
    expect(props.onTapDocket).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Print docket' }));
    expect(props.onPrintDocket).toHaveBeenCalledWith(docket);
    expect(props.onTapDocket).toHaveBeenCalledTimes(1);
  });
});
