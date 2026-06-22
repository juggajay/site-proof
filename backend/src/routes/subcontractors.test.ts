import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { authRouter } from './auth.js';
import { prisma } from '../lib/prisma.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { AuditAction, parseAuditLogChanges } from '../lib/auditLog.js';
import * as emailService from '../lib/email.js';
import { registerTestUser as registerSharedTestUser } from '../test/routeTestHarness.js';

// Import subcontractors router
import { subcontractorsRouter } from './subcontractors.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/subcontractors', subcontractorsRouter);
app.use(errorHandler);

async function registerTestUser(prefix: string, fullName: string) {
  return registerSharedTestUser(app, { emailPrefix: prefix, fullName });
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
    const adminUser = await registerSharedTestUser(app, {
      emailPrefix: 'sub-admin',
      fullName: 'Subcontractor Admin',
      companyId,
      roleInCompany: 'project_manager',
    });
    authToken = adminUser.token;
    userId = adminUser.userId;

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

      const storedInvitation = await prisma.subcontractorCompany.findUnique({
        where: { id: subcontractorCompanyId },
        select: { invitationExpiresAt: true },
      });
      expect(storedInvitation?.invitationExpiresAt).toBeInstanceOf(Date);
      expect(storedInvitation!.invitationExpiresAt!.getTime()).toBeGreaterThan(Date.now());

      const auditLog = await prisma.auditLog.findFirst({
        where: {
          projectId,
          userId,
          entityType: 'subcontractor',
          entityId: subcontractorCompanyId,
          action: AuditAction.SUBCONTRACTOR_INVITED,
        },
      });

      expect(auditLog).toBeTruthy();
      const changes = parseAuditLogChanges(auditLog!.changes) as Record<string, unknown>;
      expect(changes).toMatchObject({
        companyName: 'Test Subcontractor Co',
        primaryContactEmail: expect.stringContaining('@example.com'),
        status: 'pending_approval',
      });
    });

    it('should reject subcontractor invite when the invitation email fails', async () => {
      const email = `sub-email-fail-${Date.now()}@example.com`;
      const companyName = `Email Failure Subcontractor ${Date.now()}`;
      const sendInviteSpy = vi
        .spyOn(emailService, 'sendSubcontractorInvitationEmail')
        .mockResolvedValueOnce({
          success: false,
          error: 'simulated invite email failure',
          errorCode: 'daily_quota_exceeded',
          statusCode: 429,
          provider: 'resend',
        });

      try {
        const res = await request(app)
          .post('/api/subcontractors/invite')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            projectId,
            companyName,
            primaryContactName: 'Email Failure Contact',
            primaryContactEmail: email,
          });

        expect(sendInviteSpy).toHaveBeenCalledTimes(1);
        expect(res.status).toBe(503);
        expect(res.body.error.message).toContain('daily sending quota has been reached');
        expect(res.body.error.code).toBe('EXTERNAL_SERVICE_ERROR');
        expect(res.body.error.details).toEqual({
          provider: 'resend',
          reason: 'quota_exceeded',
        });

        const lingeringInvite = await prisma.subcontractorCompany.findFirst({
          where: { projectId, primaryContactEmail: email },
        });
        expect(lingeringInvite).toBeNull();

        const lingeringGlobal = await prisma.globalSubcontractor.findFirst({
          where: { organizationId: companyId, primaryContactEmail: email },
        });
        expect(lingeringGlobal).toBeNull();

        const lingeringAuditLog = await prisma.auditLog.findFirst({
          where: {
            projectId,
            entityType: 'subcontractor',
            action: AuditAction.SUBCONTRACTOR_INVITED,
            changes: { contains: companyName },
          },
        });
        expect(lingeringAuditLog).toBeNull();
      } finally {
        sendInviteSpy.mockRestore();
      }
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

    it('should count explicit lot assignments for each subcontractor', async () => {
      const suffix = Date.now();
      const assignedSubcontractor = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `Assigned Lot Subcontractor ${suffix}`,
          primaryContactName: 'Assigned Lot Contact',
          primaryContactEmail: `assigned-lot-sub-${suffix}@example.com`,
          status: 'approved',
        },
      });
      const assignedLot = await prisma.lot.create({
        data: {
          projectId,
          lotNumber: `SUB-ASSIGN-${suffix}`,
          lotType: 'roadworks',
          activityType: 'earthworks',
          description: 'Lot assigned through the explicit assignment table',
        },
      });
      await prisma.lotSubcontractorAssignment.create({
        data: {
          projectId,
          lotId: assignedLot.id,
          subcontractorCompanyId: assignedSubcontractor.id,
          assignedById: userId,
          status: 'active',
        },
      });

      const res = await request(app)
        .get(`/api/subcontractors/project/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      const row = res.body.subcontractors.find(
        (sub: { id: string }) => sub.id === assignedSubcontractor.id,
      );
      expect(row).toBeDefined();
      expect(row.assignedLotCount).toBe(1);
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
        data: { companyId: null, roleInCompany: 'subcontractor' },
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
      const storedInvitation = await prisma.subcontractorCompany.findUniqueOrThrow({
        where: { id: subcontractorCompanyId },
        select: { primaryContactEmail: true, primaryContactName: true },
      });

      const res = await request(app).get(
        `/api/subcontractors/invitation/${subcontractorCompanyId}`,
      );

      expect(res.status).toBe(200);
      expect(res.body.invitation).toBeDefined();
      expect(res.body.invitation.companyName).toBe('Test Subcontractor Co');
      expect(res.body.invitation.primaryContactEmail).toBe('');
      expect(res.body.invitation.primaryContactName).toBe('');
      expect(res.body.invitation.primaryContactEmailMasked).toMatch(/^\w\*\*\*@/);
      expect(storedInvitation.primaryContactEmail).toBeTruthy();
      expect(storedInvitation.primaryContactName).toBeTruthy();
      const invitationPayload = JSON.stringify(res.body.invitation);
      expect(invitationPayload).not.toContain(storedInvitation.primaryContactEmail!);
      expect(invitationPayload).not.toContain(storedInvitation.primaryContactName!);
      expect(res.body.invitation.expiresAt).toBeDefined();
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

    it('should not disclose expired invitation details publicly', async () => {
      const expiredSub = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `Expired Public Invite ${Date.now()}`,
          primaryContactName: 'Expired Invite',
          primaryContactEmail: `expired-public-${Date.now()}@example.com`,
          status: 'pending_approval',
          invitationExpiresAt: new Date(Date.now() - 60_000),
        },
      });

      try {
        const res = await request(app).get(`/api/subcontractors/invitation/${expiredSub.id}`);

        expect(res.status).toBe(404);
        expect(JSON.stringify(res.body)).not.toContain(expiredSub.companyName);
      } finally {
        await prisma.subcontractorCompany.delete({ where: { id: expiredSub.id } }).catch(() => {});
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

  describe('DELETE /api/subcontractors/:id', () => {
    it('should reject permanent delete unless the subcontractor has been removed first', async () => {
      const activeSubcontractor = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `Active Delete Guard ${Date.now()}`,
          primaryContactName: 'Active Delete Guard',
          primaryContactEmail: `active-delete-guard-${Date.now()}@example.com`,
          status: 'approved',
        },
      });

      try {
        const res = await request(app)
          .delete(`/api/subcontractors/${activeSubcontractor.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(409);
        expect(res.body.error.message).toContain('removed');

        const stored = await prisma.subcontractorCompany.findUnique({
          where: { id: activeSubcontractor.id },
          select: { status: true },
        });
        expect(stored?.status).toBe('approved');
      } finally {
        await prisma.subcontractorCompany
          .delete({ where: { id: activeSubcontractor.id } })
          .catch(() => {});
      }
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
      const portalAccess = {
        lots: true,
        itps: true,
        holdPoints: false,
        testResults: false,
        ncrs: false,
        documents: true,
      };

      const res = await request(app)
        .patch(`/api/subcontractors/${subcontractorCompanyId}/portal-access`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ portalAccess });

      expect(res.status).toBe(200);
      expect(res.body.portalAccess).toBeDefined();
      expect(res.body.portalAccess).toMatchObject(portalAccess);

      const auditLog = await prisma.auditLog.findFirst({
        where: {
          projectId,
          userId,
          entityType: 'subcontractor',
          entityId: subcontractorCompanyId,
          action: AuditAction.SUBCONTRACTOR_PORTAL_ACCESS_CHANGED,
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(auditLog).toBeTruthy();
      const changes = parseAuditLogChanges(auditLog!.changes) as {
        portalAccess: Record<string, boolean>;
        companyName: string;
      };
      expect(changes.companyName).toBe('Test Subcontractor Co');
      expect(changes.portalAccess).toMatchObject(portalAccess);
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
    });

    it('should offer an email-mismatch confirmation instead of hard-blocking logged-in users', async () => {
      const wrongUser = await registerTestUser('sub-wrong-invite', 'Wrong Invite User');

      try {
        const res = await request(app)
          .post(`/api/subcontractors/invitation/${invitationSubId}/accept`)
          .set('Authorization', `Bearer ${wrongUser.token}`);

        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('EMAIL_MISMATCH');
        // The invited address is masked so it is not leaked to a different account.
        expect(res.body.error.details.invitedEmailMasked).toBe(
          `${invitationContactEmail[0]}***@${invitationContactEmail.split('@')[1]}`,
        );
        expect(res.body.error.details.invitedEmailMasked).not.toBe(invitationContactEmail);

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

    it('should accept a mismatched-email invitation once the user acknowledges it', async () => {
      const ackEmail = `mismatch-ack-${Date.now()}@example.com`;
      const ackSub = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `Mismatch Ack Invite ${Date.now()}`,
          primaryContactName: 'Mismatch Ack User',
          primaryContactEmail: ackEmail,
          status: 'pending_approval',
        },
      });
      // A logged-in account whose email differs from the invited contact email.
      const wrongUser = await registerTestUser('sub-mismatch-ack', 'Mismatch Ack User');

      try {
        const res = await request(app)
          .post(`/api/subcontractors/invitation/${ackSub.id}/accept`)
          .set('Authorization', `Bearer ${wrongUser.token}`)
          .send({ acknowledgeEmailMismatch: true });

        expect(res.status).toBe(200);
        expect(res.body.subcontractor.status).toBe('approved');

        // Link created exactly as for a matching-email acceptance.
        const link = await prisma.subcontractorUser.findFirst({
          where: { userId: wrongUser.userId, subcontractorCompanyId: ackSub.id },
        });
        expect(link).not.toBeNull();
        expect(link?.role).toBe('admin');
      } finally {
        await prisma.subcontractorUser.deleteMany({ where: { subcontractorCompanyId: ackSub.id } });
        await cleanupTestUser(wrongUser.userId);
        await prisma.subcontractorCompany.delete({ where: { id: ackSub.id } }).catch(() => {});
      }
    });

    it('should keep register-and-accept strict on email mismatch (no self-service override)', async () => {
      const invitedEmail = `register-mismatch-invited-${Date.now()}@example.com`;
      const typedEmail = `register-mismatch-typed-${Date.now()}@example.com`;
      const mismatchSub = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `Register Mismatch Invite ${Date.now()}`,
          primaryContactName: 'Register Mismatch User',
          primaryContactEmail: invitedEmail,
          status: 'pending_approval',
        },
      });

      try {
        const res = await request(app).post('/api/auth/register-and-accept-invitation').send({
          email: typedEmail,
          password: 'SecureP@ssword123!',
          fullName: 'Register Mismatch User',
          invitationId: mismatchSub.id,
          tosAccepted: true,
        });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('Email does not match the invitation');

        const createdUser = await prisma.user.findUnique({ where: { email: typedEmail } });
        expect(createdUser).toBeNull();
      } finally {
        await prisma.user.deleteMany({ where: { email: typedEmail } });
        await prisma.subcontractorCompany.delete({ where: { id: mismatchSub.id } }).catch(() => {});
      }
    });

    it('should return only the logged-in user pending invitation for in-app acceptance', async () => {
      const res = await request(app)
        .get('/api/subcontractors/my-pending-invitation')
        .set('Authorization', `Bearer ${subcontractorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.invitation).toMatchObject({
        id: invitationSubId,
        companyName: expect.stringContaining('Invite Accept Test'),
        primaryContactEmail: invitationContactEmail,
        status: 'pending_approval',
      });
      expect(res.body.invitation.projectName).toBeDefined();
      expect(res.body.invitation.headContractorName).toBeDefined();
    });

    it('should return head-contractor-approved invitations that still need user acceptance', async () => {
      const approvedEmail = `approved-pending-user-${Date.now()}@example.com`;
      const approvedSub = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `Approved Waiting User ${Date.now()}`,
          primaryContactName: 'Approved Waiting User',
          primaryContactEmail: approvedEmail,
          status: 'approved',
          approvedById: userId,
          approvedAt: new Date(),
        },
      });
      const userRes = await request(app).post('/api/auth/register').send({
        email: approvedEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Approved Waiting User',
        tosAccepted: true,
      });
      const tempUserId = userRes.body.user.id as string;

      try {
        const res = await request(app)
          .get('/api/subcontractors/my-pending-invitation')
          .set('Authorization', `Bearer ${userRes.body.token}`);

        expect(res.status).toBe(200);
        expect(res.body.invitation).toMatchObject({
          id: approvedSub.id,
          companyName: expect.stringContaining('Approved Waiting User'),
          primaryContactEmail: approvedEmail,
          status: 'approved',
        });
      } finally {
        await cleanupTestUser(tempUserId);
        await prisma.subcontractorCompany.delete({ where: { id: approvedSub.id } }).catch(() => {});
      }
    });

    it('should not leak another subcontractor pending invitation to the wrong user', async () => {
      const wrongUser = await registerTestUser('sub-pending-invite-outsider', 'Pending Outsider');

      try {
        const res = await request(app)
          .get('/api/subcontractors/my-pending-invitation')
          .set('Authorization', `Bearer ${wrongUser.token}`);

        expect(res.status).toBe(200);
        expect(res.body.invitation).toBeNull();
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

    it('should reject new-account acceptance for expired invitations', async () => {
      const expiredEmail = `expired-new-invite-${Date.now()}@example.com`;
      const expiredSub = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `Expired New Account Invite ${Date.now()}`,
          primaryContactName: 'Expired New Invite User',
          primaryContactEmail: expiredEmail,
          status: 'pending_approval',
          invitationExpiresAt: new Date(Date.now() - 60_000),
        },
      });

      try {
        const res = await request(app).post('/api/auth/register-and-accept-invitation').send({
          email: expiredEmail,
          password: 'SecureP@ssword123!',
          fullName: 'Expired New Invite User',
          invitationId: expiredSub.id,
          tosAccepted: true,
        });

        expect(res.status).toBe(404);

        const user = await prisma.user.findUnique({ where: { email: expiredEmail } });
        expect(user).toBeNull();
      } finally {
        await prisma.subcontractorCompany.delete({ where: { id: expiredSub.id } }).catch(() => {});
      }
    });

    it('should accept already-approved invitations when no portal user is linked yet', async () => {
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

      try {
        const loggedInRes = await request(app)
          .post(`/api/subcontractors/invitation/${approvedSub.id}/accept`)
          .set('Authorization', `Bearer ${existingUserRes.body.token}`);

        expect(loggedInRes.status).toBe(200);
        expect(loggedInRes.body.subcontractor.status).toBe('approved');

        const registerRes = await request(app)
          .post('/api/auth/register-and-accept-invitation')
          .send({
            email: approvedNewAccountEmail,
            password: 'SecureP@ssword123!',
            fullName: 'New Approved Invite User',
            invitationId: approvedNewAccountSub.id,
            tosAccepted: true,
          });

        expect(registerRes.status).toBe(201);

        const links = await prisma.subcontractorUser.findMany({
          where: { subcontractorCompanyId: { in: [approvedSub.id, approvedNewAccountSub.id] } },
        });
        expect(links).toHaveLength(2);
      } finally {
        await cleanupTestUser(existingUserId);
        await prisma.user.deleteMany({ where: { email: approvedNewAccountEmail } });
        await prisma.subcontractorCompany.delete({ where: { id: approvedSub.id } }).catch(() => {});
        await prisma.subcontractorCompany
          .delete({ where: { id: approvedNewAccountSub.id } })
          .catch(() => {});
      }
    });

    it('allows only one concurrent user to claim an already-approved invitation', async () => {
      const approvedSub = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `Approved Race Invite ${Date.now()}`,
          primaryContactName: 'Approved Race Invite User',
          status: 'approved',
        },
      });
      const firstUser = await registerTestUser('approved-race-a', 'Approved Race User A');
      const secondUser = await registerTestUser('approved-race-b', 'Approved Race User B');

      await prisma.$executeRaw`
        CREATE OR REPLACE FUNCTION test_delay_subcontractor_invite_accept_insert()
        RETURNS trigger AS $$
        BEGIN
          PERFORM pg_sleep(0.2);
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `;
      await prisma.$executeRaw`
        DROP TRIGGER IF EXISTS test_delay_subcontractor_invite_accept_insert_trigger
        ON subcontractor_users
      `;
      await prisma.$executeRaw`
        CREATE TRIGGER test_delay_subcontractor_invite_accept_insert_trigger
        BEFORE INSERT ON subcontractor_users
        FOR EACH ROW
        EXECUTE FUNCTION test_delay_subcontractor_invite_accept_insert();
      `;

      try {
        const responses = await Promise.all([
          request(app)
            .post(`/api/subcontractors/invitation/${approvedSub.id}/accept`)
            .set('Authorization', `Bearer ${firstUser.token}`),
          request(app)
            .post(`/api/subcontractors/invitation/${approvedSub.id}/accept`)
            .set('Authorization', `Bearer ${secondUser.token}`),
        ]);

        expect(responses.map((res) => res.status).sort((a, b) => a - b)).toEqual([200, 400]);
        expect(
          responses.some((res) =>
            String(res.body.error?.message ?? '').includes('already been accepted'),
          ),
        ).toBe(true);

        const links = await prisma.subcontractorUser.findMany({
          where: { subcontractorCompanyId: approvedSub.id },
          select: { userId: true },
        });
        expect(links).toHaveLength(1);
        expect([firstUser.userId, secondUser.userId]).toContain(links[0]?.userId);
      } finally {
        await prisma.$executeRaw`
          DROP TRIGGER IF EXISTS test_delay_subcontractor_invite_accept_insert_trigger
          ON subcontractor_users
        `;
        await prisma.$executeRaw`
          DROP FUNCTION IF EXISTS test_delay_subcontractor_invite_accept_insert()
        `;
        await prisma.subcontractorUser.deleteMany({
          where: { subcontractorCompanyId: approvedSub.id },
        });
        await cleanupTestUser(firstUser.userId);
        await cleanupTestUser(secondUser.userId);
        await prisma.subcontractorCompany.delete({ where: { id: approvedSub.id } }).catch(() => {});
      }
    });

    it('allows only one concurrent new account to claim an approved invitation', async () => {
      const publicEmail = `approved-public-race-${Date.now()}@example.com`;
      const approvedSub = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `Approved Public Race Invite ${Date.now()}`,
          primaryContactName: 'Approved Public Race Invite User',
          primaryContactEmail: publicEmail,
          status: 'approved',
        },
      });

      await prisma.$executeRaw`
        CREATE OR REPLACE FUNCTION test_delay_public_subcontractor_invite_accept_user_insert()
        RETURNS trigger AS $$
        BEGIN
          PERFORM pg_sleep(0.2);
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `;
      await prisma.$executeRaw`
        DROP TRIGGER IF EXISTS test_delay_public_subcontractor_invite_accept_user_insert_trigger
        ON users
      `;
      await prisma.$executeRaw`
        CREATE TRIGGER test_delay_public_subcontractor_invite_accept_user_insert_trigger
        BEFORE INSERT ON users
        FOR EACH ROW
        EXECUTE FUNCTION test_delay_public_subcontractor_invite_accept_user_insert();
      `;

      try {
        const responses = await Promise.all([
          request(app).post('/api/auth/register-and-accept-invitation').send({
            email: publicEmail,
            password: 'SecureP@ssword123!',
            fullName: 'Approved Public Race User',
            invitationId: approvedSub.id,
            tosAccepted: true,
          }),
          request(app).post('/api/auth/register-and-accept-invitation').send({
            email: publicEmail,
            password: 'SecureP@ssword123!',
            fullName: 'Approved Public Race User',
            invitationId: approvedSub.id,
            tosAccepted: true,
          }),
        ]);

        expect(responses.map((res) => res.status).sort((a, b) => a - b)).toEqual([201, 400]);

        const users = await prisma.user.findMany({
          where: { email: publicEmail },
          select: { id: true },
        });
        expect(users).toHaveLength(1);

        const links = await prisma.subcontractorUser.findMany({
          where: { subcontractorCompanyId: approvedSub.id },
          select: { userId: true },
        });
        expect(links).toEqual([{ userId: users[0]!.id }]);
      } finally {
        await prisma.$executeRaw`
          DROP TRIGGER IF EXISTS test_delay_public_subcontractor_invite_accept_user_insert_trigger
          ON users
        `;
        await prisma.$executeRaw`
          DROP FUNCTION IF EXISTS test_delay_public_subcontractor_invite_accept_user_insert()
        `;
        await prisma.subcontractorUser.deleteMany({
          where: { subcontractorCompanyId: approvedSub.id },
        });
        const users = await prisma.user.findMany({
          where: { email: publicEmail },
          select: { id: true },
        });
        for (const publicUser of users) {
          await cleanupTestUser(publicUser.id);
        }
        await prisma.subcontractorCompany.delete({ where: { id: approvedSub.id } }).catch(() => {});
      }
    });

    it('should reject already-approved invitations that are linked to another portal user', async () => {
      const linkedEmail = `approved-linked-invite-${Date.now()}@example.com`;
      const linkedSub = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `Approved Linked Invite ${Date.now()}`,
          primaryContactName: 'Approved Linked Invite User',
          primaryContactEmail: linkedEmail,
          status: 'approved',
        },
      });
      const linkedUser = await registerTestUser('approved-linked-existing', 'Approved Linked User');
      const invitedUser = await request(app).post('/api/auth/register').send({
        email: linkedEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Approved Linked Invite User',
        tosAccepted: true,
      });
      const invitedUserId = invitedUser.body.user.id as string;

      await prisma.subcontractorUser.create({
        data: {
          subcontractorCompanyId: linkedSub.id,
          userId: linkedUser.userId,
          role: 'admin',
        },
      });

      try {
        const res = await request(app)
          .post(`/api/subcontractors/invitation/${linkedSub.id}/accept`)
          .set('Authorization', `Bearer ${invitedUser.body.token}`);

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('already been accepted');
      } finally {
        await prisma.subcontractorUser.deleteMany({
          where: { subcontractorCompanyId: linkedSub.id },
        });
        await cleanupTestUser(invitedUserId);
        await cleanupTestUser(linkedUser.userId);
        await prisma.subcontractorCompany.delete({ where: { id: linkedSub.id } }).catch(() => {});
      }
    });

    it('should reject logged-in acceptance for expired invitations without linking the user', async () => {
      const expiredEmail = `expired-existing-invite-${Date.now()}@example.com`;
      const expiredSub = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `Expired Existing Invite ${Date.now()}`,
          primaryContactName: 'Expired Existing Invite User',
          primaryContactEmail: expiredEmail,
          status: 'pending_approval',
          invitationExpiresAt: new Date(Date.now() - 60_000),
        },
      });
      const userRes = await request(app).post('/api/auth/register').send({
        email: expiredEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Expired Existing Invite User',
        tosAccepted: true,
      });
      const tempUserId = userRes.body.user.id as string;

      try {
        const res = await request(app)
          .post(`/api/subcontractors/invitation/${expiredSub.id}/accept`)
          .set('Authorization', `Bearer ${userRes.body.token}`);

        expect(res.status).toBe(404);

        const link = await prisma.subcontractorUser.findFirst({
          where: {
            subcontractorCompanyId: expiredSub.id,
            userId: tempUserId,
          },
        });
        expect(link).toBeNull();

        const unchangedSub = await prisma.subcontractorCompany.findUnique({
          where: { id: expiredSub.id },
          select: { status: true },
        });
        expect(unchangedSub?.status).toBe('pending_approval');
      } finally {
        await cleanupTestUser(tempUserId);
        await prisma.subcontractorCompany.delete({ where: { id: expiredSub.id } }).catch(() => {});
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

    it('should reject head-contractor company users from accepting subcontractor invitations', async () => {
      const suffix = Date.now();
      const preservedUser = await registerTestUser('hc-invite-reject', 'HC Invite Reject User');
      const preservedSub = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `HC Invite Reject ${suffix}`,
          primaryContactName: 'HC Invite Reject User',
          primaryContactEmail: preservedUser.email,
          status: 'pending_approval',
        },
      });

      await prisma.user.update({
        where: { id: preservedUser.userId },
        data: { companyId, roleInCompany: 'owner' },
      });

      try {
        const acceptRes = await request(app)
          .post(`/api/subcontractors/invitation/${preservedSub.id}/accept`)
          .set('Authorization', `Bearer ${preservedUser.token}`);

        expect(acceptRes.status).toBe(403);
        expect(acceptRes.body.error.message).toContain(
          'Head contractor company accounts cannot accept subcontractor invitations',
        );

        const acceptedUser = await prisma.user.findUnique({
          where: { id: preservedUser.userId },
          select: { companyId: true, roleInCompany: true },
        });
        expect(acceptedUser?.companyId).toBe(companyId);
        expect(acceptedUser?.roleInCompany).toBe('owner');

        const links = await prisma.subcontractorUser.findMany({
          where: {
            subcontractorCompanyId: preservedSub.id,
            userId: preservedUser.userId,
          },
        });
        expect(links).toHaveLength(0);

        const unchangedSub = await prisma.subcontractorCompany.findUnique({
          where: { id: preservedSub.id },
          select: { status: true },
        });
        expect(unchangedSub?.status).toBe('pending_approval');
      } finally {
        await prisma.subcontractorUser.deleteMany({
          where: { subcontractorCompanyId: preservedSub.id },
        });
        await prisma.subcontractorCompany
          .delete({ where: { id: preservedSub.id } })
          .catch(() => {});
        await cleanupTestUser(preservedUser.userId);
      }
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
        data: { companyId: null, roleInCompany: 'subcontractor_admin' },
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
      expect(res.body.company.availableProjects).toEqual([
        expect.objectContaining({
          projectId,
          companyName: expect.stringContaining('Portal Test Co'),
        }),
      ]);
    });

    it('should resolve my-company for requested and newest linked projects', async () => {
      const suffix = Date.now();
      const otherProject = await prisma.project.create({
        data: {
          companyId,
          name: `Portal Other Project ${suffix}`,
          projectNumber: `PORTAL-OTHER-${suffix}`,
          status: 'active',
          state: 'NSW',
          specificationSet: 'TfNSW',
        },
      });
      const otherSub = await prisma.subcontractorCompany.create({
        data: {
          projectId: otherProject.id,
          companyName: `Portal Requested Project Co ${suffix}`,
          primaryContactEmail: `portal-requested-${suffix}@example.com`,
          status: 'approved',
        },
      });
      await prisma.subcontractorUser.create({
        data: {
          userId: portalUserId,
          subcontractorCompanyId: otherSub.id,
          role: 'admin',
        },
      });

      try {
        const res = await request(app)
          .get(`/api/subcontractors/my-company?projectId=${otherProject.id}`)
          .set('Authorization', `Bearer ${portalToken}`);

        expect(res.status).toBe(200);
        expect(res.body.company.projectId).toBe(otherProject.id);
        expect(res.body.company.companyName).toBe(otherSub.companyName);
        expect(res.body.company.availableProjects).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ projectId }),
            expect.objectContaining({ projectId: otherProject.id }),
          ]),
        );

        const defaultRes = await request(app)
          .get('/api/subcontractors/my-company')
          .set('Authorization', `Bearer ${portalToken}`);

        expect(defaultRes.status).toBe(200);
        expect(defaultRes.body.company.projectId).toBe(otherProject.id);
      } finally {
        await prisma.subcontractorUser.deleteMany({
          where: { subcontractorCompanyId: otherSub.id },
        });
        await prisma.subcontractorCompany.delete({ where: { id: otherSub.id } }).catch(() => {});
        await prisma.project.delete({ where: { id: otherProject.id } }).catch(() => {});
      }
    });

    it('should add employee rates to the requested project-scoped subcontractor company', async () => {
      const suffix = Date.now();
      const otherProject = await prisma.project.create({
        data: {
          companyId,
          name: `Portal Rate Other Project ${suffix}`,
          projectNumber: `PORTAL-RATE-${suffix}`,
          status: 'active',
          state: 'NSW',
          specificationSet: 'TfNSW',
        },
      });
      const otherSub = await prisma.subcontractorCompany.create({
        data: {
          projectId: otherProject.id,
          companyName: `Portal Rate Other Co ${suffix}`,
          primaryContactEmail: `portal-rate-${suffix}@example.com`,
          status: 'approved',
        },
      });
      await prisma.subcontractorUser.create({
        data: {
          userId: portalUserId,
          subcontractorCompanyId: otherSub.id,
          role: 'admin',
        },
      });

      const employeeName = `Portal Scoped Employee ${suffix}`;

      try {
        const createRes = await request(app)
          .post('/api/subcontractors/my-company/employees')
          .set('Authorization', `Bearer ${portalToken}`)
          .send({
            projectId,
            name: employeeName,
            role: 'Operator',
            hourlyRate: 67,
          });

        expect(createRes.status).toBe(201);

        const employee = await prisma.employeeRoster.findUnique({
          where: { id: createRes.body.employee.id },
          select: { subcontractorCompanyId: true },
        });
        expect(employee?.subcontractorCompanyId).toBe(portalSubId);

        const requestedProjectRes = await request(app)
          .get(`/api/subcontractors/my-company?projectId=${projectId}`)
          .set('Authorization', `Bearer ${portalToken}`);
        const requestedEmployeeNames = requestedProjectRes.body.company.employees.map(
          (employee: { name: string }) => employee.name,
        );
        expect(requestedEmployeeNames).toContain(employeeName);

        const otherProjectRes = await request(app)
          .get(`/api/subcontractors/my-company?projectId=${otherProject.id}`)
          .set('Authorization', `Bearer ${portalToken}`);
        const otherEmployeeNames = otherProjectRes.body.company.employees.map(
          (employee: { name: string }) => employee.name,
        );
        expect(otherEmployeeNames).not.toContain(employeeName);
      } finally {
        await prisma.employeeRoster.deleteMany({ where: { name: employeeName } });
        await prisma.subcontractorUser.deleteMany({
          where: { subcontractorCompanyId: otherSub.id },
        });
        await prisma.subcontractorCompany.delete({ where: { id: otherSub.id } }).catch(() => {});
        await prisma.project.delete({ where: { id: otherProject.id } }).catch(() => {});
      }
    });

    it('should manage the exact same-project subcontractor company when one user has multiple links', async () => {
      const suffix = Date.now();
      const otherSub = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `Portal Same Project Co ${suffix}`,
          primaryContactEmail: `portal-same-project-${suffix}@example.com`,
          status: 'approved',
        },
      });
      await prisma.subcontractorUser.create({
        data: {
          userId: portalUserId,
          subcontractorCompanyId: otherSub.id,
          role: 'admin',
        },
      });

      let employeeId: string | undefined;
      let plantId: string | undefined;

      try {
        const companyRes = await request(app)
          .get(
            `/api/subcontractors/my-company?projectId=${projectId}&subcontractorCompanyId=${otherSub.id}`,
          )
          .set('Authorization', `Bearer ${portalToken}`);

        expect(companyRes.status).toBe(200);
        expect(companyRes.body.company.id).toBe(otherSub.id);
        expect(companyRes.body.company.companyName).toBe(otherSub.companyName);

        const employeeRes = await request(app)
          .post('/api/subcontractors/my-company/employees')
          .set('Authorization', `Bearer ${portalToken}`)
          .send({
            projectId,
            subcontractorCompanyId: otherSub.id,
            name: `Same Project Employee ${suffix}`,
            role: 'Operator',
            hourlyRate: 77,
          });
        expect(employeeRes.status).toBe(201);
        employeeId = employeeRes.body.employee.id;
        await expect(
          prisma.employeeRoster.findUnique({
            where: { id: employeeId },
            select: { subcontractorCompanyId: true },
          }),
        ).resolves.toMatchObject({ subcontractorCompanyId: otherSub.id });

        const plantRes = await request(app)
          .post('/api/subcontractors/my-company/plant')
          .set('Authorization', `Bearer ${portalToken}`)
          .send({
            projectId,
            subcontractorCompanyId: otherSub.id,
            type: 'Roller',
            description: `Same Project Plant ${suffix}`,
            dryRate: 155,
          });
        expect(plantRes.status).toBe(201);
        plantId = plantRes.body.plant.id;
        await expect(
          prisma.plantRegister.findUnique({
            where: { id: plantId },
            select: { subcontractorCompanyId: true },
          }),
        ).resolves.toMatchObject({ subcontractorCompanyId: otherSub.id });

        const deleteEmployeeRes = await request(app)
          .delete(
            `/api/subcontractors/my-company/employees/${employeeId}?projectId=${projectId}&subcontractorCompanyId=${otherSub.id}`,
          )
          .set('Authorization', `Bearer ${portalToken}`);
        expect(deleteEmployeeRes.status).toBe(200);
        employeeId = undefined;

        const deletePlantRes = await request(app)
          .delete(
            `/api/subcontractors/my-company/plant/${plantId}?projectId=${projectId}&subcontractorCompanyId=${otherSub.id}`,
          )
          .set('Authorization', `Bearer ${portalToken}`);
        expect(deletePlantRes.status).toBe(200);
        plantId = undefined;
      } finally {
        if (employeeId) {
          await prisma.employeeRoster.delete({ where: { id: employeeId } }).catch(() => {});
        }
        if (plantId) {
          await prisma.plantRegister.delete({ where: { id: plantId } }).catch(() => {});
        }
        await prisma.subcontractorUser.deleteMany({
          where: { subcontractorCompanyId: otherSub.id },
        });
        await prisma.subcontractorCompany.delete({ where: { id: otherSub.id } }).catch(() => {});
      }
    });

    it('should reject a requested subcontractor company from a different project scope', async () => {
      const suffix = Date.now();
      const otherProject = await prisma.project.create({
        data: {
          companyId,
          name: `Portal Mismatch Project ${suffix}`,
          projectNumber: `PORTAL-MISMATCH-${suffix}`,
          status: 'active',
          state: 'NSW',
          specificationSet: 'TfNSW',
        },
      });
      const otherSub = await prisma.subcontractorCompany.create({
        data: {
          projectId: otherProject.id,
          companyName: `Portal Mismatch Co ${suffix}`,
          primaryContactEmail: `portal-mismatch-${suffix}@example.com`,
          status: 'approved',
        },
      });
      await prisma.subcontractorUser.create({
        data: {
          userId: portalUserId,
          subcontractorCompanyId: otherSub.id,
          role: 'admin',
        },
      });

      const employeeName = `Mismatched Project Employee ${suffix}`;

      try {
        const res = await request(app)
          .post('/api/subcontractors/my-company/employees')
          .set('Authorization', `Bearer ${portalToken}`)
          .send({
            projectId,
            subcontractorCompanyId: otherSub.id,
            name: employeeName,
            role: 'Operator',
            hourlyRate: 82,
          });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain(
          'subcontractorCompanyId does not belong to the requested project',
        );

        await expect(
          prisma.employeeRoster.findFirst({
            where: { subcontractorCompanyId: otherSub.id, name: employeeName },
          }),
        ).resolves.toBeNull();
      } finally {
        await prisma.employeeRoster.deleteMany({ where: { name: employeeName } });
        await prisma.subcontractorUser.deleteMany({
          where: { subcontractorCompanyId: otherSub.id },
        });
        await prisma.subcontractorCompany.delete({ where: { id: otherSub.id } }).catch(() => {});
        await prisma.project.delete({ where: { id: otherProject.id } }).catch(() => {});
      }
    });

    it('should reject stale head-contractor accounts with subcontractor links from my-company endpoints', async () => {
      const staleUser = await registerTestUser('stale-hc-portal-link', 'Stale HC Portal Link User');

      await prisma.user.update({
        where: { id: staleUser.userId },
        data: { companyId, roleInCompany: 'owner' },
      });

      await prisma.subcontractorUser.create({
        data: {
          userId: staleUser.userId,
          subcontractorCompanyId: portalSubId,
          role: 'admin',
        },
      });

      try {
        const getRes = await request(app)
          .get('/api/subcontractors/my-company')
          .set('Authorization', `Bearer ${staleUser.token}`);

        expect(getRes.status).toBe(403);
        expect(getRes.body.error.message).toContain('standalone subcontractor portal users');

        const employeeRes = await request(app)
          .post('/api/subcontractors/my-company/employees')
          .set('Authorization', `Bearer ${staleUser.token}`)
          .send({
            name: 'Should Not Create',
            role: 'Operator',
            hourlyRate: 50,
          });

        expect(employeeRes.status).toBe(403);

        const createdEmployee = await prisma.employeeRoster.findFirst({
          where: {
            subcontractorCompanyId: portalSubId,
            name: 'Should Not Create',
          },
        });
        expect(createdEmployee).toBeNull();
      } finally {
        await prisma.subcontractorUser.deleteMany({ where: { userId: staleUser.userId } });
        await cleanupTestUser(staleUser.userId);
      }
    });

    it('should keep my-company roster and plant scoped to the linked subcontractor', async () => {
      const suffix = Date.now();
      const otherSub = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `Portal Other Co ${suffix}`,
          primaryContactName: 'Other Portal Admin',
          primaryContactEmail: `portal-other-${suffix}@example.com`,
          status: 'approved',
        },
      });
      const ownEmployee = await prisma.employeeRoster.create({
        data: {
          subcontractorCompanyId: portalSubId,
          name: `Portal Own Employee ${suffix}`,
          role: 'Operator',
          hourlyRate: 55,
          status: 'pending',
        },
      });
      const otherEmployee = await prisma.employeeRoster.create({
        data: {
          subcontractorCompanyId: otherSub.id,
          name: `Portal Other Employee ${suffix}`,
          role: 'Labourer',
          hourlyRate: 45,
          status: 'pending',
        },
      });
      const ownPlant = await prisma.plantRegister.create({
        data: {
          subcontractorCompanyId: portalSubId,
          type: 'Truck',
          description: `Portal Own Plant ${suffix}`,
          dryRate: 120,
          status: 'pending',
        },
      });
      const otherPlant = await prisma.plantRegister.create({
        data: {
          subcontractorCompanyId: otherSub.id,
          type: 'Excavator',
          description: `Portal Other Plant ${suffix}`,
          dryRate: 180,
          status: 'pending',
        },
      });

      try {
        const res = await request(app)
          .get('/api/subcontractors/my-company')
          .set('Authorization', `Bearer ${portalToken}`);

        expect(res.status).toBe(200);
        const employeeNames = res.body.company.employees.map(
          (employee: { name: string }) => employee.name,
        );
        expect(employeeNames).toContain(ownEmployee.name);
        expect(employeeNames).not.toContain(otherEmployee.name);

        const plantDescriptions = res.body.company.plant.map(
          (plant: { description: string }) => plant.description,
        );
        expect(plantDescriptions).toContain(ownPlant.description);
        expect(plantDescriptions).not.toContain(otherPlant.description);

        const deleteOtherEmployeeRes = await request(app)
          .delete(`/api/subcontractors/my-company/employees/${otherEmployee.id}`)
          .set('Authorization', `Bearer ${portalToken}`);
        expect(deleteOtherEmployeeRes.status).toBe(404);

        const deleteOtherPlantRes = await request(app)
          .delete(`/api/subcontractors/my-company/plant/${otherPlant.id}`)
          .set('Authorization', `Bearer ${portalToken}`);
        expect(deleteOtherPlantRes.status).toBe(404);

        await expect(
          prisma.employeeRoster.findUnique({ where: { id: otherEmployee.id } }),
        ).resolves.toBeTruthy();
        await expect(
          prisma.plantRegister.findUnique({ where: { id: otherPlant.id } }),
        ).resolves.toBeTruthy();
      } finally {
        await prisma.employeeRoster.deleteMany({
          where: { id: { in: [ownEmployee.id, otherEmployee.id] } },
        });
        await prisma.plantRegister.deleteMany({
          where: { id: { in: [ownPlant.id, otherPlant.id] } },
        });
        await prisma.subcontractorCompany.delete({ where: { id: otherSub.id } }).catch(() => {});
      }
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

    it('should not allow company-linked stale subcontractor roles to read portal access via old links', async () => {
      const staleEmail = `portal-stale-sub-${Date.now()}@example.com`;
      const staleRes = await request(app).post('/api/auth/register').send({
        email: staleEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Portal Stale Subcontractor',
        tosAccepted: true,
      });
      const staleToken = staleRes.body.token;
      const staleUserId = staleRes.body.user.id;

      try {
        await prisma.user.update({
          where: { id: staleUserId },
          data: { companyId, roleInCompany: 'subcontractor' },
        });
        await prisma.subcontractorUser.create({
          data: {
            userId: staleUserId,
            subcontractorCompanyId: portalSubId,
            role: 'user',
          },
        });
        await prisma.projectUser.create({
          data: {
            projectId,
            userId: staleUserId,
            role: 'project_manager',
            status: 'active',
          },
        });

        const portalAccessRes = await request(app)
          .get(`/api/subcontractors/${portalSubId}/portal-access`)
          .set('Authorization', `Bearer ${staleToken}`);

        expect(portalAccessRes.status).toBe(403);
      } finally {
        await prisma.projectUser.deleteMany({ where: { projectId, userId: staleUserId } });
        await prisma.subcontractorUser.deleteMany({ where: { userId: staleUserId } });
        await prisma.emailVerificationToken.deleteMany({ where: { userId: staleUserId } });
        await prisma.user.delete({ where: { id: staleUserId } }).catch(() => {});
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
