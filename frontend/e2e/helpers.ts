import type { Page, Route } from '@playwright/test';

export const E2E_PASSWORD = 'testpassword123';
export const ADMIN_EMAIL = 'test@example.com';
export const SUBCONTRACTOR_EMAIL = 'subcontractor@example.com';
export const E2E_PROJECT_ID = 'e2e-project';
export const E2E_ADMIN_USER = {
  id: 'e2e-admin-user',
  email: ADMIN_EMAIL,
  fullName: 'E2E Admin',
  role: 'admin',
  roleInCompany: 'admin',
  companyId: 'e2e-company',
  hasPassword: true,
};

export type JsonResponder = (body: unknown, status?: number) => Promise<void>;

export function createJsonResponder(route: Route): JsonResponder {
  return (body: unknown, status = 200) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
}

function hasSubcontractorProjectIdentity(user: typeof E2E_ADMIN_USER): boolean {
  const roles = [
    String(user.role ?? ''),
    String(user.roleInCompany ?? ''),
    'dashboardRole' in user
      ? String((user as { dashboardRole?: unknown }).dashboardRole ?? '')
      : '',
  ];

  return roles.some((role) => role.toLowerCase().startsWith('subcontractor'));
}

export async function mockAuthenticatedUserState(
  page: Page,
  user = E2E_ADMIN_USER,
  notificationUnreadCount = 0,
): Promise<void> {
  await page.route('**/api/projects/*/access', async (route) => {
    if (hasSubcontractorProjectIdentity(user)) {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { message: 'You do not have access to this project' },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access: {
          hasProjectAccess: true,
          role: 'project_manager',
          isProjectAdmin: true,
        },
      }),
    });
  });

  await page.route('**/api/notifications/unread-count**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ count: notificationUnreadCount }),
    });
  });

  await page.addInitScript((mockUser) => {
    localStorage.setItem('siteproof_remember_me', 'true');
    localStorage.setItem('siteproof_onboarding_completed', 'true');
    localStorage.setItem('siteproof_last_seen_version', '1.3.0');
    localStorage.setItem(
      'cookie_consent',
      JSON.stringify({
        version: 'v1',
        accepted: true,
        timestamp: '2026-01-15T00:00:00.000Z',
      }),
    );
    localStorage.setItem(
      'siteproof_auth',
      JSON.stringify({
        user: mockUser,
        token: 'e2e-token',
      }),
    );
  }, user);
}

export async function login(
  page: Page,
  email = ADMIN_EMAIL,
  redirectPattern = /\/(dashboard|projects|subcontractor-portal)/,
): Promise<void> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto('/login');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', E2E_PASSWORD);
    await page.getByRole('button', { name: /^Sign In$/i }).click();

    try {
      await page.waitForURL(redirectPattern, { timeout: 10000 });
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(1000);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Login did not reach the expected page');
}

export async function loginAsAdmin(page: Page): Promise<void> {
  await login(page, ADMIN_EMAIL, /\/(dashboard|projects)/);
}

export async function loginAsSubcontractor(page: Page): Promise<void> {
  await login(page, SUBCONTRACTOR_EMAIL);
}
