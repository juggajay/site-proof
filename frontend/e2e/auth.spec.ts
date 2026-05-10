import { test, expect, type Page } from '@playwright/test';
import { E2E_ADMIN_USER, mockAuthenticatedUserState } from './helpers';

const signInButtonName = /^Sign In$/i;
const strongPassword = 'StrongPass123!';

async function mockAdminPortfolioAccess(page: Page) {
  const companyAdminUser = {
    ...E2E_ADMIN_USER,
    role: 'member',
    roleInCompany: 'admin',
    name: 'Company Admin',
    fullName: 'Company Admin',
    companyName: 'E2E Civil Pty Ltd',
  };

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });

    if (url.pathname === '/api/auth/me') {
      await json({ user: companyAdminUser });
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

    if (url.pathname === '/api/dashboard/portfolio-cashflow') {
      await json({ totalClaimed: 0, totalCertified: 0, totalPaid: 0, outstanding: 0 });
      return;
    }

    if (url.pathname === '/api/dashboard/portfolio-ncrs') {
      await json({ ncrs: [] });
      return;
    }

    if (url.pathname === '/api/dashboard/portfolio-risks') {
      await json({ projectsAtRisk: [] });
      return;
    }

    await json({ message: `Unhandled E2E API route: ${url.pathname}` }, 404);
  });

  await mockAuthenticatedUserState(page, companyAdminUser);
}

test.describe('Authentication', () => {
  test('should show login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });

  test('should not show authenticated app overlays on the login page', async ({ page }) => {
    await page.goto('/login');
    await page.waitForTimeout(1000);

    await expect(page.getByText('Welcome to SiteProof!')).toHaveCount(0);
    await expect(page.getByText("What's New in SiteProof")).toHaveCount(0);

    await page.keyboard.press('Shift+/');
    await expect(page.getByText('Keyboard Shortcuts')).toHaveCount(0);
  });

  test('should show registration page', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: /create.*account/i })).toBeVisible();
  });

  test('should validate login form', async ({ page }) => {
    await page.goto('/login');

    // Try to submit empty form
    await page.getByRole('button', { name: signInButtonName }).click();

    // Should show validation messages
    await expect(
      page
        .getByRole('alert')
        .filter({ hasText: /email|required/i })
        .first(),
    ).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel(/email/i).fill('invalid@example.com');
    await page.getByLabel(/password/i).fill('wrongpassword123');
    await page.getByRole('button', { name: signInButtonName }).click();

    // Should show error message
    await expect(
      page
        .getByRole('alert')
        .filter({ hasText: /invalid|error|incorrect|failed/i })
        .first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('should validate registration form', async ({ page }) => {
    await page.goto('/register');

    // Fill weak password
    await page.getByLabel(/email/i).fill('test@example.com');
    await page
      .getByLabel(/password/i)
      .first()
      .fill('weak');

    // Should show password requirements
    await page.getByRole('button', { name: /create|register|sign up/i }).click();
    await expect(
      page
        .getByRole('alert')
        .filter({ hasText: /password.*12|12.*characters/i })
        .first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/projects');

    // Should redirect to login
    await expect(page).toHaveURL(/login/);
  });

  test('should preserve protected route query params after login', async ({ page }) => {
    let loginRequest: unknown;

    await page.route('**/api/auth/login', async (route) => {
      loginRequest = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'login-e2e-token',
          user: E2E_ADMIN_USER,
        }),
      });
    });

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
        body: JSON.stringify({ projects: [] }),
      });
    });

    await page.route('**/api/ncrs**', async (route) => {
      const url = new URL(route.request().url());

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          url.pathname.includes('/check-role/')
            ? { role: E2E_ADMIN_USER.role, canCreate: true, canEdit: true }
            : { ncrs: [] },
        ),
      });
    });

    await page.route('**/api/**', async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      const mockedPaths = [
        '/api/auth/login',
        '/api/auth/me',
        '/api/notifications',
        '/api/projects',
      ];

      if (mockedPaths.includes(pathname) || pathname.startsWith('/api/ncrs')) {
        await route.fallback();
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    });

    await page.goto('/projects/e2e-project/ncr?ncrId=ncr-123');
    await expect(page).toHaveURL(/\/login/);

    await page.getByLabel(/email/i).fill(E2E_ADMIN_USER.email);
    await page.getByLabel(/password/i).fill(strongPassword);
    await page.getByRole('button', { name: signInButtonName }).click();

    await expect
      .poll(() => loginRequest)
      .toMatchObject({
        email: E2E_ADMIN_USER.email,
        password: strongPassword,
      });
    await expect(page).toHaveURL('/projects/e2e-project/ncr?ncrId=ncr-123');

    const localStoredAuth = await page.evaluate(() => localStorage.getItem('siteproof_auth'));
    const sessionStoredAuth = await page.evaluate(() => sessionStorage.getItem('siteproof_auth'));
    const rememberMe = await page.evaluate(() => localStorage.getItem('siteproof_remember_me'));
    expect(localStoredAuth).not.toBeNull();
    expect(JSON.parse(localStoredAuth as string).token).toBe('login-e2e-token');
    expect(sessionStoredAuth).toBeNull();
    expect(rememberMe).toBe('true');
  });

  test('stores non-remembered sign-ins in session storage only', async ({ page }) => {
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'session-login-e2e-token',
          user: E2E_ADMIN_USER,
        }),
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
        body: JSON.stringify({ projects: [] }),
      });
    });

    await page.goto('/login');

    await page.getByLabel(/email/i).fill(E2E_ADMIN_USER.email);
    await page.getByLabel(/password/i).fill(strongPassword);
    await page.getByLabel(/remember me/i).uncheck();
    await page.getByRole('button', { name: signInButtonName }).click();

    await expect(page).toHaveURL('/dashboard');

    const localStoredAuth = await page.evaluate(() => localStorage.getItem('siteproof_auth'));
    const sessionStoredAuth = await page.evaluate(() => sessionStorage.getItem('siteproof_auth'));
    const rememberMe = await page.evaluate(() => localStorage.getItem('siteproof_remember_me'));
    expect(localStoredAuth).toBeNull();
    expect(sessionStoredAuth).not.toBeNull();
    expect(JSON.parse(sessionStoredAuth as string).token).toBe('session-login-e2e-token');
    expect(rememberMe).toBeNull();
  });

  test('should allow company admins through role protected routes when roleInCompany grants access', async ({
    page,
  }) => {
    await mockAdminPortfolioAccess(page);

    await page.goto('/portfolio');

    await expect(page.getByRole('heading', { name: 'Portfolio Overview' })).toBeVisible();
    await expect(page.getByText('Access Denied')).toHaveCount(0);
  });

  test('should have forgot password link', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('link', { name: /forgot.*password/i })).toBeVisible();
  });

  test('should exchange OAuth callback code without storing legacy token keys', async ({
    page,
  }) => {
    let exchangedCode: unknown;

    await page.route('**/api/auth/oauth/exchange', async (route) => {
      exchangedCode = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 'oauth-e2e-token' }),
      });
    });

    await page.route('**/api/auth/me', async (route) => {
      expect(route.request().headers().authorization).toBe('Bearer oauth-e2e-token');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'oauth-e2e-user',
            email: 'oauth-e2e@example.com',
            fullName: 'OAuth E2E User',
            role: 'admin',
          },
        }),
      });
    });

    await page.goto('/auth/oauth-callback?code=test-callback-code&provider=google');
    await page.waitForURL(/\/dashboard/);

    expect(exchangedCode).toEqual({ code: 'test-callback-code' });
    expect(page.url()).not.toContain('code=');

    const storedAuth = await page.evaluate(() => localStorage.getItem('siteproof_auth'));
    expect(storedAuth).not.toBeNull();
    expect(JSON.parse(storedAuth as string).token).toBe('oauth-e2e-token');
    const legacyToken = await page.evaluate(() => localStorage.getItem('auth_token'));
    expect(legacyToken).toBeNull();
  });
});

test.describe('Login Flow', () => {
  test('login page should have all required elements', async ({ page }) => {
    await page.goto('/login');

    // Check for email input
    await expect(page.getByLabel(/email/i)).toBeVisible();

    // Check for password input
    await expect(page.getByLabel(/password/i)).toBeVisible();

    // Check for submit button
    await expect(page.getByRole('button', { name: signInButtonName })).toBeVisible();

    // Check for register link
    await expect(
      page.getByRole('link', { name: /register|sign up|create.*account/i }),
    ).toBeVisible();
  });
});

test.describe('Registration Flow', () => {
  test('registration page should have all required elements', async ({ page }) => {
    await page.goto('/register');

    // Check for name inputs
    await expect(page.getByLabel(/first name/i)).toBeVisible();
    await expect(page.getByLabel(/last name/i)).toBeVisible();

    // Check for email input
    await expect(page.getByLabel(/email/i)).toBeVisible();

    // Check for password input
    await expect(page.getByLabel(/password/i).first()).toBeVisible();

    // Check for Terms checkbox and link
    await expect(page.getByRole('checkbox', { name: /terms|agree/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /terms of service/i })).toBeVisible();
  });

  test('registration page should show server errors', async ({ page }) => {
    await page.route('**/api/auth/register', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Email already in use' } }),
      });
    });

    await page.goto('/register');

    await page.getByLabel(/first name/i).fill('E2E');
    await page.getByLabel(/last name/i).fill('Admin');
    await page.getByLabel(/^email$/i).fill(E2E_ADMIN_USER.email);
    await page.getByLabel(/^password$/i).fill(strongPassword);
    await page.getByLabel(/confirm password/i).fill(strongPassword);
    await page.getByRole('checkbox', { name: /terms|agree/i }).check();
    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page.getByRole('alert').filter({ hasText: 'Email already in use' })).toBeVisible();
  });

  test('unverified registration does not persist an authenticated session', async ({ page }) => {
    let registerRequest: unknown;

    await page.route('**/api/auth/register', async (route) => {
      registerRequest = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'new-unverified-user',
            email: 'new-user@example.com',
            fullName: 'New User',
            role: 'member',
            emailVerified: false,
          },
          token: 'unverified-registration-token',
          verificationRequired: true,
          message: 'Account created. Please check your email to verify your account.',
        }),
      });
    });

    await page.goto('/register');

    await page.getByLabel(/first name/i).fill('New');
    await page.getByLabel(/last name/i).fill('User');
    await page.getByLabel(/^email$/i).fill('new-user@example.com');
    await page.getByLabel(/^password$/i).fill(strongPassword);
    await page.getByLabel(/confirm password/i).fill(strongPassword);
    await page.getByRole('checkbox', { name: /terms|agree/i }).check();
    await page.getByRole('button', { name: /create account/i }).click();

    await expect
      .poll(() => registerRequest)
      .toMatchObject({
        firstName: 'New',
        lastName: 'User',
        email: 'new-user@example.com',
        tosAccepted: true,
      });
    await expect(page.getByRole('heading', { name: 'Check Your Email' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('siteproof_auth'))).toBeNull();
    await expect
      .poll(() => page.evaluate(() => sessionStorage.getItem('siteproof_auth')))
      .toBeNull();
  });
});
