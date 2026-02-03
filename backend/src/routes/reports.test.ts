import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import { authRouter } from './auth.js'
import { reportsRouter } from './reports.js'
import { prisma } from '../lib/prisma.js'

const app = express()
app.use(express.json())
app.use('/api/auth', authRouter)
app.use('/api/reports', reportsRouter)

describe('Reports API - Lot Status Report', () => {
  let authToken: string
  let userId: string
  let companyId: string
  let projectId: string
  let lotId1: string
  let lotId2: string

  beforeAll(async () => {
    // Create test company
    const company = await prisma.company.create({
      data: { name: `Reports Test Company ${Date.now()}` }
    })
    companyId = company.id

    // Create test user
    const testEmail = `reports-test-${Date.now()}@example.com`
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Reports Test User',
        tosAccepted: true,
      })
    authToken = regRes.body.token
    userId = regRes.body.user.id

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'admin' }
    })

    // Create project
    const project = await prisma.project.create({
      data: {
        name: `Reports Test Project ${Date.now()}`,
        projectNumber: `RPT-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'rms',
      }
    })
    projectId = project.id

    await prisma.projectUser.create({
      data: { projectId, userId, role: 'admin', status: 'active' }
    })

    // Create test lots with various statuses
    const lot1 = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `RPT-LOT-1-${Date.now()}`,
        status: 'conformed',
        lotType: 'chainage',
        activityType: 'Earthworks',
        description: 'Test earthworks lot',
        conformedAt: new Date(),
        conformedById: userId,
      }
    })
    lotId1 = lot1.id

    const lot2 = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `RPT-LOT-2-${Date.now()}`,
        status: 'in_progress',
        lotType: 'chainage',
        activityType: 'Pavement',
        description: 'Test pavement lot',
      }
    })
    lotId2 = lot2.id
  })

  afterAll(async () => {
    await prisma.lot.deleteMany({ where: { projectId } })
    await prisma.projectUser.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.emailVerificationToken.deleteMany({ where: { userId } })
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {})
  })

  it('should require authentication', async () => {
    const res = await request(app)
      .get('/api/reports/lot-status')
      .query({ projectId })

    expect(res.status).toBe(401)
  })

  it('should require projectId parameter', async () => {
    const res = await request(app)
      .get('/api/reports/lot-status')
      .set('Authorization', `Bearer ${authToken}`)

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('projectId')
  })

  it('should generate lot status report', async () => {
    const res = await request(app)
      .get('/api/reports/lot-status')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId })

    expect(res.status).toBe(200)
    expect(res.body.generatedAt).toBeDefined()
    expect(res.body.projectId).toBe(projectId)
    expect(res.body.totalLots).toBe(2)
    expect(res.body.lots).toBeDefined()
    expect(Array.isArray(res.body.lots)).toBe(true)
    expect(res.body.statusCounts).toBeDefined()
    expect(res.body.activityCounts).toBeDefined()
    expect(res.body.summary).toBeDefined()
    expect(res.body.periodComparison).toBeDefined()
  })

  it('should include status counts', async () => {
    const res = await request(app)
      .get('/api/reports/lot-status')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId })

    expect(res.status).toBe(200)
    expect(res.body.statusCounts.conformed).toBe(1)
    expect(res.body.statusCounts.in_progress).toBe(1)
    expect(res.body.summary.conformed).toBe(1)
    expect(res.body.summary.inProgress).toBe(1)
  })

  it('should include activity type counts', async () => {
    const res = await request(app)
      .get('/api/reports/lot-status')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId })

    expect(res.status).toBe(200)
    expect(res.body.activityCounts.Earthworks).toBe(1)
    expect(res.body.activityCounts.Pavement).toBe(1)
  })

  it('should include period comparison data', async () => {
    const res = await request(app)
      .get('/api/reports/lot-status')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId })

    expect(res.status).toBe(200)
    expect(res.body.periodComparison.conformedThisPeriod).toBeDefined()
    expect(res.body.periodComparison.conformedLastPeriod).toBeDefined()
    expect(res.body.periodComparison.periodChange).toBeDefined()
    expect(res.body.periodComparison.periodChangePercent).toBeDefined()
  })

  it('should support pagination', async () => {
    const res = await request(app)
      .get('/api/reports/lot-status')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId, page: 1, limit: 1 })

    expect(res.status).toBe(200)
    expect(res.body.lots.length).toBe(1)
    expect(res.body.pagination.page).toBe(1)
    expect(res.body.pagination.limit).toBe(1)
    expect(res.body.pagination.total).toBe(2)
    expect(res.body.pagination.totalPages).toBe(2)
  })

  it('should cap pagination limit at 500', async () => {
    const res = await request(app)
      .get('/api/reports/lot-status')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId, limit: 1000 })

    expect(res.status).toBe(200)
    expect(res.body.pagination.limit).toBe(500)
  })
})

describe('Reports API - NCR Report', () => {
  let authToken: string
  let userId: string
  let companyId: string
  let projectId: string
  let ncrId1: string
  let ncrId2: string

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `NCR Reports Test Company ${Date.now()}` }
    })
    companyId = company.id

    const testEmail = `ncr-reports-test-${Date.now()}@example.com`
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'SecureP@ssword123!',
        fullName: 'NCR Reports Test User',
        tosAccepted: true,
      })
    authToken = regRes.body.token
    userId = regRes.body.user.id

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'admin' }
    })

    const project = await prisma.project.create({
      data: {
        name: `NCR Reports Test Project ${Date.now()}`,
        projectNumber: `NCRRPT-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'rms',
      }
    })
    projectId = project.id

    await prisma.projectUser.create({
      data: { projectId, userId, role: 'admin', status: 'active' }
    })

    // Create test NCRs
    const ncr1 = await prisma.nCR.create({
      data: {
        projectId,
        ncrNumber: 'NCR-001',
        description: 'Test NCR 1',
        category: 'minor',
        status: 'open',
        raisedAt: new Date(),
        raisedById: userId,
        rootCauseCategory: 'workmanship',
      }
    })
    ncrId1 = ncr1.id

    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    const ncr2 = await prisma.nCR.create({
      data: {
        projectId,
        ncrNumber: 'NCR-002',
        description: 'Test NCR 2',
        category: 'major',
        status: 'closed',
        raisedAt: yesterday,
        raisedById: userId,
        closedAt: new Date(),
        rootCauseCategory: 'materials',
        responsibleUserId: userId,
      }
    })
    ncrId2 = ncr2.id
  })

  afterAll(async () => {
    await prisma.nCR.deleteMany({ where: { projectId } })
    await prisma.projectUser.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.emailVerificationToken.deleteMany({ where: { userId } })
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {})
  })

  it('should require projectId parameter', async () => {
    const res = await request(app)
      .get('/api/reports/ncr')
      .set('Authorization', `Bearer ${authToken}`)

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('projectId')
  })

  it('should generate NCR report', async () => {
    const res = await request(app)
      .get('/api/reports/ncr')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId })

    expect(res.status).toBe(200)
    expect(res.body.generatedAt).toBeDefined()
    expect(res.body.projectId).toBe(projectId)
    expect(res.body.totalNCRs).toBe(2)
    expect(res.body.ncrs).toBeDefined()
    expect(Array.isArray(res.body.ncrs)).toBe(true)
    expect(res.body.statusCounts).toBeDefined()
    expect(res.body.categoryCounts).toBeDefined()
    expect(res.body.rootCauseCounts).toBeDefined()
  })

  it('should include status counts', async () => {
    const res = await request(app)
      .get('/api/reports/ncr')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId })

    expect(res.status).toBe(200)
    expect(res.body.statusCounts.open).toBe(1)
    expect(res.body.statusCounts.closed).toBe(1)
    expect(res.body.summary.open).toBe(1)
    expect(res.body.summary.closed).toBe(1)
  })

  it('should include category counts', async () => {
    const res = await request(app)
      .get('/api/reports/ncr')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId })

    expect(res.status).toBe(200)
    expect(res.body.categoryCounts.minor).toBe(1)
    expect(res.body.categoryCounts.major).toBe(1)
    expect(res.body.summary.minor).toBe(1)
    expect(res.body.summary.major).toBe(1)
  })

  it('should include root cause counts', async () => {
    const res = await request(app)
      .get('/api/reports/ncr')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId })

    expect(res.status).toBe(200)
    expect(res.body.rootCauseCounts.workmanship).toBe(1)
    expect(res.body.rootCauseCounts.materials).toBe(1)
  })

  it('should include responsible party counts', async () => {
    const res = await request(app)
      .get('/api/reports/ncr')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId })

    expect(res.status).toBe(200)
    expect(res.body.responsiblePartyCounts).toBeDefined()
  })

  it('should calculate closure metrics', async () => {
    const res = await request(app)
      .get('/api/reports/ncr')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId })

    expect(res.status).toBe(200)
    expect(res.body.closureRate).toBeDefined()
    expect(res.body.averageClosureTime).toBeDefined()
    expect(res.body.overdueCount).toBeDefined()
  })

  it('should support pagination', async () => {
    const res = await request(app)
      .get('/api/reports/ncr')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId, page: 1, limit: 1 })

    expect(res.status).toBe(200)
    expect(res.body.ncrs.length).toBe(1)
    expect(res.body.pagination.page).toBe(1)
    expect(res.body.pagination.limit).toBe(1)
    expect(res.body.pagination.total).toBe(2)
  })
})

describe('Reports API - Test Results Report', () => {
  let authToken: string
  let userId: string
  let companyId: string
  let projectId: string
  let lotId: string
  let testId1: string
  let testId2: string

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `Test Reports Company ${Date.now()}` }
    })
    companyId = company.id

    const testEmail = `test-reports-${Date.now()}@example.com`
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Test Reports User',
        tosAccepted: true,
      })
    authToken = regRes.body.token
    userId = regRes.body.user.id

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'admin' }
    })

    const project = await prisma.project.create({
      data: {
        name: `Test Reports Project ${Date.now()}`,
        projectNumber: `TESTRPT-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'rms',
      }
    })
    projectId = project.id

    await prisma.projectUser.create({
      data: { projectId, userId, role: 'admin', status: 'active' }
    })

    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `TEST-LOT-${Date.now()}`,
        status: 'awaiting_test',
        lotType: 'chainage',
        activityType: 'Earthworks',
      }
    })
    lotId = lot.id

    // Create test results
    const test1 = await prisma.testResult.create({
      data: {
        projectId,
        lotId,
        testRequestNumber: 'TR-001',
        testType: 'Compaction',
        sampleDate: new Date(),
        status: 'completed',
        passFail: 'pass',
        resultValue: 98,
        resultUnit: '%',
        specificationMin: 95,
      }
    })
    testId1 = test1.id

    const test2 = await prisma.testResult.create({
      data: {
        projectId,
        lotId,
        testRequestNumber: 'TR-002',
        testType: 'Moisture',
        sampleDate: new Date(),
        status: 'completed',
        passFail: 'fail',
        resultValue: 12,
        resultUnit: '%',
        specificationMax: 10,
      }
    })
    testId2 = test2.id
  })

  afterAll(async () => {
    await prisma.testResult.deleteMany({ where: { projectId } })
    await prisma.lot.deleteMany({ where: { projectId } })
    await prisma.projectUser.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.emailVerificationToken.deleteMany({ where: { userId } })
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {})
  })

  it('should require projectId parameter', async () => {
    const res = await request(app)
      .get('/api/reports/test')
      .set('Authorization', `Bearer ${authToken}`)

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('projectId')
  })

  it('should generate test results report', async () => {
    const res = await request(app)
      .get('/api/reports/test')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId })

    expect(res.status).toBe(200)
    expect(res.body.generatedAt).toBeDefined()
    expect(res.body.projectId).toBe(projectId)
    expect(res.body.totalTests).toBe(2)
    expect(res.body.tests).toBeDefined()
    expect(Array.isArray(res.body.tests)).toBe(true)
    expect(res.body.passFailCounts).toBeDefined()
    expect(res.body.testTypeCounts).toBeDefined()
  })

  it('should include pass/fail counts', async () => {
    const res = await request(app)
      .get('/api/reports/test')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId })

    expect(res.status).toBe(200)
    expect(res.body.passFailCounts.pass).toBe(1)
    expect(res.body.passFailCounts.fail).toBe(1)
    expect(res.body.summary.pass).toBe(1)
    expect(res.body.summary.fail).toBe(1)
    expect(res.body.summary.passRate).toBeDefined()
  })

  it('should include test type counts', async () => {
    const res = await request(app)
      .get('/api/reports/test')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId })

    expect(res.status).toBe(200)
    expect(res.body.testTypeCounts.Compaction).toBe(1)
    expect(res.body.testTypeCounts.Moisture).toBe(1)
  })

  it('should filter by date range', async () => {
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const res = await request(app)
      .get('/api/reports/test')
      .set('Authorization', `Bearer ${authToken}`)
      .query({
        projectId,
        startDate: today.toISOString().split('T')[0],
        endDate: tomorrow.toISOString().split('T')[0]
      })

    expect(res.status).toBe(200)
    expect(res.body.tests.length).toBe(2)
  })

  it('should filter by test types', async () => {
    const res = await request(app)
      .get('/api/reports/test')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId, testTypes: 'Compaction' })

    expect(res.status).toBe(200)
    expect(res.body.tests.length).toBe(1)
    expect(res.body.tests[0].testType).toBe('Compaction')
  })

  it('should filter by lot IDs', async () => {
    const res = await request(app)
      .get('/api/reports/test')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId, lotIds: lotId })

    expect(res.status).toBe(200)
    expect(res.body.tests.length).toBe(2)
  })

  it('should support pagination', async () => {
    const res = await request(app)
      .get('/api/reports/test')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId, page: 1, limit: 1 })

    expect(res.status).toBe(200)
    expect(res.body.tests.length).toBe(1)
    expect(res.body.pagination.page).toBe(1)
    expect(res.body.pagination.limit).toBe(1)
  })
})

describe('Reports API - Diary Report', () => {
  let authToken: string
  let userId: string
  let companyId: string
  let projectId: string
  let diaryId: string

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `Diary Reports Company ${Date.now()}` }
    })
    companyId = company.id

    const testEmail = `diary-reports-${Date.now()}@example.com`
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Diary Reports User',
        tosAccepted: true,
      })
    authToken = regRes.body.token
    userId = regRes.body.user.id

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'admin' }
    })

    const project = await prisma.project.create({
      data: {
        name: `Diary Reports Project ${Date.now()}`,
        projectNumber: `DIARYRPT-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'rms',
      }
    })
    projectId = project.id

    await prisma.projectUser.create({
      data: { projectId, userId, role: 'admin', status: 'active' }
    })

    // Create a diary entry
    const diary = await prisma.dailyDiary.create({
      data: {
        projectId,
        date: new Date(),
        status: 'submitted',
        submittedById: userId,
        submittedAt: new Date(),
        weatherConditions: 'Fine',
        temperatureMin: 18,
        temperatureMax: 28,
      }
    })
    diaryId = diary.id

    // Add personnel entry
    await prisma.diaryPersonnel.create({
      data: {
        diaryId,
        name: 'Test Worker',
        role: 'Foreman',
        company: 'Test Company',
        hours: 8,
      }
    })
  })

  afterAll(async () => {
    await prisma.diaryPersonnel.deleteMany({ where: { diary: { projectId } } })
    await prisma.dailyDiary.deleteMany({ where: { projectId } })
    await prisma.projectUser.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.emailVerificationToken.deleteMany({ where: { userId } })
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {})
  })

  it('should require projectId parameter', async () => {
    const res = await request(app)
      .get('/api/reports/diary')
      .set('Authorization', `Bearer ${authToken}`)

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('projectId')
  })

  it('should generate diary report with default sections', async () => {
    const res = await request(app)
      .get('/api/reports/diary')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId })

    expect(res.status).toBe(200)
    expect(res.body.generatedAt).toBeDefined()
    expect(res.body.projectId).toBe(projectId)
    expect(res.body.totalDiaries).toBe(1)
    expect(res.body.diaries).toBeDefined()
    expect(Array.isArray(res.body.diaries)).toBe(true)
    expect(res.body.selectedSections).toEqual(['weather', 'personnel', 'plant', 'activities', 'delays'])
  })

  it('should filter by selected sections', async () => {
    const res = await request(app)
      .get('/api/reports/diary')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId, sections: 'weather,personnel' })

    expect(res.status).toBe(200)
    expect(res.body.selectedSections).toEqual(['weather', 'personnel'])
    expect(res.body.diaries[0].weatherConditions).toBeDefined()
    expect(res.body.diaries[0].personnel).toBeDefined()
  })

  it('should include weather summary when selected', async () => {
    const res = await request(app)
      .get('/api/reports/diary')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId, sections: 'weather' })

    expect(res.status).toBe(200)
    expect(res.body.summary.weather).toBeDefined()
    expect(res.body.summary.weather.Fine).toBe(1)
  })

  it('should include personnel summary when selected', async () => {
    const res = await request(app)
      .get('/api/reports/diary')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId, sections: 'personnel' })

    expect(res.status).toBe(200)
    expect(res.body.summary.personnel).toBeDefined()
    expect(res.body.summary.personnel.totalPersonnel).toBeGreaterThan(0)
    expect(res.body.summary.personnel.totalHours).toBeGreaterThan(0)
  })

  it('should filter by date range', async () => {
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const res = await request(app)
      .get('/api/reports/diary')
      .set('Authorization', `Bearer ${authToken}`)
      .query({
        projectId,
        startDate: today.toISOString().split('T')[0],
        endDate: tomorrow.toISOString().split('T')[0]
      })

    expect(res.status).toBe(200)
    expect(res.body.diaries.length).toBe(1)
  })

  it('should support pagination', async () => {
    const res = await request(app)
      .get('/api/reports/diary')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId, page: 1, limit: 10 })

    expect(res.status).toBe(200)
    expect(res.body.pagination.page).toBe(1)
    expect(res.body.pagination.limit).toBe(10)
  })
})

describe('Reports API - Summary Report', () => {
  let authToken: string
  let userId: string
  let companyId: string
  let projectId: string

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `Summary Reports Company ${Date.now()}` }
    })
    companyId = company.id

    const testEmail = `summary-reports-${Date.now()}@example.com`
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Summary Reports User',
        tosAccepted: true,
      })
    authToken = regRes.body.token
    userId = regRes.body.user.id

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'admin' }
    })

    const project = await prisma.project.create({
      data: {
        name: `Summary Reports Project ${Date.now()}`,
        projectNumber: `SUMRPT-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'rms',
      }
    })
    projectId = project.id

    await prisma.projectUser.create({
      data: { projectId, userId, role: 'admin', status: 'active' }
    })

    // Create sample data
    await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `SUM-LOT-${Date.now()}`,
        status: 'conformed',
        lotType: 'chainage',
        activityType: 'Earthworks',
      }
    })

    await prisma.nCR.create({
      data: {
        projectId,
        ncrNumber: 'NCR-SUM-001',
        description: 'Summary test NCR',
        category: 'minor',
        status: 'open',
        raisedAt: new Date(),
        raisedById: userId,
      }
    })
  })

  afterAll(async () => {
    await prisma.testResult.deleteMany({ where: { projectId } })
    await prisma.nCR.deleteMany({ where: { projectId } })
    await prisma.lot.deleteMany({ where: { projectId } })
    await prisma.projectUser.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.emailVerificationToken.deleteMany({ where: { userId } })
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {})
  })

  it('should require projectId parameter', async () => {
    const res = await request(app)
      .get('/api/reports/summary')
      .set('Authorization', `Bearer ${authToken}`)

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('projectId')
  })

  it('should generate summary report', async () => {
    const res = await request(app)
      .get('/api/reports/summary')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId })

    expect(res.status).toBe(200)
    expect(res.body.generatedAt).toBeDefined()
    expect(res.body.projectId).toBe(projectId)
    expect(res.body.lots).toBeDefined()
    expect(res.body.ncrs).toBeDefined()
    expect(res.body.tests).toBeDefined()
    expect(res.body.holdPoints).toBeDefined()
  })

  it('should include lot summary statistics', async () => {
    const res = await request(app)
      .get('/api/reports/summary')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId })

    expect(res.status).toBe(200)
    expect(res.body.lots.total).toBe(1)
    expect(res.body.lots.conformed).toBe(1)
    expect(res.body.lots.conformedPercent).toBeDefined()
  })

  it('should include NCR summary statistics', async () => {
    const res = await request(app)
      .get('/api/reports/summary')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId })

    expect(res.status).toBe(200)
    expect(res.body.ncrs.total).toBe(1)
    expect(res.body.ncrs.open).toBe(1)
    expect(res.body.ncrs.closed).toBe(0)
  })

  it('should include test summary statistics', async () => {
    const res = await request(app)
      .get('/api/reports/summary')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId })

    expect(res.status).toBe(200)
    expect(res.body.tests.total).toBeDefined()
    expect(res.body.tests.passRate).toBeDefined()
  })
})

describe('Reports API - Claims Report', () => {
  let authToken: string
  let userId: string
  let companyId: string
  let projectId: string
  let claimId: string

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `Claims Reports Company ${Date.now()}` }
    })
    companyId = company.id

    const testEmail = `claims-reports-${Date.now()}@example.com`
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Claims Reports User',
        tosAccepted: true,
      })
    authToken = regRes.body.token
    userId = regRes.body.user.id

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'project_manager' }
    })

    const project = await prisma.project.create({
      data: {
        name: `Claims Reports Project ${Date.now()}`,
        projectNumber: `CLMRPT-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'rms',
      }
    })
    projectId = project.id

    await prisma.projectUser.create({
      data: { projectId, userId, role: 'project_manager', status: 'active' }
    })

    // Create a lot for claiming
    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `CLM-RPT-LOT-${Date.now()}`,
        status: 'conformed',
        lotType: 'chainage',
        activityType: 'Earthworks',
        budgetAmount: 5000,
      }
    })

    // Create a claim
    const claim = await prisma.progressClaim.create({
      data: {
        projectId,
        claimNumber: 1,
        claimPeriodStart: new Date('2025-01-01'),
        claimPeriodEnd: new Date('2025-01-31'),
        status: 'submitted',
        preparedById: userId,
        totalClaimedAmount: 5000,
        submittedAt: new Date(),
        claimedLots: {
          create: {
            lotId: lot.id,
            quantity: 1,
            unit: 'ea',
            rate: 5000,
            amountClaimed: 5000,
            percentageComplete: 100,
          }
        }
      }
    })
    claimId = claim.id
  })

  afterAll(async () => {
    await prisma.claimedLot.deleteMany({ where: { claim: { projectId } } })
    await prisma.progressClaim.deleteMany({ where: { projectId } })
    await prisma.lot.deleteMany({ where: { projectId } })
    await prisma.projectUser.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.emailVerificationToken.deleteMany({ where: { userId } })
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {})
  })

  it('should require projectId parameter', async () => {
    const res = await request(app)
      .get('/api/reports/claims')
      .set('Authorization', `Bearer ${authToken}`)

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('projectId')
  })

  it('should generate claims report', async () => {
    const res = await request(app)
      .get('/api/reports/claims')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId })

    expect(res.status).toBe(200)
    expect(res.body.generatedAt).toBeDefined()
    expect(res.body.projectId).toBe(projectId)
    expect(res.body.totalClaims).toBe(1)
    expect(res.body.claims).toBeDefined()
    expect(Array.isArray(res.body.claims)).toBe(true)
  })

  it('should include financial summary', async () => {
    const res = await request(app)
      .get('/api/reports/claims')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId })

    expect(res.status).toBe(200)
    expect(res.body.financialSummary).toBeDefined()
    expect(res.body.financialSummary.totalClaimed).toBe(5000)
    expect(res.body.financialSummary.certificationRate).toBeDefined()
    expect(res.body.financialSummary.collectionRate).toBeDefined()
  })

  it('should include status counts', async () => {
    const res = await request(app)
      .get('/api/reports/claims')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId })

    expect(res.status).toBe(200)
    expect(res.body.statusCounts).toBeDefined()
    expect(res.body.statusCounts.submitted).toBe(1)
  })

  it('should include monthly breakdown', async () => {
    const res = await request(app)
      .get('/api/reports/claims')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId })

    expect(res.status).toBe(200)
    expect(res.body.monthlyBreakdown).toBeDefined()
    expect(Array.isArray(res.body.monthlyBreakdown)).toBe(true)
  })

  it('should filter by status', async () => {
    const res = await request(app)
      .get('/api/reports/claims')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId, status: 'submitted' })

    expect(res.status).toBe(200)
    expect(res.body.claims.length).toBe(1)
    expect(res.body.claims[0].status).toBe('submitted')
  })

  it('should filter by date range', async () => {
    const res = await request(app)
      .get('/api/reports/claims')
      .set('Authorization', `Bearer ${authToken}`)
      .query({
        projectId,
        startDate: '2025-01-01',
        endDate: '2025-01-31'
      })

    expect(res.status).toBe(200)
    expect(res.body.claims.length).toBe(1)
  })

  it('should include export data', async () => {
    const res = await request(app)
      .get('/api/reports/claims')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId })

    expect(res.status).toBe(200)
    expect(res.body.exportData).toBeDefined()
    expect(Array.isArray(res.body.exportData)).toBe(true)
    expect(res.body.exportData[0]['Claim #']).toBe(1)
  })
})

describe('Reports API - Scheduled Reports', () => {
  let authToken: string
  let userId: string
  let companyId: string
  let projectId: string
  let scheduleId: string

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `Scheduled Reports Company ${Date.now()}` }
    })
    companyId = company.id

    const testEmail = `scheduled-reports-${Date.now()}@example.com`
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Scheduled Reports User',
        tosAccepted: true,
      })
    authToken = regRes.body.token
    userId = regRes.body.user.id

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'admin' }
    })

    const project = await prisma.project.create({
      data: {
        name: `Scheduled Reports Project ${Date.now()}`,
        projectNumber: `SCHEDRPT-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'rms',
      }
    })
    projectId = project.id

    await prisma.projectUser.create({
      data: { projectId, userId, role: 'admin', status: 'active' }
    })
  })

  afterAll(async () => {
    await prisma.scheduledReport.deleteMany({ where: { projectId } })
    await prisma.projectUser.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.emailVerificationToken.deleteMany({ where: { userId } })
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {})
  })

  describe('GET /api/reports/schedules', () => {
    it('should require projectId parameter', async () => {
      const res = await request(app)
        .get('/api/reports/schedules')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(400)
      expect(res.body.message).toContain('projectId')
    })

    it('should list scheduled reports', async () => {
      const res = await request(app)
        .get('/api/reports/schedules')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ projectId })

      expect(res.status).toBe(200)
      expect(res.body.schedules).toBeDefined()
      expect(Array.isArray(res.body.schedules)).toBe(true)
    })
  })

  describe('POST /api/reports/schedules', () => {
    it('should create a scheduled report', async () => {
      const res = await request(app)
        .post('/api/reports/schedules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          reportType: 'lot-status',
          frequency: 'weekly',
          dayOfWeek: 1,
          timeOfDay: '09:00',
          recipients: 'test@example.com,test2@example.com',
        })

      expect(res.status).toBe(201)
      expect(res.body.schedule).toBeDefined()
      expect(res.body.schedule.reportType).toBe('lot-status')
      expect(res.body.schedule.frequency).toBe('weekly')
      expect(res.body.schedule.isActive).toBe(true)
      scheduleId = res.body.schedule.id
    })

    it('should reject invalid frequency', async () => {
      const res = await request(app)
        .post('/api/reports/schedules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          reportType: 'lot-status',
          frequency: 'invalid',
          recipients: 'test@example.com',
        })

      expect(res.status).toBe(400)
      expect(res.body.message).toContain('frequency')
    })

    it('should reject invalid report type', async () => {
      const res = await request(app)
        .post('/api/reports/schedules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          reportType: 'invalid',
          frequency: 'daily',
          recipients: 'test@example.com',
        })

      expect(res.status).toBe(400)
      expect(res.body.message).toContain('reportType')
    })

    it('should require recipients', async () => {
      const res = await request(app)
        .post('/api/reports/schedules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          reportType: 'lot-status',
          frequency: 'daily',
        })

      expect(res.status).toBe(400)
    })
  })

  describe('PUT /api/reports/schedules/:id', () => {
    it('should update a scheduled report', async () => {
      const res = await request(app)
        .put(`/api/reports/schedules/${scheduleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          frequency: 'daily',
          timeOfDay: '10:00',
        })

      expect(res.status).toBe(200)
      expect(res.body.schedule.frequency).toBe('daily')
      expect(res.body.schedule.timeOfDay).toBe('10:00')
    })

    it('should deactivate a scheduled report', async () => {
      const res = await request(app)
        .put(`/api/reports/schedules/${scheduleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          isActive: false,
        })

      expect(res.status).toBe(200)
      expect(res.body.schedule.isActive).toBe(false)
    })

    it('should return 404 for non-existent schedule', async () => {
      const res = await request(app)
        .put('/api/reports/schedules/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          frequency: 'daily',
        })

      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /api/reports/schedules/:id', () => {
    it('should delete a scheduled report', async () => {
      const res = await request(app)
        .delete(`/api/reports/schedules/${scheduleId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
    })

    it('should return 404 for non-existent schedule', async () => {
      const res = await request(app)
        .delete('/api/reports/schedules/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(404)
    })
  })
})
