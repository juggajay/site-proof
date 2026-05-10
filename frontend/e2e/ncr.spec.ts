import { test, expect, type Page } from '@playwright/test';
import { E2E_ADMIN_USER, E2E_PROJECT_ID, mockAuthenticatedUserState } from './helpers';

const E2E_OPEN_NCR_ID = 'e2e-ncr-open';
const E2E_MAJOR_NCR_ID = 'e2e-ncr-major';

function buildNcrs(openStatus: 'open' | 'investigating' = 'open', majorApproved = false) {
  return [
    {
      id: E2E_OPEN_NCR_ID,
      ncrNumber: 'NCR-E2E-001',
      description: 'Compaction result failed in Lot 12',
      category: 'workmanship',
      severity: 'minor',
      status: openStatus,
      qmApprovalRequired: false,
      qmApprovedAt: null,
      qmApprovedBy: null,
      raisedBy: { fullName: 'E2E Inspector', email: 'inspector@example.com' },
      responsibleUser: { fullName: 'E2E Foreman', email: 'foreman@example.com' },
      dueDate: '2026-05-20',
      createdAt: '2026-05-01T00:00:00.000Z',
      project: {
        id: E2E_PROJECT_ID,
        name: 'E2E Highway Upgrade',
        projectNumber: 'E2E-001',
      },
      ncrLots: [
        {
          lot: {
            lotNumber: 'LOT-NCR-001',
            description: 'Northbound formation',
          },
        },
      ],
      clientNotificationRequired: false,
      clientNotifiedAt: null,
      lessonsLearned: null,
      closedAt: null,
      verificationNotes: null,
    },
    {
      id: E2E_MAJOR_NCR_ID,
      ncrNumber: 'NCR-E2E-002',
      description: 'Major concrete strength non-conformance',
      category: 'materials',
      severity: 'major',
      status: 'verification',
      qmApprovalRequired: true,
      qmApprovedAt: majorApproved ? '2026-05-09T01:00:00.000Z' : null,
      qmApprovedBy: majorApproved
        ? { fullName: 'E2E Quality Manager', email: 'qm@example.com' }
        : null,
      raisedBy: { fullName: 'E2E Inspector', email: 'inspector@example.com' },
      responsibleUser: { fullName: 'E2E Concrete Subcontractor', email: 'concrete@example.com' },
      dueDate: '2026-05-22',
      createdAt: '2026-05-02T00:00:00.000Z',
      project: {
        id: E2E_PROJECT_ID,
        name: 'E2E Highway Upgrade',
        projectNumber: 'E2E-001',
      },
      ncrLots: [
        {
          lot: {
            lotNumber: 'LOT-NCR-002',
            description: 'Bridge deck pour',
          },
        },
      ],
      clientNotificationRequired: true,
      clientNotifiedAt: null,
      lessonsLearned: null,
      closedAt: null,
      verificationNotes: null,
    },
  ];
}

async function mockSeededNcrApi(page: Page, options: { failNcrLoadsUntil?: number } = {}) {
  let openStatus: 'open' | 'investigating' = 'open';
  let majorApproved = false;
  let responseRequest: unknown;
  let qmApprovalCount = 0;
  let ncrLoadCount = 0;

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
            id: 'lot-ncr-001',
            lotNumber: 'LOT-NCR-001',
            description: 'Northbound formation',
          },
          {
            id: 'lot-ncr-002',
            lotNumber: 'LOT-NCR-002',
            description: 'Bridge deck pour',
          },
        ],
      });
      return;
    }

    if (url.pathname === '/api/ncrs' && url.searchParams.get('projectId') === E2E_PROJECT_ID) {
      ncrLoadCount += 1;
      if (ncrLoadCount <= (options.failNcrLoadsUntil ?? 0)) {
        await json({ message: 'NCR register unavailable' }, 503);
        return;
      }

      await json({ ncrs: buildNcrs(openStatus, majorApproved) });
      return;
    }

    if (url.pathname === `/api/ncrs/check-role/${E2E_PROJECT_ID}`) {
      await json({
        role: 'quality_manager',
        isQualityManager: true,
        canApproveNCRs: true,
      });
      return;
    }

    if (url.pathname === `/api/ncrs/${E2E_OPEN_NCR_ID}/respond`) {
      responseRequest = route.request().postDataJSON();
      openStatus = 'investigating';
      await json({ ncr: buildNcrs(openStatus, majorApproved)[0] });
      return;
    }

    if (url.pathname === `/api/ncrs/${E2E_MAJOR_NCR_ID}/qm-approve`) {
      qmApprovalCount += 1;
      majorApproved = true;
      await new Promise((resolve) => setTimeout(resolve, 250));
      await json({ message: 'QM approval granted' });
      return;
    }

    await json({ message: `Unhandled E2E API route: ${url.pathname}` }, 404);
  });

  await mockAuthenticatedUserState(page);

  return {
    getResponseRequest: () => responseRequest,
    getQmApprovalCount: () => qmApprovalCount,
    getNcrLoadCount: () => ncrLoadCount,
  };
}

test.describe('NCR seeded lifecycle contract', () => {
  test('renders seeded NCRs, filters the register, submits a response, and approves a major NCR', async ({
    page,
  }) => {
    const api = await mockSeededNcrApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/ncr`);

    await expect(page.getByRole('heading', { name: 'Non-Conformance Reports' })).toBeVisible();
    await expect(page.getByText('Manage NCR lifecycle for this project')).toBeVisible();
    await expect(page.getByText('Your role:')).toBeVisible();
    await expect(page.getByText('quality_manager')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Raise NCR' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible();

    const openRow = page.getByRole('row').filter({ hasText: 'NCR-E2E-001' });
    await expect(openRow).toBeVisible();
    await expect(openRow.getByText('LOT-NCR-001')).toBeVisible();
    await expect(openRow.getByText('Compaction result failed in Lot 12')).toBeVisible();
    await expect(openRow.getByText('workmanship')).toBeVisible();
    await expect(openRow.getByText('open')).toBeVisible();
    await expect(openRow.getByText('E2E Foreman')).toBeVisible();
    await expect(openRow.getByRole('button', { name: 'Respond' })).toBeVisible();
    await expect(
      openRow.getByRole('button', { name: 'Copy link to NCR NCR-E2E-001' }),
    ).toBeVisible();

    const majorRow = page.getByRole('row').filter({ hasText: 'NCR-E2E-002' });
    await expect(majorRow).toBeVisible();
    await expect(majorRow.getByText('LOT-NCR-002')).toBeVisible();
    await expect(majorRow.getByText('Major concrete strength non-conformance')).toBeVisible();
    await expect(majorRow.getByText('materials')).toBeVisible();
    await expect(majorRow.getByText('verification')).toBeVisible();
    await expect(majorRow.getByText('E2E Concrete Subcontractor')).toBeVisible();
    await expect(majorRow.getByRole('button', { name: 'QM Approve' })).toBeVisible();
    await expect(majorRow.getByRole('button', { name: 'Notify Client' })).toBeVisible();
    await expect(majorRow.getByRole('button', { name: 'Close' })).toBeDisabled();

    await page.getByLabel('Category').selectOption('workmanship');
    await expect(page.getByText('Showing 1 of 2 NCRs')).toBeVisible();
    await expect(openRow).toBeVisible();
    await expect(majorRow).toBeHidden();

    await page.getByRole('button', { name: 'Clear Filters' }).click();
    await expect(majorRow).toBeVisible();

    await openRow.getByRole('button', { name: 'Respond' }).click();

    const modal = page.getByRole('dialog').filter({ hasText: 'Respond to NCR NCR-E2E-001' });
    await expect(modal.getByRole('heading', { name: 'Respond to NCR NCR-E2E-001' })).toBeVisible();
    await expect(modal.getByText('Issue:')).toBeVisible();
    await expect(modal.getByText('Compaction result failed in Lot 12')).toBeVisible();

    await modal.getByLabel('Root Cause Category *').selectOption('process');
    await modal
      .getByLabel('Root Cause Description *')
      .fill('  Compaction process was not followed during final pass.  ');
    await modal
      .getByLabel('Proposed Corrective Action *')
      .fill('  Rework the failed area and repeat compaction testing.  ');
    await modal.getByRole('button', { name: 'Submit Response' }).click();

    expect(api.getResponseRequest()).toMatchObject({
      rootCauseCategory: 'process',
      rootCauseDescription: 'Compaction process was not followed during final pass.',
      proposedCorrectiveAction: 'Rework the failed area and repeat compaction testing.',
    });
    await expect(
      page.getByText('NCR response submitted - status changed to Investigating'),
    ).toBeVisible();
    await expect(openRow.getByText('investigating')).toBeVisible();
    await expect(openRow.getByRole('button', { name: 'Review Response' })).toBeVisible();

    await majorRow.getByRole('button', { name: 'QM Approve' }).click();
    expect(api.getQmApprovalCount()).toBe(1);
    await expect(page.getByText('QM approval granted')).toBeVisible();
    await expect(majorRow.getByRole('button', { name: 'Close' })).toBeEnabled();
  });

  test('surfaces NCR load failures with retry and no false empty state', async ({ page }) => {
    const api = await mockSeededNcrApi(page, { failNcrLoadsUntil: 2 });

    await page.goto(`/projects/${E2E_PROJECT_ID}/ncr`);

    const alert = page.getByRole('alert');
    await expect(alert).toContainText('NCR register unavailable');
    await expect(page.getByText('No NCRs found')).toHaveCount(0);

    await alert.getByRole('button', { name: 'Try again' }).click();

    await expect(page.getByRole('row').filter({ hasText: 'NCR-E2E-001' })).toBeVisible();
    expect(api.getNcrLoadCount()).toBeGreaterThanOrEqual(2);
  });

  test('guards duplicate major NCR approval clicks', async ({ page }) => {
    const api = await mockSeededNcrApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/ncr`);

    const majorRow = page.getByRole('row').filter({ hasText: 'NCR-E2E-002' });
    await expect(majorRow).toBeVisible();
    await majorRow.getByRole('button', { name: 'QM Approve' }).dblclick();

    await expect(page.getByText('QM approval granted')).toBeVisible();
    expect(api.getQmApprovalCount()).toBe(1);
    await expect(majorRow.getByRole('button', { name: 'Close' })).toBeEnabled();
  });

  test('opens the create dialog from the mounted NCR create query', async ({ page }) => {
    await mockSeededNcrApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/ncr?create=1`);

    await expect(page).toHaveURL(`/projects/${E2E_PROJECT_ID}/ncr`);
    const modal = page.getByRole('dialog', { name: 'Raise Non-Conformance Report' });
    await expect(
      modal.getByRole('heading', { name: 'Raise Non-Conformance Report' }),
    ).toBeVisible();
    await expect(modal.getByLabel('LOT-NCR-001 - Northbound formation')).toBeVisible();
  });
});
