import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { E2E_ADMIN_USER, E2E_PROJECT_ID, mockAuthenticatedUserState } from './helpers';

type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  changes: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    fullName: string | null;
  } | null;
  project: {
    id: string;
    name: string;
    projectNumber: string;
  } | null;
};

const seededLogs: AuditLog[] = [
  {
    id: 'e2e-audit-log-lot-created',
    action: 'lot.created',
    entityType: 'Lot',
    entityId: 'e2e-lot-001',
    changes: {
      lotNumber: 'LOT-001',
      status: { from: null, to: 'in_progress' },
    },
    ipAddress: '203.0.113.10',
    userAgent: 'E2E Browser',
    createdAt: '2026-05-03T02:30:00.000Z',
    user: {
      id: E2E_ADMIN_USER.id,
      email: E2E_ADMIN_USER.email,
      fullName: 'E2E Admin',
    },
    project: {
      id: E2E_PROJECT_ID,
      name: 'E2E Highway Upgrade',
      projectNumber: 'E2E-001',
    },
  },
  {
    id: 'e2e-audit-log-project-updated',
    action: 'project.updated',
    entityType: 'Project',
    entityId: E2E_PROJECT_ID,
    changes: {
      name: { from: 'Old Highway', to: 'E2E Highway Upgrade' },
    },
    ipAddress: null,
    userAgent: null,
    createdAt: '2026-05-02T01:00:00.000Z',
    user: {
      id: 'e2e-project-manager',
      email: 'pm@example.com',
      fullName: 'E2E Project Manager',
    },
    project: {
      id: E2E_PROJECT_ID,
      name: 'E2E Highway Upgrade',
      projectNumber: 'E2E-001',
    },
  },
  {
    id: 'e2e-audit-log-system',
    action: 'system.retention',
    entityType: 'System',
    entityId: 'system-retention',
    changes: { retainedDays: 365 },
    ipAddress: null,
    userAgent: null,
    createdAt: '2026-05-01T00:00:00.000Z',
    user: null,
    project: null,
  },
];

function filterLogs(url: URL, sourceLogs = seededLogs) {
  let logs = [...sourceLogs];
  const search = url.searchParams.get('search')?.toLowerCase();
  const entityType = url.searchParams.get('entityType');
  const action = url.searchParams.get('action');
  const userId = url.searchParams.get('userId');
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');

  if (search) {
    logs = logs.filter(
      (log) =>
        log.action.toLowerCase().includes(search) ||
        log.entityType.toLowerCase().includes(search) ||
        log.entityId.toLowerCase().includes(search),
    );
  }

  if (entityType) {
    logs = logs.filter((log) => log.entityType === entityType);
  }

  if (action) {
    logs = logs.filter((log) => log.action.includes(action));
  }

  if (userId) {
    logs = logs.filter((log) => log.user?.id === userId);
  }

  if (startDate) {
    logs = logs.filter((log) => new Date(log.createdAt) >= new Date(startDate));
  }

  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    logs = logs.filter((log) => new Date(log.createdAt) <= end);
  }

  return logs;
}

async function mockAuditLogApi(
  page: Page,
  sourceLogs = seededLogs,
  options: { failFilterOptions?: boolean } = {},
) {
  const listRequests: string[] = [];

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
          status: 'active',
        },
      });
      return;
    }

    if (url.pathname === '/api/audit-logs/actions') {
      if (options.failFilterOptions) {
        await json({ message: 'Filter options unavailable' }, 500);
        return;
      }
      await json({ actions: ['lot.created', 'project.updated', 'system.retention'] });
      return;
    }

    if (url.pathname === '/api/audit-logs/entity-types') {
      if (options.failFilterOptions) {
        await json({ message: 'Filter options unavailable' }, 500);
        return;
      }
      await json({ entityTypes: ['Lot', 'Project', 'System'] });
      return;
    }

    if (url.pathname === '/api/audit-logs/users') {
      if (options.failFilterOptions) {
        await json({ message: 'Filter options unavailable' }, 500);
        return;
      }
      await json({
        users: [
          {
            id: E2E_ADMIN_USER.id,
            email: E2E_ADMIN_USER.email,
            fullName: 'E2E Admin',
          },
          {
            id: 'e2e-project-manager',
            email: 'pm@example.com',
            fullName: 'E2E Project Manager',
          },
        ],
      });
      return;
    }

    if (url.pathname === '/api/audit-logs') {
      listRequests.push(url.search);
      const pageNumber = Number(url.searchParams.get('page') || '1');
      const limit = Number(url.searchParams.get('limit') || '50');
      const logs = filterLogs(url, sourceLogs);
      const start = (pageNumber - 1) * limit;
      await json({
        logs: logs.slice(start, start + limit),
        pagination: {
          page: pageNumber,
          limit,
          total: logs.length,
          totalPages: Math.max(1, Math.ceil(logs.length / limit)),
        },
      });
      return;
    }

    await json({ message: `Unhandled E2E API route: ${url.pathname}` }, 404);
  });

  await mockAuthenticatedUserState(page);

  return {
    getListRequests: () => listRequests,
  };
}

function makeExportLogs(count: number): AuditLog[] {
  return Array.from({ length: count }, (_, index) => ({
    ...seededLogs[0],
    id: `e2e-audit-export-${index}`,
    entityId: `export-log-${index.toString().padStart(3, '0')}`,
    changes: {
      row: index,
      note: index === count - 1 ? 'final exported audit entry' : 'paged audit entry',
    },
    createdAt: new Date(Date.UTC(2026, 4, 3, 2, 30, index % 60)).toISOString(),
  }));
}

async function mockFailedAuditLogApi(page: Page) {
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
      await json({ projects: [] });
      return;
    }

    if (url.pathname === '/api/audit-logs/actions') {
      await json({ actions: [] });
      return;
    }

    if (url.pathname === '/api/audit-logs/entity-types') {
      await json({ entityTypes: [] });
      return;
    }

    if (url.pathname === '/api/audit-logs/users') {
      await json({ users: [] });
      return;
    }

    if (url.pathname === '/api/audit-logs') {
      await json({ message: 'Audit log service unavailable' }, 500);
      return;
    }

    await json({ message: `Unhandled E2E API route: ${url.pathname}` }, 404);
  });

  await mockAuthenticatedUserState(page);
}

test.describe('Audit log seeded admin contract', () => {
  test('renders logs, exports CSV, opens details, and applies filters', async ({ page }) => {
    const api = await mockAuditLogApi(page);

    await page.goto('/audit-log');

    await expect(page.getByRole('heading', { name: 'Audit Log' })).toBeVisible();
    await expect(page.getByText('Showing 3 of 3 audit log entries')).toBeVisible();
    await expect(page.getByText('lot.created')).toBeVisible();
    await expect(page.getByText('project.updated')).toBeVisible();
    const systemRow = page.getByRole('row').filter({ hasText: 'system.retention' });
    await expect(systemRow.getByText('System').first()).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^audit-logs-\d{4}-\d{2}-\d{2}\.csv$/);
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    const csv = await readFile(downloadPath!, 'utf8');
    expect(csv).toContain('"IP Address"');
    expect(csv).toContain('"User Agent"');
    expect(csv).toContain('"Changes"');
    expect(csv).toContain('LOT-001');

    await page.getByRole('button', { name: /View details for lot\.created Lot e2e-lot/ }).click();
    const detailDialog = page.getByRole('dialog').filter({ hasText: 'Audit Log Details' });
    await expect(detailDialog.getByText('Review the selected activity record')).toBeVisible();
    await expect(detailDialog.getByText('203.0.113.10')).toBeVisible();
    await expect(detailDialog.getByText('"lotNumber": "LOT-001"')).toBeVisible();
    await detailDialog.getByRole('button', { name: 'Close' }).first().click();

    await page.getByLabel('Search audit logs').fill('project');
    await expect(page.getByText('Showing 1 of 1 audit log entries')).toBeVisible();
    await expect(page.getByText('project.updated')).toBeVisible();
    await expect(page.getByText('lot.created')).toBeHidden();

    await page.getByRole('button', { name: /Filters/ }).click();
    await page.getByLabel('Entity Type').selectOption('Lot');
    await expect(page.getByText('No Audit Logs Found')).toBeVisible();
    await page.getByRole('button', { name: 'Clear all filters' }).click();
    await expect(page.getByText('Showing 3 of 3 audit log entries')).toBeVisible();

    await page.getByLabel('Entity Type').selectOption('Lot');
    await page.getByLabel('Action').selectOption('lot.created');
    await page.getByLabel('User', { exact: true }).selectOption(E2E_ADMIN_USER.id);
    await page.getByLabel('From Date').fill('2026-05-01');
    await page.getByLabel('To Date').fill('2026-05-03');

    await expect(page.getByText('Showing 1 of 1 audit log entries')).toBeVisible();
    await expect(page.getByRole('table').getByText('lot.created')).toBeVisible();
    await expect.poll(() => api.getListRequests().at(-1) || '').toContain('entityType=Lot');
    const lastRequest = api.getListRequests().at(-1) || '';
    expect(lastRequest).toContain('action=lot.created');
    expect(lastRequest).toContain(`userId=${E2E_ADMIN_USER.id}`);
    expect(lastRequest).toContain('startDate=2026-05-01');
    expect(lastRequest).toContain('endDate=2026-05-03');

    await page.getByLabel('From Date').fill('2026-05-04');
    await expect(page.getByText('From date must be on or before to date.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export CSV' })).toBeDisabled();
  });

  test('exports all filtered audit log pages instead of only the visible table page', async ({
    page,
  }) => {
    const api = await mockAuditLogApi(page, makeExportLogs(101));

    await page.goto('/audit-log');

    await expect(page.getByText('Showing 50 of 101 audit log entries')).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV' }).click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    const csv = await readFile(downloadPath!, 'utf8');

    expect(csv).toContain('export-log-000');
    expect(csv).toContain('export-log-100');
    expect(csv).toContain('final exported audit entry');
    expect(
      api.getListRequests().filter((request) => request.includes('limit=100')).length,
    ).toBeGreaterThanOrEqual(2);
  });

  test('warns when audit filter metadata fails without hiding the log list', async ({ page }) => {
    await mockAuditLogApi(page, seededLogs, { failFilterOptions: true });

    await page.goto('/audit-log');

    await expect(page.getByText('Showing 3 of 3 audit log entries')).toBeVisible();
    await expect(
      page.getByText(
        'Some audit log filter options could not be loaded. Existing filters and search still work.',
      ),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry filters' })).toBeVisible();
    await page.getByRole('button', { name: /Filters/ }).click();
    await expect(page.getByLabel('Entity Type')).toBeDisabled();
    await expect(page.getByLabel('Action')).toBeDisabled();
    await expect(page.getByLabel('User', { exact: true })).toBeDisabled();
  });

  test('shows audit log failure instead of empty state and disables export', async ({ page }) => {
    await mockFailedAuditLogApi(page);

    await page.goto('/audit-log');

    await expect(page.getByRole('heading', { name: 'Audit Log' })).toBeVisible();
    await expect(page.getByText('Failed to load audit logs. Please try again.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export CSV' })).toBeDisabled();
    await expect(page.getByText('No Audit Logs Found')).toBeHidden();
  });
});
