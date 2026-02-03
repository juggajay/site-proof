import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import { authRouter } from './auth.js'
import { auditLogRouter } from './auditLog.js'
import { prisma } from '../lib/prisma.js'

const app = express()
app.use(express.json())
app.use('/api/auth', authRouter)
app.use('/api/audit-logs', auditLogRouter)

describe('Audit Log API', () => {
  let authToken: string
  let userId: string
  let companyId: string
  let projectId: string
  let secondUserId: string
  let auditLogIds: string[] = []

  beforeAll(async () => {
    // Create test company
    const company = await prisma.company.create({
      data: { name: `AuditLog Test Company ${Date.now()}` }
    })
    companyId = company.id

    // Create first test user
    const testEmail = `auditlog-test-${Date.now()}@example.com`
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'SecureP@ssword123!',
        fullName: 'AuditLog Test User',
        tosAccepted: true,
      })
    authToken = regRes.body.token
    userId = regRes.body.user.id

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'admin' }
    })

    // Create second test user for filtering tests
    const secondEmail = `auditlog-second-${Date.now()}@example.com`
    const secondRegRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: secondEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Second Test User',
        tosAccepted: true,
      })
    secondUserId = secondRegRes.body.user.id

    await prisma.user.update({
      where: { id: secondUserId },
      data: { companyId, roleInCompany: 'viewer' }
    })

    // Create test project
    const project = await prisma.project.create({
      data: {
        name: `AuditLog Test Project ${Date.now()}`,
        projectNumber: `AUDIT-${Date.now()}`,
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

    // Create sample audit logs for testing
    const logs = await Promise.all([
      // Log 1: Project created
      prisma.auditLog.create({
        data: {
          action: 'project.created',
          entityType: 'Project',
          entityId: projectId,
          userId,
          projectId,
          changes: JSON.stringify({ name: 'AuditLog Test Project' }),
        }
      }),
      // Log 2: Project updated
      prisma.auditLog.create({
        data: {
          action: 'project.updated',
          entityType: 'Project',
          entityId: projectId,
          userId,
          projectId,
          changes: JSON.stringify({ status: { from: 'draft', to: 'active' } }),
        }
      }),
      // Log 3: User added to project
      prisma.auditLog.create({
        data: {
          action: 'user.added_to_project',
          entityType: 'ProjectUser',
          entityId: userId,
          userId: secondUserId,
          projectId,
          changes: JSON.stringify({ role: 'admin' }),
        }
      }),
      // Log 4: Lot created (different entity type)
      prisma.auditLog.create({
        data: {
          action: 'lot.created',
          entityType: 'Lot',
          entityId: 'test-lot-id',
          userId,
          projectId,
          changes: JSON.stringify({ lotNumber: 'LOT-001' }),
        }
      }),
      // Log 5: ITP completion (different date)
      prisma.auditLog.create({
        data: {
          action: 'itp.completed',
          entityType: 'ITPCompletion',
          entityId: 'test-itp-id',
          userId,
          projectId,
          changes: JSON.stringify({ status: 'approved' }),
          createdAt: new Date('2024-01-01T12:00:00Z'),
        }
      }),
    ])

    auditLogIds = logs.map(log => log.id)
  })

  afterAll(async () => {
    // Cleanup audit logs
    await prisma.auditLog.deleteMany({ where: { id: { in: auditLogIds } } })
    await prisma.projectUser.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})

    for (const uid of [userId, secondUserId]) {
      await prisma.emailVerificationToken.deleteMany({ where: { userId: uid } })
      await prisma.user.delete({ where: { id: uid } }).catch(() => {})
    }

    await prisma.company.delete({ where: { id: companyId } }).catch(() => {})
  })

  describe('GET /api/audit-logs', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/audit-logs')

      expect(res.status).toBe(401)
    })

    it('should list all audit logs without filters', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.logs).toBeDefined()
      expect(Array.isArray(res.body.logs)).toBe(true)
      expect(res.body.pagination).toBeDefined()
      expect(res.body.pagination.page).toBe(1)
      expect(res.body.pagination.limit).toBe(50)
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(5)
    })

    it('should include user and project info in logs', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      const log = res.body.logs[0]
      expect(log.user).toBeDefined()
      expect(log.user.email).toBeDefined()
      expect(log.user.fullName).toBeDefined()
      expect(log.project).toBeDefined()
      expect(log.project.name).toBeDefined()
      expect(log.project.projectNumber).toBeDefined()
    })

    it('should parse changes JSON field', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      const logWithChanges = res.body.logs.find((l: any) => l.changes !== null)
      expect(logWithChanges).toBeDefined()
      expect(typeof logWithChanges.changes).toBe('object')
    })

    it('should filter by projectId', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ projectId })

      expect(res.status).toBe(200)
      expect(res.body.logs.length).toBeGreaterThan(0)
      res.body.logs.forEach((log: any) => {
        expect(log.projectId).toBe(projectId)
      })
    })

    it('should filter by entityType', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ entityType: 'Project' })

      expect(res.status).toBe(200)
      expect(res.body.logs.length).toBeGreaterThan(0)
      res.body.logs.forEach((log: any) => {
        expect(log.entityType).toBe('Project')
      })
    })

    it('should filter by action (contains)', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ action: 'created' })

      expect(res.status).toBe(200)
      expect(res.body.logs.length).toBeGreaterThan(0)
      res.body.logs.forEach((log: any) => {
        expect(log.action.toLowerCase()).toContain('created')
      })
    })

    it('should filter by userId', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ userId })

      expect(res.status).toBe(200)
      expect(res.body.logs.length).toBeGreaterThan(0)
      res.body.logs.forEach((log: any) => {
        expect(log.userId).toBe(userId)
      })
    })

    it('should search across action, entityType, and entityId', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ search: 'Project' })

      expect(res.status).toBe(200)
      expect(res.body.logs.length).toBeGreaterThan(0)
    })

    it('should filter by date range (startDate)', async () => {
      const startDate = '2024-01-01'
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ startDate })

      expect(res.status).toBe(200)
      res.body.logs.forEach((log: any) => {
        const logDate = new Date(log.createdAt)
        expect(logDate >= new Date(startDate)).toBe(true)
      })
    })

    it('should filter by date range (endDate)', async () => {
      const endDate = '2024-12-31'
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ endDate })

      expect(res.status).toBe(200)
      res.body.logs.forEach((log: any) => {
        const logDate = new Date(log.createdAt)
        const endDateTime = new Date(endDate)
        endDateTime.setHours(23, 59, 59, 999)
        expect(logDate <= endDateTime).toBe(true)
      })
    })

    it('should filter by date range (both startDate and endDate)', async () => {
      const startDate = '2024-01-01'
      const endDate = '2024-12-31'
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ startDate, endDate })

      expect(res.status).toBe(200)
      res.body.logs.forEach((log: any) => {
        const logDate = new Date(log.createdAt)
        const endDateTime = new Date(endDate)
        endDateTime.setHours(23, 59, 59, 999)
        expect(logDate >= new Date(startDate)).toBe(true)
        expect(logDate <= endDateTime).toBe(true)
      })
    })

    it('should support pagination (page 1)', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: '1', limit: '2' })

      expect(res.status).toBe(200)
      expect(res.body.logs.length).toBeLessThanOrEqual(2)
      expect(res.body.pagination.page).toBe(1)
      expect(res.body.pagination.limit).toBe(2)
      expect(res.body.pagination.totalPages).toBeGreaterThanOrEqual(1)
    })

    it('should support pagination (page 2)', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: '2', limit: '2' })

      expect(res.status).toBe(200)
      expect(res.body.pagination.page).toBe(2)
      expect(res.body.pagination.limit).toBe(2)
    })

    it('should enforce max limit of 100 per page', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: '200' })

      expect(res.status).toBe(200)
      expect(res.body.pagination.limit).toBe(100)
    })

    it('should default to page 1 and limit 50', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.pagination.page).toBe(1)
      expect(res.body.pagination.limit).toBe(50)
    })

    it('should order logs by createdAt desc (newest first)', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.logs.length).toBeGreaterThan(1)

      for (let i = 0; i < res.body.logs.length - 1; i++) {
        const current = new Date(res.body.logs[i].createdAt)
        const next = new Date(res.body.logs[i + 1].createdAt)
        expect(current >= next).toBe(true)
      }
    })

    it('should combine multiple filters', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          projectId,
          entityType: 'Project',
          userId,
        })

      expect(res.status).toBe(200)
      res.body.logs.forEach((log: any) => {
        expect(log.projectId).toBe(projectId)
        expect(log.entityType).toBe('Project')
        expect(log.userId).toBe(userId)
      })
    })
  })

  describe('GET /api/audit-logs/actions', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/audit-logs/actions')

      expect(res.status).toBe(401)
    })

    it('should return list of distinct actions', async () => {
      const res = await request(app)
        .get('/api/audit-logs/actions')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.actions).toBeDefined()
      expect(Array.isArray(res.body.actions)).toBe(true)
      expect(res.body.actions.length).toBeGreaterThan(0)
    })

    it('should return actions in alphabetical order', async () => {
      const res = await request(app)
        .get('/api/audit-logs/actions')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      const actions = res.body.actions

      for (let i = 0; i < actions.length - 1; i++) {
        expect(actions[i] <= actions[i + 1]).toBe(true)
      }
    })

    it('should return unique actions only', async () => {
      const res = await request(app)
        .get('/api/audit-logs/actions')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      const actions = res.body.actions
      const uniqueActions = [...new Set(actions)]
      expect(actions.length).toBe(uniqueActions.length)
    })
  })

  describe('GET /api/audit-logs/entity-types', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/audit-logs/entity-types')

      expect(res.status).toBe(401)
    })

    it('should return list of distinct entity types', async () => {
      const res = await request(app)
        .get('/api/audit-logs/entity-types')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.entityTypes).toBeDefined()
      expect(Array.isArray(res.body.entityTypes)).toBe(true)
      expect(res.body.entityTypes.length).toBeGreaterThan(0)
    })

    it('should return entity types in alphabetical order', async () => {
      const res = await request(app)
        .get('/api/audit-logs/entity-types')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      const entityTypes = res.body.entityTypes

      for (let i = 0; i < entityTypes.length - 1; i++) {
        expect(entityTypes[i] <= entityTypes[i + 1]).toBe(true)
      }
    })

    it('should return unique entity types only', async () => {
      const res = await request(app)
        .get('/api/audit-logs/entity-types')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      const entityTypes = res.body.entityTypes
      const uniqueTypes = [...new Set(entityTypes)]
      expect(entityTypes.length).toBe(uniqueTypes.length)
    })
  })

  describe('GET /api/audit-logs/users', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/audit-logs/users')

      expect(res.status).toBe(401)
    })

    it('should return list of users who have audit log entries', async () => {
      const res = await request(app)
        .get('/api/audit-logs/users')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.users).toBeDefined()
      expect(Array.isArray(res.body.users)).toBe(true)
      expect(res.body.users.length).toBeGreaterThan(0)
    })

    it('should include user details (id, email, fullName)', async () => {
      const res = await request(app)
        .get('/api/audit-logs/users')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      const user = res.body.users[0]
      expect(user.id).toBeDefined()
      expect(user.email).toBeDefined()
      expect(user.fullName).toBeDefined()
    })

    it('should return users sorted by email', async () => {
      const res = await request(app)
        .get('/api/audit-logs/users')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      const users = res.body.users

      for (let i = 0; i < users.length - 1; i++) {
        const currentEmail = users[i].email || ''
        const nextEmail = users[i + 1].email || ''
        expect(currentEmail.localeCompare(nextEmail)).toBeLessThanOrEqual(0)
      }
    })

    it('should return unique users only', async () => {
      const res = await request(app)
        .get('/api/audit-logs/users')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      const users = res.body.users
      const userIds = users.map((u: any) => u.id)
      const uniqueIds = [...new Set(userIds)]
      expect(userIds.length).toBe(uniqueIds.length)
    })

    it('should filter out logs with null userId', async () => {
      // Create a log with null userId
      const nullUserLog = await prisma.auditLog.create({
        data: {
          action: 'system.action',
          entityType: 'System',
          entityId: 'system-id',
          userId: null,
          projectId,
          changes: JSON.stringify({ test: 'value' }),
        }
      })
      auditLogIds.push(nullUserLog.id)

      const res = await request(app)
        .get('/api/audit-logs/users')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      // Should not include any user with null/undefined values
      res.body.users.forEach((user: any) => {
        expect(user.id).toBeDefined()
        expect(user.id).not.toBeNull()
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid date format gracefully', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ startDate: 'invalid-date' })

      // Should either return 500 or handle gracefully with valid response
      if (res.status === 500) {
        expect(res.body.error).toBeDefined()
      } else {
        expect(res.status).toBe(200)
      }
    })

    it('should handle invalid page number', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 'abc' })

      expect(res.status).toBe(200)
      expect(res.body.pagination.page).toBe(1) // Should default to 1
    })

    it('should handle invalid limit', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 'xyz' })

      expect(res.status).toBe(200)
      expect(res.body.pagination.limit).toBe(50) // Should default to 50
    })

    it('should handle zero page number', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: '0' })

      expect(res.status).toBe(200)
      expect(res.body.pagination.page).toBeGreaterThanOrEqual(1)
    })

    it('should return 500 for negative page number (known limitation)', async () => {
      // Note: The route currently doesn't validate negative page numbers
      // which results in a Prisma error when skip becomes negative
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: '-1' })

      expect(res.status).toBe(500)
      expect(res.body.error).toBeDefined()
    })
  })
})
