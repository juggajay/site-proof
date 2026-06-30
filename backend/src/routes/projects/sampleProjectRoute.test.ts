import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import { projectsRouter } from '../projects.js';
import { authRouter } from '../auth.js';
import { authenticateApiKey } from '../apiKeys.js';
import { prisma } from '../../lib/prisma.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { AuditAction } from '../../lib/auditLog.js';
import { registerTestUser, TEST_USER_PASSWORD } from '../../test/routeTestHarness.js';
import {
  SAMPLE_CHECKLIST_ITEMS,
  SAMPLE_LOTS,
  SAMPLE_NCR,
  SAMPLE_PROJECT_NAME,
  SAMPLE_PROJECT_NUMBER,
  SAMPLE_TEST_RESULTS,
} from './sampleProjectData.js';

const app = express();
app.use(express.json());
app.use(authenticateApiKey);
app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);
app.use(errorHandler);

function hashApiKeyForTest(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

async function createApiKeyForUser(userId: string, scopes = 'admin') {
  const apiKey = `sp_${crypto.randomBytes(32).toString('hex')}`;
  const record = await prisma.apiKey.create({
    data: {
      userId,
      name: 'Sample project browser-session boundary test key',
      keyHash: hashApiKeyForTest(apiKey),
      keyPrefix: apiKey.substring(0, 11),
      scopes,
      isActive: true,
    },
    select: { id: true },
  });

  return { apiKey, keyId: record.id };
}

describe('POST /api/projects/sample', () => {
  let adminToken: string;
  let adminUserId: string;
  let companyId: string;
  let foremanToken: string;
  let foremanUserId: string;
  let companylessToken: string;
  let companylessUserId: string;
  let pmToken: string;
  let pmUserId: string;
  let sampleProjectId: string | undefined;

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `Sample Project Test Company ${Date.now()}` },
    });
    companyId = company.id;

    const admin = await registerTestUser(app, {
      emailPrefix: 'sample-project-admin',
      fullName: 'Sample Project Admin',
      companyId,
      roleInCompany: 'admin',
    });
    adminToken = admin.token;
    adminUserId = admin.userId;

    const foreman = await registerTestUser(app, {
      emailPrefix: 'sample-project-foreman',
      fullName: 'Sample Project Foreman',
      companyId,
      roleInCompany: 'foreman',
    });
    foremanToken = foreman.token;
    foremanUserId = foreman.userId;

    const companyless = await registerTestUser(app, {
      emailPrefix: 'sample-project-no-company',
      fullName: 'Sample Project No Company',
    });
    companylessToken = companyless.token;
    companylessUserId = companyless.userId;

    const pm = await registerTestUser(app, {
      emailPrefix: 'sample-project-pm',
      fullName: 'Sample Project PM',
      companyId,
      roleInCompany: 'project_manager',
    });
    pmToken = pm.token;
    pmUserId = pm.userId;
  });

  afterAll(async () => {
    // Defensive cleanup: drop ITP instances before the project so the
    // template's RESTRICT FK can never block the cascading project delete.
    await prisma.iTPInstance.deleteMany({
      where: { lot: { project: { companyId } } },
    });
    await prisma.project.deleteMany({ where: { companyId } });
    for (const userId of [adminUserId, foremanUserId, companylessUserId, pmUserId]) {
      if (!userId) continue;
      await prisma.emailVerificationToken.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  });

  it('rejects unauthenticated requests', async () => {
    const res = await request(app).post('/api/projects/sample');
    expect(res.status).toBe(401);
  });

  it('rejects API-key-authenticated sample project creation', async () => {
    const { apiKey, keyId } = await createApiKeyForUser(adminUserId, 'admin');

    try {
      const res = await request(app).post('/api/projects/sample').set('x-api-key', apiKey);

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('browser session');
      await expect(
        prisma.project.count({ where: { companyId, projectNumber: SAMPLE_PROJECT_NUMBER } }),
      ).resolves.toBe(0);
    } finally {
      await prisma.apiKey.deleteMany({ where: { id: keyId } });
    }
  });

  it('rejects company members without project-creation roles', async () => {
    const res = await request(app)
      .post('/api/projects/sample')
      .set('Authorization', `Bearer ${foremanToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('admins and project managers');
  });

  it('rejects users without a company', async () => {
    const res = await request(app)
      .post('/api/projects/sample')
      .set('Authorization', `Bearer ${companylessToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('organization');
  });

  it('no longer caps sample project creation while tier enforcement is disabled (G1)', async () => {
    const limitedCompany = await prisma.company.create({
      data: {
        name: `Sample Project Cap Company ${Date.now()}`,
        subscriptionTier: 'basic',
      },
    });
    const limitedAdmin = await registerTestUser(app, {
      emailPrefix: 'sample-project-cap-admin',
      fullName: 'Sample Project Cap Admin',
      companyId: limitedCompany.id,
      roleInCompany: 'admin',
    });

    try {
      await Promise.all(
        Array.from({ length: 3 }, (_, index) =>
          prisma.project.create({
            data: {
              companyId: limitedCompany.id,
              name: `Existing Project ${index}`,
              projectNumber: `EXISTING-${Date.now()}-${index}`,
              status: 'active',
              state: 'NSW',
              specificationSet: 'TfNSW',
            },
          }),
        ),
      );

      const res = await request(app)
        .post('/api/projects/sample')
        .set('Authorization', `Bearer ${limitedAdmin.token}`);

      // G1: tier enforcement is disabled, so the sample project is created.
      expect(res.status).toBe(201);
      await expect(prisma.project.count({ where: { companyId: limitedCompany.id } })).resolves.toBe(
        4,
      );
    } finally {
      await prisma.project.deleteMany({ where: { companyId: limitedCompany.id } });
      await prisma.emailVerificationToken.deleteMany({ where: { userId: limitedAdmin.userId } });
      await prisma.user.delete({ where: { id: limitedAdmin.userId } }).catch(() => {});
      await prisma.company.delete({ where: { id: limitedCompany.id } }).catch(() => {});
    }
  });

  it('creates the example project with seeded quality records', async () => {
    const res = await request(app)
      .post('/api/projects/sample')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(201);
    expect(res.body.alreadyExisted).toBe(false);
    expect(res.body.project.name).toBe(SAMPLE_PROJECT_NAME);
    expect(res.body.project.projectNumber).toBe(SAMPLE_PROJECT_NUMBER);
    sampleProjectId = res.body.project.id;

    // Caller becomes an active project admin.
    const membership = await prisma.projectUser.findFirst({
      where: { projectId: sampleProjectId, userId: adminUserId },
    });
    expect(membership).toMatchObject({ role: 'admin', status: 'active' });

    // Lots across the lifecycle, including a claimable conformed lot.
    const lots = await prisma.lot.findMany({
      where: { projectId: sampleProjectId },
      orderBy: { lotNumber: 'asc' },
    });
    expect(lots).toHaveLength(SAMPLE_LOTS.length);
    const conformedLot = lots.find((lot) => lot.status === 'conformed');
    expect(conformedLot?.conformedAt).toBeTruthy();
    expect(conformedLot?.budgetAmount).toBeTruthy();
    expect(conformedLot?.claimedInId).toBeNull();

    // Self-contained project-owned ITP template (no global library needed).
    const template = await prisma.iTPTemplate.findFirst({
      where: { projectId: sampleProjectId },
      include: { checklistItems: true },
    });
    expect(template).toBeTruthy();
    expect(template!.checklistItems).toHaveLength(SAMPLE_CHECKLIST_ITEMS.length);

    // One completed instance, one partially completed instance.
    const instances = await prisma.iTPInstance.findMany({
      where: { lot: { projectId: sampleProjectId } },
      include: { completions: true },
    });
    expect(instances).toHaveLength(2);
    const completed = instances.find((instance) => instance.status === 'completed');
    const partial = instances.find((instance) => instance.status === 'in_progress');
    expect(completed?.completions).toHaveLength(SAMPLE_CHECKLIST_ITEMS.length);
    expect(partial?.completions.length).toBeGreaterThan(0);
    expect(partial!.completions.length).toBeLessThan(SAMPLE_CHECKLIST_ITEMS.length);

    // One hold point awaiting release, one released.
    const holdPoints = await prisma.holdPoint.findMany({
      where: { lot: { projectId: sampleProjectId } },
    });
    expect(holdPoints.map((holdPoint) => holdPoint.status).sort()).toEqual([
      'released',
      'requested',
    ]);
    const releasedHoldPoint = holdPoints.find((holdPoint) => holdPoint.status === 'released');
    expect(releasedHoldPoint?.releasedAt).toBeTruthy();
    expect(releasedHoldPoint?.releasedByName).toBeTruthy();

    // Open NCR linked to the ncr_raised lot.
    const ncr = await prisma.nCR.findFirst({
      where: { projectId: sampleProjectId },
      include: { ncrLots: { include: { lot: true } } },
    });
    expect(ncr).toMatchObject({ status: 'open', ncrNumber: SAMPLE_NCR.ncrNumber });
    expect(ncr!.ncrLots).toHaveLength(1);
    expect(ncr!.ncrLots[0].lot.lotNumber).toBe(SAMPLE_NCR.lotNumber);

    // Test results: one verified pass, one still requested.
    const testResults = await prisma.testResult.findMany({
      where: { projectId: sampleProjectId },
    });
    expect(testResults).toHaveLength(SAMPLE_TEST_RESULTS.length);
    expect(testResults.map((testResult) => testResult.status).sort()).toEqual([
      'requested',
      'verified',
    ]);

    // Audit trail records the creation.
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        projectId: sampleProjectId,
        userId: adminUserId,
        action: AuditAction.PROJECT_CREATED,
      },
    });
    expect(auditLog).toBeTruthy();
  });

  it('returns the existing example project instead of duplicating it', async () => {
    const res = await request(app)
      .post('/api/projects/sample')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.alreadyExisted).toBe(true);
    expect(res.body.project.id).toBe(sampleProjectId);

    const sampleProjects = await prisma.project.count({
      where: { companyId, projectNumber: SAMPLE_PROJECT_NUMBER },
    });
    expect(sampleProjects).toBe(1);
  });

  it('grants membership when another project creator requests the existing sample', async () => {
    const res = await request(app)
      .post('/api/projects/sample')
      .set('Authorization', `Bearer ${pmToken}`);

    expect(res.status).toBe(200);
    expect(res.body.project.id).toBe(sampleProjectId);

    const membership = await prisma.projectUser.findFirst({
      where: { projectId: sampleProjectId, userId: pmUserId },
    });
    expect(membership).toMatchObject({ status: 'active' });
  });

  it('rejects permanent deletion of seeded samples and allows archiving instead', async () => {
    const res = await request(app)
      .delete(`/api/projects/${sampleProjectId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: TEST_USER_PASSWORD });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain('cannot be permanently deleted');

    const remaining = await prisma.project.findUnique({ where: { id: sampleProjectId! } });
    expect(remaining).not.toBeNull();
    const remainingLots = await prisma.lot.count({ where: { projectId: sampleProjectId! } });
    expect(remainingLots).toBeGreaterThan(0);
    const remainingTemplates = await prisma.iTPTemplate.count({
      where: { projectId: sampleProjectId! },
    });
    expect(remainingTemplates).toBeGreaterThan(0);

    const archiveRes = await request(app)
      .patch(`/api/projects/${sampleProjectId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'archived' });

    expect(archiveRes.status).toBe(200);
    expect(archiveRes.body.project.status).toBe('archived');
  });
});
