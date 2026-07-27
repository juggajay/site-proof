import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LotHeader, type LotHeaderProps } from './LotHeader';
import type { Lot } from '../types';
import type { EvidenceReadinessItem, LotEvidenceReadiness } from '@/types/evidenceReadiness';

// Mock framer-motion to keep tests synchronous (BottomSheet uses AnimatePresence)
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...rest }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...rest}>{children}</div>
    ),
  },
  useMotionValue: () => ({ get: () => 0 }),
  useTransform: () => ({ get: () => 1 }),
  useDragControls: () => ({ start: vi.fn() }),
  useReducedMotion: () => false,
  animate: vi.fn(),
}));

// Mobile/desktop toggle — default to desktop (isMobile = false)
let mockIsMobile = false;
vi.mock('@/hooks/useMediaQuery', () => ({
  useIsMobile: () => mockIsMobile,
  useMediaQuery: () => false,
}));

// The desktop action row hosts the Ask-Clancy button, whose gate reads auth + AI
// status; stub those so it renders without an AuthProvider.
vi.mock('@/hooks/useAiStatus', () => ({ useAiStatus: () => ({ aiConfigured: true }) }));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  useAuth: () => ({ user: { roleInCompany: 'owner' } }),
}));

afterEach(() => {
  cleanup();
  mockIsMobile = false;
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

/** Readiness payload carrying only the conformance items a test cares about. */
function readinessWith(items: EvidenceReadinessItem[]): LotEvidenceReadiness {
  return {
    lotId: 'lot-1',
    lotNumber: 'LOT-001',
    status: 'in_progress',
    conformStatus: {
      canConform: false,
      blockingReasons: [],
      prerequisites: {
        itpAssigned: true,
        itpCompleted: false,
        itpCompletedCount: 1,
        itpTotalCount: 4,
        testRequired: false,
        hasPassingTest: false,
        noOpenNcrs: true,
        openNcrs: [],
      },
    },
    conformance: {
      state: 'blocked',
      blockers: items.filter((item) => item.severity === 'blocker'),
      warnings: items.filter((item) => item.severity === 'warning'),
      support: items.filter((item) => item.severity === 'support'),
    },
    claim: { state: 'not_conformed', blockers: [], warnings: [], support: [] },
    summary: { blockerCount: 0, warningCount: 0, supportCount: 0, actionBlockerCount: 0 },
  };
}

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
    onOverrideStatus: vi.fn(),
    onAddSubcontractor: vi.fn(),
    onEditAssignment: vi.fn(),
    onRemoveAssignment: vi.fn(),
    ...overrides,
  };
  return render(<LotHeader {...props} />);
}

// ── Desktop permission tests (unchanged behaviour) ──────────────────────────

describe('LotHeader lot-configuration permissions (desktop)', () => {
  it('hides Edit Lot and Add-subcontractor for a foreman (canManageLot=false)', () => {
    renderHeader({ canManageLot: false });

    expect(screen.queryByRole('button', { name: 'Edit Lot' })).not.toBeInTheDocument();
    // The retired legacy "Assign Subcontractor" header button must never appear.
    expect(screen.queryByRole('button', { name: /Assign Subcontractor/i })).not.toBeInTheDocument();
    // Modern subcontractor management (the Add button in the assignments section) is gated too.
    expect(screen.queryByRole('button', { name: 'Add' })).not.toBeInTheDocument();

    // Field/non-configuration controls stay available to every non-viewer,
    // now behind the overflow.
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    expect(screen.getByRole('button', { name: 'Copy Link' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Print' })).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('shows Edit Lot and Add-subcontractor for a manager (canManageLot=true)', () => {
    renderHeader({ canManageLot: true });

    expect(screen.getByRole('button', { name: 'Edit Lot' })).toBeInTheDocument();
    // No legacy assign button; subcontractors are managed via the assignments section.
    expect(screen.queryByRole('button', { name: /Assign Subcontractor/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });

  it('can manage subcontractors without showing Edit Lot', () => {
    renderHeader({ canManageLot: true, canEditLot: false });

    expect(screen.queryByRole('button', { name: 'Edit Lot' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });
});

describe('LotHeader desktop layout', () => {
  it('renders the action cluster with flex-wrap and desktop layout classes', () => {
    renderHeader({ canManageLot: true });

    // More button sits in the relative popover anchor inside the action cluster.
    const actionCluster = screen.getByRole('button', { name: 'More actions' }).parentElement
      ?.parentElement;
    // The action buttons wrap onto multiple lines instead of overflowing.
    expect(actionCluster).toHaveClass('flex-wrap');

    const headerRow = actionCluster?.parentElement;
    // Title block and actions stack vertically on mobile, side-by-side on >= sm.
    expect(headerRow).toHaveClass('flex-col');
    expect(headerRow).toHaveClass('sm:flex-row');
  });
});

// ── Readiness primary action (A4 spec §7) ───────────────────────────────────

describe('LotHeader readiness primary action', () => {
  const blocker: EvidenceReadinessItem = {
    code: 'unreleased_hold_points',
    severity: 'blocker',
    area: 'hold_point',
    title: 'Hold points not released',
    detail: '2 outstanding',
    blocksAction: true,
    actionLabel: 'Release hold point',
    actionHref: '?tab=itp',
  };
  const warning: EvidenceReadinessItem = {
    code: 'a_low_photo_evidence',
    severity: 'warning',
    area: 'document',
    title: 'Thin photo evidence',
    detail: '1 photo',
    blocksAction: false,
    actionLabel: 'Add photos',
    actionHref: '?tab=documents',
  };

  it('promotes the blocker over the warning even when the warning sorts first by code', () => {
    const onReadinessAction = vi.fn();
    renderHeader({
      canManageLot: true,
      readiness: readinessWith([warning, blocker]),
      onReadinessAction,
    });

    const primary = screen.getByRole('button', { name: 'Release hold point' });
    expect(primary).toHaveClass('bg-primary');
    expect(screen.queryByRole('button', { name: 'Add photos' })).not.toBeInTheDocument();

    fireEvent.click(primary);
    expect(onReadinessAction).toHaveBeenCalledWith('itp', 'unreleased_hold_points');
  });

  it('demotes Edit Lot, Copy Link, Print and Override into the overflow when a primary exists', () => {
    renderHeader({
      canManageLot: true,
      canConformLots: true,
      readiness: readinessWith([blocker]),
      onReadinessAction: vi.fn(),
    });

    expect(screen.queryByRole('button', { name: 'Edit Lot' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy Link' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    expect(screen.getByRole('button', { name: 'Edit Lot' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy Link' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Print' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Override Workflow Status' })).toBeInTheDocument();
  });

  it('keeps the permission-gated Override out of the overflow for a disallowed role', () => {
    renderHeader({
      canManageLot: true,
      canConformLots: false,
      readiness: readinessWith([blocker]),
      onReadinessAction: vi.fn(),
    });

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    expect(
      screen.queryByRole('button', { name: 'Override Workflow Status' }),
    ).not.toBeInTheDocument();
  });

  it('renders no solid button and falls back to outline Edit Lot when nothing is actionable', () => {
    // A support item with no actionLabel is not an action — the slot stays honest.
    renderHeader({
      canManageLot: true,
      readiness: readinessWith([
        {
          code: 'photos',
          severity: 'support',
          area: 'document',
          title: 'Photos attached',
          detail: '12 photos',
          blocksAction: false,
        },
      ]),
      onReadinessAction: vi.fn(),
    });

    const editLot = screen.getByRole('button', { name: 'Edit Lot' });
    expect(editLot).not.toHaveClass('bg-primary');
    expect(document.querySelector('.bg-primary')).toBeNull();
  });

  it('renders no primary at all when the fallback is not permitted either', () => {
    renderHeader({ canManageLot: false, readiness: readinessWith([]) });

    expect(screen.queryByRole('button', { name: 'Edit Lot' })).not.toBeInTheDocument();
    expect(document.querySelector('.bg-primary')).toBeNull();
    expect(screen.getByRole('button', { name: 'More actions' })).toBeInTheDocument();
  });

  it('uses the readiness action as the mobile primary and pushes Edit Lot into the sheet', () => {
    mockIsMobile = true;
    renderHeader({
      canManageLot: true,
      readiness: readinessWith([blocker]),
      onReadinessAction: vi.fn(),
    });

    expect(screen.getByRole('button', { name: 'Release hold point' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Lot' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    expect(screen.getByRole('button', { name: 'Edit Lot' })).toBeInTheDocument();
  });
});

// ── Mobile layout tests ─────────────────────────────────────────────────────

describe('LotHeader mobile overflow menu', () => {
  it('renders More button and hides individual action buttons on mobile', () => {
    mockIsMobile = true;
    renderHeader({ canManageLot: true, canConformLots: true });

    // More button must be visible and have correct aria-label
    expect(screen.getByRole('button', { name: 'More actions' })).toBeInTheDocument();

    // Primary Edit Lot button visible since canManageLot=true
    expect(screen.getByRole('button', { name: 'Edit Lot' })).toBeInTheDocument();

    // Copy Link / Print / Override should NOT be inline on mobile
    expect(screen.queryByRole('button', { name: 'Copy Link' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Print' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Override Workflow Status/i }),
    ).not.toBeInTheDocument();
  });

  it('status badge renders alongside the lot title on mobile', () => {
    mockIsMobile = true;
    renderHeader();

    // Status badge is rendered; its position is validated by the title row wrapper
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    const heading = screen.getByRole('heading', { name: 'LOT-001' });
    // Badge and heading share a flex wrapper (same parent)
    expect(heading.parentElement).toContainElement(screen.getByText('In Progress'));
  });

  it('opens BottomSheet when More button is clicked and lists all allowed actions', () => {
    mockIsMobile = true;
    renderHeader({ canManageLot: true, canConformLots: true });

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));

    // Sheet renders its action rows (no legacy Assign Subcontractor row).
    expect(screen.getByText('Copy Link')).toBeInTheDocument();
    expect(screen.getByText('Print')).toBeInTheDocument();
    expect(screen.queryByText('Assign Subcontractor')).not.toBeInTheDocument();
    expect(screen.getByText('Override Workflow Status')).toBeInTheDocument();
  });

  it('fires onCopyLink handler when Copy Link is tapped in the sheet', () => {
    mockIsMobile = true;
    const onCopyLink = vi.fn();
    renderHeader({ canManageLot: false, onCopyLink });

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByText('Copy Link'));
    expect(onCopyLink).toHaveBeenCalledTimes(1);
  });

  it('fires onPrint handler when Print is tapped in the sheet', () => {
    mockIsMobile = true;
    const onPrint = vi.fn();
    renderHeader({ onPrint });

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByText('Print'));
    expect(onPrint).toHaveBeenCalledTimes(1);
  });

  it('fires onOverrideStatus handler from the sheet', () => {
    mockIsMobile = true;
    const onOverrideStatus = vi.fn();
    renderHeader({ canConformLots: true, onOverrideStatus });

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByText('Override Workflow Status'));
    expect(onOverrideStatus).toHaveBeenCalledTimes(1);
  });

  it('hides Assign Subcontractor and Override Status from sheet when permissions are absent', () => {
    mockIsMobile = true;
    renderHeader({ canManageLot: false, canConformLots: false });

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));

    // Copy Link + Print present
    expect(screen.getByText('Copy Link')).toBeInTheDocument();
    expect(screen.getByText('Print')).toBeInTheDocument();
    // Management actions absent
    expect(screen.queryByText('Assign Subcontractor')).not.toBeInTheDocument();
    expect(screen.queryByText('Override Workflow Status')).not.toBeInTheDocument();
  });

  it('hides Assign Subcontractor for claimed lots on mobile', () => {
    mockIsMobile = true;
    renderHeader({ canManageLot: true, lot: { ...baseLot, status: 'claimed' } });

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));

    expect(screen.queryByText('Assign Subcontractor')).not.toBeInTheDocument();
  });

  it('fires onEdit when primary Edit Lot button is clicked directly on mobile', () => {
    mockIsMobile = true;
    const onEdit = vi.fn();
    renderHeader({ canManageLot: true, onEdit });

    fireEvent.click(screen.getByRole('button', { name: 'Edit Lot' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('shows the modern Add-subcontractor control when mobile edit access is absent', () => {
    mockIsMobile = true;
    renderHeader({ canManageLot: true, canEditLot: false });

    expect(screen.queryByRole('button', { name: 'Edit Lot' })).not.toBeInTheDocument();
    // The legacy Assign Subcontractor sheet action is retired; managing
    // subcontractors happens through the assignments section's Add button.
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    expect(screen.queryByText('Assign Subcontractor')).not.toBeInTheDocument();
  });

  it('hides Edit Lot primary button when canManageLot=false on mobile', () => {
    mockIsMobile = true;
    renderHeader({ canManageLot: false });

    expect(screen.queryByRole('button', { name: 'Edit Lot' })).not.toBeInTheDocument();
    // More button is still present
    expect(screen.getByRole('button', { name: 'More actions' })).toBeInTheDocument();
  });
});
