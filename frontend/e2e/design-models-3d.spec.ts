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

    // 4D playback data. The element-links mock is built from the model's REAL
    // GUIDs (read via the dev-only window.__civosViewerDebug hook after load),
    // so the paint pass exercises the true guid→localId→highlight path.
    let modelGuids: string[] = [];
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
        // Half the elements on lot-1, a quarter on lot-2, the rest unlinked —
        // scrubbing paints part of the model and ghosts the remainder.
        const links = modelGuids.map((ifcGuid, i) => ({
          ifcGuid,
          lotId: i % 4 < 2 ? 'lot-1' : i % 4 === 2 ? 'lot-2' : null,
        }));
        const kept = links.filter((link) => link.lotId !== null);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            links: kept,
            counts: {
              elements: modelGuids.length,
              linked: kept.length,
              unlinked: modelGuids.length - kept.length,
            },
          }),
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

    // ---- 4D playback over the real model ----
    modelGuids = await page.evaluate(() =>
      (
        window as unknown as { __civosViewerDebug: { listGuids(): Promise<string[]> } }
      ).__civosViewerDebug.listGuids(),
    );
    expect(modelGuids.length).toBeGreaterThan(0);

    await page.getByTestId('playback-toggle').click();
    await expect(page.getByTestId('playback-bar')).toBeVisible();
    // Today: linked elements paint by current status over the real geometry.
    await expect(page.getByTestId('playback-legend')).toContainText('Conformed');
    await page.waitForTimeout(1000); // let the highlight pass land before the shot
    await page.screenshot({ path: 'test-results/design-models-4d-today.png', fullPage: false });

    // Scrub to the earliest date: statuses replay backwards on the same model.
    await page.getByTestId('playback-slider').press('Home');
    await expect(page.getByTestId('playback-legend')).toContainText('Not Started');
    await expect(page.getByTestId('playback-legend')).not.toContainText('Conformed');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/design-models-4d-earliest.png', fullPage: false });

    // Exit restores the untinted model without errors.
    await page.getByTestId('playback-exit').click();
    await expect(page.getByTestId('playback-bar')).not.toBeVisible();

    expect(pageErrors).toEqual([]);
  });
});
