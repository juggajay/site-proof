import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { type AuthUser } from '../lib/auth.js'
import { requireAuth } from '../middleware/authMiddleware.js'
import { parsePagination, getPaginationMeta, getPrismaSkipTake } from '../lib/pagination.js'

// Zod schemas for request validation
const createNcrSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  description: z.string().min(1, 'Description is required'),
  specificationReference: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  severity: z.enum(['minor', 'major']).optional(),
  responsibleUserId: z.string().optional(),
  dueDate: z.string().optional(),
  lotIds: z.array(z.string()).optional(),
})

const updateNcrSchema = z.object({
  responsibleUserId: z.string().nullable().optional(),
  comments: z.string().optional(),
})

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

const addEvidenceSchema = z.object({
  documentId: z.string().optional(),
  evidenceType: z.string().optional(),
  filename: z.string().optional(),
  fileUrl: z.string().optional(),
  fileSize: z.number().optional(),
  mimeType: z.string().optional(),
  caption: z.string().optional(),
  projectId: z.string().optional(),
})

const submitForVerificationSchema = z.object({
  rectificationNotes: z.string().optional(),
})

export const ncrsRouter = Router()

// GET /api/ncrs - List all NCRs for user's projects
ncrsRouter.get('/', requireAuth, async (req: any, res) => {
  try {
    const user = req.user as AuthUser
    const { projectId, status, severity, lotId } = req.query
    const { page, limit, sortBy, sortOrder } = parsePagination(req.query)
    const { skip, take } = getPrismaSkipTake(page, limit)

    // Get user details to check role
    const userDetails = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { roleInCompany: true },
    })

    // Get projects the user has access to
    const projectAccess = await prisma.projectUser.findMany({
      where: { userId: user.userId },
      select: { projectId: true, role: true },
    })

    const accessibleProjectIds = projectAccess.map(p => p.projectId)

    // Build filter
    const where: any = {
      projectId: { in: accessibleProjectIds },
    }

    if (projectId && accessibleProjectIds.includes(projectId)) {
      where.projectId = projectId
    }

    if (status) {
      where.status = status
    }

    if (severity) {
      where.severity = severity
    }

    // Filter by lotId - find NCRs linked to this lot
    if (lotId) {
      where.ncrLots = {
        some: {
          lotId: lotId as string,
        },
      }
    }

    // Subcontractors can see NCRs linked to lots assigned to their company OR assigned to them as responsible party
    if (userDetails?.roleInCompany === 'subcontractor' || userDetails?.roleInCompany === 'subcontractor_admin') {
      // Find the user's subcontractor company
      const subcontractorUser = await prisma.subcontractorUser.findFirst({
        where: { userId: user.userId },
        include: { subcontractorCompany: true },
      })

      if (subcontractorUser) {
        const subCompanyId = subcontractorUser.subcontractorCompanyId

        // Get lots assigned via LotSubcontractorAssignment (new model)
        const lotAssignments = await prisma.lotSubcontractorAssignment.findMany({
          where: {
            subcontractorCompanyId: subCompanyId,
            status: 'active',
          },
          select: { lotId: true }
        })
        const assignmentLotIds = lotAssignments.map(a => a.lotId)

        // Get lots assigned via legacy field
        const legacyLots = await prisma.lot.findMany({
          where: { assignedSubcontractorId: subCompanyId },
          select: { id: true },
        })
        const legacyLotIds = legacyLots.map(l => l.id)

        // Combine both sets of lot IDs
        const allAssignedLotIds = [...new Set([...assignmentLotIds, ...legacyLotIds])]

        // Feature #212: Allow subcontractors to see NCRs where they are the responsible party
        // OR NCRs linked to their assigned lots
        where.OR = [
          { responsibleUserId: user.userId }, // NCRs assigned to this user
          ...(allAssignedLotIds.length > 0 ? [{
            ncrLots: {
              some: {
                lotId: { in: allAssignedLotIds },
              },
            },
          }] : []),
        ]

        // If no assigned lots, only show NCRs where they're responsible
        if (allAssignedLotIds.length === 0) {
          where.OR = [{ responsibleUserId: user.userId }]
        }
      } else {
        // No subcontractor company found, but they may still be responsible for NCRs
        where.responsibleUserId = user.userId
      }
    }

    const [ncrs, total] = await Promise.all([
      prisma.nCR.findMany({
        where,
        skip,
        take,
        include: {
          project: { select: { name: true, projectNumber: true } },
          raisedBy: { select: { fullName: true, email: true } },
          responsibleUser: { select: { fullName: true, email: true } },
          ncrLots: {
            include: {
              lot: { select: { lotNumber: true, description: true } },
            },
          },
          qmApprovedBy: { select: { fullName: true, email: true } },
        },
        orderBy: sortBy ? { [sortBy]: sortOrder } : { createdAt: 'desc' },
      }),
      prisma.nCR.count({ where })
    ])

    res.json({
      data: ncrs,
      pagination: getPaginationMeta(total, page, limit),
      ncrs  // Backward compatibility
    })
  } catch (error) {
    console.error('List NCRs error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// GET /api/ncrs/:id - Get single NCR
ncrsRouter.get('/:id', requireAuth, async (req: any, res) => {
  try {
    const user = req.user as AuthUser
    const { id } = req.params

    const ncr = await prisma.nCR.findUnique({
      where: { id },
      include: {
        project: { select: { name: true, projectNumber: true } },
        raisedBy: { select: { fullName: true, email: true } },
        responsibleUser: { select: { fullName: true, email: true } },
        verifiedBy: { select: { fullName: true, email: true } },
        closedBy: { select: { fullName: true, email: true } },
        qmApprovedBy: { select: { fullName: true, email: true } },
        ncrLots: {
          include: {
            lot: { select: { id: true, lotNumber: true, description: true } },
          },
        },
        ncrEvidence: {
          include: {
            document: { select: { id: true, filename: true, fileUrl: true } },
          },
        },
      },
    })

    if (!ncr) {
      return res.status(404).json({ message: 'NCR not found' })
    }

    // Check access - user must have access to the project
    const hasAccess = await prisma.projectUser.findFirst({
      where: {
        projectId: ncr.projectId,
        userId: user.userId,
      },
    })

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' })
    }

    res.json({ ncr })
  } catch (error) {
    console.error('Get NCR error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// POST /api/ncrs - Create new NCR
ncrsRouter.post('/', requireAuth, async (req: any, res) => {
  try {
    const validation = createNcrSchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.issues
      })
    }

    const user = req.user as AuthUser
    const {
      projectId,
      description,
      specificationReference,
      category,
      severity,
      responsibleUserId,
      dueDate,
      lotIds,
    } = validation.data

    // Check project access
    const hasAccess = await prisma.projectUser.findFirst({
      where: {
        projectId,
        userId: user.userId,
      },
    })

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied to this project' })
    }

    // Generate NCR number
    const existingCount = await prisma.nCR.count({
      where: { projectId },
    })
    const ncrNumber = `NCR-${String(existingCount + 1).padStart(4, '0')}`

    // Major NCRs require QM approval to close and client notification
    const isMajor = severity === 'major'

    const ncr = await prisma.nCR.create({
      data: {
        projectId,
        ncrNumber,
        description,
        specificationReference,
        category,
        severity: severity || 'minor',
        qmApprovalRequired: isMajor,
        clientNotificationRequired: isMajor, // Feature #213: Major NCRs require client notification
        raisedById: user.userId,
        responsibleUserId,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        ncrLots: lotIds?.length
          ? {
              create: lotIds.map((lotId: string) => ({
                lotId,
              })),
            }
          : undefined,
      },
      include: {
        project: { select: { name: true } },
        raisedBy: { select: { fullName: true, email: true } },
        ncrLots: {
          include: {
            lot: { select: { lotNumber: true } },
          },
        },
      },
    })

    // Update affected lots status to ncr_raised
    if (lotIds?.length) {
      await prisma.lot.updateMany({
        where: { id: { in: lotIds } },
        data: { status: 'ncr_raised' },
      })
    }

    // Feature #212: Notify responsible party when assigned to NCR
    if (responsibleUserId && responsibleUserId !== user.userId) {
      const raisedByUser = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { fullName: true, email: true }
      })
      const raisedByName = raisedByUser?.fullName || raisedByUser?.email || 'Someone'

      await prisma.notification.create({
        data: {
          userId: responsibleUserId,
          projectId,
          type: 'ncr_assigned',
          title: `NCR Assigned to You`,
          message: `${raisedByName} assigned ${ncrNumber} to you: ${description.substring(0, 100)}${description.length > 100 ? '...' : ''}`,
          linkUrl: `/projects/${projectId}/ncr`,
        }
      })
    }

    // Notify head contractor users when a subcontractor raises an NCR
    // Check if the user is a subcontractor
    const raisedByUserInfo = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { roleInCompany: true, fullName: true, email: true }
    })

    if (raisedByUserInfo && ['subcontractor', 'subcontractor_admin'].includes(raisedByUserInfo.roleInCompany || '')) {
      // Get head contractor users (project managers, quality managers, admins) on this project
      const headContractorUsers = await prisma.projectUser.findMany({
        where: {
          projectId,
          role: { in: ['project_manager', 'quality_manager', 'admin', 'owner', 'site_manager'] },
          status: 'active',
        },
        select: { userId: true }
      })

      // Create notifications for head contractor users
      if (headContractorUsers.length > 0) {
        const raisedByName = raisedByUserInfo.fullName || raisedByUserInfo.email || 'A subcontractor'
        const lotNumbers = ncr.ncrLots.map(nl => nl.lot.lotNumber).join(', ') || 'No lots'

        await prisma.notification.createMany({
          data: headContractorUsers.map(pu => ({
            userId: pu.userId,
            projectId,
            type: 'ncr_raised',
            title: `NCR Raised by Subcontractor`,
            message: `${raisedByName} raised ${ncrNumber} for ${lotNumbers}: ${description.substring(0, 100)}${description.length > 100 ? '...' : ''}`,
            linkUrl: `/projects/${projectId}/ncr`,
          }))
        })
      }
    }

    res.status(201).json({ ncr })
  } catch (error) {
    console.error('Create NCR error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Feature #636: PATCH /api/ncrs/:id - Update NCR (including redirect to different responsible party)
ncrsRouter.patch('/:id', requireAuth, async (req: any, res) => {
  try {
    const validation = updateNcrSchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.issues
      })
    }

    // Note: user authenticated via requireAuth middleware
    const { id } = req.params
    const { responsibleUserId, comments } = validation.data

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

    // Build update data
    const updateData: any = {}

    // If responsibleUserId is being changed (redirect)
    if (responsibleUserId !== undefined && responsibleUserId !== ncr.responsibleUserId) {
      updateData.responsibleUserId = responsibleUserId || null

      // If redirecting to a new user, create a notification
      if (responsibleUserId) {
        try {
          await prisma.notification.create({
            data: {
              userId: responsibleUserId,
              projectId: ncr.projectId,
              type: 'ncr_redirect',
              title: 'NCR Redirected to You',
              message: `NCR #${ncr.ncrNumber} "${ncr.description.substring(0, 50)}..." has been redirected to you for response`,
              linkUrl: `/projects/${ncr.projectId}/ncr`,
            }
          })
        } catch (notifError) {
          console.error('Failed to create redirect notification:', notifError)
        }
      }
    }

    // If comments are provided, add them as revision comments
    if (comments) {
      updateData.qmComments = comments
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'No fields to update' })
    }

    const updatedNcr = await prisma.nCR.update({
      where: { id },
      data: updateData,
      include: {
        responsibleUser: { select: { id: true, fullName: true, email: true } },
        raisedBy: { select: { id: true, fullName: true, email: true } },
        ncrLots: {
          include: {
            lot: { select: { id: true, lotNumber: true } },
          },
        },
      },
    })

    res.json({ ncr: updatedNcr, message: 'NCR updated' })
  } catch (error) {
    console.error('Update NCR error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// POST /api/ncrs/:id/respond - Submit response to NCR
ncrsRouter.post('/:id/respond', requireAuth, async (req: any, res) => {
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
ncrsRouter.post('/:id/qm-review', requireAuth, async (req: any, res) => {
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
ncrsRouter.post('/:id/rectify', requireAuth, async (req: any, res) => {
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
ncrsRouter.post('/:id/reject-rectification', requireAuth, async (req: any, res) => {
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
ncrsRouter.post('/:id/qm-approve', requireAuth, async (req: any, res) => {
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
ncrsRouter.post('/:id/close', requireAuth, async (req: any, res) => {
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
ncrsRouter.post('/:id/notify-client', requireAuth, async (req: any, res) => {
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

    // In development mode, log the notification package
    console.log('\n========================================')
    console.log('📧 CLIENT NOTIFICATION (Development Mode)')
    console.log('========================================')
    console.log('NCR:', ncr.ncrNumber)
    console.log('Recipient:', recipientEmail || '[No email provided]')
    console.log('Notification Package:', JSON.stringify(notificationPackage, null, 2))
    console.log('========================================\n')

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
ncrsRouter.post('/:id/reopen', requireAuth, async (req: any, res) => {
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

// POST /api/ncrs/:id/evidence - Add evidence to NCR
ncrsRouter.post('/:id/evidence', requireAuth, async (req: any, res) => {
  try {
    const validation = addEvidenceSchema.safeParse(req.body)
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.issues
      })
    }

    const user = req.user as AuthUser
    const { id } = req.params
    const { documentId, evidenceType, filename, fileUrl, fileSize, mimeType, caption, projectId: _providedProjectId } = validation.data

    const ncr = await prisma.nCR.findUnique({
      where: { id },
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

    // If documentId is provided, link existing document
    // Otherwise, create a new document first
    let finalDocumentId = documentId

    if (!documentId) {
      // Create a new document for this evidence
      if (!filename || !fileUrl) {
        return res.status(400).json({ message: 'Either documentId or filename and fileUrl are required' })
      }

      const document = await prisma.document.create({
        data: {
          projectId: ncr.projectId,
          documentType: evidenceType || 'ncr_evidence',
          category: 'ncr_evidence',
          filename,
          fileUrl,
          fileSize,
          mimeType,
          uploadedById: user.userId,
          caption,
        },
      })
      finalDocumentId = document.id
    }

    // Create the NCR evidence link
    const evidence = await prisma.nCREvidence.create({
      data: {
        ncrId: id,
        documentId: finalDocumentId!,
        evidenceType: evidenceType || 'photo',
      },
      include: {
        document: {
          select: {
            id: true,
            filename: true,
            fileUrl: true,
            mimeType: true,
            uploadedAt: true,
          },
        },
      },
    })

    res.status(201).json({
      evidence,
      message: 'Evidence added to NCR successfully',
    })
  } catch (error) {
    console.error('Add NCR evidence error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// GET /api/ncrs/:id/evidence - List evidence for NCR
ncrsRouter.get('/:id/evidence', requireAuth, async (req: any, res) => {
  try {
    const user = req.user as AuthUser
    const { id } = req.params

    const ncr = await prisma.nCR.findUnique({
      where: { id },
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

    const evidence = await prisma.nCREvidence.findMany({
      where: { ncrId: id },
      include: {
        document: {
          select: {
            id: true,
            filename: true,
            fileUrl: true,
            mimeType: true,
            fileSize: true,
            uploadedAt: true,
            uploadedBy: { select: { fullName: true, email: true } },
            caption: true,
          },
        },
      },
      orderBy: { uploadedAt: 'desc' },
    })

    // Group by evidence type
    const grouped = {
      photos: evidence.filter(e => e.evidenceType === 'photo'),
      certificates: evidence.filter(e => e.evidenceType === 'certificate' || e.evidenceType === 'retest_certificate'),
      documents: evidence.filter(e => !['photo', 'certificate', 'retest_certificate'].includes(e.evidenceType)),
      all: evidence,
    }

    res.json({
      evidence: grouped.all,
      grouped,
      count: evidence.length,
    })
  } catch (error) {
    console.error('List NCR evidence error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// DELETE /api/ncrs/:id/evidence/:evidenceId - Remove evidence from NCR
ncrsRouter.delete('/:id/evidence/:evidenceId', requireAuth, async (req: any, res) => {
  try {
    const user = req.user as AuthUser
    const { id, evidenceId } = req.params

    const ncr = await prisma.nCR.findUnique({
      where: { id },
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

    // Check if NCR is not closed
    if (ncr.status === 'closed' || ncr.status === 'closed_concession') {
      return res.status(400).json({ message: 'Cannot remove evidence from a closed NCR' })
    }

    await prisma.nCREvidence.delete({
      where: { id: evidenceId },
    })

    res.json({ message: 'Evidence removed successfully' })
  } catch (error) {
    console.error('Remove NCR evidence error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// POST /api/ncrs/:id/submit-for-verification - Submit rectification for verification
ncrsRouter.post('/:id/submit-for-verification', requireAuth, async (req: any, res) => {
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

// GET /api/ncrs/analytics/:projectId - Get NCR analytics for a project
ncrsRouter.get('/analytics/:projectId', requireAuth, async (req: any, res) => {
  try {
    const user = req.user as AuthUser
    const { projectId } = req.params
    const { startDate, endDate } = req.query

    // Check access
    const projectUser = await prisma.projectUser.findFirst({
      where: {
        projectId,
        userId: user.userId,
      },
    })

    if (!projectUser) {
      return res.status(403).json({ message: 'Access denied' })
    }

    // Build date filter
    const dateFilter: any = {}
    if (startDate) {
      dateFilter.gte = new Date(startDate as string)
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate as string)
    }

    const where: any = { projectId }
    if (Object.keys(dateFilter).length > 0) {
      where.raisedAt = dateFilter
    }

    // Get all NCRs for analytics
    const ncrs = await prisma.nCR.findMany({
      where,
      select: {
        id: true,
        ncrNumber: true,
        status: true,
        severity: true,
        category: true,
        rootCauseCategory: true,
        raisedAt: true,
        closedAt: true,
        dueDate: true,
        responsibleSubcontractorId: true,
        description: true,
      },
    })

    // Root cause breakdown
    const rootCauseBreakdown: Record<string, number> = {}
    ncrs.forEach(ncr => {
      const cause = ncr.rootCauseCategory || 'Not categorized'
      rootCauseBreakdown[cause] = (rootCauseBreakdown[cause] || 0) + 1
    })

    // Category breakdown
    const categoryBreakdown: Record<string, number> = {}
    ncrs.forEach(ncr => {
      const cat = ncr.category || 'Uncategorized'
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1
    })

    // Severity breakdown
    const severityBreakdown: Record<string, number> = {
      minor: 0,
      major: 0,
    }
    ncrs.forEach(ncr => {
      severityBreakdown[ncr.severity] = (severityBreakdown[ncr.severity] || 0) + 1
    })

    // Status breakdown
    const statusBreakdown: Record<string, number> = {}
    ncrs.forEach(ncr => {
      statusBreakdown[ncr.status] = (statusBreakdown[ncr.status] || 0) + 1
    })

    // Calculate metrics
    const totalNCRs = ncrs.length
    const openNCRs = ncrs.filter(n => !['closed', 'closed_concession'].includes(n.status)).length
    const closedNCRs = ncrs.filter(n => ['closed', 'closed_concession'].includes(n.status)).length
    const overdueNCRs = ncrs.filter(n => {
      if (!n.dueDate || ['closed', 'closed_concession'].includes(n.status)) return false
      return new Date(n.dueDate) < new Date()
    }).length

    // Average time to close (for closed NCRs)
    const closedWithDates = ncrs.filter(n => n.closedAt && n.raisedAt)
    let avgDaysToClose = 0
    if (closedWithDates.length > 0) {
      const totalDays = closedWithDates.reduce((sum, n) => {
        const diff = new Date(n.closedAt!).getTime() - new Date(n.raisedAt).getTime()
        return sum + diff / (1000 * 60 * 60 * 24)
      }, 0)
      avgDaysToClose = Math.round(totalDays / closedWithDates.length * 10) / 10
    }

    // Format for chart data
    const rootCauseChartData = Object.entries(rootCauseBreakdown).map(([name, value]) => ({
      name,
      value,
      percentage: Math.round((value / totalNCRs) * 100)
    })).sort((a, b) => b.value - a.value)

    const categoryChartData = Object.entries(categoryBreakdown).map(([name, value]) => ({
      name,
      value,
      percentage: Math.round((value / totalNCRs) * 100)
    })).sort((a, b) => b.value - a.value)

    // Closure time trend - group by month
    const closureTimeTrend: Record<string, { totalDays: number; count: number }> = {}
    closedWithDates.forEach(ncr => {
      const closedMonth = new Date(ncr.closedAt!).toISOString().substring(0, 7) // YYYY-MM format
      const daysToClose = (new Date(ncr.closedAt!).getTime() - new Date(ncr.raisedAt).getTime()) / (1000 * 60 * 60 * 24)

      if (!closureTimeTrend[closedMonth]) {
        closureTimeTrend[closedMonth] = { totalDays: 0, count: 0 }
      }
      closureTimeTrend[closedMonth].totalDays += daysToClose
      closureTimeTrend[closedMonth].count += 1
    })

    const closureTimeTrendData = Object.entries(closureTimeTrend)
      .map(([month, data]) => ({
        month,
        avgDays: Math.round(data.totalDays / data.count * 10) / 10,
        count: data.count
      }))
      .sort((a, b) => a.month.localeCompare(b.month))

    // NCR volume trend - group by month
    const volumeTrend: Record<string, number> = {}
    ncrs.forEach(ncr => {
      const raisedMonth = new Date(ncr.raisedAt).toISOString().substring(0, 7)
      volumeTrend[raisedMonth] = (volumeTrend[raisedMonth] || 0) + 1
    })

    const volumeTrendData = Object.entries(volumeTrend)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month))

    // Feature #475: Repeat issue identification
    // Group NCRs by category + root cause to identify repeat issues
    const repeatIssueGroups: Record<string, {
      category: string
      rootCause: string
      ncrs: { id: string; ncrNumber: string; raisedAt: Date; status: string }[]
      count: number
    }> = {}

    ncrs.forEach(ncr => {
      const category = ncr.category || 'Uncategorized'
      const rootCause = ncr.rootCauseCategory || 'Not categorized'
      const key = `${category}::${rootCause}`

      if (!repeatIssueGroups[key]) {
        repeatIssueGroups[key] = {
          category,
          rootCause,
          ncrs: [],
          count: 0
        }
      }
      repeatIssueGroups[key].ncrs.push({
        id: ncr.id,
        ncrNumber: ncr.ncrNumber,
        raisedAt: ncr.raisedAt,
        status: ncr.status
      })
      repeatIssueGroups[key].count++
    })

    // Filter to only show groups with 2+ NCRs (actual repeats)
    const repeatIssues = Object.values(repeatIssueGroups)
      .filter(group => group.count >= 2)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10) // Top 10 repeat issues

    // Also identify subcontractors with repeat issues
    const subcontractorIssues: Record<string, {
      subcontractorId: string
      ncrCount: number
      ncrIds: string[]
      categories: string[]
    }> = {}

    ncrs.forEach(ncr => {
      if (ncr.responsibleSubcontractorId) {
        const subId = ncr.responsibleSubcontractorId
        if (!subcontractorIssues[subId]) {
          subcontractorIssues[subId] = {
            subcontractorId: subId,
            ncrCount: 0,
            ncrIds: [],
            categories: []
          }
        }
        subcontractorIssues[subId].ncrCount++
        subcontractorIssues[subId].ncrIds.push(ncr.id)
        if (!subcontractorIssues[subId].categories.includes(ncr.category || 'Uncategorized')) {
          subcontractorIssues[subId].categories.push(ncr.category || 'Uncategorized')
        }
      }
    })

    // Filter to subcontractors with 2+ NCRs
    const repeatOffenders = Object.values(subcontractorIssues)
      .filter(sub => sub.ncrCount >= 2)
      .sort((a, b) => b.ncrCount - a.ncrCount)

    res.json({
      summary: {
        total: totalNCRs,
        open: openNCRs,
        closed: closedNCRs,
        overdue: overdueNCRs,
        avgDaysToClose,
        closureRate: totalNCRs > 0 ? Math.round((closedNCRs / totalNCRs) * 100) : 0,
      },
      charts: {
        rootCause: {
          title: 'NCRs by Root Cause',
          data: rootCauseChartData,
        },
        category: {
          title: 'NCRs by Category',
          data: categoryChartData,
        },
        severity: {
          title: 'NCRs by Severity',
          data: Object.entries(severityBreakdown).map(([name, value]) => ({
            name,
            value,
            percentage: totalNCRs > 0 ? Math.round((value / totalNCRs) * 100) : 0
          })),
        },
        status: {
          title: 'NCRs by Status',
          data: Object.entries(statusBreakdown).map(([name, value]) => ({
            name,
            value,
            percentage: totalNCRs > 0 ? Math.round((value / totalNCRs) * 100) : 0
          })),
        },
        closureTimeTrend: {
          title: 'Average Closure Time Trend',
          description: 'Average days to close NCRs by month',
          data: closureTimeTrendData,
          overallAvg: avgDaysToClose,
        },
        volumeTrend: {
          title: 'NCR Volume Trend',
          description: 'Number of NCRs raised by month',
          data: volumeTrendData,
        },
      },
      drillDown: {
        // Provide NCR IDs for each root cause for drill-down capability
        rootCause: Object.fromEntries(
          Object.keys(rootCauseBreakdown).map(cause => [
            cause,
            ncrs.filter(n => (n.rootCauseCategory || 'Not categorized') === cause).map(n => n.id)
          ])
        ),
        category: Object.fromEntries(
          Object.keys(categoryBreakdown).map(cat => [
            cat,
            ncrs.filter(n => (n.category || 'Uncategorized') === cat).map(n => n.id)
          ])
        ),
      },
      // Feature #475: Repeat issue identification
      repeatIssues: {
        title: 'Repeat Issues',
        description: 'NCRs grouped by category and root cause showing recurring problems',
        data: repeatIssues,
        totalRepeatGroups: repeatIssues.length,
      },
      repeatOffenders: {
        title: 'Subcontractors with Multiple NCRs',
        description: 'Subcontractors responsible for 2 or more NCRs',
        data: repeatOffenders,
      },
    })
  } catch (error) {
    console.error('NCR analytics error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// Helper endpoint to get user's role on a project
ncrsRouter.get('/check-role/:projectId', requireAuth, async (req: any, res) => {
  try {
    const user = req.user as AuthUser
    const { projectId } = req.params

    const projectUser = await prisma.projectUser.findFirst({
      where: {
        projectId,
        userId: user.userId,
      },
      select: {
        role: true,
      },
    })

    if (!projectUser) {
      return res.status(403).json({ message: 'Access denied', hasAccess: false })
    }

    const isQualityManager = ['quality_manager', 'admin', 'project_manager'].includes(projectUser.role)

    res.json({
      role: projectUser.role,
      isQualityManager,
      canApproveNCRs: isQualityManager,
    })
  } catch (error) {
    console.error('Check role error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})
