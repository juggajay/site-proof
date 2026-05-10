import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { ncrsRouter } from './ncrs/index.js';
import { authRouter } from './auth.js';
import { lotsRouter } from './lots.js';
import { prisma } from '../lib/prisma.js';
import { errorHandler } from '../middleware/errorHandler.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/ncrs', ncrsRouter);
app.use('/api/lots', lotsRouter);
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
    email,
  };
}

async function cleanupTestUser(userId: string) {
  await prisma.emailVerificationToken.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
}

describe('NCR API', () => {
  let authToken: string;
  let userId: string;
  let companyId: string;
  let projectId: string;
  let lotId: string;
  let ncrId: string;

  beforeAll(async () => {
    // Create test company
    const company = await prisma.company.create({
      data: { name: `NCR Test Company ${Date.now()}` },
    });
    companyId = company.id;

    // Create test user
    const testEmail = `ncr-test-${Date.now()}@example.com`;
    const regRes = await request(app).post('/api/auth/register').send({
      email: testEmail,
      password: 'SecureP@ssword123!',
      fullName: 'NCR Test User',
      tosAccepted: true,
    });
    authToken = regRes.body.token;
    userId = regRes.body.user.id;

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'quality_manager' },
    });

    // Create test project
    const project = await prisma.project.create({
      data: {
        name: `NCR Test Project ${Date.now()}`,
        projectNumber: `NTP-${Date.now()}`,
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
        role: 'quality_manager',
        status: 'active',
      },
    });

    // Create test lot
    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `NCR-LOT-${Date.now()}`,
        status: 'in_progress',
        lotType: 'chainage',
        activityType: 'Earthworks',
      },
    });
    lotId = lot.id;
  });

  afterAll(async () => {
    // Clean up in reverse order
    await prisma.notification.deleteMany({ where: { projectId } });
    await prisma.nCREvidence.deleteMany({ where: { ncr: { projectId } } });
    await prisma.nCRLot.deleteMany({ where: { ncr: { projectId } } });
    await prisma.nCR.deleteMany({ where: { projectId } });
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

  describe('POST /api/ncrs', () => {
    it('should create a minor NCR', async () => {
      const res = await request(app)
        .post('/api/ncrs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          description: 'Test non-conformance',
          category: 'Workmanship',
          severity: 'minor',
          lotIds: [lotId],
        });

      expect(res.status).toBe(201);
      expect(res.body.ncr).toBeDefined();
      expect(res.body.ncr.ncrNumber).toMatch(/^NCR-\d{4}$/);
      expect(res.body.ncr.severity).toBe('minor');
      ncrId = res.body.ncr.id;
    });

    it('should create a major NCR with QM approval required', async () => {
      const res = await request(app)
        .post('/api/ncrs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          description: 'Major defect found',
          category: 'Material',
          severity: 'major',
          lotIds: [lotId],
        });

      expect(res.status).toBe(201);
      expect(res.body.ncr.severity).toBe('major');
    });

    it('should allocate the next NCR number from the highest existing sequence', async () => {
      await prisma.nCR.create({
        data: {
          projectId,
          ncrNumber: 'NCR-0099',
          description: 'Existing high sequence NCR',
          category: 'Workmanship',
          severity: 'minor',
          raisedById: userId,
        },
      });

      const res = await request(app)
        .post('/api/ncrs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          description: 'Next NCR should not reuse a lower sequence',
          category: 'Workmanship',
          severity: 'minor',
        });

      expect(res.status).toBe(201);
      expect(res.body.ncr.ncrNumber).toBe('NCR-0100');
    });

    it('should allocate unique NCR numbers for concurrent creation', async () => {
      const responses = await Promise.all(
        [1, 2].map((index) =>
          request(app)
            .post('/api/ncrs')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              projectId,
              description: `Concurrent NCR ${index}`,
              category: 'Workmanship',
              severity: 'minor',
            }),
        ),
      );

      for (const res of responses) {
        expect(res.status).toBe(201);
        expect(res.body.ncr.ncrNumber).toMatch(/^NCR-\d{4}$/);
      }

      const ncrNumbers = responses.map((res) => res.body.ncr.ncrNumber);
      expect(new Set(ncrNumbers).size).toBe(2);
    });

    it('should reject NCR without required fields', async () => {
      const res = await request(app)
        .post('/api/ncrs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          // Missing description and category
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Validation failed');
      expect(res.body.error.details).toBeDefined();
    });

    it('should reject oversized NCR text fields without creating records', async () => {
      const oversizedCases = [
        {
          field: 'description',
          payload: {
            projectId,
            description: 'x'.repeat(5001),
            category: 'Workmanship',
          },
        },
        {
          field: 'category',
          payload: {
            projectId,
            description: 'Valid description',
            category: 'x'.repeat(121),
          },
        },
        {
          field: 'specificationReference',
          payload: {
            projectId,
            description: 'Valid description',
            category: 'Workmanship',
            specificationReference: 'x'.repeat(301),
          },
        },
      ];

      for (const { field, payload } of oversizedCases) {
        const beforeCount = await prisma.nCR.count({ where: { projectId } });
        const res = await request(app)
          .post('/api/ncrs')
          .set('Authorization', `Bearer ${authToken}`)
          .send(payload);

        expect(res.status).toBe(400);
        expect(JSON.stringify(res.body.error.details)).toContain(field);

        const afterCount = await prisma.nCR.count({ where: { projectId } });
        expect(afterCount).toBe(beforeCount);
      }
    });

    it('should reject NCR without projectId', async () => {
      const res = await request(app)
        .post('/api/ncrs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Test',
          category: 'Workmanship',
        });

      expect(res.status).toBe(400);
    });

    it('should reject invalid NCR due dates', async () => {
      const res = await request(app)
        .post('/api/ncrs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          description: 'Invalid due date should be rejected',
          category: 'Workmanship',
          severity: 'minor',
          dueDate: 'not-a-date',
          lotIds: [lotId],
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('dueDate');

      const invalidCalendarDateRes = await request(app)
        .post('/api/ncrs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          description: 'Invalid due date calendar component should be rejected',
          category: 'Workmanship',
          severity: 'minor',
          dueDate: '2026-02-30',
          lotIds: [lotId],
        });

      expect(invalidCalendarDateRes.status).toBe(400);
      expect(invalidCalendarDateRes.body.error.message).toContain('dueDate');

      const invalidCalendarDateTimeRes = await request(app)
        .post('/api/ncrs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          description: 'Invalid due date timestamp should be rejected',
          category: 'Workmanship',
          severity: 'minor',
          dueDate: '2026-02-30T10:00:00Z',
          lotIds: [lotId],
        });

      expect(invalidCalendarDateTimeRes.status).toBe(400);
      expect(invalidCalendarDateTimeRes.body.error.message).toContain('dueDate');
    });

    it('should reject NCR lots outside the project', async () => {
      const otherProject = await prisma.project.create({
        data: {
          name: `NCR Create Other Project ${Date.now()}`,
          projectNumber: `NCR-CREATE-OTHER-${Date.now()}`,
          companyId,
          status: 'active',
          state: 'NSW',
          specificationSet: 'TfNSW',
        },
      });
      const otherLot = await prisma.lot.create({
        data: {
          projectId: otherProject.id,
          lotNumber: `NCR-CREATE-OTHER-LOT-${Date.now()}`,
          status: 'in_progress',
          lotType: 'chainage',
          activityType: 'Earthworks',
        },
      });

      try {
        const res = await request(app)
          .post('/api/ncrs')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            projectId,
            description: 'Cross-project lot should be rejected',
            category: 'Workmanship',
            severity: 'minor',
            lotIds: [otherLot.id],
          });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('NCR lots');
      } finally {
        await prisma.lot.delete({ where: { id: otherLot.id } }).catch(() => {});
        await prisma.project.delete({ where: { id: otherProject.id } }).catch(() => {});
      }
    });

    it('should reject assigning NCRs to users outside the active project team', async () => {
      const outsideUser = await registerTestUser(
        'ncr-create-outside-assignee',
        'Outside NCR Assignee',
      );

      try {
        const res = await request(app)
          .post('/api/ncrs')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            projectId,
            description: 'Outside assignee should be rejected',
            category: 'Workmanship',
            severity: 'minor',
            responsibleUserId: outsideUser.userId,
            lotIds: [lotId],
          });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('Responsible user');
      } finally {
        await cleanupTestUser(outsideUser.userId);
      }
    });

    it('should reject pending project memberships', async () => {
      const pendingEmail = `ncr-pending-create-${Date.now()}@example.com`;
      const pendingRes = await request(app).post('/api/auth/register').send({
        email: pendingEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Pending NCR User',
        tosAccepted: true,
      });
      const pendingToken = pendingRes.body.token;
      const pendingUserId = pendingRes.body.user.id;

      await prisma.user.update({
        where: { id: pendingUserId },
        data: { companyId, roleInCompany: 'quality_manager' },
      });
      await prisma.projectUser.create({
        data: { projectId, userId: pendingUserId, role: 'quality_manager', status: 'pending' },
      });

      const res = await request(app)
        .post('/api/ncrs')
        .set('Authorization', `Bearer ${pendingToken}`)
        .send({
          projectId,
          description: 'Pending user should not create this NCR',
          category: 'Workmanship',
          severity: 'minor',
          lotIds: [lotId],
        });

      expect(res.status).toBe(403);

      await prisma.projectUser.deleteMany({ where: { projectId, userId: pendingUserId } });
      await prisma.emailVerificationToken.deleteMany({ where: { userId: pendingUserId } });
      await prisma.user.delete({ where: { id: pendingUserId } }).catch(() => {});
    });
  });

  describe('GET /api/ncrs', () => {
    it('should list NCRs for accessible projects', async () => {
      const res = await request(app).get('/api/ncrs').set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.ncrs).toBeDefined();
      expect(Array.isArray(res.body.ncrs)).toBe(true);
    });

    it('should filter by status', async () => {
      const res = await request(app)
        .get('/api/ncrs?status=open')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      for (const ncr of res.body.ncrs) {
        expect(ncr.status).toBe('open');
      }
    });

    it('should filter by severity', async () => {
      const res = await request(app)
        .get('/api/ncrs?severity=minor')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      for (const ncr of res.body.ncrs) {
        expect(ncr.severity).toBe('minor');
      }
    });

    it('should filter by projectId', async () => {
      const res = await request(app)
        .get(`/api/ncrs?projectId=${projectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.ncrs.length).toBeGreaterThan(0);
    });

    it('should search NCRs server-side without bypassing project filters', async () => {
      const searchToken = `ncr-search-${Date.now()}`;
      const matchingNcr = await prisma.nCR.create({
        data: {
          projectId,
          ncrNumber: `NCR-SEARCH-${Date.now()}`,
          description: `Visible ${searchToken}`,
          category: 'Workmanship',
          severity: 'minor',
          raisedById: userId,
        },
      });
      const otherNcr = await prisma.nCR.create({
        data: {
          projectId,
          ncrNumber: `NCR-NO-MATCH-${Date.now()}`,
          description: 'Unrelated NCR',
          category: 'Material',
          severity: 'minor',
          raisedById: userId,
        },
      });

      try {
        const res = await request(app)
          .get(
            `/api/ncrs?projectId=${projectId}&search=${encodeURIComponent(searchToken.toUpperCase())}`,
          )
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        const returnedIds = res.body.ncrs.map((ncr: { id: string }) => ncr.id);
        expect(returnedIds).toContain(matchingNcr.id);
        expect(returnedIds).not.toContain(otherNcr.id);
      } finally {
        await prisma.nCR.deleteMany({ where: { id: { in: [matchingNcr.id, otherNcr.id] } } });
      }
    });

    it('should reject unsupported sort fields', async () => {
      const res = await request(app)
        .get('/api/ncrs?sortBy=project&sortOrder=asc')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('sortBy must be one of');
    });

    it('should reject malformed NCR search parameters', async () => {
      const duplicateSearchRes = await request(app)
        .get('/api/ncrs')
        .query({ projectId, search: ['one', 'two'] })
        .set('Authorization', `Bearer ${authToken}`);

      expect(duplicateSearchRes.status).toBe(400);

      const oversizedSearchRes = await request(app)
        .get('/api/ncrs')
        .query({ projectId, search: 'x'.repeat(201) })
        .set('Authorization', `Bearer ${authToken}`);

      expect(oversizedSearchRes.status).toBe(400);
    });

    it('should let subcontractors list NCRs for their assigned lots', async () => {
      const subcontractorCompany = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `NCR Subcontractor ${Date.now()}`,
          primaryContactName: 'Sub Contact',
          primaryContactEmail: `ncr-sub-${Date.now()}@example.com`,
          status: 'approved',
          portalAccess: { ncrs: true },
        },
      });
      const subUser = await registerTestUser('ncr-sub-user', 'NCR Subcontractor User');
      await prisma.user.update({
        where: { id: subUser.userId },
        data: { companyId, roleInCompany: 'subcontractor' },
      });

      const otherLot = await prisma.lot.create({
        data: {
          projectId,
          lotNumber: `NCR-UNASSIGNED-LOT-${Date.now()}`,
          status: 'in_progress',
          lotType: 'chainage',
          activityType: 'Earthworks',
        },
      });
      const otherNcr = await prisma.nCR.create({
        data: {
          projectId,
          ncrNumber: `NCR-OTHER-${Date.now()}`,
          description: 'NCR on an unassigned lot',
          category: 'Workmanship',
          severity: 'minor',
          raisedById: userId,
          ncrLots: {
            create: { lotId: otherLot.id },
          },
        },
      });

      try {
        await prisma.subcontractorUser.create({
          data: {
            userId: subUser.userId,
            subcontractorCompanyId: subcontractorCompany.id,
            role: 'user',
          },
        });
        await prisma.lotSubcontractorAssignment.create({
          data: {
            projectId,
            lotId,
            subcontractorCompanyId: subcontractorCompany.id,
            canCompleteITP: true,
          },
        });

        const res = await request(app)
          .get(`/api/ncrs?projectId=${projectId}&subcontractorView=true`)
          .set('Authorization', `Bearer ${subUser.token}`);

        expect(res.status).toBe(200);
        const returnedIds = res.body.ncrs.map((ncr: { id: string }) => ncr.id);
        expect(returnedIds).toContain(ncrId);
        expect(returnedIds).not.toContain(otherNcr.id);
      } finally {
        await prisma.nCRLot.deleteMany({ where: { ncrId: otherNcr.id } });
        await prisma.nCR.delete({ where: { id: otherNcr.id } }).catch(() => {});
        await prisma.lotSubcontractorAssignment.deleteMany({
          where: { subcontractorCompanyId: subcontractorCompany.id },
        });
        await prisma.lot.delete({ where: { id: otherLot.id } }).catch(() => {});
        await prisma.subcontractorUser.deleteMany({
          where: { subcontractorCompanyId: subcontractorCompany.id },
        });
        await prisma.subcontractorCompany
          .delete({ where: { id: subcontractorCompany.id } })
          .catch(() => {});
        await cleanupTestUser(subUser.userId);
      }
    });

    it('should let subcontractors list NCRs assigned to their company', async () => {
      const subcontractorCompany = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `NCR Responsible Subcontractor ${Date.now()}`,
          primaryContactName: 'Sub Contact',
          primaryContactEmail: `ncr-responsible-sub-${Date.now()}@example.com`,
          status: 'approved',
          portalAccess: { ncrs: true },
        },
      });
      const subUser = await registerTestUser(
        'ncr-responsible-sub-user',
        'Responsible NCR Subcontractor User',
      );
      await prisma.user.update({
        where: { id: subUser.userId },
        data: { companyId, roleInCompany: 'subcontractor' },
      });
      const responsibleNcr = await prisma.nCR.create({
        data: {
          projectId,
          ncrNumber: `NCR-RESP-${Date.now()}`,
          description: 'NCR assigned to subcontractor company',
          category: 'Workmanship',
          severity: 'minor',
          raisedById: userId,
          responsibleSubcontractorId: subcontractorCompany.id,
        },
      });

      try {
        await prisma.subcontractorUser.create({
          data: {
            userId: subUser.userId,
            subcontractorCompanyId: subcontractorCompany.id,
            role: 'user',
          },
        });

        const res = await request(app)
          .get(`/api/ncrs?projectId=${projectId}&subcontractorView=true`)
          .set('Authorization', `Bearer ${subUser.token}`);

        expect(res.status).toBe(200);
        const returnedIds = res.body.ncrs.map((ncr: { id: string }) => ncr.id);
        expect(returnedIds).toContain(responsibleNcr.id);
      } finally {
        await prisma.nCR.delete({ where: { id: responsibleNcr.id } }).catch(() => {});
        await prisma.subcontractorUser.deleteMany({
          where: { subcontractorCompanyId: subcontractorCompany.id },
        });
        await prisma.subcontractorCompany
          .delete({ where: { id: subcontractorCompany.id } })
          .catch(() => {});
        await cleanupTestUser(subUser.userId);
      }
    });

    it('should reject inaccessible projectId filters', async () => {
      const res = await request(app)
        .get('/api/ncrs?projectId=non-existent-project-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/ncrs/:id', () => {
    it('should get a single NCR', async () => {
      const res = await request(app)
        .get(`/api/ncrs/${ncrId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.ncr).toBeDefined();
      expect(res.body.ncr.id).toBe(ncrId);
    });

    it('should return 404 for non-existent NCR', async () => {
      const res = await request(app)
        .get('/api/ncrs/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });

    it('should reject pending project memberships', async () => {
      const pendingEmail = `ncr-pending-read-${Date.now()}@example.com`;
      const pendingRes = await request(app).post('/api/auth/register').send({
        email: pendingEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Pending NCR Read User',
        tosAccepted: true,
      });
      const pendingToken = pendingRes.body.token;
      const pendingUserId = pendingRes.body.user.id;

      await prisma.user.update({
        where: { id: pendingUserId },
        data: { companyId, roleInCompany: 'quality_manager' },
      });
      await prisma.projectUser.create({
        data: { projectId, userId: pendingUserId, role: 'quality_manager', status: 'pending' },
      });

      const res = await request(app)
        .get(`/api/ncrs/${ncrId}`)
        .set('Authorization', `Bearer ${pendingToken}`);

      expect(res.status).toBe(403);

      await prisma.projectUser.deleteMany({ where: { projectId, userId: pendingUserId } });
      await prisma.emailVerificationToken.deleteMany({ where: { userId: pendingUserId } });
      await prisma.user.delete({ where: { id: pendingUserId } }).catch(() => {});
    });

    it('should let subcontractors read only NCR details in their scoped access', async () => {
      const subcontractorCompany = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `NCR Detail Subcontractor ${Date.now()}`,
          primaryContactName: 'Detail Sub Contact',
          primaryContactEmail: `ncr-detail-sub-${Date.now()}@example.com`,
          status: 'approved',
          portalAccess: { ncrs: true },
        },
      });
      const subUser = await registerTestUser(
        'ncr-detail-sub-user',
        'NCR Detail Subcontractor User',
      );
      const otherLot = await prisma.lot.create({
        data: {
          projectId,
          lotNumber: `NCR-DETAIL-UNASSIGNED-${Date.now()}`,
          status: 'in_progress',
          lotType: 'chainage',
          activityType: 'Earthworks',
        },
      });
      const otherNcr = await prisma.nCR.create({
        data: {
          projectId,
          ncrNumber: `NCR-DETAIL-OTHER-${Date.now()}`,
          description: 'Detail NCR on an unassigned lot',
          category: 'Workmanship',
          severity: 'minor',
          raisedById: userId,
          ncrLots: {
            create: { lotId: otherLot.id },
          },
        },
      });
      const responsibleNcr = await prisma.nCR.create({
        data: {
          projectId,
          ncrNumber: `NCR-DETAIL-RESP-${Date.now()}`,
          description: 'Detail NCR assigned to subcontractor company',
          category: 'Workmanship',
          severity: 'minor',
          raisedById: userId,
          responsibleSubcontractorId: subcontractorCompany.id,
        },
      });

      try {
        await prisma.user.update({
          where: { id: subUser.userId },
          data: { companyId, roleInCompany: 'subcontractor' },
        });
        await prisma.subcontractorUser.create({
          data: {
            userId: subUser.userId,
            subcontractorCompanyId: subcontractorCompany.id,
            role: 'user',
          },
        });
        await prisma.lotSubcontractorAssignment.create({
          data: {
            projectId,
            lotId,
            subcontractorCompanyId: subcontractorCompany.id,
            canCompleteITP: true,
          },
        });

        const assignedDetailRes = await request(app)
          .get(`/api/ncrs/${ncrId}`)
          .set('Authorization', `Bearer ${subUser.token}`);

        expect(assignedDetailRes.status).toBe(200);
        expect(assignedDetailRes.body.ncr.id).toBe(ncrId);

        const responsibleDetailRes = await request(app)
          .get(`/api/ncrs/${responsibleNcr.id}`)
          .set('Authorization', `Bearer ${subUser.token}`);

        expect(responsibleDetailRes.status).toBe(200);
        expect(responsibleDetailRes.body.ncr.id).toBe(responsibleNcr.id);

        const unassignedDetailRes = await request(app)
          .get(`/api/ncrs/${otherNcr.id}`)
          .set('Authorization', `Bearer ${subUser.token}`);

        expect(unassignedDetailRes.status).toBe(403);
      } finally {
        await prisma.nCRLot.deleteMany({ where: { ncrId: otherNcr.id } });
        await prisma.nCR.deleteMany({ where: { id: { in: [otherNcr.id, responsibleNcr.id] } } });
        await prisma.lotSubcontractorAssignment.deleteMany({
          where: { subcontractorCompanyId: subcontractorCompany.id },
        });
        await prisma.lot.delete({ where: { id: otherLot.id } }).catch(() => {});
        await prisma.subcontractorUser.deleteMany({
          where: { subcontractorCompanyId: subcontractorCompany.id },
        });
        await prisma.subcontractorCompany
          .delete({ where: { id: subcontractorCompany.id } })
          .catch(() => {});
        await cleanupTestUser(subUser.userId);
      }
    });
  });

  describe('Route parameter validation', () => {
    it('should reject oversized NCR route parameters before lookups', async () => {
      const longId = 'n'.repeat(121);
      const checks = [
        {
          label: 'GET analytics projectId',
          response: await request(app)
            .get(`/api/ncrs/analytics/${longId}`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'GET check role projectId',
          response: await request(app)
            .get(`/api/ncrs/check-role/${longId}`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'GET NCR',
          response: await request(app)
            .get(`/api/ncrs/${longId}`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'PATCH NCR',
          response: await request(app)
            .patch(`/api/ncrs/${longId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ comments: 'Updated comments' }),
        },
        {
          label: 'POST respond',
          response: await request(app)
            .post(`/api/ncrs/${longId}/respond`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ rootCauseCategory: 'Workmanship' }),
        },
        {
          label: 'POST QM review',
          response: await request(app)
            .post(`/api/ncrs/${longId}/qm-review`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ action: 'accept' }),
        },
        {
          label: 'POST rectify',
          response: await request(app)
            .post(`/api/ncrs/${longId}/rectify`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ rectificationNotes: 'Fixed' }),
        },
        {
          label: 'POST reject rectification',
          response: await request(app)
            .post(`/api/ncrs/${longId}/reject-rectification`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ feedback: 'Needs more evidence' }),
        },
        {
          label: 'POST QM approve',
          response: await request(app)
            .post(`/api/ncrs/${longId}/qm-approve`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({}),
        },
        {
          label: 'POST close',
          response: await request(app)
            .post(`/api/ncrs/${longId}/close`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ verificationNotes: 'Verified' }),
        },
        {
          label: 'POST notify client',
          response: await request(app)
            .post(`/api/ncrs/${longId}/notify-client`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ additionalMessage: 'Please review' }),
        },
        {
          label: 'POST reopen',
          response: await request(app)
            .post(`/api/ncrs/${longId}/reopen`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ reason: 'More work required' }),
        },
        {
          label: 'POST submit for verification',
          response: await request(app)
            .post(`/api/ncrs/${longId}/submit-for-verification`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ rectificationNotes: 'Ready for verification' }),
        },
        {
          label: 'POST evidence',
          response: await request(app)
            .post(`/api/ncrs/${longId}/evidence`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              filename: 'route-param-evidence.jpg',
              fileUrl: '/uploads/documents/route-param-evidence.jpg',
            }),
        },
        {
          label: 'GET evidence',
          response: await request(app)
            .get(`/api/ncrs/${longId}/evidence`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'DELETE evidence NCR id',
          response: await request(app)
            .delete(`/api/ncrs/${longId}/evidence/evidence-id`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'DELETE evidence evidenceId',
          response: await request(app)
            .delete(`/api/ncrs/${ncrId}/evidence/${longId}`)
            .set('Authorization', `Bearer ${authToken}`),
        },
      ];

      for (const { label, response } of checks) {
        expect(response.status, label).toBe(400);
        expect(response.body.error.message, label).toContain('is too long');
      }
    });
  });
});

describe('NCR Workflow', () => {
  let authToken: string;
  let userId: string;
  let companyId: string;
  let projectId: string;
  let workflowNcrId: string;

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `NCR Workflow Company ${Date.now()}` },
    });
    companyId = company.id;

    const testEmail = `ncr-workflow-${Date.now()}@example.com`;
    const regRes = await request(app).post('/api/auth/register').send({
      email: testEmail,
      password: 'SecureP@ssword123!',
      fullName: 'NCR Workflow User',
      tosAccepted: true,
    });
    authToken = regRes.body.token;
    userId = regRes.body.user.id;

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'quality_manager' },
    });

    const project = await prisma.project.create({
      data: {
        name: `NCR Workflow Project ${Date.now()}`,
        projectNumber: `NCRWP-${Date.now()}`,
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
        role: 'quality_manager',
        status: 'active',
      },
    });

    // Create NCR for workflow testing
    const ncrRes = await request(app)
      .post('/api/ncrs')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        projectId,
        description: 'Workflow test NCR',
        category: 'Workmanship',
        severity: 'minor',
        responsibleUserId: userId,
      });
    workflowNcrId = ncrRes.body.ncr.id;
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { projectId } });
    await prisma.nCREvidence.deleteMany({ where: { ncr: { projectId } } });
    await prisma.nCRLot.deleteMany({ where: { ncr: { projectId } } });
    await prisma.nCR.deleteMany({ where: { projectId } });
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

  it('should reject oversized workflow text without mutating the NCR', async () => {
    const oversizedWorkflowCases = [
      {
        path: 'respond',
        field: 'rootCauseDescription',
        payload: {
          rootCauseCategory: 'Method',
          rootCauseDescription: 'x'.repeat(5001),
          proposedCorrectiveAction: 'Review work method',
        },
      },
      {
        path: 'qm-review',
        field: 'comments',
        payload: {
          action: 'accept',
          comments: 'x'.repeat(5001),
        },
      },
      {
        path: 'rectify',
        field: 'rectificationNotes',
        payload: {
          rectificationNotes: 'x'.repeat(5001),
        },
      },
      {
        path: 'reject-rectification',
        field: 'feedback',
        payload: {
          feedback: 'x'.repeat(3001),
        },
      },
      {
        path: 'close',
        field: 'verificationNotes',
        payload: {
          verificationNotes: 'x'.repeat(5001),
        },
      },
      {
        path: 'notify-client',
        field: 'additionalMessage',
        payload: {
          additionalMessage: 'x'.repeat(3001),
        },
      },
      {
        path: 'reopen',
        field: 'reason',
        payload: {
          reason: 'x'.repeat(3001),
        },
      },
      {
        path: 'submit-for-verification',
        field: 'rectificationNotes',
        payload: {
          rectificationNotes: 'x'.repeat(5001),
        },
      },
    ];

    const beforeNcr = await prisma.nCR.findUniqueOrThrow({ where: { id: workflowNcrId } });

    for (const { path, field, payload } of oversizedWorkflowCases) {
      const res = await request(app)
        .post(`/api/ncrs/${workflowNcrId}/${path}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(payload);

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body.error.details)).toContain(field);
    }

    const afterNcr = await prisma.nCR.findUniqueOrThrow({ where: { id: workflowNcrId } });
    expect(afterNcr.status).toBe(beforeNcr.status);
    expect(afterNcr.rootCauseDescription).toBe(beforeNcr.rootCauseDescription);
    expect(afterNcr.qmReviewComments).toBe(beforeNcr.qmReviewComments);
    expect(afterNcr.rectificationNotes).toBe(beforeNcr.rectificationNotes);
    expect(afterNcr.verificationNotes).toBe(beforeNcr.verificationNotes);
    expect(afterNcr.lessonsLearned).toBe(beforeNcr.lessonsLearned);
  });

  it('should submit response to NCR', async () => {
    const res = await request(app)
      .post(`/api/ncrs/${workflowNcrId}/respond`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        rootCauseCategory: 'Method',
        rootCauseDescription: 'Incorrect procedure followed',
        proposedCorrectiveAction: 'Retrain workers on correct method',
      });

    expect(res.status).toBe(200);
    expect(res.body.ncr.status).toBe('investigating');
  });

  it('should reject response when NCR not in open status', async () => {
    // NCR is now in investigating status
    const res = await request(app)
      .post(`/api/ncrs/${workflowNcrId}/respond`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        rootCauseCategory: 'Method',
        rootCauseDescription: 'Test',
        proposedCorrectiveAction: 'Test',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('not in open status');
  });

  it('should accept response via QM review', async () => {
    const res = await request(app)
      .post(`/api/ncrs/${workflowNcrId}/qm-review`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        action: 'accept',
        comments: 'Response is acceptable',
      });

    expect(res.status).toBe(200);
    expect(res.body.ncr.status).toBe('rectification');
  });

  it('should submit rectification', async () => {
    const res = await request(app)
      .post(`/api/ncrs/${workflowNcrId}/rectify`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        rectificationNotes: 'Work has been rectified',
      });

    expect(res.status).toBe(200);
    expect(res.body.ncr.status).toBe('verification');
  });

  it('should close NCR', async () => {
    const res = await request(app)
      .post(`/api/ncrs/${workflowNcrId}/close`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        verificationNotes: 'Verified complete',
        lessonsLearned: 'Document procedure changes',
      });

    expect(res.status).toBe(200);
    expect(res.body.ncr.status).toBe('closed');
  });
});

describe('NCR QM Review - Request Revision', () => {
  let authToken: string;
  let userId: string;
  let companyId: string;
  let projectId: string;
  let revisionNcrId: string;

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `NCR Revision Company ${Date.now()}` },
    });
    companyId = company.id;

    const testEmail = `ncr-revision-${Date.now()}@example.com`;
    const regRes = await request(app).post('/api/auth/register').send({
      email: testEmail,
      password: 'SecureP@ssword123!',
      fullName: 'NCR Revision User',
      tosAccepted: true,
    });
    authToken = regRes.body.token;
    userId = regRes.body.user.id;

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'quality_manager' },
    });

    const project = await prisma.project.create({
      data: {
        name: `NCR Revision Project ${Date.now()}`,
        projectNumber: `NCRREV-${Date.now()}`,
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
        role: 'quality_manager',
        status: 'active',
      },
    });

    // Create NCR
    const createRes = await request(app)
      .post('/api/ncrs')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        projectId,
        description: 'Revision test NCR',
        category: 'Workmanship',
        severity: 'minor',
      });
    revisionNcrId = createRes.body.ncr.id;

    // Submit response
    await request(app)
      .post(`/api/ncrs/${revisionNcrId}/respond`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        rootCauseCategory: 'Method',
        rootCauseDescription: 'Test',
        proposedCorrectiveAction: 'Test',
      });
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { projectId } });
    await prisma.nCREvidence.deleteMany({ where: { ncr: { projectId } } });
    await prisma.nCRLot.deleteMany({ where: { ncr: { projectId } } });
    await prisma.nCR.deleteMany({ where: { projectId } });
    await prisma.projectUser.deleteMany({ where: { projectId } });
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {});

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      await prisma.emailVerificationToken.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }

    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  });

  it('should request revision of response', async () => {
    const res = await request(app)
      .post(`/api/ncrs/${revisionNcrId}/qm-review`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        action: 'request_revision',
        comments: 'Root cause analysis is insufficient',
      });

    expect(res.status).toBe(200);
    expect(res.body.ncr.status).toBe('open');
    expect(res.body.ncr.revisionRequested).toBe(true);
  });

  it('should reject invalid action', async () => {
    // First respond again
    await request(app)
      .post(`/api/ncrs/${revisionNcrId}/respond`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        rootCauseCategory: 'Method',
        rootCauseDescription: 'Updated test',
        proposedCorrectiveAction: 'Updated test',
      });

    const res = await request(app)
      .post(`/api/ncrs/${revisionNcrId}/qm-review`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        action: 'invalid_action',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Validation failed');
    expect(res.body.error.details).toBeDefined();
  });
});

describe('Major NCR QM Approval', () => {
  let authToken: string;
  let userId: string;
  let companyId: string;
  let projectId: string;
  let majorNcrId: string;

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `Major NCR Company ${Date.now()}` },
    });
    companyId = company.id;

    const testEmail = `major-ncr-${Date.now()}@example.com`;
    const regRes = await request(app).post('/api/auth/register').send({
      email: testEmail,
      password: 'SecureP@ssword123!',
      fullName: 'Major NCR User',
      tosAccepted: true,
    });
    authToken = regRes.body.token;
    userId = regRes.body.user.id;

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'quality_manager' },
    });

    const project = await prisma.project.create({
      data: {
        name: `Major NCR Project ${Date.now()}`,
        projectNumber: `MAJNCR-${Date.now()}`,
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
        role: 'quality_manager',
        status: 'active',
      },
    });

    // Create major NCR
    const ncrRes = await request(app)
      .post('/api/ncrs')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        projectId,
        description: 'Major defect requiring QM approval',
        category: 'Material',
        severity: 'major',
      });
    majorNcrId = ncrRes.body.ncr.id;

    // Complete workflow up to verification
    await request(app)
      .post(`/api/ncrs/${majorNcrId}/respond`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        rootCauseCategory: 'Material',
        rootCauseDescription: 'Defective material',
        proposedCorrectiveAction: 'Replace material',
      });

    await request(app)
      .post(`/api/ncrs/${majorNcrId}/qm-review`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ action: 'accept' });

    await request(app)
      .post(`/api/ncrs/${majorNcrId}/rectify`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ rectificationNotes: 'Material replaced' });
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { projectId } });
    await prisma.nCREvidence.deleteMany({ where: { ncr: { projectId } } });
    await prisma.nCRLot.deleteMany({ where: { ncr: { projectId } } });
    await prisma.nCR.deleteMany({ where: { projectId } });
    await prisma.projectUser.deleteMany({ where: { projectId } });
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {});

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      await prisma.emailVerificationToken.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }

    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  });

  it('should reject closing major NCR without QM approval', async () => {
    const res = await request(app)
      .post(`/api/ncrs/${majorNcrId}/close`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ verificationNotes: 'Done' });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('Quality Manager approval');
  });

  it('should grant QM approval', async () => {
    const res = await request(app)
      .post(`/api/ncrs/${majorNcrId}/qm-approve`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('approval granted');
  });

  it('should close major NCR after QM approval', async () => {
    const res = await request(app)
      .post(`/api/ncrs/${majorNcrId}/close`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ verificationNotes: 'Verified' });

    expect(res.status).toBe(200);
    expect(res.body.ncr.status).toBe('closed');
  });
});

describe('NCR Access Hardening', () => {
  let authToken: string;
  let userId: string;
  let companyId: string;
  let projectId: string;
  let otherProjectId: string;
  let ncrId: string;
  let otherNcrId: string;
  let sameProjectDocumentId: string;
  let otherProjectDocumentId: string;
  let otherNcrEvidenceId: string;

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `NCR Access Company ${Date.now()}` },
    });
    companyId = company.id;

    const registered = await registerTestUser('ncr-access-user', 'NCR Access User');
    authToken = registered.token;
    userId = registered.userId;

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'quality_manager' },
    });

    const project = await prisma.project.create({
      data: {
        name: `NCR Access Project ${Date.now()}`,
        projectNumber: `NCRACC-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    projectId = project.id;

    const otherProject = await prisma.project.create({
      data: {
        name: `NCR Access Other Project ${Date.now()}`,
        projectNumber: `NCROTHER-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    otherProjectId = otherProject.id;

    await prisma.projectUser.create({
      data: { projectId, userId, role: 'quality_manager', status: 'active' },
    });

    const [ncr, otherNcr] = await Promise.all([
      prisma.nCR.create({
        data: {
          projectId,
          ncrNumber: 'NCR-ACCESS-1',
          description: 'Access hardening NCR',
          category: 'Workmanship',
          severity: 'minor',
          status: 'open',
          raisedById: userId,
        },
      }),
      prisma.nCR.create({
        data: {
          projectId,
          ncrNumber: 'NCR-ACCESS-2',
          description: 'Other access hardening NCR',
          category: 'Workmanship',
          severity: 'minor',
          status: 'open',
          raisedById: userId,
        },
      }),
    ]);
    ncrId = ncr.id;
    otherNcrId = otherNcr.id;

    const [sameProjectDocument, otherProjectDocument] = await Promise.all([
      prisma.document.create({
        data: {
          projectId,
          documentType: 'ncr_evidence',
          category: 'ncr_evidence',
          filename: 'same-project-evidence.jpg',
          fileUrl: '/uploads/same-project-evidence.jpg',
          uploadedById: userId,
        },
      }),
      prisma.document.create({
        data: {
          projectId: otherProjectId,
          documentType: 'ncr_evidence',
          category: 'ncr_evidence',
          filename: 'other-project-evidence.jpg',
          fileUrl: '/uploads/other-project-evidence.jpg',
          uploadedById: userId,
        },
      }),
    ]);
    sameProjectDocumentId = sameProjectDocument.id;
    otherProjectDocumentId = otherProjectDocument.id;

    const otherEvidence = await prisma.nCREvidence.create({
      data: {
        ncrId: otherNcrId,
        documentId: sameProjectDocumentId,
        evidenceType: 'photo',
      },
    });
    otherNcrEvidenceId = otherEvidence.id;
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { projectId } });
    await prisma.nCREvidence.deleteMany({
      where: { ncrId: { in: [ncrId, otherNcrId].filter(Boolean) } },
    });
    await prisma.nCR.deleteMany({ where: { projectId } });
    await prisma.document.deleteMany({
      where: { projectId: { in: [projectId, otherProjectId].filter(Boolean) } },
    });
    await prisma.projectUser.deleteMany({ where: { projectId } });
    await prisma.project.deleteMany({
      where: { id: { in: [projectId, otherProjectId].filter(Boolean) } },
    });
    await cleanupTestUser(userId);
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  });

  it('should reject pending memberships on workflow and analytics routes', async () => {
    const pending = await registerTestUser('ncr-access-pending', 'Pending NCR Access User');
    await prisma.user.update({
      where: { id: pending.userId },
      data: { companyId, roleInCompany: 'quality_manager' },
    });
    await prisma.projectUser.create({
      data: { projectId, userId: pending.userId, role: 'quality_manager', status: 'pending' },
    });

    try {
      const respondRes = await request(app)
        .post(`/api/ncrs/${ncrId}/respond`)
        .set('Authorization', `Bearer ${pending.token}`)
        .send({
          rootCauseCategory: 'Method',
          rootCauseDescription: 'Pending user should not respond',
          proposedCorrectiveAction: 'None',
        });

      expect(respondRes.status).toBe(403);

      const analyticsRes = await request(app)
        .get(`/api/ncrs/analytics/${projectId}`)
        .set('Authorization', `Bearer ${pending.token}`);

      expect(analyticsRes.status).toBe(403);

      const roleRes = await request(app)
        .get(`/api/ncrs/check-role/${projectId}`)
        .set('Authorization', `Bearer ${pending.token}`);

      expect(roleRes.status).toBe(403);

      const patchRes = await request(app)
        .patch(`/api/ncrs/${ncrId}`)
        .set('Authorization', `Bearer ${pending.token}`)
        .send({ comments: 'Pending user should not update NCR metadata' });

      expect(patchRes.status).toBe(403);
    } finally {
      await prisma.projectUser.deleteMany({ where: { projectId, userId: pending.userId } });
      await cleanupTestUser(pending.userId);
    }
  });

  it('should reject subcontractor workflow and evidence routes when NCR portal access is disabled', async () => {
    const subcontractorCompany = await prisma.subcontractorCompany.create({
      data: {
        projectId,
        companyName: `NCR Portal Disabled ${Date.now()}`,
        primaryContactName: 'NCR Portal Disabled Contact',
        primaryContactEmail: `ncr-portal-disabled-${Date.now()}@example.com`,
        status: 'approved',
        portalAccess: { ncrs: false },
      },
    });
    const subcontractor = await registerTestUser(
      'ncr-access-sub-portal',
      'NCR Portal Subcontractor',
    );
    await prisma.user.update({
      where: { id: subcontractor.userId },
      data: { companyId, roleInCompany: 'subcontractor' },
    });
    await prisma.subcontractorUser.create({
      data: {
        userId: subcontractor.userId,
        subcontractorCompanyId: subcontractorCompany.id,
        role: 'user',
      },
    });
    await prisma.projectUser.create({
      data: {
        projectId,
        userId: subcontractor.userId,
        role: 'site_engineer',
        status: 'active',
      },
    });

    try {
      const detailRes = await request(app)
        .get(`/api/ncrs/${ncrId}`)
        .set('Authorization', `Bearer ${subcontractor.token}`);
      expect(detailRes.status).toBe(403);

      const respondRes = await request(app)
        .post(`/api/ncrs/${ncrId}/respond`)
        .set('Authorization', `Bearer ${subcontractor.token}`)
        .send({
          rootCauseCategory: 'Method',
          rootCauseDescription: 'Portal-disabled subcontractor should not respond',
          proposedCorrectiveAction: 'Do not mutate',
        });
      expect(respondRes.status).toBe(403);
      expect(respondRes.body.error.message).toContain('NCRs portal access is not enabled');

      const evidenceRes = await request(app)
        .get(`/api/ncrs/${ncrId}/evidence`)
        .set('Authorization', `Bearer ${subcontractor.token}`);
      expect(evidenceRes.status).toBe(403);
      expect(evidenceRes.body.error.message).toContain('NCRs portal access is not enabled');

      const unchangedNcr = await prisma.nCR.findUniqueOrThrow({
        where: { id: ncrId },
        select: { status: true, rootCauseDescription: true, proposedCorrectiveAction: true },
      });
      expect(unchangedNcr.status).toBe('open');
      expect(unchangedNcr.rootCauseDescription).toBeNull();
      expect(unchangedNcr.proposedCorrectiveAction).toBeNull();
    } finally {
      await prisma.projectUser.deleteMany({ where: { projectId, userId: subcontractor.userId } });
      await prisma.subcontractorUser.deleteMany({ where: { userId: subcontractor.userId } });
      await prisma.subcontractorCompany
        .delete({ where: { id: subcontractorCompany.id } })
        .catch(() => {});
      await cleanupTestUser(subcontractor.userId);
    }
  });

  it('should not grant subcontractors NCR workflow access through project memberships', async () => {
    const suffix = Date.now();
    const subcontractorCompany = await prisma.subcontractorCompany.create({
      data: {
        projectId,
        companyName: `NCR Project Role Subcontractor ${suffix}`,
        primaryContactName: 'NCR Project Role Contact',
        primaryContactEmail: `ncr-project-role-${suffix}@example.com`,
        status: 'approved',
        portalAccess: { ncrs: true },
      },
    });
    const subcontractor = await registerTestUser(
      'ncr-access-sub-project-role',
      'NCR Project Role Subcontractor',
    );
    const blockedDescription = `Project role subcontractor NCR ${suffix}`;
    await prisma.user.update({
      where: { id: subcontractor.userId },
      data: { companyId, roleInCompany: 'subcontractor' },
    });
    await prisma.subcontractorUser.create({
      data: {
        userId: subcontractor.userId,
        subcontractorCompanyId: subcontractorCompany.id,
        role: 'admin',
      },
    });
    await prisma.projectUser.create({
      data: {
        projectId,
        userId: subcontractor.userId,
        role: 'project_manager',
        status: 'active',
      },
    });

    try {
      const respondRes = await request(app)
        .post(`/api/ncrs/${ncrId}/respond`)
        .set('Authorization', `Bearer ${subcontractor.token}`)
        .send({
          rootCauseCategory: 'Method',
          rootCauseDescription: 'Project role subcontractor should not respond',
          proposedCorrectiveAction: 'Do not mutate',
        });
      expect(respondRes.status).toBe(403);

      const analyticsRes = await request(app)
        .get(`/api/ncrs/analytics/${projectId}`)
        .set('Authorization', `Bearer ${subcontractor.token}`);
      expect(analyticsRes.status).toBe(403);

      const createRes = await request(app)
        .post('/api/ncrs')
        .set('Authorization', `Bearer ${subcontractor.token}`)
        .send({
          projectId,
          description: blockedDescription,
          category: 'Workmanship',
          severity: 'minor',
        });
      expect(createRes.status).toBe(403);

      const unchangedNcr = await prisma.nCR.findUniqueOrThrow({
        where: { id: ncrId },
        select: { status: true, rootCauseDescription: true, proposedCorrectiveAction: true },
      });
      expect(unchangedNcr.status).toBe('open');
      expect(unchangedNcr.rootCauseDescription).toBeNull();
      expect(unchangedNcr.proposedCorrectiveAction).toBeNull();
      expect(
        await prisma.nCR.count({ where: { projectId, description: blockedDescription } }),
      ).toBe(0);
    } finally {
      await prisma.projectUser.deleteMany({ where: { projectId, userId: subcontractor.userId } });
      await prisma.subcontractorUser.deleteMany({ where: { userId: subcontractor.userId } });
      await prisma.subcontractorCompany
        .delete({ where: { id: subcontractorCompany.id } })
        .catch(() => {});
      await cleanupTestUser(subcontractor.userId);
    }
  });

  it('should reject redirecting an NCR to a user outside the active project team', async () => {
    const res = await request(app)
      .patch(`/api/ncrs/${ncrId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ responsibleUserId: 'not-an-active-project-user' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Responsible user');
  });

  it('should validate analytics date filters before querying NCRs', async () => {
    const invalidDateRes = await request(app)
      .get(`/api/ncrs/analytics/${projectId}`)
      .query({ startDate: 'not-a-date' })
      .set('Authorization', `Bearer ${authToken}`);

    expect(invalidDateRes.status).toBe(400);
    expect(invalidDateRes.body.error.message).toContain('startDate');

    const invalidCalendarDateRes = await request(app)
      .get(`/api/ncrs/analytics/${projectId}`)
      .query({ endDate: '2026-02-31' })
      .set('Authorization', `Bearer ${authToken}`);

    expect(invalidCalendarDateRes.status).toBe(400);
    expect(invalidCalendarDateRes.body.error.message).toContain('valid date');

    const repeatedDateRes = await request(app)
      .get(`/api/ncrs/analytics/${projectId}`)
      .query({ startDate: ['2026-01-01', '2026-01-02'] })
      .set('Authorization', `Bearer ${authToken}`);

    expect(repeatedDateRes.status).toBe(400);
    expect(repeatedDateRes.body.error.message).toContain('startDate');

    const invertedRangeRes = await request(app)
      .get(`/api/ncrs/analytics/${projectId}`)
      .query({ startDate: '2026-05-10', endDate: '2026-05-09' })
      .set('Authorization', `Bearer ${authToken}`);

    expect(invertedRangeRes.status).toBe(400);
    expect(invertedRangeRes.body.error.message).toContain('startDate');
  });

  it('should return analytics when date filters are valid', async () => {
    const res = await request(app)
      .get(`/api/ncrs/analytics/${projectId}`)
      .query({ startDate: '2026-01-01', endDate: '2026-12-31' })
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.summary).toBeDefined();
    expect(res.body.charts.volumeTrend.data).toBeDefined();
  });

  it('should reject evidence documents from another project', async () => {
    const res = await request(app)
      .post(`/api/ncrs/${ncrId}/evidence`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        documentId: otherProjectDocumentId,
        evidenceType: 'photo',
      });

    expect(res.status).toBe(404);

    const linkedEvidence = await prisma.nCREvidence.count({
      where: { ncrId, documentId: otherProjectDocumentId },
    });
    expect(linkedEvidence).toBe(0);
  });

  it('should reject inline data URLs for evidence documents', async () => {
    const res = await request(app)
      .post(`/api/ncrs/${ncrId}/evidence`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        evidenceType: 'photo',
        filename: 'inline-evidence.jpg',
        fileUrl: 'data:image/jpeg;base64,abc123',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.details.issues[0].message).toContain('Inline data URLs');
  });

  it('should reject non-finite evidence file sizes without creating documents', async () => {
    const filename = `non-finite-evidence-${Date.now()}.jpg`;
    const fileUrl = `/uploads/documents/${filename}`;
    const body = JSON.stringify({
      evidenceType: 'photo',
      filename,
      fileUrl,
      mimeType: 'image/jpeg',
      fileSize: 0,
    }).replace('"fileSize":0', '"fileSize":1e309');

    const res = await request(app)
      .post(`/api/ncrs/${ncrId}/evidence`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('Content-Type', 'application/json')
      .send(body);

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.error.details)).toContain('fileSize');
    expect(JSON.stringify(res.body.error.details)).toContain('finite');

    const createdDocument = await prisma.document.findFirst({
      where: { projectId, filename },
      select: { id: true },
    });
    expect(createdDocument).toBeNull();
  });

  it('should reject invalid evidence file sizes without creating documents', async () => {
    const invalidFileSizes = [
      { fileSize: -1, expectedMessage: 'negative' },
      { fileSize: 1.5, expectedMessage: 'whole number' },
    ];

    for (const { fileSize, expectedMessage } of invalidFileSizes) {
      const filename = `invalid-size-evidence-${fileSize}-${Date.now()}.jpg`;

      const res = await request(app)
        .post(`/api/ncrs/${ncrId}/evidence`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          evidenceType: 'photo',
          filename,
          fileUrl: `/uploads/documents/${filename}`,
          mimeType: 'image/jpeg',
          fileSize,
        });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body.error.details)).toContain(expectedMessage);

      const createdDocument = await prisma.document.findFirst({
        where: { projectId, filename },
        select: { id: true },
      });
      expect(createdDocument).toBeNull();
    }
  });

  it('should reject oversized evidence metadata without creating documents', async () => {
    const oversizedMetadataCases = [
      {
        field: 'evidenceType',
        payload: {
          evidenceType: 'x'.repeat(81),
          filename: `oversized-evidence-type-${Date.now()}.jpg`,
          fileUrl: `/uploads/documents/oversized-evidence-type-${Date.now()}.jpg`,
          mimeType: 'image/jpeg',
        },
      },
      {
        field: 'filename',
        payload: {
          evidenceType: 'photo',
          filename: `${'x'.repeat(181)}.jpg`,
          fileUrl: `/uploads/documents/oversized-evidence-filename-${Date.now()}.jpg`,
          mimeType: 'image/jpeg',
        },
      },
      {
        field: 'mimeType',
        payload: {
          evidenceType: 'photo',
          filename: `oversized-evidence-mime-${Date.now()}.jpg`,
          fileUrl: `/uploads/documents/oversized-evidence-mime-${Date.now()}.jpg`,
          mimeType: 'x'.repeat(121),
        },
      },
      {
        field: 'caption',
        payload: {
          evidenceType: 'photo',
          filename: `oversized-evidence-caption-${Date.now()}.jpg`,
          fileUrl: `/uploads/documents/oversized-evidence-caption-${Date.now()}.jpg`,
          mimeType: 'image/jpeg',
          caption: 'x'.repeat(2001),
        },
      },
    ];

    for (const { field, payload } of oversizedMetadataCases) {
      const res = await request(app)
        .post(`/api/ncrs/${ncrId}/evidence`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(payload);

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body.error.details)).toContain(field);

      const createdDocument = await prisma.document.findFirst({
        where: { projectId, fileUrl: payload.fileUrl },
        select: { id: true },
      });
      expect(createdDocument).toBeNull();
    }
  });

  it('should create evidence only from stored document upload paths', async () => {
    const filename = `new-ncr-evidence-${Date.now()}.jpg`;
    const fileUrl = `/uploads/documents/${filename}`;

    const res = await request(app)
      .post(`/api/ncrs/${ncrId}/evidence`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        evidenceType: 'photo',
        filename,
        fileUrl,
        mimeType: 'image/jpeg',
      });

    expect(res.status).toBe(201);
    expect(res.body.evidence.document.fileUrl).toBe(fileUrl);
  });

  it('should reject evidence file URLs outside stored document uploads', async () => {
    const filename = `comment-upload-reference-${Date.now()}.jpg`;

    const res = await request(app)
      .post(`/api/ncrs/${ncrId}/evidence`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        evidenceType: 'photo',
        filename,
        fileUrl: `/uploads/comments/${filename}`,
        mimeType: 'image/jpeg',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('uploaded document file');

    const createdDocument = await prisma.document.findFirst({
      where: { projectId, filename },
      select: { id: true },
    });
    expect(createdDocument).toBeNull();
  });

  it('should not delete evidence from a different NCR', async () => {
    const res = await request(app)
      .delete(`/api/ncrs/${ncrId}/evidence/${otherNcrEvidenceId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(404);

    const evidence = await prisma.nCREvidence.findUnique({ where: { id: otherNcrEvidenceId } });
    expect(evidence).not.toBeNull();
  });
});
