import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/authMiddleware.js'

export const companyRouter = Router()

// Apply authentication middleware to all routes
companyRouter.use(requireAuth)

// Subscription tier project limits
const TIER_PROJECT_LIMITS: Record<string, number> = {
  basic: 3,
  professional: 10,
  enterprise: 50,
  unlimited: Infinity,
}

// Subscription tier user limits
const TIER_USER_LIMITS: Record<string, number> = {
  basic: 5,
  professional: 25,
  enterprise: 100,
  unlimited: Infinity,
}

// GET /api/company - Get the current user's company
companyRouter.get('/', async (req, res) => {
  try {
    const user = req.user!

    if (!user.companyId) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'No company associated with this user'
      })
    }

    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: {
        id: true,
        name: true,
        abn: true,
        address: true,
        logoUrl: true,
        subscriptionTier: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!company) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Company not found'
      })
    }

    // Get project count for this company
    const projectCount = await prisma.project.count({
      where: { companyId: user.companyId }
    })

    // Get user count for this company
    const userCount = await prisma.user.count({
      where: { companyId: user.companyId }
    })

    const tier = company.subscriptionTier || 'basic'
    const projectLimit = TIER_PROJECT_LIMITS[tier] || TIER_PROJECT_LIMITS.basic
    const userLimit = TIER_USER_LIMITS[tier] || TIER_USER_LIMITS.basic

    res.json({
      company: {
        ...company,
        projectCount,
        projectLimit,
        userCount,
        userLimit,
      }
    })
  } catch (error) {
    console.error('Get company error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PATCH /api/company - Update the current user's company
companyRouter.patch('/', async (req, res) => {
  try {
    const user = req.user!
    const { name, abn, address, logoUrl } = req.body

    if (!user.companyId) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'No company associated with this user'
      })
    }

    // Only allow admin roles to update company settings
    const allowedRoles = ['owner', 'admin']
    if (!allowedRoles.includes(user.roleInCompany || '')) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only company owners and admins can update company settings'
      })
    }

    // Validate required fields
    if (name !== undefined && !name.trim()) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Company name is required'
      })
    }

    // Build update data
    const updateData: {
      name?: string
      abn?: string | null
      address?: string | null
      logoUrl?: string | null
    } = {}

    if (name !== undefined) updateData.name = name.trim()
    if (abn !== undefined) updateData.abn = abn || null
    if (address !== undefined) updateData.address = address || null
    if (logoUrl !== undefined) updateData.logoUrl = logoUrl || null

    const updatedCompany = await prisma.company.update({
      where: { id: user.companyId },
      data: updateData,
      select: {
        id: true,
        name: true,
        abn: true,
        address: true,
        logoUrl: true,
        subscriptionTier: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    console.log(`Company ${updatedCompany.name} settings updated by ${user.email}`)

    res.json({
      message: 'Company settings updated successfully',
      company: updatedCompany,
    })
  } catch (error) {
    console.error('Update company error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})
