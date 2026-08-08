import { test, expect, type Page } from '@playwright/test';

import { E2E_ADMIN_USER, E2E_PROJECT_ID, mockAuthenticatedUserState } from './helpers';

/**
 * The spatial workspace (Wave 1): full-height map view, camera policy, one
 * collapsed lots layer with a selection popup, zoom-tiered labels, Plan mode
 * (CRS.Simple sheet canvas), grouped toolbar, compact legend, URL state.
 * Real Leaflet runs here — only the network is mocked.
 */

const E2E_SHEET_ID = 'e2e-sheet';
const E2E_ORTHO_ID = 'e2e-ortho';

const LOT_GEOMETRY = {
  id: 'e2e-geom',
  lotId: 'e2e-lot',
  lotNumber: 'LOT-001',
  status: 'in_progress',
  activityType: 'Earthworks',
  kind: 'chainage_offset',
  controlLineId: null,
  geometryWgs84: {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [151.0, -33.8],
          [151.002, -33.8],
          [151.002, -33.802],
          [151.0, -33.802],
          [151.0, -33.8],
        ],
      ],
    },
  },
  areaM2: 34000,
  lengthM: 200,
  chainageStart: 100,
  chainageEnd: 200,
};

const PLAN_SHEET = {
  id: E2E_SHEET_ID,
  name: 'Sheet 05 — Drainage',
  pageNumber: 5,
  imageWidth: 1000,
  imageHeight: 500,
  coordinateSystem: 'EPSG:7856',
  hasRegistration: true,
  cornersWgs84: {
    topLeft: [150.999, -33.799],
    topRight: [151.003, -33.799],
    bottomRight: [151.003, -33.803],
    bottomLeft: [150.999, -33.803],
  },
  perimeter: null,
  createdAt: '2026-01-15T00:00:00.000Z',
  updatedAt: '2026-01-15T00:00:00.000Z',
};

// A near-white pixel: the plan-sheet fixture stretches it, so the plan canvas
// reads as paper rather than a solid colour block in captured screenshots.
const ONE_PX_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP49es7AAXdAuxdnSlKAAAAAElFTkSuQmCC',
  'base64',
);

async function mockMapApi(page: Page) {
  await mockAuthenticatedUserState(page);

  // Basemap tiles never leave the test: both providers get a 1px png.
  await page.route(/tile\.openstreetmap\.org|api\.maptiler\.com/, (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: ONE_PX_PNG }),
  );

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    switch (true) {
      case url.pathname === '/api/auth/me':
        return json({ user: E2E_ADMIN_USER });
      case url.pathname === `/api/projects/${E2E_PROJECT_ID}/access`:
        // This catch-all shadows the helper's page-level /access default
        // (Playwright checks the most recent route first), so answer it here.
        return json({
          access: { hasProjectAccess: true, role: 'project_manager', isProjectAdmin: true },
        });
      case url.pathname === '/api/projects':
        return json({
          projects: [
            {
              id: E2E_PROJECT_ID,
              name: 'E2E Highway Upgrade',
              projectNumber: 'E2E-001',
              status: 'active',
            },
          ],
        });
      case url.pathname === '/api/lots':
        return json({
          lots: [
            {
              id: 'e2e-lot',
              lotNumber: 'LOT-001',
              description: 'E2E lot',
              status: 'in_progress',
              activityType: 'Earthworks',
              chainageStart: 100,
              chainageEnd: 200,
              createdAt: '2026-01-15T00:00:00.000Z',
              updatedAt: '2026-01-15T00:00:00.000Z',
            },
          ],
        });
      case url.pathname === `/api/projects/${E2E_PROJECT_ID}/lot-geometries`:
        return json({ geometries: [LOT_GEOMETRY] });
      case url.pathname === `/api/projects/${E2E_PROJECT_ID}/control-lines`:
        return json({ controlLines: [] });
      case url.pathname === `/api/projects/${E2E_PROJECT_ID}/plan-sheets/${E2E_SHEET_ID}/image`:
        return route.fulfill({ status: 200, contentType: 'image/png', body: ONE_PX_PNG });
      case url.pathname === `/api/projects/${E2E_PROJECT_ID}/plan-sheets/${E2E_SHEET_ID}`:
        return json({
          planSheet: {
            ...PLAN_SHEET,
            projectId: E2E_PROJECT_ID,
            documentId: null,
            imageRef: 'e2e-image',
            createdById: null,
            registration: {
              points: [],
              transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
              rmsErrorM: 0.42,
            },
          },
        });
      case url.pathname === `/api/projects/${E2E_PROJECT_ID}/plan-sheets`:
        return json({ planSheets: [PLAN_SHEET] });
      case url.pathname === `/api/projects/${E2E_PROJECT_ID}/orthos`:
        return json({
          orthos: [
            {
              id: E2E_ORTHO_ID,
              name: 'August drone flight',
              capturedAt: '2026-08-01T00:00:00.000Z',
              status: 'ready',
              boundsWgs84: [150.999, -33.803, 151.003, -33.799],
              minZoom: 16,
              maxZoom: 22,
              tileCount: 42,
              tileUrlTemplate: `/api/projects/${E2E_PROJECT_ID}/orthos/${E2E_ORTHO_ID}/tiles/{z}/{x}/{y}.png?token=e2e`,
              diagnostics: null,
              lastFailureReason: null,
            },
          ],
        });
      case url.pathname.startsWith(`/api/projects/${E2E_PROJECT_ID}/orthos/${E2E_ORTHO_ID}/tiles/`):
        return route.fulfill({ status: 200, contentType: 'image/png', body: ONE_PX_PNG });
      // CreateLotModal mounts with the register and needs typed shapes even
      // though these tests never open it.
      case url.pathname === '/api/itp/templates':
        return json({ templates: [] });
      case url.pathname === '/api/itp/templates/match':
        return json({ tier: 'C', suggestedTemplateId: null, candidates: [] });
      default:
        return json({});
    }
  });
}

async function openMapView(page: Page) {
  await page.goto(`/projects/${E2E_PROJECT_ID}/lots`);
  await page.getByTestId('view-toggle-map').click();
  await expect(page.getByTestId('lot-map-view')).toBeVisible();
}

test.describe('Spatial workspace (lot map view)', () => {
  test('map view is a full-height workspace: camera on the work front, labels, legend, selection, URL', async ({
    page,
  }) => {
    await mockMapApi(page);
    await openMapView(page);

    // Full-height workspace, not a 520px strip in a card.
    const viewport = page.viewportSize()!;
    const mapBox = (await page.getByTestId('lot-map-stacking-root').boundingBox())!;
    expect(mapBox.height).toBeGreaterThan(viewport.height * 0.55);

    // Grouped toolbar with the mode switch; zoom control re-homed bottom-right.
    await expect(page.getByTestId('map-mode-switch')).toBeVisible();
    await expect(page.getByTestId('fit-lots-button')).toBeVisible();
    await expect(page.locator('.leaflet-bottom.leaflet-right .leaflet-control-zoom')).toBeVisible();
    await expect(page.locator('.leaflet-top.leaflet-left .leaflet-control-zoom')).toHaveCount(0);

    // The camera policy landed on the active work front at detail zoom, so the
    // single in-progress lot renders with a number+chainage label.
    await expect(page.locator('path.leaflet-interactive')).toHaveCount(1);
    await expect(page.locator('.civos-lot-label-text')).toHaveText(/LOT-001/);
    await expect(page.locator('.civos-lot-label-detail')).toHaveText(/Ch 100–200/);

    // Ready orthophotos are bounded toggles, use signed tile URLs, and expose
    // their own opacity control without leaving the Layers menu.
    await page.getByTestId('layers-button').click();
    await page.getByTestId(`map-ortho-${E2E_ORTHO_ID}`).click();
    await expect(page.getByTestId(`map-ortho-opacity-${E2E_ORTHO_ID}`)).toBeVisible();
    await expect(
      page.locator(`img.leaflet-tile[src*="/orthos/${E2E_ORTHO_ID}/tiles/"]`).first(),
    ).toBeVisible();

    // Compact legend: one in-progress lot as a count, labels only on expand.
    const legend = page.getByTestId('map-legend');
    await expect(legend).toBeVisible();
    await expect(legend).not.toContainText('In Progress');
    await page.getByTestId('map-legend-expand').click();
    await expect(legend).toContainText('In Progress');

    // Selecting a lot opens the ONE popup and mirrors into the URL.
    await page.locator('path.leaflet-interactive').click();
    await expect(page.getByTestId('lot-popup-e2e-lot')).toBeVisible();
    await expect(page).toHaveURL(/lot=e2e-lot/);

    await page.screenshot({
      path: 'e2e-artifacts/wave1-workspace-map.png',
      fullPage: false,
    });
  });

  test('Plan mode: sheet canvas with identity + registration confidence, linkable, reversible', async ({
    page,
  }) => {
    await mockMapApi(page);
    await openMapView(page);

    await page.getByTestId('mode-plan-button').click();

    // Sheet identity + registration confidence are on screen.
    const bar = page.getByTestId('plan-mode-bar');
    await expect(bar).toBeVisible();
    await expect(bar).toContainText('Sheet 05 — Drainage');
    await expect(page.getByTestId('plan-registration-confidence')).toHaveText(
      /Registration ±0\.42 m/,
    );

    // The sheet raster is the ground layer; lots re-project onto it; the
    // geographic toolbar withdrew.
    await expect(page.locator('img.leaflet-image-layer')).toBeVisible();
    await expect(page.locator('path.leaflet-interactive')).toHaveCount(1);
    await expect(page.getByTestId('find-by-area-button')).toHaveCount(0);
    await expect(page.getByTestId('locate-me-button')).toHaveCount(0);
    await expect(page.getByTestId('snapshot-button')).toBeVisible();

    // Workspace state is linkable.
    await expect(page).toHaveURL(/view=plan/);
    await expect(page).toHaveURL(new RegExp(`sheet=${E2E_SHEET_ID}`));

    await page.screenshot({
      path: 'e2e-artifacts/wave1-plan-mode.png',
      fullPage: false,
    });

    // And reversible.
    await page.getByTestId('mode-map-button').click();
    await expect(page.locator('img.leaflet-image-layer')).toHaveCount(0);
    await expect(page.getByTestId('find-by-area-button')).toBeVisible();
    await expect(page).not.toHaveURL(/view=plan/);
  });

  test('deep link ?view=plan opens straight onto the sheet canvas', async ({ page }) => {
    await mockMapApi(page);
    await page.addInitScript(() => {
      localStorage.setItem('siteproof_lot_view_mode', 'map');
    });
    await page.goto(`/projects/${E2E_PROJECT_ID}/lots?view=plan&sheet=${E2E_SHEET_ID}`);

    await expect(page.getByTestId('plan-mode-bar')).toBeVisible();
    await expect(page.locator('img.leaflet-image-layer')).toBeVisible();
  });
});
