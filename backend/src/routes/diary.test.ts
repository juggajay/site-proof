import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { authRouter } from './auth.js';
import { prisma } from '../lib/prisma.js';
import { errorHandler } from '../middleware/errorHandler.js';

// Import diary router
import diaryRouter from './diary/index.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/diary', diaryRouter);
app.use(errorHandler);

async function registerDiaryUser(fullName: string, roleInCompany: string, companyId: string) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      email: `diary-${fullName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${Math.random()}@example.com`,
      password: 'SecureP@ssword123!',
      fullName,
      tosAccepted: true,
    });

  await prisma.user.update({
    where: { id: res.body.user.id },
    data: { companyId, roleInCompany },
  });

  return { token: res.body.token as string, userId: res.body.user.id as string };
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

    it('should reject subcontractor portal users from diary reads', async () => {
      const targetDiary =
        diaryId ||
        (
          await prisma.dailyDiary.create({
            data: {
              projectId,
              date: new Date(Date.now() + 345600000),
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

  describe('Diary Submission', () => {
    it('should reject active viewers from submitting diary entries', async () => {
      const draftRes = await request(app)
        .post('/api/diary')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          date: new Date(Date.now() + 345600000).toISOString().split('T')[0],
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
      const res = await request(app)
        .post(`/api/diary/${diaryId}/submit`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ acknowledgeWarnings: true });

      expect(res.status).toBe(200);
      expect(res.body.diary.status).toBe('submitted');
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
});
