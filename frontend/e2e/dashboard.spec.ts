import { test, expect, type Page } from '@playwright/test';
import { E2E_ADMIN_USER, E2E_PROJECT_ID, mockAuthenticatedUserState } from './helpers';

const defaultProject = {
  id: E2E_PROJECT_ID,
  name: 'E2E Highway Upgrade',
  projectNumber: 'E2E-001',
  status: 'active',
};

async function mockDashboardShell(page: Page, user = E2E_ADMIN_USER) {
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

  await mockAuthenticatedUserState(page, user);
}

async function mockDefaultDashboardApi(
  page: Page,
  options: { failStats?: boolean; failStatsUntil?: number } = {},
) {
  let statsRequestCount = 0;

  await mockDashboardShell(page, {
    ...E2E_ADMIN_USER,
    name: 'E2E Admin',
    fullName: 'E2E Admin',
    roleInCompany: 'admin',
    companyName: 'E2E Civil Pty Ltd',
  });

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
    await expect(page.getByRole('heading', { name: 'Items Requiring Attention' })).toBeVisible();
    await expect(page.getByText('NCR-9001')).toBeVisible();
    await expect(page.getByText('HP-42')).toBeVisible();
    await expect(page.getByText('Daily diary submitted for night shift')).toBeVisible();
    await expect(page.getByText('Unknown time')).toBeVisible();

    await expect(page.getByRole('link', { name: 'Reports' })).toHaveAttribute('href', '/projects');

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
