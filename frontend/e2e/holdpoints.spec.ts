import { test, expect, type Page } from '@playwright/test';
import { E2E_ADMIN_USER, E2E_PROJECT_ID, mockAuthenticatedUserState } from './helpers';

const E2E_PENDING_HP_ID = 'e2e-hp-pending';
const E2E_NOTIFIED_HP_ID = 'e2e-hp-notified';
const E2E_RELEASED_HP_ID = 'e2e-hp-released';

interface MockHoldPointsOptions {
  failHoldPointLoadsUntil?: number;
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
      releaseNotes: 'Released in seeded data',
      sequenceNumber: 5,
      isCompleted: true,
      isVerified: true,
      createdAt: '2026-01-15T00:00:00.000Z',
    },
  ];
}

async function mockSeededHoldPointsApi(page: Page, options: MockHoldPointsOptions = {}) {
  let pendingReleaseRequested = false;
  let requestedScheduledDate: string | null = null;
  let notifiedReleaseRecorded = false;
  let releaseRequest: unknown;
  let recordReleaseRequest: unknown;
  let chaseCount = 0;
  let holdPointLoadCount = 0;

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
      if (holdPointLoadCount <= (options.failHoldPointLoadsUntil || 0)) {
        await json({ message: 'Hold point register unavailable' }, 503);
        return;
      }

      await json({
        holdPoints: buildHoldPoints(
          pendingReleaseRequested,
          requestedScheduledDate,
          notifiedReleaseRecorded,
        ),
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
    getChaseCount: () => chaseCount,
  };
}

test.describe('Hold points seeded release contract', () => {
  test('renders seeded hold points, requests release, filters notified items, and chases release', async ({
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
    await expect(notifiedRow.getByRole('button', { name: 'Record Release' })).toBeVisible();
    await expect(notifiedRow.getByRole('button', { name: 'Chase' })).toBeVisible();

    const releasedRow = page.getByRole('row').filter({ hasText: 'LOT-HP-003' });
    await expect(releasedRow).toBeVisible();
    await expect(releasedRow.getByText('Released asphalt witness point')).toBeVisible();
    await expect(releasedRow.getByText('E2E Superintendent')).toBeVisible();
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
    await expect(pendingRow.getByRole('button', { name: 'Record Release' })).toBeVisible();

    await page.locator('select').selectOption('notified');
    await expect(releasedRow).toBeHidden();
    await expect(pendingRow).toBeVisible();
    await expect(notifiedRow).toBeVisible();

    await notifiedRow.getByRole('button', { name: 'Chase' }).click();
    await expect.poll(() => api.getChaseCount()).toBe(1);

    await page.locator('select').selectOption('all');
    await notifiedRow.getByRole('button', { name: 'Record Release' }).click();

    const recordModal = page.getByRole('dialog').filter({ hasText: 'Record Hold Point Release' });
    await expect(recordModal.getByText('Superintendent Approval Required')).toBeVisible();
    await recordModal.getByLabel('Email Confirmation').check();
    await recordModal
      .getByPlaceholder('Enter name of person releasing')
      .fill('E2E Release Reviewer');
    await recordModal
      .getByPlaceholder("Enter organization (e.g., Superintendent's Rep)")
      .fill('E2E Superintendent Org');
    await recordModal.locator('input[type="date"]').fill('2026-02-03');
    await recordModal.locator('input[type="time"]').fill('14:20');
    await recordModal
      .getByPlaceholder('Any additional notes about the release...')
      .fill('Release accepted from seeded test');
    await recordModal.getByRole('button', { name: 'Record Release' }).click();

    expect(api.getRecordReleaseRequest()).toMatchObject({
      releasedByName: 'E2E Release Reviewer',
      releasedByOrg: 'E2E Superintendent Org',
      releaseDate: '2026-02-03',
      releaseTime: '14:20',
      releaseMethod: 'email',
      releaseNotes: 'Release accepted from seeded test',
    });
    await expect(notifiedRow.getByText('Released', { exact: true }).first()).toBeVisible();
    await expect(notifiedRow.getByText('E2E Release Reviewer')).toBeVisible();
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

  test('guards duplicate chase notifications from rapid clicks', async ({ page }) => {
    const api = await mockSeededHoldPointsApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/hold-points`);

    const notifiedRow = page.getByRole('row').filter({ hasText: 'LOT-HP-002' });
    await expect(notifiedRow).toBeVisible();
    await notifiedRow.getByRole('button', { name: 'Chase' }).dblclick();

    await expect.poll(() => api.getChaseCount()).toBe(1);
    await expect(notifiedRow.getByRole('button', { name: 'Chase' })).toBeEnabled();
  });
});
