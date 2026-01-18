import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middleware/authMiddleware.js'
import { checkConformancePrerequisites } from '../lib/conformancePrerequisites.js'

export const lotsRouter = Router()

// Apply authentication middleware to all lot routes
lotsRouter.use(requireAuth)

// Roles that can create lots
const LOT_CREATORS = ['owner', 'admin', 'project_manager', 'site_manager', 'foreman']
// Roles that can delete lots
const LOT_DELETERS = ['owner', 'admin', 'project_manager']
// Roles that can conform lots (quality management)
const LOT_CONFORMERS = ['owner', 'admin', 'project_manager', 'quality_manager']

// GET /api/lots - List all lots for a project
lotsRouter.get('/', async (req, res) => {
  try {
    const user = req.user!
    const { projectId, status, unclaimed } = req.query

    if (!projectId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'projectId query parameter is required'
      })
    }

    // Build where clause based on user role
    const whereClause: any = { projectId: projectId as string }

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
        whereClause.assignedSubcontractorId = subcontractorUser.subcontractorCompanyId
      } else {
        // No subcontractor company found - return empty result
        return res.json({ lots: [] })
      }
    }

    const lots = await prisma.lot.findMany({
      where: whereClause,
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
        budgetAmount: true,
        assignedSubcontractorId: true,
        assignedSubcontractor: {
          select: {
            companyName: true,
          }
        },
        createdAt: true,
      },
      orderBy: { lotNumber: 'asc' },
    })

    res.json({ lots })
  } catch (error) {
    console.error('Get lots error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/lots/:id - Get a single lot
lotsRouter.get('/:id', async (req, res) => {
  try {
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
        layer: true,
        areaZone: true,
        projectId: true,
        assignedSubcontractorId: true,
        createdAt: true,
        updatedAt: true,
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
      return res.status(404).json({ error: 'Lot not found' })
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
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this lot'
      })
    }

    // Authorization check 2: Subcontractors can only access lots assigned to their company
    if (user.roleInCompany === 'subcontractor' || user.roleInCompany === 'subcontractor_admin') {
      // Find the user's subcontractor company
      const subcontractorUser = await prisma.subcontractorUser.findFirst({
        where: { userId: user.id },
      })

      const userSubcontractorId = subcontractorUser?.subcontractorCompanyId

      if (lot.assignedSubcontractorId !== userSubcontractorId) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have access to this lot'
        })
      }
    }

    // Remove sensitive fields before sending response
    const { projectId, assignedSubcontractorId, ...lotResponse } = lot

    res.json({ lot: lotResponse })
  } catch (error) {
    console.error('Get lot error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/lots - Create a new lot (requires creator role in project)
lotsRouter.post('/', async (req, res) => {
  try {
    const user = req.user!
    const { projectId, lotNumber, description, activityType, chainageStart, chainageEnd, lotType } = req.body

    if (!projectId || !lotNumber) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'projectId and lotNumber are required'
      })
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
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to create lots in this project.'
      })
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
      },
      select: {
        id: true,
        lotNumber: true,
        description: true,
        status: true,
        createdAt: true,
      },
    })

    res.status(201).json({ lot })
  } catch (error: any) {
    console.error('Create lot error:', error)

    // Handle Prisma unique constraint violation
    if (error?.code === 'P2002') {
      return res.status(409).json({
        error: 'Conflict',
        message: 'A lot with this number already exists in this project',
        code: 'DUPLICATE_LOT_NUMBER'
      })
    }

    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/lots/bulk - Bulk create lots (requires creator role)
lotsRouter.post('/bulk', requireRole(LOT_CREATORS), async (req, res) => {
  try {
    const { projectId, lots: lotsData } = req.body

    if (!projectId || !lotsData || !Array.isArray(lotsData) || lotsData.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'projectId and lots array are required'
      })
    }

    // Validate all lots have required fields
    for (const lot of lotsData) {
      if (!lot.lotNumber) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Each lot must have a lotNumber'
        })
      }
    }

    // Create all lots in a transaction
    const createdLots = await prisma.$transaction(
      lotsData.map((lot: any) =>
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
  } catch (error) {
    console.error('Bulk create lots error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Roles that can edit lots
const LOT_EDITORS = ['owner', 'admin', 'project_manager', 'site_engineer', 'quality_manager', 'foreman']

// PATCH /api/lots/:id - Update a lot
lotsRouter.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const user = req.user!

    const lot = await prisma.lot.findUnique({
      where: { id },
      select: {
        id: true,
        projectId: true,
        status: true,
      },
    })

    if (!lot) {
      return res.status(404).json({ error: 'Lot not found' })
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
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to edit lots'
      })
    }

    // Don't allow editing conformed or claimed lots (without special override)
    if (lot.status === 'conformed' || lot.status === 'claimed') {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Cannot edit a ${lot.status} lot`
      })
    }

    // Extract allowed fields from request body
    const {
      lotNumber,
      description,
      activityType,
      chainageStart,
      chainageEnd,
      offset,
      layer,
      areaZone,
      status,
      budgetAmount,
      assignedSubcontractorId,
    } = req.body

    // Build update data - only include fields that were provided
    const updateData: any = {}
    if (lotNumber !== undefined) updateData.lotNumber = lotNumber
    if (description !== undefined) updateData.description = description
    if (activityType !== undefined) updateData.activityType = activityType
    if (chainageStart !== undefined) updateData.chainageStart = chainageStart
    if (chainageEnd !== undefined) updateData.chainageEnd = chainageEnd
    if (offset !== undefined) updateData.offset = offset
    if (layer !== undefined) updateData.layer = layer
    if (areaZone !== undefined) updateData.areaZone = areaZone
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
        layer: true,
        areaZone: true,
        budgetAmount: true,
        assignedSubcontractorId: true,
        updatedAt: true,
      },
    })

    res.json({ lot: updatedLot })
  } catch (error) {
    console.error('Update lot error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /api/lots/:id - Delete a lot (requires deleter role)
// Feature #585: Added docket allocation integrity check
lotsRouter.delete('/:id', requireRole(LOT_DELETERS), async (req, res) => {
  try {
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
      return res.status(404).json({ error: 'Lot not found' })
    }

    // Check if lot is conformed or claimed - cannot delete these
    if (lot.status === 'conformed') {
      return res.status(400).json({
        error: 'Cannot delete lot',
        message: 'Cannot delete a conformed lot. Conformed lots have been quality-approved.',
        code: 'LOT_CONFORMED'
      })
    }

    if (lot.status === 'claimed') {
      return res.status(400).json({
        error: 'Cannot delete lot',
        message: 'Cannot delete a claimed lot. This lot is part of a progress claim.',
        code: 'LOT_CLAIMED'
      })
    }

    // Check for unreleased hold points (actual records in hold_points table)
    if (lot.holdPoints && lot.holdPoints.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete lot',
        message: `This lot has ${lot.holdPoints.length} unreleased hold point(s). Release all hold points before deleting the lot.`,
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
        return res.status(400).json({
          error: 'Cannot delete lot',
          message: `This lot has ${unreleasedHoldPoints.length} unreleased hold point(s). Release all hold points before deleting the lot.`,
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
      return res.status(400).json({
        error: 'Cannot delete lot',
        message: `This lot has ${totalDocketAllocations} docket allocation(s) (${docketLabourCount} labour, ${docketPlantCount} plant). Remove docket allocations before deleting the lot.`,
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
  } catch (error) {
    console.error('Delete lot error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})


// POST /api/lots/bulk-delete - Bulk delete lots (requires deleter role)
lotsRouter.post('/bulk-delete', requireRole(LOT_DELETERS), async (req, res) => {
  try {
    const { lotIds } = req.body

    if (!lotIds || !Array.isArray(lotIds) || lotIds.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'lotIds array is required and must not be empty'
      })
    }

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
      return res.status(400).json({
        error: 'Bad Request',
        message: `Cannot delete ${undeletableLots.length} lot(s) that are conformed or claimed: ${undeletableLots.map(l => l.lotNumber).join(', ')}`
      })
    }

    // Check for lots with unreleased hold points
    const lotsWithUnreleasedHP = lotsToDelete.filter(
      lot => lot.holdPoints && lot.holdPoints.length > 0
    )

    if (lotsWithUnreleasedHP.length > 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Cannot delete ${lotsWithUnreleasedHP.length} lot(s) with unreleased hold points: ${lotsWithUnreleasedHP.map(l => l.lotNumber).join(', ')}`,
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
  } catch (error) {
    console.error('Bulk delete lots error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/lots/bulk-update-status - Bulk update lot status (requires creator role)
lotsRouter.post('/bulk-update-status', requireRole(LOT_CREATORS), async (req, res) => {
  try {
    const { lotIds, status } = req.body

    if (!lotIds || !Array.isArray(lotIds) || lotIds.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'lotIds array is required and must not be empty'
      })
    }

    // Valid statuses
    const validStatuses = [
      'not_started', 'in_progress', 'awaiting_test',
      'hold_point', 'ncr_raised', 'completed'
    ]

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `status must be one of: ${validStatuses.join(', ')}`
      })
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
      return res.status(400).json({
        error: 'Bad Request',
        message: `Cannot update ${unupdatableLots.length} lot(s) that are conformed or claimed: ${unupdatableLots.map(l => l.lotNumber).join(', ')}`
      })
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
  } catch (error) {
    console.error('Bulk update lot status error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/lots/bulk-assign-subcontractor - Bulk assign lots to subcontractor (requires creator role)
lotsRouter.post('/bulk-assign-subcontractor', requireRole(LOT_CREATORS), async (req, res) => {
  try {
    const { lotIds, subcontractorId } = req.body

    if (!lotIds || !Array.isArray(lotIds) || lotIds.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'lotIds array is required and must not be empty'
      })
    }

    // subcontractorId can be null (to unassign) or a valid ID
    if (subcontractorId !== null && subcontractorId !== undefined) {
      // Verify subcontractor exists
      const subcontractor = await prisma.subcontractorCompany.findUnique({
        where: { id: subcontractorId },
        select: { id: true, companyName: true }
      })

      if (!subcontractor) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Subcontractor company not found'
        })
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
      return res.status(400).json({
        error: 'Bad Request',
        message: `Cannot update ${unupdatableLots.length} lot(s) that are conformed or claimed: ${unupdatableLots.map(l => l.lotNumber).join(', ')}`
      })
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
  } catch (error) {
    console.error('Bulk assign subcontractor error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/lots/check-role/:projectId - Check user's role on a project
lotsRouter.get('/check-role/:projectId', async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Check role error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/lots/:id/conform-status - Get lot conformance prerequisites status
lotsRouter.get('/:id/conform-status', async (req, res) => {
  try {
    const { id } = req.params
    const user = req.user!

    const result = await checkConformancePrerequisites(id)

    if (result.error) {
      return res.status(404).json({ error: result.error })
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
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this lot'
      })
    }

    res.json(result)
  } catch (error) {
    console.error('Get conform status error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/lots/:id/conform - Conform a lot (quality management)
lotsRouter.post('/:id/conform', async (req, res) => {
  try {
    const { id } = req.params
    const user = req.user!
    const { force } = req.body // Optional force parameter to skip prerequisite check

    // Check conformance prerequisites first
    const conformStatus = await checkConformancePrerequisites(id)

    if (conformStatus.error) {
      return res.status(404).json({ error: conformStatus.error })
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
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to conform lots. Required roles: Quality Manager, Project Manager, Admin, or Owner.'
      })
    }

    // Check if lot is already conformed or claimed
    if (lot.status === 'conformed' || lot.status === 'claimed') {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Lot is already ${lot.status}`
      })
    }

    // Check prerequisites unless force flag is provided (only for admins)
    if (!conformStatus.canConform && !force) {
      return res.status(400).json({
        error: 'Prerequisites not met',
        message: 'Cannot conform lot - prerequisites not met',
        blockingReasons: conformStatus.blockingReasons,
        prerequisites: conformStatus.prerequisites
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
  } catch (error) {
    console.error('Conform lot error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})
