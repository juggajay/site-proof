/**
 * The registers at 390x844 — the width the app is actually used at.
 *
 * These four pages each stacked their whole filter set down the viewport, so a
 * phone user scrolled past every control before seeing one row. What that costs
 * is not measurable in jsdom: it is a layout property (where the first row
 * lands, whether the page scrolls sideways), so it is asserted here in a real
 * browser instead of by counting class names.
 */
import { test, expect, type Page } from '@playwright/test';
import { E2E_ADMIN_USER, E2E_PROJECT_ID, mockAuthenticatedUserState } from './helpers';

const PHONE = { width: 390, height: 844 };

function doc(id: string, documentType: string, category: string | null, filename: string) {
  return {
    id,
    documentType,
    category,
    filename,
    fileUrl: null,
    fileSize: 20480,
    mimeType: 'application/pdf',
    uploadedAt: '2026-07-01T00:00:00.000Z',
    uploadedBy: { id: 'u1', fullName: 'E2E Admin', email: 'a@b.c' },
    caption: null,
    lot: { id: 'lot-1', lotNumber: 'LOT-001', description: 'Footing' },
    isFavourite: false,
    version: 1,
    isLatestVersion: true,
  };
}

async function mockAll(page: Page) {
  await mockAuthenticatedUserState(page);
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const json = (body: unknown) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

    // A page-level catch-all shadows the helper's CONTEXT route, so the auth
    // surfaces have to be answered here or the session reads as expired.
    if (path === '/api/auth/me') return json({ user: E2E_ADMIN_USER });
    if (path === '/api/ai/status') return json({ aiConfigured: false });
    if (path.endsWith('/access')) {
      return json({ access: { hasProjectAccess: true, role: 'admin', isProjectAdmin: true } });
    }
    if (path === `/api/projects/${E2E_PROJECT_ID}`) {
      return json({ project: { id: E2E_PROJECT_ID, name: 'E2E', currentUserRole: 'admin' } });
    }
    if (path.startsWith('/api/documents/')) {
      return json({
        documents: [
          doc('d1', 'delivery_docket', 'delivery_docket', 'boral-docket-8842.pdf'),
          doc('d2', 'photo', 'ncr_evidence', 'ncr-crack-photo.jpg'),
          doc('d3', 'drawing', 'design', 'C-101-rev-b.pdf'),
        ],
        categories: { delivery_docket: 1, ncr_evidence: 1, design: 1 },
        pagination: {
          total: 3,
          page: 1,
          limit: 100,
          totalPages: 1,
          hasPrevPage: false,
          hasNextPage: false,
        },
      });
    }
    if (path.startsWith('/api/lots')) {
      return json({ lots: [{ id: 'lot-1', lotNumber: 'LOT-001', description: 'Footing' }] });
    }
    if (path.includes('/deliveries')) {
      return json({
        deliveries: [
          {
            id: 'del-1',
            diaryId: 'diary-1',
            description: '32 MPa concrete',
            supplier: 'Boral Concrete',
            docketNumber: null,
            quantity: '12.5',
            unit: 'm3',
            lotId: null,
            batchRef: null,
            docketDocumentId: null,
            lot: null,
            docketDocument: null,
            diary: {
              id: 'diary-1',
              date: '2026-07-28T00:00:00.000Z',
              projectId: E2E_PROJECT_ID,
              status: 'submitted',
            },
          },
        ],
        total: 1,
        limit: 50,
        offset: 0,
        hasMore: false,
        unlinkedCount: 0,
        missingDocketCount: 0,
      });
    }
    if (path.startsWith('/api/drawings/')) {
      return json({
        drawings: [
          {
            id: 'dw1',
            drawingNumber: 'C-101',
            title: 'Site plan',
            revision: 'B',
            status: 'for_construction',
            issueDate: '2026-07-01T00:00:00.000Z',
            discipline: 'civil',
            supersededById: null,
            document: { id: 'doc-dw1', filename: 'c-101.pdf', fileUrl: null },
            uploadedBy: { id: 'u1', fullName: 'E2E Admin' },
            createdAt: '2026-07-01T00:00:00.000Z',
          },
        ],
        stats: { total: 12, preliminary: 3, forConstruction: 7, asBuilt: 2 },
        pagination: {
          total: 1,
          page: 1,
          limit: 50,
          totalPages: 1,
          hasPrevPage: false,
          hasNextPage: false,
        },
      });
    }
    if (path.startsWith('/api/holdpoints/')) {
      return json({
        holdPoints: [
          {
            id: 'hp1',
            lotId: 'lot-1',
            lotNumber: 'LOT-HP-001',
            itpChecklistItemId: 'ci1',
            description: 'Verify formation before covering work',
            pointType: 'hold',
            status: 'pending',
            notificationSentAt: null,
            scheduledDate: null,
            releasedAt: null,
            releasedByName: null,
            releaseNotes: null,
            sequenceNumber: 1,
            isCompleted: true,
            isVerified: false,
            canRequestRelease: true,
            createdAt: '2026-07-01T00:00:00.000Z',
          },
        ],
        pagination: { page: 1, totalPages: 1, hasNextPage: false },
      });
    }
    return json({});
  });
}

async function overflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

/** Distance from the top of the page to the element's top edge. */
async function topOffset(page: Page, selector: ReturnType<Page['getByText']>): Promise<number> {
  return selector.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
}

test.use({ viewport: PHONE });

test('documents: filters collapse, content above the fold, no duplicate tag chips', async ({
  page,
}) => {
  await mockAll(page);
  await page.goto(`/projects/${E2E_PROJECT_ID}/documents`);

  await expect(page.getByRole('button', { name: 'Filters' })).toBeVisible();
  await expect(page.getByLabel('Search documents by filename or caption')).toBeVisible();
  // The desktop control set is gone from the phone layout.
  await expect(page.getByLabel('Document Type')).toHaveCount(0);

  const firstRow = page.getByText('boral-docket-8842.pdf');
  await expect(firstRow).toBeVisible();
  expect(await topOffset(page, firstRow)).toBeLessThan(PHONE.height);
  expect(await overflow(page)).toBeLessThanOrEqual(1);

  // De-duped + labelled: one "Delivery Docket" chip, never "delivery_docket".
  const docketRow = page.getByTestId('document-row').filter({ hasText: 'boral-docket-8842.pdf' });
  await expect(docketRow.getByText('Delivery Docket', { exact: true })).toHaveCount(1);
  await expect(page.getByText('delivery_docket')).toHaveCount(0);
  await expect(page.getByText('ncr_evidence')).toHaveCount(0);
  await expect(
    page
      .getByTestId('document-row')
      .filter({ hasText: 'ncr-crack-photo.jpg' })
      .getByText('NCR Evidence'),
  ).toBeVisible();

  // The sheet opens with the full filter set at 44px+.
  await page.getByRole('button', { name: 'Filters' }).click();
  const sheet = page.getByRole('dialog', { name: /filter documents/i });
  await expect(sheet.getByLabel('Document Type')).toBeVisible();
  const h = await sheet
    .getByLabel('Document Type')
    .evaluate((el) => el.getBoundingClientRect().height);
  expect(h).toBeGreaterThanOrEqual(44);

  // The sheet's own Apply button must not sit under the mobile shell nav.
  // Polled rather than waited on a fixed delay: the sheet slides up over
  // ~300ms, and hit-testing a moving element is how this would flake.
  const apply = sheet.getByRole('button', { name: /Apply Filters/i });
  await expect(apply).toBeVisible();
  await expect
    .poll(async () => {
      const box = await apply.boundingBox();
      if (!box) return 'none';
      return page.evaluate(
        ([x, y]) => document.elementFromPoint(x, y)?.textContent?.slice(0, 30) ?? 'none',
        [box.x + box.width / 2, box.y + box.height / 2],
      );
    })
    .toContain('Apply');
});

test('deliveries: filters collapse and the first row is above the fold', async ({ page }) => {
  await mockAll(page);
  await page.goto(`/projects/${E2E_PROJECT_ID}/deliveries`);

  await expect(page.getByRole('button', { name: 'Filters' })).toBeVisible();
  const firstRow = page.getByText('32 MPa concrete');
  await expect(firstRow).toBeVisible();
  expect(await topOffset(page, firstRow)).toBeLessThan(PHONE.height);
  expect(await overflow(page)).toBeLessThanOrEqual(1);
});

test('drawings: 2x2 stats, full-width search, register above the fold', async ({ page }) => {
  await mockAll(page);
  await page.goto(`/projects/${E2E_PROJECT_ID}/drawings`);

  const statsCard = page.locator('.grid').filter({ hasText: 'Total Drawings' });
  await expect(statsCard.getByText('For Construction', { exact: true })).toBeVisible();
  const search = page.getByRole('main').getByRole('textbox', { name: 'Search', exact: true });
  const searchWidth = await search.evaluate((el) => el.getBoundingClientRect().width);
  expect(searchWidth).toBeGreaterThan(300);

  // 2x2: the third card sits below the first.
  const totalTop = await statsCard
    .getByText('Total Drawings', { exact: true })
    .evaluate((el) => el.getBoundingClientRect().top);
  const fcTop = await statsCard
    .getByText('For Construction', { exact: true })
    .evaluate((el) => el.getBoundingClientRect().top);
  expect(fcTop).toBeGreaterThan(totalTop);

  expect(await overflow(page)).toBeLessThanOrEqual(1);
});

test('hold points: filters stack full-width at 44px', async ({ page }) => {
  await mockAll(page);
  await page.goto(`/projects/${E2E_PROJECT_ID}/hold-points`);

  const status = page.getByRole('combobox', { name: 'Filter hold points by status' });
  await expect(status).toBeVisible();
  const box = await status.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { w: r.width, h: r.height };
  });
  expect(box.h).toBeGreaterThanOrEqual(44);
  expect(box.w).toBeGreaterThan(300);
  expect(await overflow(page)).toBeLessThanOrEqual(1);
});
