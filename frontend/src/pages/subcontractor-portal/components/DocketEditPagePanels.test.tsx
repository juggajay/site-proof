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
      />,
    );

    expect(screen.getByRole('heading', { name: 'Docket DKT-001' })).toBeInTheDocument();
    expect(screen.getByText('Project: North Upgrade')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('renders the error fallback with the portal link', () => {
    renderInRouter(<DocketEditError message="Docket not found" />);

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
        onQueryResponseChange={onQueryResponseChange}
        onRespondToQuery={onRespondToQuery}
      />,
    );

    expect(screen.getByText(/rejection reason/i)).toBeInTheDocument();
    expect(screen.getByText('Missing docket photo')).toBeInTheDocument();
    expect(screen.queryByText(/no lots have been assigned/i)).not.toBeInTheDocument();
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
});
