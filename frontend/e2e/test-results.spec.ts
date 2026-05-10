import { test, expect, type Page } from '@playwright/test';
import { E2E_ADMIN_USER, E2E_PROJECT_ID, mockAuthenticatedUserState } from './helpers';

const E2E_TEST_ID = 'e2e-test-result';
const E2E_REJECT_TEST_ID = 'e2e-reject-test-result';
const E2E_CREATED_TEST_ID = 'e2e-created-test-result';

type SeededStatus = 'entered' | 'verified' | 'results_received';

interface MockTestResultsOptions {
  failLoadsUntil?: number;
}

function buildTestResults(
  primaryStatus: SeededStatus = 'entered',
  rejectedStatus: SeededStatus = 'entered',
  includeCreatedFail = false,
) {
  const results = [
    {
      id: E2E_TEST_ID,
      testType: 'Density Ratio',
      testRequestNumber: 'TR-E2E-001',
      laboratoryName: 'E2E Lab',
      laboratoryReportNumber: 'LAB-E2E-001',
      sampleDate: '2026-05-01',
      sampleLocation: 'CH 100.000 LHS',
      testDate: '2026-05-02',
      resultDate: '2026-05-03',
      resultValue: 98.2,
      resultUnit: '% DDR',
      specificationMin: 95,
      specificationMax: 100,
      passFail: 'pass',
      status: primaryStatus,
      lotId: 'e2e-test-lot',
      lot: {
        id: 'e2e-test-lot',
        lotNumber: 'LOT-TEST-001',
        description: 'E2E test lot',
        activityType: 'Earthworks',
        chainageStart: 100,
        chainageEnd: 200,
      },
      aiExtracted: true,
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
    },
    {
      id: E2E_REJECT_TEST_ID,
      testType: 'CBR Laboratory',
      testRequestNumber: 'TR-E2E-002',
      laboratoryName: 'E2E Geotech',
      laboratoryReportNumber: 'LAB-E2E-002',
      sampleDate: '2026-05-04',
      sampleLocation: 'CH 180.000 RHS',
      testDate: '2026-05-05',
      resultDate: '2026-05-06',
      resultValue: 8,
      resultUnit: '%',
      specificationMin: 10,
      specificationMax: null,
      passFail: 'fail',
      status: rejectedStatus,
      lotId: 'e2e-test-lot',
      lot: {
        id: 'e2e-test-lot',
        lotNumber: 'LOT-TEST-001',
        description: 'E2E test lot',
        activityType: 'Earthworks',
        chainageStart: 100,
        chainageEnd: 200,
      },
      aiExtracted: false,
      createdAt: '2026-05-04T00:00:00.000Z',
      updatedAt: '2026-05-04T00:00:00.000Z',
    },
  ];

  if (includeCreatedFail) {
    results.push({
      id: E2E_CREATED_TEST_ID,
      testType: 'Concrete Strength',
      testRequestNumber: 'TR-E2E-003',
      laboratoryName: 'E2E Concrete Lab',
      laboratoryReportNumber: 'LAB-E2E-003',
      sampleDate: '2026-05-07',
      sampleLocation: 'Bridge deck pour',
      testDate: '2026-05-08',
      resultDate: '2026-05-09',
      resultValue: 28,
      resultUnit: 'MPa',
      specificationMin: 32,
      specificationMax: null,
      passFail: 'fail',
      status: 'entered',
      lotId: 'e2e-test-lot',
      lot: {
        id: 'e2e-test-lot',
        lotNumber: 'LOT-TEST-001',
        description: 'E2E test lot',
        activityType: 'Concrete',
        chainageStart: 100,
        chainageEnd: 200,
      },
      aiExtracted: false,
      createdAt: '2026-05-09T00:00:00.000Z',
      updatedAt: '2026-05-09T00:00:00.000Z',
    });
  }

  return results;
}

async function mockSeededTestResultsApi(page: Page, options: MockTestResultsOptions = {}) {
  let primaryStatus: SeededStatus = 'entered';
  let rejectedStatus: SeededStatus = 'entered';
  let includeCreatedFail = false;
  let verifyRequest: unknown;
  let rejectRequest: unknown;
  let createTestRequest: unknown;
  let createNcrRequest: unknown;
  let testResultsLoadCount = 0;
  let verifyRequestCount = 0;

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
          state: 'NSW',
        },
      });
      return;
    }

    if (url.pathname === '/api/lots' && url.searchParams.get('projectId') === E2E_PROJECT_ID) {
      await json({
        lots: [
          {
            id: 'e2e-test-lot',
            lotNumber: 'LOT-TEST-001',
          },
        ],
      });
      return;
    }

    if (
      url.pathname === '/api/test-results' &&
      url.searchParams.get('projectId') === E2E_PROJECT_ID
    ) {
      testResultsLoadCount += 1;
      if (testResultsLoadCount <= (options.failLoadsUntil || 0)) {
        await json({ message: 'Test register unavailable' }, 503);
        return;
      }

      await json({
        testResults: buildTestResults(primaryStatus, rejectedStatus, includeCreatedFail),
      });
      return;
    }

    if (url.pathname === `/api/test-results/${E2E_TEST_ID}/status`) {
      verifyRequestCount += 1;
      verifyRequest = route.request().postDataJSON();
      primaryStatus = 'verified';
      await new Promise((resolve) => setTimeout(resolve, 250));
      await json({
        testResult: buildTestResults(primaryStatus, rejectedStatus, includeCreatedFail)[0],
      });
      return;
    }

    if (url.pathname === `/api/test-results/${E2E_REJECT_TEST_ID}/reject`) {
      rejectRequest = route.request().postDataJSON();
      rejectedStatus = 'results_received';
      await json({
        testResult: buildTestResults(primaryStatus, rejectedStatus, includeCreatedFail)[1],
      });
      return;
    }

    if (url.pathname === '/api/test-results' && route.request().method() === 'POST') {
      createTestRequest = route.request().postDataJSON();
      includeCreatedFail = true;
      await json({ testResult: { id: E2E_CREATED_TEST_ID } });
      return;
    }

    if (url.pathname === '/api/ncrs' && route.request().method() === 'POST') {
      createNcrRequest = route.request().postDataJSON();
      await json({ ncr: { ncrNumber: 'NCR-E2E-TEST-001' } });
      return;
    }

    await json({ message: `Unhandled E2E API route: ${url.pathname}` }, 404);
  });

  await mockAuthenticatedUserState(page);

  return {
    getVerifyRequest: () => verifyRequest,
    getVerifyRequestCount: () => verifyRequestCount,
    getRejectRequest: () => rejectRequest,
    getCreateTestRequest: () => createTestRequest,
    getCreateNcrRequest: () => createNcrRequest,
  };
}

test.describe('Test results seeded quality evidence contract', () => {
  test('renders seeded tests, filters results, verifies and rejects tests, and raises NCR for a failed test', async ({
    page,
  }) => {
    const api = await mockSeededTestResultsApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/tests`);

    await expect(page.getByRole('heading', { name: 'Test Results' })).toBeVisible();
    await expect(
      page.getByText('Manage test results and certificates for this project.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Upload Certificate' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Batch Upload' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Test Result' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible();

    const densityRow = page.getByRole('row').filter({ hasText: 'Density Ratio' });
    await expect(densityRow).toBeVisible();
    await expect(densityRow.getByText('TR-E2E-001')).toBeVisible();
    await expect(densityRow.getByRole('button', { name: 'LOT-TEST-001' })).toBeVisible();
    await expect(densityRow.getByText('E2E Lab')).toBeVisible();
    await expect(densityRow.getByText('98.2 % DDR')).toBeVisible();
    await expect(densityRow.getByText('pass')).toBeVisible();
    await expect(densityRow.getByText('Entered')).toBeVisible();
    await expect(densityRow.getByText('AI')).toBeVisible();
    await expect(
      densityRow.getByRole('button', { name: 'Print test certificate for Density Ratio' }),
    ).toBeVisible();
    await expect(densityRow.getByRole('button', { name: 'Verify' })).toBeVisible();
    await expect(densityRow.getByRole('button', { name: 'Reject' })).toBeVisible();

    const cbrRow = page.getByRole('row').filter({ hasText: 'CBR Laboratory' });
    await expect(cbrRow).toBeVisible();
    await expect(cbrRow.getByText('TR-E2E-002')).toBeVisible();
    await expect(cbrRow.getByText('E2E Geotech')).toBeVisible();
    await expect(cbrRow.getByText('8 %')).toBeVisible();
    await expect(cbrRow.getByText('fail')).toBeVisible();

    await page.getByPlaceholder('Search by report #, lot #, lab name...').fill('TR-E2E-001');
    await expect(densityRow).toBeVisible();
    await expect(cbrRow).toBeHidden();
    await page.getByRole('button', { name: 'Filters 1/2' }).click();
    await expect(page.getByText('Showing 1 of 2 results')).toBeVisible();
    await page.getByRole('button', { name: 'Clear all filters' }).click();
    await expect(cbrRow).toBeVisible();

    await densityRow.getByRole('button', { name: 'Verify' }).click();
    expect(api.getVerifyRequest()).toMatchObject({ status: 'verified' });
    await expect(densityRow.getByText('Verified')).toBeVisible();
    await expect(densityRow.getByText('Complete')).toBeVisible();

    await cbrRow.getByRole('button', { name: 'Reject' }).click();

    const rejectModal = page.getByRole('dialog').filter({ hasText: 'Reject Test Verification' });
    await expect(
      rejectModal.getByRole('heading', { name: 'Reject Test Verification' }),
    ).toBeVisible();
    await rejectModal
      .getByPlaceholder(
        "Enter the reason for rejection (e.g., incorrect values, missing data, doesn't match certificate)",
      )
      .fill('Certificate value does not match entered result.');
    await rejectModal.getByRole('button', { name: 'Reject Test' }).click();

    expect(api.getRejectRequest()).toMatchObject({
      reason: 'Certificate value does not match entered result.',
    });
    await expect(cbrRow.getByText('Results Received')).toBeVisible();

    await page.getByRole('button', { name: 'Add Test Result' }).click();

    const createModal = page.getByRole('dialog').filter({ hasText: 'Add Test Result' });
    await expect(createModal.getByRole('heading', { name: 'Add Test Result' })).toBeVisible();
    await createModal.getByLabel('Test Type *').fill('  Concrete Strength  ');
    await createModal.getByLabel('Test Request Number').fill('  TR-E2E-003  ');
    await createModal.getByLabel('Lab Report Number').fill('  LAB-E2E-003  ');
    await createModal.getByLabel('Link to Lot').selectOption('e2e-test-lot');
    await createModal.getByLabel('Laboratory Name').fill('  E2E Concrete Lab  ');
    await createModal.getByLabel('Sample Location').fill('  Bridge deck pour  ');
    await createModal.getByLabel('Sample Date').fill('2026-05-07');
    await createModal.getByLabel('Test Date').fill('2026-05-08');
    await createModal.getByLabel('Result Date').fill('2026-05-09');
    await createModal.getByLabel('Result Value').fill('28');
    await createModal.getByLabel('Spec Min').fill('32');
    await expect(createModal.getByLabel('Pass/Fail Status')).toHaveValue('fail');
    await createModal.getByRole('button', { name: 'Create Test Result' }).click();

    expect(api.getCreateTestRequest()).toMatchObject({
      projectId: E2E_PROJECT_ID,
      testType: 'Concrete Strength',
      testRequestNumber: 'TR-E2E-003',
      laboratoryReportNumber: 'LAB-E2E-003',
      laboratoryName: 'E2E Concrete Lab',
      lotId: 'e2e-test-lot',
      resultValue: '28',
      specificationMin: '32',
      passFail: 'fail',
    });

    const ncrPrompt = page.getByRole('dialog').filter({ hasText: 'Test Failed' });
    await expect(ncrPrompt.getByText('Concrete Strength result: 28')).toBeVisible();
    await ncrPrompt.getByRole('button', { name: 'Yes, Raise NCR' }).click();

    const ncrModal = page.getByRole('dialog').filter({ hasText: 'Raise NCR from Test Failure' });
    await expect(
      ncrModal.getByRole('heading', { name: 'Raise NCR from Test Failure' }),
    ).toBeVisible();
    await expect(ncrModal.getByLabel('Description *')).toHaveValue(
      /Test failure: Concrete Strength result/,
    );
    await ncrModal.getByRole('button', { name: 'Raise NCR' }).click();

    expect(api.getCreateNcrRequest()).toMatchObject({
      projectId: E2E_PROJECT_ID,
      category: 'materials',
      severity: 'minor',
      lotIds: ['e2e-test-lot'],
      linkedTestResultId: E2E_CREATED_TEST_ID,
    });
    await expect(page.getByText('NCR NCR-E2E-TEST-001 was created successfully.')).toBeVisible();
  });

  test('calculates pass/fail from the full numeric input value', async ({ page }) => {
    await mockSeededTestResultsApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/tests`);
    await page.getByRole('button', { name: 'Add Test Result' }).click();

    const createModal = page.getByRole('dialog').filter({ hasText: 'Add Test Result' });
    await createModal.getByLabel('Result Value').fill('9.5e1');
    await createModal.getByLabel('Spec Min').fill('90');
    await createModal.getByLabel('Spec Max').fill('100');

    await expect(createModal.getByLabel('Pass/Fail Status')).toHaveValue('pass');

    await createModal.getByLabel('Result Value').fill('1e3');
    await expect(createModal.getByLabel('Pass/Fail Status')).toHaveValue('fail');
  });

  test('surfaces test-result load failures with retry and no false empty state', async ({
    page,
  }) => {
    await mockSeededTestResultsApi(page, { failLoadsUntil: 1 });

    await page.goto(`/projects/${E2E_PROJECT_ID}/tests`);

    await expect(page.getByRole('alert')).toContainText('Test register unavailable');
    await expect(page.getByText('No Test Results')).toBeHidden();

    await page.getByRole('button', { name: 'Try again' }).click();

    await expect(page.getByRole('alert')).toBeHidden();
    await expect(page.getByText('Density Ratio')).toBeVisible();
    await expect(page.getByText('CBR Laboratory')).toBeVisible();
  });

  test('guards duplicate status updates from rapid clicks', async ({ page }) => {
    const api = await mockSeededTestResultsApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/tests`);

    const densityRow = page.getByRole('row').filter({ hasText: 'Density Ratio' });
    await expect(densityRow).toBeVisible();
    await densityRow.getByRole('button', { name: 'Verify' }).dblclick();

    await expect(densityRow.getByText('Verified')).toBeVisible();
    expect(api.getVerifyRequestCount()).toBe(1);
  });
});
