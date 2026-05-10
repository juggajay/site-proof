import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { lotsRouter } from './lots.js';
import { authRouter } from './auth.js';
import { prisma } from '../lib/prisma.js';
import { errorHandler } from '../middleware/errorHandler.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/lots', lotsRouter);
app.use(errorHandler);

describe('Lots API', () => {
  let authToken: string;
  let userId: string;
  let companyId: string;
  let projectId: string;
  let lotId: string;

  beforeAll(async () => {
    // Create test company
    const company = await prisma.company.create({
      data: { name: `Test Company ${Date.now()}` },
    });
    companyId = company.id;

    // Create test user via registration
    const testEmail = `lots-test-${Date.now()}@example.com`;
    const regRes = await request(app).post('/api/auth/register').send({
      email: testEmail,
      password: 'SecureP@ssword123!',
      fullName: 'Lots Test User',
      tosAccepted: true,
    });
    authToken = regRes.body.token;
    userId = regRes.body.user.id;

    // Update user with company and admin role
    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'admin' },
    });

    // Create test project
    const project = await prisma.project.create({
      data: {
        name: `Test Project ${Date.now()}`,
        projectNumber: `TP-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    projectId = project.id;

    // Add user to project with admin role
    await prisma.projectUser.create({
      data: {
        projectId,
        userId,
        role: 'admin',
        status: 'active',
      },
    });
  });

  afterAll(async () => {
    // Clean up in reverse order of dependencies
    await prisma.lot.deleteMany({ where: { projectId } });
    await prisma.projectUser.deleteMany({ where: { projectId } });
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {});

    // Clean up user and related tokens
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      await prisma.emailVerificationToken.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }

    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  });

  describe('POST /api/lots', () => {
    it('should create a new lot', async () => {
      const res = await request(app)
        .post('/api/lots')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          lotNumber: 'LOT-001',
          description: 'Test lot description',
          activityType: 'Earthworks',
        });

      expect(res.status).toBe(201);
      expect(res.body.lot).toBeDefined();
      expect(res.body.lot.lotNumber).toBe('LOT-001');
      lotId = res.body.lot.id;
    });

    it('should keep company admin lot creation rights when project membership is lower', async () => {
      await prisma.projectUser.updateMany({
        where: { projectId, userId },
        data: { role: 'viewer' },
      });

      const lotNumber = `LOT-COMPANY-ADMIN-${Date.now()}`;

      try {
        const res = await request(app)
          .post('/api/lots')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            projectId,
            lotNumber,
            description: 'Company admin should not be downgraded by project membership',
            activityType: 'Earthworks',
          });

        expect(res.status).toBe(201);
        expect(res.body.lot.lotNumber).toBe(lotNumber);
      } finally {
        await prisma.lot.deleteMany({ where: { projectId, lotNumber } });
        await prisma.projectUser.updateMany({
          where: { projectId, userId },
          data: { role: 'admin' },
        });
      }
    });

    it('should reject lot without projectId', async () => {
      const res = await request(app)
        .post('/api/lots')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          lotNumber: 'LOT-002',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject lot without lotNumber', async () => {
      const res = await request(app)
        .post('/api/lots')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject duplicate lot number in same project', async () => {
      const res = await request(app)
        .post('/api/lots')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          lotNumber: 'LOT-001', // Already exists
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('should require area zone for area lot type', async () => {
      const res = await request(app)
        .post('/api/lots')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          lotNumber: 'LOT-AREA-001',
          lotType: 'area',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.details.code).toBe('AREA_ZONE_REQUIRED');
    });

    it('should require structure ID for structure lot type', async () => {
      const res = await request(app)
        .post('/api/lots')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          lotNumber: 'LOT-STRUCT-001',
          lotType: 'structure',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.details.code).toBe('STRUCTURE_ID_REQUIRED');
    });

    it('should reject invalid chainage ranges without creating a lot', async () => {
      const lotNumber = `LOT-BAD-CHAINAGE-${Date.now()}`;
      const res = await request(app)
        .post('/api/lots')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          lotNumber,
          chainageStart: 200,
          chainageEnd: 100,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');

      const lot = await prisma.lot.findFirst({ where: { projectId, lotNumber } });
      expect(lot).toBeNull();
    });

    it('should reject cross-project ITP templates without creating the lot', async () => {
      const otherProject = await prisma.project.create({
        data: {
          name: `Other ITP Project ${Date.now()}`,
          projectNumber: `OIP-${Date.now()}`,
          companyId,
          status: 'active',
          state: 'NSW',
          specificationSet: 'TfNSW',
        },
      });
      const template = await prisma.iTPTemplate.create({
        data: {
          projectId: otherProject.id,
          name: `Other Project Template ${Date.now()}`,
          isActive: true,
        },
      });
      const lotNumber = `LOT-CROSS-ITP-${Date.now()}`;

      try {
        const res = await request(app)
          .post('/api/lots')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            projectId,
            lotNumber,
            itpTemplateId: template.id,
          });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('not available');

        const lot = await prisma.lot.findFirst({ where: { projectId, lotNumber } });
        expect(lot).toBeNull();
      } finally {
        await prisma.iTPTemplate.delete({ where: { id: template.id } }).catch(() => {});
        await prisma.project.delete({ where: { id: otherProject.id } }).catch(() => {});
      }
    });

    it('should atomically create the legacy and permissioned subcontractor assignment', async () => {
      const subcontractor = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `Create Lot Subcontractor ${Date.now()}`,
          primaryContactName: 'Create Lot Subcontractor',
          primaryContactEmail: `create-lot-sub-${Date.now()}@example.com`,
          status: 'approved',
        },
      });

      const res = await request(app)
        .post('/api/lots')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          lotNumber: `LOT-ASSIGNED-${Date.now()}`,
          assignedSubcontractorId: subcontractor.id,
          canCompleteITP: true,
          itpRequiresVerification: false,
        });

      expect(res.status).toBe(201);
      expect(res.body.lot.assignedSubcontractorId).toBe(subcontractor.id);

      const assignment = await prisma.lotSubcontractorAssignment.findUnique({
        where: {
          lotId_subcontractorCompanyId: {
            lotId: res.body.lot.id,
            subcontractorCompanyId: subcontractor.id,
          },
        },
      });
      expect(assignment).toMatchObject({
        projectId,
        status: 'active',
        canCompleteITP: true,
        itpRequiresVerification: false,
      });
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app).post('/api/lots').send({
        projectId,
        lotNumber: 'LOT-NOAUTH',
      });

      expect(res.status).toBe(401);
    });

    it('should reject company project managers without active project access', async () => {
      const outsiderEmail = `lots-create-outsider-${Date.now()}@example.com`;
      const outsiderRes = await request(app).post('/api/auth/register').send({
        email: outsiderEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Lots Create Outsider',
        tosAccepted: true,
      });
      const outsiderToken = outsiderRes.body.token;
      const outsiderUserId = outsiderRes.body.user.id;

      await prisma.user.update({
        where: { id: outsiderUserId },
        data: { companyId, roleInCompany: 'project_manager' },
      });

      const res = await request(app)
        .post('/api/lots')
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({
          projectId,
          lotNumber: `LOT-OUTSIDER-${Date.now()}`,
        });

      expect(res.status).toBe(403);

      await prisma.emailVerificationToken.deleteMany({ where: { userId: outsiderUserId } });
      await prisma.user.delete({ where: { id: outsiderUserId } }).catch(() => {});
    });
  });

  describe('GET /api/lots', () => {
    it('should list lots for a project with pagination', async () => {
      const res = await request(app)
        .get(`/api/lots?projectId=${projectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      // New paginated format
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      // Pagination metadata
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.total).toBeGreaterThan(0);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(20); // default limit
      expect(typeof res.body.pagination.totalPages).toBe('number');
      expect(typeof res.body.pagination.hasNextPage).toBe('boolean');
      expect(typeof res.body.pagination.hasPrevPage).toBe('boolean');
      // Backward compatibility
      expect(res.body.lots).toBeDefined();
      expect(res.body.lots).toEqual(res.body.data);
    });

    it('should respect pagination parameters', async () => {
      const res = await request(app)
        .get(`/api/lots?projectId=${projectId}&page=1&limit=5`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(5);
      expect(res.body.data.length).toBeLessThanOrEqual(5);
    });

    it('should require projectId query param', async () => {
      const res = await request(app).get('/api/lots').set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('required');
    });

    it('should reject users without active project access', async () => {
      const outsiderEmail = `lots-outsider-${Date.now()}@example.com`;
      const outsiderRes = await request(app).post('/api/auth/register').send({
        email: outsiderEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Lots Outsider',
        tosAccepted: true,
      });
      const outsiderToken = outsiderRes.body.token;
      const outsiderUserId = outsiderRes.body.user.id;

      await prisma.user.update({
        where: { id: outsiderUserId },
        data: { companyId, roleInCompany: 'viewer' },
      });

      const res = await request(app)
        .get(`/api/lots?projectId=${projectId}`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(res.status).toBe(403);

      await prisma.emailVerificationToken.deleteMany({ where: { userId: outsiderUserId } });
      await prisma.user.delete({ where: { id: outsiderUserId } }).catch(() => {});
    });

    it('should filter by status', async () => {
      const res = await request(app)
        .get(`/api/lots?projectId=${projectId}&status=not_started`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      for (const lot of res.body.data) {
        expect(lot.status).toBe('not_started');
      }
    });

    it('should search lots server-side across key fields', async () => {
      const searchToken = `search-needle-${Date.now()}`;
      const matchingLot = await prisma.lot.create({
        data: {
          projectId,
          lotNumber: `LOT-SEARCH-${Date.now()}`,
          description: `Contains ${searchToken}`,
          status: 'not_started',
          lotType: 'chainage',
          activityType: 'Earthworks',
        },
      });
      const otherLot = await prisma.lot.create({
        data: {
          projectId,
          lotNumber: `LOT-NO-MATCH-${Date.now()}`,
          description: 'Unrelated work area',
          status: 'not_started',
          lotType: 'chainage',
          activityType: 'Earthworks',
        },
      });

      try {
        const res = await request(app)
          .get(
            `/api/lots?projectId=${projectId}&search=${encodeURIComponent(searchToken.toUpperCase())}`,
          )
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        const returnedIds = res.body.data.map((lot: { id: string }) => lot.id);
        expect(returnedIds).toContain(matchingLot.id);
        expect(returnedIds).not.toContain(otherLot.id);
      } finally {
        await prisma.lot.deleteMany({ where: { id: { in: [matchingLot.id, otherLot.id] } } });
      }
    });

    it('should reject malformed filters and sort fields', async () => {
      const invalidStatusRes = await request(app)
        .get(`/api/lots?projectId=${projectId}&status=not_a_status`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(invalidStatusRes.status).toBe(400);

      const duplicateStatusRes = await request(app)
        .get('/api/lots')
        .query({ projectId, status: ['not_started', 'completed'] })
        .set('Authorization', `Bearer ${authToken}`);

      expect(duplicateStatusRes.status).toBe(400);

      const invalidSortRes = await request(app)
        .get(`/api/lots?projectId=${projectId}&sortBy=__proto__`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(invalidSortRes.status).toBe(400);

      const oversizedSearchRes = await request(app)
        .get('/api/lots')
        .query({ projectId, search: 'x'.repeat(201) })
        .set('Authorization', `Bearer ${authToken}`);

      expect(oversizedSearchRes.status).toBe(400);
    });

    it('should reject oversized projectId query parameters before lookups', async () => {
      const longId = 'p'.repeat(121);
      const checks = [
        {
          label: 'GET lots',
          response: await request(app)
            .get(`/api/lots?projectId=${longId}`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'GET suggested lot number',
          response: await request(app)
            .get(`/api/lots/suggest-number?projectId=${longId}`)
            .set('Authorization', `Bearer ${authToken}`),
        },
      ];

      for (const { label, response } of checks) {
        expect(response.status, label).toBe(400);
        expect(response.body.error.message, label).toContain(
          'projectId query parameter is too long',
        );
      }
    });
  });

  describe('GET /api/lots/:id', () => {
    it('should get a single lot', async () => {
      const res = await request(app)
        .get(`/api/lots/${lotId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.lot).toBeDefined();
      expect(res.body.lot.lotNumber).toBe('LOT-001');
    });

    it('should return 404 for non-existent lot', async () => {
      const res = await request(app)
        .get('/api/lots/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });

    it('should reject oversized lot route parameters before lookups', async () => {
      const longId = 'l'.repeat(121);
      const checks = [
        {
          label: 'GET lot',
          response: await request(app)
            .get(`/api/lots/${longId}`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'POST clone',
          response: await request(app)
            .post(`/api/lots/${longId}/clone`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({}),
        },
        {
          label: 'PATCH lot',
          response: await request(app)
            .patch(`/api/lots/${longId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ description: 'Updated lot description' }),
        },
        {
          label: 'DELETE lot',
          response: await request(app)
            .delete(`/api/lots/${longId}`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'POST assign',
          response: await request(app)
            .post(`/api/lots/${longId}/assign`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ subcontractorId: null }),
        },
        {
          label: 'GET check role',
          response: await request(app)
            .get(`/api/lots/check-role/${longId}`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'GET conform status',
          response: await request(app)
            .get(`/api/lots/${longId}/conform-status`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'POST conform',
          response: await request(app)
            .post(`/api/lots/${longId}/conform`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({}),
        },
        {
          label: 'POST override status',
          response: await request(app)
            .post(`/api/lots/${longId}/override-status`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ status: 'completed', reason: 'Manual status update' }),
        },
        {
          label: 'GET subcontractors',
          response: await request(app)
            .get(`/api/lots/${longId}/subcontractors`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'GET my subcontractor assignment',
          response: await request(app)
            .get(`/api/lots/${longId}/subcontractors/mine`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'POST subcontractor assignment',
          response: await request(app)
            .post(`/api/lots/${longId}/subcontractors`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ subcontractorCompanyId: 'subcontractor-id' }),
        },
        {
          label: 'PATCH assignment lot id',
          response: await request(app)
            .patch(`/api/lots/${longId}/subcontractors/assignment-id`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ canCompleteITP: true }),
        },
        {
          label: 'PATCH assignment id',
          response: await request(app)
            .patch(`/api/lots/${lotId}/subcontractors/${longId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ canCompleteITP: true }),
        },
        {
          label: 'DELETE assignment lot id',
          response: await request(app)
            .delete(`/api/lots/${longId}/subcontractors/assignment-id`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'DELETE assignment id',
          response: await request(app)
            .delete(`/api/lots/${lotId}/subcontractors/${longId}`)
            .set('Authorization', `Bearer ${authToken}`),
        },
      ];

      for (const { label, response } of checks) {
        expect(response.status, label).toBe(400);
        expect(response.body.error.message, label).toContain('is too long');
      }
    });

    it('should scope subcontractor lot detail and assignment access to assigned lots', async () => {
      const targetLot = lotId
        ? null
        : await prisma.lot.create({
            data: {
              projectId,
              lotNumber: `LOT-SUB-ASSIGNED-${Date.now()}`,
              status: 'not_started',
              lotType: 'chainage',
              activityType: 'Earthworks',
            },
          });
      const targetLotId = lotId || targetLot!.id;
      const subcontractorCompany = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `Lots Detail Subcontractor ${Date.now()}`,
          primaryContactName: 'Lots Detail Subcontractor',
          primaryContactEmail: `lots-detail-sub-${Date.now()}@example.com`,
          status: 'approved',
        },
      });

      const subcontractorRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: `lots-detail-sub-user-${Date.now()}@example.com`,
          password: 'SecureP@ssword123!',
          fullName: 'Lots Detail Subcontractor User',
          tosAccepted: true,
        });
      const subcontractorToken = subcontractorRes.body.token;
      const subcontractorUserId = subcontractorRes.body.user.id;

      await prisma.user.update({
        where: { id: subcontractorUserId },
        data: { companyId, roleInCompany: 'subcontractor' },
      });

      await prisma.subcontractorUser.create({
        data: {
          userId: subcontractorUserId,
          subcontractorCompanyId: subcontractorCompany.id,
          role: 'user',
        },
      });

      await prisma.lotSubcontractorAssignment.create({
        data: {
          projectId,
          lotId: targetLotId,
          subcontractorCompanyId: subcontractorCompany.id,
          canCompleteITP: true,
          itpRequiresVerification: true,
          status: 'active',
          assignedById: userId,
        },
      });

      const unassignedLot = await prisma.lot.create({
        data: {
          projectId,
          lotNumber: `LOT-SUB-UNASSIGNED-${Date.now()}`,
          status: 'not_started',
          lotType: 'chainage',
          activityType: 'Earthworks',
        },
      });

      try {
        const assignedRes = await request(app)
          .get(`/api/lots/${targetLotId}`)
          .set('Authorization', `Bearer ${subcontractorToken}`);

        expect(assignedRes.status).toBe(200);
        expect(assignedRes.body.lot.subcontractorAssignments).toHaveLength(1);
        expect(assignedRes.body.lot.subcontractorAssignments[0].subcontractorCompanyId).toBe(
          subcontractorCompany.id,
        );

        const mineRes = await request(app)
          .get(`/api/lots/${targetLotId}/subcontractors/mine`)
          .set('Authorization', `Bearer ${subcontractorToken}`);

        expect(mineRes.status).toBe(200);
        expect(mineRes.body.subcontractorCompanyId).toBe(subcontractorCompany.id);
        expect(mineRes.body.canCompleteITP).toBe(true);

        const conformStatusRes = await request(app)
          .get(`/api/lots/${targetLotId}/conform-status`)
          .set('Authorization', `Bearer ${subcontractorToken}`);

        expect(conformStatusRes.status).toBe(200);

        const unassignedRes = await request(app)
          .get(`/api/lots/${unassignedLot.id}`)
          .set('Authorization', `Bearer ${subcontractorToken}`);

        expect(unassignedRes.status).toBe(403);

        const unassignedConformStatusRes = await request(app)
          .get(`/api/lots/${unassignedLot.id}/conform-status`)
          .set('Authorization', `Bearer ${subcontractorToken}`);

        expect(unassignedConformStatusRes.status).toBe(403);

        await prisma.projectUser.create({
          data: {
            projectId,
            userId: subcontractorUserId,
            role: 'project_manager',
            status: 'active',
          },
        });

        const assignmentListRes = await request(app)
          .get(`/api/lots/${targetLotId}/subcontractors`)
          .set('Authorization', `Bearer ${subcontractorToken}`);

        expect(assignmentListRes.status).toBe(403);

        const updateRes = await request(app)
          .patch(`/api/lots/${targetLotId}`)
          .set('Authorization', `Bearer ${subcontractorToken}`)
          .send({ description: 'Subcontractor should not update lot metadata' });

        expect(updateRes.status).toBe(403);

        await prisma.subcontractorCompany.update({
          where: { id: subcontractorCompany.id },
          data: { status: 'suspended' },
        });

        const suspendedAssignedRes = await request(app)
          .get(`/api/lots/${targetLotId}`)
          .set('Authorization', `Bearer ${subcontractorToken}`);

        expect(suspendedAssignedRes.status).toBe(403);

        const suspendedMineRes = await request(app)
          .get(`/api/lots/${targetLotId}/subcontractors/mine`)
          .set('Authorization', `Bearer ${subcontractorToken}`);

        expect(suspendedMineRes.status).toBe(403);
      } finally {
        await prisma.lotSubcontractorAssignment.deleteMany({
          where: { subcontractorCompanyId: subcontractorCompany.id },
        });
        await prisma.subcontractorUser.deleteMany({
          where: { subcontractorCompanyId: subcontractorCompany.id },
        });
        await prisma.projectUser.deleteMany({ where: { projectId, userId: subcontractorUserId } });
        await prisma.subcontractorCompany
          .delete({ where: { id: subcontractorCompany.id } })
          .catch(() => {});
        await prisma.lot.delete({ where: { id: unassignedLot.id } }).catch(() => {});
        if (targetLot) {
          await prisma.lot.delete({ where: { id: targetLot.id } }).catch(() => {});
        }
        await prisma.emailVerificationToken.deleteMany({ where: { userId: subcontractorUserId } });
        await prisma.user.delete({ where: { id: subcontractorUserId } }).catch(() => {});
      }
    });

    it('should enforce subcontractor portal modules for lot list and detail reads', async () => {
      const suffix = Date.now();
      const assignedLot = await prisma.lot.create({
        data: {
          projectId,
          lotNumber: `LOT-PORTAL-MODULE-${suffix}`,
          status: 'not_started',
          lotType: 'chainage',
          activityType: 'Earthworks',
        },
      });
      const subcontractorCompany = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `Lots Portal Subcontractor ${suffix}`,
          primaryContactName: 'Lots Portal Subcontractor',
          primaryContactEmail: `lots-portal-sub-${suffix}@example.com`,
          status: 'approved',
          portalAccess: {
            lots: false,
            itps: false,
            holdPoints: false,
            testResults: false,
            ncrs: false,
            documents: false,
          },
        },
      });

      const subcontractorRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: `lots-portal-sub-user-${suffix}@example.com`,
          password: 'SecureP@ssword123!',
          fullName: 'Lots Portal Subcontractor User',
          tosAccepted: true,
        });
      const subcontractorToken = subcontractorRes.body.token;
      const subcontractorUserId = subcontractorRes.body.user.id;

      await prisma.user.update({
        where: { id: subcontractorUserId },
        data: { companyId, roleInCompany: 'subcontractor' },
      });

      await prisma.subcontractorUser.create({
        data: {
          userId: subcontractorUserId,
          subcontractorCompanyId: subcontractorCompany.id,
          role: 'user',
        },
      });

      await prisma.lotSubcontractorAssignment.create({
        data: {
          projectId,
          lotId: assignedLot.id,
          subcontractorCompanyId: subcontractorCompany.id,
          canCompleteITP: true,
          itpRequiresVerification: true,
          status: 'active',
          assignedById: userId,
        },
      });

      try {
        const assignedWorkListRes = await request(app)
          .get(`/api/lots?projectId=${projectId}&portalModule=lots`)
          .set('Authorization', `Bearer ${subcontractorToken}`);

        expect(assignedWorkListRes.status).toBe(403);
        expect(assignedWorkListRes.body.error.message).toContain(
          'Assigned work portal access is not enabled',
        );

        const assignedWorkDetailRes = await request(app)
          .get(`/api/lots/${assignedLot.id}?portalModule=lots`)
          .set('Authorization', `Bearer ${subcontractorToken}`);

        expect(assignedWorkDetailRes.status).toBe(403);
        expect(assignedWorkDetailRes.body.error.message).toContain(
          'Assigned work portal access is not enabled',
        );

        const itpListRes = await request(app)
          .get(`/api/lots?projectId=${projectId}&includeITP=true`)
          .set('Authorization', `Bearer ${subcontractorToken}`);

        expect(itpListRes.status).toBe(403);
        expect(itpListRes.body.error.message).toContain('ITPs portal access is not enabled');

        const itpDetailRes = await request(app)
          .get(`/api/lots/${assignedLot.id}?portalModule=itps`)
          .set('Authorization', `Bearer ${subcontractorToken}`);

        expect(itpDetailRes.status).toBe(403);
        expect(itpDetailRes.body.error.message).toContain('ITPs portal access is not enabled');

        const minimalListRes = await request(app)
          .get(`/api/lots?projectId=${projectId}`)
          .set('Authorization', `Bearer ${subcontractorToken}`);

        expect(minimalListRes.status).toBe(200);
        expect(minimalListRes.body.data.map((lot: { id: string }) => lot.id)).toEqual([
          assignedLot.id,
        ]);

        const minimalDetailRes = await request(app)
          .get(`/api/lots/${assignedLot.id}`)
          .set('Authorization', `Bearer ${subcontractorToken}`);

        expect(minimalDetailRes.status).toBe(200);
        expect(minimalDetailRes.body.lot.id).toBe(assignedLot.id);

        await prisma.subcontractorCompany.update({
          where: { id: subcontractorCompany.id },
          data: {
            portalAccess: {
              lots: true,
              itps: false,
              holdPoints: false,
              testResults: false,
              ncrs: false,
              documents: false,
            },
          },
        });

        const enabledAssignedWorkRes = await request(app)
          .get(`/api/lots/${assignedLot.id}?portalModule=lots`)
          .set('Authorization', `Bearer ${subcontractorToken}`);

        expect(enabledAssignedWorkRes.status).toBe(200);

        const stillDisabledItpRes = await request(app)
          .get(`/api/lots?projectId=${projectId}&includeITP=true`)
          .set('Authorization', `Bearer ${subcontractorToken}`);

        expect(stillDisabledItpRes.status).toBe(403);
        expect(stillDisabledItpRes.body.error.message).toContain(
          'ITPs portal access is not enabled',
        );

        await prisma.subcontractorCompany.update({
          where: { id: subcontractorCompany.id },
          data: {
            portalAccess: {
              lots: false,
              itps: true,
              holdPoints: false,
              testResults: false,
              ncrs: false,
              documents: false,
            },
          },
        });

        const enabledItpListRes = await request(app)
          .get(`/api/lots?projectId=${projectId}&includeITP=true`)
          .set('Authorization', `Bearer ${subcontractorToken}`);

        expect(enabledItpListRes.status).toBe(200);
        expect(enabledItpListRes.body.data.map((lot: { id: string }) => lot.id)).toEqual([
          assignedLot.id,
        ]);

        const enabledItpDetailRes = await request(app)
          .get(`/api/lots/${assignedLot.id}?portalModule=itps`)
          .set('Authorization', `Bearer ${subcontractorToken}`);

        expect(enabledItpDetailRes.status).toBe(200);
      } finally {
        await prisma.lotSubcontractorAssignment.deleteMany({ where: { lotId: assignedLot.id } });
        await prisma.subcontractorUser.deleteMany({
          where: { subcontractorCompanyId: subcontractorCompany.id },
        });
        await prisma.subcontractorCompany
          .delete({ where: { id: subcontractorCompany.id } })
          .catch(() => {});
        await prisma.lot.delete({ where: { id: assignedLot.id } }).catch(() => {});
        await prisma.emailVerificationToken.deleteMany({ where: { userId: subcontractorUserId } });
        await prisma.user.delete({ where: { id: subcontractorUserId } }).catch(() => {});
      }
    });
  });

  describe('PATCH /api/lots/:id', () => {
    it('should update a lot', async () => {
      const res = await request(app)
        .patch(`/api/lots/${lotId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Updated description',
          status: 'in_progress',
        });

      expect(res.status).toBe(200);
      expect(res.body.lot.description).toBe('Updated description');
      expect(res.body.lot.status).toBe('in_progress');
    });

    it('should reject invalid update status and chainage ranges', async () => {
      const invalidStatusRes = await request(app)
        .patch(`/api/lots/${lotId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'not_a_real_status' });

      expect(invalidStatusRes.status).toBe(400);

      const invalidChainageRes = await request(app)
        .patch(`/api/lots/${lotId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          chainageStart: 500,
          chainageEnd: 250,
        });

      expect(invalidChainageRes.status).toBe(400);
    });

    it('should reject project managers without active project access', async () => {
      const outsiderEmail = `lots-edit-outsider-${Date.now()}@example.com`;
      const outsiderRes = await request(app).post('/api/auth/register').send({
        email: outsiderEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Lots Edit Outsider',
        tosAccepted: true,
      });
      const outsiderToken = outsiderRes.body.token;
      const outsiderUserId = outsiderRes.body.user.id;

      await prisma.user.update({
        where: { id: outsiderUserId },
        data: { companyId, roleInCompany: 'project_manager' },
      });

      const res = await request(app)
        .patch(`/api/lots/${lotId}`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({
          description: 'Unauthorized update',
        });

      expect(res.status).toBe(403);

      await prisma.emailVerificationToken.deleteMany({ where: { userId: outsiderUserId } });
      await prisma.user.delete({ where: { id: outsiderUserId } }).catch(() => {});
    });
  });

  describe('POST /api/lots/:id/assign', () => {
    it('should reject assigning conformed lots without changing assignment state', async () => {
      const subcontractor = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `Direct Assign Subcontractor ${Date.now()}`,
          primaryContactName: 'Direct Assign Subcontractor',
          primaryContactEmail: `direct-assign-sub-${Date.now()}@example.com`,
          status: 'approved',
        },
      });
      const conformedLot = await prisma.lot.create({
        data: {
          projectId,
          lotNumber: `LOT-CONFORMED-ASSIGN-${Date.now()}`,
          status: 'conformed',
          lotType: 'chainage',
          activityType: 'Earthworks',
        },
      });

      const res = await request(app)
        .post(`/api/lots/${conformedLot.id}/assign`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ subcontractorId: subcontractor.id });

      expect(res.status).toBe(400);

      const assignmentCount = await prisma.lotSubcontractorAssignment.count({
        where: { lotId: conformedLot.id },
      });
      const unchangedLot = await prisma.lot.findUnique({
        where: { id: conformedLot.id },
        select: { assignedSubcontractorId: true },
      });
      expect(assignmentCount).toBe(0);
      expect(unchangedLot?.assignedSubcontractorId).toBeNull();
    });
  });

  describe('DELETE /api/lots/:id', () => {
    let deletableLotId: string;

    beforeAll(async () => {
      const createRes = await request(app)
        .post('/api/lots')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          lotNumber: 'LOT-DELETE-001',
          description: 'Lot to delete',
        });
      deletableLotId = createRes.body.lot.id;
    });

    it('should delete a lot', async () => {
      const res = await request(app)
        .delete(`/api/lots/${deletableLotId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('deleted');
    });

    it('should return 404 for non-existent lot', async () => {
      const res = await request(app)
        .delete('/api/lots/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });

    it('should reject project managers without active project access', async () => {
      const outsiderEmail = `lots-delete-outsider-${Date.now()}@example.com`;
      const outsiderRes = await request(app).post('/api/auth/register').send({
        email: outsiderEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Lots Delete Outsider',
        tosAccepted: true,
      });
      const outsiderToken = outsiderRes.body.token;
      const outsiderUserId = outsiderRes.body.user.id;

      await prisma.user.update({
        where: { id: outsiderUserId },
        data: { companyId, roleInCompany: 'project_manager' },
      });

      const createRes = await request(app)
        .post('/api/lots')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          lotNumber: `LOT-DELETE-DENIED-${Date.now()}`,
          description: 'Lot delete denied',
        });
      const deniedDeleteLotId = createRes.body.lot.id;

      const res = await request(app)
        .delete(`/api/lots/${deniedDeleteLotId}`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(res.status).toBe(403);

      await prisma.emailVerificationToken.deleteMany({ where: { userId: outsiderUserId } });
      await prisma.user.delete({ where: { id: outsiderUserId } }).catch(() => {});
    });
  });
});

describe('Lot Status Workflows', () => {
  let authToken: string;
  let userId: string;
  let companyId: string;
  let projectId: string;
  let workflowLotId: string;

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `Workflow Test Company ${Date.now()}` },
    });
    companyId = company.id;

    const testEmail = `workflow-test-${Date.now()}@example.com`;
    const regRes = await request(app).post('/api/auth/register').send({
      email: testEmail,
      password: 'SecureP@ssword123!',
      fullName: 'Workflow Test User',
      tosAccepted: true,
    });
    authToken = regRes.body.token;
    userId = regRes.body.user.id;

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'admin' },
    });

    const project = await prisma.project.create({
      data: {
        name: `Workflow Project ${Date.now()}`,
        projectNumber: `WP-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    projectId = project.id;

    await prisma.projectUser.create({
      data: {
        projectId,
        userId,
        role: 'admin',
        status: 'active',
      },
    });

    const createRes = await request(app)
      .post('/api/lots')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        projectId,
        lotNumber: `LOT-WORKFLOW-${Date.now()}`,
        description: 'Workflow test lot',
      });
    workflowLotId = createRes.body.lot.id;
  });

  afterAll(async () => {
    await prisma.lot.deleteMany({ where: { projectId } });
    await prisma.projectUser.deleteMany({ where: { projectId } });
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {});

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      await prisma.emailVerificationToken.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }

    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  });

  it('should transition from not_started to in_progress', async () => {
    const res = await request(app)
      .patch(`/api/lots/${workflowLotId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'in_progress' });

    expect(res.status).toBe(200);
    expect(res.body.lot.status).toBe('in_progress');
  });

  it('should transition to awaiting_test', async () => {
    const res = await request(app)
      .patch(`/api/lots/${workflowLotId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'awaiting_test' });

    expect(res.status).toBe(200);
    expect(res.body.lot.status).toBe('awaiting_test');
  });

  it('should transition to completed', async () => {
    const res = await request(app)
      .patch(`/api/lots/${workflowLotId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'completed' });

    expect(res.status).toBe(200);
    expect(res.body.lot.status).toBe('completed');
  });
});

describe('Lot Bulk Operations', () => {
  let authToken: string;
  let userId: string;
  let companyId: string;
  let projectId: string;
  const bulkLotIds: string[] = [];

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `Bulk Test Company ${Date.now()}` },
    });
    companyId = company.id;

    const testEmail = `bulk-test-${Date.now()}@example.com`;
    const regRes = await request(app).post('/api/auth/register').send({
      email: testEmail,
      password: 'SecureP@ssword123!',
      fullName: 'Bulk Test User',
      tosAccepted: true,
    });
    authToken = regRes.body.token;
    userId = regRes.body.user.id;

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'admin' },
    });

    const project = await prisma.project.create({
      data: {
        name: `Bulk Project ${Date.now()}`,
        projectNumber: `BP-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    projectId = project.id;

    await prisma.projectUser.create({
      data: {
        projectId,
        userId,
        role: 'admin',
        status: 'active',
      },
    });

    // Create multiple lots for bulk testing
    for (let i = 1; i <= 3; i++) {
      const res = await request(app)
        .post('/api/lots')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          lotNumber: `BULK-LOT-${Date.now()}-${i}`,
          description: `Bulk test lot ${i}`,
        });
      bulkLotIds.push(res.body.lot.id);
    }
  });

  afterAll(async () => {
    await prisma.lot.deleteMany({ where: { projectId } });
    await prisma.projectUser.deleteMany({ where: { projectId } });
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {});

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      await prisma.emailVerificationToken.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }

    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  });

  it('should bulk create lots', async () => {
    const timestamp = Date.now();
    const res = await request(app)
      .post('/api/lots/bulk')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        projectId,
        lots: [
          { lotNumber: `BULK-NEW-${timestamp}-1`, description: 'New bulk 1' },
          { lotNumber: `BULK-NEW-${timestamp}-2`, description: 'New bulk 2' },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.lots.length).toBe(2);
    expect(res.body.count).toBe(2);
  });

  it('should allow bulk lot mutations based on active project manager role', async () => {
    const projectManagerEmail = `bulk-project-role-manager-${Date.now()}@example.com`;
    const projectManagerRes = await request(app).post('/api/auth/register').send({
      email: projectManagerEmail,
      password: 'SecureP@ssword123!',
      fullName: 'Bulk Project Role Manager',
      tosAccepted: true,
    });
    const projectManagerToken = projectManagerRes.body.token;
    const projectManagerUserId = projectManagerRes.body.user.id;
    const timestamp = Date.now();
    const createdLotIds: string[] = [];
    let clonedLotId: string | undefined;
    let subcontractorId: string | undefined;

    await prisma.user.update({
      where: { id: projectManagerUserId },
      data: { companyId, roleInCompany: 'viewer' },
    });
    await prisma.projectUser.create({
      data: {
        projectId,
        userId: projectManagerUserId,
        role: 'project_manager',
        status: 'active',
      },
    });

    try {
      const createRes = await request(app)
        .post('/api/lots/bulk')
        .set('Authorization', `Bearer ${projectManagerToken}`)
        .send({
          projectId,
          lots: [
            { lotNumber: `BULK-PROJECT-ROLE-${timestamp}-1`, description: 'Project role bulk 1' },
            { lotNumber: `BULK-PROJECT-ROLE-${timestamp}-2`, description: 'Project role bulk 2' },
          ],
        });

      expect(createRes.status).toBe(201);
      createdLotIds.push(...createRes.body.lots.map((lot: { id: string }) => lot.id));

      const updateRes = await request(app)
        .post('/api/lots/bulk-update-status')
        .set('Authorization', `Bearer ${projectManagerToken}`)
        .send({
          lotIds: createdLotIds,
          status: 'in_progress',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.count).toBe(createdLotIds.length);

      const cloneRes = await request(app)
        .post(`/api/lots/${createdLotIds[0]}/clone`)
        .set('Authorization', `Bearer ${projectManagerToken}`)
        .send({ lotNumber: `BULK-PROJECT-ROLE-CLONE-${timestamp}` });

      expect(cloneRes.status).toBe(201);
      clonedLotId = cloneRes.body.lot.id;

      const deleteCloneRes = await request(app)
        .delete(`/api/lots/${clonedLotId}`)
        .set('Authorization', `Bearer ${projectManagerToken}`);

      expect(deleteCloneRes.status).toBe(200);
      clonedLotId = undefined;

      const subcontractor = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `Bulk Project Role Sub ${timestamp}`,
          primaryContactName: 'Bulk Project Role Sub',
          primaryContactEmail: `bulk-project-role-sub-${timestamp}@example.com`,
          status: 'approved',
        },
      });
      subcontractorId = subcontractor.id;

      const assignRes = await request(app)
        .post('/api/lots/bulk-assign-subcontractor')
        .set('Authorization', `Bearer ${projectManagerToken}`)
        .send({
          lotIds: createdLotIds,
          subcontractorId,
        });

      expect(assignRes.status).toBe(200);
      expect(assignRes.body.count).toBe(createdLotIds.length);

      const unassignRes = await request(app)
        .post('/api/lots/bulk-assign-subcontractor')
        .set('Authorization', `Bearer ${projectManagerToken}`)
        .send({
          lotIds: createdLotIds,
          subcontractorId: null,
        });

      expect(unassignRes.status).toBe(200);

      const deleteRes = await request(app)
        .post('/api/lots/bulk-delete')
        .set('Authorization', `Bearer ${projectManagerToken}`)
        .send({ lotIds: createdLotIds });

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.count).toBe(createdLotIds.length);
    } finally {
      await prisma.lotSubcontractorAssignment.deleteMany({
        where: { lotId: { in: createdLotIds } },
      });
      if (subcontractorId) {
        await prisma.subcontractorCompany
          .delete({ where: { id: subcontractorId } })
          .catch(() => {});
      }
      await prisma.lot.deleteMany({
        where: { id: { in: [...createdLotIds, clonedLotId].filter(Boolean) as string[] } },
      });
      await prisma.projectUser.deleteMany({ where: { projectId, userId: projectManagerUserId } });
      await prisma.emailVerificationToken.deleteMany({ where: { userId: projectManagerUserId } });
      await prisma.user.delete({ where: { id: projectManagerUserId } }).catch(() => {});
    }
  });

  it('should reject bulk create without lots array', async () => {
    const res = await request(app)
      .post('/api/lots/bulk')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        projectId,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should reject bulk create with empty lots array', async () => {
    const res = await request(app)
      .post('/api/lots/bulk')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        projectId,
        lots: [],
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should reject duplicate lot numbers and invalid chainage in bulk create', async () => {
    const timestamp = Date.now();
    const duplicateRes = await request(app)
      .post('/api/lots/bulk')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        projectId,
        lots: [{ lotNumber: `BULK-DUP-${timestamp}` }, { lotNumber: `BULK-DUP-${timestamp}` }],
      });

    expect(duplicateRes.status).toBe(400);

    const invalidChainageRes = await request(app)
      .post('/api/lots/bulk')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        projectId,
        lots: [{ lotNumber: `BULK-BAD-CHAINAGE-${timestamp}`, chainageStart: 20, chainageEnd: 10 }],
      });

    expect(invalidChainageRes.status).toBe(400);
  });

  it('should reject bulk operations when any requested lot is missing', async () => {
    const res = await request(app)
      .post('/api/lots/bulk-update-status')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        lotIds: [bulkLotIds[0], `missing-lot-${Date.now()}`],
        status: 'in_progress',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('not found');

    const unchangedLot = await prisma.lot.findUnique({
      where: { id: bulkLotIds[0] },
      select: { status: true },
    });
    expect(unchangedLot?.status).toBe('not_started');

    const deleteRes = await request(app)
      .post('/api/lots/bulk-delete')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        lotIds: [bulkLotIds[0], `missing-delete-lot-${Date.now()}`],
      });

    expect(deleteRes.status).toBe(400);

    const stillExists = await prisma.lot.findUnique({ where: { id: bulkLotIds[0] } });
    expect(stillExists).not.toBeNull();
  });

  it('should keep bulk subcontractor assignment records synchronized', async () => {
    const subcontractor = await prisma.subcontractorCompany.create({
      data: {
        projectId,
        companyName: `Bulk Assign Subcontractor ${Date.now()}`,
        primaryContactName: 'Bulk Assign Subcontractor',
        primaryContactEmail: `bulk-assign-sub-${Date.now()}@example.com`,
        status: 'approved',
      },
    });
    const targetLotIds = bulkLotIds.slice(0, 2);

    const assignRes = await request(app)
      .post('/api/lots/bulk-assign-subcontractor')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        lotIds: targetLotIds,
        subcontractorId: subcontractor.id,
      });

    expect(assignRes.status).toBe(200);
    expect(assignRes.body.count).toBe(targetLotIds.length);

    const activeAssignments = await prisma.lotSubcontractorAssignment.findMany({
      where: {
        lotId: { in: targetLotIds },
        subcontractorCompanyId: subcontractor.id,
        status: 'active',
      },
    });
    expect(activeAssignments).toHaveLength(targetLotIds.length);

    const assignedLots = await prisma.lot.findMany({
      where: { id: { in: targetLotIds } },
      select: { assignedSubcontractorId: true },
    });
    expect(assignedLots.every((lot) => lot.assignedSubcontractorId === subcontractor.id)).toBe(
      true,
    );

    const unassignRes = await request(app)
      .post('/api/lots/bulk-assign-subcontractor')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        lotIds: targetLotIds,
        subcontractorId: null,
      });

    expect(unassignRes.status).toBe(200);

    const remainingActiveAssignments = await prisma.lotSubcontractorAssignment.count({
      where: {
        lotId: { in: targetLotIds },
        status: 'active',
      },
    });
    const unassignedLots = await prisma.lot.findMany({
      where: { id: { in: targetLotIds } },
      select: { assignedSubcontractorId: true },
    });
    expect(remainingActiveAssignments).toBe(0);
    expect(unassignedLots.every((lot) => lot.assignedSubcontractorId === null)).toBe(true);
  });
});
