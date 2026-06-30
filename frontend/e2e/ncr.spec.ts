import { test, expect, type Locator, type Page, type Route } from '@playwright/test';
import {
  E2E_ADMIN_USER,
  E2E_PROJECT_ID,
  createJsonResponder,
  mockAuthenticatedUserState,
  type JsonResponder,
} from './helpers';

const E2E_OPEN_NCR_ID = 'e2e-ncr-open';
const E2E_MAJOR_NCR_ID = 'e2e-ncr-major';
const E2E_NCR_EVIDENCE_DOCUMENT_ID = 'e2e-ncr-evidence-document';

type OpenNcrStatus = 'open' | 'investigating' | 'rectification' | 'verification';
type OpenNcrOptions = {
  evidenceUploaded?: boolean;
  revisionRequested?: boolean;
};
type MajorNcrOptions = {
  majorApproved?: boolean;
  clientNotified?: boolean;
  majorClosed?: boolean;
  majorClosedWithConcession?: boolean;
};

function buildProject() {
  return {
    id: E2E_PROJECT_ID,
    name: 'E2E Highway Upgrade',
    projectNumber: 'E2E-001',
  };
}

function buildOpenNcr(openStatus: OpenNcrStatus, options: OpenNcrOptions = {}) {
  const hasResponse = openStatus !== 'open' || options.revisionRequested;

  return {
    id: E2E_OPEN_NCR_ID,
    ncrNumber: 'NCR-E2E-001',
    description: 'Compaction result failed in Lot 12',
    category: 'workmanship',
    severity: 'minor',
    status: openStatus,
    qmApprovalRequired: false,
    qmApprovedAt: null,
    qmApprovedBy: null,
    raisedBy: { fullName: 'E2E Inspector', email: 'inspector@example.com' },
    responsibleUser: { fullName: 'E2E Foreman', email: 'foreman@example.com' },
    dueDate: '2026-05-20',
    createdAt: '2026-05-01T00:00:00.000Z',
    project: buildProject(),
    rootCauseCategory: hasResponse ? 'process' : null,
    rootCauseDescription: hasResponse
      ? 'Compaction process was not followed during final pass.'
      : null,
    proposedCorrectiveAction: hasResponse
      ? 'Rework the failed area and repeat compaction testing.'
      : null,
    ncrLots: [
      {
        lot: {
          lotNumber: 'LOT-NCR-001',
          description: 'Northbound formation',
        },
      },
    ],
    clientNotificationRequired: false,
    clientNotifiedAt: null,
    lessonsLearned: null,
    closedAt: null,
    verificationNotes: null,
    revisionRequested: options.revisionRequested ?? false,
    rectificationNotes:
      openStatus === 'verification' ? 'Rework completed and compaction retest attached.' : null,
    ncrEvidence: options.evidenceUploaded
      ? [
          {
            id: 'e2e-ncr-evidence',
            evidenceType: 'photo',
            uploadedAt: '2026-05-08T00:00:00.000Z',
            document: {
              id: E2E_NCR_EVIDENCE_DOCUMENT_ID,
              filename: 'rectification-photo.jpg',
              fileUrl: '/signed/ncr/rectification-photo.jpg',
              mimeType: 'image/jpeg',
              uploadedAt: '2026-05-08T00:00:00.000Z',
            },
          },
        ]
      : [],
  };
}

function buildMajorNcr(options: MajorNcrOptions) {
  return {
    id: E2E_MAJOR_NCR_ID,
    ncrNumber: 'NCR-E2E-002',
    description: 'Major concrete strength non-conformance',
    category: 'materials',
    severity: 'major',
    status: options.majorClosed
      ? options.majorClosedWithConcession
        ? 'closed_concession'
        : 'closed'
      : 'verification',
    qmApprovalRequired: true,
    qmApprovedAt: options.majorApproved ? '2026-05-09T01:00:00.000Z' : null,
    qmApprovedBy: options.majorApproved
      ? { id: 'e2e-qm-user', fullName: 'E2E Quality Manager', email: 'qm@example.com' }
      : null,
    raisedBy: { fullName: 'E2E Inspector', email: 'inspector@example.com' },
    responsibleUser: { fullName: 'E2E Concrete Subcontractor', email: 'concrete@example.com' },
    dueDate: '2026-05-22',
    createdAt: '2026-05-02T00:00:00.000Z',
    project: buildProject(),
    ncrLots: [
      {
        lot: {
          lotNumber: 'LOT-NCR-002',
          description: 'Bridge deck pour',
        },
      },
    ],
    clientNotificationRequired: true,
    clientNotifiedAt: options.clientNotified ? '2026-05-09T02:00:00.000Z' : null,
    lessonsLearned: null,
    closedAt: options.majorClosed ? '2026-05-09T03:00:00.000Z' : null,
    closedBy: options.majorClosed
      ? { fullName: 'E2E Project Manager', email: 'pm@example.com' }
      : null,
    verificationNotes: options.majorClosed ? 'Closure evidence verified in E2E.' : null,
    ncrEvidence: [],
  };
}

function normalizeMajorOptions(majorOptions: MajorNcrOptions | boolean): MajorNcrOptions {
  return typeof majorOptions === 'boolean' ? { majorApproved: majorOptions } : majorOptions;
}

function buildNcrs(
  openStatus: OpenNcrStatus = 'open',
  openOptions: OpenNcrOptions = {},
  majorOptions: MajorNcrOptions | boolean = {},
) {
  return [
    buildOpenNcr(openStatus, openOptions),
    buildMajorNcr(normalizeMajorOptions(majorOptions)),
  ];
}

async function mockSeededNcrApi(page: Page, options: { failNcrLoadsUntil?: number } = {}) {
  let openStatus: OpenNcrStatus = 'open';
  let openEvidenceUploaded = false;
  let openRevisionRequested = false;
  let majorApproved = false;
  let majorClientNotified = false;
  let majorClosed = false;
  let majorClosedWithConcession = false;
  let responseRequest: unknown;
  let qmReviewRequest: unknown;
  let qmApprovalCount = 0;
  let notifyClientRequest: unknown;
  let notifyClientCount = 0;
  let closeRequest: unknown;
  let closeCount = 0;
  let evidenceRequest: unknown;
  let evidenceUploadCount = 0;
  const rectificationSubmitRequests: unknown[] = [];
  let rejectRectificationRequest: unknown;
  let ncrLoadCount = 0;

  const currentNcrs = () =>
    buildNcrs(
      openStatus,
      {
        evidenceUploaded: openEvidenceUploaded,
        revisionRequested: openRevisionRequested,
      },
      {
        majorApproved,
        clientNotified: majorClientNotified,
        majorClosed,
        majorClosedWithConcession,
      },
    );

  const handleShellRequest = async (url: URL, json: JsonResponder) => {
    if (url.pathname === '/api/auth/me') {
      await json({ user: E2E_ADMIN_USER });
      return true;
    }

    if (url.pathname === '/api/notifications') {
      await json({ notifications: [], unreadCount: 0 });
      return true;
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
      return true;
    }

    if (url.pathname === `/api/projects/${E2E_PROJECT_ID}`) {
      await json({ project: buildProject() });
      return true;
    }

    if (url.pathname === `/api/projects/${E2E_PROJECT_ID}/users`) {
      await json({ users: [] });
      return true;
    }

    if (url.pathname === `/api/subcontractors/project/${E2E_PROJECT_ID}`) {
      await json({ subcontractors: [] });
      return true;
    }

    if (url.pathname === '/api/lots' && url.searchParams.get('projectId') === E2E_PROJECT_ID) {
      await json({
        lots: [
          {
            id: 'lot-ncr-001',
            lotNumber: 'LOT-NCR-001',
            description: 'Northbound formation',
          },
          {
            id: 'lot-ncr-002',
            lotNumber: 'LOT-NCR-002',
            description: 'Bridge deck pour',
          },
        ],
      });
      return true;
    }

    return false;
  };

  const handleNcrReadRequest = async (url: URL, json: JsonResponder) => {
    if (url.pathname === '/api/ncrs' && url.searchParams.get('projectId') === E2E_PROJECT_ID) {
      ncrLoadCount += 1;
      if (ncrLoadCount <= (options.failNcrLoadsUntil ?? 0)) {
        await json({ message: 'NCR register unavailable' }, 503);
        return true;
      }

      await json({ ncrs: currentNcrs() });
      return true;
    }

    if (url.pathname === `/api/ncrs/check-role/${E2E_PROJECT_ID}`) {
      await json({
        role: 'quality_manager',
        isQualityManager: true,
        canApproveNCRs: true,
      });
      return true;
    }

    return false;
  };

  const handleOpenNcrResponse = async (url: URL, route: Route, json: JsonResponder) => {
    if (url.pathname === `/api/ncrs/${E2E_OPEN_NCR_ID}/respond`) {
      responseRequest = route.request().postDataJSON();
      openStatus = 'investigating';
      openRevisionRequested = false;
      await json({ ncr: currentNcrs()[0] });
      return true;
    }

    return false;
  };

  const handleOpenNcrReview = async (url: URL, route: Route, json: JsonResponder) => {
    if (url.pathname === `/api/ncrs/${E2E_OPEN_NCR_ID}/qm-review`) {
      qmReviewRequest = route.request().postDataJSON();
      const action = (qmReviewRequest as { action?: string } | undefined)?.action;
      if (action === 'request_revision') {
        openStatus = 'open';
        openRevisionRequested = true;
        await json({
          message: 'Revision requested for NCR response',
          ncr: currentNcrs()[0],
        });
        return true;
      }

      openStatus = 'rectification';
      await json({
        message: 'Response accepted, NCR moved to rectification',
        ncr: currentNcrs()[0],
      });
      return true;
    }

    return false;
  };

  const handleOpenNcrEvidence = async (url: URL, route: Route, json: JsonResponder) => {
    if (url.pathname === '/api/documents/upload') {
      evidenceUploadCount += 1;
      await json({
        id: E2E_NCR_EVIDENCE_DOCUMENT_ID,
        filename: 'rectification-photo.jpg',
      });
      return true;
    }

    if (url.pathname === `/api/ncrs/${E2E_OPEN_NCR_ID}/evidence`) {
      evidenceRequest = route.request().postDataJSON();
      openEvidenceUploaded = true;
      await json({ evidence: currentNcrs()[0].ncrEvidence?.[0] });
      return true;
    }

    return false;
  };

  const handleOpenNcrVerification = async (url: URL, route: Route, json: JsonResponder) => {
    if (url.pathname === `/api/ncrs/${E2E_OPEN_NCR_ID}/submit-for-verification`) {
      rectificationSubmitRequests.push(route.request().postDataJSON());
      if (!openEvidenceUploaded) {
        await json(
          {
            message:
              'Please upload at least one piece of evidence before submitting for verification',
          },
          400,
        );
        return true;
      }

      openStatus = 'verification';
      await json({
        message: 'NCR has been submitted for verification',
        ncr: currentNcrs()[0],
      });
      return true;
    }

    if (url.pathname === `/api/ncrs/${E2E_OPEN_NCR_ID}/reject-rectification`) {
      rejectRectificationRequest = route.request().postDataJSON();
      openStatus = 'rectification';
      await json({
        message: 'Rectification rejected',
        ncr: currentNcrs()[0],
      });
      return true;
    }

    return false;
  };

  const handleOpenNcrWorkflow = async (url: URL, route: Route, json: JsonResponder) =>
    (await handleOpenNcrResponse(url, route, json)) ||
    (await handleOpenNcrReview(url, route, json)) ||
    (await handleOpenNcrEvidence(url, route, json)) ||
    (await handleOpenNcrVerification(url, route, json));

  const handleMajorNcrWorkflow = async (url: URL, route: Route, json: JsonResponder) => {
    if (url.pathname === `/api/ncrs/${E2E_MAJOR_NCR_ID}/qm-approve`) {
      qmApprovalCount += 1;
      majorApproved = true;
      await new Promise((resolve) => setTimeout(resolve, 250));
      await json({ message: 'QM approval granted' });
      return true;
    }

    if (url.pathname === `/api/ncrs/${E2E_MAJOR_NCR_ID}/notify-client`) {
      notifyClientRequest = route.request().postDataJSON();
      notifyClientCount += 1;
      majorClientNotified = true;
      await json({ message: 'Client notification sent' });
      return true;
    }

    if (url.pathname === `/api/ncrs/${E2E_MAJOR_NCR_ID}/close`) {
      closeRequest = route.request().postDataJSON();
      closeCount += 1;
      majorClosed = true;
      majorClosedWithConcession = Boolean(
        (closeRequest as { withConcession?: boolean } | undefined)?.withConcession,
      );
      await json({
        message: majorClosedWithConcession
          ? 'NCR closed with concession successfully'
          : 'Major NCR closed successfully with QM approval',
      });
      return true;
    }

    return false;
  };

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const json = createJsonResponder(route);
    const handled =
      (await handleShellRequest(url, json)) ||
      (await handleNcrReadRequest(url, json)) ||
      (await handleOpenNcrWorkflow(url, route, json)) ||
      (await handleMajorNcrWorkflow(url, route, json));

    if (handled) return;

    await json({ message: `Unhandled E2E API route: ${url.pathname}` }, 404);
  });

  await mockAuthenticatedUserState(page);

  return {
    getResponseRequest: () => responseRequest,
    getQmReviewRequest: () => qmReviewRequest,
    getQmApprovalCount: () => qmApprovalCount,
    getNotifyClientRequest: () => notifyClientRequest,
    getNotifyClientCount: () => notifyClientCount,
    getCloseRequest: () => closeRequest,
    getCloseCount: () => closeCount,
    getEvidenceRequest: () => evidenceRequest,
    getEvidenceUploadCount: () => evidenceUploadCount,
    getRectificationSubmitRequests: () => rectificationSubmitRequests,
    getRejectRectificationRequest: () => rejectRectificationRequest,
    getNcrLoadCount: () => ncrLoadCount,
  };
}

async function openSeededNcrRegister(page: Page) {
  const api = await mockSeededNcrApi(page);

  await page.goto(`/projects/${E2E_PROJECT_ID}/ncr`);

  const openRow = page.getByRole('row').filter({ hasText: 'NCR-E2E-001' });
  const majorRow = page.getByRole('row').filter({ hasText: 'NCR-E2E-002' });
  await expect(openRow).toBeVisible();
  await expect(majorRow).toBeVisible();

  return { api, openRow, majorRow };
}

async function submitNcrResponse(
  page: Page,
  openRow: Locator,
  response: {
    rootCauseDescription?: string;
    proposedCorrectiveAction?: string;
  } = {},
) {
  await openRow.getByRole('button', { name: 'Respond' }).click();
  const responseModal = page.getByRole('dialog').filter({ hasText: 'Respond to NCR NCR-E2E-001' });
  await responseModal.getByLabel('Root Cause Category *').selectOption('process');
  await responseModal
    .getByLabel('Root Cause Description *')
    .fill(
      response.rootCauseDescription ?? 'Compaction process was not followed during final pass.',
    );
  await responseModal
    .getByLabel('Proposed Corrective Action *')
    .fill(
      response.proposedCorrectiveAction ?? 'Rework the failed area and repeat compaction testing.',
    );
  await responseModal.getByRole('button', { name: 'Submit Response' }).click();
  await expect(openRow.getByRole('button', { name: 'Review Response' })).toBeVisible();
}

async function openReviewResponseDialog(page: Page, openRow: Locator) {
  await openRow.getByRole('button', { name: 'Review Response' }).click();
  return page.getByRole('dialog', { name: 'Review NCR Response' });
}

async function completeQmReview(
  page: Page,
  openRow: Locator,
  actionButton: 'Accept Response' | 'Request Revision',
  comments: string,
) {
  const reviewModal = await openReviewResponseDialog(page, openRow);
  await reviewModal.getByPlaceholder('Add feedback or comments...').fill(comments);
  await reviewModal.getByRole('button', { name: actionButton }).click();
}

async function approveMajorNcr(page: Page, majorRow: Locator) {
  await majorRow.getByRole('button', { name: 'QM Approve' }).click();
  await expect(page.getByText('QM approval granted')).toBeVisible();
}

test.describe('NCR seeded lifecycle contract', () => {
  test('renders seeded NCRs, filters the register, submits a response, and approves a major NCR', async ({
    page,
  }) => {
    const api = await mockSeededNcrApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/ncr`);

    await expect(page.getByRole('heading', { name: 'Non-Conformance Reports' })).toBeVisible();
    await expect(page.getByText('Manage NCR lifecycle for this project')).toBeVisible();
    await expect(page.getByText('Your role:')).toBeVisible();
    await expect(page.getByText('quality_manager')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Raise NCR' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible();

    const openRow = page.getByRole('row').filter({ hasText: 'NCR-E2E-001' });
    await expect(openRow).toBeVisible();
    await expect(openRow.getByText('LOT-NCR-001')).toBeVisible();
    await expect(openRow.getByText('Compaction result failed in Lot 12')).toBeVisible();
    await expect(openRow.getByText('workmanship')).toBeVisible();
    await expect(openRow.getByText('open')).toBeVisible();
    await expect(openRow.getByText('E2E Foreman')).toBeVisible();
    await expect(openRow.getByRole('button', { name: 'Respond' })).toBeVisible();
    await expect(
      openRow.getByRole('button', { name: 'Copy link to NCR NCR-E2E-001' }),
    ).toBeVisible();

    const majorRow = page.getByRole('row').filter({ hasText: 'NCR-E2E-002' });
    await expect(majorRow).toBeVisible();
    await expect(majorRow.getByText('LOT-NCR-002')).toBeVisible();
    await expect(majorRow.getByText('Major concrete strength non-conformance')).toBeVisible();
    await expect(majorRow.getByText('materials')).toBeVisible();
    await expect(majorRow.getByText('verification')).toBeVisible();
    await expect(majorRow.getByText('E2E Concrete Subcontractor')).toBeVisible();
    await expect(majorRow.getByRole('button', { name: 'QM Approve' })).toBeVisible();
    await expect(majorRow.getByRole('button', { name: 'Notify Client' })).toBeVisible();
    await expect(majorRow.getByRole('button', { name: 'Close' })).toBeDisabled();

    await page.getByLabel('Category').selectOption('workmanship');
    await expect(page.getByText('Showing 1 of 2 NCRs')).toBeVisible();
    await expect(openRow).toBeVisible();
    await expect(majorRow).toBeHidden();

    await page.getByRole('button', { name: 'Clear Filters' }).click();
    await expect(majorRow).toBeVisible();

    await openRow.getByRole('button', { name: 'Respond' }).click();

    const modal = page.getByRole('dialog').filter({ hasText: 'Respond to NCR NCR-E2E-001' });
    await expect(modal.getByRole('heading', { name: 'Respond to NCR NCR-E2E-001' })).toBeVisible();
    await expect(modal.getByText('Issue:')).toBeVisible();
    await expect(modal.getByText('Compaction result failed in Lot 12')).toBeVisible();

    await modal.getByLabel('Root Cause Category *').selectOption('process');
    await modal
      .getByLabel('Root Cause Description *')
      .fill('  Compaction process was not followed during final pass.  ');
    await modal
      .getByLabel('Proposed Corrective Action *')
      .fill('  Rework the failed area and repeat compaction testing.  ');
    await modal.getByRole('button', { name: 'Submit Response' }).click();

    expect(api.getResponseRequest()).toMatchObject({
      rootCauseCategory: 'process',
      rootCauseDescription: 'Compaction process was not followed during final pass.',
      proposedCorrectiveAction: 'Rework the failed area and repeat compaction testing.',
    });
    await expect(
      page.getByText('NCR response submitted - status changed to Investigating'),
    ).toBeVisible();
    await expect(openRow.getByText('investigating')).toBeVisible();
    await expect(openRow.getByRole('button', { name: 'Review Response' })).toBeVisible();

    await majorRow.getByRole('button', { name: 'QM Approve' }).click();
    expect(api.getQmApprovalCount()).toBe(1);
    await expect(page.getByText('QM approval granted')).toBeVisible();
    await expect(majorRow.getByRole('button', { name: 'Close' })).toBeEnabled();
  });

  test('surfaces NCR load failures with retry and no false empty state', async ({ page }) => {
    const api = await mockSeededNcrApi(page, { failNcrLoadsUntil: 2 });

    await page.goto(`/projects/${E2E_PROJECT_ID}/ncr`);

    const alert = page.getByRole('alert');
    await expect(alert).toContainText('NCR register unavailable');
    await expect(page.getByText('No NCRs found')).toHaveCount(0);

    await alert.getByRole('button', { name: 'Try again' }).click();

    await expect(page.getByRole('row').filter({ hasText: 'NCR-E2E-001' })).toBeVisible();
    expect(api.getNcrLoadCount()).toBeGreaterThanOrEqual(2);
  });

  test('guards duplicate major NCR approval clicks', async ({ page }) => {
    const { api, majorRow } = await openSeededNcrRegister(page);

    await majorRow.getByRole('button', { name: 'QM Approve' }).dblclick();

    await expect(page.getByText('QM approval granted')).toBeVisible();
    expect(api.getQmApprovalCount()).toBe(1);
    await expect(majorRow.getByRole('button', { name: 'Close' })).toBeEnabled();
  });

  test('reviews a response, notifies the client, and closes a major NCR', async ({ page }) => {
    const { api, openRow, majorRow } = await openSeededNcrRegister(page);

    await submitNcrResponse(page, openRow);

    const reviewModal = await openReviewResponseDialog(page, openRow);
    await expect(reviewModal.getByText('Submitted Response:')).toBeVisible();
    await expect(
      reviewModal.getByText('Compaction process was not followed during final pass.'),
    ).toBeVisible();
    await reviewModal
      .getByPlaceholder('Add feedback or comments...')
      .fill('Response accepted for rectification.');
    await reviewModal.getByRole('button', { name: 'Accept Response' }).click();

    await expect
      .poll(() => api.getQmReviewRequest())
      .toMatchObject({
        action: 'accept',
        comments: 'Response accepted for rectification.',
      });
    await expect(page.getByText('Response accepted, NCR moved to rectification')).toBeVisible();
    await expect(openRow.getByText('Rectification', { exact: true })).toBeVisible();
    await expect(openRow.getByRole('button', { name: 'Submit Rectification' })).toBeVisible();

    await approveMajorNcr(page, majorRow);
    await expect(majorRow.getByRole('button', { name: 'Close' })).toBeEnabled();

    await majorRow.getByRole('button', { name: 'Notify Client' }).click();
    const notifyModal = page.getByRole('dialog', { name: 'Notify Client - Major NCR' });
    await notifyModal.getByPlaceholder('Enter client email address').fill('client@example.com');
    await notifyModal
      .getByPlaceholder('Add any additional context for the client...')
      .fill('Major concrete strength NCR ready for client notification.');
    await notifyModal.getByRole('button', { name: 'Send Notification' }).click();

    await expect.poll(() => api.getNotifyClientCount()).toBe(1);
    expect(api.getNotifyClientRequest()).toEqual({
      recipientEmail: 'client@example.com',
      additionalMessage: 'Major concrete strength NCR ready for client notification.',
    });
    await expect(page.getByText('Client Notified', { exact: true })).toBeVisible();
    await expect(majorRow.getByText('✓ Client Notified')).toBeVisible();

    await majorRow.getByRole('button', { name: 'Close' }).click();
    const closeDialog = page.getByRole('dialog', { name: 'Close NCR NCR-E2E-002' });
    await closeDialog
      .getByPlaceholder('Notes about the verification and closure...')
      .fill('Closure evidence verified in E2E.');
    await closeDialog
      .getByPlaceholder(
        'What lessons can be learned from this NCR? How can similar issues be prevented in the future?',
      )
      .fill('Add concrete strength hold point before future pours.');
    await closeDialog.getByRole('button', { name: 'Close NCR' }).click();

    await expect.poll(() => api.getCloseCount()).toBe(1);
    expect(api.getCloseRequest()).toEqual({
      verificationNotes: 'Closure evidence verified in E2E.',
      lessonsLearned: 'Add concrete strength hold point before future pours.',
    });
    await expect(page.getByText('Major NCR closed successfully with QM approval')).toBeVisible();
    await expect(majorRow.getByText('closed')).toBeVisible();
  });

  test('requests response revision then accepts the revised response', async ({ page }) => {
    const { api, openRow } = await openSeededNcrRegister(page);

    await submitNcrResponse(page, openRow, {
      rootCauseDescription: 'Initial root cause is too vague.',
      proposedCorrectiveAction: 'Initial corrective action is too vague.',
    });
    await completeQmReview(
      page,
      openRow,
      'Request Revision',
      'Root cause analysis is insufficient.',
    );

    await expect
      .poll(() => api.getQmReviewRequest())
      .toMatchObject({
        action: 'request_revision',
        comments: 'Root cause analysis is insufficient.',
      });
    await expect(page.getByText('Revision requested for NCR response')).toBeVisible();
    await expect(openRow.getByText('open')).toBeVisible();
    await expect(openRow.getByRole('button', { name: 'Respond' })).toBeVisible();

    await submitNcrResponse(page, openRow);
    await completeQmReview(page, openRow, 'Accept Response', 'Revised response accepted.');

    await expect
      .poll(() => api.getQmReviewRequest())
      .toMatchObject({
        action: 'accept',
        comments: 'Revised response accepted.',
      });
    await expect(openRow.getByText('Rectification', { exact: true })).toBeVisible();
  });

  test('uploads rectification evidence, rejects verification, then resubmits', async ({ page }) => {
    const { api, openRow } = await openSeededNcrRegister(page);

    await submitNcrResponse(page, openRow);
    await completeQmReview(
      page,
      openRow,
      'Accept Response',
      'Response accepted for rectification.',
    );
    await expect(openRow.getByRole('button', { name: 'Submit Rectification' })).toBeVisible();

    await openRow.getByRole('button', { name: 'Submit Rectification' }).click();
    let rectifyDialog = page.getByRole('dialog', { name: 'Submit Rectification Evidence' });
    await expect(
      rectifyDialog.getByRole('button', { name: 'Submit for Verification' }),
    ).toBeDisabled();
    await rectifyDialog.locator('input[accept="image/*"]').setInputFiles({
      name: 'rectification-photo.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake image'),
    });
    await expect.poll(() => api.getEvidenceUploadCount()).toBe(1);
    await expect
      .poll(() => api.getEvidenceRequest())
      .toMatchObject({
        documentId: E2E_NCR_EVIDENCE_DOCUMENT_ID,
        evidenceType: 'photo',
      });
    await expect(rectifyDialog.getByText('rectification-photo.jpg')).toBeVisible();
    await rectifyDialog
      .getByPlaceholder('Describe the corrective actions taken...')
      .fill('Rework completed and compaction retest attached.');
    await rectifyDialog.getByRole('button', { name: 'Submit for Verification' }).click();

    await expect.poll(() => api.getRectificationSubmitRequests()).toHaveLength(1);
    expect(api.getRectificationSubmitRequests()[0]).toEqual({
      rectificationNotes: 'Rework completed and compaction retest attached.',
    });
    await expect(openRow.getByText('Verification', { exact: true })).toBeVisible();
    await expect(openRow.getByRole('button', { name: 'Reject' })).toBeVisible();

    await openRow.getByRole('button', { name: 'Reject' }).click();
    const rejectDialog = page.getByRole('dialog').filter({ hasText: 'Reject Rectification' });
    await rejectDialog
      .getByPlaceholder(
        'Describe the issues with the rectification and what needs to be addressed...',
      )
      .fill('Retest certificate needs clearer chainage reference.');
    await rejectDialog.getByRole('button', { name: 'Reject Rectification' }).click();

    await expect
      .poll(() => api.getRejectRectificationRequest())
      .toEqual({
        feedback: 'Retest certificate needs clearer chainage reference.',
      });
    await expect(openRow.getByText('Rectification', { exact: true })).toBeVisible();
    await expect(openRow.getByRole('button', { name: 'Submit Rectification' })).toBeVisible();

    await openRow.getByRole('button', { name: 'Submit Rectification' }).click();
    rectifyDialog = page.getByRole('dialog', { name: 'Submit Rectification Evidence' });
    await expect(rectifyDialog.getByText('rectification-photo.jpg')).toBeVisible();
    await rectifyDialog
      .getByPlaceholder('Describe the corrective actions taken...')
      .fill('Updated retest certificate references chainage 10.200 to 10.260.');
    await expect(
      rectifyDialog.getByRole('button', { name: 'Submit for Verification' }),
    ).toBeEnabled();
    await rectifyDialog.getByRole('button', { name: 'Submit for Verification' }).click();

    await expect.poll(() => api.getRectificationSubmitRequests()).toHaveLength(2);
    expect(api.getRectificationSubmitRequests()[1]).toEqual({
      rectificationNotes: 'Updated retest certificate references chainage 10.200 to 10.260.',
    });
    await expect(openRow.getByText('Verification', { exact: true })).toBeVisible();
  });

  test('closes a major NCR with concession and client approval reference', async ({ page }) => {
    const { api, majorRow } = await openSeededNcrRegister(page);

    await approveMajorNcr(page, majorRow);

    await majorRow.getByRole('button', { name: 'Concession' }).click();
    const concessionDialog = page.getByRole('dialog', { name: 'Close NCR with Concession' });
    await concessionDialog
      .getByPlaceholder('Describe why the non-conformance cannot be fully rectified...')
      .fill('Full demolition is disproportionate after engineering review.');
    await concessionDialog
      .getByPlaceholder(
        'Describe the risk implications, mitigation measures, and impact on quality/safety...',
      )
      .fill('Residual risk accepted with additional monthly inspections.');
    await concessionDialog
      .getByPlaceholder('e.g., Email ref, Letter ID, Document number...')
      .fill('CLIENT-APPROVAL-42');
    await concessionDialog
      .getByLabel(
        'I confirm that the client has been notified of this concession and has provided documented approval to proceed.',
      )
      .check();
    await concessionDialog
      .getByPlaceholder('Any additional verification notes...')
      .fill('Accepted under concession after client approval.');
    await concessionDialog.getByRole('button', { name: 'Close with Concession' }).click();

    await expect.poll(() => api.getCloseCount()).toBe(1);
    expect(api.getCloseRequest()).toEqual({
      withConcession: true,
      concessionJustification: 'Full demolition is disproportionate after engineering review.',
      concessionRiskAssessment: 'Residual risk accepted with additional monthly inspections.',
      clientApprovalReference: 'CLIENT-APPROVAL-42',
      verificationNotes: 'Accepted under concession after client approval.',
    });
    await expect(page.getByText('NCR closed with concession successfully')).toBeVisible();
    await expect(majorRow.getByText('Closed (Concession)')).toBeVisible();
  });

  test('opens the create dialog from the mounted NCR create query', async ({ page }) => {
    await mockSeededNcrApi(page);

    await page.goto(`/projects/${E2E_PROJECT_ID}/ncr?create=1`);

    await expect(page).toHaveURL(`/projects/${E2E_PROJECT_ID}/ncr`);
    const modal = page.getByRole('dialog', { name: 'Raise Non-Conformance Report' });
    await expect(
      modal.getByRole('heading', { name: 'Raise Non-Conformance Report' }),
    ).toBeVisible();
    await expect(modal.getByLabel('LOT-NCR-001 - Northbound formation')).toBeVisible();
  });
});
