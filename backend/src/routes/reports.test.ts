import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { authRouter } from './auth.js';
import { reportsRouter } from './reports.js';
import { prisma } from '../lib/prisma.js';
import { errorHandler } from '../middleware/errorHandler.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/reports', reportsRouter);
app.use(errorHandler);

describe('Reports API - Project Access', () => {
  let authToken: string;
  let outsiderToken: string;
  let pendingToken: string;
  let subcontractorToken: string;
  let nonCommercialToken: string;
  let userId: string;
  let outsiderUserId: string;
  let pendingUserId: string;
  let subcontractorUserId: string;
  let nonCommercialUserId: string;
  let companyId: string;
  let outsiderCompanyId: string;
  let projectId: string;
  let scheduleId: string;
  let subcontractorCompanyId: string;

  beforeAll(async () => {
    const suffix = Date.now();
    const company = await prisma.company.create({
      data: { name: `Reports Access Company ${suffix}` },
    });
    companyId = company.id;

    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `reports-access-${suffix}@example.com`,
        password: 'SecureP@ssword123!',
        fullName: 'Reports Access User',
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
        name: `Reports Access Project ${suffix}`,
        projectNumber: `RPT-ACCESS-${suffix}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    projectId = project.id;

    await prisma.projectUser.create({
      data: { projectId, userId, role: 'admin', status: 'active' },
    });

    const pendingRegRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `reports-pending-${suffix}@example.com`,
        password: 'SecureP@ssword123!',
        fullName: 'Reports Pending User',
        tosAccepted: true,
      });
    pendingToken = pendingRegRes.body.token;
    pendingUserId = pendingRegRes.body.user.id;

    await prisma.user.update({
      where: { id: pendingUserId },
      data: { companyId, roleInCompany: 'viewer' },
    });

    await prisma.projectUser.create({
      data: { projectId, userId: pendingUserId, role: 'viewer', status: 'pending' },
    });

    const nonCommercialRegRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `reports-site-manager-${suffix}@example.com`,
        password: 'SecureP@ssword123!',
        fullName: 'Reports Site Manager',
        tosAccepted: true,
      });
    nonCommercialToken = nonCommercialRegRes.body.token;
    nonCommercialUserId = nonCommercialRegRes.body.user.id;

    await prisma.user.update({
      where: { id: nonCommercialUserId },
      data: { companyId, roleInCompany: 'site_manager' },
    });

    await prisma.projectUser.create({
      data: { projectId, userId: nonCommercialUserId, role: 'site_manager', status: 'active' },
    });

    const outsiderCompany = await prisma.company.create({
      data: { name: `Reports Outsider Company ${suffix}` },
    });
    outsiderCompanyId = outsiderCompany.id;

    const outsiderRegRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `reports-outsider-${suffix}@example.com`,
        password: 'SecureP@ssword123!',
        fullName: 'Reports Outsider User',
        tosAccepted: true,
      });
    outsiderToken = outsiderRegRes.body.token;
    outsiderUserId = outsiderRegRes.body.user.id;

    await prisma.user.update({
      where: { id: outsiderUserId },
      data: { companyId: outsiderCompanyId, roleInCompany: 'admin' },
    });

    const subcontractorCompany = await prisma.subcontractorCompany.create({
      data: {
        projectId,
        companyName: `Reports Access Subcontractor ${suffix}`,
        primaryContactName: 'Reports Subcontractor',
        primaryContactEmail: `reports-subcontractor-${suffix}@example.com`,
        status: 'approved',
      },
    });
    subcontractorCompanyId = subcontractorCompany.id;

    const subcontractorRegRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `reports-subcontractor-user-${suffix}@example.com`,
        password: 'SecureP@ssword123!',
        fullName: 'Reports Subcontractor User',
        tosAccepted: true,
      });
    subcontractorToken = subcontractorRegRes.body.token;
    subcontractorUserId = subcontractorRegRes.body.user.id;

    await prisma.user.update({
      where: { id: subcontractorUserId },
      data: { companyId, roleInCompany: 'subcontractor_admin' },
    });

    await prisma.subcontractorUser.create({
      data: {
        userId: subcontractorUserId,
        subcontractorCompanyId,
        role: 'admin',
      },
    });

    const schedule = await prisma.scheduledReport.create({
      data: {
        projectId,
        reportType: 'lot-status',
        frequency: 'weekly',
        dayOfWeek: 1,
        timeOfDay: '09:00',
        recipients: 'reports@example.com',
        nextRunAt: new Date(),
        createdById: userId,
        isActive: true,
      },
    });
    scheduleId = schedule.id;
  });

  afterAll(async () => {
    await prisma.scheduledReport.deleteMany({ where: { projectId } });
    await prisma.subcontractorUser.deleteMany({ where: { subcontractorCompanyId } });
    await prisma.subcontractorCompany
      .delete({ where: { id: subcontractorCompanyId } })
      .catch(() => {});
    await prisma.projectUser.deleteMany({ where: { projectId } });
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
    await prisma.emailVerificationToken.deleteMany({
      where: {
        userId: {
          in: [userId, outsiderUserId, pendingUserId, nonCommercialUserId, subcontractorUserId],
        },
      },
    });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.user.delete({ where: { id: pendingUserId } }).catch(() => {});
    await prisma.user.delete({ where: { id: nonCommercialUserId } }).catch(() => {});
    await prisma.user.delete({ where: { id: subcontractorUserId } }).catch(() => {});
    await prisma.user.delete({ where: { id: outsiderUserId } }).catch(() => {});
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
    await prisma.company.delete({ where: { id: outsiderCompanyId } }).catch(() => {});
  });

  it('should allow authorized users to fetch project reports', async () => {
    const res = await request(app)
      .get('/api/reports/summary')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId });

    expect(res.status).toBe(200);
    expect(res.body.projectId).toBe(projectId);
  });

  it('should allow active internal users to fetch non-commercial reports', async () => {
    const res = await request(app)
      .get('/api/reports/summary')
      .set('Authorization', `Bearer ${nonCommercialToken}`)
      .query({ projectId });

    expect(res.status).toBe(200);
    expect(res.body.projectId).toBe(projectId);
  });

  it('should deny report access for pending project memberships', async () => {
    const res = await request(app)
      .get('/api/reports/summary')
      .set('Authorization', `Bearer ${pendingToken}`)
      .query({ projectId });

    expect(res.status).toBe(403);
  });

  it('should reject oversized report identifiers and filters before heavy report work', async () => {
    const longId = 'r'.repeat(129);

    const oversizedProjectRes = await request(app)
      .get('/api/reports/summary')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId: longId });

    expect(oversizedProjectRes.status).toBe(400);
    expect(oversizedProjectRes.body.error.message).toContain('projectId is too long');

    const oversizedDateRes = await request(app)
      .get('/api/reports/test')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId, startDate: '2'.repeat(65) });

    expect(oversizedDateRes.status).toBe(400);
    expect(oversizedDateRes.body.error.message).toContain('startDate is too long');

    const oversizedScheduleUpdateRes = await request(app)
      .put(`/api/reports/schedules/${longId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ isActive: false });

    expect(oversizedScheduleUpdateRes.status).toBe(400);
    expect(oversizedScheduleUpdateRes.body.error.message).toContain('id is too long');

    const oversizedScheduleDeleteRes = await request(app)
      .delete(`/api/reports/schedules/${longId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(oversizedScheduleDeleteRes.status).toBe(400);
    expect(oversizedScheduleDeleteRes.body.error.message).toContain('id is too long');
  });

  it('should deny project report reads to users without project access', async () => {
    const endpoints = [
      '/api/reports/lot-status',
      '/api/reports/ncr',
      '/api/reports/test',
      '/api/reports/diary',
      '/api/reports/summary',
      '/api/reports/claims',
      '/api/reports/schedules',
    ];

    const responses = [];
    for (const endpoint of endpoints) {
      responses.push(
        await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${outsiderToken}`)
          .query({ projectId }),
      );
    }

    responses.forEach((res) => {
      expect(res.status).toBe(403);
    });
  });

  it('should deny project report reads to subcontractor portal users', async () => {
    const endpoints = [
      '/api/reports/lot-status',
      '/api/reports/ncr',
      '/api/reports/test',
      '/api/reports/diary',
      '/api/reports/summary',
      '/api/reports/claims',
      '/api/reports/schedules',
    ];

    const responses = [];
    for (const endpoint of endpoints) {
      responses.push(
        await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${subcontractorToken}`)
          .query({ projectId }),
      );
    }

    responses.forEach((res) => {
      expect(res.status).toBe(403);
    });
  });

  it('should deny claims report access to internal users without commercial roles', async () => {
    const res = await request(app)
      .get('/api/reports/claims')
      .set('Authorization', `Bearer ${nonCommercialToken}`)
      .query({ projectId });

    expect(res.status).toBe(403);
  });

  it('should deny project schedule management to internal users without schedule management roles', async () => {
    const listRes = await request(app)
      .get('/api/reports/schedules')
      .set('Authorization', `Bearer ${nonCommercialToken}`)
      .query({ projectId });

    const createRes = await request(app)
      .post('/api/reports/schedules')
      .set('Authorization', `Bearer ${nonCommercialToken}`)
      .send({
        projectId,
        reportType: 'lot-status',
        frequency: 'weekly',
        dayOfWeek: 1,
        timeOfDay: '09:00',
        recipients: 'site-manager@example.com',
      });

    const updateRes = await request(app)
      .put(`/api/reports/schedules/${scheduleId}`)
      .set('Authorization', `Bearer ${nonCommercialToken}`)
      .send({ isActive: false });

    const deleteRes = await request(app)
      .delete(`/api/reports/schedules/${scheduleId}`)
      .set('Authorization', `Bearer ${nonCommercialToken}`);

    expect(listRes.status).toBe(403);
    expect(createRes.status).toBe(403);
    expect(updateRes.status).toBe(403);
    expect(deleteRes.status).toBe(403);

    const schedule = await prisma.scheduledReport.findUnique({ where: { id: scheduleId } });
    expect(schedule).toBeDefined();
    expect(schedule?.isActive).toBe(true);
  });

  it('should deny project schedule management to users without project access', async () => {
    const listRes = await request(app)
      .get('/api/reports/schedules')
      .set('Authorization', `Bearer ${outsiderToken}`)
      .query({ projectId });

    const createRes = await request(app)
      .post('/api/reports/schedules')
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({
        projectId,
        reportType: 'lot-status',
        frequency: 'weekly',
        dayOfWeek: 1,
        timeOfDay: '09:00',
        recipients: 'outsider@example.com',
      });

    const updateRes = await request(app)
      .put(`/api/reports/schedules/${scheduleId}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ isActive: false });

    const deleteRes = await request(app)
      .delete(`/api/reports/schedules/${scheduleId}`)
      .set('Authorization', `Bearer ${outsiderToken}`);

    expect(listRes.status).toBe(403);
    expect(createRes.status).toBe(403);
    expect(updateRes.status).toBe(403);
    expect(deleteRes.status).toBe(403);

    const schedule = await prisma.scheduledReport.findUnique({ where: { id: scheduleId } });
    expect(schedule).toBeDefined();
    expect(schedule?.isActive).toBe(true);
  });

  it('should deny project schedule management to subcontractor portal users', async () => {
    const listRes = await request(app)
      .get('/api/reports/schedules')
      .set('Authorization', `Bearer ${subcontractorToken}`)
      .query({ projectId });

    const createRes = await request(app)
      .post('/api/reports/schedules')
      .set('Authorization', `Bearer ${subcontractorToken}`)
      .send({
        projectId,
        reportType: 'lot-status',
        frequency: 'weekly',
        dayOfWeek: 1,
        timeOfDay: '09:00',
        recipients: 'subcontractor@example.com',
      });

    const updateRes = await request(app)
      .put(`/api/reports/schedules/${scheduleId}`)
      .set('Authorization', `Bearer ${subcontractorToken}`)
      .send({ isActive: false });

    const deleteRes = await request(app)
      .delete(`/api/reports/schedules/${scheduleId}`)
      .set('Authorization', `Bearer ${subcontractorToken}`);

    expect(listRes.status).toBe(403);
    expect(createRes.status).toBe(403);
    expect(updateRes.status).toBe(403);
    expect(deleteRes.status).toBe(403);

    const schedule = await prisma.scheduledReport.findUnique({ where: { id: scheduleId } });
    expect(schedule).toBeDefined();
    expect(schedule?.isActive).toBe(true);
  });
});

describe('Reports API - Lot Status Report', () => {
  let authToken: string;
  let userId: string;
  let companyId: string;
  let projectId: string;

  beforeAll(async () => {
    // Create test company
    const company = await prisma.company.create({
      data: { name: `Reports Test Company ${Date.now()}` },
    });
    companyId = company.id;

    // Create test user
    const testEmail = `reports-test-${Date.now()}@example.com`;
    const regRes = await request(app).post('/api/auth/register').send({
      email: testEmail,
      password: 'SecureP@ssword123!',
      fullName: 'Reports Test User',
      tosAccepted: true,
    });
    authToken = regRes.body.token;
    userId = regRes.body.user.id;

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'admin' },
    });

    // Create project
    const project = await prisma.project.create({
      data: {
        name: `Reports Test Project ${Date.now()}`,
        projectNumber: `RPT-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    projectId = project.id;

    await prisma.projectUser.create({
      data: { projectId, userId, role: 'admin', status: 'active' },
    });

    // Create test lots with various statuses
    await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `RPT-LOT-1-${Date.now()}`,
        status: 'conformed',
        lotType: 'chainage',
        activityType: 'Earthworks',
        description: 'Test earthworks lot',
        conformedAt: new Date(),
        conformedById: userId,
      },
    });

    await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `RPT-LOT-2-${Date.now()}`,
        status: 'in_progress',
        lotType: 'chainage',
        activityType: 'Pavement',
        description: 'Test pavement lot',
      },
    });
  });

  afterAll(async () => {
    await prisma.lot.deleteMany({ where: { projectId } });
    await prisma.projectUser.deleteMany({ where: { projectId } });
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
    await prisma.emailVerificationToken.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  });

  it('should require authentication', async () => {
    const res = await request(app).get('/api/reports/lot-status').query({ projectId });

    expect(res.status).toBe(401);
  });

  it('should require projectId parameter', async () => {
    const res = await request(app)
      .get('/api/reports/lot-status')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('projectId');
  });

  it('should generate lot status report', async () => {
    const res = await request(app)
      .get('/api/reports/lot-status')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId });

    expect(res.status).toBe(200);
    expect(res.body.generatedAt).toBeDefined();
    expect(res.body.projectId).toBe(projectId);
    expect(res.body.totalLots).toBe(2);
    expect(res.body.lots).toBeDefined();
    expect(Array.isArray(res.body.lots)).toBe(true);
    expect(res.body.statusCounts).toBeDefined();
    expect(res.body.activityCounts).toBeDefined();
    expect(res.body.summary).toBeDefined();
    expect(res.body.periodComparison).toBeDefined();
  });

  it('should include status counts', async () => {
    const res = await request(app)
      .get('/api/reports/lot-status')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId });

    expect(res.status).toBe(200);
    expect(res.body.statusCounts.conformed).toBe(1);
    expect(res.body.statusCounts.in_progress).toBe(1);
    expect(res.body.summary.conformed).toBe(1);
    expect(res.body.summary.inProgress).toBe(1);
  });

  it('should include activity type counts', async () => {
    const res = await request(app)
      .get('/api/reports/lot-status')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId });

    expect(res.status).toBe(200);
    expect(res.body.activityCounts.Earthworks).toBe(1);
    expect(res.body.activityCounts.Pavement).toBe(1);
  });

  it('should include period comparison data', async () => {
    const res = await request(app)
      .get('/api/reports/lot-status')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId });

    expect(res.status).toBe(200);
    expect(res.body.periodComparison.conformedThisPeriod).toBeDefined();
    expect(res.body.periodComparison.conformedLastPeriod).toBeDefined();
    expect(res.body.periodComparison.periodChange).toBeDefined();
    expect(res.body.periodComparison.periodChangePercent).toBeDefined();
  });

  it('should support pagination', async () => {
    const res = await request(app)
      .get('/api/reports/lot-status')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId, page: 1, limit: 1 });

    expect(res.status).toBe(200);
    expect(res.body.lots.length).toBe(1);
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.limit).toBe(1);
    expect(res.body.pagination.total).toBe(2);
    expect(res.body.pagination.totalPages).toBe(2);
    expect(res.body.statusCounts.conformed).toBe(1);
    expect(res.body.statusCounts.in_progress).toBe(1);
  });

  it('should cap pagination limit at 500', async () => {
    const res = await request(app)
      .get('/api/reports/lot-status')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId, limit: 1000 });

    expect(res.status).toBe(200);
    expect(res.body.pagination.limit).toBe(500);
  });

  it('should reject invalid pagination parameters', async () => {
    const negativePageRes = await request(app)
      .get('/api/reports/lot-status')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId, page: -1 });

    const zeroLimitRes = await request(app)
      .get('/api/reports/lot-status')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId, limit: 0 });

    expect(negativePageRes.status).toBe(400);
    expect(negativePageRes.body.error.message).toContain('page');
    expect(zeroLimitRes.status).toBe(400);
    expect(zeroLimitRes.body.error.message).toContain('limit');
  });
});

describe('Reports API - NCR Report', () => {
  let authToken: string;
  let userId: string;
  let companyId: string;
  let projectId: string;

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `NCR Reports Test Company ${Date.now()}` },
    });
    companyId = company.id;

    const testEmail = `ncr-reports-test-${Date.now()}@example.com`;
    const regRes = await request(app).post('/api/auth/register').send({
      email: testEmail,
      password: 'SecureP@ssword123!',
      fullName: 'NCR Reports Test User',
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
        name: `NCR Reports Test Project ${Date.now()}`,
        projectNumber: `NCRRPT-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    projectId = project.id;

    await prisma.projectUser.create({
      data: { projectId, userId, role: 'admin', status: 'active' },
    });

    // Create test NCRs
    await prisma.nCR.create({
      data: {
        projectId,
        ncrNumber: 'NCR-001',
        description: 'Test NCR 1',
        category: 'minor',
        status: 'open',
        raisedAt: new Date(),
        raisedById: userId,
        rootCauseCategory: 'workmanship',
      },
    });

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    await prisma.nCR.create({
      data: {
        projectId,
        ncrNumber: 'NCR-002',
        description: 'Test NCR 2',
        category: 'major',
        status: 'closed',
        raisedAt: yesterday,
        raisedById: userId,
        closedAt: new Date(),
        rootCauseCategory: 'materials',
        responsibleUserId: userId,
      },
    });
  });

  afterAll(async () => {
    await prisma.nCR.deleteMany({ where: { projectId } });
    await prisma.projectUser.deleteMany({ where: { projectId } });
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
    await prisma.emailVerificationToken.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  });

  it('should require projectId parameter', async () => {
    const res = await request(app)
      .get('/api/reports/ncr')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('projectId');
  });

  it('should generate NCR report', async () => {
    const res = await request(app)
      .get('/api/reports/ncr')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId });

    expect(res.status).toBe(200);
    expect(res.body.generatedAt).toBeDefined();
    expect(res.body.projectId).toBe(projectId);
    expect(res.body.totalNCRs).toBe(2);
    expect(res.body.ncrs).toBeDefined();
    expect(Array.isArray(res.body.ncrs)).toBe(true);
    expect(res.body.statusCounts).toBeDefined();
    expect(res.body.categoryCounts).toBeDefined();
    expect(res.body.rootCauseCounts).toBeDefined();
  });

  it('should include status counts', async () => {
    const res = await request(app)
      .get('/api/reports/ncr')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId });

    expect(res.status).toBe(200);
    expect(res.body.statusCounts.open).toBe(1);
    expect(res.body.statusCounts.closed).toBe(1);
    expect(res.body.summary.open).toBe(1);
    expect(res.body.summary.closed).toBe(1);
  });

  it('should include category counts', async () => {
    const res = await request(app)
      .get('/api/reports/ncr')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId });

    expect(res.status).toBe(200);
    expect(res.body.categoryCounts.minor).toBe(1);
    expect(res.body.categoryCounts.major).toBe(1);
    expect(res.body.summary.minor).toBe(1);
    expect(res.body.summary.major).toBe(1);
  });

  it('should include root cause counts', async () => {
    const res = await request(app)
      .get('/api/reports/ncr')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId });

    expect(res.status).toBe(200);
    expect(res.body.rootCauseCounts.workmanship).toBe(1);
    expect(res.body.rootCauseCounts.materials).toBe(1);
  });

  it('should include responsible party counts', async () => {
    const res = await request(app)
      .get('/api/reports/ncr')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId });

    expect(res.status).toBe(200);
    expect(res.body.responsiblePartyCounts).toBeDefined();
  });

  it('should calculate closure metrics', async () => {
    const res = await request(app)
      .get('/api/reports/ncr')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId });

    expect(res.status).toBe(200);
    expect(res.body.closureRate).toBeDefined();
    expect(res.body.averageClosureTime).toBeDefined();
    expect(res.body.overdueCount).toBeDefined();
  });

  it('should support pagination', async () => {
    const res = await request(app)
      .get('/api/reports/ncr')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId, page: 1, limit: 1 });

    expect(res.status).toBe(200);
    expect(res.body.ncrs.length).toBe(1);
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.limit).toBe(1);
    expect(res.body.pagination.total).toBe(2);
    expect(res.body.statusCounts.open).toBe(1);
    expect(res.body.statusCounts.closed).toBe(1);
  });
});

describe('Reports API - Test Results Report', () => {
  let authToken: string;
  let userId: string;
  let companyId: string;
  let projectId: string;
  let lotId: string;

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `Test Reports Company ${Date.now()}` },
    });
    companyId = company.id;

    const testEmail = `test-reports-${Date.now()}@example.com`;
    const regRes = await request(app).post('/api/auth/register').send({
      email: testEmail,
      password: 'SecureP@ssword123!',
      fullName: 'Test Reports User',
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
        name: `Test Reports Project ${Date.now()}`,
        projectNumber: `TESTRPT-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    projectId = project.id;

    await prisma.projectUser.create({
      data: { projectId, userId, role: 'admin', status: 'active' },
    });

    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `TEST-LOT-${Date.now()}`,
        status: 'awaiting_test',
        lotType: 'chainage',
        activityType: 'Earthworks',
      },
    });
    lotId = lot.id;

    // Create test results
    await prisma.testResult.create({
      data: {
        projectId,
        lotId,
        testRequestNumber: 'TR-001',
        testType: 'Compaction',
        sampleDate: new Date(),
        status: 'completed',
        passFail: 'pass',
        resultValue: 98,
        resultUnit: '%',
        specificationMin: 95,
      },
    });

    await prisma.testResult.create({
      data: {
        projectId,
        lotId,
        testRequestNumber: 'TR-002',
        testType: 'Moisture',
        sampleDate: new Date(),
        status: 'completed',
        passFail: 'fail',
        resultValue: 12,
        resultUnit: '%',
        specificationMax: 10,
      },
    });
  });

  afterAll(async () => {
    await prisma.testResult.deleteMany({ where: { projectId } });
    await prisma.lot.deleteMany({ where: { projectId } });
    await prisma.projectUser.deleteMany({ where: { projectId } });
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
    await prisma.emailVerificationToken.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  });

  it('should require projectId parameter', async () => {
    const res = await request(app)
      .get('/api/reports/test')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('projectId');
  });

  it('should generate test results report', async () => {
    const res = await request(app)
      .get('/api/reports/test')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId });

    expect(res.status).toBe(200);
    expect(res.body.generatedAt).toBeDefined();
    expect(res.body.projectId).toBe(projectId);
    expect(res.body.totalTests).toBe(2);
    expect(res.body.tests).toBeDefined();
    expect(Array.isArray(res.body.tests)).toBe(true);
    expect(res.body.passFailCounts).toBeDefined();
    expect(res.body.testTypeCounts).toBeDefined();
  });

  it('should include pass/fail counts', async () => {
    const res = await request(app)
      .get('/api/reports/test')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId });

    expect(res.status).toBe(200);
    expect(res.body.passFailCounts.pass).toBe(1);
    expect(res.body.passFailCounts.fail).toBe(1);
    expect(res.body.summary.pass).toBe(1);
    expect(res.body.summary.fail).toBe(1);
    expect(res.body.summary.passRate).toBeDefined();
  });

  it('should include test type counts', async () => {
    const res = await request(app)
      .get('/api/reports/test')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId });

    expect(res.status).toBe(200);
    expect(res.body.testTypeCounts.Compaction).toBe(1);
    expect(res.body.testTypeCounts.Moisture).toBe(1);
  });

  it('should filter by date range', async () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const res = await request(app)
      .get('/api/reports/test')
      .set('Authorization', `Bearer ${authToken}`)
      .query({
        projectId,
        startDate: today.toISOString().split('T')[0],
        endDate: tomorrow.toISOString().split('T')[0],
      });

    expect(res.status).toBe(200);
    expect(res.body.tests.length).toBe(2);
  });

  it('should reject invalid test report query filters', async () => {
    const invalidDateRes = await request(app)
      .get('/api/reports/test')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId, startDate: 'not-a-date' });

    const invalidCalendarDateRes = await request(app)
      .get('/api/reports/test')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId, startDate: '2026-02-30' });

    const invalidCalendarDateTimeRes = await request(app)
      .get('/api/reports/test')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId, startDate: '2026-02-30T10:00:00Z' });

    const repeatedFilterRes = await request(app)
      .get(
        `/api/reports/test?projectId=${encodeURIComponent(projectId)}&testTypes=Compaction&testTypes=Moisture`,
      )
      .set('Authorization', `Bearer ${authToken}`);

    expect(invalidDateRes.status).toBe(400);
    expect(invalidDateRes.body.error.message).toContain('startDate');
    expect(invalidCalendarDateRes.status).toBe(400);
    expect(invalidCalendarDateRes.body.error.message).toContain('startDate');
    expect(invalidCalendarDateTimeRes.status).toBe(400);
    expect(invalidCalendarDateTimeRes.body.error.message).toContain('startDate');
    expect(repeatedFilterRes.status).toBe(400);
    expect(repeatedFilterRes.body.error.message).toContain('testTypes');
  });

  it('should filter by test types', async () => {
    const res = await request(app)
      .get('/api/reports/test')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId, testTypes: 'Compaction' });

    expect(res.status).toBe(200);
    expect(res.body.tests.length).toBe(1);
    expect(res.body.tests[0].testType).toBe('Compaction');
  });

  it('should filter by lot IDs', async () => {
    const res = await request(app)
      .get('/api/reports/test')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId, lotIds: lotId });

    expect(res.status).toBe(200);
    expect(res.body.tests.length).toBe(2);
  });

  it('should support pagination', async () => {
    const res = await request(app)
      .get('/api/reports/test')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId, page: 1, limit: 1 });

    expect(res.status).toBe(200);
    expect(res.body.tests.length).toBe(1);
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.limit).toBe(1);
    expect(res.body.passFailCounts.pass).toBe(1);
    expect(res.body.passFailCounts.fail).toBe(1);
  });
});

describe('Reports API - Diary Report', () => {
  let authToken: string;
  let userId: string;
  let companyId: string;
  let projectId: string;
  let diaryId: string;

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `Diary Reports Company ${Date.now()}` },
    });
    companyId = company.id;

    const testEmail = `diary-reports-${Date.now()}@example.com`;
    const regRes = await request(app).post('/api/auth/register').send({
      email: testEmail,
      password: 'SecureP@ssword123!',
      fullName: 'Diary Reports User',
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
        name: `Diary Reports Project ${Date.now()}`,
        projectNumber: `DIARYRPT-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    projectId = project.id;

    await prisma.projectUser.create({
      data: { projectId, userId, role: 'admin', status: 'active' },
    });

    // Create a diary entry
    const diary = await prisma.dailyDiary.create({
      data: {
        projectId,
        date: new Date(),
        status: 'submitted',
        submittedById: userId,
        submittedAt: new Date(),
        weatherConditions: 'Fine',
        temperatureMin: 18,
        temperatureMax: 28,
      },
    });
    diaryId = diary.id;

    // Add personnel entry
    await prisma.diaryPersonnel.create({
      data: {
        diaryId,
        name: 'Test Worker',
        role: 'Foreman',
        company: 'Test Company',
        hours: 8,
      },
    });
  });

  afterAll(async () => {
    await prisma.diaryPersonnel.deleteMany({ where: { diary: { projectId } } });
    await prisma.dailyDiary.deleteMany({ where: { projectId } });
    await prisma.projectUser.deleteMany({ where: { projectId } });
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
    await prisma.emailVerificationToken.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  });

  it('should require projectId parameter', async () => {
    const res = await request(app)
      .get('/api/reports/diary')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('projectId');
  });

  it('should generate diary report with default sections', async () => {
    const res = await request(app)
      .get('/api/reports/diary')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId });

    expect(res.status).toBe(200);
    expect(res.body.generatedAt).toBeDefined();
    expect(res.body.projectId).toBe(projectId);
    expect(res.body.totalDiaries).toBe(1);
    expect(res.body.diaries).toBeDefined();
    expect(Array.isArray(res.body.diaries)).toBe(true);
    expect(res.body.selectedSections).toEqual([
      'weather',
      'personnel',
      'plant',
      'activities',
      'delays',
    ]);
  });

  it('should filter by selected sections', async () => {
    const res = await request(app)
      .get('/api/reports/diary')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId, sections: 'weather,personnel' });

    expect(res.status).toBe(200);
    expect(res.body.selectedSections).toEqual(['weather', 'personnel']);
    expect(res.body.diaries[0].weatherConditions).toBeDefined();
    expect(res.body.diaries[0].personnel).toBeDefined();
  });

  it('should reject invalid diary sections', async () => {
    const res = await request(app)
      .get('/api/reports/diary')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId, sections: 'weather,invalid' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('sections');
  });

  it('should include weather summary when selected', async () => {
    const res = await request(app)
      .get('/api/reports/diary')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId, sections: 'weather' });

    expect(res.status).toBe(200);
    expect(res.body.summary.weather).toBeDefined();
    expect(res.body.summary.weather.Fine).toBe(1);
  });

  it('should include personnel summary when selected', async () => {
    const res = await request(app)
      .get('/api/reports/diary')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId, sections: 'personnel' });

    expect(res.status).toBe(200);
    expect(res.body.summary.personnel).toBeDefined();
    expect(res.body.summary.personnel.totalPersonnel).toBeGreaterThan(0);
    expect(res.body.summary.personnel.totalHours).toBeGreaterThan(0);
  });

  it('should filter by date range', async () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const res = await request(app)
      .get('/api/reports/diary')
      .set('Authorization', `Bearer ${authToken}`)
      .query({
        projectId,
        startDate: today.toISOString().split('T')[0],
        endDate: tomorrow.toISOString().split('T')[0],
      });

    expect(res.status).toBe(200);
    expect(res.body.diaries.length).toBe(1);
  });

  it('should support pagination', async () => {
    const res = await request(app)
      .get('/api/reports/diary')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId, page: 1, limit: 10 });

    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.limit).toBe(10);
  });
});

describe('Reports API - Summary Report', () => {
  let authToken: string;
  let userId: string;
  let companyId: string;
  let projectId: string;

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `Summary Reports Company ${Date.now()}` },
    });
    companyId = company.id;

    const testEmail = `summary-reports-${Date.now()}@example.com`;
    const regRes = await request(app).post('/api/auth/register').send({
      email: testEmail,
      password: 'SecureP@ssword123!',
      fullName: 'Summary Reports User',
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
        name: `Summary Reports Project ${Date.now()}`,
        projectNumber: `SUMRPT-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    projectId = project.id;

    await prisma.projectUser.create({
      data: { projectId, userId, role: 'admin', status: 'active' },
    });

    // Create sample data
    await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `SUM-LOT-${Date.now()}`,
        status: 'conformed',
        lotType: 'chainage',
        activityType: 'Earthworks',
      },
    });

    await prisma.nCR.create({
      data: {
        projectId,
        ncrNumber: 'NCR-SUM-001',
        description: 'Summary test NCR',
        category: 'minor',
        status: 'open',
        raisedAt: new Date(),
        raisedById: userId,
      },
    });
  });

  afterAll(async () => {
    await prisma.testResult.deleteMany({ where: { projectId } });
    await prisma.nCR.deleteMany({ where: { projectId } });
    await prisma.lot.deleteMany({ where: { projectId } });
    await prisma.projectUser.deleteMany({ where: { projectId } });
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
    await prisma.emailVerificationToken.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  });

  it('should require projectId parameter', async () => {
    const res = await request(app)
      .get('/api/reports/summary')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('projectId');
  });

  it('should generate summary report', async () => {
    const res = await request(app)
      .get('/api/reports/summary')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId });

    expect(res.status).toBe(200);
    expect(res.body.generatedAt).toBeDefined();
    expect(res.body.projectId).toBe(projectId);
    expect(res.body.lots).toBeDefined();
    expect(res.body.ncrs).toBeDefined();
    expect(res.body.tests).toBeDefined();
    expect(res.body.holdPoints).toBeDefined();
  });

  it('should include lot summary statistics', async () => {
    const res = await request(app)
      .get('/api/reports/summary')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId });

    expect(res.status).toBe(200);
    expect(res.body.lots.total).toBe(1);
    expect(res.body.lots.conformed).toBe(1);
    expect(res.body.lots.conformedPercent).toBeDefined();
  });

  it('should include NCR summary statistics', async () => {
    const res = await request(app)
      .get('/api/reports/summary')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId });

    expect(res.status).toBe(200);
    expect(res.body.ncrs.total).toBe(1);
    expect(res.body.ncrs.open).toBe(1);
    expect(res.body.ncrs.closed).toBe(0);
  });

  it('should include test summary statistics', async () => {
    const res = await request(app)
      .get('/api/reports/summary')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId });

    expect(res.status).toBe(200);
    expect(res.body.tests.total).toBeDefined();
    expect(res.body.tests.passRate).toBeDefined();
  });
});

describe('Reports API - Claims Report', () => {
  let authToken: string;
  let userId: string;
  let companyId: string;
  let projectId: string;

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `Claims Reports Company ${Date.now()}` },
    });
    companyId = company.id;

    const testEmail = `claims-reports-${Date.now()}@example.com`;
    const regRes = await request(app).post('/api/auth/register').send({
      email: testEmail,
      password: 'SecureP@ssword123!',
      fullName: 'Claims Reports User',
      tosAccepted: true,
    });
    authToken = regRes.body.token;
    userId = regRes.body.user.id;

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'project_manager' },
    });

    const project = await prisma.project.create({
      data: {
        name: `Claims Reports Project ${Date.now()}`,
        projectNumber: `CLMRPT-${Date.now()}`,
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

    // Create a lot for claiming
    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `CLM-RPT-LOT-${Date.now()}`,
        status: 'conformed',
        lotType: 'chainage',
        activityType: 'Earthworks',
        budgetAmount: 5000,
      },
    });

    // Create a claim
    await prisma.progressClaim.create({
      data: {
        projectId,
        claimNumber: 1,
        claimPeriodStart: new Date('2025-01-01'),
        claimPeriodEnd: new Date('2025-01-31'),
        status: 'submitted',
        preparedById: userId,
        totalClaimedAmount: 5000,
        submittedAt: new Date(),
        claimedLots: {
          create: {
            lotId: lot.id,
            quantity: 1,
            unit: 'ea',
            rate: 5000,
            amountClaimed: 5000,
            percentageComplete: 100,
          },
        },
      },
    });
  });

  afterAll(async () => {
    await prisma.claimedLot.deleteMany({ where: { claim: { projectId } } });
    await prisma.progressClaim.deleteMany({ where: { projectId } });
    await prisma.lot.deleteMany({ where: { projectId } });
    await prisma.projectUser.deleteMany({ where: { projectId } });
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
    await prisma.emailVerificationToken.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  });

  it('should require projectId parameter', async () => {
    const res = await request(app)
      .get('/api/reports/claims')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('projectId');
  });

  it('should generate claims report', async () => {
    const res = await request(app)
      .get('/api/reports/claims')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId });

    expect(res.status).toBe(200);
    expect(res.body.generatedAt).toBeDefined();
    expect(res.body.projectId).toBe(projectId);
    expect(res.body.totalClaims).toBe(1);
    expect(res.body.claims).toBeDefined();
    expect(Array.isArray(res.body.claims)).toBe(true);
  });

  it('should include financial summary', async () => {
    const res = await request(app)
      .get('/api/reports/claims')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId });

    expect(res.status).toBe(200);
    expect(res.body.financialSummary).toBeDefined();
    expect(res.body.financialSummary.totalClaimed).toBe(5000);
    expect(res.body.financialSummary.certificationRate).toBeDefined();
    expect(res.body.financialSummary.collectionRate).toBeDefined();
  });

  it('should include status counts', async () => {
    const res = await request(app)
      .get('/api/reports/claims')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId });

    expect(res.status).toBe(200);
    expect(res.body.statusCounts).toBeDefined();
    expect(res.body.statusCounts.submitted).toBe(1);
  });

  it('should include monthly breakdown', async () => {
    const res = await request(app)
      .get('/api/reports/claims')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId });

    expect(res.status).toBe(200);
    expect(res.body.monthlyBreakdown).toBeDefined();
    expect(Array.isArray(res.body.monthlyBreakdown)).toBe(true);
  });

  it('should filter by status', async () => {
    const res = await request(app)
      .get('/api/reports/claims')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId, status: 'submitted' });

    expect(res.status).toBe(200);
    expect(res.body.claims.length).toBe(1);
    expect(res.body.claims[0].status).toBe('submitted');
  });

  it('should reject malformed claims report status filters', async () => {
    const invalidStatusRes = await request(app)
      .get('/api/reports/claims')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId, status: 'submitted,unknown' });

    expect(invalidStatusRes.status).toBe(400);
    expect(invalidStatusRes.body.error.message).toContain('status must be one of');

    const repeatedStatusRes = await request(app)
      .get('/api/reports/claims')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId, status: ['submitted', 'paid'] });

    expect(repeatedStatusRes.status).toBe(400);
    expect(repeatedStatusRes.body.error.message).toContain('status must be a string');
  });

  it('should filter by date range', async () => {
    const res = await request(app)
      .get('/api/reports/claims')
      .set('Authorization', `Bearer ${authToken}`)
      .query({
        projectId,
        startDate: '2025-01-01',
        endDate: '2025-01-31',
      });

    expect(res.status).toBe(200);
    expect(res.body.claims.length).toBe(1);
  });

  it('should include export data', async () => {
    const res = await request(app)
      .get('/api/reports/claims')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ projectId });

    expect(res.status).toBe(200);
    expect(res.body.exportData).toBeDefined();
    expect(Array.isArray(res.body.exportData)).toBe(true);
    expect(res.body.exportData[0]['Claim #']).toBe(1);
  });
});

describe('Reports API - Scheduled Reports', () => {
  let authToken: string;
  let userId: string;
  let companyId: string;
  let projectId: string;
  let scheduleId: string;

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: {
        name: `Scheduled Reports Company ${Date.now()}`,
        subscriptionTier: 'professional',
      },
    });
    companyId = company.id;

    const testEmail = `scheduled-reports-${Date.now()}@example.com`;
    const regRes = await request(app).post('/api/auth/register').send({
      email: testEmail,
      password: 'SecureP@ssword123!',
      fullName: 'Scheduled Reports User',
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
        name: `Scheduled Reports Project ${Date.now()}`,
        projectNumber: `SCHEDRPT-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    projectId = project.id;

    await prisma.projectUser.create({
      data: { projectId, userId, role: 'admin', status: 'active' },
    });
  });

  afterAll(async () => {
    await prisma.scheduledReport.deleteMany({ where: { projectId } });
    await prisma.projectUser.deleteMany({ where: { projectId } });
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
    await prisma.emailVerificationToken.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  });

  describe('GET /api/reports/schedules', () => {
    it('should require projectId parameter', async () => {
      const res = await request(app)
        .get('/api/reports/schedules')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('projectId');
    });

    it('should reject repeated projectId query parameters', async () => {
      const encodedProjectId = encodeURIComponent(projectId);
      const res = await request(app)
        .get(`/api/reports/schedules?projectId=${encodedProjectId}&projectId=${encodedProjectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('projectId');
    });

    it('should list scheduled reports', async () => {
      const res = await request(app)
        .get('/api/reports/schedules')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ projectId });

      expect(res.status).toBe(200);
      expect(res.body.schedules).toBeDefined();
      expect(Array.isArray(res.body.schedules)).toBe(true);
      expect(res.body.maxSchedules).toBe(25);
    });
  });

  describe('POST /api/reports/schedules', () => {
    it('should create a scheduled report', async () => {
      const res = await request(app)
        .post('/api/reports/schedules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          reportType: 'lot-status',
          frequency: 'weekly',
          dayOfWeek: 1,
          timeOfDay: '09:00',
          recipients: 'test@example.com,test2@example.com',
        });

      expect(res.status).toBe(201);
      expect(res.body.schedule).toBeDefined();
      expect(res.body.schedule.reportType).toBe('lot-status');
      expect(res.body.schedule.frequency).toBe('weekly');
      expect(res.body.schedule.isActive).toBe(true);
      scheduleId = res.body.schedule.id;
    });

    it('should normalize and deduplicate recipient lists', async () => {
      const res = await request(app)
        .post('/api/reports/schedules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          reportType: 'ncr',
          frequency: 'daily',
          recipients: [
            ' Test@Example.com ',
            'test@example.com',
            'Second@Example.com; third@example.com',
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.schedule.recipients).toBe(
        'test@example.com,second@example.com,third@example.com',
      );
      expect(res.body.schedule.dayOfWeek).toBeNull();
      expect(res.body.schedule.dayOfMonth).toBeNull();
      expect(res.body.schedule.timeOfDay).toBe('09:00');
    });

    it('should reject invalid frequency', async () => {
      const res = await request(app)
        .post('/api/reports/schedules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          reportType: 'lot-status',
          frequency: 'invalid',
          recipients: 'test@example.com',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('frequency');
    });

    it('should reject invalid report type', async () => {
      const res = await request(app)
        .post('/api/reports/schedules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          reportType: 'invalid',
          frequency: 'daily',
          recipients: 'test@example.com',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('reportType');
    });

    it('should reject invalid recipients', async () => {
      const res = await request(app)
        .post('/api/reports/schedules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          reportType: 'lot-status',
          frequency: 'daily',
          recipients: 'test@example.com,not-an-email',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('recipients');

      const oversizedRes = await request(app)
        .post('/api/reports/schedules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          reportType: 'lot-status',
          frequency: 'daily',
          recipients: 'a'.repeat(13001),
        });

      expect(oversizedRes.status).toBe(400);
      expect(oversizedRes.body.error.message).toContain('recipients is too long');
    });

    it('should reject invalid schedule timing values', async () => {
      const invalidTimeRes = await request(app)
        .post('/api/reports/schedules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          reportType: 'lot-status',
          frequency: 'daily',
          timeOfDay: '25:00',
          recipients: 'test@example.com',
        });

      const invalidDayOfWeekRes = await request(app)
        .post('/api/reports/schedules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          reportType: 'lot-status',
          frequency: 'weekly',
          dayOfWeek: 7,
          recipients: 'test@example.com',
        });

      const invalidDayOfMonthRes = await request(app)
        .post('/api/reports/schedules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          reportType: 'lot-status',
          frequency: 'monthly',
          dayOfMonth: 0,
          recipients: 'test@example.com',
        });

      expect(invalidTimeRes.status).toBe(400);
      expect(invalidTimeRes.body.error.message).toContain('timeOfDay');
      expect(invalidDayOfWeekRes.status).toBe(400);
      expect(invalidDayOfWeekRes.body.error.message).toContain('dayOfWeek');
      expect(invalidDayOfMonthRes.status).toBe(400);
      expect(invalidDayOfMonthRes.body.error.message).toContain('dayOfMonth');
    });

    it('should require recipients', async () => {
      const res = await request(app)
        .post('/api/reports/schedules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          reportType: 'lot-status',
          frequency: 'daily',
        });

      expect(res.status).toBe(400);
    });

    it('should require a Professional or Enterprise subscription', async () => {
      await prisma.company.update({
        where: { id: companyId },
        data: { subscriptionTier: 'basic' },
      });

      try {
        const listRes = await request(app)
          .get('/api/reports/schedules')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ projectId });

        const res = await request(app)
          .post('/api/reports/schedules')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            projectId,
            reportType: 'lot-status',
            frequency: 'daily',
            recipients: 'basic-tier@example.com',
          });

        expect(listRes.status).toBe(403);
        expect(listRes.body.error.message).toContain('Professional or Enterprise');
        expect(res.status).toBe(403);
        expect(res.body.error.message).toContain('Professional or Enterprise');
      } finally {
        await prisma.company.update({
          where: { id: companyId },
          data: { subscriptionTier: 'professional' },
        });
      }
    });

    it('should enforce the per-project scheduled report cap', async () => {
      const existingCount = await prisma.scheduledReport.count({ where: { projectId } });
      const fixtures = await Promise.all(
        Array.from({ length: Math.max(0, 25 - existingCount) }, (_, index) =>
          prisma.scheduledReport.create({
            data: {
              projectId,
              reportType: 'ncr',
              frequency: 'daily',
              timeOfDay: '09:00',
              recipients: `cap-${index}@example.com`,
              nextRunAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
              createdById: userId,
              isActive: true,
            },
          }),
        ),
      );

      try {
        const res = await request(app)
          .post('/api/reports/schedules')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            projectId,
            reportType: 'diary',
            frequency: 'daily',
            recipients: 'over-cap@example.com',
          });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('25 scheduled reports');
      } finally {
        await prisma.scheduledReport.deleteMany({
          where: { id: { in: fixtures.map((fixture) => fixture.id) } },
        });
      }
    });
  });

  describe('PUT /api/reports/schedules/:id', () => {
    it('should update a scheduled report', async () => {
      const res = await request(app)
        .put(`/api/reports/schedules/${scheduleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          frequency: 'daily',
          timeOfDay: '10:00',
        });

      expect(res.status).toBe(200);
      expect(res.body.schedule.frequency).toBe('daily');
      expect(res.body.schedule.timeOfDay).toBe('10:00');
    });

    it('should normalize recipient updates', async () => {
      const res = await request(app)
        .put(`/api/reports/schedules/${scheduleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          recipients: ' Updated@Example.com; updated@example.com\nother@example.com ',
        });

      expect(res.status).toBe(200);
      expect(res.body.schedule.recipients).toBe('updated@example.com,other@example.com');
    });

    it('should reject invalid schedule update values', async () => {
      const invalidTimeRes = await request(app)
        .put(`/api/reports/schedules/${scheduleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          timeOfDay: '24:00',
        });

      const invalidActiveRes = await request(app)
        .put(`/api/reports/schedules/${scheduleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          isActive: 'false',
        });

      expect(invalidTimeRes.status).toBe(400);
      expect(invalidTimeRes.body.error.message).toContain('timeOfDay');
      expect(invalidActiveRes.status).toBe(400);
      expect(invalidActiveRes.body.error.message).toContain('isActive');
    });

    it('should deactivate a scheduled report', async () => {
      const res = await request(app)
        .put(`/api/reports/schedules/${scheduleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          isActive: false,
        });

      expect(res.status).toBe(200);
      expect(res.body.schedule.isActive).toBe(false);
    });

    it('should return 404 for non-existent schedule', async () => {
      const res = await request(app)
        .put('/api/reports/schedules/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          frequency: 'daily',
        });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/reports/schedules/:id', () => {
    it('should delete a scheduled report', async () => {
      const res = await request(app)
        .delete(`/api/reports/schedules/${scheduleId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 for non-existent schedule', async () => {
      const res = await request(app)
        .delete('/api/reports/schedules/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });
  });
});
