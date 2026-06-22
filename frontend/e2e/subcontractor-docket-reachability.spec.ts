import { test, expect, type Page } from '@playwright/test';
import { E2E_ADMIN_USER, E2E_PROJECT_ID, mockAuthenticatedUserState } from './helpers';

// Subbie portal user (mirrors the shape used by subcontractor-portal-rbac.spec.ts).
const subbieUser = {
  ...E2E_ADMIN_USER,
  id: 'e2e-subbie-reach-user',
  email: 'subbie-reach@example.com',
  fullName: 'Reach Subbie',
  role: 'subcontractor_admin',
  roleInCompany: 'subcontractor_admin',
  companyId: null,
  companyName: null,
  hasSubcontractorPortalAccess: true,
};

interface DocketFixture {
  id: string;
  docketNumber: string;
  date: string;
  status: string;
  totalLabourSubmitted: number;
  totalPlantSubmitted: number;
}

interface PortalOptions {
  dockets?: DocketFixture[];
  employees?: Array<{ id: string; name: string; status: string }>;
  plant?: Array<{ id: string; type: string; status: string }>;
  lotsEnabled?: boolean;
  assignedLots?: Array<{ id: string; lotNumber: string; activity?: string; status: string }>;
}

// Local-date key matching the frontend's formatDateKey() (YYYY-MM-DD, local tz).
function todayKey(): string {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

async function browserTodayKey(page: Page): Promise<string> {
  return page.evaluate(() => {
    const parts = new Intl.DateTimeFormat('en-AU', {
      timeZone: 'Australia/Sydney',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;
    return `${year}-${month}-${day}`;
  });
}

async function mockPortalApi(page: Page, options: PortalOptions = {}) {
  const {
    dockets = [],
    employees = [],
    plant = [],
    lotsEnabled = true,
    assignedLots = [],
  } = options;

  const company = {
    id: 'e2e-subbie-company',
    companyName: 'E2E Civil Subcontractors',
    projectId: E2E_PROJECT_ID,
    projectName: 'E2E Highway Upgrade',
    employees,
    plant,
    portalAccess: {
      lots: lotsEnabled,
      itps: false,
      holdPoints: false,
      testResults: false,
      ncrs: false,
      documents: false,
    },
    availableProjects: [],
  };

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (url.pathname === '/api/auth/me') {
      await json({ user: subbieUser });
      return;
    }
    if (url.pathname === '/api/subcontractors/my-company') {
      await json({ company });
      return;
    }
    if (url.pathname === '/api/dockets' && route.request().method() === 'GET') {
      await json({ dockets });
      return;
    }
    if (url.pathname.startsWith('/api/dockets/')) {
      const id = url.pathname.split('/')[3];
      const found = dockets.find((d) => d.id === id);
      await json({
        docket: {
          id,
          docketNumber: found?.docketNumber ?? 'DK-NEW',
          date: found?.date ?? todayKey(),
          status: found?.status ?? 'draft',
          notes: '',
          labourEntries: [],
          plantEntries: [],
          totalLabourSubmitted: found?.totalLabourSubmitted ?? 0,
          totalPlantSubmitted: found?.totalPlantSubmitted ?? 0,
        },
      });
      return;
    }
    if (url.pathname === '/api/lots') {
      await json({ lots: assignedLots });
      return;
    }
    if (url.pathname === '/api/notifications') {
      await json({ notifications: [], unreadCount: 0 });
      return;
    }
    if (url.pathname === `/api/projects/${E2E_PROJECT_ID}`) {
      await json({
        project: { id: E2E_PROJECT_ID, name: 'E2E Highway Upgrade', projectNumber: 'E2E-001' },
      });
      return;
    }

    await json({ message: `Unhandled E2E API route: ${url.pathname}` }, 404);
  });

  await mockAuthenticatedUserState(page, subbieUser);
}

test.describe('Subcontractor docket reachability', () => {
  test('docket history CTA starts a new docket when none exists for today', async ({ page }) => {
    await mockPortalApi(page, { dockets: [] });

    await page.goto('/subcontractor-portal/dockets');

    const startLink = page.getByRole('link', { name: "Start today's docket" });
    await expect(startLink).toBeVisible();
    await expect(startLink).toHaveAttribute(
      'href',
      '/subcontractor-portal/docket/new?projectId=e2e-project&subcontractorCompanyId=e2e-subbie-company',
    );
    await expect(page.getByRole('link', { name: "Continue today's docket" })).toBeHidden();
  });

  test("docket history CTA continues today's docket when one already exists", async ({ page }) => {
    const todaysDocket: DocketFixture = {
      id: 'e2e-today-docket',
      docketNumber: 'DK-TODAY',
      date: await browserTodayKey(page),
      status: 'draft',
      totalLabourSubmitted: 0,
      totalPlantSubmitted: 0,
    };
    await mockPortalApi(page, { dockets: [todaysDocket] });

    await page.goto('/subcontractor-portal/dockets');

    const continueLink = page.getByRole('link', { name: "Continue today's docket" });
    await expect(continueLink).toBeVisible();
    await expect(continueLink).toHaveAttribute(
      'href',
      '/subcontractor-portal/docket/e2e-today-docket?projectId=e2e-project&subcontractorCompanyId=e2e-subbie-company',
    );
    await expect(page.getByRole('link', { name: "Start today's docket" })).toBeHidden();
  });

  test('dashboard explains docket prerequisites when resources and lots are missing', async ({
    page,
  }) => {
    await mockPortalApi(page, {
      dockets: [],
      employees: [],
      plant: [],
      lotsEnabled: true,
      assignedLots: [],
    });

    await page.goto('/subcontractor-portal');

    await expect(page.getByText('Finish setup before filling out a docket')).toBeVisible();
    await expect(page.getByText('Add approved employees or plant in')).toBeVisible();
    await expect(page.getByRole('link', { name: 'My Company' }).first()).toBeVisible();
    await expect(
      page.getByText('No lots assigned yet. Contact your project manager to get lot assignments.'),
    ).toBeVisible();
  });

  test('dashboard hides the prerequisite guidance once resources and a lot are ready', async ({
    page,
  }) => {
    await mockPortalApi(page, {
      dockets: [],
      employees: [{ id: 'emp-1', name: 'Worker One', status: 'approved' }],
      plant: [],
      lotsEnabled: true,
      assignedLots: [
        { id: 'lot-1', lotNumber: 'SUB-LOT-001', activity: 'Drainage', status: 'in_progress' },
      ],
    });

    await page.goto('/subcontractor-portal');

    await expect(page.getByText('No docket started for today')).toBeVisible();
    await expect(page.getByText('Finish setup before filling out a docket')).toBeHidden();
  });

  test('docket editor header shows which project the subbie is filing against', async ({
    page,
  }) => {
    await mockPortalApi(page, { dockets: [] });

    await page.goto('/subcontractor-portal/docket/new');

    await expect(page.getByRole('heading', { name: "Today's Docket" })).toBeVisible();
    await expect(page.getByText('Project: E2E Highway Upgrade')).toBeVisible();
  });
});
