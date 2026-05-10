import { test, expect, type Page } from '@playwright/test';
import { E2E_ADMIN_USER, E2E_PROJECT_ID, mockAuthenticatedUserState } from './helpers';

const E2E_LOT_ID = 'e2e-lot';
const E2E_CREATED_LOT_ID = 'e2e-created-lot';
const E2E_CLONED_LOT_ID = 'e2e-cloned-lot';
const E2E_ITP_TEMPLATE_ID = 'e2e-itp-template';
const E2E_LOT = {
  id: E2E_LOT_ID,
  lotNumber: 'LOT-001',
  description: 'E2E test lot',
  status: 'in_progress',
  activityType: 'Earthworks',
  chainageStart: 100,
  chainageEnd: 200,
  offset: null,
  offsetCustom: null,
  layer: null,
  areaZone: null,
  budgetAmount: 1000,
  assignedSubcontractorId: 'e2e-subcontractor-company',
  assignedSubcontractor: { companyName: 'E2E Subcontractors' },
  createdAt: '2026-01-15T00:00:00.000Z',
  updatedAt: '2026-01-15T00:00:00.000Z',
  itpCount: 1,
  testCount: 0,
  documentCount: 0,
  ncrCount: 0,
  holdPointCount: 1,
};

interface MockSeededLotsOptions {
  failLotLoadsUntil?: number;
}

async function mockSeededLotsApi(page: Page, options: MockSeededLotsOptions = {}) {
  let lotLoadAttempts = 0;
  let createRequest: unknown;
  let bulkCreateRequest: unknown;
  let updateRequest: unknown;
  let cloneRequestCount = 0;

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });

    if (url.pathname === '/api/auth/me') {
      await json({ user: E2E_ADMIN_USER });
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

    if (url.pathname === '/api/lots' && url.searchParams.get('projectId') === E2E_PROJECT_ID) {
      lotLoadAttempts += 1;
      if (lotLoadAttempts <= (options.failLotLoadsUntil ?? 0)) {
        await json({ message: 'Lots temporarily unavailable' }, 500);
        return;
      }

      await json({ lots: [E2E_LOT] });
      return;
    }

    if (
      url.pathname === '/api/lots/suggest-number' &&
      url.searchParams.get('projectId') === E2E_PROJECT_ID
    ) {
      await json({ suggestedNumber: 'LOT-002' });
      return;
    }

    if (
      url.pathname === '/api/itp/templates' &&
      url.searchParams.get('projectId') === E2E_PROJECT_ID
    ) {
      await json({
        templates: [
          {
            id: E2E_ITP_TEMPLATE_ID,
            name: 'E2E Earthworks ITP',
            activityType: 'Earthworks',
            isActive: true,
          },
        ],
      });
      return;
    }

    if (url.pathname === '/api/lots' && route.request().method() === 'POST') {
      createRequest = route.request().postDataJSON();
      await json({
        lot: {
          ...E2E_LOT,
          id: E2E_CREATED_LOT_ID,
          lotNumber: (createRequest as { lotNumber: string }).lotNumber,
          description: (createRequest as { description?: string | null }).description,
          activityType: (createRequest as { activityType: string }).activityType,
          chainageStart: (createRequest as { chainageStart?: number | null }).chainageStart,
          chainageEnd: (createRequest as { chainageEnd?: number | null }).chainageEnd,
          assignedSubcontractorId: null,
          assignedSubcontractor: null,
        },
      });
      return;
    }

    if (url.pathname === '/api/lots/bulk' && route.request().method() === 'POST') {
      bulkCreateRequest = route.request().postDataJSON();
      await json({ count: (bulkCreateRequest as { lots: unknown[] }).lots.length });
      return;
    }

    if (url.pathname === `/api/lots/${E2E_LOT_ID}` && route.request().method() === 'GET') {
      await json({ lot: E2E_LOT });
      return;
    }

    if (url.pathname === `/api/lots/${E2E_LOT_ID}` && route.request().method() === 'PATCH') {
      updateRequest = route.request().postDataJSON();
      await json({
        lot: {
          ...E2E_LOT,
          ...(updateRequest as object),
          updatedAt: '2026-01-15T01:00:00.000Z',
        },
      });
      return;
    }

    if (url.pathname === `/api/lots/${E2E_LOT_ID}/clone` && route.request().method() === 'POST') {
      cloneRequestCount += 1;
      await json({
        lot: {
          ...E2E_LOT,
          id: E2E_CLONED_LOT_ID,
          lotNumber: 'LOT-001-COPY',
          description: 'Cloned E2E test lot',
        },
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

    if (url.pathname === `/api/projects/${E2E_PROJECT_ID}/areas`) {
      await json({ areas: [] });
      return;
    }

    if (url.pathname === `/api/subcontractors/for-project/${E2E_PROJECT_ID}`) {
      await json({
        subcontractors: [
          {
            id: 'e2e-subcontractor-company',
            companyName: 'E2E Subcontractors',
          },
        ],
      });
      return;
    }

    await json({ message: `Unhandled E2E API route: ${url.pathname}` }, 404);
  });

  await mockAuthenticatedUserState(page);

  return {
    getCreateRequest: () => createRequest,
    getBulkCreateRequest: () => bulkCreateRequest,
    getUpdateRequest: () => updateRequest,
    getCloneRequestCount: () => cloneRequestCount,
    getLotLoadAttempts: () => lotLoadAttempts,
  };
}

test.describe('Lots seeded UI contract', () => {
  test('renders the seeded lot register with hard assertions', async ({ page }) => {
    await mockSeededLotsApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/lots`);

    await expect(page.getByRole('heading', { name: 'Lot Register' })).toBeVisible();
    await expect(page.getByText('Manage lots for E2E Highway Upgrade')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Lot', exact: true })).toBeVisible();

    const lotRow = page.getByRole('row').filter({ hasText: 'LOT-001' });
    await expect(lotRow).toBeVisible();
    await expect(lotRow.getByText('E2E test lot')).toBeVisible();
    await expect(lotRow.getByRole('cell', { name: 'Earthworks' })).toBeVisible();
    await expect(lotRow.getByText('E2E Subcontractors')).toBeVisible();
    await expect(lotRow.getByRole('button', { name: 'View' })).toBeVisible();
  });

  test('shows retry instead of an empty state when lot loading fails', async ({ page }) => {
    const api = await mockSeededLotsApi(page, { failLotLoadsUntil: 1 });

    await page.goto(`/projects/${E2E_PROJECT_ID}/lots`);

    await expect(page.getByRole('alert')).toContainText('Lots temporarily unavailable');
    await expect(page.getByText('No lots yet')).toHaveCount(0);

    await page.getByRole('button', { name: 'Try again' }).click();

    await expect(page.getByRole('row').filter({ hasText: 'LOT-001' })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(api.getLotLoadAttempts()).toBeGreaterThanOrEqual(2);
  });

  test('creates a lot with trimmed values and the suggested ITP template', async ({ page }) => {
    const api = await mockSeededLotsApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/lots`);
    await expect(page.getByRole('row').filter({ hasText: 'LOT-001' })).toBeVisible();

    await page.getByRole('button', { name: 'Create Lot', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Create New Lot' })).toBeVisible();
    const modal = page.locator('[role="dialog"]').filter({ hasText: 'Create New Lot' });
    await expect(modal.getByLabel(/Lot Number/)).toHaveValue('LOT-002');
    await expect(modal.getByText(/Suggested ITP Template:\s*E2E Earthworks ITP/)).toBeVisible();

    await modal.getByLabel(/Lot Number/).fill('  LOT-002  ');
    await modal.getByLabel('Description').fill('  Created from E2E  ');
    await modal.getByLabel('Chainage Start').fill('1e2');
    await modal.getByLabel('Chainage End').fill('300.75');
    await modal.getByRole('button', { name: 'Create Lot' }).click();

    await expect(modal.getByText('Chainage Start must be a valid number')).toBeVisible();
    expect(api.getCreateRequest()).toBeUndefined();

    await modal.getByLabel('Chainage Start').fill('250.5');
    await modal.getByLabel('Chainage End').fill('300.75');
    await modal.getByRole('button', { name: 'Create Lot' }).click();

    await expect(page.getByRole('row').filter({ hasText: 'LOT-002' })).toBeVisible();
    expect(api.getCreateRequest()).toMatchObject({
      projectId: E2E_PROJECT_ID,
      lotNumber: 'LOT-002',
      description: 'Created from E2E',
      activityType: 'Earthworks',
      chainageStart: 250.5,
      chainageEnd: 300.75,
      itpTemplateId: E2E_ITP_TEMPLATE_ID,
    });
  });

  test('bulk creates lots without truncating decimal chainage', async ({ page }) => {
    const api = await mockSeededLotsApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/lots`);
    await page.getByRole('button', { name: 'Bulk Create Lots' }).click();

    await expect(page.getByText('Step 1: Define Chainage Range')).toBeVisible();
    await page.getByLabel('Start Chainage (m)').fill('1e2');
    await page.getByLabel('End Chainage (m)').fill('35.75');
    await page.getByLabel('Lot Interval (m)').fill('10.25');
    await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();

    await page.getByLabel('Start Chainage (m)').fill('10.5');
    await page.getByLabel('End Chainage (m)').fill('35.75');
    await page.getByLabel('Lot Interval (m)').fill('10.25');
    await expect(page.getByText(/This will create approximately\s*3\s*lots/)).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();

    await page.getByLabel('Lot Number Prefix').fill('DEC');
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('10.5 - 20.75')).toBeVisible();
    await expect(page.getByText('20.75 - 31')).toBeVisible();
    await expect(page.getByText('31 - 35.75')).toBeVisible();

    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Create Lots', exact: true }).click();

    expect(api.getBulkCreateRequest()).toMatchObject({
      projectId: E2E_PROJECT_ID,
      lots: [
        { lotNumber: 'DEC-001', chainageStart: 10.5, chainageEnd: 20.75 },
        { lotNumber: 'DEC-002', chainageStart: 20.75, chainageEnd: 31 },
        { lotNumber: 'DEC-003', chainageStart: 31, chainageEnd: 35.75 },
      ],
    });
  });

  test('imports CSV lots with strict chainage parsing', async ({ page }) => {
    const api = await mockSeededLotsApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/lots`);
    await page.getByRole('button', { name: 'Import CSV' }).click();
    await expect(page.getByText('Import Lots from CSV')).toBeVisible();

    await page.locator('input[type="file"]').setInputFiles({
      name: 'bad-lots.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        'lot_number,description,chainage_start,chainage_end,activity_type\nBAD-001,Bad chainage,1e2,20,Earthworks\n',
      ),
    });

    await expect(page.getByText('Invalid chainage start value')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Import 1 Lots' })).toBeDisabled();

    await page.getByRole('button', { name: 'Upload Different File' }).click();
    await page.locator('input[type="file"]').setInputFiles({
      name: 'decimal-lots.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        [
          'lot_number,description,chainage_start,chainage_end,activity_type',
          'CSV-001,Decimal import one,10.5,20.75,Earthworks',
          'CSV-002,Decimal import two,20.75,31.25,Drainage',
        ].join('\n'),
      ),
    });

    await expect(page.getByText('All 2 rows passed validation. Ready to import!')).toBeVisible();
    await page.getByRole('button', { name: 'Import 2 Lots' }).click();

    expect(api.getBulkCreateRequest()).toMatchObject({
      projectId: E2E_PROJECT_ID,
      lots: [
        { lotNumber: 'CSV-001', chainageStart: 10.5, chainageEnd: 20.75 },
        { lotNumber: 'CSV-002', chainageStart: 20.75, chainageEnd: 31.25 },
      ],
    });
  });

  test('edits a lot without accepting encoded decimal inputs', async ({ page }) => {
    const api = await mockSeededLotsApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/lots/${E2E_LOT_ID}/edit`);

    await expect(page.getByRole('heading', { name: 'Edit Lot' })).toBeVisible();
    await page.getByLabel('Chainage Start').fill('1e2');
    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect(
      page.getByText('Chainage start must be a non-negative decimal number.'),
    ).toBeVisible();
    expect(api.getUpdateRequest()).toBeUndefined();

    await page.getByLabel('Chainage Start').fill('250.5');
    await page.getByLabel('Chainage End').fill('300.75');
    await page.getByLabel('Budget Amount ($)').fill('1e2');
    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect(
      page.getByText('Budget amount must be a non-negative decimal number.'),
    ).toBeVisible();
    expect(api.getUpdateRequest()).toBeUndefined();

    await page.getByLabel('Budget Amount ($)').fill('1250.25');
    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect
      .poll(() => api.getUpdateRequest())
      .toMatchObject({
        chainageStart: 250.5,
        chainageEnd: 300.75,
        budgetAmount: 1250.25,
      });
  });

  test('clones a lot without issuing duplicate clone requests', async ({ page }) => {
    const api = await mockSeededLotsApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/lots`);
    const lotRow = page.getByRole('row').filter({ hasText: 'LOT-001' });
    await expect(lotRow).toBeVisible();

    await lotRow.getByRole('button', { name: 'Clone' }).dblclick();

    await expect(page.getByRole('row').filter({ hasText: 'LOT-001-COPY' })).toBeVisible();
    expect(api.getCloneRequestCount()).toBe(1);
  });
});
