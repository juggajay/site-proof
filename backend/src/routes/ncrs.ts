import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { verifyToken, type AuthUser } from '../lib/auth.js'

export const ncrsRouter = Router()

// Middleware to verify auth and attach user
const requireAuth = async (req: any, res: any, next: any) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const token = authHeader.substring(7)
    const user = await verifyToken(token)

    if (!user) {
      return res.status(401).json({ message: 'Invalid token' })
    }

    req.user = user
    next()
  } catch (error) {
    console.error('Auth error:', error)
    res.status(401).json({ message: 'Unauthorized' })
  }
}

// GET /api/ncrs - List all NCRs for user's projects
ncrsRouter.get('/', requireAuth, async (req: any, res) => {
  try {
    const user = req.user as AuthUser
    const { projectId, status, severity, lotId } = req.query

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

    const ncrs = await prisma.nCR.findMany({
      where,
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
      orderBy: { createdAt: 'desc' },
    })

    res.json({ ncrs })
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
    } = req.body

    if (!projectId || !description || !category) {
      return res.status(400).json({ message: 'Project ID, description, and category are required' })
    }

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

    // Major NCRs require QM approval to close
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

    res.status(201).json({ ncr })
  } catch (error) {
    console.error('Create NCR error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// POST /api/ncrs/:id/respond - Submit response to NCR
ncrsRouter.post('/:id/respond', requireAuth, async (req: any, res) => {
  try {
    const user = req.user as AuthUser
    const { id } = req.params
    const { rootCauseCategory, rootCauseDescription, proposedCorrectiveAction } = req.body

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

// POST /api/ncrs/:id/rectify - Submit rectification evidence
ncrsRouter.post('/:id/rectify', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params
    const { rectificationNotes } = req.body

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
    const user = req.user as AuthUser
    const { id } = req.params
    const { verificationNotes, lessonsLearned, withConcession, concessionJustification, concessionRiskAssessment } = req.body

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

// POST /api/ncrs/:id/reopen - Reopen a closed NCR
ncrsRouter.post('/:id/reopen', requireAuth, async (req: any, res) => {
  try {
    const user = req.user as AuthUser
    const { id } = req.params
    const { reason } = req.body

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
