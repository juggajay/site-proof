import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { NCR, UserRole } from '../types';
import { NCRTable } from './NCRTable';

// jsdom gives the scroll container a 0px viewport, so the real virtualizer
// renders no rows.
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 52,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        key: index,
        start: index * 52,
        end: (index + 1) * 52,
      })),
    measureElement: () => {},
    scrollToIndex: () => {},
  }),
}));

// Radix positions the overflow menu with floating-ui, which observes its
// anchor. jsdom ships no ResizeObserver.
beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

function makeNcr(overrides: Partial<NCR> = {}): NCR {
  return {
    id: 'ncr-1',
    ncrNumber: 'NCR-0001',
    description: 'Surface defect at lot boundary',
    category: 'general',
    severity: 'minor',
    status: 'open',
    qmApprovalRequired: false,
    qmApprovedAt: null,
    raisedBy: { fullName: 'Raiser', email: 'raiser@example.com' },
    createdAt: '2026-07-01T00:00:00Z',
    project: { id: 'project-1', name: 'Project', projectNumber: 'P-1' },
    ncrLots: [{ lot: { lotNumber: 'MC10-001', description: 'Lot' } }],
    ...overrides,
  };
}

const QUALITY_MANAGER: UserRole = {
  role: 'quality_manager',
  isQualityManager: true,
  canApproveNCRs: true,
};
const VIEWER: UserRole = { role: 'viewer', isQualityManager: false, canApproveNCRs: false };

function renderTable({
  ncrs = [makeNcr()],
  userRole = QUALITY_MANAGER,
  currentUserId = 'user-1',
  handlers = {},
}: {
  ncrs?: NCR[];
  userRole?: UserRole | null;
  currentUserId?: string | null;
  handlers?: Partial<Record<string, ReturnType<typeof vi.fn>>>;
} = {}) {
  const spies = {
    onCopyLink: vi.fn(),
    onAssign: vi.fn(),
    onRespond: vi.fn(),
    onReviewResponse: vi.fn(),
    onQmApprove: vi.fn(),
    onNotifyClient: vi.fn(),
    onRectify: vi.fn(),
    onRejectRectification: vi.fn(),
    onClose: vi.fn(),
    onConcession: vi.fn(),
    ...handlers,
  };

  render(
    <NCRTable
      ncrs={ncrs}
      userRole={userRole}
      currentUserId={currentUserId}
      actionLoading={false}
      copiedNcrId={null}
      highlightedNcrId={null}
      sortField=""
      sortDirection="asc"
      onSort={vi.fn()}
      {...spies}
    />,
  );
  return spies;
}

async function openRowMenu(
  user: ReturnType<typeof userEvent.setup>,
  ncrNumber = 'NCR-0001',
): Promise<HTMLElement> {
  await user.click(screen.getByRole('button', { name: `More actions for NCR ${ncrNumber}` }));
  return screen.getByRole('menu');
}

// The audit found the actions column clipped at the viewport edge ("Assign"
// rendering as "Assig"). One promoted action + an overflow menu fixes the width;
// these guard that nothing became unreachable and no gate loosened.
describe('NCRTable row actions', () => {
  it('promotes the status action and keeps register actions in the menu', async () => {
    const user = userEvent.setup();
    const spies = renderTable();

    expect(screen.getByRole('button', { name: 'Respond' })).toBeInTheDocument();

    const menu = await openRowMenu(user);
    for (const label of ['Assign', 'Copy link', 'Print NCR']) {
      expect(within(menu).getByRole('menuitem', { name: label })).toBeInTheDocument();
    }

    await user.click(within(menu).getByRole('menuitem', { name: 'Copy link' }));
    expect(spies.onCopyLink).toHaveBeenCalledWith('ncr-1', 'NCR-0001');
  });

  it('shows Reassign once the NCR has a responsible party', async () => {
    const user = userEvent.setup();
    const spies = renderTable({
      ncrs: [
        makeNcr({
          responsibleUser: { id: 'user-2', fullName: 'Sub Lead', email: 'sub@example.com' },
          responsibleUserId: 'user-2',
        }),
      ],
    });

    const menu = await openRowMenu(user);
    await user.click(within(menu).getByRole('menuitem', { name: 'Reassign' }));

    expect(spies.onAssign).toHaveBeenCalled();
  });

  // Role gating is unchanged — a viewer never sees an action it could not fire
  // before, wherever the control now lives.
  it('offers a viewer no assign or workflow action', async () => {
    const user = userEvent.setup();
    renderTable({ userRole: VIEWER });

    expect(screen.queryByRole('button', { name: 'Respond' })).not.toBeInTheDocument();

    const menu = await openRowMenu(user);
    expect(within(menu).queryByRole('menuitem', { name: 'Assign' })).not.toBeInTheDocument();
    expect(within(menu).queryByRole('menuitem', { name: 'Respond' })).not.toBeInTheDocument();
    // Copy link and print stay available to anyone who can read the register.
    expect(within(menu).getByRole('menuitem', { name: 'Copy link' })).toBeInTheDocument();
  });

  it('promotes QM Approve for a major NCR awaiting approval and disables close behind it', async () => {
    const user = userEvent.setup();
    renderTable({
      ncrs: [
        makeNcr({
          severity: 'major',
          status: 'verification',
          qmApprovalRequired: true,
          qmApprovedAt: null,
        }),
      ],
    });

    expect(screen.getByRole('button', { name: 'QM Approve' })).toBeInTheDocument();

    const menu = await openRowMenu(user);
    const close = within(menu).getByRole('menuitem', { name: 'Close' });
    expect(close).toHaveAttribute('aria-disabled', 'true');
    expect(close).toHaveAttribute('title', 'Requires QM approval first');
    expect(within(menu).getByRole('menuitem', { name: 'Concession' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('promotes Close once a verification-stage NCR needs no approval', async () => {
    const user = userEvent.setup();
    const spies = renderTable({ ncrs: [makeNcr({ status: 'verification' })] });

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(spies.onClose).toHaveBeenCalled();

    const menu = await openRowMenu(user);
    expect(within(menu).getByRole('menuitem', { name: 'Concession' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Reject' })).toBeInTheDocument();
  });

  it('renders the client-notified fact with the status, not in the actions column', () => {
    renderTable({
      ncrs: [
        makeNcr({
          severity: 'major',
          clientNotificationRequired: true,
          clientNotifiedAt: '2026-07-02T00:00:00Z',
        }),
      ],
    });

    const statusCell = screen.getByText('Open').closest('td');
    expect(statusCell).not.toBeNull();
    expect(within(statusCell as HTMLElement).getByText(/Client Notified/)).toBeInTheDocument();
  });
});
