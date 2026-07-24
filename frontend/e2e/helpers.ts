import type { Page, Route } from '@playwright/test';

export const E2E_PASSWORD = 'testpassword123';
export const ADMIN_EMAIL = 'test@example.com';
export const OWNER_EMAIL = 'owner@example.com';
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
  // The mocked session uses a fake bearer token; when CI runs a real backend
  // (VITE_API_URL), any UNMOCKED api call would 401 -> notifySessionExpired()
  // -> the whole spec bounces to the login page. That is exactly how a single
  // new shell-level query (the #1518 header's /api/ai/status) silently broke 36
  // master E2E tests for a week. Two surfaces get shell-wide defaults, and they
  // need OPPOSITE routing because /api/auth/me and /api/ai/status differ in who
  // should win when a spec has its own `**/api/**` catch-all:
  //
  //   - /api/auth/me lives on the CONTEXT route below. Page routes always beat
  //     context routes in Playwright, so a spec's OWN stateful /api/auth/me
  //     (profile edit, onboarding company creation, project-users) wins. A
  //     page-level default here would instead SHADOW that stateful handler
  //     (last-registered page route wins) and, e.g., revert a just-saved profile
  //     name. The context default only fills in for specs that never mock it, so
  //     boot-time token validation (401 OR malformed user => expired) survives.
  //
  //   - /api/ai/status lives on a PAGE route (below the context block). It MUST
  //     shadow a spec's catch-all: useAiStatus() defaults aiConfigured=true when
  //     the request errors, so a spec whose catch-all 404s /api/ai/status would
  //     render the full Clancy chrome and break selectors. Forcing "not
  //     configured" keeps the minimal pre-Clancy chrome. A spec that wants Clancy
  //     overrides this by registering its own /api/ai/status AFTER this call.
  //
  //   - everything else: a benign empty 200 keeps unmocked surfaces in
  //     loading/empty states instead of killing the session.
  await page.context().route('**/api/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/api/auth/me') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    });
  });

  await page.route('**/api/ai/status**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ aiConfigured: false }),
    });
  });

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
    localStorage.setItem('siteproof_hide_dev_role_switcher', 'true');
    localStorage.setItem('siteproof_last_seen_version', '1.3.0');
    // Clancy's first-run intro auto-opens a dialog ~1.5s after mount (#1491)
    // and swallows clicks under it — 37 master E2E failures. Tests that want
    // the intro clear this flag themselves.
    localStorage.setItem('clancy-intro-seen', '1');
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

export async function loginAsOwner(page: Page): Promise<void> {
  await login(page, OWNER_EMAIL, /\/(dashboard|projects)/);
}

export async function loginAsSubcontractor(page: Page): Promise<void> {
  await login(page, SUBCONTRACTOR_EMAIL);
}
