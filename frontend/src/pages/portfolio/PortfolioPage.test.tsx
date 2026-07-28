import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, within } from '@/test/renderWithProviders';

const apiFetchMock = vi.hoisted(() => vi.fn());

// Keep ApiError/apiUrl real for the rest of the import tree; only stub the fetcher.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: apiFetchMock };
});

import { PortfolioPage } from './PortfolioPage';
import type { Project, ProjectAtRisk } from './portfolioPageData';

const DAY_MS = 24 * 60 * 60 * 1000;

/** ISO for a target-completion date N days from now. */
function inDays(days: number): string {
  return new Date(Date.now() + days * DAY_MS).toISOString();
}

function mockPortfolioApi({
  projects,
  projectsAtRisk,
}: {
  projects: Project[];
  projectsAtRisk: ProjectAtRisk[];
}) {
  apiFetchMock.mockImplementation((path: string) => {
    if (path === '/api/projects') return Promise.resolve({ projects });
    if (path === '/api/dashboard/portfolio-cashflow')
      return Promise.resolve({ totalClaimed: 0, totalCertified: 0, totalPaid: 0, outstanding: 0 });
    if (path === '/api/dashboard/portfolio-ncrs') return Promise.resolve({ ncrs: [] });
    if (path === '/api/dashboard/portfolio-risks') return Promise.resolve({ projectsAtRisk });
    return Promise.reject(new Error(`Unhandled apiFetch path in test: ${path}`));
  });
}

/**
 * The "At Risk" figure from the Timeline Health panel. Matched on the label
 * PREFIX deliberately, so this reads the same number before and after the label
 * stops claiming "(due within 30 days)" — the failure it reports is the number,
 * never the copy.
 */
function atRiskMetric(): string {
  const row = screen.getByText(/^At Risk\b/).closest('div')?.parentElement;
  if (!row) throw new Error('No At Risk row');
  return within(row).getByText(/^\d+$/).textContent ?? '';
}

/** The count chip on the "Projects at Risk" panel header. */
function riskPanelCount(): string {
  const header = screen.getByRole('heading', { name: 'Projects at Risk' }).parentElement;
  if (!header) throw new Error('No Projects at Risk header');
  return within(header).getByText(/^\d+$/).textContent ?? '';
}

beforeEach(() => {
  apiFetchMock.mockReset();
});

/**
 * M2 (fable deep review 2026-07-28) — the headline "At Risk" number was computed
 * in the browser from `targetCompletion` alone (`daysUntilTarget < 30 && > 0`)
 * while the "Projects at Risk" panel immediately below it lists a project with
 * ANY backend risk indicator (timeline, open major NCRs, overdue NCRs, stale
 * hold points). Two definitions of one fact on one screen, plus a 30.0-day
 * boundary mismatch (backend `ceil(30.0) <= 30` lists, frontend `30.0 < 30`
 * excludes).
 *
 * Decision: the backend panel definition wins, so the count IS the delivered
 * list's length. These two cases pin both directions of the old disagreement.
 */
describe('PortfolioPage "At Risk" agrees with the Projects at Risk panel', () => {
  it('counts a project the panel lists for a non-timeline reason (6 months out, 3 major NCRs)', async () => {
    const project: Project = {
      id: 'project-1',
      name: 'Eastern Bypass',
      projectNumber: 'EB-001',
      status: 'active',
      contractValue: 1200000,
      // Half a year out: no timeline risk at all under the old client formula.
      targetCompletion: inDays(180),
    };

    mockPortfolioApi({
      projects: [project],
      projectsAtRisk: [
        {
          id: 'project-1',
          name: 'Eastern Bypass',
          projectNumber: 'EB-001',
          riskLevel: 'critical',
          link: '/projects/project-1/ncr',
          riskIndicators: [
            {
              type: 'ncr',
              severity: 'critical',
              message: '3 open major NCRs',
              explanation: 'Major non-conformances require attention.',
            },
          ],
        },
      ],
    });

    renderWithProviders(<PortfolioPage />);

    // The panel lists it...
    expect(await screen.findByRole('heading', { name: 'Projects at Risk' })).toBeInTheDocument();
    expect(riskPanelCount()).toBe('1');
    // ...so the headline must say 1, not 0. The old client formula said 0.
    expect(atRiskMetric()).toBe('1');
  });

  it('does not count a due-soon project the panel does not list', async () => {
    // The reverse drift: a project 20 days from target that the risks endpoint
    // did NOT return (e.g. it is not in the caller's commercial-role set, or it
    // is no longer `active` server-side). The old client formula counted it as
    // "At Risk: 1" above an empty panel.
    const project: Project = {
      id: 'project-2',
      name: 'Western Drainage',
      projectNumber: 'WD-002',
      status: 'active',
      contractValue: 850000,
      targetCompletion: inDays(20),
    };

    mockPortfolioApi({ projects: [project], projectsAtRisk: [] });

    renderWithProviders(<PortfolioPage />);

    expect(await screen.findByText('Timeline Health')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Projects at Risk' })).not.toBeInTheDocument();
    expect(atRiskMetric()).toBe('0');
  });

  it('does not label the metric with the retired "due within 30 days" definition', async () => {
    mockPortfolioApi({ projects: [], projectsAtRisk: [] });

    renderWithProviders(<PortfolioPage />);

    expect(await screen.findByText('Timeline Health')).toBeInTheDocument();
    expect(screen.queryByText(/due within 30 days/i)).not.toBeInTheDocument();
  });
});
