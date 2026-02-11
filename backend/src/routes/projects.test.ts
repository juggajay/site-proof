import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import { projectsRouter } from './projects.js'
import { authRouter } from './auth.js'
import { prisma } from '../lib/prisma.js'
import { errorHandler } from '../middleware/errorHandler.js'

const app = express()
app.use(express.json())
app.use('/api/auth', authRouter)
app.use('/api/projects', projectsRouter)
app.use(errorHandler)

describe('Projects API', () => {
  let authToken: string
  let userId: string
  let companyId: string
  let projectId: string

  beforeAll(async () => {
    // Create test company
    const company = await prisma.company.create({
      data: { name: `Projects Test Company ${Date.now()}` }
    })
    companyId = company.id

    // Create test user
    const testEmail = `projects-test-${Date.now()}@example.com`
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Projects Test User',
        tosAccepted: true,
      })
    authToken = regRes.body.token
    userId = regRes.body.user.id

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'admin' }
    })
  })

  afterAll(async () => {
    if (projectId) {
      await prisma.projectUser.deleteMany({ where: { projectId } })
      await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    }
    await prisma.emailVerificationToken.deleteMany({ where: { userId } })
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {})
  })

  describe('POST /api/projects', () => {
    it('should create a new project', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Project',
          projectNumber: `PROJ-${Date.now()}`,
          state: 'NSW',
          specificationSet: 'TfNSW',
        })

      expect(res.status).toBe(201)
      expect(res.body.project).toBeDefined()
      expect(res.body.project.name).toBe('Test Project')
      projectId = res.body.project.id
    })

    it('should reject project without name', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectNumber: 'NO-NAME',
        })

      expect(res.status).toBe(400)
      expect(res.body.error.message).toContain('required')
    })

    it('should auto-generate project number if not provided', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Auto Number Project',
          state: 'NSW',
          specificationSet: 'TfNSW',
        })

      expect(res.status).toBe(201)
      expect(res.body.project.projectNumber).toBeDefined()
      expect(res.body.project.projectNumber).toMatch(/^PRJ-/)

      // Cleanup
      await prisma.projectUser.deleteMany({ where: { projectId: res.body.project.id } })
      await prisma.project.delete({ where: { id: res.body.project.id } })
    })
  })

  describe('GET /api/projects', () => {
    it('should list accessible projects', async () => {
      const res = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.projects).toBeDefined()
      expect(Array.isArray(res.body.projects)).toBe(true)
    })

    it('should include newly created project in list', async () => {
      const res = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      const found = res.body.projects.find((p: any) => p.id === projectId)
      expect(found).toBeDefined()
    })
  })

  describe('GET /api/projects/:id', () => {
    it('should get a single project', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.project).toBeDefined()
      expect(res.body.project.id).toBe(projectId)
    })

    it('should return 404 for non-existent project', async () => {
      const res = await request(app)
        .get('/api/projects/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(404)
    })
  })

  describe('PATCH /api/projects/:id', () => {
    it('should update project settings', async () => {
      const res = await request(app)
        .patch(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Project Name',
          lotPrefix: 'LOT-',
          lotStartingNumber: 100,
        })

      expect(res.status).toBe(200)
      expect(res.body.project.name).toBe('Updated Project Name')
    })

    it('should reject empty project name', async () => {
      const res = await request(app)
        .patch(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '',
        })

      expect(res.status).toBe(400)
    })

    it('should validate chainage range', async () => {
      const res = await request(app)
        .patch(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          chainageStart: 100,
          chainageEnd: 50, // Invalid: end < start
        })

      expect(res.status).toBe(400)
      expect(res.body.error.message).toContain('greater than')
    })
  })
})

describe('Project Team Management', () => {
  let authToken: string
  let userId: string
  let secondUserId: string
  let secondUserEmail: string
  let companyId: string
  let projectId: string

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `Team Test Company ${Date.now()}` }
    })
    companyId = company.id

    // Create admin user
    const adminEmail = `team-admin-${Date.now()}@example.com`
    const adminRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: adminEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Team Admin',
        tosAccepted: true,
      })
    authToken = adminRes.body.token
    userId = adminRes.body.user.id

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'admin' }
    })

    // Create second user to add to team
    secondUserEmail = `team-member-${Date.now()}@example.com`
    const memberRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: secondUserEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Team Member',
        tosAccepted: true,
      })
    secondUserId = memberRes.body.user.id

    await prisma.user.update({
      where: { id: secondUserId },
      data: { companyId, roleInCompany: 'viewer' }
    })

    // Create project
    const project = await prisma.project.create({
      data: {
        name: `Team Test Project ${Date.now()}`,
        projectNumber: `TEAM-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      }
    })
    projectId = project.id

    await prisma.projectUser.create({
      data: { projectId, userId, role: 'admin', status: 'active' }
    })
  })

  afterAll(async () => {
    await prisma.projectUser.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})

    for (const uid of [userId, secondUserId]) {
      await prisma.emailVerificationToken.deleteMany({ where: { userId: uid } })
      await prisma.user.delete({ where: { id: uid } }).catch(() => {})
    }

    await prisma.company.delete({ where: { id: companyId } }).catch(() => {})
  })

  it('should get project team members', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/users`)
      .set('Authorization', `Bearer ${authToken}`)

    expect(res.status).toBe(200)
    expect(res.body.users).toBeDefined()
    expect(Array.isArray(res.body.users)).toBe(true)
  })

  it('should add user to project team by email', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/users`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        email: secondUserEmail,  // API expects email, not userId
        role: 'viewer',
      })

    expect(res.status).toBe(201)
  })

  it('should update user role in project', async () => {
    const res = await request(app)
      .patch(`/api/projects/${projectId}/users/${secondUserId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        role: 'foreman',
      })

    expect(res.status).toBe(200)
  })
})
