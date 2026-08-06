import { test, expect, type Locator, type Page } from '@playwright/test';
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
  forbidLotLoads?: boolean;
  paginatedLotPages?: Array<(typeof E2E_LOT)[]>;
  lotRequests?: string[];
  lot?: typeof E2E_LOT;
}

/**
 * Register-level tools (export, print, import, bulk create) live behind the
 * header overflow menu so "Create Lot" reads as the single primary action.
 */
async function openRegisterMenu(page: Page) {
  await page.getByRole('button', { name: 'More register actions' }).click();
}

/** Per-row Edit / Clone / Delete live behind the row's overflow kebab. */
async function openRowActions(row: Locator) {
  await row.getByRole('button', { name: /More actions for lot/ }).click();
}

async function getTextContrastRatio(locator: Locator) {
  return locator.evaluate((element) => {
    const parseRgb = (color: string) => {
      const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!match) return null;
      return {
        r: Number(match[1]) / 255,
        g: Number(match[2]) / 255,
        b: Number(match[3]) / 255,
      };
    };

    const linearize = (channel: number) =>
      channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

    const luminance = (rgb: { r: number; g: number; b: number }) =>
      0.2126 * linearize(rgb.r) + 0.7152 * linearize(rgb.g) + 0.0722 * linearize(rgb.b);

    const styles = window.getComputedStyle(element);
    const foreground = parseRgb(styles.color);
    const background = parseRgb(styles.backgroundColor);

    if (!foreground || !background) return 0;

    const foregroundLum = luminance(foreground);
    const backgroundLum = luminance(background);
    const lighter = Math.max(foregroundLum, backgroundLum);
    const darker = Math.min(foregroundLum, backgroundLum);
    return (lighter + 0.05) / (darker + 0.05);
  });
}

async function mockSeededLotsApi(page: Page, options: MockSeededLotsOptions = {}) {
  let lotLoadAttempts = 0;
  let createRequest: unknown;
  let bulkCreateRequest: unknown;
  let updateRequest: unknown;
  let cloneRequestCount = 0;
  const seededLot = options.lot ?? E2E_LOT;

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
      options.lotRequests?.push(`${url.pathname}${url.search}`);
      if (options.forbidLotLoads) {
        await json({ error: { message: 'You do not have access to this project' } }, 403);
        return;
      }
      if (lotLoadAttempts <= (options.failLotLoadsUntil ?? 0)) {
        await json({ message: 'Lots temporarily unavailable' }, 500);
        return;
      }

      if (options.paginatedLotPages) {
        const page = Number(url.searchParams.get('page') || '1');
        const limit = Number(url.searchParams.get('limit') || '20');
        const lots = options.paginatedLotPages[page - 1] ?? [];
        const total = options.paginatedLotPages.reduce(
          (count, lotPage) => count + lotPage.length,
          0,
        );

        await json({
          lots,
          pagination: {
            total,
            page,
            limit,
            totalPages: options.paginatedLotPages.length,
            hasNextPage: page < options.paginatedLotPages.length,
            hasPrevPage: page > 1,
          },
        });
        return;
      }

      await json({ lots: [seededLot] });
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

    // W2-PR2 deterministic matcher: the create-lot modal asks this per activity
    // and surfaces the Tier-A candidate under "Suggested". Return the seeded
    // template as the exact match for the default 'earthworks_general' activity.
    // The Tier-A effect runs reset-then-suggest on open (keyed on isOpen), so
    // the match made while the modal was mounted-but-closed pre-selects cleanly.
    if (
      url.pathname === '/api/itp/templates/match' &&
      url.searchParams.get('projectId') === E2E_PROJECT_ID
    ) {
      await json({
        tier: 'A',
        suggestedTemplateId: E2E_ITP_TEMPLATE_ID,
        candidates: [
          {
            id: E2E_ITP_TEMPLATE_ID,
            name: 'E2E Earthworks ITP',
            scope: 'project',
            stateSpec: null,
            matchKind: 'exact',
            checklistItemCount: 2,
            holdPointCount: 1,
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
      await json({ lot: seededLot });
      return;
    }

    if (url.pathname === `/api/lots/${E2E_LOT_ID}` && route.request().method() === 'PATCH') {
      updateRequest = route.request().postDataJSON();
      await json({
        lot: {
          ...seededLot,
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
          currentUserRole: 'project_manager',
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

    // Wave B B2 lot register importer. The register lists earlier batches on
    // load; the importer offers mapping profiles when it opens. Corporate
    // masters are deliberately not served — that query is disabled for
    // kind=lot_register (only ITP sets travel between projects).
    if (url.pathname === `/api/projects/${E2E_PROJECT_ID}/copilot/imports`) {
      await json({ batches: [] });
      return;
    }

    if (url.pathname === `/api/projects/${E2E_PROJECT_ID}/copilot/imports-profiles`) {
      await json({
        builtIn: [
          {
            key: 'generic_au_lot_register_excel',
            name: 'Generic AU lot register (Excel)',
            fieldMap: [],
          },
        ],
        saved: [],
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
  test('renders the seeded lot register with hard assertions @pr-smoke', async ({ page }) => {
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

  test('shows a readable mobile filter control beside lot search', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockSeededLotsApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/lots`);

    await expect(page.getByRole('heading', { name: 'Lot Register' })).toBeVisible();
    await expect(page.getByPlaceholder('Search lots...')).toBeVisible();

    const filterButton = page.getByRole('button', { name: /Filter/i }).first();
    await expect(filterButton).toBeVisible();
    await expect(filterButton).toContainText(/Filter/i);
    await expect.poll(() => getTextContrastRatio(filterButton)).toBeGreaterThanOrEqual(4.5);
  });

  test('exports lots with a project-name CSV filename', async ({ page }) => {
    await mockSeededLotsApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/lots`);

    await expect(page.getByRole('row').filter({ hasText: 'LOT-001' })).toBeVisible();
    await expect(page.getByText('Manage lots for E2E Highway Upgrade')).toBeVisible();
    await openRegisterMenu(page);
    await page.getByRole('menuitem', { name: 'Export CSV' }).click();

    const modal = page.getByRole('dialog', { name: /Export Lots to CSV/ });
    await expect(modal).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await modal.getByRole('button', { name: 'Export CSV' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(
      /^lot-register-e2e-highway-upgrade-\d{4}-\d{2}-\d{2}\.csv$/,
    );
    expect(download.suggestedFilename()).not.toContain(E2E_PROJECT_ID);
    await download.delete();
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

  test('shows access denied for forbidden project lots instead of the register shell', async ({
    page,
  }) => {
    await mockSeededLotsApi(page, { forbidLotLoads: true });

    await page.goto(`/projects/${E2E_PROJECT_ID}/lots`);

    await expect(page.getByRole('heading', { name: 'Access Denied' })).toBeVisible();
    await expect(page.getByText('You do not have access to this project')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Lot Register' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Create Lot', exact: true })).toHaveCount(0);
    await expect(page.getByText('No lots yet')).toHaveCount(0);
  });

  test('loads every lot page so the register and CSV export are not truncated', async ({
    page,
  }) => {
    const lotRequests: string[] = [];
    const secondPageLot = {
      ...E2E_LOT,
      id: 'e2e-lot-page-2',
      lotNumber: 'LOT-101',
      description: 'Second API page lot',
    };

    await mockSeededLotsApi(page, {
      paginatedLotPages: [[E2E_LOT], [secondPageLot]],
      lotRequests,
    });

    await page.goto(`/projects/${E2E_PROJECT_ID}/lots`);

    await expect(page.getByRole('row').filter({ hasText: 'LOT-001' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'LOT-101' })).toBeVisible();
    expect(lotRequests.some((requestUrl) => requestUrl.includes('page=1&limit=100'))).toBe(true);
    expect(lotRequests.some((requestUrl) => requestUrl.includes('page=2&limit=100'))).toBe(true);
  });

  test('creates a lot with trimmed values and the suggested ITP template', async ({ page }) => {
    const api = await mockSeededLotsApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/lots`);
    await expect(page.getByRole('row').filter({ hasText: 'LOT-001' })).toBeVisible();

    await page.getByRole('button', { name: 'Create Lot', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Create New Lot' })).toBeVisible();
    const modal = page.locator('[role="dialog"]').filter({ hasText: 'Create New Lot' });
    await expect(modal.getByLabel(/Lot Number/)).toHaveValue('LOT-002');
    // The Tier-A match pre-selects the exact-slug template on open (still
    // editable) — asserted without a manual pick, guarding the always-mounted
    // reset-vs-suggest ordering fixed after W2-PR2.
    await expect(modal.getByRole('option', { name: /E2E Earthworks ITP/ })).toBeAttached();
    await expect(modal.getByLabel('ITP Template (Optional)')).toHaveValue(E2E_ITP_TEMPLATE_ID);

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
      activityType: 'earthworks_general',
      chainageStart: 250.5,
      chainageEnd: 300.75,
      itpTemplateId: E2E_ITP_TEMPLATE_ID,
    });
  });

  test('bulk creates lots without truncating decimal chainage', async ({ page }) => {
    const api = await mockSeededLotsApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/lots`);
    await openRegisterMenu(page);
    await page.getByRole('menuitem', { name: 'Bulk Create Lots' }).click();

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

  test('rejects bulk lot previews above the backend bulk-create cap', async ({ page }) => {
    const api = await mockSeededLotsApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/lots`);
    await openRegisterMenu(page);
    await page.getByRole('menuitem', { name: 'Bulk Create Lots' }).click();

    await page.getByLabel('Start Chainage (m)').fill('0');
    await page.getByLabel('End Chainage (m)').fill('501');
    await page.getByLabel('Lot Interval (m)').fill('1');

    await expect(page.getByText(/This will create approximately\s*501\s*lots/)).toBeVisible();
    await expect(page.getByText(/Bulk create supports up to 500 lots/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(api.getBulkCreateRequest()).toBeUndefined();
  });

  test('rejects bulk lot intervals that do not advance after rounding', async ({ page }) => {
    const api = await mockSeededLotsApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/lots`);
    await openRegisterMenu(page);
    await page.getByRole('menuitem', { name: 'Bulk Create Lots' }).click();

    await page.getByLabel('Start Chainage (m)').fill('0');
    await page.getByLabel('End Chainage (m)').fill('0.0000003');
    await page.getByLabel('Lot Interval (m)').fill('0.0000001');

    await expect(
      page.getByText(/Lot interval is too small to create distinct chainage ranges/),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(api.getBulkCreateRequest()).toBeUndefined();
  });

  // #1631 retired the client-side CSV importer this test used to drive. Parsing
  // (chainage included) now runs server-side in the dry run, covered by
  // backend/src/routes/copilot/import/lotRegisterDryRun.test.ts. What is left
  // for E2E is the entry point: the register's button opens the importer.
  test('opens the register importer from the lots page', async ({ page }) => {
    await mockSeededLotsApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/lots`);
    await openRegisterMenu(page);
    await page.getByRole('menuitem', { name: 'Import Register' }).click();

    await expect(page.getByText('Import lots from a register')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Choose file' })).toBeVisible();
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

  test('allows commercial budget edits on conformed lots without unlocking QA fields', async ({
    page,
  }) => {
    const api = await mockSeededLotsApi(page, {
      lot: {
        ...E2E_LOT,
        status: 'conformed',
        budgetAmount: null,
      },
    });

    await page.goto(`/projects/${E2E_PROJECT_ID}/lots/${E2E_LOT_ID}/edit`);

    await expect(page.getByRole('heading', { name: 'Edit Lot' })).toBeVisible();
    await expect(page.getByText('Only the commercial budget can be edited')).toBeVisible();
    await expect(page.getByLabel('Lot Number')).toBeDisabled();
    await expect(page.getByLabel('Status')).toBeDisabled();
    await expect(page.getByLabel('Budget Amount ($)')).toBeEnabled();

    await page.getByLabel('Budget Amount ($)').fill('48000');
    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect
      .poll(() => api.getUpdateRequest())
      .toEqual({
        budgetAmount: 48000,
        expectedUpdatedAt: '2026-01-15T00:00:00.000Z',
      });
  });

  test('clones a lot without issuing duplicate clone requests', async ({ page }) => {
    const api = await mockSeededLotsApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/lots`);
    const lotRow = page.getByRole('row').filter({ hasText: 'LOT-001' });
    await expect(lotRow).toBeVisible();

    await openRowActions(lotRow);
    await page.getByRole('menuitem', { name: 'Clone' }).dblclick();

    await expect(page.getByRole('row').filter({ hasText: 'LOT-001-COPY' })).toBeVisible();
    expect(api.getCloneRequestCount()).toBe(1);
  });
});

test.describe('Lot register layout', () => {
  /** Eight neighbouring chainage lots — the shape the register actually holds. */
  async function seedRegister(page: Page) {
    const lots = Array.from({ length: 8 }, (_, index) => ({
      ...E2E_LOT,
      id: `layout-lot-${index}`,
      lotNumber: `LOT-${String(index + 1).padStart(3, '0')}`,
      description: `LOT-${2000 + index * 100}-${2100 + index * 100}`,
      activityType: 'earthworks_general',
      chainageStart: 2000 + index * 100,
      chainageEnd: 2100 + index * 100,
      status: 'not_started',
      budgetAmount: null,
      assignedSubcontractorId: null,
      assignedSubcontractor: null,
    }));
    await mockSeededLotsApi(page, { paginatedLotPages: [lots] });
  }

  test('keeps the whole table inside its container at 1440px', async ({ page }) => {
    // The register used to overflow here, clipping the last row action to "Cl".
    await seedRegister(page);
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto(`/projects/${E2E_PROJECT_ID}/lots`);
    await expect(page.getByRole('row').filter({ hasText: 'LOT-001' })).toBeVisible();

    const overflow = await page
      .getByTestId('scrollable-table-container')
      .evaluate((el) => el.scrollWidth - el.clientWidth);

    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('keeps the last lot card clear of the create-lot FAB on a phone', async ({ page }) => {
    await seedRegister(page);
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto(`/projects/${E2E_PROJECT_ID}/lots`);
    await expect(page.getByText('LOT-001').first()).toBeVisible();

    const list = page.getByTestId('card-view-container');
    await list.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
    await expect(page.getByText('Showing all 8 lots')).toBeVisible();

    const { lastCardBottom, fabTop } = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('[data-testid^="lot-card-"]'));
      const fab = document.querySelector('[aria-label="Open actions"]');
      return {
        lastCardBottom: Math.max(...cards.map((card) => card.getBoundingClientRect().bottom)),
        fabTop: fab!.getBoundingClientRect().top,
      };
    });

    expect(lastCardBottom).toBeLessThanOrEqual(fabTop);
  });
});
