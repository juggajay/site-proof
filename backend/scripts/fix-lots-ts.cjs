// Helper script to update lots.ts with subcontractor filtering fix
const fs = require('fs');
const path = require('path');

const lotsContent = `import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAuth, requireRole, requireMinRole } from '../middleware/authMiddleware.js'

export const lotsRouter = Router()

// Apply authentication middleware to all lot routes
lotsRouter.use(requireAuth)

// Roles that can create lots
const LOT_CREATORS = ['owner', 'admin', 'project_manager', 'site_manager', 'foreman']
// Roles that can delete lots
const LOT_DELETERS = ['owner', 'admin', 'project_manager']

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
`;

const targetPath = path.join(__dirname, '..', 'src', 'routes', 'lots.ts');
fs.writeFileSync(targetPath, lotsContent);
console.log('Successfully updated lots.ts with subcontractor filtering fix');
