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

// GET /api/dockets/:id - Get single docket with full details (Feature #265)
docketsRouter.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const user = req.user!

    const docket = await prisma.dailyDocket.findUnique({
      where: { id },
      include: {
        subcontractorCompany: {
          select: { id: true, companyName: true }
        },
        project: {
          select: { id: true, name: true }
        },
        labourEntries: {
          include: {
            employee: { select: { id: true, name: true, role: true, hourlyRate: true } },
            lotAllocations: {
              include: { lot: { select: { id: true, lotNumber: true } } }
            }
          },
          orderBy: { startTime: 'asc' }
        },
        plantEntries: {
          include: {
            plant: { select: { id: true, type: true, description: true, idRego: true, dryRate: true, wetRate: true } }
          },
          orderBy: { hoursOperated: 'desc' }
        },
        submittedBy: { select: { id: true, fullName: true, email: true } },
        approvedBy: { select: { id: true, fullName: true, email: true } }
      }
    })

    if (!docket) {
      return res.status(404).json({ error: 'Docket not found' })
    }

    // Get foreman diary for the same date to compare (Feature #265 Step 3)
    let foremanDiary = null
    let discrepancies: string[] = []

    const diary = await prisma.dailyDiary.findFirst({
      where: {
        projectId: docket.projectId,
        date: docket.date
      },
      select: {
        id: true,
        date: true,
        status: true,
        sitePersonnel: true,
        equipmentOnSite: true,
        weatherConditions: true,
        weatherHoursLost: true,
        workPerformed: true
      }
    })

    if (diary) {
      foremanDiary = {
        id: diary.id,
        date: diary.date.toISOString().split('T')[0],
        status: diary.status,
        sitePersonnel: diary.sitePersonnel,
        equipmentOnSite: diary.equipmentOnSite,
        weatherConditions: diary.weatherConditions,
        weatherHoursLost: Number(diary.weatherHoursLost) || 0,
        workPerformed: diary.workPerformed
      }

      // Feature #265 Step 4 - Highlight discrepancies
      const docketPersonnelCount = docket.labourEntries.length
      const diaryPersonnel = diary.sitePersonnel || ''
      if (docketPersonnelCount > 0 && !diaryPersonnel.includes(String(docketPersonnelCount))) {
        discrepancies.push(`Personnel count may differ: docket has ${docketPersonnelCount} entries`)
      }

      const docketPlantCount = docket.plantEntries.length
      const diaryEquipment = diary.equipmentOnSite || ''
      if (docketPlantCount > 0 && !diaryEquipment.includes(String(docketPlantCount))) {
        discrepancies.push(`Plant/equipment count may differ: docket has ${docketPlantCount} entries`)
      }

      if (diary.weatherHoursLost && Number(diary.weatherHoursLost) > 0) {
        discrepancies.push(`Weather hours lost noted in diary: ${diary.weatherHoursLost} hours`)
      }
    }

    // Format labour entries
    const labourEntries = docket.labourEntries.map(entry => ({
      id: entry.id,
      employee: {
        id: entry.employee.id,
        name: entry.employee.name,
        role: entry.employee.role,
        hourlyRate: Number(entry.employee.hourlyRate) || 0
      },
      startTime: entry.startTime,
      finishTime: entry.finishTime,
      submittedHours: Number(entry.submittedHours) || 0,
      approvedHours: Number(entry.approvedHours) || 0,
      hourlyRate: Number(entry.hourlyRate) || 0,
      submittedCost: Number(entry.submittedCost) || 0,
      approvedCost: Number(entry.approvedCost) || 0,
      lotAllocations: entry.lotAllocations.map(a => ({
        lotId: a.lotId,
        lotNumber: a.lot.lotNumber,
        hours: Number(a.hours) || 0
      }))
    }))

    // Format plant entries
    const plantEntries = docket.plantEntries.map(entry => ({
      id: entry.id,
      plant: {
        id: entry.plant.id,
        type: entry.plant.type,
        description: entry.plant.description,
        idRego: entry.plant.idRego,
        dryRate: Number(entry.plant.dryRate) || 0,
        wetRate: Number(entry.plant.wetRate) || 0
      },
      hoursOperated: Number(entry.hoursOperated) || 0,
      wetOrDry: entry.wetOrDry || 'dry',
      hourlyRate: Number(entry.hourlyRate) || 0,
      submittedCost: Number(entry.submittedCost) || 0,
      approvedCost: Number(entry.approvedCost) || 0
    }))

    res.json({
      docket: {
        id: docket.id,
        docketNumber: `DKT-${docket.id.slice(0, 6).toUpperCase()}`,
        date: docket.date.toISOString().split('T')[0],
        status: docket.status,
        project: docket.project,
        subcontractor: docket.subcontractorCompany,
        notes: docket.notes,
        foremanNotes: docket.foremanNotes,
        rejectionReason: docket.rejectionReason,
        submittedAt: docket.submittedAt,
        submittedBy: docket.submittedBy,
        approvedAt: docket.approvedAt,
        approvedBy: docket.approvedBy,
        totalLabourSubmitted: Number(docket.totalLabourSubmitted) || 0,
        totalLabourApproved: Number(docket.totalLabourApproved) || 0,
        totalPlantSubmitted: Number(docket.totalPlantSubmitted) || 0,
        totalPlantApproved: Number(docket.totalPlantApproved) || 0,
        labourEntries,
        plantEntries
      },
      foremanDiary,
      discrepancies: discrepancies.length > 0 ? discrepancies : null
    })
  } catch (error) {
    console.error('Get docket details error:', error)
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
      include: {
        subcontractorCompany: {
          select: { id: true, companyName: true }
        },
        project: {
          select: { id: true, name: true }
        }
      }
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

    // Feature #927 - Notify subcontractor users about docket approval
    const docketNumber = `DKT-${docket.id.slice(0, 6).toUpperCase()}`
    const docketDate = docket.date.toISOString().split('T')[0]
    const approverName = user.fullName || user.email

    // Get all subcontractor users linked to this subcontractor company
    const subcontractorUserLinks = await prisma.subcontractorUser.findMany({
      where: {
        subcontractorCompanyId: docket.subcontractorCompanyId
      }
    })

    // Get user details for these subcontractor users
    const subcontractorUserIds = subcontractorUserLinks.map(su => su.userId)
    const subcontractorUsers = subcontractorUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: subcontractorUserIds } },
          select: { id: true, email: true, fullName: true }
        })
      : []

    // Create notifications for subcontractor users
    const notificationsToCreate = subcontractorUsers.map(su => ({
      userId: su.id,
      projectId: docket.projectId,
      type: 'docket_approved',
      title: 'Docket Approved',
      message: `Your docket ${docketNumber} (${docketDate}) has been approved by ${approverName}. Status: Approved${adjustmentReason ? ` (with adjustments)` : ''}.`,
      linkUrl: `/projects/${docket.projectId}/dockets`
    }))

    if (notificationsToCreate.length > 0) {
      await prisma.notification.createMany({
        data: notificationsToCreate
      })
      console.log(`[Docket Approval] Created ${notificationsToCreate.length} in-app notifications for subcontractor`)
    }

    // Send email notifications to subcontractor users
    for (const su of subcontractorUsers) {
      try {
        await sendNotificationIfEnabled(su.id, 'enabled', {
          title: 'Docket Approved',
          message: `Your docket ${docketNumber} (${docketDate}) has been approved by ${approverName}.\n\nProject: ${docket.project.name}\nStatus: Approved\n${foremanNotes ? `Notes: ${foremanNotes}` : ''}\n${adjustmentReason ? `Adjustment Reason: ${adjustmentReason}` : ''}`,
          projectName: docket.project.name,
          linkUrl: `/projects/${docket.projectId}/dockets`
        })
      } catch (emailError) {
        console.error(`[Docket Approval] Failed to send email to user ${su.id}:`, emailError)
      }
    }

    // Log for development
    console.log(`[Docket Approval] Notification details:`)
    console.log(`  Docket: ${docketNumber}`)
    console.log(`  Approved by: ${approverName}`)
    console.log(`  Notified: ${subcontractorUsers.map(su => su.email).join(', ')}`)

    res.json({
      message: 'Docket approved successfully',
      docket: {
        id: updatedDocket.id,
        docketNumber: `DKT-${updatedDocket.id.slice(0, 6).toUpperCase()}`,
        subcontractor: updatedDocket.subcontractorCompany.companyName,
        status: updatedDocket.status,
        approvedAt: updatedDocket.approvedAt,
      },
      notifiedUsers: subcontractorUsers.map(su => ({
        email: su.email,
        fullName: su.fullName
      }))
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
      include: {
        subcontractorCompany: {
          select: { id: true, companyName: true }
        },
        project: {
          select: { id: true, name: true }
        }
      }
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

    // Feature #928 - Notify subcontractor users about docket rejection
    const docketNumber = `DKT-${docket.id.slice(0, 6).toUpperCase()}`
    const docketDate = docket.date.toISOString().split('T')[0]
    const rejectorName = user.fullName || user.email

    // Get all subcontractor users linked to this subcontractor company
    const subcontractorUserLinks = await prisma.subcontractorUser.findMany({
      where: {
        subcontractorCompanyId: docket.subcontractorCompanyId
      }
    })

    // Get user details for these subcontractor users
    const subcontractorUserIds = subcontractorUserLinks.map(su => su.userId)
    const subcontractorUsers = subcontractorUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: subcontractorUserIds } },
          select: { id: true, email: true, fullName: true }
        })
      : []

    // Create notifications for subcontractor users
    const notificationsToCreate = subcontractorUsers.map(su => ({
      userId: su.id,
      projectId: docket.projectId,
      type: 'docket_rejected',
      title: 'Docket Rejected',
      message: `Your docket ${docketNumber} (${docketDate}) has been rejected by ${rejectorName}.${reason ? ` Reason: ${reason}` : ''}`,
      linkUrl: `/projects/${docket.projectId}/dockets`
    }))

    if (notificationsToCreate.length > 0) {
      await prisma.notification.createMany({
        data: notificationsToCreate
      })
      console.log(`[Docket Rejection] Created ${notificationsToCreate.length} in-app notifications for subcontractor`)
    }

    // Send email notifications to subcontractor users
    for (const su of subcontractorUsers) {
      try {
        await sendNotificationIfEnabled(su.id, 'enabled', {
          title: 'Docket Rejected',
          message: `Your docket ${docketNumber} (${docketDate}) has been rejected by ${rejectorName}.\n\nProject: ${docket.project.name}\nStatus: Rejected\n${reason ? `Reason: ${reason}` : 'No reason provided.'}\n\nPlease review and resubmit if necessary.`,
          projectName: docket.project.name,
          linkUrl: `/projects/${docket.projectId}/dockets`
        })
      } catch (emailError) {
        console.error(`[Docket Rejection] Failed to send email to user ${su.id}:`, emailError)
      }
    }

    // Log for development
    console.log(`[Docket Rejection] Notification details:`)
    console.log(`  Docket: ${docketNumber}`)
    console.log(`  Rejected by: ${rejectorName}`)
    console.log(`  Reason: ${reason || 'Not provided'}`)
    console.log(`  Notified: ${subcontractorUsers.map(su => su.email).join(', ')}`)

    res.json({
      message: 'Docket rejected',
      docket: {
        id: updatedDocket.id,
        status: updatedDocket.status,
      },
      notifiedUsers: subcontractorUsers.map(su => ({
        email: su.email,
        fullName: su.fullName
      }))
    })
  } catch (error) {
    console.error('Reject docket error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ============================================================================
// Feature #261 - Labour Entry Management
// ============================================================================

// GET /api/dockets/:id/labour - Get labour entries for a docket
docketsRouter.get('/:id/labour', async (req, res) => {
  try {
    const { id } = req.params

    const docket = await prisma.dailyDocket.findUnique({
      where: { id },
      include: {
        labourEntries: {
          include: {
            employee: {
              select: { id: true, name: true, role: true, hourlyRate: true }
            },
            lotAllocations: {
              include: {
                lot: { select: { id: true, lotNumber: true } }
              }
            }
          },
          orderBy: { startTime: 'asc' }
        }
      }
    })

    if (!docket) {
      return res.status(404).json({ error: 'Docket not found' })
    }

    // Format labour entries
    const labourEntries = docket.labourEntries.map(entry => ({
      id: entry.id,
      employee: {
        id: entry.employee.id,
        name: entry.employee.name,
        role: entry.employee.role,
        hourlyRate: Number(entry.employee.hourlyRate) || 0
      },
      startTime: entry.startTime,
      finishTime: entry.finishTime,
      submittedHours: Number(entry.submittedHours) || 0,
      approvedHours: Number(entry.approvedHours) || 0,
      hourlyRate: Number(entry.hourlyRate) || 0,
      submittedCost: Number(entry.submittedCost) || 0,
      approvedCost: Number(entry.approvedCost) || 0,
      adjustmentReason: entry.adjustmentReason,
      lotAllocations: entry.lotAllocations.map(alloc => ({
        lotId: alloc.lotId,
        lotNumber: alloc.lot.lotNumber,
        hours: Number(alloc.hours) || 0
      }))
    }))

    // Calculate totals
    const totalSubmittedHours = labourEntries.reduce((sum, e) => sum + e.submittedHours, 0)
    const totalSubmittedCost = labourEntries.reduce((sum, e) => sum + e.submittedCost, 0)
    const totalApprovedHours = labourEntries.reduce((sum, e) => sum + e.approvedHours, 0)
    const totalApprovedCost = labourEntries.reduce((sum, e) => sum + e.approvedCost, 0)

    res.json({
      labourEntries,
      totals: {
        submittedHours: totalSubmittedHours,
        submittedCost: totalSubmittedCost,
        approvedHours: totalApprovedHours,
        approvedCost: totalApprovedCost
      }
    })
  } catch (error) {
    console.error('Get labour entries error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/dockets/:id/labour - Add a labour entry to a docket
docketsRouter.post('/:id/labour', async (req, res) => {
  try {
    const { id } = req.params
    const { employeeId, startTime, finishTime, lotAllocations } = req.body

    if (!employeeId) {
      return res.status(400).json({ error: 'employeeId is required' })
    }

    // Get docket
    const docket = await prisma.dailyDocket.findUnique({
      where: { id },
      include: {
        subcontractorCompany: { select: { id: true } }
      }
    })

    if (!docket) {
      return res.status(404).json({ error: 'Docket not found' })
    }

    if (docket.status !== 'draft') {
      return res.status(400).json({ error: 'Can only add labour to draft dockets' })
    }

    // Get employee from roster
    const employee = await prisma.employeeRoster.findFirst({
      where: {
        id: employeeId,
        subcontractorCompanyId: docket.subcontractorCompanyId
      }
    })

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found in roster' })
    }

    // Calculate hours from start/finish time
    let hours = 0
    if (startTime && finishTime) {
      const [startH, startM] = startTime.split(':').map(Number)
      const [finishH, finishM] = finishTime.split(':').map(Number)
      hours = (finishH + finishM / 60) - (startH + startM / 60)
      if (hours < 0) hours += 24 // Handle overnight shifts
    }

    // Calculate cost
    const hourlyRate = Number(employee.hourlyRate) || 0
    const cost = hours * hourlyRate

    // Create labour entry
    const entry = await prisma.docketLabour.create({
      data: {
        docketId: id,
        employeeId,
        startTime,
        finishTime,
        submittedHours: hours,
        hourlyRate,
        submittedCost: cost,
        lotAllocations: lotAllocations?.length ? {
          create: lotAllocations.map((alloc: { lotId: string; hours: number }) => ({
            lotId: alloc.lotId,
            hours: alloc.hours
          }))
        } : undefined
      },
      include: {
        employee: {
          select: { id: true, name: true, role: true, hourlyRate: true }
        },
        lotAllocations: {
          include: {
            lot: { select: { id: true, lotNumber: true } }
          }
        }
      }
    })

    // Update docket totals
    const allEntries = await prisma.docketLabour.findMany({
      where: { docketId: id }
    })
    const totalHours = allEntries.reduce((sum, e) => sum + (Number(e.submittedHours) || 0), 0)
    const totalCost = allEntries.reduce((sum, e) => sum + (Number(e.submittedCost) || 0), 0)

    await prisma.dailyDocket.update({
      where: { id },
      data: {
        totalLabourSubmitted: totalCost
      }
    })

    res.status(201).json({
      labourEntry: {
        id: entry.id,
        employee: {
          id: entry.employee.id,
          name: entry.employee.name,
          role: entry.employee.role,
          hourlyRate: Number(entry.employee.hourlyRate) || 0
        },
        startTime: entry.startTime,
        finishTime: entry.finishTime,
        submittedHours: Number(entry.submittedHours) || 0,
        hourlyRate: Number(entry.hourlyRate) || 0,
        submittedCost: Number(entry.submittedCost) || 0,
        lotAllocations: entry.lotAllocations.map(alloc => ({
          lotId: alloc.lotId,
          lotNumber: alloc.lot.lotNumber,
          hours: Number(alloc.hours) || 0
        }))
      },
      runningTotal: {
        hours: totalHours,
        cost: totalCost
      }
    })
  } catch (error) {
    console.error('Add labour entry error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PUT /api/dockets/:id/labour/:entryId - Update a labour entry
docketsRouter.put('/:id/labour/:entryId', async (req, res) => {
  try {
    const { id, entryId } = req.params
    const { startTime, finishTime, lotAllocations } = req.body

    const entry = await prisma.docketLabour.findFirst({
      where: { id: entryId, docketId: id },
      include: {
        employee: { select: { hourlyRate: true } }
      }
    })

    if (!entry) {
      return res.status(404).json({ error: 'Labour entry not found' })
    }

    const docket = await prisma.dailyDocket.findUnique({ where: { id } })
    if (docket?.status !== 'draft') {
      return res.status(400).json({ error: 'Can only update labour in draft dockets' })
    }

    // Recalculate hours
    let hours = Number(entry.submittedHours) || 0
    if (startTime && finishTime) {
      const [startH, startM] = startTime.split(':').map(Number)
      const [finishH, finishM] = finishTime.split(':').map(Number)
      hours = (finishH + finishM / 60) - (startH + startM / 60)
      if (hours < 0) hours += 24
    }

    const hourlyRate = Number(entry.hourlyRate) || Number(entry.employee.hourlyRate) || 0
    const cost = hours * hourlyRate

    // Update entry
    const updated = await prisma.docketLabour.update({
      where: { id: entryId },
      data: {
        startTime,
        finishTime,
        submittedHours: hours,
        submittedCost: cost
      },
      include: {
        employee: {
          select: { id: true, name: true, role: true, hourlyRate: true }
        },
        lotAllocations: {
          include: {
            lot: { select: { id: true, lotNumber: true } }
          }
        }
      }
    })

    // Update lot allocations if provided
    if (lotAllocations) {
      await prisma.docketLabourLot.deleteMany({ where: { docketLabourId: entryId } })
      if (lotAllocations.length > 0) {
        await prisma.docketLabourLot.createMany({
          data: lotAllocations.map((alloc: { lotId: string; hours: number }) => ({
            docketLabourId: entryId,
            lotId: alloc.lotId,
            hours: alloc.hours
          }))
        })
      }
    }

    // Update docket totals
    const allEntries = await prisma.docketLabour.findMany({
      where: { docketId: id }
    })
    const totalCost = allEntries.reduce((sum, e) => sum + (Number(e.submittedCost) || 0), 0)

    await prisma.dailyDocket.update({
      where: { id },
      data: { totalLabourSubmitted: totalCost }
    })

    res.json({
      labourEntry: {
        id: updated.id,
        employee: {
          id: updated.employee.id,
          name: updated.employee.name,
          role: updated.employee.role,
          hourlyRate: Number(updated.employee.hourlyRate) || 0
        },
        startTime: updated.startTime,
        finishTime: updated.finishTime,
        submittedHours: Number(updated.submittedHours) || 0,
        hourlyRate: Number(updated.hourlyRate) || 0,
        submittedCost: Number(updated.submittedCost) || 0
      }
    })
  } catch (error) {
    console.error('Update labour entry error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /api/dockets/:id/labour/:entryId - Delete a labour entry
docketsRouter.delete('/:id/labour/:entryId', async (req, res) => {
  try {
    const { id, entryId } = req.params

    const entry = await prisma.docketLabour.findFirst({
      where: { id: entryId, docketId: id }
    })

    if (!entry) {
      return res.status(404).json({ error: 'Labour entry not found' })
    }

    const docket = await prisma.dailyDocket.findUnique({ where: { id } })
    if (docket?.status !== 'draft') {
      return res.status(400).json({ error: 'Can only delete labour from draft dockets' })
    }

    // Delete entry (cascade deletes lot allocations)
    await prisma.docketLabour.delete({ where: { id: entryId } })

    // Update docket totals
    const allEntries = await prisma.docketLabour.findMany({
      where: { docketId: id }
    })
    const totalCost = allEntries.reduce((sum, e) => sum + (Number(e.submittedCost) || 0), 0)

    await prisma.dailyDocket.update({
      where: { id },
      data: { totalLabourSubmitted: totalCost }
    })

    res.json({ message: 'Labour entry deleted' })
  } catch (error) {
    console.error('Delete labour entry error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ============================================================================
// Feature #262 - Plant Entry Management
// ============================================================================

// GET /api/dockets/:id/plant - Get plant entries for a docket
docketsRouter.get('/:id/plant', async (req, res) => {
  try {
    const { id } = req.params

    const docket = await prisma.dailyDocket.findUnique({
      where: { id },
      include: {
        plantEntries: {
          include: {
            plant: {
              select: { id: true, type: true, description: true, idRego: true, dryRate: true, wetRate: true }
            }
          },
          orderBy: { hoursOperated: 'desc' }
        }
      }
    })

    if (!docket) {
      return res.status(404).json({ error: 'Docket not found' })
    }

    // Format plant entries
    const plantEntries = docket.plantEntries.map(entry => ({
      id: entry.id,
      plant: {
        id: entry.plant.id,
        type: entry.plant.type,
        description: entry.plant.description,
        idRego: entry.plant.idRego,
        dryRate: Number(entry.plant.dryRate) || 0,
        wetRate: Number(entry.plant.wetRate) || 0
      },
      hoursOperated: Number(entry.hoursOperated) || 0,
      wetOrDry: entry.wetOrDry || 'dry',
      hourlyRate: Number(entry.hourlyRate) || 0,
      submittedCost: Number(entry.submittedCost) || 0,
      approvedCost: Number(entry.approvedCost) || 0,
      adjustmentReason: entry.adjustmentReason
    }))

    // Calculate totals
    const totalHours = plantEntries.reduce((sum, e) => sum + e.hoursOperated, 0)
    const totalSubmittedCost = plantEntries.reduce((sum, e) => sum + e.submittedCost, 0)
    const totalApprovedCost = plantEntries.reduce((sum, e) => sum + e.approvedCost, 0)

    res.json({
      plantEntries,
      totals: {
        hours: totalHours,
        submittedCost: totalSubmittedCost,
        approvedCost: totalApprovedCost
      }
    })
  } catch (error) {
    console.error('Get plant entries error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/dockets/:id/plant - Add a plant entry to a docket
docketsRouter.post('/:id/plant', async (req, res) => {
  try {
    const { id } = req.params
    const { plantId, hoursOperated, wetOrDry } = req.body

    if (!plantId) {
      return res.status(400).json({ error: 'plantId is required' })
    }

    if (hoursOperated === undefined || hoursOperated === null) {
      return res.status(400).json({ error: 'hoursOperated is required' })
    }

    // Get docket
    const docket = await prisma.dailyDocket.findUnique({
      where: { id },
      include: {
        subcontractorCompany: { select: { id: true } }
      }
    })

    if (!docket) {
      return res.status(404).json({ error: 'Docket not found' })
    }

    if (docket.status !== 'draft') {
      return res.status(400).json({ error: 'Can only add plant to draft dockets' })
    }

    // Get plant from register
    const plant = await prisma.plantRegister.findFirst({
      where: {
        id: plantId,
        subcontractorCompanyId: docket.subcontractorCompanyId
      }
    })

    if (!plant) {
      return res.status(404).json({ error: 'Plant not found in register' })
    }

    // Determine rate based on wet/dry
    const isWet = wetOrDry === 'wet'
    const hourlyRate = isWet ? (Number(plant.wetRate) || Number(plant.dryRate) || 0) : (Number(plant.dryRate) || 0)
    const cost = Number(hoursOperated) * hourlyRate

    // Create plant entry
    const entry = await prisma.docketPlant.create({
      data: {
        docketId: id,
        plantId,
        hoursOperated,
        wetOrDry: wetOrDry || 'dry',
        hourlyRate,
        submittedCost: cost
      },
      include: {
        plant: {
          select: { id: true, type: true, description: true, idRego: true, dryRate: true, wetRate: true }
        }
      }
    })

    // Update docket totals
    const allEntries = await prisma.docketPlant.findMany({
      where: { docketId: id }
    })
    const totalHours = allEntries.reduce((sum, e) => sum + (Number(e.hoursOperated) || 0), 0)
    const totalCost = allEntries.reduce((sum, e) => sum + (Number(e.submittedCost) || 0), 0)

    await prisma.dailyDocket.update({
      where: { id },
      data: {
        totalPlantSubmitted: totalCost
      }
    })

    res.status(201).json({
      plantEntry: {
        id: entry.id,
        plant: {
          id: entry.plant.id,
          type: entry.plant.type,
          description: entry.plant.description,
          idRego: entry.plant.idRego,
          dryRate: Number(entry.plant.dryRate) || 0,
          wetRate: Number(entry.plant.wetRate) || 0
        },
        hoursOperated: Number(entry.hoursOperated) || 0,
        wetOrDry: entry.wetOrDry || 'dry',
        hourlyRate: Number(entry.hourlyRate) || 0,
        submittedCost: Number(entry.submittedCost) || 0
      },
      runningTotal: {
        hours: totalHours,
        cost: totalCost
      }
    })
  } catch (error) {
    console.error('Add plant entry error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PUT /api/dockets/:id/plant/:entryId - Update a plant entry
docketsRouter.put('/:id/plant/:entryId', async (req, res) => {
  try {
    const { id, entryId } = req.params
    const { hoursOperated, wetOrDry } = req.body

    const entry = await prisma.docketPlant.findFirst({
      where: { id: entryId, docketId: id },
      include: {
        plant: { select: { dryRate: true, wetRate: true } }
      }
    })

    if (!entry) {
      return res.status(404).json({ error: 'Plant entry not found' })
    }

    const docket = await prisma.dailyDocket.findUnique({ where: { id } })
    if (docket?.status !== 'draft') {
      return res.status(400).json({ error: 'Can only update plant in draft dockets' })
    }

    // Recalculate cost
    const hours = hoursOperated !== undefined ? Number(hoursOperated) : Number(entry.hoursOperated)
    const isWet = (wetOrDry || entry.wetOrDry) === 'wet'
    const hourlyRate = isWet
      ? (Number(entry.plant.wetRate) || Number(entry.plant.dryRate) || 0)
      : (Number(entry.plant.dryRate) || 0)
    const cost = hours * hourlyRate

    // Update entry
    const updated = await prisma.docketPlant.update({
      where: { id: entryId },
      data: {
        hoursOperated: hours,
        wetOrDry: wetOrDry || entry.wetOrDry,
        hourlyRate,
        submittedCost: cost
      },
      include: {
        plant: {
          select: { id: true, type: true, description: true, idRego: true, dryRate: true, wetRate: true }
        }
      }
    })

    // Update docket totals
    const allEntries = await prisma.docketPlant.findMany({
      where: { docketId: id }
    })
    const totalCost = allEntries.reduce((sum, e) => sum + (Number(e.submittedCost) || 0), 0)

    await prisma.dailyDocket.update({
      where: { id },
      data: { totalPlantSubmitted: totalCost }
    })

    res.json({
      plantEntry: {
        id: updated.id,
        plant: {
          id: updated.plant.id,
          type: updated.plant.type,
          description: updated.plant.description,
          idRego: updated.plant.idRego,
          dryRate: Number(updated.plant.dryRate) || 0,
          wetRate: Number(updated.plant.wetRate) || 0
        },
        hoursOperated: Number(updated.hoursOperated) || 0,
        wetOrDry: updated.wetOrDry || 'dry',
        hourlyRate: Number(updated.hourlyRate) || 0,
        submittedCost: Number(updated.submittedCost) || 0
      }
    })
  } catch (error) {
    console.error('Update plant entry error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /api/dockets/:id/plant/:entryId - Delete a plant entry
docketsRouter.delete('/:id/plant/:entryId', async (req, res) => {
  try {
    const { id, entryId } = req.params

    const entry = await prisma.docketPlant.findFirst({
      where: { id: entryId, docketId: id }
    })

    if (!entry) {
      return res.status(404).json({ error: 'Plant entry not found' })
    }

    const docket = await prisma.dailyDocket.findUnique({ where: { id } })
    if (docket?.status !== 'draft') {
      return res.status(400).json({ error: 'Can only delete plant from draft dockets' })
    }

    // Delete entry
    await prisma.docketPlant.delete({ where: { id: entryId } })

    // Update docket totals
    const allEntries = await prisma.docketPlant.findMany({
      where: { docketId: id }
    })
    const totalCost = allEntries.reduce((sum, e) => sum + (Number(e.submittedCost) || 0), 0)

    await prisma.dailyDocket.update({
      where: { id },
      data: { totalPlantSubmitted: totalCost }
    })

    res.json({ message: 'Plant entry deleted' })
  } catch (error) {
    console.error('Delete plant entry error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})
