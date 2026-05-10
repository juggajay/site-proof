import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { authRouter } from './auth.js';
import { prisma } from '../lib/prisma.js';
import { errorHandler } from '../middleware/errorHandler.js';

// Import dockets router
import { docketsRouter } from './dockets.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/dockets', docketsRouter);
app.use(errorHandler);

describe('Dockets API', () => {
  let authToken: string;
  let subcontractorToken: string;
  let userId: string;
  let subcontractorUserId: string;
  let companyId: string;
  let projectId: string;
  let subcontractorCompanyId: string;
  let docketId: string;
  let employeeId: string;
  let plantId: string;
  let assignedLotId: string;

  beforeAll(async () => {
    // Create test company
    const company = await prisma.company.create({
      data: { name: `Dockets Test Company ${Date.now()}` },
    });
    companyId = company.id;

    // Create head contractor user
    const adminEmail = `dockets-admin-${Date.now()}@example.com`;
    const adminRes = await request(app).post('/api/auth/register').send({
      email: adminEmail,
      password: 'SecureP@ssword123!',
      fullName: 'Dockets Admin',
      tosAccepted: true,
    });
    authToken = adminRes.body.token;
    userId = adminRes.body.user.id;

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'site_manager' },
    });

    // Create project
    const project = await prisma.project.create({
      data: {
        name: `Dockets Test Project ${Date.now()}`,
        projectNumber: `DKT-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    projectId = project.id;

    await prisma.projectUser.create({
      data: { projectId, userId, role: 'site_manager', status: 'active' },
    });

    // Create subcontractor company
    const subcontractorCompany = await prisma.subcontractorCompany.create({
      data: {
        projectId,
        companyName: `Test Subcontractor ${Date.now()}`,
        primaryContactName: 'Sub Contact',
        primaryContactEmail: `sub-${Date.now()}@example.com`,
        status: 'approved',
      },
    });
    subcontractorCompanyId = subcontractorCompany.id;

    // Create subcontractor user
    const subEmail = `sub-user-${Date.now()}@example.com`;
    const subRes = await request(app).post('/api/auth/register').send({
      email: subEmail,
      password: 'SecureP@ssword123!',
      fullName: 'Subcontractor User',
      tosAccepted: true,
    });
    subcontractorToken = subRes.body.token;
    subcontractorUserId = subRes.body.user.id;

    await prisma.user.update({
      where: { id: subcontractorUserId },
      data: { companyId, roleInCompany: 'subcontractor' },
    });

    // Link subcontractor user to subcontractor company
    await prisma.subcontractorUser.create({
      data: {
        userId: subcontractorUserId,
        subcontractorCompanyId,
        role: 'admin',
      },
    });

    // Create employee in roster
    const employee = await prisma.employeeRoster.create({
      data: {
        subcontractorCompanyId,
        name: 'Test Worker',
        role: 'Operator',
        hourlyRate: 45.5,
        status: 'approved',
      },
    });
    employeeId = employee.id;

    // Create plant in register
    const plant = await prisma.plantRegister.create({
      data: {
        subcontractorCompanyId,
        type: 'Excavator',
        description: 'CAT 320',
        idRego: 'EX-001',
        dryRate: 150,
        wetRate: 180,
        status: 'approved',
      },
    });
    plantId = plant.id;

    // Create lot for testing lot allocations
    const assignedLot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `DKT-LOT-${Date.now()}`,
        status: 'not_started',
        lotType: 'chainage',
        activityType: 'Earthworks',
        assignedSubcontractorId: subcontractorCompanyId,
        subcontractorAssignments: {
          create: {
            projectId,
            subcontractorCompanyId,
            assignedById: userId,
            status: 'active',
          },
        },
      },
    });
    assignedLotId = assignedLot.id;
  });

  afterAll(async () => {
    // Cleanup in correct order
    await prisma.docketLabourLot.deleteMany({ where: { docketLabour: { docket: { projectId } } } });
    await prisma.docketLabour.deleteMany({ where: { docket: { projectId } } });
    await prisma.docketPlant.deleteMany({ where: { docket: { projectId } } });
    await prisma.dailyDocket.deleteMany({ where: { projectId } });
    await prisma.notification.deleteMany({ where: { projectId } });
    await prisma.employeeRoster.deleteMany({ where: { subcontractorCompanyId } });
    await prisma.plantRegister.deleteMany({ where: { subcontractorCompanyId } });
    await prisma.subcontractorUser.deleteMany({ where: { subcontractorCompanyId } });
    await prisma.lotSubcontractorAssignment.deleteMany({ where: { projectId } });
    await prisma.subcontractorCompany.deleteMany({ where: { projectId } });
    await prisma.lot.deleteMany({ where: { projectId } });
    await prisma.projectUser.deleteMany({ where: { projectId } });
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {});

    for (const uid of [userId, subcontractorUserId]) {
      await prisma.emailVerificationToken.deleteMany({ where: { userId: uid } });
      await prisma.user.delete({ where: { id: uid } }).catch(() => {});
    }

    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  });

  describe('POST /api/dockets', () => {
    it('should create a new docket as subcontractor', async () => {
      const today = new Date().toISOString().split('T')[0];
      const res = await request(app)
        .post('/api/dockets')
        .set('Authorization', `Bearer ${subcontractorToken}`)
        .send({
          projectId,
          date: today,
          notes: 'Test docket',
        });

      expect(res.status).toBe(201);
      expect(res.body.docket).toBeDefined();
      expect(res.body.docket.status).toBe('draft');
      docketId = res.body.docket.id;
    });

    it('should reject docket without projectId', async () => {
      const res = await request(app)
        .post('/api/dockets')
        .set('Authorization', `Bearer ${subcontractorToken}`)
        .send({
          date: new Date().toISOString().split('T')[0],
        });

      expect(res.status).toBe(400);
    });

    it('should reject invalid docket dates', async () => {
      const res = await request(app)
        .post('/api/dockets')
        .set('Authorization', `Bearer ${subcontractorToken}`)
        .send({
          projectId,
          date: 'not-a-date',
        });

      expect(res.status).toBe(400);

      const invalidCalendarDateRes = await request(app)
        .post('/api/dockets')
        .set('Authorization', `Bearer ${subcontractorToken}`)
        .send({
          projectId,
          date: '2026-02-30',
        });

      expect(invalidCalendarDateRes.status).toBe(400);

      const invalidCalendarDateTimeRes = await request(app)
        .post('/api/dockets')
        .set('Authorization', `Bearer ${subcontractorToken}`)
        .send({
          projectId,
          date: '2026-02-30T10:00:00Z',
        });

      expect(invalidCalendarDateTimeRes.status).toBe(400);
    });

    it('should reject oversized docket fields without creating a docket', async () => {
      const beforeCount = await prisma.dailyDocket.count({ where: { projectId } });
      const cases = [
        {
          payload: { projectId: 'P'.repeat(121), date: new Date().toISOString().split('T')[0] },
          message: 'projectId',
        },
        {
          payload: { projectId, date: '2'.repeat(65) },
          message: 'Date',
        },
        {
          payload: {
            projectId,
            date: new Date().toISOString().split('T')[0],
            notes: 'N'.repeat(5001),
          },
          message: 'Notes',
        },
      ];

      for (const testCase of cases) {
        const res = await request(app)
          .post('/api/dockets')
          .set('Authorization', `Bearer ${subcontractorToken}`)
          .send(testCase.payload);

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain(testCase.message);
      }

      expect(await prisma.dailyDocket.count({ where: { projectId } })).toBe(beforeCount);
    });
  });

  describe('GET /api/dockets', () => {
    it('should list dockets for project', async () => {
      const res = await request(app)
        .get(`/api/dockets?projectId=${projectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.dockets).toBeDefined();
      expect(Array.isArray(res.body.dockets)).toBe(true);
    });

    it('should require projectId', async () => {
      const res = await request(app)
        .get('/api/dockets')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
    });

    it('should reject malformed projectId query parameters', async () => {
      const res = await request(app)
        .get(`/api/dockets?projectId=${projectId}&projectId=other`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
    });

    it('should filter by status', async () => {
      const res = await request(app)
        .get(`/api/dockets?projectId=${projectId}&status=draft`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.dockets).toBeDefined();
    });

    it('should reject invalid status and sort fields', async () => {
      const invalidStatus = await request(app)
        .get(`/api/dockets?projectId=${projectId}&status=not_real`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(invalidStatus.status).toBe(400);

      const invalidSort = await request(app)
        .get(`/api/dockets?projectId=${projectId}&sortBy=notAColumn`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(invalidSort.status).toBe(400);
    });
  });

  describe('GET /api/dockets/:id', () => {
    it('should get a single docket with details', async () => {
      const res = await request(app)
        .get(`/api/dockets/${docketId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.docket).toBeDefined();
      expect(res.body.docket.id).toBe(docketId);
    });

    it('should return 404 for non-existent docket', async () => {
      const res = await request(app)
        .get('/api/dockets/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('Route parameter validation', () => {
    it('should reject oversized docket route parameters before lookups', async () => {
      const longId = 'd'.repeat(121);
      const checks = [
        {
          label: 'GET docket',
          response: await request(app)
            .get(`/api/dockets/${longId}`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'PATCH docket',
          response: await request(app)
            .patch(`/api/dockets/${longId}`)
            .set('Authorization', `Bearer ${subcontractorToken}`)
            .send({ notes: 'Updated notes' }),
        },
        {
          label: 'POST submit',
          response: await request(app)
            .post(`/api/dockets/${longId}/submit`)
            .set('Authorization', `Bearer ${subcontractorToken}`),
        },
        {
          label: 'POST approve',
          response: await request(app)
            .post(`/api/dockets/${longId}/approve`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({}),
        },
        {
          label: 'POST reject',
          response: await request(app)
            .post(`/api/dockets/${longId}/reject`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ reason: 'Rejected' }),
        },
        {
          label: 'POST query',
          response: await request(app)
            .post(`/api/dockets/${longId}/query`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ questions: 'Please clarify' }),
        },
        {
          label: 'POST respond',
          response: await request(app)
            .post(`/api/dockets/${longId}/respond`)
            .set('Authorization', `Bearer ${subcontractorToken}`)
            .send({ response: 'Clarified' }),
        },
        {
          label: 'GET labour',
          response: await request(app)
            .get(`/api/dockets/${longId}/labour`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'POST labour',
          response: await request(app)
            .post(`/api/dockets/${longId}/labour`)
            .set('Authorization', `Bearer ${subcontractorToken}`)
            .send({ employeeId, startTime: '07:00', finishTime: '15:00' }),
        },
        {
          label: 'PUT labour entry',
          response: await request(app)
            .put(`/api/dockets/${docketId}/labour/${longId}`)
            .set('Authorization', `Bearer ${subcontractorToken}`)
            .send({ startTime: '07:00', finishTime: '15:00' }),
        },
        {
          label: 'DELETE labour entry',
          response: await request(app)
            .delete(`/api/dockets/${docketId}/labour/${longId}`)
            .set('Authorization', `Bearer ${subcontractorToken}`),
        },
        {
          label: 'GET plant',
          response: await request(app)
            .get(`/api/dockets/${longId}/plant`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'POST plant',
          response: await request(app)
            .post(`/api/dockets/${longId}/plant`)
            .set('Authorization', `Bearer ${subcontractorToken}`)
            .send({ plantId, hoursOperated: 4, wetOrDry: 'dry' }),
        },
        {
          label: 'PUT plant entry',
          response: await request(app)
            .put(`/api/dockets/${docketId}/plant/${longId}`)
            .set('Authorization', `Bearer ${subcontractorToken}`)
            .send({ hoursOperated: 5, wetOrDry: 'wet' }),
        },
        {
          label: 'DELETE plant entry',
          response: await request(app)
            .delete(`/api/dockets/${docketId}/plant/${longId}`)
            .set('Authorization', `Bearer ${subcontractorToken}`),
        },
      ];

      for (const { label, response } of checks) {
        expect(response.status, label).toBe(400);
        expect(response.body.error.message, label).toContain('is too long');
      }
    });
  });

  describe('PATCH /api/dockets/:id', () => {
    it('should update notes on an editable subcontractor docket', async () => {
      const docket = await prisma.dailyDocket.create({
        data: {
          projectId,
          subcontractorCompanyId,
          date: new Date(Date.now() + 86400000),
          status: 'draft',
          notes: 'Original notes',
        },
      });

      try {
        const res = await request(app)
          .patch(`/api/dockets/${docket.id}`)
          .set('Authorization', `Bearer ${subcontractorToken}`)
          .send({ notes: 'Updated subcontractor notes' });

        expect(res.status).toBe(200);
        expect(res.body.docket.notes).toBe('Updated subcontractor notes');

        const stored = await prisma.dailyDocket.findUnique({ where: { id: docket.id } });
        expect(stored?.notes).toBe('Updated subcontractor notes');
      } finally {
        await prisma.dailyDocket.delete({ where: { id: docket.id } }).catch(() => {});
      }
    });

    it('should reject note updates while a docket is pending approval', async () => {
      const docket = await prisma.dailyDocket.create({
        data: {
          projectId,
          subcontractorCompanyId,
          date: new Date(Date.now() + 172800000),
          status: 'pending_approval',
          submittedAt: new Date(),
          notes: 'Locked notes',
        },
      });

      try {
        const res = await request(app)
          .patch(`/api/dockets/${docket.id}`)
          .set('Authorization', `Bearer ${subcontractorToken}`)
          .send({ notes: 'Should not save' });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('draft, queried, or rejected');
      } finally {
        await prisma.dailyDocket.delete({ where: { id: docket.id } }).catch(() => {});
      }
    });
  });

  describe('Labour Entry Management', () => {
    let labourEntryId: string;

    it('should add labour entry to docket', async () => {
      const res = await request(app)
        .post(`/api/dockets/${docketId}/labour`)
        .set('Authorization', `Bearer ${subcontractorToken}`)
        .send({
          employeeId,
          startTime: '07:00',
          finishTime: '15:30',
        });

      expect(res.status).toBe(201);
      expect(res.body.labourEntry).toBeDefined();
      expect(res.body.labourEntry.submittedHours).toBeGreaterThan(0);
      labourEntryId = res.body.labourEntry.id;
    });

    it('should get labour entries for docket', async () => {
      const res = await request(app)
        .get(`/api/dockets/${docketId}/labour`)
        .set('Authorization', `Bearer ${subcontractorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.labourEntries).toBeDefined();
      expect(res.body.totals).toBeDefined();
    });

    it('should update labour entry', async () => {
      const res = await request(app)
        .put(`/api/dockets/${docketId}/labour/${labourEntryId}`)
        .set('Authorization', `Bearer ${subcontractorToken}`)
        .send({
          startTime: '06:00',
          finishTime: '16:00',
        });

      expect(res.status).toBe(200);
      expect(res.body.labourEntry).toBeDefined();
    });

    it('should reject adding labour without employeeId', async () => {
      const res = await request(app)
        .post(`/api/dockets/${docketId}/labour`)
        .set('Authorization', `Bearer ${subcontractorToken}`)
        .send({
          startTime: '07:00',
          finishTime: '15:00',
        });

      expect(res.status).toBe(400);
    });

    it('should reject malformed labour times and negative lot allocation hours', async () => {
      const invalidTime = await request(app)
        .post(`/api/dockets/${docketId}/labour`)
        .set('Authorization', `Bearer ${subcontractorToken}`)
        .send({
          employeeId,
          startTime: '25:00',
          finishTime: '15:00',
        });

      expect(invalidTime.status).toBe(400);

      const lot = await prisma.lot.findUnique({ where: { id: assignedLotId } });
      const negativeLotHours = await request(app)
        .post(`/api/dockets/${docketId}/labour`)
        .set('Authorization', `Bearer ${subcontractorToken}`)
        .send({
          employeeId,
          startTime: '07:00',
          finishTime: '15:00',
          lotAllocations: [{ lotId: lot!.id, hours: -1 }],
        });

      expect(negativeLotHours.status).toBe(400);
    });

    it('should reject oversized labour entry fields without creating an entry', async () => {
      const lot = await prisma.lot.findUnique({ where: { id: assignedLotId } });
      const beforeCount = await prisma.docketLabour.count({ where: { docketId } });
      const cases = [
        {
          payload: { employeeId: 'E'.repeat(121), startTime: '07:00', finishTime: '15:00' },
          message: 'employeeId',
        },
        {
          payload: {
            employeeId,
            startTime: '07:00',
            finishTime: '15:00',
            lotAllocations: [{ lotId: 'L'.repeat(121), hours: 1 }],
          },
          message: 'lotId',
        },
        {
          payload: {
            employeeId,
            startTime: '07:00',
            finishTime: '15:00',
            lotAllocations: Array.from({ length: 201 }, () => ({ lotId: lot!.id, hours: 0.1 })),
          },
          message: 'Cannot allocate more than',
        },
      ];

      for (const testCase of cases) {
        const res = await request(app)
          .post(`/api/dockets/${docketId}/labour`)
          .set('Authorization', `Bearer ${subcontractorToken}`)
          .send(testCase.payload);

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain(testCase.message);
      }

      expect(await prisma.docketLabour.count({ where: { docketId } })).toBe(beforeCount);
    });
  });

  describe('Plant Entry Management', () => {
    let plantEntryId: string;

    it('should add plant entry to docket', async () => {
      const res = await request(app)
        .post(`/api/dockets/${docketId}/plant`)
        .set('Authorization', `Bearer ${subcontractorToken}`)
        .send({
          plantId,
          hoursOperated: 8,
          wetOrDry: 'dry',
        });

      expect(res.status).toBe(201);
      expect(res.body.plantEntry).toBeDefined();
      expect(res.body.plantEntry.hoursOperated).toBe(8);
      plantEntryId = res.body.plantEntry.id;
    });

    it('should get plant entries for docket', async () => {
      const res = await request(app)
        .get(`/api/dockets/${docketId}/plant`)
        .set('Authorization', `Bearer ${subcontractorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.plantEntries).toBeDefined();
      expect(res.body.totals).toBeDefined();
    });

    it('should update plant entry', async () => {
      const res = await request(app)
        .put(`/api/dockets/${docketId}/plant/${plantEntryId}`)
        .set('Authorization', `Bearer ${subcontractorToken}`)
        .send({
          hoursOperated: 10,
          wetOrDry: 'wet',
        });

      expect(res.status).toBe(200);
      expect(res.body.plantEntry).toBeDefined();
    });

    it('should reject adding plant without plantId', async () => {
      const res = await request(app)
        .post(`/api/dockets/${docketId}/plant`)
        .set('Authorization', `Bearer ${subcontractorToken}`)
        .send({
          hoursOperated: 8,
        });

      expect(res.status).toBe(400);
    });

    it('should reject adding plant without hoursOperated', async () => {
      const res = await request(app)
        .post(`/api/dockets/${docketId}/plant`)
        .set('Authorization', `Bearer ${subcontractorToken}`)
        .send({
          plantId,
        });

      expect(res.status).toBe(400);
    });

    it('should reject negative plant hours', async () => {
      const res = await request(app)
        .post(`/api/dockets/${docketId}/plant`)
        .set('Authorization', `Bearer ${subcontractorToken}`)
        .send({
          plantId,
          hoursOperated: -1,
        });

      expect(res.status).toBe(400);
    });

    it('should reject oversized plant IDs without creating an entry', async () => {
      const beforeCount = await prisma.docketPlant.count({ where: { docketId } });
      const res = await request(app)
        .post(`/api/dockets/${docketId}/plant`)
        .set('Authorization', `Bearer ${subcontractorToken}`)
        .send({
          plantId: 'P'.repeat(121),
          hoursOperated: 8,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('plantId');
      expect(await prisma.docketPlant.count({ where: { docketId } })).toBe(beforeCount);
    });
  });

  describe('Docket Submission Flow', () => {
    let submittableDocketId: string;
    let labourId: string;

    beforeAll(async () => {
      // Create a new docket for submission testing
      const docket = await prisma.dailyDocket.create({
        data: {
          projectId,
          subcontractorCompanyId,
          date: new Date(),
          status: 'draft',
        },
      });
      submittableDocketId = docket.id;

      // Add labour entry with lot allocation for submission
      const lot = await prisma.lot.findUnique({ where: { id: assignedLotId } });
      const labour = await prisma.docketLabour.create({
        data: {
          docketId: submittableDocketId,
          employeeId,
          startTime: '07:00',
          finishTime: '15:00',
          submittedHours: 8,
          hourlyRate: 45.5,
          submittedCost: 364,
          lotAllocations: {
            create: {
              lotId: lot!.id,
              hours: 8,
            },
          },
        },
      });
      labourId = labour.id;
    });

    it('should reject submission without entries', async () => {
      // Create empty docket
      const emptyDocket = await prisma.dailyDocket.create({
        data: {
          projectId,
          subcontractorCompanyId,
          date: new Date(Date.now() + 86400000), // Tomorrow
          status: 'draft',
        },
      });

      const res = await request(app)
        .post(`/api/dockets/${emptyDocket.id}/submit`)
        .set('Authorization', `Bearer ${subcontractorToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('ENTRY_REQUIRED');

      await prisma.dailyDocket.delete({ where: { id: emptyDocket.id } });
    });

    it('should submit docket for approval', async () => {
      const pendingEmail = `dockets-pending-approver-${Date.now()}@example.com`;
      const pendingRes = await request(app).post('/api/auth/register').send({
        email: pendingEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Pending Docket Approver',
        tosAccepted: true,
      });
      const pendingUserId = pendingRes.body.user.id;

      await prisma.user.update({
        where: { id: pendingUserId },
        data: { companyId, roleInCompany: 'project_manager' },
      });
      await prisma.projectUser.create({
        data: { projectId, userId: pendingUserId, role: 'project_manager', status: 'pending' },
      });

      try {
        const res = await request(app)
          .post(`/api/dockets/${submittableDocketId}/submit`)
          .set('Authorization', `Bearer ${subcontractorToken}`);

        expect(res.status).toBe(200);
        expect(res.body.docket.status).toBe('pending_approval');

        const pendingNotification = await prisma.notification.findFirst({
          where: {
            projectId,
            userId: pendingUserId,
            type: 'docket_pending',
          },
        });
        expect(pendingNotification).toBeNull();
      } finally {
        await prisma.projectUser.deleteMany({ where: { userId: pendingUserId } });
        await prisma.emailVerificationToken.deleteMany({ where: { userId: pendingUserId } });
        await prisma.user.delete({ where: { id: pendingUserId } }).catch(() => {});
      }
    });

    it('should reject submitting non-draft docket', async () => {
      const res = await request(app)
        .post(`/api/dockets/${submittableDocketId}/submit`)
        .set('Authorization', `Bearer ${subcontractorToken}`);

      expect(res.status).toBe(400);
    });

    it('should reject negative approval adjustments', async () => {
      const res = await request(app)
        .post(`/api/dockets/${submittableDocketId}/approve`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          adjustedLabourHours: -1,
        });

      expect(res.status).toBe(400);
    });

    it('should approve docket', async () => {
      const res = await request(app)
        .post(`/api/dockets/${submittableDocketId}/approve`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          foremanNotes: 'Looks good',
        });

      expect(res.status).toBe(200);
      expect(res.body.docket.status).toBe('approved');
    });

    it('should reject approving non-pending docket', async () => {
      const res = await request(app)
        .post(`/api/dockets/${submittableDocketId}/approve`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
    });

    afterAll(async () => {
      await prisma.docketLabourLot.deleteMany({ where: { docketLabourId: labourId } });
      await prisma.docketLabour.deleteMany({ where: { docketId: submittableDocketId } });
      await prisma.dailyDocket.delete({ where: { id: submittableDocketId } }).catch(() => {});
    });
  });

  describe('Docket Rejection Flow', () => {
    let rejectableDocketId: string;

    beforeAll(async () => {
      // Create docket in pending_approval state
      const lot = await prisma.lot.findUnique({ where: { id: assignedLotId } });
      const docket = await prisma.dailyDocket.create({
        data: {
          projectId,
          subcontractorCompanyId,
          date: new Date(Date.now() + 172800000), // 2 days from now
          status: 'pending_approval',
          submittedAt: new Date(),
        },
      });
      rejectableDocketId = docket.id;

      // Add required labour entry
      await prisma.docketLabour.create({
        data: {
          docketId: rejectableDocketId,
          employeeId,
          submittedHours: 8,
          hourlyRate: 45.5,
          submittedCost: 364,
          lotAllocations: {
            create: {
              lotId: lot!.id,
              hours: 8,
            },
          },
        },
      });
    });

    it('should reject docket', async () => {
      const res = await request(app)
        .post(`/api/dockets/${rejectableDocketId}/reject`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'Hours do not match diary',
        });

      expect(res.status).toBe(200);
      expect(res.body.docket.status).toBe('rejected');
    });

    afterAll(async () => {
      await prisma.docketLabourLot.deleteMany({
        where: { docketLabour: { docketId: rejectableDocketId } },
      });
      await prisma.docketLabour.deleteMany({ where: { docketId: rejectableDocketId } });
      await prisma.dailyDocket.delete({ where: { id: rejectableDocketId } }).catch(() => {});
    });
  });

  describe('Docket Query Flow', () => {
    let queryableDocketId: string;

    beforeAll(async () => {
      const lot = await prisma.lot.findUnique({ where: { id: assignedLotId } });
      const docket = await prisma.dailyDocket.create({
        data: {
          projectId,
          subcontractorCompanyId,
          date: new Date(Date.now() + 259200000), // 3 days from now
          status: 'pending_approval',
          submittedAt: new Date(),
        },
      });
      queryableDocketId = docket.id;

      await prisma.docketLabour.create({
        data: {
          docketId: queryableDocketId,
          employeeId,
          submittedHours: 8,
          hourlyRate: 45.5,
          submittedCost: 364,
          lotAllocations: {
            create: {
              lotId: lot!.id,
              hours: 8,
            },
          },
        },
      });
    });

    it('should query docket', async () => {
      const res = await request(app)
        .post(`/api/dockets/${queryableDocketId}/query`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          questions: 'What work area was this for?',
        });

      expect(res.status).toBe(200);
      expect(res.body.docket.status).toBe('queried');
    });

    it('should reject query without questions', async () => {
      // Reset status for this test
      await prisma.dailyDocket.update({
        where: { id: queryableDocketId },
        data: { status: 'pending_approval' },
      });

      const res = await request(app)
        .post(`/api/dockets/${queryableDocketId}/query`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          questions: '',
        });

      expect(res.status).toBe(400);
    });

    it('should respond to query', async () => {
      // Set to queried state
      await prisma.dailyDocket.update({
        where: { id: queryableDocketId },
        data: { status: 'queried' },
      });

      const res = await request(app)
        .post(`/api/dockets/${queryableDocketId}/respond`)
        .set('Authorization', `Bearer ${subcontractorToken}`)
        .send({
          response: 'This was for the northern section',
        });

      expect(res.status).toBe(200);
      expect(res.body.docket.status).toBe('pending_approval');
    });

    afterAll(async () => {
      await prisma.docketLabourLot.deleteMany({
        where: { docketLabour: { docketId: queryableDocketId } },
      });
      await prisma.docketLabour.deleteMany({ where: { docketId: queryableDocketId } });
      await prisma.dailyDocket.delete({ where: { id: queryableDocketId } }).catch(() => {});
    });
  });

  describe('Entry edits after approver feedback', () => {
    it('should allow subcontractors to update entries on rejected dockets before resubmission', async () => {
      const lot = await prisma.lot.findUnique({ where: { id: assignedLotId } });
      const docket = await prisma.dailyDocket.create({
        data: {
          projectId,
          subcontractorCompanyId,
          date: new Date(Date.now() + 604800000),
          status: 'rejected',
        },
      });

      try {
        const labourRes = await request(app)
          .post(`/api/dockets/${docket.id}/labour`)
          .set('Authorization', `Bearer ${subcontractorToken}`)
          .send({
            employeeId,
            startTime: '07:00',
            finishTime: '15:00',
            lotAllocations: [{ lotId: lot!.id, hours: 8 }],
          });

        expect(labourRes.status).toBe(201);

        const updateLabourRes = await request(app)
          .put(`/api/dockets/${docket.id}/labour/${labourRes.body.labourEntry.id}`)
          .set('Authorization', `Bearer ${subcontractorToken}`)
          .send({
            startTime: '06:00',
            finishTime: '14:00',
          });

        expect(updateLabourRes.status).toBe(200);

        const plantRes = await request(app)
          .post(`/api/dockets/${docket.id}/plant`)
          .set('Authorization', `Bearer ${subcontractorToken}`)
          .send({
            plantId,
            hoursOperated: 4,
            wetOrDry: 'dry',
          });

        expect(plantRes.status).toBe(201);

        const updatePlantRes = await request(app)
          .put(`/api/dockets/${docket.id}/plant/${plantRes.body.plantEntry.id}`)
          .set('Authorization', `Bearer ${subcontractorToken}`)
          .send({
            hoursOperated: 5,
            wetOrDry: 'wet',
          });

        expect(updatePlantRes.status).toBe(200);

        const deleteLabourRes = await request(app)
          .delete(`/api/dockets/${docket.id}/labour/${labourRes.body.labourEntry.id}`)
          .set('Authorization', `Bearer ${subcontractorToken}`);

        expect(deleteLabourRes.status).toBe(200);

        const deletePlantRes = await request(app)
          .delete(`/api/dockets/${docket.id}/plant/${plantRes.body.plantEntry.id}`)
          .set('Authorization', `Bearer ${subcontractorToken}`);

        expect(deletePlantRes.status).toBe(200);
      } finally {
        await prisma.docketLabourLot.deleteMany({
          where: { docketLabour: { docketId: docket.id } },
        });
        await prisma.docketLabour.deleteMany({ where: { docketId: docket.id } });
        await prisma.docketPlant.deleteMany({ where: { docketId: docket.id } });
        await prisma.dailyDocket.delete({ where: { id: docket.id } }).catch(() => {});
      }
    });

    it('should allow subcontractors to revise entries on queried dockets before responding', async () => {
      const lot = await prisma.lot.findUnique({ where: { id: assignedLotId } });
      const docket = await prisma.dailyDocket.create({
        data: {
          projectId,
          subcontractorCompanyId,
          date: new Date(Date.now() + 691200000),
          status: 'queried',
        },
      });

      try {
        const res = await request(app)
          .post(`/api/dockets/${docket.id}/labour`)
          .set('Authorization', `Bearer ${subcontractorToken}`)
          .send({
            employeeId,
            startTime: '08:00',
            finishTime: '12:00',
            lotAllocations: [{ lotId: lot!.id, hours: 4 }],
          });

        expect(res.status).toBe(201);
      } finally {
        await prisma.docketLabourLot.deleteMany({
          where: { docketLabour: { docketId: docket.id } },
        });
        await prisma.docketLabour.deleteMany({ where: { docketId: docket.id } });
        await prisma.dailyDocket.delete({ where: { id: docket.id } }).catch(() => {});
      }
    });

    it('should still reject entry edits while a docket is pending approval', async () => {
      const docket = await prisma.dailyDocket.create({
        data: {
          projectId,
          subcontractorCompanyId,
          date: new Date(Date.now() + 777600000),
          status: 'pending_approval',
          submittedAt: new Date(),
        },
      });

      try {
        const res = await request(app)
          .post(`/api/dockets/${docket.id}/plant`)
          .set('Authorization', `Bearer ${subcontractorToken}`)
          .send({
            plantId,
            hoursOperated: 3,
            wetOrDry: 'dry',
          });

        expect(res.status).toBe(400);
      } finally {
        await prisma.docketPlant.deleteMany({ where: { docketId: docket.id } });
        await prisma.dailyDocket.delete({ where: { id: docket.id } }).catch(() => {});
      }
    });
  });

  describe('Labour Entry Deletion', () => {
    let deletableDocketId: string;
    let deletableLabourId: string;

    beforeAll(async () => {
      const docket = await prisma.dailyDocket.create({
        data: {
          projectId,
          subcontractorCompanyId,
          date: new Date(Date.now() + 345600000), // 4 days from now
          status: 'draft',
        },
      });
      deletableDocketId = docket.id;

      const labour = await prisma.docketLabour.create({
        data: {
          docketId: deletableDocketId,
          employeeId,
          submittedHours: 4,
          hourlyRate: 45.5,
          submittedCost: 182,
        },
      });
      deletableLabourId = labour.id;
    });

    it('should delete labour entry', async () => {
      const res = await request(app)
        .delete(`/api/dockets/${deletableDocketId}/labour/${deletableLabourId}`)
        .set('Authorization', `Bearer ${subcontractorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('deleted');
    });

    afterAll(async () => {
      await prisma.docketLabour.deleteMany({ where: { docketId: deletableDocketId } });
      await prisma.dailyDocket.delete({ where: { id: deletableDocketId } }).catch(() => {});
    });
  });

  describe('Plant Entry Deletion', () => {
    let deletableDocketId: string;
    let deletablePlantEntryId: string;

    beforeAll(async () => {
      const docket = await prisma.dailyDocket.create({
        data: {
          projectId,
          subcontractorCompanyId,
          date: new Date(Date.now() + 432000000), // 5 days from now
          status: 'draft',
        },
      });
      deletableDocketId = docket.id;

      const plantEntry = await prisma.docketPlant.create({
        data: {
          docketId: deletableDocketId,
          plantId,
          hoursOperated: 4,
          hourlyRate: 150,
          submittedCost: 600,
        },
      });
      deletablePlantEntryId = plantEntry.id;
    });

    it('should delete plant entry', async () => {
      const res = await request(app)
        .delete(`/api/dockets/${deletableDocketId}/plant/${deletablePlantEntryId}`)
        .set('Authorization', `Bearer ${subcontractorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('deleted');
    });

    afterAll(async () => {
      await prisma.docketPlant.deleteMany({ where: { docketId: deletableDocketId } });
      await prisma.dailyDocket.delete({ where: { id: deletableDocketId } }).catch(() => {});
    });
  });

  describe('Access control hardening', () => {
    it('should deny same-company users without active project access from listing dockets', async () => {
      const email = `dockets-unassigned-${Date.now()}@example.com`;
      const regRes = await request(app).post('/api/auth/register').send({
        email,
        password: 'SecureP@ssword123!',
        fullName: 'Unassigned Docket User',
        tosAccepted: true,
      });
      const tempUserId = regRes.body.user.id;

      await prisma.user.update({
        where: { id: tempUserId },
        data: { companyId, roleInCompany: 'site_manager' },
      });

      try {
        const res = await request(app)
          .get(`/api/dockets?projectId=${projectId}`)
          .set('Authorization', `Bearer ${regRes.body.token}`);

        expect(res.status).toBe(403);
      } finally {
        await prisma.emailVerificationToken.deleteMany({ where: { userId: tempUserId } });
        await prisma.user.delete({ where: { id: tempUserId } }).catch(() => {});
      }
    });

    it('should deny other subcontractors on the same project from reading or editing a docket', async () => {
      const otherSubcontractorCompany = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `Other Docket Subcontractor ${Date.now()}`,
          primaryContactName: 'Other Contact',
          primaryContactEmail: `other-sub-${Date.now()}@example.com`,
          status: 'approved',
        },
      });
      const email = `other-docket-sub-${Date.now()}@example.com`;
      const regRes = await request(app).post('/api/auth/register').send({
        email,
        password: 'SecureP@ssword123!',
        fullName: 'Other Docket Subcontractor',
        tosAccepted: true,
      });
      const tempUserId = regRes.body.user.id;

      await prisma.user.update({
        where: { id: tempUserId },
        data: { companyId, roleInCompany: 'subcontractor' },
      });
      await prisma.subcontractorUser.create({
        data: {
          userId: tempUserId,
          subcontractorCompanyId: otherSubcontractorCompany.id,
          role: 'user',
        },
      });

      try {
        const readRes = await request(app)
          .get(`/api/dockets/${docketId}`)
          .set('Authorization', `Bearer ${regRes.body.token}`);
        expect(readRes.status).toBe(403);

        const editRes = await request(app)
          .post(`/api/dockets/${docketId}/labour`)
          .set('Authorization', `Bearer ${regRes.body.token}`)
          .send({
            employeeId,
            startTime: '07:00',
            finishTime: '15:00',
          });
        expect(editRes.status).toBe(403);
      } finally {
        await prisma.subcontractorUser.deleteMany({ where: { userId: tempUserId } });
        await prisma.emailVerificationToken.deleteMany({ where: { userId: tempUserId } });
        await prisma.user.delete({ where: { id: tempUserId } }).catch(() => {});
        await prisma.subcontractorCompany
          .delete({ where: { id: otherSubcontractorCompany.id } })
          .catch(() => {});
      }
    });

    it('should not grant subcontractors approver access through project memberships', async () => {
      const approvableDocket = await prisma.dailyDocket.create({
        data: {
          projectId,
          subcontractorCompanyId,
          date: new Date(Date.now() + 172800000),
          status: 'pending_approval',
        },
      });
      await prisma.projectUser.create({
        data: {
          projectId,
          userId: subcontractorUserId,
          role: 'project_manager',
          status: 'active',
        },
      });

      try {
        const res = await request(app)
          .post(`/api/dockets/${approvableDocket.id}/approve`)
          .set('Authorization', `Bearer ${subcontractorToken}`)
          .send({ foremanNotes: 'Subcontractor should not approve' });

        expect(res.status).toBe(403);
        const unchanged = await prisma.dailyDocket.findUniqueOrThrow({
          where: { id: approvableDocket.id },
          select: { status: true, approvedById: true },
        });
        expect(unchanged.status).toBe('pending_approval');
        expect(unchanged.approvedById).toBeNull();
      } finally {
        await prisma.projectUser.deleteMany({ where: { projectId, userId: subcontractorUserId } });
        await prisma.dailyDocket.delete({ where: { id: approvableDocket.id } }).catch(() => {});
      }
    });

    it('should reject labour lot allocations outside the docket project', async () => {
      const otherProject = await prisma.project.create({
        data: {
          name: `Dockets Other Project ${Date.now()}`,
          projectNumber: `DKT-OTHER-${Date.now()}`,
          companyId,
          status: 'active',
          state: 'NSW',
          specificationSet: 'TfNSW',
        },
      });
      const otherLot = await prisma.lot.create({
        data: {
          projectId: otherProject.id,
          lotNumber: `DKT-OTHER-LOT-${Date.now()}`,
          status: 'not_started',
          lotType: 'chainage',
          activityType: 'Earthworks',
        },
      });

      try {
        const res = await request(app)
          .post(`/api/dockets/${docketId}/labour`)
          .set('Authorization', `Bearer ${subcontractorToken}`)
          .send({
            employeeId,
            startTime: '05:00',
            finishTime: '06:00',
            lotAllocations: [{ lotId: otherLot.id, hours: 1 }],
          });

        expect(res.status).toBe(400);
      } finally {
        await prisma.docketLabourLot.deleteMany({ where: { lotId: otherLot.id } });
        await prisma.docketLabour.deleteMany({
          where: { docketId, employeeId, startTime: '05:00' },
        });
        await prisma.lot.delete({ where: { id: otherLot.id } }).catch(() => {});
        await prisma.project.delete({ where: { id: otherProject.id } }).catch(() => {});
      }
    });

    it('should reject labour lot allocations to same-project lots not assigned to the subcontractor', async () => {
      const unassignedLot = await prisma.lot.create({
        data: {
          projectId,
          lotNumber: `DKT-UNASSIGNED-${Date.now()}`,
          status: 'not_started',
          lotType: 'chainage',
          activityType: 'Earthworks',
        },
      });
      const beforeCount = await prisma.docketLabour.count({ where: { docketId } });

      try {
        const res = await request(app)
          .post(`/api/dockets/${docketId}/labour`)
          .set('Authorization', `Bearer ${subcontractorToken}`)
          .send({
            employeeId,
            startTime: '05:30',
            finishTime: '06:30',
            lotAllocations: [{ lotId: unassignedLot.id, hours: 1 }],
          });

        expect(res.status).toBe(403);
        expect(res.body.error.message).toContain('assigned to your company');
        expect(await prisma.docketLabour.count({ where: { docketId } })).toBe(beforeCount);
      } finally {
        await prisma.docketLabourLot.deleteMany({ where: { lotId: unassignedLot.id } });
        await prisma.docketLabour.deleteMany({
          where: { docketId, employeeId, startTime: '05:30' },
        });
        await prisma.lot.delete({ where: { id: unassignedLot.id } }).catch(() => {});
      }
    });

    it('should preserve existing labour allocations when an update targets an unassigned lot', async () => {
      const unassignedLot = await prisma.lot.create({
        data: {
          projectId,
          lotNumber: `DKT-UPDATE-UNASSIGNED-${Date.now()}`,
          status: 'not_started',
          lotType: 'chainage',
          activityType: 'Earthworks',
        },
      });

      const createRes = await request(app)
        .post(`/api/dockets/${docketId}/labour`)
        .set('Authorization', `Bearer ${subcontractorToken}`)
        .send({
          employeeId,
          startTime: '06:30',
          finishTime: '07:30',
          lotAllocations: [{ lotId: assignedLotId, hours: 1 }],
        });
      expect(createRes.status).toBe(201);
      const labourEntryId = createRes.body.labourEntry.id as string;

      try {
        const res = await request(app)
          .put(`/api/dockets/${docketId}/labour/${labourEntryId}`)
          .set('Authorization', `Bearer ${subcontractorToken}`)
          .send({
            lotAllocations: [{ lotId: unassignedLot.id, hours: 1 }],
          });

        expect(res.status).toBe(403);
        expect(res.body.error.message).toContain('assigned to your company');

        const allocations = await prisma.docketLabourLot.findMany({
          where: { docketLabourId: labourEntryId },
          select: { lotId: true },
        });
        expect(allocations).toEqual([{ lotId: assignedLotId }]);
      } finally {
        await prisma.docketLabourLot.deleteMany({ where: { docketLabourId: labourEntryId } });
        await prisma.docketLabour.delete({ where: { id: labourEntryId } }).catch(() => {});
        await prisma.docketLabourLot.deleteMany({ where: { lotId: unassignedLot.id } });
        await prisma.lot.delete({ where: { id: unassignedLot.id } }).catch(() => {});
      }
    });

    it('should deny same-company approvers without active project access', async () => {
      const docket = await prisma.dailyDocket.create({
        data: {
          projectId,
          subcontractorCompanyId,
          date: new Date(Date.now() + 518400000),
          status: 'pending_approval',
          submittedAt: new Date(),
        },
      });
      const email = `dockets-unassigned-approver-${Date.now()}@example.com`;
      const regRes = await request(app).post('/api/auth/register').send({
        email,
        password: 'SecureP@ssword123!',
        fullName: 'Unassigned Docket Approver',
        tosAccepted: true,
      });
      const tempUserId = regRes.body.user.id;

      await prisma.user.update({
        where: { id: tempUserId },
        data: { companyId, roleInCompany: 'site_manager' },
      });

      try {
        const res = await request(app)
          .post(`/api/dockets/${docket.id}/approve`)
          .set('Authorization', `Bearer ${regRes.body.token}`)
          .send({ foremanNotes: 'Approved without access' });

        expect(res.status).toBe(403);
      } finally {
        await prisma.dailyDocket.delete({ where: { id: docket.id } }).catch(() => {});
        await prisma.emailVerificationToken.deleteMany({ where: { userId: tempUserId } });
        await prisma.user.delete({ where: { id: tempUserId } }).catch(() => {});
      }
    });

    it('should deny project viewers from docket approver workflows even with an approver company role', async () => {
      const email = `dockets-viewer-approver-${Date.now()}@example.com`;
      const regRes = await request(app).post('/api/auth/register').send({
        email,
        password: 'SecureP@ssword123!',
        fullName: 'Viewer Docket Approver',
        tosAccepted: true,
      });
      const tempUserId = regRes.body.user.id;
      const docketIds: string[] = [];

      await prisma.user.update({
        where: { id: tempUserId },
        data: { companyId, roleInCompany: 'site_manager' },
      });
      await prisma.projectUser.create({
        data: { projectId, userId: tempUserId, role: 'viewer', status: 'active' },
      });

      const workflows = [
        { path: 'approve', body: { foremanNotes: 'Viewer approve attempt' } },
        { path: 'reject', body: { reason: 'Viewer reject attempt' } },
        { path: 'query', body: { questions: 'Viewer query attempt' } },
      ] as const;

      try {
        for (const workflow of workflows) {
          const docket = await prisma.dailyDocket.create({
            data: {
              projectId,
              subcontractorCompanyId,
              date: new Date(Date.now() + 604800000 + docketIds.length * 86400000),
              status: 'pending_approval',
              submittedAt: new Date(),
            },
          });
          docketIds.push(docket.id);

          const res = await request(app)
            .post(`/api/dockets/${docket.id}/${workflow.path}`)
            .set('Authorization', `Bearer ${regRes.body.token}`)
            .send(workflow.body);

          expect(res.status).toBe(403);
        }
      } finally {
        await prisma.dailyDocket.deleteMany({ where: { id: { in: docketIds } } });
        await prisma.projectUser.deleteMany({ where: { projectId, userId: tempUserId } });
        await prisma.emailVerificationToken.deleteMany({ where: { userId: tempUserId } });
        await prisma.user.delete({ where: { id: tempUserId } }).catch(() => {});
      }
    });

    it('should allow docket workflows based on active project approver role', async () => {
      const docket = await prisma.dailyDocket.create({
        data: {
          projectId,
          subcontractorCompanyId,
          date: new Date(Date.now() + 950400000),
          status: 'pending_approval',
          submittedAt: new Date(),
        },
      });
      const email = `dockets-project-approver-${Date.now()}@example.com`;
      const regRes = await request(app).post('/api/auth/register').send({
        email,
        password: 'SecureP@ssword123!',
        fullName: 'Project Docket Approver',
        tosAccepted: true,
      });
      const tempUserId = regRes.body.user.id;

      await prisma.user.update({
        where: { id: tempUserId },
        data: { companyId, roleInCompany: 'site_engineer' },
      });
      await prisma.projectUser.create({
        data: { projectId, userId: tempUserId, role: 'site_manager', status: 'active' },
      });

      try {
        const res = await request(app)
          .post(`/api/dockets/${docket.id}/query`)
          .set('Authorization', `Bearer ${regRes.body.token}`)
          .send({ questions: 'Please clarify the submitted hours' });

        expect(res.status).toBe(200);
        expect(res.body.docket.status).toBe('queried');
      } finally {
        await prisma.notification.deleteMany({ where: { projectId } });
        await prisma.projectUser.deleteMany({ where: { projectId, userId: tempUserId } });
        await prisma.dailyDocket.delete({ where: { id: docket.id } }).catch(() => {});
        await prisma.emailVerificationToken.deleteMany({ where: { userId: tempUserId } });
        await prisma.user.delete({ where: { id: tempUserId } }).catch(() => {});
      }
    });
  });
});
