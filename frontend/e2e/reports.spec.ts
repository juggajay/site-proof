import { test, expect, type Locator, type Page, type Route } from '@playwright/test';
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
  failureCount?: number;
  lastFailureAt?: string | null;
  lastFailureReason?: string | null;
};

type ReportsApiOptions = {
  failLotStatusUntil?: number;
  failSchedulesUntil?: number;
  createScheduleDelayMs?: number;
  updateScheduleDelayMs?: number;
  deleteScheduleDelayMs?: number;
  companyTier?: string;
  user?: typeof E2E_ADMIN_USER;
  projectCurrentUserRole?: string | null;
  includeFailurePausedSchedule?: boolean;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function openScheduleDialog(page: Page) {
  await page.getByRole('button', { name: 'Schedule Reports' }).click();
  const scheduleDialog = page.getByRole('dialog').filter({ hasText: 'Schedule Email Reports' });
  await expect(scheduleDialog).toBeVisible();
  return scheduleDialog;
}

async function startDiarySchedule(scheduleDialog: Locator, frequency: 'daily' | 'monthly') {
  await expect(scheduleDialog.getByText('Lot Status Report')).toBeVisible();
  await scheduleDialog.getByRole('button', { name: '+ New Schedule' }).click();
  await scheduleDialog.getByLabel('Report Type').selectOption('diary');
  await scheduleDialog.getByLabel('Frequency').selectOption(frequency);
}

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

function claimsReport() {
  return {
    generatedAt: '2026-05-09T01:00:00.000Z',
    projectId: E2E_PROJECT_ID,
    dateRange: { startDate: null, endDate: null },
    totalClaims: 2,
    statusCounts: { certified: 1, paid: 1 },
    financialSummary: {
      totalClaimed: 180000,
      totalCertified: 160000,
      totalPaid: 90000,
      outstanding: 70000,
      certificationRate: '88.9',
      collectionRate: '56.3',
      totalLots: 5,
    },
    monthlyBreakdown: [
      {
        month: '2026-05',
        claimed: 180000,
        certified: 160000,
        paid: 90000,
        count: 2,
        variance: 20000,
      },
    ],
    claims: [
      {
        id: 'e2e-report-claim-8',
        claimNumber: 8,
        periodStart: '2026-05-01',
        periodEnd: '2026-05-31',
        status: 'certified',
        totalClaimedAmount: 120000,
        certifiedAmount: 100000,
        paidAmount: 30000,
        variance: 20000,
        outstanding: 70000,
        submittedAt: '2026-05-10',
        certifiedAt: '2026-05-12',
        paidAt: null,
        paymentReference: null,
        lotCount: 3,
        lots: [],
        preparedBy: { name: 'E2E Admin', email: E2E_ADMIN_USER.email },
        preparedAt: '2026-05-09',
      },
      {
        id: 'e2e-report-claim-7',
        claimNumber: 7,
        periodStart: '2026-04-01',
        periodEnd: '2026-04-30',
        status: 'paid',
        totalClaimedAmount: 60000,
        certifiedAmount: 60000,
        paidAmount: 60000,
        variance: 0,
        outstanding: 0,
        submittedAt: '2026-04-10',
        certifiedAt: '2026-04-12',
        paidAt: '2026-04-20',
        paymentReference: 'PAY-7',
        lotCount: 2,
        lots: [],
        preparedBy: { name: 'E2E Admin', email: E2E_ADMIN_USER.email },
        preparedAt: '2026-04-09',
      },
    ],
    exportData: [],
  };
}

async function mockReportsApi(page: Page, options: ReportsApiOptions = {}) {
  const reportRequests: string[] = [];
  const createScheduleRequests: unknown[] = [];
  const updateScheduleRequests: unknown[] = [];
  const deleteScheduleRequests: string[] = [];
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
  if (options.includeFailurePausedSchedule) {
    schedules.push({
      id: 'e2e-schedule-failed',
      reportType: 'ncr',
      frequency: 'daily',
      dayOfWeek: null,
      dayOfMonth: null,
      timeOfDay: '07:00',
      recipients: 'bad-recipient@example.com',
      isActive: false,
      nextRunAt: null,
      lastSentAt: null,
      failureCount: 3,
      lastFailureAt: '2026-05-10T07:00:00.000Z',
      lastFailureReason: 'Scheduled report recipients must contain valid email addresses',
    });
  }

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

    if (url.pathname === '/api/company') {
      await json({
        company: {
          subscriptionTier: options.companyTier ?? 'professional',
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
          currentUserRole: options.projectCurrentUserRole,
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

    if (url.pathname === '/api/reports/claims') {
      reportRequests.push(`${url.pathname}?${url.searchParams.toString()}`);
      await json(claimsReport());
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
      updateScheduleRequests.push(updateScheduleRequest);
      if (options.updateScheduleDelayMs) {
        await delay(options.updateScheduleDelayMs);
      }
      schedules[0].isActive = Boolean((updateScheduleRequest as { isActive?: boolean }).isActive);
      await json({ schedule: schedules[0] });
      return;
    }

    if (
      url.pathname.startsWith('/api/reports/schedules/') &&
      route.request().method() === 'DELETE'
    ) {
      deleteScheduleId = decodeURIComponent(url.pathname.replace('/api/reports/schedules/', ''));
      deleteScheduleRequests.push(deleteScheduleId);
      if (options.deleteScheduleDelayMs) {
        await delay(options.deleteScheduleDelayMs);
      }
      const index = schedules.findIndex((schedule) => schedule.id === deleteScheduleId);
      if (index >= 0) {
        schedules.splice(index, 1);
      }
      await json({ message: 'Deleted' });
      return;
    }

    await json({ message: `Unhandled E2E API route: ${url.pathname}` }, 404);
  });

  await mockAuthenticatedUserState(page, options.user ?? E2E_ADMIN_USER);

  return {
    getReportRequests: () => reportRequests,
    getCreateScheduleRequest: () => createScheduleRequests.at(-1),
    getCreateScheduleRequests: () => createScheduleRequests,
    getUpdateScheduleRequest: () => updateScheduleRequest,
    getUpdateScheduleRequests: () => updateScheduleRequests,
    getDeleteScheduleId: () => deleteScheduleId,
    getDeleteScheduleRequests: () => deleteScheduleRequests,
    getLotStatusRequestCount: () => lotStatusRequestCount,
    getScheduleLoadCount: () => scheduleLoadCount,
  };
}

async function mockScheduledReportArtifactApi(
  page: Page,
  artifactHandler: (route: Route) => Promise<void>,
) {
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

    if (url.pathname === '/api/reports/scheduled-runs/e2e-run/artifact') {
      await artifactHandler(route);
      return;
    }

    await json({ message: `Unhandled E2E API route: ${url.pathname}` }, 404);
  });

  await mockAuthenticatedUserState(page);
}

async function fulfillScheduledReportPdf(route: Route) {
  await route.fulfill({
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': "attachment; filename*=UTF-8''Lot%20Status%20Report.pdf",
      'access-control-expose-headers': 'Content-Disposition',
    },
    body: '%PDF-1.4\n% scheduled report e2e\n%%EOF',
  });
}

test.describe('Scheduled report artifact link', () => {
  test('auto-downloads the scheduled report artifact once with the server filename', async ({
    page,
  }) => {
    let artifactRequests = 0;
    await mockScheduledReportArtifactApi(page, async (route) => {
      artifactRequests += 1;
      await fulfillScheduledReportPdf(route);
    });

    const downloadPromise = page.waitForEvent('download');
    await page.goto('/reports/scheduled-runs/e2e-run/artifact');
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('Lot Status Report.pdf');
    await expect(page.getByText('Your report download has started.')).toBeVisible();
    expect(artifactRequests).toBe(1);
    await download.delete();
  });

  test('lets users retry a scheduled report artifact after the first download fails', async ({
    page,
  }) => {
    let artifactRequests = 0;
    await mockScheduledReportArtifactApi(page, async (route) => {
      artifactRequests += 1;
      if (artifactRequests === 1) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Artifact unavailable' }),
        });
        return;
      }
      await fulfillScheduledReportPdf(route);
    });

    await page.goto('/reports/scheduled-runs/e2e-run/artifact');

    await expect(page.getByText('Artifact unavailable')).toBeVisible();
    expect(artifactRequests).toBe(1);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Retry download' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('Lot Status Report.pdf');
    await expect(page.getByText('Your report download has started.')).toBeVisible();
    expect(artifactRequests).toBe(2);
    await download.delete();
  });
});

test.describe('Reports seeded analytics contract', () => {
  test('normalizes an invalid reports tab URL back to lot status', async ({ page }) => {
    const api = await mockReportsApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/reports?tab=unknown`);

    await expect(page).toHaveURL(/tab=lot-status/);
    await expect(page.getByRole('tab', { name: 'Lot Status' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByText('LOT-RPT-001')).toBeVisible();
    expect(api.getReportRequests()).toContain(
      '/api/reports/lot-status?projectId=e2e-project&limit=500&page=1',
    );
  });

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
        '/api/reports/test?projectId=e2e-project&startDate=2026-05-01&endDate=2026-05-09&testTypes=Compaction&limit=500&page=1',
      );
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page.getByLabel('Test report start date')).toHaveValue('');
    await expect(page.getByLabel('Test report end date')).toHaveValue('');
    await expect(page.getByText('TR-ALL')).toBeVisible();
    await expect
      .poll(() => api.getReportRequests())
      .toContain('/api/reports/test?projectId=e2e-project&limit=500&page=1');

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
        '/api/reports/diary?projectId=e2e-project&sections=weather%2Cpersonnel%2Cplant%2Cactivities&startDate=2026-05-03&endDate=2026-05-04&limit=500&page=1',
      );

    await page.getByRole('tab', { name: 'Claims' }).click();
    await expect(page.getByText('Total Claimed')).toBeVisible();
    await expect(page.getByText('$180,000', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Claim 8')).toBeVisible();
    const claimEightRow = page.getByRole('row').filter({ hasText: 'Claim 8' });
    await expect(claimEightRow).toContainText('Certified');
    await expect(claimEightRow).toContainText('01/05/2026 to 31/05/2026');
    await expect(claimEightRow).toContainText('$70,000');
    await expect
      .poll(() => api.getReportRequests())
      .toContain('/api/reports/claims?projectId=e2e-project');

    await page.getByLabel('Claim report start date').fill('2026-04-01');
    await page.getByLabel('Claim report end date').fill('2026-05-31');
    await page.getByLabel('Status').selectOption('paid');
    await page.getByRole('button', { name: 'Generate Report' }).click();
    await expect
      .poll(() => api.getReportRequests())
      .toContain(
        '/api/reports/claims?projectId=e2e-project&startDate=2026-04-01&endDate=2026-05-31&status=paid',
      );
    const unfilteredClaimRequestsBeforeClear = api
      .getReportRequests()
      .filter((request) => request === '/api/reports/claims?projectId=e2e-project').length;
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page.getByLabel('Claim report start date')).toHaveValue('');
    await expect(page.getByLabel('Claim report end date')).toHaveValue('');
    await expect(page.getByLabel('Status')).toHaveValue('');
    await expect
      .poll(
        () =>
          api
            .getReportRequests()
            .filter((request) => request === '/api/reports/claims?projectId=e2e-project').length,
      )
      .toBeGreaterThan(unfilteredClaimRequestsBeforeClear);

    const scheduleDialog = await openScheduleDialog(page);
    await expect(
      scheduleDialog.getByText('Create and manage automatic report emails for this project.'),
    ).toBeVisible();
    await expect(scheduleDialog.getByText('Lot Status Report')).toBeVisible();
    await expect(scheduleDialog.getByText('Weekly on Monday at 09:00')).toBeVisible();

    await startDiarySchedule(scheduleDialog, 'monthly');
    await expect(scheduleDialog.getByLabel('Day of Month').locator('option')).toHaveCount(31);
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

  test('keeps the mobile reports header compact with visible actions', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockReportsApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/reports`);

    const heading = page.getByRole('heading', { name: 'Reports & Analytics' });
    const scheduleButton = page.getByRole('button', { name: 'Schedule Reports' });
    const refreshButton = page.getByRole('button', { name: 'Refresh Report' });

    await expect(heading).toBeVisible();
    await expect(page.getByText('Total Lots: 2')).toBeVisible();

    const headingBox = await heading.boundingBox();
    const scheduleBox = await scheduleButton.boundingBox();
    const refreshBox = await refreshButton.boundingBox();
    expect(headingBox).toBeTruthy();
    expect(scheduleBox).toBeTruthy();
    expect(refreshBox).toBeTruthy();

    const headingMetrics = await heading.evaluate((element) => {
      const styles = window.getComputedStyle(element);
      return {
        height: element.getBoundingClientRect().height,
        lineHeight: Number.parseFloat(styles.lineHeight),
      };
    });

    expect(headingMetrics.height).toBeLessThanOrEqual(headingMetrics.lineHeight * 1.35);
    expect(scheduleBox!.y).toBeGreaterThan(headingBox!.y + headingBox!.height);
    expect(scheduleBox!.x).toBeGreaterThanOrEqual(0);
    expect(refreshBox!.x + refreshBox!.width).toBeLessThanOrEqual(375);
    expect(Math.abs(scheduleBox!.y - refreshBox!.y)).toBeLessThanOrEqual(2);
  });

  test('does not expose commercial claims or schedule controls to reports viewers', async ({
    page,
  }) => {
    const viewerUser = {
      ...E2E_ADMIN_USER,
      id: 'e2e-viewer-user',
      email: 'viewer@example.com',
      fullName: 'E2E Viewer',
      role: 'viewer',
      roleInCompany: 'viewer',
      dashboardRole: 'viewer' as const,
    };
    const api = await mockReportsApi(page, { user: viewerUser, companyTier: 'professional' });

    await page.goto(`/projects/${E2E_PROJECT_ID}/reports`);

    await expect(page.getByRole('heading', { name: 'Reports & Analytics' })).toBeVisible();
    await expect(page.getByText('Total Lots: 2')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Schedule Reports' })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Claims' })).toHaveCount(0);
    expect(api.getScheduleLoadCount()).toBe(0);
    expect(api.getReportRequests()).not.toContain('/api/reports/claims?projectId=e2e-project');
  });

  test('uses the current project role before exposing commercial reports controls', async ({
    page,
  }) => {
    const mixedRoleUser = {
      ...E2E_ADMIN_USER,
      id: 'e2e-mixed-role-user',
      email: 'mixed-role@example.com',
      fullName: 'E2E Mixed Role',
      role: 'admin',
      roleInCompany: 'admin',
      dashboardRole: 'project_manager' as const,
    };
    const api = await mockReportsApi(page, {
      user: mixedRoleUser,
      companyTier: 'professional',
      projectCurrentUserRole: 'viewer',
    });

    await page.goto(`/projects/${E2E_PROJECT_ID}/reports?tab=claims`);

    await expect(page.getByRole('heading', { name: 'Reports & Analytics' })).toBeVisible();
    await expect(page.getByText('Total Lots: 2')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Schedule Reports' })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Claims' })).toHaveCount(0);
    await expect(page).toHaveURL(/tab=lot-status/);
    expect(api.getScheduleLoadCount()).toBe(0);
    expect(api.getReportRequests()).not.toContain('/api/reports/claims?projectId=e2e-project');
  });

  test('routes basic-tier schedule attempts to upgrade state without loading schedules', async ({
    page,
  }) => {
    const api = await mockReportsApi(page, { companyTier: 'basic' });

    await page.goto(`/projects/${E2E_PROJECT_ID}/reports`);
    await expect(page.getByText('Total Lots: 2')).toBeVisible();

    await page.getByRole('button', { name: 'Schedule Reports' }).click();

    await expect(page.getByRole('tab', { name: 'Advanced Analytics' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByText('Upgrade to Professional')).toBeVisible();
    expect(api.getScheduleLoadCount()).toBe(0);
  });

  test('does not route project managers to forbidden company settings from analytics upsell', async ({
    page,
  }) => {
    const projectManager = {
      ...E2E_ADMIN_USER,
      id: 'e2e-basic-project-manager',
      email: 'basic-project-manager@example.com',
      fullName: 'E2E Project Manager',
      role: 'member',
      roleInCompany: 'member',
      dashboardRole: 'project_manager' as const,
    };
    const api = await mockReportsApi(page, {
      user: projectManager,
      companyTier: 'basic',
      projectCurrentUserRole: 'project_manager',
    });

    await page.goto(`/projects/${E2E_PROJECT_ID}/reports?tab=advanced`);

    await expect(page.getByRole('heading', { name: 'Advanced Analytics' })).toBeVisible();
    await expect(page.getByText('Ask a company admin to upgrade this workspace.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Upgrade to Professional' })).toHaveCount(0);
    expect(api.getScheduleLoadCount()).toBe(0);
  });

  test('shows a retryable report load error without stale synthetic report content', async ({
    page,
  }) => {
    const api = await mockReportsApi(page, { failLotStatusUntil: 1 });

    await page.goto(`/projects/${E2E_PROJECT_ID}/reports`);

    await expect(page.getByRole('heading', { name: 'Reports & Analytics' })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('Lot report unavailable');
    await expect(page.getByText('Total Lots: 2')).toHaveCount(0);
    await expect(page.getByText('LOT-RPT-001')).toHaveCount(0);

    await page.getByRole('button', { name: 'Refresh Report' }).click();

    await expect.poll(() => api.getLotStatusRequestCount()).toBeGreaterThan(1);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByText('Total Lots: 2')).toBeVisible();
    await expect(page.getByText('LOT-RPT-001')).toBeVisible();
  });

  test('shows a retryable schedule load error instead of a false empty schedule list', async ({
    page,
  }) => {
    const api = await mockReportsApi(page, { failSchedulesUntil: 1 });

    await page.goto(`/projects/${E2E_PROJECT_ID}/reports`);
    await expect(page.getByText('Total Lots: 2')).toBeVisible();

    const scheduleDialog = await openScheduleDialog(page);
    await expect(scheduleDialog.getByRole('alert')).toContainText('Schedule service unavailable');
    await expect(scheduleDialog.getByText('No scheduled reports yet')).toHaveCount(0);
    await expect(scheduleDialog.getByRole('button', { name: '+ New Schedule' })).toHaveCount(0);

    await scheduleDialog.getByRole('button', { name: 'Try again' }).click();

    await expect.poll(() => api.getScheduleLoadCount()).toBeGreaterThan(1);
    await expect(scheduleDialog.getByRole('alert')).toHaveCount(0);
    await expect(scheduleDialog.getByText('Lot Status Report')).toBeVisible();
    await expect(scheduleDialog.getByText('Weekly on Monday at 09:00')).toBeVisible();
    await expect(scheduleDialog.getByRole('button', { name: '+ New Schedule' })).toBeVisible();
  });

  test('shows when the worker paused a repeatedly failing scheduled report', async ({ page }) => {
    await mockReportsApi(page, { includeFailurePausedSchedule: true });

    await page.goto(`/projects/${E2E_PROJECT_ID}/reports`);
    await expect(page.getByText('Total Lots: 2')).toBeVisible();

    const scheduleDialog = await openScheduleDialog(page);
    await expect(scheduleDialog.getByText('NCR Report')).toBeVisible();
    await expect(scheduleDialog.getByText('Paused after failures')).toBeVisible();
    await expect(
      scheduleDialog.getByText(
        'Paused after 3 failed delivery attempts. Last error: Scheduled report recipients must contain valid email addresses',
      ),
    ).toBeVisible();
    await expect(scheduleDialog.getByText('Next: Not scheduled')).toBeVisible();
  });

  test('ignores duplicate schedule creation while the request is in flight', async ({ page }) => {
    const api = await mockReportsApi(page, { createScheduleDelayMs: 250 });

    await page.goto(`/projects/${E2E_PROJECT_ID}/reports`);

    const scheduleDialog = await openScheduleDialog(page);

    await startDiarySchedule(scheduleDialog, 'daily');
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

    await expect(scheduleDialog.getByRole('button', { name: 'Creating...' })).toBeDisabled();
    await expect(scheduleDialog.getByLabel('Report Type')).toBeDisabled();
    await expect(scheduleDialog.getByLabel('Frequency')).toBeDisabled();
    await expect(scheduleDialog.getByLabel('Time')).toBeDisabled();
    await expect(scheduleDialog.getByLabel('Recipients (comma-separated emails)')).toBeDisabled();
    await expect(scheduleDialog.getByRole('button', { name: 'Cancel' })).toBeDisabled();

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

  test('locks scheduled report row actions while update and delete requests are in flight', async ({
    page,
  }) => {
    const api = await mockReportsApi(page, {
      updateScheduleDelayMs: 250,
      deleteScheduleDelayMs: 250,
    });

    await page.goto(`/projects/${E2E_PROJECT_ID}/reports`);

    const scheduleDialog = await openScheduleDialog(page);
    const existingSchedule = scheduleDialog
      .locator('div')
      .filter({ hasText: 'Lot Status Report' })
      .filter({ hasText: 'Weekly on Monday at 09:00' })
      .first();

    await existingSchedule
      .getByRole('button', { name: 'Pause' })
      .evaluate((button: HTMLElement) => {
        button.click();
        button.click();
      });

    await expect(existingSchedule.getByRole('button', { name: 'Pausing...' })).toBeDisabled();
    await expect(existingSchedule.getByRole('button', { name: 'Delete' })).toBeDisabled();
    await expect(page.getByText('The scheduled report was updated.')).toBeVisible();
    expect(api.getUpdateScheduleRequests()).toHaveLength(1);

    await existingSchedule.getByRole('button', { name: 'Delete' }).click();
    const deleteDialog = page
      .getByRole('alertdialog')
      .filter({ hasText: 'Delete Scheduled Report' });
    await expect(deleteDialog).toBeVisible();

    await deleteDialog.getByRole('button', { name: 'Delete' }).evaluate((button: HTMLElement) => {
      button.click();
      button.click();
    });

    await expect(deleteDialog.getByRole('button', { name: 'Deleting...' })).toBeDisabled();
    await expect(deleteDialog.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    await expect(deleteDialog).toBeHidden();
    expect(api.getDeleteScheduleRequests()).toEqual(['e2e-schedule-existing']);
  });
});
