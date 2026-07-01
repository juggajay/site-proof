import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Docket } from '../docketEditData';
import {
  DocketEditActionBar,
  DocketEditError,
  DocketEditHeader,
  DocketEditNotices,
} from './DocketEditPagePanels';

afterEach(() => {
  cleanup();
});

const baseDocket: Docket = {
  id: 'docket-1',
  docketNumber: 'DKT-001',
  date: '2026-06-06',
  status: 'draft',
  totalLabourSubmitted: 0,
  totalPlantSubmitted: 0,
  labourEntries: [],
  plantEntries: [],
};

function renderInRouter(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('DocketEditPagePanels', () => {
  it('renders the edit header title, project, and status label', () => {
    renderInRouter(
      <DocketEditHeader
        docket={{ ...baseDocket, status: 'pending_approval' }}
        isNewDocket={false}
        projectName="North Upgrade"
        today="2026-06-07"
        backTo="/subcontractor-portal?projectId=project-1&subcontractorCompanyId=subbie-1"
      />,
    );

    expect(screen.getByRole('heading', { name: 'Docket DKT-001' })).toBeInTheDocument();
    expect(screen.getByText('Project: North Upgrade')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('renders the error fallback with the portal link', () => {
    renderInRouter(<DocketEditError message="Docket not found" backTo="/subcontractor-portal" />);

    expect(screen.getByText('Docket not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to portal/i })).toHaveAttribute(
      'href',
      '/subcontractor-portal',
    );
  });

  it('renders query, rejection, and no-lot notices from docket state', () => {
    const onQueryResponseChange = vi.fn();
    const onRespondToQuery = vi.fn();

    const { rerender } = render(
      <DocketEditNotices
        docket={{ ...baseDocket, status: 'queried', foremanNotes: 'Clarify trench hours' }}
        queryResponse=""
        respondingToQuery={false}
        assignedLotCount={0}
        canEdit
        isOnline
        lotsModuleDisabled={false}
        onQueryResponseChange={onQueryResponseChange}
        onRespondToQuery={onRespondToQuery}
      />,
    );

    expect(screen.getByText(/query from foreman/i)).toBeInTheDocument();
    expect(screen.getByText('Clarify trench hours')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /respond & resubmit/i })).toBeDisabled();
    expect(screen.getByText(/no lots have been assigned/i)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Type your response to the query...'), {
      target: { value: 'Updated notes attached' },
    });
    expect(onQueryResponseChange).toHaveBeenCalledWith('Updated notes attached');

    rerender(
      <DocketEditNotices
        docket={{ ...baseDocket, status: 'rejected', foremanNotes: 'Missing docket photo' }}
        queryResponse=""
        respondingToQuery={false}
        assignedLotCount={1}
        canEdit
        isOnline
        lotsModuleDisabled={false}
        onQueryResponseChange={onQueryResponseChange}
        onRespondToQuery={onRespondToQuery}
      />,
    );

    expect(screen.getByText(/rejection reason/i)).toBeInTheDocument();
    expect(screen.getByText('Missing docket photo')).toBeInTheDocument();
    expect(screen.queryByText(/no lots have been assigned/i)).not.toBeInTheDocument();

    rerender(
      <DocketEditNotices
        docket={{
          ...baseDocket,
          status: 'approved',
          adjustmentReason: 'Reduced to verified site hours',
        }}
        queryResponse=""
        respondingToQuery={false}
        assignedLotCount={1}
        canEdit={false}
        isOnline
        lotsModuleDisabled={false}
        onQueryResponseChange={onQueryResponseChange}
        onRespondToQuery={onRespondToQuery}
      />,
    );

    expect(screen.getByText(/approved with adjustment/i)).toBeInTheDocument();
    expect(screen.getByText('Reduced to verified site hours')).toBeInTheDocument();
  });

  it('shows the lots-module-disabled notice instead of the no-lots notice when the lots module is off', () => {
    renderInRouter(
      <DocketEditNotices
        docket={baseDocket}
        queryResponse=""
        respondingToQuery={false}
        assignedLotCount={0}
        canEdit
        isOnline
        lotsModuleDisabled
        onQueryResponseChange={vi.fn()}
        onRespondToQuery={vi.fn()}
      />,
    );

    // The lots-module-off explanation replaces the generic "no lots assigned"
    // copy so the subbie knows the HC must enable lot access, not assign lots.
    expect(screen.getByText(/has not enabled assigned work \(lot\) access/i)).toBeInTheDocument();
    expect(screen.getByText(/plant-only dockets still work/i)).toBeInTheDocument();
    expect(screen.queryByText(/no lots have been assigned/i)).not.toBeInTheDocument();
  });

  it('shows an offline write guard and disables query response controls', () => {
    renderInRouter(
      <DocketEditNotices
        docket={{ ...baseDocket, status: 'queried', foremanNotes: 'Clarify trench hours' }}
        queryResponse="Ready to resend"
        respondingToQuery={false}
        assignedLotCount={1}
        canEdit
        isOnline={false}
        lotsModuleDisabled={false}
        onQueryResponseChange={vi.fn()}
        onRespondToQuery={vi.fn()}
      />,
    );

    expect(screen.getByText(/dockets need a connection/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/reconnect to reply/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /respond & resubmit/i })).toBeDisabled();
  });

  it('renders action bar states and reports submit clicks', () => {
    const onSubmit = vi.fn();

    const { rerender } = render(
      <DocketEditActionBar
        canEdit
        canSubmit
        docketStatus="rejected"
        submitting={false}
        totalCost={731.25}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByText('$731')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /resubmit for approval/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);

    rerender(
      <DocketEditActionBar
        canEdit={false}
        canSubmit={false}
        docketStatus="approved"
        submitting={false}
        totalCost={731.25}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('hides the dead Submit button on a queried docket and points to the resubmit flow', () => {
    const onSubmit = vi.fn();

    renderInRouter(
      <DocketEditActionBar
        canEdit
        canSubmit={false}
        docketStatus="queried"
        submitting={false}
        totalCost={731.25}
        onSubmit={onSubmit}
      />,
    );

    // The permanently-disabled "Submit for Approval" button must not render for
    // a queried docket; the real path is "Respond & Resubmit" in the notices.
    expect(screen.queryByRole('button', { name: /submit for approval/i })).not.toBeInTheDocument();
    expect(screen.getByText(/respond to the query above to resubmit/i)).toBeInTheDocument();
  });

  it('still shows an enabled Submit button on a valid draft docket', () => {
    const onSubmit = vi.fn();

    renderInRouter(
      <DocketEditActionBar
        canEdit
        canSubmit
        docketStatus="draft"
        submitting={false}
        totalCost={731.25}
        onSubmit={onSubmit}
      />,
    );

    const submitButton = screen.getByRole('button', { name: /submit for approval/i });
    expect(submitButton).toBeEnabled();
    fireEvent.click(submitButton);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
