import { test, expect, type Page } from '@playwright/test';
import { E2E_ADMIN_USER, E2E_PROJECT_ID, mockAuthenticatedUserState } from './helpers';

type ProjectUser = {
  id: string;
  userId: string;
  email: string;
  fullName: string | null;
  role: string;
  status: string;
  joinedAt: string;
};

type ProjectUsersApiOptions = {
  failUserLoadsUntil?: number;
  inviteDelayMs?: number;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const adminUser: ProjectUser = {
  id: 'e2e-project-user-admin',
  userId: E2E_ADMIN_USER.id,
  email: E2E_ADMIN_USER.email,
  fullName: 'E2E Admin',
  role: 'admin',
  status: 'active',
  joinedAt: '2026-05-01T00:00:00.000Z',
};

const engineerUser: ProjectUser = {
  id: 'e2e-project-user-engineer',
  userId: 'e2e-engineer-user',
  email: 'engineer@example.com',
  fullName: 'E2E Engineer',
  role: 'site_engineer',
  status: 'active',
  joinedAt: '2026-05-02T00:00:00.000Z',
};

const viewerUser: ProjectUser = {
  id: 'e2e-project-user-viewer',
  userId: 'e2e-viewer-user',
  email: 'viewer@example.com',
  fullName: 'E2E Viewer',
  role: 'viewer',
  status: 'pending',
  joinedAt: '2026-05-03T00:00:00.000Z',
};

async function mockProjectShellApi(page: Page) {
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: E2E_ADMIN_USER }),
    });
  });

  await page.route('**/api/notifications', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ notifications: [], unreadCount: 0 }),
    });
  });

  await page.route('**/api/projects', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        projects: [
          {
            id: E2E_PROJECT_ID,
            name: 'E2E Highway Upgrade',
            projectNumber: 'E2E-001',
            status: 'active',
          },
        ],
      }),
    });
  });

  await page.route(`**/api/projects/${E2E_PROJECT_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        project: {
          id: E2E_PROJECT_ID,
          name: 'E2E Highway Upgrade',
          projectNumber: 'E2E-001',
          status: 'active',
        },
      }),
    });
  });
}

async function mockSeededProjectUsersApi(page: Page, options: ProjectUsersApiOptions = {}) {
  const users: ProjectUser[] = [
    structuredClone(adminUser),
    structuredClone(engineerUser),
    structuredClone(viewerUser),
  ];
  const inviteRequests: unknown[] = [];
  let updateRoleRequest: { userId: string; body: unknown } | null = null;
  let removeUserId: string | null = null;
  let userLoadCount = 0;

  await mockProjectShellApi(page);

  await page.route(`**/api/projects/${E2E_PROJECT_ID}/users`, async (route) => {
    if (route.request().method() === 'GET') {
      userLoadCount += 1;
      if (userLoadCount <= (options.failUserLoadsUntil ?? 0)) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Team service unavailable' }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ users }),
      });
      return;
    }

    if (route.request().method() === 'POST') {
      inviteRequests.push(route.request().postDataJSON());
      if (options.inviteDelayMs) {
        await delay(options.inviteDelayMs);
      }
      const body = inviteRequests.at(-1) as { email: string; role: string };
      const invited: ProjectUser = {
        id: 'e2e-project-user-invited',
        userId: 'e2e-invited-user',
        email: body.email,
        fullName: null,
        role: body.role,
        status: 'pending',
        joinedAt: '2026-05-09T00:00:00.000Z',
      };
      users.push(invited);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ projectUser: invited }),
      });
      return;
    }

    await route.fulfill({
      status: 405,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Method not allowed' }),
    });
  });

  await page.route(`**/api/projects/${E2E_PROJECT_ID}/users/*`, async (route) => {
    const userId = new URL(route.request().url()).pathname.split('/').at(-1) || '';

    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON();
      updateRoleRequest = { userId, body };
      const user = users.find((item) => item.userId === userId);
      if (user) {
        user.role = (body as { role?: string }).role || user.role;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ projectUser: user }),
      });
      return;
    }

    if (route.request().method() === 'DELETE') {
      removeUserId = userId;
      const index = users.findIndex((item) => item.userId === userId);
      if (index >= 0) {
        users.splice(index, 1);
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
      return;
    }

    await route.fulfill({
      status: 405,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Method not allowed' }),
    });
  });

  await mockAuthenticatedUserState(page);

  return {
    getInviteRequest: () => inviteRequests.at(-1),
    getInviteRequests: () => inviteRequests,
    getUpdateRoleRequest: () => updateRoleRequest,
    getRemoveUserId: () => removeUserId,
    getUserLoadCount: () => userLoadCount,
  };
}

test.describe('Project users seeded admin contract', () => {
  test('invites, changes role, and removes project users', async ({ page }) => {
    const api = await mockSeededProjectUsersApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/users`);

    await expect(page.getByRole('heading', { name: 'Project Team' })).toBeVisible();
    await expect(page.getByText('Manage team members and their roles')).toBeVisible();
    await expect(page.getByText('E2E Admin')).toBeVisible();
    await expect(page.getByText('(You)')).toBeVisible();
    await expect(page.getByText('E2E Engineer')).toBeVisible();
    await expect(page.getByText('E2E Viewer')).toBeVisible();

    await page.getByRole('button', { name: 'Invite User' }).click();
    const inviteDialog = page.getByRole('dialog').filter({ hasText: 'Invite User' });
    await expect(
      inviteDialog.getByText('Add an existing company user to this project'),
    ).toBeVisible();
    await inviteDialog.getByLabel('Email Address').fill('qa.manager@example.com');
    await inviteDialog.getByLabel('Role').selectOption('quality_manager');
    await inviteDialog.getByRole('button', { name: 'Send Invite' }).click();

    await expect(
      page.getByText('qa.manager@example.com has been added to the project.'),
    ).toBeVisible();
    expect(api.getInviteRequest()).toMatchObject({
      email: 'qa.manager@example.com',
      role: 'quality_manager',
    });
    const invitedRow = page.locator('tbody tr').filter({ hasText: 'qa.manager@example.com' });
    await expect(invitedRow).toBeVisible();

    await page.getByRole('button', { name: 'Change role for E2E Engineer' }).click();
    await page.getByRole('combobox', { name: 'Role for E2E Engineer' }).selectOption('foreman');
    await page.getByRole('button', { name: 'Save role for E2E Engineer' }).click();
    await expect
      .poll(() => api.getUpdateRoleRequest())
      .toEqual(
        expect.objectContaining({
          userId: 'e2e-engineer-user',
          body: expect.objectContaining({ role: 'foreman' }),
        }),
      );
    await expect(page.getByText("E2E Engineer's role has been updated.")).toBeVisible();
    const engineerRow = page.locator('tbody tr').filter({ hasText: 'E2E Engineer' });
    await expect(engineerRow.getByText('Foreman')).toBeVisible();

    await page.getByRole('button', { name: 'Remove E2E Viewer from project' }).click();
    const removeDialog = page.getByRole('alertdialog').filter({ hasText: 'Remove Project User' });
    await expect(
      removeDialog.getByText('They will lose access to this project immediately.'),
    ).toBeVisible();
    await removeDialog.getByRole('button', { name: 'Remove' }).click();

    expect(api.getRemoveUserId()).toBe('e2e-viewer-user');
    await expect(page.getByText('E2E Viewer has been removed from the project.')).toBeVisible();
    await expect(page.getByText('E2E Viewer')).toBeHidden();
  });

  test('shows a retryable team load failure instead of an empty-team state', async ({ page }) => {
    const api = await mockSeededProjectUsersApi(page, { failUserLoadsUntil: 2 });

    await page.goto(`/projects/${E2E_PROJECT_ID}/users`);

    await expect(page.getByRole('heading', { name: 'Project Team' })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('Team service unavailable');
    await expect(page.getByText('No team members yet')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();

    await page.getByRole('button', { name: 'Try again' }).click();

    await expect.poll(() => api.getUserLoadCount()).toBeGreaterThan(2);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByText('E2E Admin')).toBeVisible();
    await expect(page.getByText('E2E Engineer')).toBeVisible();
  });

  test('ignores duplicate invite submissions while the request is in flight', async ({ page }) => {
    const api = await mockSeededProjectUsersApi(page, { inviteDelayMs: 250 });

    await page.goto(`/projects/${E2E_PROJECT_ID}/users`);

    await page.getByRole('button', { name: 'Invite User' }).click();
    const inviteDialog = page.getByRole('dialog').filter({ hasText: 'Invite User' });
    await inviteDialog.getByLabel('Email Address').fill('QA.Manager@Example.com');
    await inviteDialog.getByLabel('Role').selectOption('quality_manager');

    await inviteDialog
      .getByRole('button', { name: 'Send Invite' })
      .evaluate((button: HTMLElement) => {
        button.click();
        button.click();
      });

    await expect(
      page.getByText('qa.manager@example.com has been added to the project.'),
    ).toBeVisible();
    expect(api.getInviteRequests()).toHaveLength(1);
    expect(api.getInviteRequest()).toMatchObject({
      email: 'qa.manager@example.com',
      role: 'quality_manager',
    });
  });
});
