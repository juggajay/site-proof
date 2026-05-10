import { test, expect, type Page } from '@playwright/test';
import { ADMIN_EMAIL, E2E_ADMIN_USER, E2E_PROJECT_ID, mockAuthenticatedUserState } from './helpers';

const settingsUser = {
  ...E2E_ADMIN_USER,
  name: 'E2E Admin',
  companyName: 'E2E Civil Pty Ltd',
};

const baseEmailPreferences = {
  enabled: true,
  mentions: true,
  mentionsTiming: 'immediate',
  ncrAssigned: true,
  ncrAssignedTiming: 'immediate',
  ncrStatusChange: true,
  ncrStatusChangeTiming: 'digest',
  holdPointReminder: true,
  holdPointReminderTiming: 'immediate',
  holdPointRelease: true,
  holdPointReleaseTiming: 'immediate',
  commentReply: true,
  commentReplyTiming: 'immediate',
  scheduledReports: true,
  scheduledReportsTiming: 'immediate',
  dailyDigest: false,
  diaryReminder: false,
  diaryReminderTiming: 'digest',
};

type MockSettingsApiOptions = {
  mfaEnabled?: boolean;
  failEmailPreferenceLoadsUntil?: number;
  failMfaStatusLoadsUntil?: number;
  failPushStatusLoadsUntil?: number;
  emailPreferenceDelayMs?: number;
  testEmailDelayMs?: number;
  mfaSetupDelayMs?: number;
  mfaVerifyDelayMs?: number;
  exportDelayMs?: number;
  exportContentType?: string;
  exportFilename?: string;
  exportBody?: string;
  deleteDelayMs?: number;
};

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function mockSettingsApi(page: Page, options: MockSettingsApiOptions = {}) {
  let emailPreferences: Record<string, unknown> = { ...baseEmailPreferences };
  const emailPreferenceRequests: Record<string, unknown>[] = [];
  let testEmailRequestCount = 0;
  let mfaSetupRequestCount = 0;
  const mfaVerifyRequests: unknown[] = [];
  let exportRequestCount = 0;
  let deleteRequest: unknown = null;
  const deleteRequests: unknown[] = [];
  let emailPreferenceLoadCount = 0;
  let mfaStatusLoadCount = 0;
  let pushStatusLoadCount = 0;

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });

    if (url.pathname === '/api/auth/me') {
      await json({ user: settingsUser });
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

    if (url.pathname === '/api/notifications/email-preferences') {
      if (route.request().method() === 'PUT') {
        if (options.emailPreferenceDelayMs) {
          await delay(options.emailPreferenceDelayMs);
        }

        const body = route.request().postDataJSON() as { preferences?: Record<string, unknown> };
        emailPreferences = { ...emailPreferences, ...(body.preferences || {}) };
        emailPreferenceRequests.push({ ...emailPreferences });
        await json({ preferences: emailPreferences, message: 'Email preferences updated' });
        return;
      }

      emailPreferenceLoadCount += 1;
      if (emailPreferenceLoadCount <= (options.failEmailPreferenceLoadsUntil ?? 0)) {
        await json({ message: 'Email preferences service unavailable' }, 500);
        return;
      }

      await json({ preferences: emailPreferences });
      return;
    }

    if (url.pathname === '/api/notifications/send-test-email') {
      if (options.testEmailDelayMs) {
        await delay(options.testEmailDelayMs);
      }

      testEmailRequestCount += 1;
      await json({ sentTo: ADMIN_EMAIL });
      return;
    }

    if (url.pathname === '/api/mfa/status') {
      mfaStatusLoadCount += 1;
      if (mfaStatusLoadCount <= (options.failMfaStatusLoadsUntil ?? 0)) {
        await json({ message: 'MFA service unavailable' }, 500);
        return;
      }

      await json({ mfaEnabled: options.mfaEnabled ?? false });
      return;
    }

    if (url.pathname === '/api/mfa/setup') {
      if (options.mfaSetupDelayMs) {
        await delay(options.mfaSetupDelayMs);
      }

      mfaSetupRequestCount += 1;
      await json({
        secret: 'JBSWY3DPEHPK3PXP',
        qrCode: 'data:image/png;base64,iVBORw0KGgo=',
        message: 'Scan the QR code with your authenticator app, then verify with a code.',
      });
      return;
    }

    if (url.pathname === '/api/mfa/verify-setup') {
      if (options.mfaVerifyDelayMs) {
        await delay(options.mfaVerifyDelayMs);
      }

      mfaVerifyRequests.push(route.request().postDataJSON());
      await json({
        success: true,
        message: 'Two-factor authentication has been enabled successfully.',
        backupCodes: ['SP-0001', 'SP-0002', 'SP-0003', 'SP-0004'],
      });
      return;
    }

    if (url.pathname === '/api/push/status') {
      pushStatusLoadCount += 1;
      if (pushStatusLoadCount <= (options.failPushStatusLoadsUntil ?? 0)) {
        await json({ error: { message: 'Push service unavailable' } }, 500);
        return;
      }

      await json({
        configured: false,
        message: 'Push notifications require VAPID keys to be configured',
      });
      return;
    }

    if (url.pathname === '/api/auth/export-data') {
      if (options.exportDelayMs) {
        await delay(options.exportDelayMs);
      }

      exportRequestCount += 1;
      const exportBody = options.exportBody ?? JSON.stringify({ user: settingsUser, projects: [] });
      await route.fulfill({
        status: 200,
        headers: {
          'Content-Type': options.exportContentType ?? 'application/json',
          'Content-Disposition': `attachment; filename="${options.exportFilename ?? 'siteproof-export-e2e.json'}"`,
          'Access-Control-Expose-Headers': 'Content-Disposition',
        },
        body: exportBody,
      });
      return;
    }

    if (url.pathname === '/api/auth/delete-account') {
      if (options.deleteDelayMs) {
        await delay(options.deleteDelayMs);
      }

      deleteRequest = route.request().postDataJSON();
      deleteRequests.push(deleteRequest);
      await json({ message: 'Account deleted successfully' });
      return;
    }

    if (url.pathname === '/api/company/leave') {
      await json({ message: 'Left company' });
      return;
    }

    await json({ message: `Unhandled E2E API route: ${url.pathname}` }, 404);
  });

  await mockAuthenticatedUserState(page, settingsUser);

  return {
    getLastEmailPreferences: () => emailPreferenceRequests.at(-1) ?? null,
    getEmailPreferenceRequests: () => emailPreferenceRequests,
    getTestEmailRequested: () => testEmailRequestCount > 0,
    getTestEmailRequestCount: () => testEmailRequestCount,
    getMfaSetupRequested: () => mfaSetupRequestCount > 0,
    getMfaSetupRequestCount: () => mfaSetupRequestCount,
    getMfaVerifyRequest: () => mfaVerifyRequests.at(-1) ?? null,
    getMfaVerifyRequests: () => mfaVerifyRequests,
    getExportRequested: () => exportRequestCount > 0,
    getExportRequestCount: () => exportRequestCount,
    getDeleteRequest: () => deleteRequest,
    getDeleteRequests: () => deleteRequests,
    getEmailPreferenceLoadCount: () => emailPreferenceLoadCount,
    getMfaStatusLoadCount: () => mfaStatusLoadCount,
    getPushStatusLoadCount: () => pushStatusLoadCount,
  };
}

test.describe('Settings seeded account contract', () => {
  test('persists appearance, regional, and email notification preferences', async ({ page }) => {
    const api = await mockSettingsApi(page);

    await page.goto('/settings');

    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
    await expect(page.getByText('E2E Civil Pty Ltd')).toBeVisible();

    await page.getByRole('button', { name: 'Dark theme' }).click();
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('siteproof_theme')))
      .toBe('dark');

    await page.getByRole('button', { name: 'YYYY-MM-DD date format' }).click();
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('siteproof_date_format')))
      .toBe('YYYY-MM-DD');

    await page.getByLabel('Timezone').selectOption('UTC');
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('siteproof_timezone')))
      .toBe('UTC');

    await page.getByLabel('Scheduled Reports notification timing').selectOption('digest');
    await expect(
      page.getByRole('status').filter({ hasText: 'Email preferences saved' }),
    ).toBeVisible();

    const diaryReminderSwitch = page.getByRole('switch', {
      name: 'Daily Diary Reminders email notifications',
    });
    await expect(diaryReminderSwitch).not.toBeChecked();
    await diaryReminderSwitch.click();
    await expect(diaryReminderSwitch).toBeChecked();

    await expect
      .poll(() => api.getLastEmailPreferences())
      .toMatchObject({
        scheduledReportsTiming: 'digest',
        diaryReminder: true,
        diaryReminderTiming: 'digest',
      });

    await page.getByRole('button', { name: 'Send Test Email' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: `Test email sent to ${ADMIN_EMAIL}` }),
    ).toBeVisible();
    expect(api.getTestEmailRequested()).toBe(true);
  });

  test('prevents duplicate email preference and test email submissions', async ({ page }) => {
    const api = await mockSettingsApi(page, {
      emailPreferenceDelayMs: 250,
      testEmailDelayMs: 250,
    });

    await page.goto('/settings');

    const diaryReminderSwitch = page.getByRole('switch', {
      name: 'Daily Diary Reminders email notifications',
    });
    await expect(diaryReminderSwitch).not.toBeChecked();
    await diaryReminderSwitch.evaluate((button: HTMLElement) => {
      button.click();
      button.click();
    });

    await expect(
      page.getByRole('status').filter({ hasText: 'Email preferences saved' }),
    ).toBeVisible();
    expect(api.getEmailPreferenceRequests()).toHaveLength(1);
    expect(api.getLastEmailPreferences()).toMatchObject({
      diaryReminder: true,
    });

    const sendTestButton = page.getByRole('button', { name: 'Send Test Email' });
    await sendTestButton.evaluate((button: HTMLElement) => {
      button.click();
      button.click();
    });

    await expect(
      page.getByRole('status').filter({ hasText: `Test email sent to ${ADMIN_EMAIL}` }),
    ).toBeVisible();
    expect(api.getTestEmailRequestCount()).toBe(1);
  });

  test('recovers email preference load failure without editing defaults', async ({ page }) => {
    const api = await mockSettingsApi(page, { failEmailPreferenceLoadsUntil: 4 });

    await page.goto('/settings');

    const emailAlert = page
      .getByRole('alert')
      .filter({ hasText: 'Email preferences service unavailable' });
    const retryPanel = page
      .getByRole('alert')
      .filter({ hasText: 'Email notification preferences could not be loaded' });
    await expect(emailAlert).toBeVisible();
    await expect(retryPanel).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Enable email notifications' })).toBeHidden();

    const tryAgainButton = retryPanel.getByRole('button', { name: 'Try again' });
    for (let attempt = 0; attempt < 6; attempt += 1) {
      if (
        await page
          .getByRole('switch', { name: 'Enable email notifications' })
          .isVisible()
          .catch(() => false)
      )
        break;
      if (await tryAgainButton.isVisible().catch(() => false)) {
        await tryAgainButton.click();
      }
      await page.waitForTimeout(100);
    }

    await expect(page.getByRole('switch', { name: 'Enable email notifications' })).toBeVisible();
    expect(api.getEmailPreferenceRequests()).toHaveLength(0);
    await expect.poll(() => api.getEmailPreferenceLoadCount()).toBeGreaterThan(4);
  });

  test('sets up MFA and exports account data', async ({ page }) => {
    const api = await mockSettingsApi(page);

    await page.goto('/settings');

    await page.getByRole('button', { name: 'Enable Two-Factor Authentication' }).click();
    await expect.poll(() => api.getMfaSetupRequested()).toBe(true);

    const setupDialog = page
      .getByRole('dialog')
      .filter({ hasText: 'Set Up Two-Factor Authentication' });
    await expect(
      setupDialog.getByAltText('QR code for two-factor authentication setup'),
    ).toBeVisible();
    await setupDialog.getByLabel(/6-digit code/).fill('123456');
    await setupDialog.getByRole('button', { name: 'Verify & Enable' }).click();

    await expect.poll(() => api.getMfaVerifyRequest()).toMatchObject({ code: '123456' });

    const backupDialog = page
      .getByRole('alertdialog')
      .filter({ hasText: '2FA Enabled Successfully!' });
    await expect(backupDialog.getByText('SP-0001')).toBeVisible();
    await backupDialog.getByRole('button', { name: "I've Saved My Codes" }).click();
    await expect(
      page.getByText('Two-Factor Authentication Enabled', { exact: true }),
    ).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export My Data' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('siteproof-export-e2e.json');
    expect(api.getExportRequested()).toBe(true);
    await expect(
      page.getByRole('status').filter({ hasText: 'Data exported successfully' }),
    ).toBeVisible();
  });

  test('sanitizes exported account data filenames', async ({ page }) => {
    await mockSettingsApi(page, {
      exportFilename: '../unsafe:export?.json',
    });

    await page.goto('/settings');

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export My Data' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('unsafe-export-.json');
  });

  test('rejects unexpected exported account data content types', async ({ page }) => {
    const downloads: string[] = [];
    page.on('download', (download) => downloads.push(download.suggestedFilename()));

    const api = await mockSettingsApi(page, {
      exportContentType: 'text/html',
      exportFilename: 'siteproof-export-e2e.html',
      exportBody: '<html>not json</html>',
    });

    await page.goto('/settings');

    await page.getByRole('button', { name: 'Export My Data' }).click();

    await expect(
      page.getByRole('alert').filter({ hasText: 'Export returned an unexpected file type' }),
    ).toBeVisible();
    expect(api.getExportRequestCount()).toBe(1);
    expect(downloads).toHaveLength(0);
  });

  test('prevents duplicate MFA setup, verification, and export actions', async ({ page }) => {
    const api = await mockSettingsApi(page, {
      mfaSetupDelayMs: 250,
      mfaVerifyDelayMs: 250,
      exportDelayMs: 250,
    });

    await page.goto('/settings');

    const enableMfaButton = page.getByRole('button', { name: 'Enable Two-Factor Authentication' });
    await enableMfaButton.evaluate((button: HTMLElement) => {
      button.click();
      button.click();
    });
    const setupDialog = page
      .getByRole('dialog')
      .filter({ hasText: 'Set Up Two-Factor Authentication' });
    await expect(
      setupDialog.getByAltText('QR code for two-factor authentication setup'),
    ).toBeVisible();
    expect(api.getMfaSetupRequestCount()).toBe(1);

    await setupDialog.getByLabel(/6-digit code/).fill('123456');
    const verifyButton = setupDialog.getByRole('button', { name: 'Verify & Enable' });
    await verifyButton.evaluate((button: HTMLElement) => {
      button.click();
      button.click();
    });

    const backupDialog = page
      .getByRole('alertdialog')
      .filter({ hasText: '2FA Enabled Successfully!' });
    await expect(backupDialog.getByText('SP-0001')).toBeVisible();
    expect(api.getMfaVerifyRequests()).toHaveLength(1);
    await backupDialog.getByRole('button', { name: "I've Saved My Codes" }).click();

    const downloadPromise = page.waitForEvent('download');
    const exportButton = page.getByRole('button', { name: 'Export My Data' });
    await exportButton.evaluate((button: HTMLElement) => {
      button.click();
      button.click();
    });
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('siteproof-export-e2e.json');
    expect(api.getExportRequestCount()).toBe(1);
  });

  test('recovers MFA status load failure without false disabled state', async ({ page }) => {
    const api = await mockSettingsApi(page, { failMfaStatusLoadsUntil: 4 });

    await page.goto('/settings');

    const mfaAlert = page.getByRole('alert').filter({ hasText: 'MFA service unavailable' });
    await expect(mfaAlert).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Enable Two-Factor Authentication' }),
    ).toBeHidden();

    const tryAgainButton = mfaAlert.getByRole('button', { name: 'Try again' });
    for (let attempt = 0; attempt < 6; attempt += 1) {
      if (
        await page
          .getByRole('button', { name: 'Enable Two-Factor Authentication' })
          .isVisible()
          .catch(() => false)
      )
        break;
      if (await tryAgainButton.isVisible().catch(() => false)) {
        await tryAgainButton.click();
      }
      await page.waitForTimeout(100);
    }

    await expect(
      page.getByRole('button', { name: 'Enable Two-Factor Authentication' }),
    ).toBeVisible();
    await expect.poll(() => api.getMfaStatusLoadCount()).toBeGreaterThan(4);
  });

  test('recovers push status load failure without hiding the retry action', async ({ page }) => {
    const api = await mockSettingsApi(page, { failPushStatusLoadsUntil: 4 });

    await page.goto('/settings');

    const pushAlert = page.getByRole('alert').filter({ hasText: 'Push service unavailable' });
    await expect(pushAlert).toBeVisible();

    const tryAgainButton = pushAlert.getByRole('button', { name: 'Try again' });
    for (let attempt = 0; attempt < 6; attempt += 1) {
      if (!(await pushAlert.isVisible().catch(() => false))) break;
      await tryAgainButton.click();
      await page.waitForTimeout(100);
    }

    await expect(pushAlert).toBeHidden();
    await expect.poll(() => api.getPushStatusLoadCount()).toBeGreaterThan(4);
  });

  test('requires exact email confirmation before deleting the account', async ({ page }) => {
    const api = await mockSettingsApi(page);

    await page.goto('/settings');

    await page.getByRole('button', { name: 'Delete My Account' }).click();
    const deleteDialog = page.getByRole('alertdialog').filter({ hasText: 'Delete Account' });
    const deleteButton = deleteDialog.getByRole('button', { name: 'Permanently Delete' });

    await expect(deleteButton).toBeDisabled();
    await deleteDialog.getByLabel(/Type your email to confirm/).fill('wrong@example.com');
    await expect(
      deleteDialog.getByText('Email must match your account email exactly.'),
    ).toBeVisible();
    await expect(deleteButton).toBeDisabled();

    await deleteDialog.getByLabel(/Type your email to confirm/).fill(ADMIN_EMAIL);
    await expect(deleteButton).toBeDisabled();
    await expect(deleteDialog.getByText('Required for password-based accounts.')).toBeVisible();
    await deleteDialog.getByLabel('Enter your password').fill('CorrectHorse123!');
    await deleteButton.click();

    await expect
      .poll(() => api.getDeleteRequest())
      .toMatchObject({
        confirmEmail: ADMIN_EMAIL,
        password: 'CorrectHorse123!',
      });
    await expect(page).toHaveURL(/\/login/);
  });
});
