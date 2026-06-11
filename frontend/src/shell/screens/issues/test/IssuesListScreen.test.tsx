/**
 * Tests for IssuesListScreen — open-first cards, filter chips, loading/error/
 * empty states (including the mock's "No open issues. Good." empty state), the
 * raise-issue flow opening the capture flow, and the absence of any Close
 * affordance (foreman never closes — research doc 14).
 *
 * MOCKS @/lib/useOfflineStatus (Dexie/IndexedDB) because ShellScreen mounts
 * SyncChip → useOfflineStatus. CaptureModal is mocked to a sentinel so we can
 * assert the raise-issue button opens it pre-set to NCR mode.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { NCR } from '@/pages/ncr/types';
import type { IssuesShellData } from '../useIssuesShellData';

vi.mock('@/lib/useOfflineStatus', () => ({
  useOfflineStatus: () => ({ isOnline: true, pendingSyncCount: 0, isSyncing: false }),
}));
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { id: 'user-me', fullName: 'Jay', roleInCompany: 'foreman' } }),
}));
vi.mock('@/hooks/useEffectiveProjectId', () => ({
  useEffectiveProjectId: () => ({ projectId: 'proj-1', isResolving: false }),
}));

// CaptureModal sentinel: renders only when open, exposing its defaultCaptureType.
vi.mock('@/components/foreman/CaptureModal', () => ({
  CaptureModal: ({
    isOpen,
    defaultCaptureType,
  }: {
    isOpen: boolean;
    defaultCaptureType?: string;
  }) => (isOpen ? <div data-testid="capture-modal" data-mode={defaultCaptureType} /> : null),
}));

let _data: IssuesShellData;
vi.mock('../issuesShellContext', () => ({
  useIssuesShellContext: () => _data,
}));

import { IssuesListScreen } from '../IssuesListScreen';
import { openIssueCount } from '../issuesShellState';

function makeNcr(over: Partial<NCR>): NCR {
  return {
    id: 'n1',
    ncrNumber: 'NCR-001',
    description: 'Cracked kerb at chainage 120',
    category: 'workmanship',
    severity: 'minor',
    status: 'open',
    qmApprovalRequired: false,
    qmApprovedAt: null,
    raisedBy: { fullName: 'Jay', email: 'jay@x.com' },
    responsibleUserId: null,
    createdAt: '2026-06-10T08:00:00Z',
    project: { name: 'Demo', projectNumber: 'P1' },
    ncrLots: [],
    ...over,
  } as NCR;
}

function makeData(ncrs: NCR[], over: Partial<IssuesShellData> = {}): IssuesShellData {
  return {
    projectId: 'proj-1',
    ncrs,
    loading: false,
    loadError: null,
    openCount: openIssueCount(ncrs),
    refetch: vi.fn(),
    ...over,
  };
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/m/issues']}>
      <Routes>
        <Route path="/m/issues" element={<IssuesListScreen />} />
        <Route path="/m/issues/:ncrId" element={<div>issue detail</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('IssuesListScreen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the mono NCR number, description and severity/status pills', () => {
    _data = makeData([makeNcr({ severity: 'major', status: 'open' })]);
    renderScreen();
    expect(screen.getByText('NCR-001')).toBeInTheDocument();
    expect(screen.getByText(/Cracked kerb at chainage 120/)).toBeInTheDocument();
    expect(screen.getByText('MAJOR')).toBeInTheDocument();
    expect(screen.getByText('OPEN')).toBeInTheDocument();
  });

  it('defaults to the Open filter and hides closed issues', () => {
    _data = makeData([
      makeNcr({ id: 'o', ncrNumber: 'NCR-001', status: 'open' }),
      makeNcr({ id: 'c', ncrNumber: 'NCR-002', status: 'closed' }),
    ]);
    renderScreen();
    expect(screen.getByText('NCR-001')).toBeInTheDocument();
    expect(screen.queryByText('NCR-002')).toBeNull();
  });

  it('switches to Closed and shows closed issues', () => {
    _data = makeData([
      makeNcr({ id: 'o', ncrNumber: 'NCR-001', status: 'open' }),
      makeNcr({ id: 'c', ncrNumber: 'NCR-002', status: 'closed' }),
    ]);
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /^Closed$/ }));
    expect(screen.getByText('NCR-002')).toBeInTheDocument();
    expect(screen.queryByText('NCR-001')).toBeNull();
  });

  it('shows a loading skeleton', () => {
    _data = makeData([], { loading: true });
    const { container } = renderScreen();
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('shows the load-error message', () => {
    _data = makeData([], { loadError: 'Failed to load NCRs' });
    renderScreen();
    expect(screen.getByText('Failed to load NCRs')).toBeInTheDocument();
  });

  it("shows the mock's empty state when there are no open issues", () => {
    _data = makeData([]);
    renderScreen();
    expect(screen.getByText(/No open issues\. Good\./i)).toBeInTheDocument();
    expect(screen.getByText(/Photo first — words later/i)).toBeInTheDocument();
  });

  it('opens the capture flow pre-set to NCR mode when "Raise an issue" is pressed', () => {
    _data = makeData([]);
    renderScreen();
    expect(screen.queryByTestId('capture-modal')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Raise an issue/i }));
    const modal = screen.getByTestId('capture-modal');
    expect(modal).toBeInTheDocument();
    expect(modal).toHaveAttribute('data-mode', 'ncr');
  });

  it('has NO close/verify/QM action affordance (foreman never closes)', () => {
    _data = makeData([makeNcr({ status: 'open' })]);
    renderScreen();
    // The "Closed" filter chip is legitimate; assert there is no NCR close /
    // verify / QM-review ACTION button (those belong to the desktop register).
    expect(
      screen.queryByRole('button', {
        name: /close (issue|ncr)|verify|qm review|concession/i,
      }),
    ).toBeNull();
  });
});
