import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { ncrsRouter } from './ncrs/index.js';
import { authRouter } from './auth.js';
import { lotsRouter } from './lots.js';
import { prisma } from '../lib/prisma.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { AuditAction, parseAuditLogChanges } from '../lib/auditLog.js';
import * as emailService from '../lib/email.js';
import { registerTestUser as registerSharedTestUser } from '../test/routeTestHarness.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/ncrs', ncrsRouter);
app.use('/api/lots', lotsRouter);
app.use(errorHandler);

async function registerTestUser(prefix: string, fullName: string) {
  return registerSharedTestUser(app, { emailPrefix: prefix, fullName });
}

async function cleanupTestUser(userId: string) {
  await prisma.emailVerificationToken.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
}

async function createNcrEvidence(projectId: string, userId: string, ncrId: string) {
  const filename = `ncr-evidence-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const document = await prisma.document.create({
    data: {
      projectId,
      documentType: 'ncr_evidence',
      category: 'ncr_evidence',
      filename,
      fileUrl: `/uploads/documents/${filename}`,
      uploadedById: userId,
    },
  });

  return prisma.nCREvidence.create({
    data: {
      ncrId,
      documentId: document.id,
      evidenceType: 'photo',
    },
  });
}

function holdNextTwoNcrReads(ncrId: string) {
  const originalFindUnique = prisma.nCR.findUnique.bind(prisma.nCR);
  let reads = 0;
  let unblockReads!: () => void;
  const readsBarrier = new Promise<void>((resolve) => {
    unblockReads = resolve;
  });

  const findUniqueSpy = vi.spyOn(prisma.nCR, 'findUnique');
  findUniqueSpy.mockImplementation(((args) => {
    return originalFindUnique(args).then(async (result) => {
      if (args?.where?.id === ncrId && reads < 2) {
        reads += 1;
        if (reads === 2) {
          unblockReads();
        }
        await readsBarrier;
      }
      return result;
    }) as ReturnType<typeof prisma.nCR.findUnique>;
  }) as Parameters<typeof findUniqueSpy.mockImplementation>[0]);

  return findUniqueSpy;
}

async function findStatusTransitionAudits(
  projectId: string,
  userId: string,
  ncrId: string,
  from: string,
  to: string,
) {
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      projectId,
      userId,
      entityType: 'ncr',
      entityId: ncrId,
      action: AuditAction.NCR_STATUS_CHANGED,
    },
  });

  return auditLogs.filter((auditLog) => {
    const changes = parseAuditLogChanges(auditLog.changes) as {
      status?: { from?: string; to?: string };
    };
    return changes.status?.from === from && changes.status.to === to;
  });
}

async function expectConcurrentNcrTerminalState(
  responses: Array<{ status: number }>,
  ncrId: string,
  expected: { status: string; closedById: string | null },
) {
  expect(responses.map((response) => response.status).sort()).toEqual([200, 400]);

  const ncr = await prisma.nCR.findUniqueOrThrow({
    where: { id: ncrId },
    select: { status: true, closedAt: true, closedById: true },
  });
  expect(ncr.status).toBe(expected.status);

  if (expected.closedById) {
    expect(ncr.closedAt).toBeInstanceOf(Date);
    expect(ncr.closedById).toBe(expected.closedById);
  } else {
    expect(ncr.closedAt).toBeNull();
    expect(ncr.closedById).toBeNull();
  }
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
    const primaryUser = await registerSharedTestUser(app, {
      emailPrefix: 'ncr-test',
      fullName: 'NCR Test User',
      companyId,
      roleInCompany: 'quality_manager',
    });
    authToken = primaryUser.token;
    userId = primaryUser.userId;

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
    it('should write an audit log when creating an NCR', async () => {
      await prisma.auditLog.deleteMany({
        where: { projectId, action: AuditAction.NCR_CREATED },
      });

      const res = await request(app)
        .post('/api/ncrs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          description: 'Audited non-conformance',
          category: 'Workmanship',
          severity: 'minor',
          lotIds: [lotId],
        });

      expect(res.status).toBe(201);

      const auditLog = await prisma.auditLog.findFirst({
        where: {
          projectId,
          entityType: 'ncr',
          entityId: res.body.ncr.id,
          action: AuditAction.NCR_CREATED,
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(auditLog).not.toBeNull();
      if (!auditLog) {
        throw new Error('Expected NCR creation audit log');
      }
      expect(auditLog.userId).toBe(userId);
      const changes = parseAuditLogChanges(auditLog.changes) as Record<string, unknown>;
      expect(changes).toEqual({
        ncrNumber: res.body.ncr.ncrNumber,
        status: 'open',
        severity: 'minor',
        category: 'Workmanship',
        lotIds: [lotId],
      });
      expect(JSON.stringify(changes)).not.toContain('Audited non-conformance');
    });

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

    it('notifies the responsible party when NCR Assignments is enabled (default)', async () => {
      const assignee = await registerTestUser('ncr-assign-on', 'NCR Assignee On');
      await prisma.user.update({
        where: { id: assignee.userId },
        data: { companyId, roleInCompany: 'quality_manager' },
      });
      await prisma.projectUser.create({
        data: { projectId, userId: assignee.userId, role: 'quality_manager', status: 'active' },
      });

      try {
        const res = await request(app)
          .post('/api/ncrs')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            projectId,
            description: 'Assignment notification should fire by default',
            category: 'Workmanship',
            severity: 'minor',
            responsibleUserId: assignee.userId,
            lotIds: [lotId],
          });

        expect(res.status).toBe(201);

        const notification = await prisma.notification.findFirst({
          where: { userId: assignee.userId, projectId, type: 'ncr_assigned' },
        });
        expect(notification).not.toBeNull();
      } finally {
        await prisma.notification.deleteMany({ where: { userId: assignee.userId } });
        await prisma.nCRLot.deleteMany({ where: { ncr: { responsibleUserId: assignee.userId } } });
        await prisma.nCR.deleteMany({ where: { responsibleUserId: assignee.userId } });
        await prisma.projectUser.deleteMany({ where: { projectId, userId: assignee.userId } });
        await cleanupTestUser(assignee.userId);
      }
    });

    it('suppresses the assignment notification when the project toggle is off', async () => {
      const assignee = await registerTestUser('ncr-assign-off', 'NCR Assignee Off');
      await prisma.user.update({
        where: { id: assignee.userId },
        data: { companyId, roleInCompany: 'quality_manager' },
      });
      await prisma.projectUser.create({
        data: { projectId, userId: assignee.userId, role: 'quality_manager', status: 'active' },
      });

      await prisma.project.update({
        where: { id: projectId },
        data: {
          settings: JSON.stringify({ notificationPreferences: { ncrAssignments: false } }),
        },
      });

      try {
        const res = await request(app)
          .post('/api/ncrs')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            projectId,
            description: 'Assignment notification should be suppressed',
            category: 'Workmanship',
            severity: 'minor',
            responsibleUserId: assignee.userId,
            lotIds: [lotId],
          });

        // The NCR is still created; only the assignment notification is suppressed.
        expect(res.status).toBe(201);

        const notification = await prisma.notification.findFirst({
          where: { userId: assignee.userId, projectId, type: 'ncr_assigned' },
        });
        expect(notification).toBeNull();
      } finally {
        await prisma.project.update({ where: { id: projectId }, data: { settings: null } });
        await prisma.notification.deleteMany({ where: { userId: assignee.userId } });
        await prisma.nCRLot.deleteMany({ where: { ncr: { responsibleUserId: assignee.userId } } });
        await prisma.nCR.deleteMany({ where: { responsibleUserId: assignee.userId } });
        await prisma.projectUser.deleteMany({ where: { projectId, userId: assignee.userId } });
        await cleanupTestUser(assignee.userId);
      }
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

    it('should reject unsupported status and severity filters', async () => {
      const invalidStatusRes = await request(app)
        .get('/api/ncrs?status=deleted')
        .set('Authorization', `Bearer ${authToken}`);

      expect(invalidStatusRes.status).toBe(400);
      expect(invalidStatusRes.body.error.message).toContain('status must be one of');

      const invalidSeverityRes = await request(app)
        .get('/api/ncrs?severity=critical')
        .set('Authorization', `Bearer ${authToken}`);

      expect(invalidSeverityRes.status).toBe(400);
      expect(invalidSeverityRes.body.error.message).toContain('severity must be one of');
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

    const primaryUser = await registerSharedTestUser(app, {
      emailPrefix: 'ncr-workflow',
      fullName: 'NCR Workflow User',
      companyId,
      roleInCompany: 'quality_manager',
    });
    authToken = primaryUser.token;
    userId = primaryUser.userId;

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

  async function createRectificationNcrWithEvidence(
    description: string,
    severity: 'minor' | 'major' = 'minor',
  ) {
    const ncr = await prisma.nCR.create({
      data: {
        projectId,
        ncrNumber: `NCR-RACE-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        description,
        category: 'Workmanship',
        severity,
        status: 'rectification',
        raisedById: userId,
        responsibleUserId: userId,
        rootCauseCategory: 'Method',
        rootCauseDescription: 'Incorrect procedure followed',
        proposedCorrectiveAction: 'Retrain workers on correct method',
        responseSubmittedAt: new Date(),
        qmReviewedAt: new Date(),
        qmReviewedById: userId,
        qmReviewComments: 'Response is acceptable',
      },
    });

    await createNcrEvidence(projectId, userId, ncr.id);

    return ncr.id;
  }

  async function createVerificationNcr(description: string, severity: 'minor' | 'major' = 'minor') {
    const ncrRes = await request(app)
      .post('/api/ncrs')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        projectId,
        description,
        category: 'Workmanship',
        severity,
        responsibleUserId: userId,
      });
    expect(ncrRes.status).toBe(201);
    const createdNcrId = ncrRes.body.ncr.id as string;

    const respondRes = await request(app)
      .post(`/api/ncrs/${createdNcrId}/respond`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        rootCauseCategory: 'Method',
        rootCauseDescription: 'Incorrect procedure followed',
        proposedCorrectiveAction: 'Retrain workers on correct method',
      });
    expect(respondRes.status).toBe(200);

    const reviewRes = await request(app)
      .post(`/api/ncrs/${createdNcrId}/qm-review`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        action: 'accept',
        comments: 'Response is acceptable',
      });
    expect(reviewRes.status).toBe(200);

    await createNcrEvidence(projectId, userId, createdNcrId);

    const rectifyRes = await request(app)
      .post(`/api/ncrs/${createdNcrId}/rectify`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        rectificationNotes: 'Work has been rectified',
      });
    expect(rectifyRes.status).toBe(200);
    expect(rectifyRes.body.ncr.status).toBe('verification');

    return createdNcrId;
  }

  async function expectConcurrentVerificationSubmit(
    path: 'rectify' | 'submit-for-verification',
    description: string,
  ) {
    const raceNcrId = await createRectificationNcrWithEvidence(description);
    const findUniqueSpy = holdNextTwoNcrReads(raceNcrId);

    try {
      const [firstSubmitRes, secondSubmitRes] = await Promise.all([
        request(app)
          .post(`/api/ncrs/${raceNcrId}/${path}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ rectificationNotes: 'First submit wins' }),
        request(app)
          .post(`/api/ncrs/${raceNcrId}/${path}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ rectificationNotes: 'Second submit should be rejected' }),
      ]);

      expect([firstSubmitRes.status, secondSubmitRes.status].sort()).toEqual([200, 400]);

      const ncr = await prisma.nCR.findUniqueOrThrow({
        where: { id: raceNcrId },
        select: {
          status: true,
          rectificationNotes: true,
          rectificationSubmittedAt: true,
        },
      });
      expect(ncr.status).toBe('verification');
      expect(['First submit wins', 'Second submit should be rejected']).toContain(
        ncr.rectificationNotes,
      );
      expect(ncr.rectificationSubmittedAt).toBeInstanceOf(Date);

      const submitAudits = await findStatusTransitionAudits(
        projectId,
        userId,
        raceNcrId,
        'rectification',
        'verification',
      );
      expect(submitAudits).toHaveLength(1);
    } finally {
      findUniqueSpy.mockRestore();
    }
  }

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

  it('should reject client notification without a recipient and leave notification state untouched', async () => {
    const createRes = await request(app)
      .post('/api/ncrs')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        projectId,
        description: 'Major NCR needs a real recipient',
        category: 'Workmanship',
        severity: 'major',
        responsibleUserId: userId,
      });

    expect(createRes.status).toBe(201);
    const ncrId = createRes.body.ncr.id as string;

    const notifyRes = await request(app)
      .post(`/api/ncrs/${ncrId}/notify-client`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        additionalMessage: 'Please review',
      });

    expect(notifyRes.status).toBe(400);
    expect(notifyRes.body.error.message).toContain('Recipient email is required');

    const unchanged = await prisma.nCR.findUniqueOrThrow({
      where: { id: ncrId },
      select: { clientNotifiedAt: true },
    });
    expect(unchanged.clientNotifiedAt).toBeNull();
  });

  it('should send client notification email and audit metadata only', async () => {
    const sensitiveDescription = `Client notification leak sentinel ${Date.now()}`;
    const sensitiveMessage = `Private client context ${Date.now()}`;
    const sensitiveRecipient = `client-${Date.now()}@example.com`;
    emailService.clearEmailQueue();

    const createRes = await request(app)
      .post('/api/ncrs')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        projectId,
        description: sensitiveDescription,
        category: 'Workmanship',
        severity: 'major',
        responsibleUserId: userId,
      });

    expect(createRes.status).toBe(201);
    const ncrId = createRes.body.ncr.id as string;

    const notifyRes = await request(app)
      .post(`/api/ncrs/${ncrId}/notify-client`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('User-Agent', 'ncr-client-notify-audit-test')
      .send({
        recipientEmail: sensitiveRecipient,
        additionalMessage: sensitiveMessage,
      });

    expect(notifyRes.status).toBe(200);

    const queuedEmail = emailService
      .getQueuedEmails()
      .find((email) => email.to === sensitiveRecipient);
    expect(queuedEmail).toBeDefined();
    expect(queuedEmail?.subject).toContain(createRes.body.ncr.ncrNumber);
    expect(queuedEmail?.text).toContain(sensitiveDescription);

    const auditLog = await prisma.auditLog.findFirst({
      where: {
        projectId,
        userId,
        entityType: 'ncr',
        entityId: ncrId,
        action: AuditAction.NCR_CLIENT_NOTIFIED,
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(auditLog).toBeTruthy();
    expect(auditLog!.ipAddress).toBeTruthy();
    expect(auditLog!.userAgent).toBe('ncr-client-notify-audit-test');

    const changes = parseAuditLogChanges(auditLog!.changes) as Record<string, unknown>;
    expect(changes).toMatchObject({
      ncrNumber: createRes.body.ncr.ncrNumber,
      recipientEmailPresent: true,
      additionalMessagePresent: true,
      affectedLotCount: 0,
      severity: 'major',
    });

    const serializedChanges = JSON.stringify(changes);
    expect(serializedChanges).not.toContain(sensitiveRecipient);
    expect(serializedChanges).not.toContain(sensitiveMessage);
    expect(serializedChanges).not.toContain(sensitiveDescription);
    expect(serializedChanges).not.toContain('notificationPackage');
  });

  it('should send only one client notification when concurrent requests race', async () => {
    const recipientEmail = `client-race-${Date.now()}@example.com`;
    const sendEmailSpy = vi.spyOn(emailService, 'sendEmail').mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { success: true };
    });

    try {
      const createRes = await request(app)
        .post('/api/ncrs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          description: 'Major NCR client notify race',
          category: 'Workmanship',
          severity: 'major',
          responsibleUserId: userId,
        });

      expect(createRes.status).toBe(201);
      const raceNcrId = createRes.body.ncr.id as string;

      const [firstNotifyRes, secondNotifyRes] = await Promise.all([
        request(app)
          .post(`/api/ncrs/${raceNcrId}/notify-client`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ recipientEmail }),
        request(app)
          .post(`/api/ncrs/${raceNcrId}/notify-client`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ recipientEmail }),
      ]);

      expect([firstNotifyRes.status, secondNotifyRes.status].sort()).toEqual([200, 400]);
      expect(sendEmailSpy).toHaveBeenCalledTimes(1);

      const auditLogs = await prisma.auditLog.findMany({
        where: {
          projectId,
          userId,
          entityType: 'ncr',
          entityId: raceNcrId,
          action: AuditAction.NCR_CLIENT_NOTIFIED,
        },
      });
      expect(auditLogs).toHaveLength(1);
    } finally {
      sendEmailSpy.mockRestore();
    }
  });

  it('should not mark client notified or audit when client notification email fails', async () => {
    const recipientEmail = `failed-client-${Date.now()}@example.com`;
    const sendEmailSpy = vi.spyOn(emailService, 'sendEmail').mockResolvedValueOnce({
      success: false,
      error: 'simulated delivery failure',
    });

    try {
      const createRes = await request(app)
        .post('/api/ncrs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          description: 'Major NCR notification must fail closed',
          category: 'Workmanship',
          severity: 'major',
          responsibleUserId: userId,
        });

      expect(createRes.status).toBe(201);
      const failedNotifyNcrId = createRes.body.ncr.id as string;

      const notifyRes = await request(app)
        .post(`/api/ncrs/${failedNotifyNcrId}/notify-client`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          recipientEmail,
          additionalMessage: 'This message should not mark the NCR notified.',
        });

      expect(sendEmailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: recipientEmail,
        }),
      );
      expect(notifyRes.status).toBe(500);
      expect(notifyRes.body.error.message).toContain('Client notification email could not be sent');

      const unchanged = await prisma.nCR.findUniqueOrThrow({
        where: { id: failedNotifyNcrId },
        select: { clientNotifiedAt: true },
      });
      expect(unchanged.clientNotifiedAt).toBeNull();

      const auditLog = await prisma.auditLog.findFirst({
        where: {
          projectId,
          userId,
          entityType: 'ncr',
          entityId: failedNotifyNcrId,
          action: AuditAction.NCR_CLIENT_NOTIFIED,
        },
      });
      expect(auditLog).toBeNull();
    } finally {
      sendEmailSpy.mockRestore();
    }
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

    const auditLog = await prisma.auditLog.findFirst({
      where: {
        projectId,
        userId,
        entityType: 'ncr',
        entityId: workflowNcrId,
        action: AuditAction.NCR_STATUS_CHANGED,
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(auditLog).toBeTruthy();
    expect(parseAuditLogChanges(auditLog!.changes)).toMatchObject({
      status: { from: 'open', to: 'investigating' },
      rootCauseCategoryPresent: true,
      rootCauseDescriptionPresent: true,
      proposedCorrectiveActionPresent: true,
    });
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
    const currentNcr = await prisma.nCR.findUniqueOrThrow({ where: { id: workflowNcrId } });
    if (currentNcr.status === 'open') {
      const respondRes = await request(app)
        .post(`/api/ncrs/${workflowNcrId}/respond`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          rootCauseCategory: 'Method',
          rootCauseDescription: 'Incorrect procedure followed',
          proposedCorrectiveAction: 'Retrain workers on correct method',
        });
      expect(respondRes.status).toBe(200);
    }

    const res = await request(app)
      .post(`/api/ncrs/${workflowNcrId}/qm-review`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        action: 'accept',
        comments: 'Response is acceptable',
      });

    expect(res.status).toBe(200);
    expect(res.body.ncr.status).toBe('rectification');

    const auditLog = await prisma.auditLog.findFirst({
      where: {
        projectId,
        userId,
        entityType: 'ncr',
        entityId: workflowNcrId,
        action: AuditAction.NCR_STATUS_CHANGED,
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(auditLog).toBeTruthy();
    expect(parseAuditLogChanges(auditLog!.changes)).toMatchObject({
      status: { from: 'investigating', to: 'rectification' },
      qmReviewAction: 'accept',
      commentsPresent: true,
    });

    const reviewedNcr = await prisma.nCR.findUniqueOrThrow({
      where: { id: workflowNcrId },
      select: { qmReviewedAt: true },
    });
    expect(reviewedNcr.qmReviewedAt).toBeTruthy();

    const auditCountBeforeRetry = await prisma.auditLog.count({
      where: {
        projectId,
        userId,
        entityType: 'ncr',
        entityId: workflowNcrId,
        action: AuditAction.NCR_STATUS_CHANGED,
      },
    });
    const notificationCountBeforeRetry = await prisma.notification.count({
      where: {
        projectId,
        userId,
        type: 'ncr_response_accepted',
      },
    });

    const retryRes = await request(app)
      .post(`/api/ncrs/${workflowNcrId}/qm-review`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        action: 'accept',
        comments: 'Response is acceptable',
      });

    expect(retryRes.status).toBe(200);
    expect(retryRes.body.ncr.status).toBe('rectification');

    const afterRetryNcr = await prisma.nCR.findUniqueOrThrow({
      where: { id: workflowNcrId },
      select: { qmReviewedAt: true },
    });
    expect(afterRetryNcr.qmReviewedAt?.toISOString()).toBe(reviewedNcr.qmReviewedAt?.toISOString());

    await expect(
      prisma.auditLog.count({
        where: {
          projectId,
          userId,
          entityType: 'ncr',
          entityId: workflowNcrId,
          action: AuditAction.NCR_STATUS_CHANGED,
        },
      }),
    ).resolves.toBe(auditCountBeforeRetry);
    await expect(
      prisma.notification.count({
        where: {
          projectId,
          userId,
          type: 'ncr_response_accepted',
        },
      }),
    ).resolves.toBe(notificationCountBeforeRetry);
  });

  it('should reject rectification when no evidence has been uploaded', async () => {
    const ncrRes = await request(app)
      .post('/api/ncrs')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        projectId,
        description: 'Rectification should require evidence',
        category: 'Workmanship',
        severity: 'minor',
        responsibleUserId: userId,
      });
    const ncrId = ncrRes.body.ncr.id as string;

    await request(app)
      .post(`/api/ncrs/${ncrId}/respond`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        rootCauseCategory: 'Method',
        rootCauseDescription: 'Incorrect procedure followed',
        proposedCorrectiveAction: 'Retrain workers on correct method',
      });

    await request(app)
      .post(`/api/ncrs/${ncrId}/qm-review`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        action: 'accept',
        comments: 'Response is acceptable',
      });

    const res = await request(app)
      .post(`/api/ncrs/${ncrId}/rectify`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        rectificationNotes: 'Work has been rectified',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain(
      'Please upload at least one piece of evidence before submitting for verification',
    );
    expect(res.body.error.details).toEqual({ evidenceCount: 0 });

    const ncr = await prisma.nCR.findUniqueOrThrow({ where: { id: ncrId } });
    expect(ncr.status).toBe('rectification');
    expect(ncr.rectificationSubmittedAt).toBeNull();
  });

  it('should submit rectification', async () => {
    await createNcrEvidence(projectId, userId, workflowNcrId);

    const res = await request(app)
      .post(`/api/ncrs/${workflowNcrId}/rectify`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        rectificationNotes: 'Work has been rectified',
      });

    expect(res.status).toBe(200);
    expect(res.body.ncr.status).toBe('verification');

    const auditLog = await prisma.auditLog.findFirst({
      where: {
        projectId,
        userId,
        entityType: 'ncr',
        entityId: workflowNcrId,
        action: AuditAction.NCR_STATUS_CHANGED,
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(auditLog).toBeTruthy();
    expect(parseAuditLogChanges(auditLog!.changes)).toMatchObject({
      status: { from: 'rectification', to: 'verification' },
      rectificationNotesPresent: true,
      evidenceCount: 1,
    });
  });

  it('should submit rectification only once when concurrent legacy rectify requests race', async () => {
    await expectConcurrentVerificationSubmit('rectify', 'Concurrent legacy rectify race');
  });

  it('should audit submit-for-verification from the UI path', async () => {
    const ncrRes = await request(app)
      .post('/api/ncrs')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        projectId,
        description: 'Submit for verification should be audited',
        category: 'Workmanship',
        severity: 'minor',
        responsibleUserId: userId,
      });
    expect(ncrRes.status).toBe(201);
    const ncrId = ncrRes.body.ncr.id as string;

    await request(app)
      .post(`/api/ncrs/${ncrId}/respond`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        rootCauseCategory: 'Method',
        rootCauseDescription: 'Incorrect method used',
        proposedCorrectiveAction: 'Rework and submit evidence',
      });

    await request(app)
      .post(`/api/ncrs/${ncrId}/qm-review`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        action: 'accept',
        comments: 'Response accepted',
      });

    await createNcrEvidence(projectId, userId, ncrId);

    const res = await request(app)
      .post(`/api/ncrs/${ncrId}/submit-for-verification`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        rectificationNotes: 'Ready for verification from UI path',
      });

    expect(res.status).toBe(200);
    expect(res.body.ncr.status).toBe('verification');

    const auditLog = await prisma.auditLog.findFirst({
      where: {
        projectId,
        userId,
        entityType: 'ncr',
        entityId: ncrId,
        action: AuditAction.NCR_STATUS_CHANGED,
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(auditLog).toBeTruthy();
    expect(parseAuditLogChanges(auditLog!.changes)).toMatchObject({
      status: { from: 'rectification', to: 'verification' },
      rectificationNotesPresent: true,
      evidenceCount: 1,
      submissionPath: 'submit-for-verification',
    });
  });

  it('should submit for verification only once when concurrent UI submit requests race', async () => {
    await expectConcurrentVerificationSubmit(
      'submit-for-verification',
      'Concurrent UI submit-for-verification race',
    );
  });

  it('should reject rectification and write an audit log', async () => {
    const ncrRes = await request(app)
      .post('/api/ncrs')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        projectId,
        description: 'Rectification rejection audit NCR',
        category: 'Workmanship',
        severity: 'minor',
        responsibleUserId: userId,
      });
    const ncrId = ncrRes.body.ncr.id as string;

    await request(app)
      .post(`/api/ncrs/${ncrId}/respond`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        rootCauseCategory: 'Method',
        rootCauseDescription: 'Incorrect procedure followed',
        proposedCorrectiveAction: 'Retrain workers on correct method',
      });

    await request(app)
      .post(`/api/ncrs/${ncrId}/qm-review`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        action: 'accept',
        comments: 'Response is acceptable',
      });

    await createNcrEvidence(projectId, userId, ncrId);

    await request(app)
      .post(`/api/ncrs/${ncrId}/rectify`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        rectificationNotes: 'Work has been rectified',
      });

    const res = await request(app)
      .post(`/api/ncrs/${ncrId}/reject-rectification`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        feedback: 'Evidence does not prove the corrective action is complete',
      });

    expect(res.status).toBe(200);
    expect(res.body.ncr.status).toBe('rectification');

    const auditLog = await prisma.auditLog.findFirst({
      where: {
        projectId,
        userId,
        entityType: 'ncr',
        entityId: ncrId,
        action: AuditAction.NCR_STATUS_CHANGED,
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(auditLog).toBeTruthy();
    expect(parseAuditLogChanges(auditLog!.changes)).toMatchObject({
      status: { from: 'verification', to: 'rectification' },
      feedbackPresent: true,
    });
  });

  it('should reject closing directly from rectification status', async () => {
    const ncrRes = await request(app)
      .post('/api/ncrs')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        projectId,
        description: 'Close should require verification NCR',
        category: 'Workmanship',
        severity: 'minor',
        responsibleUserId: userId,
      });
    expect(ncrRes.status).toBe(201);
    const ncrId = ncrRes.body.ncr.id as string;

    const respondRes = await request(app)
      .post(`/api/ncrs/${ncrId}/respond`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        rootCauseCategory: 'Method',
        rootCauseDescription: 'Incorrect procedure followed',
        proposedCorrectiveAction: 'Retrain workers on correct method',
      });
    expect(respondRes.status).toBe(200);

    const reviewRes = await request(app)
      .post(`/api/ncrs/${ncrId}/qm-review`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        action: 'accept',
        comments: 'Response is acceptable',
      });
    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.ncr.status).toBe('rectification');

    const closeRes = await request(app)
      .post(`/api/ncrs/${ncrId}/close`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        verificationNotes: 'This should not close before verification',
      });

    expect(closeRes.status).toBe(400);
    expect(closeRes.body.error.message).toContain('verification status');

    const ncr = await prisma.nCR.findUniqueOrThrow({
      where: { id: ncrId },
      select: {
        status: true,
        verifiedAt: true,
        verificationNotes: true,
        closedAt: true,
        closedById: true,
      },
    });
    expect(ncr.status).toBe('rectification');
    expect(ncr.verifiedAt).toBeNull();
    expect(ncr.verificationNotes).toBeNull();
    expect(ncr.closedAt).toBeNull();
    expect(ncr.closedById).toBeNull();
  });

  it('should reject concession closure without justification and risk assessment', async () => {
    const ncrId = await createVerificationNcr('Concession close should require rationale');

    const res = await request(app)
      .post(`/api/ncrs/${ncrId}/close`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        verificationNotes: 'Accepting with concession',
        withConcession: true,
      });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.error.details)).toContain(
      'Concession justification is required',
    );
    expect(JSON.stringify(res.body.error.details)).toContain(
      'Concession risk assessment is required',
    );

    const ncr = await prisma.nCR.findUniqueOrThrow({
      where: { id: ncrId },
      select: {
        status: true,
        closedAt: true,
        closedById: true,
        concessionJustification: true,
        concessionRiskAssessment: true,
      },
    });
    expect(ncr.status).toBe('verification');
    expect(ncr.closedAt).toBeNull();
    expect(ncr.closedById).toBeNull();
    expect(ncr.concessionJustification).toBeNull();
    expect(ncr.concessionRiskAssessment).toBeNull();
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

    const auditLog = await prisma.auditLog.findFirst({
      where: {
        projectId,
        userId,
        entityType: 'ncr',
        entityId: workflowNcrId,
        action: AuditAction.NCR_STATUS_CHANGED,
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(auditLog).toBeTruthy();
    expect(parseAuditLogChanges(auditLog!.changes)).toMatchObject({
      status: { from: 'verification', to: 'closed' },
      withConcession: false,
      verificationNotesPresent: true,
      lessonsLearnedPresent: true,
    });
  });

  it('should close only once when concurrent close requests race', async () => {
    const raceNcrId = await createVerificationNcr('Concurrent close race');
    const findUniqueSpy = holdNextTwoNcrReads(raceNcrId);

    try {
      const [firstCloseRes, secondCloseRes] = await Promise.all([
        request(app)
          .post(`/api/ncrs/${raceNcrId}/close`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ verificationNotes: 'First close wins' }),
        request(app)
          .post(`/api/ncrs/${raceNcrId}/close`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ verificationNotes: 'Second close should be rejected' }),
      ]);

      await expectConcurrentNcrTerminalState([firstCloseRes, secondCloseRes], raceNcrId, {
        status: 'closed',
        closedById: userId,
      });

      const closeAudits = await findStatusTransitionAudits(
        projectId,
        userId,
        raceNcrId,
        'verification',
        'closed',
      );
      expect(closeAudits).toHaveLength(1);
    } finally {
      findUniqueSpy.mockRestore();
    }
  });

  it('should reopen closed NCR and write an audit log', async () => {
    const res = await request(app)
      .post(`/api/ncrs/${workflowNcrId}/reopen`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        reason: 'Additional rectification evidence required',
      });

    expect(res.status).toBe(200);
    expect(res.body.ncr.status).toBe('rectification');

    const auditLog = await prisma.auditLog.findFirst({
      where: {
        projectId,
        userId,
        entityType: 'ncr',
        entityId: workflowNcrId,
        action: AuditAction.NCR_STATUS_CHANGED,
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(auditLog).toBeTruthy();
    expect(parseAuditLogChanges(auditLog!.changes)).toMatchObject({
      status: { from: 'closed', to: 'rectification' },
      reasonPresent: true,
    });
  });

  it('should reopen only once when concurrent reopen requests race', async () => {
    const raceNcrId = await createVerificationNcr('Concurrent reopen race');
    const closeRes = await request(app)
      .post(`/api/ncrs/${raceNcrId}/close`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ verificationNotes: 'Ready to close before reopen race' });
    expect(closeRes.status).toBe(200);

    const findUniqueSpy = holdNextTwoNcrReads(raceNcrId);

    try {
      const [firstReopenRes, secondReopenRes] = await Promise.all([
        request(app)
          .post(`/api/ncrs/${raceNcrId}/reopen`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ reason: 'First reopen wins' }),
        request(app)
          .post(`/api/ncrs/${raceNcrId}/reopen`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ reason: 'Second reopen should be rejected' }),
      ]);

      await expectConcurrentNcrTerminalState([firstReopenRes, secondReopenRes], raceNcrId, {
        status: 'rectification',
        closedById: null,
      });

      const reopenAudits = await findStatusTransitionAudits(
        projectId,
        userId,
        raceNcrId,
        'closed',
        'rectification',
      );
      expect(reopenAudits).toHaveLength(1);
    } finally {
      findUniqueSpy.mockRestore();
    }
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

    const primaryUser = await registerSharedTestUser(app, {
      emailPrefix: 'ncr-revision',
      fullName: 'NCR Revision User',
      companyId,
      roleInCompany: 'quality_manager',
    });
    authToken = primaryUser.token;
    userId = primaryUser.userId;

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

    const auditLog = await prisma.auditLog.findFirst({
      where: {
        projectId,
        userId,
        entityType: 'ncr',
        entityId: revisionNcrId,
        action: AuditAction.NCR_STATUS_CHANGED,
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(auditLog).toBeTruthy();
    expect(parseAuditLogChanges(auditLog!.changes)).toMatchObject({
      status: { from: 'investigating', to: 'open' },
      qmReviewAction: 'request_revision',
      commentsPresent: true,
      revisionRequested: true,
    });
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

    const primaryUser = await registerSharedTestUser(app, {
      emailPrefix: 'major-ncr',
      fullName: 'Major NCR User',
      companyId,
      roleInCompany: 'quality_manager',
    });
    authToken = primaryUser.token;
    userId = primaryUser.userId;

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

    await createNcrEvidence(projectId, userId, majorNcrId);

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

  async function createMajorNcrInVerification(description: string) {
    const ncrRes = await request(app)
      .post('/api/ncrs')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        projectId,
        description,
        category: 'Material',
        severity: 'major',
        responsibleUserId: userId,
      });
    expect(ncrRes.status).toBe(201);
    const createdNcrId = ncrRes.body.ncr.id as string;

    const respondRes = await request(app)
      .post(`/api/ncrs/${createdNcrId}/respond`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        rootCauseCategory: 'Material',
        rootCauseDescription: 'Defective material',
        proposedCorrectiveAction: 'Replace material',
      });
    expect(respondRes.status).toBe(200);

    const reviewRes = await request(app)
      .post(`/api/ncrs/${createdNcrId}/qm-review`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ action: 'accept' });
    expect(reviewRes.status).toBe(200);

    await createNcrEvidence(projectId, userId, createdNcrId);

    const rectifyRes = await request(app)
      .post(`/api/ncrs/${createdNcrId}/rectify`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ rectificationNotes: 'Material replaced' });
    expect(rectifyRes.status).toBe(200);
    expect(rectifyRes.body.ncr.status).toBe('verification');

    return createdNcrId;
  }

  it('should reject closing major NCR without QM approval', async () => {
    const res = await request(app)
      .post(`/api/ncrs/${majorNcrId}/close`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ verificationNotes: 'Done' });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('Quality Manager approval');
  });

  it('should reject project managers granting QM approval for major NCRs', async () => {
    const projectManager = await registerSharedTestUser(app, {
      emailPrefix: 'major-ncr-pm',
      fullName: 'Major NCR Project Manager',
      companyId,
      roleInCompany: 'project_manager',
    });
    await prisma.projectUser.create({
      data: {
        projectId,
        userId: projectManager.userId,
        role: 'project_manager',
        status: 'active',
      },
    });
    const ncrId = await createMajorNcrInVerification('Project manager cannot QM approve major NCR');

    try {
      const res = await request(app)
        .post(`/api/ncrs/${ncrId}/qm-approve`)
        .set('Authorization', `Bearer ${projectManager.token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('Quality Manager');

      const ncr = await prisma.nCR.findUniqueOrThrow({
        where: { id: ncrId },
        select: { qmApprovedAt: true, qmApprovedById: true },
      });
      expect(ncr.qmApprovedAt).toBeNull();
      expect(ncr.qmApprovedById).toBeNull();
    } finally {
      await prisma.projectUser.deleteMany({ where: { userId: projectManager.userId } });
      await cleanupTestUser(projectManager.userId);
    }
  });

  it('should allow company owners to review and approve major NCRs', async () => {
    const owner = await registerSharedTestUser(app, {
      emailPrefix: 'major-ncr-owner',
      fullName: 'Major NCR Owner',
      companyId,
      roleInCompany: 'owner',
    });

    try {
      const ncrRes = await request(app)
        .post('/api/ncrs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          description: 'Major defect requiring owner quality approval',
          category: 'Material',
          severity: 'major',
          responsibleUserId: userId,
        });
      expect(ncrRes.status).toBe(201);
      const createdOwnerNcrId = ncrRes.body.ncr.id as string;

      const respondRes = await request(app)
        .post(`/api/ncrs/${createdOwnerNcrId}/respond`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          rootCauseCategory: 'Material',
          rootCauseDescription: 'Owner approval workflow defect',
          proposedCorrectiveAction: 'Repair and verify',
        });
      expect(respondRes.status).toBe(200);
      expect(respondRes.body.ncr.status).toBe('investigating');

      const reviewRes = await request(app)
        .post(`/api/ncrs/${createdOwnerNcrId}/qm-review`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({
          action: 'accept',
          comments: 'Owner accepts the response',
        });
      expect(reviewRes.status).toBe(200);
      expect(reviewRes.body.ncr.status).toBe('rectification');

      await createNcrEvidence(projectId, userId, createdOwnerNcrId);

      const rectifyRes = await request(app)
        .post(`/api/ncrs/${createdOwnerNcrId}/rectify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ rectificationNotes: 'Repair complete' });
      expect(rectifyRes.status).toBe(200);
      expect(rectifyRes.body.ncr.status).toBe('verification');

      const approvalRes = await request(app)
        .post(`/api/ncrs/${createdOwnerNcrId}/qm-approve`)
        .set('Authorization', `Bearer ${owner.token}`)
        .set('User-Agent', 'ncr-owner-qm-approval-test');

      expect(approvalRes.status).toBe(200);
      expect(approvalRes.body.message).toContain('approval granted');

      const auditLog = await prisma.auditLog.findFirst({
        where: {
          projectId,
          userId: owner.userId,
          entityType: 'ncr',
          entityId: createdOwnerNcrId,
          action: AuditAction.NCR_QM_APPROVED,
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(auditLog).toBeTruthy();
      expect(auditLog!.userAgent).toBe('ncr-owner-qm-approval-test');
      expect(parseAuditLogChanges(auditLog!.changes)).toMatchObject({
        severity: 'major',
        qmApprovalRequired: true,
        qmApproved: true,
      });
    } finally {
      await prisma.auditLog.deleteMany({ where: { userId: owner.userId } }).catch(() => {});
      await cleanupTestUser(owner.userId);
    }
  });

  it('should grant QM approval', async () => {
    const res = await request(app)
      .post(`/api/ncrs/${majorNcrId}/qm-approve`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('User-Agent', 'ncr-qm-approval-audit-test');

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('approval granted');

    const auditLog = await prisma.auditLog.findFirst({
      where: {
        projectId,
        userId,
        entityType: 'ncr',
        entityId: majorNcrId,
        action: AuditAction.NCR_QM_APPROVED,
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(auditLog).toBeTruthy();
    expect(auditLog!.ipAddress).toBeTruthy();
    expect(auditLog!.userAgent).toBe('ncr-qm-approval-audit-test');
    expect(parseAuditLogChanges(auditLog!.changes)).toMatchObject({
      ncrNumber: res.body.ncr.ncrNumber,
      severity: 'major',
      qmApprovalRequired: true,
      qmApproved: true,
    });
  });

  it('should grant QM approval only once when concurrent approval requests race', async () => {
    const raceNcrId = await createMajorNcrInVerification('Concurrent QM approval race');
    const findUniqueSpy = holdNextTwoNcrReads(raceNcrId);

    try {
      const [firstApprovalRes, secondApprovalRes] = await Promise.all([
        request(app)
          .post(`/api/ncrs/${raceNcrId}/qm-approve`)
          .set('Authorization', `Bearer ${authToken}`),
        request(app)
          .post(`/api/ncrs/${raceNcrId}/qm-approve`)
          .set('Authorization', `Bearer ${authToken}`),
      ]);

      expect([firstApprovalRes.status, secondApprovalRes.status].sort()).toEqual([200, 400]);

      const ncr = await prisma.nCR.findUniqueOrThrow({
        where: { id: raceNcrId },
        select: { qmApprovedAt: true, qmApprovedById: true },
      });
      expect(ncr.qmApprovedAt).toBeInstanceOf(Date);
      expect(ncr.qmApprovedById).toBe(userId);

      const approvalAuditLogs = await prisma.auditLog.findMany({
        where: {
          projectId,
          userId,
          entityType: 'ncr',
          entityId: raceNcrId,
          action: AuditAction.NCR_QM_APPROVED,
        },
      });
      expect(approvalAuditLogs).toHaveLength(1);
    } finally {
      findUniqueSpy.mockRestore();
    }
  });

  it('should reject closing a major NCR by the same user who granted QM approval', async () => {
    const ncrId = await createMajorNcrInVerification('Same approver cannot close major NCR');
    const approvalRes = await request(app)
      .post(`/api/ncrs/${ncrId}/qm-approve`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(approvalRes.status).toBe(200);

    const res = await request(app)
      .post(`/api/ncrs/${ncrId}/close`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ verificationNotes: 'Verified by approving user' });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('different user');

    const ncr = await prisma.nCR.findUniqueOrThrow({
      where: { id: ncrId },
      select: { status: true, closedAt: true, closedById: true },
    });
    expect(ncr.status).toBe('verification');
    expect(ncr.closedAt).toBeNull();
    expect(ncr.closedById).toBeNull();
  });

  it('should close major NCR after QM approval', async () => {
    const ncrId = await createMajorNcrInVerification('Different quality user closes major NCR');
    const approvalRes = await request(app)
      .post(`/api/ncrs/${ncrId}/qm-approve`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(approvalRes.status).toBe(200);

    const closer = await registerSharedTestUser(app, {
      emailPrefix: 'major-ncr-closer',
      fullName: 'Major NCR Closer',
      companyId,
      roleInCompany: 'quality_manager',
    });
    await prisma.projectUser.create({
      data: {
        projectId,
        userId: closer.userId,
        role: 'quality_manager',
        status: 'active',
      },
    });

    try {
      const res = await request(app)
        .post(`/api/ncrs/${ncrId}/close`)
        .set('Authorization', `Bearer ${closer.token}`)
        .send({ verificationNotes: 'Verified' });

      expect(res.status).toBe(200);
      expect(res.body.ncr.status).toBe('closed');

      const ncr = await prisma.nCR.findUniqueOrThrow({
        where: { id: ncrId },
        select: { closedById: true },
      });
      expect(ncr.closedById).toBe(closer.userId);
    } finally {
      await prisma.projectUser.deleteMany({ where: { userId: closer.userId } });
      await cleanupTestUser(closer.userId);
    }
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
  let lotId: string;
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

    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `NCR-ACCESS-LOT-${Date.now()}`,
        status: 'in_progress',
        lotType: 'chainage',
        activityType: 'Earthworks',
      },
    });
    lotId = lot.id;

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
    await prisma.lot.deleteMany({ where: { projectId } });
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

  it('should reject active viewers from creating NCRs or changing linked lot status', async () => {
    const viewer = await registerTestUser('ncr-access-viewer-create', 'NCR Access Viewer Create');
    await prisma.user.update({
      where: { id: viewer.userId },
      data: { companyId, roleInCompany: 'viewer' },
    });
    await prisma.projectUser.create({
      data: { projectId, userId: viewer.userId, role: 'viewer', status: 'active' },
    });

    try {
      const res = await request(app)
        .post('/api/ncrs')
        .set('Authorization', `Bearer ${viewer.token}`)
        .send({
          projectId,
          description: 'Viewer should not create NCRs',
          category: 'Workmanship',
          severity: 'minor',
          lotIds: [lotId],
        });

      expect(res.status).toBe(403);
      expect(await prisma.nCR.count({ where: { projectId, raisedById: viewer.userId } })).toBe(0);
      const lot = await prisma.lot.findUniqueOrThrow({ where: { id: lotId } });
      expect(lot.status).toBe('in_progress');
    } finally {
      await prisma.projectUser.deleteMany({ where: { projectId, userId: viewer.userId } });
      await cleanupTestUser(viewer.userId);
    }
  });

  it('should reject active viewers from NCR workflow state transitions', async () => {
    const viewer = await registerTestUser(
      'ncr-access-viewer-workflow',
      'NCR Access Viewer Workflow',
    );
    await prisma.user.update({
      where: { id: viewer.userId },
      data: { companyId, roleInCompany: 'viewer' },
    });
    await prisma.projectUser.create({
      data: { projectId, userId: viewer.userId, role: 'viewer', status: 'active' },
    });

    try {
      await prisma.nCR.update({
        where: { id: ncrId },
        data: {
          status: 'open',
          rootCauseDescription: null,
          proposedCorrectiveAction: null,
          responseSubmittedAt: null,
        },
      });
      const respondRes = await request(app)
        .post(`/api/ncrs/${ncrId}/respond`)
        .set('Authorization', `Bearer ${viewer.token}`)
        .send({
          rootCauseCategory: 'Method',
          rootCauseDescription: 'Viewer should not respond',
          proposedCorrectiveAction: 'Do not mutate',
        });
      expect(respondRes.status).toBe(403);

      await prisma.nCR.update({
        where: { id: ncrId },
        data: { status: 'verification', verifiedAt: null, closedAt: null, closedById: null },
      });
      const closeRes = await request(app)
        .post(`/api/ncrs/${ncrId}/close`)
        .set('Authorization', `Bearer ${viewer.token}`)
        .send({
          verificationNotes: 'Viewer should not close',
          lessonsLearned: 'Do not mutate',
        });
      expect(closeRes.status).toBe(403);

      const ncr = await prisma.nCR.findUniqueOrThrow({
        where: { id: ncrId },
        select: {
          status: true,
          rootCauseDescription: true,
          proposedCorrectiveAction: true,
          closedAt: true,
          closedById: true,
        },
      });
      expect(ncr.status).toBe('verification');
      expect(ncr.rootCauseDescription).toBeNull();
      expect(ncr.proposedCorrectiveAction).toBeNull();
      expect(ncr.closedAt).toBeNull();
      expect(ncr.closedById).toBeNull();
    } finally {
      await prisma.nCR.update({
        where: { id: ncrId },
        data: {
          status: 'open',
          rootCauseDescription: null,
          proposedCorrectiveAction: null,
          responseSubmittedAt: null,
          verifiedAt: null,
          closedAt: null,
          closedById: null,
        },
      });
      await prisma.projectUser.deleteMany({ where: { projectId, userId: viewer.userId } });
      await cleanupTestUser(viewer.userId);
    }
  });

  it('should reject active viewers from adding or deleting NCR evidence', async () => {
    const viewer = await registerTestUser(
      'ncr-access-viewer-evidence',
      'NCR Access Viewer Evidence',
    );
    await prisma.user.update({
      where: { id: viewer.userId },
      data: { companyId, roleInCompany: 'viewer' },
    });
    await prisma.projectUser.create({
      data: { projectId, userId: viewer.userId, role: 'viewer', status: 'active' },
    });
    const evidence = await prisma.nCREvidence.create({
      data: {
        ncrId,
        documentId: sameProjectDocumentId,
        evidenceType: 'photo',
      },
    });

    try {
      const addRes = await request(app)
        .post(`/api/ncrs/${ncrId}/evidence`)
        .set('Authorization', `Bearer ${viewer.token}`)
        .send({
          evidenceType: 'photo',
          filename: `viewer-evidence-${Date.now()}.jpg`,
          fileUrl: `/uploads/documents/viewer-evidence-${Date.now()}.jpg`,
          mimeType: 'image/jpeg',
        });
      expect(addRes.status).toBe(403);

      const deleteRes = await request(app)
        .delete(`/api/ncrs/${ncrId}/evidence/${evidence.id}`)
        .set('Authorization', `Bearer ${viewer.token}`);
      expect(deleteRes.status).toBe(403);

      await expect(prisma.nCREvidence.findUnique({ where: { id: evidence.id } })).resolves.not.toBe(
        null,
      );
    } finally {
      await prisma.nCREvidence.deleteMany({ where: { id: evidence.id } });
      await prisma.projectUser.deleteMany({ where: { projectId, userId: viewer.userId } });
      await cleanupTestUser(viewer.userId);
    }
  });

  it('should let responsible subcontractors list and add NCR evidence', async () => {
    const suffix = Date.now();
    const subcontractorCompany = await prisma.subcontractorCompany.create({
      data: {
        projectId,
        companyName: `NCR Evidence Responsible Sub ${suffix}`,
        primaryContactName: 'NCR Evidence Responsible Contact',
        primaryContactEmail: `ncr-evidence-responsible-${suffix}@example.com`,
        status: 'approved',
        portalAccess: { ncrs: true },
      },
    });
    const subcontractor = await registerTestUser(
      'ncr-evidence-responsible-sub',
      'NCR Evidence Responsible Subcontractor',
    );
    const responsibleNcr = await prisma.nCR.create({
      data: {
        projectId,
        ncrNumber: `NCR-EVID-RESP-${suffix}`,
        description: 'Responsible subcontractor can attach evidence',
        category: 'Workmanship',
        severity: 'minor',
        raisedById: userId,
        responsibleSubcontractorId: subcontractorCompany.id,
      },
    });
    const existingDocument = await prisma.document.create({
      data: {
        projectId,
        documentType: 'ncr_evidence',
        category: 'ncr_evidence',
        filename: `responsible-sub-existing-evidence-${suffix}.jpg`,
        fileUrl: `/uploads/documents/responsible-sub-existing-evidence-${suffix}.jpg`,
        uploadedById: userId,
      },
    });
    const existingEvidence = await prisma.nCREvidence.create({
      data: {
        ncrId: responsibleNcr.id,
        documentId: existingDocument.id,
        evidenceType: 'photo',
      },
    });
    const newFilename = `responsible-sub-added-evidence-${suffix}.jpg`;

    try {
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

      const listRes = await request(app)
        .get(`/api/ncrs/${responsibleNcr.id}/evidence`)
        .set('Authorization', `Bearer ${subcontractor.token}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.evidence.map((evidence: { id: string }) => evidence.id)).toContain(
        existingEvidence.id,
      );

      const addRes = await request(app)
        .post(`/api/ncrs/${responsibleNcr.id}/evidence`)
        .set('Authorization', `Bearer ${subcontractor.token}`)
        .send({
          evidenceType: 'photo',
          filename: newFilename,
          fileUrl: `/uploads/documents/${newFilename}`,
          mimeType: 'image/jpeg',
        });
      expect(addRes.status).toBe(201);
      expect(addRes.body.evidence.document.filename).toBe(newFilename);

      const storedDocument = await prisma.document.findFirstOrThrow({
        where: { projectId, filename: newFilename },
        select: { uploadedById: true },
      });
      expect(storedDocument.uploadedById).toBe(subcontractor.userId);
    } finally {
      await prisma.nCREvidence.deleteMany({ where: { ncrId: responsibleNcr.id } });
      await prisma.document.deleteMany({
        where: {
          projectId,
          filename: {
            in: [existingDocument.filename, newFilename],
          },
        },
      });
      await prisma.nCR.delete({ where: { id: responsibleNcr.id } }).catch(() => {});
      await prisma.subcontractorUser.deleteMany({ where: { userId: subcontractor.userId } });
      await prisma.subcontractorCompany
        .delete({ where: { id: subcontractorCompany.id } })
        .catch(() => {});
      await cleanupTestUser(subcontractor.userId);
    }
  });

  it('should reject unrelated subcontractors from NCR evidence routes', async () => {
    const suffix = Date.now();
    const responsibleCompany = await prisma.subcontractorCompany.create({
      data: {
        projectId,
        companyName: `NCR Evidence Assigned Sub ${suffix}`,
        primaryContactName: 'NCR Evidence Assigned Contact',
        primaryContactEmail: `ncr-evidence-assigned-${suffix}@example.com`,
        status: 'approved',
        portalAccess: { ncrs: true },
      },
    });
    const unrelatedCompany = await prisma.subcontractorCompany.create({
      data: {
        projectId,
        companyName: `NCR Evidence Unrelated Sub ${suffix}`,
        primaryContactName: 'NCR Evidence Unrelated Contact',
        primaryContactEmail: `ncr-evidence-unrelated-${suffix}@example.com`,
        status: 'approved',
        portalAccess: { ncrs: true },
      },
    });
    const unrelatedSubcontractor = await registerTestUser(
      'ncr-evidence-unrelated-sub',
      'NCR Evidence Unrelated Subcontractor',
    );
    const responsibleNcr = await prisma.nCR.create({
      data: {
        projectId,
        ncrNumber: `NCR-EVID-DENY-${suffix}`,
        description: 'Unrelated subcontractor cannot attach evidence',
        category: 'Workmanship',
        severity: 'minor',
        raisedById: userId,
        responsibleSubcontractorId: responsibleCompany.id,
      },
    });
    const deniedFilename = `unrelated-sub-denied-evidence-${suffix}.jpg`;

    try {
      await prisma.user.update({
        where: { id: unrelatedSubcontractor.userId },
        data: { companyId, roleInCompany: 'subcontractor' },
      });
      await prisma.subcontractorUser.create({
        data: {
          userId: unrelatedSubcontractor.userId,
          subcontractorCompanyId: unrelatedCompany.id,
          role: 'user',
        },
      });

      const listRes = await request(app)
        .get(`/api/ncrs/${responsibleNcr.id}/evidence`)
        .set('Authorization', `Bearer ${unrelatedSubcontractor.token}`);
      expect(listRes.status).toBe(403);

      const addRes = await request(app)
        .post(`/api/ncrs/${responsibleNcr.id}/evidence`)
        .set('Authorization', `Bearer ${unrelatedSubcontractor.token}`)
        .send({
          evidenceType: 'photo',
          filename: deniedFilename,
          fileUrl: `/uploads/documents/${deniedFilename}`,
          mimeType: 'image/jpeg',
        });
      expect(addRes.status).toBe(403);

      const deniedDocument = await prisma.document.findFirst({
        where: { projectId, filename: deniedFilename },
        select: { id: true },
      });
      expect(deniedDocument).toBeNull();
    } finally {
      await prisma.nCR.delete({ where: { id: responsibleNcr.id } }).catch(() => {});
      await prisma.subcontractorUser.deleteMany({
        where: { userId: unrelatedSubcontractor.userId },
      });
      await prisma.subcontractorCompany.deleteMany({
        where: { id: { in: [responsibleCompany.id, unrelatedCompany.id] } },
      });
      await cleanupTestUser(unrelatedSubcontractor.userId);
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

  it('should audit NCR reassignment to a different responsible user', async () => {
    const assignee = await registerSharedTestUser(app, {
      emailPrefix: 'ncr-reassign-audit',
      fullName: 'NCR Reassignment Audit User',
      companyId,
      roleInCompany: 'quality_manager',
    });

    await prisma.projectUser.create({
      data: {
        projectId,
        userId: assignee.userId,
        role: 'quality_manager',
        status: 'active',
      },
    });

    await prisma.nCR.update({
      where: { id: ncrId },
      data: { responsibleUserId: null, responsibleSubcontractorId: null },
    });

    await prisma.auditLog.deleteMany({
      where: {
        projectId,
        userId,
        entityType: 'ncr',
        entityId: ncrId,
        action: AuditAction.NCR_UPDATED,
      },
    });

    try {
      const res = await request(app)
        .patch(`/api/ncrs/${ncrId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('User-Agent', 'ncr-reassignment-audit-test')
        .send({
          responsibleUserId: assignee.userId,
          comments: 'Redirecting to the responsible quality user',
        });

      expect(res.status).toBe(200);
      expect(res.body.ncr.responsibleUserId).toBe(assignee.userId);

      const auditLog = await prisma.auditLog.findFirst({
        where: {
          projectId,
          userId,
          entityType: 'ncr',
          entityId: ncrId,
          action: AuditAction.NCR_UPDATED,
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(auditLog).toBeTruthy();
      expect(auditLog!.userAgent).toBe('ncr-reassignment-audit-test');
      expect(parseAuditLogChanges(auditLog!.changes)).toMatchObject({
        responsibleUserId: { from: null, to: assignee.userId },
        commentsPresent: true,
      });
    } finally {
      await prisma.nCR
        .update({
          where: { id: ncrId },
          data: { responsibleUserId: null, responsibleSubcontractorId: null },
        })
        .catch(() => {});
      await prisma.projectUser.deleteMany({ where: { projectId, userId: assignee.userId } });
      await cleanupTestUser(assignee.userId);
    }
  });

  describe('Feature N1 - subcontractor responsible party', () => {
    async function createActiveSubcontractor(prefix: string) {
      return prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `${prefix} ${Date.now()}-${Math.random().toString(36).slice(2)}`,
          primaryContactName: 'N1 Sub Contact',
          primaryContactEmail: `${prefix}-${Date.now()}@example.com`,
          status: 'approved',
          portalAccess: { ncrs: true },
        },
      });
    }

    it('creates an NCR assigned to a subcontractor and the subcontractor can read it', async () => {
      const subcontractor = await createActiveSubcontractor('N1 Create Sub');
      const subUser = await registerTestUser('n1-create-sub-user', 'N1 Create Sub User');
      await prisma.user.update({
        where: { id: subUser.userId },
        data: { companyId, roleInCompany: 'subcontractor' },
      });
      await prisma.subcontractorUser.create({
        data: {
          userId: subUser.userId,
          subcontractorCompanyId: subcontractor.id,
          role: 'user',
        },
      });

      let createdNcrId: string | undefined;
      try {
        const createRes = await request(app)
          .post('/api/ncrs')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            projectId,
            description: 'NCR assigned to a subcontractor on create',
            category: 'Workmanship',
            severity: 'minor',
            responsibleSubcontractorId: subcontractor.id,
          });

        expect(createRes.status).toBe(201);
        createdNcrId = createRes.body.ncr.id;
        expect(createRes.body.ncr.responsibleSubcontractorId).toBe(subcontractor.id);
        expect(createRes.body.ncr.responsibleSubcontractor?.companyName).toBe(
          subcontractor.companyName,
        );

        // Acceptance #1: the assigned subcontractor sees it in their portal list.
        const listRes = await request(app)
          .get(`/api/ncrs?projectId=${projectId}`)
          .set('Authorization', `Bearer ${subUser.token}`);

        expect(listRes.status).toBe(200);
        const listedIds = listRes.body.ncrs.map((entry: { id: string }) => entry.id);
        expect(listedIds).toContain(createdNcrId);

        // Single-NCR read access is also granted.
        const detailRes = await request(app)
          .get(`/api/ncrs/${createdNcrId}`)
          .set('Authorization', `Bearer ${subUser.token}`);
        expect(detailRes.status).toBe(200);

        // The company's portal users are notified of the assignment.
        const notification = await prisma.notification.findFirst({
          where: { userId: subUser.userId, projectId, type: 'ncr_assigned' },
        });
        expect(notification).not.toBeNull();
      } finally {
        await prisma.notification.deleteMany({ where: { userId: subUser.userId } });
        if (createdNcrId) {
          await prisma.nCR.delete({ where: { id: createdNcrId } }).catch(() => {});
        }
        await prisma.subcontractorUser.deleteMany({
          where: { subcontractorCompanyId: subcontractor.id },
        });
        await prisma.subcontractorCompany
          .delete({ where: { id: subcontractor.id } })
          .catch(() => {});
        await cleanupTestUser(subUser.userId);
      }
    });

    it('auto-enables the NCRs portal module (and notifies) when an NCR is assigned to a subcontractor whose module was off', async () => {
      // Start with the NCRs portal module OFF (its default). Assigning an NCR to
      // the company is the head contractor's intent to share it, so it should
      // auto-enable the module — which in turn unblocks the notification fan-out
      // (which is gated on the same portalAccess.ncrs flag).
      const subcontractor = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `N1 No-Portal Sub ${Date.now()}-${Math.random().toString(36).slice(2)}`,
          primaryContactName: 'N1 Sub Contact',
          primaryContactEmail: `n1-no-portal-sub-${Date.now()}@example.com`,
          status: 'approved',
          portalAccess: { ncrs: false },
        },
      });
      const subUser = await registerTestUser('n1-no-portal-sub-user', 'N1 No-Portal Sub User');
      await prisma.user.update({
        where: { id: subUser.userId },
        data: { companyId, roleInCompany: 'subcontractor' },
      });
      await prisma.subcontractorUser.create({
        data: {
          userId: subUser.userId,
          subcontractorCompanyId: subcontractor.id,
          role: 'user',
        },
      });

      let createdNcrId: string | undefined;
      try {
        const createRes = await request(app)
          .post('/api/ncrs')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            projectId,
            description: 'NCR assigned to a subcontractor with the NCRs portal module off',
            category: 'Workmanship',
            severity: 'minor',
            responsibleSubcontractorId: subcontractor.id,
          });

        expect(createRes.status).toBe(201);
        createdNcrId = createRes.body.ncr.id;
        expect(createRes.body.ncr.responsibleSubcontractorId).toBe(subcontractor.id);

        // The assignment auto-enables the company's NCRs portal module so the
        // subcontractor can actually see the NCR in their portal.
        const updated = await prisma.subcontractorCompany.findUnique({
          where: { id: subcontractor.id },
          select: { portalAccess: true },
        });
        expect((updated?.portalAccess as { ncrs?: boolean } | null)?.ncrs).toBe(true);

        // With the module now enabled, the assignment notification fan-out is no
        // longer suppressed, so the company's portal users are notified.
        const notificationCount = await prisma.notification.count({
          where: {
            userId: subUser.userId,
            projectId,
            type: { in: ['ncr_assigned', 'ncr_redirect'] },
          },
        });
        expect(notificationCount).toBeGreaterThan(0);
      } finally {
        await prisma.notification.deleteMany({ where: { userId: subUser.userId } });
        if (createdNcrId) {
          await prisma.nCR.delete({ where: { id: createdNcrId } }).catch(() => {});
        }
        await prisma.subcontractorUser.deleteMany({
          where: { subcontractorCompanyId: subcontractor.id },
        });
        await prisma.subcontractorCompany
          .delete({ where: { id: subcontractor.id } })
          .catch(() => {});
        await cleanupTestUser(subUser.userId);
      }
    });

    it('rejects creating an NCR assigned to both a user and a subcontractor', async () => {
      const subcontractor = await createActiveSubcontractor('N1 Exclusive Sub');
      try {
        const res = await request(app)
          .post('/api/ncrs')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            projectId,
            description: 'NCR with both responsible parties',
            category: 'Workmanship',
            severity: 'minor',
            responsibleUserId: userId,
            responsibleSubcontractorId: subcontractor.id,
          });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toBe('Validation failed');
        expect(JSON.stringify(res.body.error.details)).toContain('user or a subcontractor');
        expect(
          await prisma.nCR.count({
            where: { projectId, responsibleSubcontractorId: subcontractor.id },
          }),
        ).toBe(0);
      } finally {
        await prisma.subcontractorCompany
          .delete({ where: { id: subcontractor.id } })
          .catch(() => {});
      }
    });

    it('rejects creating an NCR assigned to a subcontractor from another project', async () => {
      const foreignSubcontractor = await prisma.subcontractorCompany.create({
        data: {
          projectId: otherProjectId,
          companyName: `N1 Foreign Sub ${Date.now()}`,
          primaryContactName: 'Foreign Contact',
          primaryContactEmail: `n1-foreign-sub-${Date.now()}@example.com`,
          status: 'approved',
          portalAccess: { ncrs: true },
        },
      });
      try {
        const res = await request(app)
          .post('/api/ncrs')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            projectId,
            description: 'NCR with cross-project subcontractor',
            category: 'Workmanship',
            severity: 'minor',
            responsibleSubcontractorId: foreignSubcontractor.id,
          });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('Responsible subcontractor');
        expect(
          await prisma.nCR.count({
            where: { projectId, responsibleSubcontractorId: foreignSubcontractor.id },
          }),
        ).toBe(0);
      } finally {
        await prisma.subcontractorCompany
          .delete({ where: { id: foreignSubcontractor.id } })
          .catch(() => {});
      }
    });

    it('rejects creating an NCR assigned to a removed subcontractor', async () => {
      const removedSubcontractor = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `N1 Removed Sub ${Date.now()}`,
          primaryContactName: 'Removed Contact',
          primaryContactEmail: `n1-removed-sub-${Date.now()}@example.com`,
          status: 'removed',
          portalAccess: { ncrs: true },
        },
      });
      try {
        const res = await request(app)
          .post('/api/ncrs')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            projectId,
            description: 'NCR with removed subcontractor',
            category: 'Workmanship',
            severity: 'minor',
            responsibleSubcontractorId: removedSubcontractor.id,
          });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('Responsible subcontractor');
      } finally {
        await prisma.subcontractorCompany
          .delete({ where: { id: removedSubcontractor.id } })
          .catch(() => {});
      }
    });

    it('reassigns an NCR from a user to a subcontractor and back, then clears it', async () => {
      const subcontractor = await createActiveSubcontractor('N1 Reassign Sub');
      const ncr = await prisma.nCR.create({
        data: {
          projectId,
          ncrNumber: `NCR-N1-REASSIGN-${Date.now()}`,
          description: 'NCR for reassignment lifecycle',
          category: 'Workmanship',
          severity: 'minor',
          status: 'open',
          raisedById: userId,
          responsibleUserId: userId,
        },
      });

      try {
        // user -> subcontractor: clears the user, sets the subcontractor.
        const toSubRes = await request(app)
          .patch(`/api/ncrs/${ncr.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ responsibleSubcontractorId: subcontractor.id });
        expect(toSubRes.status).toBe(200);

        const afterToSub = await prisma.nCR.findUniqueOrThrow({
          where: { id: ncr.id },
          select: { responsibleUserId: true, responsibleSubcontractorId: true },
        });
        expect(afterToSub.responsibleSubcontractorId).toBe(subcontractor.id);
        expect(afterToSub.responsibleUserId).toBeNull();

        // subcontractor -> user: clears the subcontractor, sets the user.
        const toUserRes = await request(app)
          .patch(`/api/ncrs/${ncr.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ responsibleUserId: userId });
        expect(toUserRes.status).toBe(200);

        const afterToUser = await prisma.nCR.findUniqueOrThrow({
          where: { id: ncr.id },
          select: { responsibleUserId: true, responsibleSubcontractorId: true },
        });
        expect(afterToUser.responsibleUserId).toBe(userId);
        expect(afterToUser.responsibleSubcontractorId).toBeNull();

        // clear to unassigned via explicit null.
        const clearRes = await request(app)
          .patch(`/api/ncrs/${ncr.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ responsibleUserId: null });
        expect(clearRes.status).toBe(200);

        const afterClear = await prisma.nCR.findUniqueOrThrow({
          where: { id: ncr.id },
          select: { responsibleUserId: true, responsibleSubcontractorId: true },
        });
        expect(afterClear.responsibleUserId).toBeNull();
        expect(afterClear.responsibleSubcontractorId).toBeNull();
      } finally {
        await prisma.notification.deleteMany({ where: { projectId } });
        await prisma.nCR.delete({ where: { id: ncr.id } }).catch(() => {});
        await prisma.subcontractorCompany
          .delete({ where: { id: subcontractor.id } })
          .catch(() => {});
      }
    });

    it('rejects reassigning an NCR to both a user and a subcontractor at once', async () => {
      const subcontractor = await createActiveSubcontractor('N1 Patch Exclusive Sub');
      const ncr = await prisma.nCR.create({
        data: {
          projectId,
          ncrNumber: `NCR-N1-PATCH-EXC-${Date.now()}`,
          description: 'NCR for patch exclusivity',
          category: 'Workmanship',
          severity: 'minor',
          status: 'open',
          raisedById: userId,
        },
      });

      try {
        const res = await request(app)
          .patch(`/api/ncrs/${ncr.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ responsibleUserId: userId, responsibleSubcontractorId: subcontractor.id });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toBe('Validation failed');
        expect(JSON.stringify(res.body.error.details)).toContain('user or a subcontractor');

        const unchanged = await prisma.nCR.findUniqueOrThrow({
          where: { id: ncr.id },
          select: { responsibleUserId: true, responsibleSubcontractorId: true },
        });
        expect(unchanged.responsibleUserId).toBeNull();
        expect(unchanged.responsibleSubcontractorId).toBeNull();
      } finally {
        await prisma.nCR.delete({ where: { id: ncr.id } }).catch(() => {});
        await prisma.subcontractorCompany
          .delete({ where: { id: subcontractor.id } })
          .catch(() => {});
      }
    });

    it('counts subcontractor-assigned NCRs in analytics repeat-offender data', async () => {
      const subcontractor = await createActiveSubcontractor('N1 Analytics Sub');
      // Repeat-offender analytics surfaces a subcontractor only at 2+ NCRs.
      const [ncrOne, ncrTwo] = await Promise.all([
        prisma.nCR.create({
          data: {
            projectId,
            ncrNumber: `NCR-N1-ANALYTICS-A-${Date.now()}`,
            description: 'First NCR counted in subcontractor analytics',
            category: 'Workmanship',
            severity: 'minor',
            status: 'open',
            raisedById: userId,
            responsibleSubcontractorId: subcontractor.id,
          },
        }),
        prisma.nCR.create({
          data: {
            projectId,
            ncrNumber: `NCR-N1-ANALYTICS-B-${Date.now()}`,
            description: 'Second NCR counted in subcontractor analytics',
            category: 'Materials',
            severity: 'minor',
            status: 'open',
            raisedById: userId,
            responsibleSubcontractorId: subcontractor.id,
          },
        }),
      ]);

      try {
        const res = await request(app)
          .get(`/api/ncrs/analytics/${projectId}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        const repeatOffenders = res.body.repeatOffenders.data as Array<{
          subcontractorId: string;
          ncrCount: number;
        }>;
        const offender = repeatOffenders.find((o) => o.subcontractorId === subcontractor.id);
        expect(offender).toBeDefined();
        expect(offender?.ncrCount).toBe(2);
      } finally {
        await prisma.nCR.deleteMany({ where: { id: { in: [ncrOne.id, ncrTwo.id] } } });
        await prisma.subcontractorCompany
          .delete({ where: { id: subcontractor.id } })
          .catch(() => {});
      }
    });
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

  it('should treat linking the same NCR evidence document as idempotent', async () => {
    const document = await prisma.document.create({
      data: {
        projectId,
        documentType: 'ncr_evidence',
        category: 'ncr_evidence',
        filename: `duplicate-link-evidence-${Date.now()}.jpg`,
        fileUrl: `/uploads/documents/duplicate-link-evidence-${Date.now()}.jpg`,
        uploadedById: userId,
      },
    });

    const firstRes = await request(app)
      .post(`/api/ncrs/${ncrId}/evidence`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        documentId: document.id,
        evidenceType: 'photo',
      });
    expect(firstRes.status).toBe(201);

    const duplicateRes = await request(app)
      .post(`/api/ncrs/${ncrId}/evidence`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        documentId: document.id,
        evidenceType: 'photo',
      });
    expect(duplicateRes.status).toBe(200);
    expect(duplicateRes.body.message).toBe('Evidence already linked to NCR');
    expect(duplicateRes.body.evidence.id).toBe(firstRes.body.evidence.id);

    const linkedEvidence = await prisma.nCREvidence.findMany({
      where: { ncrId, documentId: document.id },
    });
    expect(linkedEvidence).toHaveLength(1);
  });

  it('should normalize public Supabase document URLs before creating NCR evidence documents', async () => {
    const previousSupabaseUrl = process.env.SUPABASE_URL;
    process.env.SUPABASE_URL = 'https://fixture-project.supabase.co';

    const filename = `supabase-public-ncr-evidence-${Date.now()}.jpg`;
    const fileUrl = `https://fixture-project.supabase.co/storage/v1/object/public/documents/${projectId}/${filename}`;
    const expectedFileUrl = `supabase://documents/${projectId}/${filename}`;
    let createdDocumentId: string | undefined;

    try {
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
      expect(res.body.evidence.document.fileUrl).toBe(expectedFileUrl);
      createdDocumentId = res.body.evidence.documentId;
    } finally {
      if (createdDocumentId) {
        await prisma.nCREvidence.deleteMany({ where: { ncrId, documentId: createdDocumentId } });
        await prisma.document.deleteMany({ where: { id: createdDocumentId } });
      }
      if (previousSupabaseUrl === undefined) {
        delete process.env.SUPABASE_URL;
      } else {
        process.env.SUPABASE_URL = previousSupabaseUrl;
      }
    }
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

  it('should write audit logs when adding and removing NCR evidence', async () => {
    await prisma.auditLog.deleteMany({
      where: {
        projectId,
        action: {
          in: [AuditAction.NCR_EVIDENCE_ADDED, AuditAction.NCR_EVIDENCE_REMOVED],
        },
      },
    });

    const filename = `audited-ncr-evidence-${Date.now()}.jpg`;
    const fileUrl = `/uploads/documents/${filename}`;
    const addRes = await request(app)
      .post(`/api/ncrs/${ncrId}/evidence`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        evidenceType: 'photo',
        filename,
        fileUrl,
        mimeType: 'image/jpeg',
        caption: 'Caption should stay out of the audit log',
      });

    expect(addRes.status).toBe(201);

    const evidenceId = addRes.body.evidence.id as string;
    const documentId = addRes.body.evidence.document.id as string;

    const addedAuditLog = await prisma.auditLog.findFirst({
      where: {
        projectId,
        entityType: 'ncr_evidence',
        entityId: evidenceId,
        action: AuditAction.NCR_EVIDENCE_ADDED,
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(addedAuditLog).not.toBeNull();
    if (!addedAuditLog) {
      throw new Error('Expected NCR evidence added audit log');
    }
    expect(addedAuditLog.userId).toBe(userId);
    const addedChanges = parseAuditLogChanges(addedAuditLog.changes) as Record<string, unknown>;
    expect(addedChanges).toEqual({
      ncrId,
      documentId,
      evidenceType: 'photo',
    });
    expect(JSON.stringify(addedChanges)).not.toContain(filename);
    expect(JSON.stringify(addedChanges)).not.toContain(fileUrl);
    expect(JSON.stringify(addedChanges)).not.toContain('Caption should stay out');

    const deleteRes = await request(app)
      .delete(`/api/ncrs/${ncrId}/evidence/${evidenceId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(deleteRes.status).toBe(200);

    const removedAuditLog = await prisma.auditLog.findFirst({
      where: {
        projectId,
        entityType: 'ncr_evidence',
        entityId: evidenceId,
        action: AuditAction.NCR_EVIDENCE_REMOVED,
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(removedAuditLog).not.toBeNull();
    if (!removedAuditLog) {
      throw new Error('Expected NCR evidence removed audit log');
    }
    expect(removedAuditLog.userId).toBe(userId);
    const removedChanges = parseAuditLogChanges(removedAuditLog.changes) as Record<string, unknown>;
    expect(removedChanges).toEqual({
      ncrId,
      documentId,
      evidenceType: 'photo',
    });
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

  it('should reject evidence Supabase document references from a different project', async () => {
    const filename = `cross-project-supabase-reference-${Date.now()}.jpg`;

    const res = await request(app)
      .post(`/api/ncrs/${ncrId}/evidence`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        evidenceType: 'photo',
        filename,
        fileUrl: `supabase://documents/${otherProjectId}/${filename}`,
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

  it('should accept evidence file URLs from Supabase document storage references', async () => {
    const filename = `supabase-ref-evidence-${Date.now()}.jpg`;
    const fileUrl = `supabase://documents/${projectId}/${filename}`;
    let evidenceId: string | undefined;
    let documentId: string | undefined;

    try {
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
      evidenceId = res.body.evidence.id;
      documentId = res.body.evidence.documentId;
    } finally {
      if (evidenceId) {
        await prisma.nCREvidence.deleteMany({ where: { id: evidenceId } });
      }
      if (documentId) {
        await prisma.document.deleteMany({ where: { id: documentId } });
      }
    }
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
