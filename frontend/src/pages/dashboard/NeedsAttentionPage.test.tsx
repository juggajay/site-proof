import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, renderWithProviders, screen, within } from '@/test/renderWithProviders';

// Hoisted so the vi.mock factories (which run before the imports below) can
// close over them. The page reads `user` and `actualRole` from useAuth.
const authState = vi.hoisted(() => ({
  user: null as Record<string, unknown> | null,
  actualRole: null as string | null,
}));
const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>();
  return {
    ...actual,
    useAuth: () => ({ user: authState.user, actualRole: authState.actualRole }),
  };
});

// Keep ApiError/apiUrl real for the rest of the import tree; only stub the fetcher.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: apiFetchMock };
});

import { NeedsAttentionPage } from './NeedsAttentionPage';
import type { ActionAssignment } from '@/hooks/useDashboardStats';

const HOUR = 60 * 60 * 1000;

/** waiting_on_me + needsAction — the only group that earns a primary button. */
const NEEDS_YOU_HOLD_POINT: ActionAssignment = {
  subjectType: 'hold_point',
  subjectId: 'hp-1',
  title: 'Subgrade proof roll',
  status: 'waiting_on_me',
  needsAction: true,
  isOverdue: false,
  assignee: { kind: 'role', role: 'quality_manager' },
  severity: 'warning',
  reasonCode: 'unreleased_hold_points',
  primaryAction: {
    label: 'Release hold point',
    // Mirrors what the backend adapter emits, which must be the route App.tsx
    // registers (`/hold-points`) — the unhyphenated form 404'd.
    href: '/projects/p1/hold-points',
    executableByRoles: ['quality_manager'],
  },
};

/**
 * THE invariant fixture (spec §4.2 rule 3, P1.5): overdue AND waiting on someone
 * else. It must land in "Waiting on others" with an overdue CHIP — never in a
 * synthetic "Overdue" group, and never promoted into "Needs you".
 */
const OVERDUE_WAITING_ON_OTHERS_NCR: ActionAssignment = {
  subjectType: 'ncr',
  subjectId: 'ncr-1',
  title: 'NCR NCR-0037',
  status: 'waiting_on_others',
  needsAction: false,
  isOverdue: true,
  dueAt: new Date(Date.now() - 3 * 24 * HOUR - HOUR).toISOString(),
  assignee: { kind: 'company', id: 'sub-9' },
  severity: 'blocker',
  reasonCode: 'ncr_overdue',
  primaryAction: {
    label: 'Review NCR',
    href: '/projects/p2/ncr?ncr=ncr-1',
    executableByRoles: ['quality_manager'],
  },
};

interface MockOptions {
  items?: ActionAssignment[];
  totalCount?: number;
}

function mockStatsApi({ items = [], totalCount = items.length }: MockOptions = {}) {
  apiFetchMock.mockImplementation((path: string) => {
    if (path.startsWith('/api/dashboard/stats')) {
      return Promise.resolve({
        totalProjects: 2,
        activeProjects: 2,
        totalLots: 0,
        openHoldPoints: 0,
        openNCRs: 0,
        attentionItems: { overdueNCRs: [], staleHoldPoints: [], total: 0 },
        recentActivities: [],
        actionAssignments: { items, totalCount },
      });
    }
    if (path === '/api/projects') {
      return Promise.resolve({
        projects: [
          { id: 'p1', name: 'Cudgegong Rd Stage 2' },
          { id: 'p2', name: 'Hunter Expressway' },
        ],
      });
    }
    return Promise.reject(new Error(`Unhandled apiFetch path in test: ${path}`));
  });
}

function groupSection(name: string): HTMLElement {
  const section = screen.getByRole('heading', { name }).closest('section');
  if (!section) throw new Error(`No section for group "${name}"`);
  return section;
}

beforeEach(() => {
  authState.user = { id: 'u1', email: 'qm@example.com' };
  authState.actualRole = 'quality_manager';
  apiFetchMock.mockReset();
});

describe('NeedsAttentionPage', () => {
  it('partitions rows by ball in court, and only Needs you earns a primary action', async () => {
    mockStatsApi({ items: [NEEDS_YOU_HOLD_POINT, OVERDUE_WAITING_ON_OTHERS_NCR] });

    renderWithProviders(<NeedsAttentionPage />);

    expect(await screen.findByRole('heading', { name: 'Needs you' })).toBeInTheDocument();
    const needsYou = groupSection('Needs you');
    const waiting = groupSection('Waiting on others');

    // Each item appears exactly once, in exactly one group.
    expect(within(needsYou).getByText('Subgrade proof roll')).toBeInTheDocument();
    expect(within(waiting).queryByText('Subgrade proof roll')).not.toBeInTheDocument();
    expect(within(waiting).getByText('NCR NCR-0037')).toBeInTheDocument();
    expect(within(needsYou).queryByText('NCR NCR-0037')).not.toBeInTheDocument();

    // §5.1 render rule: the verb renders iff needsAction. The waiting row gets a
    // chevron, never a button the viewer's court cannot advance.
    expect(within(needsYou).getByText('Release hold point')).toBeInTheDocument();
    expect(within(waiting).queryByText('Review NCR')).not.toBeInTheDocument();

    // Second line is structured fields plus the reason, in plain English —
    // never the raw enum (L13), never prose.
    expect(within(needsYou).getByText('Hold Points Not Released')).toBeInTheDocument();
    expect(within(needsYou).queryByText('unreleased_hold_points')).not.toBeInTheDocument();
    expect(within(waiting).getByText('NCR Overdue')).toBeInTheDocument();
    expect(within(waiting).queryByText('ncr_overdue')).not.toBeInTheDocument();
    expect(within(needsYou).getByText(/Quality Manager \(you\)/)).toBeInTheDocument();
    expect(within(waiting).getByText(/Hunter Expressway/)).toBeInTheDocument();
  });

  it('keeps an overdue waiting_on_others item in Waiting on others, as a time chip not a group', async () => {
    mockStatsApi({ items: [OVERDUE_WAITING_ON_OTHERS_NCR] });

    renderWithProviders(<NeedsAttentionPage />);

    await screen.findByRole('heading', { name: 'Waiting on others' });
    const waiting = groupSection('Waiting on others');
    expect(within(waiting).getByText('NCR NCR-0037')).toBeInTheDocument();
    expect(within(waiting).getByText('3 days overdue')).toBeInTheDocument();

    // Overdue is never a group, and never promotes ownership into Needs you.
    expect(screen.queryByRole('heading', { name: 'Overdue' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Needs you' })).not.toBeInTheDocument();
  });

  // M8 — the banner said "the N most overdue of M", but the hold-point limb is
  // fetched `orderBy createdAt asc` and deliberately includes rows that are not
  // overdue at all. The cap is real; the ordering claim was not.
  it('states the honest count when the capped feed hides items, without claiming an overdue ranking', async () => {
    mockStatsApi({ items: [NEEDS_YOU_HOLD_POINT, OVERDUE_WAITING_ON_OTHERS_NCR], totalCount: 47 });

    renderWithProviders(<NeedsAttentionPage />);

    expect(await screen.findByText('Showing 2 of 47 items needing attention.')).toBeInTheDocument();
    expect(screen.queryByText(/most overdue/)).not.toBeInTheDocument();
  });

  it('says nothing more than one line when there is nothing to do', async () => {
    mockStatsApi({ items: [] });

    renderWithProviders(<NeedsAttentionPage />);

    expect(await screen.findByText('Nothing is waiting on you.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Needs you' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Waiting on others' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Filter by project' })).not.toBeInTheDocument();
  });

  it('filters the company-wide list by project without re-grouping it', async () => {
    mockStatsApi({ items: [NEEDS_YOU_HOLD_POINT, OVERDUE_WAITING_ON_OTHERS_NCR] });

    renderWithProviders(<NeedsAttentionPage />);

    expect(await screen.findByRole('button', { name: /All projects/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    fireEvent.click(screen.getByRole('button', { name: /Hunter Expressway/ }));

    // The other project's row leaves; the ball-in-court grouping is untouched.
    expect(screen.queryByText('Subgrade proof roll')).not.toBeInTheDocument();
    expect(screen.getByText('NCR NCR-0037')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Needs you' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Waiting on others' })).toBeInTheDocument();
  });
});
