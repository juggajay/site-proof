// NCR workflow transitions: respond, rectify, review, reject, close, notify, reopen
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { type AuthUser } from '../../lib/auth.js'
import { requireAuth } from '../../middleware/authMiddleware.js'

const respondNcrSchema = z.object({
  rootCauseCategory: z.string().optional(),
  rootCauseDescription: z.string().optional(),
  proposedCorrectiveAction: z.string().optional(),
})

const qmReviewSchema = z.object({
  action: z.enum(['accept', 'request_revision']),
  comments: z.string().optional(),
})

const rectifyNcrSchema = z.object({
  rectificationNotes: z.string().optional(),
})

const rejectRectificationSchema = z.object({
  feedback: z.string().min(1, 'Feedback is required when rejecting rectification'),
})

const closeNcrSchema = z.object({
  verificationNotes: z.string().optional(),
  lessonsLearned: z.string().optional(),
  withConcession: z.boolean().optional(),
  concessionJustification: z.string().optional(),
  concessionRiskAssessment: z.string().optional(),
})

const notifyClientSchema = z.object({
  recipientEmail: z.string().email().optional(),
  additionalMessage: z.string().optional(),
})

const reopenNcrSchema = z.object({
  reason: z.string().optional(),
})

const submitForVerificationSchema = z.object({
  rectificationNotes: z.string().optional(),
})

export const ncrWorkflowRouter = Router()

// POST /api/ncrs/:id/respond - Submit response to NCR
ncrWorkflowRouter.post('/:id/respond', requireAuth, async (req: any, res) => {
  try {
    const validation = respondNcrSchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.issues
      })
    }

    // Note: user authenticated via requireAuth middleware
    const { id } = req.params
    const { rootCauseCategory, rootCauseDescription, proposedCorrectiveAction } = validation.data

    const ncr = await prisma.nCR.findUnique({
      where: { id },
    })

    if (!ncr) {
      return res.status(404).json({ message: 'NCR not found' })
    }

    if (ncr.status !== 'open') {
      return res.status(400).json({ message: 'NCR is not in open status' })
    }

    const updatedNcr = await prisma.nCR.update({
      where: { id },
      data: {
        status: 'investigating',
        rootCauseCategory,
        rootCauseDescription,
        proposedCorrectiveAction,
        responseSubmittedAt: new Date(),
      },
    })

    res.json({ ncr: updatedNcr })
  } catch (error) {
    console.error('Respond to NCR error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Feature #215: POST /api/ncrs/:id/qm-review - QM reviews the NCR response
ncrWorkflowRouter.post('/:id/qm-review', requireAuth, async (req: any, res) => {
  try {
    const validation = qmReviewSchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.issues
      })
    }

    const user = req.user as AuthUser
    const { id } = req.params
    const { action, comments } = validation.data // action: 'accept' or 'request_revision'

    const ncr = await prisma.nCR.findUnique({
      where: { id },
      include: {
        project: true,
        responsibleUser: { select: { id: true, fullName: true, email: true } },
      },
    })

    if (!ncr) {
      return res.status(404).json({ message: 'NCR not found' })
    }

    // Must be in 'investigating' status (after response submitted)
    if (ncr.status !== 'investigating') {
      return res.status(400).json({ message: 'NCR must be in investigating status to review' })
    }

    // Check if user has QM role on this project
    const projectUser = await prisma.projectUser.findFirst({
      where: {
        projectId: ncr.projectId,
        userId: user.userId,
        role: { in: ['quality_manager', 'admin', 'project_manager'] },
      },
    })

    if (!projectUser) {
      return res.status(403).json({
        message: 'Only Quality Managers, Project Managers, or Admins can review NCR responses',
      })
    }

    // Get reviewer info for notifications
    const reviewer = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { fullName: true, email: true },
    })
    const reviewerName = reviewer?.fullName || reviewer?.email || 'QM'

    if (action === 'accept') {
      // Accept response - proceed to rectification status
      const updatedNcr = await prisma.nCR.update({
        where: { id },
        data: {
          status: 'rectification',
          qmReviewedAt: new Date(),
          qmReviewedById: user.userId,
          qmReviewComments: comments || null,
          revisionRequested: false,
        },
        include: {
          project: { select: { name: true } },
          raisedBy: { select: { fullName: true, email: true } },
          responsibleUser: { select: { fullName: true, email: true } },
        },
      })

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
        })
      }

      res.json({ ncr: updatedNcr, message: 'Response accepted, NCR proceeds to rectification' })
    } else {
      // Request revision - send back to responsible party
      const updatedNcr = await prisma.nCR.update({
        where: { id },
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
        include: {
          project: { select: { name: true } },
          raisedBy: { select: { fullName: true, email: true } },
          responsibleUser: { select: { fullName: true, email: true } },
        },
      })

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
        })
      }

      res.json({ ncr: updatedNcr, message: 'Revision requested, feedback sent to responsible party' })
    }
  } catch (error) {
    console.error('QM review NCR error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// POST /api/ncrs/:id/rectify - Submit rectification evidence
ncrWorkflowRouter.post('/:id/rectify', requireAuth, async (req: any, res) => {
  try {
    const validation = rectifyNcrSchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.issues
      })
    }

    const { id } = req.params
    const { rectificationNotes } = validation.data

    const ncr = await prisma.nCR.findUnique({
      where: { id },
    })

    if (!ncr) {
      return res.status(404).json({ message: 'NCR not found' })
    }

    if (ncr.status !== 'investigating' && ncr.status !== 'rectification') {
      return res.status(400).json({ message: 'NCR is not ready for rectification' })
    }

    const updatedNcr = await prisma.nCR.update({
      where: { id },
      data: {
        status: 'verification',
        rectificationNotes,
        rectificationSubmittedAt: new Date(),
      },
    })

    res.json({ ncr: updatedNcr })
  } catch (error) {
    console.error('Rectify NCR error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Feature #218: POST /api/ncrs/:id/reject-rectification - Reject rectification and return to RECTIFICATION status
ncrWorkflowRouter.post('/:id/reject-rectification', requireAuth, async (req: any, res) => {
  try {
    const validation = rejectRectificationSchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.issues
      })
    }

    const user = req.user as AuthUser
    const { id } = req.params
    const { feedback } = validation.data

    const ncr = await prisma.nCR.findUnique({
      where: { id },
      include: {
        project: true,
        responsibleUser: { select: { id: true, fullName: true, email: true } },
      },
    })

    if (!ncr) {
      return res.status(404).json({ message: 'NCR not found' })
    }

    // Must be in 'verification' status
    if (ncr.status !== 'verification') {
      return res.status(400).json({ message: 'NCR must be in verification status to reject rectification' })
    }

    // Check if user has QM/PM role on this project
    const projectUser = await prisma.projectUser.findFirst({
      where: {
        projectId: ncr.projectId,
        userId: user.userId,
        role: { in: ['quality_manager', 'admin', 'project_manager', 'site_manager'] },
      },
    })

    if (!projectUser) {
      return res.status(403).json({
        message: 'Only Quality Managers, Project Managers, or Admins can reject rectification',
      })
    }

    // Get reviewer info for notifications
    const reviewer = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { fullName: true, email: true },
    })
    const reviewerName = reviewer?.fullName || reviewer?.email || 'QM'

    // Return NCR to rectification status
    const updatedNcr = await prisma.nCR.update({
      where: { id },
      data: {
        status: 'rectification',
        verificationNotes: feedback,
        verifiedAt: null,
        verifiedById: null,
        revisionRequested: true,
        revisionRequestedAt: new Date(),
        revisionCount: { increment: 1 },
      },
      include: {
        project: { select: { name: true } },
        raisedBy: { select: { fullName: true, email: true } },
        responsibleUser: { select: { fullName: true, email: true } },
      },
    })

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
      })
    }

    res.json({
      ncr: updatedNcr,
      message: 'Rectification rejected, NCR returned to rectification status',
    })
  } catch (error) {
    console.error('Reject rectification error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// POST /api/ncrs/:id/qm-approve - QM approval for major NCRs (Quality Manager only)
ncrWorkflowRouter.post('/:id/qm-approve', requireAuth, async (req: any, res) => {
  try {
    const user = req.user as AuthUser
    const { id } = req.params

    const ncr = await prisma.nCR.findUnique({
      where: { id },
      include: {
        project: true,
      },
    })

    if (!ncr) {
      return res.status(404).json({ message: 'NCR not found' })
    }

    // Check if user has QM role on this project
    const projectUser = await prisma.projectUser.findFirst({
      where: {
        projectId: ncr.projectId,
        userId: user.userId,
      },
    })

    if (!projectUser) {
      return res.status(403).json({ message: 'Access denied' })
    }

    // Only Quality Managers can approve major NCRs
    const isQualityManager = projectUser.role === 'quality_manager' || projectUser.role === 'admin' || projectUser.role === 'project_manager'
    if (!isQualityManager) {
      return res.status(403).json({
        message: 'Only Quality Managers, Project Managers, or Admins can approve major NCR closures',
        requiresRole: 'quality_manager'
      })
    }

    if (!ncr.qmApprovalRequired) {
      return res.status(400).json({ message: 'This NCR does not require QM approval' })
    }

    if (ncr.qmApprovedAt) {
      return res.status(400).json({ message: 'This NCR has already been approved by QM' })
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
    })

    res.json({
      ncr: updatedNcr,
      message: 'QM approval granted. NCR can now be closed.'
    })
  } catch (error) {
    console.error('QM approve NCR error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// POST /api/ncrs/:id/close - Close NCR (requires QM approval for major NCRs)
ncrWorkflowRouter.post('/:id/close', requireAuth, async (req: any, res) => {
  try {
    const validation = closeNcrSchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.issues
      })
    }

    const user = req.user as AuthUser
    const { id } = req.params
    const { verificationNotes, lessonsLearned, withConcession, concessionJustification, concessionRiskAssessment } = validation.data

    const ncr = await prisma.nCR.findUnique({
      where: { id },
      include: {
        ncrLots: { select: { lotId: true } },
      },
    })

    if (!ncr) {
      return res.status(404).json({ message: 'NCR not found' })
    }

    // Check access
    const projectUser = await prisma.projectUser.findFirst({
      where: {
        projectId: ncr.projectId,
        userId: user.userId,
      },
    })

    if (!projectUser) {
      return res.status(403).json({ message: 'Access denied' })
    }

    // Check if NCR is in a state that can be closed
    if (ncr.status !== 'verification' && ncr.status !== 'rectification') {
      return res.status(400).json({
        message: 'NCR must be in verification or rectification status to close',
        currentStatus: ncr.status
      })
    }

    // CRITICAL: For major NCRs, require QM approval before closing
    if (ncr.severity === 'major' && ncr.qmApprovalRequired && !ncr.qmApprovedAt) {
      return res.status(403).json({
        message: 'Major NCRs require Quality Manager approval before closure. Please request QM approval first.',
        requiresQmApproval: true,
        severity: ncr.severity
      })
    }

    const closeStatus = withConcession ? 'closed_concession' : 'closed'

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
    })

    // Update affected lots - revert status from ncr_raised
    if (ncr.ncrLots.length > 0) {
      const lotIds = ncr.ncrLots.map(nl => nl.lotId)

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
        })

        if (otherOpenNcrs === 0) {
          // No other open NCRs, revert lot status
          await prisma.lot.update({
            where: { id: lotId },
            data: { status: 'in_progress' },
          })
        }
      }
    }

    res.json({
      ncr: updatedNcr,
      message: ncr.severity === 'major'
        ? 'Major NCR closed successfully with QM approval'
        : 'NCR closed successfully'
    })
  } catch (error) {
    console.error('Close NCR error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Feature #213: POST /api/ncrs/:id/notify-client - Notify client about major NCR
ncrWorkflowRouter.post('/:id/notify-client', requireAuth, async (req: any, res) => {
  try {
    const validation = notifyClientSchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.issues
      })
    }

    const user = req.user as AuthUser
    const { id } = req.params
    const { recipientEmail, additionalMessage } = validation.data

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
    })

    if (!ncr) {
      return res.status(404).json({ message: 'NCR not found' })
    }

    // Check if client notification is required (major NCR)
    if (!ncr.clientNotificationRequired) {
      return res.status(400).json({ message: 'Client notification not required for this NCR' })
    }

    // Check if already notified
    if (ncr.clientNotifiedAt) {
      return res.status(400).json({
        message: `Client was already notified on ${new Date(ncr.clientNotifiedAt).toLocaleDateString()}`,
      })
    }

    // Check access - only PM, QM, or admin can notify client
    const projectUser = await prisma.projectUser.findFirst({
      where: {
        projectId: ncr.projectId,
        userId: user.userId,
        role: { in: ['quality_manager', 'admin', 'project_manager', 'owner'] },
      },
    })

    if (!projectUser) {
      return res.status(403).json({
        message: 'Only Project Managers, Quality Managers, or Admins can notify client',
      })
    }

    // Get user details for notification
    const notifiedByUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { fullName: true, email: true },
    })

    // Generate notification package content
    const lotNumbers = ncr.ncrLots.map(nl => nl.lot.lotNumber).join(', ') || 'N/A'
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
    })

    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        userId: user.userId,
        action: 'NCR_CLIENT_NOTIFIED',
        entityType: 'NCR',
        entityId: ncr.id,
        changes: JSON.stringify({
          ncrNumber: ncr.ncrNumber,
          recipientEmail: recipientEmail || 'Not specified',
          notificationPackage,
        }),
      },
    })

    res.json({
      ncr: updatedNcr,
      notificationPackage,
      message: `Client notification sent for ${ncr.ncrNumber}`,
    })
  } catch (error) {
    console.error('Notify client error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// POST /api/ncrs/:id/reopen - Reopen a closed NCR
ncrWorkflowRouter.post('/:id/reopen', requireAuth, async (req: any, res) => {
  try {
    const validation = reopenNcrSchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.issues
      })
    }

    const user = req.user as AuthUser
    const { id } = req.params
    const { reason } = validation.data

    const ncr = await prisma.nCR.findUnique({
      where: { id },
    })

    if (!ncr) {
      return res.status(404).json({ message: 'NCR not found' })
    }

    if (ncr.status !== 'closed' && ncr.status !== 'closed_concession') {
      return res.status(400).json({ message: 'NCR is not closed' })
    }

    // Check access - only QM or admin can reopen
    const projectUser = await prisma.projectUser.findFirst({
      where: {
        projectId: ncr.projectId,
        userId: user.userId,
        role: { in: ['quality_manager', 'admin', 'project_manager'] },
      },
    })

    if (!projectUser) {
      return res.status(403).json({ message: 'Only Quality Managers can reopen NCRs' })
    }

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
        lessonsLearned: reason ? `[Reopened: ${reason}] ${ncr.lessonsLearned || ''}` : ncr.lessonsLearned,
      },
    })

    res.json({ ncr: updatedNcr })
  } catch (error) {
    console.error('Reopen NCR error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// POST /api/ncrs/:id/submit-for-verification - Submit rectification for verification
ncrWorkflowRouter.post('/:id/submit-for-verification', requireAuth, async (req: any, res) => {
  try {
    const validation = submitForVerificationSchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.issues
      })
    }

    const user = req.user as AuthUser
    const { id } = req.params
    const { rectificationNotes } = validation.data

    const ncr = await prisma.nCR.findUnique({
      where: { id },
      include: {
        ncrEvidence: true,
      },
    })

    if (!ncr) {
      return res.status(404).json({ message: 'NCR not found' })
    }

    // Check access
    const projectUser = await prisma.projectUser.findFirst({
      where: {
        projectId: ncr.projectId,
        userId: user.userId,
      },
    })

    if (!projectUser) {
      return res.status(403).json({ message: 'Access denied' })
    }

    // Check if NCR is in rectification status
    if (ncr.status !== 'rectification' && ncr.status !== 'investigating') {
      return res.status(400).json({
        message: 'NCR must be in rectification or investigating status to submit for verification',
        currentStatus: ncr.status,
      })
    }

    // Check if evidence has been uploaded
    if (ncr.ncrEvidence.length === 0) {
      return res.status(400).json({
        message: 'Please upload at least one piece of evidence before submitting for verification',
        evidenceCount: 0,
      })
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
    })

    res.json({
      ncr: updatedNcr,
      message: 'NCR submitted for verification successfully',
      evidenceCount: updatedNcr.ncrEvidence.length,
    })
  } catch (error) {
    console.error('Submit NCR for verification error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})
