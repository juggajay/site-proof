import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAuth, requireRole, requireMinRole } from '../middleware/authMiddleware.js'

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
    const { projectId } = req.query

    if (!projectId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'projectId query parameter is required'
      })
    }

    // Build where clause based on user role
    const whereClause: any = { projectId: projectId as string }

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

// POST /api/lots - Create a new lot (requires creator role)
lotsRouter.post('/', requireRole(LOT_CREATORS), async (req, res) => {
  try {
    const { projectId, lotNumber, description, activityType, chainageStart, chainageEnd } = req.body

    if (!projectId || !lotNumber) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'projectId and lotNumber are required'
      })
    }

    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber,
        description,
        activityType,
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
  } catch (error) {
    console.error('Create lot error:', error)
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
lotsRouter.delete('/:id', requireRole(LOT_DELETERS), async (req, res) => {
  try {
    const { id } = req.params

    const lot = await prisma.lot.findUnique({
      where: { id },
    })

    if (!lot) {
      return res.status(404).json({ error: 'Lot not found' })
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

// POST /api/lots/:id/conform - Conform a lot (quality management)
lotsRouter.post('/:id/conform', async (req, res) => {
  try {
    const { id } = req.params
    const user = req.user!

    // Check if user has the right role to conform lots
    // Get user's role on the project first
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
