import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { authRouter } from './auth.js';
import { prisma } from '../lib/prisma.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { registerTestUser } from '../test/routeTestHarness.js';

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
    const adminUser = await registerTestUser(app, {
      emailPrefix: 'dockets-admin',
      fullName: 'Dockets Admin',
      companyId,
      roleInCompany: 'site_manager',
    });
    authToken = adminUser.token;
    userId = adminUser.userId;

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
      data: { companyId: null, roleInCompany: 'subcontractor' },
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

    it('should reject docket creation when the project is archived', async () => {
      const initialDocketCount = await prisma.dailyDocket.count({ where: { projectId } });

      await prisma.project.update({
        where: { id: projectId },
        data: { status: 'archived' },
      });

      try {
        const res = await request(app)
          .post('/api/dockets')
          .set('Authorization', `Bearer ${subcontractorToken}`)
          .send({
            projectId,
            date: '2031-06-21',
            notes: 'Should not be created on archived project',
          });

        expect(res.status).toBe(409);
        expect(res.body.error.message).toContain('Archived projects are read-only');
        await expect(prisma.dailyDocket.count({ where: { projectId } })).resolves.toBe(
          initialDocketCount,
        );
      } finally {
        await prisma.project.update({
          where: { id: projectId },
          data: { status: 'active' },
        });
      }
    });

    it('rejects company-linked stale subcontractor roles even with old links', async () => {
      const staleUser = await registerTestUser(app, {
        emailPrefix: 'dockets-stale-subcontractor',
        fullName: 'Dockets Stale Subcontractor',
        companyId,
        roleInCompany: 'subcontractor',
      });
      const staleDocket = await prisma.dailyDocket.create({
        data: {
          projectId,
          subcontractorCompanyId,
          date: new Date('2031-06-22T00:00:00.000Z'),
          status: 'draft',
          notes: 'Stale identity should not read or submit this docket',
        },
      });

      try {
        await prisma.subcontractorUser.create({
          data: {
            userId: staleUser.userId,
            subcontractorCompanyId,
            role: 'admin',
          },
        });
        await prisma.projectUser.create({
          data: {
            projectId,
            userId: staleUser.userId,
            role: 'project_manager',
            status: 'active',
          },
        });

        const createRes = await request(app)
          .post('/api/dockets')
          .set('Authorization', `Bearer ${staleUser.token}`)
          .send({
            projectId,
            date: '2031-06-23',
            notes: 'Stale subcontractor create attempt',
          });
        expect(createRes.status).toBe(403);

        const listRes = await request(app)
          .get(`/api/dockets?projectId=${projectId}`)
          .set('Authorization', `Bearer ${staleUser.token}`);
        expect(listRes.status).toBe(403);

        const detailRes = await request(app)
          .get(`/api/dockets/${staleDocket.id}`)
          .set('Authorization', `Bearer ${staleUser.token}`);
        expect(detailRes.status).toBe(403);

        const submitRes = await request(app)
          .post(`/api/dockets/${staleDocket.id}/submit`)
          .set('Authorization', `Bearer ${staleUser.token}`);
        expect(submitRes.status).toBe(403);
      } finally {
        await prisma.dailyDocket.delete({ where: { id: staleDocket.id } }).catch(() => {});
        await prisma.projectUser.deleteMany({ where: { projectId, userId: staleUser.userId } });
        await prisma.subcontractorUser.deleteMany({ where: { userId: staleUser.userId } });
        await prisma.emailVerificationToken.deleteMany({ where: { userId: staleUser.userId } });
        await prisma.user.delete({ where: { id: staleUser.userId } }).catch(() => {});
      }
    });

    it('ignores legacy create-hour fields and never seeds submitted-cost columns with hours', async () => {
      const date = '2031-05-21';
      let createdDocketId: string | undefined;

      try {
        const res = await request(app)
          .post('/api/dockets')
          .set('Authorization', `Bearer ${subcontractorToken}`)
          .send({
            projectId,
            date,
            labourHours: 3.25,
            plantHours: 2,
            notes: 'Offline-created docket',
          });

        expect(res.status).toBe(201);
        createdDocketId = res.body.docket.id;
        // totalLabourSubmitted/totalPlantSubmitted are dollar COSTS (see
        // refreshLabourSubmittedTotals), not hours, and are recomputed from
        // entries. A freshly created docket has no entries, so both the public
        // hour fields and persisted cost columns must start at zero.
        expect(res.body.docket.labourHours).toBe(0);
        expect(res.body.docket.plantHours).toBe(0);
        expect(res.body.docket.totalLabourSubmitted).toBe(0);
        expect(res.body.docket.totalPlantSubmitted).toBe(0);

        const stored = await prisma.dailyDocket.findUnique({
          where: { id: createdDocketId },
          select: { totalLabourSubmitted: true, totalPlantSubmitted: true },
        });
        expect(Number(stored?.totalLabourSubmitted)).toBe(0);
        expect(Number(stored?.totalPlantSubmitted)).toBe(0);
      } finally {
        if (createdDocketId) {
          await prisma.dailyDocket.delete({ where: { id: createdDocketId } }).catch(() => {});
        }
      }
    });

    it('should reject duplicate daily dockets for the same subcontractor and date', async () => {
      const date = '2031-05-20';
      let createdDocketId: string | undefined;

      try {
        const firstRes = await request(app)
          .post('/api/dockets')
          .set('Authorization', `Bearer ${subcontractorToken}`)
          .send({
            projectId,
            date: `${date}T13:45:00+10:00`,
            notes: 'First docket for the day',
          });

        expect(firstRes.status).toBe(201);
        createdDocketId = firstRes.body.docket.id;

        const duplicateRes = await request(app)
          .post('/api/dockets')
          .set('Authorization', `Bearer ${subcontractorToken}`)
          .send({
            projectId,
            date,
            notes: 'Duplicate docket for the same day',
          });

        expect(duplicateRes.status).toBe(409);
        expect(duplicateRes.body.error.message).toContain('already exists');

        const storedForDate = await prisma.dailyDocket.findMany({
          where: {
            projectId,
            subcontractorCompanyId,
            date: new Date('2031-05-20T00:00:00.000Z'),
          },
        });
        expect(storedForDate).toHaveLength(1);
      } finally {
        if (createdDocketId) {
          await prisma.dailyDocket.delete({ where: { id: createdDocketId } }).catch(() => {});
        }
      }
    });

    it('creates dockets for the selected linked subcontractor company in the same project', async () => {
      const suffix = Date.now();
      const date = '2031-07-01';
      const otherSubcontractorCompany = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `Second Linked Docket Subcontractor ${suffix}`,
          primaryContactName: 'Second Linked Contact',
          primaryContactEmail: `second-linked-docket-${suffix}@example.com`,
          status: 'approved',
        },
      });
      const primaryDocket = await prisma.dailyDocket.create({
        data: {
          projectId,
          subcontractorCompanyId,
          date: new Date(`${date}T00:00:00.000Z`),
          status: 'draft',
          notes: 'Existing primary company docket',
        },
      });
      let createdDocketId: string | undefined;

      await prisma.subcontractorUser.create({
        data: {
          userId: subcontractorUserId,
          subcontractorCompanyId: otherSubcontractorCompany.id,
          role: 'admin',
        },
      });

      try {
        const ambiguousRes = await request(app)
          .post('/api/dockets')
          .set('Authorization', `Bearer ${subcontractorToken}`)
          .send({
            projectId,
            date: '2031-07-02',
            notes: 'Ambiguous same-project docket',
          });
        expect(ambiguousRes.status).toBe(400);
        expect(ambiguousRes.body.error.message).toContain('subcontractorCompanyId is required');

        const res = await request(app)
          .post('/api/dockets')
          .set('Authorization', `Bearer ${subcontractorToken}`)
          .send({
            projectId,
            subcontractorCompanyId: otherSubcontractorCompany.id,
            date,
            notes: 'Selected second company docket',
          });

        expect(res.status).toBe(201);
        createdDocketId = res.body.docket.id;
        const stored = await prisma.dailyDocket.findUniqueOrThrow({
          where: { id: createdDocketId },
          select: { subcontractorCompanyId: true },
        });
        expect(stored.subcontractorCompanyId).toBe(otherSubcontractorCompany.id);
        await expect(
          prisma.dailyDocket.count({
            where: {
              projectId,
              date: new Date(`${date}T00:00:00.000Z`),
            },
          }),
        ).resolves.toBe(2);
      } finally {
        if (createdDocketId) {
          await prisma.dailyDocket.delete({ where: { id: createdDocketId } }).catch(() => {});
        }
        await prisma.dailyDocket.delete({ where: { id: primaryDocket.id } }).catch(() => {});
        await prisma.subcontractorUser.deleteMany({
          where: { subcontractorCompanyId: otherSubcontractorCompany.id },
        });
        await prisma.subcontractorCompany
          .delete({ where: { id: otherSubcontractorCompany.id } })
          .catch(() => {});
      }
    });

    it('should enforce daily docket uniqueness at the database layer', async () => {
      const docketDate = new Date('2031-05-21T00:00:00.000Z');

      try {
        await prisma.dailyDocket.create({
          data: {
            projectId,
            subcontractorCompanyId,
            date: docketDate,
            status: 'draft',
            notes: 'First database-level docket',
          },
        });

        await expect(
          prisma.dailyDocket.create({
            data: {
              projectId,
              subcontractorCompanyId,
              date: docketDate,
              status: 'draft',
              notes: 'Duplicate database-level docket',
            },
          }),
        ).rejects.toMatchObject({ code: 'P2002' });

        await expect(
          prisma.dailyDocket.count({
            where: {
              projectId,
              subcontractorCompanyId,
              date: docketDate,
            },
          }),
        ).resolves.toBe(1);
      } finally {
        await prisma.dailyDocket.deleteMany({
          where: {
            projectId,
            subcontractorCompanyId,
            date: docketDate,
          },
        });
      }
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

    it('lists dockets for every linked subcontractor company in the project', async () => {
      const suffix = Date.now();
      const otherSubcontractorCompany = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `Second Listed Docket Subcontractor ${suffix}`,
          primaryContactName: 'Second Listed Contact',
          primaryContactEmail: `second-listed-docket-${suffix}@example.com`,
          status: 'approved',
        },
      });
      const ownDocket = await prisma.dailyDocket.create({
        data: {
          projectId,
          subcontractorCompanyId,
          date: new Date('2031-08-01T00:00:00.000Z'),
          status: 'draft',
        },
      });
      const otherDocket = await prisma.dailyDocket.create({
        data: {
          projectId,
          subcontractorCompanyId: otherSubcontractorCompany.id,
          date: new Date('2031-08-02T00:00:00.000Z'),
          status: 'draft',
        },
      });

      await prisma.subcontractorUser.create({
        data: {
          userId: subcontractorUserId,
          subcontractorCompanyId: otherSubcontractorCompany.id,
          role: 'admin',
        },
      });

      try {
        const res = await request(app)
          .get(`/api/dockets?projectId=${projectId}&limit=100`)
          .set('Authorization', `Bearer ${subcontractorToken}`);

        expect(res.status).toBe(200);
        const returnedIds = (res.body.dockets as Array<{ id: string }>).map((docket) => docket.id);
        expect(returnedIds).toContain(ownDocket.id);
        expect(returnedIds).toContain(otherDocket.id);

        const scopedRes = await request(app)
          .get(
            `/api/dockets?projectId=${projectId}&subcontractorCompanyId=${otherSubcontractorCompany.id}&limit=100`,
          )
          .set('Authorization', `Bearer ${subcontractorToken}`);

        expect(scopedRes.status).toBe(200);
        const scopedIds = (scopedRes.body.dockets as Array<{ id: string }>).map(
          (docket) => docket.id,
        );
        expect(scopedIds).toContain(otherDocket.id);
        expect(scopedIds).not.toContain(ownDocket.id);
      } finally {
        await prisma.dailyDocket.delete({ where: { id: otherDocket.id } }).catch(() => {});
        await prisma.dailyDocket.delete({ where: { id: ownDocket.id } }).catch(() => {});
        await prisma.subcontractorUser.deleteMany({
          where: { subcontractorCompanyId: otherSubcontractorCompany.id },
        });
        await prisma.subcontractorCompany
          .delete({ where: { id: otherSubcontractorCompany.id } })
          .catch(() => {});
      }
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

    it('should hide foreman diary comparison from subcontractor docket detail', async () => {
      const date = new Date(Date.now() + 1000 * 60 * 60 * 24 * 3650);
      const docket = await prisma.dailyDocket.create({
        data: {
          projectId,
          subcontractorCompanyId,
          date,
          status: 'draft',
          notes: 'Subcontractor-visible docket',
        },
      });
      await prisma.docketLabour.create({
        data: {
          docketId: docket.id,
          employeeId,
          startTime: '07:00',
          finishTime: '15:00',
          submittedHours: 8,
          hourlyRate: 45.5,
          submittedCost: 364,
          lotAllocations: {
            create: {
              lotId: assignedLotId,
              hours: 8,
            },
          },
        },
      });
      await prisma.docketPlant.create({
        data: {
          docketId: docket.id,
          plantId,
          hoursOperated: 4,
          wetOrDry: 'dry',
          hourlyRate: 150,
          submittedCost: 600,
          lotAllocations: {
            create: {
              lotId: assignedLotId,
              hours: 4,
            },
          },
        },
      });
      const diary = await prisma.dailyDiary.create({
        data: {
          projectId,
          date,
          status: 'draft',
          weatherConditions: 'Rain',
          personnel: {
            create: [
              { name: 'Head contractor worker', company: 'Head contractor', role: 'Supervisor' },
              { name: 'Other crew member', company: 'Other subcontractor', role: 'Labourer' },
            ],
          },
          plant: {
            create: [
              { description: 'Grader', idRego: 'GR-001' },
              { description: 'Roller', idRego: 'RO-001' },
            ],
          },
          activities: {
            create: [{ description: 'Bulk earthworks', lotId: assignedLotId }],
          },
          delays: {
            create: [{ delayType: 'weather', durationHours: 2, description: 'Rain delay' }],
          },
        },
      });

      try {
        const subcontractorRes = await request(app)
          .get(`/api/dockets/${docket.id}`)
          .set('Authorization', `Bearer ${subcontractorToken}`);

        expect(subcontractorRes.status).toBe(200);
        expect(subcontractorRes.body.docket.id).toBe(docket.id);
        expect(subcontractorRes.body.foremanDiary).toBeNull();
        expect(subcontractorRes.body.discrepancies).toBeNull();

        const headContractorRes = await request(app)
          .get(`/api/dockets/${docket.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(headContractorRes.status).toBe(200);
        expect(headContractorRes.body.foremanDiary).toMatchObject({
          personnelCount: 2,
          plantCount: 2,
          activitiesCount: 1,
          weatherConditions: 'Rain',
          weatherHoursLost: 2,
        });
        expect(headContractorRes.body.discrepancies).toEqual(
          expect.arrayContaining([
            'Personnel count may differ: docket has 1 entries, diary has 2',
            'Plant/equipment count may differ: docket has 1 entries, diary has 2',
            'Weather hours lost noted in diary: 2 hours',
          ]),
        );
      } finally {
        await prisma.dailyDiary.delete({ where: { id: diary.id } }).catch(() => {});
        await prisma.dailyDocket.delete({ where: { id: docket.id } }).catch(() => {});
      }
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

    it('should recalculate labour hours and submitted total on one-sided time updates', async () => {
      const docket = await prisma.dailyDocket.create({
        data: {
          projectId,
          subcontractorCompanyId,
          date: new Date(Date.now() + 1296000000),
          status: 'draft',
          totalLabourSubmitted: 364,
        },
      });
      const labourEntry = await prisma.docketLabour.create({
        data: {
          docketId: docket.id,
          employeeId,
          startTime: '07:00',
          finishTime: '15:00',
          submittedHours: 8,
          hourlyRate: 45.5,
          submittedCost: 364,
        },
      });

      try {
        const res = await request(app)
          .put(`/api/dockets/${docket.id}/labour/${labourEntry.id}`)
          .set('Authorization', `Bearer ${subcontractorToken}`)
          .send({ finishTime: '12:00' });

        expect(res.status).toBe(200);
        expect(res.body.labourEntry).toMatchObject({
          startTime: '07:00',
          finishTime: '12:00',
          submittedHours: 5,
          submittedCost: 227.5,
        });

        const stored = await prisma.dailyDocket.findUniqueOrThrow({
          where: { id: docket.id },
          select: { totalLabourSubmitted: true },
        });
        expect(Number(stored.totalLabourSubmitted)).toBe(227.5);
      } finally {
        await prisma.docketLabour.deleteMany({ where: { docketId: docket.id } });
        await prisma.dailyDocket.delete({ where: { id: docket.id } }).catch(() => {});
      }
    });

    it('should reject reduced labour hours when existing lot allocations exceed the new entry hours', async () => {
      const docket = await prisma.dailyDocket.create({
        data: {
          projectId,
          subcontractorCompanyId,
          date: new Date(Date.now() + 1382400000),
          status: 'draft',
          totalLabourSubmitted: 364,
        },
      });
      const labourEntry = await prisma.docketLabour.create({
        data: {
          docketId: docket.id,
          employeeId,
          startTime: '07:00',
          finishTime: '15:00',
          submittedHours: 8,
          hourlyRate: 45.5,
          submittedCost: 364,
          lotAllocations: { create: [{ lotId: assignedLotId, hours: 8 }] },
        },
      });

      try {
        const res = await request(app)
          .put(`/api/dockets/${docket.id}/labour/${labourEntry.id}`)
          .set('Authorization', `Bearer ${subcontractorToken}`)
          .send({ finishTime: '12:00' });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('Lot allocation hours');
        const stored = await prisma.docketLabour.findUniqueOrThrow({
          where: { id: labourEntry.id },
          select: { startTime: true, finishTime: true, submittedHours: true, submittedCost: true },
        });
        expect(stored).toMatchObject({ startTime: '07:00', finishTime: '15:00' });
        expect(Number(stored.submittedHours)).toBe(8);
        expect(Number(stored.submittedCost)).toBe(364);
      } finally {
        await prisma.docketLabourLot.deleteMany({ where: { docketLabourId: labourEntry.id } });
        await prisma.docketLabour.deleteMany({ where: { docketId: docket.id } });
        await prisma.dailyDocket.delete({ where: { id: docket.id } }).catch(() => {});
      }
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

    it('should reject adding labour for a roster employee that is not approved', async () => {
      const docket = await prisma.dailyDocket.create({
        data: {
          projectId,
          subcontractorCompanyId,
          date: new Date(),
          status: 'draft',
        },
      });
      const pendingEmployee = await prisma.employeeRoster.create({
        data: {
          subcontractorCompanyId,
          name: 'Pending Worker',
          role: 'Operator',
          hourlyRate: 999,
          status: 'pending',
        },
      });
      const beforeCount = await prisma.docketLabour.count({ where: { docketId: docket.id } });

      const res = await request(app)
        .post(`/api/dockets/${docket.id}/labour`)
        .set('Authorization', `Bearer ${subcontractorToken}`)
        .send({
          employeeId: pendingEmployee.id,
          startTime: '07:00',
          finishTime: '15:00',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('approved');
      expect(await prisma.docketLabour.count({ where: { docketId: docket.id } })).toBe(beforeCount);
    });

    it('should reject updating labour when the roster employee is no longer approved', async () => {
      const docket = await prisma.dailyDocket.create({
        data: {
          projectId,
          subcontractorCompanyId,
          date: new Date(),
          status: 'draft',
        },
      });
      const labourEntry = await prisma.docketLabour.create({
        data: {
          docketId: docket.id,
          employeeId,
          startTime: '07:00',
          finishTime: '15:00',
          submittedHours: 8,
          hourlyRate: 45.5,
          submittedCost: 364,
        },
      });
      await prisma.employeeRoster.update({
        where: { id: employeeId },
        data: { status: 'pending' },
      });

      try {
        const res = await request(app)
          .put(`/api/dockets/${docket.id}/labour/${labourEntry.id}`)
          .set('Authorization', `Bearer ${subcontractorToken}`)
          .send({
            startTime: '06:00',
            finishTime: '18:00',
          });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('approved');
        await expect(
          prisma.docketLabour.findUnique({
            where: { id: labourEntry.id },
            select: { startTime: true, finishTime: true, submittedHours: true },
          }),
        ).resolves.toMatchObject({
          startTime: '07:00',
          finishTime: '15:00',
        });
      } finally {
        await prisma.employeeRoster.update({
          where: { id: employeeId },
          data: { status: 'approved' },
        });
      }
    });

    it('should preserve totals when labour entries are added concurrently', async () => {
      const docket = await prisma.dailyDocket.create({
        data: {
          projectId,
          subcontractorCompanyId,
          date: new Date(Date.now() + 950400000),
          status: 'draft',
        },
      });

      let middlewareActive = true;
      let matchingTotalUpdates = 0;
      let firstTotalUpdateReached: () => void = () => {};
      let secondTotalUpdateFinished: () => void = () => {};
      let releaseFirstTotalUpdate: () => void = () => {};
      const firstTotalUpdateStarted = new Promise<void>((resolve) => {
        firstTotalUpdateReached = resolve;
      });
      const secondTotalUpdateDone = new Promise<void>((resolve) => {
        secondTotalUpdateFinished = resolve;
      });
      const releaseFirstUpdate = new Promise<void>((resolve) => {
        releaseFirstTotalUpdate = resolve;
      });

      prisma.$use(async (params, next) => {
        const data = params.args?.data as { totalLabourSubmitted?: number } | undefined;
        const where = params.args?.where as { id?: string } | undefined;

        if (
          middlewareActive &&
          params.model === 'DailyDocket' &&
          params.action === 'update' &&
          where?.id === docket.id &&
          data?.totalLabourSubmitted !== undefined
        ) {
          matchingTotalUpdates += 1;

          if (matchingTotalUpdates === 1) {
            firstTotalUpdateReached();
            await releaseFirstUpdate;
            return next(params);
          }

          const result = await next(params);
          secondTotalUpdateFinished();
          return result;
        }

        return next(params);
      });

      try {
        const firstRequest = request(app)
          .post(`/api/dockets/${docket.id}/labour`)
          .set('Authorization', `Bearer ${subcontractorToken}`)
          .send({
            employeeId,
            startTime: '07:00',
            finishTime: '08:00',
          });
        const firstResponsePromise = firstRequest.then((res) => res);

        await firstTotalUpdateStarted;

        const secondRequest = request(app)
          .post(`/api/dockets/${docket.id}/labour`)
          .set('Authorization', `Bearer ${subcontractorToken}`)
          .send({
            employeeId,
            startTime: '08:00',
            finishTime: '10:00',
          });
        const secondResponsePromise = secondRequest.then((res) => res);

        await Promise.race([
          secondTotalUpdateDone,
          new Promise<void>((resolve) => setTimeout(resolve, 2000)),
        ]);
        releaseFirstTotalUpdate();

        const [firstRes, secondRes] = await Promise.all([
          firstResponsePromise,
          secondResponsePromise,
        ]);

        expect(firstRes.status).toBe(201);
        expect(secondRes.status).toBe(201);

        const storedDocket = await prisma.dailyDocket.findUniqueOrThrow({
          where: { id: docket.id },
          select: { totalLabourSubmitted: true },
        });
        const labourAggregate = await prisma.docketLabour.aggregate({
          where: { docketId: docket.id },
          _sum: { submittedCost: true },
        });

        expect(Number(storedDocket.totalLabourSubmitted)).toBe(
          Number(labourAggregate._sum.submittedCost),
        );
        expect(Number(storedDocket.totalLabourSubmitted)).toBe(136.5);
      } finally {
        middlewareActive = false;
        releaseFirstTotalUpdate();
        await prisma.docketLabourLot.deleteMany({
          where: { docketLabour: { docketId: docket.id } },
        });
        await prisma.docketLabour.deleteMany({ where: { docketId: docket.id } });
        await prisma.dailyDocket.delete({ where: { id: docket.id } }).catch(() => {});
      }
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

    it('should reject adding plant for register equipment that is not approved', async () => {
      const docket = await prisma.dailyDocket.create({
        data: {
          projectId,
          subcontractorCompanyId,
          date: new Date(),
          status: 'draft',
        },
      });
      const pendingPlant = await prisma.plantRegister.create({
        data: {
          subcontractorCompanyId,
          type: 'Crane',
          description: 'Pending high-rate crane',
          idRego: 'PENDING-001',
          dryRate: 1200,
          wetRate: 1500,
          status: 'pending',
        },
      });
      const beforeCount = await prisma.docketPlant.count({ where: { docketId: docket.id } });

      const res = await request(app)
        .post(`/api/dockets/${docket.id}/plant`)
        .set('Authorization', `Bearer ${subcontractorToken}`)
        .send({
          plantId: pendingPlant.id,
          hoursOperated: 8,
          wetOrDry: 'dry',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('approved');
      expect(await prisma.docketPlant.count({ where: { docketId: docket.id } })).toBe(beforeCount);
    });

    it('should reject updating plant when the register equipment is no longer approved', async () => {
      const docket = await prisma.dailyDocket.create({
        data: {
          projectId,
          subcontractorCompanyId,
          date: new Date(),
          status: 'draft',
        },
      });
      const plantEntry = await prisma.docketPlant.create({
        data: {
          docketId: docket.id,
          plantId,
          hoursOperated: 8,
          wetOrDry: 'dry',
          hourlyRate: 150,
          submittedCost: 1200,
        },
      });
      await prisma.plantRegister.update({
        where: { id: plantId },
        data: { status: 'pending' },
      });

      try {
        const res = await request(app)
          .put(`/api/dockets/${docket.id}/plant/${plantEntry.id}`)
          .set('Authorization', `Bearer ${subcontractorToken}`)
          .send({
            hoursOperated: 12,
            wetOrDry: 'wet',
          });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('approved');
        await expect(
          prisma.docketPlant.findUnique({
            where: { id: plantEntry.id },
            select: { hoursOperated: true, wetOrDry: true, submittedCost: true },
          }),
        ).resolves.toMatchObject({
          wetOrDry: 'dry',
        });
      } finally {
        await prisma.plantRegister.update({
          where: { id: plantId },
          data: { status: 'approved' },
        });
      }
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
      const qualityEmail = `dockets-quality-approver-${Date.now()}@example.com`;
      const qualityRes = await request(app).post('/api/auth/register').send({
        email: qualityEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Quality Docket Approver',
        tosAccepted: true,
      });
      const qualityUserId = qualityRes.body.user.id;

      await prisma.user.update({
        where: { id: pendingUserId },
        data: { companyId, roleInCompany: 'project_manager' },
      });
      await prisma.user.update({
        where: { id: qualityUserId },
        data: { companyId, roleInCompany: 'quality_manager' },
      });
      await prisma.projectUser.create({
        data: { projectId, userId: pendingUserId, role: 'project_manager', status: 'pending' },
      });
      await prisma.projectUser.create({
        data: { projectId, userId: qualityUserId, role: 'quality_manager', status: 'active' },
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

        const qualityNotification = await prisma.notification.findFirst({
          where: {
            projectId,
            userId: qualityUserId,
            type: 'docket_pending',
          },
        });
        expect(qualityNotification).toBeTruthy();

        const auditLog = await prisma.auditLog.findFirst({
          where: {
            projectId,
            userId: subcontractorUserId,
            entityType: 'daily_docket',
            entityId: submittableDocketId,
            action: 'docket_submitted',
          },
        });
        expect(auditLog).toBeTruthy();
        expect(auditLog?.changes ? JSON.parse(auditLog.changes) : null).toMatchObject({
          status: { from: 'draft', to: 'pending_approval' },
        });
      } finally {
        await prisma.projectUser.deleteMany({
          where: { userId: { in: [pendingUserId, qualityUserId] } },
        });
        await prisma.notification.deleteMany({ where: { userId: qualityUserId } });
        await prisma.emailVerificationToken.deleteMany({
          where: { userId: { in: [pendingUserId, qualityUserId] } },
        });
        await prisma.user.delete({ where: { id: pendingUserId } }).catch(() => {});
        await prisma.user.delete({ where: { id: qualityUserId } }).catch(() => {});
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

    async function createCostedPendingDocket(dateOffsetMs: number) {
      const docket = await prisma.dailyDocket.create({
        data: {
          projectId,
          subcontractorCompanyId,
          date: new Date(Date.now() + dateOffsetMs),
          status: 'pending_approval',
          submittedAt: new Date(),
          totalLabourSubmitted: 364,
          totalPlantSubmitted: 450,
        },
      });
      const labour = await prisma.docketLabour.create({
        data: {
          docketId: docket.id,
          employeeId,
          startTime: '06:30',
          finishTime: '14:30',
          submittedHours: 8,
          hourlyRate: 45.5,
          submittedCost: 364,
          lotAllocations: {
            create: {
              lotId: assignedLotId,
              hours: 8,
            },
          },
        },
      });
      const plantEntry = await prisma.docketPlant.create({
        data: {
          docketId: docket.id,
          plantId,
          hoursOperated: 3,
          hourlyRate: 150,
          submittedCost: 450,
          lotAllocations: {
            create: {
              lotId: assignedLotId,
              hours: 3,
            },
          },
        },
      });
      return { docket, labour, plantEntry };
    }

    async function deleteCostedPendingDocket({
      docket,
      labour,
      plantEntry,
    }: Awaited<ReturnType<typeof createCostedPendingDocket>>) {
      await prisma.docketLabourLot.deleteMany({ where: { docketLabourId: labour.id } });
      await prisma.docketPlantLot.deleteMany({ where: { docketPlantId: plantEntry.id } });
      await prisma.docketLabour.deleteMany({ where: { docketId: docket.id } });
      await prisma.docketPlant.deleteMany({ where: { docketId: docket.id } });
      await prisma.dailyDocket.delete({ where: { id: docket.id } }).catch(() => {});
    }

    it('should approve docket when optional approval text fields are null', async () => {
      const nullableApprovalDocket = await prisma.dailyDocket.create({
        data: {
          projectId,
          subcontractorCompanyId,
          date: new Date(Date.now() + 777600000),
          status: 'pending_approval',
          submittedAt: new Date(),
          totalLabourSubmitted: 8,
          totalPlantSubmitted: 0,
        },
      });

      const res = await request(app)
        .post(`/api/dockets/${nullableApprovalDocket.id}/approve`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          foremanNotes: null,
          adjustmentReason: null,
        });

      expect(res.status).toBe(200);
      expect(res.body.docket.status).toBe('approved');

      const stored = await prisma.dailyDocket.findUnique({
        where: { id: nullableApprovalDocket.id },
      });
      expect(stored?.foremanNotes).toBeNull();
      expect(stored?.adjustmentReason).toBeNull();
    });

    it('should fall back to submitted entry hours, not submitted costs, when approving without adjustments', async () => {
      const costedDocket = await createCostedPendingDocket(1_296_000_000);
      const { docket, labour, plantEntry } = costedDocket;

      try {
        const res = await request(app)
          .post(`/api/dockets/${docket.id}/approve`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ foremanNotes: 'Approve with submitted hours' });

        expect(res.status).toBe(200);

        const stored = await prisma.dailyDocket.findUniqueOrThrow({
          where: { id: docket.id },
          select: {
            totalLabourApproved: true,
            totalPlantApproved: true,
            totalLabourApprovedCost: true,
            totalPlantApprovedCost: true,
          },
        });
        expect(Number(stored.totalLabourApproved)).toBe(8);
        expect(Number(stored.totalPlantApproved)).toBe(3);
        expect(Number(stored.totalLabourApprovedCost)).toBe(364);
        expect(Number(stored.totalPlantApprovedCost)).toBe(450);

        const approvedLabour = await prisma.docketLabour.findUniqueOrThrow({
          where: { id: labour.id },
          select: { approvedHours: true, approvedCost: true },
        });
        const approvedPlant = await prisma.docketPlant.findUniqueOrThrow({
          where: { id: plantEntry.id },
          select: { approvedCost: true },
        });
        expect(Number(approvedLabour.approvedHours)).toBe(8);
        expect(Number(approvedLabour.approvedCost)).toBe(364);
        expect(Number(approvedPlant.approvedCost)).toBe(450);
      } finally {
        await deleteCostedPendingDocket(costedDocket);
      }
    });

    it('should accept unchanged adjusted-hour payloads without requiring an adjustment reason', async () => {
      const costedDocket = await createCostedPendingDocket(1_339_200_000);
      const { docket } = costedDocket;

      try {
        const res = await request(app)
          .post(`/api/dockets/${docket.id}/approve`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            foremanNotes: 'Approve unchanged default modal values',
            adjustedLabourHours: 8,
            adjustedPlantHours: 3,
            adjustmentReason: null,
          });

        expect(res.status).toBe(200);

        const stored = await prisma.dailyDocket.findUniqueOrThrow({
          where: { id: docket.id },
          select: {
            status: true,
            adjustmentReason: true,
            totalLabourApproved: true,
            totalPlantApproved: true,
          },
        });
        expect(stored.status).toBe('approved');
        expect(stored.adjustmentReason).toBeNull();
        expect(Number(stored.totalLabourApproved)).toBe(8);
        expect(Number(stored.totalPlantApproved)).toBe(3);
      } finally {
        await deleteCostedPendingDocket(costedDocket);
      }
    });

    it('should require an adjustment reason when adjusted approval hours differ from submitted totals', async () => {
      const costedDocket = await createCostedPendingDocket(1_360_800_000);
      const { docket } = costedDocket;

      try {
        const res = await request(app)
          .post(`/api/dockets/${docket.id}/approve`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            adjustedLabourHours: 7,
            adjustedPlantHours: 3,
            adjustmentReason: null,
          });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toBe(
          'Adjustment reason is required when approving adjusted hours',
        );

        const stored = await prisma.dailyDocket.findUniqueOrThrow({
          where: { id: docket.id },
          select: { status: true, approvedAt: true },
        });
        expect(stored.status).toBe('pending_approval');
        expect(stored.approvedAt).toBeNull();
      } finally {
        await deleteCostedPendingDocket(costedDocket);
      }
    });

    it('should calculate approved entry costs from adjusted approval hours', async () => {
      const costedDocket = await createCostedPendingDocket(1_382_400_000);
      const { docket, labour, plantEntry } = costedDocket;

      try {
        const res = await request(app)
          .post(`/api/dockets/${docket.id}/approve`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            adjustedLabourHours: 7,
            adjustedPlantHours: 2.5,
            adjustmentReason: 'Approved less time after review',
          });

        expect(res.status).toBe(200);

        const stored = await prisma.dailyDocket.findUniqueOrThrow({
          where: { id: docket.id },
          select: {
            totalLabourApproved: true,
            totalPlantApproved: true,
            totalLabourApprovedCost: true,
            totalPlantApprovedCost: true,
          },
        });
        expect(Number(stored.totalLabourApproved)).toBe(7);
        expect(Number(stored.totalPlantApproved)).toBe(2.5);
        expect(Number(stored.totalLabourApprovedCost)).toBe(318.5);
        expect(Number(stored.totalPlantApprovedCost)).toBe(375);

        const approvedLabour = await prisma.docketLabour.findUniqueOrThrow({
          where: { id: labour.id },
          select: { approvedHours: true, approvedCost: true, adjustmentReason: true },
        });
        const approvedPlant = await prisma.docketPlant.findUniqueOrThrow({
          where: { id: plantEntry.id },
          select: { approvedCost: true, adjustmentReason: true },
        });

        expect(Number(approvedLabour.approvedHours)).toBe(7);
        expect(Number(approvedLabour.approvedCost)).toBe(318.5);
        expect(approvedLabour.adjustmentReason).toBe('Approved less time after review');
        expect(Number(approvedPlant.approvedCost)).toBe(375);
        expect(approvedPlant.adjustmentReason).toBe('Approved less time after review');
      } finally {
        await deleteCostedPendingDocket(costedDocket);
      }
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

      const auditLog = await prisma.auditLog.findFirst({
        where: {
          projectId,
          userId,
          entityType: 'daily_docket',
          entityId: submittableDocketId,
          action: 'docket_approved',
        },
      });
      expect(auditLog).toBeTruthy();
      expect(auditLog?.changes ? JSON.parse(auditLog.changes) : null).toMatchObject({
        status: { from: 'pending_approval', to: 'approved' },
        foremanNotes: 'Looks good',
      });
    });

    it('should return a diary sync warning when a locked draft diary prevents auto-population', async () => {
      const date = new Date(Date.now() + 950400000);
      const docket = await prisma.dailyDocket.create({
        data: {
          projectId,
          subcontractorCompanyId,
          date,
          status: 'pending_approval',
          submittedAt: new Date(),
        },
      });
      const diary = await prisma.dailyDiary.create({
        data: {
          projectId,
          date,
          status: 'draft',
          lockedAt: new Date(),
        },
      });
      const labour = await prisma.docketLabour.create({
        data: {
          docketId: docket.id,
          employeeId,
          startTime: '06:30',
          finishTime: '14:30',
          submittedHours: 8,
          hourlyRate: 45.5,
          submittedCost: 364,
          lotAllocations: {
            create: {
              lotId: assignedLotId,
              hours: 8,
            },
          },
        },
      });
      const plantEntry = await prisma.docketPlant.create({
        data: {
          docketId: docket.id,
          plantId,
          hoursOperated: 3,
          hourlyRate: 150,
          submittedCost: 450,
          lotAllocations: {
            create: {
              lotId: assignedLotId,
              hours: 3,
            },
          },
        },
      });

      try {
        const res = await request(app)
          .post(`/api/dockets/${docket.id}/approve`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            foremanNotes: 'Approve without mutating locked diary',
          });

        expect(res.status).toBe(200);
        expect(res.body.docket.status).toBe('approved');
        expect(res.body.diarySync).toMatchObject({
          status: 'skipped',
          code: 'DIARY_LOCKED',
        });
        expect(res.body.diarySync.message).toContain('daily diary is locked');
        await expect(prisma.diaryPersonnel.count({ where: { diaryId: diary.id } })).resolves.toBe(
          0,
        );
        await expect(prisma.diaryPlant.count({ where: { diaryId: diary.id } })).resolves.toBe(0);
      } finally {
        await prisma.diaryPersonnel.deleteMany({ where: { diaryId: diary.id } });
        await prisma.diaryPlant.deleteMany({ where: { diaryId: diary.id } });
        await prisma.docketLabourLot.deleteMany({ where: { docketLabourId: labour.id } });
        await prisma.docketPlantLot.deleteMany({ where: { docketPlantId: plantEntry.id } });
        await prisma.docketLabour.deleteMany({ where: { docketId: docket.id } });
        await prisma.docketPlant.deleteMany({ where: { docketId: docket.id } });
        await prisma.dailyDocket.delete({ where: { id: docket.id } }).catch(() => {});
        await prisma.dailyDiary.delete({ where: { id: diary.id } }).catch(() => {});
      }
    });

    it('should auto-populate the diary with approved labour and plant hours when approving a docket', async () => {
      const date = new Date(Date.now() + 1_123_200_000);
      const docket = await prisma.dailyDocket.create({
        data: {
          projectId,
          subcontractorCompanyId,
          date,
          status: 'pending_approval',
          submittedAt: new Date(),
        },
      });
      const labour = await prisma.docketLabour.create({
        data: {
          docketId: docket.id,
          employeeId,
          startTime: '06:30',
          finishTime: '14:30',
          submittedHours: 8,
          hourlyRate: 45.5,
          submittedCost: 364,
          lotAllocations: {
            create: {
              lotId: assignedLotId,
              hours: 8,
            },
          },
        },
      });
      const plantEntry = await prisma.docketPlant.create({
        data: {
          docketId: docket.id,
          plantId,
          hoursOperated: 3,
          hourlyRate: 150,
          submittedCost: 450,
          lotAllocations: {
            create: {
              lotId: assignedLotId,
              hours: 3,
            },
          },
        },
      });
      let diaryId: string | undefined;

      try {
        const res = await request(app)
          .post(`/api/dockets/${docket.id}/approve`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            foremanNotes: 'Approve adjusted hours and populate diary',
            adjustedLabourHours: 7,
            adjustedPlantHours: 2.5,
            adjustmentReason: 'Diary check reduced approved time',
          });

        expect(res.status).toBe(200);
        expect(res.body.docket.status).toBe('approved');

        const diary = await prisma.dailyDiary.findUnique({
          where: { projectId_date: { projectId, date } },
        });
        expect(diary).not.toBeNull();
        diaryId = diary!.id;

        const personnel = await prisma.diaryPersonnel.findMany({ where: { diaryId } });
        expect(personnel).toHaveLength(1);
        expect(personnel[0]).toMatchObject({
          source: 'docket',
          docketId: docket.id,
          lotId: assignedLotId,
        });
        expect(Number(personnel[0].hours)).toBe(7);

        const plantRows = await prisma.diaryPlant.findMany({ where: { diaryId } });
        expect(plantRows).toHaveLength(1);
        expect(plantRows[0]).toMatchObject({
          source: 'docket',
          docketId: docket.id,
          lotId: assignedLotId,
        });
        expect(Number(plantRows[0].hoursOperated)).toBe(2.5);
      } finally {
        if (diaryId) {
          await prisma.diaryPersonnel.deleteMany({ where: { diaryId } });
          await prisma.diaryPlant.deleteMany({ where: { diaryId } });
        }
        await prisma.docketLabourLot.deleteMany({ where: { docketLabourId: labour.id } });
        await prisma.docketPlantLot.deleteMany({ where: { docketPlantId: plantEntry.id } });
        await prisma.docketLabour.deleteMany({ where: { docketId: docket.id } });
        await prisma.docketPlant.deleteMany({ where: { docketId: docket.id } });
        await prisma.dailyDocket.delete({ where: { id: docket.id } }).catch(() => {});
        if (diaryId) {
          await prisma.dailyDiary.delete({ where: { id: diaryId } }).catch(() => {});
        }
      }
    });

    it('should not auto-populate a submitted diary when approving a docket', async () => {
      const date = new Date(Date.now() + 1_036_800_000);
      const docket = await prisma.dailyDocket.create({
        data: {
          projectId,
          subcontractorCompanyId,
          date,
          status: 'pending_approval',
          submittedAt: new Date(),
        },
      });
      const diary = await prisma.dailyDiary.create({
        data: {
          projectId,
          date,
          status: 'submitted',
          submittedAt: new Date(),
          submittedById: userId,
        },
      });
      const labour = await prisma.docketLabour.create({
        data: {
          docketId: docket.id,
          employeeId,
          startTime: '06:30',
          finishTime: '14:30',
          submittedHours: 8,
          hourlyRate: 45.5,
          submittedCost: 364,
          lotAllocations: {
            create: {
              lotId: assignedLotId,
              hours: 8,
            },
          },
        },
      });
      const plantEntry = await prisma.docketPlant.create({
        data: {
          docketId: docket.id,
          plantId,
          hoursOperated: 3,
          hourlyRate: 150,
          submittedCost: 450,
          lotAllocations: {
            create: {
              lotId: assignedLotId,
              hours: 3,
            },
          },
        },
      });

      try {
        const res = await request(app)
          .post(`/api/dockets/${docket.id}/approve`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            foremanNotes: 'Approve without mutating submitted diary',
          });

        expect(res.status).toBe(200);
        expect(res.body.docket.status).toBe('approved');
        await expect(prisma.diaryPersonnel.count({ where: { diaryId: diary.id } })).resolves.toBe(
          0,
        );
        await expect(prisma.diaryPlant.count({ where: { diaryId: diary.id } })).resolves.toBe(0);
      } finally {
        await prisma.diaryPersonnel.deleteMany({ where: { diaryId: diary.id } });
        await prisma.diaryPlant.deleteMany({ where: { diaryId: diary.id } });
        await prisma.docketLabourLot.deleteMany({ where: { docketLabourId: labour.id } });
        await prisma.docketPlantLot.deleteMany({ where: { docketPlantId: plantEntry.id } });
        await prisma.docketLabour.deleteMany({ where: { docketId: docket.id } });
        await prisma.docketPlant.deleteMany({ where: { docketId: docket.id } });
        await prisma.dailyDocket.delete({ where: { id: docket.id } }).catch(() => {});
        await prisma.dailyDiary.delete({ where: { id: diary.id } }).catch(() => {});
      }
    });

    it('should reject approving non-pending docket', async () => {
      const res = await request(app)
        .post(`/api/dockets/${submittableDocketId}/approve`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
    });

    afterAll(async () => {
      await prisma.auditLog.deleteMany({ where: { entityId: submittableDocketId } });
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

      const stored = await prisma.dailyDocket.findUniqueOrThrow({
        where: { id: rejectableDocketId },
        select: { status: true, approvedById: true, approvedAt: true },
      });
      expect(stored.status).toBe('rejected');
      expect(stored.approvedById).toBeNull();
      expect(stored.approvedAt).toBeNull();

      const auditLog = await prisma.auditLog.findFirst({
        where: {
          projectId,
          userId,
          entityType: 'daily_docket',
          entityId: rejectableDocketId,
          action: 'docket_rejected',
        },
      });
      expect(auditLog).toBeTruthy();
      expect(auditLog?.changes ? JSON.parse(auditLog.changes) : null).toMatchObject({
        status: { from: 'pending_approval', to: 'rejected' },
        reason: 'Hours do not match diary',
      });
    });

    it('should reject the API request when rejection reason is null or blank', async () => {
      const nullableRejectDocket = await prisma.dailyDocket.create({
        data: {
          projectId,
          subcontractorCompanyId,
          date: new Date(Date.now() + 1036800000),
          status: 'pending_approval',
          submittedAt: new Date(),
        },
      });

      try {
        const nullReason = await request(app)
          .post(`/api/dockets/${nullableRejectDocket.id}/reject`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ reason: null });

        expect(nullReason.status).toBe(400);

        const blankReason = await request(app)
          .post(`/api/dockets/${nullableRejectDocket.id}/reject`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ reason: '   ' });

        expect(blankReason.status).toBe(400);

        const stored = await prisma.dailyDocket.findUnique({
          where: { id: nullableRejectDocket.id },
        });
        expect(stored?.status).toBe('pending_approval');
        expect(stored?.foremanNotes).toBeNull();
      } finally {
        await prisma.dailyDocket.delete({ where: { id: nullableRejectDocket.id } }).catch(() => {});
      }
    });

    afterAll(async () => {
      await prisma.auditLog.deleteMany({ where: { entityId: rejectableDocketId } });
      await prisma.docketLabourLot.deleteMany({
        where: { docketLabour: { docketId: rejectableDocketId } },
      });
      await prisma.docketLabour.deleteMany({ where: { docketId: rejectableDocketId } });
      await prisma.dailyDocket.delete({ where: { id: rejectableDocketId } }).catch(() => {});
    });
  });

  describe('Docket Query Flow', () => {
    let queryableDocketId: string;

    async function resetQueryableDocketLabourEntry() {
      await prisma.docketLabourLot.deleteMany({
        where: { docketLabour: { docketId: queryableDocketId } },
      });
      await prisma.docketLabour.deleteMany({ where: { docketId: queryableDocketId } });

      return prisma.docketLabour.create({
        data: {
          docketId: queryableDocketId,
          employeeId,
          submittedHours: 8,
          hourlyRate: 45.5,
          submittedCost: 364,
          lotAllocations: {
            create: {
              lotId: assignedLotId,
              hours: 8,
            },
          },
        },
      });
    }

    beforeAll(async () => {
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

      await resetQueryableDocketLabourEntry();
    });

    it('should query docket', async () => {
      await prisma.auditLog.deleteMany({ where: { entityId: queryableDocketId } });

      const res = await request(app)
        .post(`/api/dockets/${queryableDocketId}/query`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          questions: 'What work area was this for?',
        });

      expect(res.status).toBe(200);
      expect(res.body.docket.status).toBe('queried');

      const auditLog = await prisma.auditLog.findFirst({
        where: {
          projectId,
          userId,
          entityType: 'daily_docket',
          entityId: queryableDocketId,
          action: 'docket_queried',
        },
      });
      expect(auditLog).toBeTruthy();
      expect(auditLog?.changes ? JSON.parse(auditLog.changes) : null).toMatchObject({
        status: { from: 'pending_approval', to: 'queried' },
        questionLength: 'What work area was this for?'.length,
      });
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
      await prisma.auditLog.deleteMany({ where: { entityId: queryableDocketId } });
      await resetQueryableDocketLabourEntry();
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

      const auditLog = await prisma.auditLog.findFirst({
        where: {
          projectId,
          userId: subcontractorUserId,
          entityType: 'daily_docket',
          entityId: queryableDocketId,
          action: 'docket_query_responded',
        },
      });
      expect(auditLog).toBeTruthy();
      expect(auditLog?.changes ? JSON.parse(auditLog.changes) : null).toMatchObject({
        status: { from: 'queried', to: 'pending_approval' },
        responseLength: 'This was for the northern section'.length,
      });
    });

    it('should reject query responses when editable labour entries no longer have lot allocations', async () => {
      await resetQueryableDocketLabourEntry();
      await prisma.dailyDocket.update({
        where: { id: queryableDocketId },
        data: { status: 'queried' },
      });
      await prisma.docketLabourLot.deleteMany({
        where: { docketLabour: { docketId: queryableDocketId } },
      });

      const res = await request(app)
        .post(`/api/dockets/${queryableDocketId}/respond`)
        .set('Authorization', `Bearer ${subcontractorToken}`)
        .send({
          response: 'I updated the hours but missed the lot split',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('LOT_REQUIRED');
      await expect(
        prisma.dailyDocket.findUnique({
          where: { id: queryableDocketId },
          select: { status: true },
        }),
      ).resolves.toMatchObject({ status: 'queried' });
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
      expect(res.body.runningTotal).toStrictEqual({ hours: 0, cost: 0 });
      const updatedDocket = await prisma.dailyDocket.findUnique({
        where: { id: deletableDocketId },
        select: { totalLabourSubmitted: true },
      });
      expect(Number(updatedDocket?.totalLabourSubmitted)).toBe(0);
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
      expect(res.body.runningTotal).toStrictEqual({ hours: 0, cost: 0 });
      const updatedDocket = await prisma.dailyDocket.findUnique({
        where: { id: deletableDocketId },
        select: { totalPlantSubmitted: true },
      });
      expect(Number(updatedDocket?.totalPlantSubmitted)).toBe(0);
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
        data: { companyId: null, roleInCompany: 'subcontractor' },
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

    it('should scope former subcontractor users to their linked company dockets', async () => {
      const suffix = Date.now();
      const promotedCompany = await prisma.company.create({
        data: { name: `Former Subcontractor Promoted Company ${suffix}` },
      });
      const otherSubcontractorCompany = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `Other Former Scope Subcontractor ${suffix}`,
          primaryContactName: 'Other Former Scope Contact',
          primaryContactEmail: `other-former-scope-${suffix}@example.com`,
          status: 'approved',
        },
      });
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: `former-docket-sub-${suffix}@example.com`,
          password: 'SecureP@ssword123!',
          fullName: 'Former Docket Subcontractor',
          tosAccepted: true,
        });
      const tempUserId = regRes.body.user.id;
      const ownDocket = await prisma.dailyDocket.create({
        data: {
          projectId,
          subcontractorCompanyId,
          date: new Date(Date.now() + 259200000),
          status: 'draft',
          notes: 'Linked subcontractor docket',
        },
      });
      const otherDocket = await prisma.dailyDocket.create({
        data: {
          projectId,
          subcontractorCompanyId: otherSubcontractorCompany.id,
          date: new Date(Date.now() + 345600000),
          status: 'draft',
          notes: 'Other subcontractor docket',
        },
      });

      await prisma.user.update({
        where: { id: tempUserId },
        data: { companyId: promotedCompany.id, roleInCompany: 'owner' },
      });
      await prisma.subcontractorUser.create({
        data: {
          userId: tempUserId,
          subcontractorCompanyId,
          role: 'admin',
        },
      });

      try {
        const listRes = await request(app)
          .get(`/api/dockets?projectId=${projectId}&limit=50`)
          .set('Authorization', `Bearer ${regRes.body.token}`);

        expect(listRes.status).toBe(200);
        const returnedIds = (listRes.body.dockets as Array<{ id: string }>).map(
          (docket) => docket.id,
        );
        expect(returnedIds).toContain(ownDocket.id);
        expect(returnedIds).not.toContain(otherDocket.id);

        const readOtherRes = await request(app)
          .get(`/api/dockets/${otherDocket.id}`)
          .set('Authorization', `Bearer ${regRes.body.token}`);

        expect(readOtherRes.status).toBe(403);
      } finally {
        await prisma.subcontractorUser.deleteMany({ where: { userId: tempUserId } });
        await prisma.dailyDocket.delete({ where: { id: otherDocket.id } }).catch(() => {});
        await prisma.dailyDocket.delete({ where: { id: ownDocket.id } }).catch(() => {});
        await prisma.subcontractorCompany
          .delete({ where: { id: otherSubcontractorCompany.id } })
          .catch(() => {});
        await prisma.emailVerificationToken.deleteMany({ where: { userId: tempUserId } });
        await prisma.user.delete({ where: { id: tempUserId } }).catch(() => {});
        await prisma.company.delete({ where: { id: promotedCompany.id } }).catch(() => {});
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
