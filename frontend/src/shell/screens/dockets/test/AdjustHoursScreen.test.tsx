/**
 * Tests for AdjustHoursScreen — the approve-with-adjustment shell form. Seeds the
 * fields from the submitted hours, fires the approve mutation with the adjusted
 * hours + reason, and disables offline with an honest note.
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

import { AdjustHoursScreen } from '../AdjustHoursScreen';

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

function renderScreen() {
  _data = {
    projectId: 'proj-1',
    dockets: [makeDocket()],
    projectName: 'Demo Project',
    loading: false,
    loadError: null,
    pendingCount: 1,
    refetch: vi.fn(),
  };
  return render(
    <MemoryRouter initialEntries={['/m/dockets/d1/adjust']}>
      <Routes>
        <Route path="/m/dockets" element={<div>list</div>} />
        <Route path="/m/dockets/:docketId/adjust" element={<AdjustHoursScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  _online = true;
});

describe('AdjustHoursScreen', () => {
  it('seeds the fields from the submitted hours', () => {
    renderScreen();
    expect(screen.getByLabelText(/Labour hours/i)).toHaveValue(48);
    expect(screen.getByLabelText(/Plant hours/i)).toHaveValue(16);
  });

  it('fires approve with adjusted hours + reason', async () => {
    renderScreen();
    fireEvent.change(screen.getByLabelText(/Labour hours/i), { target: { value: '40' } });
    fireEvent.change(screen.getByLabelText(/Adjustment reason/i), {
      target: { value: 'Rounded down' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Approve with adjusted hours/i }));
    await waitFor(() =>
      expect(runAction).toHaveBeenCalledWith(
        expect.objectContaining({
          docketId: 'd1',
          actionType: 'approve',
          adjustedLabourHours: 40,
          adjustedPlantHours: 16,
          adjustmentReason: 'Rounded down',
        }),
      ),
    );
  });

  it('disables submit offline with an honest note', () => {
    _online = false;
    renderScreen();
    expect(screen.getByRole('button', { name: /Approve with adjusted hours/i })).toBeDisabled();
    expect(screen.getByText(/Approvals need signal/i)).toBeInTheDocument();
  });
});
