import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { sendNotificationIfEnabled } from '../notifications.js';
import { createAuditLog, AuditAction } from '../../lib/auditLog.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { getEffectiveProjectRole } from '../../lib/projectAccess.js';
import { isProjectNotificationEnabled } from '../../lib/projectNotificationPreferences.js';
import {
  TEST_CREATORS,
  TEST_VERIFIERS,
  requireTestProjectRole,
  requireTestResultReadAccess,
} from './accessControl.js';
import {
  hasRecordedResult,
  RESULT_REQUIRED_CODE,
  RESULT_REQUIRED_MESSAGE,
  STATUS_LABELS,
  VALID_STATUS_TRANSITIONS,
} from './statusWorkflow.js';
import {
  buildTestResultAlreadyVerifiedResponse,
  buildTestResultRejectedResponse,
  buildTestResultRejectionNotification,
  buildTestResultVerifiedResponse,
} from './verificationResponses.js';
import {
  buildTestResultReceivedEmail,
  buildTestResultReceivedNotification,
} from './statusNotifications.js';
import {
  buildTestResultStatusUpdatedResponse,
  buildTestResultWorkflowResponse,
} from './workflowResponse.js';
import {
  MAX_REJECTION_REASON_LENGTH,
  normalizeRequiredString,
  parseTestResultRouteParam,
} from './validation.js';

export const workflowRoutes = Router();

// Ticket T2: a test cannot become 'entered' or 'verified' until it carries a
// real result value AND a definitive pass/fail outcome. Throws the same
// AppError style as the B2 CERTIFICATE_REQUIRED gate so the global error handler
// returns a 400 with a clear, code-tagged message.
function assertResultRecorded(testResult: { resultValue: unknown; passFail: unknown }) {
  if (!hasRecordedResult(testResult)) {
    throw new AppError(400, RESULT_REQUIRED_MESSAGE, RESULT_REQUIRED_CODE);
  }
}

// POST /api/test-results/:id/reject - Reject a test result verification (Feature #204)
workflowRoutes.post(
  '/:id/reject',
  asyncHandler(async (req, res) => {
    const id = parseTestResultRouteParam(req.params.id, 'id');
    const user = req.user!;
    const reason = normalizeRequiredString(req.body.reason, 'reason', MAX_REJECTION_REASON_LENGTH);

    const testResult = await prisma.testResult.findUnique({
      where: { id },
      include: {
        enteredBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    if (!testResult) {
      throw AppError.notFound('Test result');
    }

    await requireTestProjectRole(
      testResult.projectId,
      user,
      TEST_VERIFIERS,
      'You do not have permission to reject test results',
    );

    // Can only reject tests that are in 'entered' status (pending verification)
    if (testResult.status !== 'entered') {
      throw AppError.badRequest(
        `Cannot reject a test result with status '${testResult.status}'. Only tests in 'Entered' status can be rejected.`,
      );
    }

    // Reset status back to 'results_received' so engineer can re-enter
    const updatedTestResult = await prisma.testResult.update({
      where: { id },
      data: {
        status: 'results_received',
        rejectedById: user.id,
        rejectedAt: new Date(),
        rejectionReason: reason,
        // Clear verification fields
        verifiedById: null,
        verifiedAt: null,
        // Clear entered fields so engineer can re-enter
        enteredById: null,
        enteredAt: null,
      },
      select: {
        id: true,
        testType: true,
        status: true,
        rejectedAt: true,
        rejectionReason: true,
        rejectedBy: {
          select: {
            fullName: true,
            email: true,
          },
        },
        enteredBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    const engineerNotified = buildTestResultRejectionNotification(testResult, reason);

    // Audit log for test result rejection
    await createAuditLog({
      projectId: testResult.projectId,
      userId: user.id,
      entityType: 'test_result',
      entityId: id,
      action: AuditAction.TEST_RESULT_REJECTED,
      changes: { reason, previousStatus: testResult.status },
      req,
    });

    res.json(buildTestResultRejectedResponse(updatedTestResult, engineerNotified));
  }),
);

// POST /api/test-results/:id/verify - Verify a test result (quality management)
workflowRoutes.post(
  '/:id/verify',
  asyncHandler(async (req, res) => {
    const id = parseTestResultRouteParam(req.params.id, 'id');
    const user = req.user!;

    const testResult = await prisma.testResult.findUnique({
      where: { id },
    });

    if (!testResult) {
      throw AppError.notFound('Test result');
    }

    await requireTestProjectRole(
      testResult.projectId,
      user,
      TEST_VERIFIERS,
      'You do not have permission to verify test results',
    );

    if (testResult.status === 'verified') {
      const existingVerifiedTestResult = await prisma.testResult.findUniqueOrThrow({
        where: { id },
        select: {
          id: true,
          testType: true,
          status: true,
          verifiedAt: true,
          verifiedBy: {
            select: {
              fullName: true,
              email: true,
            },
          },
        },
      });

      return res.json(buildTestResultAlreadyVerifiedResponse(existingVerifiedTestResult));
    }

    // Feature #883: Require certificate before verification
    if (!testResult.certificateDocId) {
      throw new AppError(
        400,
        'A test certificate must be uploaded before the test result can be verified.',
        'CERTIFICATE_REQUIRED',
      );
    }

    // Ticket T2: never verify a blank/pending result. The full row is loaded
    // above (no `select`), so resultValue/passFail are available here.
    assertResultRecorded(testResult);

    const updatedTestResult = await prisma.testResult.update({
      where: { id },
      data: {
        status: 'verified',
        verifiedById: user.id,
        verifiedAt: new Date(),
      },
      select: {
        id: true,
        testType: true,
        status: true,
        verifiedAt: true,
        verifiedBy: {
          select: {
            fullName: true,
            email: true,
          },
        },
      },
    });

    // Audit log for test result verification
    await createAuditLog({
      projectId: testResult.projectId,
      userId: user.id,
      entityType: 'test_result',
      entityId: id,
      action: AuditAction.TEST_RESULT_VERIFIED,
      changes: { status: 'verified' },
      req,
    });

    res.json(buildTestResultVerifiedResponse(updatedTestResult));
  }),
);

// POST /api/test-results/:id/status - Update test result status (Feature #196)
workflowRoutes.post(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const id = parseTestResultRouteParam(req.params.id, 'id');
    const user = req.user!;
    const status = normalizeRequiredString(req.body.status, 'status', 40);

    if (!Object.prototype.hasOwnProperty.call(STATUS_LABELS, status)) {
      throw AppError.badRequest('status must be a valid test result status');
    }

    const testResult = await prisma.testResult.findUnique({
      where: { id },
    });

    if (!testResult) {
      throw AppError.notFound('Test result');
    }

    const userProjectRole = await getEffectiveProjectRole(user, testResult.projectId, {
      excludeSubcontractorProjectMemberships: true,
      throwIfProjectMissing: true,
    });

    // Verification requires higher permission
    if (status === 'verified' && (!userProjectRole || !TEST_VERIFIERS.includes(userProjectRole))) {
      throw AppError.forbidden('You do not have permission to verify test results');
    }

    // Other status changes require creator permission
    if (status !== 'verified' && (!userProjectRole || !TEST_CREATORS.includes(userProjectRole))) {
      throw AppError.forbidden('You do not have permission to update test result status');
    }

    // Validate the status transition
    const currentStatus = testResult.status;
    const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus] || [];

    if (!allowedTransitions.includes(status)) {
      throw AppError.badRequest(
        `Cannot transition from '${STATUS_LABELS[currentStatus] || currentStatus}' to '${STATUS_LABELS[status] || status}'`,
        {
          currentStatus: currentStatus,
          allowedTransitions: allowedTransitions.map((s) => ({
            status: s,
            label: STATUS_LABELS[s] || s,
          })),
        },
      );
    }

    // Feature #883: Require certificate before verification
    if (status === 'verified' && !testResult.certificateDocId) {
      throw new AppError(
        400,
        'A test certificate must be uploaded before the test result can be verified.',
        'CERTIFICATE_REQUIRED',
      );
    }

    // Ticket T2: 'entered' must mean "has a real result", and 'verified' inherits
    // that requirement. Block the old no-data "Enter Results" click here. The
    // full row is loaded above, so resultValue/passFail are available.
    if (status === 'entered' || status === 'verified') {
      assertResultRecorded(testResult);
    }

    // Build update data based on the new status
    const updateData: Prisma.TestResultUncheckedUpdateInput = { status };

    // If entering 'entered' status, record who entered and when
    if (status === 'entered') {
      updateData.enteredById = user.id;
      updateData.enteredAt = new Date();
    }

    // If entering 'verified' status, record who verified and when
    if (status === 'verified') {
      updateData.verifiedById = user.id;
      updateData.verifiedAt = new Date();
    }

    const updatedTestResult = await prisma.testResult.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        testType: true,
        status: true,
        enteredAt: true,
        verifiedAt: true,
        enteredBy: {
          select: {
            fullName: true,
            email: true,
          },
        },
        verifiedBy: {
          select: {
            fullName: true,
            email: true,
          },
        },
      },
    });

    // Feature #933 - Notify engineers when test results are received (pending verification)
    if (status === 'results_received' && currentStatus !== 'results_received') {
      try {
        // Get project info
        const project = await prisma.project.findUnique({
          where: { id: testResult.projectId },
          select: { id: true, name: true, settings: true },
        });

        // Respect the project-level "Test Results" notification toggle. When an
        // admin turns this category off, skip both the in-app records and the
        // emails for everyone. Absent/missing settings default to on. The audit
        // log below still runs regardless.
        if (isProjectNotificationEnabled(project?.settings, 'testResults')) {
          // Get active site engineers
          const siteEngineers = await prisma.projectUser.findMany({
            where: {
              projectId: testResult.projectId,
              role: 'site_engineer',
              status: 'active',
            },
          });

          // Get user details for engineers
          const engineerUserIds = siteEngineers.map((se) => se.userId);
          const engineerUsers =
            engineerUserIds.length > 0
              ? await prisma.user.findMany({
                  where: { id: { in: engineerUserIds } },
                  select: { id: true, email: true, fullName: true },
                })
              : [];

          // Get laboratory name for more context
          const testWithLab = await prisma.testResult.findUnique({
            where: { id },
            select: { laboratoryName: true, testRequestNumber: true },
          });
          const labName = testWithLab?.laboratoryName || 'laboratory';
          const requestNum = testWithLab?.testRequestNumber || id.substring(0, 8).toUpperCase();

          // Create in-app notifications for site engineers
          const notificationsToCreate = engineerUsers.map((eng) =>
            buildTestResultReceivedNotification({
              userId: eng.id,
              projectId: testResult.projectId,
              testResultId: id,
              testType: testResult.testType,
              requestNumber: requestNum,
              labName,
            }),
          );

          if (notificationsToCreate.length > 0) {
            await prisma.notification.createMany({
              data: notificationsToCreate,
            });
          }

          // Send email notifications
          for (const eng of engineerUsers) {
            await sendNotificationIfEnabled(
              eng.id,
              'enabled',
              buildTestResultReceivedEmail({
                projectId: testResult.projectId,
                testResultId: id,
                projectName: project?.name,
                testType: testResult.testType,
                requestNumber: requestNum,
                labName,
              }),
            );
          }
        }
      } catch {
        // Don't fail the main request if notifications fail
      }
    }

    // Audit log for test result status change
    await createAuditLog({
      projectId: testResult.projectId,
      userId: user.id,
      entityType: 'test_result',
      entityId: id,
      action: AuditAction.TEST_RESULT_STATUS_CHANGED,
      changes: { previousStatus: currentStatus, newStatus: status },
      req,
    });

    res.json(buildTestResultStatusUpdatedResponse(status, updatedTestResult));
  }),
);

// GET /api/test-results/:id/workflow - Get workflow status info (Feature #196)
workflowRoutes.get(
  '/:id/workflow',
  asyncHandler(async (req, res) => {
    const id = parseTestResultRouteParam(req.params.id, 'id');
    const user = req.user!;

    const testResult = await prisma.testResult.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        projectId: true,
        lotId: true,
        enteredAt: true,
        verifiedAt: true,
        createdAt: true,
        enteredBy: {
          select: { fullName: true },
        },
        verifiedBy: {
          select: { fullName: true },
        },
      },
    });

    if (!testResult) {
      throw AppError.notFound('Test result');
    }

    await requireTestResultReadAccess(testResult, user);
    const userProjectRole = await getEffectiveProjectRole(user, testResult.projectId, {
      excludeSubcontractorProjectMemberships: true,
      throwIfProjectMissing: true,
    });

    res.json(
      buildTestResultWorkflowResponse(testResult, {
        canCreateTest: TEST_CREATORS.includes(userProjectRole || ''),
        canVerifyTest: TEST_VERIFIERS.includes(userProjectRole || ''),
      }),
    );
  }),
);
