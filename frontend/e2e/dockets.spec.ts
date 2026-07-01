import { test, expect, type Page } from '@playwright/test';
import { E2E_ADMIN_USER, E2E_PROJECT_ID, mockAuthenticatedUserState } from './helpers';

const E2E_DOCKET_ID = 'e2e-docket';
type DocketStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'queried';

type SeededDocketsApiOptions = {
  failDocketLoadsUntil?: number;
  approveDelayMs?: number;
  user?: typeof E2E_ADMIN_USER;
  dockets?: ReturnType<typeof buildDocket>[];
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const E2E_SUBCONTRACTOR_USER = {
  ...E2E_ADMIN_USER,
  id: 'e2e-subcontractor-user',
  role: 'subcontractor_admin',
  roleInCompany: 'subcontractor_admin',
  companyId: null,
  hasSubcontractorPortalAccess: true,
};

function buildDocket(
  status: DocketStatus = 'pending_approval',
  overrides: { foremanNotes?: string | null; notes?: string | null } = {},
) {
  const isApproved = status === 'approved';
  return {
    id: E2E_DOCKET_ID,
    docketNumber: 'DKT-E2E-001',
    subcontractor: 'E2E Subcontractors',
    subcontractorId: 'e2e-subcontractor-company',
    date: '2026-01-15',
    status,
    notes: overrides.notes ?? 'E2E seeded docket',
    labourHours: 8,
    plantHours: 3,
    totalLabourSubmitted: 8,
    totalLabourApproved: isApproved ? 8 : 0,
    totalPlantSubmitted: 3,
    totalPlantApproved: isApproved ? 3 : 0,
    submittedAt: '2026-01-15T05:00:00.000Z',
    approvedAt: isApproved ? '2026-01-15T06:00:00.000Z' : null,
    foremanNotes: overrides.foremanNotes ?? (isApproved ? 'Approved in E2E' : null),
  };
}

async function mockSeededDocketsApi(page: Page, options: SeededDocketsApiOptions = {}) {
  let docketStatus: DocketStatus = 'pending_approval';
  let foremanNotes: string | null = null;
  let createRequest: unknown;
  let createRequestCount = 0;
  let approveRequest: unknown;
  let approveRequestCount = 0;
  let rejectRequest: unknown;
  let rejectRequestCount = 0;
  let queryRequest: unknown;
  let queryRequestCount = 0;
  let docketLoadCount = 0;
  let projectRequestCount = 0;
  let failNextProjectLookup = false;

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
      await json({
        dockets: options.dockets ?? [buildDocket(docketStatus, { foremanNotes })],
      });
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
      projectRequestCount += 1;
      if (failNextProjectLookup) {
        failNextProjectLookup = false;
        await json({ message: 'Project metadata unavailable' }, 500);
        return;
      }
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
      const isApproved = docketStatus === 'approved';
      await json({
        docket: {
          ...buildDocket(docketStatus, { foremanNotes }),
          labourEntries: [
            {
              id: 'e2e-labour-entry',
              employee: { name: 'E2E Labourer', role: 'Operator' },
              startTime: '07:00',
              finishTime: '15:00',
              submittedHours: 8,
              approvedHours: isApproved ? 8 : 0,
              hourlyRate: 90,
              submittedCost: 720,
              approvedCost: isApproved ? 720 : 0,
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
              approvedCost: isApproved ? 480 : 0,
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
      docketStatus = 'approved';
      foremanNotes =
        (approveRequest as { foremanNotes?: string | null } | null)?.foremanNotes ?? null;
      await json({ docket: buildDocket('approved', { foremanNotes }) });
      return;
    }

    if (url.pathname === `/api/dockets/${E2E_DOCKET_ID}/reject`) {
      rejectRequest = route.request().postDataJSON();
      rejectRequestCount += 1;
      docketStatus = 'rejected';
      foremanNotes = (rejectRequest as { reason?: string } | null)?.reason ?? null;
      await json({ docket: buildDocket('rejected', { foremanNotes }) });
      return;
    }

    if (url.pathname === `/api/dockets/${E2E_DOCKET_ID}/query`) {
      queryRequest = route.request().postDataJSON();
      queryRequestCount += 1;
      docketStatus = 'queried';
      foremanNotes = (queryRequest as { questions?: string } | null)?.questions ?? null;
      await json({ docket: buildDocket('queried', { foremanNotes }) });
      return;
    }

    await json({ message: `Unhandled E2E API route: ${url.pathname}` }, 404);
  });

  await mockAuthenticatedUserState(page, options.user ?? E2E_ADMIN_USER);

  return {
    getCreateRequest: () => createRequest,
    getCreateRequestCount: () => createRequestCount,
    getApproveRequest: () => approveRequest,
    getApproveRequestCount: () => approveRequestCount,
    getRejectRequest: () => rejectRequest,
    getRejectRequestCount: () => rejectRequestCount,
    getQueryRequest: () => queryRequest,
    getQueryRequestCount: () => queryRequestCount,
    getDocketLoadCount: () => docketLoadCount,
    getProjectRequestCount: () => projectRequestCount,
    failNextProjectLookup: () => {
      failNextProjectLookup = true;
    },
  };
}

async function mockSubcontractorDocketEditApi(
  page: Page,
  options: { status?: DocketStatus; foremanNotes?: string | null; notes?: string | null } = {},
) {
  let docketStatus = options.status ?? 'draft';
  let docketNotes = options.notes ?? 'E2E seeded docket';
  let plantRequest: unknown;
  let plantRequestCount = 0;
  let respondRequest: unknown;
  let respondRequestCount = 0;
  let submitRequestCount = 0;

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

    if (url.pathname === '/api/dockets') {
      await json({
        dockets: [
          buildDocket(docketStatus, { foremanNotes: options.foremanNotes, notes: docketNotes }),
        ],
      });
      return;
    }

    if (url.pathname === `/api/dockets/${E2E_DOCKET_ID}` && route.request().method() === 'GET') {
      await json({
        docket: {
          ...buildDocket(docketStatus, {
            foremanNotes: options.foremanNotes,
            notes: docketNotes,
          }),
          labourEntries:
            docketStatus === 'queried' || docketStatus === 'rejected'
              ? [
                  {
                    id: 'e2e-labour-entry',
                    employee: { id: 'e2e-employee', name: 'E2E Labourer', role: 'Operator' },
                    startTime: '07:00',
                    finishTime: '15:00',
                    submittedHours: 8,
                    hourlyRate: 90,
                    submittedCost: 720,
                    lotAllocations: [{ lotId: 'e2e-lot', lotNumber: 'LOT-E2E-001', hours: 8 }],
                  },
                ]
              : [],
          plantEntries: [],
          totalLabourSubmitted: docketStatus === 'queried' || docketStatus === 'rejected' ? 720 : 0,
          totalPlantSubmitted: 0,
        },
      });
      return;
    }

    if (url.pathname === `/api/dockets/${E2E_DOCKET_ID}` && route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON() as { notes?: string };
      docketNotes = body.notes ?? docketNotes;
      await json({
        docket: buildDocket(docketStatus, {
          foremanNotes: options.foremanNotes,
          notes: docketNotes,
        }),
      });
      return;
    }

    if (
      url.pathname === `/api/dockets/${E2E_DOCKET_ID}/respond` &&
      route.request().method() === 'POST'
    ) {
      respondRequest = route.request().postDataJSON();
      respondRequestCount += 1;
      docketStatus = 'pending_approval';
      await json({ docket: buildDocket('pending_approval', { notes: docketNotes }) });
      return;
    }

    if (
      url.pathname === `/api/dockets/${E2E_DOCKET_ID}/submit` &&
      route.request().method() === 'POST'
    ) {
      submitRequestCount += 1;
      docketStatus = 'pending_approval';
      await json({ docket: buildDocket('pending_approval', { notes: docketNotes }) });
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
        lotAllocations?: Array<{ lotId: string; hours: number }>;
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
            lotAllocations: body.lotAllocations?.map((allocation) => ({
              ...allocation,
              lotNumber: 'LOT-E2E-001',
            })),
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
    getRespondRequest: () => respondRequest,
    getRespondRequestCount: () => respondRequestCount,
    getSubmitRequestCount: () => submitRequestCount,
  };
}

test.describe('Dockets seeded approval contract', () => {
  test('renders and approves the seeded pending docket with hard assertions @pr-smoke', async ({
    page,
  }) => {
    const api = await mockSeededDocketsApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/dockets`);

    await expect(page.getByRole('heading', { name: 'Docket Approvals' })).toBeVisible();
    await expect(page.getByText('project E2E Highway Upgrade')).toBeVisible();
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

  test('shows explicit approve and reject actions on mobile pending docket cards', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockSeededDocketsApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/dockets?status=pending_approval`);

    await expect(page.getByText('DKT-E2E-001')).toBeVisible();
    const approveButton = page.getByRole('button', { name: 'Approve', exact: true });
    await expect(approveButton).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reject', exact: true })).toBeVisible();

    await approveButton.click();
    await expect(page.getByRole('dialog', { name: 'Approve Docket' })).toBeVisible();
  });

  test('rejects a pending docket with a required reason and updates the row status', async ({
    page,
  }) => {
    const api = await mockSeededDocketsApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/dockets`);

    const docketRow = page.getByRole('row').filter({ hasText: 'DKT-E2E-001' });
    await expect(docketRow).toBeVisible();
    await docketRow.getByRole('button', { name: 'Reject' }).click();

    const modal = page.getByRole('dialog', { name: 'Reject Docket' });
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('button', { name: 'Reject' })).toBeDisabled();

    await modal.getByLabel(/Rejection Reason/).fill('  Missing signed dayworks docket  ');
    await modal.getByRole('button', { name: 'Reject' }).click();

    await expect.poll(() => api.getRejectRequestCount()).toBe(1);
    expect(api.getRejectRequest()).toEqual({
      reason: 'Missing signed dayworks docket',
    });
    await expect(page.getByRole('button', { name: 'Pending (0)' })).toBeVisible();
    await expect(
      page.getByRole('row').filter({ hasText: 'DKT-E2E-001' }).getByText('Rejected'),
    ).toBeVisible();
  });

  test('queries a pending docket and records the foreman question payload', async ({ page }) => {
    const api = await mockSeededDocketsApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/dockets`);

    const docketRow = page.getByRole('row').filter({ hasText: 'DKT-E2E-001' });
    await expect(docketRow).toBeVisible();
    await docketRow.getByRole('button', { name: 'Query' }).click();

    const modal = page.getByRole('dialog', { name: 'Query Docket' });
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('button', { name: 'Send Query' })).toBeDisabled();

    await modal.getByLabel(/Query Details/).fill('  Please confirm the cartage hours  ');
    await modal.getByRole('button', { name: 'Send Query' }).click();

    await expect.poll(() => api.getQueryRequestCount()).toBe(1);
    expect(api.getQueryRequest()).toEqual({
      questions: 'Please confirm the cartage hours',
    });
    await expect(page.getByRole('button', { name: 'Pending (0)' })).toBeVisible();
    await expect(
      page.getByRole('row').filter({ hasText: 'DKT-E2E-001' }).getByText('Queried'),
    ).toBeVisible();
  });

  test('exports dockets with a project-name CSV filename', async ({ page }) => {
    await mockSeededDocketsApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/dockets`);

    await expect(page.getByRole('row').filter({ hasText: 'DKT-E2E-001' })).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(
      /^dockets-e2e-highway-upgrade-\d{4}-\d{2}-\d{2}\.csv$/,
    );
    expect(download.suggestedFilename()).not.toContain(E2E_PROJECT_ID);
    await download.delete();
  });

  test('downloads a docket PDF from the approvals table', async ({ page }) => {
    await mockSeededDocketsApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/dockets`);

    const docketRow = page.getByRole('row').filter({ hasText: 'DKT-E2E-001' });
    await expect(docketRow).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await docketRow.getByRole('button', { name: 'Print docket' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('Docket-DKT-E2E-001-pending_approval.pdf');
    await expect(page.getByText('Docket PDF downloaded')).toBeVisible();
    await download.delete();
  });

  test('still downloads a docket PDF when project metadata lookup fails during print', async ({
    page,
  }) => {
    const api = await mockSeededDocketsApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/dockets`);

    const docketRow = page.getByRole('row').filter({ hasText: 'DKT-E2E-001' });
    await expect(docketRow).toBeVisible();
    const projectRequestsBeforePrint = api.getProjectRequestCount();
    api.failNextProjectLookup();

    const downloadPromise = page.waitForEvent('download');
    await docketRow.getByRole('button', { name: 'Print docket' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('Docket-DKT-E2E-001-pending_approval.pdf');
    await expect(page.getByText('Docket PDF downloaded')).toBeVisible();
    expect(api.getProjectRequestCount()).toBeGreaterThan(projectRequestsBeforePrint);
    await download.delete();
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

    await expect(modal.getByText('Hours must be a non-negative decimal number.')).toBeVisible();
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

  test('keeps subcontractors out of the project docket approvals workspace @pr-smoke', async ({
    page,
  }) => {
    const api = await mockSeededDocketsApi(page, { user: E2E_SUBCONTRACTOR_USER });

    await page.goto(`/projects/${E2E_PROJECT_ID}/dockets`);

    await expect(page.getByText('Access Denied')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Docket' })).toHaveCount(0);
    expect(api.getCreateRequestCount()).toBe(0);
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

  test('guides empty owner approvals state toward subcontractor setup', async ({ page }) => {
    await mockSeededDocketsApi(page, { dockets: [] });

    await page.goto(`/projects/${E2E_PROJECT_ID}/dockets`);

    await expect(page.getByRole('heading', { name: 'Docket Approvals' })).toBeVisible();
    await expect(page.getByText('No dockets found')).toHaveCount(0);
    await expect(page.getByText('No subcontractor dockets yet')).toBeVisible();
    await expect(page.getByText('Subcontractors submit dockets from their portal.')).toBeVisible();

    const cta = page.getByRole('link', { name: 'Invite a subcontractor' });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', `/projects/${E2E_PROJECT_ID}/subcontractors`);
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
  test('shows a rejected docket reason and lets the subcontractor resubmit it', async ({
    page,
  }) => {
    const api = await mockSubcontractorDocketEditApi(page, {
      status: 'rejected',
      foremanNotes: 'Missing signed dayworks docket',
    });

    await page.goto(
      `/subcontractor-portal/docket/${E2E_DOCKET_ID}?projectId=${E2E_PROJECT_ID}&subcontractorCompanyId=e2e-subcontractor-company`,
    );

    await expect(page.getByText(/Rejection reason/i)).toBeVisible();
    await expect(page.getByText('Missing signed dayworks docket')).toBeVisible();

    const resubmitButton = page.getByRole('button', { name: /Resubmit for Approval/i });
    await expect(resubmitButton).toBeEnabled();
    await resubmitButton.click();

    await expect.poll(() => api.getSubmitRequestCount()).toBe(1);
  });

  test('responds to a queried docket and resubmits it for approval', async ({ page }) => {
    const api = await mockSubcontractorDocketEditApi(page, {
      status: 'queried',
      foremanNotes: 'Please confirm the cartage hours',
    });

    await page.goto(
      `/subcontractor-portal/docket/${E2E_DOCKET_ID}?projectId=${E2E_PROJECT_ID}&subcontractorCompanyId=e2e-subcontractor-company`,
    );

    await expect(page.getByText(/Query from foreman/i)).toBeVisible();
    await expect(page.getByText('Please confirm the cartage hours')).toBeVisible();

    const respondButton = page.getByRole('button', { name: /Respond & Resubmit/i });
    await expect(respondButton).toBeDisabled();

    await page
      .getByPlaceholder('Type your response to the query...')
      .fill('  Cartage hours corrected to 6.5.  ');
    await expect(respondButton).toBeEnabled();
    await respondButton.click();

    await expect.poll(() => api.getRespondRequestCount()).toBe(1);
    expect(api.getRespondRequest()).toEqual({
      response: 'Cartage hours corrected to 6.5.',
    });
  });

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
      lotAllocations: [{ lotId: 'e2e-lot', hours: 6.5 }],
    });
    await expect(page.getByText('6.5h × $180/hr')).toBeVisible();
    await expect(page.getByText('LOT-E2E-001')).toBeVisible();
  });
});
