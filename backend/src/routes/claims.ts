import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/authMiddleware.js'
import { sendNotificationIfEnabled } from './notifications.js'

const router = Router()

// All routes require authentication
router.use(requireAuth)

// GET /api/projects/:projectId/lots - Get conformed lots for claiming
router.get('/:projectId/lots', async (req, res) => {
  try {
    const { projectId } = req.params
    const { status, unclaimed } = req.query

    const whereClause: any = { projectId }

    // Filter by status if provided
    if (status) {
      whereClause.status = status as string
    }

    // Filter for unclaimed lots (no claimedInId)
    if (unclaimed === 'true') {
      whereClause.claimedInId = null
    }

    const lots = await prisma.lot.findMany({
      where: whereClause,
      select: {
        id: true,
        lotNumber: true,
        description: true,
        status: true,
        activityType: true,
        budgetAmount: true,
      },
      orderBy: { lotNumber: 'asc' },
    })

    // Transform to match frontend interface
    const transformedLots = lots.map(lot => ({
      id: lot.id,
      lotNumber: lot.lotNumber,
      activity: lot.activityType,
      budgetAmount: lot.budgetAmount ? Number(lot.budgetAmount) : 0,
    }))

    res.json({ lots: transformedLots })
  } catch (error) {
    console.error('Error fetching lots:', error)
    res.status(500).json({ error: 'Failed to fetch lots' })
  }
})

// GET /api/projects/:projectId/claims - List all claims for a project
router.get('/:projectId/claims', async (req, res) => {
  try {
    const { projectId } = req.params

    const claims = await prisma.progressClaim.findMany({
      where: { projectId },
      orderBy: { claimNumber: 'desc' },
      include: {
        _count: {
          select: { claimedLots: true }
        }
      }
    })

    // Transform to match frontend interface
    const transformedClaims = claims.map(claim => ({
      id: claim.id,
      claimNumber: claim.claimNumber,
      periodStart: claim.claimPeriodStart.toISOString().split('T')[0],
      periodEnd: claim.claimPeriodEnd.toISOString().split('T')[0],
      status: claim.status,
      totalClaimedAmount: claim.totalClaimedAmount ? Number(claim.totalClaimedAmount) : 0,
      certifiedAmount: claim.certifiedAmount ? Number(claim.certifiedAmount) : null,
      paidAmount: claim.paidAmount ? Number(claim.paidAmount) : null,
      submittedAt: claim.submittedAt ? claim.submittedAt.toISOString().split('T')[0] : null,
      disputeNotes: claim.disputeNotes || null,
      disputedAt: claim.disputedAt ? claim.disputedAt.toISOString().split('T')[0] : null,
      lotCount: claim._count.claimedLots
    }))

    res.json({ claims: transformedClaims })
  } catch (error) {
    console.error('Error fetching claims:', error)
    res.status(500).json({ error: 'Failed to fetch claims' })
  }
})

// GET /api/projects/:projectId/claims/:claimId - Get a single claim
router.get('/:projectId/claims/:claimId', async (req, res) => {
  try {
    const { projectId, claimId } = req.params

    const claim = await prisma.progressClaim.findFirst({
      where: { id: claimId, projectId },
      include: {
        claimedLots: {
          include: {
            lot: true
          }
        },
        preparedBy: {
          select: { id: true, fullName: true, email: true }
        }
      }
    })

    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' })
    }

    res.json({ claim })
  } catch (error) {
    console.error('Error fetching claim:', error)
    res.status(500).json({ error: 'Failed to fetch claim' })
  }
})

// POST /api/projects/:projectId/claims - Create a new claim
router.post('/:projectId/claims', async (req, res) => {
  try {
    const { projectId } = req.params
    const { periodStart, periodEnd, lotIds } = req.body
    const userId = (req as any).userId

    // Validate required fields
    if (!periodStart || !periodEnd || !lotIds || !Array.isArray(lotIds) || lotIds.length === 0) {
      return res.status(400).json({ error: 'Period start, period end, and at least one lot are required' })
    }

    // Get the next claim number for this project
    const lastClaim = await prisma.progressClaim.findFirst({
      where: { projectId },
      orderBy: { claimNumber: 'desc' }
    })
    const nextClaimNumber = (lastClaim?.claimNumber || 0) + 1

    // Get the lots to calculate total amount
    const lots = await prisma.lot.findMany({
      where: {
        id: { in: lotIds },
        projectId,
        status: 'conformed'
      }
    })

    if (lots.length === 0) {
      return res.status(400).json({ error: 'No valid conformed lots found' })
    }

    // Calculate total claimed amount from lot budget amounts
    const totalClaimedAmount = lots.reduce((sum, lot) => {
      return sum + (lot.budgetAmount ? Number(lot.budgetAmount) : 0)
    }, 0)

    // Create the claim with claimed lots
    const claim = await prisma.progressClaim.create({
      data: {
        projectId,
        claimNumber: nextClaimNumber,
        claimPeriodStart: new Date(periodStart),
        claimPeriodEnd: new Date(periodEnd),
        status: 'draft',
        preparedById: userId,
        preparedAt: new Date(),
        totalClaimedAmount,
        claimedLots: {
          create: lots.map(lot => ({
            lotId: lot.id,
            quantity: 1,
            unit: 'ea',
            rate: lot.budgetAmount,
            amountClaimed: lot.budgetAmount,
            percentageComplete: 100
          }))
        }
      },
      include: {
        _count: {
          select: { claimedLots: true }
        }
      }
    })

    // Update lots to link them to this claim and set status to claimed
    await prisma.lot.updateMany({
      where: { id: { in: lotIds } },
      data: {
        claimedInId: claim.id,
        status: 'claimed'
      }
    })

    // Transform to match frontend interface
    const transformedClaim = {
      id: claim.id,
      claimNumber: claim.claimNumber,
      periodStart: claim.claimPeriodStart.toISOString().split('T')[0],
      periodEnd: claim.claimPeriodEnd.toISOString().split('T')[0],
      status: claim.status,
      totalClaimedAmount: claim.totalClaimedAmount ? Number(claim.totalClaimedAmount) : 0,
      certifiedAmount: null,
      paidAmount: null,
      submittedAt: null,
      lotCount: claim._count.claimedLots
    }

    res.status(201).json({ claim: transformedClaim })
  } catch (error) {
    console.error('Error creating claim:', error)
    res.status(500).json({ error: 'Failed to create claim' })
  }
})

// PUT /api/projects/:projectId/claims/:claimId - Update a claim
router.put('/:projectId/claims/:claimId', async (req, res) => {
  try {
    const { projectId, claimId } = req.params
    const { status, certifiedAmount, paidAmount, paymentReference, disputeNotes } = req.body
    const userId = (req as any).userId

    const claim = await prisma.progressClaim.findFirst({
      where: { id: claimId, projectId },
      include: {
        project: {
          select: { id: true, name: true }
        }
      }
    })

    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' })
    }

    // Don't allow updates to paid claims
    if (claim.status === 'paid') {
      return res.status(400).json({ error: 'Cannot update a paid claim' })
    }

    const updateData: any = {}
    const previousStatus = claim.status

    if (status) {
      updateData.status = status
      if (status === 'submitted') {
        updateData.submittedAt = new Date()
      }
      if (status === 'certified' && certifiedAmount !== undefined) {
        updateData.certifiedAmount = certifiedAmount
        updateData.certifiedAt = new Date()
      }
      if (status === 'paid' && paidAmount !== undefined) {
        updateData.paidAmount = paidAmount
        updateData.paidAt = new Date()
        updateData.paymentReference = paymentReference || null
      }
      if (status === 'disputed') {
        updateData.disputedAt = new Date()
        updateData.disputeNotes = disputeNotes || null
      }
    }

    const updatedClaim = await prisma.progressClaim.update({
      where: { id: claimId },
      data: updateData,
      include: {
        _count: {
          select: { claimedLots: true }
        }
      }
    })

    // Feature #931 - Notify project managers when a claim is certified
    if (status === 'certified' && previousStatus !== 'certified' && certifiedAmount !== undefined) {
      try {
        // Get the user who certified the claim
        const certifier = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, email: true, fullName: true }
        })
        const certifierName = certifier?.fullName || certifier?.email || 'Unknown'

        // Get all project managers on this project
        const projectManagers = await prisma.projectUser.findMany({
          where: {
            projectId,
            role: 'project_manager',
            status: { in: ['active', 'accepted'] }
          }
        })

        // Get user details for project managers
        const pmUserIds = projectManagers.map(pm => pm.userId)
        const pmUsers = pmUserIds.length > 0
          ? await prisma.user.findMany({
              where: { id: { in: pmUserIds } },
              select: { id: true, email: true, fullName: true }
            })
          : []

        // Format certified amount for display
        const formattedAmount = new Intl.NumberFormat('en-AU', {
          style: 'currency',
          currency: 'AUD'
        }).format(certifiedAmount)

        // Create notifications for project managers
        const notificationsToCreate = pmUsers.map(pm => ({
          userId: pm.id,
          projectId,
          type: 'claim_certified',
          title: 'Claim Certified',
          message: `Claim #${claim.claimNumber} has been certified by ${certifierName}. Certified amount: ${formattedAmount}.`,
          linkUrl: `/projects/${projectId}/claims`
        }))

        if (notificationsToCreate.length > 0) {
          await prisma.notification.createMany({
            data: notificationsToCreate
          })
          console.log(`[Claim Certification] Created ${notificationsToCreate.length} in-app notifications for project managers`)
        }

        // Send email notifications to project managers
        for (const pm of pmUsers) {
          try {
            await sendNotificationIfEnabled(pm.id, 'enabled', {
              title: 'Claim Certified',
              message: `Claim #${claim.claimNumber} has been certified by ${certifierName}.\n\nProject: ${claim.project.name}\nCertified Amount: ${formattedAmount}\n\nPlease review the claim details in the system.`,
              projectName: claim.project.name,
              linkUrl: `/projects/${projectId}/claims`
            })
          } catch (emailError) {
            console.error(`[Claim Certification] Failed to send email to PM ${pm.id}:`, emailError)
          }
        }

        // Log for development
        console.log(`[Claim Certification] Notification details:`)
        console.log(`  Claim: #${claim.claimNumber}`)
        console.log(`  Certified by: ${certifierName}`)
        console.log(`  Certified amount: ${formattedAmount}`)
        console.log(`  Notified PMs: ${pmUsers.map(pm => pm.email).join(', ') || 'None'}`)
      } catch (notifError) {
        console.error('[Claim Certification] Failed to send notifications:', notifError)
        // Don't fail the main request if notifications fail
      }
    }

    // Feature #932 - Notify relevant users when a claim is paid
    if (status === 'paid' && previousStatus !== 'paid' && paidAmount !== undefined) {
      try {
        // Get the user who recorded the payment
        const payer = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, email: true, fullName: true }
        })
        const payerName = payer?.fullName || payer?.email || 'Unknown'

        // Get all project managers on this project
        const projectManagers = await prisma.projectUser.findMany({
          where: {
            projectId,
            role: 'project_manager',
            status: { in: ['active', 'accepted'] }
          }
        })

        // Get user details for project managers
        const pmUserIds = projectManagers.map(pm => pm.userId)
        const pmUsers = pmUserIds.length > 0
          ? await prisma.user.findMany({
              where: { id: { in: pmUserIds } },
              select: { id: true, email: true, fullName: true }
            })
          : []

        // Format paid amount for display
        const formattedAmount = new Intl.NumberFormat('en-AU', {
          style: 'currency',
          currency: 'AUD'
        }).format(paidAmount)

        // Create notifications for project managers
        const notificationsToCreate = pmUsers.map(pm => ({
          userId: pm.id,
          projectId,
          type: 'claim_paid',
          title: 'Claim Payment Received',
          message: `Claim #${claim.claimNumber} payment of ${formattedAmount} has been recorded${paymentReference ? ` (Ref: ${paymentReference})` : ''}.`,
          linkUrl: `/projects/${projectId}/claims`
        }))

        if (notificationsToCreate.length > 0) {
          await prisma.notification.createMany({
            data: notificationsToCreate
          })
          console.log(`[Claim Payment] Created ${notificationsToCreate.length} in-app notifications for project managers`)
        }

        // Send email notifications to project managers
        for (const pm of pmUsers) {
          try {
            await sendNotificationIfEnabled(pm.id, 'enabled', {
              title: 'Claim Payment Received',
              message: `Claim #${claim.claimNumber} payment has been recorded.\n\nProject: ${claim.project.name}\nPaid Amount: ${formattedAmount}${paymentReference ? `\nPayment Reference: ${paymentReference}` : ''}\n\nPlease review the payment details in the system.`,
              projectName: claim.project.name,
              linkUrl: `/projects/${projectId}/claims`
            })
          } catch (emailError) {
            console.error(`[Claim Payment] Failed to send email to PM ${pm.id}:`, emailError)
          }
        }

        // Log for development
        console.log(`[Claim Payment] Notification details:`)
        console.log(`  Claim: #${claim.claimNumber}`)
        console.log(`  Recorded by: ${payerName}`)
        console.log(`  Paid amount: ${formattedAmount}`)
        console.log(`  Payment ref: ${paymentReference || 'N/A'}`)
        console.log(`  Notified PMs: ${pmUsers.map(pm => pm.email).join(', ') || 'None'}`)
      } catch (notifError) {
        console.error('[Claim Payment] Failed to send notifications:', notifError)
        // Don't fail the main request if notifications fail
      }
    }

    res.json({ claim: updatedClaim })
  } catch (error) {
    console.error('Error updating claim:', error)
    res.status(500).json({ error: 'Failed to update claim' })
  }
})

// GET /api/projects/:projectId/claims/:claimId/evidence-package - Get evidence package data for a claim
router.get('/:projectId/claims/:claimId/evidence-package', async (req, res) => {
  try {
    const { projectId, claimId } = req.params
    const startTime = Date.now()

    // Get the claim with all related data
    const claim = await prisma.progressClaim.findFirst({
      where: { id: claimId, projectId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            projectNumber: true,
            clientName: true,
            state: true,
          }
        },
        preparedBy: {
          select: { id: true, fullName: true, email: true }
        },
        claimedLots: {
          include: {
            lot: {
              include: {
                testResults: {
                  include: {
                    verifiedBy: {
                      select: { id: true, fullName: true, email: true }
                    }
                  },
                  orderBy: { sampleDate: 'desc' }
                },
                ncrLots: {
                  include: {
                    ncr: true
                  }
                },
                documents: {
                  where: {
                    OR: [
                      { documentType: 'photo' },
                      { documentType: 'certificate' },
                      { documentType: 'test_result' }
                    ]
                  },
                  orderBy: { uploadedAt: 'desc' }
                },
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
                        attachments: true
                      }
                    }
                  }
                },
                holdPoints: true,
                conformedBy: {
                  select: { id: true, fullName: true, email: true }
                }
              }
            }
          },
          orderBy: {
            lot: {
              lotNumber: 'asc'
            }
          }
        }
      }
    })

    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' })
    }

    // Transform the data for the frontend PDF generator
    const evidencePackage = {
      claim: {
        id: claim.id,
        claimNumber: claim.claimNumber,
        periodStart: claim.claimPeriodStart.toISOString().split('T')[0],
        periodEnd: claim.claimPeriodEnd.toISOString().split('T')[0],
        status: claim.status,
        totalClaimedAmount: claim.totalClaimedAmount ? Number(claim.totalClaimedAmount) : 0,
        certifiedAmount: claim.certifiedAmount ? Number(claim.certifiedAmount) : null,
        submittedAt: claim.submittedAt?.toISOString() || null,
        preparedBy: claim.preparedBy ? {
          name: claim.preparedBy.fullName || claim.preparedBy.email,
          email: claim.preparedBy.email
        } : null,
        preparedAt: claim.preparedAt?.toISOString() || null
      },
      project: {
        id: claim.project.id,
        name: claim.project.name,
        projectNumber: claim.project.projectNumber || null,
        clientName: claim.project.clientName || null,
        state: claim.project.state || 'NSW'
      },
      lots: claim.claimedLots.map(claimedLot => {
        const lot = claimedLot.lot
        const itpInstance = lot.itpInstance

        return {
          id: lot.id,
          lotNumber: lot.lotNumber,
          description: lot.description || null,
          activityType: lot.activityType || null,
          chainageStart: lot.chainageStart ? Number(lot.chainageStart) : null,
          chainageEnd: lot.chainageEnd ? Number(lot.chainageEnd) : null,
          layer: lot.layer || null,
          areaZone: lot.areaZone || null,
          status: lot.status,
          conformedAt: lot.conformedAt?.toISOString() || null,
          conformedBy: lot.conformedBy ? {
            name: lot.conformedBy.fullName || lot.conformedBy.email,
            email: lot.conformedBy.email
          } : null,
          claimAmount: claimedLot.amountClaimed ? Number(claimedLot.amountClaimed) : 0,
          percentComplete: claimedLot.percentageComplete || 100,

          // ITP data
          itp: itpInstance ? {
            templateName: itpInstance.template.name,
            checklistItems: itpInstance.template.checklistItems.map(item => ({
              id: item.id,
              sequenceNumber: item.sequenceNumber,
              description: item.description,
              category: '',
              responsibleParty: item.responsibleParty || '',
              pointType: item.pointType,
              isHoldPoint: item.pointType === 'hold_point',
              evidenceRequired: item.evidenceRequired || ''
            })),
            completions: itpInstance.completions.map(c => ({
              checklistItemId: c.checklistItemId,
              isCompleted: c.status === 'completed',
              notes: c.notes || null,
              completedAt: c.completedAt?.toISOString() || null,
              completedBy: c.completedBy ? {
                name: c.completedBy.fullName || c.completedBy.email,
                email: c.completedBy.email
              } : null,
              isVerified: c.verificationStatus === 'verified',
              verifiedAt: c.verifiedAt?.toISOString() || null,
              verifiedBy: c.verifiedBy ? {
                name: c.verifiedBy.fullName || c.verifiedBy.email,
                email: c.verifiedBy.email
              } : null,
              attachmentCount: c.attachments?.length || 0
            }))
          } : null,

          // Hold Points (on lot level)
          holdPoints: lot.holdPoints.map(hp => ({
            id: hp.id,
            description: hp.description || '',
            status: hp.status,
            releasedAt: hp.releasedAt?.toISOString() || null,
            releasedBy: hp.releasedByName ? {
              name: hp.releasedByName,
              organization: hp.releasedByOrg || null
            } : null
          })),

          // Test results
          testResults: lot.testResults.map(test => ({
            id: test.id,
            testType: test.testType,
            testRequestNumber: test.testRequestNumber || null,
            laboratoryName: test.laboratoryName || null,
            resultValue: test.resultValue ? Number(test.resultValue) : null,
            resultUnit: test.resultUnit || null,
            passFail: test.passFail || null,
            status: test.status,
            sampleDate: test.sampleDate?.toISOString() || null,
            resultDate: test.resultDate?.toISOString() || null,
            isVerified: test.verifiedById !== null,
            verifiedBy: test.verifiedBy ? {
              name: test.verifiedBy.fullName || test.verifiedBy.email,
              email: test.verifiedBy.email
            } : null
          })),

          // NCRs (via ncrLots join table)
          ncrs: lot.ncrLots.map(ncrLot => ({
            id: ncrLot.ncr.id,
            ncrNumber: ncrLot.ncr.ncrNumber,
            description: ncrLot.ncr.description,
            category: ncrLot.ncr.category,
            severity: ncrLot.ncr.severity,
            status: ncrLot.ncr.status,
            createdAt: ncrLot.ncr.createdAt.toISOString(),
            closedAt: ncrLot.ncr.closedAt?.toISOString() || null
          })),

          // Documents/Photos
          documents: lot.documents.map(doc => ({
            id: doc.id,
            filename: doc.filename,
            documentType: doc.documentType,
            caption: doc.caption || null,
            uploadedAt: doc.uploadedAt?.toISOString() || null
          })),

          // Summary stats
          summary: {
            testResultCount: lot.testResults.length,
            passedTestCount: lot.testResults.filter(t => t.passFail === 'pass').length,
            ncrCount: lot.ncrLots.length,
            openNcrCount: lot.ncrLots.filter(nl => !['closed', 'closed_concession'].includes(nl.ncr.status)).length,
            photoCount: lot.documents.filter(d => d.documentType === 'photo').length,
            itpCompletionPercentage: itpInstance
              ? Math.round((itpInstance.completions.filter(c => c.status === 'completed').length /
                  Math.max(1, itpInstance.template.checklistItems.length)) * 100)
              : 0
          }
        }
      }),

      // Overall summary
      summary: {
        totalLots: claim.claimedLots.length,
        totalClaimedAmount: claim.totalClaimedAmount ? Number(claim.totalClaimedAmount) : 0,
        totalTestResults: claim.claimedLots.reduce((sum, cl) => sum + cl.lot.testResults.length, 0),
        totalPassedTests: claim.claimedLots.reduce((sum, cl) => sum + cl.lot.testResults.filter(t => t.passFail === 'pass').length, 0),
        totalNCRs: claim.claimedLots.reduce((sum, cl) => sum + cl.lot.ncrLots.length, 0),
        totalOpenNCRs: claim.claimedLots.reduce((sum, cl) => sum + cl.lot.ncrLots.filter(nl => !['closed', 'closed_concession'].includes(nl.ncr.status)).length, 0),
        totalPhotos: claim.claimedLots.reduce((sum, cl) => sum + cl.lot.documents.filter(d => d.documentType === 'photo').length, 0),
        conformedLots: claim.claimedLots.filter(cl => cl.lot.status === 'conformed' || cl.lot.status === 'claimed').length
      },

      generatedAt: new Date().toISOString(),
      generationTimeMs: Date.now() - startTime
    }

    console.log(`Evidence package generated in ${evidencePackage.generationTimeMs}ms for claim ${claim.claimNumber} with ${claim.claimedLots.length} lots`)

    res.json(evidencePackage)
  } catch (error) {
    console.error('Error generating evidence package:', error)
    res.status(500).json({ error: 'Failed to generate evidence package' })
  }
})

// GET /api/projects/:projectId/claims/:claimId/completeness-check - AI completeness analysis for a claim
router.get('/:projectId/claims/:claimId/completeness-check', async (req, res) => {
  try {
    const { projectId, claimId } = req.params

    // Get the claim with all related data for completeness analysis
    const claim = await prisma.progressClaim.findFirst({
      where: { id: claimId, projectId },
      include: {
        claimedLots: {
          include: {
            lot: {
              include: {
                testResults: true,
                ncrLots: {
                  include: {
                    ncr: true
                  }
                },
                documents: true,
                itpInstance: {
                  include: {
                    template: {
                      include: {
                        checklistItems: true
                      }
                    },
                    completions: true
                  }
                },
                holdPoints: true
              }
            }
          }
        }
      }
    })

    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' })
    }

    // Analyze each lot for completeness
    const lotAnalysis = claim.claimedLots.map(claimedLot => {
      const lot = claimedLot.lot
      const issues: Array<{ type: string; severity: 'critical' | 'warning' | 'info'; message: string; suggestion: string }> = []

      // Calculate completeness score
      let scoreComponents = {
        itpCompletion: 0,
        testResults: 0,
        holdPoints: 0,
        ncrsClosed: 0,
        photoEvidence: 0
      }

      // Check ITP completion
      const itpInstance = lot.itpInstance
      if (itpInstance) {
        const totalItems = itpInstance.template.checklistItems.length
        const completedItems = itpInstance.completions.filter(c => c.status === 'completed').length
        const itpPercentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0
        scoreComponents.itpCompletion = itpPercentage

        if (itpPercentage < 100) {
          const missingItems = totalItems - completedItems
          if (itpPercentage < 50) {
            issues.push({
              type: 'itp_incomplete',
              severity: 'critical',
              message: `ITP only ${itpPercentage}% complete (${missingItems} items remaining)`,
              suggestion: 'Consider excluding this lot from the claim until ITP is completed, or complete remaining checklist items before submission.'
            })
          } else if (itpPercentage < 100) {
            issues.push({
              type: 'itp_incomplete',
              severity: 'warning',
              message: `ITP ${itpPercentage}% complete (${missingItems} items remaining)`,
              suggestion: 'Complete remaining ITP checklist items to strengthen the evidence package.'
            })
          }
        }

        // Check for unverified hold points in ITP
        const holdPointItems = itpInstance.template.checklistItems.filter(item => item.pointType === 'hold_point')
        const unverifiedHoldPoints = holdPointItems.filter(hp => {
          const completion = itpInstance.completions.find(c => c.checklistItemId === hp.id)
          return !completion || completion.verificationStatus !== 'verified'
        })

        if (unverifiedHoldPoints.length > 0) {
          issues.push({
            type: 'unreleased_hp',
            severity: 'critical',
            message: `${unverifiedHoldPoints.length} hold point(s) not verified/released`,
            suggestion: 'Hold points must be released before claiming. Exclude this lot or obtain hold point releases.'
          })
        }
      } else {
        issues.push({
          type: 'no_itp',
          severity: 'warning',
          message: 'No ITP assigned to this lot',
          suggestion: 'Consider assigning an ITP template and completing the checklist for better evidence documentation.'
        })
        scoreComponents.itpCompletion = 0
      }

      // Check lot-level hold points
      const unreleasedLotHPs = lot.holdPoints.filter(hp => hp.status !== 'released')
      if (unreleasedLotHPs.length > 0) {
        issues.push({
          type: 'unreleased_hp',
          severity: 'critical',
          message: `${unreleasedLotHPs.length} lot-level hold point(s) not released`,
          suggestion: 'All hold points must be released before claiming. Coordinate with the superintendent for release.'
        })
        scoreComponents.holdPoints = Math.round(((lot.holdPoints.length - unreleasedLotHPs.length) / Math.max(1, lot.holdPoints.length)) * 100)
      } else if (lot.holdPoints.length > 0) {
        scoreComponents.holdPoints = 100
      } else {
        scoreComponents.holdPoints = 100 // No hold points required = 100%
      }

      // Check test results
      const testResults = lot.testResults
      const failedTests = testResults.filter(t => t.passFail === 'fail')
      const pendingTests = testResults.filter(t => t.status === 'pending' || t.status === 'submitted')

      if (testResults.length === 0) {
        issues.push({
          type: 'no_tests',
          severity: 'info',
          message: 'No test results recorded for this lot',
          suggestion: 'If tests are required for this activity type, ensure test results are uploaded before claiming.'
        })
        scoreComponents.testResults = 100 // No tests required assumption
      } else {
        const passedTests = testResults.filter(t => t.passFail === 'pass').length
        scoreComponents.testResults = Math.round((passedTests / testResults.length) * 100)

        if (failedTests.length > 0) {
          issues.push({
            type: 'failed_tests',
            severity: 'critical',
            message: `${failedTests.length} test(s) failed`,
            suggestion: 'Failed tests indicate non-conformance. Consider excluding this lot or addressing the test failures with retests.'
          })
        }

        if (pendingTests.length > 0) {
          issues.push({
            type: 'pending_tests',
            severity: 'warning',
            message: `${pendingTests.length} test(s) pending results`,
            suggestion: 'Wait for test results before including this lot, or proceed with caution and update evidence package when results arrive.'
          })
        }
      }

      // Check NCRs
      const ncrs = lot.ncrLots.map(nl => nl.ncr)
      const openNCRs = ncrs.filter(ncr => !['closed', 'closed_concession'].includes(ncr.status))

      if (openNCRs.length > 0) {
        const criticalNCRs = openNCRs.filter(ncr => ncr.severity === 'major' || ncr.severity === 'critical')

        if (criticalNCRs.length > 0) {
          issues.push({
            type: 'open_ncr',
            severity: 'critical',
            message: `${criticalNCRs.length} critical/major NCR(s) open`,
            suggestion: 'Critical NCRs must be resolved before claiming. Exclude this lot until NCRs are closed.'
          })
        } else {
          issues.push({
            type: 'open_ncr',
            severity: 'warning',
            message: `${openNCRs.length} minor NCR(s) open`,
            suggestion: 'Consider resolving NCRs before claiming for a cleaner evidence package.'
          })
        }
        scoreComponents.ncrsClosed = ncrs.length > 0
          ? Math.round(((ncrs.length - openNCRs.length) / ncrs.length) * 100)
          : 100
      } else {
        scoreComponents.ncrsClosed = 100
      }

      // Check photo evidence
      const photos = lot.documents.filter(d => d.documentType === 'photo')
      if (photos.length === 0) {
        issues.push({
          type: 'no_photos',
          severity: 'info',
          message: 'No photo evidence for this lot',
          suggestion: 'Adding photos strengthens the evidence package. Consider uploading progress photos.'
        })
        scoreComponents.photoEvidence = 50 // Partial score for no photos
      } else if (photos.length < 3) {
        issues.push({
          type: 'low_photos',
          severity: 'info',
          message: `Only ${photos.length} photo(s) uploaded`,
          suggestion: 'Consider adding more photos (minimum 3 recommended) to strengthen evidence.'
        })
        scoreComponents.photoEvidence = 75
      } else {
        scoreComponents.photoEvidence = 100
      }

      // Calculate overall completeness score (weighted average)
      const weights = {
        itpCompletion: 0.3,
        holdPoints: 0.25,
        testResults: 0.2,
        ncrsClosed: 0.15,
        photoEvidence: 0.1
      }

      const completenessScore = Math.round(
        scoreComponents.itpCompletion * weights.itpCompletion +
        scoreComponents.holdPoints * weights.holdPoints +
        scoreComponents.testResults * weights.testResults +
        scoreComponents.ncrsClosed * weights.ncrsClosed +
        scoreComponents.photoEvidence * weights.photoEvidence
      )

      // Determine recommendation
      let recommendation: 'include' | 'review' | 'exclude'
      const criticalIssues = issues.filter(i => i.severity === 'critical')
      const warningIssues = issues.filter(i => i.severity === 'warning')

      if (criticalIssues.length > 0) {
        recommendation = 'exclude'
      } else if (warningIssues.length > 0 || completenessScore < 80) {
        recommendation = 'review'
      } else {
        recommendation = 'include'
      }

      return {
        lotId: lot.id,
        lotNumber: lot.lotNumber,
        activityType: lot.activityType || 'Unknown',
        claimAmount: claimedLot.amountClaimed ? Number(claimedLot.amountClaimed) : 0,
        completenessScore,
        scoreComponents,
        issues,
        recommendation,
        summary: {
          itpStatus: itpInstance
            ? `${itpInstance.completions.filter(c => c.status === 'completed').length}/${itpInstance.template.checklistItems.length} items complete`
            : 'No ITP',
          testStatus: testResults.length > 0
            ? `${testResults.filter(t => t.passFail === 'pass').length}/${testResults.length} tests passed`
            : 'No tests',
          holdPointStatus: lot.holdPoints.length > 0
            ? `${lot.holdPoints.filter(hp => hp.status === 'released').length}/${lot.holdPoints.length} released`
            : 'None required',
          ncrStatus: ncrs.length > 0
            ? `${ncrs.filter(n => ['closed', 'closed_concession'].includes(n.status)).length}/${ncrs.length} closed`
            : 'None',
          photoCount: photos.length
        }
      }
    })

    // Calculate overall claim analysis
    const totalLots = lotAnalysis.length
    const excludeCount = lotAnalysis.filter(l => l.recommendation === 'exclude').length
    const reviewCount = lotAnalysis.filter(l => l.recommendation === 'review').length
    const includeCount = lotAnalysis.filter(l => l.recommendation === 'include').length
    const averageScore = totalLots > 0
      ? Math.round(lotAnalysis.reduce((sum, l) => sum + l.completenessScore, 0) / totalLots)
      : 0

    // Overall suggestions
    const overallSuggestions: string[] = []

    if (excludeCount > 0) {
      overallSuggestions.push(`Consider excluding ${excludeCount} lot(s) with critical issues to avoid payment disputes.`)
    }

    if (reviewCount > 0) {
      overallSuggestions.push(`Review ${reviewCount} lot(s) with warnings before finalizing the claim.`)
    }

    const totalExcludeAmount = lotAnalysis
      .filter(l => l.recommendation === 'exclude')
      .reduce((sum, l) => sum + l.claimAmount, 0)

    if (totalExcludeAmount > 0) {
      overallSuggestions.push(`Excluding recommended lots would reduce the claim by $${totalExcludeAmount.toLocaleString()}.`)
    }

    res.json({
      claimId: claim.id,
      claimNumber: claim.claimNumber,
      analyzedAt: new Date().toISOString(),
      summary: {
        totalLots,
        includeCount,
        reviewCount,
        excludeCount,
        averageCompletenessScore: averageScore,
        totalClaimAmount: claim.totalClaimedAmount ? Number(claim.totalClaimedAmount) : 0,
        recommendedAmount: lotAnalysis
          .filter(l => l.recommendation !== 'exclude')
          .reduce((sum, l) => sum + l.claimAmount, 0)
      },
      overallSuggestions,
      lots: lotAnalysis
    })
  } catch (error) {
    console.error('Error analyzing claim completeness:', error)
    res.status(500).json({ error: 'Failed to analyze claim completeness' })
  }
})

// Feature #284: POST /api/projects/:projectId/claims/:claimId/certify - Record certification
// Dedicated endpoint for recording claim certification with all details
router.post('/:projectId/claims/:claimId/certify', async (req, res) => {
  try {
    const { projectId, claimId } = req.params
    const {
      certifiedAmount,
      certificationDate,
      variationNotes,
      certificationDocumentId,
      certificationDocumentUrl,
      certificationDocumentFilename
    } = req.body
    const userId = (req as any).userId

    // Validate required fields
    if (certifiedAmount === undefined || certifiedAmount === null) {
      return res.status(400).json({ error: 'Certified amount is required' })
    }

    // Get the claim
    const claim = await prisma.progressClaim.findFirst({
      where: { id: claimId, projectId },
      include: {
        project: { select: { id: true, name: true } }
      }
    })

    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' })
    }

    // Only allow certification of submitted claims
    if (claim.status !== 'submitted' && claim.status !== 'disputed') {
      return res.status(400).json({
        error: 'Invalid claim status',
        message: `Can only certify submitted or disputed claims. Current status: ${claim.status}`
      })
    }

    const previousStatus = claim.status

    // Create certification document record if URL provided
    let certDocId = certificationDocumentId
    if (certificationDocumentUrl && !certDocId) {
      const certDoc = await prisma.document.create({
        data: {
          projectId,
          documentType: 'certificate',
          category: 'certification',
          filename: certificationDocumentFilename || `certification-claim-${claim.claimNumber}.pdf`,
          fileUrl: certificationDocumentUrl,
          uploadedById: userId,
          caption: `Certification document for Claim #${claim.claimNumber}`
        }
      })
      certDocId = certDoc.id
    }

    // Update the claim with certification details
    const updatedClaim = await prisma.progressClaim.update({
      where: { id: claimId },
      data: {
        status: 'certified',
        certifiedAmount: certifiedAmount,
        certifiedAt: certificationDate ? new Date(certificationDate) : new Date(),
        // Store variation notes and document reference in a JSON field or notes
        notes: variationNotes ? JSON.stringify({
          variationNotes,
          certificationDocumentId: certDocId,
          certifiedBy: userId
        }) : claim.notes
      },
      include: {
        _count: { select: { claimedLots: true } }
      }
    })

    // Send notifications to project managers
    try {
      const certifier = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, fullName: true }
      })
      const certifierName = certifier?.fullName || certifier?.email || 'Unknown'

      const projectManagers = await prisma.projectUser.findMany({
        where: {
          projectId,
          role: 'project_manager',
          status: { in: ['active', 'accepted'] }
        }
      })

      const pmUserIds = projectManagers.map(pm => pm.userId)
      const pmUsers = pmUserIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: pmUserIds } },
            select: { id: true, email: true, fullName: true }
          })
        : []

      const formattedAmount = new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD'
      }).format(certifiedAmount)

      // Create in-app notifications
      if (pmUsers.length > 0) {
        await prisma.notification.createMany({
          data: pmUsers.map(pm => ({
            userId: pm.id,
            projectId,
            type: 'claim_certified',
            title: 'Claim Certified',
            message: `Claim #${claim.claimNumber} has been certified by ${certifierName}. Certified amount: ${formattedAmount}.${variationNotes ? ` Variations: ${variationNotes.substring(0, 100)}${variationNotes.length > 100 ? '...' : ''}` : ''}`,
            linkUrl: `/projects/${projectId}/claims`
          }))
        })
      }

      // Send email notifications
      for (const pm of pmUsers) {
        try {
          await sendNotificationIfEnabled(pm.id, 'enabled', {
            title: 'Claim Certified',
            message: `Claim #${claim.claimNumber} has been certified.\n\nProject: ${claim.project.name}\nCertified Amount: ${formattedAmount}${variationNotes ? `\nVariations: ${variationNotes}` : ''}\n\nPlease review the claim details in the system.`,
            projectName: claim.project.name,
            linkUrl: `/projects/${projectId}/claims`
          })
        } catch (emailError) {
          console.error(`Failed to send certification email to PM ${pm.id}:`, emailError)
        }
      }
    } catch (notifError) {
      console.error('Failed to send certification notifications:', notifError)
    }

    // Transform response
    const response = {
      claim: {
        id: updatedClaim.id,
        claimNumber: updatedClaim.claimNumber,
        periodStart: updatedClaim.claimPeriodStart.toISOString().split('T')[0],
        periodEnd: updatedClaim.claimPeriodEnd.toISOString().split('T')[0],
        status: updatedClaim.status,
        totalClaimedAmount: updatedClaim.totalClaimedAmount ? Number(updatedClaim.totalClaimedAmount) : 0,
        certifiedAmount: updatedClaim.certifiedAmount ? Number(updatedClaim.certifiedAmount) : null,
        certifiedAt: updatedClaim.certifiedAt?.toISOString() || null,
        paidAmount: updatedClaim.paidAmount ? Number(updatedClaim.paidAmount) : null,
        lotCount: updatedClaim._count.claimedLots,
        variationNotes: variationNotes || null,
        certificationDocumentId: certDocId || null
      },
      previousStatus,
      message: 'Claim certified successfully'
    }

    const formattedAmountLog = new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(certifiedAmount)
    console.log(`[Claim Certification] Claim #${claim.claimNumber} certified for ${formattedAmountLog}`)

    res.json(response)
  } catch (error) {
    console.error('Error certifying claim:', error)
    res.status(500).json({ error: 'Failed to certify claim' })
  }
})

// Feature #285: POST /api/projects/:projectId/claims/:claimId/payment - Record payment
// Dedicated endpoint for recording claim payment with support for partial payments
router.post('/:projectId/claims/:claimId/payment', async (req, res) => {
  try {
    const { projectId, claimId } = req.params
    const {
      paidAmount,
      paymentDate,
      paymentReference,
      paymentNotes
    } = req.body
    const userId = (req as any).userId

    // Validate required fields
    if (paidAmount === undefined || paidAmount === null) {
      return res.status(400).json({ error: 'Payment amount is required' })
    }

    if (paidAmount <= 0) {
      return res.status(400).json({ error: 'Payment amount must be greater than zero' })
    }

    // Get the claim
    const claim = await prisma.progressClaim.findFirst({
      where: { id: claimId, projectId },
      include: {
        project: { select: { id: true, name: true } }
      }
    })

    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' })
    }

    // Only allow payment of certified or partially paid claims
    if (claim.status !== 'certified' && claim.status !== 'partially_paid') {
      return res.status(400).json({
        error: 'Invalid claim status',
        message: `Can only record payment for certified or partially paid claims. Current status: ${claim.status}`
      })
    }

    const previousStatus = claim.status
    const certifiedAmount = claim.certifiedAmount ? Number(claim.certifiedAmount) : 0
    const previousPaidAmount = claim.paidAmount ? Number(claim.paidAmount) : 0
    const totalPaid = previousPaidAmount + paidAmount
    const outstanding = certifiedAmount - totalPaid

    // Determine new status
    let newStatus: string
    if (outstanding <= 0) {
      newStatus = 'paid'
    } else {
      newStatus = 'partially_paid'
    }

    // Build notes with payment history
    let paymentHistory: any[] = []
    if (claim.notes) {
      try {
        const existingNotes = JSON.parse(claim.notes)
        paymentHistory = existingNotes.paymentHistory || []
      } catch (e) {
        // Not JSON, start fresh
      }
    }

    paymentHistory.push({
      amount: paidAmount,
      date: paymentDate || new Date().toISOString().split('T')[0],
      reference: paymentReference || null,
      notes: paymentNotes || null,
      recordedAt: new Date().toISOString(),
      recordedBy: userId
    })

    // Update the claim
    const updatedClaim = await prisma.progressClaim.update({
      where: { id: claimId },
      data: {
        status: newStatus,
        paidAmount: totalPaid,
        paidAt: paymentDate ? new Date(paymentDate) : new Date(),
        paymentReference: paymentReference || claim.paymentReference,
        notes: JSON.stringify({
          ...JSON.parse(claim.notes || '{}'),
          paymentHistory,
          lastPaymentNotes: paymentNotes
        })
      },
      include: {
        _count: { select: { claimedLots: true } }
      }
    })

    // Send notifications to project managers
    try {
      const payer = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, fullName: true }
      })
      const payerName = payer?.fullName || payer?.email || 'Unknown'

      const projectManagers = await prisma.projectUser.findMany({
        where: {
          projectId,
          role: 'project_manager',
          status: { in: ['active', 'accepted'] }
        }
      })

      const pmUserIds = projectManagers.map(pm => pm.userId)
      const pmUsers = pmUserIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: pmUserIds } },
            select: { id: true, email: true, fullName: true }
          })
        : []

      const formattedPaidAmount = new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD'
      }).format(paidAmount)

      const formattedOutstanding = new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD'
      }).format(Math.max(0, outstanding))

      const notificationType = newStatus === 'paid' ? 'claim_paid' : 'claim_partial_payment'
      const notificationTitle = newStatus === 'paid' ? 'Claim Payment Complete' : 'Partial Payment Received'
      const notificationMessage = newStatus === 'paid'
        ? `Claim #${claim.claimNumber} payment of ${formattedPaidAmount} has been recorded${paymentReference ? ` (Ref: ${paymentReference})` : ''}. Claim is now fully paid.`
        : `Partial payment of ${formattedPaidAmount} recorded for Claim #${claim.claimNumber}${paymentReference ? ` (Ref: ${paymentReference})` : ''}. Outstanding: ${formattedOutstanding}.`

      // Create in-app notifications
      if (pmUsers.length > 0) {
        await prisma.notification.createMany({
          data: pmUsers.map(pm => ({
            userId: pm.id,
            projectId,
            type: notificationType,
            title: notificationTitle,
            message: notificationMessage,
            linkUrl: `/projects/${projectId}/claims`
          }))
        })
      }

      // Send email notifications
      for (const pm of pmUsers) {
        try {
          await sendNotificationIfEnabled(pm.id, 'enabled', {
            title: notificationTitle,
            message: `${notificationMessage}\n\nProject: ${claim.project.name}\nRecorded by: ${payerName}\n\nPlease review the payment details in the system.`,
            projectName: claim.project.name,
            linkUrl: `/projects/${projectId}/claims`
          })
        } catch (emailError) {
          console.error(`Failed to send payment email to PM ${pm.id}:`, emailError)
        }
      }
    } catch (notifError) {
      console.error('Failed to send payment notifications:', notifError)
    }

    // Transform response
    const response = {
      claim: {
        id: updatedClaim.id,
        claimNumber: updatedClaim.claimNumber,
        periodStart: updatedClaim.claimPeriodStart.toISOString().split('T')[0],
        periodEnd: updatedClaim.claimPeriodEnd.toISOString().split('T')[0],
        status: updatedClaim.status,
        totalClaimedAmount: updatedClaim.totalClaimedAmount ? Number(updatedClaim.totalClaimedAmount) : 0,
        certifiedAmount: updatedClaim.certifiedAmount ? Number(updatedClaim.certifiedAmount) : null,
        paidAmount: updatedClaim.paidAmount ? Number(updatedClaim.paidAmount) : null,
        paidAt: updatedClaim.paidAt?.toISOString() || null,
        paymentReference: updatedClaim.paymentReference || null,
        lotCount: updatedClaim._count.claimedLots
      },
      payment: {
        amount: paidAmount,
        date: paymentDate || new Date().toISOString().split('T')[0],
        reference: paymentReference || null,
        notes: paymentNotes || null
      },
      outstanding: Math.max(0, outstanding),
      isFullyPaid: outstanding <= 0,
      previousStatus,
      paymentHistory,
      message: outstanding <= 0 ? 'Claim fully paid' : `Partial payment recorded. Outstanding: $${outstanding.toFixed(2)}`
    }

    const formattedLog = new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(paidAmount)
    console.log(`[Claim Payment] Claim #${claim.claimNumber} payment recorded: ${formattedLog} (${newStatus})`)

    res.json(response)
  } catch (error) {
    console.error('Error recording payment:', error)
    res.status(500).json({ error: 'Failed to record payment' })
  }
})

// DELETE /api/projects/:projectId/claims/:claimId - Delete a draft claim
router.delete('/:projectId/claims/:claimId', async (req, res) => {
  try {
    const { projectId, claimId } = req.params

    const claim = await prisma.progressClaim.findFirst({
      where: { id: claimId, projectId }
    })

    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' })
    }

    if (claim.status !== 'draft') {
      return res.status(400).json({ error: 'Can only delete draft claims' })
    }

    // Unlink lots from this claim
    await prisma.lot.updateMany({
      where: { claimedInId: claimId },
      data: { claimedInId: null }
    })

    // Delete the claim (cascades to claimedLots)
    await prisma.progressClaim.delete({
      where: { id: claimId }
    })

    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting claim:', error)
    res.status(500).json({ error: 'Failed to delete claim' })
  }
})

export default router
