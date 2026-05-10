import { test, expect, type Page } from '@playwright/test';
import { E2E_ADMIN_USER, E2E_PROJECT_ID, mockAuthenticatedUserState } from './helpers';

const E2E_CLAIM_ID = 'e2e-claim';

type ClaimStatus = 'draft' | 'submitted' | 'certified' | 'partially_paid' | 'paid' | 'disputed';

type SeededClaimsApiOptions = {
  failClaimLoadsUntil?: number;
  submitDelayMs?: number;
  initialStatus?: ClaimStatus;
  initialPaidAmount?: number;
  initialCertifiedAmount?: number | null;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function buildClaim(
  status: ClaimStatus = 'draft',
  disputeNotes: string | null = null,
  paidAmount = status === 'paid' ? 90000 : 25000,
  certifiedAmount: number | null = status === 'draft' ? null : 90000,
) {
  return {
    id: E2E_CLAIM_ID,
    claimNumber: 7,
    periodStart: '2026-04-01',
    periodEnd: '2026-04-30',
    status,
    totalClaimedAmount: 120000,
    certifiedAmount,
    paidAmount,
    submittedAt: status === 'draft' ? null : '2026-05-01T00:00:00.000Z',
    disputeNotes,
    disputedAt: status === 'disputed' ? '2026-05-09' : null,
    lotCount: 3,
    paymentDueDate: status === 'draft' ? null : '2026-05-29',
  };
}

async function mockSeededClaimsApi(page: Page, options: SeededClaimsApiOptions = {}) {
  let claimStatus: ClaimStatus = options.initialStatus ?? 'draft';
  let disputeNotes: string | null = null;
  let certifiedAmount =
    options.initialCertifiedAmount !== undefined
      ? options.initialCertifiedAmount
      : claimStatus === 'draft'
        ? null
        : 90000;
  let paidAmount = options.initialPaidAmount ?? (claimStatus === 'paid' ? 90000 : 25000);
  const updateRequests: unknown[] = [];
  const certificationRequests: unknown[] = [];
  const paymentRequests: unknown[] = [];
  let claimLoadCount = 0;
  let createClaimRequest: unknown;

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

    if (
      url.pathname === `/api/projects/${E2E_PROJECT_ID}/claims` &&
      route.request().method() === 'GET'
    ) {
      claimLoadCount += 1;
      if (claimLoadCount <= (options.failClaimLoadsUntil ?? 0)) {
        await json({ message: 'Unable to load progress claims' }, 500);
        return;
      }
      await json({ claims: [buildClaim(claimStatus, disputeNotes, paidAmount, certifiedAmount)] });
      return;
    }

    if (
      url.pathname === `/api/projects/${E2E_PROJECT_ID}/lots` &&
      route.request().method() === 'GET'
    ) {
      await json({
        lots: [
          {
            id: 'e2e-claim-lot',
            lotNumber: 'LOT-CLAIM-001',
            activity: 'Earthworks',
            budgetAmount: 100000,
          },
        ],
      });
      return;
    }

    if (
      url.pathname === `/api/projects/${E2E_PROJECT_ID}/claims` &&
      route.request().method() === 'POST'
    ) {
      createClaimRequest = route.request().postDataJSON();
      await json({ claim: buildClaim('draft') }, 201);
      return;
    }

    if (
      url.pathname === `/api/projects/${E2E_PROJECT_ID}/claims/${E2E_CLAIM_ID}` &&
      route.request().method() === 'PUT'
    ) {
      const requestBody = route.request().postDataJSON();
      updateRequests.push(requestBody);
      if (requestBody.status === 'submitted') {
        if (options.submitDelayMs) {
          await delay(options.submitDelayMs);
        }
        claimStatus = 'submitted';
      }
      if (requestBody.status === 'disputed') {
        claimStatus = 'disputed';
        disputeNotes = requestBody.disputeNotes || null;
      }
      await json({ claim: buildClaim(claimStatus, disputeNotes, paidAmount, certifiedAmount) });
      return;
    }

    if (
      url.pathname === `/api/projects/${E2E_PROJECT_ID}/claims/${E2E_CLAIM_ID}/certify` &&
      route.request().method() === 'POST'
    ) {
      const requestBody = route.request().postDataJSON() as { certifiedAmount?: number };
      certificationRequests.push(requestBody);
      certifiedAmount = requestBody.certifiedAmount ?? 0;
      claimStatus = 'certified';
      await json({
        claim: buildClaim(claimStatus, disputeNotes, paidAmount, certifiedAmount),
        message: 'Claim certified successfully',
      });
      return;
    }

    if (
      url.pathname === `/api/projects/${E2E_PROJECT_ID}/claims/${E2E_CLAIM_ID}/payment` &&
      route.request().method() === 'POST'
    ) {
      const requestBody = route.request().postDataJSON() as { paidAmount?: number };
      paymentRequests.push(requestBody);
      paidAmount += requestBody.paidAmount ?? 0;
      claimStatus = paidAmount >= (certifiedAmount ?? 0) ? 'paid' : 'partially_paid';
      await json({
        claim: buildClaim(claimStatus, disputeNotes, paidAmount, certifiedAmount),
        message: claimStatus === 'paid' ? 'Claim fully paid' : 'Partial payment recorded.',
      });
      return;
    }

    await json({ message: `Unhandled E2E API route: ${url.pathname}` }, 404);
  });

  await mockAuthenticatedUserState(page);

  return {
    getUpdateRequests: () => updateRequests,
    getCertificationRequests: () => certificationRequests,
    getPaymentRequests: () => paymentRequests,
    getClaimLoadCount: () => claimLoadCount,
    getCreateClaimRequest: () => createClaimRequest,
  };
}

test.describe('Claims seeded commercial contract', () => {
  test('renders a seeded draft claim, downloads claim CSV, submits it, and disputes it', async ({
    page,
  }) => {
    const api = await mockSeededClaimsApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/claims`);

    await expect(page.getByRole('heading', { name: 'Progress Claims' })).toBeVisible();
    await expect(
      page.getByText('SOPA-compliant progress claims and payment tracking'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Claim' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible();

    const totalClaimedCard = page
      .locator('.rounded-lg.border.bg-card.p-4')
      .filter({ hasText: 'Total Claimed' });
    await expect(totalClaimedCard.getByText('$120,000')).toBeVisible();
    const outstandingCard = page
      .locator('.rounded-lg.border.bg-card.p-4')
      .filter({ hasText: 'Outstanding' });
    await expect(outstandingCard.getByText('-$25,000')).toBeVisible();

    const claimRow = page.getByRole('row').filter({ hasText: 'Claim 7' });
    await expect(claimRow).toBeVisible();
    await expect(claimRow.getByText('Draft')).toBeVisible();
    await expect(claimRow.getByRole('cell', { name: '3', exact: true })).toBeVisible();
    await expect(claimRow.getByText('$120,000')).toBeVisible();
    await expect(claimRow.getByText('$25,000')).toBeVisible();
    await expect(claimRow.getByRole('button', { name: 'Submit Claim' })).toBeVisible();
    await expect(claimRow.getByRole('button', { name: 'AI Completeness Check' })).toBeVisible();
    await expect(claimRow.getByRole('button', { name: 'Generate Evidence Package' })).toBeVisible();
    await expect(claimRow.getByRole('button', { name: 'Download CSV' })).toBeVisible();

    const rowDownloadPromise = page.waitForEvent('download');
    await claimRow.getByRole('button', { name: 'Download CSV' }).click();
    const rowDownload = await rowDownloadPromise;
    expect(rowDownload.suggestedFilename()).toBe('claim-7.csv');
    await rowDownload.delete();

    await claimRow.getByRole('button', { name: 'Submit Claim' }).click();

    const submitModal = page.getByRole('dialog').filter({ hasText: 'Submit Claim' });
    await expect(submitModal.getByRole('heading', { name: 'Submit Claim' })).toBeVisible();
    await expect(
      submitModal.getByText(
        'Download the claim package, then submit it through your client channel.',
      ),
    ).toBeVisible();

    const submitDownloadPromise = page.waitForEvent('download');
    await submitModal.getByText('Download package').click();
    const submitDownload = await submitDownloadPromise;
    expect(submitDownload.suggestedFilename()).toBe('claim-7.csv');
    await submitDownload.delete();

    expect(api.getUpdateRequests()).toContainEqual({ status: 'submitted' });
    await expect(page.getByText('Claim 7 was downloaded and marked as submitted.')).toBeVisible();
    await expect(claimRow.getByText('Submitted')).toBeVisible();
    await expect(claimRow.getByRole('button', { name: 'Mark as Disputed' })).toBeVisible();

    await claimRow.getByRole('button', { name: 'Mark as Disputed' }).click();

    const disputeModal = page
      .getByRole('alertdialog')
      .filter({ hasText: 'Mark Claim as Disputed' });
    await expect(
      disputeModal.getByRole('heading', { name: 'Mark Claim as Disputed' }),
    ).toBeVisible();
    await expect(
      disputeModal.getByText('This action will mark the claim as disputed.'),
    ).toBeVisible();
    await disputeModal
      .getByPlaceholder(
        'Describe the reason for the dispute, including any specific items or amounts in question...',
      )
      .fill('E2E dispute over certified quantity.');
    await disputeModal.getByRole('button', { name: 'Mark as Disputed' }).click();

    expect(api.getUpdateRequests()).toContainEqual({
      status: 'disputed',
      disputeNotes: 'E2E dispute over certified quantity.',
    });
    await expect(page.getByText('The claim has been marked as disputed.')).toBeVisible();
    await expect(claimRow.getByText('Disputed')).toBeVisible();
  });

  test('shows a retryable load error instead of a false empty claims state', async ({ page }) => {
    const api = await mockSeededClaimsApi(page, { failClaimLoadsUntil: 2 });

    await page.goto(`/projects/${E2E_PROJECT_ID}/claims`);

    await expect(page.getByRole('alert')).toContainText('Unable to load progress claims');
    await expect(page.getByText('No claims yet')).toHaveCount(0);

    await page.getByRole('button', { name: 'Try again' }).click();

    await expect.poll(() => api.getClaimLoadCount()).toBeGreaterThan(2);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('row').filter({ hasText: 'Claim 7' })).toBeVisible();
  });

  test('ignores duplicate submit clicks while the request is in flight', async ({ page }) => {
    const api = await mockSeededClaimsApi(page, { submitDelayMs: 250 });

    await page.goto(`/projects/${E2E_PROJECT_ID}/claims`);

    const claimRow = page.getByRole('row').filter({ hasText: 'Claim 7' });
    await expect(claimRow).toBeVisible();
    await claimRow.getByRole('button', { name: 'Submit Claim' }).click();

    const submitModal = page.getByRole('dialog').filter({ hasText: 'Submit Claim' });
    await expect(submitModal.getByRole('heading', { name: 'Submit Claim' })).toBeVisible();

    const submitButton = submitModal.getByText('Download package');
    await submitButton.evaluate((button: HTMLElement) => {
      button.click();
      button.click();
    });

    await expect
      .poll(
        () =>
          api
            .getUpdateRequests()
            .filter(
              (request) =>
                typeof request === 'object' &&
                request !== null &&
                'status' in request &&
                request.status === 'submitted',
            ).length,
      )
      .toBe(1);
    await expect(claimRow.getByText('Submitted')).toBeVisible();
  });

  test('rejects encoded percent complete while creating a claim', async ({ page }) => {
    const api = await mockSeededClaimsApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/claims`);
    await page.getByRole('button', { name: 'New Claim' }).click();

    const modal = page.getByRole('dialog').filter({ hasText: 'Create New Progress Claim' });
    await expect(modal.getByText('LOT-CLAIM-001')).toBeVisible();
    await modal.getByRole('checkbox').check();

    await modal.locator('input[type="number"]').fill('1e1');
    await expect(
      modal.getByText('Percent complete must be a decimal between 0 and 100.'),
    ).toBeVisible();
    await expect(modal.getByRole('button', { name: 'Create Claim' })).toBeDisabled();
    expect(api.getCreateClaimRequest()).toBeUndefined();

    await modal.locator('input[type="number"]').fill('50.5');
    await expect(modal.getByText('$50,500').first()).toBeVisible();
    await modal.getByRole('button', { name: 'Create Claim' }).click();

    await expect
      .poll(() => api.getCreateClaimRequest())
      .toMatchObject({
        lots: [
          {
            lotId: 'e2e-claim-lot',
            percentageComplete: 50.5,
          },
        ],
      });
  });

  test('records a final payment against a certified claim', async ({ page }) => {
    const api = await mockSeededClaimsApi(page, {
      initialStatus: 'certified',
      initialPaidAmount: 25000,
    });

    await page.goto(`/projects/${E2E_PROJECT_ID}/claims`);

    const claimRow = page.getByRole('row').filter({ hasText: 'Claim 7' });
    await expect(claimRow).toBeVisible();
    await expect(claimRow.getByText('Certified')).toBeVisible();
    await expect(claimRow.getByText('$25,000')).toBeVisible();

    await claimRow.getByRole('button', { name: 'Record Payment' }).click();

    const paymentModal = page.getByRole('dialog').filter({ hasText: 'Record Payment' });
    await expect(paymentModal.getByRole('heading', { name: 'Record Payment' })).toBeVisible();
    await expect(paymentModal.getByText('Outstanding $65,000')).toBeVisible();

    await paymentModal.getByLabel('Payment Amount').fill('65000');
    await paymentModal.getByLabel('Payment Date').fill('2026-05-10');
    await paymentModal.getByLabel('Payment Reference').fill('PAY-E2E-001');
    await paymentModal.getByLabel('Payment Notes').fill('Final payment received.');
    await paymentModal.getByRole('button', { name: 'Record Payment' }).click();

    await expect
      .poll(() => api.getPaymentRequests())
      .toContainEqual({
        paidAmount: 65000,
        paymentDate: '2026-05-10',
        paymentReference: 'PAY-E2E-001',
        paymentNotes: 'Final payment received.',
      });
    await expect(page.getByText('Claim fully paid')).toBeVisible();
    await expect(claimRow.getByText('Paid')).toBeVisible();
    await expect(claimRow.locator('td').nth(8)).toHaveText('$90,000');
  });

  test('certifies a submitted claim and enables payment recording', async ({ page }) => {
    const api = await mockSeededClaimsApi(page, {
      initialStatus: 'submitted',
      initialCertifiedAmount: null,
      initialPaidAmount: 0,
    });

    await page.goto(`/projects/${E2E_PROJECT_ID}/claims`);

    const claimRow = page.getByRole('row').filter({ hasText: 'Claim 7' });
    await expect(claimRow).toBeVisible();
    await expect(claimRow.getByText('Submitted')).toBeVisible();
    await expect(claimRow.getByRole('button', { name: 'Certify Claim' })).toBeVisible();

    await claimRow.getByRole('button', { name: 'Certify Claim' }).click();

    const certificationModal = page.getByRole('dialog').filter({ hasText: 'Certify Claim' });
    await expect(certificationModal.getByRole('heading', { name: 'Certify Claim' })).toBeVisible();
    await expect(certificationModal.getByText('Claimed $120,000')).toBeVisible();

    await certificationModal.getByLabel('Certified Amount').fill('88000');
    await certificationModal.getByLabel('Certification Date').fill('2026-05-11');
    await certificationModal.getByLabel('Variation Notes').fill('Certified less retention.');
    await certificationModal.getByRole('button', { name: 'Certify Claim' }).click();

    await expect
      .poll(() => api.getCertificationRequests())
      .toContainEqual({
        certifiedAmount: 88000,
        certificationDate: '2026-05-11',
        variationNotes: 'Certified less retention.',
      });
    await expect(page.getByText('Claim certified successfully')).toBeVisible();
    await expect(claimRow.getByText('Certified')).toBeVisible();
    await expect(claimRow.locator('td').nth(7)).toHaveText('$88,000');
    await expect(claimRow.getByRole('button', { name: 'Record Payment' })).toBeVisible();
  });
});
