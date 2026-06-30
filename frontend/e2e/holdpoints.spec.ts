import { test, expect, type Page } from '@playwright/test';
import { E2E_ADMIN_USER, E2E_PROJECT_ID, mockAuthenticatedUserState } from './helpers';

const E2E_PENDING_HP_ID = 'e2e-hp-pending';
const E2E_NOTIFIED_HP_ID = 'e2e-hp-notified';
const E2E_RELEASED_HP_ID = 'e2e-hp-released';

interface MockHoldPointsOptions {
  failHoldPointLoadsUntil?: number;
  paginatedHoldPoints?: ReturnType<typeof buildHoldPoints>;
  failRecordReleaseMessage?: string;
}

function getFutureDateValue() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

function buildHoldPoints(
  pendingReleaseRequested = false,
  requestedScheduledDate: string | null = null,
  notifiedReleaseRecorded = false,
) {
  const now = new Date().toISOString();

  return [
    {
      id: E2E_PENDING_HP_ID,
      lotId: 'e2e-lot-pending',
      lotNumber: 'LOT-HP-001',
      itpChecklistItemId: 'e2e-item-pending',
      description: 'Verify formation before covering work',
      pointType: 'hold_point',
      status: pendingReleaseRequested ? 'notified' : 'pending',
      notificationSentAt: pendingReleaseRequested ? now : null,
      scheduledDate: requestedScheduledDate,
      releasedAt: null,
      releasedByName: null,
      releasedByOrg: null,
      releaseMethod: null,
      releaseRecipientEmail: null,
      releaseNotes: null,
      sequenceNumber: 3,
      isCompleted: false,
      isVerified: false,
      createdAt: '2026-01-15T00:00:00.000Z',
    },
    {
      id: E2E_NOTIFIED_HP_ID,
      lotId: 'e2e-lot-notified',
      lotNumber: 'LOT-HP-002',
      itpChecklistItemId: 'e2e-item-notified',
      description: 'Superintendent release for basecourse',
      pointType: 'hold_point',
      status: notifiedReleaseRecorded ? 'released' : 'notified',
      notificationSentAt: '2026-01-15T01:00:00.000Z',
      scheduledDate: '2026-01-16',
      releasedAt: notifiedReleaseRecorded ? now : null,
      releasedByName: notifiedReleaseRecorded ? 'E2E Release Reviewer' : null,
      releasedByOrg: notifiedReleaseRecorded ? 'E2E Superintendent Org' : null,
      releaseMethod: notifiedReleaseRecorded ? 'email' : null,
      releaseRecipientEmail: null,
      releaseNotes: notifiedReleaseRecorded ? 'Release accepted from seeded test' : null,
      sequenceNumber: 4,
      isCompleted: false,
      isVerified: false,
      createdAt: '2026-01-15T00:00:00.000Z',
    },
    {
      id: E2E_RELEASED_HP_ID,
      lotId: 'e2e-lot-released',
      lotNumber: 'LOT-HP-003',
      itpChecklistItemId: 'e2e-item-released',
      description: 'Released asphalt witness point',
      pointType: 'hold_point',
      status: 'released',
      notificationSentAt: '2026-01-15T01:00:00.000Z',
      scheduledDate: '2026-01-16',
      releasedAt: now,
      releasedByName: 'E2E Superintendent',
      releasedByOrg: 'E2E Superintendent Org',
      releaseMethod: 'secure_link',
      releaseRecipientEmail: 'e2e.super@example.com',
      releaseNotes: 'Released in seeded data',
      sequenceNumber: 5,
      isCompleted: true,
      isVerified: true,
      createdAt: '2026-01-15T00:00:00.000Z',
    },
  ];
}

function buildManyHoldPoints(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `e2e-hp-page-${String(index + 1).padStart(2, '0')}`,
    lotId: `e2e-lot-page-${String(index + 1).padStart(2, '0')}`,
    lotNumber: `LOT-HP-${String(index + 1).padStart(3, '0')}`,
    itpChecklistItemId: `e2e-item-page-${String(index + 1).padStart(2, '0')}`,
    description: `Paginated hold point ${index + 1}`,
    pointType: 'hold_point',
    status: 'pending',
    notificationSentAt: null,
    scheduledDate: null,
    releasedAt: null,
    releasedByName: null,
    releasedByOrg: null,
    releaseMethod: null,
    releaseRecipientEmail: null,
    releaseNotes: null,
    sequenceNumber: index + 1,
    isCompleted: false,
    isVerified: false,
    createdAt: '2026-01-15T00:00:00.000Z',
  }));
}

async function mockSeededHoldPointsApi(page: Page, options: MockHoldPointsOptions = {}) {
  let pendingReleaseRequested = false;
  let requestedScheduledDate: string | null = null;
  let notifiedReleaseRecorded = false;
  let releaseRequest: unknown;
  let recordReleaseRequest: unknown;
  let evidenceUploadCount = 0;
  let chaseCount = 0;
  let holdPointLoadCount = 0;
  const holdPointRegisterRequests: string[] = [];

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

    if (url.pathname === `/api/holdpoints/project/${E2E_PROJECT_ID}`) {
      holdPointLoadCount += 1;
      holdPointRegisterRequests.push(url.search);
      if (holdPointLoadCount <= (options.failHoldPointLoadsUntil || 0)) {
        await json({ message: 'Hold point register unavailable' }, 503);
        return;
      }

      const allHoldPoints =
        options.paginatedHoldPoints ||
        buildHoldPoints(pendingReleaseRequested, requestedScheduledDate, notifiedReleaseRecorded);
      const returnAll = url.searchParams.get('all') === 'true';
      const pageNumber = returnAll ? 1 : Number(url.searchParams.get('page') || '1');
      const limit = returnAll ? 5000 : Number(url.searchParams.get('limit') || '20');
      const start = (pageNumber - 1) * limit;
      const holdPoints = returnAll
        ? allHoldPoints.slice(0, limit)
        : allHoldPoints.slice(start, start + limit);

      await json({
        holdPoints,
        pagination: {
          total: allHoldPoints.length,
          page: pageNumber,
          limit,
          totalPages: Math.ceil(allHoldPoints.length / limit),
          hasNextPage: pageNumber * limit < allHoldPoints.length,
          hasPrevPage: pageNumber > 1,
        },
      });
      return;
    }

    if (url.pathname === '/api/holdpoints/lot/e2e-lot-pending/item/e2e-item-pending') {
      const holdPoint = buildHoldPoints(
        pendingReleaseRequested,
        requestedScheduledDate,
        notifiedReleaseRecorded,
      )[0];
      await json({
        holdPoint,
        prerequisites: [
          {
            id: 'e2e-prerequisite',
            description: 'Complete preceding compaction result',
            sequenceNumber: 2,
            isHoldPoint: false,
            isCompleted: true,
            isVerified: true,
            completedAt: '2026-01-15T02:00:00.000Z',
          },
        ],
        incompletePrerequisites: [],
        canRequestRelease: true,
        defaultRecipients: ['inspector@example.com'],
        approvalRequirement: 'superintendent',
      });
      return;
    }

    if (url.pathname === '/api/holdpoints/lot/e2e-lot-notified/item/e2e-item-notified') {
      const holdPoint = buildHoldPoints(
        pendingReleaseRequested,
        requestedScheduledDate,
        notifiedReleaseRecorded,
      )[1];
      await json({
        holdPoint,
        prerequisites: [
          {
            id: 'e2e-notified-prerequisite',
            description: 'Complete basecourse density results',
            sequenceNumber: 3,
            isHoldPoint: false,
            isCompleted: true,
            isVerified: true,
            completedAt: '2026-01-15T02:00:00.000Z',
          },
        ],
        incompletePrerequisites: [],
        canRequestRelease: true,
        defaultRecipients: ['superintendent@example.com'],
        approvalRequirement: 'superintendent',
      });
      return;
    }

    if (url.pathname === '/api/holdpoints/request-release') {
      releaseRequest = route.request().postDataJSON();
      requestedScheduledDate = (releaseRequest as { scheduledDate?: string }).scheduledDate || null;
      pendingReleaseRequested = true;
      await json({
        holdPoint: buildHoldPoints(
          pendingReleaseRequested,
          requestedScheduledDate,
          notifiedReleaseRecorded,
        )[0],
      });
      return;
    }

    if (url.pathname === `/api/holdpoints/${E2E_NOTIFIED_HP_ID}/release`) {
      recordReleaseRequest = route.request().postDataJSON();
      if (options.failRecordReleaseMessage) {
        await json({ error: { message: options.failRecordReleaseMessage } }, 400);
        return;
      }

      notifiedReleaseRecorded = true;
      await json({
        holdPoint: buildHoldPoints(
          pendingReleaseRequested,
          requestedScheduledDate,
          notifiedReleaseRecorded,
        )[1],
      });
      return;
    }

    if (url.pathname === '/api/documents/upload') {
      evidenceUploadCount += 1;
      await json({
        id: `e2e-release-evidence-${evidenceUploadCount}`,
        filename: `release-evidence-${evidenceUploadCount}.pdf`,
        fileUrl: `/uploads/release-evidence-${evidenceUploadCount}.pdf`,
      });
      return;
    }

    if (url.pathname === `/api/holdpoints/${E2E_NOTIFIED_HP_ID}/chase`) {
      chaseCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 250));
      await json({ holdPoint: { chaseCount } });
      return;
    }

    await json({ message: `Unhandled E2E API route: ${url.pathname}` }, 404);
  });

  await mockAuthenticatedUserState(page);

  return {
    getReleaseRequest: () => releaseRequest,
    getRecordReleaseRequest: () => recordReleaseRequest,
    getEvidenceUploadCount: () => evidenceUploadCount,
    getChaseCount: () => chaseCount,
    getHoldPointRegisterRequests: () => holdPointRegisterRequests,
  };
}

function buildPublicReleasePackage({
  status = 'notified',
  recipientName = 'E2E Superintendent',
}: {
  status?: string;
  recipientName?: string | null;
} = {}) {
  const released = status === 'released';
  return {
    evidencePackage: {
      holdPoint: {
        id: 'e2e-public-hp',
        description: 'External superintendent release before concrete pour',
        itpChecklistItemId: 'e2e-public-checklist-item',
        status,
        notificationSentAt: '2026-03-01T22:00:00.000Z',
        scheduledDate: '2026-03-02T00:00:00.000Z',
        releasedAt: released ? '2026-03-02T01:00:00.000Z' : null,
        releasedByName: released ? 'Already Released Superintendent' : null,
        releasedByOrg: released ? 'Client Superintendent Org' : null,
        releaseMethod: released ? 'secure_link' : null,
        releaseNotes: released ? 'Released before reopening the secure link' : null,
      },
      lot: {
        id: 'e2e-public-lot',
        lotNumber: 'HP-PUBLIC-001',
        description: 'Concrete slab pour',
        activityType: 'Structures',
        chainageStart: null,
        chainageEnd: null,
      },
      project: {
        id: E2E_PROJECT_ID,
        name: 'E2E Highway Upgrade',
        projectNumber: 'E2E-001',
      },
      itpTemplate: {
        id: 'e2e-public-itp',
        name: 'Structures Hold Point ITP',
        activityType: 'Structures',
      },
      checklist: [
        {
          itpChecklistItemId: 'e2e-public-checklist-item',
          sequenceNumber: 1,
          description: 'Confirm formwork and reinforcement before pour',
          pointType: 'hold_point',
          responsibleParty: 'Superintendent',
          isCompleted: released,
          completedAt: released ? '2026-03-02T01:00:00.000Z' : null,
          completedBy: released ? 'Already Released Superintendent' : null,
          isVerified: released,
          verifiedAt: released ? '2026-03-02T01:00:00.000Z' : null,
          verifiedBy: released ? 'Already Released Superintendent' : null,
          notes: 'Ready for superintendent release',
          attachments: [
            {
              id: 'e2e-public-attachment',
              documentId: 'e2e-public-document',
              filename: 'formwork-check.pdf',
              caption: 'Formwork checklist',
            },
          ],
        },
      ],
      testResults: [
        {
          id: 'e2e-public-test',
          testType: 'Concrete slump',
          testRequestNumber: 'TR-PUBLIC-001',
          laboratoryName: 'E2E Lab',
          resultValue: 80,
          resultUnit: 'mm',
          passFail: 'pass',
          status: 'verified',
          isVerified: true,
          verifiedBy: 'E2E Engineer',
          createdAt: '2026-03-02T00:45:00.000Z',
        },
      ],
      photos: [
        {
          id: 'e2e-public-photo',
          filename: 'reinforcement-before-pour.jpg',
          caption: 'Pre-pour inspection',
          uploadedAt: '2026-03-02T00:50:00.000Z',
        },
      ],
      summary: {
        totalChecklistItems: 1,
        completedItems: released ? 1 : 0,
        verifiedItems: released ? 1 : 0,
        totalTestResults: 1,
        passingTests: 1,
        totalPhotos: 1,
        totalAttachments: 1,
      },
      generatedAt: '2026-03-02T01:00:00.000Z',
    },
    tokenInfo: {
      recipientEmail: 'external.superintendent@example.com',
      recipientName,
      expiresAt: '2026-03-04T00:00:00.000Z',
      canRelease: !released,
    },
  };
}

async function mockPublicHoldPointReleaseApi(
  page: Page,
  options: {
    loadStatus?: number;
    loadMessage?: string;
    releaseStatus?: number;
    releaseMessage?: string;
    initialStatus?: string;
    recipientName?: string | null;
  } = {},
) {
  let releaseRequest: unknown;
  let releaseCount = 0;

  await page.addInitScript(() => {
    localStorage.setItem(
      'cookie_consent',
      JSON.stringify({
        version: 'v1',
        accepted: true,
        timestamp: '2026-01-15T00:00:00.000Z',
      }),
    );
  });

  await page.route('**/api/holdpoints/public/e2e-public-token', async (route) => {
    if ((options.loadStatus || 200) !== 200) {
      await route.fulfill({
        status: options.loadStatus || 410,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { message: options.loadMessage || 'This secure release link has expired.' },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        buildPublicReleasePackage({
          status: options.initialStatus || 'notified',
          recipientName: Object.prototype.hasOwnProperty.call(options, 'recipientName')
            ? options.recipientName
            : 'E2E Superintendent',
        }),
      ),
    });
  });

  await page.route('**/api/holdpoints/public/e2e-public-token/release', async (route) => {
    releaseCount += 1;
    releaseRequest = route.request().postDataJSON();
    const requestBody = releaseRequest as { releasedByName?: string };

    if ((options.releaseStatus || 200) !== 200) {
      await route.fulfill({
        status: options.releaseStatus || 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { message: options.releaseMessage || 'Release could not be recorded.' },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'Hold point released successfully via secure link',
        holdPoint: {
          status: 'released',
          itpChecklistItemId: 'e2e-public-checklist-item',
          releasedAt: '2026-03-02T01:20:00.000Z',
          releasedByName: requestBody.releasedByName || 'E2E Superintendent',
          releasedByOrg: 'Client Superintendent Org',
          releaseMethod: 'secure_link',
          releaseNotes: 'Evidence reviewed and accepted',
        },
      }),
    });
  });

  return {
    getReleaseRequest: () => releaseRequest,
    getReleaseCount: () => releaseCount,
  };
}

// M20: the public secure-link release requires a signature. Draw a short stroke
// on the SignaturePad canvas so onChange fires a non-empty data URL and the
// "Release Hold Point" button becomes enabled.
async function drawReleaseSignature(page: Page) {
  const canvas = page.locator('canvas').first();
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Signature canvas was not rendered');
  await canvas.dragTo(canvas, {
    sourcePosition: { x: box.width * 0.25, y: box.height * 0.5 },
    targetPosition: { x: box.width * 0.75, y: box.height * 0.6 },
  });
  await expect(page.getByText('Signature captured')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Release Hold Point' })).toBeEnabled();
}

test.describe('Hold points seeded release contract', () => {
  test('renders seeded hold points, requests release, filters notified items, and chases release @pr-smoke', async ({
    page,
  }) => {
    const api = await mockSeededHoldPointsApi(page);
    const scheduledDate = getFutureDateValue();

    await page.goto(`/projects/${E2E_PROJECT_ID}/hold-points`);

    await expect(page.getByRole('heading', { name: 'Hold Points' })).toBeVisible();
    await expect(
      page.getByText('Track and release hold points requiring third-party inspection'),
    ).toBeVisible();
    await expect(page.getByText('Total HPs')).toBeVisible();
    await expect(page.getByRole('combobox')).toContainText('Awaiting Release');
    await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible();

    const pendingRow = page.getByRole('row').filter({ hasText: 'LOT-HP-001' });
    await expect(pendingRow).toBeVisible();
    await expect(pendingRow.getByText('Verify formation before covering work')).toBeVisible();
    await expect(pendingRow.getByText('Pending')).toBeVisible();
    await expect(
      pendingRow.getByRole('button', { name: 'Copy link to hold point LOT-HP-001' }),
    ).toBeVisible();
    await expect(pendingRow.getByRole('button', { name: 'Request Release' })).toBeVisible();

    const notifiedRow = page.getByRole('row').filter({ hasText: 'LOT-HP-002' });
    await expect(notifiedRow).toBeVisible();
    await expect(notifiedRow.getByText('Superintendent release for basecourse')).toBeVisible();
    await expect(notifiedRow.getByText('Awaiting Release')).toBeVisible();
    await expect(notifiedRow.getByText('OVERDUE')).toBeVisible();
    await expect(notifiedRow.getByRole('button', { name: 'Record Manual Release' })).toBeVisible();
    await expect(notifiedRow.getByRole('button', { name: 'Chase' })).toBeVisible();

    const releasedRow = page.getByRole('row').filter({ hasText: 'LOT-HP-003' });
    await expect(releasedRow).toBeVisible();
    await expect(releasedRow.getByText('Released asphalt witness point')).toBeVisible();
    await expect(releasedRow.getByText('E2E Superintendent')).toBeVisible();
    await expect(releasedRow.getByText('E2E Superintendent Org')).toBeVisible();
    await expect(releasedRow.getByText('Secure link')).toBeVisible();
    await expect(releasedRow.getByText('sent to e2e.super@example.com')).toBeVisible();
    await expect(releasedRow.getByRole('button', { name: 'Evidence PDF' })).toBeVisible();

    await pendingRow.getByRole('button', { name: 'Request Release' }).click();

    const modal = page.getByRole('dialog').filter({ hasText: 'Request Hold Point Release' });
    await expect(modal.getByRole('heading', { name: 'Request Hold Point Release' })).toBeVisible();
    await expect(modal.getByText('Complete preceding compaction result')).toBeVisible();
    await expect(modal.getByText('All prerequisites completed')).toBeVisible();
    await expect(
      modal.getByPlaceholder('inspector@example.com, superintendent@example.com'),
    ).toHaveValue('inspector@example.com');

    await modal.locator('input[type="date"]').fill(scheduledDate);
    await modal.locator('input[type="time"]').fill('09:30');
    await modal.getByRole('button', { name: 'Request Release' }).click();

    expect(api.getReleaseRequest()).toMatchObject({
      lotId: 'e2e-lot-pending',
      itpChecklistItemId: 'e2e-item-pending',
      scheduledDate,
      scheduledTime: '09:30',
      notificationSentTo: 'inspector@example.com',
      noticePeriodOverride: false,
    });
    await expect(pendingRow.getByText('Awaiting Release')).toBeVisible();
    await expect(pendingRow.getByRole('button', { name: 'Record Manual Release' })).toBeVisible();

    await page.locator('select').selectOption('notified');
    await expect(releasedRow).toBeHidden();
    await expect(pendingRow).toBeVisible();
    await expect(notifiedRow).toBeVisible();

    await notifiedRow.getByRole('button', { name: 'Chase' }).click();
    await expect.poll(() => api.getChaseCount()).toBe(1);

    await page.locator('select').selectOption('all');
    await notifiedRow.getByRole('button', { name: 'Record Manual Release' }).click();

    const recordModal = page
      .getByRole('dialog')
      .filter({ hasText: 'Record Manual Hold Point Release' });
    await expect(recordModal.getByText('Superintendent Approval Required')).toBeVisible();
    await recordModal.getByLabel('Email Confirmation').check();
    await recordModal.locator('#evidence-upload').setInputFiles({
      name: 'release-email.eml',
      mimeType: 'message/rfc822',
      buffer: Buffer.from('Subject: Release approved\n\nApproved by email.'),
    });
    await recordModal
      .getByPlaceholder('Enter name of person releasing')
      .fill('E2E Release Reviewer');
    await recordModal
      .getByPlaceholder("Enter organisation (e.g., Superintendent's Rep)")
      .fill('E2E Superintendent Org');
    await recordModal.locator('input[type="date"]').fill('2026-02-03');
    await recordModal.locator('input[type="time"]').fill('14:20');
    await recordModal
      .getByPlaceholder('Any additional notes about the release...')
      .fill('Release accepted from seeded test');
    await recordModal.getByRole('button', { name: 'Record Manual Release' }).click();

    await expect
      .poll(() => api.getRecordReleaseRequest())
      .toMatchObject({
        releasedByName: 'E2E Release Reviewer',
        releasedByOrg: 'E2E Superintendent Org',
        releaseDate: '2026-02-03',
        releaseTime: '14:20',
        releaseMethod: 'email',
        releaseNotes:
          'Release accepted from seeded test\nEvidence uploaded: release-evidence-1.pdf',
      });
    await expect(notifiedRow.getByText('Released', { exact: true }).first()).toBeVisible();
    await expect(notifiedRow.getByText('E2E Release Reviewer')).toBeVisible();
    await expect(notifiedRow.getByText('E2E Superintendent Org')).toBeVisible();
  });

  test('surfaces hold point load failures with retry and no false empty state', async ({
    page,
  }) => {
    await mockSeededHoldPointsApi(page, { failHoldPointLoadsUntil: 1 });

    await page.goto(`/projects/${E2E_PROJECT_ID}/hold-points`);

    await expect(page.getByRole('alert')).toContainText('Hold point register unavailable');
    await expect(page.getByText('No Hold Points')).toBeHidden();

    await page.getByRole('button', { name: 'Try again' }).click();

    await expect(page.getByRole('alert')).toBeHidden();
    await expect(page.getByText('LOT-HP-001')).toBeVisible();
    await expect(page.getByText('Total HPs')).toBeVisible();
  });

  test('loads the bounded backend register before treating the hold point register as complete', async ({
    page,
  }) => {
    const api = await mockSeededHoldPointsApi(page, {
      paginatedHoldPoints: buildManyHoldPoints(25),
    });

    await page.goto(`/projects/${E2E_PROJECT_ID}/hold-points`);

    await expect(page.getByText('LOT-HP-001')).toBeVisible();
    await expect(page.getByText('Total HPs').locator('..').getByText('25')).toBeVisible();
    expect(api.getHoldPointRegisterRequests()).toEqual(['?all=true']);
  });

  test('guards duplicate chase notifications from rapid clicks', async ({ page }) => {
    const api = await mockSeededHoldPointsApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/hold-points`);

    const notifiedRow = page.getByRole('row').filter({ hasText: 'LOT-HP-002' });
    await expect(notifiedRow).toBeVisible();
    await notifiedRow.getByRole('button', { name: 'Chase' }).dblclick();

    await expect.poll(() => api.getChaseCount()).toBe(1);
    await expect(notifiedRow.getByRole('button', { name: 'Chase' })).toBeEnabled();
  });

  test('submits only evidence that belongs to the final release method', async ({ page }) => {
    const api = await mockSeededHoldPointsApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/hold-points`);

    const notifiedRow = page.getByRole('row').filter({ hasText: 'LOT-HP-002' });
    await expect(notifiedRow).toBeVisible();
    await notifiedRow.getByRole('button', { name: 'Record Manual Release' }).click();

    const recordModal = page
      .getByRole('dialog')
      .filter({ hasText: 'Record Manual Hold Point Release' });
    await expect(
      recordModal.getByRole('heading', { name: 'Record Manual Hold Point Release' }),
    ).toBeVisible();

    await recordModal.getByLabel('Email Confirmation').check();
    await recordModal.locator('#evidence-upload').setInputFiles({
      name: 'release-email.eml',
      mimeType: 'message/rfc822',
      buffer: Buffer.from('Subject: Release approved\n\nApproved by email.'),
    });
    await expect(recordModal.getByText('Selected: release-email.eml')).toBeVisible();

    await recordModal.getByLabel('Paper Form').check();
    await expect(recordModal.getByText('Selected: release-email.eml')).toBeHidden();
    await recordModal.locator('#paper-evidence-upload').setInputFiles({
      name: 'paper-release.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 paper release'),
    });
    await expect(recordModal.getByText('Selected: paper-release.pdf')).toBeVisible();

    await recordModal.getByPlaceholder('Enter name of person releasing').fill('E2E Paper Reviewer');
    await recordModal
      .getByPlaceholder("Enter organisation (e.g., Superintendent's Rep)")
      .fill('E2E Superintendent Org');
    await recordModal.locator('input[type="date"]').fill('2026-02-03');
    await recordModal.locator('input[type="time"]').fill('14:20');
    await recordModal.getByRole('button', { name: 'Record Manual Release' }).click();

    await expect
      .poll(() => api.getRecordReleaseRequest())
      .toMatchObject({
        releasedByName: 'E2E Paper Reviewer',
        releasedByOrg: 'E2E Superintendent Org',
        releaseMethod: 'paper',
        signatureDataUrl: null,
      });
    expect(api.getEvidenceUploadCount()).toBe(1);
  });

  test('shows backend validation errors inside the record release modal', async ({ page }) => {
    await mockSeededHoldPointsApi(page, {
      failRecordReleaseMessage: 'Release date must be a valid date',
    });

    await page.goto(`/projects/${E2E_PROJECT_ID}/hold-points`);

    const notifiedRow = page.getByRole('row').filter({ hasText: 'LOT-HP-002' });
    await expect(notifiedRow).toBeVisible();
    await notifiedRow.getByRole('button', { name: 'Record Manual Release' }).click();

    const recordModal = page
      .getByRole('dialog')
      .filter({ hasText: 'Record Manual Hold Point Release' });
    await expect(
      recordModal.getByRole('heading', { name: 'Record Manual Hold Point Release' }),
    ).toBeVisible();

    await recordModal.getByLabel('Email Confirmation').check();
    await recordModal.locator('#evidence-upload').setInputFiles({
      name: 'release-email.eml',
      mimeType: 'message/rfc822',
      buffer: Buffer.from('Subject: Release approved\n\nApproved by email.'),
    });
    await recordModal
      .getByPlaceholder('Enter name of person releasing')
      .fill('E2E Release Reviewer');
    await recordModal
      .getByPlaceholder("Enter organisation (e.g., Superintendent's Rep)")
      .fill('E2E Superintendent Org');
    await recordModal.locator('input[type="date"]').fill('2026-02-03');
    await recordModal.locator('input[type="time"]').fill('14:20');
    await recordModal.getByRole('button', { name: 'Record Manual Release' }).click();

    await expect(recordModal.getByRole('alert')).toContainText('Release date must be a valid date');
    await expect(recordModal).toBeVisible();
    await expect(notifiedRow.getByText('Released', { exact: true })).toBeHidden();
  });
});

test.describe('Public hold point secure release page', () => {
  test('lets a named external superintendent review evidence and release from a secure link', async ({
    page,
  }) => {
    const api = await mockPublicHoldPointReleaseApi(page);

    await page.goto('/hp-release/e2e-public-token');

    await expect(page.getByText('Secure SiteProof Release')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'External superintendent release before concrete pour' }),
    ).toBeVisible();
    await expect(page.getByText('E2E Highway Upgrade')).toBeVisible();
    await expect(page.getByText('HP-PUBLIC-001')).toBeVisible();
    await expect(page.getByText('0/1 checklist items')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Evidence Package' })).toBeVisible();
    await expect(page.getByText('Confirm formwork and reinforcement before pour')).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Confirm formwork' })).toContainText('No');
    await expect(page.getByRole('heading', { name: 'Test Results' })).toBeVisible();
    await expect(page.getByText('Concrete slump')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Photos And Attachments' })).toBeVisible();
    await expect(page.getByText('formwork-check.pdf')).toBeVisible();
    await expect(page.getByText('reinforcement-before-pour.jpg')).toBeVisible();
    await expect(
      page.locator(
        'a[href*="/api/holdpoints/public/e2e-public-token/documents/e2e-public-document"]',
      ),
    ).toBeVisible();
    await expect(
      page.locator('a[href*="/api/holdpoints/public/e2e-public-token/documents/e2e-public-photo"]'),
    ).toBeVisible();
    await expect(page.locator('body')).not.toContainText('/storage/v1/object/public/');

    const releasedBy = page.getByLabel('Released By');
    await expect(releasedBy).toHaveValue('E2E Superintendent');
    await expect(releasedBy).toBeDisabled();
    await expect(
      page.getByText('This secure link is assigned to E2E Superintendent.'),
    ).toBeVisible();

    await page.getByLabel('Organisation').fill('Client Superintendent Org');
    await page.getByLabel('Release Notes').fill('Evidence reviewed and accepted');
    // M20: signature is required before the release can be submitted.
    await expect(page.getByRole('button', { name: 'Release Hold Point' })).toBeDisabled();
    await drawReleaseSignature(page);
    await page.getByRole('button', { name: 'Release Hold Point' }).click();

    await expect.poll(() => api.getReleaseCount()).toBe(1);
    expect(api.getReleaseRequest()).toMatchObject({
      releasedByName: 'E2E Superintendent',
      releasedByOrg: 'Client Superintendent Org',
      releaseNotes: 'Evidence reviewed and accepted',
    });
    await expect(page.getByRole('status')).toContainText('Hold Point Released');
    await expect(
      page.getByText(/Released by E2E Superintendent, Client Superintendent Org/),
    ).toBeVisible();
    await expect(page.getByText(/Secure link/)).toBeVisible();
    await expect(page.getByText('1/1 checklist items')).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Confirm formwork' })).toContainText(
      'Yes',
    );
    await expect(page.getByRole('button', { name: 'Download Evidence PDF' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Release Hold Point' })).toHaveCount(0);
  });

  test('requires an unnamed secure-link recipient to enter their release identity', async ({
    page,
  }) => {
    const api = await mockPublicHoldPointReleaseApi(page, { recipientName: null });

    await page.goto('/hp-release/e2e-public-token');

    const releasedBy = page.getByLabel('Released By');
    await expect(releasedBy).toBeEnabled();
    await expect(releasedBy).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Release Hold Point' })).toBeDisabled();

    await releasedBy.fill('Typed External Reviewer');
    // M20: still disabled until a signature is captured.
    await expect(page.getByRole('button', { name: 'Release Hold Point' })).toBeDisabled();
    await drawReleaseSignature(page);
    await page.getByRole('button', { name: 'Release Hold Point' }).click();

    await expect.poll(() => api.getReleaseCount()).toBe(1);
    expect(api.getReleaseRequest()).toMatchObject({
      releasedByName: 'Typed External Reviewer',
    });
    await expect(page.getByText('Released by Typed External Reviewer')).toBeVisible();
  });

  test('renders an already released secure link as read-only release evidence', async ({
    page,
  }) => {
    await mockPublicHoldPointReleaseApi(page, { initialStatus: 'released' });

    await page.goto('/hp-release/e2e-public-token');

    await expect(
      page.getByText(/Already Released Superintendent, Client Superintendent Org/),
    ).toBeVisible();
    await expect(page.getByText(/Secure link/)).toBeVisible();
    await expect(page.getByText('Released before reopening the secure link')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Release Hold Point' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Download Evidence PDF' })).toBeVisible();
  });

  test('keeps the public secure release flow usable on mobile', async ({ page }) => {
    const api = await mockPublicHoldPointReleaseApi(page, { recipientName: null });
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto('/hp-release/e2e-public-token');

    await expect(page.getByRole('heading', { name: 'Evidence Package' })).toBeVisible();
    await page.getByRole('heading', { name: 'Release Hold Point' }).scrollIntoViewIfNeeded();
    await expect(page.getByLabel('Released By')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Release Hold Point' })).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);

    await page.getByLabel('Released By').fill('Mobile External Reviewer');
    await drawReleaseSignature(page);
    await page.getByRole('button', { name: 'Release Hold Point' }).click();

    await expect.poll(() => api.getReleaseCount()).toBe(1);
    await expect(page.getByText('Released by Mobile External Reviewer')).toBeVisible();
  });

  test('shows expired secure-link errors without rendering the release form', async ({ page }) => {
    await mockPublicHoldPointReleaseApi(page, {
      loadStatus: 410,
      loadMessage: 'This secure release link has expired. Please contact the site team.',
    });

    await page.goto('/hp-release/e2e-public-token');

    await expect(page.getByRole('heading', { name: 'Release Link Unavailable' })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('secure release link has expired');
    await expect(page.getByRole('link', { name: 'Go to SiteProof' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Release Hold Point' })).toHaveCount(0);
  });

  test('keeps the secure release form open when the backend rejects submission', async ({
    page,
  }) => {
    const api = await mockPublicHoldPointReleaseApi(page, {
      releaseStatus: 400,
      releaseMessage: 'This hold point has already been released.',
    });

    await page.goto('/hp-release/e2e-public-token');

    await page.getByLabel('Organisation').fill('Client Superintendent Org');
    await drawReleaseSignature(page);
    await page.getByRole('button', { name: 'Release Hold Point' }).click();

    await expect.poll(() => api.getReleaseCount()).toBe(1);
    await expect(page.getByRole('alert')).toContainText(
      'This hold point has already been released.',
    );
    await expect(page.getByRole('button', { name: 'Release Hold Point' })).toBeVisible();
    await expect(page.getByRole('status', { name: /Hold Point Released/i })).toHaveCount(0);
  });
});

test.describe('Hold points mobile card layout', () => {
  test('renders hold points as cards with a full-width Request Release and no desktop table/export', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockSeededHoldPointsApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/hold-points`);

    await expect(page.getByRole('heading', { name: 'Hold Points' })).toBeVisible();
    await expect(page.getByText('Total HPs')).toBeVisible();

    // Mobile drops the desktop table and the CSV export.
    await expect(page.getByRole('table')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Export CSV' })).toBeHidden();

    // Pending hold point is a card with the primary release action.
    await expect(page.getByText('LOT-HP-001')).toBeVisible();
    await expect(page.getByText('Verify formation before covering work')).toBeVisible();
    const requestRelease = page.getByRole('button', { name: 'Request Release' });
    await expect(requestRelease).toBeVisible();

    // The action spans (close to) the full card width so it is an obvious tap target.
    const cardWidth = await page
      .getByText('LOT-HP-001')
      .locator('xpath=ancestor::*[contains(@class,"rounded-xl")][1]')
      .evaluate((el) => el.getBoundingClientRect().width);
    const buttonWidth = await requestRelease.evaluate((el) => el.getBoundingClientRect().width);
    expect(buttonWidth).toBeGreaterThan(cardWidth * 0.8);

    // Per-status actions are preserved on mobile.
    await expect(page.getByRole('button', { name: 'Record Manual Release' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Chase' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Evidence PDF' })).toBeVisible();

    // Request Release still opens the existing modal workflow.
    await requestRelease.click();
    const modal = page.getByRole('dialog').filter({ hasText: 'Request Hold Point Release' });
    await expect(modal.getByRole('heading', { name: 'Request Hold Point Release' })).toBeVisible();
  });
});
