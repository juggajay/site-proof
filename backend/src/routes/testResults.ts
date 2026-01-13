import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middleware/authMiddleware.js'

export const testResultsRouter = Router()

// Apply authentication middleware to all test result routes
testResultsRouter.use(requireAuth)

// Roles that can create/edit test results
const TEST_CREATORS = ['owner', 'admin', 'project_manager', 'site_engineer', 'quality_manager', 'foreman']
// Roles that can verify test results
const TEST_VERIFIERS = ['owner', 'admin', 'project_manager', 'quality_manager']

// GET /api/test-results - List all test results for a project
testResultsRouter.get('/', async (req, res) => {
  try {
    const user = req.user!
    const { projectId, lotId } = req.query

    if (!projectId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'projectId query parameter is required'
      })
    }

    // Verify user has access to the project
    const projectAccess = await prisma.projectUser.findFirst({
      where: {
        projectId: projectId as string,
        userId: user.id,
        status: 'active',
      },
    })

    const projectCompanyAccess = await prisma.project.findFirst({
      where: {
        id: projectId as string,
        companyId: user.companyId || undefined,
      },
    })

    if (!projectAccess && !projectCompanyAccess) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this project'
      })
    }

    // Build where clause
    const whereClause: any = { projectId: projectId as string }

    // Filter by lot if provided
    if (lotId) {
      whereClause.lotId = lotId as string
    }

    const testResults = await prisma.testResult.findMany({
      where: whereClause,
      select: {
        id: true,
        testType: true,
        testRequestNumber: true,
        laboratoryName: true,
        laboratoryReportNumber: true,
        sampleDate: true,
        sampleLocation: true,
        testDate: true,
        resultDate: true,
        resultValue: true,
        resultUnit: true,
        specificationMin: true,
        specificationMax: true,
        passFail: true,
        status: true,
        lotId: true,
        lot: {
          select: {
            id: true,
            lotNumber: true,
          }
        },
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json({ testResults })
  } catch (error) {
    console.error('Get test results error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/test-results/:id - Get a single test result
testResultsRouter.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const user = req.user!

    const testResult = await prisma.testResult.findUnique({
      where: { id },
      include: {
        lot: {
          select: {
            id: true,
            lotNumber: true,
            description: true,
          }
        },
        enteredBy: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        verifiedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
      },
    })

    if (!testResult) {
      return res.status(404).json({ error: 'Test result not found' })
    }

    // Verify user has access to the project
    const projectAccess = await prisma.projectUser.findFirst({
      where: {
        projectId: testResult.projectId,
        userId: user.id,
        status: 'active',
      },
    })

    const projectCompanyAccess = await prisma.project.findFirst({
      where: {
        id: testResult.projectId,
        companyId: user.companyId || undefined,
      },
    })

    if (!projectAccess && !projectCompanyAccess) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this test result'
      })
    }

    res.json({ testResult })
  } catch (error) {
    console.error('Get test result error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/test-results - Create a new test result
testResultsRouter.post('/', async (req, res) => {
  try {
    const user = req.user!
    const {
      projectId,
      lotId,
      testType,
      testRequestNumber,
      laboratoryName,
      laboratoryReportNumber,
      sampleDate,
      sampleLocation,
      testDate,
      resultDate,
      resultValue,
      resultUnit,
      specificationMin,
      specificationMax,
      passFail,
    } = req.body

    if (!projectId || !testType) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'projectId and testType are required'
      })
    }

    // Verify user has access and permission
    const projectUser = await prisma.projectUser.findFirst({
      where: {
        projectId,
        userId: user.id,
        status: 'active',
      },
    })

    const userProjectRole = projectUser?.role || user.roleInCompany

    if (!TEST_CREATORS.includes(userProjectRole)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to create test results'
      })
    }

    // If lotId is provided, verify lot exists and belongs to project
    if (lotId) {
      const lot = await prisma.lot.findFirst({
        where: {
          id: lotId,
          projectId,
        },
      })

      if (!lot) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Lot not found or does not belong to this project'
        })
      }
    }

    const testResult = await prisma.testResult.create({
      data: {
        projectId,
        lotId: lotId || null,
        testType,
        testRequestNumber,
        laboratoryName,
        laboratoryReportNumber,
        sampleDate: sampleDate ? new Date(sampleDate) : null,
        sampleLocation,
        testDate: testDate ? new Date(testDate) : null,
        resultDate: resultDate ? new Date(resultDate) : null,
        resultValue: resultValue ? parseFloat(resultValue) : null,
        resultUnit,
        specificationMin: specificationMin ? parseFloat(specificationMin) : null,
        specificationMax: specificationMax ? parseFloat(specificationMax) : null,
        passFail: passFail || 'pending',
        status: 'entered',
        enteredById: user.id,
        enteredAt: new Date(),
      },
      select: {
        id: true,
        testType: true,
        testRequestNumber: true,
        lotId: true,
        lot: {
          select: {
            id: true,
            lotNumber: true,
          }
        },
        passFail: true,
        status: true,
        createdAt: true,
      },
    })

    res.status(201).json({ testResult })
  } catch (error) {
    console.error('Create test result error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PATCH /api/test-results/:id - Update a test result
testResultsRouter.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const user = req.user!

    const testResult = await prisma.testResult.findUnique({
      where: { id },
    })

    if (!testResult) {
      return res.status(404).json({ error: 'Test result not found' })
    }

    // Verify user has access and permission
    const projectUser = await prisma.projectUser.findFirst({
      where: {
        projectId: testResult.projectId,
        userId: user.id,
        status: 'active',
      },
    })

    const userProjectRole = projectUser?.role || user.roleInCompany

    if (!TEST_CREATORS.includes(userProjectRole)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to edit test results'
      })
    }

    const {
      lotId,
      testType,
      testRequestNumber,
      laboratoryName,
      laboratoryReportNumber,
      sampleDate,
      sampleLocation,
      testDate,
      resultDate,
      resultValue,
      resultUnit,
      specificationMin,
      specificationMax,
      passFail,
    } = req.body

    // Build update data
    const updateData: any = {}
    if (lotId !== undefined) updateData.lotId = lotId || null
    if (testType !== undefined) updateData.testType = testType
    if (testRequestNumber !== undefined) updateData.testRequestNumber = testRequestNumber
    if (laboratoryName !== undefined) updateData.laboratoryName = laboratoryName
    if (laboratoryReportNumber !== undefined) updateData.laboratoryReportNumber = laboratoryReportNumber
    if (sampleDate !== undefined) updateData.sampleDate = sampleDate ? new Date(sampleDate) : null
    if (sampleLocation !== undefined) updateData.sampleLocation = sampleLocation
    if (testDate !== undefined) updateData.testDate = testDate ? new Date(testDate) : null
    if (resultDate !== undefined) updateData.resultDate = resultDate ? new Date(resultDate) : null
    if (resultValue !== undefined) updateData.resultValue = resultValue ? parseFloat(resultValue) : null
    if (resultUnit !== undefined) updateData.resultUnit = resultUnit
    if (specificationMin !== undefined) updateData.specificationMin = specificationMin ? parseFloat(specificationMin) : null
    if (specificationMax !== undefined) updateData.specificationMax = specificationMax ? parseFloat(specificationMax) : null
    if (passFail !== undefined) updateData.passFail = passFail

    const updatedTestResult = await prisma.testResult.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        testType: true,
        testRequestNumber: true,
        lotId: true,
        lot: {
          select: {
            id: true,
            lotNumber: true,
          }
        },
        passFail: true,
        status: true,
        updatedAt: true,
      },
    })

    res.json({ testResult: updatedTestResult })
  } catch (error) {
    console.error('Update test result error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /api/test-results/:id - Delete a test result
testResultsRouter.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const user = req.user!

    const testResult = await prisma.testResult.findUnique({
      where: { id },
    })

    if (!testResult) {
      return res.status(404).json({ error: 'Test result not found' })
    }

    // Verify user has access and permission (only higher roles can delete)
    const projectUser = await prisma.projectUser.findFirst({
      where: {
        projectId: testResult.projectId,
        userId: user.id,
        status: 'active',
      },
    })

    const userProjectRole = projectUser?.role || user.roleInCompany

    if (!['owner', 'admin', 'project_manager', 'quality_manager'].includes(userProjectRole)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to delete test results'
      })
    }

    await prisma.testResult.delete({
      where: { id },
    })

    res.json({ message: 'Test result deleted successfully' })
  } catch (error) {
    console.error('Delete test result error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/test-results/:id/verify - Verify a test result (quality management)
testResultsRouter.post('/:id/verify', async (req, res) => {
  try {
    const { id } = req.params
    const user = req.user!

    const testResult = await prisma.testResult.findUnique({
      where: { id },
    })

    if (!testResult) {
      return res.status(404).json({ error: 'Test result not found' })
    }

    // Verify user has permission to verify
    const projectUser = await prisma.projectUser.findFirst({
      where: {
        projectId: testResult.projectId,
        userId: user.id,
        status: 'active',
      },
    })

    const userProjectRole = projectUser?.role || user.roleInCompany

    if (!TEST_VERIFIERS.includes(userProjectRole)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to verify test results'
      })
    }

    const updatedTestResult = await prisma.testResult.update({
      where: { id },
      data: {
        status: 'verified',
        verifiedById: user.id,
        verifiedAt: new Date(),
      },
      select: {
        id: true,
        testType: true,
        status: true,
        verifiedAt: true,
        verifiedBy: {
          select: {
            name: true,
            email: true,
          }
        },
      },
    })

    res.json({
      message: 'Test result verified successfully',
      testResult: updatedTestResult
    })
  } catch (error) {
    console.error('Verify test result error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})
