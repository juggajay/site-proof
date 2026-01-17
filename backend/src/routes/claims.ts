import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/authMiddleware.js'

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

    const claim = await prisma.progressClaim.findFirst({
      where: { id: claimId, projectId }
    })

    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' })
    }

    // Don't allow updates to paid claims
    if (claim.status === 'paid') {
      return res.status(400).json({ error: 'Cannot update a paid claim' })
    }

    const updateData: any = {}

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

    res.json({ claim: updatedClaim })
  } catch (error) {
    console.error('Error updating claim:', error)
    res.status(500).json({ error: 'Failed to update claim' })
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
