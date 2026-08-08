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

  test('4D playback: scrubber renders, date change recounts, unlinked stays neutral', async ({
    page,
  }) => {
    await mockAuthenticatedUserState(page);
    await mockProjectRole(page, 'project_manager');
    await mockModelsList(page, [buildModel('model-1', 'Corridor', 'ready', '2100000')]);
    await mockVersion(page, { ...baseVersion, status: 'ready', fragSizeBytes: '2100000' });
    // Stall the fragments download: CI never boots the real 3D stack, and the
    // playback bar is data-driven so it must work while the canvas loads.
    await page.route('**/fragments', () => {
      /* never fulfil */
    });
    await page.route(`**/api/projects/${E2E_PROJECT_ID}/lots/status-timeline`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          earliest: '2026-07-01T00:00:00.000Z',
          lots: [
            {
              lotId: 'lot-1',
              createdAt: '2026-06-30T00:00:00.000Z',
              currentStatus: 'conformed',
              events: [
                { at: '2026-07-10T00:00:00.000Z', from: 'not_started', to: 'in_progress' },
                { at: '2026-08-01T00:00:00.000Z', from: 'in_progress', to: 'conformed' },
              ],
            },
            {
              lotId: 'lot-2',
              createdAt: '2026-07-20T00:00:00.000Z',
              currentStatus: 'in_progress',
              events: [{ at: '2026-07-20T00:00:00.000Z', from: 'not_started', to: 'in_progress' }],
            },
          ],
        }),
      });
    });
    await page.route(
      `**/api/projects/${E2E_PROJECT_ID}/models/model-1/versions/version-1/element-links`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            links: [
              { ifcGuid: 'guid-1', lotId: 'lot-1' },
              { ifcGuid: 'guid-2', lotId: 'lot-2' },
            ],
            counts: { elements: 3, linked: 2, unlinked: 1 },
          }),
        });
      },
    );

    await page.goto(`/projects/${E2E_PROJECT_ID}/models/model-1/versions/version-1/view`);

    await page.getByTestId('playback-toggle').click();
    await expect(page.getByTestId('playback-bar')).toBeVisible();

    // Right edge (today, the default): live statuses.
    const legend = page.getByTestId('playback-legend');
    await expect(legend).toContainText('In Progress');
    await expect(legend).toContainText('Conformed');
    // The unlinked element is declared neutral, never painted as a status.
    await expect(legend).toContainText('No QA record');
    await expect(page.getByTestId('playback-coverage')).toContainText(
      '2 of 3 elements linked to lots.',
    );

    // Scrub to the earliest date: lot-1 replays to not_started, lot-2 did not
    // exist yet — the counts repaint from the same shared replay semantics.
    await page.getByTestId('playback-slider').press('Home');
    // Month renders short or long depending on the browser's ICU data.
    await expect(page.getByTestId('playback-date')).toContainText(/1 Jul\w* 2026/);
    await expect(legend).toContainText('Not Started');
    await expect(legend).not.toContainText('Conformed');
    // Ghosted geometry: 1 unlinked + 1 not-yet-created.
    await expect(legend).toContainText('No QA record2');

    // Compare mode: what moved since that date (both lots changed).
    await page.getByTestId('playback-compare').check();
    await expect(page.getByTestId('playback-changed-count')).toContainText(
      /2 changed since 1 Jul\w* 2026/,
    );

    // Always a way out.
    await page.getByTestId('playback-exit').click();
    await expect(page.getByTestId('playback-bar')).not.toBeVisible();
    await expect(page.getByTestId('playback-toggle')).toBeVisible();
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

test.describe('model lot linking (copilot rail, mocked endpoints)', () => {
  const CANDIDATE = {
    versionId: 'model-ready-v1',
    links: [
      { elementId: 'el-1', ifcGuid: 'guid-1', lotNumberValue: 'EW-001', lotId: 'lot-a' },
      { elementId: 'el-2', ifcGuid: 'guid-2', lotNumberValue: 'EW-002', lotId: 'lot-b' },
    ],
    ambiguous: [
      {
        elementId: 'el-3',
        ifcGuid: 'guid-3',
        lotNumberValue: 'DR-010',
        candidateLotIds: ['lot-c', 'lot-d'],
      },
    ],
    unlinked: [{ elementId: 'el-4', ifcGuid: 'guid-4', lotNumberValue: 'ZZ-999' }],
    unlinkedCount: 1,
    orphanedManual: [],
    counts: {
      elements: 4,
      linked: 2,
      ambiguous: 1,
      unlinked: 1,
      carriedForward: 0,
      orphanedManual: 0,
    },
  };

  test('Link lots proposes, deep-links to the rail, and applies with a resolved decision', async ({
    page,
  }) => {
    await mockAuthenticatedUserState(page);
    await mockProjectRole(page, 'project_manager');
    await mockModelsList(page, [buildModel('model-ready', 'Stage 2 drainage', 'ready', '2100000')]);

    let extracted = false;
    await page.route(
      `**/api/projects/${E2E_PROJECT_ID}/copilot/model_lot_linking/extract`,
      async (route) => {
        extracted = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ proposalId: 'prop-link-1', candidate: CANDIDATE, warnings: [] }),
        });
      },
    );
    const proposal = {
      id: 'prop-link-1',
      projectId: E2E_PROJECT_ID,
      stage: 'model_lot_linking',
      status: 'proposed',
      model: 'deterministic',
      sourceRefs: [{ fileName: 'drainage.ifc', note: 'Model Stage 2 drainage, version 1' }],
      payload: CANDIDATE,
      warnings: [],
      editedPayload: null,
      decidedAt: null,
      createdAt: '2026-08-01T00:00:00.000Z',
    };
    await page.route(`**/api/projects/${E2E_PROJECT_ID}/copilot/proposals`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ proposals: extracted ? [{ ...proposal, payload: null }] : [] }),
      });
    });
    await page.route(
      `**/api/projects/${E2E_PROJECT_ID}/copilot/proposals/prop-link-1`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ proposal }),
        });
      },
    );
    let decisionBody: Record<string, unknown> | null = null;
    await page.route(
      `**/api/projects/${E2E_PROJECT_ID}/copilot/proposals/prop-link-1/decision`,
      async (route) => {
        decisionBody = route.request().postDataJSON() as Record<string, unknown>;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ proposal: { ...proposal, status: 'edited' } }),
        });
      },
    );
    await page.route('**/api/lots?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          lots: [
            { id: 'lot-c', lotNumber: 'DR-010' },
            { id: 'lot-d', lotNumber: 'DR-010A' },
          ],
          pagination: { totalPages: 1 },
        }),
      });
    });

    await page.goto(`/projects/${E2E_PROJECT_ID}/models`);
    await page.getByRole('button', { name: 'Link lots' }).click();

    // The extract lands us on the copilot rail with the proposal open for review.
    await page.waitForURL(/\/copilot/);
    await expect(page.getByTestId('linking-summary')).toContainText('2 of 4 elements matched');
    await expect(page.getByTestId('linking-summary')).toContainText('1 need a decision');
    await expect(page.getByText(/had no matching lot number/)).toContainText('ZZ-999');

    // Resolve the ambiguous element to a concrete lot, then apply.
    const picker = page.getByLabel('Lot for DR-010');
    await expect(picker.getByRole('option', { name: 'DR-010A' })).toHaveCount(1);
    await picker.selectOption('lot-d');
    await expect(page.getByTestId('linking-apply')).toContainText('Apply 3 links');
    await page.getByTestId('linking-apply').click();

    await expect(page.getByTestId('linking-summary')).not.toBeVisible();
    expect(decisionBody).not.toBeNull();
    const edited = (decisionBody as unknown as { editedPayload: typeof CANDIDATE }).editedPayload;
    expect(edited.versionId).toBe('model-ready-v1');
    expect(edited.links).toHaveLength(3);
    expect(edited.links[2]).toMatchObject({ elementId: 'el-3', lotId: 'lot-d', source: 'manual' });
  });
});
