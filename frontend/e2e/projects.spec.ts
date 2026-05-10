import { test, expect, type Page } from '@playwright/test';
import { E2E_ADMIN_USER, E2E_PROJECT_ID, mockAuthenticatedUserState } from './helpers';

const projectsUser = {
  ...E2E_ADMIN_USER,
  name: 'E2E Admin',
  fullName: 'E2E Admin',
  companyName: 'E2E Civil Pty Ltd',
};

const foremanUser = {
  ...E2E_ADMIN_USER,
  id: 'e2e-foreman-user',
  email: 'foreman@example.com',
  name: 'E2E Foreman',
  fullName: 'E2E Foreman',
  role: 'foreman',
  roleInCompany: 'foreman',
};

const seededProjects = [
  {
    id: E2E_PROJECT_ID,
    name: 'E2E Highway Upgrade',
    projectNumber: 'E2E-001',
    status: 'active',
    createdAt: '2026-01-15T00:00:00.000Z',
  },
  {
    id: 'e2e-bridge-project',
    name: 'E2E Bridge Widening',
    projectNumber: 'E2E-002',
    status: 'on_hold',
    createdAt: '2026-01-10T00:00:00.000Z',
  },
];

const projectDashboardData = {
  project: {
    id: E2E_PROJECT_ID,
    name: 'E2E Highway Upgrade',
    projectNumber: 'E2E-001',
    status: 'on_hold',
    client: 'Transport NSW',
    state: 'NSW',
  },
  stats: {
    lots: {
      total: 5,
      completed: 2,
      inProgress: 2,
      notStarted: 1,
      onHold: 0,
      progressPct: 40,
    },
    ncrs: {
      open: 2,
      total: 3,
      overdue: 1,
      major: 1,
      minor: 1,
      observation: 0,
    },
    holdPoints: { pending: 3, released: 7 },
    itps: { pending: 4, completed: 8 },
    dockets: { pendingApproval: 2 },
    tests: { total: 12 },
    documents: { total: 9 },
    diary: { todayStatus: 'draft' },
  },
  attentionItems: [
    {
      id: 'attention-ncr-1',
      type: 'ncr',
      title: 'NCR E2E-NCR-1 overdue',
      description: 'Overdue major NCR response',
      urgency: 'critical',
      daysOverdue: 3,
      link: 'https://external.invalid/ncr',
    },
  ],
  recentActivity: [
    {
      id: 'activity-lot-1',
      type: 'lot',
      description: 'Lot L-001 status changed to in progress',
      timestamp: 'not-a-date',
      link: 'https://external.invalid/activity',
    },
  ],
};

async function mockProjectsApi(
  page: Page,
  options: {
    user?: typeof projectsUser;
    projects?: typeof seededProjects;
    failProjectLoadsUntil?: number;
    createProjectFailure?: string;
    createProjectFailureStatus?: number;
  } = {},
) {
  const user = options.user ?? projectsUser;
  let projects = [...(options.projects ?? seededProjects)];
  let projectLoadCount = 0;
  let createRequest: unknown = null;

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });

    if (url.pathname === '/api/auth/me') {
      await json({ user });
      return;
    }

    if (url.pathname === '/api/notifications') {
      await json({ notifications: [], unreadCount: 0 });
      return;
    }

    if (url.pathname === '/api/projects') {
      if (method === 'POST') {
        createRequest = route.request().postDataJSON();
        if (options.createProjectFailure) {
          await json(
            { error: { message: options.createProjectFailure } },
            options.createProjectFailureStatus ?? 403,
          );
          return;
        }

        const body = createRequest as {
          name: string;
          projectNumber: string;
        };
        const createdProject = {
          id: 'created-project',
          name: body.name,
          projectNumber: body.projectNumber,
          status: 'active',
          createdAt: '2026-02-01T00:00:00.000Z',
        };
        projects = [createdProject, ...projects];
        await json({ project: createdProject }, 201);
        return;
      }

      projectLoadCount += 1;
      if (projectLoadCount <= (options.failProjectLoadsUntil ?? 0)) {
        await json({ message: 'Projects temporarily unavailable' }, 503);
        return;
      }

      await json({ projects });
      return;
    }

    if (url.pathname === `/api/projects/${E2E_PROJECT_ID}`) {
      await json({
        project: {
          ...seededProjects[0],
          clientName: 'Transport NSW',
          state: 'NSW',
        },
      });
      return;
    }

    if (url.pathname === `/api/projects/${E2E_PROJECT_ID}/dashboard`) {
      await json(projectDashboardData);
      return;
    }

    if (url.pathname === `/api/dashboard/projects/${E2E_PROJECT_ID}/foreman/today`) {
      await json({
        blocking: [],
        dueToday: [],
        upcoming: [],
        summary: { totalBlocking: 0, totalDueToday: 0, totalUpcoming: 0 },
      });
      return;
    }

    if (url.pathname === '/api/dockets' && url.searchParams.get('projectId') === E2E_PROJECT_ID) {
      await json({ dockets: [] });
      return;
    }

    if (url.pathname === '/api/diary' && url.searchParams.get('projectId') === E2E_PROJECT_ID) {
      await json({ diary: null });
      return;
    }

    if (url.pathname === '/api/lots' && url.searchParams.get('projectId') === E2E_PROJECT_ID) {
      await json({ lots: [] });
      return;
    }

    await json({ message: `Unhandled E2E API route: ${url.pathname}` }, 404);
  });

  await mockAuthenticatedUserState(page, user);

  return {
    getCreateRequest: () => createRequest,
    getProjectLoadCount: () => projectLoadCount,
  };
}

test.describe('Projects seeded account contract', () => {
  test('renders the project list with mounted project links and readable statuses', async ({
    page,
  }) => {
    await mockProjectsApi(page);

    await page.goto('/projects');

    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
    await expect(page.getByTestId('project-card')).toHaveCount(2);
    await expect(page.getByRole('link', { name: /E2E Highway Upgrade/ })).toHaveAttribute(
      'href',
      `/projects/${E2E_PROJECT_ID}`,
    );
    await expect(page.getByRole('link', { name: /E2E Bridge Widening/ })).toContainText('On Hold');
  });

  test('creates a project with trimmed text and numeric contract value', async ({ page }) => {
    const api = await mockProjectsApi(page, { projects: [] });

    await page.goto('/projects');

    await expect(page.getByText('No projects found')).toBeVisible();
    await page.getByRole('button', { name: 'New Project' }).click();

    const dialog = page.getByRole('dialog', { name: 'Create New Project' });
    await dialog.getByLabel(/Project Name/).fill('  Pacific Highway Upgrade  ');
    await dialog.getByLabel(/Project Number/).fill('  PHU-001  ');
    await dialog.getByLabel('Client').fill('  Transport NSW  ');
    await dialog.getByLabel(/Contract Value/).fill('1e2');
    await expect(
      dialog.getByText('Contract value must be a non-negative decimal number.'),
    ).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Create Project' })).toBeDisabled();
    expect(api.getCreateRequest()).toBeNull();
    await dialog.getByLabel(/Contract Value/).fill('1250000.50');
    await dialog.getByLabel('Start Date').fill('2026-12-15');
    await dialog.getByLabel('Target Completion').fill('2026-02-01');
    await expect(
      dialog.getByText('Target completion must be on or after the start date.'),
    ).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Create Project' })).toBeDisabled();
    await dialog.getByLabel('Start Date').fill('2026-02-01');
    await dialog.getByLabel('Target Completion').fill('2026-12-15');
    await dialog.getByLabel('State').selectOption('QLD');
    await dialog.getByLabel('Specification Set').selectOption('MRTS');
    await dialog.getByRole('button', { name: 'Create Project' }).click();

    await expect
      .poll(() => api.getCreateRequest())
      .toMatchObject({
        name: 'Pacific Highway Upgrade',
        projectNumber: 'PHU-001',
        clientName: 'Transport NSW',
        contractValue: 1250000.5,
        state: 'QLD',
        specificationSet: 'MRTS',
        startDate: '2026-02-01',
        targetCompletion: '2026-12-15',
      });
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('Pacific Highway Upgrade')).toBeVisible();
  });

  test('keeps the create project dialog open when the subscription limit is reached', async ({
    page,
  }) => {
    const api = await mockProjectsApi(page, {
      projects: seededProjects,
      createProjectFailure:
        'Your basic subscription allows up to 3 projects. Please upgrade to create more projects.',
    });

    await page.goto('/projects');
    await page.getByRole('button', { name: 'New Project' }).click();

    const dialog = page.getByRole('dialog', { name: 'Create New Project' });
    await dialog.getByLabel(/Project Name/).fill('Project Over Limit');
    await dialog.getByLabel(/Project Number/).fill('LIMIT-001');
    await dialog.getByRole('button', { name: 'Create Project' }).click();

    await expect(dialog.getByRole('alert')).toContainText(
      'basic subscription allows up to 3 projects',
    );
    await expect(dialog).toBeVisible();
    expect(api.getCreateRequest()).toMatchObject({
      name: 'Project Over Limit',
      projectNumber: 'LIMIT-001',
    });
  });

  test('surfaces project load failures with retry and no false empty state', async ({ page }) => {
    const api = await mockProjectsApi(page, { failProjectLoadsUntil: 2 });

    await page.goto('/projects');

    const alert = page.getByRole('alert');
    await expect(alert).toContainText('Projects temporarily unavailable');
    await expect(page.getByText('No projects found')).toHaveCount(0);

    await alert.getByRole('button', { name: 'Try again' }).click();

    await expect(page.getByTestId('project-card')).toHaveCount(2);
    expect(api.getProjectLoadCount()).toBeGreaterThanOrEqual(3);
  });

  test('renders project dashboard data and guards API-provided links', async ({ page }) => {
    await mockProjectsApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}`);

    const projectHeader = page
      .getByRole('heading', { name: 'E2E Highway Upgrade' })
      .locator('..')
      .locator('..');
    await expect(page.getByRole('heading', { name: 'E2E Highway Upgrade' })).toBeVisible();
    await expect(projectHeader).toContainText('On Hold');
    await expect(projectHeader).toContainText('E2E-001');
    await expect(projectHeader).toContainText('Transport NSW');
    await expect(
      page.getByRole('heading', { name: 'Lot Progress' }).locator('..').locator('..'),
    ).toContainText('40%');
    await expect(
      page.getByRole('heading', { name: 'Quality Overview' }).locator('..').locator('..'),
    ).toContainText('2');

    await expect(page.getByRole('link', { name: /NCR E2E-NCR-1 overdue/ })).toHaveAttribute(
      'href',
      `/projects/${E2E_PROJECT_ID}/ncr`,
    );
    await expect(
      page.getByRole('link', { name: /Lot L-001 status changed to in progress/ }),
    ).toHaveAttribute('href', `/projects/${E2E_PROJECT_ID}/lots`);
    await expect(page.getByText('Unknown time')).toBeVisible();
  });

  test('redirects foreman mobile users to the foreman today view', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockProjectsApi(page, { user: foremanUser });

    await page.goto(`/projects/${E2E_PROJECT_ID}`);

    await expect(page).toHaveURL(`/projects/${E2E_PROJECT_ID}/foreman/today`);
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
  });

  test('keeps foreman mobile bottom navigation on mounted project routes', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockProjectsApi(page, { user: foremanUser });

    await page.goto(`/projects/${E2E_PROJECT_ID}/foreman/today`);

    await page.getByRole('button', { name: 'Approve' }).click();
    await expect(page).toHaveURL(`/projects/${E2E_PROJECT_ID}/dockets?status=pending_approval`);

    await page.getByRole('button', { name: 'Diary' }).click();
    await expect(page).toHaveURL(`/projects/${E2E_PROJECT_ID}/diary`);

    await page.getByRole('button', { name: 'Lots' }).click();
    await expect(page).toHaveURL(`/projects/${E2E_PROJECT_ID}/lots`);

    await page.getByRole('button', { name: 'Today' }).click();
    await expect(page).toHaveURL(`/projects/${E2E_PROJECT_ID}/foreman/today`);
  });
});
