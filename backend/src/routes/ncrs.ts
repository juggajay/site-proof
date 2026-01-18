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
        // Get lots assigned to this subcontractor company
        const assignedLots = await prisma.lot.findMany({
          where: { assignedSubcontractorId: subcontractorUser.subcontractorCompanyId },
          select: { id: true },
        })

        const assignedLotIds = assignedLots.map(l => l.id)

        // Feature #212: Allow subcontractors to see NCRs where they are the responsible party
        // OR NCRs linked to their assigned lots
        where.OR = [
          { responsibleUserId: user.userId }, // NCRs assigned to this user
          ...(assignedLotIds.length > 0 ? [{
            ncrLots: {
              some: {
                lotId: { in: assignedLotIds },
              },
            },
          }] : []),
        ]

        // If no assigned lots and no responsible NCRs possible, the OR handles it
        if (assignedLotIds.length === 0) {
          where.OR = [{ responsibleUserId: user.userId }]
        }
      } else {
        // No subcontractor company found, but they may still be responsible for NCRs
        where.responsibleUserId = user.userId
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

// POST /api/ncrs/:id/respond - Submit response to NCR
ncrsRouter.post('/:id/respond', requireAuth, async (req: any, res) => {
  try {
    // Note: user authenticated via requireAuth middleware
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

// Feature #213: POST /api/ncrs/:id/notify-client - Notify client about major NCR
ncrsRouter.post('/:id/notify-client', requireAuth, async (req: any, res) => {
  try {
    const user = req.user as AuthUser
    const { id } = req.params
    const { recipientEmail, additionalMessage } = req.body

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
        details: JSON.stringify({
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

// POST /api/ncrs/:id/evidence - Add evidence to NCR
ncrsRouter.post('/:id/evidence', requireAuth, async (req: any, res) => {
  try {
    const user = req.user as AuthUser
    const { id } = req.params
    const { documentId, evidenceType, filename, fileUrl, fileSize, mimeType, caption, projectId: providedProjectId } = req.body

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
        documentId: finalDocumentId,
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
    const user = req.user as AuthUser
    const { id } = req.params
    const { rectificationNotes } = req.body

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
