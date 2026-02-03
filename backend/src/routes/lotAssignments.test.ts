import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import { authRouter } from './auth.js'
import { lotAssignmentsRouter } from './lotAssignments.js'
import { prisma } from '../lib/prisma.js'

const app = express()
app.use(express.json())
app.use('/api/auth', authRouter)
// Only use lotAssignmentsRouter to test those specific routes
app.use('/api/lots', lotAssignmentsRouter)

describe('Lot Assignments API', () => {
  let authToken: string
  let userId: string
  let companyId: string
  let projectId: string
  let lotId: string
  let subcontractorCompanyId: string
  let assignmentId: string

  beforeAll(async () => {
    // Create test company
    const company = await prisma.company.create({
      data: { name: `Lot Assignments Test Company ${Date.now()}` }
    })
    companyId = company.id

    // Create test user via registration
    const testEmail = `lot-assign-test-${Date.now()}@example.com`
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Lot Assignment Test User',
        tosAccepted: true,
      })
    authToken = regRes.body.token
    userId = regRes.body.user.id

    // Update user with company and project_manager role
    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'project_manager' }
    })

    // Create test project
    const project = await prisma.project.create({
      data: {
        name: `Lot Assignments Test Project ${Date.now()}`,
        projectNumber: `LAP-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'rms',
      }
    })
    projectId = project.id

    // Add user to project with project_manager role
    await prisma.projectUser.create({
      data: {
        projectId,
        userId,
        role: 'project_manager',
        status: 'active',
      }
    })

    // Create a lot directly in DB (since we're not testing lotsRouter)
    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: 'LOT-ASSIGN-001',
        lotType: 'roadworks',
        activityType: 'excavation',
        description: 'Test lot for assignments',
      }
    })
    lotId = lot.id

    // Create subcontractor company
    const subcontractor = await prisma.subcontractorCompany.create({
      data: {
        projectId,
        companyName: `Subcontractor Test ${Date.now()}`,
        primaryContactName: 'Sub Contact',
        primaryContactEmail: `sub-${Date.now()}@example.com`,
        status: 'approved',
      }
    })
    subcontractorCompanyId = subcontractor.id
  })

  afterAll(async () => {
    // Clean up in reverse order of dependencies
    await prisma.lotSubcontractorAssignment.deleteMany({ where: { projectId } })
    await prisma.subcontractorCompany.deleteMany({ where: { projectId } })
    await prisma.lot.deleteMany({ where: { projectId } })
    await prisma.projectUser.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})

    // Clean up user and related tokens
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (user) {
      await prisma.emailVerificationToken.deleteMany({ where: { userId } })
      await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    }

    await prisma.company.delete({ where: { id: companyId } }).catch(() => {})
  })

  describe('POST /api/lots/:lotId/subcontractors - Assign Subcontractor', () => {
    it('should assign a subcontractor to a lot', async () => {
      const res = await request(app)
        .post(`/api/lots/${lotId}/subcontractors`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          subcontractorCompanyId,
          canCompleteITP: true,
          itpRequiresVerification: false,
        })

      expect(res.status).toBe(201)
      expect(res.body.lotId).toBe(lotId)
      expect(res.body.subcontractorCompanyId).toBe(subcontractorCompanyId)
      expect(res.body.canCompleteITP).toBe(true)
      expect(res.body.itpRequiresVerification).toBe(false)
      expect(res.body.status).toBe('active')
      expect(res.body.subcontractorCompany).toBeDefined()
      expect(res.body.assignedById).toBe(userId)
      assignmentId = res.body.id
    })

    it('should use default values for optional fields', async () => {
      // Create another lot directly in DB
      const testLot = await prisma.lot.create({
        data: {
          projectId,
          lotNumber: `LOT-ASSIGN-DEFAULT-${Date.now()}`,
          lotType: 'roadworks',
          activityType: 'excavation',
          description: 'Test lot for default values',
        }
      })
      const testLotId = testLot.id

      const res = await request(app)
        .post(`/api/lots/${testLotId}/subcontractors`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          subcontractorCompanyId,
        })

      expect(res.status).toBe(201)
      expect(res.body.canCompleteITP).toBe(false)
      expect(res.body.itpRequiresVerification).toBe(true)

      // Clean up
      await prisma.lotSubcontractorAssignment.deleteMany({ where: { lotId: testLotId } })
      await prisma.lot.delete({ where: { id: testLotId } })
    })

    it('should reject assignment without subcontractorCompanyId', async () => {
      const res = await request(app)
        .post(`/api/lots/${lotId}/subcontractors`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})

      expect(res.status).toBe(400)
      // Check for either error format (depending on middleware)
      expect(res.body.error || res.body.message).toBeDefined()
    })

    it('should reject assignment to non-existent lot', async () => {
      const res = await request(app)
        .post('/api/lots/non-existent-lot-id/subcontractors')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          subcontractorCompanyId,
        })

      expect(res.status).toBe(404)
      expect(res.body.error).toBe('Lot not found')
    })

    it('should reject assignment with non-existent subcontractor', async () => {
      const res = await request(app)
        .post(`/api/lots/${lotId}/subcontractors`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          subcontractorCompanyId: 'non-existent-sub-id',
        })

      expect(res.status).toBe(400)
      // Check for either error format
      expect(res.body.error || res.body.message).toBeDefined()
    })

    it('should reject duplicate active assignment', async () => {
      const res = await request(app)
        .post(`/api/lots/${lotId}/subcontractors`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          subcontractorCompanyId,
        })

      expect(res.status).toBe(409)
      // Check for either error format
      expect(res.body.error || res.body.message).toBeDefined()
    })

    it('should reject assignment from unapproved subcontractor', async () => {
      // Create a pending subcontractor
      const pendingSub = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `Pending Sub ${Date.now()}`,
          primaryContactName: 'Pending Contact',
          primaryContactEmail: `pending-${Date.now()}@example.com`,
          status: 'pending_approval',
        }
      })

      const res = await request(app)
        .post(`/api/lots/${lotId}/subcontractors`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          subcontractorCompanyId: pendingSub.id,
        })

      expect(res.status).toBe(400)
      // Check for either error format
      expect(res.body.error || res.body.message).toBeDefined()

      // Clean up
      await prisma.subcontractorCompany.delete({ where: { id: pendingSub.id } })
    })

    it('should reactivate removed assignment', async () => {
      // Create a lot with a removed assignment directly in DB
      const testLot = await prisma.lot.create({
        data: {
          projectId,
          lotNumber: `LOT-REACTIVATE-${Date.now()}`,
          lotType: 'roadworks',
          activityType: 'excavation',
          description: 'Test lot for reactivation',
        }
      })
      const testLotId = testLot.id

      // Create another subcontractor for this test
      const reactivateSub = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `Reactivate Sub ${Date.now()}`,
          primaryContactName: 'Reactivate Contact',
          primaryContactEmail: `reactivate-${Date.now()}@example.com`,
          status: 'approved',
        }
      })

      // Create removed assignment directly in DB
      const assignment = await prisma.lotSubcontractorAssignment.create({
        data: {
          lotId: testLotId,
          subcontractorCompanyId: reactivateSub.id,
          projectId,
          status: 'removed',
          assignedById: userId,
        }
      })

      // Reactivate via API
      const res = await request(app)
        .post(`/api/lots/${testLotId}/subcontractors`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          subcontractorCompanyId: reactivateSub.id,
          canCompleteITP: true,
          itpRequiresVerification: true,
        })

      expect(res.status).toBe(201)
      expect(res.body.id).toBe(assignment.id) // Should reuse the same assignment ID
      expect(res.body.status).toBe('active')
      expect(res.body.canCompleteITP).toBe(true)

      // Clean up
      await prisma.lotSubcontractorAssignment.deleteMany({ where: { lotId: testLotId } })
      await prisma.subcontractorCompany.delete({ where: { id: reactivateSub.id } })
      await prisma.lot.delete({ where: { id: testLotId } })
    })

    it('should reject assignment without proper role', async () => {
      // Create a user with insufficient role
      const viewerEmail = `viewer-${Date.now()}@example.com`
      const viewerRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: viewerEmail,
          password: 'SecureP@ssword123!',
          fullName: 'Viewer User',
          tosAccepted: true,
        })
      const viewerToken = viewerRes.body.token
      const viewerId = viewerRes.body.user.id

      await prisma.user.update({
        where: { id: viewerId },
        data: { companyId, roleInCompany: 'viewer' }
      })

      await prisma.projectUser.create({
        data: {
          projectId,
          userId: viewerId,
          role: 'viewer',
          status: 'active',
        }
      })

      const res = await request(app)
        .post(`/api/lots/${lotId}/subcontractors`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          subcontractorCompanyId,
        })

      expect(res.status).toBe(403)

      // Clean up
      await prisma.projectUser.deleteMany({ where: { userId: viewerId } })
      await prisma.emailVerificationToken.deleteMany({ where: { userId: viewerId } })
      await prisma.user.delete({ where: { id: viewerId } })
    })

    it('should reject unauthenticated assignment', async () => {
      const res = await request(app)
        .post(`/api/lots/${lotId}/subcontractors`)
        .send({
          subcontractorCompanyId,
        })

      expect(res.status).toBe(401)
    })
  })

  describe('GET /api/lots/:lotId/subcontractors - List Assignments', () => {
    it('should list all assignments for a lot', async () => {
      const res = await request(app)
        .get(`/api/lots/${lotId}/subcontractors`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body.length).toBeGreaterThan(0)
      const assignment = res.body[0]
      expect(assignment.lotId).toBe(lotId)
      expect(assignment.subcontractorCompany).toBeDefined()
      expect(assignment.subcontractorCompany.id).toBeDefined()
      expect(assignment.subcontractorCompany.companyName).toBeDefined()
      // assignedBy may be present or not depending on data
      if (assignment.assignedBy) {
        expect(assignment.assignedBy.id).toBeDefined()
        expect(assignment.assignedBy.fullName).toBeDefined()
      }
    })

    it('should only show active assignments', async () => {
      const res = await request(app)
        .get(`/api/lots/${lotId}/subcontractors`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      for (const assignment of res.body) {
        expect(assignment.status).toBe('active')
      }
    })

    it('should filter assignments for subcontractor users', async () => {
      // Create a separate lot for this test to avoid pollution
      const testLot = await prisma.lot.create({
        data: {
          projectId,
          lotNumber: `LOT-FILTER-${Date.now()}`,
          lotType: 'roadworks',
          activityType: 'excavation',
          description: 'Lot for filter test',
        }
      })
      const testLotId = testLot.id

      // Assign subcontractor to this lot
      await request(app)
        .post(`/api/lots/${testLotId}/subcontractors`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          subcontractorCompanyId,
        })

      // Create subcontractor user
      const subEmail = `sub-user-${Date.now()}@example.com`
      const subRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: subEmail,
          password: 'SecureP@ssword123!',
          fullName: 'Subcontractor User',
          tosAccepted: true,
        })
      const subToken = subRes.body.token
      const subUserId = subRes.body.user.id

      await prisma.user.update({
        where: { id: subUserId },
        data: { companyId, roleInCompany: 'subcontractor' }
      })

      // Link to subcontractor company
      await prisma.subcontractorUser.create({
        data: {
          userId: subUserId,
          subcontractorCompanyId,
          role: 'user',
        }
      })

      const res = await request(app)
        .get(`/api/lots/${testLotId}/subcontractors`)
        .set('Authorization', `Bearer ${subToken}`)

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body.length).toBeGreaterThan(0)
      // Should only see their own assignment
      for (const assignment of res.body) {
        expect(assignment.subcontractorCompanyId).toBe(subcontractorCompanyId)
      }

      // Clean up
      await prisma.subcontractorUser.deleteMany({ where: { userId: subUserId } })
      await prisma.emailVerificationToken.deleteMany({ where: { userId: subUserId } })
      await prisma.user.delete({ where: { id: subUserId } })
      await prisma.lotSubcontractorAssignment.deleteMany({ where: { lotId: testLotId } })
      await prisma.lot.delete({ where: { id: testLotId } })
    })

    it('should return empty array for subcontractor not assigned to lot', async () => {
      // Create a fresh lot with NO assignments directly in DB
      const emptyLot = await prisma.lot.create({
        data: {
          projectId,
          lotNumber: `LOT-EMPTY-${Date.now()}`,
          lotType: 'roadworks',
          activityType: 'excavation',
          description: 'Lot with no assignments',
        }
      })
      const emptyLotId = emptyLot.id

      // Create another subcontractor user not assigned to this lot
      const otherSubEmail = `other-sub-${Date.now()}@example.com`
      const otherSubRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: otherSubEmail,
          password: 'SecureP@ssword123!',
          fullName: 'Other Subcontractor User',
          tosAccepted: true,
        })
      const otherSubToken = otherSubRes.body.token
      const otherSubUserId = otherSubRes.body.user.id

      await prisma.user.update({
        where: { id: otherSubUserId },
        data: { companyId, roleInCompany: 'subcontractor' }
      })

      // Create another subcontractor company
      const otherSub = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `Other Sub ${Date.now()}`,
          primaryContactName: 'Other Contact',
          primaryContactEmail: `other-sub-co-${Date.now()}@example.com`,
          status: 'approved',
        }
      })

      await prisma.subcontractorUser.create({
        data: {
          userId: otherSubUserId,
          subcontractorCompanyId: otherSub.id,
          role: 'user',
        }
      })

      const res = await request(app)
        .get(`/api/lots/${emptyLotId}/subcontractors`)
        .set('Authorization', `Bearer ${otherSubToken}`)

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body).toEqual([])

      // Clean up
      await prisma.subcontractorUser.deleteMany({ where: { userId: otherSubUserId } })
      await prisma.subcontractorCompany.delete({ where: { id: otherSub.id } })
      await prisma.emailVerificationToken.deleteMany({ where: { userId: otherSubUserId } })
      await prisma.user.delete({ where: { id: otherSubUserId } })
      await prisma.lot.delete({ where: { id: emptyLotId } })
    })

    it('should require authentication', async () => {
      const res = await request(app)
        .get(`/api/lots/${lotId}/subcontractors`)

      expect(res.status).toBe(401)
    })
  })

  describe('GET /api/lots/:lotId/subcontractors/mine - Get My Assignment', () => {
    let subToken: string
    let subUserId: string

    beforeAll(async () => {
      // Create subcontractor user
      const subEmail = `mine-sub-${Date.now()}@example.com`
      const subRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: subEmail,
          password: 'SecureP@ssword123!',
          fullName: 'Mine Subcontractor User',
          tosAccepted: true,
        })
      subToken = subRes.body.token
      subUserId = subRes.body.user.id

      await prisma.user.update({
        where: { id: subUserId },
        data: { companyId, roleInCompany: 'subcontractor' }
      })

      await prisma.subcontractorUser.create({
        data: {
          userId: subUserId,
          subcontractorCompanyId,
          role: 'user',
        }
      })
    })

    afterAll(async () => {
      await prisma.subcontractorUser.deleteMany({ where: { userId: subUserId } })
      await prisma.emailVerificationToken.deleteMany({ where: { userId: subUserId } })
      await prisma.user.delete({ where: { id: subUserId } })
    })

    it('should get my assignment for the lot', async () => {
      const res = await request(app)
        .get(`/api/lots/${lotId}/subcontractors/mine`)
        .set('Authorization', `Bearer ${subToken}`)

      expect(res.status).toBe(200)
      expect(res.body.lotId).toBe(lotId)
      expect(res.body.subcontractorCompanyId).toBe(subcontractorCompanyId)
      expect(res.body.subcontractorCompany).toBeDefined()
    })

    it('should return 404 when not assigned to lot', async () => {
      // Create another lot directly in DB
      const unassignedLot = await prisma.lot.create({
        data: {
          projectId,
          lotNumber: `LOT-UNASSIGNED-${Date.now()}`,
          lotType: 'roadworks',
          activityType: 'excavation',
          description: 'Unassigned lot',
        }
      })
      const unassignedLotId = unassignedLot.id

      const res = await request(app)
        .get(`/api/lots/${unassignedLotId}/subcontractors/mine`)
        .set('Authorization', `Bearer ${subToken}`)

      expect(res.status).toBe(404)
      expect(res.body.error).toBe('No assignment found for this lot')

      // Clean up
      await prisma.lot.delete({ where: { id: unassignedLotId } })
    })

    it('should return 404 for non-subcontractor users', async () => {
      const res = await request(app)
        .get(`/api/lots/${lotId}/subcontractors/mine`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(404)
      expect(res.body.error).toBe('Not a subcontractor')
    })

    it('should require authentication', async () => {
      const res = await request(app)
        .get(`/api/lots/${lotId}/subcontractors/mine`)

      expect(res.status).toBe(401)
    })
  })

  describe('PATCH /api/lots/:lotId/subcontractors/:assignmentId - Update Assignment', () => {
    it('should update assignment permissions', async () => {
      const res = await request(app)
        .patch(`/api/lots/${lotId}/subcontractors/${assignmentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          canCompleteITP: false,
          itpRequiresVerification: true,
        })

      expect(res.status).toBe(200)
      expect(res.body.id).toBe(assignmentId)
      expect(res.body.canCompleteITP).toBe(false)
      expect(res.body.itpRequiresVerification).toBe(true)
      expect(res.body.subcontractorCompany).toBeDefined()
    })

    it('should update only canCompleteITP', async () => {
      const res = await request(app)
        .patch(`/api/lots/${lotId}/subcontractors/${assignmentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          canCompleteITP: true,
        })

      expect(res.status).toBe(200)
      expect(res.body.canCompleteITP).toBe(true)
    })

    it('should update only itpRequiresVerification', async () => {
      const res = await request(app)
        .patch(`/api/lots/${lotId}/subcontractors/${assignmentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          itpRequiresVerification: false,
        })

      expect(res.status).toBe(200)
      expect(res.body.itpRequiresVerification).toBe(false)
    })

    it('should return 404 for non-existent assignment', async () => {
      const res = await request(app)
        .patch(`/api/lots/${lotId}/subcontractors/non-existent-assignment-id`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          canCompleteITP: true,
        })

      expect(res.status).toBe(404)
      expect(res.body.error).toBe('Assignment not found')
    })

    it('should reject update without proper role', async () => {
      // Create a user with insufficient role
      const foremanEmail = `foreman-${Date.now()}@example.com`
      const foremanRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: foremanEmail,
          password: 'SecureP@ssword123!',
          fullName: 'Foreman User',
          tosAccepted: true,
        })
      const foremanToken = foremanRes.body.token
      const foremanId = foremanRes.body.user.id

      await prisma.user.update({
        where: { id: foremanId },
        data: { companyId, roleInCompany: 'foreman' }
      })

      await prisma.projectUser.create({
        data: {
          projectId,
          userId: foremanId,
          role: 'foreman',
          status: 'active',
        }
      })

      const res = await request(app)
        .patch(`/api/lots/${lotId}/subcontractors/${assignmentId}`)
        .set('Authorization', `Bearer ${foremanToken}`)
        .send({
          canCompleteITP: true,
        })

      expect(res.status).toBe(403)

      // Clean up
      await prisma.projectUser.deleteMany({ where: { userId: foremanId } })
      await prisma.emailVerificationToken.deleteMany({ where: { userId: foremanId } })
      await prisma.user.delete({ where: { id: foremanId } })
    })

    it('should require authentication', async () => {
      const res = await request(app)
        .patch(`/api/lots/${lotId}/subcontractors/${assignmentId}`)
        .send({
          canCompleteITP: true,
        })

      expect(res.status).toBe(401)
    })
  })

  describe('DELETE /api/lots/:lotId/subcontractors/:assignmentId - Remove Assignment', () => {
    let deletableAssignmentId: string
    let deletableLotId: string

    beforeAll(async () => {
      // Create a lot and assignment to delete directly in DB
      const deletableLot = await prisma.lot.create({
        data: {
          projectId,
          lotNumber: `LOT-DELETE-${Date.now()}`,
          lotType: 'roadworks',
          activityType: 'excavation',
          description: 'Lot for deletion test',
        }
      })
      deletableLotId = deletableLot.id

      const assignRes = await request(app)
        .post(`/api/lots/${deletableLotId}/subcontractors`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          subcontractorCompanyId,
        })
      deletableAssignmentId = assignRes.body.id
    })

    afterAll(async () => {
      await prisma.lotSubcontractorAssignment.deleteMany({ where: { lotId: deletableLotId } })
      await prisma.lot.delete({ where: { id: deletableLotId } })
    })

    it('should soft delete assignment', async () => {
      const res = await request(app)
        .delete(`/api/lots/${deletableLotId}/subcontractors/${deletableAssignmentId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      // Check for success in either format
      expect(res.body.success || res.body.message).toBeDefined()

      // Verify assignment is marked as removed
      const assignment = await prisma.lotSubcontractorAssignment.findUnique({
        where: { id: deletableAssignmentId }
      })
      expect(assignment?.status).toBe('removed')

      // Verify it doesn't appear in active assignments
      const listRes = await request(app)
        .get(`/api/lots/${deletableLotId}/subcontractors`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(listRes.status).toBe(200)
      expect(Array.isArray(listRes.body)).toBe(true)
      expect(listRes.body.length).toBe(0)
    })

    it('should return 404 for non-existent assignment', async () => {
      const res = await request(app)
        .delete(`/api/lots/${lotId}/subcontractors/non-existent-assignment-id`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(404)
      expect(res.body.error).toBe('Assignment not found')
    })

    it('should reject deletion without proper role', async () => {
      // Create a user with insufficient role
      const subcontractorEmail = `sub-delete-${Date.now()}@example.com`
      const subRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: subcontractorEmail,
          password: 'SecureP@ssword123!',
          fullName: 'Subcontractor User',
          tosAccepted: true,
        })
      const subToken = subRes.body.token
      const subId = subRes.body.user.id

      await prisma.user.update({
        where: { id: subId },
        data: { companyId, roleInCompany: 'subcontractor' }
      })

      const res = await request(app)
        .delete(`/api/lots/${lotId}/subcontractors/${assignmentId}`)
        .set('Authorization', `Bearer ${subToken}`)

      expect(res.status).toBe(403)

      // Clean up
      await prisma.emailVerificationToken.deleteMany({ where: { userId: subId } })
      await prisma.user.delete({ where: { id: subId } })
    })

    it('should require authentication', async () => {
      const res = await request(app)
        .delete(`/api/lots/${lotId}/subcontractors/${assignmentId}`)

      expect(res.status).toBe(401)
    })
  })
})

describe('Lot Assignments Role-Based Access', () => {
  let companyId: string
  let projectId: string
  let lotId: string
  let subcontractorCompanyId: string
  let ownerToken: string
  let adminToken: string
  let siteManagerToken: string
  let ownerUserId: string
  let adminUserId: string
  let siteManagerUserId: string

  beforeAll(async () => {
    // Create test company
    const company = await prisma.company.create({
      data: { name: `Role Test Company ${Date.now()}` }
    })
    companyId = company.id

    // Create owner user
    const ownerEmail = `owner-${Date.now()}@example.com`
    const ownerRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: ownerEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Owner User',
        tosAccepted: true,
      })
    ownerToken = ownerRes.body.token
    ownerUserId = ownerRes.body.user.id

    await prisma.user.update({
      where: { id: ownerUserId },
      data: { companyId, roleInCompany: 'owner' }
    })

    // Create admin user
    const adminEmail = `admin-${Date.now()}@example.com`
    const adminRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: adminEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Admin User',
        tosAccepted: true,
      })
    adminToken = adminRes.body.token
    adminUserId = adminRes.body.user.id

    await prisma.user.update({
      where: { id: adminUserId },
      data: { companyId, roleInCompany: 'admin' }
    })

    // Create site manager user
    const siteManagerEmail = `site-manager-${Date.now()}@example.com`
    const siteManagerRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: siteManagerEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Site Manager User',
        tosAccepted: true,
      })
    siteManagerToken = siteManagerRes.body.token
    siteManagerUserId = siteManagerRes.body.user.id

    await prisma.user.update({
      where: { id: siteManagerUserId },
      data: { companyId, roleInCompany: 'site_manager' }
    })

    // Create test project
    const project = await prisma.project.create({
      data: {
        name: `Role Test Project ${Date.now()}`,
        projectNumber: `RTP-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'rms',
      }
    })
    projectId = project.id

    // Add users to project
    await prisma.projectUser.createMany({
      data: [
        { projectId, userId: ownerUserId, role: 'admin', status: 'active' },
        { projectId, userId: adminUserId, role: 'admin', status: 'active' },
        { projectId, userId: siteManagerUserId, role: 'site_manager', status: 'active' },
      ]
    })

    // Create a lot directly in DB
    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `LOT-ROLE-${Date.now()}`,
        lotType: 'roadworks',
        activityType: 'excavation',
        description: 'Lot for role testing',
      }
    })
    lotId = lot.id

    // Create subcontractor
    const subcontractor = await prisma.subcontractorCompany.create({
      data: {
        projectId,
        companyName: `Role Test Sub ${Date.now()}`,
        primaryContactName: 'Sub Contact',
        primaryContactEmail: `role-sub-${Date.now()}@example.com`,
        status: 'approved',
      }
    })
    subcontractorCompanyId = subcontractor.id
  })

  afterAll(async () => {
    // Clean up
    await prisma.lotSubcontractorAssignment.deleteMany({ where: { projectId } })
    await prisma.subcontractorCompany.deleteMany({ where: { projectId } })
    await prisma.lot.deleteMany({ where: { projectId } })
    await prisma.projectUser.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})

    for (const uid of [ownerUserId, adminUserId, siteManagerUserId]) {
      await prisma.emailVerificationToken.deleteMany({ where: { userId: uid } })
      await prisma.user.delete({ where: { id: uid } }).catch(() => {})
    }

    await prisma.company.delete({ where: { id: companyId } }).catch(() => {})
  })

  it('should allow owner to assign subcontractor', async () => {
    const res = await request(app)
      .post(`/api/lots/${lotId}/subcontractors`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ subcontractorCompanyId })

    expect(res.status).toBe(201)

    // Clean up for next test
    await prisma.lotSubcontractorAssignment.deleteMany({
      where: { lotId, subcontractorCompanyId }
    })
  })

  it('should allow admin to assign subcontractor', async () => {
    const res = await request(app)
      .post(`/api/lots/${lotId}/subcontractors`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ subcontractorCompanyId })

    expect(res.status).toBe(201)

    // Clean up for next test
    await prisma.lotSubcontractorAssignment.deleteMany({
      where: { lotId, subcontractorCompanyId }
    })
  })

  it('should allow site_manager to assign subcontractor', async () => {
    const res = await request(app)
      .post(`/api/lots/${lotId}/subcontractors`)
      .set('Authorization', `Bearer ${siteManagerToken}`)
      .send({ subcontractorCompanyId })

    expect(res.status).toBe(201)
  })
})
