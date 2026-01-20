import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/authMiddleware.js'
import { createAuditLog, AuditAction } from '../lib/auditLog.js'
import { sendNotificationIfEnabled } from './notifications.js'

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
        contractValue: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    // Hide contract values from subcontractors (commercial isolation)
    const sanitizedProjects = isSubcontractor
      ? projects.map(p => ({ ...p, contractValue: null }))
      : projects

    res.json({ projects: sanitizedProjects })
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
    let subcontractorSuspended = false

    if (isSubcontractor) {
      const subcontractorUser = await prisma.subcontractorUser.findFirst({
        where: { userId: user.id },
        include: {
          subcontractorCompany: {
            select: { projectId: true, status: true }
          }
        }
      })

      // Check if subcontractor has access to this project
      const companyProjectMatch = subcontractorUser?.subcontractorCompany?.projectId === id

      // Check if subcontractor is suspended or removed
      const companyStatus = subcontractorUser?.subcontractorCompany?.status
      subcontractorSuspended = companyStatus === 'suspended' || companyStatus === 'removed'

      // Only grant access if project matches AND company is not suspended/removed
      hasSubcontractorAccess = companyProjectMatch && !subcontractorSuspended
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
        workingHoursStart: true,
        workingHoursEnd: true,
        workingDays: true,
        chainageStart: true,
        chainageEnd: true,
        settings: true, // Feature #697 - HP recipients stored in JSON settings
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

    // Provide specific error message for suspended subcontractors
    if (isSubcontractor && subcontractorSuspended) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Your company has been suspended from this project. Please contact the project manager.'
      })
    }

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
        chainageStart: project.chainageStart ? Number(project.chainageStart) : null,
        chainageEnd: project.chainageEnd ? Number(project.chainageEnd) : null,
      }
    })
  } catch (error) {
    console.error('Get project error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Subscription tier project limits
const TIER_PROJECT_LIMITS: Record<string, number> = {
  basic: 3,
  professional: 10,
  enterprise: 50,
  unlimited: Infinity,
}

// POST /api/projects - Create a new project
projectsRouter.post('/', async (req, res) => {
  try {
    const user = req.user!
    const { name, projectNumber, clientName, startDate, targetCompletion, contractValue, state, specificationSet } = req.body

    if (!name) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Name is required'
      })
    }

    // Check project limit if user has a company
    if (user.companyId) {
      const company = await prisma.company.findUnique({
        where: { id: user.companyId },
        select: { subscriptionTier: true }
      })

      if (company) {
        const tier = company.subscriptionTier || 'basic'
        const limit = TIER_PROJECT_LIMITS[tier] || TIER_PROJECT_LIMITS.basic

        // Count existing projects for this company
        const projectCount = await prisma.project.count({
          where: { companyId: user.companyId }
        })

        if (projectCount >= limit) {
          return res.status(403).json({
            error: 'Project Limit Reached',
            message: `Your ${tier} subscription allows up to ${limit} projects. Please upgrade to create more projects.`,
            currentCount: projectCount,
            limit: limit,
            tier: tier
          })
        }
      }
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
      // Update user's company and set them as owner
      await prisma.user.update({
        where: { id: user.id },
        data: {
          companyId: company.id,
          roleInCompany: 'owner'  // Make them owner of the new company
        }
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
        contractValue: contractValue ? parseFloat(contractValue) : null,
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
    const { name, code, lotPrefix, lotStartingNumber, ncrPrefix, ncrStartingNumber, workingHoursStart, workingHoursEnd, workingDays, chainageStart, chainageEnd, status, settings } = req.body

    // Validate required fields
    if (name !== undefined && !name.trim()) {
      return res.status(400).json({ message: 'Project name is required' })
    }

    // Validate lotPrefix format (must not be empty if provided)
    if (lotPrefix !== undefined && typeof lotPrefix === 'string' && lotPrefix.length > 50) {
      return res.status(400).json({ message: 'Lot prefix must be 50 characters or less' })
    }

    // Validate ncrPrefix format
    if (ncrPrefix !== undefined && typeof ncrPrefix === 'string' && ncrPrefix.length > 50) {
      return res.status(400).json({ message: 'NCR prefix must be 50 characters or less' })
    }

    // Validate starting numbers are positive
    if (lotStartingNumber !== undefined && (typeof lotStartingNumber !== 'number' || lotStartingNumber < 0)) {
      return res.status(400).json({ message: 'Lot starting number must be a positive number' })
    }

    if (ncrStartingNumber !== undefined && (typeof ncrStartingNumber !== 'number' || ncrStartingNumber < 0)) {
      return res.status(400).json({ message: 'NCR starting number must be a positive number' })
    }

    // Validate chainage values
    if (chainageStart !== undefined && chainageStart !== null && (typeof chainageStart !== 'number' || chainageStart < 0)) {
      return res.status(400).json({ message: 'Chainage start must be a non-negative number' })
    }

    if (chainageEnd !== undefined && chainageEnd !== null && (typeof chainageEnd !== 'number' || chainageEnd < 0)) {
      return res.status(400).json({ message: 'Chainage end must be a non-negative number' })
    }

    if (chainageStart !== undefined && chainageEnd !== undefined && chainageStart !== null && chainageEnd !== null && chainageStart >= chainageEnd) {
      return res.status(400).json({ message: 'Chainage end must be greater than chainage start' })
    }

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
    if (workingHoursStart !== undefined) updateData.workingHoursStart = workingHoursStart
    if (workingHoursEnd !== undefined) updateData.workingHoursEnd = workingHoursEnd
    if (workingDays !== undefined) updateData.workingDays = workingDays
    if (chainageStart !== undefined) updateData.chainageStart = chainageStart
    if (chainageEnd !== undefined) updateData.chainageEnd = chainageEnd
    if (status !== undefined) {
      // Validate status values
      const validStatuses = ['active', 'archived', 'completed', 'on_hold']
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid status value' })
      }
      updateData.status = status
    }
    // Feature #697 - Store HP recipients and other notification settings in JSON settings field
    if (settings !== undefined) {
      // Merge with existing settings
      const existingProject = await prisma.project.findUnique({
        where: { id },
        select: { settings: true }
      })
      let existingSettings: Record<string, unknown> = {}
      if (existingProject?.settings) {
        try {
          existingSettings = JSON.parse(existingProject.settings)
        } catch (e) {
          // Invalid JSON, start fresh
        }
      }
      const mergedSettings = { ...existingSettings, ...settings }
      updateData.settings = JSON.stringify(mergedSettings)
    }

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
        workingHoursStart: true,
        workingHoursEnd: true,
        workingDays: true,
        chainageStart: true,
        chainageEnd: true,
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
        chainageStart: updatedProject.chainageStart ? Number(updatedProject.chainageStart) : null,
        chainageEnd: updatedProject.chainageEnd ? Number(updatedProject.chainageEnd) : null,
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

    // Check user limit for the company
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { companyId: true }
    })

    if (project?.companyId) {
      const company = await prisma.company.findUnique({
        where: { id: project.companyId },
        select: { subscriptionTier: true }
      })

      if (company) {
        const TIER_USER_LIMITS: Record<string, number> = {
          basic: 5,
          professional: 25,
          enterprise: 100,
          unlimited: Infinity,
        }

        const tier = company.subscriptionTier || 'basic'
        const userLimit = TIER_USER_LIMITS[tier] || TIER_USER_LIMITS.basic

        const userCount = await prisma.user.count({
          where: { companyId: project.companyId }
        })

        if (userCount >= userLimit) {
          return res.status(403).json({
            error: 'User Limit Reached',
            message: `Your ${tier} subscription allows up to ${userLimit} users. Upgrade your plan to add more team members.`
          })
        }
      }
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

    // Feature #939 - Send team invitation notification to invited user
    try {
      // Get project details for the notification
      const projectDetails = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, name: true, projectNumber: true }
      })

      const inviterName = currentUser.fullName || currentUser.email || 'A team member'

      // Create in-app notification
      await prisma.notification.create({
        data: {
          userId: invitedUser.id,
          projectId,
          type: 'team_invitation',
          title: 'Team Invitation',
          message: `${inviterName} has invited you to join ${projectDetails?.name || 'a project'} as ${role.replace('_', ' ')}.`,
          linkUrl: `/projects/${projectId}`
        }
      })

      // Send email notification
      await sendNotificationIfEnabled(
        invitedUser.id,
        projectId,
        'mentions', // Using mentions type for team invitations
        'Team Invitation',
        `You've been invited to join ${projectDetails?.name || 'a project'} as ${role.replace('_', ' ')}. Project: ${projectDetails?.projectNumber || 'N/A'}`,
        invitedUser.email
      )

      console.log(`[Team Invitation] Notification sent to ${invitedUser.email} for project ${projectDetails?.name}`)
    } catch (notifError) {
      console.error('[Team Invitation] Failed to send notification:', notifError)
      // Don't fail the main request if notifications fail
    }

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

    // Feature #940 - Send role change notification to the user
    if (oldRole !== role) {
      try {
        // Get project details for the notification
        const projectDetails = await prisma.project.findUnique({
          where: { id: projectId },
          select: { id: true, name: true, projectNumber: true }
        })

        const changerName = currentUser.fullName || currentUser.email || 'An administrator'
        const formattedOldRole = oldRole.replace(/_/g, ' ')
        const formattedNewRole = role.replace(/_/g, ' ')

        // Create in-app notification
        await prisma.notification.create({
          data: {
            userId: targetUserId,
            projectId,
            type: 'role_change',
            title: 'Role Changed',
            message: `Your role on ${projectDetails?.name || 'a project'} has been changed from ${formattedOldRole} to ${formattedNewRole} by ${changerName}.`,
            linkUrl: `/projects/${projectId}`
          }
        })

        // Send email notification
        await sendNotificationIfEnabled(
          targetUserId,
          'mentions', // Using mentions type for role changes
          {
            title: 'Role Changed',
            message: `Your role on ${projectDetails?.name || 'a project'} has been changed from ${formattedOldRole} to ${formattedNewRole}.`,
            projectName: projectDetails?.name,
            linkUrl: `/projects/${projectId}`
          }
        )

        console.log(`[Role Change] Notification sent to ${targetProjectUser.user.email} for project ${projectDetails?.name}: ${formattedOldRole} -> ${formattedNewRole}`)
      } catch (notifError) {
        console.error('[Role Change] Failed to send notification:', notifError)
        // Don't fail the main request if notifications fail
      }
    }

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

    // Feature #941 - Send removal notification to the removed user
    try {
      // Get project details for the notification
      const projectDetails = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, name: true, projectNumber: true }
      })

      const removerName = currentUser.fullName || currentUser.email || 'An administrator'
      const formattedRole = targetProjectUser.role.replace(/_/g, ' ')

      // Create in-app notification
      await prisma.notification.create({
        data: {
          userId: targetUserId,
          projectId: null, // Project access has been removed, so we don't link to the project
          type: 'project_removal',
          title: 'Removed from Project',
          message: `You have been removed from ${projectDetails?.name || 'a project'} by ${removerName}. Your previous role was ${formattedRole}.`,
          linkUrl: '/projects' // Link to projects list since they no longer have access to this project
        }
      })

      // Send email notification
      await sendNotificationIfEnabled(
        targetUserId,
        'mentions', // Using mentions type for removal notifications
        {
          title: 'Removed from Project',
          message: `You have been removed from ${projectDetails?.name || 'a project'}. Your previous role was ${formattedRole}.`,
          projectName: projectDetails?.name,
          linkUrl: '/projects'
        }
      )

      console.log(`[Project Removal] Notification sent to ${targetProjectUser.user.email} - removed from ${projectDetails?.name}`)
    } catch (notifError) {
      console.error('[Project Removal] Failed to send notification:', notifError)
      // Don't fail the main request if notifications fail
    }

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

// ============================================================================
// Project Areas
// ============================================================================

// GET /api/projects/:id/areas - Get all project areas
projectsRouter.get('/:id/areas', async (req, res) => {
  try {
    const { id: projectId } = req.params
    const user = req.user!

    // Check user has access to project
    const projectUser = await prisma.projectUser.findFirst({
      where: { projectId, userId: user.id }
    })

    if (!projectUser) {
      return res.status(403).json({ error: 'Not a member of this project' })
    }

    const areas = await prisma.projectArea.findMany({
      where: { projectId },
      orderBy: { chainageStart: 'asc' }
    })

    res.json({
      areas: areas.map(area => ({
        id: area.id,
        name: area.name,
        chainageStart: area.chainageStart ? Number(area.chainageStart) : null,
        chainageEnd: area.chainageEnd ? Number(area.chainageEnd) : null,
        colour: area.colour,
        createdAt: area.createdAt
      }))
    })
  } catch (error) {
    console.error('Get project areas error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/projects/:id/areas - Create a new project area
projectsRouter.post('/:id/areas', async (req, res) => {
  try {
    const { id: projectId } = req.params
    const user = req.user!
    const { name, chainageStart, chainageEnd, colour } = req.body

    // Check user has admin access
    const projectUser = await prisma.projectUser.findFirst({
      where: { projectId, userId: user.id }
    })

    const isAdmin = projectUser?.role === 'admin' ||
                   projectUser?.role === 'project_manager' ||
                   user.roleInCompany === 'admin' ||
                   user.roleInCompany === 'owner'

    if (!isAdmin) {
      return res.status(403).json({ error: 'Only admins can create areas' })
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Area name is required' })
    }

    // Feature #906: Require chainage range for areas
    if (chainageStart == null || chainageEnd == null) {
      return res.status(400).json({
        error: 'Chainage range required',
        message: 'Both chainage start and chainage end are required for project areas.',
        code: 'CHAINAGE_REQUIRED'
      })
    }

    // Validate chainage values are numbers
    const startVal = Number(chainageStart)
    const endVal = Number(chainageEnd)
    if (isNaN(startVal) || isNaN(endVal)) {
      return res.status(400).json({
        error: 'Invalid chainage',
        message: 'Chainage values must be valid numbers.',
        code: 'INVALID_CHAINAGE'
      })
    }

    // Validate start is less than end
    if (startVal >= endVal) {
      return res.status(400).json({
        error: 'Invalid chainage range',
        message: 'Chainage start must be less than chainage end.',
        code: 'INVALID_CHAINAGE_RANGE'
      })
    }

    const area = await prisma.projectArea.create({
      data: {
        projectId,
        name: name.trim(),
        chainageStart: chainageStart != null ? chainageStart : null,
        chainageEnd: chainageEnd != null ? chainageEnd : null,
        colour: colour || null
      }
    })

    res.status(201).json({
      area: {
        id: area.id,
        name: area.name,
        chainageStart: area.chainageStart ? Number(area.chainageStart) : null,
        chainageEnd: area.chainageEnd ? Number(area.chainageEnd) : null,
        colour: area.colour,
        createdAt: area.createdAt
      }
    })
  } catch (error) {
    console.error('Create project area error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PATCH /api/projects/:id/areas/:areaId - Update a project area
projectsRouter.patch('/:id/areas/:areaId', async (req, res) => {
  try {
    const { id: projectId, areaId } = req.params
    const user = req.user!
    const { name, chainageStart, chainageEnd, colour } = req.body

    // Check user has admin access
    const projectUser = await prisma.projectUser.findFirst({
      where: { projectId, userId: user.id }
    })

    const isAdmin = projectUser?.role === 'admin' ||
                   projectUser?.role === 'project_manager' ||
                   user.roleInCompany === 'admin' ||
                   user.roleInCompany === 'owner'

    if (!isAdmin) {
      return res.status(403).json({ error: 'Only admins can update areas' })
    }

    // Check area exists and belongs to project
    const existingArea = await prisma.projectArea.findFirst({
      where: { id: areaId, projectId }
    })

    if (!existingArea) {
      return res.status(404).json({ error: 'Area not found' })
    }

    // Feature #906: Validate chainage if being updated
    const newChainageStart = chainageStart !== undefined ? chainageStart : existingArea.chainageStart
    const newChainageEnd = chainageEnd !== undefined ? chainageEnd : existingArea.chainageEnd

    // If either chainage is being set to null, reject
    if ((chainageStart !== undefined && chainageStart == null) ||
        (chainageEnd !== undefined && chainageEnd == null)) {
      return res.status(400).json({
        error: 'Chainage range required',
        message: 'Both chainage start and chainage end are required for project areas.',
        code: 'CHAINAGE_REQUIRED'
      })
    }

    // Validate chainage range if both are present
    if (newChainageStart != null && newChainageEnd != null) {
      const startVal = Number(newChainageStart)
      const endVal = Number(newChainageEnd)
      if (isNaN(startVal) || isNaN(endVal)) {
        return res.status(400).json({
          error: 'Invalid chainage',
          message: 'Chainage values must be valid numbers.',
          code: 'INVALID_CHAINAGE'
        })
      }
      if (startVal >= endVal) {
        return res.status(400).json({
          error: 'Invalid chainage range',
          message: 'Chainage start must be less than chainage end.',
          code: 'INVALID_CHAINAGE_RANGE'
        })
      }
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name.trim()
    if (chainageStart !== undefined) updateData.chainageStart = chainageStart
    if (chainageEnd !== undefined) updateData.chainageEnd = chainageEnd
    if (colour !== undefined) updateData.colour = colour

    const area = await prisma.projectArea.update({
      where: { id: areaId },
      data: updateData
    })

    res.json({
      area: {
        id: area.id,
        name: area.name,
        chainageStart: area.chainageStart ? Number(area.chainageStart) : null,
        chainageEnd: area.chainageEnd ? Number(area.chainageEnd) : null,
        colour: area.colour,
        createdAt: area.createdAt
      }
    })
  } catch (error) {
    console.error('Update project area error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /api/projects/:id/areas/:areaId - Delete a project area
projectsRouter.delete('/:id/areas/:areaId', async (req, res) => {
  try {
    const { id: projectId, areaId } = req.params
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
      return res.status(403).json({ error: 'Only admins can delete areas' })
    }

    // Check area exists and belongs to project
    const existingArea = await prisma.projectArea.findFirst({
      where: { id: areaId, projectId }
    })

    if (!existingArea) {
      return res.status(404).json({ error: 'Area not found' })
    }

    await prisma.projectArea.delete({
      where: { id: areaId }
    })

    res.json({ message: 'Area deleted successfully' })
  } catch (error) {
    console.error('Delete project area error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})
