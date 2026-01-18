import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/authMiddleware.js'

export const subcontractorsRouter = Router()

// Apply authentication middleware to all routes
subcontractorsRouter.use(requireAuth)

// POST /api/subcontractors/invite - Invite/create a new subcontractor company for a project
subcontractorsRouter.post('/invite', async (req, res) => {
  try {
    const user = req.user!
    const { projectId, companyName, abn, primaryContactName, primaryContactEmail, primaryContactPhone } = req.body

    // Only allow head contractor roles to invite subcontractors
    const allowedRoles = ['owner', 'admin', 'project_manager', 'site_manager']
    if (!allowedRoles.includes(user.roleInCompany || '')) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only project managers or higher can invite subcontractors'
      })
    }

    // Validate required fields
    if (!projectId || !companyName || !primaryContactName || !primaryContactEmail) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'projectId, companyName, primaryContactName, and primaryContactEmail are required'
      })
    }

    // Verify project exists and user has access
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    })

    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }

    // Check if a subcontractor with same name already exists for this project
    const existingSubcontractor = await prisma.subcontractorCompany.findFirst({
      where: {
        projectId,
        companyName: companyName
      }
    })

    if (existingSubcontractor) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'A subcontractor with this company name already exists for this project'
      })
    }

    // Create the subcontractor company
    const subcontractor = await prisma.subcontractorCompany.create({
      data: {
        projectId,
        companyName,
        abn: abn || null,
        primaryContactName,
        primaryContactEmail,
        primaryContactPhone: primaryContactPhone || null,
        status: 'pending_approval'
      }
    })

    console.log(`Subcontractor ${companyName} invited to project ${project.name} by ${user.email}`)

    // Log email invitation (in production, this would send an actual email)
    const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:5175'}/subcontractor-portal/accept-invite?id=${subcontractor.id}`
    console.log('\n========================================')
    console.log('📧 SUBCONTRACTOR INVITATION EMAIL')
    console.log('========================================')
    console.log(`To: ${primaryContactEmail}`)
    console.log(`Subject: Invitation to join ${project.name} on SiteProof`)
    console.log('----------------------------------------')
    console.log(`Hi ${primaryContactName},`)
    console.log('')
    console.log(`You have been invited to join the project "${project.name}" on SiteProof`)
    console.log(`as a subcontractor for ${companyName}.`)
    console.log('')
    console.log(`Click the link below to accept your invitation and set up your account:`)
    console.log(`${inviteUrl}`)
    console.log('')
    console.log(`This invitation was sent by ${user.email}.`)
    console.log('========================================\n')

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
  } catch (error) {
    console.error('Invite subcontractor error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/subcontractors/for-project/:projectId - Get subcontractors for a project
subcontractorsRouter.get('/for-project/:projectId', async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Get subcontractors for project error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/subcontractors/my-company - Get the current user's subcontractor company
subcontractorsRouter.get('/my-company', async (req, res) => {
  try {
    const user = req.user!

    // Check if user is a subcontractor
    if (!['subcontractor', 'subcontractor_admin'].includes(user.roleInCompany || '')) {
      return res.status(403).json({ error: 'Only subcontractors can access this endpoint' })
    }

    // Get the user's subcontractor company via SubcontractorUser
    const subcontractorUser = await prisma.subcontractorUser.findFirst({
      where: { userId: user.id },
      include: {
        subcontractorCompany: {
          include: {
            employeeRoster: true,
            plantRegister: true,
          }
        }
      }
    })

    if (!subcontractorUser || !subcontractorUser.subcontractorCompany) {
      return res.status(404).json({ error: 'No subcontractor company found for this user' })
    }

    const company = subcontractorUser.subcontractorCompany

    res.json({
      company: {
        id: company.id,
        companyName: company.companyName,
        abn: company.abn || '',
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
        }))
      }
    })
  } catch (error) {
    console.error('Get my company error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/subcontractors/my-company/employees - Add a new employee
subcontractorsRouter.post('/my-company/employees', async (req, res) => {
  try {
    const user = req.user!

    // Check if user is a subcontractor admin
    if (user.roleInCompany !== 'subcontractor_admin') {
      return res.status(403).json({ error: 'Only subcontractor admins can add employees' })
    }

    // Get the user's subcontractor company
    const subcontractorUser = await prisma.subcontractorUser.findFirst({
      where: { userId: user.id },
      include: { subcontractorCompany: true }
    })

    if (!subcontractorUser || !subcontractorUser.subcontractorCompany) {
      return res.status(404).json({ error: 'No subcontractor company found' })
    }

    const { name, phone, role, hourlyRate } = req.body

    if (!name || !role || !hourlyRate) {
      return res.status(400).json({ error: 'Name, role, and hourlyRate are required' })
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
  } catch (error) {
    console.error('Add employee error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/subcontractors/my-company/plant - Add new plant
subcontractorsRouter.post('/my-company/plant', async (req, res) => {
  try {
    const user = req.user!

    // Check if user is a subcontractor admin
    if (user.roleInCompany !== 'subcontractor_admin') {
      return res.status(403).json({ error: 'Only subcontractor admins can add plant' })
    }

    // Get the user's subcontractor company
    const subcontractorUser = await prisma.subcontractorUser.findFirst({
      where: { userId: user.id },
      include: { subcontractorCompany: true }
    })

    if (!subcontractorUser || !subcontractorUser.subcontractorCompany) {
      return res.status(404).json({ error: 'No subcontractor company found' })
    }

    const { type, description, idRego, dryRate, wetRate } = req.body

    if (!type || !description || !dryRate) {
      return res.status(400).json({ error: 'Type, description, and dryRate are required' })
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
  } catch (error) {
    console.error('Add plant error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /api/subcontractors/my-company/employees/:id - Delete an employee
subcontractorsRouter.delete('/my-company/employees/:id', async (req, res) => {
  try {
    const user = req.user!
    const { id } = req.params

    // Check if user is a subcontractor admin
    if (user.roleInCompany !== 'subcontractor_admin') {
      return res.status(403).json({ error: 'Only subcontractor admins can delete employees' })
    }

    // Get the user's subcontractor company
    const subcontractorUser = await prisma.subcontractorUser.findFirst({
      where: { userId: user.id }
    })

    if (!subcontractorUser) {
      return res.status(404).json({ error: 'No subcontractor company found' })
    }

    // Verify the employee belongs to this company
    const employee = await prisma.employeeRoster.findUnique({
      where: { id }
    })

    if (!employee || employee.subcontractorCompanyId !== subcontractorUser.subcontractorCompanyId) {
      return res.status(404).json({ error: 'Employee not found' })
    }

    await prisma.employeeRoster.delete({
      where: { id }
    })

    res.json({ message: 'Employee deleted successfully' })
  } catch (error) {
    console.error('Delete employee error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /api/subcontractors/my-company/plant/:id - Delete plant
subcontractorsRouter.delete('/my-company/plant/:id', async (req, res) => {
  try {
    const user = req.user!
    const { id } = req.params

    // Check if user is a subcontractor admin
    if (user.roleInCompany !== 'subcontractor_admin') {
      return res.status(403).json({ error: 'Only subcontractor admins can delete plant' })
    }

    // Get the user's subcontractor company
    const subcontractorUser = await prisma.subcontractorUser.findFirst({
      where: { userId: user.id }
    })

    if (!subcontractorUser) {
      return res.status(404).json({ error: 'No subcontractor company found' })
    }

    // Verify the plant belongs to this company
    const plant = await prisma.plantRegister.findUnique({
      where: { id }
    })

    if (!plant || plant.subcontractorCompanyId !== subcontractorUser.subcontractorCompanyId) {
      return res.status(404).json({ error: 'Plant not found' })
    }

    await prisma.plantRegister.delete({
      where: { id }
    })

    res.json({ message: 'Plant deleted successfully' })
  } catch (error) {
    console.error('Delete plant error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PATCH /api/subcontractors/:id/status - Update subcontractor status (suspend/remove)
// Only project managers, admins, or owners can suspend subcontractors
subcontractorsRouter.patch('/:id/status', async (req, res) => {
  try {
    const user = req.user!
    const { id } = req.params
    const { status } = req.body

    // Only allow head contractor roles to change status
    const allowedRoles = ['owner', 'admin', 'project_manager', 'site_manager']
    if (!allowedRoles.includes(user.roleInCompany || '')) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only project managers or higher can update subcontractor status'
      })
    }

    // Validate status
    const validStatuses = ['pending_approval', 'approved', 'suspended', 'removed']
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Status must be one of: ${validStatuses.join(', ')}`
      })
    }

    // Find the subcontractor company
    const subcontractor = await prisma.subcontractorCompany.findUnique({
      where: { id },
      include: { project: true }
    })

    if (!subcontractor) {
      return res.status(404).json({ error: 'Subcontractor company not found' })
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
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this project'
      })
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

    // Log the action
    console.log(`Subcontractor ${updatedSubcontractor.companyName} status changed to ${status} by ${user.email}`)

    res.json({
      message: `Subcontractor status updated to ${status}`,
      subcontractor: updatedSubcontractor
    })
  } catch (error) {
    console.error('Update subcontractor status error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/subcontractors/project/:projectId - Get all subcontractors for a project (head contractor view)
subcontractorsRouter.get('/project/:projectId', async (req, res) => {
  try {
    const user = req.user!
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
  } catch (error) {
    console.error('Get project subcontractors error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/subcontractors/:id/employees - Add employee to a subcontractor (admin)
subcontractorsRouter.post('/:id/employees', async (req, res) => {
  try {
    const { id } = req.params
    const { name, role, hourlyRate, phone } = req.body

    if (!name || hourlyRate === undefined) {
      return res.status(400).json({ error: 'Name and hourly rate are required' })
    }

    // Verify subcontractor exists
    const subcontractor = await prisma.subcontractorCompany.findUnique({
      where: { id }
    })

    if (!subcontractor) {
      return res.status(404).json({ error: 'Subcontractor not found' })
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
  } catch (error) {
    console.error('Add employee error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PATCH /api/subcontractors/:id/employees/:empId/status - Update employee status
subcontractorsRouter.patch('/:id/employees/:empId/status', async (req, res) => {
  try {
    const { id, empId } = req.params
    const { status } = req.body
    const userId = (req as any).user?.userId

    const validStatuses = ['pending', 'approved', 'inactive']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be: pending, approved, or inactive' })
    }

    // Verify employee belongs to this subcontractor
    const employee = await prisma.employeeRoster.findFirst({
      where: {
        id: empId,
        subcontractorCompanyId: id
      }
    })

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' })
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

    res.json({
      employee: {
        id: updated.id,
        name: updated.name,
        role: updated.role || '',
        hourlyRate: Number(updated.hourlyRate),
        status: updated.status
      }
    })
  } catch (error) {
    console.error('Update employee status error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/subcontractors/:id/plant - Add plant to a subcontractor (admin)
subcontractorsRouter.post('/:id/plant', async (req, res) => {
  try {
    const { id } = req.params
    const { type, description, idRego, dryRate, wetRate } = req.body

    if (!type || dryRate === undefined) {
      return res.status(400).json({ error: 'Type and dry rate are required' })
    }

    // Verify subcontractor exists
    const subcontractor = await prisma.subcontractorCompany.findUnique({
      where: { id }
    })

    if (!subcontractor) {
      return res.status(404).json({ error: 'Subcontractor not found' })
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
  } catch (error) {
    console.error('Add plant error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PATCH /api/subcontractors/:id/plant/:plantId/status - Update plant status
subcontractorsRouter.patch('/:id/plant/:plantId/status', async (req, res) => {
  try {
    const { id, plantId } = req.params
    const { status } = req.body
    const userId = (req as any).user?.userId

    const validStatuses = ['pending', 'approved', 'inactive']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be: pending, approved, or inactive' })
    }

    // Verify plant belongs to this subcontractor
    const plant = await prisma.plantRegister.findFirst({
      where: {
        id: plantId,
        subcontractorCompanyId: id
      }
    })

    if (!plant) {
      return res.status(404).json({ error: 'Plant not found' })
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

    res.json({
      plant: {
        id: updated.id,
        type: updated.type,
        description: updated.description || '',
        idRego: updated.idRego || '',
        dryRate: Number(updated.dryRate),
        wetRate: Number(updated.wetRate) || 0,
        status: updated.status
      }
    })
  } catch (error) {
    console.error('Update plant status error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})
