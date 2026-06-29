// NCR workflow transitions: respond, rectify, review, reject, close, notify, reopen
import { Router, type Request, type Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { type AuthUser } from '../../lib/auth.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { assertProjectAllowsWrite } from '../../lib/projectAccess.js';
import {
  NCR_QUALITY_MANAGEMENT_ROLES,
  parseNcrRouteParam,
  requireActiveProjectUser,
  requireNcrResponsibleOrProjectRole,
} from './ncrAccess.js';
import { AuditAction, createAuditLog } from '../../lib/auditLog.js';
import {
  buildNcrWorkflowMessageResponse,
  buildNcrWorkflowResponse,
} from './ncrWorkflowResponses.js';
import {
  qmReviewSchema,
  rectifyNcrSchema,
  rejectRectificationSchema,
  respondNcrSchema,
} from './ncrWorkflowValidation.js';
import { ncrClosureWorkflowRouter } from './ncrClosureWorkflow.js';
import { claimNcrVerificationSubmission } from './ncrVerificationSubmission.js';
import { notifySubcontractorNcrPortalUsers } from './ncrNotifications.js';

const qmReviewedNcrInclude = {
  project: { select: { name: true } },
  raisedBy: { select: { fullName: true, email: true } },
  responsibleUser: { select: { fullName: true, email: true } },
} as const;

export const ncrWorkflowRouter = Router();

// POST /api/ncrs/:id/respond - Submit response to NCR
ncrWorkflowRouter.post(
  '/:id/respond',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const validation = respondNcrSchema.safeParse(req.body);
    if (!validation.success) {
      throw AppError.fromZodError(validation.error);
    }

    const user = req.user as AuthUser;
    const id = parseNcrRouteParam(req.params.id, 'id');
    const { rootCauseCategory, rootCauseDescription, proposedCorrectiveAction } = validation.data;

    const ncr = await prisma.nCR.findUnique({
      where: { id },
    });

    if (!ncr) {
      throw AppError.notFound('NCR not found');
    }

    await requireNcrResponsibleOrProjectRole(
      ncr,
      user,
      'Only the responsible party or project quality roles can respond to NCRs',
    );

    if (ncr.status !== 'open') {
      throw AppError.badRequest('NCR is not in open status');
    }

    const responseUpdate = await prisma.nCR.updateMany({
      where: { id, status: 'open' },
      data: {
        status: 'investigating',
        rootCauseCategory,
        rootCauseDescription,
        proposedCorrectiveAction,
        responseSubmittedAt: new Date(),
      },
    });
    if (responseUpdate.count !== 1) {
      throw AppError.badRequest('NCR is not in open status');
    }

    const updatedNcr = await prisma.nCR.findUniqueOrThrow({
      where: { id },
    });

    await createAuditLog({
      projectId: ncr.projectId,
      userId: user.userId,
      entityType: 'ncr',
      entityId: ncr.id,
      action: AuditAction.NCR_STATUS_CHANGED,
      changes: {
        ncrNumber: ncr.ncrNumber,
        status: { from: ncr.status, to: updatedNcr.status },
        rootCauseCategoryPresent: Boolean(rootCauseCategory),
        rootCauseDescriptionPresent: Boolean(rootCauseDescription),
        proposedCorrectiveActionPresent: Boolean(proposedCorrectiveAction),
      },
      req,
    });

    res.json(buildNcrWorkflowResponse(updatedNcr));
  }),
);

// Feature #215: POST /api/ncrs/:id/qm-review - QM reviews the NCR response
ncrWorkflowRouter.post(
  '/:id/qm-review',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const validation = qmReviewSchema.safeParse(req.body);
    if (!validation.success) {
      throw AppError.fromZodError(validation.error);
    }

    const user = req.user as AuthUser;
    const id = parseNcrRouteParam(req.params.id, 'id');
    const { action, comments } = validation.data; // action: 'accept' or 'request_revision'

    const ncr = await prisma.nCR.findUnique({
      where: { id },
      include: {
        project: true,
        responsibleUser: { select: { id: true, fullName: true, email: true } },
      },
    });

    if (!ncr) {
      throw AppError.notFound('NCR not found');
    }

    const isAcceptedRetry =
      action === 'accept' && ncr.status === 'rectification' && ncr.qmReviewedAt !== null;

    // Must be in 'investigating' status (after response submitted), except for idempotent
    // accept retries that return the already-reviewed NCR without mutating timestamps.
    if (!isAcceptedRetry && ncr.status !== 'investigating') {
      throw AppError.badRequest('NCR must be in investigating status to review');
    }

    await requireActiveProjectUser(
      ncr.projectId,
      user,
      'Only project quality roles can review NCR responses',
      NCR_QUALITY_MANAGEMENT_ROLES,
    );
    await assertProjectAllowsWrite(ncr.projectId);

    if (isAcceptedRetry) {
      const acceptedNcr = await prisma.nCR.findUniqueOrThrow({
        where: { id },
        include: qmReviewedNcrInclude,
      });

      res.json(
        buildNcrWorkflowMessageResponse(
          acceptedNcr,
          'Response already accepted, NCR is in rectification',
        ),
      );
      return;
    }

    // Get reviewer info for notifications
    const reviewer = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { fullName: true, email: true },
    });
    const reviewerName = reviewer?.fullName || reviewer?.email || 'QM';

    if (action === 'accept') {
      // Accept response - proceed to rectification status
      const reviewTime = new Date();
      const reviewResult = await prisma.nCR.updateMany({
        where: { id, status: 'investigating', qmReviewedAt: null },
        data: {
          status: 'rectification',
          qmReviewedAt: reviewTime,
          qmReviewedById: user.userId,
          qmReviewComments: comments || null,
          revisionRequested: false,
        },
      });

      if (reviewResult.count === 0) {
        const acceptedNcr = await prisma.nCR.findFirst({
          where: { id, status: 'rectification', qmReviewedAt: { not: null } },
          include: qmReviewedNcrInclude,
        });

        if (acceptedNcr) {
          res.json(
            buildNcrWorkflowMessageResponse(
              acceptedNcr,
              'Response already accepted, NCR is in rectification',
            ),
          );
          return;
        }

        throw AppError.badRequest('NCR must be in investigating status to review');
      }

      const updatedNcr = await prisma.nCR.findUniqueOrThrow({
        where: { id },
        include: {
          ...qmReviewedNcrInclude,
        },
      });

      // Notify responsible party that response was accepted
      if (ncr.responsibleUserId) {
        await prisma.notification.create({
          data: {
            userId: ncr.responsibleUserId,
            projectId: ncr.projectId,
            type: 'ncr_response_accepted',
            title: `NCR Response Accepted`,
            message: `${reviewerName} has accepted your response for ${ncr.ncrNumber}. Please proceed with rectification.`,
            linkUrl: `/projects/${ncr.projectId}/ncr`,
          },
        });
      }
      if (ncr.responsibleSubcontractorId) {
        await notifySubcontractorNcrPortalUsers({
          projectId: ncr.projectId,
          subcontractorCompanyId: ncr.responsibleSubcontractorId,
          ncrId: ncr.id,
          type: 'ncr_response_accepted',
          title: 'NCR Response Accepted',
          message: `${reviewerName} has accepted your response for ${ncr.ncrNumber}. Please proceed with rectification.`,
        });
      }

      await createAuditLog({
        projectId: ncr.projectId,
        userId: user.userId,
        entityType: 'ncr',
        entityId: ncr.id,
        action: AuditAction.NCR_STATUS_CHANGED,
        changes: {
          ncrNumber: ncr.ncrNumber,
          status: { from: ncr.status, to: updatedNcr.status },
          qmReviewAction: 'accept',
          commentsPresent: Boolean(comments),
        },
        req,
      });

      res.json(
        buildNcrWorkflowMessageResponse(
          updatedNcr,
          'Response accepted, NCR proceeds to rectification',
        ),
      );
    } else {
      // Request revision - send back to responsible party
      const revisionUpdate = await prisma.nCR.updateMany({
        where: { id, status: 'investigating' },
        data: {
          status: 'open', // Reset to open for revision
          qmReviewedAt: new Date(),
          qmReviewedById: user.userId,
          qmReviewComments: comments || 'Revision requested',
          revisionRequested: true,
          revisionRequestedAt: new Date(),
          revisionCount: { increment: 1 },
          // Clear previous response fields for re-entry
          rootCauseCategory: null,
          rootCauseDescription: null,
          proposedCorrectiveAction: null,
          responseSubmittedAt: null,
        },
      });
      if (revisionUpdate.count !== 1) {
        throw AppError.badRequest('NCR must be in investigating status to review');
      }

      const updatedNcr = await prisma.nCR.findUniqueOrThrow({
        where: { id },
        include: {
          project: { select: { name: true } },
          raisedBy: { select: { fullName: true, email: true } },
          responsibleUser: { select: { fullName: true, email: true } },
        },
      });

      // Notify responsible party about revision request
      if (ncr.responsibleUserId) {
        await prisma.notification.create({
          data: {
            userId: ncr.responsibleUserId,
            projectId: ncr.projectId,
            type: 'ncr_revision_requested',
            title: `NCR Revision Requested`,
            message: `${reviewerName} has requested a revision for ${ncr.ncrNumber}. Feedback: ${comments || 'Please review and resubmit.'}`,
            linkUrl: `/projects/${ncr.projectId}/ncr`,
          },
        });
      }
      if (ncr.responsibleSubcontractorId) {
        await notifySubcontractorNcrPortalUsers({
          projectId: ncr.projectId,
          subcontractorCompanyId: ncr.responsibleSubcontractorId,
          ncrId: ncr.id,
          type: 'ncr_revision_requested',
          title: 'NCR Revision Requested',
          message: `${reviewerName} has requested a revision for ${ncr.ncrNumber}. Feedback: ${comments || 'Please review and resubmit.'}`,
        });
      }

      await createAuditLog({
        projectId: ncr.projectId,
        userId: user.userId,
        entityType: 'ncr',
        entityId: ncr.id,
        action: AuditAction.NCR_STATUS_CHANGED,
        changes: {
          ncrNumber: ncr.ncrNumber,
          status: { from: ncr.status, to: updatedNcr.status },
          qmReviewAction: 'request_revision',
          commentsPresent: Boolean(comments),
          revisionRequested: true,
          revisionCount: updatedNcr.revisionCount,
        },
        req,
      });

      res.json(
        buildNcrWorkflowMessageResponse(
          updatedNcr,
          'Revision requested, feedback sent to responsible party',
        ),
      );
    }
  }),
);

// POST /api/ncrs/:id/rectify - Submit rectification evidence
ncrWorkflowRouter.post(
  '/:id/rectify',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const validation = rectifyNcrSchema.safeParse(req.body);
    if (!validation.success) {
      throw AppError.fromZodError(validation.error);
    }

    const user = req.user as AuthUser;
    const id = parseNcrRouteParam(req.params.id, 'id');
    const { rectificationNotes } = validation.data;

    const ncr = await prisma.nCR.findUnique({
      where: { id },
      include: {
        ncrEvidence: {
          select: { id: true },
        },
      },
    });

    if (!ncr) {
      throw AppError.notFound('NCR not found');
    }

    await requireNcrResponsibleOrProjectRole(
      ncr,
      user,
      'Only the responsible party or project quality roles can submit NCR rectification',
    );

    if (ncr.status !== 'investigating' && ncr.status !== 'rectification') {
      throw AppError.badRequest('NCR is not ready for rectification');
    }

    if (ncr.ncrEvidence.length === 0) {
      throw AppError.badRequest(
        'Please upload at least one piece of evidence before submitting for verification',
        { evidenceCount: 0 },
      );
    }

    await claimNcrVerificationSubmission({
      ncrId: id,
      rectificationNotes,
      submittedAt: new Date(),
    });

    const updatedNcr = await prisma.nCR.findUniqueOrThrow({
      where: { id },
    });

    await createAuditLog({
      projectId: ncr.projectId,
      userId: user.userId,
      entityType: 'ncr',
      entityId: ncr.id,
      action: AuditAction.NCR_STATUS_CHANGED,
      changes: {
        ncrNumber: ncr.ncrNumber,
        status: { from: ncr.status, to: updatedNcr.status },
        rectificationNotesPresent: Boolean(rectificationNotes),
        evidenceCount: ncr.ncrEvidence.length,
      },
      req,
    });

    res.json(buildNcrWorkflowResponse(updatedNcr));
  }),
);

// Feature #218: POST /api/ncrs/:id/reject-rectification - Reject rectification and return to RECTIFICATION status
ncrWorkflowRouter.post(
  '/:id/reject-rectification',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const validation = rejectRectificationSchema.safeParse(req.body);
    if (!validation.success) {
      throw AppError.fromZodError(validation.error);
    }

    const user = req.user as AuthUser;
    const id = parseNcrRouteParam(req.params.id, 'id');
    const { feedback } = validation.data;

    const ncr = await prisma.nCR.findUnique({
      where: { id },
      include: {
        project: true,
        responsibleUser: { select: { id: true, fullName: true, email: true } },
      },
    });

    if (!ncr) {
      throw AppError.notFound('NCR not found');
    }

    // Must be in 'verification' status
    if (ncr.status !== 'verification') {
      throw AppError.badRequest('NCR must be in verification status to reject rectification');
    }

    await requireActiveProjectUser(
      ncr.projectId,
      user,
      'Only project quality roles can reject rectification',
      NCR_QUALITY_MANAGEMENT_ROLES,
    );
    await assertProjectAllowsWrite(ncr.projectId);

    // Get reviewer info for notifications
    const reviewer = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { fullName: true, email: true },
    });
    const reviewerName = reviewer?.fullName || reviewer?.email || 'QM';

    // Return NCR to rectification status
    const rejectUpdate = await prisma.nCR.updateMany({
      where: { id, status: 'verification' },
      data: {
        status: 'rectification',
        verificationNotes: feedback,
        verifiedAt: null,
        verifiedById: null,
        revisionRequested: true,
        revisionRequestedAt: new Date(),
        revisionCount: { increment: 1 },
      },
    });
    if (rejectUpdate.count !== 1) {
      throw AppError.badRequest('NCR must be in verification status to reject rectification');
    }

    const updatedNcr = await prisma.nCR.findUniqueOrThrow({
      where: { id },
      include: {
        project: { select: { name: true } },
        raisedBy: { select: { fullName: true, email: true } },
        responsibleUser: { select: { fullName: true, email: true } },
      },
    });

    // Notify responsible party about rejection
    if (ncr.responsibleUserId) {
      await prisma.notification.create({
        data: {
          userId: ncr.responsibleUserId,
          projectId: ncr.projectId,
          type: 'ncr_rectification_rejected',
          title: `Rectification Rejected`,
          message: `${reviewerName} has rejected the rectification for ${ncr.ncrNumber}. Feedback: ${feedback.substring(0, 100)}${feedback.length > 100 ? '...' : ''}`,
          linkUrl: `/projects/${ncr.projectId}/ncr`,
        },
      });
    }
    if (ncr.responsibleSubcontractorId) {
      await notifySubcontractorNcrPortalUsers({
        projectId: ncr.projectId,
        subcontractorCompanyId: ncr.responsibleSubcontractorId,
        ncrId: ncr.id,
        type: 'ncr_rectification_rejected',
        title: 'Rectification Rejected',
        message: `${reviewerName} has rejected the rectification for ${ncr.ncrNumber}. Feedback: ${feedback.substring(0, 100)}${feedback.length > 100 ? '...' : ''}`,
      });
    }

    await createAuditLog({
      projectId: ncr.projectId,
      userId: user.userId,
      entityType: 'ncr',
      entityId: ncr.id,
      action: AuditAction.NCR_STATUS_CHANGED,
      changes: {
        ncrNumber: ncr.ncrNumber,
        status: { from: ncr.status, to: updatedNcr.status },
        feedbackPresent: Boolean(feedback),
        revisionRequested: true,
        revisionCount: updatedNcr.revisionCount,
      },
      req,
    });

    res.json(
      buildNcrWorkflowMessageResponse(
        updatedNcr,
        'Rectification rejected, NCR returned to rectification status',
      ),
    );
  }),
);

ncrWorkflowRouter.use(ncrClosureWorkflowRouter);
