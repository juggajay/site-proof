import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'

const prisma = new PrismaClient()
const holdpointsRouter = Router()

// Utility function to calculate appropriate notification time based on working hours
function calculateNotificationTime(
  requestedDate: Date,
  workingHoursStart: string = '07:00',
  workingHoursEnd: string = '17:00',
  workingDays: string = '1,2,3,4,5' // Mon-Fri by default
): { scheduledTime: Date; adjustedForWorkingHours: boolean; reason?: string } {
  const [startHour, startMin] = workingHoursStart.split(':').map(Number)
  const [endHour, endMin] = workingHoursEnd.split(':').map(Number)
  const workingDaysList = workingDays.split(',').map(Number) // 0=Sun, 1=Mon, etc.

  let notificationTime = new Date(requestedDate)
  let adjustedForWorkingHours = false
  let reason: string | undefined

  // Check if requested time is within working hours
  const requestedHour = notificationTime.getHours()
  const requestedMin = notificationTime.getMinutes()
  const requestedDay = notificationTime.getDay()

  const requestedTimeMinutes = requestedHour * 60 + requestedMin
  const startTimeMinutes = startHour * 60 + startMin
  const endTimeMinutes = endHour * 60 + endMin

  // Check if it's a working day
  if (!workingDaysList.includes(requestedDay)) {
    adjustedForWorkingHours = true
    reason = 'Scheduled for non-working day'

    // Find next working day
    let daysToAdd = 1
    while (!workingDaysList.includes((requestedDay + daysToAdd) % 7)) {
      daysToAdd++
      if (daysToAdd > 7) break // Safety to prevent infinite loop
    }
    notificationTime.setDate(notificationTime.getDate() + daysToAdd)
    notificationTime.setHours(startHour, startMin, 0, 0)
    reason = `Adjusted to next working day (${notificationTime.toDateString()}) at ${workingHoursStart}`
  }
  // Check if before working hours start
  else if (requestedTimeMinutes < startTimeMinutes) {
    adjustedForWorkingHours = true
    notificationTime.setHours(startHour, startMin, 0, 0)
    reason = `Adjusted to start of working hours (${workingHoursStart})`
  }
  // Check if after working hours end
  else if (requestedTimeMinutes >= endTimeMinutes) {
    adjustedForWorkingHours = true

    // Schedule for next working day
    let daysToAdd = 1
    while (!workingDaysList.includes((requestedDay + daysToAdd) % 7)) {
      daysToAdd++
      if (daysToAdd > 7) break
    }
    notificationTime.setDate(notificationTime.getDate() + daysToAdd)
    notificationTime.setHours(startHour, startMin, 0, 0)
    reason = `Scheduled after hours - moved to next working day (${notificationTime.toDateString()}) at ${workingHoursStart}`
  }

  return { scheduledTime: notificationTime, adjustedForWorkingHours, reason }
}

interface AuthUser {
  userId: string
  email: string
}

// Auth middleware
const requireAuth = async (req: any, res: any, next: any) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' })
    }
    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as AuthUser
    req.user = decoded
    next()
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

// Get all hold points for a project
holdpointsRouter.get('/project/:projectId', requireAuth, async (req: any, res) => {
  try {
    const { projectId } = req.params

    // Get all lots for the project that have ITP instances with hold points
    const lots = await prisma.lot.findMany({
      where: { projectId },
      include: {
        itpInstance: {
          include: {
            template: {
              include: {
                checklistItems: {
                  where: { pointType: 'hold_point' },
                  orderBy: { sequenceNumber: 'asc' }
                }
              }
            },
            completions: true
          }
        },
        holdPoints: {
          include: {
            itpChecklistItem: true
          }
        }
      }
    })

    // Transform to hold point list
    const holdPoints: any[] = []

    for (const lot of lots) {
      if (!lot.itpInstance?.template?.checklistItems) continue

      for (const item of lot.itpInstance.template.checklistItems) {
        // Find existing hold point record or create virtual one
        const existingHP = lot.holdPoints.find(hp => hp.itpChecklistItemId === item.id)

        // Find the completion status for this item
        const completion = lot.itpInstance.completions.find(c => c.checklistItemId === item.id)

        holdPoints.push({
          id: existingHP?.id || `virtual-${lot.id}-${item.id}`,
          lotId: lot.id,
          lotNumber: lot.lotNumber,
          itpChecklistItemId: item.id,
          description: item.description,
          pointType: item.pointType,
          status: existingHP?.status || 'pending',
          notificationSentAt: existingHP?.notificationSentAt,
          scheduledDate: existingHP?.scheduledDate,
          releasedAt: existingHP?.releasedAt,
          releasedByName: existingHP?.releasedByName,
          releaseNotes: existingHP?.releaseNotes,
          sequenceNumber: item.sequenceNumber,
          isCompleted: completion?.status === 'completed',
          isVerified: completion?.verificationStatus === 'verified',
          createdAt: existingHP?.createdAt || lot.createdAt
        })
      }
    }

    // Sort by lot number, then sequence number
    holdPoints.sort((a, b) => {
      if (a.lotNumber !== b.lotNumber) return a.lotNumber.localeCompare(b.lotNumber)
      return a.sequenceNumber - b.sequenceNumber
    })

    res.json({ holdPoints })
  } catch (error) {
    console.error('Error fetching hold points:', error)
    res.status(500).json({ error: 'Failed to fetch hold points' })
  }
})

// Get hold point details with prerequisite status
holdpointsRouter.get('/lot/:lotId/item/:itemId', requireAuth, async (req: any, res) => {
  try {
    const { lotId, itemId } = req.params

    // Get the lot with ITP instance and all checklist items
    const lot = await prisma.lot.findUnique({
      where: { id: lotId },
      include: {
        itpInstance: {
          include: {
            template: {
              include: {
                checklistItems: {
                  orderBy: { sequenceNumber: 'asc' }
                }
              }
            },
            completions: true
          }
        },
        holdPoints: {
          where: { itpChecklistItemId: itemId },
          include: { itpChecklistItem: true }
        }
      }
    })

    if (!lot || !lot.itpInstance) {
      return res.status(404).json({ error: 'Lot or ITP instance not found' })
    }

    // Find the hold point item
    const holdPointItem = lot.itpInstance.template.checklistItems.find(i => i.id === itemId)
    if (!holdPointItem || holdPointItem.pointType !== 'hold_point') {
      return res.status(404).json({ error: 'Hold point item not found' })
    }

    // Get all preceding items (items with lower sequence number)
    const precedingItems = lot.itpInstance.template.checklistItems.filter(
      i => i.sequenceNumber < holdPointItem.sequenceNumber
    )

    // Check completion status of each preceding item
    const prerequisites = precedingItems.map(item => {
      const completion = lot.itpInstance!.completions.find(c => c.checklistItemId === item.id)
      return {
        id: item.id,
        description: item.description,
        sequenceNumber: item.sequenceNumber,
        isHoldPoint: item.pointType === 'hold_point',
        isCompleted: completion?.status === 'completed',
        isVerified: completion?.verificationStatus === 'verified',
        completedAt: completion?.completedAt
      }
    })

    // Check if all prerequisites are completed
    const incompletePrerequisites = prerequisites.filter(p => !p.isCompleted)
    const canRequestRelease = incompletePrerequisites.length === 0

    // Get existing hold point record
    const existingHP = lot.holdPoints[0]

    res.json({
      holdPoint: {
        id: existingHP?.id || null,
        lotId,
        lotNumber: lot.lotNumber,
        itpChecklistItemId: itemId,
        description: holdPointItem.description,
        sequenceNumber: holdPointItem.sequenceNumber,
        status: existingHP?.status || 'pending',
        notificationSentAt: existingHP?.notificationSentAt,
        scheduledDate: existingHP?.scheduledDate,
        releasedAt: existingHP?.releasedAt,
        releasedByName: existingHP?.releasedByName,
        releaseNotes: existingHP?.releaseNotes
      },
      prerequisites,
      incompletePrerequisites,
      canRequestRelease
    })
  } catch (error) {
    console.error('Error fetching hold point details:', error)
    res.status(500).json({ error: 'Failed to fetch hold point details' })
  }
})

// Request hold point release - checks prerequisites first
holdpointsRouter.post('/request-release', requireAuth, async (req: any, res) => {
  try {
    const { lotId, itpChecklistItemId, scheduledDate, scheduledTime, notificationSentTo } = req.body

    if (!lotId || !itpChecklistItemId) {
      return res.status(400).json({ error: 'lotId and itpChecklistItemId are required' })
    }

    // Get the lot with ITP instance
    const lot = await prisma.lot.findUnique({
      where: { id: lotId },
      include: {
        itpInstance: {
          include: {
            template: {
              include: {
                checklistItems: {
                  orderBy: { sequenceNumber: 'asc' }
                }
              }
            },
            completions: true
          }
        },
        holdPoints: {
          where: { itpChecklistItemId }
        }
      }
    })

    if (!lot || !lot.itpInstance) {
      return res.status(404).json({ error: 'Lot or ITP instance not found' })
    }

    // Find the hold point item
    const holdPointItem = lot.itpInstance.template.checklistItems.find(i => i.id === itpChecklistItemId)
    if (!holdPointItem || holdPointItem.pointType !== 'hold_point') {
      return res.status(400).json({ error: 'Item is not a hold point' })
    }

    // Get all preceding items
    const precedingItems = lot.itpInstance.template.checklistItems.filter(
      i => i.sequenceNumber < holdPointItem.sequenceNumber
    )

    // Check completion status of preceding items
    const incompleteItems = precedingItems.filter(item => {
      const completion = lot.itpInstance!.completions.find(c => c.checklistItemId === item.id)
      return !completion || completion.status !== 'completed'
    })

    // If there are incomplete prerequisites, return error with list
    if (incompleteItems.length > 0) {
      return res.status(400).json({
        error: 'Prerequisites not completed',
        message: 'Cannot request hold point release until all preceding checklist items are completed.',
        incompleteItems: incompleteItems.map(item => ({
          id: item.id,
          description: item.description,
          sequenceNumber: item.sequenceNumber,
          isHoldPoint: item.pointType === 'hold_point'
        }))
      })
    }

    // All prerequisites completed - create or update hold point request
    let holdPoint
    if (lot.holdPoints.length > 0) {
      // Update existing
      holdPoint = await prisma.holdPoint.update({
        where: { id: lot.holdPoints[0].id },
        data: {
          status: 'notified',
          notificationSentAt: new Date(),
          notificationSentTo: notificationSentTo || null,
          scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
          scheduledTime: scheduledTime || null
        },
        include: { itpChecklistItem: true }
      })
    } else {
      // Create new
      holdPoint = await prisma.holdPoint.create({
        data: {
          lotId,
          itpChecklistItemId,
          pointType: 'hold_point',
          description: holdPointItem.description,
          status: 'notified',
          notificationSentAt: new Date(),
          notificationSentTo: notificationSentTo || null,
          scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
          scheduledTime: scheduledTime || null
        },
        include: { itpChecklistItem: true }
      })
    }

    res.json({
      success: true,
      message: 'Hold point release requested successfully',
      holdPoint
    })
  } catch (error) {
    console.error('Error requesting hold point release:', error)
    res.status(500).json({ error: 'Failed to request hold point release' })
  }
})

// Release a hold point
holdpointsRouter.post('/:id/release', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params
    const { releasedByName, releasedByOrg, releaseMethod, releaseNotes } = req.body

    const holdPoint = await prisma.holdPoint.update({
      where: { id },
      data: {
        status: 'released',
        releasedAt: new Date(),
        releasedByName: releasedByName || null,
        releasedByOrg: releasedByOrg || null,
        releaseMethod: releaseMethod || null,
        releaseNotes: releaseNotes || null
      },
      include: {
        itpChecklistItem: true,
        lot: true
      }
    })

    // Also mark the ITP completion as verified
    const itpInstance = await prisma.iTPInstance.findUnique({
      where: { lotId: holdPoint.lotId }
    })

    if (itpInstance) {
      await prisma.iTPCompletion.updateMany({
        where: {
          itpInstanceId: itpInstance.id,
          checklistItemId: holdPoint.itpChecklistItemId
        },
        data: {
          verificationStatus: 'verified',
          verifiedAt: new Date()
        }
      })
    }

    res.json({
      success: true,
      message: 'Hold point released successfully',
      holdPoint
    })
  } catch (error) {
    console.error('Error releasing hold point:', error)
    res.status(500).json({ error: 'Failed to release hold point' })
  }
})

// Chase a hold point (send reminder)
holdpointsRouter.post('/:id/chase', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params

    const holdPoint = await prisma.holdPoint.update({
      where: { id },
      data: {
        chaseCount: { increment: 1 },
        lastChasedAt: new Date()
      }
    })

    res.json({
      success: true,
      message: 'Chase notification sent',
      holdPoint
    })
  } catch (error) {
    console.error('Error chasing hold point:', error)
    res.status(500).json({ error: 'Failed to chase hold point' })
  }
})

// Generate evidence package for a hold point
holdpointsRouter.get('/:id/evidence-package', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params

    // Get the hold point with all related data
    const holdPoint = await prisma.holdPoint.findUnique({
      where: { id },
      include: {
        itpChecklistItem: true,
        lot: {
          include: {
            project: true,
            itpInstance: {
              include: {
                template: {
                  include: {
                    checklistItems: {
                      orderBy: { sequenceNumber: 'asc' }
                    }
                  }
                },
                completions: {
                  include: {
                    completedBy: {
                      select: { id: true, fullName: true, email: true }
                    },
                    verifiedBy: {
                      select: { id: true, fullName: true, email: true }
                    },
                    attachments: {
                      include: {
                        document: true
                      }
                    }
                  }
                }
              }
            },
            testResults: {
              include: {
                verifiedBy: {
                  select: { id: true, fullName: true, email: true }
                }
              }
            },
            documents: {
              where: {
                OR: [
                  { documentType: 'photo' },
                  { category: 'itp_evidence' }
                ]
              }
            }
          }
        }
      }
    })

    if (!holdPoint) {
      return res.status(404).json({ error: 'Hold point not found' })
    }

    const lot = holdPoint.lot
    const itpInstance = lot.itpInstance

    if (!itpInstance) {
      return res.status(400).json({ error: 'No ITP assigned to this lot' })
    }

    // Get all checklist items up to and including the hold point
    const holdPointItem = holdPoint.itpChecklistItem
    const itemsUpToHP = itpInstance.template.checklistItems.filter(
      item => item.sequenceNumber <= holdPointItem.sequenceNumber
    )

    // Map completions to items
    const checklistWithStatus = itemsUpToHP.map(item => {
      const completion = itpInstance.completions.find(c => c.checklistItemId === item.id)
      return {
        sequenceNumber: item.sequenceNumber,
        description: item.description,
        pointType: item.pointType,
        responsibleParty: item.responsibleParty,
        isCompleted: completion?.status === 'completed',
        completedAt: completion?.completedAt,
        completedBy: completion?.completedBy?.fullName || null,
        isVerified: completion?.verificationStatus === 'verified',
        verifiedAt: completion?.verifiedAt,
        verifiedBy: completion?.verifiedBy?.fullName || null,
        notes: completion?.notes,
        attachments: completion?.attachments?.map(a => ({
          id: a.id,
          filename: a.document.filename,
          fileUrl: a.document.fileUrl,
          caption: a.document.caption
        })) || []
      }
    })

    // Get test results
    const testResults = lot.testResults.map(t => ({
      id: t.id,
      testType: t.testType,
      testRequestNumber: t.testRequestNumber,
      laboratoryName: t.laboratoryName,
      resultValue: t.resultValue,
      resultUnit: t.resultUnit,
      passFail: t.passFail,
      status: t.status,
      isVerified: t.status === 'verified',
      verifiedBy: t.verifiedBy?.fullName || null,
      createdAt: t.createdAt
    }))

    // Get photos/evidence documents
    const photos = lot.documents.map(d => ({
      id: d.id,
      filename: d.filename,
      fileUrl: d.fileUrl,
      caption: d.caption,
      uploadedAt: d.uploadedAt
    }))

    // Build evidence package response
    const evidencePackage = {
      holdPoint: {
        id: holdPoint.id,
        description: holdPoint.description,
        status: holdPoint.status,
        notificationSentAt: holdPoint.notificationSentAt,
        scheduledDate: holdPoint.scheduledDate,
        releasedAt: holdPoint.releasedAt,
        releasedByName: holdPoint.releasedByName,
        releaseNotes: holdPoint.releaseNotes
      },
      lot: {
        id: lot.id,
        lotNumber: lot.lotNumber,
        description: lot.description,
        activityType: lot.activityType,
        chainageStart: lot.chainageStart,
        chainageEnd: lot.chainageEnd
      },
      project: {
        id: lot.project.id,
        name: lot.project.name,
        projectNumber: lot.project.projectNumber
      },
      itpTemplate: {
        id: itpInstance.template.id,
        name: itpInstance.template.name,
        activityType: itpInstance.template.activityType
      },
      checklist: checklistWithStatus,
      testResults,
      photos,
      summary: {
        totalChecklistItems: checklistWithStatus.length,
        completedItems: checklistWithStatus.filter(i => i.isCompleted).length,
        verifiedItems: checklistWithStatus.filter(i => i.isVerified).length,
        totalTestResults: testResults.length,
        passingTests: testResults.filter(t => t.passFail === 'pass').length,
        totalPhotos: photos.length,
        totalAttachments: checklistWithStatus.reduce((sum, i) => sum + i.attachments.length, 0)
      },
      generatedAt: new Date().toISOString()
    }

    res.json({ evidencePackage })
  } catch (error) {
    console.error('Error generating evidence package:', error)
    res.status(500).json({ error: 'Failed to generate evidence package' })
  }
})

// Get notification timing for a hold point request based on working hours
holdpointsRouter.post('/calculate-notification-time', requireAuth, async (req: any, res) => {
  try {
    const { projectId, requestedDateTime } = req.body

    if (!projectId || !requestedDateTime) {
      return res.status(400).json({ error: 'projectId and requestedDateTime are required' })
    }

    // Get project working hours configuration
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        workingHoursStart: true,
        workingHoursEnd: true,
        workingDays: true
      }
    })

    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }

    const requestedDate = new Date(requestedDateTime)
    const result = calculateNotificationTime(
      requestedDate,
      project.workingHoursStart || '07:00',
      project.workingHoursEnd || '17:00',
      project.workingDays || '1,2,3,4,5'
    )

    res.json({
      requestedDateTime: requestedDate.toISOString(),
      scheduledNotificationTime: result.scheduledTime.toISOString(),
      adjustedForWorkingHours: result.adjustedForWorkingHours,
      adjustmentReason: result.reason,
      workingHours: {
        start: project.workingHoursStart || '07:00',
        end: project.workingHoursEnd || '17:00',
        days: project.workingDays || '1,2,3,4,5'
      }
    })
  } catch (error) {
    console.error('Error calculating notification time:', error)
    res.status(500).json({ error: 'Failed to calculate notification time' })
  }
})

// Get project working hours configuration
holdpointsRouter.get('/project/:projectId/working-hours', requireAuth, async (req: any, res) => {
  try {
    const { projectId } = req.params

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        workingHoursStart: true,
        workingHoursEnd: true,
        workingDays: true
      }
    })

    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }

    // Parse working days to human-readable format
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const workingDaysList = (project.workingDays || '1,2,3,4,5').split(',').map(Number)
    const workingDayNames = workingDaysList.map(d => dayNames[d])

    res.json({
      projectId: project.id,
      projectName: project.name,
      workingHours: {
        start: project.workingHoursStart || '07:00',
        end: project.workingHoursEnd || '17:00',
        days: project.workingDays || '1,2,3,4,5',
        dayNames: workingDayNames
      }
    })
  } catch (error) {
    console.error('Error fetching working hours:', error)
    res.status(500).json({ error: 'Failed to fetch working hours' })
  }
})

export { holdpointsRouter }
