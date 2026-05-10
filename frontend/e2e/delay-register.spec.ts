import { test, expect, type Page } from '@playwright/test';
import { E2E_ADMIN_USER, E2E_PROJECT_ID, mockAuthenticatedUserState } from './helpers';

type SeededDelayRegisterOptions = {
  failDelayLoadsUntil?: number;
};

function buildDelay(delayType = 'weather') {
  return {
    id: `e2e-delay-${delayType}`,
    diaryId: 'e2e-diary',
    diaryDate: '2026-01-15T00:00:00.000Z',
    diaryStatus: 'draft',
    delayType,
    startTime: '12:00',
    endTime: '13:30',
    durationHours: 1.5,
    description: delayType === 'weather' ? 'Wet weather shutdown' : 'Excavator hydraulic fault',
    impact: delayType === 'weather' ? 'Crew stood down' : 'Standby excavator mobilised',
  };
}

function buildDelayResponse(delayType: string | null) {
  const delays = delayType
    ? [buildDelay(delayType)]
    : [buildDelay('weather'), buildDelay('equipment_breakdown')];
  const byType = delays.reduce<Record<string, { count: number; totalHours: number }>>(
    (acc, delay) => {
      acc[delay.delayType] = {
        count: (acc[delay.delayType]?.count || 0) + 1,
        totalHours: (acc[delay.delayType]?.totalHours || 0) + (delay.durationHours || 0),
      };
      return acc;
    },
    {},
  );

  return {
    delays,
    summary: {
      totalDelays: delays.length,
      totalHours: delays.reduce((sum, delay) => sum + (delay.durationHours || 0), 0),
      byType,
    },
  };
}

async function mockSeededDelayRegisterApi(page: Page, options: SeededDelayRegisterOptions = {}) {
  let delayLoadCount = 0;
  let exportUrl: string | null = null;

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

    if (url.pathname === `/api/projects/${E2E_PROJECT_ID}`) {
      await json({
        project: {
          id: E2E_PROJECT_ID,
          name: 'E2E Highway Upgrade',
          projectNumber: 'E2E-001',
        },
      });
      return;
    }

    if (url.pathname === `/api/diary/project/${E2E_PROJECT_ID}/delays`) {
      delayLoadCount += 1;
      if (delayLoadCount <= (options.failDelayLoadsUntil ?? 0)) {
        await json({ message: 'Delay register unavailable' }, 500);
        return;
      }

      await json(buildDelayResponse(url.searchParams.get('delayType')));
      return;
    }

    if (url.pathname === `/api/diary/project/${E2E_PROJECT_ID}/delays/export`) {
      exportUrl = url.toString();
      await route.fulfill({
        status: 200,
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': 'attachment; filename="unsafe:delay-register?.csv"',
          'access-control-expose-headers': 'Content-Disposition',
        },
        body: 'Date,Type,Duration,Description\n2026-01-15,weather,1.5,Wet weather shutdown\n',
      });
      return;
    }

    await json({ message: `Unhandled E2E API route: ${url.pathname}` }, 404);
  });

  await mockAuthenticatedUserState(page);

  return {
    getDelayLoadCount: () => delayLoadCount,
    getExportUrl: () => exportUrl,
  };
}

test.describe('Delay register seeded contract', () => {
  test('renders, filters, and exports the seeded delay register', async ({ page }) => {
    const api = await mockSeededDelayRegisterApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/delays`);

    await expect(page.getByRole('heading', { name: 'Delay Register' })).toBeVisible();
    await expect(page.getByText('Total Delays')).toBeVisible();
    await expect(page.getByText('Total Hours Lost')).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Wet weather shutdown' })).toBeVisible();
    await expect(
      page.getByRole('row').filter({ hasText: 'Excavator hydraulic fault' }),
    ).toBeVisible();

    await page.locator('select').first().selectOption('weather');

    await expect(page.getByRole('row').filter({ hasText: 'Wet weather shutdown' })).toBeVisible();
    await expect(
      page.getByRole('row').filter({ hasText: 'Excavator hydraulic fault' }),
    ).toHaveCount(0);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export to Excel (CSV)' }).click(),
    ]);

    expect(download.suggestedFilename()).toBe('unsafe-delay-register-.csv');
    expect(api.getExportUrl()).toContain('delayType=weather');
  });

  test('shows a retryable load error without rendering a false empty state', async ({ page }) => {
    const api = await mockSeededDelayRegisterApi(page, { failDelayLoadsUntil: 2 });

    await page.goto(`/projects/${E2E_PROJECT_ID}/delays`);

    await expect(page.getByRole('alert')).toContainText('Delay register unavailable');
    await expect(page.getByText(/No delays found/)).toHaveCount(0);

    await page.getByRole('button', { name: 'Try again' }).click();

    await expect.poll(() => api.getDelayLoadCount()).toBeGreaterThan(2);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('row').filter({ hasText: 'Wet weather shutdown' })).toBeVisible();
  });
});
