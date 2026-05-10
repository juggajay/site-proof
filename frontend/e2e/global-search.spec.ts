import { expect, test, type Page } from '@playwright/test';
import { E2E_ADMIN_USER, E2E_PROJECT_ID, mockAuthenticatedUserState } from './helpers';

type SearchScope = 'lots' | 'ncrs' | 'tests';

const project = {
  id: E2E_PROJECT_ID,
  name: 'E2E Highway Upgrade',
  projectNumber: 'E2E-001',
  status: 'active',
};

const dashboard = {
  project: {
    ...project,
    client: 'Transport NSW',
    state: 'NSW',
  },
  stats: {
    lots: { total: 1, completed: 0, inProgress: 1, notStarted: 0, onHold: 0, progressPct: 0 },
    ncrs: { open: 1, total: 1, overdue: 0, major: 0, minor: 1, observation: 0 },
    holdPoints: { pending: 0, released: 0 },
    itps: { pending: 0, completed: 0 },
    dockets: { pendingApproval: 0 },
    tests: { total: 1 },
    documents: { total: 0 },
    diary: { todayStatus: 'draft' },
  },
  attentionItems: [],
  recentActivity: [],
};

async function mockGlobalSearchApi(
  page: Page,
  options: {
    failingScopes?: SearchScope[];
    noResults?: boolean;
  } = {},
) {
  const failingScopes = new Set(options.failingScopes ?? []);
  const requests: Record<SearchScope, Array<{ search: string | null; limit: string | null }>> = {
    lots: [],
    ncrs: [],
    tests: [],
  };
  let lotsRequestCount = 0;

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
      await json({ projects: [project] });
      return;
    }

    if (url.pathname === `/api/projects/${E2E_PROJECT_ID}/dashboard`) {
      await json(dashboard);
      return;
    }

    if (url.pathname === '/api/lots') {
      lotsRequestCount += 1;
      requests.lots.push({
        search: url.searchParams.get('search'),
        limit: url.searchParams.get('limit'),
      });
      if (failingScopes.has('lots')) {
        await json({ message: 'Lots unavailable' }, 503);
        return;
      }
      const lots = options.noResults
        ? []
        : [
            {
              id: 'lot/search 1',
              lotNumber: 'ALPHA-LOT-001',
              description: 'Alpha zone earthworks',
              status: 'in_progress',
              activityType: 'Earthworks',
              projectId: E2E_PROJECT_ID,
            },
          ];
      await json({
        data: lots,
        lots,
        pagination: { total: lots.length, page: 1, limit: 10, totalPages: 1 },
      });
      return;
    }

    if (url.pathname === '/api/ncrs') {
      requests.ncrs.push({
        search: url.searchParams.get('search'),
        limit: url.searchParams.get('limit'),
      });
      if (failingScopes.has('ncrs')) {
        await json({ message: 'NCRs unavailable' }, 503);
        return;
      }
      const ncrs = options.noResults
        ? []
        : [
            {
              id: 'ncr-search-1',
              projectId: E2E_PROJECT_ID,
              ncrNumber: 'NCR-ALPHA-001',
              description: 'Alpha NCR',
              category: 'Workmanship',
              severity: 'minor',
              status: 'open',
            },
          ];
      await json({
        data: ncrs,
        ncrs,
        pagination: { total: ncrs.length, page: 1, limit: 10, totalPages: 1 },
      });
      return;
    }

    if (url.pathname === '/api/test-results') {
      requests.tests.push({
        search: url.searchParams.get('search'),
        limit: url.searchParams.get('limit'),
      });
      if (failingScopes.has('tests')) {
        await json({ message: 'Tests unavailable' }, 503);
        return;
      }
      const testResults = options.noResults
        ? []
        : [
            {
              id: 'test-search-1',
              projectId: E2E_PROJECT_ID,
              testType: 'Alpha compaction test',
              testRequestNumber: 'TR-ALPHA-001',
              laboratoryName: 'Alpha Lab',
              status: 'requested',
            },
          ];
      await json({
        testResults,
        pagination: { total: testResults.length, page: 1, limit: 10, totalPages: 1 },
      });
      return;
    }

    await json({ message: `Unhandled E2E API route: ${url.pathname}` }, 404);
  });

  await mockAuthenticatedUserState(page, E2E_ADMIN_USER);

  return {
    requests,
    getLotsRequestCount: () => lotsRequestCount,
  };
}

test.describe('Global search', () => {
  test('queries server-side search endpoints and navigates to encoded results', async ({
    page,
  }) => {
    const api = await mockGlobalSearchApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}`);
    await page.getByRole('button', { name: 'Quick search' }).click();
    await page
      .getByRole('dialog', { name: 'Global search' })
      .getByRole('textbox', { name: 'Search' })
      .fill('alpha');

    await expect(page.getByRole('button', { name: /ALPHA-LOT-001/ })).toBeVisible();
    await expect.poll(() => api.requests.lots.at(-1)).toEqual({ search: 'alpha', limit: '10' });
    await expect.poll(() => api.requests.ncrs.at(-1)).toEqual({ search: 'alpha', limit: '10' });
    await expect.poll(() => api.requests.tests.at(-1)).toEqual({ search: 'alpha', limit: '10' });

    await page.getByRole('button', { name: /ALPHA-LOT-001/ }).click();
    await expect(page).toHaveURL(new RegExp(`/projects/${E2E_PROJECT_ID}/lots/lot%2Fsearch%201$`));
  });

  test('shows partial failure state without hiding successful results', async ({ page }) => {
    await mockGlobalSearchApi(page, { failingScopes: ['ncrs', 'tests'] });

    await page.goto(`/projects/${E2E_PROJECT_ID}`);
    await page.getByRole('button', { name: 'Quick search' }).click();
    await page
      .getByRole('dialog', { name: 'Global search' })
      .getByRole('textbox', { name: 'Search' })
      .fill('alpha');

    await expect(page.getByRole('button', { name: /ALPHA-LOT-001/ })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('Some search results could not be loaded');
    await expect(page.getByText(/No results found/)).toBeHidden();
  });

  test('shows retryable failure instead of a false empty state', async ({ page }) => {
    const api = await mockGlobalSearchApi(page, { failingScopes: ['lots', 'ncrs', 'tests'] });

    await page.goto(`/projects/${E2E_PROJECT_ID}`);
    await page.getByRole('button', { name: 'Quick search' }).click();
    await page
      .getByRole('dialog', { name: 'Global search' })
      .getByRole('textbox', { name: 'Search' })
      .fill('alpha');

    await expect(page.getByRole('alert')).toContainText('Search failed');
    await expect(page.getByText(/No results found/)).toBeHidden();

    const beforeRetry = api.getLotsRequestCount();
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect.poll(() => api.getLotsRequestCount()).toBeGreaterThan(beforeRetry);
  });

  test('explains that a project context is required', async ({ page }) => {
    await mockGlobalSearchApi(page);

    await page.goto('/projects');
    await page.getByRole('button', { name: 'Quick search' }).click();

    await expect(page.getByText('Select a project to search')).toBeVisible();
  });
});
