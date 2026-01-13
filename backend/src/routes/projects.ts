import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/authMiddleware.js'
import { createAuditLog, AuditAction } from '../lib/auditLog.js'

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

    // For subcontractor users, get projects via SubcontractorUser -> SubcontractorCompany
    const isSubcontractor = user.roleInCompany === 'subcontractor' || user.roleInCompany === 'subcontractor_admin'
    let subcontractorProjectIds: string[] = []

    if (isSubcontractor) {
      // Get the subcontractor company the user belongs to
      const subcontractorUser = await prisma.subcontractorUser.findFirst({
        where: { userId: user.id },
        include: {
          subcontractorCompany: {
            select: { projectId: true }
          }
        }
      })

      if (subcontractorUser?.subcontractorCompany?.projectId) {
        subcontractorProjectIds = [subcontractorUser.subcontractorCompany.projectId]
      }
    }

    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { id: { in: projectIds } },
          { id: { in: subcontractorProjectIds } },
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
    const user = req.user!

    // Check access - user must have access to the project
    const projectUser = await prisma.projectUser.findFirst({
      where: {
        projectId: id,
        userId: user.id,
      },
    })

    // Check subcontractor access
    const isSubcontractor = user.roleInCompany === 'subcontractor' || user.roleInCompany === 'subcontractor_admin'
    let hasSubcontractorAccess = false

    if (isSubcontractor) {
      const subcontractorUser = await prisma.subcontractorUser.findFirst({
        where: { userId: user.id },
        include: {
          subcontractorCompany: {
            select: { projectId: true }
          }
        }
      })

      hasSubcontractorAccess = subcontractorUser?.subcontractorCompany?.projectId === id
    }

    // Also allow company admins/owners to access company projects
    const project = await prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        projectNumber: true,
        clientName: true,
        status: true,
        startDate: true,
        targetCompletion: true,
        contractValue: true,
        companyId: true,
        lotPrefix: true,
        lotStartingNumber: true,
        ncrPrefix: true,
        ncrStartingNumber: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }

    // Check if user has access via ProjectUser, subcontractor, or is company admin/owner
    const isCompanyAdmin = user.roleInCompany === 'admin' || user.roleInCompany === 'owner'
    const isCompanyProject = project.companyId === user.companyId

    if (!projectUser && !hasSubcontractorAccess && !(isCompanyAdmin && isCompanyProject)) {
      return res.status(403).json({ error: 'Access denied to this project' })
    }

    // Hide contract value from subcontractors (commercial isolation)
    if (isSubcontractor) {
      project.contractValue = null
    }

    // Map projectNumber to code for frontend consistency
    res.json({
      project: {
        ...project,
        code: project.projectNumber,
      }
    })
  } catch (error) {
    console.error('Get project error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/projects - Create a new project
projectsRouter.post('/', async (req, res) => {
  try {
    const user = req.user!
    const { name, projectNumber, clientName, startDate, targetCompletion, state, specificationSet } = req.body

    if (!name) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Name is required'
      })
    }

    // Create company for user if they don't have one
    let companyId = user.companyId
    if (!companyId) {
      const company = await prisma.company.create({
        data: {
          name: `${user.fullName || user.email}'s Company`,
          abn: '',
        }
      })
      companyId = company.id
      // Update user's company
      await prisma.user.update({
        where: { id: user.id },
        data: { companyId: company.id }
      })
    }

    // Generate project number if not provided
    const generatedProjectNumber = projectNumber || `PRJ-${Date.now().toString(36).toUpperCase()}`

    const project = await prisma.project.create({
      data: {
        name,
        projectNumber: generatedProjectNumber,
        clientName,
        startDate: startDate ? new Date(startDate) : null,
        targetCompletion: targetCompletion ? new Date(targetCompletion) : null,
        companyId: companyId,
        state: state || 'NSW',
        specificationSet: specificationSet || 'MRTS',
      },
      select: {
        id: true,
        name: true,
        projectNumber: true,
        status: true,
        createdAt: true,
      },
    })

    // Add the creating user to the project
    await prisma.projectUser.create({
      data: {
        projectId: project.id,
        userId: user.id,
        role: 'admin',
        status: 'active',
        acceptedAt: new Date(),
      },
    })

    res.status(201).json({ project })
  } catch (error) {
    console.error('Create project error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})


// PATCH /api/projects/:id - Update project settings
projectsRouter.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const user = req.user!
    const { name, code, lotPrefix, lotStartingNumber, ncrPrefix, ncrStartingNumber } = req.body

    // Check access - user must be admin or project admin
    const projectUser = await prisma.projectUser.findFirst({
      where: {
        projectId: id,
        userId: user.id,
      },
    })

    const isProjectAdmin = projectUser?.role === 'admin' || projectUser?.role === 'project_manager'
    const isCompanyAdmin = user.roleInCompany === 'admin' || user.roleInCompany === 'owner'

    // Get the project to check company ownership
    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true, companyId: true }
    })

    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }

    const isCompanyProject = project.companyId === user.companyId

    if (!isProjectAdmin && !(isCompanyAdmin && isCompanyProject)) {
      return res.status(403).json({ error: 'Access denied. Only project admins can update settings.' })
    }

    // Build update data
    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (code !== undefined) updateData.projectNumber = code
    if (lotPrefix !== undefined) updateData.lotPrefix = lotPrefix
    if (lotStartingNumber !== undefined) updateData.lotStartingNumber = lotStartingNumber
    if (ncrPrefix !== undefined) updateData.ncrPrefix = ncrPrefix
    if (ncrStartingNumber !== undefined) updateData.ncrStartingNumber = ncrStartingNumber

    // Update the project
    const updatedProject = await prisma.project.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        projectNumber: true,
        lotPrefix: true,
        lotStartingNumber: true,
        ncrPrefix: true,
        ncrStartingNumber: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    // Map projectNumber to code for frontend consistency
    res.json({
      project: {
        ...updatedProject,
        code: updatedProject.projectNumber,
      }
    })
  } catch (error) {
    console.error('Update project error:', error)
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

// ==================== User Management Routes ====================

// GET /api/projects/:id/users - Get all users in a project
projectsRouter.get('/:id/users', async (req, res) => {
  try {
    const { id: projectId } = req.params
    const user = req.user!

    // Verify access to the project
    const projectUser = await prisma.projectUser.findFirst({
      where: { projectId, userId: user.id }
    })

    if (!projectUser && user.roleInCompany !== 'admin' && user.roleInCompany !== 'owner') {
      return res.status(403).json({ error: 'Access denied' })
    }

    const projectUsers = await prisma.projectUser.findMany({
      where: { projectId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          }
        }
      },
      orderBy: { invitedAt: 'desc' }
    })

    res.json({
      users: projectUsers.map(pu => ({
        id: pu.id,
        userId: pu.userId,
        email: pu.user.email,
        fullName: pu.user.fullName,
        role: pu.role,
        status: pu.status,
        invitedAt: pu.invitedAt,
        acceptedAt: pu.acceptedAt
      }))
    })
  } catch (error) {
    console.error('Get project users error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/projects/:id/users - Invite a user to a project
projectsRouter.post('/:id/users', async (req, res) => {
  try {
    const { id: projectId } = req.params
    const { email, role } = req.body
    const currentUser = req.user!

    if (!email || !role) {
      return res.status(400).json({ error: 'Email and role are required' })
    }

    // Check current user has admin access to project
    const currentProjectUser = await prisma.projectUser.findFirst({
      where: { projectId, userId: currentUser.id }
    })

    const isAdmin = currentProjectUser?.role === 'admin' ||
                   currentProjectUser?.role === 'project_manager' ||
                   currentUser.roleInCompany === 'admin' ||
                   currentUser.roleInCompany === 'owner'

    if (!isAdmin) {
      return res.status(403).json({ error: 'Only admins can invite users' })
    }

    // Find the user to invite
    const invitedUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, fullName: true }
    })

    if (!invitedUser) {
      return res.status(404).json({ error: 'User not found. They must register first.' })
    }

    // Check if already a member
    const existingMember = await prisma.projectUser.findFirst({
      where: { projectId, userId: invitedUser.id }
    })

    if (existingMember) {
      return res.status(400).json({ error: 'User is already a member of this project' })
    }

    // Create project user
    const newProjectUser = await prisma.projectUser.create({
      data: {
        projectId,
        userId: invitedUser.id,
        role,
        status: 'active',
        acceptedAt: new Date() // Auto-accept for now
      }
    })

    // Audit log
    await createAuditLog({
      projectId,
      userId: currentUser.id,
      entityType: 'project_user',
      entityId: newProjectUser.id,
      action: AuditAction.USER_INVITED,
      changes: {
        invitedUserId: invitedUser.id,
        invitedUserEmail: invitedUser.email,
        role
      },
      req
    })

    res.status(201).json({
      message: 'User invited successfully',
      projectUser: {
        id: newProjectUser.id,
        userId: invitedUser.id,
        email: invitedUser.email,
        fullName: invitedUser.fullName,
        role
      }
    })
  } catch (error) {
    console.error('Invite user error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PATCH /api/projects/:id/users/:userId - Update user role in project
projectsRouter.patch('/:id/users/:userId', async (req, res) => {
  try {
    const { id: projectId, userId: targetUserId } = req.params
    const { role } = req.body
    const currentUser = req.user!

    if (!role) {
      return res.status(400).json({ error: 'Role is required' })
    }

    // Check current user has admin access
    const currentProjectUser = await prisma.projectUser.findFirst({
      where: { projectId, userId: currentUser.id }
    })

    const isAdmin = currentProjectUser?.role === 'admin' ||
                   currentProjectUser?.role === 'project_manager' ||
                   currentUser.roleInCompany === 'admin' ||
                   currentUser.roleInCompany === 'owner'

    if (!isAdmin) {
      return res.status(403).json({ error: 'Only admins can change user roles' })
    }

    // Find the target project user
    const targetProjectUser = await prisma.projectUser.findFirst({
      where: { projectId, userId: targetUserId },
      include: {
        user: { select: { email: true, fullName: true } }
      }
    })

    if (!targetProjectUser) {
      return res.status(404).json({ error: 'User not found in project' })
    }

    const oldRole = targetProjectUser.role

    // Update role
    const updated = await prisma.projectUser.update({
      where: { id: targetProjectUser.id },
      data: { role }
    })

    // Audit log
    await createAuditLog({
      projectId,
      userId: currentUser.id,
      entityType: 'project_user',
      entityId: targetProjectUser.id,
      action: AuditAction.USER_ROLE_CHANGED,
      changes: {
        targetUserId,
        targetUserEmail: targetProjectUser.user.email,
        oldRole,
        newRole: role
      },
      req
    })

    res.json({
      message: 'User role updated successfully',
      projectUser: {
        id: updated.id,
        userId: targetUserId,
        email: targetProjectUser.user.email,
        role: updated.role
      }
    })
  } catch (error) {
    console.error('Update user role error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /api/projects/:id/users/:userId - Remove user from project
projectsRouter.delete('/:id/users/:userId', async (req, res) => {
  try {
    const { id: projectId, userId: targetUserId } = req.params
    const currentUser = req.user!

    // Check current user has admin access
    const currentProjectUser = await prisma.projectUser.findFirst({
      where: { projectId, userId: currentUser.id }
    })

    const isAdmin = currentProjectUser?.role === 'admin' ||
                   currentProjectUser?.role === 'project_manager' ||
                   currentUser.roleInCompany === 'admin' ||
                   currentUser.roleInCompany === 'owner'

    if (!isAdmin) {
      return res.status(403).json({ error: 'Only admins can remove users' })
    }

    // Find the target project user
    const targetProjectUser = await prisma.projectUser.findFirst({
      where: { projectId, userId: targetUserId },
      include: {
        user: { select: { email: true, fullName: true } }
      }
    })

    if (!targetProjectUser) {
      return res.status(404).json({ error: 'User not found in project' })
    }

    // Can't remove yourself
    if (targetUserId === currentUser.id) {
      return res.status(400).json({ error: 'You cannot remove yourself from the project' })
    }

    // Delete the project user
    await prisma.projectUser.delete({
      where: { id: targetProjectUser.id }
    })

    // Audit log
    await createAuditLog({
      projectId,
      userId: currentUser.id,
      entityType: 'project_user',
      entityId: targetProjectUser.id,
      action: AuditAction.USER_REMOVED,
      changes: {
        removedUserId: targetUserId,
        removedUserEmail: targetProjectUser.user.email,
        removedUserRole: targetProjectUser.role
      },
      req
    })

    res.json({
      message: 'User removed successfully',
      removedUser: {
        userId: targetUserId,
        email: targetProjectUser.user.email
      }
    })
  } catch (error) {
    console.error('Remove user error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/projects/:id/audit-logs - Get audit logs for a project
projectsRouter.get('/:id/audit-logs', async (req, res) => {
  try {
    const { id: projectId } = req.params
    const user = req.user!

    // Check user has admin access
    const projectUser = await prisma.projectUser.findFirst({
      where: { projectId, userId: user.id }
    })

    const isAdmin = projectUser?.role === 'admin' ||
                   projectUser?.role === 'project_manager' ||
                   user.roleInCompany === 'admin' ||
                   user.roleInCompany === 'owner'

    if (!isAdmin) {
      return res.status(403).json({ error: 'Only admins can view audit logs' })
    }

    const auditLogs = await prisma.auditLog.findMany({
      where: { projectId },
      include: {
        user: {
          select: { email: true, fullName: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100 // Limit to last 100 entries
    })

    res.json({
      auditLogs: auditLogs.map(log => ({
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        changes: log.changes ? JSON.parse(log.changes) : null,
        performedBy: log.user ? {
          email: log.user.email,
          fullName: log.user.fullName
        } : null,
        ipAddress: log.ipAddress,
        createdAt: log.createdAt
      }))
    })
  } catch (error) {
    console.error('Get audit logs error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})
