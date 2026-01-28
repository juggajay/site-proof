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
    // Note: user is available from requireAuth middleware but not used in this endpoint
    // const user = req.user!

    const docket = await prisma.dailyDocket.findUnique({
      where: { id },
      include: {
        subcontractorCompany: {
          select: { id: true, companyName: true }
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
        }
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
      include: {
        personnel: {
          select: { id: true, name: true, company: true, role: true }
        },
        plant: {
          select: { id: true, description: true, idRego: true }
        },
        activities: {
          select: { id: true, description: true, lotId: true }
        },
        delays: {
          select: { id: true, delayType: true, durationHours: true, description: true }
        }
      }
    })

    if (diary) {
      // Calculate weather hours lost from delays
      const weatherDelays = diary.delays.filter((d) => d.delayType === 'weather')
      const weatherHoursLost = weatherDelays.reduce((sum, d) => sum + (Number(d.durationHours) || 0), 0)

      foremanDiary = {
        id: diary.id,
        date: diary.date.toISOString().split('T')[0],
        status: diary.status,
        personnelCount: diary.personnel.length,
        plantCount: diary.plant.length,
        weatherConditions: diary.weatherConditions,
        weatherHoursLost,
        activitiesCount: diary.activities.length
      }

      // Feature #265 Step 4 - Highlight discrepancies
      const docketPersonnelCount = docket.labourEntries.length
      const diaryPersonnelCount = diary.personnel.length
      if (docketPersonnelCount > 0 && diaryPersonnelCount !== docketPersonnelCount) {
        discrepancies.push(`Personnel count may differ: docket has ${docketPersonnelCount} entries, diary has ${diaryPersonnelCount}`)
      }

      const docketPlantCount = docket.plantEntries.length
      const diaryPlantCount = diary.plant.length
      if (docketPlantCount > 0 && diaryPlantCount !== docketPlantCount) {
        discrepancies.push(`Plant/equipment count may differ: docket has ${docketPlantCount} entries, diary has ${diaryPlantCount}`)
      }

      if (weatherHoursLost > 0) {
        discrepancies.push(`Weather hours lost noted in diary: ${weatherHoursLost} hours`)
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

    // Fetch project info separately since it's not a relation on DailyDocket
    const project = await prisma.project.findUnique({
      where: { id: docket.projectId },
      select: { id: true, name: true }
    })

    // Fetch submittedBy and approvedBy user info separately
    const submittedBy = docket.submittedById
      ? await prisma.user.findUnique({
          where: { id: docket.submittedById },
          select: { id: true, fullName: true, email: true }
        })
      : null

    const approvedBy = docket.approvedById
      ? await prisma.user.findUnique({
          where: { id: docket.approvedById },
          select: { id: true, fullName: true, email: true }
        })
      : null

    res.json({
      docket: {
        id: docket.id,
        docketNumber: `DKT-${docket.id.slice(0, 6).toUpperCase()}`,
        date: docket.date.toISOString().split('T')[0],
        status: docket.status,
        projectId: docket.projectId,
        project,
        subcontractor: docket.subcontractorCompany,
        notes: docket.notes,
        foremanNotes: docket.foremanNotes,
        adjustmentReason: docket.adjustmentReason,
        submittedAt: docket.submittedAt,
        submittedById: docket.submittedById,
        submittedBy,
        approvedAt: docket.approvedAt,
        approvedById: docket.approvedById,
        approvedBy,
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
        },
        labourEntries: {
          include: {
            lotAllocations: true
          }
        },
        plantEntries: true
      }
    })

    if (!docket) {
      return res.status(404).json({ error: 'Docket not found' })
    }

    if (!['draft', 'rejected'].includes(docket.status)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Only draft or rejected dockets can be submitted'
      })
    }

    // Feature #891: Require at least one entry before submission
    const hasLabourEntries = docket.labourEntries && docket.labourEntries.length > 0
    const hasPlantEntries = docket.plantEntries && docket.plantEntries.length > 0
    if (!hasLabourEntries && !hasPlantEntries) {
      return res.status(400).json({
        error: 'Entry required',
        message: 'At least one labour or plant entry is required before submitting the docket.',
        code: 'ENTRY_REQUIRED'
      })
    }

    // Feature #890: Require lot selection for docket submission
    // Check if docket has labour entries that need lot allocation
    if (docket.labourEntries.length > 0) {
      const hasAnyLotAllocation = docket.labourEntries.some(
        entry => entry.lotAllocations && entry.lotAllocations.length > 0
      )
      if (!hasAnyLotAllocation) {
        return res.status(400).json({
          error: 'Lot required',
          message: 'At least one labour entry must be allocated to a lot before submitting the docket.',
          code: 'LOT_REQUIRED'
        })
      }
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

    // === DIARY AUTO-POPULATION ===
    // When a docket is approved, write its labour and plant data into the daily diary
    try {
      const docketDate = docket.date.toISOString().split('T')[0]

      // Find or create diary for this date
      let diary = await prisma.dailyDiary.findUnique({
        where: { projectId_date: { projectId: docket.projectId, date: docket.date } },
      })

      if (!diary) {
        diary = await prisma.dailyDiary.create({
          data: {
            projectId: docket.projectId,
            date: docket.date,
            status: 'draft',
          },
        })
        console.log(`[Docket→Diary] Auto-created diary for ${docketDate}`)
      }

      // Don't modify submitted diaries
      if (diary.status !== 'submitted') {
        // Fetch full docket with labour and plant entries
        const fullDocket = await prisma.dailyDocket.findUnique({
          where: { id: docket.id },
          include: {
            labourEntries: {
              include: {
                employee: { select: { name: true, role: true } },
                lotAllocations: true,
              },
            },
            plantEntries: {
              include: {
                plant: { select: { type: true, description: true, idRego: true } },
                lotAllocations: true,
              },
            },
            subcontractorCompany: { select: { companyName: true } },
          },
        })

        if (fullDocket) {
          // Write personnel records from labour entries
          for (const entry of fullDocket.labourEntries) {
            await prisma.diaryPersonnel.create({
              data: {
                diaryId: diary.id,
                name: entry.employee.name,
                role: entry.employee.role || undefined,
                company: fullDocket.subcontractorCompany.companyName,
                hours: entry.approvedHours || entry.submittedHours || undefined,
                startTime: entry.startTime || undefined,
                finishTime: entry.finishTime || undefined,
                source: 'docket',
                docketId: docket.id,
                lotId: entry.lotAllocations[0]?.lotId || undefined,
              },
            })
          }

          // Write plant records from plant entries
          for (const entry of fullDocket.plantEntries) {
            await prisma.diaryPlant.create({
              data: {
                diaryId: diary.id,
                description: entry.plant.description || entry.plant.type,
                idRego: entry.plant.idRego || undefined,
                company: fullDocket.subcontractorCompany.companyName,
                hoursOperated: entry.hoursOperated || undefined,
                source: 'docket',
                docketId: docket.id,
                lotId: entry.lotAllocations[0]?.lotId || undefined,
              },
            })
          }

          console.log(`[Docket→Diary] Populated diary with ${fullDocket.labourEntries.length} personnel + ${fullDocket.plantEntries.length} plant from docket ${docket.id}`)
        }
      } else {
        console.log(`[Docket→Diary] Diary for ${docketDate} is already submitted, skipping auto-population`)
      }
    } catch (diaryError) {
      // Don't fail the approval if diary population fails
      console.error('[Docket→Diary] Auto-population failed (docket still approved):', diaryError)
    }
    // === END DIARY AUTO-POPULATION ===

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

// POST /api/dockets/:id/query - Query a docket (Feature #268)
docketsRouter.post('/:id/query', requireRole(DOCKET_APPROVERS), async (req, res) => {
  try {
    const { id } = req.params
    const user = req.user!
    const { questions } = req.body

    if (!questions || questions.trim() === '') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Questions/issues are required'
      })
    }

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
        message: 'Only pending dockets can be queried'
      })
    }

    // Step 5 - Update status to 'queried'
    const updatedDocket = await prisma.dailyDocket.update({
      where: { id },
      data: {
        status: 'queried',
        foremanNotes: questions, // Store the query in foreman notes
      },
    })

    // Step 6 - Notify subcontractor users
    const docketNumber = `DKT-${docket.id.slice(0, 6).toUpperCase()}`
    const docketDate = docket.date.toISOString().split('T')[0]
    const querierName = user.fullName || user.email

    // Get all subcontractor users linked to this subcontractor company
    const subcontractorUserLinks = await prisma.subcontractorUser.findMany({
      where: {
        subcontractorCompanyId: docket.subcontractorCompanyId
      }
    })

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
      type: 'docket_queried',
      title: 'Docket Query',
      message: `${querierName} has raised a query on docket ${docketNumber} (${docketDate}).\n\nQuestions: ${questions.substring(0, 200)}${questions.length > 200 ? '...' : ''}\n\nPlease review and respond or amend the docket.`,
      linkUrl: `/projects/${docket.projectId}/dockets`
    }))

    if (notificationsToCreate.length > 0) {
      await prisma.notification.createMany({
        data: notificationsToCreate
      })
      console.log(`[Docket Query] Created ${notificationsToCreate.length} in-app notifications for subcontractor`)
    }

    // Send email notifications to subcontractor users
    for (const su of subcontractorUsers) {
      try {
        await sendNotificationIfEnabled(su.id, 'enabled', {
          title: 'Docket Query - Response Required',
          message: `${querierName} has raised a query on docket ${docketNumber} (${docketDate}).\n\nProject: ${docket.project.name}\n\nQuestions/Issues:\n${questions}\n\nPlease review and respond or amend the docket.`,
          projectName: docket.project.name,
          linkUrl: `/projects/${docket.projectId}/dockets`
        })
      } catch (emailError) {
        console.error(`[Docket Query] Failed to send email to user ${su.id}:`, emailError)
      }
    }

    // Log for development
    console.log(`[Docket Query] Notification details:`)
    console.log(`  Docket: ${docketNumber}`)
    console.log(`  Queried by: ${querierName}`)
    console.log(`  Questions: ${questions.substring(0, 100)}...`)
    console.log(`  Notified: ${subcontractorUsers.map(su => su.email).join(', ')}`)

    res.json({
      message: 'Docket queried successfully',
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
    console.error('Query docket error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/dockets/:id/respond - Respond to a docket query (Feature #268 Step 7)
docketsRouter.post('/:id/respond', async (req, res) => {
  try {
    const { id } = req.params
    const user = req.user!
    const { response } = req.body

    if (!response || response.trim() === '') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Response is required'
      })
    }

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

    if (docket.status !== 'queried') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Only queried dockets can be responded to'
      })
    }

    // Update status back to pending_approval and append response to notes
    const existingNotes = docket.notes || ''
    const newNotes = existingNotes
      ? `${existingNotes}\n\n--- Response to Query ---\n${response}`
      : `--- Response to Query ---\n${response}`

    const updatedDocket = await prisma.dailyDocket.update({
      where: { id },
      data: {
        status: 'pending_approval', // Back to pending for re-review
        notes: newNotes,
      },
    })

    // Notify project approvers about the response
    const docketNumber = `DKT-${docket.id.slice(0, 6).toUpperCase()}`
    const docketDate = docket.date.toISOString().split('T')[0]
    const responderName = user.fullName || user.email

    const projectUsers = await prisma.projectUser.findMany({
      where: {
        projectId: docket.projectId,
        role: { in: DOCKET_APPROVERS }
      },
      include: {
        user: { select: { id: true, email: true, fullName: true } }
      }
    })

    const notificationsToCreate = projectUsers.map(pu => ({
      userId: pu.userId,
      projectId: docket.projectId,
      type: 'docket_query_response',
      title: 'Docket Query Response',
      message: `${responderName} has responded to the query on docket ${docketNumber} (${docketDate}).\n\nResponse: ${response.substring(0, 200)}${response.length > 200 ? '...' : ''}\n\nThe docket is ready for review.`,
      linkUrl: `/projects/${docket.projectId}/dockets`
    }))

    if (notificationsToCreate.length > 0) {
      await prisma.notification.createMany({
        data: notificationsToCreate
      })
      console.log(`[Docket Query Response] Created ${notificationsToCreate.length} notifications for approvers`)
    }

    res.json({
      message: 'Query response submitted',
      docket: {
        id: updatedDocket.id,
        status: updatedDocket.status,
      }
    })
  } catch (error) {
    console.error('Respond to docket query error:', error)
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
