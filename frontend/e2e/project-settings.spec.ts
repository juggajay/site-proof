import { test, expect, type Page } from '@playwright/test';
import { E2E_ADMIN_USER, E2E_PROJECT_ID, mockAuthenticatedUserState } from './helpers';

type PatchRequest = {
  name?: string;
  code?: string;
  lotPrefix?: string;
  lotStartingNumber?: number;
  ncrPrefix?: string;
  ncrStartingNumber?: number;
  chainageStart?: number;
  chainageEnd?: number;
  workingHoursStart?: string;
  workingHoursEnd?: string;
  settings?: Record<string, unknown>;
};

type InviteRequest = {
  email: string;
  role: string;
};

type MockProjectSettingsApiOptions = {
  failProjectLoadsUntil?: number;
  failTeamLoadsUntil?: number;
  failTemplateLoadsUntil?: number;
  patchDelayMs?: number;
  inviteDelayMs?: number;
  user?: typeof E2E_ADMIN_USER;
};

const seededProject = {
  id: E2E_PROJECT_ID,
  name: 'E2E Highway Upgrade',
  code: 'E2E-001',
  projectNumber: 'E2E-001',
  status: 'active',
  startDate: '2026-05-01T00:00:00.000Z',
  targetCompletion: '2026-12-01T00:00:00.000Z',
  contractValue: 1250000,
  lotPrefix: 'LOT-',
  lotStartingNumber: 1,
  ncrPrefix: 'NCR-',
  ncrStartingNumber: 1,
  chainageStart: 0,
  chainageEnd: 1200,
  workingHoursStart: '06:00',
  workingHoursEnd: '18:00',
  settings: JSON.stringify({
    enabledModules: {
      costTracking: true,
      progressClaims: true,
      subcontractors: true,
      dockets: true,
      dailyDiary: true,
    },
    notificationPreferences: {
      holdPointReleases: true,
      ncrAssignments: true,
      testResults: true,
      dailyDiaryReminders: true,
    },
    witnessPointNotifications: {
      enabled: false,
      trigger: 'previous_item',
      clientEmail: 'client@example.com',
      clientName: 'Initial Contact',
    },
    hpMinimumNoticeDays: 2,
    hpApprovalRequirement: 'superintendent',
    hpRecipients: [{ role: 'Superintendent', email: 'superintendent@example.com' }],
    requireSubcontractorVerification: true,
  }),
};

const seededTeamMembers = [
  {
    id: 'team-member-1',
    userId: 'e2e-admin-user',
    email: 'test@example.com',
    fullName: 'E2E Admin',
    role: 'admin',
    status: 'active',
    invitedAt: '2026-05-01T00:00:00.000Z',
    acceptedAt: '2026-05-01T00:00:00.000Z',
  },
];

const seededItpTemplates = [
  {
    id: 'template-1',
    name: 'Earthworks ITP',
    activityType: 'Earthworks',
    isActive: true,
    checklistItems: [{ id: 'item-1' }, { id: 'item-2' }],
  },
];

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function mockProjectSettingsApi(page: Page, options: MockProjectSettingsApiOptions = {}) {
  let project = structuredClone(seededProject);
  const teamMembers = structuredClone(seededTeamMembers);
  const patchRequests: PatchRequest[] = [];
  const inviteRequests: InviteRequest[] = [];
  let projectLoadCount = 0;
  let teamLoadCount = 0;
  let templateLoadCount = 0;

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });

    if (url.pathname === '/api/auth/me') {
      await json({ user: options.user ?? E2E_ADMIN_USER });
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
            name: project.name,
            projectNumber: project.projectNumber,
            status: project.status,
          },
        ],
      });
      return;
    }

    if (url.pathname === `/api/projects/${E2E_PROJECT_ID}`) {
      if (route.request().method() === 'GET') {
        projectLoadCount += 1;
        if (projectLoadCount <= (options.failProjectLoadsUntil ?? 0)) {
          await json({ message: 'Project settings service unavailable' }, 500);
          return;
        }

        await json({ project });
        return;
      }

      if (route.request().method() === 'PATCH') {
        if (options.patchDelayMs) {
          await delay(options.patchDelayMs);
        }

        const body = route.request().postDataJSON() as PatchRequest;
        patchRequests.push(body);
        const existingSettings = JSON.parse(project.settings) as Record<string, unknown>;
        const nextSettings = body.settings
          ? { ...existingSettings, ...body.settings }
          : existingSettings;
        project = {
          ...project,
          ...body,
          projectNumber: body.code ?? project.projectNumber,
          code: body.code ?? project.code,
          settings: JSON.stringify(nextSettings),
        };
        await json({ project });
        return;
      }
    }

    if (url.pathname === `/api/projects/${E2E_PROJECT_ID}/users`) {
      if (route.request().method() === 'GET') {
        teamLoadCount += 1;
        if (teamLoadCount <= (options.failTeamLoadsUntil ?? 0)) {
          await json({ message: 'Project team service unavailable' }, 500);
          return;
        }

        await json({ users: teamMembers });
        return;
      }

      if (route.request().method() === 'POST') {
        if (options.inviteDelayMs) {
          await delay(options.inviteDelayMs);
        }

        const body = route.request().postDataJSON() as InviteRequest;
        inviteRequests.push(body);
        teamMembers.push({
          id: `team-member-${teamMembers.length + 1}`,
          userId: `pending-${teamMembers.length + 1}`,
          email: body.email,
          fullName: '',
          role: body.role,
          status: 'pending',
          invitedAt: '2026-05-09T00:00:00.000Z',
          acceptedAt: '',
        });
        await json({ user: teamMembers.at(-1) });
        return;
      }
    }

    if (url.pathname === '/api/itp/templates') {
      templateLoadCount += 1;
      if (templateLoadCount <= (options.failTemplateLoadsUntil ?? 0)) {
        await json({ message: 'ITP templates service unavailable' }, 500);
        return;
      }

      await json({ templates: seededItpTemplates });
      return;
    }

    await json({ message: `Unhandled E2E API route: ${url.pathname}` }, 404);
  });

  await mockAuthenticatedUserState(page);

  return {
    getPatchRequests: () => patchRequests,
    getInviteRequests: () => inviteRequests,
    getProjectLoadCount: () => projectLoadCount,
    getTeamLoadCount: () => teamLoadCount,
    getTemplateLoadCount: () => templateLoadCount,
  };
}

test.describe('Project settings seeded admin contract', () => {
  test('falls back to general tab and saves validated general settings', async ({ page }) => {
    const api = await mockProjectSettingsApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/settings?tab=unknown`);

    await expect(page.getByRole('heading', { name: 'Project Settings' })).toBeVisible();
    await expect(page.getByRole('main').getByText('E2E Highway Upgrade')).toBeVisible();
    await expect(page.getByRole('tab', { name: /General/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByRole('heading', { name: 'General Settings' })).toBeVisible();

    await page.getByLabel('Project Name').fill('E2E Highway Stage 2');
    await page.getByLabel('Lot Starting Number').fill('1e2');
    await page.getByRole('button', { name: 'Save Settings' }).click();

    await expect(page.getByText('Lot starting number must be a positive integer')).toBeVisible();
    expect(api.getPatchRequests()).toHaveLength(0);

    await page.getByLabel('Lot Starting Number').fill('100');
    await page.getByLabel('Chainage Start (m)').fill('1e2');
    await page.getByRole('button', { name: 'Save Settings' }).click();

    await expect(
      page.getByText('Chainage start must be a non-negative decimal number'),
    ).toBeVisible();
    expect(api.getPatchRequests()).toHaveLength(0);

    await page.getByLabel('Chainage Start (m)').fill('250.5');
    await page.getByLabel('Chainage End (m)').fill('250');
    await page.getByRole('button', { name: 'Save Settings' }).click();

    await expect(page.getByText('Chainage end must be greater than chainage start')).toBeVisible();
    expect(api.getPatchRequests()).toHaveLength(0);

    await page.getByLabel('Chainage End (m)').fill('1000.75');
    await page.getByLabel('Start Time').fill('07:00');
    await page.getByLabel('End Time').fill('16:30');
    await page.getByRole('button', { name: 'Save Settings' }).click();

    await expect(page.getByText('Settings saved successfully!')).toBeVisible();
    expect(api.getPatchRequests()).toHaveLength(1);
    expect(api.getPatchRequests()[0]).toMatchObject({
      name: 'E2E Highway Stage 2',
      chainageStart: 250.5,
      chainageEnd: 1000.75,
      workingHoursStart: '07:00',
      workingHoursEnd: '16:30',
    });
  });

  test('uses company role for commercial setting visibility', async ({ page }) => {
    await mockProjectSettingsApi(page, {
      user: {
        ...E2E_ADMIN_USER,
        role: 'viewer',
        roleInCompany: 'admin',
      },
    });

    await page.goto(`/projects/${E2E_PROJECT_ID}/settings`);

    await expect(page.getByRole('heading', { name: 'General Settings' })).toBeVisible();
    await expect(page.getByText('Contract Value')).toBeVisible();
    await expect(page.getByText('$1,250,000.00')).toBeVisible();
  });

  test('prevents duplicate general settings save submissions', async ({ page }) => {
    const api = await mockProjectSettingsApi(page, { patchDelayMs: 250 });

    await page.goto(`/projects/${E2E_PROJECT_ID}/settings`);

    await page.getByLabel('Project Name').fill('  E2E Duplicate Guard  ');
    const saveButton = page.getByRole('button', { name: 'Save Settings' });
    await saveButton.evaluate((button: HTMLElement) => {
      button.click();
      button.click();
    });

    await expect(page.getByText('Settings saved successfully!')).toBeVisible();
    expect(api.getPatchRequests()).toHaveLength(1);
    expect(api.getPatchRequests()[0]).toMatchObject({
      name: 'E2E Duplicate Guard',
    });
  });

  test('persists module and notification settings', async ({ page }) => {
    const api = await mockProjectSettingsApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/settings?tab=modules`);

    const costTrackingToggle = page.getByRole('checkbox', { name: /Cost Tracking/ });
    await expect(costTrackingToggle).toBeChecked();
    await costTrackingToggle.uncheck();

    await expect
      .poll(() => api.getPatchRequests())
      .toContainEqual(
        expect.objectContaining({
          settings: expect.objectContaining({
            enabledModules: expect.objectContaining({ costTracking: false }),
          }),
        }),
      );
    await expect(costTrackingToggle).not.toBeChecked();

    await page.getByRole('tab', { name: /Notifications/ }).click();
    await expect(page.getByRole('heading', { name: 'Notification Preferences' })).toBeVisible();

    const diaryReminderToggle = page.getByRole('checkbox', { name: /Daily Diary Reminders/ });
    await expect(diaryReminderToggle).toBeChecked();
    await diaryReminderToggle.uncheck();
    await expect(page.getByText('Notification preference saved.')).toBeVisible();

    await page.getByLabel('Release Authorization').selectOption('any');
    await expect(page.getByText('Hold point approval requirement saved.')).toBeVisible();

    await page.getByLabel('Minimum Notice (Working Days)').selectOption('5');
    await expect(page.getByText('Minimum notice period saved.')).toBeVisible();

    const witnessToggle = page.getByRole('checkbox', {
      name: /Enable Witness Point Notifications/,
    });
    await expect(witnessToggle).not.toBeChecked();
    await witnessToggle.check();
    await page.getByLabel('Notification Trigger').selectOption('same_day');
    await page.getByLabel('Client Contact Email').fill('superintendent@example.com');
    await page.getByLabel('Client Contact Name').fill('E2E Superintendent');
    await page.getByRole('button', { name: 'Save Witness Settings' }).click();
    await expect(page.getByText('Witness point notification settings saved.')).toBeVisible();

    await page.getByRole('button', { name: 'Add Recipient' }).click();
    const recipientDialog = page.getByRole('dialog').filter({ hasText: 'Add HP Recipient' });
    await expect(recipientDialog.getByText('Add a default recipient')).toBeVisible();
    await recipientDialog.getByLabel('Role/Title').fill('Client Rep');
    await recipientDialog.getByLabel('Email Address').fill('client.rep@example.com');
    await recipientDialog.getByRole('button', { name: 'Add Recipient' }).click();
    await expect(page.getByText('Hold point recipient added.')).toBeVisible();
    await expect(page.getByText('client.rep@example.com')).toBeVisible();

    await page.getByRole('button', { name: 'Remove Superintendent' }).click();
    await expect(page.getByText('Hold point recipient removed.')).toBeVisible();
    await expect(page.getByText('superintendent@example.com')).toBeHidden();

    const patchRequests = api.getPatchRequests();
    expect(patchRequests).toContainEqual(
      expect.objectContaining({
        settings: expect.objectContaining({
          notificationPreferences: expect.objectContaining({ dailyDiaryReminders: false }),
        }),
      }),
    );
    expect(patchRequests).toContainEqual(
      expect.objectContaining({
        settings: expect.objectContaining({ hpApprovalRequirement: 'any' }),
      }),
    );
    expect(patchRequests).toContainEqual(
      expect.objectContaining({
        settings: expect.objectContaining({ hpMinimumNoticeDays: 5 }),
      }),
    );
    expect(patchRequests).toContainEqual(
      expect.objectContaining({
        settings: expect.objectContaining({
          witnessPointNotifications: expect.objectContaining({
            enabled: true,
            trigger: 'same_day',
            clientEmail: 'superintendent@example.com',
            clientName: 'E2E Superintendent',
          }),
        }),
      }),
    );
    expect(patchRequests).toContainEqual(
      expect.objectContaining({
        settings: expect.objectContaining({
          hpRecipients: expect.arrayContaining([
            expect.objectContaining({ role: 'Client Rep', email: 'client.rep@example.com' }),
          ]),
        }),
      }),
    );
    expect(patchRequests.at(-1)).toMatchObject({
      settings: {
        hpRecipients: [{ role: 'Client Rep', email: 'client.rep@example.com' }],
      },
    });
  });

  test('recovers from project settings load failure without false tab content', async ({
    page,
  }) => {
    const api = await mockProjectSettingsApi(page, { failProjectLoadsUntil: 4 });

    await page.goto(`/projects/${E2E_PROJECT_ID}/settings`);

    await expect(page.getByRole('heading', { name: 'Project Settings' })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('Project settings service unavailable');
    await expect(page.getByRole('heading', { name: 'General Settings' })).toBeHidden();

    const tryAgainButton = page.getByRole('button', { name: 'Try again' });
    for (let attempt = 0; attempt < 6; attempt += 1) {
      if (!(await tryAgainButton.isVisible().catch(() => false))) break;
      await tryAgainButton.click();
    }

    await expect(page.getByRole('heading', { name: 'General Settings' })).toBeVisible();
    await expect.poll(() => api.getProjectLoadCount()).toBeGreaterThan(4);
  });

  test('recovers embedded team load failure without false empty state', async ({ page }) => {
    const api = await mockProjectSettingsApi(page, { failTeamLoadsUntil: 2 });

    await page.goto(`/projects/${E2E_PROJECT_ID}/settings?tab=team`);

    await expect(page.getByRole('heading', { name: 'Team Members' })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('Project team service unavailable');
    await expect(page.getByText('No team members yet.')).toBeHidden();

    const teamAlert = page
      .getByRole('alert')
      .filter({ hasText: 'Project team service unavailable' });
    const tryAgainButton = teamAlert.getByRole('button', { name: 'Try again' });
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (!(await tryAgainButton.isVisible().catch(() => false))) break;
      await tryAgainButton.click();
    }

    await expect(page.getByText('E2E Admin')).toBeVisible();
    await expect.poll(() => api.getTeamLoadCount()).toBeGreaterThan(2);
  });

  test('recovers embedded ITP template load failure without false empty state', async ({
    page,
  }) => {
    const api = await mockProjectSettingsApi(page, { failTemplateLoadsUntil: 2 });

    await page.goto(`/projects/${E2E_PROJECT_ID}/settings?tab=itp-templates`);

    await expect(page.getByRole('heading', { name: 'ITP Templates' })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('ITP templates service unavailable');
    await expect(page.getByText('No ITP templates found for this project.')).toBeHidden();

    const templateAlert = page
      .getByRole('alert')
      .filter({ hasText: 'ITP templates service unavailable' });
    const tryAgainButton = templateAlert.getByRole('button', { name: 'Try again' });
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (!(await tryAgainButton.isVisible().catch(() => false))) break;
      await tryAgainButton.click();
    }

    await expect(page.getByText('Earthworks ITP')).toBeVisible();
    await expect.poll(() => api.getTemplateLoadCount()).toBeGreaterThan(2);
  });
});
