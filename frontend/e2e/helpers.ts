import type { Page } from '@playwright/test';

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

export async function mockAuthenticatedUserState(page: Page, user = E2E_ADMIN_USER): Promise<void> {
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
