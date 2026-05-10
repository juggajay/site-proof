import { test, expect, type Page } from '@playwright/test';
import { E2E_ADMIN_USER, E2E_PROJECT_ID, mockAuthenticatedUserState } from './helpers';

type ProjectArea = {
  id: string;
  name: string;
  chainageStart: number | null;
  chainageEnd: number | null;
  colour: string | null;
  createdAt: string;
};

type ProjectAreasApiOptions = {
  failAreaLoadsUntil?: number;
  saveDelayMs?: number;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const centralArea: ProjectArea = {
  id: 'e2e-area-central',
  name: 'Central Works',
  chainageStart: 100,
  chainageEnd: 500,
  colour: '#3B82F6',
  createdAt: '2026-05-01T00:00:00.000Z',
};

const southArea: ProjectArea = {
  id: 'e2e-area-south',
  name: 'South Zone',
  chainageStart: 500,
  chainageEnd: 900,
  colour: '#22C55E',
  createdAt: '2026-05-02T00:00:00.000Z',
};

async function mockProjectAreasApi(page: Page, options: ProjectAreasApiOptions = {}) {
  const areas: ProjectArea[] = [structuredClone(centralArea), structuredClone(southArea)];
  const createRequests: unknown[] = [];
  let updateRequest: { areaId: string; body: unknown } | null = null;
  let deleteAreaId: string | null = null;
  let areaLoadCount = 0;

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

    if (url.pathname === `/api/projects/${E2E_PROJECT_ID}`) {
      await json({
        project: {
          id: E2E_PROJECT_ID,
          name: 'E2E Highway Upgrade',
          projectNumber: 'E2E-001',
          status: 'active',
        },
      });
      return;
    }

    if (url.pathname === `/api/projects/${E2E_PROJECT_ID}/areas`) {
      if (route.request().method() === 'GET') {
        areaLoadCount += 1;
        if (areaLoadCount <= (options.failAreaLoadsUntil ?? 0)) {
          await json({ message: 'Area service unavailable' }, 500);
          return;
        }

        await json({ areas });
        return;
      }

      if (route.request().method() === 'POST') {
        createRequests.push(route.request().postDataJSON());
        if (options.saveDelayMs) {
          await delay(options.saveDelayMs);
        }
        const body = createRequests.at(-1) as Omit<ProjectArea, 'id' | 'createdAt'>;
        const created: ProjectArea = {
          id: 'e2e-area-created',
          name: body.name,
          chainageStart: body.chainageStart,
          chainageEnd: body.chainageEnd,
          colour: body.colour,
          createdAt: '2026-05-09T00:00:00.000Z',
        };
        areas.push(created);
        await json({ area: created }, 201);
        return;
      }
    }

    const areaMatch = url.pathname.match(
      new RegExp(`^/api/projects/${E2E_PROJECT_ID}/areas/([^/]+)$`),
    );
    if (areaMatch) {
      const areaId = areaMatch[1];

      if (route.request().method() === 'PATCH') {
        const body = route.request().postDataJSON();
        updateRequest = { areaId, body };
        if (options.saveDelayMs) {
          await delay(options.saveDelayMs);
        }
        const index = areas.findIndex((area) => area.id === areaId);
        if (index >= 0) {
          areas[index] = {
            ...areas[index],
            ...(body as Partial<ProjectArea>),
          };
          await json({ area: areas[index] });
          return;
        }
        await json({ message: 'Area not found' }, 404);
        return;
      }

      if (route.request().method() === 'DELETE') {
        deleteAreaId = areaId;
        const index = areas.findIndex((area) => area.id === areaId);
        if (index >= 0) {
          areas.splice(index, 1);
        }
        await json({ success: true });
        return;
      }
    }

    await json({ message: `Unhandled E2E API route: ${url.pathname}` }, 404);
  });

  await mockAuthenticatedUserState(page);

  return {
    getCreateRequest: () => createRequests.at(-1) ?? null,
    getCreateRequests: () => createRequests,
    getUpdateRequest: () => updateRequest,
    getDeleteAreaId: () => deleteAreaId,
    getAreaLoadCount: () => areaLoadCount,
  };
}

test.describe('Project areas seeded admin contract', () => {
  test('creates, edits, and deletes project areas', async ({ page }) => {
    const api = await mockProjectAreasApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/areas`);

    await expect(page.getByRole('heading', { name: 'Project Areas' })).toBeVisible();
    await expect(page.getByText('Define areas or zones within the project chainage')).toBeVisible();
    await expect(page.getByText('Central Works')).toBeVisible();
    await expect(page.getByText('South Zone')).toBeVisible();

    await page.getByRole('button', { name: 'Add Area' }).click();
    const addDialog = page.getByRole('dialog').filter({ hasText: 'Add Area' });
    await expect(addDialog.getByText('Define a named project area')).toBeVisible();
    await addDialog.getByLabel(/Area Name/).fill('North Zone');
    await addDialog.getByLabel('Chainage Start (m)').fill('0');
    await addDialog.getByLabel('Chainage End (m)').fill('99.5');
    await addDialog.getByRole('button', { name: 'Select Purple colour' }).click();
    await addDialog.getByRole('button', { name: 'Add Area' }).click();

    await expect(page.getByText('North Zone has been added to the project.')).toBeVisible();
    expect(api.getCreateRequest()).toMatchObject({
      name: 'North Zone',
      chainageStart: 0,
      chainageEnd: 99.5,
      colour: '#A855F7',
    });
    const northRow = page.locator('tbody tr').filter({ hasText: 'North Zone' });
    await expect(northRow).toBeVisible();
    await expect(northRow.getByText('99.5m')).toBeVisible();

    await page.getByRole('button', { name: 'Edit North Zone' }).click();
    const editDialog = page.getByRole('dialog').filter({ hasText: 'Edit Area' });
    await editDialog.getByLabel(/Area Name/).fill('North Zone Revised');
    await editDialog.getByLabel('Chainage Start (m)').fill('10');
    await editDialog.getByLabel('Chainage End (m)').fill('120');
    await editDialog.getByRole('button', { name: 'Select Orange colour' }).click();
    await editDialog.getByRole('button', { name: 'Update Area' }).click();

    await expect(page.getByText('North Zone Revised has been updated.')).toBeVisible();
    await expect
      .poll(() => api.getUpdateRequest())
      .toEqual(
        expect.objectContaining({
          areaId: 'e2e-area-created',
          body: expect.objectContaining({
            name: 'North Zone Revised',
            chainageStart: 10,
            chainageEnd: 120,
            colour: '#F97316',
          }),
        }),
      );
    const revisedRow = page.locator('tbody tr').filter({ hasText: 'North Zone Revised' });
    await expect(revisedRow.getByText('120m')).toBeVisible();

    await page.getByRole('button', { name: 'Delete South Zone' }).click();
    const deleteDialog = page.getByRole('alertdialog').filter({ hasText: 'Delete Project Area' });
    await expect(deleteDialog.getByText('Lots and reports that use this area')).toBeVisible();
    await deleteDialog.getByRole('button', { name: 'Delete' }).click();

    expect(api.getDeleteAreaId()).toBe('e2e-area-south');
    await expect(page.getByText('South Zone has been removed.')).toBeVisible();
    await expect(page.getByText('South Zone')).toBeHidden();
  });

  test('validates chainage range before saving an area', async ({ page }) => {
    const api = await mockProjectAreasApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/areas`);
    await page.getByRole('button', { name: 'Add Area' }).click();
    const addDialog = page.getByRole('dialog').filter({ hasText: 'Add Area' });
    await addDialog.getByLabel(/Area Name/).fill('Backwards Chainage');
    await addDialog.getByLabel('Chainage Start (m)').fill('1e2');
    await addDialog.getByLabel('Chainage End (m)').fill('100');
    await addDialog.getByRole('button', { name: 'Add Area' }).click();

    await expect(
      page.getByText('Enter non-negative decimal numbers for chainage start and end.'),
    ).toBeVisible();
    expect(api.getCreateRequest()).toBeNull();

    await addDialog.getByLabel('Chainage Start (m)').fill('500');
    await addDialog.getByLabel('Chainage End (m)').fill('100');
    await addDialog.getByRole('button', { name: 'Add Area' }).click();

    await expect(
      page.getByText('Chainage start must be less than or equal to chainage end.'),
    ).toBeVisible();
    expect(api.getCreateRequest()).toBeNull();
  });

  test('shows a retryable area load failure instead of an empty-area state', async ({ page }) => {
    const api = await mockProjectAreasApi(page, { failAreaLoadsUntil: 2 });

    await page.goto(`/projects/${E2E_PROJECT_ID}/areas`);

    await expect(page.getByRole('heading', { name: 'Project Areas' })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('Area service unavailable');
    await expect(page.getByText('No areas defined')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();

    await page.getByRole('button', { name: 'Try again' }).click();

    await expect.poll(() => api.getAreaLoadCount()).toBeGreaterThan(2);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByText('Central Works')).toBeVisible();
    await expect(page.getByText('South Zone')).toBeVisible();
  });

  test('ignores duplicate area creation while the request is in flight', async ({ page }) => {
    const api = await mockProjectAreasApi(page, { saveDelayMs: 250 });

    await page.goto(`/projects/${E2E_PROJECT_ID}/areas`);

    await page.getByRole('button', { name: 'Add Area' }).click();
    const addDialog = page.getByRole('dialog').filter({ hasText: 'Add Area' });
    await addDialog.getByLabel(/Area Name/).fill('Duplicate Safe Zone');
    await addDialog.getByLabel('Chainage Start (m)').fill('0');
    await addDialog.getByLabel('Chainage End (m)').fill('99.5');

    await addDialog.getByRole('button', { name: 'Add Area' }).evaluate((button: HTMLElement) => {
      button.click();
      button.click();
    });

    await expect(
      page.getByText('Duplicate Safe Zone has been added to the project.'),
    ).toBeVisible();
    expect(api.getCreateRequests()).toHaveLength(1);
    expect(api.getCreateRequest()).toMatchObject({
      name: 'Duplicate Safe Zone',
      chainageStart: 0,
      chainageEnd: 99.5,
    });
  });
});
