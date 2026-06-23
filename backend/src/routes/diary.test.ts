import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { authRouter } from './auth.js';
import { prisma } from '../lib/prisma.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { registerTestUser as registerSharedTestUser } from '../test/routeTestHarness.js';

// Import diary router
import diaryRouter from './diary/index.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/diary', diaryRouter);
app.use(errorHandler);

async function registerDiaryUser(fullName: string, roleInCompany: string, companyId: string) {
  const { token, userId } = await registerSharedTestUser(app, {
    emailPrefix: `diary-${fullName.toLowerCase().replace(/\s+/g, '-')}`,
    fullName,
    roleInCompany,
    companyId,
  });
  return { token, userId };
}

describe('Daily Diary API', () => {
  let authToken: string;
  let userId: string;
  let companyId: string;
  let projectId: string;
  let diaryId: string;
  let diaryDate: string;
  let viewerToken: string;
  let viewerUserId: string;
  let noAccessToken: string;
  let noAccessUserId: string;
  let otherProjectId: string;
  let otherLotId: string;
  const userIds: string[] = [];
  const projectIds: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `Diary Test Company ${Date.now()}` },
    });
    companyId = company.id;

    const testEmail = `diary-test-${Date.now()}@example.com`;
    const regRes = await request(app).post('/api/auth/register').send({
      email: testEmail,
      password: 'SecureP@ssword123!',
      fullName: 'Diary Test User',
      tosAccepted: true,
    });
    authToken = regRes.body.token;
    userId = regRes.body.user.id;
    userIds.push(userId);

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'admin' },
    });

    const project = await prisma.project.create({
      data: {
        name: `Diary Test Project ${Date.now()}`,
        projectNumber: `DIARY-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    projectId = project.id;
    projectIds.push(projectId);

    await prisma.projectUser.create({
      data: { projectId, userId, role: 'site_manager', status: 'active' },
    });

    const viewer = await registerDiaryUser('Diary Viewer', 'viewer', companyId);
    viewerToken = viewer.token;
    viewerUserId = viewer.userId;
    userIds.push(viewerUserId);

    await prisma.projectUser.create({
      data: { projectId, userId: viewerUserId, role: 'viewer', status: 'active' },
    });

    const noAccess = await registerDiaryUser('Diary No Access', 'viewer', companyId);
    noAccessToken = noAccess.token;
    noAccessUserId = noAccess.userId;
    userIds.push(noAccessUserId);

    const otherProject = await prisma.project.create({
      data: {
        name: `Diary Other Project ${Date.now()}`,
        projectNumber: `DIARY-OTHER-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    otherProjectId = otherProject.id;
    projectIds.push(otherProjectId);

    const otherLot = await prisma.lot.create({
      data: {
        projectId: otherProjectId,
        lotNumber: `DIARY-OTHER-LOT-${Date.now()}`,
        status: 'not_started',
        lotType: 'chainage',
        activityType: 'Earthworks',
      },
    });
    otherLotId = otherLot.id;
  });

  afterAll(async () => {
    await prisma.diaryAddendum.deleteMany({ where: { diary: { projectId: { in: projectIds } } } });
    await prisma.diaryDelay.deleteMany({ where: { diary: { projectId: { in: projectIds } } } });
    await prisma.diaryDelivery.deleteMany({ where: { diary: { projectId: { in: projectIds } } } });
    await prisma.diaryEvent.deleteMany({ where: { diary: { projectId: { in: projectIds } } } });
    await prisma.diaryVisitor.deleteMany({ where: { diary: { projectId: { in: projectIds } } } });
    await prisma.diaryActivity.deleteMany({ where: { diary: { projectId: { in: projectIds } } } });
    await prisma.diaryPlant.deleteMany({ where: { diary: { projectId: { in: projectIds } } } });
    await prisma.diaryPersonnel.deleteMany({ where: { diary: { projectId: { in: projectIds } } } });
    await prisma.auditLog.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.dailyDiary.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.lot.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.projectUser.deleteMany({
      where: {
        OR: [{ projectId: { in: projectIds } }, { userId: { in: userIds } }],
      },
    });
    await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
    await prisma.emailVerificationToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  });

  describe('POST /api/diary', () => {
    it('should create a diary entry', async () => {
      const today = new Date().toISOString().split('T')[0];
      diaryDate = today;
      const res = await request(app)
        .post('/api/diary')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          date: today,
        });

      expect(res.status).toBe(201);
      // API returns diary directly (not wrapped)
      expect(res.body.id).toBeDefined();
      diaryId = res.body.id;
    });

    it('should update existing diary for same date (upsert behavior)', async () => {
      const today = new Date().toISOString().split('T')[0];
      const res = await request(app)
        .post('/api/diary')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          date: today,
          generalNotes: 'Updated notes',
        });

      // API updates existing diary, returns 200
      expect(res.status).toBe(200);
      expect(res.body.generalNotes).toBe('Updated notes');
    });

    it('resolves a concurrent first-write race to the same diary without a 409 (M83/M34)', async () => {
      // A far-future date unique to this test so the row it creates can't collide
      // with another test's date assertions; it is also cleaned up below.
      const raceDate = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Hold both requests at the existence check until both have read "no diary
      // yet", so the second insert hits the (projectId, date) unique constraint
      // and must fall back to the update path rather than 409/500.
      let releaseReads: () => void = () => {};
      const bothRead = new Promise<void>((resolve) => {
        releaseReads = resolve;
      });
      let matchingReads = 0;
      let active = true;
      const fallback = setTimeout(() => releaseReads(), 1500);

      prisma.$use(async (params, next) => {
        const result = await next(params);
        const where = params.args?.where as { projectId?: string; date?: unknown } | undefined;
        if (
          active &&
          params.model === 'DailyDiary' &&
          params.action === 'findFirst' &&
          where?.projectId === projectId &&
          where?.date
        ) {
          matchingReads += 1;
          if (matchingReads >= 2) {
            clearTimeout(fallback);
            releaseReads();
          }
          await bothRead;
        }
        return result;
      });

      try {
        const [a, b] = await Promise.all([
          request(app)
            .post('/api/diary')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ projectId, date: raceDate }),
          request(app)
            .post('/api/diary')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ projectId, date: raceDate }),
        ]);

        active = false;
        expect([200, 201]).toContain(a.status);
        expect([200, 201]).toContain(b.status);
        expect(a.body.id).toBeDefined();
        expect(a.body.id).toBe(b.body.id);

        // Don't leave the raced diary behind for later tests.
        if (a.body.id) {
          await prisma.dailyDiary.delete({ where: { id: a.body.id } }).catch(() => {});
        }
      } finally {
        active = false;
        clearTimeout(fallback);
        releaseReads();
      }
    });

    it('should reject invalid diary dates', async () => {
      const res = await request(app)
        .post('/api/diary')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          date: '2026-02-30',
        });

      expect(res.status).toBe(400);
    });

    it('should reject oversized diary identifiers without creating diaries', async () => {
      const beforeCount = await prisma.dailyDiary.count({ where: { projectId } });
      const cases = [
        {
          payload: { projectId: 'P'.repeat(129), date: '2026-03-01' },
          message: 'projectId',
        },
        {
          payload: { projectId, date: '2'.repeat(65) },
          message: 'date',
        },
      ];

      for (const testCase of cases) {
        const res = await request(app)
          .post('/api/diary')
          .set('Authorization', `Bearer ${authToken}`)
          .send(testCase.payload);

        expect(res.status).toBe(400);
        expect(JSON.stringify(res.body.error)).toContain(testCase.message);
      }

      expect(await prisma.dailyDiary.count({ where: { projectId } })).toBe(beforeCount);
    });

    it('should reject invalid weather metrics', async () => {
      const negativeRainfallRes = await request(app)
        .post('/api/diary')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          rainfallMm: -1,
        });

      expect(negativeRainfallRes.status).toBe(400);

      const reversedTemperatureRes = await request(app)
        .post('/api/diary')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          temperatureMin: 30,
          temperatureMax: 20,
        });

      expect(reversedTemperatureRes.status).toBe(400);
    });
  });

  describe('GET /api/diary/:projectId', () => {
    it('should list diary entries for project', async () => {
      const res = await request(app)
        .get(`/api/diary/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      // API returns paginated response
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should reject malformed diary search filters', async () => {
      const repeatedSearchRes = await request(app)
        .get(`/api/diary/${projectId}`)
        .query({ search: ['weather', 'notes'] })
        .set('Authorization', `Bearer ${authToken}`);

      expect(repeatedSearchRes.status).toBe(400);

      const tooLongSearchRes = await request(app)
        .get(`/api/diary/${projectId}`)
        .query({ search: 'x'.repeat(121) })
        .set('Authorization', `Bearer ${authToken}`);

      expect(tooLongSearchRes.status).toBe(400);
    });

    it('should reject oversized diary route parameters before lookups', async () => {
      const longId = 'x'.repeat(129);
      const longDate = '2'.repeat(65);
      const paths = [
        `/api/diary/${longId}`,
        `/api/diary/entry/${longId}`,
        `/api/diary/project/${longId}/activity-suggestions`,
        `/api/diary/project/${longId}/delays`,
        `/api/diary/${longId}/validate`,
        `/api/diary/${longId}/timeline`,
        `/api/diary/project/${projectId}/docket-summary/${longDate}`,
      ];

      for (const path of paths) {
        const res = await request(app).get(path).set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('too long');
      }
    });

    it('should reject same-company users without active project access', async () => {
      const res = await request(app)
        .get(`/api/diary/${projectId}`)
        .set('Authorization', `Bearer ${noAccessToken}`);

      expect(res.status).toBe(403);
    });

    it('can return null instead of 404 for an intentionally empty selected date', async () => {
      const res = await request(app)
        .get(`/api/diary/${projectId}/2099-12-31`)
        .query({ missing: 'null' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toBeNull();
    });

    it('keeps the default 404 contract for a missing selected date', async () => {
      const res = await request(app)
        .get(`/api/diary/${projectId}/2099-12-30`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });

    it('should reject subcontractor portal users from diary reads', async () => {
      const targetDiary =
        diaryId ||
        (
          await prisma.dailyDiary.create({
            data: {
              projectId,
              // +13d, unique to this test so it can't collide with the
              // viewer-submission test's fresh-draft date (test isolation).
              date: new Date(Date.now() + 1123200000),
            },
          })
        ).id;
      const subcontractorCompany = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `Diary Subcontractor ${Date.now()}`,
          status: 'approved',
          portalAccess: { dockets: true },
        },
      });
      const subcontractor = await registerDiaryUser(
        'Diary Subcontractor',
        'subcontractor',
        companyId,
      );
      userIds.push(subcontractor.userId);

      await prisma.subcontractorUser.create({
        data: {
          userId: subcontractor.userId,
          subcontractorCompanyId: subcontractorCompany.id,
          role: 'user',
        },
      });

      try {
        const listRes = await request(app)
          .get(`/api/diary/${projectId}`)
          .set('Authorization', `Bearer ${subcontractor.token}`);
        expect(listRes.status).toBe(403);

        const detailRes = await request(app)
          .get(`/api/diary/entry/${targetDiary}`)
          .set('Authorization', `Bearer ${subcontractor.token}`);
        expect(detailRes.status).toBe(403);

        await prisma.projectUser.create({
          data: {
            projectId,
            userId: subcontractor.userId,
            role: 'project_manager',
            status: 'active',
          },
        });

        const writeRes = await request(app)
          .post('/api/diary')
          .set('Authorization', `Bearer ${subcontractor.token}`)
          .send({
            projectId,
            date: new Date(Date.now() + 259200000).toISOString().split('T')[0],
          });
        expect(writeRes.status).toBe(403);
      } finally {
        await prisma.projectUser.deleteMany({ where: { projectId, userId: subcontractor.userId } });
        await prisma.subcontractorUser.deleteMany({ where: { userId: subcontractor.userId } });
        await prisma.subcontractorCompany
          .delete({ where: { id: subcontractorCompany.id } })
          .catch(() => {});
      }
    });
  });

  describe('GET /api/diary/:projectId/weather/:date', () => {
    it('returns a manual-entry fallback when the weather provider is unavailable', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockRejectedValueOnce(new Error('Open-Meteo unavailable'));

      const res = await request(app)
        .get(`/api/diary/${projectId}/weather/2026-01-15`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(fetchSpy).toHaveBeenCalledOnce();
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        date: '2026-01-15',
        weatherConditions: null,
        temperatureMin: null,
        temperatureMax: null,
        rainfallMm: null,
        source: null,
        unavailable: true,
        message: 'Weather auto-population unavailable. Enter weather manually.',
        location: {
          latitude: -33.8688,
          longitude: 151.2093,
          fromProjectState: true,
        },
      });
    });
  });

  describe('GET /api/diary/project/:projectId/activity-suggestions', () => {
    it('should reject malformed activity suggestion search filters', async () => {
      const repeatedSearchRes = await request(app)
        .get(`/api/diary/project/${projectId}/activity-suggestions`)
        .query({ search: ['excavation', 'concrete'] })
        .set('Authorization', `Bearer ${authToken}`);

      expect(repeatedSearchRes.status).toBe(400);

      const tooLongSearchRes = await request(app)
        .get(`/api/diary/project/${projectId}/activity-suggestions`)
        .query({ search: 'x'.repeat(121) })
        .set('Authorization', `Bearer ${authToken}`);

      expect(tooLongSearchRes.status).toBe(400);
    });
  });

  describe('Diary write permissions', () => {
    it('should allow active viewers to read but not create diary entries', async () => {
      const readRes = await request(app)
        .get(`/api/diary/${projectId}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(readRes.status).toBe(200);

      const writeRes = await request(app)
        .post('/api/diary')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          projectId,
          date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        });

      expect(writeRes.status).toBe(403);
    });

    it('should reject users without project access from creating diary entries', async () => {
      const res = await request(app)
        .post('/api/diary')
        .set('Authorization', `Bearer ${noAccessToken}`)
        .send({
          projectId,
          date: new Date(Date.now() + 172800000).toISOString().split('T')[0],
        });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/diary/entry/:diaryId', () => {
    it('should get a single diary by ID', async () => {
      // Ensure diaryId is set from previous test
      if (!diaryId) {
        throw new Error('diaryId not set from creation test');
      }
      const res = await request(app)
        .get(`/api/diary/entry/${diaryId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(diaryId);
    });
  });

  describe('Diary Personnel', () => {
    let personnelId: string;

    it('should add personnel entry', async () => {
      const res = await request(app)
        .post(`/api/diary/${diaryId}/personnel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'John Worker',
          company: 'Test Company',
          role: 'Operator',
          hours: 8,
        });

      expect(res.status).toBe(201);
      // API returns personnel directly
      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe('John Worker');
      personnelId = res.body.id;
    });

    it('should reject malformed personnel hours and times', async () => {
      const badTimeRes = await request(app)
        .post(`/api/diary/${diaryId}/personnel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Bad Time Worker',
          startTime: '25:00',
          hours: 8,
        });

      expect(badTimeRes.status).toBe(400);

      const negativeHoursRes = await request(app)
        .post(`/api/diary/${diaryId}/personnel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Negative Hours Worker',
          hours: -1,
        });

      expect(negativeHoursRes.status).toBe(400);
    });

    it('should delete personnel entry', async () => {
      const res = await request(app)
        .delete(`/api/diary/${diaryId}/personnel/${personnelId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(204);
    });
  });

  describe('Diary Plant', () => {
    let plantId: string;

    it('should add plant entry', async () => {
      const res = await request(app)
        .post(`/api/diary/${diaryId}/plant`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Excavator CAT 320',
          idRego: 'EX-001',
          hoursOperated: 8,
        });

      expect(res.status).toBe(201);
      // API returns plant directly
      expect(res.body.id).toBeDefined();
      expect(res.body.description).toBe('Excavator CAT 320');
      plantId = res.body.id;
    });

    it('should reject invalid plant hours', async () => {
      const res = await request(app)
        .post(`/api/diary/${diaryId}/plant`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Invalid Excavator',
          hoursOperated: -1,
        });

      expect(res.status).toBe(400);
    });

    it('should delete plant entry', async () => {
      const res = await request(app)
        .delete(`/api/diary/${diaryId}/plant/${plantId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(204);
    });
  });

  describe('Diary Activities', () => {
    it('should add activity entry', async () => {
      const res = await request(app)
        .post(`/api/diary/${diaryId}/activities`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Excavation work',
          quantity: 500,
          unit: 'm3',
        });

      expect(res.status).toBe(201);
      // API returns activity directly
      expect(res.body.id).toBeDefined();
      expect(res.body.description).toBe('Excavation work');
    });

    it('should reject negative activity quantities', async () => {
      const res = await request(app)
        .post(`/api/diary/${diaryId}/activities`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Invalid quantity activity',
          quantity: -1,
        });

      expect(res.status).toBe(400);
    });

    it('should reject activity lot links from another project', async () => {
      const res = await request(app)
        .post(`/api/diary/${diaryId}/activities`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          lotId: otherLotId,
          description: 'Cross-project activity',
        });

      expect(res.status).toBe(400);
    });

    it('should not delete an activity from a different diary', async () => {
      const otherDiaryRes = await request(app)
        .post('/api/diary')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          date: new Date(Date.now() + 259200000).toISOString().split('T')[0],
        });
      expect(otherDiaryRes.status).toBe(201);

      const activityRes = await request(app)
        .post(`/api/diary/${otherDiaryRes.body.id}/activities`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ description: 'Other diary activity' });
      expect(activityRes.status).toBe(201);

      const deleteRes = await request(app)
        .delete(`/api/diary/${diaryId}/activities/${activityRes.body.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(deleteRes.status).toBe(404);

      const stillExists = await prisma.diaryActivity.findUnique({
        where: { id: activityRes.body.id },
      });
      expect(stillExists).not.toBeNull();
    });

    it('should reject active viewers from adding diary items', async () => {
      const res = await request(app)
        .post(`/api/diary/${diaryId}/activities`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ description: 'Viewer activity' });

      expect(res.status).toBe(403);
    });
  });

  describe('Diary Delays', () => {
    it('should reject malformed delay times and durations', async () => {
      const badTimeRes = await request(app)
        .post(`/api/diary/${diaryId}/delays`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          delayType: 'Weather',
          startTime: '24:01',
          description: 'Invalid delay time',
        });

      expect(badTimeRes.status).toBe(400);

      const negativeDurationRes = await request(app)
        .post(`/api/diary/${diaryId}/delays`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          delayType: 'Weather',
          durationHours: -1,
          description: 'Invalid delay duration',
        });

      expect(negativeDurationRes.status).toBe(400);
    });

    it('should add delay entry', async () => {
      const res = await request(app)
        .post(`/api/diary/${diaryId}/delays`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          delayType: 'Weather',
          startTime: '09:00',
          endTime: '10:30',
          durationHours: 1.5,
          description: 'Rain delay',
          impact: 'Crew stood down',
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.delayType).toBe('Weather');
    });

    it('should match delay report filters across legacy and mobile delay type labels', async () => {
      const reportDate = '2026-01-15';
      const reportDiary = await prisma.dailyDiary.create({
        data: {
          projectId,
          date: new Date(`${reportDate}T00:00:00.000Z`),
          delays: {
            create: [
              {
                delayType: 'Weather',
                durationHours: 1,
                description: 'Desktop weather delay',
              },
              {
                delayType: 'weather',
                durationHours: 2,
                description: 'Mobile weather delay',
              },
              {
                delayType: 'Material Delay',
                durationHours: 3,
                description: 'Desktop material delay',
              },
            ],
          },
        },
      });

      try {
        const weatherRes = await request(app)
          .get(
            `/api/diary/project/${projectId}/delays?delayType=weather&startDate=${reportDate}&endDate=${reportDate}`,
          )
          .set('Authorization', `Bearer ${authToken}`);

        expect(weatherRes.status).toBe(200);
        expect(weatherRes.body.delays).toHaveLength(2);
        expect(weatherRes.body.summary.totalHours).toBe(3);
        expect(
          weatherRes.body.delays.map((delay: { delayType: string }) => delay.delayType).sort(),
        ).toEqual(['Weather', 'weather']);

        const materialRes = await request(app)
          .get(
            `/api/diary/project/${projectId}/delays?delayType=material_shortage&startDate=${reportDate}&endDate=${reportDate}`,
          )
          .set('Authorization', `Bearer ${authToken}`);

        expect(materialRes.status).toBe(200);
        expect(materialRes.body.delays).toHaveLength(1);
        expect(materialRes.body.delays[0].delayType).toBe('Material Delay');

        const exportRes = await request(app)
          .get(
            `/api/diary/project/${projectId}/delays/export?delayType=weather&startDate=${reportDate}&endDate=${reportDate}`,
          )
          .set('Authorization', `Bearer ${authToken}`);

        expect(exportRes.status).toBe(200);
        expect(exportRes.text).toContain('Desktop weather delay');
        expect(exportRes.text).toContain('Mobile weather delay');
        expect(exportRes.text).not.toContain('Desktop material delay');
      } finally {
        await prisma.diaryDelay.deleteMany({ where: { diaryId: reportDiary.id } });
        await prisma.dailyDiary.delete({ where: { id: reportDiary.id } });
      }
    });

    it('should reject malformed delay report filters', async () => {
      const invalidDateRes = await request(app)
        .get(`/api/diary/project/${projectId}/delays?startDate=2026-02-30`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(invalidDateRes.status).toBe(400);

      const reversedRangeRes = await request(app)
        .get(`/api/diary/project/${projectId}/delays?startDate=2026-01-02&endDate=2026-01-01`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(reversedRangeRes.status).toBe(400);

      const duplicateFilterRes = await request(app)
        .get(`/api/diary/project/${projectId}/delays?delayType=Weather&delayType=Other`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(duplicateFilterRes.status).toBe(400);
    });

    it('should reject malformed delay export filters', async () => {
      const res = await request(app)
        .get(
          `/api/diary/project/${projectId}/delays/export?startDate=2026-01-02&endDate=2026-01-01`,
        )
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
    });

    it('should guard delay CSV exports from spreadsheet formula injection', async () => {
      const description = ' +SUM(1,1)';
      const impact = '\t=cmd';

      await prisma.diaryDelay.create({
        data: {
          diaryId,
          delayType: 'Other',
          durationHours: 0.5,
          description,
          impact,
        },
      });

      const res = await request(app)
        .get(`/api/diary/project/${projectId}/delays/export`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain(`"'${description}"`);
      expect(res.text).toContain(`"'${impact}"`);
      expect(res.text).not.toContain(`"${description}"`);
      expect(res.text).not.toContain(`"${impact}"`);
    });
  });

  describe('Diary item updates', () => {
    it('should update mobile-editable timeline entries in place', async () => {
      const diaryRes = await request(app)
        .post('/api/diary')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          date: new Date(Date.now() + 864000000).toISOString().split('T')[0],
        });
      expect(diaryRes.status).toBe(201);
      const editableDiaryId = diaryRes.body.id;

      const personnelRes = await request(app)
        .post(`/api/diary/${editableDiaryId}/personnel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Edit Worker',
          company: 'Original Co',
          role: 'Operator',
          hours: 6,
        });
      expect(personnelRes.status).toBe(201);

      const plantRes = await request(app)
        .post(`/api/diary/${editableDiaryId}/plant`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Edit Dozer',
          idRego: 'DZ-1',
          company: 'Original Plant',
          hoursOperated: 4,
        });
      expect(plantRes.status).toBe(201);

      const activityRes = await request(app)
        .post(`/api/diary/${editableDiaryId}/activities`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Original activity',
          quantity: 10,
          unit: 'm',
        });
      expect(activityRes.status).toBe(201);

      const delayRes = await request(app)
        .post(`/api/diary/${editableDiaryId}/delays`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          delayType: 'Weather',
          description: 'Original delay',
          durationHours: 1,
        });
      expect(delayRes.status).toBe(201);

      const deliveryRes = await request(app)
        .post(`/api/diary/${editableDiaryId}/deliveries`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Original delivery',
          supplier: 'Original Supplier',
          quantity: 2,
          unit: 'loads',
        });
      expect(deliveryRes.status).toBe(201);

      const eventRes = await request(app)
        .post(`/api/diary/${editableDiaryId}/events`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          eventType: 'safety',
          description: 'Original event',
          notes: 'Original notes',
        });
      expect(eventRes.status).toBe(201);

      const beforeCounts = {
        personnel: await prisma.diaryPersonnel.count({ where: { diaryId: editableDiaryId } }),
        plant: await prisma.diaryPlant.count({ where: { diaryId: editableDiaryId } }),
        activities: await prisma.diaryActivity.count({ where: { diaryId: editableDiaryId } }),
        delays: await prisma.diaryDelay.count({ where: { diaryId: editableDiaryId } }),
        deliveries: await prisma.diaryDelivery.count({ where: { diaryId: editableDiaryId } }),
        events: await prisma.diaryEvent.count({ where: { diaryId: editableDiaryId } }),
      };

      const personnelUpdateRes = await request(app)
        .put(`/api/diary/${editableDiaryId}/personnel/${personnelRes.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Edited Worker',
          company: 'Edited Co',
          role: 'Leading Hand',
          hours: 7,
        });
      expect(personnelUpdateRes.status).toBe(200);
      expect(personnelUpdateRes.body).toMatchObject({
        id: personnelRes.body.id,
        name: 'Edited Worker',
        company: 'Edited Co',
        role: 'Leading Hand',
      });

      const plantUpdateRes = await request(app)
        .put(`/api/diary/${editableDiaryId}/plant/${plantRes.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Edited Dozer',
          idRego: 'DZ-2',
          company: 'Edited Plant',
          hoursOperated: 5,
        });
      expect(plantUpdateRes.status).toBe(200);
      expect(plantUpdateRes.body).toMatchObject({
        id: plantRes.body.id,
        description: 'Edited Dozer',
        idRego: 'DZ-2',
      });

      const activityUpdateRes = await request(app)
        .put(`/api/diary/${editableDiaryId}/activities/${activityRes.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Edited activity',
          quantity: 12,
          unit: 'm2',
          notes: 'Edited notes',
        });
      expect(activityUpdateRes.status).toBe(200);
      expect(activityUpdateRes.body).toMatchObject({
        id: activityRes.body.id,
        description: 'Edited activity',
        unit: 'm2',
      });

      const delayUpdateRes = await request(app)
        .put(`/api/diary/${editableDiaryId}/delays/${delayRes.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          delayType: 'Plant Breakdown',
          description: 'Edited delay',
          durationHours: 2,
          impact: 'Resequenced crew',
        });
      expect(delayUpdateRes.status).toBe(200);
      expect(delayUpdateRes.body).toMatchObject({
        id: delayRes.body.id,
        delayType: 'Plant Breakdown',
        description: 'Edited delay',
      });

      const deliveryUpdateRes = await request(app)
        .put(`/api/diary/${editableDiaryId}/deliveries/${deliveryRes.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Edited delivery',
          supplier: 'Edited Supplier',
          quantity: 3,
          unit: 'loads',
          notes: 'Checked in',
        });
      expect(deliveryUpdateRes.status).toBe(200);
      expect(deliveryUpdateRes.body).toMatchObject({
        id: deliveryRes.body.id,
        description: 'Edited delivery',
        supplier: 'Edited Supplier',
      });

      const eventUpdateRes = await request(app)
        .put(`/api/diary/${editableDiaryId}/events/${eventRes.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          eventType: 'instruction',
          description: 'Edited event',
          notes: 'Instruction recorded',
        });
      expect(eventUpdateRes.status).toBe(200);
      expect(eventUpdateRes.body).toMatchObject({
        id: eventRes.body.id,
        eventType: 'instruction',
        description: 'Edited event',
      });

      await expect(
        prisma.diaryPersonnel.count({ where: { diaryId: editableDiaryId } }),
      ).resolves.toBe(beforeCounts.personnel);
      await expect(prisma.diaryPlant.count({ where: { diaryId: editableDiaryId } })).resolves.toBe(
        beforeCounts.plant,
      );
      await expect(
        prisma.diaryActivity.count({ where: { diaryId: editableDiaryId } }),
      ).resolves.toBe(beforeCounts.activities);
      await expect(prisma.diaryDelay.count({ where: { diaryId: editableDiaryId } })).resolves.toBe(
        beforeCounts.delays,
      );
      await expect(
        prisma.diaryDelivery.count({ where: { diaryId: editableDiaryId } }),
      ).resolves.toBe(beforeCounts.deliveries);
      await expect(prisma.diaryEvent.count({ where: { diaryId: editableDiaryId } })).resolves.toBe(
        beforeCounts.events,
      );
    });
  });

  describe('Diary Submission', () => {
    it('should reject active viewers from submitting diary entries', async () => {
      const draftRes = await request(app)
        .post('/api/diary')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          // +17d, unique to this test so the fresh-draft create is always a 201
          // (the subcontractor-read test above used to share +4d -> flaky 200).
          date: new Date(Date.now() + 1468800000).toISOString().split('T')[0],
        });
      expect(draftRes.status).toBe(201);

      const res = await request(app)
        .post(`/api/diary/${draftRes.body.id}/submit`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ acknowledgeWarnings: true });

      expect(res.status).toBe(403);
    });

    it('should reject non-boolean warning acknowledgement', async () => {
      const draftRes = await request(app)
        .post('/api/diary')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          date: new Date(Date.now() + 432000000).toISOString().split('T')[0],
        });
      expect(draftRes.status).toBe(201);

      const res = await request(app)
        .post(`/api/diary/${draftRes.body.id}/submit`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ acknowledgeWarnings: 'true' });

      expect(res.status).toBe(400);
    });

    it('should submit diary with warnings acknowledged', async () => {
      if (!diaryId) {
        diaryDate = new Date(Date.now() + 604800000).toISOString().split('T')[0];
        const draftRes = await request(app)
          .post('/api/diary')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            projectId,
            date: diaryDate,
          });
        expect(draftRes.status).toBe(201);
        diaryId = draftRes.body.id;
      }

      const res = await request(app)
        .post(`/api/diary/${diaryId}/submit`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ acknowledgeWarnings: true });

      expect(res.status).toBe(200);
      expect(res.body.diary.status).toBe('submitted');

      const auditLog = await prisma.auditLog.findFirst({
        where: {
          projectId,
          userId,
          entityType: 'daily_diary',
          entityId: diaryId,
          action: 'diary_submitted',
        },
      });
      expect(auditLog).toBeTruthy();
      expect(auditLog?.changes ? JSON.parse(auditLog.changes) : null).toMatchObject({
        status: { from: 'draft', to: 'submitted' },
        warningsAcknowledged: true,
      });
    });

    it('should reject item writes that start before a concurrent submit commits', async () => {
      const draftRes = await request(app)
        .post('/api/diary')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          date: new Date(Date.now() + 518400000).toISOString().split('T')[0],
        });
      expect(draftRes.status).toBe(201);

      let activityWrite: ReturnType<ReturnType<typeof request>['post']> | undefined;

      await prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`
            SELECT id
            FROM daily_diaries
            WHERE id = ${draftRes.body.id}
            FOR UPDATE
          `;

          activityWrite = request(app)
            .post(`/api/diary/${draftRes.body.id}/activities`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ description: 'Started before submit committed' });

          await new Promise((resolve) => setTimeout(resolve, 150));
          await tx.dailyDiary.update({
            where: { id: draftRes.body.id },
            data: {
              status: 'submitted',
              submittedById: userId,
              submittedAt: new Date(),
            },
          });
        },
        { timeout: 10_000 },
      );

      if (!activityWrite) {
        throw new Error('activity write request was not started');
      }
      const res = await activityWrite;

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('submitted');
      await expect(
        prisma.diaryActivity.count({ where: { diaryId: draftRes.body.id } }),
      ).resolves.toBe(0);
    });

    it('should reject malformed addendum content', async () => {
      const objectContentRes = await request(app)
        .post(`/api/diary/${diaryId}/addendum`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: { text: 'Invalid addendum' } });

      expect(objectContentRes.status).toBe(400);

      const longContentRes = await request(app)
        .post(`/api/diary/${diaryId}/addendum`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'x'.repeat(5001) });

      expect(longContentRes.status).toBe(400);
    });

    async function createSubmittedDiary(dayOffset: number) {
      const date = new Date(Date.now() + dayOffset * 86400000).toISOString().split('T')[0];
      const draftRes = await request(app)
        .post('/api/diary')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ projectId, date });
      expect(draftRes.status).toBe(201);
      const submitRes = await request(app)
        .post(`/api/diary/${draftRes.body.id}/submit`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ acknowledgeWarnings: true });
      expect(submitRes.status).toBe(200);
      return draftRes.body.id as string;
    }

    it('reopens a submitted diary back to draft with an audited reason (M31)', async () => {
      const reopenDiaryId = await createSubmittedDiary(40);

      const res = await request(app)
        .post(`/api/diary/${reopenDiaryId}/reopen`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reason: 'Personnel hours were entered incorrectly' });

      expect(res.status).toBe(200);
      expect(res.body.diary.status).toBe('draft');

      const reopened = await prisma.dailyDiary.findUniqueOrThrow({ where: { id: reopenDiaryId } });
      expect(reopened.status).toBe('draft');
      expect(reopened.submittedAt).toBeNull();
      expect(reopened.lockedAt).toBeNull();

      const auditLog = await prisma.auditLog.findFirst({
        where: {
          projectId,
          entityType: 'daily_diary',
          entityId: reopenDiaryId,
          action: 'diary_reopened',
        },
      });
      expect(auditLog).not.toBeNull();
      expect(auditLog?.changes ? JSON.parse(auditLog.changes) : null).toMatchObject({
        status: { from: 'submitted', to: 'draft' },
        reason: 'Personnel hours were entered incorrectly',
      });

      // Reopening restores edit access.
      const editRes = await request(app)
        .post(`/api/diary/${reopenDiaryId}/activities`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ description: 'Corrected activity after reopen' });
      expect(editRes.status).toBe(201);
    });

    it('requires a reason to reopen a diary (M31)', async () => {
      const id = await createSubmittedDiary(41);

      const res = await request(app)
        .post(`/api/diary/${id}/reopen`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reason: '   ' });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('reason is required');

      const stillSubmitted = await prisma.dailyDiary.findUniqueOrThrow({ where: { id } });
      expect(stillSubmitted.status).toBe('submitted');
    });

    it('rejects reopening a diary that is not submitted (M31)', async () => {
      const date = new Date(Date.now() + 42 * 86400000).toISOString().split('T')[0];
      const draftRes = await request(app)
        .post('/api/diary')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ projectId, date });

      const res = await request(app)
        .post(`/api/diary/${draftRes.body.id}/reopen`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reason: 'Trying to reopen a draft' });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('submitted');
    });

    it('forbids a foreman from reopening a submitted diary (M31)', async () => {
      const foreman = await registerDiaryUser('Diary Reopen Foreman', 'foreman', companyId);
      userIds.push(foreman.userId);
      await prisma.projectUser.create({
        data: { projectId, userId: foreman.userId, role: 'foreman', status: 'active' },
      });

      const id = await createSubmittedDiary(43);

      const res = await request(app)
        .post(`/api/diary/${id}/reopen`)
        .set('Authorization', `Bearer ${foreman.token}`)
        .send({ reason: 'Foreman should not be able to reopen' });
      expect(res.status).toBe(403);

      const stillSubmitted = await prisma.dailyDiary.findUniqueOrThrow({ where: { id } });
      expect(stillSubmitted.status).toBe('submitted');
    });

    it('auto-locks a submitted diary from addendums after the cutoff, and reopen overrides it (M32)', async () => {
      const id = await createSubmittedDiary(44);

      // Backdate the submission past the 7-day lock cutoff.
      await prisma.dailyDiary.update({
        where: { id },
        data: { submittedAt: new Date(Date.now() - 8 * 86400000) },
      });

      const addendumRes = await request(app)
        .post(`/api/diary/${id}/addendum`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Trying to add a note to a locked diary' });
      expect(addendumRes.status).toBe(400);
      expect(addendumRes.body.error.message).toContain('locked');

      // M31 reopen overrides the auto-lock even after the cutoff.
      const reopenRes = await request(app)
        .post(`/api/diary/${id}/reopen`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reason: 'Reopen overrides the auto-lock' });
      expect(reopenRes.status).toBe(200);
      expect(reopenRes.body.diary.status).toBe('draft');
    });

    it('should add submitted diary addendum and write an audit log without storing addendum content', async () => {
      const addendumDiaryDate = new Date(Date.now() + 691200000).toISOString().split('T')[0];
      const draftRes = await request(app)
        .post('/api/diary')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          date: addendumDiaryDate,
        });
      expect(draftRes.status).toBe(201);

      const submitRes = await request(app)
        .post(`/api/diary/${draftRes.body.id}/submit`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ acknowledgeWarnings: true });
      expect(submitRes.status).toBe(200);

      const content = '  Late concrete pour note added after submission.  ';
      const res = await request(app)
        .post(`/api/diary/${draftRes.body.id}/addendum`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content });

      expect(res.status).toBe(201);
      expect(res.body.content).toBe(content.trim());

      const auditLog = await prisma.auditLog.findFirst({
        where: {
          projectId,
          userId,
          entityType: 'diary_addendum',
          entityId: res.body.id,
          action: 'diary_addendum_added',
        },
      });
      expect(auditLog).toBeTruthy();
      expect(auditLog?.changes ? JSON.parse(auditLog.changes) : null).toMatchObject({
        diaryId: draftRes.body.id,
        diaryDate: addendumDiaryDate,
        contentLength: content.trim().length,
      });
      expect(auditLog?.changes).not.toContain(content.trim());
    });

    it('should reject updating a submitted diary through the upsert endpoint', async () => {
      const res = await request(app)
        .post('/api/diary')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          date: diaryDate,
          generalNotes: 'Should not update',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('submitted');
    });

    it('should reject adding personnel to submitted diary', async () => {
      const res = await request(app)
        .post(`/api/diary/${diaryId}/personnel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'New Worker',
          company: 'Test Company',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('submitted');
    });
  });

  describe('GET previous-personnel / previous-plant (H11)', () => {
    it('copies only manually-entered rows, never docket-sourced crew or plant', async () => {
      const prevDiary = await prisma.dailyDiary.create({
        data: {
          projectId,
          date: new Date('2026-02-01T00:00:00.000Z'),
          personnel: {
            create: [
              { name: 'Manual Person', source: 'manual' },
              { name: 'Docket Person', source: 'docket' },
            ],
          },
          plant: {
            create: [
              { description: 'Manual Excavator', source: 'manual' },
              { description: 'Docket Excavator', source: 'docket' },
            ],
          },
        },
      });

      try {
        const personnelRes = await request(app)
          .get(`/api/diary/${projectId}/2026-02-05/previous-personnel`)
          .set('Authorization', `Bearer ${authToken}`);
        expect(personnelRes.status).toBe(200);
        expect((personnelRes.body.personnel as Array<{ name: string }>).map((p) => p.name)).toEqual(
          ['Manual Person'],
        );

        const plantRes = await request(app)
          .get(`/api/diary/${projectId}/2026-02-05/previous-plant`)
          .set('Authorization', `Bearer ${authToken}`);
        expect(plantRes.status).toBe(200);
        expect(
          (plantRes.body.plant as Array<{ description: string }>).map((p) => p.description),
        ).toEqual(['Manual Excavator']);
      } finally {
        await prisma.diaryPersonnel.deleteMany({ where: { diaryId: prevDiary.id } });
        await prisma.diaryPlant.deleteMany({ where: { diaryId: prevDiary.id } });
        await prisma.dailyDiary.delete({ where: { id: prevDiary.id } }).catch(() => {});
      }
    });

    it('skips a previous diary that has only docket-sourced rows', async () => {
      const prevDiary = await prisma.dailyDiary.create({
        data: {
          projectId,
          date: new Date('2026-02-02T00:00:00.000Z'),
          personnel: { create: [{ name: 'Docket Only', source: 'docket' }] },
        },
      });

      try {
        const res = await request(app)
          .get(`/api/diary/${projectId}/2026-02-06/previous-personnel`)
          .set('Authorization', `Bearer ${authToken}`);
        expect(res.status).toBe(200);
        expect(res.body.personnel).toEqual([]);
      } finally {
        await prisma.diaryPersonnel.deleteMany({ where: { diaryId: prevDiary.id } });
        await prisma.dailyDiary.delete({ where: { id: prevDiary.id } }).catch(() => {});
      }
    });
  });
});
