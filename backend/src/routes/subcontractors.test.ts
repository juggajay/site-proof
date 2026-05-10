import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { authRouter } from './auth.js';
import { prisma } from '../lib/prisma.js';
import { errorHandler } from '../middleware/errorHandler.js';

// Import subcontractors router
import { subcontractorsRouter } from './subcontractors.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/subcontractors', subcontractorsRouter);
app.use(errorHandler);

const TEST_PASSWORD = 'SecureP@ssword123!';

async function registerTestUser(prefix: string, fullName: string) {
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const res = await request(app).post('/api/auth/register').send({
    email,
    password: TEST_PASSWORD,
    fullName,
    tosAccepted: true,
  });

  return {
    token: res.body.token as string,
    userId: res.body.user.id as string,
  };
}

async function cleanupTestUser(userId: string) {
  await prisma.emailVerificationToken.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
}

describe('Subcontractors API', () => {
  let authToken: string;
  let subcontractorToken: string;
  let userId: string;
  let subcontractorUserId: string;
  let companyId: string;
  let projectId: string;
  let subcontractorCompanyId: string;

  beforeAll(async () => {
    // Create test company
    const company = await prisma.company.create({
      data: { name: `Subcontractors Test Company ${Date.now()}` },
    });
    companyId = company.id;

    // Create head contractor user
    const adminEmail = `sub-admin-${Date.now()}@example.com`;
    const adminRes = await request(app).post('/api/auth/register').send({
      email: adminEmail,
      password: 'SecureP@ssword123!',
      fullName: 'Subcontractor Admin',
      tosAccepted: true,
    });
    authToken = adminRes.body.token;
    userId = adminRes.body.user.id;

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'project_manager' },
    });

    // Create project
    const project = await prisma.project.create({
      data: {
        name: `Subcontractors Test Project ${Date.now()}`,
        projectNumber: `SUB-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    projectId = project.id;

    await prisma.projectUser.create({
      data: { projectId, userId, role: 'project_manager', status: 'active' },
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.notification.deleteMany({ where: { projectId } });
    await prisma.employeeRoster.deleteMany({ where: { subcontractorCompany: { projectId } } });
    await prisma.plantRegister.deleteMany({ where: { subcontractorCompany: { projectId } } });
    await prisma.subcontractorUser.deleteMany({ where: { subcontractorCompany: { projectId } } });
    await prisma.subcontractorCompany.deleteMany({ where: { projectId } });
    await prisma.globalSubcontractor.deleteMany({ where: { organizationId: companyId } });
    await prisma.projectUser.deleteMany({ where: { projectId } });
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {});

    for (const uid of [userId, subcontractorUserId].filter(Boolean)) {
      await prisma.emailVerificationToken.deleteMany({ where: { userId: uid } });
      await prisma.user.delete({ where: { id: uid } }).catch(() => {});
    }

    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  });

  describe('POST /api/subcontractors/invite', () => {
    it('should invite a new subcontractor', async () => {
      const res = await request(app)
        .post('/api/subcontractors/invite')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          companyName: 'Test Subcontractor Co',
          primaryContactName: 'John Sub',
          primaryContactEmail: `sub-invite-${Date.now()}@example.com`,
          primaryContactPhone: '0412345678',
        });

      expect(res.status).toBe(201);
      expect(res.body.subcontractor).toBeDefined();
      expect(res.body.subcontractor.companyName).toBe('Test Subcontractor Co');
      expect(res.body.subcontractor.status).toBe('pending_approval');
      subcontractorCompanyId = res.body.subcontractor.id;
    });

    it('should reject duplicate company name for same project', async () => {
      const res = await request(app)
        .post('/api/subcontractors/invite')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          companyName: 'Test Subcontractor Co',
          primaryContactName: 'Jane Sub',
          primaryContactEmail: `sub-dupe-${Date.now()}@example.com`,
        });

      expect(res.status).toBe(409);
    });

    it('should reject duplicate company names after trimming and case normalization', async () => {
      const res = await request(app)
        .post('/api/subcontractors/invite')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          companyName: '  test subcontractor co  ',
          primaryContactName: 'Case Duplicate',
          primaryContactEmail: `sub-dupe-case-${Date.now()}@example.com`,
        });

      expect(res.status).toBe(409);
    });

    it('should reject malformed invitation contact details', async () => {
      const res = await request(app)
        .post('/api/subcontractors/invite')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          companyName: 'Invalid Contact Subcontractor',
          primaryContactName: 'Invalid Contact',
          primaryContactEmail: 'not-an-email',
        });

      expect(res.status).toBe(400);
    });

    it('should reject invitation without required fields', async () => {
      const res = await request(app)
        .post('/api/subcontractors/invite')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          // Missing companyName, primaryContactName, primaryContactEmail
        });

      expect(res.status).toBe(400);
    });

    it('should reject invitation without projectId', async () => {
      const res = await request(app)
        .post('/api/subcontractors/invite')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          companyName: 'Another Co',
          primaryContactName: 'Test',
          primaryContactEmail: 'test@example.com',
        });

      expect(res.status).toBe(400);
    });

    it('should reject cross-company project managers without project access', async () => {
      const otherCompany = await prisma.company.create({
        data: { name: `Subcontractor Other Company ${Date.now()}` },
      });
      const outsider = await registerTestUser('sub-outsider', 'Subcontractor Outsider');

      await prisma.user.update({
        where: { id: outsider.userId },
        data: { companyId: otherCompany.id, roleInCompany: 'project_manager' },
      });

      try {
        const res = await request(app)
          .post('/api/subcontractors/invite')
          .set('Authorization', `Bearer ${outsider.token}`)
          .send({
            projectId,
            companyName: 'Outsider Subcontractor',
            primaryContactName: 'Outside User',
            primaryContactEmail: `sub-outsider-invite-${Date.now()}@example.com`,
          });

        expect(res.status).toBe(403);
      } finally {
        await cleanupTestUser(outsider.userId);
        await prisma.company.delete({ where: { id: otherCompany.id } }).catch(() => {});
      }
    });

    it('should reject pending project managers', async () => {
      const pending = await registerTestUser('sub-pending', 'Pending Subcontractor PM');
      await prisma.user.update({
        where: { id: pending.userId },
        data: { companyId, roleInCompany: 'project_manager' },
      });
      await prisma.projectUser.create({
        data: { projectId, userId: pending.userId, role: 'project_manager', status: 'pending' },
      });

      try {
        const res = await request(app)
          .post('/api/subcontractors/invite')
          .set('Authorization', `Bearer ${pending.token}`)
          .send({
            projectId,
            companyName: 'Pending PM Subcontractor',
            primaryContactName: 'Pending User',
            primaryContactEmail: `sub-pending-invite-${Date.now()}@example.com`,
          });

        expect(res.status).toBe(403);
      } finally {
        await prisma.projectUser.deleteMany({ where: { projectId, userId: pending.userId } });
        await cleanupTestUser(pending.userId);
      }
    });
  });

  describe('POST /api/subcontractors/validate-abn', () => {
    it('should validate a correct ABN', async () => {
      // Using a known valid ABN format (Australian Tax Office test ABN)
      const res = await request(app)
        .post('/api/subcontractors/validate-abn')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          abn: '51824753556', // Valid test ABN
        });

      expect(res.status).toBe(200);
      expect(res.body.valid).toBeDefined();
    });

    it('should reject invalid ABN', async () => {
      const res = await request(app)
        .post('/api/subcontractors/validate-abn')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          abn: '12345678901', // Invalid checksum
        });

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(false);
      expect(res.body.error).toBeDefined();
    });

    it('should reject ABN with wrong length', async () => {
      const res = await request(app)
        .post('/api/subcontractors/validate-abn')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          abn: '123456',
        });

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(false);
    });

    it('should require ABN field', async () => {
      const res = await request(app)
        .post('/api/subcontractors/validate-abn')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('should reject non-string ABN values', async () => {
      const res = await request(app)
        .post('/api/subcontractors/validate-abn')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ abn: { value: '51824753556' } });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/subcontractors/project/:projectId', () => {
    it('should list subcontractors for project', async () => {
      const res = await request(app)
        .get(`/api/subcontractors/project/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.subcontractors).toBeDefined();
      expect(Array.isArray(res.body.subcontractors)).toBe(true);
      expect(res.body.subcontractors.length).toBeGreaterThan(0);
    });

    it('should reject malformed includeRemoved query parameters', async () => {
      const duplicateIncludeRemovedRes = await request(app)
        .get(`/api/subcontractors/project/${projectId}`)
        .query({ includeRemoved: ['true', 'false'] })
        .set('Authorization', `Bearer ${authToken}`);

      expect(duplicateIncludeRemovedRes.status).toBe(400);
      expect(duplicateIncludeRemovedRes.body.error.message).toContain(
        'includeRemoved query parameter must be a single value',
      );

      const invalidIncludeRemovedRes = await request(app)
        .get(`/api/subcontractors/project/${projectId}?includeRemoved=yes`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(invalidIncludeRemovedRes.status).toBe(400);
      expect(invalidIncludeRemovedRes.body.error.message).toContain(
        'includeRemoved must be true or false',
      );
    });

    it('should reject users without project access', async () => {
      const outsider = await registerTestUser('sub-list-outsider', 'Subcontractor List Outsider');
      await prisma.user.update({
        where: { id: outsider.userId },
        data: { companyId, roleInCompany: 'viewer' },
      });

      try {
        const res = await request(app)
          .get(`/api/subcontractors/project/${projectId}`)
          .set('Authorization', `Bearer ${outsider.token}`);

        expect(res.status).toBe(403);
      } finally {
        await cleanupTestUser(outsider.userId);
      }
    });
  });

  describe('GET /api/subcontractors/for-project/:projectId', () => {
    it('should get subcontractors for project selection', async () => {
      const res = await request(app)
        .get(`/api/subcontractors/for-project/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.subcontractors).toBeDefined();
      expect(Array.isArray(res.body.subcontractors)).toBe(true);
    });

    it('should reject users without project access', async () => {
      const outsider = await registerTestUser(
        'sub-select-outsider',
        'Subcontractor Select Outsider',
      );
      await prisma.user.update({
        where: { id: outsider.userId },
        data: { companyId, roleInCompany: 'viewer' },
      });

      try {
        const res = await request(app)
          .get(`/api/subcontractors/for-project/${projectId}`)
          .set('Authorization', `Bearer ${outsider.token}`);

        expect(res.status).toBe(403);
      } finally {
        await cleanupTestUser(outsider.userId);
      }
    });
  });

  describe('Head contractor management access', () => {
    it('should not grant subcontractor portal users management access through project memberships', async () => {
      const suffix = Date.now();
      const portalUser = await registerTestUser(
        'sub-management-portal',
        'Subcontractor Portal Manager',
      );
      const linkedSubcontractor = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `Linked Portal Subcontractor ${suffix}`,
          primaryContactName: 'Linked Portal User',
          primaryContactEmail: `linked-portal-${suffix}@example.com`,
          status: 'approved',
        },
      });
      const managedSubcontractor = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `Managed Subcontractor ${suffix}`,
          primaryContactName: 'Managed User',
          primaryContactEmail: `managed-sub-${suffix}@example.com`,
          status: 'approved',
        },
      });
      const managedEmployee = await prisma.employeeRoster.create({
        data: {
          subcontractorCompanyId: managedSubcontractor.id,
          name: 'Managed Worker',
          hourlyRate: 50,
          status: 'pending',
        },
      });
      const managedPlant = await prisma.plantRegister.create({
        data: {
          subcontractorCompanyId: managedSubcontractor.id,
          type: 'Excavator',
          description: 'Managed plant',
          dryRate: 120,
          wetRate: 160,
          status: 'pending',
        },
      });

      await prisma.user.update({
        where: { id: portalUser.userId },
        data: { companyId, roleInCompany: 'subcontractor' },
      });
      await prisma.subcontractorUser.create({
        data: {
          userId: portalUser.userId,
          subcontractorCompanyId: linkedSubcontractor.id,
          role: 'admin',
        },
      });
      await prisma.projectUser.create({
        data: {
          projectId,
          userId: portalUser.userId,
          role: 'project_manager',
          status: 'active',
        },
      });

      try {
        const listRes = await request(app)
          .get(`/api/subcontractors/project/${projectId}`)
          .set('Authorization', `Bearer ${portalUser.token}`);
        expect(listRes.status).toBe(403);

        const selectRes = await request(app)
          .get(`/api/subcontractors/for-project/${projectId}`)
          .set('Authorization', `Bearer ${portalUser.token}`);
        expect(selectRes.status).toBe(403);

        const inviteRes = await request(app)
          .post('/api/subcontractors/invite')
          .set('Authorization', `Bearer ${portalUser.token}`)
          .send({
            projectId,
            companyName: `Blocked Managed Invite ${suffix}`,
            primaryContactName: 'Blocked Invite',
            primaryContactEmail: `blocked-managed-invite-${suffix}@example.com`,
          });
        expect(inviteRes.status).toBe(403);

        const statusRes = await request(app)
          .patch(`/api/subcontractors/${managedSubcontractor.id}/status`)
          .set('Authorization', `Bearer ${portalUser.token}`)
          .send({ status: 'suspended' });
        expect(statusRes.status).toBe(403);

        const getPortalAccessRes = await request(app)
          .get(`/api/subcontractors/${managedSubcontractor.id}/portal-access`)
          .set('Authorization', `Bearer ${portalUser.token}`);
        expect(getPortalAccessRes.status).toBe(403);

        const patchPortalAccessRes = await request(app)
          .patch(`/api/subcontractors/${managedSubcontractor.id}/portal-access`)
          .set('Authorization', `Bearer ${portalUser.token}`)
          .send({ portalAccess: { lots: false } });
        expect(patchPortalAccessRes.status).toBe(403);

        const createEmployeeRes = await request(app)
          .post(`/api/subcontractors/${managedSubcontractor.id}/employees`)
          .set('Authorization', `Bearer ${portalUser.token}`)
          .send({ name: 'Blocked Worker', hourlyRate: 45 });
        expect(createEmployeeRes.status).toBe(403);

        const updateEmployeeRes = await request(app)
          .patch(
            `/api/subcontractors/${managedSubcontractor.id}/employees/${managedEmployee.id}/status`,
          )
          .set('Authorization', `Bearer ${portalUser.token}`)
          .send({ status: 'approved' });
        expect(updateEmployeeRes.status).toBe(403);

        const createPlantRes = await request(app)
          .post(`/api/subcontractors/${managedSubcontractor.id}/plant`)
          .set('Authorization', `Bearer ${portalUser.token}`)
          .send({ type: 'Roller', description: 'Blocked plant', dryRate: 90 });
        expect(createPlantRes.status).toBe(403);

        const updatePlantRes = await request(app)
          .patch(`/api/subcontractors/${managedSubcontractor.id}/plant/${managedPlant.id}/status`)
          .set('Authorization', `Bearer ${portalUser.token}`)
          .send({ status: 'approved' });
        expect(updatePlantRes.status).toBe(403);

        await expect(
          prisma.subcontractorCompany.findUnique({
            where: { id: managedSubcontractor.id },
            select: { status: true },
          }),
        ).resolves.toEqual({ status: 'approved' });
        await expect(
          prisma.employeeRoster.findUnique({
            where: { id: managedEmployee.id },
            select: { status: true },
          }),
        ).resolves.toEqual({ status: 'pending' });
        await expect(
          prisma.plantRegister.findUnique({
            where: { id: managedPlant.id },
            select: { status: true },
          }),
        ).resolves.toEqual({ status: 'pending' });
      } finally {
        await prisma.projectUser.deleteMany({ where: { projectId, userId: portalUser.userId } });
        await prisma.subcontractorUser.deleteMany({ where: { userId: portalUser.userId } });
        await prisma.employeeRoster.deleteMany({
          where: { subcontractorCompanyId: managedSubcontractor.id },
        });
        await prisma.plantRegister.deleteMany({
          where: { subcontractorCompanyId: managedSubcontractor.id },
        });
        await prisma.subcontractorCompany.deleteMany({
          where: { id: { in: [linkedSubcontractor.id, managedSubcontractor.id] } },
        });
        await cleanupTestUser(portalUser.userId);
      }
    });
  });

  describe('Route parameter validation', () => {
    it('should reject oversized route parameters before subcontractor lookups', async () => {
      const longId = 's'.repeat(121);
      const validPortalAccess = {
        lots: true,
        itps: false,
        holdPoints: true,
        testResults: false,
        ncrs: false,
        documents: true,
      };

      const checks = [
        {
          label: 'GET public invitation',
          response: await request(app).get(`/api/subcontractors/invitation/${longId}`),
        },
        {
          label: 'GET project subcontractors',
          response: await request(app)
            .get(`/api/subcontractors/project/${longId}`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'GET for-project subcontractors',
          response: await request(app)
            .get(`/api/subcontractors/for-project/${longId}`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'DELETE my-company employee',
          response: await request(app)
            .delete(`/api/subcontractors/my-company/employees/${longId}`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'DELETE my-company plant',
          response: await request(app)
            .delete(`/api/subcontractors/my-company/plant/${longId}`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'PATCH subcontractor status',
          response: await request(app)
            .patch(`/api/subcontractors/${longId}/status`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ status: 'approved' }),
        },
        {
          label: 'DELETE subcontractor',
          response: await request(app)
            .delete(`/api/subcontractors/${longId}`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'PATCH portal access',
          response: await request(app)
            .patch(`/api/subcontractors/${longId}/portal-access`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ portalAccess: validPortalAccess }),
        },
        {
          label: 'GET portal access',
          response: await request(app)
            .get(`/api/subcontractors/${longId}/portal-access`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'POST employee',
          response: await request(app)
            .post(`/api/subcontractors/${longId}/employees`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ name: 'Oversized Param Worker', hourlyRate: 45 }),
        },
        {
          label: 'PATCH employee status',
          response: await request(app)
            .patch(`/api/subcontractors/${subcontractorCompanyId}/employees/${longId}/status`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ status: 'approved' }),
        },
        {
          label: 'POST plant',
          response: await request(app)
            .post(`/api/subcontractors/${longId}/plant`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ type: 'Oversized Param Plant', dryRate: 120 }),
        },
        {
          label: 'PATCH plant status',
          response: await request(app)
            .patch(`/api/subcontractors/${subcontractorCompanyId}/plant/${longId}/status`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ status: 'approved' }),
        },
      ];

      for (const { label, response } of checks) {
        expect(response.status, label).toBe(400);
        expect(response.body.error.message, label).toContain('characters or fewer');
      }
    });
  });

  describe('GET /api/subcontractors/invitation/:id', () => {
    it('should get invitation details (public endpoint)', async () => {
      const res = await request(app).get(
        `/api/subcontractors/invitation/${subcontractorCompanyId}`,
      );

      expect(res.status).toBe(200);
      expect(res.body.invitation).toBeDefined();
      expect(res.body.invitation.companyName).toBe('Test Subcontractor Co');
    });

    it('should return 404 for non-existent invitation', async () => {
      const res = await request(app).get('/api/subcontractors/invitation/non-existent-id');

      expect(res.status).toBe(404);
    });

    it('should not disclose inactive invitation details publicly', async () => {
      const removedSub = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `Removed Public Invite ${Date.now()}`,
          primaryContactName: 'Removed Invite',
          primaryContactEmail: `removed-public-${Date.now()}@example.com`,
          status: 'removed',
        },
      });

      try {
        const res = await request(app).get(`/api/subcontractors/invitation/${removedSub.id}`);

        expect(res.status).toBe(404);
        expect(JSON.stringify(res.body)).not.toContain(removedSub.companyName);
      } finally {
        await prisma.subcontractorCompany.delete({ where: { id: removedSub.id } }).catch(() => {});
      }
    });
  });

  describe('PATCH /api/subcontractors/:id/status', () => {
    it('should update subcontractor status to approved', async () => {
      const res = await request(app)
        .patch(`/api/subcontractors/${subcontractorCompanyId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'approved',
        });

      expect(res.status).toBe(200);
      expect(res.body.subcontractor.status).toBe('approved');
    });

    it('should suspend subcontractor', async () => {
      const res = await request(app)
        .patch(`/api/subcontractors/${subcontractorCompanyId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'suspended',
        });

      expect(res.status).toBe(200);
      expect(res.body.subcontractor.status).toBe('suspended');
    });

    it('should reject invalid status', async () => {
      const res = await request(app)
        .patch(`/api/subcontractors/${subcontractorCompanyId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'invalid_status',
        });

      expect(res.status).toBe(400);
    });

    it('should reject pending project memberships', async () => {
      const pending = await registerTestUser('sub-status-pending', 'Pending Status PM');
      await prisma.user.update({
        where: { id: pending.userId },
        data: { companyId, roleInCompany: 'project_manager' },
      });
      await prisma.projectUser.create({
        data: { projectId, userId: pending.userId, role: 'project_manager', status: 'pending' },
      });

      try {
        const res = await request(app)
          .patch(`/api/subcontractors/${subcontractorCompanyId}/status`)
          .set('Authorization', `Bearer ${pending.token}`)
          .send({
            status: 'approved',
          });

        expect(res.status).toBe(403);
      } finally {
        await prisma.projectUser.deleteMany({ where: { projectId, userId: pending.userId } });
        await cleanupTestUser(pending.userId);
      }
    });

    it('should allow status updates based on active project manager role', async () => {
      const manager = await registerTestUser('sub-status-project-role', 'Project Role Status PM');
      await prisma.user.update({
        where: { id: manager.userId },
        data: { companyId, roleInCompany: 'viewer' },
      });
      await prisma.projectUser.create({
        data: { projectId, userId: manager.userId, role: 'project_manager', status: 'active' },
      });

      try {
        const res = await request(app)
          .patch(`/api/subcontractors/${subcontractorCompanyId}/status`)
          .set('Authorization', `Bearer ${manager.token}`)
          .send({
            status: 'approved',
          });

        expect(res.status).toBe(200);
        expect(res.body.subcontractor.status).toBe('approved');
      } finally {
        await prisma.projectUser.deleteMany({ where: { projectId, userId: manager.userId } });
        await prisma.auditLog.deleteMany({ where: { userId: manager.userId } });
        await cleanupTestUser(manager.userId);
      }
    });

    it('should reject company project managers with viewer project role', async () => {
      const viewer = await registerTestUser('sub-status-viewer-role', 'Viewer Role Status PM');
      await prisma.user.update({
        where: { id: viewer.userId },
        data: { companyId, roleInCompany: 'project_manager' },
      });
      await prisma.projectUser.create({
        data: { projectId, userId: viewer.userId, role: 'viewer', status: 'active' },
      });

      try {
        const res = await request(app)
          .patch(`/api/subcontractors/${subcontractorCompanyId}/status`)
          .set('Authorization', `Bearer ${viewer.token}`)
          .send({
            status: 'approved',
          });

        expect(res.status).toBe(403);
      } finally {
        await prisma.projectUser.deleteMany({ where: { projectId, userId: viewer.userId } });
        await cleanupTestUser(viewer.userId);
      }
    });

    // Reset to approved for further tests
    afterAll(async () => {
      await prisma.subcontractorCompany.update({
        where: { id: subcontractorCompanyId },
        data: { status: 'approved' },
      });
    });
  });

  describe('Portal Access Management', () => {
    it('should get portal access settings', async () => {
      const res = await request(app)
        .get(`/api/subcontractors/${subcontractorCompanyId}/portal-access`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.portalAccess).toBeDefined();
      expect(res.body.portalAccess.lots).toBeDefined();
    });

    it('should update portal access settings', async () => {
      const res = await request(app)
        .patch(`/api/subcontractors/${subcontractorCompanyId}/portal-access`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          portalAccess: {
            lots: true,
            itps: true,
            holdPoints: false,
            testResults: false,
            ncrs: false,
            documents: true,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.portalAccess).toBeDefined();
    });

    it('should reject invalid portal access values', async () => {
      const res = await request(app)
        .patch(`/api/subcontractors/${subcontractorCompanyId}/portal-access`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          portalAccess: {
            lots: 'yes', // Should be boolean
          },
        });

      expect(res.status).toBe(400);
    });

    it('should allow portal access updates based on active project manager role', async () => {
      const manager = await registerTestUser('sub-portal-project-role', 'Project Role Portal PM');
      await prisma.user.update({
        where: { id: manager.userId },
        data: { companyId, roleInCompany: 'viewer' },
      });
      await prisma.projectUser.create({
        data: { projectId, userId: manager.userId, role: 'project_manager', status: 'active' },
      });

      try {
        const res = await request(app)
          .patch(`/api/subcontractors/${subcontractorCompanyId}/portal-access`)
          .set('Authorization', `Bearer ${manager.token}`)
          .send({
            portalAccess: {
              lots: true,
              itps: false,
              holdPoints: true,
              testResults: false,
              ncrs: false,
              documents: true,
            },
          });

        expect(res.status).toBe(200);
        expect(res.body.portalAccess.holdPoints).toBe(true);
      } finally {
        await prisma.projectUser.deleteMany({ where: { projectId, userId: manager.userId } });
        await prisma.auditLog.deleteMany({ where: { userId: manager.userId } });
        await cleanupTestUser(manager.userId);
      }
    });
  });

  describe('Employee Management', () => {
    let employeeId: string;

    it('should add employee to subcontractor', async () => {
      const res = await request(app)
        .post(`/api/subcontractors/${subcontractorCompanyId}/employees`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Worker',
          role: 'Labourer',
          hourlyRate: 42.5,
          phone: '0412345678',
        });

      expect(res.status).toBe(201);
      expect(res.body.employee).toBeDefined();
      expect(res.body.employee.name).toBe('Test Worker');
      expect(res.body.employee.status).toBe('pending');
      employeeId = res.body.employee.id;
    });

    it('should reject employee without name', async () => {
      const res = await request(app)
        .post(`/api/subcontractors/${subcontractorCompanyId}/employees`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          role: 'Labourer',
          hourlyRate: 42.5,
        });

      expect(res.status).toBe(400);
    });

    it('should reject invalid employee rates', async () => {
      const res = await request(app)
        .post(`/api/subcontractors/${subcontractorCompanyId}/employees`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Negative Rate Worker',
          role: 'Labourer',
          hourlyRate: -1,
        });

      expect(res.status).toBe(400);

      const hexRateRes = await request(app)
        .post(`/api/subcontractors/${subcontractorCompanyId}/employees`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Hex Rate Worker',
          role: 'Labourer',
          hourlyRate: '0x10',
        });

      expect(hexRateRes.status).toBe(400);

      const tooManyDecimalsRes = await request(app)
        .post(`/api/subcontractors/${subcontractorCompanyId}/employees`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Precise Rate Worker',
          role: 'Labourer',
          hourlyRate: '42.555',
        });

      expect(tooManyDecimalsRes.status).toBe(400);
    });

    it('should approve employee rate', async () => {
      const res = await request(app)
        .patch(`/api/subcontractors/${subcontractorCompanyId}/employees/${employeeId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'approved',
        });

      expect(res.status).toBe(200);
      expect(res.body.employee.status).toBe('approved');
    });

    it('should counter-propose employee rate', async () => {
      // First reset to pending
      await prisma.employeeRoster.update({
        where: { id: employeeId },
        data: { status: 'pending' },
      });

      const res = await request(app)
        .patch(`/api/subcontractors/${subcontractorCompanyId}/employees/${employeeId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'counter',
          counterRate: 38.0,
        });

      expect(res.status).toBe(200);
      expect(res.body.employee.status).toBe('counter');
    });

    it('should reject counter without counterRate', async () => {
      const res = await request(app)
        .patch(`/api/subcontractors/${subcontractorCompanyId}/employees/${employeeId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'counter',
          // Missing counterRate
        });

      expect(res.status).toBe(400);
    });

    it('should reject invalid employee counter rates', async () => {
      const res = await request(app)
        .patch(`/api/subcontractors/${subcontractorCompanyId}/employees/${employeeId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'counter',
          counterRate: 'not-a-number',
        });

      expect(res.status).toBe(400);

      const tooManyDecimalsRes = await request(app)
        .patch(`/api/subcontractors/${subcontractorCompanyId}/employees/${employeeId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'counter',
          counterRate: '38.999',
        });

      expect(tooManyDecimalsRes.status).toBe(400);
    });
  });

  describe('Plant Management', () => {
    let plantId: string;

    it('should add plant to subcontractor', async () => {
      const res = await request(app)
        .post(`/api/subcontractors/${subcontractorCompanyId}/plant`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'Excavator',
          description: 'CAT 320DL',
          idRego: 'EX-001',
          dryRate: 150,
          wetRate: 180,
        });

      expect(res.status).toBe(201);
      expect(res.body.plant).toBeDefined();
      expect(res.body.plant.type).toBe('Excavator');
      expect(res.body.plant.status).toBe('pending');
      plantId = res.body.plant.id;
    });

    it('should reject plant without type', async () => {
      const res = await request(app)
        .post(`/api/subcontractors/${subcontractorCompanyId}/plant`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Some equipment',
          dryRate: 100,
        });

      expect(res.status).toBe(400);
    });

    it('should reject invalid plant rates', async () => {
      const res = await request(app)
        .post(`/api/subcontractors/${subcontractorCompanyId}/plant`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'Invalid Plant',
          description: 'Bad rate',
          dryRate: -100,
        });

      expect(res.status).toBe(400);

      const scientificRateRes = await request(app)
        .post(`/api/subcontractors/${subcontractorCompanyId}/plant`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'Scientific Rate Plant',
          description: 'Bad rate',
          dryRate: '1e2',
        });

      expect(scientificRateRes.status).toBe(400);

      const tooManyDecimalsRes = await request(app)
        .post(`/api/subcontractors/${subcontractorCompanyId}/plant`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'Precise Rate Plant',
          description: 'Bad rate',
          dryRate: '120.123',
        });

      expect(tooManyDecimalsRes.status).toBe(400);
    });

    it('should approve plant rate', async () => {
      const res = await request(app)
        .patch(`/api/subcontractors/${subcontractorCompanyId}/plant/${plantId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'approved',
        });

      expect(res.status).toBe(200);
      expect(res.body.plant.status).toBe('approved');
    });

    it('should counter-propose plant rate', async () => {
      // Reset to pending
      await prisma.plantRegister.update({
        where: { id: plantId },
        data: { status: 'pending' },
      });

      const res = await request(app)
        .patch(`/api/subcontractors/${subcontractorCompanyId}/plant/${plantId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'counter',
          counterDryRate: 140,
          counterWetRate: 170,
        });

      expect(res.status).toBe(200);
      expect(res.body.plant.status).toBe('counter');
    });

    it('should reject invalid plant counter rates', async () => {
      const res = await request(app)
        .patch(`/api/subcontractors/${subcontractorCompanyId}/plant/${plantId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'counter',
          counterDryRate: -1,
        });

      expect(res.status).toBe(400);

      const tooManyDecimalsRes = await request(app)
        .patch(`/api/subcontractors/${subcontractorCompanyId}/plant/${plantId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'counter',
          counterDryRate: 140,
          counterWetRate: '170.999',
        });

      expect(tooManyDecimalsRes.status).toBe(400);
    });
  });

  describe('Invitation Acceptance', () => {
    let invitationSubId: string;
    let invitationContactEmail: string;

    beforeAll(async () => {
      invitationContactEmail = `accept-${Date.now()}@example.com`;

      // Create a new subcontractor for acceptance testing
      const sub = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `Invite Accept Test ${Date.now()}`,
          primaryContactName: 'Accept Test',
          primaryContactEmail: invitationContactEmail,
          status: 'pending_approval',
        },
      });
      invitationSubId = sub.id;

      // Create a user to accept
      const acceptRes = await request(app).post('/api/auth/register').send({
        email: invitationContactEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Accept User',
        tosAccepted: true,
      });
      subcontractorToken = acceptRes.body.token;
      subcontractorUserId = acceptRes.body.user.id;

      await prisma.user.update({
        where: { id: subcontractorUserId },
        data: { companyId, roleInCompany: 'viewer' },
      });
    });

    it('should reject logged-in users whose email does not match the invitation', async () => {
      const wrongUser = await registerTestUser('sub-wrong-invite', 'Wrong Invite User');

      try {
        const res = await request(app)
          .post(`/api/subcontractors/invitation/${invitationSubId}/accept`)
          .set('Authorization', `Bearer ${wrongUser.token}`);

        expect(res.status).toBe(403);

        const link = await prisma.subcontractorUser.findFirst({
          where: {
            userId: wrongUser.userId,
            subcontractorCompanyId: invitationSubId,
          },
        });
        expect(link).toBeNull();
      } finally {
        await cleanupTestUser(wrongUser.userId);
      }
    });

    it('should reject new-account acceptance for inactive invitations', async () => {
      const suspendedEmail = `suspended-invite-${Date.now()}@example.com`;
      const suspendedSub = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `Suspended Invite ${Date.now()}`,
          primaryContactName: 'Suspended Invite User',
          primaryContactEmail: suspendedEmail,
          status: 'suspended',
        },
      });

      try {
        const res = await request(app).post('/api/auth/register-and-accept-invitation').send({
          email: suspendedEmail,
          password: 'SecureP@ssword123!',
          fullName: 'Suspended Invite User',
          invitationId: suspendedSub.id,
          tosAccepted: true,
        });

        expect(res.status).toBe(403);

        const user = await prisma.user.findUnique({ where: { email: suspendedEmail } });
        expect(user).toBeNull();
      } finally {
        await prisma.subcontractorCompany
          .delete({ where: { id: suspendedSub.id } })
          .catch(() => {});
      }
    });

    it('should reject already-approved invitations without linking or creating users', async () => {
      const approvedEmail = `approved-invite-${Date.now()}@example.com`;
      const approvedNewAccountEmail = `approved-new-invite-${Date.now()}@example.com`;
      const approvedSub = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `Approved Invite ${Date.now()}`,
          primaryContactName: 'Approved Invite User',
          primaryContactEmail: approvedEmail,
          status: 'approved',
        },
      });
      const approvedNewAccountSub = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `Approved New Account Invite ${Date.now()}`,
          primaryContactName: 'Approved New Account Invite User',
          primaryContactEmail: approvedNewAccountEmail,
          status: 'approved',
        },
      });
      const existingUserRes = await request(app).post('/api/auth/register').send({
        email: approvedEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Approved Invite User',
        tosAccepted: true,
      });
      const existingUserId = existingUserRes.body.user.id as string;

      await prisma.user.update({
        where: { id: existingUserId },
        data: { companyId, roleInCompany: 'viewer' },
      });

      try {
        const loggedInRes = await request(app)
          .post(`/api/subcontractors/invitation/${approvedSub.id}/accept`)
          .set('Authorization', `Bearer ${existingUserRes.body.token}`);

        expect(loggedInRes.status).toBe(403);

        const registerRes = await request(app)
          .post('/api/auth/register-and-accept-invitation')
          .send({
            email: approvedNewAccountEmail,
            password: 'SecureP@ssword123!',
            fullName: 'New Approved Invite User',
            invitationId: approvedNewAccountSub.id,
            tosAccepted: true,
          });

        expect(registerRes.status).toBe(403);

        const links = await prisma.subcontractorUser.findMany({
          where: { subcontractorCompanyId: approvedSub.id },
        });
        expect(links).toHaveLength(0);
      } finally {
        await cleanupTestUser(existingUserId);
        await prisma.user.deleteMany({ where: { email: approvedNewAccountEmail } });
        await prisma.subcontractorCompany.delete({ where: { id: approvedSub.id } }).catch(() => {});
        await prisma.subcontractorCompany
          .delete({ where: { id: approvedNewAccountSub.id } })
          .catch(() => {});
      }
    });

    it('should accept invitation and link user', async () => {
      const res = await request(app)
        .post(`/api/subcontractors/invitation/${invitationSubId}/accept`)
        .set('Authorization', `Bearer ${subcontractorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.subcontractor).toBeDefined();
      expect(res.body.subcontractor.status).toBe('approved');

      const acceptedUser = await prisma.user.findUnique({
        where: { id: subcontractorUserId },
        select: { roleInCompany: true },
      });
      expect(acceptedUser?.roleInCompany).toBe('subcontractor_admin');

      const portalRes = await request(app)
        .get('/api/subcontractors/my-company')
        .set('Authorization', `Bearer ${subcontractorToken}`);

      expect(portalRes.status).toBe(200);
      expect(portalRes.body.company.id).toBe(invitationSubId);
    });

    it('should reject duplicate acceptance', async () => {
      const res = await request(app)
        .post(`/api/subcontractors/invitation/${invitationSubId}/accept`)
        .set('Authorization', `Bearer ${subcontractorToken}`);

      expect(res.status).toBe(400);
    });

    afterAll(async () => {
      await prisma.subcontractorUser.deleteMany({
        where: { subcontractorCompanyId: invitationSubId },
      });
      await prisma.subcontractorCompany.delete({ where: { id: invitationSubId } }).catch(() => {});
    });
  });

  describe('Subcontractor Portal (my-company)', () => {
    let portalSubId: string;
    let portalUserId: string;
    let portalToken: string;

    beforeAll(async () => {
      // Create subcontractor company
      const sub = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `Portal Test Co ${Date.now()}`,
          primaryContactName: 'Portal Admin',
          primaryContactEmail: `portal-${Date.now()}@example.com`,
          status: 'approved',
        },
      });
      portalSubId = sub.id;

      // Create and link user
      const portalEmail = `portal-admin-${Date.now()}@example.com`;
      const portalRes = await request(app).post('/api/auth/register').send({
        email: portalEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Portal Admin User',
        tosAccepted: true,
      });
      portalToken = portalRes.body.token;
      portalUserId = portalRes.body.user.id;

      await prisma.user.update({
        where: { id: portalUserId },
        data: { companyId, roleInCompany: 'subcontractor_admin' },
      });

      await prisma.subcontractorUser.create({
        data: {
          userId: portalUserId,
          subcontractorCompanyId: portalSubId,
          role: 'admin',
        },
      });
    });

    it('should get my company details', async () => {
      const res = await request(app)
        .get('/api/subcontractors/my-company')
        .set('Authorization', `Bearer ${portalToken}`);

      expect(res.status).toBe(200);
      expect(res.body.company).toBeDefined();
      expect(res.body.company.companyName).toContain('Portal Test Co');
    });

    it('should block suspended subcontractor portal access and roster mutations', async () => {
      await prisma.subcontractorCompany.update({
        where: { id: portalSubId },
        data: { status: 'suspended' },
      });

      try {
        const myCompanyRes = await request(app)
          .get('/api/subcontractors/my-company')
          .set('Authorization', `Bearer ${portalToken}`);
        expect(myCompanyRes.status).toBe(403);

        const employeeRes = await request(app)
          .post('/api/subcontractors/my-company/employees')
          .set('Authorization', `Bearer ${portalToken}`)
          .send({
            name: 'Suspended Employee',
            role: 'Operator',
            hourlyRate: 55,
          });
        expect(employeeRes.status).toBe(403);

        const plantRes = await request(app)
          .post('/api/subcontractors/my-company/plant')
          .set('Authorization', `Bearer ${portalToken}`)
          .send({
            type: 'Suspended Plant',
            description: 'Suspended plant entry',
            dryRate: 120,
          });
        expect(plantRes.status).toBe(403);

        const portalAccessRes = await request(app)
          .get(`/api/subcontractors/${portalSubId}/portal-access`)
          .set('Authorization', `Bearer ${portalToken}`);
        expect(portalAccessRes.status).toBe(403);
      } finally {
        await prisma.subcontractorCompany.update({
          where: { id: portalSubId },
          data: { status: 'approved' },
        });
      }
    });

    it('should add employee via my-company', async () => {
      const res = await request(app)
        .post('/api/subcontractors/my-company/employees')
        .set('Authorization', `Bearer ${portalToken}`)
        .send({
          name: 'My Employee',
          role: 'Operator',
          hourlyRate: 55,
          phone: '0400000000',
        });

      expect(res.status).toBe(201);
      expect(res.body.employee).toBeDefined();
    });

    it('should reject invalid my-company employee input', async () => {
      const res = await request(app)
        .post('/api/subcontractors/my-company/employees')
        .set('Authorization', `Bearer ${portalToken}`)
        .send({
          name: 'Bad Employee',
          role: 'Operator',
          hourlyRate: -5,
        });

      expect(res.status).toBe(400);
    });

    it('should add plant via my-company', async () => {
      const res = await request(app)
        .post('/api/subcontractors/my-company/plant')
        .set('Authorization', `Bearer ${portalToken}`)
        .send({
          type: 'Truck',
          description: 'Tipper Truck',
          dryRate: 120,
        });

      expect(res.status).toBe(201);
      expect(res.body.plant).toBeDefined();
    });

    it('should reject invalid my-company plant input', async () => {
      const res = await request(app)
        .post('/api/subcontractors/my-company/plant')
        .set('Authorization', `Bearer ${portalToken}`)
        .send({
          type: 'Bad Plant',
          description: 'Invalid wet rate',
          dryRate: 120,
          wetRate: 'nope',
        });

      expect(res.status).toBe(400);
    });

    afterAll(async () => {
      await prisma.employeeRoster.deleteMany({ where: { subcontractorCompanyId: portalSubId } });
      await prisma.plantRegister.deleteMany({ where: { subcontractorCompanyId: portalSubId } });
      await prisma.subcontractorUser.deleteMany({ where: { subcontractorCompanyId: portalSubId } });
      await prisma.subcontractorCompany.delete({ where: { id: portalSubId } }).catch(() => {});
      await prisma.emailVerificationToken.deleteMany({ where: { userId: portalUserId } });
      await prisma.user.delete({ where: { id: portalUserId } }).catch(() => {});
    });
  });

  describe('Global Subcontractor Directory', () => {
    it('should get global subcontractor directory', async () => {
      const res = await request(app)
        .get('/api/subcontractors/directory')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.subcontractors).toBeDefined();
      expect(Array.isArray(res.body.subcontractors)).toBe(true);
    });

    it('should reject subcontractor and viewer access to the global directory', async () => {
      const subcontractor = await registerTestUser('sub-directory-portal', 'Directory Portal User');
      const viewer = await registerTestUser('sub-directory-viewer', 'Directory Viewer User');

      await prisma.user.update({
        where: { id: subcontractor.userId },
        data: { companyId, roleInCompany: 'subcontractor' },
      });
      await prisma.user.update({
        where: { id: viewer.userId },
        data: { companyId, roleInCompany: 'viewer' },
      });

      try {
        const subcontractorRes = await request(app)
          .get('/api/subcontractors/directory')
          .set('Authorization', `Bearer ${subcontractor.token}`);
        expect(subcontractorRes.status).toBe(403);

        const viewerRes = await request(app)
          .get('/api/subcontractors/directory')
          .set('Authorization', `Bearer ${viewer.token}`);
        expect(viewerRes.status).toBe(403);
      } finally {
        await cleanupTestUser(subcontractor.userId);
        await cleanupTestUser(viewer.userId);
      }
    });
  });
});
