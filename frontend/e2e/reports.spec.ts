import { test, expect, type Page } from '@playwright/test';
import { E2E_ADMIN_USER, E2E_PROJECT_ID, mockAuthenticatedUserState } from './helpers';

type ScheduledReport = {
  id: string;
  reportType: string;
  frequency: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  timeOfDay: string;
  recipients: string;
  isActive: boolean;
  nextRunAt: string | null;
  lastSentAt: string | null;
};

type ReportsApiOptions = {
  failLotStatusUntil?: number;
  failSchedulesUntil?: number;
  createScheduleDelayMs?: number;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function lotStatusReport() {
  return {
    generatedAt: '2026-05-09T01:00:00.000Z',
    projectId: E2E_PROJECT_ID,
    totalLots: 2,
    statusCounts: { conformed: 1, in_progress: 1 },
    activityCounts: { Earthworks: 1, Drainage: 1 },
    lots: [
      {
        id: 'e2e-report-lot-1',
        lotNumber: 'LOT-RPT-001',
        description: 'Report lot one',
        status: 'conformed',
        activityType: 'Earthworks',
        chainageStart: 100,
        chainageEnd: 150,
        offset: 'LHS',
        layer: 'Base',
        areaZone: 'Zone A',
        createdAt: '2026-05-01T00:00:00.000Z',
        conformedAt: '2026-05-05T00:00:00.000Z',
      },
      {
        id: 'e2e-report-lot-2',
        lotNumber: 'LOT-RPT-002',
        description: 'Report lot two',
        status: 'in_progress',
        activityType: 'Drainage',
        chainageStart: 200,
        chainageEnd: 240,
        offset: 'RHS',
        layer: null,
        areaZone: 'Zone B',
        createdAt: '2026-05-02T00:00:00.000Z',
        conformedAt: null,
      },
    ],
    summary: {
      notStarted: 0,
      inProgress: 1,
      awaitingTest: 0,
      holdPoint: 0,
      ncrRaised: 0,
      conformed: 1,
      claimed: 0,
    },
    periodComparison: {
      conformedThisPeriod: 1,
      conformedLastPeriod: 0,
      periodChange: 1,
      periodChangePercent: '100',
      currentPeriodLabel: 'May 2026',
      previousPeriodLabel: 'Apr 2026',
    },
  };
}

function testResultsReport(url: URL) {
  return {
    generatedAt: '2026-05-09T01:00:00.000Z',
    projectId: E2E_PROJECT_ID,
    totalTests: 1,
    passFailCounts: { pass: 1 },
    testTypeCounts: { Compaction: 1, Concrete: 0 },
    statusCounts: { verified: 1 },
    tests: [
      {
        id: 'e2e-report-test-1',
        testRequestNumber: `TR-${url.searchParams.get('startDate') || 'ALL'}`,
        testType: url.searchParams.get('testTypes') || 'Compaction',
        laboratoryName: 'E2E Lab',
        laboratoryReportNumber: 'LAB-RPT-001',
        sampleDate: '2026-05-01',
        resultDate: '2026-05-02',
        resultValue: 98,
        resultUnit: '%',
        specificationMin: 95,
        specificationMax: null,
        passFail: 'pass',
        status: 'verified',
        lotId: 'e2e-report-lot-1',
      },
    ],
    summary: {
      pass: 1,
      fail: 0,
      pending: 0,
      passRate: '100',
    },
  };
}

function diaryReport(url: URL) {
  const sections = url.searchParams.get('sections')?.split(',').filter(Boolean) || [
    'weather',
    'personnel',
    'plant',
    'activities',
    'delays',
  ];

  return {
    generatedAt: '2026-05-09T01:00:00.000Z',
    projectId: E2E_PROJECT_ID,
    dateRange: {
      startDate: url.searchParams.get('startDate'),
      endDate: url.searchParams.get('endDate'),
    },
    selectedSections: sections,
    totalDiaries: 1,
    submittedCount: 1,
    draftCount: 0,
    diaries: [
      {
        id: 'e2e-diary-report-1',
        date: '2026-05-03',
        status: 'submitted',
        isLate: false,
        submittedBy: { id: E2E_ADMIN_USER.id, fullName: 'E2E Admin', email: E2E_ADMIN_USER.email },
        submittedAt: '2026-05-03T08:00:00.000Z',
        weatherConditions: 'Fine',
        temperatureMin: 14,
        temperatureMax: 24,
        rainfallMm: 0,
        weatherNotes: 'Clear shift',
        generalNotes: 'Diary report note',
        personnel: [
          { id: 'person-1', name: 'E2E Worker', company: 'E2E Civil', role: 'Operator', hours: 8 },
        ],
        plant: [{ id: 'plant-1', description: 'Roller', company: 'E2E Plant', hoursOperated: 7 }],
        activities: [
          {
            id: 'activity-1',
            description: 'Placed base',
            lot: { id: 'lot-1', lotNumber: 'LOT-RPT-001' },
            quantity: 30,
            unit: 'm3',
          },
        ],
        delays: [
          {
            id: 'delay-1',
            delayType: 'weather',
            durationHours: 1,
            description: 'Short weather hold',
          },
        ],
      },
    ],
    summary: {
      weather: { Fine: 1 },
      personnel: {
        totalPersonnel: 1,
        totalHours: 8,
        byCompany: { 'E2E Civil': { count: 1, hours: 8 } },
      },
      plant: {
        totalPlant: 1,
        totalHours: 7,
        byCompany: { 'E2E Plant': { count: 1, hours: 7 } },
      },
      activities: {
        totalActivities: 1,
        byLot: { 'LOT-RPT-001': 1 },
      },
      delays: {
        totalDelays: 1,
        totalHours: 1,
        byType: { weather: { count: 1, hours: 1 } },
      },
    },
  };
}

function ncrReport() {
  return {
    generatedAt: '2026-05-09T01:00:00.000Z',
    projectId: E2E_PROJECT_ID,
    totalNCRs: 1,
    statusCounts: { open: 1 },
    categoryCounts: { workmanship: 1 },
    rootCauseCounts: { process: 1 },
    responsiblePartyCounts: { contractor: 1 },
    overdueCount: 0,
    closedThisMonth: 0,
    averageClosureTime: 0,
    closureRate: '0',
    ncrs: [
      {
        id: 'e2e-report-ncr-1',
        ncrNumber: 'NCR-RPT-001',
        description: 'Report NCR',
        category: 'workmanship',
        status: 'open',
        raisedAt: '2026-05-04T00:00:00.000Z',
        closedAt: null,
        dueDate: '2026-05-11T00:00:00.000Z',
        rootCauseCategory: 'process',
      },
    ],
    summary: {
      open: 1,
      investigating: 0,
      rectification: 0,
      verification: 0,
      closed: 0,
      closedConcession: 0,
      minor: 1,
      major: 0,
    },
  };
}

async function mockReportsApi(page: Page, options: ReportsApiOptions = {}) {
  const reportRequests: string[] = [];
  const createScheduleRequests: unknown[] = [];
  let updateScheduleRequest: unknown;
  let deleteScheduleId: string | null = null;
  let lotStatusRequestCount = 0;
  let scheduleLoadCount = 0;
  const schedules: ScheduledReport[] = [
    {
      id: 'e2e-schedule-existing',
      reportType: 'lot-status',
      frequency: 'weekly',
      dayOfWeek: 1,
      dayOfMonth: null,
      timeOfDay: '09:00',
      recipients: 'quality@example.com',
      isActive: true,
      nextRunAt: '2026-05-11T09:00:00.000Z',
      lastSentAt: null,
    },
  ];

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

    if (url.pathname === '/api/company') {
      await json({
        company: {
          subscriptionTier: 'professional',
          name: 'E2E Contractor',
          logoUrl: null,
        },
      });
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

    if (url.pathname === '/api/reports/lot-status') {
      reportRequests.push(`${url.pathname}?${url.searchParams.toString()}`);
      lotStatusRequestCount += 1;
      if (lotStatusRequestCount <= (options.failLotStatusUntil ?? 0)) {
        await json({ message: 'Lot report unavailable' }, 500);
        return;
      }
      await json(lotStatusReport());
      return;
    }

    if (url.pathname === '/api/reports/ncr') {
      reportRequests.push(`${url.pathname}?${url.searchParams.toString()}`);
      await json(ncrReport());
      return;
    }

    if (url.pathname === '/api/reports/test') {
      reportRequests.push(`${url.pathname}?${url.searchParams.toString()}`);
      await json(testResultsReport(url));
      return;
    }

    if (url.pathname === '/api/reports/diary') {
      reportRequests.push(`${url.pathname}?${url.searchParams.toString()}`);
      await json(diaryReport(url));
      return;
    }

    if (url.pathname === '/api/reports/schedules' && route.request().method() === 'GET') {
      scheduleLoadCount += 1;
      if (scheduleLoadCount <= (options.failSchedulesUntil ?? 0)) {
        await json({ message: 'Schedule service unavailable' }, 500);
        return;
      }
      await json({ schedules });
      return;
    }

    if (url.pathname === '/api/reports/schedules' && route.request().method() === 'POST') {
      createScheduleRequests.push(route.request().postDataJSON());
      if (options.createScheduleDelayMs) {
        await delay(options.createScheduleDelayMs);
      }
      const body = createScheduleRequests.at(-1) as {
        reportType: string;
        frequency: string;
        dayOfWeek: number | null;
        dayOfMonth: number | null;
        timeOfDay: string;
        recipients: string[];
      };
      const created: ScheduledReport = {
        id: 'e2e-schedule-created',
        reportType: body.reportType,
        frequency: body.frequency,
        dayOfWeek: body.dayOfWeek,
        dayOfMonth: body.dayOfMonth,
        timeOfDay: body.timeOfDay,
        recipients: body.recipients.join(','),
        isActive: true,
        nextRunAt: '2026-05-12T06:30:00.000Z',
        lastSentAt: null,
      };
      schedules.unshift(created);
      await json({ schedule: created }, 201);
      return;
    }

    if (
      url.pathname === '/api/reports/schedules/e2e-schedule-existing' &&
      route.request().method() === 'PUT'
    ) {
      updateScheduleRequest = route.request().postDataJSON();
      schedules[0].isActive = Boolean((updateScheduleRequest as { isActive?: boolean }).isActive);
      await json({ schedule: schedules[0] });
      return;
    }

    if (
      url.pathname === '/api/reports/schedules/e2e-schedule-created' &&
      route.request().method() === 'DELETE'
    ) {
      deleteScheduleId = 'e2e-schedule-created';
      const index = schedules.findIndex((schedule) => schedule.id === deleteScheduleId);
      if (index >= 0) {
        schedules.splice(index, 1);
      }
      await json({ message: 'Deleted' });
      return;
    }

    await json({ message: `Unhandled E2E API route: ${url.pathname}` }, 404);
  });

  await mockAuthenticatedUserState(page);

  return {
    getReportRequests: () => reportRequests,
    getCreateScheduleRequest: () => createScheduleRequests.at(-1),
    getCreateScheduleRequests: () => createScheduleRequests,
    getUpdateScheduleRequest: () => updateScheduleRequest,
    getDeleteScheduleId: () => deleteScheduleId,
    getLotStatusRequestCount: () => lotStatusRequestCount,
    getScheduleLoadCount: () => scheduleLoadCount,
  };
}

test.describe('Reports seeded analytics contract', () => {
  test('renders reports, applies filters, and manages scheduled report emails', async ({
    page,
  }) => {
    const api = await mockReportsApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/reports`);

    await expect(page.getByRole('heading', { name: 'Reports & Analytics' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Lot Status' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByText('Total Lots: 2')).toBeVisible();
    await expect(page.getByText('LOT-RPT-001')).toBeVisible();

    await page.getByRole('tab', { name: 'Test Results' }).click();
    await expect(page.getByText('Total Tests')).toBeVisible();
    await page.getByLabel('Test report start date').fill('2026-05-01');
    await page.getByLabel('Test report end date').fill('2026-05-09');
    await page.getByRole('button', { name: 'Compaction' }).click();
    await page.getByRole('button', { name: 'Generate Report' }).click();
    await expect(page.getByText('TR-2026-05-01')).toBeVisible();
    await expect
      .poll(() => api.getReportRequests())
      .toContain(
        '/api/reports/test?projectId=e2e-project&startDate=2026-05-01&endDate=2026-05-09&testTypes=Compaction',
      );

    await page.getByRole('tab', { name: 'Diary Report' }).click();
    await expect(page.getByText('Total Diaries')).toBeVisible();
    await page.getByLabel('Diary report start date').fill('2026-05-03');
    await page.getByLabel('Diary report end date').fill('2026-05-04');
    await page.getByRole('button', { name: 'Delays' }).click();
    await page.getByRole('button', { name: 'Generate Report' }).click();
    await expect(page.getByText('Weather Summary')).toBeVisible();
    await expect(page.getByText('Fine:')).toBeVisible();
    await expect
      .poll(() => api.getReportRequests())
      .toContain(
        '/api/reports/diary?projectId=e2e-project&sections=weather%2Cpersonnel%2Cplant%2Cactivities&startDate=2026-05-03&endDate=2026-05-04',
      );

    await page.getByRole('button', { name: 'Schedule Reports' }).click();
    const scheduleDialog = page.getByRole('dialog').filter({ hasText: 'Schedule Email Reports' });
    await expect(
      scheduleDialog.getByText('Create and manage automatic report emails for this project.'),
    ).toBeVisible();
    await expect(scheduleDialog.getByText('Lot Status Report')).toBeVisible();
    await expect(scheduleDialog.getByText('Weekly on Monday at 09:00')).toBeVisible();

    await scheduleDialog.getByRole('button', { name: '+ New Schedule' }).click();
    await scheduleDialog.getByLabel('Report Type').selectOption('diary');
    await scheduleDialog.getByLabel('Frequency').selectOption('daily');
    await scheduleDialog.getByLabel('Time').fill('06:30');
    await scheduleDialog
      .getByLabel('Recipients (comma-separated emails)')
      .fill('reports@example.com; Reports@example.com, qa@example.com');
    await scheduleDialog.getByRole('button', { name: 'Create Schedule' }).click();

    await expect(page.getByText('The report schedule was saved.')).toBeVisible();
    expect(api.getCreateScheduleRequest()).toMatchObject({
      projectId: E2E_PROJECT_ID,
      reportType: 'diary',
      frequency: 'daily',
      timeOfDay: '06:30',
      recipients: ['reports@example.com', 'qa@example.com'],
    });
    await expect(scheduleDialog.getByText('Daily Diary Report')).toBeVisible();
    await expect(scheduleDialog.getByText('Daily at 06:30')).toBeVisible();

    const existingSchedule = scheduleDialog
      .locator('.rounded-lg')
      .filter({ hasText: 'Lot Status Report' })
      .first();
    await existingSchedule.getByRole('button', { name: 'Pause' }).click();
    await expect.poll(() => api.getUpdateScheduleRequest()).toMatchObject({ isActive: false });
    await expect(page.getByText('The scheduled report was updated.')).toBeVisible();

    const createdSchedule = scheduleDialog
      .locator('.rounded-lg')
      .filter({ hasText: 'Daily Diary Report' })
      .first();
    await createdSchedule.getByRole('button', { name: 'Delete' }).click();
    const deleteDialog = page
      .getByRole('alertdialog')
      .filter({ hasText: 'Delete Scheduled Report' });
    await expect(
      deleteDialog.getByText('Recipients will no longer receive it automatically.'),
    ).toBeVisible();
    await deleteDialog.getByRole('button', { name: 'Delete' }).click();
    await expect.poll(() => api.getDeleteScheduleId()).toBe('e2e-schedule-created');
    await expect(
      page.getByText('Recipients will no longer receive this report automatically.'),
    ).toBeVisible();
  });

  test('shows a retryable report load error without stale synthetic report content', async ({
    page,
  }) => {
    const api = await mockReportsApi(page, { failLotStatusUntil: 2 });

    await page.goto(`/projects/${E2E_PROJECT_ID}/reports`);

    await expect(page.getByRole('heading', { name: 'Reports & Analytics' })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('Lot report unavailable');
    await expect(page.getByText('Total Lots: 2')).toHaveCount(0);
    await expect(page.getByText('LOT-RPT-001')).toHaveCount(0);

    await page.getByRole('button', { name: 'Refresh Report' }).click();

    await expect.poll(() => api.getLotStatusRequestCount()).toBeGreaterThan(2);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByText('Total Lots: 2')).toBeVisible();
    await expect(page.getByText('LOT-RPT-001')).toBeVisible();
  });

  test('shows a retryable schedule load error instead of a false empty schedule list', async ({
    page,
  }) => {
    const api = await mockReportsApi(page, { failSchedulesUntil: 1 });

    await page.goto(`/projects/${E2E_PROJECT_ID}/reports`);

    await page.getByRole('button', { name: 'Schedule Reports' }).click();
    const scheduleDialog = page.getByRole('dialog').filter({ hasText: 'Schedule Email Reports' });
    await expect(scheduleDialog.getByRole('alert')).toContainText('Schedule service unavailable');
    await expect(scheduleDialog.getByText('No scheduled reports yet')).toHaveCount(0);

    await scheduleDialog.getByRole('button', { name: 'Try again' }).click();

    await expect.poll(() => api.getScheduleLoadCount()).toBeGreaterThan(1);
    await expect(scheduleDialog.getByRole('alert')).toHaveCount(0);
    await expect(scheduleDialog.getByText('Lot Status Report')).toBeVisible();
    await expect(scheduleDialog.getByText('Weekly on Monday at 09:00')).toBeVisible();
  });

  test('ignores duplicate schedule creation while the request is in flight', async ({ page }) => {
    const api = await mockReportsApi(page, { createScheduleDelayMs: 250 });

    await page.goto(`/projects/${E2E_PROJECT_ID}/reports`);

    await page.getByRole('button', { name: 'Schedule Reports' }).click();
    const scheduleDialog = page.getByRole('dialog').filter({ hasText: 'Schedule Email Reports' });
    await expect(scheduleDialog.getByText('Lot Status Report')).toBeVisible();

    await scheduleDialog.getByRole('button', { name: '+ New Schedule' }).click();
    await scheduleDialog.getByLabel('Report Type').selectOption('diary');
    await scheduleDialog.getByLabel('Frequency').selectOption('daily');
    await scheduleDialog.getByLabel('Time').fill('06:30');
    await scheduleDialog
      .getByLabel('Recipients (comma-separated emails)')
      .fill('reports@example.com, qa@example.com');

    await scheduleDialog
      .getByRole('button', { name: 'Create Schedule' })
      .evaluate((button: HTMLElement) => {
        button.click();
        button.click();
      });

    await expect(page.getByText('The report schedule was saved.')).toBeVisible();
    expect(api.getCreateScheduleRequests()).toHaveLength(1);
    expect(api.getCreateScheduleRequest()).toMatchObject({
      projectId: E2E_PROJECT_ID,
      reportType: 'diary',
      frequency: 'daily',
      timeOfDay: '06:30',
      recipients: ['reports@example.com', 'qa@example.com'],
    });
  });
});
