import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/authMiddleware.js'

export const subcontractorsRouter = Router()

// Apply authentication middleware to all routes
subcontractorsRouter.use(requireAuth)

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
