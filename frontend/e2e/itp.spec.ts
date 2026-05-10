import { test, expect, type Page } from '@playwright/test';
import { E2E_ADMIN_USER, E2E_PROJECT_ID, mockAuthenticatedUserState } from './helpers';

const E2E_LOCAL_TEMPLATE_ID = 'e2e-itp-template';
const E2E_GLOBAL_TEMPLATE_ID = 'e2e-global-itp-template';
const E2E_CREATED_TEMPLATE_ID = 'e2e-created-itp-template';
const E2E_IMPORTED_TEMPLATE_ID = 'e2e-imported-itp-template';
const E2E_CROSS_PROJECT_TEMPLATE_ID = 'e2e-cross-project-itp-template';

interface MockSeededItpOptions {
  failTemplateLoadsUntil?: number;
}

function buildLocalTemplate(isActive = true) {
  return {
    id: E2E_LOCAL_TEMPLATE_ID,
    name: 'E2E Roadworks ITP',
    description: 'E2E seeded ITP template',
    activityType: 'Earthworks',
    createdAt: '2026-01-15T00:00:00.000Z',
    isGlobalTemplate: false,
    stateSpec: null,
    isActive,
    checklistItems: [
      {
        id: 'e2e-itp-checklist-item-1',
        description: 'Verify formation is ready for inspection',
        category: 'Preparation',
        responsibleParty: 'contractor',
        isHoldPoint: true,
        pointType: 'hold_point',
        evidenceRequired: 'photo',
        verificationMethod: 'Visual inspection',
        acceptanceCriteria: 'Conforms to project specification',
        order: 1,
      },
      {
        id: 'e2e-itp-checklist-item-2',
        description: 'Confirm subcontractor survey records',
        category: 'Records',
        responsibleParty: 'subcontractor',
        isHoldPoint: false,
        pointType: 'witness',
        evidenceRequired: 'document',
        verificationMethod: 'Document review',
        acceptanceCriteria: 'Records attached before covering work',
        order: 2,
      },
    ],
  };
}

const E2E_GLOBAL_TEMPLATE = {
  id: E2E_GLOBAL_TEMPLATE_ID,
  name: 'TfNSW Pavement ITP',
  description: 'Library pavement controls',
  activityType: 'Pavement',
  createdAt: '2026-01-15T00:00:00.000Z',
  isGlobalTemplate: true,
  stateSpec: 'TfNSW',
  isActive: true,
  checklistItems: [
    {
      id: 'e2e-global-itp-checklist-item-1',
      description: 'Superintendent witness for pavement proof roll',
      category: 'Witness',
      responsibleParty: 'superintendent',
      isHoldPoint: false,
      pointType: 'witness',
      evidenceRequired: 'none',
      verificationMethod: 'Witness',
      acceptanceCriteria: 'Witness complete',
      order: 1,
    },
  ],
};

async function mockSeededItpApi(page: Page, options: MockSeededItpOptions = {}) {
  let localTemplateActive = true;
  let toggleRequest: unknown;
  let templateLoadAttempts = 0;
  let createRequest: unknown;
  const cloneRequests: unknown[] = [];

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
        },
      });
      return;
    }

    if (
      url.pathname === '/api/itp/templates/cross-project' &&
      url.searchParams.get('currentProjectId') === E2E_PROJECT_ID
    ) {
      await json({
        projects: [
          {
            id: 'e2e-source-project',
            name: 'E2E Source Project',
            code: 'SRC-001',
            templates: [
              {
                id: E2E_CROSS_PROJECT_TEMPLATE_ID,
                name: 'E2E Imported Drainage ITP',
                description: 'Reusable drainage controls',
                activityType: 'Drainage',
                checklistItemCount: 3,
                holdPointCount: 1,
              },
            ],
          },
        ],
      });
      return;
    }

    if (
      url.pathname === '/api/itp/templates' &&
      url.searchParams.get('projectId') === E2E_PROJECT_ID
    ) {
      templateLoadAttempts += 1;
      if (templateLoadAttempts <= (options.failTemplateLoadsUntil ?? 0)) {
        await json({ message: 'ITP templates temporarily unavailable' }, 500);
        return;
      }

      const includeGlobal = url.searchParams.get('includeGlobal') !== 'false';
      await json({
        projectSpecificationSet: 'TfNSW',
        templates: includeGlobal
          ? [buildLocalTemplate(localTemplateActive), E2E_GLOBAL_TEMPLATE]
          : [buildLocalTemplate(localTemplateActive)],
      });
      return;
    }

    if (url.pathname === '/api/itp/templates' && route.request().method() === 'POST') {
      createRequest = route.request().postDataJSON();
      await json({
        template: {
          id: E2E_CREATED_TEMPLATE_ID,
          name: (createRequest as { name: string }).name,
          description: (createRequest as { description?: string }).description || null,
          activityType: (createRequest as { activityType: string }).activityType,
          createdAt: '2026-01-16T00:00:00.000Z',
          isGlobalTemplate: false,
          stateSpec: null,
          isActive: true,
          checklistItems: (
            (createRequest as { checklistItems?: unknown[] }).checklistItems || []
          ).map((item, index) => ({
            ...(item as object),
            id: `e2e-created-checklist-item-${index + 1}`,
            order: index,
          })),
        },
      });
      return;
    }

    if (
      url.pathname === `/api/itp/templates/${E2E_LOCAL_TEMPLATE_ID}` &&
      route.request().method() === 'PATCH'
    ) {
      toggleRequest = route.request().postDataJSON();
      localTemplateActive = Boolean((toggleRequest as { isActive?: boolean }).isActive);
      await json({ template: buildLocalTemplate(localTemplateActive) });
      return;
    }

    if (
      url.pathname === `/api/itp/templates/${E2E_LOCAL_TEMPLATE_ID}/clone` &&
      route.request().method() === 'POST'
    ) {
      cloneRequests.push(route.request().postDataJSON());
      await json({
        template: {
          ...buildLocalTemplate(true),
          id: 'e2e-cloned-local-itp-template',
          name: 'Copy of E2E Roadworks ITP',
        },
      });
      return;
    }

    if (
      url.pathname === `/api/itp/templates/${E2E_CROSS_PROJECT_TEMPLATE_ID}/clone` &&
      route.request().method() === 'POST'
    ) {
      cloneRequests.push(route.request().postDataJSON());
      await json({
        template: {
          id: E2E_IMPORTED_TEMPLATE_ID,
          name: 'E2E Imported Drainage ITP',
          description: 'Reusable drainage controls',
          activityType: 'Drainage',
          createdAt: '2026-01-16T00:00:00.000Z',
          isGlobalTemplate: false,
          stateSpec: null,
          isActive: true,
          checklistItems: [
            {
              id: 'e2e-imported-checklist-item-1',
              description: 'Confirm pipe bedding',
              category: 'Preparation',
              responsibleParty: 'contractor',
              isHoldPoint: true,
              pointType: 'hold_point',
              evidenceRequired: 'photo',
              order: 1,
            },
          ],
        },
      });
      return;
    }

    await json({ message: `Unhandled E2E API route: ${url.pathname}` }, 404);
  });

  await mockAuthenticatedUserState(page);

  return {
    getToggleRequest: () => toggleRequest,
    getTemplateLoadAttempts: () => templateLoadAttempts,
    getCreateRequest: () => createRequest,
    getCloneRequests: () => cloneRequests,
  };
}

test.describe('ITP seeded UI contract', () => {
  test('renders seeded templates, filters them, and toggles active state', async ({ page }) => {
    const api = await mockSeededItpApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/itp`);

    await expect(page.getByRole('heading', { name: 'Inspection & Test Plans' })).toBeVisible();
    await expect(page.getByText('Manage ITP templates for quality checkpoints')).toBeVisible();
    await expect(page.getByText('TfNSW').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Import from Project' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create ITP Template' })).toBeVisible();

    const localTemplateCard = page
      .locator('.rounded-lg.border.p-4')
      .filter({ hasText: 'E2E Roadworks ITP' });
    await expect(localTemplateCard).toBeVisible();
    await expect(localTemplateCard.getByText('Earthworks')).toBeVisible();
    await expect(localTemplateCard.getByText('E2E seeded ITP template')).toBeVisible();
    await expect(localTemplateCard.getByText('2 checklist items')).toBeVisible();
    await expect(localTemplateCard.getByText('1 hold points')).toBeVisible();
    await expect(localTemplateCard.getByRole('button', { name: 'Copy' })).toBeVisible();
    await expect(localTemplateCard.getByRole('button', { name: 'Edit' })).toBeVisible();
    await expect(localTemplateCard.getByRole('button', { name: 'Active' })).toBeVisible();

    const globalTemplateCard = page
      .locator('.rounded-lg.border.p-4')
      .filter({ hasText: 'TfNSW Pavement ITP' });
    await expect(globalTemplateCard).toBeVisible();
    await expect(globalTemplateCard.getByText('TfNSW Template')).toBeVisible();
    await expect(globalTemplateCard.getByText('Library pavement controls')).toBeVisible();
    await expect(globalTemplateCard.getByRole('button', { name: 'Edit' })).toHaveCount(0);

    await page.locator('select').nth(1).selectOption('contractor');
    await expect(localTemplateCard.getByText('1 contractor items')).toBeVisible();
    await expect(localTemplateCard.getByText('1 hold points')).toBeVisible();
    await expect(globalTemplateCard).toBeHidden();

    await page.getByLabel('Include TfNSW library templates').uncheck();
    await expect(globalTemplateCard).toHaveCount(0);

    await localTemplateCard.getByRole('button', { name: 'Active' }).click();
    expect(api.getToggleRequest()).toMatchObject({ isActive: false });
    await expect(localTemplateCard.getByRole('button', { name: 'Inactive' })).toBeVisible();
    await expect(localTemplateCard.getByText('Inactive').first()).toBeVisible();
  });

  test('shows retry instead of an empty state when template loading fails', async ({ page }) => {
    const api = await mockSeededItpApi(page, { failTemplateLoadsUntil: 1 });

    await page.goto(`/projects/${E2E_PROJECT_ID}/itp`);

    await expect(page.getByRole('alert')).toContainText('ITP templates temporarily unavailable');
    await expect(page.getByText('No ITP Templates')).toHaveCount(0);

    await page.getByRole('button', { name: 'Try again' }).click();

    await expect(page.getByText('E2E Roadworks ITP')).toBeVisible();
    await expect(page.getByText('TfNSW Pavement ITP')).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(api.getTemplateLoadAttempts()).toBeGreaterThanOrEqual(2);
  });

  test('creates a template with sanitized required fields', async ({ page }) => {
    const api = await mockSeededItpApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/itp`);
    await expect(page.getByText('E2E Roadworks ITP')).toBeVisible();

    await page.getByRole('button', { name: 'Create ITP Template' }).click();
    const modal = page.locator('.fixed.inset-0').filter({ hasText: 'Create ITP Template' });
    await expect(modal).toBeVisible();
    await modal.getByPlaceholder('e.g., Earthworks ITP').fill('  E2E Concrete ITP  ');
    await modal.locator('select').first().selectOption('Concrete');
    await modal
      .getByPlaceholder('Optional description of this ITP template')
      .fill('  Concrete pour checks  ');
    await modal
      .getByPlaceholder('Checklist item description')
      .fill('  Confirm formwork is signed off  ');
    await modal.getByRole('button', { name: 'Create Template' }).click();

    await expect(page.getByText('E2E Concrete ITP')).toBeVisible();
    expect(api.getCreateRequest()).toMatchObject({
      projectId: E2E_PROJECT_ID,
      name: 'E2E Concrete ITP',
      description: 'Concrete pour checks',
      activityType: 'Concrete',
      checklistItems: [
        expect.objectContaining({
          description: 'Confirm formwork is signed off',
        }),
      ],
    });
  });

  test('imports a template from another project into the current project', async ({ page }) => {
    const api = await mockSeededItpApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/itp`);
    await expect(page.getByText('E2E Roadworks ITP')).toBeVisible();

    await page.getByRole('button', { name: 'Import from Project' }).click();
    await expect(
      page.getByRole('heading', { name: 'Import ITP Template from Another Project' }),
    ).toBeVisible();
    const modal = page
      .locator('.fixed.inset-0')
      .filter({ hasText: 'Import ITP Template from Another Project' });
    await expect(page.getByText('E2E Imported Drainage ITP')).toBeVisible();

    await modal.getByRole('button', { name: 'Import' }).click();

    await expect(modal.getByRole('button', { name: '✓ Imported' })).toBeVisible();
    await modal.getByRole('button', { name: 'Close' }).click();
    await expect(
      page.locator('.rounded-lg.border.p-4').filter({ hasText: 'E2E Imported Drainage ITP' }),
    ).toBeVisible();
    expect(api.getCloneRequests()).toContainEqual({ projectId: E2E_PROJECT_ID });
  });
});
