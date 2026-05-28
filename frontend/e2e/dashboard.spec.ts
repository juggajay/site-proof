import { test, expect, type Page } from '@playwright/test';
import { E2E_ADMIN_USER, E2E_PROJECT_ID, mockAuthenticatedUserState } from './helpers';

const defaultProject = {
  id: E2E_PROJECT_ID,
  name: 'E2E Highway Upgrade',
  projectNumber: 'E2E-001',
  status: 'active',
};

type PendingInvitation = {
  id: string;
  companyName: string;
  projectName: string;
  headContractorName: string;
  primaryContactEmail: string;
  primaryContactName: string;
  status: string;
};

async function mockDashboardShell(
  page: Page,
  user = E2E_ADMIN_USER,
  pendingInvitation: PendingInvitation | null = null,
) {
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user }),
    });
  });

  await page.route('**/api/notifications', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ notifications: [], unreadCount: 0 }),
    });
  });

  await page.route('**/api/projects', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ projects: [defaultProject] }),
    });
  });

  await page.route('**/api/subcontractors/my-pending-invitation', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ invitation: pendingInvitation }),
    });
  });

  await mockAuthenticatedUserState(page, user);
}

async function mockDefaultDashboardApi(
  page: Page,
  options: { failStats?: boolean; failStatsUntil?: number } = {},
) {
  let statsRequestCount = 0;

  await mockDashboardShell(
    page,
    {
      ...E2E_ADMIN_USER,
      name: 'E2E Admin',
      fullName: 'E2E Admin',
      roleInCompany: 'admin',
      companyName: 'E2E Civil Pty Ltd',
    },
    null,
  );

  await page.route('**/api/dashboard/stats**', async (route) => {
    statsRequestCount += 1;
    if (options.failStats || statsRequestCount <= (options.failStatsUntil ?? 0)) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Dashboard stats unavailable' }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        totalProjects: 3,
        activeProjects: 2,
        totalLots: 14,
        lotStatusCounts: {
          not_started: 2,
          in_progress: 3,
          awaiting_test: 1,
          hold_point: 2,
          ncr_raised: 1,
          completed: 0,
          conformed: 4,
          claimed: 1,
        },
        openHoldPoints: 4,
        openNCRs: 2,
        attentionItems: {
          total: 2,
          overdueNCRs: [
            {
              id: 'ncr-attention-1',
              type: 'ncr',
              title: 'NCR-9001',
              description: 'Overdue major NCR response',
              status: 'open',
              daysOverdue: 5,
              project: defaultProject,
              link: 'https://external.invalid/ncr-9001',
            },
          ],
          staleHoldPoints: [
            {
              id: 'hp-attention-1',
              type: 'holdpoint',
              title: 'HP-42',
              description: 'Awaiting superintendent release',
              status: 'requested',
              daysStale: 3,
              project: defaultProject,
              link: `/projects/${E2E_PROJECT_ID}/hold-points?hp=hp-attention-1`,
            },
          ],
        },
        recentActivities: [
          {
            id: 'activity-1',
            type: 'diary',
            description: 'Daily diary submitted for night shift',
            timestamp: 'not-a-date',
          },
          {
            id: 'activity-2',
            type: 'lot',
            description: 'Lot LOT-007 status changed to in progress',
            timestamp: '2026-05-19T08:15:00Z',
          },
        ],
      }),
    });
  });

  return {
    getStatsRequestCount: () => statsRequestCount,
  };
}

async function mockProjectManagerDashboardApi(page: Page, options: { failUntil?: number } = {}) {
  let dashboardRequestCount = 0;

  await mockDashboardShell(page, {
    ...E2E_ADMIN_USER,
    role: 'project_manager',
    roleInCompany: 'project_manager',
  });

  await page.route('**/api/dashboard/project-manager', async (route) => {
    dashboardRequestCount += 1;
    if (dashboardRequestCount <= (options.failUntil ?? 0)) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Project manager dashboard unavailable' }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        project: defaultProject,
        lotProgress: {
          total: 10,
          notStarted: 1,
          inProgress: 3,
          onHold: 1,
          completed: 5,
          progressPercentage: 50,
        },
        openNCRs: {
          total: 2,
          major: 1,
          minor: 1,
          overdue: 1,
          items: [],
        },
        holdPointPipeline: {
          pending: 1,
          scheduled: 2,
          requested: 1,
          released: 6,
          thisWeek: 3,
          items: [],
        },
        claimStatus: {
          totalClaimed: 100_000,
          totalCertified: 80_000,
          totalPaid: 50_000,
          outstanding: 30_000,
          pendingClaims: 1,
          recentClaims: [],
        },
        costTracking: {
          budgetTotal: 500_000,
          actualSpend: 420_000,
          variance: -80_000,
          variancePercentage: -16,
          labourCost: 260_000,
          plantCost: 160_000,
          trend: 'under',
        },
        attentionItems: [],
      }),
    });
  });

  return {
    getDashboardRequestCount: () => dashboardRequestCount,
  };
}

async function mockQualityManagerDashboardApi(page: Page, options: { failUntil?: number } = {}) {
  let dashboardRequestCount = 0;

  await mockDashboardShell(page, {
    ...E2E_ADMIN_USER,
    role: 'quality_manager',
    roleInCompany: 'quality_manager',
  });

  await page.route('**/api/dashboard/quality-manager', async (route) => {
    dashboardRequestCount += 1;
    if (dashboardRequestCount <= (options.failUntil ?? 0)) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Quality manager dashboard unavailable' }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        project: defaultProject,
        lotConformance: {
          totalLots: 10,
          conformingLots: 9,
          nonConformingLots: 1,
          rate: 90,
        },
        ncrsByCategory: {
          major: 1,
          minor: 2,
          observation: 0,
          total: 3,
        },
        openNCRs: [],
        pendingVerifications: {
          count: 0,
          items: [],
        },
        holdPointMetrics: {
          totalReleased: 8,
          totalPending: 2,
          releaseRate: 80,
          avgTimeToRelease: 12,
        },
        itpTrends: {
          completedThisWeek: 7,
          completedLastWeek: 5,
          trend: 'up',
          completionRate: 72,
        },
        auditReadiness: {
          score: 88,
          status: 'needs_attention',
          issues: ['Two lots missing signed test certificates'],
        },
      }),
    });
  });

  return {
    getDashboardRequestCount: () => dashboardRequestCount,
  };
}

test.describe('Dashboard seeded account contract', () => {
  test('renders real default dashboard data and persists widget preferences', async ({ page }) => {
    await mockDefaultDashboardApi(page);

    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Welcome back, E2E Admin')).toBeVisible();
    await expect(page.getByText('Total Projects').locator('..')).toContainText('3');
    await expect(page.getByText('Active Projects').locator('..')).toContainText('2');
    await expect(page.getByText('Total Lots').locator('..')).toContainText('14');
    const lotStatusOverview = page
      .getByRole('heading', { name: 'Lot Status Overview' })
      .locator('xpath=ancestor::div[contains(@class, "bg-card")][1]');
    await expect(lotStatusOverview.getByRole('button', { name: /Not Started\s+2/ })).toBeVisible();
    await expect(lotStatusOverview.getByRole('button', { name: /In Progress\s+3/ })).toBeVisible();
    await expect(
      lotStatusOverview.getByRole('button', { name: /Awaiting Test\s+1/ }),
    ).toBeVisible();
    await expect(lotStatusOverview.getByRole('button', { name: /Hold Point\s+2/ })).toBeVisible();
    await expect(lotStatusOverview.getByRole('button', { name: /NCR Raised\s+1/ })).toBeVisible();
    await expect(lotStatusOverview.getByRole('button', { name: /Completed\s+0/ })).toBeVisible();
    await expect(lotStatusOverview.getByRole('button', { name: /Conformed\s+4/ })).toBeVisible();
    await expect(lotStatusOverview.getByRole('button', { name: /Claimed\s+1/ })).toBeVisible();
    await expect(lotStatusOverview.getByText('Completed means the work is done.')).toBeVisible();
    await expect(
      lotStatusOverview.getByText('Quality evidence is approved and the lot can be claimed.'),
    ).toBeVisible();
    await expect(
      lotStatusOverview.getByText('The lot is included in a progress claim.'),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Items Requiring Attention' })).toBeVisible();
    await expect(page.getByText('NCR-9001')).toBeVisible();
    await expect(page.getByText('HP-42')).toBeVisible();
    await expect(page.getByText('Daily diary submitted for night shift')).toBeVisible();
    await expect(page.getByText('Unknown time')).toBeVisible();
    await expect(page.getByText('Lot LOT-007 status changed to in progress')).toBeVisible();

    await expect(page.getByRole('link', { name: 'Reports' })).toHaveAttribute(
      'href',
      `/projects/${E2E_PROJECT_ID}/reports`,
    );

    await page.getByRole('button', { name: 'Customize' }).click();
    await page.getByRole('button', { name: 'Recent Activity' }).click();
    await expect(page.getByRole('heading', { name: 'Recent Activity' })).toBeHidden();
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('siteproof_dashboard_widgets')))
      .not.toContain('recentActivity');
  });

  test('surfaces dashboard stat failures without synthetic activity fallback', async ({ page }) => {
    await mockDefaultDashboardApi(page, { failStats: true });

    await page.goto('/dashboard');

    const alert = page.getByRole('alert');
    await expect(alert).toContainText('Dashboard data could not be loaded.', { timeout: 15000 });
    await expect(alert).toContainText('Dashboard stats unavailable');
    await expect(page.getByText('Lot LOT-001 status changed to completed')).toHaveCount(0);
    await expect(page.getByText('New NCR raised: NCR-2024-001')).toHaveCount(0);
    await expect(page.getByText('No recent activity')).toBeHidden();
    await expect(
      page.getByText('Dashboard metrics are unavailable until the data loads successfully.'),
    ).toBeVisible();

    await expect(alert.getByRole('button', { name: 'Try again' })).toBeVisible();
  });

  test('shows a pending subcontractor invitation banner with an in-app accept link', async ({
    page,
  }) => {
    await mockDashboardShell(
      page,
      {
        id: 'e2e-invited-viewer',
        email: 'site@subbie.example',
        fullName: 'Sally Subbie',
        role: 'viewer',
        roleInCompany: 'viewer',
        companyId: 'e2e-company',
        hasPassword: true,
      },
      {
        id: 'e2e-invite-token',
        companyName: 'E2E Subbie Pty Ltd',
        projectName: 'E2E Highway Upgrade',
        headContractorName: 'Head Contractor Pty Ltd',
        primaryContactEmail: 'site@subbie.example',
        primaryContactName: 'Sally Subbie',
        status: 'pending_approval',
      },
    );

    await page.route('**/api/dashboard/stats**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          totalProjects: 0,
          activeProjects: 0,
          totalLots: 0,
          openHoldPoints: 0,
          openNCRs: 0,
          attentionItems: { total: 0, overdueNCRs: [], staleHoldPoints: [] },
          recentActivities: [],
        }),
      });
    });

    await page.goto('/dashboard');

    await expect(
      page.getByRole('region', { name: 'Pending subcontractor invitation' }),
    ).toContainText('E2E Subbie Pty Ltd');
    await expect(page.getByRole('link', { name: 'Accept Invitation' })).toHaveAttribute(
      'href',
      '/invitations',
    );
  });

  test('routes subcontractor users away from the head-contractor dashboard content', async ({
    page,
  }) => {
    let headContractorStatsRequested = false;
    await mockDashboardShell(
      page,
      {
        id: 'e2e-subbie-dashboard-user',
        email: 'site@subbie.example',
        fullName: 'Sally Subbie',
        role: 'subcontractor',
        roleInCompany: 'subcontractor',
        companyId: null,
        companyName: null,
        hasSubcontractorPortalAccess: true,
        hasPassword: true,
      },
      null,
    );

    await page.route('**/api/subcontractors/my-company', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          company: {
            id: 'e2e-subcontractor-company',
            companyName: 'E2E Subbie Pty Ltd',
            projectId: E2E_PROJECT_ID,
            projectName: 'E2E Highway Upgrade',
            employees: [],
            plant: [],
            portalAccess: {
              lots: true,
              itps: true,
              holdPoints: true,
              testResults: true,
              ncrs: true,
              documents: true,
            },
          },
        }),
      });
    });

    await page.route('**/api/dockets?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ dockets: [] }),
      });
    });

    await page.route('**/api/lots?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ lots: [] }),
      });
    });

    await page.route('**/api/notifications?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ notifications: [], unreadCount: 0 }),
      });
    });

    await page.route('**/api/dashboard/stats**', async (route) => {
      headContractorStatsRequested = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          totalProjects: 99,
          activeProjects: 99,
          totalLots: 99,
          openHoldPoints: 0,
          openNCRs: 0,
          attentionItems: { total: 0, overdueNCRs: [], staleHoldPoints: [] },
          recentActivities: [],
        }),
      });
    });

    await page.goto('/dashboard');

    await expect(
      page.getByRole('heading', { name: /Good (morning|afternoon|evening), Sally/ }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: "Today's Docket" })).toBeVisible();
    await expect(page.getByText('E2E Subbie Pty Ltd')).toBeVisible();
    await expect(page.getByText('Total Projects')).toHaveCount(0);
    await expect(page.getByText('Create Lot')).toHaveCount(0);
    expect(headContractorStatsRequested).toBe(false);
  });

  test.describe('timestamp locale contract', () => {
    test.use({ locale: 'en-US', timezoneId: 'America/New_York' });

    test('formats recent activity timestamps in Australian date order', async ({ page }) => {
      await mockDefaultDashboardApi(page);

      await page.goto('/dashboard');

      const activityRow = page.getByText('Lot LOT-007 status changed to in progress').locator('..');
      await expect(activityRow).toContainText(/19\/05\/2026,?\s+0?4:15\s*(am|AM)/);
      await expect(activityRow).not.toContainText('5/19/2026');
    });
  });

  test('keeps default dashboard header controls within iPhone width', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockDefaultDashboardApi(page);

    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    const layout = await page.evaluate(() => {
      const viewportWidth = window.innerWidth;
      const controlNames = ['Last 30 Days', 'Refresh', 'Export PDF', 'Customize'];
      const controls = controlNames.map((name) => {
        const button = Array.from(document.querySelectorAll('button')).find((candidate) =>
          candidate.textContent?.includes(name),
        );
        const rect = button?.getBoundingClientRect();
        return {
          name,
          found: Boolean(button && rect),
          left: rect?.left ?? null,
          right: rect?.right ?? null,
        };
      });

      return {
        viewportWidth,
        scrollWidth: document.documentElement.scrollWidth,
        controls,
      };
    });

    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.controls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Last 30 Days', found: true }),
        expect.objectContaining({ name: 'Refresh', found: true }),
        expect.objectContaining({ name: 'Export PDF', found: true }),
        expect.objectContaining({ name: 'Customize', found: true }),
      ]),
    );
    for (const control of layout.controls) {
      expect(
        control.left,
        `${control.name} should not be clipped on the left`,
      ).toBeGreaterThanOrEqual(0);
      expect(
        control.right,
        `${control.name} should not be clipped on the right`,
      ).toBeLessThanOrEqual(layout.viewportWidth);
    }
  });

  test('keeps cookie consent above the fixed mobile navigation', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockDefaultDashboardApi(page);
    await page.addInitScript(() => {
      localStorage.removeItem('cookie_consent');
    });

    await page.goto('/dashboard');

    const banner = page.getByTestId('cookie-consent-banner');
    await expect(banner).toBeVisible();
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();

    const layout = await page.evaluate(() => {
      const bannerElement = document.querySelector('[data-testid="cookie-consent-banner"]');
      const bottomNav = Array.from(document.querySelectorAll('nav.fixed')).find((nav) => {
        const rect = nav.getBoundingClientRect();
        return Math.abs(window.innerHeight - rect.bottom) < 2 && rect.height > 0;
      });
      const bannerRect = bannerElement?.getBoundingClientRect();
      const navRect = bottomNav?.getBoundingClientRect();

      return {
        bannerHeight: bannerRect?.height ?? null,
        bannerBottom: bannerRect?.bottom ?? null,
        navTop: navRect?.top ?? null,
      };
    });

    expect(layout.bannerHeight).not.toBeNull();
    expect(layout.bannerHeight!).toBeLessThanOrEqual(112);
    expect(layout.bannerBottom).not.toBeNull();
    expect(layout.navTop).not.toBeNull();
    expect(layout.bannerBottom!).toBeLessThanOrEqual(layout.navTop! + 1);
  });

  test('project manager dashboard links to mounted project routes', async ({ page }) => {
    await mockProjectManagerDashboardApi(page);

    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: 'Project Dashboard' })).toBeVisible();
    await expect(page.getByText('E2E Highway Upgrade')).toBeVisible();
    await expect(page.getByText('Lot Progress').locator('..')).toContainText('50%');
    await expect(page.getByRole('link', { name: 'Manage Lots' })).toHaveAttribute(
      'href',
      `/projects/${E2E_PROJECT_ID}/lots`,
    );
    await expect(page.getByRole('link', { name: 'Progress Claims' })).toHaveAttribute(
      'href',
      `/projects/${E2E_PROJECT_ID}/claims`,
    );
    await expect(page.getByRole('link', { name: 'Reports' })).toHaveAttribute(
      'href',
      `/projects/${E2E_PROJECT_ID}/reports`,
    );
    await expect(page.getByRole('link', { name: 'Docket Approvals' })).toHaveAttribute(
      'href',
      `/projects/${E2E_PROJECT_ID}/dockets`,
    );
  });

  test('project manager dashboard avoids false zero metrics on load failure', async ({ page }) => {
    await mockProjectManagerDashboardApi(page, { failUntil: 100 });

    await page.goto('/dashboard');

    const alert = page.getByRole('alert');
    await expect(alert).toContainText('Project manager dashboard could not be loaded.', {
      timeout: 15000,
    });
    await expect(alert).toContainText('Project manager dashboard unavailable');
    await expect(page.getByText('Lot Progress')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  });

  test('quality manager dashboard links to mounted project routes', async ({ page }) => {
    await mockQualityManagerDashboardApi(page);

    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { name: 'Quality Dashboard' })).toBeVisible();
    await expect(page.getByText('Lot Conformance').locator('..')).toContainText('90.0%');
    await expect(page.getByText('Two lots missing signed test certificates')).toBeVisible();
    await expect(page.getByRole('link', { name: 'NCR Register' })).toHaveAttribute(
      'href',
      `/projects/${E2E_PROJECT_ID}/ncr`,
    );
    await expect(page.getByRole('link', { name: 'ITP Management' })).toHaveAttribute(
      'href',
      `/projects/${E2E_PROJECT_ID}/itp`,
    );
    await expect(page.getByRole('link', { name: 'Hold Points' })).toHaveAttribute(
      'href',
      `/projects/${E2E_PROJECT_ID}/hold-points`,
    );
    await expect(page.getByRole('link', { name: 'Quality Reports' })).toHaveAttribute(
      'href',
      `/projects/${E2E_PROJECT_ID}/reports`,
    );
  });

  test('quality manager dashboard avoids false zero metrics on load failure', async ({ page }) => {
    await mockQualityManagerDashboardApi(page, { failUntil: 100 });

    await page.goto('/dashboard');

    const alert = page.getByRole('alert');
    await expect(alert).toContainText('Quality manager dashboard could not be loaded.', {
      timeout: 15000,
    });
    await expect(alert).toContainText('Quality manager dashboard unavailable');
    await expect(page.getByText('Lot Conformance')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  });
});
