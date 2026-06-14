// NCR closure workflow transitions: QM approval, closure, client notification, reopen
import { Router, type Request, type Response } from 'express';

import { type AuthUser } from '../../lib/auth.js';
import { AuditAction, createAuditLog } from '../../lib/auditLog.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { sendEmail } from '../../lib/email.js';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import {
  NCR_QUALITY_MANAGEMENT_ROLES,
  parseNcrRouteParam,
  requireActiveProjectUser,
  requireNcrResponsibleOrProjectRole,
} from './ncrAccess.js';
import {
  buildNcrClientNotificationResponse,
  buildNcrClosedResponse,
  buildNcrSubmittedForVerificationResponse,
  buildNcrWorkflowMessageResponse,
  buildNcrWorkflowResponse,
} from './ncrWorkflowResponses.js';
import {
  closeNcrSchema,
  notifyClientSchema,
  reopenNcrSchema,
  submitForVerificationSchema,
} from './ncrWorkflowValidation.js';

export const ncrClosureWorkflowRouter = Router();

// POST /api/ncrs/:id/qm-approve - QM approval for major NCRs (Quality Manager only)
ncrClosureWorkflowRouter.post(
  '/:id/qm-approve',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as AuthUser;
    const id = parseNcrRouteParam(req.params.id, 'id');

    const ncr = await prisma.nCR.findUnique({
      where: { id },
      include: {
        project: true,
      },
    });

    if (!ncr) {
      throw AppError.notFound('NCR not found');
    }

    await requireActiveProjectUser(
      ncr.projectId,
      user,
      'Only project quality roles can approve major NCR closures',
      NCR_QUALITY_MANAGEMENT_ROLES,
    );

    if (!ncr.qmApprovalRequired) {
      throw AppError.badRequest('This NCR does not require QM approval');
    }

    if (ncr.qmApprovedAt) {
      throw AppError.badRequest('This NCR has already been approved by QM');
    }

    const updatedNcr = await prisma.nCR.update({
      where: { id },
      data: {
        qmApprovedById: user.userId,
        qmApprovedAt: new Date(),
      },
      include: {
        qmApprovedBy: { select: { fullName: true, email: true } },
      },
    });

    await createAuditLog({
      projectId: ncr.projectId,
      userId: user.userId,
      entityType: 'ncr',
      entityId: ncr.id,
      action: AuditAction.NCR_QM_APPROVED,
      changes: {
        ncrNumber: ncr.ncrNumber,
        severity: ncr.severity,
        status: ncr.status,
        qmApprovalRequired: ncr.qmApprovalRequired,
        qmApproved: true,
      },
      req,
    });

    res.json(
      buildNcrWorkflowMessageResponse(updatedNcr, 'QM approval granted. NCR can now be closed.'),
    );
  }),
);

// POST /api/ncrs/:id/close - Close NCR (requires QM approval for major NCRs)
ncrClosureWorkflowRouter.post(
  '/:id/close',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const validation = closeNcrSchema.safeParse(req.body);
    if (!validation.success) {
      throw AppError.fromZodError(validation.error);
    }

    const user = req.user as AuthUser;
    const id = parseNcrRouteParam(req.params.id, 'id');
    const {
      verificationNotes,
      lessonsLearned,
      withConcession,
      concessionJustification,
      concessionRiskAssessment,
    } = validation.data;

    const ncr = await prisma.nCR.findUnique({
      where: { id },
      include: {
        ncrLots: { select: { lotId: true } },
      },
    });

    if (!ncr) {
      throw AppError.notFound('NCR not found');
    }

    await requireActiveProjectUser(
      ncr.projectId,
      user,
      'Only Quality Managers, Project Managers, or Admins can close NCRs',
      NCR_QUALITY_MANAGEMENT_ROLES,
    );

    // Closing is the final verification decision; rectification must be submitted first.
    if (ncr.status !== 'verification') {
      throw AppError.badRequest('NCR must be in verification status to close', {
        currentStatus: ncr.status,
      });
    }

    // CRITICAL: For major NCRs, require QM approval before closing
    if (ncr.severity === 'major' && ncr.qmApprovalRequired && !ncr.qmApprovedAt) {
      throw AppError.forbidden(
        'Major NCRs require Quality Manager approval before closure. Please request QM approval first.',
      );
    }

    const closeStatus = withConcession ? 'closed_concession' : 'closed';

    const updatedNcr = await prisma.nCR.update({
      where: { id },
      data: {
        status: closeStatus,
        verifiedById: user.userId,
        verifiedAt: new Date(),
        verificationNotes,
        closedById: user.userId,
        closedAt: new Date(),
        lessonsLearned,
        concessionJustification: withConcession ? concessionJustification : null,
        concessionRiskAssessment: withConcession ? concessionRiskAssessment : null,
      },
      include: {
        closedBy: { select: { fullName: true, email: true } },
        qmApprovedBy: { select: { fullName: true, email: true } },
      },
    });

    // Update affected lots - revert status from ncr_raised
    if (ncr.ncrLots.length > 0) {
      const lotIds = ncr.ncrLots.map((nl) => nl.lotId);

      // Check if any other open NCRs exist for these lots
      for (const lotId of lotIds) {
        const otherOpenNcrs = await prisma.nCRLot.count({
          where: {
            lotId,
            ncr: {
              id: { not: ncr.id },
              status: { notIn: ['closed', 'closed_concession'] },
            },
          },
        });

        if (otherOpenNcrs === 0) {
          // No other open NCRs, revert lot status
          await prisma.lot.update({
            where: { id: lotId },
            data: { status: 'in_progress' },
          });
        }
      }
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
        withConcession: Boolean(withConcession),
        verificationNotesPresent: Boolean(verificationNotes),
        lessonsLearnedPresent: Boolean(lessonsLearned),
        affectedLotCount: ncr.ncrLots.length,
      },
      req,
    });

    res.json(buildNcrClosedResponse(updatedNcr, ncr.severity));
  }),
);

// Feature #213: POST /api/ncrs/:id/notify-client - Notify client about major NCR
ncrClosureWorkflowRouter.post(
  '/:id/notify-client',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const validation = notifyClientSchema.safeParse(req.body);
    if (!validation.success) {
      throw AppError.fromZodError(validation.error);
    }

    const user = req.user as AuthUser;
    const id = parseNcrRouteParam(req.params.id, 'id');
    const { recipientEmail, additionalMessage } = validation.data;

    if (!recipientEmail) {
      throw AppError.badRequest('Recipient email is required to notify the client');
    }

    const ncr = await prisma.nCR.findUnique({
      where: { id },
      include: {
        project: { select: { name: true, projectNumber: true } },
        raisedBy: { select: { fullName: true, email: true } },
        ncrLots: {
          include: {
            lot: { select: { lotNumber: true, description: true } },
          },
        },
      },
    });

    if (!ncr) {
      throw AppError.notFound('NCR not found');
    }

    // Check if client notification is required (major NCR)
    if (!ncr.clientNotificationRequired) {
      throw AppError.badRequest('Client notification not required for this NCR');
    }

    // Check if already notified
    if (ncr.clientNotifiedAt) {
      throw AppError.badRequest(
        `Client was already notified on ${new Date(ncr.clientNotifiedAt).toLocaleDateString('en-AU')}`,
      );
    }

    await requireActiveProjectUser(
      ncr.projectId,
      user,
      'Only Project Managers, Quality Managers, or Admins can notify client',
      ['quality_manager', 'admin', 'project_manager', 'owner'],
    );

    // Get user details for notification
    const notifiedByUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { fullName: true, email: true },
    });

    // Generate notification package content
    const lotNumbers = ncr.ncrLots.map((nl) => nl.lot.lotNumber).join(', ') || 'N/A';
    const notificationPackage = {
      ncrNumber: ncr.ncrNumber,
      project: `${ncr.project.name} (${ncr.project.projectNumber})`,
      severity: ncr.severity,
      category: ncr.category,
      affectedLots: lotNumbers,
      description: ncr.description,
      specificationReference: ncr.specificationReference || 'N/A',
      raisedBy: ncr.raisedBy?.fullName || ncr.raisedBy?.email || 'Unknown',
      raisedAt: ncr.raisedAt,
      notifiedBy: notifiedByUser?.fullName || notifiedByUser?.email || 'Unknown',
      notifiedAt: new Date().toISOString(),
      additionalMessage: additionalMessage || null,
    };

    const emailResult = await sendEmail({
      to: recipientEmail,
      subject: `Major NCR notification: ${ncr.ncrNumber} - ${ncr.project.name}`,
      text: [
        `Major NCR notification: ${ncr.ncrNumber}`,
        '',
        `Project: ${notificationPackage.project}`,
        `Severity: ${notificationPackage.severity}`,
        `Category: ${notificationPackage.category}`,
        `Affected lots: ${notificationPackage.affectedLots}`,
        `Specification reference: ${notificationPackage.specificationReference}`,
        `Raised by: ${notificationPackage.raisedBy}`,
        `Raised at: ${new Date(ncr.raisedAt).toLocaleString('en-AU')}`,
        `Notified by: ${notificationPackage.notifiedBy}`,
        '',
        'Description:',
        ncr.description,
        ...(additionalMessage ? ['', 'Additional message:', additionalMessage] : []),
      ].join('\n'),
    });

    if (!emailResult.success) {
      throw AppError.internal('Client notification email could not be sent');
    }

    // Update NCR with notification timestamp
    const updatedNcr = await prisma.nCR.update({
      where: { id },
      data: {
        clientNotifiedAt: new Date(),
      },
      include: {
        project: { select: { name: true } },
        raisedBy: { select: { fullName: true, email: true } },
        ncrLots: {
          include: {
            lot: { select: { lotNumber: true, description: true } },
          },
        },
      },
    });

    await createAuditLog({
      projectId: ncr.projectId,
      userId: user.userId,
      entityType: 'ncr',
      entityId: ncr.id,
      action: AuditAction.NCR_CLIENT_NOTIFIED,
      changes: {
        ncrNumber: ncr.ncrNumber,
        severity: ncr.severity,
        affectedLotCount: ncr.ncrLots.length,
        recipientEmailPresent: Boolean(recipientEmail),
        additionalMessagePresent: Boolean(additionalMessage),
      },
      req,
    });

    res.json(buildNcrClientNotificationResponse(updatedNcr, notificationPackage, ncr.ncrNumber));
  }),
);

// POST /api/ncrs/:id/reopen - Reopen a closed NCR
ncrClosureWorkflowRouter.post(
  '/:id/reopen',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const validation = reopenNcrSchema.safeParse(req.body);
    if (!validation.success) {
      throw AppError.fromZodError(validation.error);
    }

    const user = req.user as AuthUser;
    const id = parseNcrRouteParam(req.params.id, 'id');
    const { reason } = validation.data;

    const ncr = await prisma.nCR.findUnique({
      where: { id },
    });

    if (!ncr) {
      throw AppError.notFound('NCR not found');
    }

    if (ncr.status !== 'closed' && ncr.status !== 'closed_concession') {
      throw AppError.badRequest('NCR is not closed');
    }

    await requireActiveProjectUser(ncr.projectId, user, 'Only Quality Managers can reopen NCRs', [
      'quality_manager',
      'admin',
      'project_manager',
    ]);

    const updatedNcr = await prisma.nCR.update({
      where: { id },
      data: {
        status: 'rectification',
        verifiedById: null,
        verifiedAt: null,
        verificationNotes: null,
        closedById: null,
        closedAt: null,
        qmApprovedById: null,
        qmApprovedAt: null,
        lessonsLearned: reason
          ? `[Reopened: ${reason}] ${ncr.lessonsLearned || ''}`
          : ncr.lessonsLearned,
      },
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
        reasonPresent: Boolean(reason),
      },
      req,
    });

    res.json(buildNcrWorkflowResponse(updatedNcr));
  }),
);

// POST /api/ncrs/:id/submit-for-verification - Submit rectification for verification
ncrClosureWorkflowRouter.post(
  '/:id/submit-for-verification',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const validation = submitForVerificationSchema.safeParse(req.body);
    if (!validation.success) {
      throw AppError.fromZodError(validation.error);
    }

    const user = req.user as AuthUser;
    const id = parseNcrRouteParam(req.params.id, 'id');
    const { rectificationNotes } = validation.data;

    const ncr = await prisma.nCR.findUnique({
      where: { id },
      include: {
        ncrEvidence: true,
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

    // Check if NCR is in rectification status
    if (ncr.status !== 'rectification' && ncr.status !== 'investigating') {
      throw AppError.badRequest(
        'NCR must be in rectification or investigating status to submit for verification',
        { currentStatus: ncr.status },
      );
    }

    // Check if evidence has been uploaded
    if (ncr.ncrEvidence.length === 0) {
      throw AppError.badRequest(
        'Please upload at least one piece of evidence before submitting for verification',
        { evidenceCount: 0 },
      );
    }

    const updatedNcr = await prisma.nCR.update({
      where: { id },
      data: {
        status: 'verification',
        rectificationNotes,
        rectificationSubmittedAt: new Date(),
      },
      include: {
        ncrEvidence: {
          include: {
            document: { select: { filename: true, fileUrl: true } },
          },
        },
      },
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
        submissionPath: 'submit-for-verification',
      },
      req,
    });

    res.json(buildNcrSubmittedForVerificationResponse(updatedNcr));
  }),
);
