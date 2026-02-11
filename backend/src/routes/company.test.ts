import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import { companyRouter } from './company.js'
import { authRouter } from './auth.js'
import { prisma } from '../lib/prisma.js'

const app = express()
app.use(express.json())
app.use('/api/auth', authRouter)
app.use('/api/company', companyRouter)

describe('Company API', () => {
  let authToken: string
  let userId: string
  let companyId: string

  beforeAll(async () => {
    // Create test company
    const company = await prisma.company.create({
      data: {
        name: `Company Test ${Date.now()}`,
        subscriptionTier: 'professional'
      }
    })
    companyId = company.id

    // Create test user
    const testEmail = `company-test-${Date.now()}@example.com`
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Company Test User',
        tosAccepted: true,
      })
    authToken = regRes.body.token
    userId = regRes.body.user.id

    // Update user with company and owner role
    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'owner' }
    })
  })

  afterAll(async () => {
    await prisma.emailVerificationToken.deleteMany({ where: { userId } })
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {})
  })

  describe('GET /api/company', () => {
    it('should get the current user\'s company', async () => {
      const res = await request(app)
        .get('/api/company')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.company).toBeDefined()
      expect(res.body.company.id).toBe(companyId)
      expect(res.body.company.name).toContain('Company Test')
      expect(res.body.company.subscriptionTier).toBe('professional')
    })

    it('should include project count and limit', async () => {
      const res = await request(app)
        .get('/api/company')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.company.projectCount).toBeDefined()
      expect(res.body.company.projectLimit).toBe(10) // professional tier
      expect(typeof res.body.company.projectCount).toBe('number')
    })

    it('should include user count and limit', async () => {
      const res = await request(app)
        .get('/api/company')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.company.userCount).toBeDefined()
      expect(res.body.company.userLimit).toBe(25) // professional tier
      expect(typeof res.body.company.userCount).toBe('number')
    })

    it('should return 404 if user has no company', async () => {
      // Create a user without company
      const noCompanyEmail = `no-company-${Date.now()}@example.com`
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: noCompanyEmail,
          password: 'SecureP@ssword123!',
          fullName: 'No Company User',
          tosAccepted: true,
        })

      const res = await request(app)
        .get('/api/company')
        .set('Authorization', `Bearer ${regRes.body.token}`)

      expect(res.status).toBe(404)
      expect(res.body.message).toContain('No company associated')

      // Cleanup
      await prisma.emailVerificationToken.deleteMany({ where: { userId: regRes.body.user.id } })
      await prisma.user.delete({ where: { id: regRes.body.user.id } })
    })

    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/company')

      expect(res.status).toBe(401)
    })
  })

  describe('PATCH /api/company', () => {
    it('should update company name', async () => {
      const newName = `Updated Company ${Date.now()}`
      const res = await request(app)
        .patch('/api/company')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: newName })

      expect(res.status).toBe(200)
      expect(res.body.message).toContain('updated successfully')
      expect(res.body.company.name).toBe(newName)
    })

    it('should update company ABN', async () => {
      const res = await request(app)
        .patch('/api/company')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ abn: '12345678901' })

      expect(res.status).toBe(200)
      expect(res.body.company.abn).toBe('12345678901')
    })

    it('should update company address', async () => {
      const res = await request(app)
        .patch('/api/company')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ address: '123 Test Street, Sydney NSW 2000' })

      expect(res.status).toBe(200)
      expect(res.body.company.address).toBe('123 Test Street, Sydney NSW 2000')
    })

    it('should update company logo URL', async () => {
      const res = await request(app)
        .patch('/api/company')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ logoUrl: 'https://example.com/logo.png' })

      expect(res.status).toBe(200)
      expect(res.body.company.logoUrl).toBe('https://example.com/logo.png')
    })

    it('should update multiple fields at once', async () => {
      const res = await request(app)
        .patch('/api/company')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: `Multi Update ${Date.now()}`,
          abn: '98765432109',
          address: '456 Another St',
          logoUrl: 'https://example.com/new-logo.png'
        })

      expect(res.status).toBe(200)
      expect(res.body.company.name).toContain('Multi Update')
      expect(res.body.company.abn).toBe('98765432109')
      expect(res.body.company.address).toBe('456 Another St')
      expect(res.body.company.logoUrl).toBe('https://example.com/new-logo.png')
    })

    it('should reject empty company name', async () => {
      const res = await request(app)
        .patch('/api/company')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: '   ' })

      expect(res.status).toBe(400)
      expect(res.body.message).toContain('required')
    })

    it('should trim company name', async () => {
      const res = await request(app)
        .patch('/api/company')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: '  Trimmed Name  ' })

      expect(res.status).toBe(200)
      expect(res.body.company.name).toBe('Trimmed Name')
    })

    it('should allow clearing optional fields', async () => {
      const res = await request(app)
        .patch('/api/company')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          abn: '',
          address: '',
          logoUrl: ''
        })

      expect(res.status).toBe(200)
      expect(res.body.company.abn).toBeNull()
      expect(res.body.company.address).toBeNull()
      expect(res.body.company.logoUrl).toBeNull()
    })

    it('should require authentication', async () => {
      const res = await request(app)
        .patch('/api/company')
        .send({ name: 'Should Fail' })

      expect(res.status).toBe(401)
    })

    it('should reject non-admin/owner users', async () => {
      // Create a member user
      const memberEmail = `member-${Date.now()}@example.com`
      const memberRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: memberEmail,
          password: 'SecureP@ssword123!',
          fullName: 'Member User',
          tosAccepted: true,
        })

      await prisma.user.update({
        where: { id: memberRes.body.user.id },
        data: { companyId, roleInCompany: 'site_manager' }
      })

      const res = await request(app)
        .patch('/api/company')
        .set('Authorization', `Bearer ${memberRes.body.token}`)
        .send({ name: 'Should Fail' })

      expect(res.status).toBe(403)
      expect(res.body.message).toContain('owners and admins')

      // Cleanup
      await prisma.emailVerificationToken.deleteMany({ where: { userId: memberRes.body.user.id } })
      await prisma.user.delete({ where: { id: memberRes.body.user.id } })
    })

    it('should allow admin to update company', async () => {
      // Create an admin user
      const adminEmail = `admin-${Date.now()}@example.com`
      const adminRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: adminEmail,
          password: 'SecureP@ssword123!',
          fullName: 'Admin User',
          tosAccepted: true,
        })

      await prisma.user.update({
        where: { id: adminRes.body.user.id },
        data: { companyId, roleInCompany: 'admin' }
      })

      const res = await request(app)
        .patch('/api/company')
        .set('Authorization', `Bearer ${adminRes.body.token}`)
        .send({ name: `Admin Updated ${Date.now()}` })

      expect(res.status).toBe(200)
      expect(res.body.company.name).toContain('Admin Updated')

      // Cleanup
      await prisma.emailVerificationToken.deleteMany({ where: { userId: adminRes.body.user.id } })
      await prisma.user.delete({ where: { id: adminRes.body.user.id } })
    })

    it('should return 404 if user has no company', async () => {
      // Create a user without company
      const noCompanyEmail = `no-company-patch-${Date.now()}@example.com`
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: noCompanyEmail,
          password: 'SecureP@ssword123!',
          fullName: 'No Company User',
          tosAccepted: true,
        })

      const res = await request(app)
        .patch('/api/company')
        .set('Authorization', `Bearer ${regRes.body.token}`)
        .send({ name: 'Should Fail' })

      expect(res.status).toBe(404)
      expect(res.body.message).toContain('No company associated')

      // Cleanup
      await prisma.emailVerificationToken.deleteMany({ where: { userId: regRes.body.user.id } })
      await prisma.user.delete({ where: { id: regRes.body.user.id } })
    })
  })

  describe('GET /api/company/members', () => {
    let memberId: string
    let memberEmail: string

    beforeAll(async () => {
      // Create a member user
      memberEmail = `member-list-${Date.now()}@example.com`
      const memberRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: memberEmail,
          password: 'SecureP@ssword123!',
          fullName: 'Member List User',
          tosAccepted: true,
        })
      memberId = memberRes.body.user.id

      await prisma.user.update({
        where: { id: memberId },
        data: { companyId, roleInCompany: 'admin' }
      })
    })

    afterAll(async () => {
      await prisma.emailVerificationToken.deleteMany({ where: { userId: memberId } })
      await prisma.user.delete({ where: { id: memberId } }).catch(() => {})
    })

    it('should list all company members for owner', async () => {
      const res = await request(app)
        .get('/api/company/members')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.members).toBeDefined()
      expect(Array.isArray(res.body.members)).toBe(true)
      expect(res.body.members.length).toBeGreaterThanOrEqual(2) // owner + member
    })

    it('should include member details', async () => {
      const res = await request(app)
        .get('/api/company/members')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      const member = res.body.members.find((m: any) => m.email === memberEmail)
      expect(member).toBeDefined()
      expect(member.id).toBeDefined()
      expect(member.fullName).toBe('Member List User')
      expect(member.roleInCompany).toBe('admin')
    })

    it('should sort members by full name', async () => {
      const res = await request(app)
        .get('/api/company/members')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      const names = res.body.members.map((m: any) => m.fullName)
      const sortedNames = [...names].sort()
      expect(names).toEqual(sortedNames)
    })

    it('should reject non-owner users', async () => {
      // Create a non-owner user
      const adminEmail = `admin-list-${Date.now()}@example.com`
      const adminRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: adminEmail,
          password: 'SecureP@ssword123!',
          fullName: 'Admin User',
          tosAccepted: true,
        })

      await prisma.user.update({
        where: { id: adminRes.body.user.id },
        data: { companyId, roleInCompany: 'admin' }
      })

      const res = await request(app)
        .get('/api/company/members')
        .set('Authorization', `Bearer ${adminRes.body.token}`)

      expect(res.status).toBe(403)
      expect(res.body.message).toContain('Only company owners')

      // Cleanup
      await prisma.emailVerificationToken.deleteMany({ where: { userId: adminRes.body.user.id } })
      await prisma.user.delete({ where: { id: adminRes.body.user.id } })
    })

    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/company/members')

      expect(res.status).toBe(401)
    })

    it('should return 404 if user has no company', async () => {
      // Create a user without company
      const noCompanyEmail = `no-company-members-${Date.now()}@example.com`
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: noCompanyEmail,
          password: 'SecureP@ssword123!',
          fullName: 'No Company User',
          tosAccepted: true,
        })

      // Make them owner (for permission check)
      await prisma.user.update({
        where: { id: regRes.body.user.id },
        data: { roleInCompany: 'owner' }
      })

      const res = await request(app)
        .get('/api/company/members')
        .set('Authorization', `Bearer ${regRes.body.token}`)

      expect(res.status).toBe(404)
      expect(res.body.message).toContain('No company associated')

      // Cleanup
      await prisma.emailVerificationToken.deleteMany({ where: { userId: regRes.body.user.id } })
      await prisma.user.delete({ where: { id: regRes.body.user.id } })
    })
  })

  describe('POST /api/company/transfer-ownership', () => {
    let newOwnerId: string
    let newOwnerToken: string
    let transferCompanyId: string

    beforeAll(async () => {
      // Create a separate company for transfer tests
      const company = await prisma.company.create({
        data: { name: `Transfer Test Company ${Date.now()}` }
      })
      transferCompanyId = company.id

      // Create owner
      const ownerEmail = `transfer-owner-${Date.now()}@example.com`
      const ownerRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: ownerEmail,
          password: 'SecureP@ssword123!',
          fullName: 'Transfer Owner',
          tosAccepted: true,
        })

      await prisma.user.update({
        where: { id: ownerRes.body.user.id },
        data: { companyId: transferCompanyId, roleInCompany: 'owner' }
      })

      // Create new owner candidate
      const newOwnerEmail = `new-owner-${Date.now()}@example.com`
      const newOwnerRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: newOwnerEmail,
          password: 'SecureP@ssword123!',
          fullName: 'New Owner',
          tosAccepted: true,
        })
      newOwnerId = newOwnerRes.body.user.id
      newOwnerToken = ownerRes.body.token

      await prisma.user.update({
        where: { id: newOwnerId },
        data: { companyId: transferCompanyId, roleInCompany: 'admin' }
      })
    })

    afterAll(async () => {
      // Cleanup users
      const users = await prisma.user.findMany({
        where: { companyId: transferCompanyId }
      })
      for (const user of users) {
        await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } })
        await prisma.user.delete({ where: { id: user.id } }).catch(() => {})
      }
      await prisma.company.delete({ where: { id: transferCompanyId } }).catch(() => {})
    })

    it('should transfer ownership to another member', async () => {
      const res = await request(app)
        .post('/api/company/transfer-ownership')
        .set('Authorization', `Bearer ${newOwnerToken}`)
        .send({ newOwnerId })

      expect(res.status).toBe(200)
      expect(res.body.message).toContain('transferred successfully')
      expect(res.body.newOwner.id).toBe(newOwnerId)
      expect(res.body.transferredAt).toBeDefined()
    })

    it('should update roles correctly after transfer', async () => {
      // Verify new owner has owner role
      const newOwner = await prisma.user.findUnique({
        where: { id: newOwnerId }
      })
      expect(newOwner?.roleInCompany).toBe('owner')

      // Verify old owner is now admin
      const admins = await prisma.user.findMany({
        where: {
          companyId: transferCompanyId,
          roleInCompany: 'admin'
        }
      })
      expect(admins.length).toBeGreaterThan(0)
    })

    it('should reject transfer without newOwnerId', async () => {
      const res = await request(app)
        .post('/api/company/transfer-ownership')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})

      expect(res.status).toBe(400)
      expect(res.body.message).toContain('New owner ID is required')
    })

    it('should reject transfer to self', async () => {
      const res = await request(app)
        .post('/api/company/transfer-ownership')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ newOwnerId: userId })

      expect(res.status).toBe(400)
      expect(res.body.message).toContain('Cannot transfer ownership to yourself')
    })

    it('should reject transfer to non-member', async () => {
      // Create user in different company
      const otherEmail = `other-company-${Date.now()}@example.com`
      const otherRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: otherEmail,
          password: 'SecureP@ssword123!',
          fullName: 'Other Company User',
          tosAccepted: true,
        })

      const res = await request(app)
        .post('/api/company/transfer-ownership')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ newOwnerId: otherRes.body.user.id })

      expect(res.status).toBe(404)
      expect(res.body.message).toContain('not found in your company')

      // Cleanup
      await prisma.emailVerificationToken.deleteMany({ where: { userId: otherRes.body.user.id } })
      await prisma.user.delete({ where: { id: otherRes.body.user.id } })
    })

    it('should reject non-owner users', async () => {
      // Create admin user
      const adminEmail = `admin-transfer-${Date.now()}@example.com`
      const adminRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: adminEmail,
          password: 'SecureP@ssword123!',
          fullName: 'Admin User',
          tosAccepted: true,
        })

      await prisma.user.update({
        where: { id: adminRes.body.user.id },
        data: { companyId, roleInCompany: 'admin' }
      })

      const res = await request(app)
        .post('/api/company/transfer-ownership')
        .set('Authorization', `Bearer ${adminRes.body.token}`)
        .send({ newOwnerId: userId })

      expect(res.status).toBe(403)
      expect(res.body.message).toContain('Only the company owner')

      // Cleanup
      await prisma.emailVerificationToken.deleteMany({ where: { userId: adminRes.body.user.id } })
      await prisma.user.delete({ where: { id: adminRes.body.user.id } })
    })

    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/company/transfer-ownership')
        .send({ newOwnerId })

      expect(res.status).toBe(401)
    })
  })

  describe('POST /api/company/leave', () => {
    let leaveCompanyId: string
    let leaveUserId: string
    let leaveUserToken: string
    let projectId: string

    beforeAll(async () => {
      // Create company
      const company = await prisma.company.create({
        data: { name: `Leave Test Company ${Date.now()}` }
      })
      leaveCompanyId = company.id

      // Create owner (can't leave)
      const ownerEmail = `leave-owner-${Date.now()}@example.com`
      const ownerRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: ownerEmail,
          password: 'SecureP@ssword123!',
          fullName: 'Leave Owner',
          tosAccepted: true,
        })

      await prisma.user.update({
        where: { id: ownerRes.body.user.id },
        data: { companyId: leaveCompanyId, roleInCompany: 'owner' }
      })

      // Create member (can leave)
      const memberEmail = `leave-member-${Date.now()}@example.com`
      const memberRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: memberEmail,
          password: 'SecureP@ssword123!',
          fullName: 'Leave Member',
          tosAccepted: true,
        })
      leaveUserId = memberRes.body.user.id
      leaveUserToken = memberRes.body.token

      await prisma.user.update({
        where: { id: leaveUserId },
        data: { companyId: leaveCompanyId, roleInCompany: 'admin' }
      })

      // Create a project with the member
      const project = await prisma.project.create({
        data: {
          name: `Leave Test Project ${Date.now()}`,
          projectNumber: `LEAVE-${Date.now()}`,
          companyId: leaveCompanyId,
          status: 'active',
          state: 'NSW',
          specificationSet: 'TfNSW',
        }
      })
      projectId = project.id

      await prisma.projectUser.create({
        data: {
          projectId,
          userId: leaveUserId,
          role: 'admin',
          status: 'active'
        }
      })
    })

    afterAll(async () => {
      // Cleanup
      await prisma.projectUser.deleteMany({ where: { projectId } })
      await prisma.project.delete({ where: { id: projectId } }).catch(() => {})

      const users = await prisma.user.findMany({
        where: { OR: [
          { companyId: leaveCompanyId },
          { id: leaveUserId }
        ]}
      })
      for (const user of users) {
        await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } })
        await prisma.user.delete({ where: { id: user.id } }).catch(() => {})
      }
      await prisma.company.delete({ where: { id: leaveCompanyId } }).catch(() => {})
    })

    it('should allow non-owner to leave company', async () => {
      const res = await request(app)
        .post('/api/company/leave')
        .set('Authorization', `Bearer ${leaveUserToken}`)

      expect(res.status).toBe(200)
      expect(res.body.message).toContain('Successfully left')
      expect(res.body.leftAt).toBeDefined()
    })

    it('should remove company association from user', async () => {
      const user = await prisma.user.findUnique({
        where: { id: leaveUserId }
      })
      expect(user?.companyId).toBeNull()
      expect(user?.roleInCompany).toBe('member') // Reset to default
    })

    it('should remove user from all company projects', async () => {
      const projectUsers = await prisma.projectUser.findMany({
        where: {
          userId: leaveUserId,
          projectId
        }
      })
      expect(projectUsers.length).toBe(0)
    })

    it('should reject owner leaving', async () => {
      const res = await request(app)
        .post('/api/company/leave')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(403)
      expect(res.body.message).toContain('owners cannot leave')
      expect(res.body.message).toContain('transfer ownership')
    })

    it('should reject if user has no company', async () => {
      // Create user without company
      const noCompanyEmail = `no-company-leave-${Date.now()}@example.com`
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: noCompanyEmail,
          password: 'SecureP@ssword123!',
          fullName: 'No Company User',
          tosAccepted: true,
        })

      const res = await request(app)
        .post('/api/company/leave')
        .set('Authorization', `Bearer ${regRes.body.token}`)

      expect(res.status).toBe(400)
      expect(res.body.message).toContain('not a member of any company')

      // Cleanup
      await prisma.emailVerificationToken.deleteMany({ where: { userId: regRes.body.user.id } })
      await prisma.user.delete({ where: { id: regRes.body.user.id } })
    })

    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/company/leave')

      expect(res.status).toBe(401)
    })
  })

  describe('Subscription Tier Limits', () => {
    it('should return correct limits for basic tier', async () => {
      // Create basic tier company
      const basicCompany = await prisma.company.create({
        data: {
          name: `Basic Tier ${Date.now()}`,
          subscriptionTier: 'basic'
        }
      })

      await prisma.user.update({
        where: { id: userId },
        data: { companyId: basicCompany.id }
      })

      const res = await request(app)
        .get('/api/company')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.company.projectLimit).toBe(3)
      expect(res.body.company.userLimit).toBe(5)

      // Restore original company
      await prisma.user.update({
        where: { id: userId },
        data: { companyId }
      })
      await prisma.company.delete({ where: { id: basicCompany.id } })
    })

    it('should return correct limits for enterprise tier', async () => {
      // Create enterprise tier company
      const enterpriseCompany = await prisma.company.create({
        data: {
          name: `Enterprise Tier ${Date.now()}`,
          subscriptionTier: 'enterprise'
        }
      })

      await prisma.user.update({
        where: { id: userId },
        data: { companyId: enterpriseCompany.id }
      })

      const res = await request(app)
        .get('/api/company')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.company.projectLimit).toBe(50)
      expect(res.body.company.userLimit).toBe(100)

      // Restore original company
      await prisma.user.update({
        where: { id: userId },
        data: { companyId }
      })
      await prisma.company.delete({ where: { id: enterpriseCompany.id } })
    })

    it('should return infinity for unlimited tier', async () => {
      // Create unlimited tier company
      const unlimitedCompany = await prisma.company.create({
        data: {
          name: `Unlimited Tier ${Date.now()}`,
          subscriptionTier: 'unlimited'
        }
      })

      await prisma.user.update({
        where: { id: userId },
        data: { companyId: unlimitedCompany.id }
      })

      const res = await request(app)
        .get('/api/company')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      // JSON serializes Infinity as null, so we check the limits are very large or null
      // In practice, Infinity gets serialized as null in JSON
      expect(res.body.company.projectLimit).toBeNull()
      expect(res.body.company.userLimit).toBeNull()

      // Restore original company
      await prisma.user.update({
        where: { id: userId },
        data: { companyId }
      })
      await prisma.company.delete({ where: { id: unlimitedCompany.id } })
    })

    it('should default to basic tier if not set', async () => {
      // Create company without subscription tier
      const noTierCompany = await prisma.company.create({
        data: { name: `No Tier ${Date.now()}` }
      })

      await prisma.user.update({
        where: { id: userId },
        data: { companyId: noTierCompany.id }
      })

      const res = await request(app)
        .get('/api/company')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.company.projectLimit).toBe(3) // basic default
      expect(res.body.company.userLimit).toBe(5) // basic default

      // Restore original company
      await prisma.user.update({
        where: { id: userId },
        data: { companyId }
      })
      await prisma.company.delete({ where: { id: noTierCompany.id } })
    })
  })
})
