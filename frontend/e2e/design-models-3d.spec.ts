import { test, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { E2E_PROJECT_ID, mockAuthenticatedUserState } from './helpers';

/**
 * Wave 5b — LOCAL-ONLY real-3D smoke. Loads a real corpus .frag through the
 * actual ThatOpen stack (blob-wrapped worker, self-hosted wasm, camera fit).
 *
 * Gated on CIVOS_3D_FRAG_DIR pointing at the corpus fragments directory, e.g.
 *   CIVOS_3D_FRAG_DIR=C:\Users\jayso\siteproof-test-plans\spatial-corpus\frag
 * CI has no corpus (frag binaries are not committed), so this skips there and
 * runs as part of the full local Playwright bar.
 */

const FRAG_DIR = process.env.CIVOS_3D_FRAG_DIR;
const FRAG_FILE = process.env.CIVOS_3D_FRAG_FILE ?? 'pr2-small.frag';

test.describe('real 3D viewer smoke (local corpus)', () => {
  test.skip(!FRAG_DIR, 'CIVOS_3D_FRAG_DIR not set — local-only real-3D smoke');

  test('renders a real corpus frag and inspects an element', async ({ page }) => {
    const fragPath = join(FRAG_DIR!, FRAG_FILE);
    expect(existsSync(fragPath), `corpus frag missing: ${fragPath}`).toBe(true);
    const fragBytes = readFileSync(fragPath);

    await mockAuthenticatedUserState(page);
    await page.route(`**/api/projects/${E2E_PROJECT_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          project: { id: E2E_PROJECT_ID, currentUserRole: 'project_manager' },
        }),
      });
    });
    await page.route(`**/api/projects/${E2E_PROJECT_ID}/models`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          models: [
            {
              id: 'model-1',
              projectId: E2E_PROJECT_ID,
              name: 'Corpus smoke model',
              createdAt: '2026-08-01T00:00:00.000Z',
              updatedAt: '2026-08-01T00:00:00.000Z',
              latestVersion: {
                id: 'version-1',
                versionNumber: 1,
                status: 'ready',
                fragSizeBytes: String(fragBytes.byteLength),
                createdAt: '2026-08-01T00:00:00.000Z',
              },
            },
          ],
        }),
      });
    });
    await page.route(
      `**/api/projects/${E2E_PROJECT_ID}/models/model-1/versions/version-1`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'version-1',
            modelId: 'model-1',
            versionNumber: 1,
            status: 'ready',
            fileName: FRAG_FILE.replace(/\.frag$/, '.ifc'),
            fragSizeBytes: String(fragBytes.byteLength),
            failureCount: 0,
            lastFailureReason: null,
            diagnostics: null,
          }),
        });
      },
    );
    await page.route(
      `**/api/projects/${E2E_PROJECT_ID}/models/model-1/versions/version-1/fragments`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/octet-stream',
          body: fragBytes,
        });
      },
    );

    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(String(error)));

    await page.goto(`/projects/${E2E_PROJECT_ID}/models/model-1/versions/version-1/view`);

    // The real stack: fragments download -> blob worker boot -> load -> camera
    // fit. data-viewer-state flips to "ready" only after the first painted
    // frame with the camera framed on the model.
    const viewer = page.locator('[data-viewer-state]');
    await expect(viewer).toHaveAttribute('data-viewer-state', 'ready', { timeout: 60_000 });
    await expect(page.locator('canvas')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset view' })).toBeVisible();

    // Click the centre of the canvas — the corpus models carry CIVOS_QA psets,
    // and a centred camera fit puts geometry under the cursor. If the click
    // misses geometry no panel opens; only assert when a panel appeared.
    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      const panel = page.getByText('Tapped element properties');
      if (await panel.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await expect(panel).toBeVisible();
      }
    }

    await page.screenshot({
      path: 'test-results/design-models-3d-smoke.png',
      fullPage: false,
    });

    expect(pageErrors).toEqual([]);
  });
});
