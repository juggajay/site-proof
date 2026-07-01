/**
 * Tests for QueryFormScreen + RejectFormScreen — both require a non-empty reason
 * before the action can fire, send the correct action type, and disable offline
 * with an honest note.
 *
 * MOCKS @/lib/useOfflineStatus (ShellScreen → SyncChip) — toggled per test.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { Docket } from '@/pages/dockets/docketApprovalsData';
import type { DocketsShellData } from '../useDocketsShellData';

let _online = true;
vi.mock('@/lib/useOfflineStatus', () => ({
  useOfflineStatus: () => ({ isOnline: _online, pendingSyncCount: 0, isSyncing: false }),
}));
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { fullName: 'Jay', roleInCompany: 'foreman' } }),
}));
vi.mock('@/hooks/useEffectiveProjectId', () => ({
  useEffectiveProjectId: () => ({ projectId: 'proj-1', isResolving: false }),
}));

let _data: DocketsShellData;
vi.mock('../docketsShellContext', () => ({
  useDocketsShellContext: () => _data,
}));

const runAction = vi.fn(() => Promise.resolve(true));
vi.mock('../useDocketAction', () => ({
  useDocketAction: () => ({ submitting: false, runAction }),
}));

import { QueryFormScreen } from '../QueryFormScreen';
import { RejectFormScreen } from '../RejectFormScreen';

function makeDocket(over: Partial<Docket> = {}): Docket {
  return {
    id: 'd1',
    docketNumber: 'DKT-0142',
    subcontractor: 'CivilWorx Pty Ltd',
    subcontractorId: 's1',
    date: '2026-06-10',
    status: 'pending_approval',
    notes: null,
    labourHours: 48,
    plantHours: 16,
    totalLabourSubmitted: 48,
    totalLabourApproved: 0,
    totalPlantSubmitted: 16,
    totalPlantApproved: 0,
    submittedAt: '2026-06-10T08:00:00Z',
    approvedAt: null,
    foremanNotes: null,
    ...over,
  };
}

function setData(over: Partial<DocketsShellData> = {}) {
  _data = {
    projectId: 'proj-1',
    dockets: [makeDocket()],
    projectName: 'Demo Project',
    loading: false,
    loadError: null,
    pendingCount: 1,
    refetch: vi.fn(),
    ...over,
  };
}

function renderQuery() {
  return render(
    <MemoryRouter initialEntries={['/m/dockets/d1/query']}>
      <Routes>
        <Route path="/m/dockets" element={<div>list</div>} />
        <Route path="/m/dockets/:docketId/query" element={<QueryFormScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderReject() {
  return render(
    <MemoryRouter initialEntries={['/m/dockets/d1/reject']}>
      <Routes>
        <Route path="/m/dockets" element={<div>list</div>} />
        <Route path="/m/dockets/:docketId/reject" element={<RejectFormScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  _online = true;
  setData();
});

describe('QueryFormScreen', () => {
  it('shows loading instead of a false form while a direct route resolves', () => {
    setData({ dockets: [], loading: true, pendingCount: 0 });
    renderQuery();

    expect(screen.getAllByText(/Loading docket/i).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText(/What needs clarifying/i)).not.toBeInTheDocument();
  });

  it('disables Send until a reason is entered, then fires the query mutation', async () => {
    renderQuery();
    const send = screen.getByRole('button', { name: 'Send query' });
    expect(send).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/What needs clarifying/i), {
      target: { value: 'Which lot was the formwork on?' },
    });
    expect(send).toBeEnabled();

    fireEvent.click(send);
    await waitFor(() =>
      expect(runAction).toHaveBeenCalledWith(
        expect.objectContaining({
          docketId: 'd1',
          actionType: 'query',
          actionNotes: 'Which lot was the formwork on?',
        }),
      ),
    );
  });

  it('stays disabled offline with an honest note', () => {
    _online = false;
    renderQuery();
    fireEvent.change(screen.getByLabelText(/What needs clarifying/i), {
      target: { value: 'A question' },
    });
    expect(screen.getByRole('button', { name: 'Send query' })).toBeDisabled();
    expect(screen.getByText(/Queries need signal/i)).toBeInTheDocument();
  });

  it('does not allow querying a docket that is no longer pending approval', () => {
    setData({ dockets: [makeDocket({ status: 'approved' })], pendingCount: 0 });
    renderQuery();

    expect(screen.getByText(/This docket is no longer pending approval/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/What needs clarifying/i)).not.toBeInTheDocument();
  });
});

describe('RejectFormScreen', () => {
  it('shows not found when a direct route points at a missing docket', () => {
    setData({ dockets: [], loading: false, pendingCount: 0 });
    renderReject();

    expect(screen.getByText(/This docket isn’t here anymore/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Reason for rejection/i)).not.toBeInTheDocument();
  });

  it('disables Reject until a reason is entered, then fires the reject mutation', async () => {
    renderReject();
    const reject = screen.getByRole('button', { name: 'Reject docket' });
    expect(reject).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Reason for rejection/i), {
      target: { value: 'Hours do not match the daysheet.' },
    });
    expect(reject).toBeEnabled();

    fireEvent.click(reject);
    await waitFor(() =>
      expect(runAction).toHaveBeenCalledWith(
        expect.objectContaining({
          docketId: 'd1',
          actionType: 'reject',
          actionNotes: 'Hours do not match the daysheet.',
        }),
      ),
    );
  });

  it('stays disabled offline with an honest note', () => {
    _online = false;
    renderReject();
    fireEvent.change(screen.getByLabelText(/Reason for rejection/i), {
      target: { value: 'A reason' },
    });
    expect(screen.getByRole('button', { name: 'Reject docket' })).toBeDisabled();
    expect(screen.getByText(/Rejections need signal/i)).toBeInTheDocument();
  });

  it('does not allow rejecting a docket that is no longer pending approval', () => {
    setData({ dockets: [makeDocket({ status: 'queried' })], pendingCount: 0 });
    renderReject();

    expect(screen.getByText(/This docket is no longer pending approval/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Reason for rejection/i)).not.toBeInTheDocument();
  });
});
