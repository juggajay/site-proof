import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { dashboardRouter } from './dashboard.js';
import { authRouter } from './auth.js';
import { prisma } from '../lib/prisma.js';
import { errorHandler } from '../middleware/errorHandler.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/dashboard', dashboardRouter);
app.use(errorHandler);

const TEST_PASSWORD = 'SecureP@ssword123!';

async function registerDashboardUser(
  prefix: string,
  fullName: string,
  companyId?: string,
  roleInCompany = 'viewer',
) {
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const res = await request(app).post('/api/auth/register').send({
    email,
    password: TEST_PASSWORD,
    fullName,
    tosAccepted: true,
  });

  if (companyId) {
    await prisma.user.update({
      where: { id: res.body.user.id },
      data: { companyId, roleInCompany },
    });
  }

  return {
    token: res.body.token as string,
    userId: res.body.user.id as string,
  };
}

async function cleanupDashboardUser(userId: string) {
  await prisma.projectUser.deleteMany({ where: { userId } });
  await prisma.emailVerificationToken.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
}

describe('Dashboard Stats API', () => {
  let authToken: string;
  let userId: string;
  let companyId: string;
  let projectId: string;
  let lotId: string;

  beforeAll(async () => {
    // Create test company
    const company = await prisma.company.create({
      data: { name: `Dashboard Test Company ${Date.now()}` },
    });
    companyId = company.id;

    // Create test user
    const testEmail = `dashboard-test-${Date.now()}@example.com`;
    const regRes = await request(app).post('/api/auth/register').send({
      email: testEmail,
      password: 'SecureP@ssword123!',
      fullName: 'Dashboard Test User',
      tosAccepted: true,
    });
    authToken = regRes.body.token;
    userId = regRes.body.user.id;

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'admin' },
    });

    // Create test project
    const project = await prisma.project.create({
      data: {
        name: 'Dashboard Test Project',
        projectNumber: `DASH-${Date.now()}`,
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

    // Create test lot
    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: 'LOT-001',
        lotType: 'general',
        activityType: 'earthworks',
        status: 'not_started',
      },
    });
    lotId = lot.id;
  });

  afterAll(async () => {
    // Clean up in reverse order of creation
    if (lotId) {
      await prisma.holdPoint.deleteMany({ where: { lotId } });
      await prisma.lot.delete({ where: { id: lotId } }).catch(() => {});
    }
    if (projectId) {
      await prisma.nCR.deleteMany({ where: { projectId } });
      await prisma.projectUser.deleteMany({ where: { projectId } });
      await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
    }
    await prisma.emailVerificationToken.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  });

  describe('GET /api/dashboard/stats', () => {
    it('should return dashboard stats for authenticated user', async () => {
      const res = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalProjects');
      expect(res.body).toHaveProperty('activeProjects');
      expect(res.body).toHaveProperty('totalLots');
      expect(res.body).toHaveProperty('openHoldPoints');
      expect(res.body).toHaveProperty('openNCRs');
      expect(res.body).toHaveProperty('attentionItems');
      expect(res.body).toHaveProperty('recentActivities');
    });

    it('should include correct project counts', async () => {
      const res = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.totalProjects).toBeGreaterThanOrEqual(1);
      expect(res.body.activeProjects).toBeGreaterThanOrEqual(1);
    });

    it('should include same-company projects for admins without explicit project membership', async () => {
      const companyAdmin = await registerDashboardUser(
        'dashboard-company-admin',
        'Dashboard Company Admin',
        companyId,
        'admin',
      );

      try {
        const res = await request(app)
          .get('/api/dashboard/stats')
          .set('Authorization', `Bearer ${companyAdmin.token}`);

        expect(res.status).toBe(200);
        expect(res.body.totalProjects).toBeGreaterThanOrEqual(1);
        expect(res.body.totalLots).toBeGreaterThanOrEqual(1);
      } finally {
        await cleanupDashboardUser(companyAdmin.userId);
      }
    });

    it('should include attention items structure', async () => {
      const res = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.attentionItems).toHaveProperty('overdueNCRs');
      expect(res.body.attentionItems).toHaveProperty('staleHoldPoints');
      expect(res.body.attentionItems).toHaveProperty('total');
      expect(Array.isArray(res.body.attentionItems.overdueNCRs)).toBe(true);
      expect(Array.isArray(res.body.attentionItems.staleHoldPoints)).toBe(true);
    });

    it('should return empty stats for user with no projects', async () => {
      // Create user without projects
      const noProjectEmail = `no-project-${Date.now()}@example.com`;
      const noProjectRes = await request(app).post('/api/auth/register').send({
        email: noProjectEmail,
        password: 'SecureP@ssword123!',
        fullName: 'No Project User',
        tosAccepted: true,
      });
      const noProjectToken = noProjectRes.body.token;
      const noProjectUserId = noProjectRes.body.user.id;

      const res = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${noProjectToken}`);

      expect(res.status).toBe(200);
      expect(res.body.totalProjects).toBe(0);
      expect(res.body.activeProjects).toBe(0);
      expect(res.body.totalLots).toBe(0);
      expect(res.body.openHoldPoints).toBe(0);
      expect(res.body.openNCRs).toBe(0);

      // Cleanup
      await prisma.emailVerificationToken.deleteMany({ where: { userId: noProjectUserId } });
      await prisma.user.delete({ where: { id: noProjectUserId } }).catch(() => {});
    });

    it('should exclude pending project memberships', async () => {
      const pendingEmail = `dashboard-pending-${Date.now()}@example.com`;
      const pendingRes = await request(app).post('/api/auth/register').send({
        email: pendingEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Pending Dashboard User',
        tosAccepted: true,
      });
      const pendingToken = pendingRes.body.token;
      const pendingUserId = pendingRes.body.user.id;

      await prisma.user.update({
        where: { id: pendingUserId },
        data: { companyId, roleInCompany: 'viewer' },
      });
      await prisma.projectUser.create({
        data: { projectId, userId: pendingUserId, role: 'viewer', status: 'pending' },
      });

      const res = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${pendingToken}`);

      expect(res.status).toBe(200);
      expect(res.body.totalProjects).toBe(0);
      expect(res.body.totalLots).toBe(0);
      expect(res.body.openHoldPoints).toBe(0);
      expect(res.body.openNCRs).toBe(0);

      await prisma.projectUser.deleteMany({ where: { projectId, userId: pendingUserId } });
      await prisma.emailVerificationToken.deleteMany({ where: { userId: pendingUserId } });
      await prisma.user.delete({ where: { id: pendingUserId } }).catch(() => {});
    });

    it('should not expose head contractor dashboard data to subcontractors with active project memberships', async () => {
      const suffix = Date.now();
      const subcontractorCompany = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `Dashboard Subcontractor ${suffix}`,
          primaryContactName: 'Dashboard Subcontractor',
          primaryContactEmail: `dashboard-sub-${suffix}@example.com`,
          status: 'approved',
        },
      });
      const subcontractor = await registerDashboardUser(
        'dashboard-subcontractor',
        'Dashboard Subcontractor',
        companyId,
        'subcontractor',
      );

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
          role: 'project_manager',
          status: 'active',
        },
      });

      try {
        const statsRes = await request(app)
          .get('/api/dashboard/stats')
          .set('Authorization', `Bearer ${subcontractor.token}`);

        expect(statsRes.status).toBe(200);
        expect(statsRes.body.totalProjects).toBe(0);
        expect(statsRes.body.totalLots).toBe(0);
        expect(statsRes.body.openHoldPoints).toBe(0);
        expect(statsRes.body.openNCRs).toBe(0);

        const projectManagerRes = await request(app)
          .get('/api/dashboard/project-manager')
          .set('Authorization', `Bearer ${subcontractor.token}`);

        expect(projectManagerRes.status).toBe(200);
        expect(projectManagerRes.body.project).toBeNull();
        expect(projectManagerRes.body.lotProgress.total).toBe(0);
      } finally {
        await prisma.subcontractorUser.deleteMany({
          where: { subcontractorCompanyId: subcontractorCompany.id },
        });
        await cleanupDashboardUser(subcontractor.userId);
        await prisma.subcontractorCompany
          .delete({ where: { id: subcontractorCompany.id } })
          .catch(() => {});
      }
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app).get('/api/dashboard/stats');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/dashboard/stats with NCRs', () => {
    let ncrId: string;

    beforeAll(async () => {
      // Create an overdue NCR
      const dueDate = new Date();
      dueDate.setHours(0, 0, 0, 0);
      dueDate.setDate(dueDate.getDate() - 3); // 3 days overdue

      const ncr = await prisma.nCR.create({
        data: {
          projectId,
          ncrNumber: 'NCR-001',
          description: 'Test overdue NCR',
          category: 'major',
          status: 'open',
          dueDate,
          raisedById: userId,
        },
      });
      ncrId = ncr.id;
    });

    afterAll(async () => {
      if (ncrId) {
        await prisma.nCR.delete({ where: { id: ncrId } }).catch(() => {});
      }
    });

    it('should include overdue NCRs in attention items', async () => {
      const res = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.openNCRs).toBeGreaterThanOrEqual(1);
      expect(res.body.attentionItems.overdueNCRs.length).toBeGreaterThanOrEqual(1);

      const overdueNCR = res.body.attentionItems.overdueNCRs.find((ncr: any) => ncr.id === ncrId);
      expect(overdueNCR).toBeDefined();
      expect(overdueNCR.daysOverdue).toBeGreaterThan(0);
      // ncrNumber might be returned under different field name or format
      if (overdueNCR.ncrNumber) {
        expect(overdueNCR.ncrNumber).toBe('NCR-001');
      }
    });
  });

  describe('GET /api/dashboard/stats with stale hold points', () => {
    let holdPointId: string;
    let itpTemplateId: string;
    let checklistItemId: string;

    beforeAll(async () => {
      // Create ITP template and checklist item (required for HoldPoint)
      const itpTemplate = await prisma.iTPTemplate.create({
        data: {
          projectId,
          name: 'Test ITP Template',
          activityType: 'earthworks',
        },
      });
      itpTemplateId = itpTemplate.id;

      const checklistItem = await prisma.iTPChecklistItem.create({
        data: {
          templateId: itpTemplateId,
          sequenceNumber: 1,
          description: 'Test hold point item',
          pointType: 'hold_point',
        },
      });
      checklistItemId = checklistItem.id;

      // Create a stale hold point (created 8 days ago)
      const staleDate = new Date();
      staleDate.setDate(staleDate.getDate() - 8);

      const hp = await prisma.holdPoint.create({
        data: {
          lotId,
          itpChecklistItemId: checklistItemId,
          pointType: 'hold_point',
          description: 'Stale hold point',
          status: 'pending',
          createdAt: staleDate,
        },
      });
      holdPointId = hp.id;
    });

    afterAll(async () => {
      if (holdPointId) {
        await prisma.holdPoint.delete({ where: { id: holdPointId } }).catch(() => {});
      }
      if (checklistItemId) {
        await prisma.iTPChecklistItem.delete({ where: { id: checklistItemId } }).catch(() => {});
      }
      if (itpTemplateId) {
        await prisma.iTPTemplate.delete({ where: { id: itpTemplateId } }).catch(() => {});
      }
    });

    it('should include stale hold points in attention items', async () => {
      const res = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.openHoldPoints).toBeGreaterThanOrEqual(1);
      expect(res.body.attentionItems.staleHoldPoints.length).toBeGreaterThanOrEqual(1);

      const staleHP = res.body.attentionItems.staleHoldPoints.find(
        (hp: any) => hp.id === holdPointId,
      );
      expect(staleHP).toBeDefined();
      expect(staleHP.daysStale).toBeGreaterThan(7);
    });
  });
});

describe('Portfolio Cash Flow API', () => {
  let authToken: string;
  let userId: string;
  let companyId: string;
  let projectId: string;
  let claimId: string;

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `Cashflow Test Company ${Date.now()}` },
    });
    companyId = company.id;

    const testEmail = `cashflow-test-${Date.now()}@example.com`;
    const regRes = await request(app).post('/api/auth/register').send({
      email: testEmail,
      password: 'SecureP@ssword123!',
      fullName: 'Cashflow Test User',
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
        name: 'Cashflow Test Project',
        projectNumber: `CF-${Date.now()}`,
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

    // Create a progress claim
    const claim = await prisma.progressClaim.create({
      data: {
        projectId,
        claimNumber: 1,
        claimPeriodStart: new Date(),
        claimPeriodEnd: new Date(),
        status: 'submitted',
        totalClaimedAmount: 100000,
        certifiedAmount: 95000,
        paidAmount: 50000,
      },
    });
    claimId = claim.id;
  });

  afterAll(async () => {
    if (claimId) {
      await prisma.progressClaim.delete({ where: { id: claimId } }).catch(() => {});
    }
    if (projectId) {
      await prisma.projectUser.deleteMany({ where: { projectId } });
      await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
    }
    await prisma.emailVerificationToken.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  });

  describe('GET /api/dashboard/portfolio-cashflow', () => {
    it('should return cash flow summary', async () => {
      const res = await request(app)
        .get('/api/dashboard/portfolio-cashflow')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalClaimed');
      expect(res.body).toHaveProperty('totalCertified');
      expect(res.body).toHaveProperty('totalPaid');
      expect(res.body).toHaveProperty('outstanding');
    });

    it('should calculate correct totals', async () => {
      const res = await request(app)
        .get('/api/dashboard/portfolio-cashflow')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.totalClaimed).toBe(100000);
      expect(res.body.totalCertified).toBe(95000);
      expect(res.body.totalPaid).toBe(50000);
      expect(res.body.outstanding).toBe(45000); // certified - paid
    });

    it('should include same-company projects for admins without explicit project membership', async () => {
      const companyAdmin = await registerDashboardUser(
        'cf-company-admin',
        'Cash Flow Company Admin',
        companyId,
        'admin',
      );

      try {
        const res = await request(app)
          .get('/api/dashboard/portfolio-cashflow')
          .set('Authorization', `Bearer ${companyAdmin.token}`);

        expect(res.status).toBe(200);
        expect(res.body.totalClaimed).toBe(100000);
        expect(res.body.totalCertified).toBe(95000);
        expect(res.body.totalPaid).toBe(50000);
        expect(res.body.outstanding).toBe(45000);
      } finally {
        await cleanupDashboardUser(companyAdmin.userId);
      }
    });

    it('should reject active project viewers from portfolio cash flow', async () => {
      const viewer = await registerDashboardUser(
        'cf-viewer',
        'Cash Flow Viewer',
        companyId,
        'viewer',
      );
      await prisma.projectUser.create({
        data: { projectId, userId: viewer.userId, role: 'viewer', status: 'active' },
      });

      try {
        const res = await request(app)
          .get('/api/dashboard/portfolio-cashflow')
          .set('Authorization', `Bearer ${viewer.token}`);

        expect(res.status).toBe(403);
      } finally {
        await cleanupDashboardUser(viewer.userId);
      }
    });

    it('should return zero values for user with no projects', async () => {
      const noProjectEmail = `cf-no-project-${Date.now()}@example.com`;
      const noProjectRes = await request(app).post('/api/auth/register').send({
        email: noProjectEmail,
        password: 'SecureP@ssword123!',
        fullName: 'No Project User',
        tosAccepted: true,
      });
      const noProjectToken = noProjectRes.body.token;
      const noProjectUserId = noProjectRes.body.user.id;

      const res = await request(app)
        .get('/api/dashboard/portfolio-cashflow')
        .set('Authorization', `Bearer ${noProjectToken}`);

      expect(res.status).toBe(200);
      expect(res.body.totalClaimed).toBe(0);
      expect(res.body.totalCertified).toBe(0);
      expect(res.body.totalPaid).toBe(0);
      expect(res.body.outstanding).toBe(0);

      // Cleanup
      await prisma.emailVerificationToken.deleteMany({ where: { userId: noProjectUserId } });
      await prisma.user.delete({ where: { id: noProjectUserId } }).catch(() => {});
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app).get('/api/dashboard/portfolio-cashflow');

      expect(res.status).toBe(401);
    });
  });
});

describe('Portfolio NCRs API', () => {
  let authToken: string;
  let userId: string;
  let companyId: string;
  let projectId: string;
  let majorNcrId: string;

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `NCR Portfolio Test Company ${Date.now()}` },
    });
    companyId = company.id;

    const testEmail = `ncr-portfolio-test-${Date.now()}@example.com`;
    const regRes = await request(app).post('/api/auth/register').send({
      email: testEmail,
      password: 'SecureP@ssword123!',
      fullName: 'NCR Portfolio Test User',
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
        name: 'NCR Portfolio Test Project',
        projectNumber: `NP-${Date.now()}`,
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

    // Create a major NCR
    const ncr = await prisma.nCR.create({
      data: {
        projectId,
        ncrNumber: 'NCR-MAJOR-001',
        description: 'Critical issue requiring attention',
        category: 'major',
        status: 'open',
        raisedById: userId,
      },
    });
    majorNcrId = ncr.id;
  });

  afterAll(async () => {
    if (majorNcrId) {
      await prisma.nCR.delete({ where: { id: majorNcrId } }).catch(() => {});
    }
    if (projectId) {
      await prisma.projectUser.deleteMany({ where: { projectId } });
      await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
    }
    await prisma.emailVerificationToken.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  });

  describe('GET /api/dashboard/portfolio-ncrs', () => {
    it('should return critical NCRs across projects', async () => {
      const res = await request(app)
        .get('/api/dashboard/portfolio-ncrs')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('ncrs');
      expect(Array.isArray(res.body.ncrs)).toBe(true);
    });

    it('should include major NCRs in results', async () => {
      const res = await request(app)
        .get('/api/dashboard/portfolio-ncrs')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.ncrs.length).toBeGreaterThanOrEqual(1);

      const majorNCR = res.body.ncrs.find((ncr: any) => ncr.id === majorNcrId);
      expect(majorNCR).toBeDefined();
      expect(majorNCR.category).toBe('major');
      expect(majorNCR.ncrNumber).toBe('NCR-MAJOR-001');
    });

    it('should include NCR details in response', async () => {
      const res = await request(app)
        .get('/api/dashboard/portfolio-ncrs')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      const ncr = res.body.ncrs[0];
      expect(ncr).toHaveProperty('id');
      expect(ncr).toHaveProperty('ncrNumber');
      expect(ncr).toHaveProperty('description');
      expect(ncr).toHaveProperty('category');
      expect(ncr).toHaveProperty('status');
      expect(ncr).toHaveProperty('project');
      expect(ncr).toHaveProperty('link');
      expect(ncr).toHaveProperty('isOverdue');
      expect(ncr).toHaveProperty('daysUntilDue');
    });

    it('should return empty array for user with no projects', async () => {
      const noProjectEmail = `ncr-no-project-${Date.now()}@example.com`;
      const noProjectRes = await request(app).post('/api/auth/register').send({
        email: noProjectEmail,
        password: 'SecureP@ssword123!',
        fullName: 'No Project User',
        tosAccepted: true,
      });
      const noProjectToken = noProjectRes.body.token;
      const noProjectUserId = noProjectRes.body.user.id;

      const res = await request(app)
        .get('/api/dashboard/portfolio-ncrs')
        .set('Authorization', `Bearer ${noProjectToken}`);

      expect(res.status).toBe(200);
      expect(res.body.ncrs).toEqual([]);

      // Cleanup
      await prisma.emailVerificationToken.deleteMany({ where: { userId: noProjectUserId } });
      await prisma.user.delete({ where: { id: noProjectUserId } }).catch(() => {});
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app).get('/api/dashboard/portfolio-ncrs');

      expect(res.status).toBe(401);
    });
  });
});

describe('Portfolio Risks API', () => {
  let authToken: string;
  let userId: string;
  let companyId: string;
  let projectId: string;

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `Risk Test Company ${Date.now()}` },
    });
    companyId = company.id;

    const testEmail = `risk-test-${Date.now()}@example.com`;
    const regRes = await request(app).post('/api/auth/register').send({
      email: testEmail,
      password: 'SecureP@ssword123!',
      fullName: 'Risk Test User',
      tosAccepted: true,
    });
    authToken = regRes.body.token;
    userId = regRes.body.user.id;

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'admin' },
    });

    // Create project with near-term completion date
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 15); // 15 days from now

    const project = await prisma.project.create({
      data: {
        name: 'Risk Test Project',
        projectNumber: `RISK-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
        targetCompletion: targetDate,
      },
    });
    projectId = project.id;

    await prisma.projectUser.create({
      data: { projectId, userId, role: 'admin', status: 'active' },
    });
  });

  afterAll(async () => {
    if (projectId) {
      await prisma.nCR.deleteMany({ where: { projectId } });
      await prisma.projectUser.deleteMany({ where: { projectId } });
      await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
    }
    await prisma.emailVerificationToken.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  });

  describe('GET /api/dashboard/portfolio-risks', () => {
    it('should return projects at risk', async () => {
      const res = await request(app)
        .get('/api/dashboard/portfolio-risks')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('projectsAtRisk');
      expect(Array.isArray(res.body.projectsAtRisk)).toBe(true);
    });

    it('should identify timeline risk for near-term projects', async () => {
      const res = await request(app)
        .get('/api/dashboard/portfolio-risks')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      const riskProject = res.body.projectsAtRisk.find((p: any) => p.id === projectId);
      expect(riskProject).toBeDefined();
      expect(riskProject.riskIndicators.some((r: any) => r.type === 'timeline')).toBe(true);
    });

    it('should include risk indicator details', async () => {
      const res = await request(app)
        .get('/api/dashboard/portfolio-risks')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      if (res.body.projectsAtRisk.length > 0) {
        const project = res.body.projectsAtRisk[0];
        expect(project).toHaveProperty('id');
        expect(project).toHaveProperty('name');
        expect(project).toHaveProperty('projectNumber');
        expect(project).toHaveProperty('riskIndicators');
        expect(project).toHaveProperty('riskLevel');
        expect(project).toHaveProperty('link');

        const indicator = project.riskIndicators[0];
        expect(indicator).toHaveProperty('type');
        expect(indicator).toHaveProperty('severity');
        expect(indicator).toHaveProperty('message');
        expect(indicator).toHaveProperty('explanation');
      }
    });

    it('should return empty array for user with no projects', async () => {
      const noProjectEmail = `risk-no-project-${Date.now()}@example.com`;
      const noProjectRes = await request(app).post('/api/auth/register').send({
        email: noProjectEmail,
        password: 'SecureP@ssword123!',
        fullName: 'No Project User',
        tosAccepted: true,
      });
      const noProjectToken = noProjectRes.body.token;
      const noProjectUserId = noProjectRes.body.user.id;

      const res = await request(app)
        .get('/api/dashboard/portfolio-risks')
        .set('Authorization', `Bearer ${noProjectToken}`);

      expect(res.status).toBe(200);
      expect(res.body.projectsAtRisk).toEqual([]);

      // Cleanup
      await prisma.emailVerificationToken.deleteMany({ where: { userId: noProjectUserId } });
      await prisma.user.delete({ where: { id: noProjectUserId } }).catch(() => {});
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app).get('/api/dashboard/portfolio-risks');

      expect(res.status).toBe(401);
    });
  });
});

describe('Cost Trend API', () => {
  let authToken: string;
  let userId: string;
  let companyId: string;
  let projectId: string;
  let subcontractorCompanyId: string;
  let docketId: string;

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `Cost Trend Test Company ${Date.now()}` },
    });
    companyId = company.id;

    const testEmail = `cost-trend-test-${Date.now()}@example.com`;
    const regRes = await request(app).post('/api/auth/register').send({
      email: testEmail,
      password: 'SecureP@ssword123!',
      fullName: 'Cost Trend Test User',
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
        name: 'Cost Trend Test Project',
        projectNumber: `CT-${Date.now()}`,
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

    // Create subcontractor company
    const subCo = await prisma.subcontractorCompany.create({
      data: {
        projectId,
        companyName: `Subcontractor ${Date.now()}`,
        status: 'approved',
      },
    });
    subcontractorCompanyId = subCo.id;

    // Create a docket
    const docket = await prisma.dailyDocket.create({
      data: {
        projectId,
        subcontractorCompanyId,
        date: new Date(),
        status: 'approved',
        totalLabourSubmitted: 800,
        totalPlantSubmitted: 200,
      },
    });
    docketId = docket.id;
  });

  afterAll(async () => {
    if (docketId) {
      await prisma.dailyDocket.delete({ where: { id: docketId } }).catch(() => {});
    }
    if (subcontractorCompanyId) {
      await prisma.subcontractorCompany
        .delete({ where: { id: subcontractorCompanyId } })
        .catch(() => {});
    }
    if (projectId) {
      await prisma.projectUser.deleteMany({ where: { projectId } });
      await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
    }
    await prisma.emailVerificationToken.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  });

  describe('GET /api/dashboard/cost-trend', () => {
    it('should return cost trend data', async () => {
      const res = await request(app)
        .get('/api/dashboard/cost-trend')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('dailyCosts');
      expect(res.body).toHaveProperty('totals');
      expect(res.body).toHaveProperty('runningAverage');
      expect(res.body).toHaveProperty('subcontractors');
      expect(res.body).toHaveProperty('dateRange');
    });

    it('should include correct totals structure', async () => {
      const res = await request(app)
        .get('/api/dashboard/cost-trend')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.totals).toHaveProperty('labour');
      expect(res.body.totals).toHaveProperty('plant');
      expect(res.body.totals).toHaveProperty('combined');
      expect(res.body.totals.labour).toBe(800);
      expect(res.body.totals.plant).toBe(200);
      expect(res.body.totals.combined).toBe(1000);
    });

    it('should aggregate multiple dockets for the same day and subcontractor', async () => {
      const extraDocket = await prisma.dailyDocket.create({
        data: {
          projectId,
          subcontractorCompanyId,
          date: new Date(),
          status: 'pending_approval',
          totalLabourSubmitted: 50,
          totalPlantSubmitted: 25,
        },
      });

      try {
        const res = await request(app)
          .get(`/api/dashboard/cost-trend?projectId=${projectId}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.totals.labour).toBe(850);
        expect(res.body.totals.plant).toBe(225);
        expect(res.body.totals.combined).toBe(1075);

        const subcontractor = res.body.subcontractors.find(
          (item: any) => item.id === subcontractorCompanyId,
        );
        expect(subcontractor).toEqual(
          expect.objectContaining({
            labour: 850,
            plant: 225,
          }),
        );
      } finally {
        await prisma.dailyDocket.delete({ where: { id: extraDocket.id } }).catch(() => {});
      }
    });

    it('should filter by project ID', async () => {
      const res = await request(app)
        .get(`/api/dashboard/cost-trend?projectId=${projectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.dailyCosts).toBeDefined();
    });

    it('should allow same-company admins without explicit project membership to view project cost trends', async () => {
      const companyAdmin = await registerDashboardUser(
        'cost-trend-company-admin',
        'Cost Trend Company Admin',
        companyId,
        'admin',
      );

      try {
        const res = await request(app)
          .get(`/api/dashboard/cost-trend?projectId=${projectId}`)
          .set('Authorization', `Bearer ${companyAdmin.token}`);

        expect(res.status).toBe(200);
        expect(res.body.totals.labour).toBe(800);
        expect(res.body.totals.plant).toBe(200);
        expect(res.body.totals.combined).toBe(1000);
      } finally {
        await cleanupDashboardUser(companyAdmin.userId);
      }
    });

    it('should filter by subcontractor', async () => {
      const res = await request(app)
        .get(`/api/dashboard/cost-trend?subcontractorId=${subcontractorCompanyId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.subcontractors.length).toBeGreaterThanOrEqual(1);
    });

    it('should reject structured cost trend query filters', async () => {
      const res = await request(app)
        .get('/api/dashboard/cost-trend')
        .query({ subcontractorId: [subcontractorCompanyId, 'other-subcontractor'] })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
    });

    it('should reject active project viewers from cost trends', async () => {
      const viewer = await registerDashboardUser(
        'cost-trend-viewer',
        'Cost Trend Viewer',
        companyId,
        'viewer',
      );
      await prisma.projectUser.create({
        data: { projectId, userId: viewer.userId, role: 'viewer', status: 'active' },
      });

      try {
        const portfolioRes = await request(app)
          .get('/api/dashboard/cost-trend')
          .set('Authorization', `Bearer ${viewer.token}`);
        expect(portfolioRes.status).toBe(403);

        const projectRes = await request(app)
          .get(`/api/dashboard/cost-trend?projectId=${projectId}`)
          .set('Authorization', `Bearer ${viewer.token}`);
        expect(projectRes.status).toBe(403);
      } finally {
        await cleanupDashboardUser(viewer.userId);
      }
    });

    it('should allow cost trends based on active project manager role', async () => {
      const manager = await registerDashboardUser(
        'cost-trend-project-manager',
        'Cost Trend Project Manager',
        companyId,
        'viewer',
      );
      await prisma.projectUser.create({
        data: { projectId, userId: manager.userId, role: 'project_manager', status: 'active' },
      });

      try {
        const res = await request(app)
          .get(`/api/dashboard/cost-trend?projectId=${projectId}`)
          .set('Authorization', `Bearer ${manager.token}`);

        expect(res.status).toBe(200);
        expect(res.body.totals.combined).toBe(1000);
      } finally {
        await cleanupDashboardUser(manager.userId);
      }
    });

    it('should not use company project manager role over lower project role for cost trends', async () => {
      const viewer = await registerDashboardUser(
        'cost-trend-company-pm-viewer',
        'Cost Trend Company PM Viewer',
        companyId,
        'project_manager',
      );
      await prisma.projectUser.create({
        data: { projectId, userId: viewer.userId, role: 'viewer', status: 'active' },
      });

      try {
        const res = await request(app)
          .get(`/api/dashboard/cost-trend?projectId=${projectId}`)
          .set('Authorization', `Bearer ${viewer.token}`);

        expect(res.status).toBe(403);
      } finally {
        await cleanupDashboardUser(viewer.userId);
      }
    });

    it('should handle custom date range', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      const endDate = new Date();

      const res = await request(app)
        .get(
          `/api/dashboard/cost-trend?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`,
        )
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.dateRange).toBeDefined();
    });

    it('should reject invalid cost trend date and days filters', async () => {
      const invalidDateRes = await request(app)
        .get('/api/dashboard/cost-trend?startDate=not-a-date')
        .set('Authorization', `Bearer ${authToken}`);
      expect(invalidDateRes.status).toBe(400);

      const invalidCalendarDateRes = await request(app)
        .get('/api/dashboard/cost-trend?startDate=2026-02-30')
        .set('Authorization', `Bearer ${authToken}`);
      expect(invalidCalendarDateRes.status).toBe(400);

      const invalidCalendarDateTimeRes = await request(app)
        .get('/api/dashboard/cost-trend?startDate=2026-02-30T10:00:00Z')
        .set('Authorization', `Bearer ${authToken}`);
      expect(invalidCalendarDateTimeRes.status).toBe(400);

      const reversedDateRes = await request(app)
        .get('/api/dashboard/cost-trend?startDate=2025-02-01&endDate=2025-01-31')
        .set('Authorization', `Bearer ${authToken}`);
      expect(reversedDateRes.status).toBe(400);

      const zeroDaysRes = await request(app)
        .get('/api/dashboard/cost-trend?days=0')
        .set('Authorization', `Bearer ${authToken}`);
      expect(zeroDaysRes.status).toBe(400);

      const tooManyDaysRes = await request(app)
        .get('/api/dashboard/cost-trend?days=366')
        .set('Authorization', `Bearer ${authToken}`);
      expect(tooManyDaysRes.status).toBe(400);

      const decimalDaysRes = await request(app)
        .get('/api/dashboard/cost-trend?days=1.5')
        .set('Authorization', `Bearer ${authToken}`);
      expect(decimalDaysRes.status).toBe(400);

      const suffixedDaysRes = await request(app)
        .get('/api/dashboard/cost-trend?days=30days')
        .set('Authorization', `Bearer ${authToken}`);
      expect(suffixedDaysRes.status).toBe(400);
    });

    it('should reject access to project user does not have access to', async () => {
      const res = await request(app)
        .get('/api/dashboard/cost-trend?projectId=non-existent-project-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(403);
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app).get('/api/dashboard/cost-trend');

      expect(res.status).toBe(401);
    });
  });
});

describe('Foreman Dashboard API', () => {
  let authToken: string;
  let userId: string;
  let companyId: string;
  let projectId: string;

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `Foreman Test Company ${Date.now()}` },
    });
    companyId = company.id;

    const testEmail = `foreman-test-${Date.now()}@example.com`;
    const regRes = await request(app).post('/api/auth/register').send({
      email: testEmail,
      password: 'SecureP@ssword123!',
      fullName: 'Foreman Test User',
      tosAccepted: true,
    });
    authToken = regRes.body.token;
    userId = regRes.body.user.id;

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'foreman' },
    });

    const project = await prisma.project.create({
      data: {
        name: 'Foreman Test Project',
        projectNumber: `FM-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    projectId = project.id;

    await prisma.projectUser.create({
      data: { projectId, userId, role: 'foreman', status: 'active' },
    });
  });

  afterAll(async () => {
    if (projectId) {
      await prisma.dailyDiary.deleteMany({ where: { projectId } });
      await prisma.dailyDocket.deleteMany({ where: { projectId } });
      await prisma.projectUser.deleteMany({ where: { projectId } });
      await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
    }
    await prisma.emailVerificationToken.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  });

  describe('GET /api/dashboard/foreman', () => {
    it('should return foreman dashboard data', async () => {
      const res = await request(app)
        .get('/api/dashboard/foreman')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('todayDiary');
      expect(res.body).toHaveProperty('pendingDockets');
      expect(res.body).toHaveProperty('inspectionsDueToday');
      expect(res.body).toHaveProperty('weather');
      expect(res.body).toHaveProperty('project');
    });

    it('should include today diary status structure', async () => {
      const res = await request(app)
        .get('/api/dashboard/foreman')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.todayDiary).toHaveProperty('exists');
      expect(res.body.todayDiary).toHaveProperty('status');
      expect(res.body.todayDiary).toHaveProperty('id');
    });

    it('should include pending dockets structure', async () => {
      const res = await request(app)
        .get('/api/dashboard/foreman')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.pendingDockets).toHaveProperty('count');
      expect(res.body.pendingDockets).toHaveProperty('totalLabourHours');
      expect(res.body.pendingDockets).toHaveProperty('totalPlantHours');
    });

    it('should include inspections due today structure', async () => {
      const res = await request(app)
        .get('/api/dashboard/foreman')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.inspectionsDueToday).toHaveProperty('count');
      expect(res.body.inspectionsDueToday).toHaveProperty('items');
      expect(Array.isArray(res.body.inspectionsDueToday.items)).toBe(true);
    });

    it('should include weather structure', async () => {
      const res = await request(app)
        .get('/api/dashboard/foreman')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.weather).toHaveProperty('conditions');
      expect(res.body.weather).toHaveProperty('temperatureMin');
      expect(res.body.weather).toHaveProperty('temperatureMax');
      expect(res.body.weather).toHaveProperty('rainfallMm');
    });

    it('should reject active project viewers from the foreman dashboard', async () => {
      const viewer = await registerDashboardUser(
        'foreman-viewer',
        'Foreman Dashboard Viewer',
        companyId,
        'viewer',
      );
      await prisma.projectUser.create({
        data: { projectId, userId: viewer.userId, role: 'viewer', status: 'active' },
      });

      try {
        const res = await request(app)
          .get('/api/dashboard/foreman')
          .set('Authorization', `Bearer ${viewer.token}`);

        expect(res.status).toBe(403);
      } finally {
        await cleanupDashboardUser(viewer.userId);
      }
    });

    it('should return empty data for user with no projects', async () => {
      const noProjectEmail = `fm-no-project-${Date.now()}@example.com`;
      const noProjectRes = await request(app).post('/api/auth/register').send({
        email: noProjectEmail,
        password: 'SecureP@ssword123!',
        fullName: 'No Project User',
        tosAccepted: true,
      });
      const noProjectToken = noProjectRes.body.token;
      const noProjectUserId = noProjectRes.body.user.id;

      const res = await request(app)
        .get('/api/dashboard/foreman')
        .set('Authorization', `Bearer ${noProjectToken}`);

      expect(res.status).toBe(200);
      expect(res.body.todayDiary.exists).toBe(false);
      expect(res.body.pendingDockets.count).toBe(0);
      expect(res.body.project).toBeNull();

      // Cleanup
      await prisma.emailVerificationToken.deleteMany({ where: { userId: noProjectUserId } });
      await prisma.user.delete({ where: { id: noProjectUserId } }).catch(() => {});
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app).get('/api/dashboard/foreman');

      expect(res.status).toBe(401);
    });
  });
});

describe('Quality Manager Dashboard API', () => {
  let authToken: string;
  let userId: string;
  let companyId: string;
  let projectId: string;

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `QM Test Company ${Date.now()}` },
    });
    companyId = company.id;

    const testEmail = `qm-test-${Date.now()}@example.com`;
    const regRes = await request(app).post('/api/auth/register').send({
      email: testEmail,
      password: 'SecureP@ssword123!',
      fullName: 'QM Test User',
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
        name: 'QM Test Project',
        projectNumber: `QM-${Date.now()}`,
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
    if (projectId) {
      await prisma.nCR.deleteMany({ where: { projectId } });
      await prisma.projectUser.deleteMany({ where: { projectId } });
      await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
    }
    await prisma.emailVerificationToken.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  });

  describe('GET /api/dashboard/quality-manager', () => {
    it('should return quality manager dashboard data', async () => {
      const res = await request(app)
        .get('/api/dashboard/quality-manager')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('lotConformance');
      expect(res.body).toHaveProperty('ncrsByCategory');
      expect(res.body).toHaveProperty('openNCRs');
      expect(res.body).toHaveProperty('pendingVerifications');
      expect(res.body).toHaveProperty('holdPointMetrics');
      expect(res.body).toHaveProperty('itpTrends');
      expect(res.body).toHaveProperty('auditReadiness');
      expect(res.body).toHaveProperty('project');
    });

    it('should include lot conformance structure', async () => {
      const res = await request(app)
        .get('/api/dashboard/quality-manager')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.lotConformance).toHaveProperty('totalLots');
      expect(res.body.lotConformance).toHaveProperty('conformingLots');
      expect(res.body.lotConformance).toHaveProperty('nonConformingLots');
      expect(res.body.lotConformance).toHaveProperty('rate');
    });

    it('should include NCR breakdown by category', async () => {
      const res = await request(app)
        .get('/api/dashboard/quality-manager')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.ncrsByCategory).toHaveProperty('major');
      expect(res.body.ncrsByCategory).toHaveProperty('minor');
      expect(res.body.ncrsByCategory).toHaveProperty('observation');
      expect(res.body.ncrsByCategory).toHaveProperty('total');
    });

    it('should include hold point metrics', async () => {
      const res = await request(app)
        .get('/api/dashboard/quality-manager')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.holdPointMetrics).toHaveProperty('totalReleased');
      expect(res.body.holdPointMetrics).toHaveProperty('totalPending');
      expect(res.body.holdPointMetrics).toHaveProperty('releaseRate');
      expect(res.body.holdPointMetrics).toHaveProperty('avgTimeToRelease');
    });

    it('should include ITP trends', async () => {
      const res = await request(app)
        .get('/api/dashboard/quality-manager')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.itpTrends).toHaveProperty('completedThisWeek');
      expect(res.body.itpTrends).toHaveProperty('completedLastWeek');
      expect(res.body.itpTrends).toHaveProperty('trend');
      expect(res.body.itpTrends).toHaveProperty('completionRate');
      expect(['up', 'down', 'stable']).toContain(res.body.itpTrends.trend);
    });

    it('should include audit readiness score', async () => {
      const res = await request(app)
        .get('/api/dashboard/quality-manager')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.auditReadiness).toHaveProperty('score');
      expect(res.body.auditReadiness).toHaveProperty('status');
      expect(res.body.auditReadiness).toHaveProperty('issues');
      expect(['ready', 'needs_attention', 'not_ready']).toContain(res.body.auditReadiness.status);
      expect(Array.isArray(res.body.auditReadiness.issues)).toBe(true);
    });

    it('should reject active project viewers from the quality dashboard', async () => {
      const viewer = await registerDashboardUser(
        'qm-viewer',
        'Quality Dashboard Viewer',
        companyId,
        'viewer',
      );
      await prisma.projectUser.create({
        data: { projectId, userId: viewer.userId, role: 'viewer', status: 'active' },
      });

      try {
        const res = await request(app)
          .get('/api/dashboard/quality-manager')
          .set('Authorization', `Bearer ${viewer.token}`);

        expect(res.status).toBe(403);
      } finally {
        await cleanupDashboardUser(viewer.userId);
      }
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app).get('/api/dashboard/quality-manager');

      expect(res.status).toBe(401);
    });
  });
});

describe('Project Manager Dashboard API', () => {
  let authToken: string;
  let userId: string;
  let companyId: string;
  let projectId: string;

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `PM Test Company ${Date.now()}` },
    });
    companyId = company.id;

    const testEmail = `pm-test-${Date.now()}@example.com`;
    const regRes = await request(app).post('/api/auth/register').send({
      email: testEmail,
      password: 'SecureP@ssword123!',
      fullName: 'PM Test User',
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
        name: 'PM Test Project',
        projectNumber: `PM-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
        contractValue: 1000000,
      },
    });
    projectId = project.id;

    await prisma.projectUser.create({
      data: { projectId, userId, role: 'project_manager', status: 'active' },
    });
  });

  afterAll(async () => {
    if (projectId) {
      await prisma.nCR.deleteMany({ where: { projectId } });
      await prisma.lot.deleteMany({ where: { projectId } });
      await prisma.projectUser.deleteMany({ where: { projectId } });
      await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
    }
    await prisma.emailVerificationToken.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  });

  describe('GET /api/dashboard/project-manager', () => {
    it('should return project manager dashboard data', async () => {
      const res = await request(app)
        .get('/api/dashboard/project-manager')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('lotProgress');
      expect(res.body).toHaveProperty('openNCRs');
      expect(res.body).toHaveProperty('holdPointPipeline');
      expect(res.body).toHaveProperty('claimStatus');
      expect(res.body).toHaveProperty('costTracking');
      expect(res.body).toHaveProperty('attentionItems');
      expect(res.body).toHaveProperty('project');
    });

    it('should include lot progress breakdown', async () => {
      const res = await request(app)
        .get('/api/dashboard/project-manager')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.lotProgress).toHaveProperty('total');
      expect(res.body.lotProgress).toHaveProperty('notStarted');
      expect(res.body.lotProgress).toHaveProperty('inProgress');
      expect(res.body.lotProgress).toHaveProperty('onHold');
      expect(res.body.lotProgress).toHaveProperty('completed');
      expect(res.body.lotProgress).toHaveProperty('progressPercentage');
    });

    it('should include open NCR summary', async () => {
      const res = await request(app)
        .get('/api/dashboard/project-manager')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.openNCRs).toHaveProperty('total');
      expect(res.body.openNCRs).toHaveProperty('major');
      expect(res.body.openNCRs).toHaveProperty('minor');
      expect(res.body.openNCRs).toHaveProperty('overdue');
      expect(res.body.openNCRs).toHaveProperty('items');
      expect(Array.isArray(res.body.openNCRs.items)).toBe(true);
    });

    it('should include hold point pipeline', async () => {
      const res = await request(app)
        .get('/api/dashboard/project-manager')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.holdPointPipeline).toHaveProperty('pending');
      expect(res.body.holdPointPipeline).toHaveProperty('scheduled');
      expect(res.body.holdPointPipeline).toHaveProperty('requested');
      expect(res.body.holdPointPipeline).toHaveProperty('released');
      expect(res.body.holdPointPipeline).toHaveProperty('thisWeek');
      expect(res.body.holdPointPipeline).toHaveProperty('items');
    });

    it('should include claim status', async () => {
      const res = await request(app)
        .get('/api/dashboard/project-manager')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.claimStatus).toHaveProperty('totalClaimed');
      expect(res.body.claimStatus).toHaveProperty('totalCertified');
      expect(res.body.claimStatus).toHaveProperty('totalPaid');
      expect(res.body.claimStatus).toHaveProperty('outstanding');
      expect(res.body.claimStatus).toHaveProperty('pendingClaims');
      expect(res.body.claimStatus).toHaveProperty('recentClaims');
    });

    it('should include cost tracking', async () => {
      const res = await request(app)
        .get('/api/dashboard/project-manager')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.costTracking).toHaveProperty('budgetTotal');
      expect(res.body.costTracking).toHaveProperty('actualSpend');
      expect(res.body.costTracking).toHaveProperty('variance');
      expect(res.body.costTracking).toHaveProperty('variancePercentage');
      expect(res.body.costTracking).toHaveProperty('labourCost');
      expect(res.body.costTracking).toHaveProperty('plantCost');
      expect(res.body.costTracking).toHaveProperty('trend');
      expect(['on_track', 'under', 'over']).toContain(res.body.costTracking.trend);
    });

    it('should include attention items array', async () => {
      const res = await request(app)
        .get('/api/dashboard/project-manager')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.attentionItems)).toBe(true);
    });

    it('should reject active project viewers from the project manager dashboard', async () => {
      const viewer = await registerDashboardUser(
        'pm-viewer',
        'Project Manager Dashboard Viewer',
        companyId,
        'viewer',
      );
      await prisma.projectUser.create({
        data: { projectId, userId: viewer.userId, role: 'viewer', status: 'active' },
      });

      try {
        const res = await request(app)
          .get('/api/dashboard/project-manager')
          .set('Authorization', `Bearer ${viewer.token}`);

        expect(res.status).toBe(403);
      } finally {
        await cleanupDashboardUser(viewer.userId);
      }
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app).get('/api/dashboard/project-manager');

      expect(res.status).toBe(401);
    });
  });
});

describe('Foreman Today Worklist API', () => {
  let authToken: string;
  let userId: string;
  let companyId: string;
  let projectId: string;
  let lotId: string;

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `Foreman Today Test Company ${Date.now()}` },
    });
    companyId = company.id;

    const testEmail = `foreman-today-test-${Date.now()}@example.com`;
    const regRes = await request(app).post('/api/auth/register').send({
      email: testEmail,
      password: 'SecureP@ssword123!',
      fullName: 'Foreman Today Test User',
      tosAccepted: true,
    });
    authToken = regRes.body.token;
    userId = regRes.body.user.id;

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'foreman' },
    });

    const project = await prisma.project.create({
      data: {
        name: 'Foreman Today Test Project',
        projectNumber: `FT-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    projectId = project.id;

    await prisma.projectUser.create({
      data: { projectId, userId, role: 'foreman', status: 'active' },
    });

    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: 'LOT-TODAY-001',
        lotType: 'general',
        activityType: 'earthworks',
        status: 'in_progress',
      },
    });
    lotId = lot.id;
  });

  afterAll(async () => {
    if (lotId) {
      await prisma.holdPoint.deleteMany({ where: { lotId } });
      await prisma.lot.delete({ where: { id: lotId } }).catch(() => {});
    }
    if (projectId) {
      await prisma.projectUser.deleteMany({ where: { projectId } });
      await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
    }
    await prisma.emailVerificationToken.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  });

  describe('GET /api/dashboard/projects/:projectId/foreman/today', () => {
    it('should return today worklist for foreman', async () => {
      const res = await request(app)
        .get(`/api/dashboard/projects/${projectId}/foreman/today`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('blocking');
      expect(res.body).toHaveProperty('dueToday');
      expect(res.body).toHaveProperty('upcoming');
      expect(res.body).toHaveProperty('summary');
    });

    it('should categorize work items by urgency', async () => {
      const res = await request(app)
        .get(`/api/dashboard/projects/${projectId}/foreman/today`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.blocking)).toBe(true);
      expect(Array.isArray(res.body.dueToday)).toBe(true);
      expect(Array.isArray(res.body.upcoming)).toBe(true);
    });

    it('should include summary counts', async () => {
      const res = await request(app)
        .get(`/api/dashboard/projects/${projectId}/foreman/today`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.summary).toHaveProperty('totalBlocking');
      expect(res.body.summary).toHaveProperty('totalDueToday');
      expect(res.body.summary).toHaveProperty('totalUpcoming');
    });

    it('should reject oversized project route ids before worklist lookups', async () => {
      const longId = 'p'.repeat(121);

      const res = await request(app)
        .get(`/api/dashboard/projects/${longId}/foreman/today`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('projectId is too long');
    });

    it('should reject access to project user does not have access to', async () => {
      const otherUserEmail = `other-user-${Date.now()}@example.com`;
      const otherUserRes = await request(app).post('/api/auth/register').send({
        email: otherUserEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Other User',
        tosAccepted: true,
      });
      const otherUserToken = otherUserRes.body.token;
      const otherUserId = otherUserRes.body.user.id;

      const res = await request(app)
        .get(`/api/dashboard/projects/${projectId}/foreman/today`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(res.status).toBe(403);

      // Cleanup
      await prisma.emailVerificationToken.deleteMany({ where: { userId: otherUserId } });
      await prisma.user.delete({ where: { id: otherUserId } }).catch(() => {});
    });

    it('should reject pending same-company project memberships', async () => {
      const pendingEmail = `foreman-today-pending-${Date.now()}@example.com`;
      const pendingRes = await request(app).post('/api/auth/register').send({
        email: pendingEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Pending Foreman User',
        tosAccepted: true,
      });
      const pendingToken = pendingRes.body.token;
      const pendingUserId = pendingRes.body.user.id;

      await prisma.user.update({
        where: { id: pendingUserId },
        data: { companyId, roleInCompany: 'foreman' },
      });
      await prisma.projectUser.create({
        data: { projectId, userId: pendingUserId, role: 'foreman', status: 'pending' },
      });

      const res = await request(app)
        .get(`/api/dashboard/projects/${projectId}/foreman/today`)
        .set('Authorization', `Bearer ${pendingToken}`);

      expect(res.status).toBe(403);

      await prisma.projectUser.deleteMany({ where: { projectId, userId: pendingUserId } });
      await prisma.emailVerificationToken.deleteMany({ where: { userId: pendingUserId } });
      await prisma.user.delete({ where: { id: pendingUserId } }).catch(() => {});
    });

    it('should allow same-company admins even if their explicit project role is lower', async () => {
      const companyAdmin = await registerDashboardUser(
        'foreman-today-company-admin',
        'Foreman Today Company Admin',
        companyId,
        'admin',
      );
      await prisma.projectUser.create({
        data: { projectId, userId: companyAdmin.userId, role: 'viewer', status: 'active' },
      });

      try {
        const res = await request(app)
          .get(`/api/dashboard/projects/${projectId}/foreman/today`)
          .set('Authorization', `Bearer ${companyAdmin.token}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('summary');
      } finally {
        await cleanupDashboardUser(companyAdmin.userId);
      }
    });

    it('should not use cross-company admin role over lower project role', async () => {
      const otherCompany = await prisma.company.create({
        data: { name: `Foreman Today Other Company ${Date.now()}` },
      });
      const otherCompanyAdmin = await registerDashboardUser(
        'foreman-today-cross-company-admin',
        'Foreman Today Cross Company Admin',
        otherCompany.id,
        'admin',
      );
      await prisma.projectUser.create({
        data: { projectId, userId: otherCompanyAdmin.userId, role: 'viewer', status: 'active' },
      });

      try {
        const res = await request(app)
          .get(`/api/dashboard/projects/${projectId}/foreman/today`)
          .set('Authorization', `Bearer ${otherCompanyAdmin.token}`);

        expect(res.status).toBe(403);
      } finally {
        await cleanupDashboardUser(otherCompanyAdmin.userId);
        await prisma.company.delete({ where: { id: otherCompany.id } }).catch(() => {});
      }
    });

    it('should reject active project viewers from the foreman worklist', async () => {
      const viewer = await registerDashboardUser(
        'foreman-today-viewer',
        'Foreman Today Viewer',
        companyId,
        'viewer',
      );
      await prisma.projectUser.create({
        data: { projectId, userId: viewer.userId, role: 'viewer', status: 'active' },
      });

      try {
        const res = await request(app)
          .get(`/api/dashboard/projects/${projectId}/foreman/today`)
          .set('Authorization', `Bearer ${viewer.token}`);

        expect(res.status).toBe(403);
      } finally {
        await cleanupDashboardUser(viewer.userId);
      }
    });

    it('should reject subcontractor users from the foreman worklist even with active foreman membership', async () => {
      const suffix = Date.now();
      const subcontractorCompany = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `Foreman Today Subcontractor ${suffix}`,
          primaryContactName: 'Foreman Today Subcontractor',
          primaryContactEmail: `foreman-today-sub-${suffix}@example.com`,
          status: 'approved',
        },
      });
      const subcontractor = await registerDashboardUser(
        'foreman-today-subcontractor',
        'Foreman Today Subcontractor',
        companyId,
        'subcontractor',
      );

      await prisma.subcontractorUser.create({
        data: {
          userId: subcontractor.userId,
          subcontractorCompanyId: subcontractorCompany.id,
          role: 'user',
        },
      });
      await prisma.projectUser.create({
        data: { projectId, userId: subcontractor.userId, role: 'foreman', status: 'active' },
      });

      try {
        const res = await request(app)
          .get(`/api/dashboard/projects/${projectId}/foreman/today`)
          .set('Authorization', `Bearer ${subcontractor.token}`);

        expect(res.status).toBe(403);
        expect(res.body.error.message).toContain('foreman worklist');
      } finally {
        await prisma.subcontractorUser.deleteMany({
          where: { subcontractorCompanyId: subcontractorCompany.id },
        });
        await cleanupDashboardUser(subcontractor.userId);
        await prisma.subcontractorCompany
          .delete({ where: { id: subcontractorCompany.id } })
          .catch(() => {});
      }
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app).get(`/api/dashboard/projects/${projectId}/foreman/today`);

      expect(res.status).toBe(401);
    });
  });
});
