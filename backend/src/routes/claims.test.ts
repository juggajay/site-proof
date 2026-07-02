import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { authRouter } from './auth.js';
import { prisma } from '../lib/prisma.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { AuditAction } from '../lib/auditLog.js';
import { registerTestUser } from '../test/routeTestHarness.js';

// Import claims router
import claimsRouter from './claims.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/projects', claimsRouter);
app.use(errorHandler);

const ORIGINAL_SUPABASE_URL = process.env.SUPABASE_URL;

function restoreOptionalEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

describe('Progress Claims API', () => {
  let authToken: string;
  let userId: string;
  let companyId: string;
  let projectId: string;
  let lotId1: string;
  let lotId2: string;
  let claimId: string;

  beforeAll(async () => {
    // Create test company
    const company = await prisma.company.create({
      data: { name: `Claims Test Company ${Date.now()}` },
    });
    companyId = company.id;

    // Create test user
    const primaryUser = await registerTestUser(app, {
      emailPrefix: 'claims-test',
      fullName: 'Claims Test User',
      companyId,
      roleInCompany: 'project_manager',
    });
    authToken = primaryUser.token;
    userId = primaryUser.userId;

    // Create project
    const project = await prisma.project.create({
      data: {
        name: `Claims Test Project ${Date.now()}`,
        projectNumber: `CLM-${Date.now()}`,
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

    // Create conformed lots with budget amounts for claiming
    const lot1 = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `CLM-LOT-1-${Date.now()}`,
        status: 'conformed',
        lotType: 'chainage',
        activityType: 'Earthworks',
        budgetAmount: 5000,
        conformedAt: new Date(),
        conformedById: userId,
      },
    });
    lotId1 = lot1.id;

    const lot2 = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `CLM-LOT-2-${Date.now()}`,
        status: 'conformed',
        lotType: 'chainage',
        activityType: 'Earthworks',
        budgetAmount: 7500,
        conformedAt: new Date(),
        conformedById: userId,
      },
    });
    lotId2 = lot2.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.notification.deleteMany({ where: { projectId } });
    await prisma.claimedLot.deleteMany({ where: { claim: { projectId } } });
    await prisma.progressClaim.deleteMany({ where: { projectId } });
    await prisma.document.deleteMany({ where: { projectId } });
    await prisma.nCRLot.deleteMany({ where: { lot: { projectId } } });
    await prisma.nCR.deleteMany({ where: { projectId } });
    await prisma.lot.deleteMany({ where: { projectId } });
    await prisma.projectUser.deleteMany({ where: { projectId } });
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
    await prisma.emailVerificationToken.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  });

  async function nextManualClaimNumber() {
    // Manual fixture claims share this project with route-created claims, so
    // allocate from the current database state instead of a stale local counter.
    const lastClaim = await prisma.progressClaim.findFirst({
      where: { projectId },
      orderBy: { claimNumber: 'desc' },
      select: { claimNumber: true },
    });

    return (lastClaim?.claimNumber ?? 0) + 1;
  }

  async function createSubmittedCertificationClaim(totalClaimedAmount = 1000) {
    const claimNumber = await nextManualClaimNumber();
    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `CERT-LOT-${claimNumber}-${Date.now()}`,
        status: 'conformed',
        lotType: 'chainage',
        activityType: 'Earthworks',
        budgetAmount: totalClaimedAmount,
        conformedAt: new Date(),
        conformedById: userId,
      },
    });

    const claim = await prisma.progressClaim.create({
      data: {
        projectId,
        claimNumber,
        claimPeriodStart: new Date('2025-04-01'),
        claimPeriodEnd: new Date('2025-04-30'),
        status: 'submitted',
        preparedById: userId,
        preparedAt: new Date(),
        totalClaimedAmount,
        submittedAt: new Date(),
        claimedLots: {
          create: {
            lotId: lot.id,
            quantity: 1,
            unit: 'ea',
            rate: totalClaimedAmount,
            amountClaimed: totalClaimedAmount,
            percentageComplete: 100,
          },
        },
      },
    });

    return claim;
  }

  async function createCertificationDocument(filename: string, fileUrl?: string) {
    return prisma.document.create({
      data: {
        projectId,
        documentType: 'certificate',
        category: 'certification',
        filename,
        fileUrl: fileUrl ?? `/uploads/documents/${filename}`,
        uploadedById: userId,
        caption: `Certification document ${filename}`,
      },
    });
  }

  async function createDraftWorkflowClaim(totalClaimedAmount = 1000) {
    const claimNumber = await nextManualClaimNumber();
    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `DRAFT-WORKFLOW-LOT-${claimNumber}-${Date.now()}`,
        status: 'claimed',
        lotType: 'chainage',
        activityType: 'Earthworks',
        budgetAmount: totalClaimedAmount,
        conformedAt: new Date(),
        conformedById: userId,
      },
    });

    const claim = await prisma.progressClaim.create({
      data: {
        projectId,
        claimNumber,
        claimPeriodStart: new Date('2025-04-01'),
        claimPeriodEnd: new Date('2025-04-30'),
        status: 'draft',
        preparedById: userId,
        preparedAt: new Date(),
        totalClaimedAmount,
        claimedLots: {
          create: {
            lotId: lot.id,
            quantity: 1,
            unit: 'ea',
            rate: totalClaimedAmount,
            amountClaimed: totalClaimedAmount,
            percentageComplete: 100,
          },
        },
      },
    });

    await prisma.lot.update({
      where: { id: lot.id },
      data: { claimedInId: claim.id },
    });

    return claim;
  }

  async function createClaimableLot(prefix: string, budgetAmount = 1000) {
    return prisma.lot.create({
      data: {
        projectId,
        lotNumber: `${prefix}-${Date.now()}`,
        status: 'conformed',
        lotType: 'chainage',
        activityType: 'Earthworks',
        budgetAmount,
        conformedAt: new Date(),
        conformedById: userId,
      },
    });
  }

  describe('GET /api/projects/:projectId/claim-readiness', () => {
    it('shows missing budget before claim creation while preserving create-time enforcement', async () => {
      const lotWithoutBudget = await prisma.lot.create({
        data: {
          projectId,
          lotNumber: `CLAIM-READY-NO-BUDGET-${Date.now()}`,
          status: 'conformed',
          lotType: 'chainage',
          activityType: 'Earthworks',
          conformedAt: new Date(),
          conformedById: userId,
        },
      });

      const readinessRes = await request(app)
        .get(`/api/projects/${projectId}/claim-readiness`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(readinessRes.status).toBe(200);
      const readinessLot = readinessRes.body.lots.find(
        (lot: { lotId: string }) => lot.lotId === lotWithoutBudget.id,
      );
      expect(readinessLot.claim.blockers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'missing_budget', blocksAction: true }),
        ]),
      );

      const createRes = await request(app)
        .post(`/api/projects/${projectId}/claims`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          periodStart: '2026-05-01',
          periodEnd: '2026-05-31',
          lots: [{ lotId: lotWithoutBudget.id, percentageComplete: 100 }],
        });

      expect(createRes.status).toBe(400);
      expect(createRes.body.error.message).toContain('do not have a rate set');
    });

    it('shows unreleased hold points as evidence blockers without action blocking', async () => {
      const lot = await createClaimableLot(`CLAIM-READY-HP-${Date.now()}`, 2000);
      const template = await prisma.iTPTemplate.create({
        data: {
          projectId,
          name: `Claim readiness HP template ${Date.now()}`,
          activityType: 'Earthworks',
        },
      });
      const checklistItem = await prisma.iTPChecklistItem.create({
        data: {
          templateId: template.id,
          sequenceNumber: 1,
          description: 'Superintendent release required',
          pointType: 'hold_point',
          responsibleParty: 'contractor',
          evidenceRequired: 'none',
        },
      });

      await prisma.holdPoint.create({
        data: {
          lotId: lot.id,
          itpChecklistItemId: checklistItem.id,
          pointType: 'hold_point',
          description: 'Superintendent release required',
          status: 'requested',
        },
      });

      const res = await request(app)
        .get(`/api/projects/${projectId}/claim-readiness`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      const readinessLot = res.body.lots.find((item: { lotId: string }) => item.lotId === lot.id);
      expect(readinessLot.claim.blockers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'unreleased_hold_points',
            blocksAction: false,
          }),
        ]),
      );
    });

    it('shows current workflow test results awaiting verification in claim readiness', async () => {
      const lot = await createClaimableLot(`CLAIM-READY-TEST-${Date.now()}`, 2000);

      await prisma.testResult.create({
        data: {
          projectId,
          lotId: lot.id,
          testType: 'Compaction',
          resultValue: 98.5,
          resultUnit: '%',
          specificationMin: 95,
          passFail: 'pass',
          status: 'entered',
          enteredById: userId,
          enteredAt: new Date(),
        },
      });

      const res = await request(app)
        .get(`/api/projects/${projectId}/claim-readiness`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      const readinessLot = res.body.lots.find((item: { lotId: string }) => item.lotId === lot.id);
      expect(readinessLot.claim.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'pending_tests',
            count: 1,
            blocksAction: false,
          }),
        ]),
      );
    });
  });

  describe('GET /api/projects/:projectId/lots', () => {
    it('should list lots for claiming', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/lots`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.lots).toBeDefined();
      expect(Array.isArray(res.body.lots)).toBe(true);
    });

    it('should filter by status', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/lots?status=conformed`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.lots).toBeDefined();
    });

    it('should filter for unclaimed lots', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/lots?unclaimed=true`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.lots).toBeDefined();
    });

    it('should reject malformed lot filter query parameters', async () => {
      const duplicateStatusRes = await request(app)
        .get(`/api/projects/${projectId}/lots`)
        .query({ status: ['conformed', 'claimed'] })
        .set('Authorization', `Bearer ${authToken}`);

      expect(duplicateStatusRes.status).toBe(400);
      expect(duplicateStatusRes.body.error.message).toContain(
        'status query parameter must be a single value',
      );

      const invalidStatusRes = await request(app)
        .get(`/api/projects/${projectId}/lots?status=not_a_status`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(invalidStatusRes.status).toBe(400);
      expect(invalidStatusRes.body.error.message).toContain('status must be one of');

      const duplicateUnclaimedRes = await request(app)
        .get(`/api/projects/${projectId}/lots`)
        .query({ unclaimed: ['true', 'false'] })
        .set('Authorization', `Bearer ${authToken}`);

      expect(duplicateUnclaimedRes.status).toBe(400);
      expect(duplicateUnclaimedRes.body.error.message).toContain(
        'unclaimed query parameter must be a single value',
      );

      const invalidUnclaimedRes = await request(app)
        .get(`/api/projects/${projectId}/lots?unclaimed=yes`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(invalidUnclaimedRes.status).toBe(400);
      expect(invalidUnclaimedRes.body.error.message).toContain('unclaimed must be true or false');
    });
  });

  describe('POST /api/projects/:projectId/claims', () => {
    it('should create a new claim', async () => {
      const today = new Date();
      const periodStart = new Date(today.getFullYear(), today.getMonth(), 1)
        .toISOString()
        .split('T')[0];
      const periodEnd = today.toISOString().split('T')[0];

      const res = await request(app)
        .post(`/api/projects/${projectId}/claims`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          periodStart,
          periodEnd,
          lots: [{ lotId: lotId1, percentageComplete: 100 }],
        });

      expect(res.status).toBe(201);
      expect(res.body.claim).toBeDefined();
      expect(res.body.claim.claimNumber).toBe(1);
      expect(res.body.claim.status).toBe('draft');
      expect(res.body.claim.totalClaimedAmount).toBe(5000);
      claimId = res.body.claim.id;
    });

    it('should reject claim without lots', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/claims`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          periodStart: '2025-01-01',
          periodEnd: '2025-01-31',
          lotIds: [],
        });

      expect(res.status).toBe(400);
    });

    it('should reject legacy lotIds payloads without explicit percentages', async () => {
      const lot = await createClaimableLot('LEGACY-CLAIM-LOT');

      try {
        const res = await request(app)
          .post(`/api/projects/${projectId}/claims`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            periodStart: '2025-02-01',
            periodEnd: '2025-02-28',
            lotIds: [lot.id],
          });

        if (res.status === 201) {
          await prisma.claimedLot.deleteMany({ where: { claimId: res.body.claim.id } });
          await prisma.progressClaim.delete({ where: { id: res.body.claim.id } }).catch(() => {});
          await prisma.lot.update({
            where: { id: lot.id },
            data: { claimedInId: null, status: 'conformed' },
          });
        }

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('percentageComplete');

        const unchangedLot = await prisma.lot.findUnique({ where: { id: lot.id } });
        expect(unchangedLot?.status).toBe('conformed');
        expect(unchangedLot?.claimedInId).toBeNull();
      } finally {
        await prisma.lot.delete({ where: { id: lot.id } }).catch(() => {});
      }
    });

    it('should reject claim lots missing explicit percentageComplete', async () => {
      const lot = await createClaimableLot('MISSING-PERCENT-LOT');

      try {
        const res = await request(app)
          .post(`/api/projects/${projectId}/claims`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            periodStart: '2025-02-01',
            periodEnd: '2025-02-28',
            lots: [{ lotId: lot.id }],
          });

        if (res.status === 201) {
          await prisma.claimedLot.deleteMany({ where: { claimId: res.body.claim.id } });
          await prisma.progressClaim.delete({ where: { id: res.body.claim.id } }).catch(() => {});
          await prisma.lot.update({
            where: { id: lot.id },
            data: { claimedInId: null, status: 'conformed' },
          });
        }

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('percentageComplete');

        const unchangedLot = await prisma.lot.findUnique({ where: { id: lot.id } });
        expect(unchangedLot?.status).toBe('conformed');
        expect(unchangedLot?.claimedInId).toBeNull();
      } finally {
        await prisma.lot.delete({ where: { id: lot.id } }).catch(() => {});
      }
    });

    it('should reject zero-percent claim increments without creating claim rows', async () => {
      const lot = await createClaimableLot('ZERO-PERCENT-LOT');

      try {
        const res = await request(app)
          .post(`/api/projects/${projectId}/claims`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            periodStart: '2025-02-01',
            periodEnd: '2025-02-28',
            lots: [{ lotId: lot.id, percentageComplete: 0 }],
          });

        expect(res.status).toBe(400);
        expect(JSON.stringify(res.body.error.details)).toContain(
          'Percentage complete must be greater than zero',
        );

        const unchangedLot = await prisma.lot.findUnique({ where: { id: lot.id } });
        expect(unchangedLot?.status).toBe('conformed');
        expect(unchangedLot?.claimedInId).toBeNull();
        await expect(prisma.claimedLot.count({ where: { lotId: lot.id } })).resolves.toBe(0);
      } finally {
        await prisma.lot.delete({ where: { id: lot.id } }).catch(() => {});
      }
    });

    it('should reject claim without period dates', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/claims`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          lots: [{ lotId: lotId2, percentageComplete: 100 }],
        });

      expect(res.status).toBe(400);
    });

    it('should reject invalid or reversed claim periods without mutating lots', async () => {
      const invalidDateRes = await request(app)
        .post(`/api/projects/${projectId}/claims`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          periodStart: 'not-a-date',
          periodEnd: '2025-01-31',
          lots: [{ lotId: lotId2, percentageComplete: 100 }],
        });

      expect(invalidDateRes.status).toBe(400);

      const reversedDateRes = await request(app)
        .post(`/api/projects/${projectId}/claims`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          periodStart: '2025-02-01',
          periodEnd: '2025-01-31',
          lots: [{ lotId: lotId2, percentageComplete: 100 }],
        });

      expect(reversedDateRes.status).toBe(400);

      const impossibleDateRes = await request(app)
        .post(`/api/projects/${projectId}/claims`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          periodStart: '2026-02-30',
          periodEnd: '2026-03-31',
          lots: [{ lotId: lotId2, percentageComplete: 100 }],
        });

      expect(impossibleDateRes.status).toBe(400);

      const unchangedLot = await prisma.lot.findUnique({ where: { id: lotId2 } });
      expect(unchangedLot?.status).toBe('conformed');
      expect(unchangedLot?.claimedInId).toBeNull();
    });

    it('should reject invalid partial claim percentages without mutating lots', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/claims`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          periodStart: '2025-02-01',
          periodEnd: '2025-02-28',
          lots: [{ lotId: lotId2, percentageComplete: 100.1 }],
        });

      expect(res.status).toBe(400);

      const unchangedLot = await prisma.lot.findUnique({ where: { id: lotId2 } });
      expect(unchangedLot?.status).toBe('conformed');
      expect(unchangedLot?.claimedInId).toBeNull();
    });

    it('should reject lots without budget amount', async () => {
      // Create a lot without budget amount
      const lotNoBudget = await prisma.lot.create({
        data: {
          projectId,
          lotNumber: `NO-BUDGET-${Date.now()}`,
          status: 'conformed',
          lotType: 'chainage',
          activityType: 'Earthworks',
          // No budgetAmount set
        },
      });

      const res = await request(app)
        .post(`/api/projects/${projectId}/claims`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          periodStart: '2025-02-01',
          periodEnd: '2025-02-28',
          lots: [{ lotId: lotNoBudget.id, percentageComplete: 100 }],
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');

      // Cleanup
      await prisma.lot.delete({ where: { id: lotNoBudget.id } });
    });

    it('should reject a stored conformed lot when an open NCR now blocks conformance', async () => {
      const staleLot = await createClaimableLot(`CLAIM-STALE-NCR-${Date.now()}`, 3200);
      const ncr = await prisma.nCR.create({
        data: {
          projectId,
          ncrNumber: `NCR-CLAIM-STALE-${Date.now()}`,
          description: 'Reopened defect blocks claiming',
          category: 'Workmanship',
          severity: 'minor',
          status: 'open',
          raisedById: userId,
          ncrLots: { create: { lotId: staleLot.id } },
        },
      });

      try {
        const res = await request(app)
          .post(`/api/projects/${projectId}/claims`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            periodStart: '2025-04-01',
            periodEnd: '2025-04-30',
            lots: [{ lotId: staleLot.id, percentageComplete: 100 }],
          });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('no longer satisfy conformance');
        expect(res.body.error.details).toMatchObject({
          code: 'CONFORMANCE_STALE',
          lots: [
            {
              id: staleLot.id,
              lotNumber: staleLot.lotNumber,
              blockingReasons: ['1 open NCR(s) must be closed'],
            },
          ],
        });

        const unchangedLot = await prisma.lot.findUnique({
          where: { id: staleLot.id },
          select: { status: true, claimedInId: true },
        });
        expect(unchangedLot).toEqual({ status: 'conformed', claimedInId: null });
        await expect(
          prisma.claimedLot.findFirst({ where: { lotId: staleLot.id } }),
        ).resolves.toBeNull();
      } finally {
        await prisma.nCRLot.deleteMany({ where: { ncrId: ncr.id } });
        await prisma.nCR.delete({ where: { id: ncr.id } }).catch(() => {});
        await prisma.lot.delete({ where: { id: staleLot.id } }).catch(() => {});
      }
    });

    it('should reject mixed valid and out-of-project lots without mutating either lot', async () => {
      const otherCompany = await prisma.company.create({
        data: { name: `Claims Other Company ${Date.now()}` },
      });
      const otherProject = await prisma.project.create({
        data: {
          name: `Claims Other Project ${Date.now()}`,
          projectNumber: `CLM-OTHER-${Date.now()}`,
          companyId: otherCompany.id,
          status: 'active',
          state: 'NSW',
          specificationSet: 'TfNSW',
        },
      });
      const otherLot = await prisma.lot.create({
        data: {
          projectId: otherProject.id,
          lotNumber: `OTHER-LOT-${Date.now()}`,
          status: 'conformed',
          lotType: 'chainage',
          activityType: 'Earthworks',
          budgetAmount: 2500,
        },
      });

      try {
        const res = await request(app)
          .post(`/api/projects/${projectId}/claims`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            periodStart: '2025-02-01',
            periodEnd: '2025-02-28',
            lots: [
              { lotId: lotId2, percentageComplete: 100 },
              { lotId: otherLot.id, percentageComplete: 100 },
            ],
          });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('All selected lots');

        const localLot = await prisma.lot.findUnique({ where: { id: lotId2 } });
        const unchangedOtherLot = await prisma.lot.findUnique({ where: { id: otherLot.id } });
        expect(localLot?.status).toBe('conformed');
        expect(localLot?.claimedInId).toBeNull();
        expect(unchangedOtherLot?.status).toBe('conformed');
        expect(unchangedOtherLot?.claimedInId).toBeNull();
      } finally {
        await prisma.lot.delete({ where: { id: otherLot.id } }).catch(() => {});
        await prisma.project.delete({ where: { id: otherProject.id } }).catch(() => {});
        await prisma.company.delete({ where: { id: otherCompany.id } }).catch(() => {});
      }
    });

    it('should allocate unique claim numbers for concurrent claim creation', async () => {
      const concurrentLots = await Promise.all(
        [1, 2].map((index) =>
          prisma.lot.create({
            data: {
              projectId,
              lotNumber: `CONCURRENT-CLAIM-${index}-${Date.now()}`,
              status: 'conformed',
              lotType: 'chainage',
              activityType: 'Earthworks',
              budgetAmount: 1000 + index,
              conformedAt: new Date(),
              conformedById: userId,
            },
          }),
        ),
      );

      const responses = await Promise.all(
        concurrentLots.map((lot, index) =>
          request(app)
            .post(`/api/projects/${projectId}/claims`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              periodStart: `2025-03-0${index + 1}`,
              periodEnd: '2025-03-31',
              lots: [{ lotId: lot.id, percentageComplete: 100 }],
            }),
        ),
      );

      for (const res of responses) {
        expect(res.status).toBe(201);
      }

      const claimNumbers = responses.map((res) => res.body.claim.claimNumber).sort((a, b) => a - b);
      expect(new Set(claimNumbers).size).toBe(2);
      expect(claimNumbers).toEqual([2, 3]);
    });

    it('should persist partial claim percentages and amounts and keep the lot claimable', async () => {
      const partialLot = await prisma.lot.create({
        data: {
          projectId,
          lotNumber: `PARTIAL-CLAIM-${Date.now()}`,
          status: 'conformed',
          lotType: 'chainage',
          activityType: 'Earthworks',
          budgetAmount: 10000,
          conformedAt: new Date(),
          conformedById: userId,
        },
      });

      const res = await request(app)
        .post(`/api/projects/${projectId}/claims`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          periodStart: '2025-08-01',
          periodEnd: '2025-08-31',
          lots: [{ lotId: partialLot.id, percentageComplete: 50.5 }],
        });

      expect(res.status).toBe(201);
      expect(res.body.claim.totalClaimedAmount).toBe(5050);

      const claimedLot = await prisma.claimedLot.findFirst({
        where: {
          claimId: res.body.claim.id,
          lotId: partialLot.id,
        },
      });
      expect(Number(claimedLot?.amountClaimed)).toBe(5050);
      expect(Number(claimedLot?.percentageComplete)).toBe(50.5);

      // Cumulative claiming: a partial claim must NOT lock the lot. It stays
      // conformed (claimedInId null) so the remaining 49.5% can be claimed
      // on a later claim.
      const updatedLot = await prisma.lot.findUnique({ where: { id: partialLot.id } });
      expect(updatedLot?.status).toBe('conformed');
      expect(updatedLot?.claimedInId).toBeNull();
    });
  });

  describe('Cumulative progress claims', () => {
    async function createCumulativeLot(budgetAmount: number) {
      return prisma.lot.create({
        data: {
          projectId,
          lotNumber: `CUMULATIVE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          status: 'conformed',
          lotType: 'chainage',
          activityType: 'Earthworks',
          budgetAmount,
          conformedAt: new Date(),
          conformedById: userId,
        },
      });
    }

    async function claimLot(lotId: string, percentageComplete: number) {
      return request(app)
        .post(`/api/projects/${projectId}/claims`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          periodStart: '2025-09-01',
          periodEnd: '2025-09-30',
          lots: [{ lotId, percentageComplete }],
        });
    }

    it('lets a lot be claimed across successive claims until it reaches 100%', async () => {
      const lot = await createCumulativeLot(200000);

      const first = await claimLot(lot.id, 50);
      expect(first.status).toBe(201);
      expect(first.body.claim.totalClaimedAmount).toBe(100000);

      const afterFirst = await prisma.lot.findUnique({ where: { id: lot.id } });
      expect(afterFirst?.status).toBe('conformed');
      expect(afterFirst?.claimedInId).toBeNull();

      const second = await claimLot(lot.id, 30);
      expect(second.status).toBe(201);
      expect(second.body.claim.totalClaimedAmount).toBe(60000);

      const afterSecond = await prisma.lot.findUnique({ where: { id: lot.id } });
      expect(afterSecond?.status).toBe('conformed');
      expect(afterSecond?.claimedInId).toBeNull();

      const third = await claimLot(lot.id, 20);
      expect(third.status).toBe(201);
      expect(third.body.claim.totalClaimedAmount).toBe(40000);

      // Cumulative now reaches 100% so the lot is finally locked to the
      // completing claim.
      const afterThird = await prisma.lot.findUnique({ where: { id: lot.id } });
      expect(afterThird?.status).toBe('claimed');
      expect(afterThird?.claimedInId).toBe(third.body.claim.id);

      const claimedLots = await prisma.claimedLot.findMany({ where: { lotId: lot.id } });
      const totalClaimed = claimedLots.reduce((sum, cl) => sum + Number(cl.amountClaimed ?? 0), 0);
      expect(totalClaimed).toBe(200000);
    });

    it('rejects an increment that would push cumulative progress past 100%', async () => {
      const lot = await createCumulativeLot(100000);

      const first = await claimLot(lot.id, 70);
      expect(first.status).toBe(201);

      const overClaim = await claimLot(lot.id, 40);
      expect(overClaim.status).toBe(400);
      expect(overClaim.body.error.details?.code).toBe('OVER_CLAIM');

      // The rejected claim must not have mutated the lot or created a row.
      const unchangedLot = await prisma.lot.findUnique({ where: { id: lot.id } });
      expect(unchangedLot?.status).toBe('conformed');
      expect(unchangedLot?.claimedInId).toBeNull();
      const claimedLots = await prisma.claimedLot.findMany({ where: { lotId: lot.id } });
      expect(claimedLots).toHaveLength(1);
    });

    it('serializes concurrent cumulative claims against the same lot', async () => {
      const lot = await createCumulativeLot(100000);

      const first = await claimLot(lot.id, 70);
      expect(first.status).toBe(201);

      await prisma.$executeRaw`
        CREATE OR REPLACE FUNCTION test_delay_claimed_lot_insert()
        RETURNS trigger AS $$
        BEGIN
          PERFORM pg_sleep(0.2);
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `;
      await prisma.$executeRaw`DROP TRIGGER IF EXISTS test_delay_claimed_lot_insert_trigger ON claimed_lots;`;
      await prisma.$executeRaw`
        CREATE TRIGGER test_delay_claimed_lot_insert_trigger
        BEFORE INSERT ON claimed_lots
        FOR EACH ROW
        EXECUTE FUNCTION test_delay_claimed_lot_insert();
      `;

      try {
        const responses = await Promise.all([claimLot(lot.id, 20), claimLot(lot.id, 20)]);

        expect(responses.map((res) => res.status).sort((a, b) => a - b)).toEqual([201, 400]);
        const rejected = responses.find((res) => res.status === 400);
        expect(rejected?.body.error.details?.code).toBe('OVER_CLAIM');

        const claimedLots = await prisma.claimedLot.findMany({ where: { lotId: lot.id } });
        expect(claimedLots).toHaveLength(2);
        const cumulativePercentage = claimedLots.reduce(
          (sum, claimedLot) => sum + Number(claimedLot.percentageComplete ?? 0),
          0,
        );
        expect(cumulativePercentage).toBe(90);
      } finally {
        await prisma.$executeRaw`DROP TRIGGER IF EXISTS test_delay_claimed_lot_insert_trigger ON claimed_lots;`;
        await prisma.$executeRaw`DROP FUNCTION IF EXISTS test_delay_claimed_lot_insert();`;
      }
    });

    it('allows claiming exactly the remaining percentage at the 100% boundary', async () => {
      const lot = await createCumulativeLot(100000);

      expect((await claimLot(lot.id, 60)).status).toBe(201);
      const final = await claimLot(lot.id, 40);
      expect(final.status).toBe(201);

      const finalLot = await prisma.lot.findUnique({ where: { id: lot.id } });
      expect(finalLot?.status).toBe('claimed');
      expect(finalLot?.claimedInId).toBe(final.body.claim.id);
    });

    it('rejects re-claiming a fully claimed lot', async () => {
      const lot = await createCumulativeLot(100000);

      expect((await claimLot(lot.id, 100)).status).toBe(201);

      const retry = await claimLot(lot.id, 10);
      // A fully claimed lot is status `claimed`, so it is no longer a valid
      // conformed lot for a new claim.
      expect(retry.status).toBe(400);
    });

    it('releases increments when a draft claim is deleted so the lot is claimable again', async () => {
      const lot = await createCumulativeLot(100000);

      expect((await claimLot(lot.id, 40)).status).toBe(201);
      const completing = await claimLot(lot.id, 60);
      expect(completing.status).toBe(201);

      const lockedLot = await prisma.lot.findUnique({ where: { id: lot.id } });
      expect(lockedLot?.status).toBe('claimed');
      expect(lockedLot?.claimedInId).toBe(completing.body.claim.id);

      // Deleting the completing draft claim must release its 60% increment and
      // return the lot to conformed so it can be claimed again.
      const del = await request(app)
        .delete(`/api/projects/${projectId}/claims/${completing.body.claim.id}`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(del.status).toBe(200);

      const releasedLot = await prisma.lot.findUnique({ where: { id: lot.id } });
      expect(releasedLot?.status).toBe('conformed');
      expect(releasedLot?.claimedInId).toBeNull();

      // Cumulative now back to 40%, so a further 60% is allowed again.
      const reclaim = await claimLot(lot.id, 60);
      expect(reclaim.status).toBe(201);

      const relockedLot = await prisma.lot.findUnique({ where: { id: lot.id } });
      expect(relockedLot?.status).toBe('claimed');
      expect(relockedLot?.claimedInId).toBe(reclaim.body.claim.id);
    });

    it('writes an audit log when a draft claim is deleted', async () => {
      const claim = await createDraftWorkflowClaim(1200);
      const auditCountBefore = await prisma.auditLog.count({
        where: {
          projectId,
          entityType: 'progress_claim',
          entityId: claim.id,
          action: AuditAction.CLAIM_DELETED,
        },
      });

      const del = await request(app)
        .delete(`/api/projects/${projectId}/claims/${claim.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(del.status).toBe(200);

      const auditLog = await prisma.auditLog.findFirst({
        where: {
          projectId,
          entityType: 'progress_claim',
          entityId: claim.id,
          action: AuditAction.CLAIM_DELETED,
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(auditLog).not.toBeNull();
      expect(
        await prisma.auditLog.count({
          where: {
            projectId,
            entityType: 'progress_claim',
            entityId: claim.id,
            action: AuditAction.CLAIM_DELETED,
          },
        }),
      ).toBe(auditCountBefore + 1);

      const changes = JSON.parse(auditLog!.changes ?? '{}') as {
        claimNumber?: number;
        previousStatus?: string;
        totalClaimedAmount?: number;
        lotCount?: number;
      };
      expect(changes).toMatchObject({
        claimNumber: claim.claimNumber,
        previousStatus: 'draft',
        totalClaimedAmount: 1200,
        lotCount: 1,
      });
    });

    it('does not let a stale draft delete remove a claim that another request submitted', async () => {
      const claim = await createDraftWorkflowClaim(1300);

      await prisma.$executeRaw`
        CREATE OR REPLACE FUNCTION test_delay_claim_release_update()
        RETURNS trigger AS $$
        BEGIN
          IF OLD.claimed_in_id IS NOT NULL AND NEW.claimed_in_id IS NULL THEN
            PERFORM pg_sleep(0.2);
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `;
      await prisma.$executeRaw`
        DROP TRIGGER IF EXISTS test_delay_claim_release_update_trigger ON lots
      `;
      await prisma.$executeRaw`
        CREATE TRIGGER test_delay_claim_release_update_trigger
        BEFORE UPDATE ON lots
        FOR EACH ROW
        EXECUTE FUNCTION test_delay_claim_release_update();
      `;

      try {
        const deletePromise = request(app)
          .delete(`/api/projects/${projectId}/claims/${claim.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        await new Promise((resolve) => setTimeout(resolve, 50));

        const submitPromise = request(app)
          .put(`/api/projects/${projectId}/claims/${claim.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status: 'submitted' });

        const [deleteRes, submitRes] = await Promise.all([deletePromise, submitPromise]);

        const successCount = [deleteRes.status, submitRes.status].filter(
          (status) => status === 200,
        ).length;
        expect(successCount).toBe(1);

        const storedClaim = await prisma.progressClaim.findUnique({ where: { id: claim.id } });
        if (submitRes.status === 200) {
          expect(deleteRes.status).not.toBe(200);
          expect(storedClaim?.status).toBe('submitted');
          expect(storedClaim?.submittedAt).not.toBeNull();
        }
        if (deleteRes.status === 200) {
          expect(submitRes.status).not.toBe(200);
          expect(storedClaim).toBeNull();
        }
        expect(storedClaim?.status).not.toBe('draft');
      } finally {
        await prisma.$executeRaw`
          DROP TRIGGER IF EXISTS test_delay_claim_release_update_trigger ON lots
        `;
        await prisma.$executeRaw`DROP FUNCTION IF EXISTS test_delay_claim_release_update()`;
      }
    });

    it('reports remaining percentage in claim readiness for a partially claimed lot', async () => {
      const lot = await createCumulativeLot(100000);
      expect((await claimLot(lot.id, 25)).status).toBe(201);

      const readiness = await request(app)
        .get(`/api/projects/${projectId}/claim-readiness`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(readiness.status).toBe(200);

      const readinessLot = readiness.body.lots.find(
        (item: { lotId: string }) => item.lotId === lot.id,
      );
      expect(readinessLot).toBeDefined();
      expect(readinessLot.claim.claimedPercentage).toBe(25);
      expect(readinessLot.claim.remainingPercentage).toBe(75);
      // A partially claimed conformed lot is selectable (no action blocker).
      expect(
        readinessLot.claim.blockers.some(
          (blocker: { blocksAction: boolean }) => blocker.blocksAction,
        ),
      ).toBe(false);
    });
  });

  describe('GET /api/projects/:projectId/claims', () => {
    it('should list all claims for project', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/claims`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.claims).toBeDefined();
      expect(Array.isArray(res.body.claims)).toBe(true);
      expect(res.body.claims.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/projects/:projectId/claims/:claimId', () => {
    it('should get a single claim with details', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/claims/${claimId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.claim).toBeDefined();
      expect(res.body.claim.id).toBe(claimId);
      expect(res.body.claim.claimedLots).toBeDefined();
    });

    it('should return 404 for non-existent claim', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/claims/non-existent-id`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('Route parameter validation', () => {
    it('should reject oversized claim route parameters before lookups', async () => {
      const longId = 'c'.repeat(121);
      const checks = [
        {
          label: 'GET claim lots projectId',
          response: await request(app)
            .get(`/api/projects/${longId}/lots`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'POST claim projectId',
          response: await request(app)
            .post(`/api/projects/${longId}/claims`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              periodStart: '2026-01-01',
              periodEnd: '2026-01-31',
              lots: [{ lotId: lotId1, percentageComplete: 100 }],
            }),
        },
        {
          label: 'GET claims projectId',
          response: await request(app)
            .get(`/api/projects/${longId}/claims`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'GET claim projectId',
          response: await request(app)
            .get(`/api/projects/${longId}/claims/${claimId}`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'GET claim claimId',
          response: await request(app)
            .get(`/api/projects/${projectId}/claims/${longId}`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'PUT claim projectId',
          response: await request(app)
            .put(`/api/projects/${longId}/claims/${claimId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ status: 'submitted' }),
        },
        {
          label: 'PUT claim claimId',
          response: await request(app)
            .put(`/api/projects/${projectId}/claims/${longId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ status: 'submitted' }),
        },
        {
          label: 'GET evidence package projectId',
          response: await request(app)
            .get(`/api/projects/${longId}/claims/${claimId}/evidence-package`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'GET evidence package claimId',
          response: await request(app)
            .get(`/api/projects/${projectId}/claims/${longId}/evidence-package`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'GET completeness check projectId',
          response: await request(app)
            .get(`/api/projects/${longId}/claims/${claimId}/completeness-check`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'GET completeness check claimId',
          response: await request(app)
            .get(`/api/projects/${projectId}/claims/${longId}/completeness-check`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'POST certify projectId',
          response: await request(app)
            .post(`/api/projects/${longId}/claims/${claimId}/certify`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ certifiedAmount: 100 }),
        },
        {
          label: 'POST certify claimId',
          response: await request(app)
            .post(`/api/projects/${projectId}/claims/${longId}/certify`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ certifiedAmount: 100 }),
        },
        {
          label: 'POST payment projectId',
          response: await request(app)
            .post(`/api/projects/${longId}/claims/${claimId}/payment`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ paidAmount: 50 }),
        },
        {
          label: 'POST payment claimId',
          response: await request(app)
            .post(`/api/projects/${projectId}/claims/${longId}/payment`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ paidAmount: 50 }),
        },
        {
          label: 'DELETE claim projectId',
          response: await request(app)
            .delete(`/api/projects/${longId}/claims/${claimId}`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'DELETE claim claimId',
          response: await request(app)
            .delete(`/api/projects/${projectId}/claims/${longId}`)
            .set('Authorization', `Bearer ${authToken}`),
        },
      ];

      for (const { label, response } of checks) {
        expect(response.status, label).toBe(400);
        expect(response.body.error.message, label).toContain('is too long');
      }
    });
  });

  describe('PUT /api/projects/:projectId/claims/:claimId - Status Workflow', () => {
    it('should submit a draft claim', async () => {
      const res = await request(app)
        .put(`/api/projects/${projectId}/claims/${claimId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'submitted',
        });

      expect(res.status).toBe(200);
      expect(res.body.claim.status).toBe('submitted');
      expect(res.body.claim.submittedAt).toBeDefined();
    });

    it('should not re-stamp submitted claims when generic update is retried', async () => {
      const claim = await createDraftWorkflowClaim();
      const originalSubmittedAt = new Date('2025-05-01T00:00:00.000Z');

      await prisma.progressClaim.update({
        where: { id: claim.id },
        data: {
          status: 'submitted',
          submittedAt: originalSubmittedAt,
        },
      });

      const auditCountBefore = await prisma.auditLog.count({
        where: {
          projectId,
          entityType: 'progress_claim',
          entityId: claim.id,
          action: AuditAction.CLAIM_STATUS_CHANGED,
        },
      });

      const res = await request(app)
        .put(`/api/projects/${projectId}/claims/${claim.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'submitted',
        });

      expect(res.status).toBe(200);

      const unchangedClaim = await prisma.progressClaim.findUnique({ where: { id: claim.id } });
      expect(unchangedClaim?.status).toBe('submitted');
      expect(unchangedClaim?.submittedAt?.toISOString()).toBe(originalSubmittedAt.toISOString());
      await expect(
        prisma.auditLog.count({
          where: {
            projectId,
            entityType: 'progress_claim',
            entityId: claim.id,
            action: AuditAction.CLAIM_STATUS_CHANGED,
          },
        }),
      ).resolves.toBe(auditCountBefore);
    });

    it('should reject certifying or disputing draft claims through the generic update route', async () => {
      const claim = await createDraftWorkflowClaim();

      const certifyRes = await request(app)
        .put(`/api/projects/${projectId}/claims/${claim.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'certified',
          certifiedAmount: 900,
        });

      expect(certifyRes.status).toBe(400);

      const disputeRes = await request(app)
        .put(`/api/projects/${projectId}/claims/${claim.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'disputed',
          disputeNotes: 'Draft claims should not be disputable.',
        });

      expect(disputeRes.status).toBe(400);

      const unchangedClaim = await prisma.progressClaim.findUnique({ where: { id: claim.id } });
      expect(unchangedClaim?.status).toBe('draft');
      expect(unchangedClaim?.certifiedAmount).toBeNull();
      expect(unchangedClaim?.disputeNotes).toBeNull();
      expect(unchangedClaim?.disputedAt).toBeNull();
    });

    it('should reject certification without a certified amount', async () => {
      const res = await request(app)
        .put(`/api/projects/${projectId}/claims/${claimId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'certified',
        });

      expect(res.status).toBe(400);
    });

    it('should reject negative certification amounts', async () => {
      const res = await request(app)
        .put(`/api/projects/${projectId}/claims/${claimId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'certified',
          certifiedAmount: -1,
        });

      expect(res.status).toBe(400);
    });

    it('should reject non-finite certification amounts', async () => {
      const res = await request(app)
        .put(`/api/projects/${projectId}/claims/${claimId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{"status":"certified","certifiedAmount":1e309}');

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body.error.details)).toContain('finite');
    });

    it('should reject certification above the claimed amount through the generic update route', async () => {
      const res = await request(app)
        .put(`/api/projects/${projectId}/claims/${claimId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'certified',
          certifiedAmount: 5000.01,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Certified amount cannot exceed');

      const unchangedClaim = await prisma.progressClaim.findUnique({ where: { id: claimId } });
      expect(unchangedClaim?.status).toBe('submitted');
      expect(unchangedClaim?.certifiedAmount).toBeNull();
      expect(unchangedClaim?.certifiedAt).toBeNull();
    });

    it('should reject reduced generic certification without variation notes', async () => {
      const claim = await createSubmittedCertificationClaim(1000);

      const res = await request(app)
        .put(`/api/projects/${projectId}/claims/${claim.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'certified',
          certifiedAmount: 900,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Variation notes are required');

      const unchangedClaim = await prisma.progressClaim.findUnique({ where: { id: claim.id } });
      expect(unchangedClaim?.status).toBe('submitted');
      expect(unchangedClaim?.certifiedAmount).toBeNull();
      expect(unchangedClaim?.disputeNotes).toBeNull();
    });

    it('should reject re-certifying below the amount already paid through the generic update route', async () => {
      const claim = await createDraftWorkflowClaim(1000);
      await prisma.progressClaim.update({
        where: { id: claim.id },
        data: {
          status: 'disputed',
          submittedAt: new Date('2025-05-01T00:00:00.000Z'),
          certifiedAmount: 1000,
          certifiedAt: new Date('2025-05-02T00:00:00.000Z'),
          paidAmount: 500,
          disputedAt: new Date('2025-05-03T00:00:00.000Z'),
        },
      });

      const res = await request(app)
        .put(`/api/projects/${projectId}/claims/${claim.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'certified',
          certifiedAmount: 100,
          disputeNotes: 'Re-certified lower after dispute review',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/already paid/i);

      const unchangedClaim = await prisma.progressClaim.findUnique({ where: { id: claim.id } });
      expect(unchangedClaim?.status).toBe('disputed');
      expect(Number(unchangedClaim?.paidAmount)).toBe(500);
      expect(Number(unchangedClaim?.certifiedAmount)).toBe(1000);
    });

    it('should round generic certification amounts to cents before validation and storage', async () => {
      const claim = await createSubmittedCertificationClaim(1000);

      const res = await request(app)
        .put(`/api/projects/${projectId}/claims/${claim.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'certified',
          certifiedAmount: 999.999,
        });

      expect(res.status).toBe(200);
      expect(Number(res.body.claim.certifiedAmount)).toBe(1000);
      expect(res.body.claim.certification.certifiedByName).toBeNull();

      const updatedClaim = await prisma.progressClaim.findUnique({ where: { id: claim.id } });
      expect(updatedClaim?.status).toBe('certified');
      expect(Number(updatedClaim?.certifiedAmount)).toBe(1000);
    });

    it('should certify a submitted claim', async () => {
      const res = await request(app)
        .put(`/api/projects/${projectId}/claims/${claimId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'certified',
          certifiedAmount: 4800,
          disputeNotes: 'Principal certified a reduced amount',
        });

      expect(res.status).toBe(200);
      expect(res.body.claim.status).toBe('certified');
      // Prisma returns Decimal as string
      expect(Number(res.body.claim.certifiedAmount)).toBe(4800);
      expect(res.body.claim.certification.variationNotes).toBe(
        'Principal certified a reduced amount',
      );
    });

    it('should not re-stamp certified claims when generic update is retried', async () => {
      const claim = await createSubmittedCertificationClaim(1000);
      const originalCertifiedAt = new Date('2025-05-01T00:00:00.000Z');

      await prisma.progressClaim.update({
        where: { id: claim.id },
        data: {
          status: 'certified',
          certifiedAmount: 1000,
          certifiedAt: originalCertifiedAt,
        },
      });

      const res = await request(app)
        .put(`/api/projects/${projectId}/claims/${claim.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'certified',
          certifiedAmount: 1000,
        });

      expect(res.status).toBe(200);

      const unchangedClaim = await prisma.progressClaim.findUnique({ where: { id: claim.id } });
      expect(unchangedClaim?.status).toBe('certified');
      expect(Number(unchangedClaim?.certifiedAmount)).toBe(1000);
      expect(unchangedClaim?.certifiedAt?.toISOString()).toBe(originalCertifiedAt.toISOString());
    });

    it('should not re-stamp disputed claims when generic update is retried', async () => {
      const claim = await createSubmittedCertificationClaim(1000);
      const originalDisputedAt = new Date('2025-05-02T00:00:00.000Z');

      await prisma.progressClaim.update({
        where: { id: claim.id },
        data: {
          status: 'disputed',
          disputeNotes: 'Original dispute notes',
          disputedAt: originalDisputedAt,
        },
      });

      const res = await request(app)
        .put(`/api/projects/${projectId}/claims/${claim.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'disputed',
          disputeNotes: 'Original dispute notes',
        });

      expect(res.status).toBe(200);

      const unchangedClaim = await prisma.progressClaim.findUnique({ where: { id: claim.id } });
      expect(unchangedClaim?.status).toBe('disputed');
      expect(unchangedClaim?.disputeNotes).toBe('Original dispute notes');
      expect(unchangedClaim?.disputedAt?.toISOString()).toBe(originalDisputedAt.toISOString());
    });

    it('should reject payment above the certified amount', async () => {
      const res = await request(app)
        .put(`/api/projects/${projectId}/claims/${claimId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'paid',
          paidAmount: 4800.01,
          paymentReference: 'PAY-2025-OVER',
        });

      expect(res.status).toBe(400);
    });

    it('should reject marking uncertified claims as paid through the generic update route', async () => {
      const claim = await createSubmittedCertificationClaim();

      const res = await request(app)
        .put(`/api/projects/${projectId}/claims/${claim.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'paid',
          paidAmount: 1,
          paymentReference: 'PAY-UNCERTIFIED',
        });

      expect(res.status).toBe(400);

      const unchangedClaim = await prisma.progressClaim.findUnique({ where: { id: claim.id } });
      expect(unchangedClaim?.status).toBe('submitted');
      expect(unchangedClaim?.paidAmount).toBeNull();
      expect(unchangedClaim?.paidAt).toBeNull();
      expect(unchangedClaim?.paymentReference).toBeNull();
    });

    it('should reject non-finite paid amounts', async () => {
      const res = await request(app)
        .put(`/api/projects/${projectId}/claims/${claimId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{"status":"paid","paidAmount":1e309}');

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body.error.details)).toContain('finite');
    });

    it('should reject oversized status workflow text without mutating the claim', async () => {
      const claim = await createSubmittedCertificationClaim();
      const cases = [
        {
          field: 'paymentReference',
          payload: { status: 'paid', paidAmount: 1, paymentReference: 'R'.repeat(161) },
        },
        {
          field: 'disputeNotes',
          payload: { status: 'disputed', disputeNotes: 'D'.repeat(5001) },
        },
      ];

      for (const testCase of cases) {
        const res = await request(app)
          .put(`/api/projects/${projectId}/claims/${claim.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(testCase.payload);

        expect(res.status).toBe(400);
        expect(JSON.stringify(res.body.error.details)).toContain(testCase.field);
      }

      const unchangedClaim = await prisma.progressClaim.findUnique({ where: { id: claim.id } });
      expect(unchangedClaim?.status).toBe('submitted');
      expect(unchangedClaim?.paidAmount).toBeNull();
      expect(unchangedClaim?.paymentReference).toBeNull();
      expect(unchangedClaim?.disputeNotes).toBeNull();
      expect(unchangedClaim?.disputedAt).toBeNull();
    });

    it('should reject blank dispute notes without mutating the claim', async () => {
      const claim = await createSubmittedCertificationClaim();

      const res = await request(app)
        .put(`/api/projects/${projectId}/claims/${claim.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'disputed',
          disputeNotes: '   ',
        });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body.error.details)).toContain('Dispute notes are required');

      const unchangedClaim = await prisma.progressClaim.findUnique({ where: { id: claim.id } });
      expect(unchangedClaim?.status).toBe('submitted');
      expect(unchangedClaim?.disputeNotes).toBeNull();
      expect(unchangedClaim?.disputedAt).toBeNull();
    });

    it('should reject partial payment amounts through the generic paid transition', async () => {
      const claim = await createSubmittedCertificationClaim(1000);
      await prisma.progressClaim.update({
        where: { id: claim.id },
        data: {
          status: 'certified',
          certifiedAmount: 1000,
          certifiedAt: new Date(),
        },
      });

      const res = await request(app)
        .put(`/api/projects/${projectId}/claims/${claim.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'paid',
          paidAmount: 999,
          paymentReference: 'PAY-PARTIAL-GENERIC',
        });

      expect(res.status).toBe(400);

      const unchangedClaim = await prisma.progressClaim.findUnique({ where: { id: claim.id } });
      expect(unchangedClaim?.status).toBe('certified');
      expect(Number(unchangedClaim?.certifiedAmount)).toBe(1000);
      expect(unchangedClaim?.paidAmount).toBeNull();
      expect(unchangedClaim?.paymentReference).toBeNull();
    });

    it('should mark claim as paid', async () => {
      const res = await request(app)
        .put(`/api/projects/${projectId}/claims/${claimId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'paid',
          paidAmount: 4800,
          paymentReference: 'PAY-2025-001',
        });

      expect(res.status).toBe(200);
      expect(res.body.claim.status).toBe('paid');
      // Prisma returns Decimal as string
      expect(Number(res.body.claim.paidAmount)).toBe(4800);
    });

    it('should only mark a certified claim paid once under concurrent generic updates', async () => {
      const claim = await createSubmittedCertificationClaim(1000);
      await prisma.progressClaim.update({
        where: { id: claim.id },
        data: {
          status: 'certified',
          certifiedAmount: 1000,
          certifiedAt: new Date(),
        },
      });

      await prisma.$executeRaw`
        CREATE OR REPLACE FUNCTION test_delay_generic_claim_paid_update()
        RETURNS trigger AS $$
        BEGIN
          IF OLD.status = 'certified' AND NEW.status = 'paid' THEN
            PERFORM pg_sleep(0.25);
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `;
      await prisma.$executeRaw`
        DROP TRIGGER IF EXISTS test_delay_generic_claim_paid_update_trigger ON progress_claims
      `;
      await prisma.$executeRaw`
        CREATE TRIGGER test_delay_generic_claim_paid_update_trigger
        BEFORE UPDATE ON progress_claims
        FOR EACH ROW
        EXECUTE FUNCTION test_delay_generic_claim_paid_update();
      `;

      try {
        const markPaid = (paymentReference: string) =>
          request(app)
            .put(`/api/projects/${projectId}/claims/${claim.id}`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              status: 'paid',
              paidAmount: 1000,
              paymentReference,
            });

        const responses = await Promise.all([
          markPaid('PAY-GENERIC-CONCURRENT-001'),
          markPaid('PAY-GENERIC-CONCURRENT-002'),
        ]);
        const statuses = responses.map((response) => response.status).sort((a, b) => a - b);

        expect(statuses).toEqual([200, 400]);

        const updatedClaim = await prisma.progressClaim.findUnique({ where: { id: claim.id } });
        expect(updatedClaim?.status).toBe('paid');
        expect(Number(updatedClaim?.paidAmount)).toBe(1000);

        const notificationCount = await prisma.notification.count({
          where: {
            projectId,
            type: 'claim_paid',
            message: { contains: `Claim #${claim.claimNumber}` },
          },
        });
        expect(notificationCount).toBe(1);

        const auditCount = await prisma.auditLog.count({
          where: {
            projectId,
            entityType: 'progress_claim',
            entityId: claim.id,
            action: AuditAction.CLAIM_STATUS_CHANGED,
          },
        });
        expect(auditCount).toBe(1);
      } finally {
        await prisma.$executeRaw`
          DROP TRIGGER IF EXISTS test_delay_generic_claim_paid_update_trigger ON progress_claims
        `;
        await prisma.$executeRaw`
          DROP FUNCTION IF EXISTS test_delay_generic_claim_paid_update()
        `;
      }
    });

    it('should reject updates to paid claims', async () => {
      const res = await request(app)
        .put(`/api/projects/${projectId}/claims/${claimId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'certified',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/projects/:projectId/claims/:claimId/certify', () => {
    it('should reject re-certifying an already certified claim', async () => {
      const claim = await createSubmittedCertificationClaim(1000);
      await prisma.progressClaim.update({
        where: { id: claim.id },
        data: {
          status: 'certified',
          certifiedAmount: 800,
          certifiedAt: new Date('2025-05-05T00:00:00.000Z'),
        },
      });
      const auditCountBefore = await prisma.auditLog.count({
        where: {
          projectId,
          entityType: 'progress_claim',
          entityId: claim.id,
          action: AuditAction.CLAIM_CERTIFIED,
        },
      });

      const res = await request(app)
        .post(`/api/projects/${projectId}/claims/${claim.id}/certify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          certifiedAmount: 900,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Current status: certified');

      const unchangedClaim = await prisma.progressClaim.findUnique({ where: { id: claim.id } });
      expect(unchangedClaim?.status).toBe('certified');
      expect(Number(unchangedClaim?.certifiedAmount)).toBe(800);
      expect(unchangedClaim?.certifiedAt?.toISOString()).toBe('2025-05-05T00:00:00.000Z');
      await expect(
        prisma.auditLog.count({
          where: {
            projectId,
            entityType: 'progress_claim',
            entityId: claim.id,
            action: AuditAction.CLAIM_CERTIFIED,
          },
        }),
      ).resolves.toBe(auditCountBefore);
    });

    it('should reject non-finite certification amounts', async () => {
      const claim = await createSubmittedCertificationClaim();

      const res = await request(app)
        .post(`/api/projects/${projectId}/claims/${claim.id}/certify`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{"certifiedAmount":1e309}');

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body.error.details)).toContain('finite');

      const unchangedClaim = await prisma.progressClaim.findUnique({ where: { id: claim.id } });
      expect(unchangedClaim?.status).toBe('submitted');
      expect(unchangedClaim?.certifiedAmount).toBeNull();
    });

    it('should reject certification above the claimed amount without creating documents', async () => {
      const claim = await createSubmittedCertificationClaim(1000);
      const certificationDocument = await createCertificationDocument(
        `over-certified-${claim.claimNumber}.pdf`,
      );
      const documentCountBefore = await prisma.document.count({ where: { projectId } });

      const res = await request(app)
        .post(`/api/projects/${projectId}/claims/${claim.id}/certify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          certifiedAmount: 1000.01,
          certificationDocumentId: certificationDocument.id,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Certified amount cannot exceed');

      const unchangedClaim = await prisma.progressClaim.findUnique({ where: { id: claim.id } });
      expect(unchangedClaim?.status).toBe('submitted');
      expect(unchangedClaim?.certifiedAmount).toBeNull();
      expect(unchangedClaim?.certifiedAt).toBeNull();
      expect(await prisma.document.count({ where: { projectId } })).toBe(documentCountBefore);
      expect(await prisma.document.count({ where: { id: certificationDocument.id } })).toBe(1);
    });

    it('should reject reduced certification without variation notes', async () => {
      const claim = await createSubmittedCertificationClaim(1000);
      const certificationDocument = await createCertificationDocument(
        `reduced-without-notes-${claim.claimNumber}.pdf`,
      );

      const res = await request(app)
        .post(`/api/projects/${projectId}/claims/${claim.id}/certify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          certifiedAmount: 900,
          certificationDocumentId: certificationDocument.id,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Variation notes are required');

      const unchangedClaim = await prisma.progressClaim.findUnique({ where: { id: claim.id } });
      expect(unchangedClaim?.status).toBe('submitted');
      expect(unchangedClaim?.certifiedAmount).toBeNull();
      expect(unchangedClaim?.disputeNotes).toBeNull();
      expect(await prisma.document.count({ where: { id: certificationDocument.id } })).toBe(1);
    });

    it('should reject oversized certification text without mutating the claim', async () => {
      const claim = await createSubmittedCertificationClaim();
      const cases = [
        {
          field: 'variationNotes',
          payload: { certifiedAmount: 900, variationNotes: 'V'.repeat(2001) },
        },
        {
          field: 'certificationDocumentId',
          payload: { certifiedAmount: 900, certificationDocumentId: 'D'.repeat(121) },
        },
      ];
      const documentCountBefore = await prisma.document.count({ where: { projectId } });

      for (const testCase of cases) {
        const res = await request(app)
          .post(`/api/projects/${projectId}/claims/${claim.id}/certify`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(testCase.payload);

        expect(res.status).toBe(400);
        expect(JSON.stringify(res.body.error.details)).toContain(testCase.field);
      }

      const unchangedClaim = await prisma.progressClaim.findUnique({ where: { id: claim.id } });
      expect(unchangedClaim?.status).toBe('submitted');
      expect(unchangedClaim?.certifiedAmount).toBeNull();
      expect(unchangedClaim?.disputeNotes).toBeNull();
      expect(await prisma.document.count({ where: { projectId } })).toBe(documentCountBefore);
    });

    it('should reject legacy certification document URL payloads', async () => {
      const claim = await createSubmittedCertificationClaim();
      const legacyUrl = `/uploads/documents/certification-${claim.claimNumber}.pdf`;
      const documentCountBefore = await prisma.document.count({ where: { projectId } });

      const res = await request(app)
        .post(`/api/projects/${projectId}/claims/${claim.id}/certify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          certifiedAmount: 900,
          certificationDocumentUrl: legacyUrl,
          certificationDocumentFilename: 'legacy-certification.pdf',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Validation failed');
      expect(JSON.stringify(res.body.error.details)).toContain(
        'certificationDocumentUrl is no longer supported',
      );
      expect(JSON.stringify(res.body.error.details)).toContain(
        'certificationDocumentFilename is no longer supported',
      );
      expect(await prisma.document.count({ where: { projectId } })).toBe(documentCountBefore);
      const unchangedClaim = await prisma.progressClaim.findUnique({ where: { id: claim.id } });
      expect(unchangedClaim?.status).toBe('submitted');
    });

    it('should reject configured Supabase certification document URLs', async () => {
      process.env.SUPABASE_URL = 'https://siteproof.supabase.co';
      const claim = await createSubmittedCertificationClaim();
      const publicUrl = `https://siteproof.supabase.co/storage/v1/object/public/documents/${projectId}/certification.pdf`;

      try {
        const res = await request(app)
          .post(`/api/projects/${projectId}/claims/${claim.id}/certify`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            certifiedAmount: 900,
            certificationDocumentUrl: publicUrl,
          });

        expect(res.status).toBe(400);
        expect(JSON.stringify(res.body.error.details)).toContain(
          'certificationDocumentUrl is no longer supported',
        );
        expect(await prisma.document.count({ where: { projectId, fileUrl: publicUrl } })).toBe(0);
      } finally {
        restoreOptionalEnv('SUPABASE_URL', ORIGINAL_SUPABASE_URL);
      }
    });

    it('should reject certification document IDs outside the claim project', async () => {
      const claim = await createSubmittedCertificationClaim();
      const otherProject = await prisma.project.create({
        data: {
          name: `Claims Other Cert Project ${Date.now()}`,
          projectNumber: `CLM-CERT-OTHER-${Date.now()}`,
          companyId,
          status: 'active',
          state: 'NSW',
          specificationSet: 'TfNSW',
        },
      });
      const otherDocument = await prisma.document.create({
        data: {
          projectId: otherProject.id,
          documentType: 'certificate',
          category: 'certification',
          filename: 'other-project-cert.pdf',
          fileUrl: '/uploads/documents/other-project-cert.pdf',
          uploadedById: userId,
        },
      });

      try {
        const res = await request(app)
          .post(`/api/projects/${projectId}/claims/${claim.id}/certify`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            certifiedAmount: 1000,
            certificationDocumentId: otherDocument.id,
          });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('document in this project');
      } finally {
        await prisma.document.delete({ where: { id: otherDocument.id } }).catch(() => {});
        await prisma.project.delete({ where: { id: otherProject.id } }).catch(() => {});
      }
    });

    it('should reject same-project documents that are not certification documents', async () => {
      const claim = await createSubmittedCertificationClaim();
      const wrongDocument = await prisma.document.create({
        data: {
          projectId,
          documentType: 'photo',
          category: 'quality',
          filename: 'site-photo-is-not-a-certificate.jpg',
          fileUrl: '/uploads/documents/site-photo-is-not-a-certificate.jpg',
          uploadedById: userId,
        },
      });

      try {
        const res = await request(app)
          .post(`/api/projects/${projectId}/claims/${claim.id}/certify`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            certifiedAmount: 1000,
            certificationDocumentId: wrongDocument.id,
          });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('certification document');
        const unchangedClaim = await prisma.progressClaim.findUnique({ where: { id: claim.id } });
        expect(unchangedClaim?.status).toBe('submitted');
      } finally {
        await prisma.document.delete({ where: { id: wrongDocument.id } }).catch(() => {});
      }
    });

    it('should certify with a project certification document id', async () => {
      const claim = await createSubmittedCertificationClaim();
      const fileUrl = `/uploads/documents/certification-${claim.claimNumber}.pdf`;
      const certificationDocument = await createCertificationDocument(
        `certification-${claim.claimNumber}.pdf`,
        fileUrl,
      );

      const res = await request(app)
        .post(`/api/projects/${projectId}/claims/${claim.id}/certify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          certifiedAmount: 1000,
          certificationDocumentId: certificationDocument.id,
        });

      expect(res.status).toBe(200);
      expect(res.body.claim.status).toBe('certified');
      expect(res.body.claim.certificationDocumentId).toBe(certificationDocument.id);

      const document = await prisma.document.findUnique({
        where: { id: res.body.claim.certificationDocumentId },
      });
      expect(document?.projectId).toBe(projectId);
      expect(document?.fileUrl).toBe(fileUrl);
      expect(document?.filename).toBe(certificationDocument.filename);

      const updatedClaim = await prisma.progressClaim.findUnique({ where: { id: claim.id } });
      const certificationMetadata = JSON.parse(updatedClaim?.disputeNotes || '{}') as {
        variationNotes?: string | null;
        certificationDocumentId?: string | null;
        certifiedBy?: string;
      };
      expect(certificationMetadata.variationNotes).toBeNull();
      expect(certificationMetadata.certificationDocumentId).toBe(document?.id);
      expect(certificationMetadata.certifiedBy).toBe(userId);
    });

    it('should round dedicated certification amounts to cents before validation and storage', async () => {
      const claim = await createSubmittedCertificationClaim(1000);

      const res = await request(app)
        .post(`/api/projects/${projectId}/claims/${claim.id}/certify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          certifiedAmount: 999.999,
        });

      expect(res.status).toBe(200);
      expect(res.body.claim.status).toBe('certified');
      expect(res.body.claim.certifiedAmount).toBe(1000);

      const updatedClaim = await prisma.progressClaim.findUnique({ where: { id: claim.id } });
      expect(updatedClaim?.status).toBe('certified');
      expect(Number(updatedClaim?.certifiedAmount)).toBe(1000);
    });

    it('clears active dispute fields when a disputed claim is certified', async () => {
      const claim = await createSubmittedCertificationClaim(1000);

      await request(app)
        .put(`/api/projects/${projectId}/claims/${claim.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'disputed',
          disputeNotes: 'Quantity support missing',
        })
        .expect(200);

      const res = await request(app)
        .post(`/api/projects/${projectId}/claims/${claim.id}/certify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          certifiedAmount: 1000,
        });

      expect(res.status).toBe(200);
      expect(res.body.claim.status).toBe('certified');

      const detailRes = await request(app)
        .get(`/api/projects/${projectId}/claims/${claim.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.claim.status).toBe('certified');
      expect(detailRes.body.claim.disputeNotes).toBeNull();
      expect(detailRes.body.claim.disputedAt).toBeNull();
      expect(detailRes.body.claim.certification.certifiedByName).toBeTruthy();

      const updatedClaim = await prisma.progressClaim.findUnique({ where: { id: claim.id } });
      expect(updatedClaim?.disputedAt).toBeNull();
      const certificationMetadata = JSON.parse(updatedClaim?.disputeNotes || '{}') as {
        resolvedDisputeNotes?: string;
      };
      expect(certificationMetadata.resolvedDisputeNotes).toBe('Quantity support missing');
    });

    it('should only certify a submitted claim once under concurrent requests', async () => {
      const claim = await createSubmittedCertificationClaim(1000);
      const certificationDocument = await createCertificationDocument(
        `concurrent-certification-${claim.claimNumber}.pdf`,
      );

      await prisma.$executeRaw`
        CREATE OR REPLACE FUNCTION test_delay_claim_certification_update()
        RETURNS trigger AS $$
        BEGIN
          PERFORM pg_sleep(0.2);
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `;
      await prisma.$executeRaw`
        DROP TRIGGER IF EXISTS test_delay_claim_certification_update_trigger ON progress_claims
      `;
      await prisma.$executeRaw`
        CREATE TRIGGER test_delay_claim_certification_update_trigger
        BEFORE UPDATE ON progress_claims
        FOR EACH ROW
        EXECUTE FUNCTION test_delay_claim_certification_update();
      `;

      try {
        const responses = await Promise.all([
          request(app)
            .post(`/api/projects/${projectId}/claims/${claim.id}/certify`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              certifiedAmount: 900,
              variationNotes: 'Concurrent certification reduced by schedule',
              certificationDocumentId: certificationDocument.id,
            }),
          request(app)
            .post(`/api/projects/${projectId}/claims/${claim.id}/certify`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              certifiedAmount: 900,
              variationNotes: 'Concurrent certification reduced by schedule',
              certificationDocumentId: certificationDocument.id,
            }),
        ]);

        expect(responses.map((res) => res.status).sort()).toEqual([200, 400]);

        const updatedClaim = await prisma.progressClaim.findUnique({ where: { id: claim.id } });
        expect(updatedClaim?.status).toBe('certified');
        expect(Number(updatedClaim?.certifiedAmount)).toBe(900);

        await expect(
          prisma.document.count({ where: { id: certificationDocument.id } }),
        ).resolves.toBe(1);
        await expect(
          prisma.auditLog.count({
            where: {
              projectId,
              entityType: 'progress_claim',
              entityId: claim.id,
              action: AuditAction.CLAIM_CERTIFIED,
            },
          }),
        ).resolves.toBe(1);
      } finally {
        await prisma.$executeRaw`
          DROP TRIGGER IF EXISTS test_delay_claim_certification_update_trigger ON progress_claims
        `;
        await prisma.$executeRaw`
          DROP FUNCTION IF EXISTS test_delay_claim_certification_update()
        `;
      }
    });

    it('should certify with a Supabase-backed project document id', async () => {
      const claim = await createSubmittedCertificationClaim();
      const expectedStoredFileUrl = `supabase://documents/${projectId}/certification-${claim.claimNumber}.pdf`;
      const certificationDocument = await createCertificationDocument(
        'supabase-certification.pdf',
        expectedStoredFileUrl,
      );

      const res = await request(app)
        .post(`/api/projects/${projectId}/claims/${claim.id}/certify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          certifiedAmount: 1000,
          certificationDocumentId: certificationDocument.id,
        });

      expect(res.status).toBe(200);
      expect(res.body.claim.status).toBe('certified');
      expect(res.body.claim.certificationDocumentId).toBe(certificationDocument.id);

      const document = await prisma.document.findUnique({
        where: { id: res.body.claim.certificationDocumentId },
      });
      expect(document?.projectId).toBe(projectId);
      expect(document?.fileUrl).toBe(expectedStoredFileUrl);
      expect(document?.filename).toBe('supabase-certification.pdf');
    });

    it('surfaces parsed certification metadata on the read-back routes after certifying', async () => {
      const claim = await createSubmittedCertificationClaim(1000);
      const certificationDocument = await createCertificationDocument(
        `readback-${claim.claimNumber}.pdf`,
      );

      const certifyRes = await request(app)
        .post(`/api/projects/${projectId}/claims/${claim.id}/certify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          certifiedAmount: 900,
          variationNotes: 'Approved with a minor variation',
          certificationDocumentId: certificationDocument.id,
        });

      expect(certifyRes.status).toBe(200);
      const certificationDocumentId = certifyRes.body.claim.certificationDocumentId as string;
      expect(certificationDocumentId).toBe(certificationDocument.id);

      // Detail GET surfaces the parsed certification sub-object (who/notes/cert)
      // without exposing the raw disputeNotes JSON metadata.
      const detailRes = await request(app)
        .get(`/api/projects/${projectId}/claims/${claim.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.claim.certification).toMatchObject({
        variationNotes: 'Approved with a minor variation',
        certificationDocumentId,
      });
      expect(detailRes.body.claim.certification.certifiedByName).toBeTruthy();
      expect(detailRes.body.claim.disputeNotes).toBeNull();

      // List GET surfaces the same certification read-back for the certified claim.
      const listRes = await request(app)
        .get(`/api/projects/${projectId}/claims`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(listRes.status).toBe(200);
      const listed = (
        listRes.body.claims as Array<{
          id: string;
          certification?: unknown;
          disputeNotes?: unknown;
        }>
      ).find((c) => c.id === claim.id);
      expect(listed?.certification).toMatchObject({
        variationNotes: 'Approved with a minor variation',
        certificationDocumentId,
      });
      expect(listed?.disputeNotes).toBeNull();
    });

    it('keeps the certification document recoverable after a certified claim is disputed', async () => {
      const claim = await createSubmittedCertificationClaim(1000);
      const certificationDocument = await createCertificationDocument(
        `disputed-readback-${claim.claimNumber}.pdf`,
      );

      const certifyRes = await request(app)
        .post(`/api/projects/${projectId}/claims/${claim.id}/certify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          certifiedAmount: 900,
          variationNotes: 'Approved before later dispute',
          certificationDocumentId: certificationDocument.id,
        });

      expect(certifyRes.status).toBe(200);
      const certificationDocumentId = certifyRes.body.claim.certificationDocumentId as string;
      expect(certificationDocumentId).toBe(certificationDocument.id);

      await request(app)
        .put(`/api/projects/${projectId}/claims/${claim.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'disputed',
          disputeNotes: 'Certified quantity now disputed',
        })
        .expect(200);

      const detailRes = await request(app)
        .get(`/api/projects/${projectId}/claims/${claim.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.claim.status).toBe('disputed');
      expect(detailRes.body.claim.disputeNotes).toBe('Certified quantity now disputed');
      expect(detailRes.body.claim.certification).toMatchObject({
        variationNotes: 'Approved before later dispute',
        certificationDocumentId,
      });
    });

    it('keeps a disputed claim disputeNotes as a plain string with no certification on read-back', async () => {
      const claim = await createSubmittedCertificationClaim(1000);
      await request(app)
        .put(`/api/projects/${projectId}/claims/${claim.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'disputed', disputeNotes: 'Documentation incomplete' })
        .expect(200);

      const detailRes = await request(app)
        .get(`/api/projects/${projectId}/claims/${claim.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.claim.disputeNotes).toBe('Documentation incomplete');
      expect(detailRes.body.claim.certification).toBeNull();
    });
  });

  describe('POST /api/projects/:projectId/claims/:claimId/payment', () => {
    it('should reject non-finite payment amounts', async () => {
      const claim = await createSubmittedCertificationClaim();
      await prisma.progressClaim.update({
        where: { id: claim.id },
        data: {
          status: 'certified',
          certifiedAmount: 1000,
          certifiedAt: new Date(),
        },
      });

      const res = await request(app)
        .post(`/api/projects/${projectId}/claims/${claim.id}/payment`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{"paidAmount":1e309}');

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body.error.details)).toContain('finite');

      const unchangedClaim = await prisma.progressClaim.findUnique({ where: { id: claim.id } });
      expect(unchangedClaim?.status).toBe('certified');
      expect(unchangedClaim?.paidAmount).toBeNull();
    });

    it('should reject oversized payment text without mutating the claim', async () => {
      const claim = await createSubmittedCertificationClaim();
      await prisma.progressClaim.update({
        where: { id: claim.id },
        data: {
          status: 'certified',
          certifiedAmount: 1000,
          certifiedAt: new Date(),
        },
      });
      const cases = [
        {
          field: 'paymentReference',
          payload: { paidAmount: 100, paymentReference: 'R'.repeat(161) },
        },
        {
          field: 'paymentNotes',
          payload: { paidAmount: 100, paymentNotes: 'N'.repeat(3001) },
        },
      ];

      for (const testCase of cases) {
        const res = await request(app)
          .post(`/api/projects/${projectId}/claims/${claim.id}/payment`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(testCase.payload);

        expect(res.status).toBe(400);
        expect(JSON.stringify(res.body.error.details)).toContain(testCase.field);
      }

      const unchangedClaim = await prisma.progressClaim.findUnique({ where: { id: claim.id } });
      expect(unchangedClaim?.status).toBe('certified');
      expect(unchangedClaim?.paidAmount).toBeNull();
      expect(unchangedClaim?.paymentReference).toBeNull();
      expect(unchangedClaim?.disputeNotes).toBeNull();
    });

    it('should record partial and final payments with payment history', async () => {
      const claim = await createSubmittedCertificationClaim(1000);
      await prisma.progressClaim.update({
        where: { id: claim.id },
        data: {
          status: 'certified',
          certifiedAmount: 1000,
          certifiedAt: new Date(),
          disputeNotes: JSON.stringify({ variationNotes: 'Existing certified variation' }),
        },
      });

      const partialPaymentRes = await request(app)
        .post(`/api/projects/${projectId}/claims/${claim.id}/payment`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paidAmount: 400,
          paymentDate: '2025-06-01',
          paymentReference: 'PAY-PART-001',
          paymentNotes: 'First partial payment',
        });

      expect(partialPaymentRes.status).toBe(200);
      expect(partialPaymentRes.body.claim.status).toBe('partially_paid');
      expect(partialPaymentRes.body.claim.paidAmount).toBe(400);
      expect(partialPaymentRes.body.outstanding).toBe(600);
      expect(partialPaymentRes.body.isFullyPaid).toBe(false);
      expect(partialPaymentRes.body.paymentHistory).toHaveLength(1);
      expect(partialPaymentRes.body.paymentHistory[0]).toMatchObject({
        amount: 400,
        date: '2025-06-01',
        reference: 'PAY-PART-001',
        notes: 'First partial payment',
        recordedBy: userId,
      });

      const finalPaymentRes = await request(app)
        .post(`/api/projects/${projectId}/claims/${claim.id}/payment`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paidAmount: 600,
          paymentDate: '2025-06-15',
          paymentReference: 'PAY-FINAL-001',
          paymentNotes: 'Final payment',
        });

      expect(finalPaymentRes.status).toBe(200);
      expect(finalPaymentRes.body.claim.status).toBe('paid');
      expect(finalPaymentRes.body.claim.paidAmount).toBe(1000);
      expect(finalPaymentRes.body.outstanding).toBe(0);
      expect(finalPaymentRes.body.isFullyPaid).toBe(true);
      expect(finalPaymentRes.body.paymentHistory).toHaveLength(2);
      expect(finalPaymentRes.body.paymentHistory[1]).toMatchObject({
        amount: 600,
        date: '2025-06-15',
        reference: 'PAY-FINAL-001',
        notes: 'Final payment',
        recordedBy: userId,
      });

      const updatedClaim = await prisma.progressClaim.findUnique({ where: { id: claim.id } });
      expect(updatedClaim?.status).toBe('paid');
      expect(Number(updatedClaim?.paidAmount)).toBe(1000);
      expect(updatedClaim?.paymentReference).toBe('PAY-FINAL-001');

      const storedNotes = JSON.parse(updatedClaim?.disputeNotes || '{}') as {
        variationNotes?: string;
        paymentHistory?: Array<{ amount: number; reference: string }>;
        lastPaymentNotes?: string;
      };
      expect(storedNotes.variationNotes).toBe('Existing certified variation');
      expect(storedNotes.paymentHistory).toHaveLength(2);
      expect(storedNotes.paymentHistory?.[0].reference).toBe('PAY-PART-001');
      expect(storedNotes.paymentHistory?.[1].reference).toBe('PAY-FINAL-001');
      expect(storedNotes.lastPaymentNotes).toBe('Final payment');
    });

    it('rounds partial payment amounts and outstanding totals to cents', async () => {
      const claim = await createSubmittedCertificationClaim(1000);
      await prisma.progressClaim.update({
        where: { id: claim.id },
        data: {
          status: 'certified',
          certifiedAmount: 1000,
          certifiedAt: new Date(),
        },
      });

      const res = await request(app)
        .post(`/api/projects/${projectId}/claims/${claim.id}/payment`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paidAmount: 333.333,
          paymentReference: 'PAY-ROUNDING',
        });

      expect(res.status).toBe(200);
      expect(res.body.claim.status).toBe('partially_paid');
      expect(res.body.claim.paidAmount).toBe(333.33);
      expect(res.body.payment.amount).toBe(333.33);
      expect(res.body.outstanding).toBe(666.67);
      expect(res.body.paymentHistory[0].amount).toBe(333.33);

      const updatedClaim = await prisma.progressClaim.findUnique({ where: { id: claim.id } });
      expect(Number(updatedClaim?.paidAmount)).toBe(333.33);
      const storedNotes = JSON.parse(updatedClaim?.disputeNotes || '{}') as {
        paymentHistory?: Array<{ amount: number; reference: string }>;
      };
      expect(storedNotes.paymentHistory?.[0]).toMatchObject({
        amount: 333.33,
        reference: 'PAY-ROUNDING',
      });
    });

    it('should reject payments above the outstanding certified amount without mutating', async () => {
      const claim = await createSubmittedCertificationClaim(1000);
      await prisma.progressClaim.update({
        where: { id: claim.id },
        data: {
          status: 'partially_paid',
          certifiedAmount: 1000,
          certifiedAt: new Date(),
          paidAmount: 400,
          paidAt: new Date('2025-06-01'),
          paymentReference: 'PAY-PART-EXISTING',
          disputeNotes: JSON.stringify({
            paymentHistory: [
              {
                amount: 400,
                date: '2025-06-01',
                reference: 'PAY-PART-EXISTING',
                notes: null,
                recordedAt: new Date('2025-06-01').toISOString(),
                recordedBy: userId,
              },
            ],
          }),
        },
      });

      const res = await request(app)
        .post(`/api/projects/${projectId}/claims/${claim.id}/payment`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paidAmount: 600.01,
          paymentReference: 'PAY-OVER-OUTSTANDING',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('outstanding certified amount');

      const unchangedClaim = await prisma.progressClaim.findUnique({ where: { id: claim.id } });
      expect(unchangedClaim?.status).toBe('partially_paid');
      expect(Number(unchangedClaim?.paidAmount)).toBe(400);
      expect(unchangedClaim?.paymentReference).toBe('PAY-PART-EXISTING');

      const storedNotes = JSON.parse(unchangedClaim?.disputeNotes || '{}') as {
        paymentHistory?: Array<{ reference: string }>;
      };
      expect(storedNotes.paymentHistory).toHaveLength(1);
      expect(storedNotes.paymentHistory?.[0].reference).toBe('PAY-PART-EXISTING');
    });

    it('should preserve both concurrent partial payments in paid amount and history', async () => {
      const claim = await createSubmittedCertificationClaim(1000);
      await prisma.progressClaim.update({
        where: { id: claim.id },
        data: {
          status: 'certified',
          certifiedAmount: 1000,
          certifiedAt: new Date(),
        },
      });

      await prisma.$executeRaw`
        CREATE OR REPLACE FUNCTION test_delay_claim_payment_update()
        RETURNS trigger AS $$
        BEGIN
          PERFORM pg_sleep(0.2);
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `;
      await prisma.$executeRaw`
        DROP TRIGGER IF EXISTS test_delay_claim_payment_update_trigger ON progress_claims
      `;
      await prisma.$executeRaw`
        CREATE TRIGGER test_delay_claim_payment_update_trigger
        BEFORE UPDATE ON progress_claims
        FOR EACH ROW
        EXECUTE FUNCTION test_delay_claim_payment_update();
      `;
      try {
        const responses = await Promise.all([
          request(app)
            .post(`/api/projects/${projectId}/claims/${claim.id}/payment`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              paidAmount: 400,
              paymentReference: 'PAY-CONCURRENT-001',
            }),
          request(app)
            .post(`/api/projects/${projectId}/claims/${claim.id}/payment`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              paidAmount: 500,
              paymentReference: 'PAY-CONCURRENT-002',
            }),
        ]);

        expect(responses.map((res) => res.status).sort()).toEqual([200, 200]);

        const updatedClaim = await prisma.progressClaim.findUnique({ where: { id: claim.id } });
        expect(updatedClaim?.status).toBe('partially_paid');
        expect(Number(updatedClaim?.paidAmount)).toBe(900);

        const storedNotes = JSON.parse(updatedClaim?.disputeNotes || '{}') as {
          paymentHistory?: Array<{ amount: number; reference: string }>;
        };
        expect(storedNotes.paymentHistory).toHaveLength(2);
        expect(storedNotes.paymentHistory?.map((entry) => entry.reference).sort()).toEqual([
          'PAY-CONCURRENT-001',
          'PAY-CONCURRENT-002',
        ]);
      } finally {
        await prisma.$executeRaw`
          DROP TRIGGER IF EXISTS test_delay_claim_payment_update_trigger ON progress_claims
        `;
        await prisma.$executeRaw`
          DROP FUNCTION IF EXISTS test_delay_claim_payment_update()
        `;
      }
    });
  });

  describe('Claim Dispute Flow', () => {
    let disputeClaimId: string;

    beforeAll(async () => {
      // Create a new lot for this test
      const disputeLot = await prisma.lot.create({
        data: {
          projectId,
          lotNumber: `DISPUTE-LOT-${Date.now()}`,
          status: 'conformed',
          lotType: 'chainage',
          activityType: 'Earthworks',
          budgetAmount: 3000,
        },
      });

      // Create a claim to dispute
      const claim = await prisma.progressClaim.create({
        data: {
          projectId,
          claimNumber: 99,
          claimPeriodStart: new Date('2025-01-01'),
          claimPeriodEnd: new Date('2025-01-31'),
          status: 'submitted',
          preparedById: userId,
          totalClaimedAmount: 3000,
          submittedAt: new Date(),
          claimedLots: {
            create: {
              lotId: disputeLot.id,
              quantity: 1,
              unit: 'ea',
              rate: 3000,
              amountClaimed: 3000,
              percentageComplete: 100,
            },
          },
        },
      });
      disputeClaimId = claim.id;
    });

    it('should dispute a claim', async () => {
      const res = await request(app)
        .put(`/api/projects/${projectId}/claims/${disputeClaimId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'disputed',
          disputeNotes: 'Documentation incomplete',
        });

      expect(res.status).toBe(200);
      expect(res.body.claim.status).toBe('disputed');
      expect(res.body.claim.disputeNotes).toBe('Documentation incomplete');
    });

    afterAll(async () => {
      await prisma.claimedLot.deleteMany({ where: { claimId: disputeClaimId } });
      await prisma.progressClaim.delete({ where: { id: disputeClaimId } }).catch(() => {});
    });
  });

  describe('GET /api/projects/:projectId/claims/:claimId/evidence-package', () => {
    let evidenceClaimId: string;
    let evidenceLotId: string;

    beforeAll(async () => {
      // Create a new lot and claim for evidence package test
      const evidenceLot = await prisma.lot.create({
        data: {
          projectId,
          lotNumber: `EVIDENCE-LOT-${Date.now()}`,
          status: 'conformed',
          lotType: 'chainage',
          activityType: 'Earthworks',
          budgetAmount: 2000,
          conformedAt: new Date(),
          conformedById: userId,
        },
      });
      evidenceLotId = evidenceLot.id;

      await prisma.document.create({
        data: {
          projectId,
          lotId: evidenceLot.id,
          documentType: 'photo',
          category: 'field_evidence',
          filename: 'evidence-lot-proof-photo.jpg',
          fileUrl: '/uploads/documents/evidence-lot-proof-photo.jpg',
          uploadedById: userId,
          uploadedAt: new Date('2025-02-20T10:00:00.000Z'),
          caption: 'Evidence lot proof photo',
        },
      });

      const claim = await prisma.progressClaim.create({
        data: {
          projectId,
          claimNumber: 98,
          claimPeriodStart: new Date('2025-02-01'),
          claimPeriodEnd: new Date('2025-02-28'),
          status: 'submitted',
          preparedById: userId,
          preparedAt: new Date(),
          totalClaimedAmount: 2000,
          submittedAt: new Date(),
          claimedLots: {
            create: {
              lotId: evidenceLot.id,
              quantity: 1,
              unit: 'ea',
              rate: 2000,
              amountClaimed: 2000,
              percentageComplete: 100,
            },
          },
        },
      });
      evidenceClaimId = claim.id;
    });

    it('should get evidence package data', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/claims/${evidenceClaimId}/evidence-package`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.claim).toBeDefined();
      expect(res.body.project).toBeDefined();
      expect(res.body.lots).toBeDefined();
      expect(Array.isArray(res.body.lots)).toBe(true);
      expect(res.body.summary.totalPhotos).toBe(1);
      expect(res.body.lots[0].summary.photoCount).toBe(1);
      expect(res.body.lots[0].documents).toEqual([
        expect.objectContaining({
          filename: 'evidence-lot-proof-photo.jpg',
          documentType: 'photo',
          caption: 'Evidence lot proof photo',
          uploadedAt: '2025-02-20T10:00:00.000Z',
        }),
      ]);
    });

    it('preserves a zero claimed percentage in the evidence package', async () => {
      const claimedLot = await prisma.claimedLot.findFirstOrThrow({
        where: { claimId: evidenceClaimId },
      });
      await prisma.claimedLot.update({
        where: { id: claimedLot.id },
        data: {
          amountClaimed: 0,
          percentageComplete: 0,
        },
      });

      try {
        const res = await request(app)
          .get(`/api/projects/${projectId}/claims/${evidenceClaimId}/evidence-package`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.lots[0].claimAmount).toBe(0);
        expect(res.body.lots[0].percentComplete).toBe(0);
      } finally {
        await prisma.claimedLot.update({
          where: { id: claimedLot.id },
          data: {
            amountClaimed: 2000,
            percentageComplete: 100,
          },
        });
      }
    });

    it('preserves zero-valued claim, lot, and test evidence fields', async () => {
      await prisma.progressClaim.update({
        where: { id: evidenceClaimId },
        data: { certifiedAmount: 0 },
      });
      await prisma.lot.update({
        where: { id: evidenceLotId },
        data: {
          chainageStart: 0,
          chainageEnd: 0,
        },
      });
      const testResult = await prisma.testResult.create({
        data: {
          projectId,
          lotId: evidenceLotId,
          testType: 'Compaction',
          resultValue: 0,
          resultUnit: '%',
          passFail: 'pass',
          status: 'verified',
          enteredById: userId,
          enteredAt: new Date('2025-02-21T09:00:00.000Z'),
          verifiedById: userId,
          verifiedAt: new Date('2025-02-21T10:00:00.000Z'),
          sampleDate: new Date('2025-02-21T08:00:00.000Z'),
        },
      });

      try {
        const res = await request(app)
          .get(`/api/projects/${projectId}/claims/${evidenceClaimId}/evidence-package`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.claim.certifiedAmount).toBe(0);
        expect(res.body.lots[0].chainageStart).toBe(0);
        expect(res.body.lots[0].chainageEnd).toBe(0);
        expect(res.body.lots[0].testResults[0].resultValue).toBe(0);
      } finally {
        await prisma.testResult.delete({ where: { id: testResult.id } }).catch(() => {});
        await prisma.progressClaim.update({
          where: { id: evidenceClaimId },
          data: { certifiedAmount: null },
        });
        await prisma.lot.update({
          where: { id: evidenceLotId },
          data: {
            chainageStart: null,
            chainageEnd: null,
          },
        });
      }
    });

    it('uses the assigned ITP snapshot and counts N/A completions as accepted evidence', async () => {
      const template = await prisma.iTPTemplate.create({
        data: {
          projectId,
          name: `Evidence snapshot template ${Date.now()}`,
          activityType: 'Earthworks',
        },
      });
      const assignedItem = await prisma.iTPChecklistItem.create({
        data: {
          templateId: template.id,
          sequenceNumber: 1,
          description: 'Live description changed after assignment',
          pointType: 'standard',
          responsibleParty: 'contractor',
          evidenceRequired: 'none',
        },
      });
      const addedLaterItem = await prisma.iTPChecklistItem.create({
        data: {
          templateId: template.id,
          sequenceNumber: 2,
          description: 'Added after assignment',
          pointType: 'standard',
          responsibleParty: 'contractor',
          evidenceRequired: 'none',
        },
      });
      const instance = await prisma.iTPInstance.create({
        data: {
          lotId: evidenceLotId,
          templateId: template.id,
          status: 'in_progress',
          templateSnapshot: JSON.stringify({
            id: template.id,
            name: template.name,
            checklistItems: [
              {
                id: assignedItem.id,
                sequenceNumber: 1,
                description: 'Assigned snapshot description',
                pointType: 'standard',
                responsibleParty: 'contractor',
                evidenceRequired: 'none',
              },
            ],
          }),
        },
      });
      const completion = await prisma.iTPCompletion.create({
        data: {
          itpInstanceId: instance.id,
          checklistItemId: assignedItem.id,
          status: 'not_applicable',
          completedById: userId,
          completedAt: new Date('2025-02-22T09:00:00.000Z'),
        },
      });
      const attachmentDocument = await prisma.document.create({
        data: {
          projectId,
          documentType: 'photo',
          category: 'itp_evidence',
          filename: 'itp-attachment-evidence.jpg',
          fileUrl: '/uploads/documents/itp-attachment-evidence.jpg',
          uploadedById: userId,
          uploadedAt: new Date('2025-02-22T09:15:00.000Z'),
          caption: 'ITP attachment evidence',
        },
      });
      const attachment = await prisma.iTPCompletionAttachment.create({
        data: {
          completionId: completion.id,
          documentId: attachmentDocument.id,
        },
      });

      try {
        const res = await request(app)
          .get(`/api/projects/${projectId}/claims/${evidenceClaimId}/evidence-package`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.lots[0].itp.checklistItems).toEqual([
          expect.objectContaining({
            id: assignedItem.id,
            description: 'Assigned snapshot description',
          }),
        ]);
        expect(res.body.lots[0].itp.checklistItems).not.toEqual(
          expect.arrayContaining([expect.objectContaining({ id: addedLaterItem.id })]),
        );
        expect(res.body.lots[0].itp.completions).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              checklistItemId: assignedItem.id,
              isCompleted: false,
              isNotApplicable: true,
              attachmentCount: 1,
              attachments: [
                expect.objectContaining({
                  id: attachment.id,
                  documentId: attachmentDocument.id,
                  document: expect.objectContaining({
                    id: attachmentDocument.id,
                    filename: 'itp-attachment-evidence.jpg',
                    documentType: 'photo',
                    caption: 'ITP attachment evidence',
                    uploadedAt: '2025-02-22T09:15:00.000Z',
                  }),
                }),
              ],
            }),
          ]),
        );
        expect(res.body.lots[0].summary.itpCompletionPercentage).toBe(100);
      } finally {
        await prisma.iTPCompletionAttachment
          .delete({ where: { id: attachment.id } })
          .catch(() => {});
        await prisma.document.delete({ where: { id: attachmentDocument.id } }).catch(() => {});
        await prisma.iTPCompletion.delete({ where: { id: completion.id } }).catch(() => {});
        await prisma.iTPInstance.delete({ where: { id: instance.id } }).catch(() => {});
        await prisma.iTPChecklistItem.deleteMany({
          where: { id: { in: [assignedItem.id, addedLaterItem.id] } },
        });
        await prisma.iTPTemplate.delete({ where: { id: template.id } }).catch(() => {});
      }
    });

    it('counts only verified passing tests as passed claim evidence', async () => {
      const verifiedPass = await prisma.testResult.create({
        data: {
          projectId,
          lotId: evidenceLotId,
          testType: 'Verified Compaction',
          resultValue: 98.5,
          resultUnit: '%',
          passFail: 'pass',
          status: 'verified',
          enteredById: userId,
          enteredAt: new Date('2025-02-23T09:00:00.000Z'),
          verifiedById: userId,
          verifiedAt: new Date('2025-02-23T10:00:00.000Z'),
          sampleDate: new Date('2025-02-23T08:00:00.000Z'),
        },
      });
      const unverifiedPass = await prisma.testResult.create({
        data: {
          projectId,
          lotId: evidenceLotId,
          testType: 'Unverified Compaction',
          resultValue: 97,
          resultUnit: '%',
          passFail: 'pass',
          status: 'entered',
          enteredById: userId,
          enteredAt: new Date('2025-02-24T09:00:00.000Z'),
          sampleDate: new Date('2025-02-24T08:00:00.000Z'),
        },
      });
      const failedTest = await prisma.testResult.create({
        data: {
          projectId,
          lotId: evidenceLotId,
          testType: 'Failed Compaction',
          resultValue: 91,
          resultUnit: '%',
          passFail: 'fail',
          status: 'verified',
          enteredById: userId,
          enteredAt: new Date('2025-02-25T09:00:00.000Z'),
          verifiedById: userId,
          verifiedAt: new Date('2025-02-25T10:00:00.000Z'),
          sampleDate: new Date('2025-02-25T08:00:00.000Z'),
        },
      });

      try {
        const res = await request(app)
          .get(`/api/projects/${projectId}/claims/${evidenceClaimId}/evidence-package`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.lots[0].summary.testResultCount).toBeGreaterThanOrEqual(3);
        expect(res.body.lots[0].summary.passedTestCount).toBe(1);
        expect(res.body.lots[0].summary.failedTestCount).toBe(1);
        expect(res.body.lots[0].summary.pendingTestCount).toBe(1);
        expect(res.body.summary.totalPassedTests).toBe(1);
        expect(res.body.summary.totalFailedTests).toBe(1);
        expect(res.body.summary.totalPendingTests).toBe(1);
      } finally {
        await prisma.testResult.deleteMany({
          where: { id: { in: [verifiedPass.id, unverifiedPass.id, failedTest.id] } },
        });
      }
    });

    it('should get claim evidence review data with readiness-shaped buckets', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/claims/${evidenceClaimId}/completeness-check`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.claimId).toBe(evidenceClaimId);
      expect(res.body.summary).toMatchObject({
        totalLots: 1,
        totalClaimAmount: 2000,
        recommendedAmount: 2000,
      });
      expect(res.body.summary).toHaveProperty('readyCount');
      expect(res.body.summary).toHaveProperty('reviewCount');
      expect(res.body.summary).toHaveProperty('blockedCount');
      expect(res.body.summary).not.toHaveProperty('averageCompletenessScore');
      expect(res.body.summary).not.toHaveProperty('includeCount');
      expect(res.body.lots[0]).toHaveProperty('claim');
      expect(res.body.lots[0].claim).toHaveProperty('blockers');
      expect(res.body.lots[0].claim).toHaveProperty('warnings');
      expect(res.body.lots[0].claim).toHaveProperty('support');
      expect(res.body.lots[0]).not.toHaveProperty('completenessScore');
      expect(res.body.lots[0]).not.toHaveProperty('recommendation');
    });

    it('should return 404 for non-existent claim', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/claims/non-existent-id/evidence-package`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });

    afterAll(async () => {
      await prisma.claimedLot.deleteMany({ where: { claimId: evidenceClaimId } });
      await prisma.progressClaim.delete({ where: { id: evidenceClaimId } }).catch(() => {});
    });
  });

  describe('Claim Number Auto-Increment', () => {
    it('should auto-increment claim numbers', async () => {
      // Create another lot for second claim
      const autoLot = await prisma.lot.create({
        data: {
          projectId,
          lotNumber: `AUTO-LOT-${Date.now()}`,
          status: 'conformed',
          lotType: 'chainage',
          activityType: 'Earthworks',
          budgetAmount: 1000,
        },
      });

      const res = await request(app)
        .post(`/api/projects/${projectId}/claims`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          periodStart: '2025-03-01',
          periodEnd: '2025-03-31',
          lots: [{ lotId: autoLot.id, percentageComplete: 100 }],
        });

      expect(res.status).toBe(201);
      // Should be higher than claim #1 we created earlier (but could be 2, 100, etc. depending on cleanup)
      expect(res.body.claim.claimNumber).toBeGreaterThan(1);

      // Cleanup
      await prisma.claimedLot.deleteMany({ where: { claimId: res.body.claim.id } });
      await prisma.progressClaim.delete({ where: { id: res.body.claim.id } }).catch(() => {});
    });
  });

  describe('Access control hardening', () => {
    it('should deny same-company project managers without active project membership', async () => {
      const email = `claims-unassigned-${Date.now()}@example.com`;
      const regRes = await request(app).post('/api/auth/register').send({
        email,
        password: 'SecureP@ssword123!',
        fullName: 'Unassigned Claims User',
        tosAccepted: true,
      });
      const tempUserId = regRes.body.user.id;

      await prisma.user.update({
        where: { id: tempUserId },
        data: { companyId, roleInCompany: 'project_manager' },
      });

      try {
        const listRes = await request(app)
          .get(`/api/projects/${projectId}/claims`)
          .set('Authorization', `Bearer ${regRes.body.token}`);
        expect(listRes.status).toBe(403);

        const createRes = await request(app)
          .post(`/api/projects/${projectId}/claims`)
          .set('Authorization', `Bearer ${regRes.body.token}`)
          .send({
            periodStart: '2025-06-01',
            periodEnd: '2025-06-30',
            lots: [{ lotId: lotId2, percentageComplete: 100 }],
          });
        expect(createRes.status).toBe(403);
      } finally {
        await prisma.claimedLot.deleteMany({
          where: { claim: { projectId, preparedById: tempUserId } },
        });
        await prisma.progressClaim.deleteMany({ where: { projectId, preparedById: tempUserId } });
        await prisma.lot
          .update({
            where: { id: lotId2 },
            data: { claimedInId: null, status: 'conformed' },
          })
          .catch(() => {});
        await prisma.emailVerificationToken.deleteMany({ where: { userId: tempUserId } });
        await prisma.user.delete({ where: { id: tempUserId } }).catch(() => {});
      }
    });

    it('should deny active non-commercial project users from claims data', async () => {
      const email = `claims-viewer-${Date.now()}@example.com`;
      const regRes = await request(app).post('/api/auth/register').send({
        email,
        password: 'SecureP@ssword123!',
        fullName: 'Claims Viewer',
        tosAccepted: true,
      });
      const tempUserId = regRes.body.user.id;

      await prisma.user.update({
        where: { id: tempUserId },
        data: { companyId, roleInCompany: 'viewer' },
      });
      await prisma.projectUser.create({
        data: { projectId, userId: tempUserId, role: 'viewer', status: 'active' },
      });

      try {
        const lotsRes = await request(app)
          .get(`/api/projects/${projectId}/lots`)
          .set('Authorization', `Bearer ${regRes.body.token}`);
        expect(lotsRes.status).toBe(403);

        const claimsRes = await request(app)
          .get(`/api/projects/${projectId}/claims`)
          .set('Authorization', `Bearer ${regRes.body.token}`);
        expect(claimsRes.status).toBe(403);
      } finally {
        await prisma.projectUser.deleteMany({ where: { userId: tempUserId } });
        await prisma.emailVerificationToken.deleteMany({ where: { userId: tempUserId } });
        await prisma.user.delete({ where: { id: tempUserId } }).catch(() => {});
      }
    });

    it('should deny subcontractor portal users from claims data', async () => {
      const subcontractorCompany = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `Claims Subcontractor ${Date.now()}`,
          status: 'approved',
          portalAccess: {
            dockets: true,
            documents: true,
          },
        },
      });
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: `claims-subcontractor-${Date.now()}@example.com`,
          password: 'SecureP@ssword123!',
          fullName: 'Claims Subcontractor',
          tosAccepted: true,
        });
      const tempUserId = regRes.body.user.id;

      await prisma.user.update({
        where: { id: tempUserId },
        data: { companyId, roleInCompany: 'subcontractor_admin' },
      });
      await prisma.subcontractorUser.create({
        data: {
          userId: tempUserId,
          subcontractorCompanyId: subcontractorCompany.id,
          role: 'admin',
        },
      });

      try {
        const lotsRes = await request(app)
          .get(`/api/projects/${projectId}/lots`)
          .set('Authorization', `Bearer ${regRes.body.token}`);
        expect(lotsRes.status).toBe(403);

        const claimsRes = await request(app)
          .get(`/api/projects/${projectId}/claims`)
          .set('Authorization', `Bearer ${regRes.body.token}`);
        expect(claimsRes.status).toBe(403);

        const detailRes = await request(app)
          .get(`/api/projects/${projectId}/claims/${claimId}`)
          .set('Authorization', `Bearer ${regRes.body.token}`);
        expect(detailRes.status).toBe(403);
      } finally {
        await prisma.subcontractorUser.deleteMany({ where: { userId: tempUserId } });
        await prisma.subcontractorCompany
          .delete({ where: { id: subcontractorCompany.id } })
          .catch(() => {});
        await prisma.emailVerificationToken.deleteMany({ where: { userId: tempUserId } });
        await prisma.user.delete({ where: { id: tempUserId } }).catch(() => {});
      }
    });
  });
});

describe('Claim Lots Association', () => {
  let authToken: string;
  let userId: string;
  let companyId: string;
  let projectId: string;

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `Claim Lots Test Company ${Date.now()}` },
    });
    companyId = company.id;

    const primaryUser = await registerTestUser(app, {
      emailPrefix: 'claim-lots',
      fullName: 'Claim Lots User',
      companyId,
      roleInCompany: 'project_manager',
    });
    authToken = primaryUser.token;
    userId = primaryUser.userId;

    const project = await prisma.project.create({
      data: {
        name: `Claim Lots Project ${Date.now()}`,
        projectNumber: `CLMLT-${Date.now()}`,
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

  it('should mark lots as claimed when added to a claim', async () => {
    // Create conformed lot
    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `ASSOC-LOT-${Date.now()}`,
        status: 'conformed',
        lotType: 'chainage',
        activityType: 'Earthworks',
        budgetAmount: 1500,
      },
    });

    // Create claim with this lot
    const res = await request(app)
      .post(`/api/projects/${projectId}/claims`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        periodStart: '2025-04-01',
        periodEnd: '2025-04-30',
        lots: [{ lotId: lot.id, percentageComplete: 100 }],
      });

    expect(res.status).toBe(201);

    // Verify lot is now claimed
    const updatedLot = await prisma.lot.findUnique({
      where: { id: lot.id },
    });

    expect(updatedLot?.status).toBe('claimed');
    expect(updatedLot?.claimedInId).toBe(res.body.claim.id);
  });

  it('should not allow claiming non-conformed lots', async () => {
    // Create a lot that is not conformed
    const nonConformedLot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `NOT-CONF-${Date.now()}`,
        status: 'in_progress',
        lotType: 'chainage',
        activityType: 'Earthworks',
        budgetAmount: 2000,
      },
    });

    const res = await request(app)
      .post(`/api/projects/${projectId}/claims`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        periodStart: '2025-05-01',
        periodEnd: '2025-05-31',
        lots: [{ lotId: nonConformedLot.id, percentageComplete: 100 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('No valid conformed lots');
  });
});
