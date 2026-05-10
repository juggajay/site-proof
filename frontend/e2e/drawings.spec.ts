import { test, expect, type Page } from '@playwright/test';
import { Buffer } from 'node:buffer';
import { E2E_ADMIN_USER, E2E_PROJECT_ID, mockAuthenticatedUserState } from './helpers';

const E2E_DRAWING_ID = 'e2e-drawing-current';
const E2E_PRELIM_DRAWING_ID = 'e2e-drawing-prelim';
const E2E_UPLOADED_DRAWING_ID = 'e2e-drawing-uploaded';
const E2E_REVISION_DRAWING_ID = 'e2e-drawing-revision-b';

type Drawing = {
  id: string;
  drawingNumber: string;
  title: string | null;
  revision: string | null;
  issueDate: string | null;
  status: string;
  createdAt: string;
  document: {
    id: string;
    filename: string;
    fileUrl: string;
    fileSize: number | null;
    mimeType: string | null;
    uploadedAt: string;
    uploadedBy: { id: string; fullName: string; email: string } | null;
  };
  supersededBy: { id: string; drawingNumber: string; revision: string } | null;
  supersedes: { id: string; drawingNumber: string; revision: string }[];
};

type AnchorDownload = {
  href: string;
  download: string;
};

function buildDrawing(
  id: string,
  drawingNumber: string,
  title: string,
  revision: string,
  status: string,
  documentId: string,
  filename: string,
  fileSize = 1048576,
): Drawing {
  return {
    id,
    drawingNumber,
    title,
    revision,
    issueDate: '2026-05-01T00:00:00.000Z',
    status,
    createdAt: '2026-05-01T00:00:00.000Z',
    document: {
      id: documentId,
      filename,
      fileUrl: `/uploads/drawings/${filename}`,
      fileSize,
      mimeType: 'application/pdf',
      uploadedAt: '2026-05-01T00:00:00.000Z',
      uploadedBy: { id: E2E_ADMIN_USER.id, fullName: 'E2E Admin', email: E2E_ADMIN_USER.email },
    },
    supersededBy: null,
    supersedes: [],
  };
}

function buildStats(drawings: Drawing[]) {
  return {
    total: drawings.length,
    preliminary: drawings.filter((drawing) => drawing.status === 'preliminary').length,
    forConstruction: drawings.filter((drawing) => drawing.status === 'for_construction').length,
    asBuilt: drawings.filter((drawing) => drawing.status === 'as_built').length,
  };
}

function filterDrawings(drawings: Drawing[], url: URL) {
  return drawings.filter((drawing) => {
    const status = url.searchParams.get('status');
    if (status && drawing.status !== status) return false;

    const search = url.searchParams.get('search')?.toLowerCase();
    if (search) {
      return (
        drawing.drawingNumber.toLowerCase().includes(search) ||
        drawing.title?.toLowerCase().includes(search)
      );
    }

    return true;
  });
}

function paginateDrawings(drawings: Drawing[], url: URL) {
  const page = Number(url.searchParams.get('page') || '1');
  const limit = Number(url.searchParams.get('limit') || '50');
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 50;
  const start = (safePage - 1) * safeLimit;

  return {
    page: safePage,
    limit: safeLimit,
    drawings: drawings.slice(start, start + safeLimit),
  };
}

function readMultipartField(body: string, name: string): string {
  const match = new RegExp(`name="${name}"\\r\\n\\r\\n([^\\r\\n]*)`).exec(body);
  return match?.[1] ?? '';
}

async function mockSeededDrawingsApi(
  page: Page,
  options: { failList?: boolean; failCurrentSet?: boolean } = {},
) {
  const drawings: Drawing[] = [
    buildDrawing(
      E2E_DRAWING_ID,
      'DRW-E2E-001',
      'Site grading plan',
      'A',
      'for_construction',
      'e2e-current-document',
      'e2e-site-grading.pdf',
    ),
    buildDrawing(
      E2E_PRELIM_DRAWING_ID,
      'DRW-E2E-002',
      'Temporary works layout',
      'P1',
      'preliminary',
      'e2e-prelim-document',
      'e2e-temporary-works.pdf',
      2048,
    ),
  ];
  let uploadBody = '';
  let revisionBody = '';
  let statusRequest: unknown;
  let deleteRequestId: string | null = null;

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

    if (url.pathname === `/api/drawings/${E2E_PROJECT_ID}/current-set`) {
      if (options.failCurrentSet) {
        await json({ message: 'Current set unavailable' }, 500);
        return;
      }
      await json({
        drawings: drawings
          .filter((drawing) => !drawing.supersededBy)
          .map((drawing) => ({
            documentId: drawing.document.id,
            drawingNumber: drawing.drawingNumber,
            revision: drawing.revision,
            filename: drawing.document.filename,
            fileUrl: drawing.document.fileUrl,
          })),
      });
      return;
    }

    if (url.pathname === `/api/drawings/${E2E_PROJECT_ID}` && route.request().method() === 'GET') {
      if (options.failList) {
        await json({ message: 'Drawing register unavailable' }, 500);
        return;
      }
      const filtered = filterDrawings(drawings, url);
      const paged = paginateDrawings(filtered, url);
      await json({
        drawings: paged.drawings,
        stats: buildStats(filtered),
        pagination: {
          total: filtered.length,
          page: paged.page,
          limit: paged.limit,
          totalPages: Math.ceil(filtered.length / paged.limit),
          hasNextPage: paged.page * paged.limit < filtered.length,
          hasPrevPage: paged.page > 1,
        },
      });
      return;
    }

    if (url.pathname.endsWith('/signed-url') && route.request().method() === 'POST') {
      const documentId = url.pathname.split('/').at(-2);
      await json({
        signedUrl: `/signed/${documentId}`,
        expiresAt: '2026-05-09T02:00:00.000Z',
      });
      return;
    }

    if (url.pathname === '/api/drawings' && route.request().method() === 'POST') {
      uploadBody = route.request().postDataBuffer()?.toString('latin1') || '';
      const uploaded = buildDrawing(
        E2E_UPLOADED_DRAWING_ID,
        readMultipartField(uploadBody, 'drawingNumber') || 'DRW-E2E-003',
        readMultipartField(uploadBody, 'title') || 'Uploaded drainage plan',
        readMultipartField(uploadBody, 'revision') || 'A',
        readMultipartField(uploadBody, 'status') || 'preliminary',
        'e2e-uploaded-document',
        'e2e-uploaded-drawing.pdf',
        32,
      );
      uploaded.issueDate = `${readMultipartField(uploadBody, 'issueDate') || '2026-05-09'}T00:00:00.000Z`;
      drawings.unshift(uploaded);
      await json(uploaded, 201);
      return;
    }

    if (
      url.pathname === `/api/drawings/${E2E_DRAWING_ID}/supersede` &&
      route.request().method() === 'POST'
    ) {
      revisionBody = route.request().postDataBuffer()?.toString('latin1') || '';
      const original = drawings.find((drawing) => drawing.id === E2E_DRAWING_ID);
      const revision = readMultipartField(revisionBody, 'revision') || 'B';
      const replacement = buildDrawing(
        E2E_REVISION_DRAWING_ID,
        'DRW-E2E-001',
        readMultipartField(revisionBody, 'title') || original?.title || 'Site grading plan',
        revision,
        readMultipartField(revisionBody, 'status') || 'for_construction',
        'e2e-revision-document',
        'e2e-site-grading-rev-b.pdf',
      );
      replacement.issueDate = `${readMultipartField(revisionBody, 'issueDate') || '2026-05-10'}T00:00:00.000Z`;
      replacement.supersedes = original
        ? [
            {
              id: original.id,
              drawingNumber: original.drawingNumber,
              revision: original.revision || '',
            },
          ]
        : [];
      if (original) {
        original.supersededBy = {
          id: replacement.id,
          drawingNumber: replacement.drawingNumber,
          revision: replacement.revision || '',
        };
      }
      drawings.unshift(replacement);
      await json(replacement, 201);
      return;
    }

    if (url.pathname.startsWith('/api/drawings/') && route.request().method() === 'PATCH') {
      const drawingId = url.pathname.split('/').at(-1);
      statusRequest = route.request().postDataJSON();
      const drawing = drawings.find((item) => item.id === drawingId);
      if (drawing) {
        drawing.status = (statusRequest as { status?: string }).status || drawing.status;
      }
      await json(drawing);
      return;
    }

    if (url.pathname.startsWith('/api/drawings/') && route.request().method() === 'DELETE') {
      const drawingId = url.pathname.split('/').at(-1) || null;
      deleteRequestId = drawingId;
      const index = drawings.findIndex((drawing) => drawing.id === drawingId);
      if (index >= 0) {
        drawings.splice(index, 1);
      }
      await json({ message: 'Drawing deleted' });
      return;
    }

    await json({ message: `Unhandled E2E API route: ${url.pathname}` }, 404);
  });

  await mockAuthenticatedUserState(page);

  return {
    getUploadBody: () => uploadBody,
    getRevisionBody: () => revisionBody,
    getStatusRequest: () => statusRequest,
    getDeleteRequestId: () => deleteRequestId,
  };
}

test.describe('Drawings seeded register contract', () => {
  test('filters, downloads, uploads, supersedes, changes status, and deletes drawings', async ({
    page,
  }) => {
    const api = await mockSeededDrawingsApi(page);
    const openedUrls: string[] = [];
    const anchorDownloads: AnchorDownload[] = [];

    await page.exposeFunction('recordOpenedUrl', (url: string) => {
      openedUrls.push(url);
    });
    await page.exposeFunction('recordAnchorDownload', (download: AnchorDownload) => {
      anchorDownloads.push(download);
    });
    await page.addInitScript(() => {
      window.open = (url?: string | URL) => {
        void (
          window as typeof window & { recordOpenedUrl?: (openedUrl: string) => void }
        ).recordOpenedUrl?.(String(url || ''));
        return null;
      };

      HTMLAnchorElement.prototype.click = function () {
        void (
          window as typeof window & { recordAnchorDownload?: (download: AnchorDownload) => void }
        ).recordAnchorDownload?.({
          href: this.getAttribute('href') || this.href,
          download: this.download,
        });
      };
    });

    await page.goto(`/projects/${E2E_PROJECT_ID}/drawings`);

    await expect(page.getByRole('heading', { name: 'Drawing Register' })).toBeVisible();
    await expect(page.getByText('Manage project drawings and revisions')).toBeVisible();
    await expect(page.getByText('Total Drawings')).toBeVisible();
    await expect(
      page
        .locator('.grid')
        .filter({ hasText: 'Total Drawings' })
        .getByText('For Construction', { exact: true }),
    ).toBeVisible();

    const currentRow = page
      .getByRole('row')
      .filter({ hasText: 'DRW-E2E-001' })
      .filter({ hasText: 'Site grading plan' });
    const prelimRow = page.getByRole('row').filter({ hasText: 'DRW-E2E-002' });
    await expect(currentRow).toBeVisible();
    await expect(currentRow.getByText('A', { exact: true })).toBeVisible();
    await expect(currentRow.getByText('e2e-site-grading.pdf')).toBeVisible();
    await expect(currentRow.getByText('1.0 MB')).toBeVisible();
    await expect(prelimRow).toBeVisible();

    await page.getByLabel('Status', { exact: true }).selectOption('preliminary');
    await expect(prelimRow).toBeVisible();
    await expect(currentRow).toBeHidden();

    await page.getByLabel('Status', { exact: true }).selectOption('');
    await page.getByLabel('Search', { exact: true }).fill('grading');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(currentRow).toBeVisible();
    await expect(prelimRow).toBeHidden();

    await page.getByLabel('Search', { exact: true }).fill('');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await currentRow.getByLabel('Status for DRW-E2E-001').selectOption('as_built');
    await expect
      .poll(() => api.getStatusRequest())
      .toEqual(expect.objectContaining({ status: 'as_built' }));
    await expect(currentRow.getByLabel('Status for DRW-E2E-001')).toHaveValue('as_built');

    await currentRow.getByRole('button', { name: 'Download DRW-E2E-001' }).click();
    await expect.poll(() => openedUrls).toContain('/signed/e2e-current-document');

    await page.getByRole('button', { name: 'Download Current Set' }).click();
    await expect
      .poll(() => anchorDownloads.map((download) => download.download))
      .toEqual(
        expect.arrayContaining([
          'DRW-E2E-001_RevA_e2e-site-grading.pdf',
          'DRW-E2E-002_RevP1_e2e-temporary-works.pdf',
        ]),
      );
    await expect(page.getByText('2 current drawing(s) were opened for download.')).toBeVisible();

    await page.getByLabel('Search', { exact: true }).fill('does-not-exist');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.getByText('No drawings found')).toBeVisible();
    await expect(page.getByText('No drawings match the current filters.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download Current Set' })).toBeEnabled();
    const currentSetDownloadsBefore = anchorDownloads.length;
    await page.getByRole('button', { name: 'Download Current Set' }).click();
    await expect.poll(() => anchorDownloads.length).toBeGreaterThan(currentSetDownloadsBefore);

    await page.getByLabel('Search', { exact: true }).fill('');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(currentRow).toBeVisible();

    await page.getByRole('button', { name: 'Add Drawing' }).click();
    const uploadModal = page.getByRole('dialog').filter({ hasText: 'Add Drawing' });
    await expect(
      uploadModal.getByText('Upload a drawing file with its register number'),
    ).toBeVisible();
    await uploadModal.getByLabel('Select File *').setInputFiles({
      name: 'e2e-uploaded-drawing.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n%E2E drawing\n'),
    });
    await uploadModal.getByLabel('Drawing Number *').fill('DRW-E2E-003');
    await uploadModal.getByLabel('Title').fill('Uploaded drainage plan');
    await uploadModal.getByLabel('Revision').fill('A');
    await uploadModal.getByLabel('Issue Date').fill('2026-05-09');
    await uploadModal.getByLabel('Status').selectOption('for_construction');
    await uploadModal.getByRole('button', { name: 'Upload' }).click();

    await expect(page.getByText('DRW-E2E-003 was added to the register.')).toBeVisible();
    expect(api.getUploadBody()).toContain('name="drawingNumber"');
    expect(api.getUploadBody()).toContain('DRW-E2E-003');
    expect(api.getUploadBody()).toContain('name="status"');
    expect(api.getUploadBody()).toContain('for_construction');

    const uploadedRow = page.getByRole('row').filter({ hasText: 'DRW-E2E-003' });
    await expect(uploadedRow).toBeVisible();

    await currentRow.getByRole('button', { name: 'Upload new revision for DRW-E2E-001' }).click();
    const revisionModal = page.getByRole('dialog').filter({ hasText: 'Upload New Revision' });
    await expect(
      revisionModal.getByText('The existing drawing will be marked as superseded.'),
    ).toBeVisible();
    await revisionModal.getByLabel('Select File *').setInputFiles({
      name: 'e2e-site-grading-rev-b.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n%E2E revision\n'),
    });
    await revisionModal.getByLabel('New Revision *').fill('B');
    await revisionModal.getByLabel('Title').fill('Site grading plan issued');
    await revisionModal.getByLabel('Issue Date').fill('2026-05-10');
    await revisionModal.getByLabel('Status').selectOption('for_construction');
    await revisionModal.getByRole('button', { name: 'Upload Revision' }).click();

    await expect(page.getByText('DRW-E2E-001 Rev B is now in the register.')).toBeVisible();
    expect(api.getRevisionBody()).toContain('name="revision"');
    expect(api.getRevisionBody()).toContain('B');
    await expect(
      page
        .getByRole('row')
        .filter({ hasText: 'DRW-E2E-001' })
        .filter({ hasText: 'Site grading plan issued' }),
    ).toBeVisible();
    await expect(currentRow.getByText('(Superseded)')).toBeVisible();

    await uploadedRow.getByRole('button', { name: 'Delete DRW-E2E-003' }).click();
    const deleteDialog = page.getByRole('alertdialog').filter({ hasText: 'Delete Drawing' });
    await expect(deleteDialog.getByText('Delete drawing DRW-E2E-003 Rev A?')).toBeVisible();
    await deleteDialog.getByRole('button', { name: 'Delete' }).click();
    expect(api.getDeleteRequestId()).toBe(E2E_UPLOADED_DRAWING_ID);
    await expect(page.getByText('The drawing was removed from the register.')).toBeVisible();
    await expect(uploadedRow).toBeHidden();
  });

  test('shows drawing load failures instead of an empty register', async ({ page }) => {
    await mockSeededDrawingsApi(page, { failList: true });

    await page.goto(`/projects/${E2E_PROJECT_ID}/drawings`);

    await expect(page.getByRole('heading', { name: 'Drawing Register' })).toBeVisible();
    await expect(page.getByText('Failed to load drawings. Please try again.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download Current Set' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Add Drawing' })).toBeDisabled();
    await expect(page.getByText('No drawings found')).toBeHidden();
  });
});
