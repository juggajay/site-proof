import { test, expect, type Page } from '@playwright/test';
import { Buffer } from 'node:buffer';
import { E2E_PROJECT_ID, mockAuthenticatedUserState } from './helpers';

/**
 * Wave 5b — design models management surface + mobile budget rule.
 * CI-safe: every API call is route-mocked and the real 3D stack is never
 * booted (the viewer's ThatOpen path is exercised by the local-only smoke in
 * design-models-3d.spec.ts).
 */

type ListModel = {
  id: string;
  projectId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  latestVersion: {
    id: string;
    versionNumber: number;
    status: string;
    fragSizeBytes: string | null;
    createdAt: string;
  } | null;
};

function buildModel(
  id: string,
  name: string,
  status: string | null,
  fragSizeBytes: string | null = null,
): ListModel {
  return {
    id,
    projectId: E2E_PROJECT_ID,
    name,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    latestVersion: status
      ? {
          id: `${id}-v1`,
          versionNumber: 1,
          status,
          fragSizeBytes,
          createdAt: '2026-08-01T00:00:00.000Z',
        }
      : null,
  };
}

async function mockProjectRole(page: Page, role: string) {
  await page.route(`**/api/projects/${E2E_PROJECT_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ project: { id: E2E_PROJECT_ID, currentUserRole: role } }),
    });
  });
}

async function mockModelsList(page: Page, models: ListModel[]) {
  await page.route(`**/api/projects/${E2E_PROJECT_ID}/models`, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ models }),
      });
      return;
    }
    await route.fallback();
  });
}

test.describe('design models list', () => {
  test('shows the empty state with an upload action for managers', async ({ page }) => {
    await mockAuthenticatedUserState(page);
    await mockProjectRole(page, 'project_manager');
    await mockModelsList(page, []);

    await page.goto(`/projects/${E2E_PROJECT_ID}/models`);

    await expect(page.getByRole('heading', { name: 'No design models yet' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Upload design model' })).toBeVisible();
  });

  test('read-only roles see the list without manage actions', async ({ page }) => {
    await mockAuthenticatedUserState(page);
    await mockProjectRole(page, 'site_engineer');
    await mockModelsList(page, [buildModel('model-ready', 'Stage 2 drainage', 'ready', '2100000')]);

    await page.goto(`/projects/${E2E_PROJECT_ID}/models`);

    await expect(page.getByText('Stage 2 drainage')).toBeVisible();
    await expect(page.getByRole('link', { name: 'View in 3D' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Upload design model' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'New version' })).not.toBeVisible();
  });

  test('renders version statuses: ready, converting, and failed', async ({ page }) => {
    await mockAuthenticatedUserState(page);
    await mockProjectRole(page, 'project_manager');
    await mockModelsList(page, [
      buildModel('model-ready', 'Ready model', 'ready', '2100000'),
      buildModel('model-converting', 'Converting model', 'converting'),
      buildModel('model-failed', 'Failed model', 'failed'),
    ]);

    await page.goto(`/projects/${E2E_PROJECT_ID}/models`);

    await expect(page.getByText('Ready', { exact: true })).toBeVisible();
    await expect(page.getByText('2.0 MB')).toBeVisible();
    await expect(page.getByText('Converting', { exact: true })).toBeVisible();
    await expect(page.getByText('Conversion failed')).toBeVisible();
    // Only the ready model links into the viewer.
    await expect(page.getByRole('link', { name: 'View in 3D' })).toHaveCount(1);
  });

  test('uploads a new model end to end (create, parts, complete)', async ({ page }) => {
    await mockAuthenticatedUserState(page);
    await mockProjectRole(page, 'project_manager');

    const models: ListModel[] = [];
    await mockModelsList(page, models);

    await page.route(`**/api/projects/${E2E_PROJECT_ID}/models`, async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'model-new', projectId: E2E_PROJECT_ID, name: 'Bridge deck' }),
      });
    });

    const partPuts: string[] = [];
    await page.route(
      `**/api/projects/${E2E_PROJECT_ID}/models/model-new/versions**`,
      async (route) => {
        const url = new URL(route.request().url());
        const method = route.request().method();
        if (method === 'POST' && url.pathname.endsWith('/versions')) {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              versionId: 'version-new',
              partSizeBytes: 8388608,
              partCount: 1,
            }),
          });
          return;
        }
        if (method === 'GET' && url.pathname.endsWith('/parts')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ received: [] }),
          });
          return;
        }
        if (method === 'PUT' && /\/parts\/\d+$/.test(url.pathname)) {
          partPuts.push(url.pathname);
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ index: 0, sizeBytes: 20 }),
          });
          return;
        }
        if (method === 'POST' && url.pathname.endsWith('/complete')) {
          models.push(buildModel('model-new', 'Bridge deck', 'queued'));
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'version-new',
              modelId: 'model-new',
              versionNumber: 1,
              status: 'queued',
              fileName: 'bridge-deck.ifc',
              failureCount: 0,
            }),
          });
          return;
        }
        await route.fallback();
      },
    );

    await page.goto(`/projects/${E2E_PROJECT_ID}/models`);
    await page.getByRole('button', { name: 'Upload design model' }).click();

    await page.getByLabel('IFC file').setInputFiles({
      name: 'bridge-deck.ifc',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('ISO-10303-21; MOCK IFC'),
    });
    // Model name prefills from the file name.
    await expect(page.getByLabel('Model name')).toHaveValue('bridge-deck');

    await page.getByRole('button', { name: 'Upload', exact: true }).click();

    // The dialog closes and the refreshed list shows the queued version —
    // stronger evidence than the transient toast.
    await expect(page.getByText('Bridge deck')).toBeVisible();
    // exact: true — the success toast also contains the phrase.
    await expect(page.getByText('Queued for conversion', { exact: true })).toBeVisible();
    expect(partPuts).toEqual([
      `/api/projects/${E2E_PROJECT_ID}/models/model-new/versions/version-new/parts/0`,
    ]);
  });

  test('rejects a non-IFC file before any upload starts', async ({ page }) => {
    await mockAuthenticatedUserState(page);
    await mockProjectRole(page, 'project_manager');
    await mockModelsList(page, []);

    await page.goto(`/projects/${E2E_PROJECT_ID}/models`);
    await page.getByRole('button', { name: 'Upload design model' }).click();
    await page.getByLabel('IFC file').setInputFiles({
      name: 'photo.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('not an ifc'),
    });

    await expect(page.getByText('Only IFC files (.ifc) can be converted')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Upload', exact: true })).toBeDisabled();
  });
});

test.describe('model viewer page (no real 3D in CI)', () => {
  function mockVersion(page: Page, version: Record<string, unknown>) {
    return page.route(
      `**/api/projects/${E2E_PROJECT_ID}/models/model-1/versions/version-1`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(version),
        });
      },
    );
  }

  const baseVersion = {
    id: 'version-1',
    modelId: 'model-1',
    versionNumber: 2,
    fileName: 'corridor.ifc',
    failureCount: 0,
    lastFailureReason: null,
    diagnostics: null,
  };

  test('shows the conversion-pending state', async ({ page }) => {
    await mockAuthenticatedUserState(page);
    await mockProjectRole(page, 'project_manager');
    await mockModelsList(page, [buildModel('model-1', 'Corridor', 'converting')]);
    await mockVersion(page, { ...baseVersion, status: 'converting', fragSizeBytes: null });

    await page.goto(`/projects/${E2E_PROJECT_ID}/models/model-1/versions/version-1/view`);

    await expect(
      page.getByText('The model is being converted for 3D viewing', { exact: false }),
    ).toBeVisible();
  });

  test('shows a quarantined failure plainly', async ({ page }) => {
    await mockAuthenticatedUserState(page);
    await mockProjectRole(page, 'project_manager');
    await mockModelsList(page, [buildModel('model-1', 'Corridor', 'failed')]);
    await mockVersion(page, {
      ...baseVersion,
      status: 'failed',
      fragSizeBytes: null,
      failureCount: 2,
      lastFailureReason: 'IFC schema unsupported',
    });

    await page.goto(`/projects/${E2E_PROJECT_ID}/models/model-1/versions/version-1/view`);

    await expect(page.getByText('IFC schema unsupported')).toBeVisible();
    await expect(
      page.getByText('failed twice and will not be retried', { exact: false }),
    ).toBeVisible();
  });

  test('mobile viewport refuses an over-budget model and never fetches fragments', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockAuthenticatedUserState(page);
    await mockProjectRole(page, 'project_manager');
    await mockModelsList(page, [buildModel('model-1', 'Corridor', 'ready', '30300000')]);
    await mockVersion(page, { ...baseVersion, status: 'ready', fragSizeBytes: '30300000' });

    let fragmentsRequested = false;
    await page.route('**/fragments', async (route) => {
      fragmentsRequested = true;
      await route.fulfill({ status: 404, body: '' });
    });

    await page.goto(`/projects/${E2E_PROJECT_ID}/models/model-1/versions/version-1/view`);

    await expect(page.getByText('Too large for this device')).toBeVisible();
    await expect(page.getByText(/This model is 28\.9 MB/)).toBeVisible();
    await expect(page.getByText(/crash on models over 15 MB/)).toBeVisible();
    await expect(page.getByText('needs a desktop browser', { exact: false })).toBeVisible();
    // There is deliberately NO "load anyway" affordance — it crashes phones.
    await expect(page.getByRole('button', { name: /load|anyway|continue/i })).toHaveCount(0);
    expect(fragmentsRequested).toBe(false);
  });

  test('mobile viewport loads a model under the budget (canvas path begins)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockAuthenticatedUserState(page);
    await mockProjectRole(page, 'project_manager');
    await mockModelsList(page, [buildModel('model-1', 'Corridor', 'ready', '2100000')]);
    await mockVersion(page, { ...baseVersion, status: 'ready', fragSizeBytes: '2100000' });

    // Under budget: the page proceeds into the canvas path and requests the
    // fragments download (stalled here — CI never boots the real 3D stack).
    const fragmentsRequest = page.waitForRequest('**/fragments');
    await page.goto(`/projects/${E2E_PROJECT_ID}/models/model-1/versions/version-1/view`);
    await fragmentsRequest;
    await expect(page.getByText('Too large for this device')).not.toBeVisible();
  });
});
