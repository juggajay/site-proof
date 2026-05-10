import { test, expect, type Page } from '@playwright/test';
import { E2E_ADMIN_USER, E2E_PROJECT_ID, mockAuthenticatedUserState } from './helpers';

const E2E_DOCKET_ID = 'e2e-docket';

type SeededDocketsApiOptions = {
  failDocketLoadsUntil?: number;
  approveDelayMs?: number;
  user?: typeof E2E_ADMIN_USER;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const E2E_SUBCONTRACTOR_USER = {
  ...E2E_ADMIN_USER,
  id: 'e2e-subcontractor-user',
  role: 'subcontractor_admin',
  roleInCompany: 'subcontractor_admin',
};

function buildDocket(status: 'pending_approval' | 'approved' = 'pending_approval') {
  return {
    id: E2E_DOCKET_ID,
    docketNumber: 'DKT-E2E-001',
    subcontractor: 'E2E Subcontractors',
    subcontractorId: 'e2e-subcontractor-company',
    date: '2026-01-15',
    status,
    notes: 'E2E seeded docket',
    labourHours: 8,
    plantHours: 3,
    totalLabourSubmitted: 8,
    totalLabourApproved: status === 'approved' ? 8 : 0,
    totalPlantSubmitted: 3,
    totalPlantApproved: status === 'approved' ? 3 : 0,
    submittedAt: '2026-01-15T05:00:00.000Z',
    approvedAt: status === 'approved' ? '2026-01-15T06:00:00.000Z' : null,
    foremanNotes: status === 'approved' ? 'Approved in E2E' : null,
  };
}

async function mockSeededDocketsApi(page: Page, options: SeededDocketsApiOptions = {}) {
  let approved = false;
  let createRequest: unknown;
  let createRequestCount = 0;
  let approveRequest: unknown;
  let approveRequestCount = 0;
  let docketLoadCount = 0;

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });

    if (url.pathname === '/api/auth/me') {
      await json({ user: options.user ?? E2E_ADMIN_USER });
      return;
    }

    if (url.pathname === '/api/dockets' && url.searchParams.get('projectId') === E2E_PROJECT_ID) {
      docketLoadCount += 1;
      if (docketLoadCount <= (options.failDocketLoadsUntil ?? 0)) {
        await json({ message: 'Unable to load dockets right now' }, 500);
        return;
      }
      await json({ dockets: [buildDocket(approved ? 'approved' : 'pending_approval')] });
      return;
    }

    if (url.pathname === '/api/projects') {
      await json({
        projects: [
          {
            id: E2E_PROJECT_ID,
            name: 'E2E Highway Upgrade',
            projectNumber: 'E2E-001',
            status: 'active',
          },
        ],
      });
      return;
    }

    if (url.pathname === `/api/projects/${E2E_PROJECT_ID}`) {
      await json({
        project: {
          id: E2E_PROJECT_ID,
          name: 'E2E Highway Upgrade',
          projectNumber: 'E2E-001',
        },
      });
      return;
    }

    if (url.pathname === '/api/notifications') {
      await json({ notifications: [], unreadCount: 0 });
      return;
    }

    if (url.pathname === '/api/dockets' && route.request().method() === 'POST') {
      createRequest = route.request().postDataJSON();
      createRequestCount += 1;
      await json({ docket: buildDocket('pending_approval') }, 201);
      return;
    }

    if (url.pathname === `/api/dockets/${E2E_DOCKET_ID}`) {
      await json({
        docket: {
          ...buildDocket(approved ? 'approved' : 'pending_approval'),
          labourEntries: [
            {
              id: 'e2e-labour-entry',
              employee: { name: 'E2E Labourer', role: 'Operator' },
              startTime: '07:00',
              finishTime: '15:00',
              submittedHours: 8,
              approvedHours: approved ? 8 : 0,
              hourlyRate: 90,
              submittedCost: 720,
              approvedCost: approved ? 720 : 0,
            },
          ],
          plantEntries: [
            {
              id: 'e2e-plant-entry',
              plant: { type: 'excavator', description: 'E2E Excavator', idRego: 'EX-001' },
              hoursOperated: 3,
              wetOrDry: 'wet',
              hourlyRate: 160,
              submittedCost: 480,
              approvedCost: approved ? 480 : 0,
            },
          ],
        },
      });
      return;
    }

    if (url.pathname === `/api/dockets/${E2E_DOCKET_ID}/approve`) {
      approveRequest = route.request().postDataJSON();
      approveRequestCount += 1;
      if (options.approveDelayMs) {
        await delay(options.approveDelayMs);
      }
      approved = true;
      await json({ docket: buildDocket('approved') });
      return;
    }

    await json({ message: `Unhandled E2E API route: ${url.pathname}` }, 404);
  });

  await mockAuthenticatedUserState(page);

  return {
    getCreateRequest: () => createRequest,
    getCreateRequestCount: () => createRequestCount,
    getApproveRequest: () => approveRequest,
    getApproveRequestCount: () => approveRequestCount,
    getDocketLoadCount: () => docketLoadCount,
  };
}

async function mockSubcontractorDocketEditApi(page: Page) {
  let plantRequest: unknown;
  let plantRequestCount = 0;

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });

    if (url.pathname === '/api/auth/me') {
      await json({ user: E2E_SUBCONTRACTOR_USER });
      return;
    }

    if (url.pathname === '/api/notifications') {
      await json({ notifications: [], unreadCount: 0 });
      return;
    }

    if (url.pathname === '/api/projects') {
      await json({
        projects: [
          {
            id: E2E_PROJECT_ID,
            name: 'E2E Highway Upgrade',
            projectNumber: 'E2E-001',
            status: 'active',
          },
        ],
      });
      return;
    }

    if (url.pathname === '/api/subcontractors/my-company') {
      await json({
        company: {
          id: 'e2e-subcontractor-company',
          projectId: E2E_PROJECT_ID,
          projectName: 'E2E Highway Upgrade',
          employees: [],
          plant: [
            {
              id: 'e2e-plant',
              type: 'Excavator',
              description: 'E2E Excavator',
              idRego: 'EX-001',
              dryRate: 180,
              wetRate: 240,
              status: 'approved',
            },
          ],
        },
      });
      return;
    }

    if (url.pathname === '/api/lots' && url.searchParams.get('projectId') === E2E_PROJECT_ID) {
      await json({
        lots: [
          {
            id: 'e2e-lot',
            lotNumber: 'LOT-E2E-001',
            activity: 'Earthworks',
          },
        ],
      });
      return;
    }

    if (url.pathname === `/api/dockets/${E2E_DOCKET_ID}` && route.request().method() === 'GET') {
      await json({
        docket: {
          ...buildDocket('pending_approval'),
          status: 'draft',
          labourEntries: [],
          plantEntries: [],
          totalLabourSubmitted: 0,
          totalPlantSubmitted: 0,
        },
      });
      return;
    }

    if (
      url.pathname === `/api/dockets/${E2E_DOCKET_ID}/plant` &&
      route.request().method() === 'POST'
    ) {
      plantRequest = route.request().postDataJSON();
      plantRequestCount += 1;
      const body = plantRequest as {
        plantId: string;
        hoursOperated: number;
        wetOrDry: 'dry' | 'wet';
      };
      await json(
        {
          plantEntry: {
            id: 'e2e-plant-entry-added',
            plant: {
              id: body.plantId,
              type: 'Excavator',
              description: 'E2E Excavator',
              dryRate: 180,
              wetRate: 240,
            },
            hoursOperated: body.hoursOperated,
            wetOrDry: body.wetOrDry,
            hourlyRate: 180,
            submittedCost: body.hoursOperated * 180,
          },
          runningTotal: {
            hours: body.hoursOperated,
            cost: body.hoursOperated * 180,
          },
        },
        201,
      );
      return;
    }

    await json({ message: `Unhandled E2E API route: ${url.pathname}` }, 404);
  });

  await mockAuthenticatedUserState(page, E2E_SUBCONTRACTOR_USER);

  return {
    getPlantRequest: () => plantRequest,
    getPlantRequestCount: () => plantRequestCount,
  };
}

test.describe('Dockets seeded approval contract', () => {
  test('renders and approves the seeded pending docket with hard assertions', async ({ page }) => {
    const api = await mockSeededDocketsApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/dockets`);

    await expect(page.getByRole('heading', { name: 'Docket Approvals' })).toBeVisible();
    await expect(page.getByText(`project ${E2E_PROJECT_ID}`)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pending (1)' })).toBeVisible();

    const docketRow = page.getByRole('row').filter({ hasText: 'DKT-E2E-001' });
    await expect(docketRow).toBeVisible();
    await expect(docketRow.getByText('E2E Subcontractors')).toBeVisible();
    await expect(docketRow.getByText('E2E seeded docket')).toBeVisible();
    await expect(docketRow.getByText('8h')).toBeVisible();
    await expect(docketRow.getByText('3h')).toBeVisible();
    await expect(docketRow.getByText('Pending Approval')).toBeVisible();
    await expect(docketRow.getByRole('button', { name: 'Approve' })).toBeVisible();
    await expect(docketRow.getByRole('button', { name: 'Reject' })).toBeVisible();

    await docketRow.getByRole('button', { name: 'Approve' }).click();

    const modal = page.locator('.fixed').filter({ hasText: 'Approve Docket' }).first();
    await expect(modal.getByRole('heading', { name: 'Approve Docket' })).toBeVisible();
    await expect(modal.getByText('E2E Labourer')).toBeVisible();
    await expect(modal.getByText('E2E Excavator (EX-001)')).toBeVisible();

    await modal.getByPlaceholder('Add any notes (optional)...').fill('  Approved in E2E  ');
    await modal.getByRole('button', { name: 'Approve' }).click();

    await expect.poll(() => api.getApproveRequestCount()).toBe(1);
    expect(api.getApproveRequest()).toMatchObject({
      foremanNotes: 'Approved in E2E',
      adjustedLabourHours: 8,
      adjustedPlantHours: 3,
    });
    await expect(page.getByRole('button', { name: 'Pending (0)' })).toBeVisible();
    await expect(
      page.getByRole('row').filter({ hasText: 'DKT-E2E-001' }).getByText('Approved'),
    ).toBeVisible();
  });

  test('rejects encoded adjustment hours before approving', async ({ page }) => {
    const api = await mockSeededDocketsApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/dockets`);

    const docketRow = page.getByRole('row').filter({ hasText: 'DKT-E2E-001' });
    await expect(docketRow).toBeVisible();
    await docketRow.getByRole('button', { name: 'Approve' }).click();

    const modal = page.getByRole('dialog', { name: 'Approve Docket' });
    await expect(modal).toBeVisible();
    await modal.getByLabel('Adjusted Labour Hours').fill('1e2');
    await modal.getByRole('button', { name: 'Approve' }).click();

    await expect(page.getByText('Hours must be a non-negative decimal number.')).toBeVisible();
    expect(api.getApproveRequestCount()).toBe(0);

    await modal.getByLabel('Adjusted Labour Hours').fill('7.5');
    await modal.getByLabel('Adjusted Plant Hours').fill('3.25');
    await modal.getByLabel(/Adjustment Reason/).fill('Corrected docket totals');
    await modal.getByRole('button', { name: 'Approve' }).click();

    await expect.poll(() => api.getApproveRequestCount()).toBe(1);
    expect(api.getApproveRequest()).toMatchObject({
      adjustedLabourHours: 7.5,
      adjustedPlantHours: 3.25,
      adjustmentReason: 'Corrected docket totals',
    });
  });

  test('rejects encoded create-docket hours before posting', async ({ page }) => {
    const api = await mockSeededDocketsApi(page, { user: E2E_SUBCONTRACTOR_USER });

    await page.goto(`/projects/${E2E_PROJECT_ID}/dockets`);

    await page.getByRole('button', { name: 'Create Docket' }).click();
    const modal = page.getByRole('dialog', { name: 'Create Docket' });
    await modal.getByLabel('Date *').fill('2026-01-16');
    await modal.getByLabel('Labour Hours').fill('1e2');
    await modal.getByLabel('Plant Hours').fill('3.25');
    await modal.getByRole('button', { name: 'Create Docket', exact: true }).click();

    await expect(page.getByText('Hours must be a non-negative decimal number.')).toBeVisible();
    expect(api.getCreateRequestCount()).toBe(0);

    await modal.getByLabel('Labour Hours').fill('8.5');
    await modal.getByRole('button', { name: 'Create Docket', exact: true }).click();

    await expect.poll(() => api.getCreateRequestCount()).toBe(1);
    expect(api.getCreateRequest()).toMatchObject({
      projectId: E2E_PROJECT_ID,
      date: '2026-01-16',
      labourHours: 8.5,
      plantHours: 3.25,
    });
  });

  test('shows a retryable load error instead of a false empty state', async ({ page }) => {
    const api = await mockSeededDocketsApi(page, { failDocketLoadsUntil: 2 });

    await page.goto(`/projects/${E2E_PROJECT_ID}/dockets`);

    await expect(page.getByRole('alert')).toContainText('Unable to load dockets right now');
    await expect(page.getByText('No dockets found')).toHaveCount(0);

    await page.getByRole('button', { name: 'Try again' }).click();

    await expect.poll(() => api.getDocketLoadCount()).toBeGreaterThan(2);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('row').filter({ hasText: 'DKT-E2E-001' })).toBeVisible();
  });

  test('ignores duplicate approve clicks while the request is in flight', async ({ page }) => {
    const api = await mockSeededDocketsApi(page, { approveDelayMs: 250 });

    await page.goto(`/projects/${E2E_PROJECT_ID}/dockets`);

    const docketRow = page.getByRole('row').filter({ hasText: 'DKT-E2E-001' });
    await expect(docketRow).toBeVisible();
    await docketRow.getByRole('button', { name: 'Approve' }).click();

    const modal = page.locator('.fixed').filter({ hasText: 'Approve Docket' }).first();
    await expect(modal.getByRole('heading', { name: 'Approve Docket' })).toBeVisible();

    const approveButton = modal.getByRole('button', { name: 'Approve' });
    await approveButton.evaluate((button: HTMLElement) => {
      button.click();
      button.click();
    });

    await expect.poll(() => api.getApproveRequestCount()).toBe(1);
    await expect(
      page.getByRole('row').filter({ hasText: 'DKT-E2E-001' }).getByText('Approved'),
    ).toBeVisible();
  });
});

test.describe('Subcontractor portal docket editing', () => {
  test('rejects encoded plant hours before adding docket entries', async ({ page }) => {
    const api = await mockSubcontractorDocketEditApi(page);

    await page.goto(`/subcontractor-portal/docket/${E2E_DOCKET_ID}`);

    await page.getByRole('button', { name: /Plant/ }).click();
    await page.getByRole('button', { name: /Excavator/ }).click();

    const sheet = page.locator('.fixed').filter({ hasText: 'Add Plant Hours' });
    await expect(sheet).toBeVisible();
    await sheet.getByLabel('Hours Operated').fill('1e2');
    await expect(
      sheet.getByText('Hours operated must be greater than 0 and 24 or less.'),
    ).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Add to Docket' })).toBeDisabled();
    expect(api.getPlantRequestCount()).toBe(0);

    await sheet.getByLabel('Hours Operated').fill('6.5');
    await expect(sheet.getByRole('button', { name: 'Add to Docket' })).toBeEnabled();
    await sheet.getByRole('button', { name: 'Add to Docket' }).click();

    await expect.poll(() => api.getPlantRequestCount()).toBe(1);
    expect(api.getPlantRequest()).toMatchObject({
      plantId: 'e2e-plant',
      hoursOperated: 6.5,
      wetOrDry: 'dry',
    });
    await expect(page.getByText('6.5h × $180/hr')).toBeVisible();
  });
});
