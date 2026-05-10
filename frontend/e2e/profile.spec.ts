import { test, expect, type Page } from '@playwright/test';
import { E2E_ADMIN_USER, E2E_PROJECT_ID, mockAuthenticatedUserState } from './helpers';

const profileUser = {
  ...E2E_ADMIN_USER,
  fullName: 'E2E Admin',
  name: 'E2E Admin',
  phone: '+61 400 000 000',
  role: 'admin',
  roleInCompany: 'admin',
  companyName: 'E2E Civil Pty Ltd',
  createdAt: '2026-05-01T00:00:00.000Z',
  avatarUrl: null,
};

type MockProfileApiOptions = {
  profileDelayMs?: number;
  passwordDelayMs?: number;
  logoutAllDelayMs?: number;
  avatarUploadFailure?: boolean;
};

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function mockProfileApi(page: Page, options: MockProfileApiOptions = {}) {
  let currentUser = structuredClone(profileUser);
  const profilePatches: unknown[] = [];
  const passwordRequests: unknown[] = [];
  let logoutAllRequestCount = 0;

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });

    if (url.pathname === '/api/auth/me') {
      await json({ user: currentUser });
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

    if (url.pathname === '/api/auth/profile') {
      if (options.profileDelayMs) {
        await delay(options.profileDelayMs);
      }

      const body = route.request().postDataJSON() as { fullName: string; phone: string };
      profilePatches.push(body);
      currentUser = {
        ...currentUser,
        fullName: body.fullName,
        name: body.fullName,
        phone: body.phone,
      };
      await json({
        message: 'Profile updated successfully',
        user: currentUser,
      });
      return;
    }

    if (url.pathname === '/api/auth/change-password') {
      if (options.passwordDelayMs) {
        await delay(options.passwordDelayMs);
      }

      passwordRequests.push(route.request().postDataJSON());
      await json({ message: 'Password changed successfully' });
      return;
    }

    if (url.pathname === '/api/auth/avatar') {
      if (route.request().method() === 'POST') {
        if (options.avatarUploadFailure) {
          await json({ error: { message: 'Avatar rejected by server' } }, 400);
          return;
        }

        currentUser = {
          ...currentUser,
          avatarUrl: '/uploads/avatars/e2e-avatar.png',
        };
        await json({ avatarUrl: currentUser.avatarUrl, user: currentUser });
        return;
      }

      if (route.request().method() === 'DELETE') {
        currentUser = {
          ...currentUser,
          avatarUrl: null,
        };
        await json({ success: true, user: currentUser });
        return;
      }
    }

    if (url.pathname === '/api/auth/logout-all-devices') {
      if (options.logoutAllDelayMs) {
        await delay(options.logoutAllDelayMs);
      }

      logoutAllRequestCount += 1;
      await json({ message: 'Successfully logged out from all devices' });
      return;
    }

    await json({ message: `Unhandled E2E API route: ${url.pathname}` }, 404);
  });

  await mockAuthenticatedUserState(page, currentUser);

  return {
    getProfilePatch: () => profilePatches.at(-1) ?? null,
    getProfilePatches: () => profilePatches,
    getPasswordRequest: () => passwordRequests.at(-1) ?? null,
    getPasswordRequests: () => passwordRequests,
    getLogoutAllRequested: () => logoutAllRequestCount > 0,
    getLogoutAllRequestCount: () => logoutAllRequestCount,
  };
}

test.describe('Profile seeded account contract', () => {
  test('updates profile details, validates password policy, and changes password', async ({
    page,
  }) => {
    const api = await mockProfileApi(page);

    await page.goto('/profile');

    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'E2E Admin' })).toBeVisible();
    await expect(page.getByText('+61 400 000 000')).toBeVisible();
    await expect(page.getByText('E2E Civil Pty Ltd')).toBeVisible();

    await page.getByRole('button', { name: 'Edit Profile' }).click();
    const editDialog = page.getByRole('dialog').filter({ hasText: 'Edit Profile' });
    await expect(editDialog.getByText('Update your profile details')).toBeVisible();
    await editDialog.getByLabel('Full Name').fill('  E2E Admin Updated  ');
    await editDialog.getByLabel('Phone Number').fill('  +61 400 111 222  ');
    await editDialog.getByRole('button', { name: 'Save Changes' }).click();

    await expect(page.getByText('Your profile has been updated successfully.')).toBeVisible();
    expect(api.getProfilePatch()).toMatchObject({
      fullName: 'E2E Admin Updated',
      phone: '+61 400 111 222',
    });
    await expect(page.getByRole('heading', { name: 'E2E Admin Updated' })).toBeVisible();
    await expect(page.getByText('+61 400 111 222')).toBeVisible();

    await page.getByRole('button', { name: 'Change Password' }).click();
    const passwordDialog = page.getByRole('dialog').filter({ hasText: 'Change Password' });
    await expect(
      passwordDialog.getByText('Use a strong password with at least 12 characters'),
    ).toBeVisible();
    await passwordDialog.getByLabel('Current Password').fill('CurrentPass123!');
    await passwordDialog.getByLabel('New Password', { exact: true }).fill('Short1!');
    await passwordDialog.getByLabel('Confirm New Password').fill('Short1!');
    await passwordDialog.getByRole('button', { name: 'Change Password' }).click();

    await expect(
      passwordDialog.getByText('New password must be at least 12 characters long'),
    ).toBeVisible();
    expect(api.getPasswordRequest()).toBeNull();

    await passwordDialog.getByLabel('New Password', { exact: true }).fill('StrongerPass123!');
    await passwordDialog.getByLabel('Confirm New Password').fill('StrongerPass123!');
    await passwordDialog.getByRole('button', { name: 'Change Password' }).click();

    await expect(page.getByText('Your password has been changed successfully.')).toBeVisible();
    expect(api.getPasswordRequest()).toMatchObject({
      currentPassword: 'CurrentPass123!',
      newPassword: 'StrongerPass123!',
      confirmPassword: 'StrongerPass123!',
    });
  });

  test('prevents duplicate profile and password submissions', async ({ page }) => {
    const api = await mockProfileApi(page, {
      profileDelayMs: 250,
      passwordDelayMs: 250,
    });

    await page.goto('/profile');

    await page.getByRole('button', { name: 'Edit Profile' }).click();
    const editDialog = page.getByRole('dialog').filter({ hasText: 'Edit Profile' });
    await editDialog.getByLabel('Full Name').fill('E2E Duplicate Guard');
    const saveButton = editDialog.getByRole('button', { name: 'Save Changes' });
    await saveButton.evaluate((button: HTMLElement) => {
      button.click();
      button.click();
    });

    await expect(page.getByText('Your profile has been updated successfully.')).toBeVisible();
    expect(api.getProfilePatches()).toHaveLength(1);

    await page.getByRole('button', { name: 'Change Password' }).click();
    const passwordDialog = page.getByRole('dialog').filter({ hasText: 'Change Password' });
    await passwordDialog.getByLabel('Current Password').fill('CurrentPass123!');
    await passwordDialog.getByLabel('New Password', { exact: true }).fill('StrongerPass123!');
    await passwordDialog.getByLabel('Confirm New Password').fill('StrongerPass123!');
    const changeButton = passwordDialog.getByRole('button', { name: 'Change Password' });
    await changeButton.evaluate((button: HTMLElement) => {
      button.click();
      button.click();
    });

    await expect(page.getByText('Your password has been changed successfully.')).toBeVisible();
    expect(api.getPasswordRequests()).toHaveLength(1);
  });

  test('shows nested backend avatar upload errors as readable messages', async ({ page }) => {
    await mockProfileApi(page, { avatarUploadFailure: true });

    await page.goto('/profile');
    await page.getByRole('button', { name: 'Edit Profile' }).click();

    const editDialog = page.getByRole('dialog').filter({ hasText: 'Edit Profile' });
    await editDialog.getByLabel('Avatar image file').setInputFiles({
      name: 'avatar.png',
      mimeType: 'image/png',
      buffer: Buffer.from('not-a-real-image'),
    });
    const saveAvatarButton = editDialog.getByRole('button', { name: 'Save Avatar' });
    await expect(saveAvatarButton).toBeVisible();
    await saveAvatarButton.click();

    await expect(page.getByText('Avatar rejected by server')).toBeVisible();
  });

  test('requires confirmation before logging out all devices', async ({ page }) => {
    const api = await mockProfileApi(page);

    await page.goto('/profile');

    await page.getByRole('button', { name: 'Logout All Devices' }).click();
    const logoutDialog = page
      .getByRole('alertdialog')
      .filter({ hasText: 'Log Out From All Devices' });
    await expect(logoutDialog.getByText('including this browser session')).toBeVisible();
    await logoutDialog.getByRole('button', { name: 'Cancel' }).click();
    expect(api.getLogoutAllRequested()).toBe(false);

    await page.getByRole('button', { name: 'Logout All Devices' }).click();
    await logoutDialog.getByRole('button', { name: 'Log Out' }).click();
    await expect.poll(() => api.getLogoutAllRequested()).toBe(true);
  });
});
