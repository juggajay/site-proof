import { test, expect, type Page } from '@playwright/test';
import { E2E_ADMIN_USER, E2E_PROJECT_ID, mockAuthenticatedUserState } from './helpers';

const E2E_DIARY_DATE = '2026-01-15';
const E2E_DIARY_ID = 'e2e-diary';

type SeededDiaryApiOptions = {
  failDiaryLoadsUntil?: number;
  submitDelayMs?: number;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function buildDiary(status: 'draft' | 'submitted' = 'draft', date = E2E_DIARY_DATE) {
  return {
    id: E2E_DIARY_ID,
    projectId: E2E_PROJECT_ID,
    date: `${date}T00:00:00.000Z`,
    status,
    weatherConditions: 'Fine',
    temperatureMin: 16,
    temperatureMax: 27,
    rainfallMm: 0,
    weatherNotes: 'Light breeze',
    generalNotes: '<p>E2E seeded diary notes</p>',
    personnel: [
      {
        id: 'e2e-personnel',
        name: 'E2E Foreman',
        company: 'E2E Civil Pty Ltd',
        role: 'Foreman',
        startTime: '07:00',
        finishTime: '15:00',
        hours: 8,
        createdAt: `${date}T00:00:00.000Z`,
      },
    ],
    plant: [
      {
        id: 'e2e-plant',
        description: 'E2E Excavator',
        idRego: 'EX-001',
        company: 'E2E Plant Hire',
        hoursOperated: 5,
        notes: 'Trim work',
        createdAt: `${date}T00:00:00.000Z`,
      },
    ],
    activities: [
      {
        id: 'e2e-activity',
        description: 'Trim formation',
        lotId: 'e2e-lot',
        lot: { id: 'e2e-lot', lotNumber: 'LOT-001' },
        quantity: 120,
        unit: 'm2',
        notes: 'Ready for hold point',
        createdAt: `${date}T00:00:00.000Z`,
      },
    ],
    delays: [
      {
        id: 'e2e-delay',
        delayType: 'weather',
        startTime: '12:00',
        endTime: '13:00',
        durationHours: 1,
        description: 'Short rain delay',
        impact: 'Crew stood down',
        createdAt: `${date}T00:00:00.000Z`,
      },
    ],
    deliveries: [],
    events: [],
    submittedBy:
      status === 'submitted'
        ? { id: E2E_ADMIN_USER.id, fullName: E2E_ADMIN_USER.fullName, email: E2E_ADMIN_USER.email }
        : undefined,
    submittedAt: status === 'submitted' ? `${date}T06:00:00.000Z` : undefined,
    createdAt: `${date}T00:00:00.000Z`,
    updatedAt: `${date}T00:00:00.000Z`,
  };
}

async function mockSeededDiaryApi(page: Page, options: SeededDiaryApiOptions = {}) {
  let submitted = false;
  let diaryLoadCount = 0;
  let submitRequestCount = 0;
  let submitRequest: unknown;
  let weatherSaveRequest: unknown;
  let activityCreateRequest: unknown;
  let plantCreateRequest: unknown;
  let delayCreateRequest: unknown;

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

    if (url.pathname === '/api/lots' && url.searchParams.get('projectId') === E2E_PROJECT_ID) {
      await json({
        lots: [
          {
            id: 'e2e-lot',
            lotNumber: 'LOT-001',
          },
        ],
      });
      return;
    }

    if (url.pathname === `/api/diary/${E2E_PROJECT_ID}`) {
      if (url.searchParams.get('search')) {
        await json([buildDiary(submitted ? 'submitted' : 'draft')]);
        return;
      }

      await json({ data: [buildDiary(submitted ? 'submitted' : 'draft')] });
      return;
    }

    const diaryDateMatch = url.pathname.match(
      new RegExp(`^/api/diary/${E2E_PROJECT_ID}/(\\d{4}-\\d{2}-\\d{2})$`),
    );
    if (diaryDateMatch) {
      diaryLoadCount += 1;
      if (diaryLoadCount <= (options.failDiaryLoadsUntil ?? 0)) {
        await json({ message: 'Unable to load diary for this date' }, 500);
        return;
      }

      await json(buildDiary(submitted ? 'submitted' : 'draft', diaryDateMatch[1]));
      return;
    }

    if (url.pathname.startsWith(`/api/diary/${E2E_PROJECT_ID}/weather/`)) {
      await json({
        weatherConditions: 'Fine',
        temperatureMin: 16,
        temperatureMax: 27,
        rainfallMm: 0,
        source: 'E2E weather service',
        location: { fromProjectState: false },
      });
      return;
    }

    if (url.pathname === '/api/diary' && route.request().method() === 'POST') {
      weatherSaveRequest = route.request().postDataJSON();
      await json({
        ...buildDiary(submitted ? 'submitted' : 'draft'),
        ...(weatherSaveRequest as object),
        date: `${E2E_DIARY_DATE}T00:00:00.000Z`,
      });
      return;
    }

    if (
      url.pathname === `/api/diary/${E2E_DIARY_ID}/activities` &&
      route.request().method() === 'POST'
    ) {
      activityCreateRequest = route.request().postDataJSON();
      await json(
        {
          id: 'e2e-new-activity',
          ...(activityCreateRequest as object),
          createdAt: `${E2E_DIARY_DATE}T01:00:00.000Z`,
        },
        201,
      );
      return;
    }

    if (
      url.pathname === `/api/diary/${E2E_DIARY_ID}/plant` &&
      route.request().method() === 'POST'
    ) {
      plantCreateRequest = route.request().postDataJSON();
      await json(
        {
          id: 'e2e-new-plant',
          ...(plantCreateRequest as object),
          createdAt: `${E2E_DIARY_DATE}T01:00:00.000Z`,
        },
        201,
      );
      return;
    }

    if (
      url.pathname === `/api/diary/${E2E_DIARY_ID}/delays` &&
      route.request().method() === 'POST'
    ) {
      delayCreateRequest = route.request().postDataJSON();
      await json(
        {
          id: 'e2e-new-delay',
          ...(delayCreateRequest as object),
          createdAt: `${E2E_DIARY_DATE}T01:00:00.000Z`,
        },
        201,
      );
      return;
    }

    if (url.pathname === `/api/diary/${E2E_DIARY_ID}/submit`) {
      submitRequestCount += 1;
      submitRequest = route.request().postDataJSON();
      if (options.submitDelayMs) {
        await delay(options.submitDelayMs);
      }
      submitted = true;
      await json({ diary: buildDiary('submitted') });
      return;
    }

    if (url.pathname === `/api/diary/${E2E_DIARY_ID}/addendums`) {
      await json([]);
      return;
    }

    await json({ message: `Unhandled E2E API route: ${url.pathname}` }, 404);
  });

  await mockAuthenticatedUserState(page);

  return {
    getDiaryLoadCount: () => diaryLoadCount,
    getSubmitRequest: () => submitRequest,
    getSubmitRequestCount: () => submitRequestCount,
    getWeatherSaveRequest: () => weatherSaveRequest,
    getActivityCreateRequest: () => activityCreateRequest,
    getPlantCreateRequest: () => plantCreateRequest,
    getDelayCreateRequest: () => delayCreateRequest,
  };
}

test.describe('Daily diary seeded UI contract', () => {
  test('renders the seeded diary across desktop tabs with hard assertions', async ({ page }) => {
    await mockSeededDiaryApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/diary`);
    await page.locator('#diary-date').fill(E2E_DIARY_DATE);

    await expect(page.getByRole('heading', { name: 'Daily Diary' })).toBeVisible();
    await expect(page.getByText('Draft', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Weather & General Notes' })).toBeVisible();
    await expect(page.locator('select').first()).toHaveValue('Fine');
    await expect(page.locator('input[placeholder="e.g. 15"]')).toHaveValue('16');
    await expect(page.locator('input[placeholder="e.g. 28"]')).toHaveValue('27');

    const tabNav = page.locator('nav');

    await tabNav.getByRole('button', { name: /personnel/i }).click();
    const personnelRow = page.getByRole('row').filter({ hasText: 'E2E Foreman' });
    await expect(personnelRow).toBeVisible();
    await expect(personnelRow.getByText('E2E Civil Pty Ltd')).toBeVisible();
    await expect(personnelRow.getByRole('cell', { name: 'Foreman', exact: true })).toBeVisible();
    await expect(page.getByText('1 people,')).toBeVisible();

    await tabNav.getByRole('button', { name: /plant/i }).click();
    const plantRow = page.getByRole('row').filter({ hasText: 'E2E Excavator' });
    await expect(plantRow).toBeVisible();
    await expect(plantRow.getByText('EX-001')).toBeVisible();
    await expect(plantRow.getByText('E2E Plant Hire')).toBeVisible();

    await tabNav.getByRole('button', { name: /activities/i }).click();
    const activityRow = page.getByRole('row').filter({ hasText: 'Trim formation' });
    await expect(activityRow).toBeVisible();
    await expect(activityRow.getByRole('link', { name: 'LOT-001' })).toBeVisible();
    await expect(activityRow.getByText('120')).toBeVisible();
    await expect(activityRow.getByText('Ready for hold point')).toBeVisible();

    await tabNav.getByRole('button', { name: /delays/i }).click();
    const delayRow = page.getByRole('row').filter({ hasText: 'Short rain delay' });
    await expect(delayRow).toBeVisible();
    await expect(delayRow.getByText('weather')).toBeVisible();
    await expect(delayRow.getByText('1h')).toBeVisible();
    await expect(delayRow.getByText('Crew stood down')).toBeVisible();
  });

  test('shows a retryable load error without rendering a false empty state', async ({ page }) => {
    const api = await mockSeededDiaryApi(page, { failDiaryLoadsUntil: 2 });

    await page.goto(`/projects/${E2E_PROJECT_ID}/diary`);

    await expect(page.getByRole('alert')).toContainText('Unable to load diary for this date');
    await expect(page.getByText(/No diary entry for/)).toHaveCount(0);

    await page.getByRole('button', { name: 'Try again' }).click();

    await expect.poll(() => api.getDiaryLoadCount()).toBeGreaterThan(2);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Weather & General Notes' })).toBeVisible();
  });

  test('ignores duplicate submit confirmations while the request is in flight', async ({
    page,
  }) => {
    const api = await mockSeededDiaryApi(page, { submitDelayMs: 250 });

    await page.goto(`/projects/${E2E_PROJECT_ID}/diary`);
    await page.locator('#diary-date').fill(E2E_DIARY_DATE);

    await page.getByRole('button', { name: 'Submit Diary' }).click();

    const modal = page.locator('.fixed').filter({ hasText: 'Submit Daily Diary?' }).first();
    await expect(
      modal.getByText('Once submitted, this diary entry cannot be edited.'),
    ).toBeVisible();

    const confirmButton = modal.getByRole('button', { name: 'Confirm Submit' });
    await confirmButton.evaluate((button: HTMLElement) => {
      button.click();
      button.click();
    });

    await expect.poll(() => api.getSubmitRequestCount()).toBe(1);
    expect(api.getSubmitRequest()).toMatchObject({ acknowledgeWarnings: true });
    await expect(
      page
        .locator('span')
        .filter({ hasText: /^Submitted$/ })
        .first(),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Submit Diary' })).toHaveCount(0);
  });

  test('rejects encoded numeric diary inputs before sending requests', async ({ page }) => {
    const api = await mockSeededDiaryApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/diary`);
    await page.locator('#diary-date').fill(E2E_DIARY_DATE);

    await page.locator('input[placeholder="e.g. 15"]').fill('1e2');
    await expect(
      page.getByText('Min temp must be a decimal number between -80 and 80.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Update Weather Info' })).toBeDisabled();
    expect(api.getWeatherSaveRequest()).toBeUndefined();

    await page.locator('input[placeholder="e.g. 15"]').fill('15.5');
    await page.getByRole('button', { name: 'Update Weather Info' }).click();
    await expect.poll(() => api.getWeatherSaveRequest()).toMatchObject({ temperatureMin: 15.5 });

    const tabNav = page.locator('nav');
    await tabNav.getByRole('button', { name: /activities/i }).click();
    await page.getByPlaceholder('Description *').fill('Encoded quantity check');
    await page.getByPlaceholder('Quantity').fill('1e2');
    await expect(page.getByText('Quantity must be a non-negative decimal number.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add' })).toBeDisabled();
    expect(api.getActivityCreateRequest()).toBeUndefined();

    await page.getByPlaceholder('Quantity').fill('12.5');
    await page.getByRole('button', { name: 'Add' }).click();
    await expect.poll(() => api.getActivityCreateRequest()).toMatchObject({ quantity: 12.5 });

    await tabNav.getByRole('button', { name: /plant/i }).click();
    await page.getByPlaceholder('Description *').fill('Encoded plant hours check');
    await page.getByPlaceholder('Hours').fill('1e2');
    await expect(page.getByText('Hours must be greater than 0 and no more than 24.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add' })).toBeDisabled();
    expect(api.getPlantCreateRequest()).toBeUndefined();

    await page.getByPlaceholder('Hours').fill('6.5');
    await page.getByRole('button', { name: 'Add' }).click();
    await expect.poll(() => api.getPlantCreateRequest()).toMatchObject({ hoursOperated: 6.5 });

    await tabNav.getByRole('button', { name: /delays/i }).click();
    await page.locator('select').selectOption('Weather');
    await page.getByPlaceholder('Description *').fill('Encoded delay duration check');
    await page.getByPlaceholder('Duration (hours)').fill('1e2');
    await expect(page.getByText('Hours must be greater than 0 and no more than 24.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add' })).toBeDisabled();
    expect(api.getDelayCreateRequest()).toBeUndefined();

    await page.getByPlaceholder('Duration (hours)').fill('1.5');
    await page.getByRole('button', { name: 'Add' }).click();
    await expect.poll(() => api.getDelayCreateRequest()).toMatchObject({ durationHours: 1.5 });
  });
});
