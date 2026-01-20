import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../middleware/authMiddleware.js'
import { sendNotificationIfEnabled } from './notifications.js'

export const testResultsRouter = Router()

// Configure multer for file uploads
const uploadsDir = path.join(process.cwd(), 'uploads', 'certificates')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, `cert-${uniqueSuffix}${path.extname(file.originalname)}`)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Accept only PDFs and images
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Only PDF and image files are allowed'))
    }
  }
})

// Test type specifications lookup table
// Based on Australian road standards (TMR MRTS, RMS QA specs, etc.)
const testTypeSpecifications: Record<string, {
  name: string
  description: string
  specificationMin: number | null
  specificationMax: number | null
  unit: string
  specReference: string
}> = {
  'compaction': {
    name: 'Compaction Test',
    description: 'Relative compaction as percentage of maximum dry density',
    specificationMin: 95,
    specificationMax: 100,
    unit: '% MDD',
    specReference: 'TMR MRTS04 / AS 1289.5.4.1'
  },
  'cbr': {
    name: 'California Bearing Ratio (CBR)',
    description: 'Soil strength test for pavement design',
    specificationMin: 15,
    specificationMax: null,
    unit: '%',
    specReference: 'TMR MRTS05 / AS 1289.6.1.1'
  },
  'moisture_content': {
    name: 'Moisture Content',
    description: 'Soil moisture as percentage of dry weight',
    specificationMin: null,
    specificationMax: null,
    unit: '%',
    specReference: 'AS 1289.2.1.1'
  },
  'plasticity_index': {
    name: 'Plasticity Index (PI)',
    description: 'Difference between liquid and plastic limits',
    specificationMin: null,
    specificationMax: 25,
    unit: '%',
    specReference: 'TMR MRTS05 / AS 1289.3.3.1'
  },
  'liquid_limit': {
    name: 'Liquid Limit (LL)',
    description: 'Water content at which soil behaves as liquid',
    specificationMin: null,
    specificationMax: 45,
    unit: '%',
    specReference: 'AS 1289.3.1.1'
  },
  'grading': {
    name: 'Particle Size Distribution',
    description: 'Grading envelope compliance',
    specificationMin: null,
    specificationMax: null,
    unit: 'envelope',
    specReference: 'TMR MRTS05 / AS 1289.3.6.1'
  },
  'sand_equivalent': {
    name: 'Sand Equivalent',
    description: 'Cleanliness of fine aggregate',
    specificationMin: 30,
    specificationMax: null,
    unit: '%',
    specReference: 'TMR MRTS30 / Q203'
  },
  'concrete_slump': {
    name: 'Concrete Slump',
    description: 'Workability measurement for concrete',
    specificationMin: 50,
    specificationMax: 120,
    unit: 'mm',
    specReference: 'AS 1012.3.1'
  },
  'concrete_strength': {
    name: 'Concrete Compressive Strength',
    description: '28-day compressive strength',
    specificationMin: 32,
    specificationMax: null,
    unit: 'MPa',
    specReference: 'AS 1012.9'
  },
  'asphalt_density': {
    name: 'Asphalt Density',
    description: 'Field density as percentage of Marshall density',
    specificationMin: 93,
    specificationMax: 100,
    unit: '%',
    specReference: 'TMR MRTS30 / AS 2891.9.1'
  },
  'asphalt_thickness': {
    name: 'Asphalt Layer Thickness',
    description: 'Pavement layer thickness compliance',
    specificationMin: null,
    specificationMax: null,
    unit: 'mm',
    specReference: 'TMR MRTS30'
  },
  'dcp': {
    name: 'Dynamic Cone Penetrometer (DCP)',
    description: 'In-situ bearing capacity indicator',
    specificationMin: null,
    specificationMax: 10,
    unit: 'mm/blow',
    specReference: 'AS 1289.6.3.2'
  },
  'permeability': {
    name: 'Permeability Test',
    description: 'Hydraulic conductivity of soil',
    specificationMin: null,
    specificationMax: null,
    unit: 'm/s',
    specReference: 'AS 1289.6.7.1'
  }
}

// Apply authentication middleware to all test result routes
testResultsRouter.use(requireAuth)

// Roles that can create/edit test results
const TEST_CREATORS = ['owner', 'admin', 'project_manager', 'site_engineer', 'quality_manager', 'foreman']
// Roles that can verify test results
const TEST_VERIFIERS = ['owner', 'admin', 'project_manager', 'quality_manager']

// GET /api/test-results/specifications - Get all test type specifications
testResultsRouter.get('/specifications', async (req, res) => {
  try {
    res.json({
      specifications: Object.entries(testTypeSpecifications).map(([key, spec]) => ({
        testType: key,
        ...spec
      }))
    })
  } catch (error) {
    console.error('Get test specifications error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/test-results/specifications/:testType - Get specification for a specific test type
testResultsRouter.get('/specifications/:testType', async (req, res) => {
  try {
    const { testType } = req.params

    // Normalize test type key (lowercase, replace spaces with underscore)
    const normalizedType = testType.toLowerCase().replace(/\s+/g, '_')

    const spec = testTypeSpecifications[normalizedType]

    if (!spec) {
      // Try to find a partial match
      const partialMatch = Object.entries(testTypeSpecifications).find(([key, value]) =>
        key.includes(normalizedType) ||
        value.name.toLowerCase().includes(testType.toLowerCase())
      )

      if (partialMatch) {
        return res.json({
          testType: partialMatch[0],
          ...partialMatch[1]
        })
      }

      return res.status(404).json({
        error: 'Specification not found',
        message: `No specification found for test type: ${testType}`,
        availableTypes: Object.keys(testTypeSpecifications)
      })
    }

    res.json({
      testType: normalizedType,
      ...spec
    })
  } catch (error) {
    console.error('Get test specification error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

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
        aiExtracted: true,  // Feature #200
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
            fullName: true,
            email: true,
          }
        },
        verifiedBy: {
          select: {
            id: true,
            fullName: true,
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
        status: 'requested', // Feature #196: Start in 'requested' status
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

// GET /api/test-results/:id/request-form - Generate printable test request form for lab
testResultsRouter.get('/:id/request-form', async (req, res) => {
  try {
    const { id } = req.params
    const user = req.user!

    const testResult = await prisma.testResult.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            projectNumber: true,
            clientName: true,
            company: {
              select: {
                name: true,
                abn: true,
                address: true,
                logoUrl: true,
              }
            }
          }
        },
        lot: {
          select: {
            id: true,
            lotNumber: true,
            description: true,
            chainageStart: true,
            chainageEnd: true,
            layer: true,
            activityType: true,
          }
        },
        enteredBy: {
          select: {
            fullName: true,
            email: true,
            phone: true,
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

    // Format dates for display
    const formatDate = (date: Date | null) => {
      if (!date) return 'N/A'
      return new Date(date).toLocaleDateString('en-AU', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    }

    // Generate HTML for printable form
    const formHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Request Form - ${testResult.testRequestNumber || 'N/A'}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: Arial, sans-serif;
            font-size: 12px;
            line-height: 1.4;
            padding: 20px;
            max-width: 800px;
            margin: 0 auto;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #333;
        }
        .company-info { flex: 1; }
        .company-name { font-size: 18px; font-weight: bold; color: #333; }
        .form-title { text-align: right; }
        .form-title h1 { font-size: 20px; color: #333; }
        .form-title p { font-size: 14px; color: #666; }

        .section {
            margin-bottom: 15px;
            border: 1px solid #ccc;
            padding: 10px;
        }
        .section-title {
            font-weight: bold;
            font-size: 14px;
            margin-bottom: 10px;
            padding-bottom: 5px;
            border-bottom: 1px solid #ddd;
            background: #f5f5f5;
            margin: -10px -10px 10px -10px;
            padding: 8px 10px;
        }
        .row {
            display: flex;
            margin-bottom: 8px;
        }
        .field {
            flex: 1;
            padding-right: 15px;
        }
        .field label {
            font-weight: bold;
            display: block;
            font-size: 10px;
            color: #666;
            text-transform: uppercase;
        }
        .field .value {
            border-bottom: 1px solid #999;
            min-height: 18px;
            padding: 2px 0;
        }

        .specifications {
            background: #f9f9f9;
        }

        .footer {
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid #ccc;
        }
        .signature-row {
            display: flex;
            justify-content: space-between;
            margin-top: 40px;
        }
        .signature-block {
            width: 45%;
        }
        .signature-line {
            border-bottom: 1px solid #333;
            height: 30px;
            margin-bottom: 5px;
        }
        .signature-label {
            font-size: 10px;
            color: #666;
        }

        .notes {
            min-height: 60px;
            border: 1px solid #ccc;
            padding: 8px;
            margin-top: 5px;
        }

        @media print {
            body { padding: 10px; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="no-print" style="margin-bottom: 15px; padding: 10px; background: #e3f2fd; border-radius: 4px;">
        <button onclick="window.print()" style="padding: 8px 16px; cursor: pointer;">Print Form</button>
        <span style="margin-left: 10px; color: #666;">Press Ctrl+P to print or save as PDF</span>
    </div>

    <div class="header">
        <div class="company-info">
            <div class="company-name">${testResult.project.company?.name || 'Company'}</div>
            ${testResult.project.company?.abn ? `<div>ABN: ${testResult.project.company.abn}</div>` : ''}
            ${testResult.project.company?.address ? `<div>${testResult.project.company.address}</div>` : ''}
        </div>
        <div class="form-title">
            <h1>TEST REQUEST FORM</h1>
            <p>Form No: ${testResult.testRequestNumber || 'TRF-' + testResult.id.substring(0, 8).toUpperCase()}</p>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Project Information</div>
        <div class="row">
            <div class="field" style="flex: 2;">
                <label>Project Name</label>
                <div class="value">${testResult.project.name}</div>
            </div>
            <div class="field">
                <label>Project Number</label>
                <div class="value">${testResult.project.projectNumber}</div>
            </div>
        </div>
        <div class="row">
            <div class="field">
                <label>Client</label>
                <div class="value">${testResult.project.clientName || 'N/A'}</div>
            </div>
            <div class="field">
                <label>Request Date</label>
                <div class="value">${formatDate(testResult.createdAt)}</div>
            </div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Sample Location</div>
        <div class="row">
            <div class="field">
                <label>Lot Number</label>
                <div class="value">${testResult.lot?.lotNumber || 'N/A'}</div>
            </div>
            <div class="field">
                <label>Activity Type</label>
                <div class="value">${testResult.lot?.activityType || 'N/A'}</div>
            </div>
        </div>
        <div class="row">
            <div class="field" style="flex: 2;">
                <label>Lot Description</label>
                <div class="value">${testResult.lot?.description || 'N/A'}</div>
            </div>
            <div class="field">
                <label>Layer</label>
                <div class="value">${testResult.lot?.layer || 'N/A'}</div>
            </div>
        </div>
        <div class="row">
            <div class="field">
                <label>Chainage Start</label>
                <div class="value">${testResult.lot?.chainageStart || 'N/A'}</div>
            </div>
            <div class="field">
                <label>Chainage End</label>
                <div class="value">${testResult.lot?.chainageEnd || 'N/A'}</div>
            </div>
            <div class="field">
                <label>Sample Location Detail</label>
                <div class="value">${testResult.sampleLocation || 'N/A'}</div>
            </div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Test Details</div>
        <div class="row">
            <div class="field" style="flex: 2;">
                <label>Test Type</label>
                <div class="value">${testResult.testType}</div>
            </div>
            <div class="field">
                <label>Sample Date</label>
                <div class="value">${formatDate(testResult.sampleDate)}</div>
            </div>
        </div>
        <div class="row">
            <div class="field">
                <label>Laboratory</label>
                <div class="value">${testResult.laboratoryName || '(To be assigned)'}</div>
            </div>
            <div class="field">
                <label>Priority</label>
                <div class="value">Standard</div>
            </div>
        </div>
    </div>

    <div class="section specifications">
        <div class="section-title">Specification Requirements</div>
        <div class="row">
            <div class="field">
                <label>Specification Min</label>
                <div class="value">${testResult.specificationMin ? testResult.specificationMin + ' ' + (testResult.resultUnit || '') : 'N/A'}</div>
            </div>
            <div class="field">
                <label>Specification Max</label>
                <div class="value">${testResult.specificationMax ? testResult.specificationMax + ' ' + (testResult.resultUnit || '') : 'N/A'}</div>
            </div>
            <div class="field">
                <label>Unit of Measurement</label>
                <div class="value">${testResult.resultUnit || 'N/A'}</div>
            </div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Notes / Special Instructions</div>
        <div class="notes"></div>
    </div>

    <div class="footer">
        <div class="row">
            <div class="field">
                <label>Requested By</label>
                <div class="value">${testResult.enteredBy?.fullName || 'N/A'}</div>
            </div>
            <div class="field">
                <label>Contact Email</label>
                <div class="value">${testResult.enteredBy?.email || 'N/A'}</div>
            </div>
            <div class="field">
                <label>Contact Phone</label>
                <div class="value">${testResult.enteredBy?.phone || 'N/A'}</div>
            </div>
        </div>

        <div class="signature-row">
            <div class="signature-block">
                <div class="signature-line"></div>
                <div class="signature-label">Contractor Signature / Date</div>
            </div>
            <div class="signature-block">
                <div class="signature-line"></div>
                <div class="signature-label">Laboratory Receipt / Date</div>
            </div>
        </div>
    </div>

    <div style="margin-top: 20px; text-align: center; font-size: 10px; color: #999;">
        Generated by SiteProof | ${new Date().toLocaleString('en-AU')}
    </div>
</body>
</html>
`

    // Return the HTML form or JSON metadata
    const format = req.query.format || 'html'

    if (format === 'json') {
      // Return JSON metadata for the request form
      res.json({
        testRequestForm: {
          requestNumber: testResult.testRequestNumber || 'TRF-' + testResult.id.substring(0, 8).toUpperCase(),
          project: {
            name: testResult.project.name,
            number: testResult.project.projectNumber,
            client: testResult.project.clientName,
            company: testResult.project.company?.name
          },
          lot: testResult.lot ? {
            number: testResult.lot.lotNumber,
            description: testResult.lot.description,
            activityType: testResult.lot.activityType,
            chainageStart: testResult.lot.chainageStart,
            chainageEnd: testResult.lot.chainageEnd,
            layer: testResult.lot.layer
          } : null,
          testDetails: {
            type: testResult.testType,
            laboratory: testResult.laboratoryName,
            sampleDate: testResult.sampleDate,
            sampleLocation: testResult.sampleLocation
          },
          specifications: {
            min: testResult.specificationMin,
            max: testResult.specificationMax,
            unit: testResult.resultUnit
          },
          requestedBy: testResult.enteredBy,
          createdAt: testResult.createdAt
        }
      })
    } else {
      // Return HTML for printing
      res.setHeader('Content-Type', 'text/html')
      res.send(formHtml)
    }
  } catch (error) {
    console.error('Generate test request form error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/test-results/:id/verification-view - Get side-by-side verification view data
testResultsRouter.get('/:id/verification-view', async (req, res) => {
  try {
    const { id } = req.params
    const user = req.user!

    const testResult = await prisma.testResult.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            projectNumber: true,
            specificationSet: true,
          }
        },
        lot: {
          select: {
            id: true,
            lotNumber: true,
            description: true,
            activityType: true,
            chainageStart: true,
            chainageEnd: true,
            layer: true,
          }
        },
        enteredBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          }
        },
        verifiedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          }
        },
        certificateDoc: {
          select: {
            id: true,
            filename: true,
            fileUrl: true,
            mimeType: true,
            uploadedAt: true,
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

    // Determine if result passes or fails specification
    let specificationStatus = 'unknown'
    if (testResult.resultValue !== null) {
      const value = Number(testResult.resultValue)
      const min = testResult.specificationMin !== null ? Number(testResult.specificationMin) : null
      const max = testResult.specificationMax !== null ? Number(testResult.specificationMax) : null

      if (min !== null && max !== null) {
        specificationStatus = value >= min && value <= max ? 'pass' : 'fail'
      } else if (min !== null) {
        specificationStatus = value >= min ? 'pass' : 'fail'
      } else if (max !== null) {
        specificationStatus = value <= max ? 'pass' : 'fail'
      }
    }

    // Get specification reference for this test type if available
    const normalizedType = testResult.testType.toLowerCase().replace(/\s+/g, '_')
    const standardSpec = testTypeSpecifications[normalizedType]

    // Format the response for side-by-side view
    res.json({
      verificationView: {
        // Left side: Document/Certificate info
        document: testResult.certificateDoc ? {
          id: testResult.certificateDoc.id,
          filename: testResult.certificateDoc.filename,
          fileUrl: testResult.certificateDoc.fileUrl,
          mimeType: testResult.certificateDoc.mimeType,
          uploadedAt: testResult.certificateDoc.uploadedAt,
          isPdf: testResult.certificateDoc.mimeType === 'application/pdf',
        } : null,

        // Right side: Extracted/Entered data
        extractedData: {
          testType: testResult.testType,
          testRequestNumber: testResult.testRequestNumber,
          laboratoryName: testResult.laboratoryName,
          laboratoryReportNumber: testResult.laboratoryReportNumber,
          sampleDate: testResult.sampleDate,
          sampleLocation: testResult.sampleLocation,
          testDate: testResult.testDate,
          resultDate: testResult.resultDate,
          resultValue: testResult.resultValue,
          resultUnit: testResult.resultUnit,
          aiExtracted: testResult.aiExtracted,
          aiConfidence: testResult.aiConfidence ? JSON.parse(testResult.aiConfidence as string) : null,
        },

        // Confidence highlighting for AI-extracted fields
        confidenceHighlights: (() => {
          if (!testResult.aiExtracted || !testResult.aiConfidence) {
            return { hasLowConfidence: false, lowConfidenceFields: [], fieldStatus: {} }
          }

          const confidence = JSON.parse(testResult.aiConfidence as string)
          const LOW_CONFIDENCE_THRESHOLD = 0.80 // Fields below 80% get highlighted
          const MEDIUM_CONFIDENCE_THRESHOLD = 0.90 // Fields below 90% get warning

          const fieldStatus: Record<string, { confidence: number; status: 'high' | 'medium' | 'low'; needsReview: boolean }> = {}
          const lowConfidenceFields: string[] = []

          for (const [field, conf] of Object.entries(confidence)) {
            const confValue = conf as number
            let status: 'high' | 'medium' | 'low' = 'high'
            let needsReview = false

            if (confValue < LOW_CONFIDENCE_THRESHOLD) {
              status = 'low'
              needsReview = true
              lowConfidenceFields.push(field)
            } else if (confValue < MEDIUM_CONFIDENCE_THRESHOLD) {
              status = 'medium'
              needsReview = false
            }

            fieldStatus[field] = { confidence: confValue, status, needsReview }
          }

          return {
            hasLowConfidence: lowConfidenceFields.length > 0,
            lowConfidenceFields,
            fieldStatus,
            thresholds: {
              low: LOW_CONFIDENCE_THRESHOLD,
              medium: MEDIUM_CONFIDENCE_THRESHOLD
            },
            reviewMessage: lowConfidenceFields.length > 0
              ? `${lowConfidenceFields.length} field(s) have low AI confidence and require manual verification: ${lowConfidenceFields.join(', ')}`
              : 'All AI-extracted fields have acceptable confidence levels'
          }
        })(),

        // Specification comparison
        specification: {
          min: testResult.specificationMin,
          max: testResult.specificationMax,
          unit: testResult.resultUnit,
          currentStatus: testResult.passFail,
          calculatedStatus: specificationStatus,
          standardReference: standardSpec?.specReference || null,
        },

        // Metadata
        metadata: {
          id: testResult.id,
          status: testResult.status,
          project: testResult.project,
          lot: testResult.lot,
          enteredBy: testResult.enteredBy,
          enteredAt: testResult.enteredAt,
          verifiedBy: testResult.verifiedBy,
          verifiedAt: testResult.verifiedAt,
          createdAt: testResult.createdAt,
          updatedAt: testResult.updatedAt,
        },

        // User permissions
        canVerify: TEST_VERIFIERS.includes(projectAccess?.role || user.roleInCompany),
        needsVerification: testResult.status !== 'verified',
      }
    })
  } catch (error) {
    console.error('Get verification view error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/test-results/:id/reject - Reject a test result verification (Feature #204)
testResultsRouter.post('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params
    const user = req.user!
    const { reason } = req.body

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Rejection reason is required'
      })
    }

    const testResult = await prisma.testResult.findUnique({
      where: { id },
      include: {
        enteredBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          }
        }
      }
    })

    if (!testResult) {
      return res.status(404).json({ error: 'Test result not found' })
    }

    // Verify user has permission to reject (same as verify)
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
        message: 'You do not have permission to reject test results'
      })
    }

    // Can only reject tests that are in 'entered' status (pending verification)
    if (testResult.status !== 'entered') {
      return res.status(400).json({
        error: 'Invalid Status',
        message: `Cannot reject a test result with status '${testResult.status}'. Only tests in 'Entered' status can be rejected.`
      })
    }

    // Reset status back to 'results_received' so engineer can re-enter
    const updatedTestResult = await prisma.testResult.update({
      where: { id },
      data: {
        status: 'results_received',
        rejectedById: user.id,
        rejectedAt: new Date(),
        rejectionReason: reason.trim(),
        // Clear verification fields
        verifiedById: null,
        verifiedAt: null,
        // Clear entered fields so engineer can re-enter
        enteredById: null,
        enteredAt: null,
      },
      select: {
        id: true,
        testType: true,
        status: true,
        rejectedAt: true,
        rejectionReason: true,
        rejectedBy: {
          select: {
            fullName: true,
            email: true,
          }
        },
        enteredBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          }
        },
      },
    })

    // In a real app, we would send a notification to the engineer here
    // For now, we'll just include the engineer info in the response
    const engineerNotified = testResult.enteredBy ? {
      userId: testResult.enteredBy.id,
      name: testResult.enteredBy.fullName,
      email: testResult.enteredBy.email,
      message: `Your test result "${testResult.testType}" was rejected. Reason: ${reason.trim()}`
    } : null

    res.json({
      message: 'Test result rejected',
      testResult: updatedTestResult,
      notification: {
        sent: engineerNotified !== null,
        recipient: engineerNotified
      }
    })
  } catch (error) {
    console.error('Reject test result error:', error)
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

    // Feature #883: Require certificate before verification
    if (!testResult.certificateDocId) {
      return res.status(400).json({
        error: 'Certificate required',
        message: 'A test certificate must be uploaded before the test result can be verified.',
        code: 'CERTIFICATE_REQUIRED'
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
            fullName: true,
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

// Valid status workflow transitions (Feature #196)
// requested -> at_lab -> results_received -> entered -> verified
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  'requested': ['at_lab'],
  'at_lab': ['results_received'],
  'results_received': ['entered'],
  'entered': ['verified'],
  'verified': [], // Terminal state
}

// Status labels for display
const STATUS_LABELS: Record<string, string> = {
  'requested': 'Requested',
  'at_lab': 'At Lab',
  'results_received': 'Results Received',
  'entered': 'Entered',
  'verified': 'Verified',
}

// POST /api/test-results/:id/status - Update test result status (Feature #196)
testResultsRouter.post('/:id/status', async (req, res) => {
  try {
    const { id } = req.params
    const user = req.user!
    const { status } = req.body

    if (!status) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'status is required'
      })
    }

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

    // Verification requires higher permission
    if (status === 'verified' && !TEST_VERIFIERS.includes(userProjectRole)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to verify test results'
      })
    }

    // Other status changes require creator permission
    if (status !== 'verified' && !TEST_CREATORS.includes(userProjectRole)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to update test result status'
      })
    }

    // Validate the status transition
    const currentStatus = testResult.status
    const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus] || []

    if (!allowedTransitions.includes(status)) {
      return res.status(400).json({
        error: 'Invalid Status Transition',
        message: `Cannot transition from '${STATUS_LABELS[currentStatus] || currentStatus}' to '${STATUS_LABELS[status] || status}'`,
        currentStatus: currentStatus,
        allowedTransitions: allowedTransitions.map(s => ({ status: s, label: STATUS_LABELS[s] || s }))
      })
    }

    // Feature #883: Require certificate before verification
    if (status === 'verified' && !testResult.certificateDocId) {
      return res.status(400).json({
        error: 'Certificate required',
        message: 'A test certificate must be uploaded before the test result can be verified.',
        code: 'CERTIFICATE_REQUIRED'
      })
    }

    // Build update data based on the new status
    const updateData: any = { status }

    // If entering 'entered' status, record who entered and when
    if (status === 'entered') {
      updateData.enteredById = user.id
      updateData.enteredAt = new Date()
    }

    // If entering 'verified' status, record who verified and when
    if (status === 'verified') {
      updateData.verifiedById = user.id
      updateData.verifiedAt = new Date()
    }

    const updatedTestResult = await prisma.testResult.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        testType: true,
        status: true,
        enteredAt: true,
        verifiedAt: true,
        enteredBy: {
          select: {
            fullName: true,
            email: true,
          }
        },
        verifiedBy: {
          select: {
            fullName: true,
            email: true,
          }
        },
      },
    })

    // Feature #933 - Notify engineers when test results are received (pending verification)
    if (status === 'results_received' && currentStatus !== 'results_received') {
      try {
        // Get project info
        const project = await prisma.project.findUnique({
          where: { id: testResult.projectId },
          select: { id: true, name: true }
        })

        // Get site engineers with active or accepted status
        const siteEngineers = await prisma.projectUser.findMany({
          where: {
            projectId: testResult.projectId,
            role: 'site_engineer',
            status: { in: ['active', 'accepted'] }
          }
        })

        // Get user details for engineers
        const engineerUserIds = siteEngineers.map(se => se.userId)
        const engineerUsers = engineerUserIds.length > 0
          ? await prisma.user.findMany({
              where: { id: { in: engineerUserIds } },
              select: { id: true, email: true, fullName: true }
            })
          : []

        // Get laboratory name for more context
        const testWithLab = await prisma.testResult.findUnique({
          where: { id },
          select: { laboratoryName: true, testRequestNumber: true }
        })
        const labName = testWithLab?.laboratoryName || 'laboratory'
        const requestNum = testWithLab?.testRequestNumber || id.substring(0, 8).toUpperCase()

        // Create in-app notifications for site engineers
        const notificationsToCreate = engineerUsers.map(eng => ({
          userId: eng.id,
          projectId: testResult.projectId,
          type: 'test_result_received',
          title: 'Test Result Received',
          message: `Test result for ${testResult.testType} (${requestNum}) has been received from ${labName}. Pending verification.`,
          linkUrl: `/projects/${testResult.projectId}/test-results`
        }))

        if (notificationsToCreate.length > 0) {
          await prisma.notification.createMany({
            data: notificationsToCreate
          })
        }

        // Send email notifications
        for (const eng of engineerUsers) {
          await sendNotificationIfEnabled(
            eng.id,
            testResult.projectId,
            'test_result_received',
            'Test Result Received',
            `Test result for ${testResult.testType} (${requestNum}) from ${labName} is pending verification.`,
            eng.email
          )
        }

        console.log(`[Test Result Received] Notification sent for test ${id}`)
        console.log(`  Test Type: ${testResult.testType}`)
        console.log(`  Project: ${project?.name || testResult.projectId}`)
        console.log(`  Notified Engineers: ${engineerUsers.map(e => e.email).join(', ') || 'None'}`)
      } catch (notifError) {
        console.error('[Test Result Received] Failed to send notifications:', notifError)
        // Don't fail the main request if notifications fail
      }
    }

    res.json({
      message: `Test result status updated to '${STATUS_LABELS[status] || status}'`,
      testResult: updatedTestResult,
      nextTransitions: (VALID_STATUS_TRANSITIONS[status] || []).map(s => ({
        status: s,
        label: STATUS_LABELS[s] || s
      }))
    })
  } catch (error) {
    console.error('Update test result status error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/test-results/:id/workflow - Get workflow status info (Feature #196)
testResultsRouter.get('/:id/workflow', async (req, res) => {
  try {
    const { id } = req.params
    const user = req.user!

    const testResult = await prisma.testResult.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        projectId: true,
        enteredAt: true,
        verifiedAt: true,
        createdAt: true,
        enteredBy: {
          select: { fullName: true }
        },
        verifiedBy: {
          select: { fullName: true }
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

    const userProjectRole = projectAccess?.role || user.roleInCompany

    // Build workflow steps with status
    const workflowSteps = [
      {
        status: 'requested',
        label: 'Requested',
        completed: true, // Always completed (initial state)
        completedAt: testResult.createdAt,
        completedBy: null,
      },
      {
        status: 'at_lab',
        label: 'At Lab',
        completed: ['at_lab', 'results_received', 'entered', 'verified'].includes(testResult.status),
        completedAt: null,
        completedBy: null,
      },
      {
        status: 'results_received',
        label: 'Results Received',
        completed: ['results_received', 'entered', 'verified'].includes(testResult.status),
        completedAt: null,
        completedBy: null,
      },
      {
        status: 'entered',
        label: 'Entered',
        completed: ['entered', 'verified'].includes(testResult.status),
        completedAt: testResult.enteredAt,
        completedBy: testResult.enteredBy?.fullName || null,
      },
      {
        status: 'verified',
        label: 'Verified',
        completed: testResult.status === 'verified',
        completedAt: testResult.verifiedAt,
        completedBy: testResult.verifiedBy?.fullName || null,
      },
    ]

    res.json({
      workflow: {
        currentStatus: testResult.status,
        currentStatusLabel: STATUS_LABELS[testResult.status] || testResult.status,
        steps: workflowSteps,
        nextTransitions: (VALID_STATUS_TRANSITIONS[testResult.status] || []).map(s => ({
          status: s,
          label: STATUS_LABELS[s] || s,
          canPerform: s === 'verified' ? TEST_VERIFIERS.includes(userProjectRole) : TEST_CREATORS.includes(userProjectRole)
        })),
        canAdvance: (VALID_STATUS_TRANSITIONS[testResult.status] || []).length > 0,
        isComplete: testResult.status === 'verified',
      }
    })
  } catch (error) {
    console.error('Get workflow status error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ============================================================================
// Feature #200: AI Test Certificate Extraction
// ============================================================================

// Simulated AI extraction - extracts field values from PDF content
// In production, this would call an actual AI/ML service
const simulateAIExtraction = (filename: string) => {
  // Simulate extracted data based on common test certificate patterns
  // Generate realistic looking data with varying confidence levels
  const testTypes = ['Compaction Test', 'CBR Test', 'Grading Analysis', 'Moisture Content', 'Plasticity Index']
  const labs = ['ABC Testing Labs', 'National Geotechnical', 'Southern Materials Testing', 'Boral Testing Services']

  const randomConfidence = (min: number, max: number) => +(Math.random() * (max - min) + min).toFixed(2)

  // Generate extracted values with confidence scores
  const extractedData = {
    testType: {
      value: testTypes[Math.floor(Math.random() * testTypes.length)],
      confidence: randomConfidence(0.85, 0.98)
    },
    laboratoryName: {
      value: labs[Math.floor(Math.random() * labs.length)],
      confidence: randomConfidence(0.90, 0.99)
    },
    laboratoryReportNumber: {
      value: `LAB-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`,
      confidence: randomConfidence(0.88, 0.96)
    },
    sampleDate: {
      value: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      confidence: randomConfidence(0.75, 0.92)
    },
    testDate: {
      value: new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      confidence: randomConfidence(0.78, 0.95)
    },
    resultValue: {
      value: String((Math.random() * 10 + 93).toFixed(1)),  // 93-103 range
      confidence: randomConfidence(0.82, 0.97)
    },
    resultUnit: {
      value: '% MDD',
      confidence: randomConfidence(0.85, 0.99)
    },
    specificationMin: {
      value: '95',
      confidence: randomConfidence(0.70, 0.88)  // Often harder to extract
    },
    specificationMax: {
      value: '100',
      confidence: randomConfidence(0.68, 0.85)  // Often harder to extract
    },
    sampleLocation: {
      value: `CH ${Math.floor(Math.random() * 5000)}+${String(Math.floor(Math.random() * 100)).padStart(2, '0')}`,
      confidence: randomConfidence(0.60, 0.80)  // Handwritten/variable format
    },
  }

  return extractedData
}

// POST /api/test-results/upload-certificate - Upload a test certificate PDF for AI extraction
testResultsRouter.post('/upload-certificate', upload.single('certificate'), async (req, res) => {
  try {
    const user = req.user!
    const file = req.file
    const { projectId } = req.body

    if (!file) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'No file uploaded'
      })
    }

    if (!projectId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'projectId is required'
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
      // Delete uploaded file if permission denied
      fs.unlinkSync(file.path)
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to upload test certificates'
      })
    }

    // Create document record for the certificate
    const document = await prisma.document.create({
      data: {
        projectId,
        documentType: 'test_certificate',
        category: 'test_results',
        filename: file.originalname,
        fileUrl: `/uploads/certificates/${file.filename}`,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedById: user.id,
      }
    })

    // Simulate AI extraction (immediate for demo, would be async in production)
    const extractedData = simulateAIExtraction(file.originalname)

    // Build confidence object for storage
    const confidenceObj: Record<string, number> = {}
    for (const [key, data] of Object.entries(extractedData)) {
      confidenceObj[key] = data.confidence
    }

    // Create a new test result with extracted data
    const testResult = await prisma.testResult.create({
      data: {
        projectId,
        testType: extractedData.testType.value,
        laboratoryName: extractedData.laboratoryName.value,
        laboratoryReportNumber: extractedData.laboratoryReportNumber.value,
        sampleDate: new Date(extractedData.sampleDate.value),
        testDate: new Date(extractedData.testDate.value),
        sampleLocation: extractedData.sampleLocation.value,
        resultValue: parseFloat(extractedData.resultValue.value),
        resultUnit: extractedData.resultUnit.value,
        specificationMin: parseFloat(extractedData.specificationMin.value),
        specificationMax: parseFloat(extractedData.specificationMax.value),
        passFail: parseFloat(extractedData.resultValue.value) >= 95 ? 'pass' : 'fail',
        certificateDocId: document.id,
        aiExtracted: true,
        aiConfidence: JSON.stringify(confidenceObj),
        status: 'results_received',  // Skip to results_received since we have the cert
      },
      include: {
        certificateDoc: {
          select: {
            id: true,
            filename: true,
            fileUrl: true,
            mimeType: true,
          }
        }
      }
    })

    // Identify low confidence fields that need review
    const lowConfidenceThreshold = 0.80
    const lowConfidenceFields = Object.entries(confidenceObj)
      .filter(([_, conf]) => conf < lowConfidenceThreshold)
      .map(([field, conf]) => ({ field, confidence: conf }))

    res.status(201).json({
      message: 'Certificate uploaded and processed successfully',
      testResult: {
        id: testResult.id,
        testType: testResult.testType,
        status: testResult.status,
        aiExtracted: testResult.aiExtracted,
        certificateDoc: testResult.certificateDoc,
      },
      extraction: {
        success: true,
        extractedFields: extractedData,
        confidence: confidenceObj,
        lowConfidenceFields,
        needsReview: lowConfidenceFields.length > 0,
        reviewMessage: lowConfidenceFields.length > 0
          ? `${lowConfidenceFields.length} field(s) need manual verification due to low AI confidence`
          : 'All fields extracted with high confidence'
      }
    })
  } catch (error) {
    console.error('Upload certificate error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/test-results/:id/extraction - Get AI extraction details for a test result
testResultsRouter.get('/:id/extraction', async (req, res) => {
  try {
    const { id } = req.params
    const user = req.user!

    const testResult = await prisma.testResult.findUnique({
      where: { id },
      include: {
        certificateDoc: {
          select: {
            id: true,
            filename: true,
            fileUrl: true,
            mimeType: true,
            uploadedAt: true,
          }
        }
      }
    })

    if (!testResult) {
      return res.status(404).json({ error: 'Test result not found' })
    }

    // Verify user has access
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

    if (!testResult.aiExtracted) {
      return res.json({
        extraction: {
          aiExtracted: false,
          message: 'This test result was not AI-extracted'
        }
      })
    }

    const confidence = testResult.aiConfidence ? JSON.parse(testResult.aiConfidence) : {}
    const lowConfidenceThreshold = 0.80
    const mediumConfidenceThreshold = 0.90

    // Build field status with confidence indicators
    const fieldStatus: Record<string, { value: any; confidence: number; status: string }> = {}

    const fields = [
      { key: 'testType', value: testResult.testType },
      { key: 'laboratoryName', value: testResult.laboratoryName },
      { key: 'laboratoryReportNumber', value: testResult.laboratoryReportNumber },
      { key: 'sampleDate', value: testResult.sampleDate },
      { key: 'testDate', value: testResult.testDate },
      { key: 'sampleLocation', value: testResult.sampleLocation },
      { key: 'resultValue', value: testResult.resultValue },
      { key: 'resultUnit', value: testResult.resultUnit },
      { key: 'specificationMin', value: testResult.specificationMin },
      { key: 'specificationMax', value: testResult.specificationMax },
    ]

    for (const { key, value } of fields) {
      const conf = confidence[key] || 1.0
      let status = 'high'
      if (conf < lowConfidenceThreshold) status = 'low'
      else if (conf < mediumConfidenceThreshold) status = 'medium'

      fieldStatus[key] = { value, confidence: conf, status }
    }

    const lowConfidenceFields = Object.entries(fieldStatus)
      .filter(([_, f]) => f.status === 'low')
      .map(([key, f]) => ({ field: key, confidence: f.confidence }))

    res.json({
      extraction: {
        aiExtracted: true,
        certificateDoc: testResult.certificateDoc,
        fields: fieldStatus,
        lowConfidenceFields,
        needsReview: lowConfidenceFields.length > 0,
        thresholds: {
          low: lowConfidenceThreshold,
          medium: mediumConfidenceThreshold
        }
      }
    })
  } catch (error) {
    console.error('Get extraction details error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PATCH /api/test-results/:id/confirm-extraction - Confirm or correct AI-extracted fields
testResultsRouter.patch('/:id/confirm-extraction', async (req, res) => {
  try {
    const { id } = req.params
    const user = req.user!
    const { confirmedFields, corrections } = req.body

    const testResult = await prisma.testResult.findUnique({
      where: { id },
    })

    if (!testResult) {
      return res.status(404).json({ error: 'Test result not found' })
    }

    // Verify user has permission
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
        message: 'You do not have permission to confirm test results'
      })
    }

    // Build update data from corrections
    const updateData: any = {}

    if (corrections) {
      if (corrections.testType !== undefined) updateData.testType = corrections.testType
      if (corrections.laboratoryName !== undefined) updateData.laboratoryName = corrections.laboratoryName
      if (corrections.laboratoryReportNumber !== undefined) updateData.laboratoryReportNumber = corrections.laboratoryReportNumber
      if (corrections.sampleDate !== undefined) updateData.sampleDate = corrections.sampleDate ? new Date(corrections.sampleDate) : null
      if (corrections.testDate !== undefined) updateData.testDate = corrections.testDate ? new Date(corrections.testDate) : null
      if (corrections.sampleLocation !== undefined) updateData.sampleLocation = corrections.sampleLocation
      if (corrections.resultValue !== undefined) updateData.resultValue = corrections.resultValue ? parseFloat(corrections.resultValue) : null
      if (corrections.resultUnit !== undefined) updateData.resultUnit = corrections.resultUnit
      if (corrections.specificationMin !== undefined) updateData.specificationMin = corrections.specificationMin ? parseFloat(corrections.specificationMin) : null
      if (corrections.specificationMax !== undefined) updateData.specificationMax = corrections.specificationMax ? parseFloat(corrections.specificationMax) : null
      if (corrections.passFail !== undefined) updateData.passFail = corrections.passFail
    }

    // Move to 'entered' status after confirmation
    updateData.status = 'entered'
    updateData.enteredById = user.id
    updateData.enteredAt = new Date()

    const updatedTestResult = await prisma.testResult.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        testType: true,
        laboratoryName: true,
        laboratoryReportNumber: true,
        sampleDate: true,
        testDate: true,
        sampleLocation: true,
        resultValue: true,
        resultUnit: true,
        specificationMin: true,
        specificationMax: true,
        passFail: true,
        status: true,
        aiExtracted: true,
        enteredAt: true,
        enteredBy: {
          select: {
            fullName: true,
          }
        }
      }
    })

    res.json({
      message: 'Extraction confirmed and test result saved',
      testResult: updatedTestResult,
      nextStep: {
        status: 'entered',
        message: 'Test result is now entered and ready for verification'
      }
    })
  } catch (error) {
    console.error('Confirm extraction error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/test-results/batch-upload - Batch upload multiple test certificates (Feature #202)
testResultsRouter.post('/batch-upload', upload.array('certificates', 10), async (req, res) => {
  try {
    const user = req.user!
    const files = req.files as Express.Multer.File[]
    const { projectId } = req.body

    if (!files || files.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'No files uploaded'
      })
    }

    if (!projectId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'projectId is required'
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
      // Delete uploaded files if permission denied
      for (const file of files) {
        fs.unlinkSync(file.path)
      }
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to upload test certificates'
      })
    }

    // Process each file
    const results: any[] = []

    for (const file of files) {
      try {
        // Create document record for the certificate
        const document = await prisma.document.create({
          data: {
            projectId,
            documentType: 'test_certificate',
            category: 'test_results',
            filename: file.originalname,
            fileUrl: `/uploads/certificates/${file.filename}`,
            fileSize: file.size,
            mimeType: file.mimetype,
            uploadedById: user.id,
          }
        })

        // Simulate AI extraction
        const extractedData = simulateAIExtraction(file.originalname)

        // Build confidence object for storage
        const confidenceObj: Record<string, number> = {}
        for (const [key, data] of Object.entries(extractedData)) {
          confidenceObj[key] = data.confidence
        }

        // Create a new test result with extracted data
        const testResult = await prisma.testResult.create({
          data: {
            projectId,
            testType: extractedData.testType.value,
            laboratoryName: extractedData.laboratoryName.value,
            laboratoryReportNumber: extractedData.laboratoryReportNumber.value,
            sampleDate: new Date(extractedData.sampleDate.value),
            testDate: new Date(extractedData.testDate.value),
            sampleLocation: extractedData.sampleLocation.value,
            resultValue: parseFloat(extractedData.resultValue.value),
            resultUnit: extractedData.resultUnit.value,
            specificationMin: parseFloat(extractedData.specificationMin.value),
            specificationMax: parseFloat(extractedData.specificationMax.value),
            passFail: parseFloat(extractedData.resultValue.value) >= 95 ? 'pass' : 'fail',
            certificateDocId: document.id,
            aiExtracted: true,
            aiConfidence: JSON.stringify(confidenceObj),
            status: 'results_received',
          },
          include: {
            certificateDoc: {
              select: {
                id: true,
                filename: true,
                fileUrl: true,
                mimeType: true,
              }
            }
          }
        })

        // Identify low confidence fields
        const lowConfidenceThreshold = 0.80
        const lowConfidenceFields = Object.entries(confidenceObj)
          .filter(([_, conf]) => conf < lowConfidenceThreshold)
          .map(([field, conf]) => ({ field, confidence: conf }))

        results.push({
          success: true,
          filename: file.originalname,
          testResult: {
            id: testResult.id,
            testType: testResult.testType,
            status: testResult.status,
            aiExtracted: testResult.aiExtracted,
            certificateDoc: testResult.certificateDoc,
          },
          extraction: {
            extractedFields: extractedData,
            confidence: confidenceObj,
            lowConfidenceFields,
            needsReview: lowConfidenceFields.length > 0,
          }
        })
      } catch (fileError) {
        console.error(`Error processing file ${file.originalname}:`, fileError)
        results.push({
          success: false,
          filename: file.originalname,
          error: 'Failed to process file'
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length
    const needsReviewCount = results.filter(r => r.success && r.extraction?.needsReview).length

    res.status(201).json({
      message: `Processed ${successCount} of ${files.length} certificates`,
      summary: {
        total: files.length,
        success: successCount,
        failed: failCount,
        needsReview: needsReviewCount,
      },
      results
    })
  } catch (error) {
    console.error('Batch upload error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/test-results/batch-confirm - Batch confirm multiple extractions (Feature #202)
testResultsRouter.post('/batch-confirm', async (req, res) => {
  try {
    const user = req.user!
    const { confirmations } = req.body

    if (!confirmations || !Array.isArray(confirmations) || confirmations.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'confirmations array is required'
      })
    }

    const results: any[] = []

    for (const confirmation of confirmations) {
      const { testResultId, corrections } = confirmation

      try {
        const testResult = await prisma.testResult.findUnique({
          where: { id: testResultId },
        })

        if (!testResult) {
          results.push({
            success: false,
            testResultId,
            error: 'Test result not found'
          })
          continue
        }

        // Verify user has permission
        const projectUser = await prisma.projectUser.findFirst({
          where: {
            projectId: testResult.projectId,
            userId: user.id,
            status: 'active',
          },
        })

        const userProjectRole = projectUser?.role || user.roleInCompany

        if (!TEST_CREATORS.includes(userProjectRole)) {
          results.push({
            success: false,
            testResultId,
            error: 'No permission'
          })
          continue
        }

        // Build update data from corrections
        const updateData: any = {}

        if (corrections) {
          if (corrections.testType !== undefined) updateData.testType = corrections.testType
          if (corrections.laboratoryName !== undefined) updateData.laboratoryName = corrections.laboratoryName
          if (corrections.laboratoryReportNumber !== undefined) updateData.laboratoryReportNumber = corrections.laboratoryReportNumber
          if (corrections.sampleDate !== undefined) updateData.sampleDate = corrections.sampleDate ? new Date(corrections.sampleDate) : null
          if (corrections.testDate !== undefined) updateData.testDate = corrections.testDate ? new Date(corrections.testDate) : null
          if (corrections.sampleLocation !== undefined) updateData.sampleLocation = corrections.sampleLocation
          if (corrections.resultValue !== undefined) updateData.resultValue = corrections.resultValue ? parseFloat(corrections.resultValue) : null
          if (corrections.resultUnit !== undefined) updateData.resultUnit = corrections.resultUnit
          if (corrections.specificationMin !== undefined) updateData.specificationMin = corrections.specificationMin ? parseFloat(corrections.specificationMin) : null
          if (corrections.specificationMax !== undefined) updateData.specificationMax = corrections.specificationMax ? parseFloat(corrections.specificationMax) : null
          if (corrections.passFail !== undefined) updateData.passFail = corrections.passFail
        }

        // Move to 'entered' status after confirmation
        updateData.status = 'entered'
        updateData.enteredById = user.id
        updateData.enteredAt = new Date()

        const updatedTestResult = await prisma.testResult.update({
          where: { id: testResultId },
          data: updateData,
          select: {
            id: true,
            testType: true,
            status: true,
          }
        })

        results.push({
          success: true,
          testResultId,
          testResult: updatedTestResult
        })
      } catch (confirmError) {
        console.error(`Error confirming test result ${testResultId}:`, confirmError)
        results.push({
          success: false,
          testResultId,
          error: 'Failed to confirm'
        })
      }
    }

    const successCount = results.filter(r => r.success).length

    res.json({
      message: `Confirmed ${successCount} of ${confirmations.length} test results`,
      summary: {
        total: confirmations.length,
        success: successCount,
        failed: confirmations.length - successCount,
      },
      results
    })
  } catch (error) {
    console.error('Batch confirm error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})
