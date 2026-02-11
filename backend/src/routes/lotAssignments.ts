import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middleware/authMiddleware.js'
import { AppError } from '../lib/AppError.js'
import { asyncHandler } from '../lib/asyncHandler.js'

export const lotAssignmentsRouter = Router()

// Roles that can manage lot assignments
const ASSIGNMENT_MANAGERS = ['owner', 'admin', 'project_manager', 'site_manager']

// POST /api/lots/:lotId/subcontractors - Assign subcontractor to lot
lotAssignmentsRouter.post('/:lotId/subcontractors', requireAuth, requireRole(ASSIGNMENT_MANAGERS), asyncHandler(async (req, res) => {
  const { lotId } = req.params
  const { subcontractorCompanyId, canCompleteITP = false, itpRequiresVerification = true } = req.body
  const user = req.user!

  if (!subcontractorCompanyId) {
    throw AppError.badRequest('subcontractorCompanyId is required')
  }

  // Get lot with project info
  const lot = await prisma.lot.findUnique({
    where: { id: lotId },
    select: { id: true, projectId: true }
  })

  if (!lot) {
    throw AppError.notFound('Lot')
  }

  // Verify subcontractor belongs to this project
  const subcontractorCompany = await prisma.subcontractorCompany.findFirst({
    where: {
      id: subcontractorCompanyId,
      projectId: lot.projectId,
      status: 'approved'
    }
  })

  if (!subcontractorCompany) {
    throw AppError.badRequest('Subcontractor not found or not approved for this project')
  }

  // Check for existing assignment
  const existing = await prisma.lotSubcontractorAssignment.findUnique({
    where: {
      lotId_subcontractorCompanyId: { lotId, subcontractorCompanyId }
    }
  })

  if (existing && existing.status === 'active') {
    throw AppError.conflict('Subcontractor already assigned to this lot')
  }

  // Create or reactivate assignment
  const assignment = existing
    ? await prisma.lotSubcontractorAssignment.update({
        where: { id: existing.id },
        data: {
          status: 'active',
          canCompleteITP,
          itpRequiresVerification,
          assignedById: user.id,
          assignedAt: new Date()
        },
        include: {
          subcontractorCompany: { select: { id: true, companyName: true } }
        }
      })
    : await prisma.lotSubcontractorAssignment.create({
        data: {
          lotId,
          subcontractorCompanyId,
          projectId: lot.projectId,
          canCompleteITP,
          itpRequiresVerification,
          assignedById: user.id
        },
        include: {
          subcontractorCompany: { select: { id: true, companyName: true } }
        }
      })

  res.status(201).json(assignment)
}))

// GET /api/lots/:lotId/subcontractors - List assignments for a lot
lotAssignmentsRouter.get('/:lotId/subcontractors', requireAuth, asyncHandler(async (req, res) => {
  const { lotId } = req.params
  const user = req.user!

  const assignments = await prisma.lotSubcontractorAssignment.findMany({
    where: {
      lotId,
      status: 'active'
    },
    include: {
      subcontractorCompany: {
        select: { id: true, companyName: true, primaryContactName: true, primaryContactEmail: true }
      },
      assignedBy: {
        select: { id: true, fullName: true }
      }
    },
    orderBy: { assignedAt: 'desc' }
  })

  // If user is a subcontractor, only return their own assignment
  if (user.roleInCompany === 'subcontractor' || user.roleInCompany === 'subcontractor_admin') {
    const subcontractorUser = await prisma.subcontractorUser.findFirst({
      where: { userId: user.id }
    })

    if (subcontractorUser) {
      const filtered = assignments.filter(a => a.subcontractorCompanyId === subcontractorUser.subcontractorCompanyId)
      return res.json(filtered)
    }
    return res.json([])
  }

  res.json(assignments)
}))

// GET /api/lots/:lotId/subcontractors/mine - Get current user's assignment
lotAssignmentsRouter.get('/:lotId/subcontractors/mine', requireAuth, asyncHandler(async (req, res) => {
  const { lotId } = req.params
  const user = req.user!

  // Find user's subcontractor company
  const subcontractorUser = await prisma.subcontractorUser.findFirst({
    where: { userId: user.id }
  })

  if (!subcontractorUser) {
    throw AppError.notFound('Not a subcontractor')
  }

  const assignment = await prisma.lotSubcontractorAssignment.findFirst({
    where: {
      lotId,
      subcontractorCompanyId: subcontractorUser.subcontractorCompanyId,
      status: 'active'
    },
    include: {
      subcontractorCompany: {
        select: { id: true, companyName: true }
      }
    }
  })

  if (!assignment) {
    throw AppError.notFound('No assignment found for this lot')
  }

  res.json(assignment)
}))

// PATCH /api/lots/:lotId/subcontractors/:assignmentId - Update assignment permissions
lotAssignmentsRouter.patch('/:lotId/subcontractors/:assignmentId', requireAuth, requireRole(ASSIGNMENT_MANAGERS), asyncHandler(async (req, res) => {
  const { lotId, assignmentId } = req.params
  const { canCompleteITP, itpRequiresVerification } = req.body

  const assignment = await prisma.lotSubcontractorAssignment.findFirst({
    where: { id: assignmentId, lotId }
  })

  if (!assignment) {
    throw AppError.notFound('Assignment')
  }

  const updated = await prisma.lotSubcontractorAssignment.update({
    where: { id: assignmentId },
    data: {
      ...(canCompleteITP !== undefined ? { canCompleteITP } : {}),
      ...(itpRequiresVerification !== undefined ? { itpRequiresVerification } : {})
    },
    include: {
      subcontractorCompany: { select: { id: true, companyName: true } }
    }
  })

  res.json(updated)
}))

// DELETE /api/lots/:lotId/subcontractors/:assignmentId - Remove assignment (soft delete)
lotAssignmentsRouter.delete('/:lotId/subcontractors/:assignmentId', requireAuth, requireRole(ASSIGNMENT_MANAGERS), asyncHandler(async (req, res) => {
  const { lotId, assignmentId } = req.params

  const assignment = await prisma.lotSubcontractorAssignment.findFirst({
    where: { id: assignmentId, lotId }
  })

  if (!assignment) {
    throw AppError.notFound('Assignment')
  }

  await prisma.lotSubcontractorAssignment.update({
    where: { id: assignmentId },
    data: { status: 'removed' }
  })

  res.json({ success: true })
}))
