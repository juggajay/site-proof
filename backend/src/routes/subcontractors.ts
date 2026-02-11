import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/authMiddleware.js'
import { AppError } from '../lib/AppError.js'
import { asyncHandler } from '../lib/asyncHandler.js'
import { sendSubcontractorInvitationEmail } from '../lib/email.js'
import { createAuditLog, AuditAction } from '../lib/auditLog.js'

// Feature #483: ABN (Australian Business Number) validation
// ABN is an 11-digit number with a specific checksum algorithm
function validateABN(abn: string): { valid: boolean; error?: string } {
  if (!abn) {
    return { valid: true } // ABN is optional
  }

  // Remove spaces and dashes
  const cleanABN = abn.replace(/[\s-]/g, '')

  // Must be exactly 11 digits
  if (!/^\d{11}$/.test(cleanABN)) {
    return { valid: false, error: 'ABN must be exactly 11 digits' }
  }

  // ABN validation algorithm (ATO specification)
  // 1. Subtract 1 from the first digit
  // 2. Multiply each digit by its weighting factor
  // 3. Sum the results
  // 4. If divisible by 89, ABN is valid
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19]
  const digits = cleanABN.split('').map(Number)

  // Subtract 1 from first digit
  digits[0] = digits[0] - 1

  // Calculate weighted sum
  let sum = 0
  for (let i = 0; i < 11; i++) {
    sum += digits[i] * weights[i]
  }

  if (sum % 89 !== 0) {
    return { valid: false, error: 'Invalid ABN - checksum failed' }
  }

  return { valid: true }
}

export const subcontractorsRouter = Router()

// ================================================================================
// PUBLIC ENDPOINTS (no auth required) - Must be defined BEFORE requireAuth
// ================================================================================

// Feature #484: GET /api/subcontractors/invitation/:id - Get invitation details (no auth required)
// This allows the frontend to display invitation info before user creates account
subcontractorsRouter.get('/invitation/:id', asyncHandler(async (req, res) => {
    const { id } = req.params

    const subcontractor = await prisma.subcontractorCompany.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true, companyId: true } }
      }
    })

    if (!subcontractor) {
      throw AppError.notFound('Invitation')
    }

    // Get the head contractor company name
    const headContractor = await prisma.company.findUnique({
      where: { id: subcontractor.project.companyId },
      select: { name: true }
    })

    res.json({
      invitation: {
        id: subcontractor.id,
        companyName: subcontractor.companyName,
        projectName: subcontractor.project.name,
        headContractorName: headContractor?.name || 'Unknown',
        primaryContactEmail: subcontractor.primaryContactEmail,
        primaryContactName: subcontractor.primaryContactName,
        status: subcontractor.status
      }
    })
}))

// ================================================================================
// PROTECTED ENDPOINTS (auth required)
// ================================================================================

// Apply authentication middleware to all subsequent routes
subcontractorsRouter.use(requireAuth)

// GET /api/subcontractors/directory - Get global subcontractors for the user's organization
// This allows selecting existing subcontractors when inviting to a new project
subcontractorsRouter.get('/directory', asyncHandler(async (req, res) => {
    const user = req.user!

    // User must belong to a company
    if (!user.companyId) {
      throw AppError.badRequest('User must belong to an organization to access the subcontractor directory')
    }

    // Get all global subcontractors for this organization
    const globalSubcontractors = await prisma.globalSubcontractor.findMany({
      where: {
        organizationId: user.companyId,
        status: 'active'
      },
      orderBy: { companyName: 'asc' }
    })

    res.json({
      subcontractors: globalSubcontractors.map(gs => ({
        id: gs.id,
        companyName: gs.companyName,
        abn: gs.abn || '',
        primaryContactName: gs.primaryContactName || '',
        primaryContactEmail: gs.primaryContactEmail || '',
        primaryContactPhone: gs.primaryContactPhone || ''
      }))
    })
}))

// POST /api/subcontractors/invite - Invite/create a new subcontractor company for a project
// Now supports selecting from global directory via globalSubcontractorId
subcontractorsRouter.post('/invite', asyncHandler(async (req, res) => {
    const user = req.user!
    const {
      projectId,
      globalSubcontractorId, // Optional: select from existing directory
      companyName,
      abn,
      primaryContactName,
      primaryContactEmail,
      primaryContactPhone
    } = req.body

    // Only allow head contractor roles to invite subcontractors
    const allowedRoles = ['owner', 'admin', 'project_manager', 'site_manager']
    if (!allowedRoles.includes(user.roleInCompany || '')) {
      throw AppError.forbidden('Only project managers or higher can invite subcontractors')
    }

    // Validate required fields
    if (!projectId) {
      throw AppError.badRequest('projectId is required')
    }

    // If not selecting from directory, require all fields
    if (!globalSubcontractorId && (!companyName || !primaryContactName || !primaryContactEmail)) {
      throw AppError.badRequest('companyName, primaryContactName, and primaryContactEmail are required when not selecting from directory')
    }

    // Verify project exists and user has access
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    })

    if (!project) {
      throw AppError.notFound('Project')
    }

    // Determine the company details to use
    let finalCompanyName: string
    let finalAbn: string | null
    let finalContactName: string
    let finalContactEmail: string
    let finalContactPhone: string | null
    let globalId: string | null = null

    if (globalSubcontractorId) {
      // Selecting from directory - fetch the global subcontractor
      const globalSub = await prisma.globalSubcontractor.findUnique({
        where: { id: globalSubcontractorId }
      })

      if (!globalSub) {
        throw AppError.notFound('Global subcontractor')
      }

      // Verify it belongs to the same organization
      if (globalSub.organizationId !== user.companyId) {
        throw AppError.forbidden('This subcontractor does not belong to your organization')
      }

      // Check if this global subcontractor is already invited to this project
      const existingLink = await prisma.subcontractorCompany.findFirst({
        where: {
          projectId,
          globalSubcontractorId
        }
      })

      if (existingLink) {
        throw AppError.conflict('This subcontractor has already been invited to this project')
      }

      finalCompanyName = globalSub.companyName
      finalAbn = globalSub.abn
      finalContactName = globalSub.primaryContactName || ''
      finalContactEmail = globalSub.primaryContactEmail || ''
      finalContactPhone = globalSub.primaryContactPhone
      globalId = globalSub.id
    } else {
      // Creating new - validate ABN if provided
      if (abn) {
        const abnValidation = validateABN(abn)
        if (!abnValidation.valid) {
          throw AppError.badRequest(abnValidation.error || 'Invalid ABN', { code: 'INVALID_ABN' })
        }
      }

      // Check if a subcontractor with same name already exists for this project
      const existingSubcontractor = await prisma.subcontractorCompany.findFirst({
        where: {
          projectId,
          companyName: companyName
        }
      })

      if (existingSubcontractor) {
        throw AppError.conflict('A subcontractor with this company name already exists for this project')
      }

      // Create a new GlobalSubcontractor record
      const newGlobalSub = await prisma.globalSubcontractor.create({
        data: {
          organizationId: user.companyId!,
          companyName,
          abn: abn || null,
          primaryContactName,
          primaryContactEmail,
          primaryContactPhone: primaryContactPhone || null,
          status: 'active'
        }
      })

      finalCompanyName = companyName
      finalAbn = abn || null
      finalContactName = primaryContactName
      finalContactEmail = primaryContactEmail
      finalContactPhone = primaryContactPhone || null
      globalId = newGlobalSub.id
    }

    // Create the project-specific SubcontractorCompany linked to the global record
    const subcontractor = await prisma.subcontractorCompany.create({
      data: {
        projectId,
        globalSubcontractorId: globalId,
        companyName: finalCompanyName,
        abn: finalAbn,
        primaryContactName: finalContactName,
        primaryContactEmail: finalContactEmail,
        primaryContactPhone: finalContactPhone,
        status: 'pending_approval'
      }
    })

    // Feature #942 - Send subcontractor invitation email with setup link
    const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:5174'}/subcontractor-portal/accept-invite?id=${subcontractor.id}`

    try {
      await sendSubcontractorInvitationEmail({
        to: finalContactEmail,
        contactName: finalContactName,
        companyName: finalCompanyName,
        projectName: project.name,
        inviterEmail: user.email,
        inviteUrl
      })
    } catch (emailError) {
      console.error('[Subcontractor Invite] Failed to send email:', emailError)
      // Don't fail the invite if email fails
    }

    res.status(201).json({
      message: 'Subcontractor invited successfully',
      subcontractor: {
        id: subcontractor.id,
        companyName: subcontractor.companyName,
        abn: subcontractor.abn || '',
        primaryContact: subcontractor.primaryContactName || '',
        email: subcontractor.primaryContactEmail || '',
        phone: subcontractor.primaryContactPhone || '',
        status: subcontractor.status,
        employees: [],
        plant: [],
        totalApprovedDockets: 0,
        totalCost: 0,
        assignedLotCount: 0
      }
    })
}))

// GET /api/subcontractors/for-project/:projectId - Get subcontractors for a project
subcontractorsRouter.get('/for-project/:projectId', asyncHandler(async (req, res) => {
    const { projectId } = req.params

    // Get all subcontractor companies associated with this project
    const subcontractors = await prisma.subcontractorCompany.findMany({
      where: {
        projectId: projectId
      },
      select: {
        id: true,
        companyName: true,
        status: true,
      },
      orderBy: { companyName: 'asc' }
    })

    res.json({ subcontractors })
}))

// Feature #484: POST /api/subcontractors/invitation/:id/accept - Accept invitation and link user
subcontractorsRouter.post('/invitation/:id/accept', asyncHandler(async (req, res) => {
    const { id } = req.params
    const user = req.user!

    // Find the subcontractor company
    const subcontractor = await prisma.subcontractorCompany.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true } }
      }
    })

    if (!subcontractor) {
      throw AppError.notFound('Invitation')
    }

    // Check if user is already linked to THIS specific subcontractor company
    // (Allow users to be linked to multiple subcontractor companies across different projects)
    const existingLink = await prisma.subcontractorUser.findFirst({
      where: {
        userId: user.id,
        subcontractorCompanyId: id
      }
    })

    if (existingLink) {
      throw AppError.badRequest('Your account is already linked to this subcontractor company')
    }

    // Link user to subcontractor company
    await prisma.subcontractorUser.create({
      data: {
        userId: user.id,
        subcontractorCompanyId: subcontractor.id,
        role: 'admin' // First user is admin
      }
    })

    // Only set role to subcontractor_admin if the user doesn't already have a role
    // (don't downgrade owners, admins, project managers, etc.)
    const currentUser = await prisma.user.findUnique({ where: { id: user.id }, select: { roleInCompany: true } })
    if (!currentUser?.roleInCompany) {
      await prisma.user.update({
        where: { id: user.id },
        data: { roleInCompany: 'subcontractor_admin' }
      })
    }

    // Update subcontractor status to approved if pending
    if (subcontractor.status === 'pending_approval') {
      await prisma.subcontractorCompany.update({
        where: { id: subcontractor.id },
        data: { status: 'approved' }
      })
    }

    // Audit log for subcontractor invitation acceptance
    await createAuditLog({
      projectId: subcontractor.project.id,
      userId: user.id,
      entityType: 'subcontractor',
      entityId: id,
      action: AuditAction.SUBCONTRACTOR_INVITATION_ACCEPTED,
      changes: { companyName: subcontractor.companyName },
      req
    })

    res.json({
      message: 'Invitation accepted successfully',
      subcontractor: {
        id: subcontractor.id,
        companyName: subcontractor.companyName,
        projectName: subcontractor.project.name,
        status: 'approved'
      }
    })
}))

// GET /api/subcontractors/my-company - Get the current user's subcontractor company
subcontractorsRouter.get('/my-company', asyncHandler(async (req, res) => {
    const user = req.user!

    // Check if user is a subcontractor
    if (!['subcontractor', 'subcontractor_admin'].includes(user.roleInCompany || '')) {
      throw AppError.forbidden('Only subcontractors can access this endpoint')
    }

    // Get the user's subcontractor company via SubcontractorUser
    const subcontractorUser = await prisma.subcontractorUser.findFirst({
      where: { userId: user.id },
      include: {
        subcontractorCompany: {
          include: {
            employeeRoster: true,
            plantRegister: true,
            project: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        }
      }
    })

    if (!subcontractorUser || !subcontractorUser.subcontractorCompany) {
      throw AppError.notFound('Subcontractor company')
    }

    const company = subcontractorUser.subcontractorCompany

    res.json({
      company: {
        id: company.id,
        companyName: company.companyName,
        abn: company.abn || '',
        projectId: company.projectId,
        projectName: company.project?.name || '',
        primaryContactName: company.primaryContactName || user.fullName || '',
        primaryContactEmail: company.primaryContactEmail || user.email,
        primaryContactPhone: company.primaryContactPhone || '',
        status: company.status,
        employees: company.employeeRoster.map(e => ({
          id: e.id,
          name: e.name,
          phone: e.phone || '',
          role: e.role || '',
          hourlyRate: e.hourlyRate?.toNumber() || 0,
          status: e.status === 'approved' ? 'approved' : 'pending'
        })),
        plant: company.plantRegister.map(p => ({
          id: p.id,
          type: p.type,
          description: p.description || '',
          idRego: p.idRego || '',
          dryRate: p.dryRate?.toNumber() || 0,
          wetRate: p.wetRate?.toNumber() || 0,
          status: p.status === 'approved' ? 'approved' : 'pending'
        })),
        portalAccess: company.portalAccess || {
          lots: true,
          itps: false,
          holdPoints: false,
          testResults: false,
          ncrs: false,
          documents: false,
        }
      }
    })
}))

// POST /api/subcontractors/my-company/employees - Add a new employee
subcontractorsRouter.post('/my-company/employees', asyncHandler(async (req, res) => {
    const user = req.user!

    // Check if user is a subcontractor admin
    if (user.roleInCompany !== 'subcontractor_admin') {
      throw AppError.forbidden('Only subcontractor admins can add employees')
    }

    // Get the user's subcontractor company
    const subcontractorUser = await prisma.subcontractorUser.findFirst({
      where: { userId: user.id },
      include: { subcontractorCompany: true }
    })

    if (!subcontractorUser || !subcontractorUser.subcontractorCompany) {
      throw AppError.notFound('Subcontractor company')
    }

    const { name, phone, role, hourlyRate } = req.body

    if (!name || !role || !hourlyRate) {
      throw AppError.badRequest('Name, role, and hourlyRate are required')
    }

    const employee = await prisma.employeeRoster.create({
      data: {
        subcontractorCompanyId: subcontractorUser.subcontractorCompany.id,
        name: name,
        phone: phone || null,
        role: role,
        hourlyRate: hourlyRate,
        status: 'pending' // Needs head contractor approval
      }
    })

    res.status(201).json({
      employee: {
        id: employee.id,
        name: employee.name,
        phone: employee.phone || '',
        role: employee.role || '',
        hourlyRate: employee.hourlyRate?.toNumber() || 0,
        status: 'pending'
      }
    })
}))

// POST /api/subcontractors/my-company/plant - Add new plant
subcontractorsRouter.post('/my-company/plant', asyncHandler(async (req, res) => {
    const user = req.user!

    // Check if user is a subcontractor admin
    if (user.roleInCompany !== 'subcontractor_admin') {
      throw AppError.forbidden('Only subcontractor admins can add plant')
    }

    // Get the user's subcontractor company
    const subcontractorUser = await prisma.subcontractorUser.findFirst({
      where: { userId: user.id },
      include: { subcontractorCompany: true }
    })

    if (!subcontractorUser || !subcontractorUser.subcontractorCompany) {
      throw AppError.notFound('Subcontractor company')
    }

    const { type, description, idRego, dryRate, wetRate } = req.body

    if (!type || !description || !dryRate) {
      throw AppError.badRequest('Type, description, and dryRate are required')
    }

    const plant = await prisma.plantRegister.create({
      data: {
        subcontractorCompanyId: subcontractorUser.subcontractorCompany.id,
        type: type,
        description: description,
        idRego: idRego || null,
        dryRate: dryRate,
        wetRate: wetRate || 0,
        status: 'pending' // Needs head contractor approval
      }
    })

    res.status(201).json({
      plant: {
        id: plant.id,
        type: plant.type,
        description: plant.description || '',
        idRego: plant.idRego || '',
        dryRate: plant.dryRate?.toNumber() || 0,
        wetRate: plant.wetRate?.toNumber() || 0,
        status: 'pending'
      }
    })
}))

// DELETE /api/subcontractors/my-company/employees/:id - Delete an employee
subcontractorsRouter.delete('/my-company/employees/:id', asyncHandler(async (req, res) => {
    const user = req.user!
    const { id } = req.params

    // Check if user is a subcontractor admin
    if (user.roleInCompany !== 'subcontractor_admin') {
      throw AppError.forbidden('Only subcontractor admins can delete employees')
    }

    // Get the user's subcontractor company
    const subcontractorUser = await prisma.subcontractorUser.findFirst({
      where: { userId: user.id }
    })

    if (!subcontractorUser) {
      throw AppError.notFound('Subcontractor company')
    }

    // Verify the employee belongs to this company
    const employee = await prisma.employeeRoster.findUnique({
      where: { id }
    })

    if (!employee || employee.subcontractorCompanyId !== subcontractorUser.subcontractorCompanyId) {
      throw AppError.notFound('Employee')
    }

    await prisma.employeeRoster.delete({
      where: { id }
    })

    res.json({ message: 'Employee deleted successfully' })
}))

// DELETE /api/subcontractors/my-company/plant/:id - Delete plant
subcontractorsRouter.delete('/my-company/plant/:id', asyncHandler(async (req, res) => {
    const user = req.user!
    const { id } = req.params

    // Check if user is a subcontractor admin
    if (user.roleInCompany !== 'subcontractor_admin') {
      throw AppError.forbidden('Only subcontractor admins can delete plant')
    }

    // Get the user's subcontractor company
    const subcontractorUser = await prisma.subcontractorUser.findFirst({
      where: { userId: user.id }
    })

    if (!subcontractorUser) {
      throw AppError.notFound('Subcontractor company')
    }

    // Verify the plant belongs to this company
    const plant = await prisma.plantRegister.findUnique({
      where: { id }
    })

    if (!plant || plant.subcontractorCompanyId !== subcontractorUser.subcontractorCompanyId) {
      throw AppError.notFound('Plant')
    }

    await prisma.plantRegister.delete({
      where: { id }
    })

    res.json({ message: 'Plant deleted successfully' })
}))

// PATCH /api/subcontractors/:id/status - Update subcontractor status (suspend/remove)
// Only project managers, admins, or owners can suspend subcontractors
subcontractorsRouter.patch('/:id/status', asyncHandler(async (req, res) => {
    const user = req.user!
    const { id } = req.params
    const { status } = req.body

    // Only allow head contractor roles to change status
    const allowedRoles = ['owner', 'admin', 'project_manager', 'site_manager']
    if (!allowedRoles.includes(user.roleInCompany || '')) {
      throw AppError.forbidden('Only project managers or higher can update subcontractor status')
    }

    // Validate status
    const validStatuses = ['pending_approval', 'approved', 'suspended', 'removed']
    if (!status || !validStatuses.includes(status)) {
      throw AppError.badRequest(`Status must be one of: ${validStatuses.join(', ')}`)
    }

    // Find the subcontractor company
    const subcontractor = await prisma.subcontractorCompany.findUnique({
      where: { id },
      include: { project: true }
    })

    if (!subcontractor) {
      throw AppError.notFound('Subcontractor company')
    }

    // Verify user has access to this project (company-based access or ProjectUser)
    const projectUser = await prisma.projectUser.findUnique({
      where: {
        projectId_userId: {
          projectId: subcontractor.projectId,
          userId: user.id
        }
      }
    })

    const isCompanyAdmin = ['owner', 'admin'].includes(user.roleInCompany || '')
    const project = await prisma.project.findUnique({
      where: { id: subcontractor.projectId }
    })
    const isCompanyProject = project?.companyId === user.companyId

    if (!projectUser && !(isCompanyAdmin && isCompanyProject)) {
      throw AppError.forbidden('You do not have access to this project')
    }

    // Update the status
    const updatedSubcontractor = await prisma.subcontractorCompany.update({
      where: { id },
      data: {
        status,
        // If approving, record who approved
        ...(status === 'approved' && {
          approvedById: user.id,
          approvedAt: new Date()
        })
      },
      select: {
        id: true,
        companyName: true,
        status: true,
        approvedAt: true,
      }
    })

    // Audit log for subcontractor status change
    await createAuditLog({
      projectId: subcontractor.projectId,
      userId: user.id,
      entityType: 'subcontractor',
      entityId: id,
      action: AuditAction.SUBCONTRACTOR_STATUS_CHANGED,
      changes: { previousStatus: subcontractor.status, newStatus: status, companyName: subcontractor.companyName },
      req
    })

    res.json({
      message: `Subcontractor status updated to ${status}`,
      subcontractor: updatedSubcontractor
    })
}))

// DELETE /api/subcontractors/:id - Permanently delete a subcontractor and all associated records
subcontractorsRouter.delete('/:id', asyncHandler(async (req, res) => {
    const user = req.user!
    const { id } = req.params

    // Only allow head contractor roles to delete subcontractors
    const allowedRoles = ['owner', 'admin', 'project_manager', 'site_manager']
    if (!allowedRoles.includes(user.roleInCompany || '')) {
      throw AppError.forbidden('Only project managers or higher can delete subcontractors')
    }

    // Find the subcontractor company with counts
    const subcontractor = await prisma.subcontractorCompany.findUnique({
      where: { id },
      include: {
        project: true,
        employeeRoster: { select: { id: true } },
        plantRegister: { select: { id: true } },
        dailyDockets: { select: { id: true } },
        users: { select: { id: true } },
      }
    })

    if (!subcontractor) {
      throw AppError.notFound('Subcontractor company')
    }

    // Verify user has access to this project
    const projectUser = await prisma.projectUser.findUnique({
      where: {
        projectId_userId: {
          projectId: subcontractor.projectId,
          userId: user.id
        }
      }
    })

    const isCompanyAdmin = ['owner', 'admin'].includes(user.roleInCompany || '')
    const project = await prisma.project.findUnique({
      where: { id: subcontractor.projectId }
    })
    const isCompanyProject = project?.companyId === user.companyId

    if (!projectUser && !(isCompanyAdmin && isCompanyProject)) {
      throw AppError.forbidden('You do not have access to this project')
    }

    // Nullify foreign keys in Lot and NCR before deleting
    await prisma.lot.updateMany({
      where: { assignedSubcontractorId: id },
      data: { assignedSubcontractorId: null }
    })

    await prisma.nCR.updateMany({
      where: { responsibleSubcontractorId: id },
      data: { responsibleSubcontractorId: null }
    })

    const deletedCounts = {
      dockets: subcontractor.dailyDockets.length,
      employees: subcontractor.employeeRoster.length,
      plant: subcontractor.plantRegister.length,
    }

    // Delete the subcontractor company (Prisma cascade handles SubcontractorUser, EmployeeRoster, PlantRegister, DailyDocket)
    await prisma.subcontractorCompany.delete({
      where: { id }
    })

    res.json({
      message: `Subcontractor ${subcontractor.companyName} permanently deleted`,
      deletedCounts
    })
}))

// Default portal access settings
const DEFAULT_PORTAL_ACCESS = {
  lots: true,
  itps: false,
  holdPoints: false,
  testResults: false,
  ncrs: false,
  documents: false,
}

// PATCH /api/subcontractors/:id/portal-access - Update portal access settings
subcontractorsRouter.patch('/:id/portal-access', asyncHandler(async (req, res) => {
    const user = req.user!
    const { id } = req.params
    const { portalAccess } = req.body

    // Only allow head contractor roles to change portal access
    const allowedRoles = ['owner', 'admin', 'project_manager', 'site_manager']
    if (!allowedRoles.includes(user.roleInCompany || '')) {
      throw AppError.forbidden('Only project managers or higher can update portal access settings')
    }

    // Validate portal access object
    if (!portalAccess || typeof portalAccess !== 'object') {
      throw AppError.badRequest('portalAccess object is required')
    }

    // Validate the structure - ensure all keys are valid booleans
    const validKeys = ['lots', 'itps', 'holdPoints', 'testResults', 'ncrs', 'documents']
    for (const key of validKeys) {
      if (portalAccess[key] !== undefined && typeof portalAccess[key] !== 'boolean') {
        throw AppError.badRequest(`Invalid value for ${key} - must be a boolean`)
      }
    }

    // Find the subcontractor company
    const subcontractor = await prisma.subcontractorCompany.findUnique({
      where: { id },
      include: { project: true }
    })

    if (!subcontractor) {
      throw AppError.notFound('Subcontractor company')
    }

    // Verify user has access to this project
    const projectUser = await prisma.projectUser.findUnique({
      where: {
        projectId_userId: {
          projectId: subcontractor.projectId,
          userId: user.id
        }
      }
    })

    const isCompanyAdmin = ['owner', 'admin'].includes(user.roleInCompany || '')
    const project = await prisma.project.findUnique({
      where: { id: subcontractor.projectId }
    })
    const isCompanyProject = project?.companyId === user.companyId

    if (!projectUser && !(isCompanyAdmin && isCompanyProject)) {
      throw AppError.forbidden('You do not have access to this project')
    }

    // Merge with defaults to ensure all keys exist
    const mergedAccess = {
      ...DEFAULT_PORTAL_ACCESS,
      ...portalAccess
    }

    // Update the portal access
    const updatedSubcontractor = await prisma.subcontractorCompany.update({
      where: { id },
      data: {
        portalAccess: mergedAccess
      },
      select: {
        id: true,
        companyName: true,
        portalAccess: true,
      }
    })

    // Audit log for portal access update
    await createAuditLog({
      projectId: subcontractor.projectId,
      userId: user.id,
      entityType: 'subcontractor',
      entityId: id,
      action: AuditAction.SUBCONTRACTOR_PORTAL_ACCESS_UPDATED,
      changes: { portalAccess: mergedAccess, companyName: subcontractor.companyName },
      req
    })

    res.json({
      message: 'Portal access updated successfully',
      portalAccess: updatedSubcontractor.portalAccess
    })
}))

// GET /api/subcontractors/:id/portal-access - Get portal access settings
subcontractorsRouter.get('/:id/portal-access', asyncHandler(async (req, res) => {
    const { id } = req.params

    const subcontractor = await prisma.subcontractorCompany.findUnique({
      where: { id },
      select: {
        id: true,
        companyName: true,
        portalAccess: true,
      }
    })

    if (!subcontractor) {
      throw AppError.notFound('Subcontractor company')
    }

    // Return stored access or defaults
    const portalAccess = subcontractor.portalAccess || DEFAULT_PORTAL_ACCESS

    res.json({ portalAccess })
}))

// GET /api/subcontractors/project/:projectId - Get all subcontractors for a project (head contractor view)
subcontractorsRouter.get('/project/:projectId', asyncHandler(async (req, res) => {
    const { projectId } = req.params
    const { includeRemoved } = req.query

    // Get subcontractors for this project
    const whereClause: any = { projectId }

    // By default, exclude removed subcontractors unless specifically requested
    if (includeRemoved !== 'true') {
      whereClause.status = { not: 'removed' }
    }

    const subcontractors = await prisma.subcontractorCompany.findMany({
      where: whereClause,
      include: {
        employeeRoster: true,
        plantRegister: true,
        dailyDockets: {
          where: { status: 'approved' },
          select: {
            id: true,
            totalLabourApproved: true,
            totalPlantApproved: true,
          }
        },
        assignedLots: {
          select: { id: true }
        }
      },
      orderBy: { companyName: 'asc' }
    })

    // Calculate totals for each subcontractor
    const formattedSubcontractors = subcontractors.map(sub => {
      const totalApprovedDockets = sub.dailyDockets.length
      const totalCost = sub.dailyDockets.reduce((sum, docket) => {
        return sum + (Number(docket.totalLabourApproved) || 0) + (Number(docket.totalPlantApproved) || 0)
      }, 0)

      return {
        id: sub.id,
        companyName: sub.companyName,
        abn: sub.abn || '',
        primaryContact: sub.primaryContactName || '',
        email: sub.primaryContactEmail || '',
        phone: sub.primaryContactPhone || '',
        status: sub.status,
        portalAccess: sub.portalAccess || DEFAULT_PORTAL_ACCESS,
        employees: sub.employeeRoster.map(e => ({
          id: e.id,
          name: e.name,
          role: e.role || '',
          hourlyRate: Number(e.hourlyRate) || 0,
          status: e.status
        })),
        plant: sub.plantRegister.map(p => ({
          id: p.id,
          type: p.type,
          description: p.description || '',
          idRego: p.idRego || '',
          dryRate: Number(p.dryRate) || 0,
          wetRate: Number(p.wetRate) || 0,
          status: p.status
        })),
        totalApprovedDockets,
        totalCost,
        assignedLotCount: sub.assignedLots.length
      }
    })

    res.json({ subcontractors: formattedSubcontractors })
}))

// POST /api/subcontractors/:id/employees - Add employee to a subcontractor (admin)
subcontractorsRouter.post('/:id/employees', asyncHandler(async (req, res) => {
    const { id } = req.params
    const { name, role, hourlyRate, phone } = req.body

    if (!name || hourlyRate === undefined) {
      throw AppError.badRequest('Name and hourly rate are required')
    }

    // Verify subcontractor exists
    const subcontractor = await prisma.subcontractorCompany.findUnique({
      where: { id }
    })

    if (!subcontractor) {
      throw AppError.notFound('Subcontractor')
    }

    const employee = await prisma.employeeRoster.create({
      data: {
        subcontractorCompanyId: id,
        name,
        role: role || '',
        hourlyRate: hourlyRate,
        phone: phone || '',
        status: 'pending'
      }
    })

    res.status(201).json({
      employee: {
        id: employee.id,
        name: employee.name,
        role: employee.role || '',
        hourlyRate: Number(employee.hourlyRate),
        status: employee.status
      }
    })
}))

// PATCH /api/subcontractors/:id/employees/:empId/status - Update employee status
subcontractorsRouter.patch('/:id/employees/:empId/status', asyncHandler(async (req, res) => {
    const { id, empId } = req.params
    const { status, counterRate } = req.body
    const userId = req.user?.userId

    const validStatuses = ['pending', 'approved', 'inactive', 'counter']
    if (!validStatuses.includes(status)) {
      throw AppError.badRequest('Invalid status. Must be: pending, approved, inactive, or counter')
    }

    // Counter-proposals require a counter rate
    if (status === 'counter' && (counterRate === undefined || counterRate === null)) {
      throw AppError.badRequest('Counter-proposal requires a counterRate value')
    }

    // Verify employee belongs to this subcontractor
    const employee = await prisma.employeeRoster.findFirst({
      where: {
        id: empId,
        subcontractorCompanyId: id
      }
    })

    if (!employee) {
      throw AppError.notFound('Employee')
    }

    const updateData: any = { status }
    if (status === 'approved') {
      updateData.approvedById = userId
      updateData.approvedAt = new Date()
    }

    const updated = await prisma.employeeRoster.update({
      where: { id: empId },
      data: updateData
    })

    // Feature #943 - Send notification when employee rate is approved
    if (status === 'approved') {
      try {
        // Get subcontractor company and project details
        const subcontractor = await prisma.subcontractorCompany.findUnique({
          where: { id },
          include: {
            project: { select: { id: true, name: true } }
          }
        })

        // Get subcontractor users to notify
        const subcontractorUsers = await prisma.subcontractorUser.findMany({
          where: { subcontractorCompanyId: id }
        })

        // Get user details for each subcontractor user
        const userIds = subcontractorUsers.map(su => su.userId)
        const users = await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true }
        })

        // Create notification for each subcontractor user
        for (const u of users) {
          await prisma.notification.create({
            data: {
              userId: u.id,
              projectId: subcontractor?.project?.id || null,
              type: 'rate_approved',
              title: 'Employee Rate Approved',
              message: `The rate for ${updated.name} ($${Number(updated.hourlyRate).toFixed(2)}/hr) has been approved. You can now include this employee in your dockets.`,
              linkUrl: `/subcontractor-portal`
            }
          })
        }

      } catch (notifError) {
        console.error('[Rate Approval] Failed to send notification:', notifError)
        // Don't fail the main request
      }
    }

    // Feature #944 - Send notification when PM counter-proposes employee rate
    if (status === 'counter' && counterRate !== undefined) {
      try {
        // Get subcontractor company and project details
        const subcontractor = await prisma.subcontractorCompany.findUnique({
          where: { id },
          include: {
            project: { select: { id: true, name: true } }
          }
        })

        // Get subcontractor users to notify
        const subcontractorUsers = await prisma.subcontractorUser.findMany({
          where: { subcontractorCompanyId: id }
        })

        // Get user details for each subcontractor user
        const userIds2 = subcontractorUsers.map(su => su.userId)
        const users2 = await prisma.user.findMany({
          where: { id: { in: userIds2 } },
          select: { id: true, email: true }
        })

        const originalRate = Number(employee.hourlyRate).toFixed(2)
        const proposedRate = Number(counterRate).toFixed(2)

        // Create notification for each subcontractor user
        for (const u of users2) {
          await prisma.notification.create({
            data: {
              userId: u.id,
              projectId: subcontractor?.project?.id || null,
              type: 'rate_counter',
              title: 'Rate Counter-Proposal',
              message: `A counter-proposal has been made for ${updated.name}. Original rate: $${originalRate}/hr, Proposed rate: $${proposedRate}/hr. Please review and respond.`,
              linkUrl: `/subcontractor-portal`
            }
          })
        }

      } catch (notifError) {
        console.error('[Rate Counter] Failed to send notification:', notifError)
        // Don't fail the main request
      }
    }

    // Audit log for employee rate status change
    const subForAudit = await prisma.subcontractorCompany.findUnique({
      where: { id },
      select: { projectId: true, companyName: true }
    })
    await createAuditLog({
      projectId: subForAudit?.projectId,
      userId,
      entityType: 'subcontractor_employee',
      entityId: empId,
      action: AuditAction.SUBCONTRACTOR_EMPLOYEE_RATE_APPROVED,
      changes: { status, employeeName: updated.name, hourlyRate: Number(updated.hourlyRate), counterRate },
      req
    })

    res.json({
      employee: {
        id: updated.id,
        name: updated.name,
        role: updated.role || '',
        hourlyRate: Number(updated.hourlyRate),
        status: updated.status,
        ...(status === 'counter' && counterRate !== undefined && { counterRate: Number(counterRate) })
      }
    })
}))

// POST /api/subcontractors/:id/plant - Add plant to a subcontractor (admin)
subcontractorsRouter.post('/:id/plant', asyncHandler(async (req, res) => {
    const { id } = req.params
    const { type, description, idRego, dryRate, wetRate } = req.body

    if (!type || dryRate === undefined) {
      throw AppError.badRequest('Type and dry rate are required')
    }

    // Verify subcontractor exists
    const subcontractor = await prisma.subcontractorCompany.findUnique({
      where: { id }
    })

    if (!subcontractor) {
      throw AppError.notFound('Subcontractor')
    }

    const plant = await prisma.plantRegister.create({
      data: {
        subcontractorCompanyId: id,
        type,
        description: description || '',
        idRego: idRego || '',
        dryRate: dryRate,
        wetRate: wetRate || 0,
        status: 'pending'
      }
    })

    res.status(201).json({
      plant: {
        id: plant.id,
        type: plant.type,
        description: plant.description || '',
        idRego: plant.idRego || '',
        dryRate: Number(plant.dryRate),
        wetRate: Number(plant.wetRate) || 0,
        status: plant.status
      }
    })
}))

// PATCH /api/subcontractors/:id/plant/:plantId/status - Update plant status
subcontractorsRouter.patch('/:id/plant/:plantId/status', asyncHandler(async (req, res) => {
    const { id, plantId } = req.params
    const { status, counterDryRate, counterWetRate } = req.body
    const userId = req.user?.userId

    const validStatuses = ['pending', 'approved', 'inactive', 'counter']
    if (!validStatuses.includes(status)) {
      throw AppError.badRequest('Invalid status. Must be: pending, approved, inactive, or counter')
    }

    // Counter-proposals require at least a counter dry rate
    if (status === 'counter' && (counterDryRate === undefined || counterDryRate === null)) {
      throw AppError.badRequest('Counter-proposal requires a counterDryRate value')
    }

    // Verify plant belongs to this subcontractor
    const plant = await prisma.plantRegister.findFirst({
      where: {
        id: plantId,
        subcontractorCompanyId: id
      }
    })

    if (!plant) {
      throw AppError.notFound('Plant')
    }

    const updateData: any = { status }
    if (status === 'approved') {
      updateData.approvedById = userId
      updateData.approvedAt = new Date()
    }

    const updated = await prisma.plantRegister.update({
      where: { id: plantId },
      data: updateData
    })

    // Feature #943 - Send notification when plant rate is approved
    if (status === 'approved') {
      try {
        // Get subcontractor company and project details
        const subcontractor = await prisma.subcontractorCompany.findUnique({
          where: { id },
          include: {
            project: { select: { id: true, name: true } }
          }
        })

        // Get subcontractor users to notify
        const subcontractorUsers = await prisma.subcontractorUser.findMany({
          where: { subcontractorCompanyId: id }
        })

        // Get user details for each subcontractor user
        const userIds3 = subcontractorUsers.map(su => su.userId)
        const users3 = await prisma.user.findMany({
          where: { id: { in: userIds3 } },
          select: { id: true, email: true }
        })

        // Format rates for display
        const dryRateStr = `$${Number(updated.dryRate).toFixed(2)}`
        const wetRateStr = updated.wetRate ? `/$${Number(updated.wetRate).toFixed(2)}` : ''
        const rateDisplay = `${dryRateStr}${wetRateStr}/hr (dry${wetRateStr ? '/wet' : ''})`

        // Create notification for each subcontractor user
        for (const u of users3) {
          await prisma.notification.create({
            data: {
              userId: u.id,
              projectId: subcontractor?.project?.id || null,
              type: 'rate_approved',
              title: 'Plant Rate Approved',
              message: `The rate for ${updated.type}${updated.description ? ` - ${updated.description}` : ''} (${rateDisplay}) has been approved. You can now include this plant in your dockets.`,
              linkUrl: `/subcontractor-portal`
            }
          })
        }

      } catch (notifError) {
        console.error('[Rate Approval] Failed to send notification:', notifError)
        // Don't fail the main request
      }
    }

    // Feature #944 - Send notification when PM counter-proposes plant rate
    if (status === 'counter' && counterDryRate !== undefined) {
      try {
        // Get subcontractor company and project details
        const subcontractor = await prisma.subcontractorCompany.findUnique({
          where: { id },
          include: {
            project: { select: { id: true, name: true } }
          }
        })

        // Get subcontractor users to notify
        const subcontractorUsers4 = await prisma.subcontractorUser.findMany({
          where: { subcontractorCompanyId: id }
        })

        // Get user details for each subcontractor user
        const userIds4 = subcontractorUsers4.map(su => su.userId)
        const users4 = await prisma.user.findMany({
          where: { id: { in: userIds4 } },
          select: { id: true, email: true }
        })

        // Format original rates
        const origDryRate = Number(plant.dryRate).toFixed(2)
        const origWetRate = plant.wetRate ? Number(plant.wetRate).toFixed(2) : null
        const originalRates = origWetRate ? `$${origDryRate}/$${origWetRate}/hr` : `$${origDryRate}/hr`

        // Format proposed rates
        const propDryRate = Number(counterDryRate).toFixed(2)
        const propWetRate = counterWetRate ? Number(counterWetRate).toFixed(2) : null
        const proposedRates = propWetRate ? `$${propDryRate}/$${propWetRate}/hr` : `$${propDryRate}/hr`

        const plantDesc = `${updated.type}${updated.description ? ` - ${updated.description}` : ''}`

        // Create notification for each subcontractor user
        for (const u of users4) {
          await prisma.notification.create({
            data: {
              userId: u.id,
              projectId: subcontractor?.project?.id || null,
              type: 'rate_counter',
              title: 'Plant Rate Counter-Proposal',
              message: `A counter-proposal has been made for ${plantDesc}. Original: ${originalRates}, Proposed: ${proposedRates}. Please review and respond.`,
              linkUrl: `/subcontractor-portal`
            }
          })
        }

      } catch (notifError) {
        console.error('[Rate Counter] Failed to send notification:', notifError)
        // Don't fail the main request
      }
    }

    // Audit log for plant rate status change
    const subForPlantAudit = await prisma.subcontractorCompany.findUnique({
      where: { id },
      select: { projectId: true, companyName: true }
    })
    await createAuditLog({
      projectId: subForPlantAudit?.projectId,
      userId,
      entityType: 'subcontractor_plant',
      entityId: plantId,
      action: AuditAction.SUBCONTRACTOR_PLANT_RATE_APPROVED,
      changes: { status, plantType: updated.type, dryRate: Number(updated.dryRate), wetRate: Number(updated.wetRate), counterDryRate, counterWetRate },
      req
    })

    res.json({
      plant: {
        id: updated.id,
        type: updated.type,
        description: updated.description || '',
        idRego: updated.idRego || '',
        dryRate: Number(updated.dryRate),
        wetRate: Number(updated.wetRate) || 0,
        status: updated.status,
        ...(status === 'counter' && {
          counterDryRate: Number(counterDryRate),
          ...(counterWetRate !== undefined && { counterWetRate: Number(counterWetRate) })
        })
      }
    })
}))

// Feature #483: POST /api/subcontractors/validate-abn - Validate an ABN
subcontractorsRouter.post('/validate-abn', asyncHandler(async (req, res) => {
    const { abn } = req.body

    if (!abn) {
      throw AppError.badRequest('Please provide an ABN to validate')
    }

    const validation = validateABN(abn)

    res.json({
      abn: abn.replace(/[\s-]/g, ''),
      valid: validation.valid,
      error: validation.error || null,
      formatted: validation.valid ? formatABN(abn.replace(/[\s-]/g, '')) : null
    })
}))

// Helper to format ABN with spaces: XX XXX XXX XXX
function formatABN(abn: string): string {
  const clean = abn.replace(/[\s-]/g, '')
  if (clean.length !== 11) return abn
  return `${clean.slice(0, 2)} ${clean.slice(2, 5)} ${clean.slice(5, 8)} ${clean.slice(8, 11)}`
}
