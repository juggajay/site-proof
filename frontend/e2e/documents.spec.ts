import { test, expect, type Page } from '@playwright/test';
import { Buffer } from 'node:buffer';
import { E2E_ADMIN_USER, E2E_PROJECT_ID, mockAuthenticatedUserState } from './helpers';

const E2E_PHOTO_DOC_ID = 'e2e-photo-document';
const E2E_PDF_DOC_ID = 'e2e-pdf-document';
const E2E_UPLOADED_DOC_ID = 'e2e-uploaded-document';

type SeededDocument = {
  id: string;
  documentType: string;
  category: string | null;
  filename: string;
  fileUrl: string;
  fileSize: number | null;
  mimeType: string | null;
  uploadedAt: string;
  uploadedBy: { id: string; fullName: string; email: string } | null;
  caption: string | null;
  lot: { id: string; lotNumber: string; description: string } | null;
  isFavourite: boolean;
};

const transparentPixel = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

function buildSeedDocuments(pdfFavourite = false, includeUploaded = false): SeededDocument[] {
  const documents: SeededDocument[] = [
    {
      id: E2E_PHOTO_DOC_ID,
      documentType: 'photo',
      category: 'quality',
      filename: 'e2e-proof-photo.jpg',
      fileUrl: '/uploads/e2e-proof-photo.jpg',
      fileSize: 2048,
      mimeType: 'image/jpeg',
      uploadedAt: '2026-05-01T01:00:00.000Z',
      uploadedBy: { id: E2E_ADMIN_USER.id, fullName: 'E2E Admin', email: E2E_ADMIN_USER.email },
      caption: 'E2E evidence photo',
      lot: { id: 'e2e-document-lot', lotNumber: 'LOT-DOC-001', description: 'Document lot' },
      isFavourite: true,
    },
    {
      id: E2E_PDF_DOC_ID,
      documentType: 'drawing',
      category: 'design',
      filename: 'e2e-drawing.pdf',
      fileUrl: '/uploads/e2e-drawing.pdf',
      fileSize: 1048576,
      mimeType: 'application/pdf',
      uploadedAt: '2026-05-02T01:00:00.000Z',
      uploadedBy: { id: E2E_ADMIN_USER.id, fullName: 'E2E Admin', email: E2E_ADMIN_USER.email },
      caption: 'E2E IFC drawing',
      lot: null,
      isFavourite: pdfFavourite,
    },
  ];

  if (includeUploaded) {
    documents.unshift({
      id: E2E_UPLOADED_DOC_ID,
      documentType: 'drawing',
      category: 'quality',
      filename: 'e2e-upload.pdf',
      fileUrl: '/uploads/e2e-upload.pdf',
      fileSize: 32,
      mimeType: 'application/pdf',
      uploadedAt: '2026-05-09T01:00:00.000Z',
      uploadedBy: { id: E2E_ADMIN_USER.id, fullName: 'E2E Admin', email: E2E_ADMIN_USER.email },
      caption: 'Uploaded from E2E',
      lot: { id: 'e2e-document-lot', lotNumber: 'LOT-DOC-001', description: 'Document lot' },
      isFavourite: false,
    });
  }

  return documents;
}

function filterDocuments(documents: SeededDocument[], url: URL) {
  return documents.filter((doc) => {
    if (
      url.searchParams.get('documentType') &&
      doc.documentType !== url.searchParams.get('documentType')
    ) {
      return false;
    }
    if (url.searchParams.get('category') && doc.category !== url.searchParams.get('category')) {
      return false;
    }
    if (url.searchParams.get('lotId') && doc.lot?.id !== url.searchParams.get('lotId')) {
      return false;
    }
    if (url.searchParams.get('search')) {
      const query = url.searchParams.get('search')!.toLowerCase();
      return (
        doc.filename.toLowerCase().includes(query) || doc.caption?.toLowerCase().includes(query)
      );
    }
    return true;
  });
}

async function mockSeededDocumentsApi(
  page: Page,
  options: { failDocumentLoadsUntil?: number; shortSignedUrlExpiry?: boolean } = {},
) {
  let pdfFavourite = false;
  let includeUploaded = false;
  let favouriteRequest: unknown;
  let favouriteRequestCount = 0;
  let deleteRequestId: string | null = null;
  let uploadBody = '';
  let documentLoadCount = 0;
  const signedUrlRequestCounts = new Map<string, number>();

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

    if (url.pathname === '/api/lots' && url.searchParams.get('projectId') === E2E_PROJECT_ID) {
      await json({
        lots: [
          {
            id: 'e2e-document-lot',
            lotNumber: 'LOT-DOC-001',
            description: 'Document lot',
          },
        ],
      });
      return;
    }

    if (url.pathname === `/api/documents/${E2E_PROJECT_ID}` && route.request().method() === 'GET') {
      documentLoadCount += 1;
      if (documentLoadCount <= (options.failDocumentLoadsUntil ?? 0)) {
        await json({ message: 'Document register unavailable' }, 503);
        return;
      }

      const documents = filterDocuments(buildSeedDocuments(pdfFavourite, includeUploaded), url);
      await json({
        documents,
        categories: {
          quality: documents.filter((doc) => doc.category === 'quality').length,
          design: documents.filter((doc) => doc.category === 'design').length,
        },
      });
      return;
    }

    if (url.pathname.endsWith('/signed-url') && route.request().method() === 'POST') {
      const documentId = url.pathname.split('/').at(-2);
      if (documentId) {
        signedUrlRequestCounts.set(documentId, (signedUrlRequestCounts.get(documentId) ?? 0) + 1);
      }
      await json({
        signedUrl: documentId === E2E_PHOTO_DOC_ID ? transparentPixel : '/signed/e2e-document',
        expiresAt: new Date(
          Date.now() + (options.shortSignedUrlExpiry ? 100 : 60_000),
        ).toISOString(),
      });
      return;
    }

    if (
      url.pathname === `/api/documents/${E2E_PDF_DOC_ID}` &&
      route.request().method() === 'PATCH'
    ) {
      favouriteRequestCount += 1;
      favouriteRequest = route.request().postDataJSON();
      pdfFavourite = Boolean((favouriteRequest as { isFavourite?: boolean }).isFavourite);
      await new Promise((resolve) => setTimeout(resolve, 250));
      await json(
        buildSeedDocuments(pdfFavourite, includeUploaded).find((doc) => doc.id === E2E_PDF_DOC_ID),
      );
      return;
    }

    if (
      url.pathname === `/api/documents/${E2E_PDF_DOC_ID}` &&
      route.request().method() === 'DELETE'
    ) {
      deleteRequestId = E2E_PDF_DOC_ID;
      await json({ success: true });
      return;
    }

    if (url.pathname === '/api/documents/upload' && route.request().method() === 'POST') {
      uploadBody = route.request().postDataBuffer()?.toString('latin1') || '';
      includeUploaded = true;
      await json(buildSeedDocuments(pdfFavourite, includeUploaded)[0]);
      return;
    }

    await json({ message: `Unhandled E2E API route: ${url.pathname}` }, 404);
  });

  await mockAuthenticatedUserState(page);

  return {
    getFavouriteRequest: () => favouriteRequest,
    getFavouriteRequestCount: () => favouriteRequestCount,
    getDeleteRequestId: () => deleteRequestId,
    getDocumentLoadCount: () => documentLoadCount,
    getSignedUrlRequestCount: (documentId: string) => signedUrlRequestCounts.get(documentId) ?? 0,
    getUploadBody: () => uploadBody,
  };
}

test.describe('Documents seeded evidence contract', () => {
  test('renders seeded documents, filters, uploads, favourites, previews, downloads, and deletes', async ({
    page,
  }) => {
    const api = await mockSeededDocumentsApi(page);
    const openedUrls: string[] = [];
    await page.exposeFunction('recordOpenedUrl', (url: string) => {
      openedUrls.push(url);
    });
    await page.addInitScript(() => {
      window.open = (url?: string | URL) => {
        void (
          window as typeof window & { recordOpenedUrl?: (openedUrl: string) => void }
        ).recordOpenedUrl?.(String(url || ''));
        return null;
      };
    });

    await page.goto(`/projects/${E2E_PROJECT_ID}/documents`);

    await expect(page.getByRole('heading', { name: 'Documents & Photos' })).toBeVisible();
    await expect(page.getByText('Upload and manage project documents and photos')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Upload Document' })).toBeVisible();

    const photoItem = page
      .locator('.flex.items-center.gap-4.p-4')
      .filter({ hasText: 'e2e-proof-photo.jpg' });
    await expect(photoItem).toBeVisible();
    await expect(photoItem.getByText('Photo', { exact: true })).toBeVisible();
    await expect(photoItem.getByText('quality', { exact: true })).toBeVisible();
    await expect(photoItem.getByText('2.0 KB')).toBeVisible();
    await expect(photoItem.getByText('by E2E Admin')).toBeVisible();
    await expect(photoItem.getByText('Lot LOT-DOC-001')).toBeVisible();
    await expect(photoItem.getByText('E2E evidence photo')).toBeVisible();

    const pdfItem = page
      .locator('.flex.items-center.gap-4.p-4')
      .filter({ hasText: 'e2e-drawing.pdf' });
    await expect(pdfItem).toBeVisible();
    await expect(pdfItem.getByText('Drawing', { exact: true })).toBeVisible();
    await expect(pdfItem.getByText('design', { exact: true })).toBeVisible();
    await expect(pdfItem.getByText('1.0 MB')).toBeVisible();
    await expect(pdfItem.getByText('E2E IFC drawing')).toBeVisible();

    await page.getByLabel('Document Type').selectOption('drawing');
    await expect(pdfItem).toBeVisible();
    await expect(photoItem).toBeHidden();

    await page.getByRole('button', { name: 'Clear All' }).click();
    await expect(photoItem).toBeVisible();
    await page.getByLabel('Search', { exact: true }).fill('proof');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(photoItem).toBeVisible();
    await expect(pdfItem).toBeHidden();

    await page.getByRole('button', { name: 'Clear All' }).click();
    await expect(pdfItem).toBeVisible();
    await pdfItem.getByRole('button', { name: 'Add to Favourites' }).click();
    expect(api.getFavouriteRequest()).toMatchObject({ isFavourite: true });

    await page.getByRole('button', { name: 'Favourites', exact: true }).click();
    await expect(photoItem).toBeVisible();
    await expect(pdfItem).toBeVisible();
    await page.getByRole('button', { name: 'Clear All' }).click();

    await photoItem.getByRole('button', { name: 'View' }).click();
    const viewer = page.getByTestId('document-viewer-modal');
    await expect(viewer.getByText('e2e-proof-photo.jpg')).toBeVisible();
    await expect(viewer.getByText('E2E evidence photo')).toBeVisible();
    await viewer.getByRole('button', { name: 'Close' }).click();

    await pdfItem.getByRole('button', { name: 'Download' }).click();
    await expect.poll(() => openedUrls).toContain('/signed/e2e-document');

    await page.getByRole('button', { name: 'Upload Document' }).click();
    const uploadModal = page.getByRole('dialog').filter({ hasText: 'Upload Document' });
    await expect(uploadModal.getByRole('heading', { name: 'Upload Document' })).toBeVisible();
    await uploadModal.getByLabel('Select Files').setInputFiles({
      name: 'e2e-upload.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n%E2E\n'),
    });
    await expect(uploadModal.getByText('1 file selected')).toBeVisible();
    await expect(uploadModal.getByLabel('Document Type *')).toHaveValue('drawing');
    await uploadModal.getByLabel('Category').selectOption('quality');
    await uploadModal.getByLabel('Link to Lot (optional)').selectOption('e2e-document-lot');
    await uploadModal.getByLabel('Description').fill('  Uploaded from E2E  ');
    await uploadModal.getByRole('button', { name: 'Upload' }).click();

    await expect(page.getByText('1 file uploaded successfully.')).toBeVisible();
    expect(api.getUploadBody()).toContain('name="documentType"');
    expect(api.getUploadBody()).toContain('drawing');
    expect(api.getUploadBody()).toContain('name="category"');
    expect(api.getUploadBody()).toContain('quality');
    expect(api.getUploadBody()).toContain('name="lotId"');
    expect(api.getUploadBody()).toContain('e2e-document-lot');
    expect(api.getUploadBody()).toContain('Uploaded from E2E');
    expect(api.getUploadBody()).not.toContain('  Uploaded from E2E  ');
    await expect(page.getByText('e2e-upload.pdf')).toBeVisible();

    await pdfItem.getByRole('button', { name: 'Delete' }).click();
    const deleteDialog = page.getByRole('alertdialog').filter({ hasText: 'Delete Document' });
    await expect(deleteDialog.getByText('Delete "e2e-drawing.pdf"?')).toBeVisible();
    await deleteDialog.getByRole('button', { name: 'Delete' }).click();
    expect(api.getDeleteRequestId()).toBe(E2E_PDF_DOC_ID);
  });

  test('surfaces load failures with retry and no false empty state', async ({ page }) => {
    const api = await mockSeededDocumentsApi(page, { failDocumentLoadsUntil: 2 });

    await page.goto(`/projects/${E2E_PROJECT_ID}/documents`);

    const alert = page.getByRole('alert');
    await expect(alert).toContainText('Document register unavailable');
    await expect(page.getByText('No documents found')).toHaveCount(0);

    await alert.getByRole('button', { name: 'Try again' }).click();

    await expect(page.getByText('e2e-proof-photo.jpg')).toBeVisible();
    await expect(page.getByText('e2e-drawing.pdf')).toBeVisible();
    expect(api.getDocumentLoadCount()).toBeGreaterThanOrEqual(3);
  });

  test('refreshes expiring signed thumbnail URLs while the register remains open', async ({
    page,
  }) => {
    const api = await mockSeededDocumentsApi(page, { shortSignedUrlExpiry: true });

    await page.goto(`/projects/${E2E_PROJECT_ID}/documents`);

    await expect(page.getByText('e2e-proof-photo.jpg')).toBeVisible();
    await expect
      .poll(() => api.getSignedUrlRequestCount(E2E_PHOTO_DOC_ID))
      .toBeGreaterThanOrEqual(1);
    await expect
      .poll(() => api.getSignedUrlRequestCount(E2E_PHOTO_DOC_ID), { timeout: 4_000 })
      .toBeGreaterThan(1);
  });

  test('guards duplicate favourite updates from rapid clicks', async ({ page }) => {
    const api = await mockSeededDocumentsApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/documents`);

    const pdfItem = page
      .locator('.flex.items-center.gap-4.p-4')
      .filter({ hasText: 'e2e-drawing.pdf' });
    await expect(pdfItem).toBeVisible();
    await pdfItem.getByRole('button', { name: 'Add to Favourites' }).dblclick();

    await expect.poll(() => api.getFavouriteRequest()).toMatchObject({ isFavourite: true });
    expect(api.getFavouriteRequestCount()).toBe(1);
  });
});
