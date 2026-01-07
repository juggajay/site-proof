import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/authMiddleware.js'

export const projectsRouter = Router()

// Apply authentication middleware to all project routes
projectsRouter.use(requireAuth)

// GET /api/projects - List all projects accessible to the user
projectsRouter.get('/', async (req, res) => {
  try {
    const user = req.user!

    // Get projects the user has access to via ProjectUser table
    const projectUsers = await prisma.projectUser.findMany({
      where: { userId: user.id },
      select: { projectId: true },
    })
    const projectIds = projectUsers.map(pu => pu.projectId)

    // Also include projects from user's company for company admins/owners
    const isCompanyAdmin = user.roleInCompany === 'admin' || user.roleInCompany === 'owner'

    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { id: { in: projectIds } },
          ...(isCompanyAdmin && user.companyId ? [{ companyId: user.companyId }] : [])
        ]
      },
      select: {
        id: true,
        name: true,
        projectNumber: true,
        status: true,
        startDate: true,
        targetCompletion: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json({ projects })
  } catch (error) {
    console.error('Get projects error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/projects/:id - Get a single project
projectsRouter.get('/:id', async (req, res) => {
  try {
    const { id } = req.params

    const project = await prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        status: true,
        startDate: true,
        endDate: true,
        contractValue: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }

    res.json({ project })
  } catch (error) {
    console.error('Get project error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/projects - Create a new project
projectsRouter.post('/', async (req, res) => {
  try {
    const user = req.user!
    const { name, code, description, startDate, endDate } = req.body

    if (!name || !code) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Name and code are required'
      })
    }

    const project = await prisma.project.create({
      data: {
        name,
        code,
        description,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        companyId: user.companyId,
      },
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        createdAt: true,
      },
    })

    res.status(201).json({ project })
  } catch (error) {
    console.error('Create project error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})


// DELETE /api/projects/:id - Delete a project (requires password confirmation)
projectsRouter.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { password } = req.body
    const user = req.user!

    // Password is required for deletion
    if (!password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Password confirmation is required to delete a project'
      })
    }

    // Get the full user record with password hash
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        passwordHash: true,
        roleInCompany: true,
        companyId: true,
      },
    })

    if (!fullUser || !fullUser.passwordHash) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid credentials'
      })
    }

    // Verify password
    const { verifyPassword } = await import('../lib/auth.js')
    if (!verifyPassword(password, fullUser.passwordHash)) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Incorrect password'
      })
    }

    // Check if project exists
    const project = await prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        companyId: true,
      },
    })

    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }

    // Authorization: Only owner/admin can delete, or project must be in user's company
    const isAdmin = fullUser.roleInCompany === 'admin' || fullUser.roleInCompany === 'owner'
    const isCompanyProject = project.companyId === fullUser.companyId

    if (!isAdmin && !isCompanyProject) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to delete this project'
      })
    }

    // Delete the project (cascading deletes will handle related records)
    await prisma.project.delete({
      where: { id },
    })

    res.json({
      message: 'Project deleted successfully',
      deletedProject: { id: project.id, name: project.name }
    })
  } catch (error) {
    console.error('Delete project error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})
