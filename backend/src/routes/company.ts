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

// POST /api/company/leave - Leave the current company
companyRouter.post('/leave', async (req, res) => {
  try {
    const user = req.user!

    if (!user.companyId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'You are not a member of any company'
      })
    }

    // Don't allow owners to leave (they must transfer ownership or delete company)
    if (user.roleInCompany === 'owner') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Company owners cannot leave. Please transfer ownership first or delete the company.'
      })
    }

    // Remove user from all project memberships for this company
    const companyProjects = await prisma.project.findMany({
      where: { companyId: user.companyId },
      select: { id: true }
    })

    const projectIds = companyProjects.map(p => p.id)

    // Delete project user records
    await prisma.projectUser.deleteMany({
      where: {
        userId: user.userId,
        projectId: { in: projectIds }
      }
    })

    // Remove company association from user using raw SQL to avoid Prisma quirks
    // Set role_in_company to 'member' (default) since it's NOT NULL
    await prisma.$executeRaw`UPDATE users SET company_id = NULL, role_in_company = 'member' WHERE id = ${user.userId}`

    res.json({
      message: 'Successfully left the company',
      leftAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('Leave company error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/company/members - Get all members of the current user's company
companyRouter.get('/members', async (req, res) => {
  try {
    const user = req.user!

    if (!user.companyId) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'No company associated with this user'
      })
    }

    // Only owners can view members for transfer purposes
    if (user.roleInCompany !== 'owner') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only company owners can view members for ownership transfer'
      })
    }

    const members = await prisma.user.findMany({
      where: { companyId: user.companyId },
      select: {
        id: true,
        email: true,
        fullName: true,
        roleInCompany: true,
      },
      orderBy: { fullName: 'asc' }
    })

    res.json({ members })
  } catch (error) {
    console.error('Get company members error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/company/transfer-ownership - Transfer company ownership to another user
companyRouter.post('/transfer-ownership', async (req, res) => {
  try {
    const user = req.user!
    const { newOwnerId } = req.body

    if (!user.companyId) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'No company associated with this user'
      })
    }

    // Only owners can transfer ownership
    if (user.roleInCompany !== 'owner') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only the company owner can transfer ownership'
      })
    }

    if (!newOwnerId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'New owner ID is required'
      })
    }

    // Cannot transfer to yourself
    if (newOwnerId === user.userId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Cannot transfer ownership to yourself'
      })
    }

    // Verify new owner is a member of the same company
    const newOwner = await prisma.user.findFirst({
      where: {
        id: newOwnerId,
        companyId: user.companyId
      }
    })

    if (!newOwner) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found in your company'
      })
    }

    // Transfer ownership: update both users in a transaction
    await prisma.$transaction([
      // Set new owner
      prisma.$executeRaw`UPDATE users SET role_in_company = 'owner' WHERE id = ${newOwnerId}`,
      // Demote current owner to admin
      prisma.$executeRaw`UPDATE users SET role_in_company = 'admin' WHERE id = ${user.userId}`,
    ])

    res.json({
      message: 'Ownership transferred successfully',
      newOwner: {
        id: newOwner.id,
        email: newOwner.email,
        fullName: newOwner.fullName
      },
      transferredAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('Transfer ownership error:', error)
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

    res.json({
      message: 'Company settings updated successfully',
      company: updatedCompany,
    })
  } catch (error) {
    console.error('Update company error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})
