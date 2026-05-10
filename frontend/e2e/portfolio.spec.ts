import { test, expect, type Page } from '@playwright/test';
import { E2E_ADMIN_USER, E2E_PROJECT_ID, mockAuthenticatedUserState } from './helpers';

function futureIsoDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString();
}

const portfolioProjects = [
  {
    id: 'bridge-1',
    name: 'Harbour Bridge Upgrade',
    projectNumber: 'HB-001',
    status: 'active',
    targetCompletion: futureIsoDate(90),
    contractValue: 1_200_000,
  },
  {
    id: 'road-2',
    name: 'Western Road Duplication',
    projectNumber: 'WR-002',
    status: 'active',
    targetCompletion: futureIsoDate(12),
    contractValue: 800_000,
  },
  {
    id: 'rail-3',
    name: 'City Rail Extension',
    projectNumber: 'CR-003',
    status: 'completed',
    targetCompletion: futureIsoDate(-20),
    contractValue: 500_000,
  },
  {
    id: E2E_PROJECT_ID,
    name: 'Archived Interchange',
    projectNumber: 'AI-004',
    status: 'archived',
    contractValue: 0,
  },
];

async function mockPortfolioApi(
  page: Page,
  options: {
    failProjectsUntil?: number;
    failCashFlow?: boolean;
    failRisks?: boolean;
  } = {},
) {
  let projectsRequestCount = 0;

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });

    if (url.pathname === '/api/auth/me') {
      await json({
        user: {
          ...E2E_ADMIN_USER,
          name: E2E_ADMIN_USER.fullName,
          companyName: 'E2E Civil Pty Ltd',
        },
      });
      return;
    }

    if (url.pathname === '/api/notifications') {
      await json({ notifications: [], unreadCount: 0 });
      return;
    }

    if (url.pathname === '/api/projects') {
      projectsRequestCount += 1;
      if (projectsRequestCount <= (options.failProjectsUntil ?? 0)) {
        await json({ message: 'Projects service unavailable' }, 503);
        return;
      }

      await json({ projects: portfolioProjects });
      return;
    }

    if (url.pathname === '/api/dashboard/portfolio-cashflow') {
      if (options.failCashFlow) {
        await json({ message: 'Cash flow service unavailable' }, 503);
        return;
      }

      await json({
        totalClaimed: 450_000,
        totalCertified: 320_000,
        totalPaid: 250_000,
        outstanding: 70_000,
      });
      return;
    }

    if (url.pathname === '/api/dashboard/portfolio-ncrs') {
      await json({
        ncrs: [
          {
            id: 'ncr-1001',
            ncrNumber: 'NCR-1001',
            description: 'Major compaction failure at chainage 1200.',
            category: 'major',
            status: 'open',
            dueDate: futureIsoDate(-2),
            isOverdue: true,
            daysUntilDue: -2,
            project: {
              id: 'rail-3',
              name: 'City Rail Extension',
              projectNumber: 'CR-003',
            },
            link: 'https://external.invalid/ncr-1001',
          },
        ],
      });
      return;
    }

    if (url.pathname === '/api/dashboard/portfolio-risks') {
      if (options.failRisks) {
        await json({ message: 'Risk engine unavailable' }, 503);
        return;
      }

      await json({
        projectsAtRisk: [
          {
            id: 'road-2',
            name: 'Western Road Duplication',
            projectNumber: 'WR-002',
            riskLevel: 'critical',
            link: '//external.invalid/road-2',
            riskIndicators: [
              {
                type: 'timeline',
                severity: 'critical',
                message: 'Due within 12 days',
                explanation: 'Target completion is inside the escalation window.',
              },
            ],
          },
        ],
      });
      return;
    }

    await json({ message: `Unhandled E2E API route: ${url.pathname}` }, 404);
  });

  await mockAuthenticatedUserState(page, {
    ...E2E_ADMIN_USER,
    name: E2E_ADMIN_USER.fullName,
    companyName: 'E2E Civil Pty Ltd',
  });

  return {
    getProjectsRequestCount: () => projectsRequestCount,
  };
}

test.describe('Portfolio seeded admin contract', () => {
  test('renders portfolio metrics, risk links, and company project links', async ({ page }) => {
    await mockPortfolioApi(page);

    await page.goto('/portfolio');

    await expect(page.getByRole('heading', { name: 'Portfolio Overview' })).toBeVisible();
    await expect(page.getByText('Total Projects').locator('..')).toContainText('4');
    await expect(page.getByText('Active Projects').locator('..')).toContainText('2');
    await expect(page.getByText('Total Contract Value').locator('..')).toContainText('$2,500,000');
    await expect(page.getByText('Total Claimed').locator('..')).toContainText('$450,000');
    await expect(page.getByText('Outstanding').locator('..')).toContainText('$70,000');

    await expect(
      page.getByRole('heading', { name: 'Critical NCRs Across Projects' }),
    ).toBeVisible();
    await expect(page.getByText('NCR-1001')).toBeVisible();
    await expect(page.getByText('OVERDUE')).toBeVisible();

    await expect(page.getByRole('heading', { name: 'Projects at Risk' })).toBeVisible();
    await expect(page.getByText('Due within 12 days')).toBeVisible();

    await expect(
      page.getByRole('link', { name: 'Open NCR-1001 for City Rail Extension' }),
    ).toHaveAttribute('href', '/projects/rail-3/ncr');
    await expect(
      page.getByRole('link', { name: 'Open risk summary for Western Road Duplication' }),
    ).toHaveAttribute('href', '/projects/road-2');
    await expect(page.getByRole('link', { name: /Harbour Bridge Upgrade/ })).toHaveAttribute(
      'href',
      '/projects/bridge-1',
    );
  });

  test('surfaces partial portfolio API failures without hiding loaded data', async ({ page }) => {
    await mockPortfolioApi(page, { failRisks: true });

    await page.goto('/portfolio');

    await expect(page.getByText('Total Contract Value').locator('..')).toContainText('$2,500,000');
    await expect(page.getByText('Total Claimed').locator('..')).toContainText('$450,000');

    const alert = page.getByRole('alert');
    await expect(alert).toContainText('Some portfolio data could not be loaded.', {
      timeout: 15000,
    });
    await expect(alert).toContainText('Risk indicators: Risk engine unavailable');
    await expect(alert.getByRole('button', { name: 'Try again' })).toBeVisible();
  });

  test('surfaces project load failure without false empty project list', async ({ page }) => {
    await mockPortfolioApi(page, { failProjectsUntil: 100 });

    await page.goto('/portfolio');

    const alert = page.getByRole('alert');
    await expect(alert).toContainText('Projects: Projects service unavailable', { timeout: 15000 });
    await expect(
      page.getByText('No projects found. Create your first project to get started.'),
    ).toBeHidden();
    await expect(
      page.getByText(
        'Project portfolio metrics are unavailable until project data loads successfully.',
      ),
    ).toBeVisible();
    await expect(alert.getByRole('button', { name: 'Try again' })).toBeVisible();
  });

  test('hides cash flow zeros when the cash flow API fails', async ({ page }) => {
    await mockPortfolioApi(page, { failCashFlow: true });

    await page.goto('/portfolio');

    await expect(page.getByText('Total Projects').locator('..')).toContainText('4');
    const alert = page.getByRole('alert');
    await expect(alert).toContainText('Cash flow: Cash flow service unavailable', {
      timeout: 15000,
    });
    await expect(page.getByRole('heading', { name: 'Cash Flow Summary' })).toBeHidden();
    await expect(
      page.getByText('Cash flow metrics are unavailable until cash flow data loads successfully.'),
    ).toBeVisible();
  });
});
