import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middleware/authMiddleware.js'
import { sendNotificationIfEnabled } from './notifications.js'

export const docketsRouter = Router()

// Apply authentication middleware to all docket routes
docketsRouter.use(requireAuth)

// Roles that can approve dockets
const DOCKET_APPROVERS = ['owner', 'admin', 'project_manager', 'site_manager', 'foreman']

// GET /api/dockets - List dockets for a project
docketsRouter.get('/', async (req, res) => {
  try {
    const user = req.user!
    const { projectId, status } = req.query

    if (!projectId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'projectId query parameter is required'
      })
    }

    const whereClause: any = { projectId: projectId as string }

    // Filter by status if provided
    if (status) {
      whereClause.status = status as string
    }

    // Subcontractors can only see their own company's dockets
    if (user.roleInCompany === 'subcontractor' || user.roleInCompany === 'subcontractor_admin') {
      const subcontractorUser = await prisma.subcontractorUser.findFirst({
        where: { userId: user.id },
      })

      if (subcontractorUser) {
        whereClause.subcontractorCompanyId = subcontractorUser.subcontractorCompanyId
      } else {
        return res.json({ dockets: [] })
      }
    }

    const dockets = await prisma.dailyDocket.findMany({
      where: whereClause,
      include: {
        subcontractorCompany: {
          select: {
            id: true,
            companyName: true,
          }
        },
        labourEntries: {
          include: {
            employee: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        },
        plantEntries: {
          include: {
            plant: {
              select: {
                id: true,
                type: true,
                description: true,
              }
            }
          }
        },
      },
      orderBy: { date: 'desc' },
    })

    // Format dockets for response
    const formattedDockets = dockets.map(docket => ({
      id: docket.id,
      docketNumber: `DKT-${docket.id.slice(0, 6).toUpperCase()}`,
      subcontractor: docket.subcontractorCompany.companyName,
      subcontractorId: docket.subcontractorCompany.id,
      date: docket.date.toISOString().split('T')[0],
      status: docket.status,
      notes: docket.notes,
      labourHours: docket.labourEntries.reduce((sum, entry) =>
        sum + (Number(entry.submittedHours) || 0), 0
      ),
      plantHours: docket.plantEntries.reduce((sum, entry) =>
        sum + (Number(entry.hoursOperated) || 0), 0
      ),
      totalLabourSubmitted: Number(docket.totalLabourSubmitted) || 0,
      totalLabourApproved: Number(docket.totalLabourApproved) || 0,
      totalPlantSubmitted: Number(docket.totalPlantSubmitted) || 0,
      totalPlantApproved: Number(docket.totalPlantApproved) || 0,
      submittedAt: docket.submittedAt,
      approvedAt: docket.approvedAt,
      foremanNotes: docket.foremanNotes,
    }))

    res.json({ dockets: formattedDockets })
  } catch (error) {
    console.error('Get dockets error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/dockets - Create a new docket
docketsRouter.post('/', async (req, res) => {
  try {
    const user = req.user!
    const { projectId, date, labourHours, plantHours, notes } = req.body

    if (!projectId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'projectId is required'
      })
    }

    // Find user's subcontractor company
    const subcontractorUser = await prisma.subcontractorUser.findFirst({
      where: { userId: user.id },
    })

    if (!subcontractorUser) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only subcontractors can create dockets'
      })
    }

    const docket = await prisma.dailyDocket.create({
      data: {
        projectId,
        subcontractorCompanyId: subcontractorUser.subcontractorCompanyId,
        date: new Date(date || new Date()),
        status: 'draft',
        notes,
        totalLabourSubmitted: labourHours || 0,
        totalPlantSubmitted: plantHours || 0,
      },
      include: {
        subcontractorCompany: {
          select: {
            companyName: true,
          }
        }
      }
    })

    res.status(201).json({
      docket: {
        id: docket.id,
        docketNumber: `DKT-${docket.id.slice(0, 6).toUpperCase()}`,
        subcontractor: docket.subcontractorCompany.companyName,
        date: docket.date.toISOString().split('T')[0],
        status: docket.status,
        labourHours: Number(docket.totalLabourSubmitted) || 0,
        plantHours: Number(docket.totalPlantSubmitted) || 0,
        notes: docket.notes,
      }
    })
  } catch (error) {
    console.error('Create docket error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/dockets/:id/submit - Submit a docket for approval
docketsRouter.post('/:id/submit', async (req, res) => {
  try {
    const { id } = req.params
    const user = req.user!

    const docket = await prisma.dailyDocket.findUnique({
      where: { id },
      include: {
        subcontractorCompany: {
          select: { companyName: true }
        },
        project: {
          select: { id: true, name: true }
        }
      }
    })

    if (!docket) {
      return res.status(404).json({ error: 'Docket not found' })
    }

    if (docket.status !== 'draft') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Only draft dockets can be submitted'
      })
    }

    const updatedDocket = await prisma.dailyDocket.update({
      where: { id },
      data: {
        status: 'pending_approval',
        submittedById: user.id,
        submittedAt: new Date(),
      },
    })

    // Feature #926 - Notify foremen and approvers about pending docket
    // Get all project users who can approve dockets (foreman, site_manager, project_manager, admin, owner)
    const projectUsers = await prisma.projectUser.findMany({
      where: {
        projectId: docket.projectId,
        role: { in: ['owner', 'admin', 'project_manager', 'site_manager', 'foreman'] }
      },
      include: {
        user: {
          select: { id: true, email: true, fullName: true }
        }
      }
    })

    // Count total pending dockets for this project
    const pendingCount = await prisma.dailyDocket.count({
      where: {
        projectId: docket.projectId,
        status: 'pending_approval'
      }
    })

    // Create in-app notifications for approvers
    const docketNumber = `DKT-${docket.id.slice(0, 6).toUpperCase()}`
    const docketDate = docket.date.toISOString().split('T')[0]
    const subcontractorName = docket.subcontractorCompany.companyName

    const notificationsToCreate = projectUsers.map(pu => ({
      userId: pu.userId,
      projectId: docket.projectId,
      type: 'docket_pending',
      title: 'Docket Pending Approval',
      message: `${subcontractorName} has submitted docket ${docketNumber} (${docketDate}) for approval. ${pendingCount} docket${pendingCount !== 1 ? 's' : ''} pending.`,
      linkUrl: `/projects/${docket.projectId}/dockets`
    }))

    if (notificationsToCreate.length > 0) {
      await prisma.notification.createMany({
        data: notificationsToCreate
      })
      console.log(`[Docket Submit] Created ${notificationsToCreate.length} in-app notifications for pending docket`)
    }

    // Send email notifications to approvers (if configured)
    for (const pu of projectUsers) {
      try {
        await sendNotificationIfEnabled(pu.userId, 'enabled', {
          title: 'Docket Pending Approval',
          message: `${subcontractorName} has submitted docket ${docketNumber} (${docketDate}) for approval.\n\nProject: ${docket.project.name}\nPending Dockets: ${pendingCount}\n\nPlease review and approve at your earliest convenience.`,
          projectName: docket.project.name,
          linkUrl: `/projects/${docket.projectId}/dockets`
        })
      } catch (emailError) {
        console.error(`[Docket Submit] Failed to send email to user ${pu.userId}:`, emailError)
      }
    }

    // Log for development
    console.log(`[Docket Submit] Notification details:`)
    console.log(`  Docket: ${docketNumber}`)
    console.log(`  Subcontractor: ${subcontractorName}`)
    console.log(`  Notified: ${projectUsers.map(pu => pu.user.email).join(', ')}`)
    console.log(`  Pending Count: ${pendingCount}`)

    res.json({
      message: 'Docket submitted for approval',
      docket: {
        id: updatedDocket.id,
        status: updatedDocket.status,
        submittedAt: updatedDocket.submittedAt,
      },
      notifiedUsers: projectUsers.map(pu => ({
        email: pu.user.email,
        fullName: pu.user.fullName
      }))
    })
  } catch (error) {
    console.error('Submit docket error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/dockets/:id/approve - Approve a docket
docketsRouter.post('/:id/approve', requireRole(DOCKET_APPROVERS), async (req, res) => {
  try {
    const { id } = req.params
    const user = req.user!
    const { foremanNotes, adjustmentReason, adjustedLabourHours, adjustedPlantHours } = req.body

    const docket = await prisma.dailyDocket.findUnique({
      where: { id },
    })

    if (!docket) {
      return res.status(404).json({ error: 'Docket not found' })
    }

    if (docket.status !== 'pending_approval') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Only pending dockets can be approved'
      })
    }

    // Use adjusted values if provided, otherwise copy submitted values
    const labourApproved = adjustedLabourHours !== undefined
      ? adjustedLabourHours
      : docket.totalLabourSubmitted
    const plantApproved = adjustedPlantHours !== undefined
      ? adjustedPlantHours
      : docket.totalPlantSubmitted

    const updatedDocket = await prisma.dailyDocket.update({
      where: { id },
      data: {
        status: 'approved',
        approvedById: user.id,
        approvedAt: new Date(),
        foremanNotes,
        adjustmentReason,
        totalLabourApproved: labourApproved,
        totalPlantApproved: plantApproved,
      },
      include: {
        subcontractorCompany: {
          select: {
            companyName: true,
          }
        }
      }
    })

    res.json({
      message: 'Docket approved successfully',
      docket: {
        id: updatedDocket.id,
        docketNumber: `DKT-${updatedDocket.id.slice(0, 6).toUpperCase()}`,
        subcontractor: updatedDocket.subcontractorCompany.companyName,
        status: updatedDocket.status,
        approvedAt: updatedDocket.approvedAt,
      }
    })
  } catch (error) {
    console.error('Approve docket error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/dockets/:id/reject - Reject a docket
docketsRouter.post('/:id/reject', requireRole(DOCKET_APPROVERS), async (req, res) => {
  try {
    const { id } = req.params
    const user = req.user!
    const { reason } = req.body

    const docket = await prisma.dailyDocket.findUnique({
      where: { id },
    })

    if (!docket) {
      return res.status(404).json({ error: 'Docket not found' })
    }

    if (docket.status !== 'pending_approval') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Only pending dockets can be rejected'
      })
    }

    const updatedDocket = await prisma.dailyDocket.update({
      where: { id },
      data: {
        status: 'rejected',
        approvedById: user.id,
        approvedAt: new Date(),
        foremanNotes: reason,
      },
    })

    res.json({
      message: 'Docket rejected',
      docket: {
        id: updatedDocket.id,
        status: updatedDocket.status,
      }
    })
  } catch (error) {
    console.error('Reject docket error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})
