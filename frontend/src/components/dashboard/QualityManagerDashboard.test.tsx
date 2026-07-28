// M8 (deep review 2026-07-28) — `DashboardPage` returns early for
// `quality_manager`, and the only link to `/dashboard/needs-attention` lived in a
// widget mounted solely on the DEFAULT dashboard. So the QM — the one role that
// reliably produces a non-empty "Needs you" group — had no nav item, link or
// button that reached the screen built for them.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/test/renderWithProviders';

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: apiFetchMock };
});

vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  useAuth: () => ({ user: { id: 'u1', roleInCompany: 'quality_manager' } }),
}));

import { QualityManagerDashboard } from './QualityManagerDashboard';

/** A dashboard with nothing outstanding — the case the entry point must survive. */
const EMPTY_QM_PAYLOAD = {
  lotConformance: { totalLots: 0, conformingLots: 0, nonConformingLots: 0, rate: 0 },
  ncrsByCategory: { major: 0, minor: 0, observation: 0, total: 0 },
  openNCRs: [],
  pendingVerifications: { count: 0, items: [] },
  holdPointMetrics: { totalReleased: 0, totalPending: 0, releaseRate: 0, avgTimeToRelease: 0 },
  itpTrends: { completedThisWeek: 0, completedLastWeek: 0, trend: 'stable', completionRate: 0 },
  auditReadiness: { score: 100, status: 'ready', issues: [] },
  project: { id: 'p1', name: 'Cudgegong Rd Stage 2', projectNumber: 'CR-2' },
  projects: [],
};

beforeEach(() => {
  apiFetchMock.mockReset();
});

describe('QualityManagerDashboard Needs Attention reachability', () => {
  it('links to /dashboard/needs-attention', async () => {
    apiFetchMock.mockResolvedValue(EMPTY_QM_PAYLOAD);

    renderWithProviders(<QualityManagerDashboard />);

    const link = await screen.findByRole('link', { name: /needs attention/i });
    expect(link).toHaveAttribute('href', '/dashboard/needs-attention');
  });

  it('keeps the link visible when nothing is outstanding', async () => {
    // The default-dashboard widget hid itself at total === 0 — exactly the state
    // the A4R-B4 widening was built to serve. An empty destination is fine;
    // an invisible one is not.
    apiFetchMock.mockResolvedValue(EMPTY_QM_PAYLOAD);

    renderWithProviders(<QualityManagerDashboard />);

    expect(await screen.findByRole('link', { name: /needs attention/i })).toBeInTheDocument();
  });
});
