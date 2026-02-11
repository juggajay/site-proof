// NCR CRUD: create, list, get, update, delete
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { type AuthUser } from '../../lib/auth.js'
import { requireAuth } from '../../middleware/authMiddleware.js'
import { parsePagination, getPaginationMeta, getPrismaSkipTake } from '../../lib/pagination.js'
import { AppError } from '../../lib/AppError.js'
import { asyncHandler } from '../../lib/asyncHandler.js'

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

export const ncrCoreRouter = Router()

// GET /api/ncrs - List all NCRs for user's projects
ncrCoreRouter.get('/', requireAuth, asyncHandler(async (req: any, res) => {

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
  
}))

// GET /api/ncrs/:id - Get single NCR
ncrCoreRouter.get('/:id', requireAuth, asyncHandler(async (req: any, res) => {

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
    throw AppError.notFound('NCR not found')
  }

  // Check access - user must have access to the project
  const hasAccess = await prisma.projectUser.findFirst({
    where: {
      projectId: ncr.projectId,
      userId: user.userId,
    },
  })

  if (!hasAccess) {
    throw AppError.forbidden('Access denied')
  }

  res.json({ ncr })
  
}))

// POST /api/ncrs - Create new NCR
ncrCoreRouter.post('/', requireAuth, asyncHandler(async (req: any, res) => {

  const validation = createNcrSchema.safeParse(req.body)
  if (!validation.success) {
    throw AppError.fromZodError(validation.error)
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
    throw AppError.forbidden('Access denied to this project')
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
  
}))

// Feature #636: PATCH /api/ncrs/:id - Update NCR (including redirect to different responsible party)
ncrCoreRouter.patch('/:id', requireAuth, asyncHandler(async (req: any, res) => {

  const validation = updateNcrSchema.safeParse(req.body)
  if (!validation.success) {
    throw AppError.fromZodError(validation.error)
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
    throw AppError.notFound('NCR not found')
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
    throw AppError.badRequest('No fields to update')
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
  
}))
