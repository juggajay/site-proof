import { Router } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middleware/authMiddleware.js'
import { checkConformancePrerequisites } from '../lib/conformancePrerequisites.js'
import { parsePagination, getPaginationMeta, getPrismaSkipTake } from '../lib/pagination.js'
import { AppError } from '../lib/AppError.js'
import { asyncHandler } from '../lib/asyncHandler.js'

// ============================================================================
// Zod Validation Schemas
// ============================================================================

// Valid lot statuses
const validStatuses = [
  'not_started', 'in_progress', 'awaiting_test',
  'hold_point', 'ncr_raised', 'completed'
] as const

// Valid lot types
const validLotTypes = ['chainage', 'area', 'structure'] as const

// Schema for creating a lot
const createLotSchema = z.object({
  projectId: z.string().min(1, 'projectId is required'),
  lotNumber: z.string().min(1, 'lotNumber is required'),
  description: z.string().optional().nullable(),
  activityType: z.string().optional(),
  chainageStart: z.number().optional().nullable(),
  chainageEnd: z.number().optional().nullable(),
  lotType: z.enum(validLotTypes).optional(),
  itpTemplateId: z.string().optional().nullable(),
  assignedSubcontractorId: z.string().optional().nullable(),
  areaZone: z.string().optional().nullable(),
  structureId: z.string().optional().nullable(),
  structureElement: z.string().optional().nullable(),
  canCompleteITP: z.boolean().optional(),
  itpRequiresVerification: z.boolean().optional(),
})

// Schema for bulk creating lots
const bulkCreateLotsSchema = z.object({
  projectId: z.string().min(1, 'projectId is required'),
  lots: z.array(z.object({
    lotNumber: z.string().min(1, 'Each lot must have a lotNumber'),
    description: z.string().optional().nullable(),
    activityType: z.string().optional(),
    lotType: z.enum(validLotTypes).optional(),
    chainageStart: z.number().optional().nullable(),
    chainageEnd: z.number().optional().nullable(),
    layer: z.string().optional().nullable(),
  })).min(1, 'lots array is required and must not be empty'),
})

// Schema for cloning a lot
const cloneLotSchema = z.object({
  lotNumber: z.string().optional(),
  chainageStart: z.number().optional().nullable(),
  chainageEnd: z.number().optional().nullable(),
})

// Schema for updating a lot
const updateLotSchema = z.object({
  lotNumber: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  activityType: z.string().optional(),
  chainageStart: z.number().optional().nullable(),
  chainageEnd: z.number().optional().nullable(),
  offset: z.string().optional().nullable(),
  offsetCustom: z.string().optional().nullable(),
  layer: z.string().optional().nullable(),
  areaZone: z.string().optional().nullable(),
  lotType: z.enum(validLotTypes).optional(),
  structureId: z.string().optional().nullable(),
  structureElement: z.string().optional().nullable(),
  status: z.string().optional(),
  budgetAmount: z.number().optional().nullable(),
  assignedSubcontractorId: z.string().optional().nullable(),
  expectedUpdatedAt: z.string().optional(), // For optimistic locking
})

// Schema for bulk delete
const bulkDeleteSchema = z.object({
  lotIds: z.array(z.string()).min(1, 'lotIds array is required and must not be empty'),
})

// Schema for bulk update status
const bulkUpdateStatusSchema = z.object({
  lotIds: z.array(z.string()).min(1, 'lotIds array is required and must not be empty'),
  status: z.enum(validStatuses, {
    errorMap: () => ({ message: `status must be one of: ${validStatuses.join(', ')}` })
  }),
})

// Schema for bulk assign subcontractor
const bulkAssignSubcontractorSchema = z.object({
  lotIds: z.array(z.string()).min(1, 'lotIds array is required and must not be empty'),
  subcontractorId: z.string().nullable().optional(),
})

// Schema for assigning subcontractor to lot
const assignSubcontractorSchema = z.object({
  subcontractorId: z.string().nullable().optional(),
})

// Schema for conforming a lot
const conformLotSchema = z.object({
  force: z.boolean().optional(),
})

// Schema for overriding status
const overrideStatusSchema = z.object({
  status: z.enum(validStatuses, {
    errorMap: () => ({ message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` })
  }),
  reason: z.string().min(5, 'Reason must be at least 5 characters'),
})

// Schema for creating subcontractor assignment
const createSubcontractorAssignmentSchema = z.object({
  subcontractorCompanyId: z.string().min(1, 'subcontractorCompanyId is required'),
  canCompleteITP: z.boolean().optional(),
  itpRequiresVerification: z.boolean().optional(),
})

// Schema for updating subcontractor assignment
const updateSubcontractorAssignmentSchema = z.object({
  canCompleteITP: z.boolean().optional(),
  itpRequiresVerification: z.boolean().optional(),
})

export const lotsRouter = Router()

// Apply authentication middleware to all lot routes
lotsRouter.use(requireAuth)

// Roles that can create lots
const LOT_CREATORS = ['owner', 'admin', 'project_manager', 'site_manager', 'foreman']
// Roles that can delete lots
const LOT_DELETERS = ['owner', 'admin', 'project_manager']
// Roles that can conform lots (quality management)
const LOT_CONFORMERS = ['owner', 'admin', 'project_manager', 'quality_manager']

// GET /api/lots - List all lots for a project (paginated)
lotsRouter.get('/', asyncHandler(async (req, res) => {
    const user = req.user!
    const { projectId, status, unclaimed, includeITP } = req.query

    if (!projectId) {
      throw AppError.badRequest('projectId query parameter is required')
    }

    // Parse pagination parameters
    const { page, limit, sortBy, sortOrder } = parsePagination(req.query)
    const { skip, take } = getPrismaSkipTake(page, limit)

    // Build where clause based on user role
    const whereClause: Prisma.LotWhereInput = { projectId: projectId as string }

    // Filter by status if provided
    if (status) {
      whereClause.status = status as string
    }

    // Filter for unclaimed lots (no claimedInId)
    if (unclaimed === 'true') {
      whereClause.claimedInId = null
    }

    // Subcontractors can only see lots assigned to their company
    if (user.roleInCompany === 'subcontractor' || user.roleInCompany === 'subcontractor_admin') {
      // Find the user's subcontractor company for this project
      const subcontractorUser = await prisma.subcontractorUser.findFirst({
        where: { userId: user.id },
        include: { subcontractorCompany: true }
      })

      if (subcontractorUser) {
        const subCompanyId = subcontractorUser.subcontractorCompanyId

        // Get lots assigned via LotSubcontractorAssignment (new model)
        const lotAssignments = await prisma.lotSubcontractorAssignment.findMany({
          where: {
            subcontractorCompanyId: subCompanyId,
            status: 'active',
            projectId: projectId as string,
          },
          select: { lotId: true }
        })
        const assignedLotIds = lotAssignments.map(a => a.lotId)

        // Include lots from both legacy field AND new assignment model
        whereClause.OR = [
          { assignedSubcontractorId: subCompanyId },
          ...(assignedLotIds.length > 0 ? [{ id: { in: assignedLotIds } }] : [])
        ]
      } else {
        // No subcontractor company found - return empty result with pagination
        return res.json({
          data: [],
          pagination: getPaginationMeta(0, page, limit),
          // Backward compatibility - keep 'lots' alias during transition
          lots: []
        })
      }
    }

    // Build select clause - conditionally include ITP data
    const selectClause: Prisma.LotSelect = {
      id: true,
      lotNumber: true,
      description: true,
      status: true,
      activityType: true,
      chainageStart: true,
      chainageEnd: true,
      offset: true,
      offsetCustom: true,
      layer: true,
      areaZone: true,
      budgetAmount: true,
      assignedSubcontractorId: true,
      assignedSubcontractor: {
        select: {
          companyName: true,
        }
      },
      // Include subcontractor assignments with ITP permissions
      subcontractorAssignments: {
        where: { status: 'active' },
        select: {
          id: true,
          subcontractorCompanyId: true,
          canCompleteITP: true,
          itpRequiresVerification: true,
          subcontractorCompany: {
            select: { id: true, companyName: true }
          }
        }
      },
      createdAt: true,
    }

    // Include ITP instance data if requested
    if (includeITP === 'true') {
      selectClause.itpInstance = {
        select: {
          id: true,
          templateId: true,
          status: true,
          template: {
            select: {
              id: true,
              name: true,
              activityType: true,
            }
          }
        }
      }
    }

    // Determine sort field - default to lotNumber for lots
    const orderBy = sortBy
      ? { [sortBy]: sortOrder }
      : { lotNumber: 'asc' as const }

    // Execute count and findMany in parallel for efficiency
    const [lots, total] = await Promise.all([
      prisma.lot.findMany({
        where: whereClause,
        select: selectClause,
        orderBy,
        skip,
        take,
      }),
      prisma.lot.count({ where: whereClause })
    ])

    // Transform response to match frontend expectations
    // Frontend expects itpInstances array, but we have singular itpInstance
    const transformedLots = includeITP === 'true'
      ? lots.map(lot => ({
          ...lot,
          itpInstances: lot.itpInstance ? [lot.itpInstance] : []
        }))
      : lots

    res.json({
      data: transformedLots,
      pagination: getPaginationMeta(total, page, limit),
      // Backward compatibility - keep 'lots' alias during transition
      lots: transformedLots
    })
}))

// GET /api/lots/suggest-number - Get suggested next lot number for a project
lotsRouter.get('/suggest-number', asyncHandler(async (req, res) => {
    const { projectId } = req.query
    const user = req.user!

    if (!projectId) {
      throw AppError.badRequest('projectId is required')
    }

    // Verify user has access to the project
    const projectAccess = await prisma.projectUser.findFirst({
      where: { projectId: projectId as string, userId: user.id }
    })

    if (!projectAccess) {
      throw AppError.forbidden('Access denied')
    }

    // Get project settings
    const project = await prisma.project.findUnique({
      where: { id: projectId as string },
      select: {
        lotPrefix: true,
        lotStartingNumber: true
      }
    })

    if (!project) {
      throw AppError.notFound('Project')
    }

    const prefix = project.lotPrefix || 'LOT-'
    const startingNumber = project.lotStartingNumber || 1

    // Find the highest existing lot number with this prefix
    const existingLots = await prisma.lot.findMany({
      where: {
        projectId: projectId as string,
        lotNumber: { startsWith: prefix }
      },
      select: { lotNumber: true },
      orderBy: { lotNumber: 'desc' }
    })

    let nextNumber = startingNumber

    if (existingLots.length > 0) {
      // Extract numbers from existing lot numbers and find the highest
      const numbers = existingLots
        .map(lot => {
          const match = lot.lotNumber.match(new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)`))
          return match ? parseInt(match[1], 10) : 0
        })
        .filter(n => !isNaN(n) && n > 0)

      if (numbers.length > 0) {
        nextNumber = Math.max(...numbers) + 1
      }
    }

    // Pad with zeros to match the starting number format
    const paddingLength = Math.max(String(startingNumber).length, String(nextNumber).length, 3)
    const suggestedNumber = `${prefix}${String(nextNumber).padStart(paddingLength, '0')}`

    res.json({
      suggestedNumber,
      prefix,
      nextNumber,
      startingNumber
    })
}))

// GET /api/lots/:id - Get a single lot
lotsRouter.get('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params
    const user = req.user!

    const lot = await prisma.lot.findUnique({
      where: { id },
      select: {
        id: true,
        lotNumber: true,
        description: true,
        status: true,
        activityType: true,
        chainageStart: true,
        chainageEnd: true,
        offset: true,
        offsetCustom: true,
        layer: true,
        areaZone: true,
        projectId: true,
        assignedSubcontractorId: true,
        assignedSubcontractor: {
          select: {
            id: true,
            companyName: true,
          },
        },
        // Include subcontractor assignments with ITP permissions
        subcontractorAssignments: {
          where: { status: 'active' },
          select: {
            id: true,
            subcontractorCompanyId: true,
            canCompleteITP: true,
            itpRequiresVerification: true,
            subcontractorCompany: {
              select: { id: true, companyName: true }
            }
          }
        },
        createdAt: true,
        updatedAt: true,
        conformedAt: true,
        conformedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        _count: {
          select: {
            testResults: true,
            ncrLots: true,
            documents: true,
          },
        },
        itpInstance: {
          select: { id: true },
        },
      },
    })

    if (!lot) {
      throw AppError.notFound('Lot')
    }

    // Authorization check 1: Verify user has access to the project
    // Check if user is a member of the lot's project through ProjectUser
    const projectAccess = await prisma.projectUser.findFirst({
      where: {
        projectId: lot.projectId,
        userId: user.id,
        status: 'active',
      },
    })

    // Also check if user is in the same company as the project owner (company-level access)
    const projectCompanyAccess = await prisma.project.findFirst({
      where: {
        id: lot.projectId,
        companyId: user.companyId || undefined,
      },
    })

    // If user has no project access and no company-level access, deny
    if (!projectAccess && !projectCompanyAccess) {
      throw AppError.forbidden('You do not have access to this lot')
    }

    // Authorization check 2: Subcontractors can only access lots assigned to their company
    if (user.roleInCompany === 'subcontractor' || user.roleInCompany === 'subcontractor_admin') {
      // Find the user's subcontractor company
      const subcontractorUser = await prisma.subcontractorUser.findFirst({
        where: { userId: user.id },
      })

      const userSubcontractorId = subcontractorUser?.subcontractorCompanyId

      // Check both legacy field AND new LotSubcontractorAssignment model
      const hasLegacyAssignment = lot.assignedSubcontractorId === userSubcontractorId
      const hasNewAssignment = lot.subcontractorAssignments?.some(
        a => a.subcontractorCompanyId === userSubcontractorId
      )

      if (!hasLegacyAssignment && !hasNewAssignment) {
        throw AppError.forbidden('You do not have access to this lot')
      }
    }

    // Remove sensitive fields before sending response
    const { projectId, assignedSubcontractorId, ...lotResponse } = lot

    res.json({ lot: lotResponse })
}))

// POST /api/lots - Create a new lot (requires creator role in project)
lotsRouter.post('/', asyncHandler(async (req, res) => {
    const user = req.user!

    // Validate request body
    const validation = createLotSchema.safeParse(req.body)
    if (!validation.success) {
      throw AppError.fromZodError(validation.error)
    }
    const { projectId, lotNumber, description, activityType, chainageStart, chainageEnd, lotType, itpTemplateId, assignedSubcontractorId, areaZone, canCompleteITP, itpRequiresVerification } = validation.data

    // Feature #853: Area zone required for area lot type
    if (lotType === 'area' && !areaZone) {
      throw AppError.badRequest('Area zone is required for area lot type', { code: 'AREA_ZONE_REQUIRED' })
    }

    // Feature #854: Structure ID required for structure lot type
    const structureId = req.body.structureId
    if (lotType === 'structure' && !structureId) {
      throw AppError.badRequest('Structure ID is required for structure lot type', { code: 'STRUCTURE_ID_REQUIRED' })
    }

    // Check if user has creator role - either via company role or project membership
    let hasPermission = LOT_CREATORS.includes(user.roleInCompany || '')

    if (!hasPermission) {
      // Check project-specific role
      const projectUser = await prisma.projectUser.findFirst({
        where: {
          projectId,
          userId: user.id,
          status: 'active'
        }
      })

      if (projectUser && LOT_CREATORS.includes(projectUser.role)) {
        hasPermission = true
      }
    }

    if (!hasPermission) {
      throw AppError.forbidden('You do not have permission to create lots in this project.')
    }

    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber,
        description,
        activityType: activityType || 'Earthworks',
        lotType: lotType || 'chainage',
        chainageStart,
        chainageEnd,
        assignedSubcontractorId: assignedSubcontractorId || null,
        areaZone: areaZone || null,
        structureId: structureId || null,  // Feature #854
        structureElement: req.body.structureElement || null,  // Feature #854
      },
      select: {
        id: true,
        lotNumber: true,
        description: true,
        status: true,
        assignedSubcontractorId: true,
        createdAt: true,
      },
    })

    // If an ITP template is specified, create an ITP instance for the lot
    if (itpTemplateId) {
      try {
        await prisma.iTPInstance.create({
          data: {
            lotId: lot.id,
            templateId: itpTemplateId,
            status: 'not_started',
          },
        })
      } catch (itpError) {
        console.error('Failed to create ITP instance:', itpError)
        // Don't fail the lot creation if ITP instance fails
      }
    }

    // If a subcontractor is assigned, also create a LotSubcontractorAssignment record
    // This ensures the new assignment system recognizes the assignment with ITP permissions
    if (assignedSubcontractorId) {
      try {
        await prisma.lotSubcontractorAssignment.create({
          data: {
            lotId: lot.id,
            subcontractorCompanyId: assignedSubcontractorId,
            projectId,
            canCompleteITP: canCompleteITP ?? false,
            itpRequiresVerification: itpRequiresVerification ?? true,
            assignedById: user.id,
          },
        })
      } catch (assignmentError) {
        console.error('Failed to create subcontractor assignment:', assignmentError)
        // Don't fail the lot creation if assignment fails
      }
    }

    res.status(201).json({ lot })
}))

// POST /api/lots/bulk - Bulk create lots (requires creator role)
lotsRouter.post('/bulk', requireRole(LOT_CREATORS), asyncHandler(async (req, res) => {
    // Validate request body
    const validation = bulkCreateLotsSchema.safeParse(req.body)
    if (!validation.success) {
      throw AppError.fromZodError(validation.error)
    }
    const { projectId, lots: lotsData } = validation.data

    // Create all lots in a transaction
    const createdLots = await prisma.$transaction(
      lotsData.map((lot) =>
        prisma.lot.create({
          data: {
            projectId,
            lotNumber: lot.lotNumber,
            description: lot.description || null,
            activityType: lot.activityType || 'Earthworks',
            lotType: lot.lotType || 'chainage',
            chainageStart: lot.chainageStart ?? null,
            chainageEnd: lot.chainageEnd ?? null,
            layer: lot.layer || null,
          },
          select: {
            id: true,
            lotNumber: true,
            description: true,
            status: true,
            activityType: true,
            chainageStart: true,
            chainageEnd: true,
            createdAt: true,
          },
        })
      )
    )

    res.status(201).json({
      message: `Successfully created ${createdLots.length} lots`,
      lots: createdLots,
      count: createdLots.length
    })
}))

// POST /api/lots/:id/clone - Clone a lot with suggested adjacent chainage
lotsRouter.post('/:id/clone', requireRole(LOT_CREATORS), asyncHandler(async (req, res) => {
    const { id } = req.params

    // Validate request body
    const validation = cloneLotSchema.safeParse(req.body)
    if (!validation.success) {
      throw AppError.fromZodError(validation.error)
    }
    const { lotNumber, chainageStart, chainageEnd } = validation.data

    // Get the original lot
    const sourceLot = await prisma.lot.findUnique({
      where: { id },
      select: {
        id: true,
        projectId: true,
        lotNumber: true,
        description: true,
        activityType: true,
        lotType: true,
        chainageStart: true,
        chainageEnd: true,
        offset: true,
        offsetCustom: true,
        layer: true,
        areaZone: true,
        assignedSubcontractorId: true,
      },
    })

    if (!sourceLot) {
      throw AppError.notFound('Lot')
    }

    // Calculate suggested adjacent chainage if not provided
    let suggestedChainageStart = chainageStart
    let suggestedChainageEnd = chainageEnd

    if (suggestedChainageStart === undefined && sourceLot.chainageEnd !== null) {
      // Suggest next section starting from where the original ended
      suggestedChainageStart = Number(sourceLot.chainageEnd)
      if (sourceLot.chainageStart !== null) {
        const sectionLength = Number(sourceLot.chainageEnd) - Number(sourceLot.chainageStart)
        suggestedChainageEnd = Number(suggestedChainageStart) + sectionLength
      }
    }

    // If no lotNumber provided, generate a suggestion
    let newLotNumber = lotNumber
    if (!newLotNumber) {
      // Try to increment the lot number (e.g., LOT-001 -> LOT-002)
      const match = sourceLot.lotNumber.match(/^(.*)(\d+)$/)
      if (match) {
        const prefix = match[1]
        const num = parseInt(match[2], 10)
        const paddedNum = String(num + 1).padStart(match[2].length, '0')
        newLotNumber = `${prefix}${paddedNum}`
      } else {
        newLotNumber = `${sourceLot.lotNumber}-copy`
      }
    }

    // Create the cloned lot
    const clonedLot = await prisma.lot.create({
      data: {
        projectId: sourceLot.projectId,
        lotNumber: newLotNumber,
        description: sourceLot.description,
        activityType: sourceLot.activityType,
        lotType: sourceLot.lotType,
        chainageStart: suggestedChainageStart ?? sourceLot.chainageStart,
        chainageEnd: suggestedChainageEnd ?? sourceLot.chainageEnd,
        offset: sourceLot.offset,
        offsetCustom: sourceLot.offsetCustom,
        layer: sourceLot.layer,
        areaZone: sourceLot.areaZone,
        assignedSubcontractorId: sourceLot.assignedSubcontractorId,
      },
      select: {
        id: true,
        lotNumber: true,
        description: true,
        status: true,
        activityType: true,
        chainageStart: true,
        chainageEnd: true,
        offset: true,
        layer: true,
        areaZone: true,
        assignedSubcontractorId: true,
        createdAt: true,
      },
    })

    res.status(201).json({
      lot: clonedLot,
      sourceLotId: sourceLot.id,
      message: `Lot cloned from ${sourceLot.lotNumber}`,
    })
}))

// Roles that can edit lots
const LOT_EDITORS = ['owner', 'admin', 'project_manager', 'site_engineer', 'quality_manager', 'foreman']

// PATCH /api/lots/:id - Update a lot
lotsRouter.patch('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params
    const user = req.user!

    // Validate request body
    const validation = updateLotSchema.safeParse(req.body)
    if (!validation.success) {
      throw AppError.fromZodError(validation.error)
    }

    const lot = await prisma.lot.findUnique({
      where: { id },
      select: {
        id: true,
        projectId: true,
        status: true,
        updatedAt: true,
      },
    })

    if (!lot) {
      throw AppError.notFound('Lot')
    }

    // Get user's role on this project
    const projectUser = await prisma.projectUser.findFirst({
      where: {
        projectId: lot.projectId,
        userId: user.id,
        status: 'active',
      },
    })

    const userProjectRole = projectUser?.role || user.roleInCompany

    // Check if user has permission to edit lots
    if (!LOT_EDITORS.includes(userProjectRole)) {
      throw AppError.forbidden('You do not have permission to edit lots')
    }

    // Don't allow editing conformed or claimed lots (without special override)
    if (lot.status === 'conformed' || lot.status === 'claimed') {
      throw AppError.badRequest(`Cannot edit a ${lot.status} lot`)
    }

    // Feature #871: Concurrent edit detection (optimistic locking)
    // If client sends expectedUpdatedAt, check if lot was modified since
    const { expectedUpdatedAt } = req.body
    if (expectedUpdatedAt) {
      const clientExpectedTime = new Date(expectedUpdatedAt).getTime()
      const serverUpdatedTime = lot.updatedAt.getTime()
      const timeDiff = Math.abs(clientExpectedTime - serverUpdatedTime)

      // Allow 1 second tolerance for timing differences
      if (timeDiff > 1000) {
        throw AppError.conflict('This lot has been modified by another user. Please refresh and try again.', {
          serverUpdatedAt: lot.updatedAt.toISOString(),
          clientExpectedAt: expectedUpdatedAt
        })
      }
    }

    // Extract validated fields
    const {
      lotNumber,
      description,
      activityType,
      chainageStart,
      chainageEnd,
      offset,
      offsetCustom,
      layer,
      areaZone,
      status,
      budgetAmount,
      assignedSubcontractorId,
      lotType: validatedLotType,
      structureId: validatedStructureId,
      structureElement: validatedStructureElement,
    } = validation.data

    // Feature #853 & #854: Validate area zone and structure ID for respective lot types
    const existingLot = await prisma.lot.findUnique({ where: { id }, select: { lotType: true, areaZone: true, structureId: true } })
    const newLotType = validatedLotType ?? existingLot?.lotType
    const newAreaZone = areaZone ?? existingLot?.areaZone
    const newStructureId = validatedStructureId ?? existingLot?.structureId

    if (newLotType === 'area' && !newAreaZone) {
      throw AppError.badRequest('Area zone is required for area lot type', { code: 'AREA_ZONE_REQUIRED' })
    }

    // Feature #854: Structure ID required for structure lot type
    if (newLotType === 'structure' && !newStructureId) {
      throw AppError.badRequest('Structure ID is required for structure lot type', { code: 'STRUCTURE_ID_REQUIRED' })
    }

    // Build update data - only include fields that were provided
    const updateData: Record<string, unknown> = {}
    if (validatedLotType !== undefined) updateData.lotType = validatedLotType
    if (lotNumber !== undefined) updateData.lotNumber = lotNumber
    if (description !== undefined) updateData.description = description
    if (activityType !== undefined) updateData.activityType = activityType
    if (chainageStart !== undefined) updateData.chainageStart = chainageStart
    if (chainageEnd !== undefined) updateData.chainageEnd = chainageEnd
    if (offset !== undefined) updateData.offset = offset
    if (offsetCustom !== undefined) updateData.offsetCustom = offsetCustom
    if (layer !== undefined) updateData.layer = layer
    if (areaZone !== undefined) updateData.areaZone = areaZone
    if (validatedStructureId !== undefined) updateData.structureId = validatedStructureId  // Feature #854
    if (validatedStructureElement !== undefined) updateData.structureElement = validatedStructureElement  // Feature #854
    if (status !== undefined) updateData.status = status
    // Only PMs and above can set budget
    if (budgetAmount !== undefined && ['owner', 'admin', 'project_manager'].includes(userProjectRole)) {
      updateData.budgetAmount = budgetAmount
    }
    // Only PMs and above can assign subcontractors
    if (assignedSubcontractorId !== undefined && ['owner', 'admin', 'project_manager'].includes(userProjectRole)) {
      updateData.assignedSubcontractorId = assignedSubcontractorId || null
    }

    const updatedLot = await prisma.lot.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        lotNumber: true,
        description: true,
        status: true,
        activityType: true,
        chainageStart: true,
        chainageEnd: true,
        offset: true,
        offsetCustom: true,
        layer: true,
        areaZone: true,
        budgetAmount: true,
        assignedSubcontractorId: true,
        updatedAt: true,
      },
    })

    res.json({ lot: updatedLot })
}))

// DELETE /api/lots/:id - Delete a lot (requires deleter role)
// Feature #585: Added docket allocation integrity check
lotsRouter.delete('/:id', requireRole(LOT_DELETERS), asyncHandler(async (req, res) => {
    const { id } = req.params

    const lot = await prisma.lot.findUnique({
      where: { id },
      include: {
        // Check for actual hold point records that aren't released
        holdPoints: {
          where: {
            status: { not: 'released' }
          }
        },
        // Also check for ITP instances with hold point items (virtual hold points)
        itpInstance: {
          include: {
            template: {
              include: {
                checklistItems: {
                  where: { pointType: 'hold_point' }
                }
              }
            },
            completions: {
              where: {
                checklistItem: { pointType: 'hold_point' }
              }
            }
          }
        },
        // Check for docket allocations
        docketLabourLots: {
          select: { id: true }
        },
        docketPlantLots: {
          select: { id: true }
        }
      }
    })

    if (!lot) {
      throw AppError.notFound('Lot')
    }

    // Check if lot is conformed or claimed - cannot delete these
    if (lot.status === 'conformed') {
      throw AppError.badRequest('Cannot delete a conformed lot. Conformed lots have been quality-approved.', {
        code: 'LOT_CONFORMED'
      })
    }

    if (lot.status === 'claimed') {
      throw AppError.badRequest('Cannot delete a claimed lot. This lot is part of a progress claim.', {
        code: 'LOT_CLAIMED'
      })
    }

    // Check for unreleased hold points (actual records in hold_points table)
    if (lot.holdPoints && lot.holdPoints.length > 0) {
      throw AppError.badRequest(`This lot has ${lot.holdPoints.length} unreleased hold point(s). Release all hold points before deleting the lot.`, {
        code: 'UNRELEASED_HOLD_POINTS',
        unreleasedHoldPoints: lot.holdPoints.length
      })
    }

    // Check for virtual hold points (ITP checklist items with hold_point type that haven't been released)
    if (lot.itpInstance?.template?.checklistItems) {
      const holdPointItems = lot.itpInstance.template.checklistItems
      const releasedCompletions = lot.itpInstance.completions?.filter(
        c => c.verificationStatus === 'verified'
      ) || []

      // Find hold point items that haven't been verified/released
      const unreleasedHoldPoints = holdPointItems.filter(item =>
        !releasedCompletions.some(c => c.checklistItemId === item.id)
      )

      if (unreleasedHoldPoints.length > 0) {
        throw AppError.badRequest(`This lot has ${unreleasedHoldPoints.length} unreleased hold point(s). Release all hold points before deleting the lot.`, {
          code: 'UNRELEASED_HOLD_POINTS',
          unreleasedHoldPoints: unreleasedHoldPoints.length
        })
      }
    }

    // Check for docket allocations - lots with docket costs cannot be deleted
    const docketLabourCount = lot.docketLabourLots?.length || 0
    const docketPlantCount = lot.docketPlantLots?.length || 0
    const totalDocketAllocations = docketLabourCount + docketPlantCount

    if (totalDocketAllocations > 0) {
      throw AppError.badRequest(`This lot has ${totalDocketAllocations} docket allocation(s) (${docketLabourCount} labour, ${docketPlantCount} plant). Remove docket allocations before deleting the lot.`, {
        code: 'HAS_DOCKET_ALLOCATIONS',
        docketAllocations: {
          labour: docketLabourCount,
          plant: docketPlantCount,
          total: totalDocketAllocations
        }
      })
    }

    await prisma.lot.delete({
      where: { id },
    })

    res.json({ message: 'Lot deleted successfully' })
}))


// POST /api/lots/bulk-delete - Bulk delete lots (requires deleter role)
lotsRouter.post('/bulk-delete', requireRole(LOT_DELETERS), asyncHandler(async (req, res) => {
    // Validate request body
    const validation = bulkDeleteSchema.safeParse(req.body)
    if (!validation.success) {
      throw AppError.fromZodError(validation.error)
    }
    const { lotIds } = validation.data

    // Check that lots exist and can be deleted (not conformed or claimed)
    const lotsToDelete = await prisma.lot.findMany({
      where: {
        id: { in: lotIds },
      },
      select: {
        id: true,
        lotNumber: true,
        status: true,
        holdPoints: {
          where: {
            status: { not: 'released' }
          },
          select: { id: true }
        }
      },
    })

    // Check for lots that cannot be deleted (conformed or claimed)
    const undeletableLots = lotsToDelete.filter(
      lot => lot.status === 'conformed' || lot.status === 'claimed'
    )

    if (undeletableLots.length > 0) {
      throw AppError.badRequest(`Cannot delete ${undeletableLots.length} lot(s) that are conformed or claimed: ${undeletableLots.map(l => l.lotNumber).join(', ')}`)
    }

    // Check for lots with unreleased hold points
    const lotsWithUnreleasedHP = lotsToDelete.filter(
      lot => lot.holdPoints && lot.holdPoints.length > 0
    )

    if (lotsWithUnreleasedHP.length > 0) {
      throw AppError.badRequest(`Cannot delete ${lotsWithUnreleasedHP.length} lot(s) with unreleased hold points: ${lotsWithUnreleasedHP.map(l => l.lotNumber).join(', ')}`, {
        code: 'UNRELEASED_HOLD_POINTS'
      })
    }

    // Delete all lots in a transaction
    const result = await prisma.lot.deleteMany({
      where: {
        id: { in: lotIds },
        status: { notIn: ['conformed', 'claimed'] },
      },
    })

    res.json({
      message: `Successfully deleted ${result.count} lot(s)`,
      count: result.count,
    })
}))

// POST /api/lots/bulk-update-status - Bulk update lot status (requires creator role)
lotsRouter.post('/bulk-update-status', requireRole(LOT_CREATORS), asyncHandler(async (req, res) => {
    // Validate request body
    const validation = bulkUpdateStatusSchema.safeParse(req.body)
    if (!validation.success) {
      throw AppError.fromZodError(validation.error)
    }
    const { lotIds, status } = validation.data

    // Check that lots exist and can be updated (not conformed or claimed)
    const lotsToUpdate = await prisma.lot.findMany({
      where: {
        id: { in: lotIds },
      },
      select: {
        id: true,
        lotNumber: true,
        status: true,
      },
    })

    // Check for lots that cannot be updated (conformed or claimed)
    const unupdatableLots = lotsToUpdate.filter(
      lot => lot.status === 'conformed' || lot.status === 'claimed'
    )

    if (unupdatableLots.length > 0) {
      throw AppError.badRequest(
        `Cannot update ${unupdatableLots.length} lot(s) that are conformed or claimed: ${unupdatableLots.map(l => l.lotNumber).join(', ')}`
      )
    }

    // Update all lots
    const result = await prisma.lot.updateMany({
      where: {
        id: { in: lotIds },
        status: { notIn: ['conformed', 'claimed'] },
      },
      data: {
        status: status,
        updatedAt: new Date(),
      },
    })

    res.json({
      message: `Successfully updated ${result.count} lot(s) to "${status.replace('_', ' ')}"`,
      count: result.count,
    })
}))

// POST /api/lots/bulk-assign-subcontractor - Bulk assign lots to subcontractor (requires creator role)
lotsRouter.post('/bulk-assign-subcontractor', requireRole(LOT_CREATORS), asyncHandler(async (req, res) => {
    // Validate request body
    const validation = bulkAssignSubcontractorSchema.safeParse(req.body)
    if (!validation.success) {
      throw AppError.fromZodError(validation.error)
    }
    const { lotIds, subcontractorId } = validation.data

    // subcontractorId can be null (to unassign) or a valid ID
    if (subcontractorId !== null && subcontractorId !== undefined) {
      // Verify subcontractor exists
      const subcontractor = await prisma.subcontractorCompany.findUnique({
        where: { id: subcontractorId },
        select: { id: true, companyName: true }
      })

      if (!subcontractor) {
        throw AppError.notFound('Subcontractor company')
      }
    }

    // Check that lots exist and can be updated (not conformed or claimed)
    const lotsToUpdate = await prisma.lot.findMany({
      where: {
        id: { in: lotIds },
      },
      select: {
        id: true,
        lotNumber: true,
        status: true,
      },
    })

    // Check for lots that cannot be updated (conformed or claimed)
    const unupdatableLots = lotsToUpdate.filter(
      lot => lot.status === 'conformed' || lot.status === 'claimed'
    )

    if (unupdatableLots.length > 0) {
      throw AppError.badRequest(
        `Cannot update ${unupdatableLots.length} lot(s) that are conformed or claimed: ${unupdatableLots.map(l => l.lotNumber).join(', ')}`
      )
    }

    // Update all lots
    const result = await prisma.lot.updateMany({
      where: {
        id: { in: lotIds },
        status: { notIn: ['conformed', 'claimed'] },
      },
      data: {
        assignedSubcontractorId: subcontractorId || null,
        updatedAt: new Date(),
      },
    })

    const action = subcontractorId ? 'assigned' : 'unassigned'
    res.json({
      message: `Successfully ${action} ${result.count} lot(s)`,
      count: result.count,
    })
}))

// POST /api/lots/:id/assign - Assign a subcontractor to a lot with notification
lotsRouter.post('/:id/assign', asyncHandler(async (req, res) => {
    const { id } = req.params
    const user = req.user!

    // Validate request body
    const validation = assignSubcontractorSchema.safeParse(req.body)
    if (!validation.success) {
      throw AppError.fromZodError(validation.error)
    }
    const { subcontractorId } = validation.data

    // Get the lot with project info
    const lot = await prisma.lot.findUnique({
      where: { id },
      select: {
        id: true,
        lotNumber: true,
        description: true,
        status: true,
        projectId: true,
        assignedSubcontractorId: true,
      },
    })

    if (!lot) {
      throw AppError.notFound('Lot')
    }

    // Don't allow assigning claimed lots
    if (lot.status === 'claimed') {
      throw AppError.badRequest('Cannot assign a claimed lot')
    }

    // Check user permission (only PMs and above can assign)
    const projectUser = await prisma.projectUser.findFirst({
      where: {
        projectId: lot.projectId,
        userId: user.id,
        status: 'active',
      },
    })

    const userRole = projectUser?.role || user.roleInCompany
    const canAssign = ['owner', 'admin', 'project_manager', 'site_manager'].includes(userRole)

    if (!canAssign) {
      throw AppError.forbidden('You do not have permission to assign lots')
    }

    // Update the lot
    const updatedLot = await prisma.lot.update({
      where: { id },
      data: {
        assignedSubcontractorId: subcontractorId || null,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        lotNumber: true,
        description: true,
        status: true,
        assignedSubcontractorId: true,
        assignedSubcontractor: {
          select: {
            id: true,
            companyName: true,
          },
        },
      },
    })

    // If assigning (not unassigning), send notifications to subcontractor users
    if (subcontractorId) {
      // Find all users linked to this subcontractor company
      const subcontractorUsers = await prisma.subcontractorUser.findMany({
        where: {
          subcontractorCompanyId: subcontractorId,
        },
        select: {
          userId: true,
        },
      })

      if (subcontractorUsers.length > 0) {
        // Get assigner info
        const assignerName = user.fullName || user.email || 'A project manager'

        // Create notifications for all subcontractor users
        await prisma.notification.createMany({
          data: subcontractorUsers.map(su => ({
            userId: su.userId,
            projectId: lot.projectId,
            type: 'lot_assigned',
            title: 'Lot Assigned to Your Company',
            message: `${assignerName} assigned lot ${lot.lotNumber}${lot.description ? ` (${lot.description})` : ''} to your company.`,
            linkUrl: `/projects/${lot.projectId}/lots/${lot.id}`,
          })),
        })
      }

      // Record in audit log
      await prisma.auditLog.create({
        data: {
          projectId: lot.projectId,
          userId: user.id,
          entityType: 'Lot',
          entityId: id,
          action: 'subcontractor_assigned',
          changes: JSON.stringify({
            lotNumber: lot.lotNumber,
            subcontractorId,
            subcontractorName: updatedLot.assignedSubcontractor?.companyName,
            previousSubcontractorId: lot.assignedSubcontractorId,
            assignedBy: user.email,
          }),
        },
      })
    }

    res.json({
      message: subcontractorId
        ? `Lot assigned to ${updatedLot.assignedSubcontractor?.companyName || 'subcontractor'}`
        : 'Lot unassigned from subcontractor',
      lot: updatedLot,
      notificationsSent: subcontractorId ? true : false,
    })
}))

// GET /api/lots/check-role/:projectId - Check user's role on a project
lotsRouter.get('/check-role/:projectId', asyncHandler(async (req, res) => {
    const { projectId } = req.params
    const user = req.user!

    // Get user's role on this project
    const projectUser = await prisma.projectUser.findFirst({
      where: {
        projectId,
        userId: user.id,
        status: 'active',
      },
    })

    const role = projectUser?.role || user.roleInCompany

    // Check quality management permissions
    const isQualityManager = role === 'quality_manager'
    const canConformLots = LOT_CONFORMERS.includes(role)
    const canVerifyTestResults = LOT_CONFORMERS.includes(role)
    const canCloseNCRs = LOT_CONFORMERS.includes(role)
    const canManageITPTemplates = LOT_CONFORMERS.includes(role)

    res.json({
      role,
      isQualityManager,
      canConformLots,
      canVerifyTestResults,
      canCloseNCRs,
      canManageITPTemplates,
    })
}))

// GET /api/lots/:id/conform-status - Get lot conformance prerequisites status
lotsRouter.get('/:id/conform-status', asyncHandler(async (req, res) => {
    const { id } = req.params
    const user = req.user!

    const result = await checkConformancePrerequisites(id)

    if (result.error) {
      throw AppError.notFound('Lot')
    }

    // Check if user has access to this lot's project
    const projectAccess = await prisma.projectUser.findFirst({
      where: {
        projectId: result.lot!.projectId,
        userId: user.id,
        status: 'active',
      },
    })

    const projectCompanyAccess = await prisma.project.findFirst({
      where: {
        id: result.lot!.projectId,
        companyId: user.companyId || undefined,
      },
    })

    if (!projectAccess && !projectCompanyAccess) {
      throw AppError.forbidden('You do not have access to this lot')
    }

    res.json(result)
}))

// POST /api/lots/:id/conform - Conform a lot (quality management)
lotsRouter.post('/:id/conform', asyncHandler(async (req, res) => {
    const { id } = req.params
    const user = req.user!

    // Validate request body
    const validation = conformLotSchema.safeParse(req.body)
    if (!validation.success) {
      throw AppError.fromZodError(validation.error)
    }
    const { force } = validation.data // Optional force parameter to skip prerequisite check

    // Check conformance prerequisites first
    const conformStatus = await checkConformancePrerequisites(id)

    if (conformStatus.error) {
      throw AppError.notFound('Lot')
    }

    const lot = conformStatus.lot!

    // Get user's role on this project
    const projectUser = await prisma.projectUser.findFirst({
      where: {
        projectId: lot.projectId,
        userId: user.id,
        status: 'active',
      },
    })

    const userProjectRole = projectUser?.role || user.roleInCompany

    // Check if user has permission to conform lots
    if (!LOT_CONFORMERS.includes(userProjectRole)) {
      throw AppError.forbidden('You do not have permission to conform lots. Required roles: Quality Manager, Project Manager, Admin, or Owner.')
    }

    // Check if lot is already conformed or claimed
    if (lot.status === 'conformed' || lot.status === 'claimed') {
      throw AppError.badRequest(`Lot is already ${lot.status}`)
    }

    // Check prerequisites unless force flag is provided (only for admins)
    if (!conformStatus.canConform && !force) {
      throw AppError.badRequest('Cannot conform lot - prerequisites not met', {
        blockingReasons: conformStatus.blockingReasons as unknown as Record<string, unknown>,
        prerequisites: conformStatus.prerequisites as unknown as Record<string, unknown>,
      })
    }

    // Update lot status to conformed
    const updatedLot = await prisma.lot.update({
      where: { id },
      data: {
        status: 'conformed',
        conformedAt: new Date(),
        conformedBy: {
          connect: { id: user.id }
        },
      },
      select: {
        id: true,
        lotNumber: true,
        status: true,
        conformedAt: true,
      },
    })

    res.json({
      message: 'Lot conformed successfully',
      lot: updatedLot
    })
}))

// Roles that can override lot status
const STATUS_OVERRIDERS = ['owner', 'admin', 'project_manager', 'quality_manager']

// POST /api/lots/:id/override-status - Manual status override with reason (Feature #159)
lotsRouter.post('/:id/override-status', asyncHandler(async (req, res) => {
    const { id } = req.params
    const user = req.user!

    // Validate request body
    const validation = overrideStatusSchema.safeParse(req.body)
    if (!validation.success) {
      throw AppError.fromZodError(validation.error)
    }
    const { status, reason } = validation.data

    // Get the lot
    const lot = await prisma.lot.findUnique({
      where: { id },
      select: {
        id: true,
        lotNumber: true,
        status: true,
        projectId: true,
      },
    })

    if (!lot) {
      throw AppError.notFound('Lot')
    }

    // Don't allow overriding claimed lots
    if (lot.status === 'claimed') {
      throw AppError.badRequest('Cannot override status of a claimed lot')
    }

    // Check user permission
    const projectUser = await prisma.projectUser.findFirst({
      where: {
        projectId: lot.projectId,
        userId: user.id,
        status: 'active',
      },
    })

    const userProjectRole = projectUser?.role || user.roleInCompany

    if (!STATUS_OVERRIDERS.includes(userProjectRole)) {
      throw AppError.forbidden('You do not have permission to override lot status. Required roles: Quality Manager, Project Manager, Admin, or Owner.')
    }

    const previousStatus = lot.status

    // Update the lot status
    const updatedLot = await prisma.lot.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        lotNumber: true,
        status: true,
        updatedAt: true,
      },
    })

    // Record the override in the audit log with the reason
    await prisma.auditLog.create({
      data: {
        projectId: lot.projectId,
        userId: user.id,
        entityType: 'Lot',
        entityId: id,
        action: 'status_override',
        changes: JSON.stringify({
          status: {
            from: previousStatus,
            to: status
          },
          reason: reason.trim(),
          overriddenBy: user.email
        }),
      },
    })

    res.json({
      message: 'Status overridden successfully',
      lot: updatedLot,
      previousStatus,
      reason: reason.trim()
    })
}))

// ============================================================================
// Lot Subcontractor Assignment Management (new permission system)
// ============================================================================

// GET /api/lots/:id/subcontractors - List all subcontractor assignments for a lot
lotsRouter.get('/:id/subcontractors', asyncHandler(async (req, res) => {
    const { id } = req.params

    const assignments = await prisma.lotSubcontractorAssignment.findMany({
      where: { lotId: id, status: 'active' },
      include: {
        subcontractorCompany: {
          select: { id: true, companyName: true }
        }
      },
      orderBy: { assignedAt: 'desc' }
    })

    res.json(assignments)
}))

// POST /api/lots/:id/subcontractors - Assign a subcontractor to a lot
lotsRouter.post('/:id/subcontractors', asyncHandler(async (req, res) => {
    const { id } = req.params
    const user = req.user!

    // Validate request body
    const validation = createSubcontractorAssignmentSchema.safeParse(req.body)
    if (!validation.success) {
      throw AppError.fromZodError(validation.error)
    }
    const { subcontractorCompanyId, canCompleteITP, itpRequiresVerification } = validation.data

    // Get the lot to verify access and get projectId
    const lot = await prisma.lot.findUnique({
      where: { id },
      select: { id: true, projectId: true, lotNumber: true }
    })

    if (!lot) {
      throw AppError.notFound('Lot')
    }

    // Check user permission (PM and above)
    const projectUser = await prisma.projectUser.findFirst({
      where: { projectId: lot.projectId, userId: user.id, status: 'active' }
    })
    const userRole = projectUser?.role || user.roleInCompany
    const canAssign = ['owner', 'admin', 'project_manager', 'site_manager'].includes(userRole)

    if (!canAssign) {
      throw AppError.forbidden('You do not have permission to assign subcontractors')
    }

    // Verify subcontractor exists and belongs to this project
    const subcontractor = await prisma.subcontractorCompany.findFirst({
      where: { id: subcontractorCompanyId, projectId: lot.projectId }
    })

    if (!subcontractor) {
      throw AppError.notFound('Subcontractor not found for this project')
    }

    // Check for existing active assignment
    const existingAssignment = await prisma.lotSubcontractorAssignment.findFirst({
      where: { lotId: id, subcontractorCompanyId, status: 'active' }
    })

    if (existingAssignment) {
      throw AppError.conflict('This subcontractor is already assigned to this lot')
    }

    // Create the assignment
    const assignment = await prisma.lotSubcontractorAssignment.create({
      data: {
        lotId: id,
        projectId: lot.projectId,
        subcontractorCompanyId,
        canCompleteITP: canCompleteITP ?? false,
        itpRequiresVerification: itpRequiresVerification ?? true,
        assignedById: user.id,
        status: 'active'
      },
      include: {
        subcontractorCompany: {
          select: { id: true, companyName: true }
        }
      }
    })

    res.status(201).json(assignment)
}))

// PATCH /api/lots/:id/subcontractors/:assignmentId - Update assignment permissions
lotsRouter.patch('/:id/subcontractors/:assignmentId', asyncHandler(async (req, res) => {
    const { id, assignmentId } = req.params
    const user = req.user!

    // Validate request body
    const validation = updateSubcontractorAssignmentSchema.safeParse(req.body)
    if (!validation.success) {
      throw AppError.fromZodError(validation.error)
    }
    const { canCompleteITP, itpRequiresVerification } = validation.data

    // Get the lot to verify access
    const lot = await prisma.lot.findUnique({
      where: { id },
      select: { id: true, projectId: true }
    })

    if (!lot) {
      throw AppError.notFound('Lot')
    }

    // Check user permission
    const projectUser = await prisma.projectUser.findFirst({
      where: { projectId: lot.projectId, userId: user.id, status: 'active' }
    })
    const userRole = projectUser?.role || user.roleInCompany
    const canManage = ['owner', 'admin', 'project_manager', 'site_manager'].includes(userRole)

    if (!canManage) {
      throw AppError.forbidden('You do not have permission to manage subcontractor assignments')
    }

    // Verify assignment exists and belongs to this lot
    const assignment = await prisma.lotSubcontractorAssignment.findFirst({
      where: { id: assignmentId, lotId: id }
    })

    if (!assignment) {
      throw AppError.notFound('Assignment')
    }

    // Update the assignment
    const updated = await prisma.lotSubcontractorAssignment.update({
      where: { id: assignmentId },
      data: {
        ...(canCompleteITP !== undefined && { canCompleteITP }),
        ...(itpRequiresVerification !== undefined && { itpRequiresVerification })
      },
      include: {
        subcontractorCompany: {
          select: { id: true, companyName: true }
        }
      }
    })

    res.json(updated)
}))

// DELETE /api/lots/:id/subcontractors/:assignmentId - Remove assignment
lotsRouter.delete('/:id/subcontractors/:assignmentId', asyncHandler(async (req, res) => {
    const { id, assignmentId } = req.params
    const user = req.user!

    // Get the lot to verify access
    const lot = await prisma.lot.findUnique({
      where: { id },
      select: { id: true, projectId: true }
    })

    if (!lot) {
      throw AppError.notFound('Lot')
    }

    // Check user permission
    const projectUser = await prisma.projectUser.findFirst({
      where: { projectId: lot.projectId, userId: user.id, status: 'active' }
    })
    const userRole = projectUser?.role || user.roleInCompany
    const canManage = ['owner', 'admin', 'project_manager', 'site_manager'].includes(userRole)

    if (!canManage) {
      throw AppError.forbidden('You do not have permission to manage subcontractor assignments')
    }

    // Verify assignment exists and belongs to this lot
    const assignment = await prisma.lotSubcontractorAssignment.findFirst({
      where: { id: assignmentId, lotId: id }
    })

    if (!assignment) {
      throw AppError.notFound('Assignment')
    }

    // Soft delete by setting status to 'removed'
    await prisma.lotSubcontractorAssignment.update({
      where: { id: assignmentId },
      data: { status: 'removed' }
    })

    res.json({ message: 'Assignment removed successfully' })
}))
