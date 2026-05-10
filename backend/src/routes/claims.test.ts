import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { authRouter } from './auth.js';
import { prisma } from '../lib/prisma.js';
import { errorHandler } from '../middleware/errorHandler.js';

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
  let manualClaimNumber = 200;

  beforeAll(async () => {
    // Create test company
    const company = await prisma.company.create({
      data: { name: `Claims Test Company ${Date.now()}` },
    });
    companyId = company.id;

    // Create test user
    const testEmail = `claims-test-${Date.now()}@example.com`;
    const regRes = await request(app).post('/api/auth/register').send({
      email: testEmail,
      password: 'SecureP@ssword123!',
      fullName: 'Claims Test User',
      tosAccepted: true,
    });
    authToken = regRes.body.token;
    userId = regRes.body.user.id;

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'project_manager' },
    });

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
    await prisma.lot.deleteMany({ where: { projectId } });
    await prisma.projectUser.deleteMany({ where: { projectId } });
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
    await prisma.emailVerificationToken.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  });

  async function createSubmittedCertificationClaim(totalClaimedAmount = 1000) {
    const claimNumber = manualClaimNumber++;
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

  async function createDraftWorkflowClaim(totalClaimedAmount = 1000) {
    const claimNumber = manualClaimNumber++;
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
          lotIds: [lotId1],
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

    it('should reject claim without period dates', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/claims`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          lotIds: [lotId2],
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
          lotIds: [lotId2],
        });

      expect(invalidDateRes.status).toBe(400);

      const reversedDateRes = await request(app)
        .post(`/api/projects/${projectId}/claims`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          periodStart: '2025-02-01',
          periodEnd: '2025-01-31',
          lotIds: [lotId2],
        });

      expect(reversedDateRes.status).toBe(400);

      const impossibleDateRes = await request(app)
        .post(`/api/projects/${projectId}/claims`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          periodStart: '2026-02-30',
          periodEnd: '2026-03-31',
          lotIds: [lotId2],
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
          lotIds: [lotNoBudget.id],
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');

      // Cleanup
      await prisma.lot.delete({ where: { id: lotNoBudget.id } });
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
            lotIds: [lotId2, otherLot.id],
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
              lotIds: [lot.id],
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

    it('should persist partial claim percentages and amounts', async () => {
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

      const updatedLot = await prisma.lot.findUnique({ where: { id: partialLot.id } });
      expect(updatedLot?.status).toBe('claimed');
      expect(updatedLot?.claimedInId).toBe(res.body.claim.id);
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
            .send({ periodStart: '2026-01-01', periodEnd: '2026-01-31', lotIds: [lotId1] }),
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

    it('should certify a submitted claim', async () => {
      const res = await request(app)
        .put(`/api/projects/${projectId}/claims/${claimId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'certified',
          certifiedAmount: 4800,
        });

      expect(res.status).toBe(200);
      expect(res.body.claim.status).toBe('certified');
      // Prisma returns Decimal as string
      expect(Number(res.body.claim.certifiedAmount)).toBe(4800);
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
      const fileUrl = `/uploads/documents/over-certified-${claim.claimNumber}.pdf`;
      const documentCountBefore = await prisma.document.count({ where: { projectId } });

      const res = await request(app)
        .post(`/api/projects/${projectId}/claims/${claim.id}/certify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          certifiedAmount: 1000.01,
          certificationDocumentUrl: fileUrl,
          certificationDocumentFilename: 'should-not-exist.pdf',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Certified amount cannot exceed');

      const unchangedClaim = await prisma.progressClaim.findUnique({ where: { id: claim.id } });
      expect(unchangedClaim?.status).toBe('submitted');
      expect(unchangedClaim?.certifiedAmount).toBeNull();
      expect(unchangedClaim?.certifiedAt).toBeNull();
      expect(await prisma.document.count({ where: { projectId } })).toBe(documentCountBefore);
      expect(await prisma.document.count({ where: { projectId, fileUrl } })).toBe(0);
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
        {
          field: 'certificationDocumentUrl',
          payload: {
            certifiedAmount: 900,
            certificationDocumentUrl: `/uploads/documents/${'u'.repeat(2030)}.pdf`,
          },
        },
        {
          field: 'certificationDocumentFilename',
          payload: {
            certifiedAmount: 900,
            certificationDocumentFilename: `${'f'.repeat(181)}.pdf`,
          },
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

    it('should reject certification document URLs that do not reference uploaded documents', async () => {
      const claim = await createSubmittedCertificationClaim();
      const unsafeUrl = 'https://example.com/certification.pdf';
      const beforeCount = await prisma.document.count({ where: { projectId, fileUrl: unsafeUrl } });

      const res = await request(app)
        .post(`/api/projects/${projectId}/claims/${claim.id}/certify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          certifiedAmount: 900,
          certificationDocumentUrl: unsafeUrl,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('uploaded document file');
      expect(await prisma.document.count({ where: { projectId, fileUrl: unsafeUrl } })).toBe(
        beforeCount,
      );
      const unchangedClaim = await prisma.progressClaim.findUnique({ where: { id: claim.id } });
      expect(unchangedClaim?.status).toBe('submitted');
    });

    it('should reject spoofed Supabase document URLs from untrusted origins', async () => {
      process.env.SUPABASE_URL = 'https://siteproof.supabase.co';
      const claim = await createSubmittedCertificationClaim();
      const spoofedUrl =
        'https://example.com/storage/v1/object/public/documents/project/certification.pdf';

      try {
        const res = await request(app)
          .post(`/api/projects/${projectId}/claims/${claim.id}/certify`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            certifiedAmount: 900,
            certificationDocumentUrl: spoofedUrl,
          });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('uploaded document file');
        expect(await prisma.document.count({ where: { projectId, fileUrl: spoofedUrl } })).toBe(0);
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
            certifiedAmount: 900,
            certificationDocumentId: otherDocument.id,
          });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('document in this project');
      } finally {
        await prisma.document.delete({ where: { id: otherDocument.id } }).catch(() => {});
        await prisma.project.delete({ where: { id: otherProject.id } }).catch(() => {});
      }
    });

    it('should certify with a stored document URL and persist the generated document reference', async () => {
      const claim = await createSubmittedCertificationClaim();
      const fileUrl = `/uploads/documents/certification-${claim.claimNumber}.pdf`;

      const res = await request(app)
        .post(`/api/projects/${projectId}/claims/${claim.id}/certify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          certifiedAmount: 950,
          certificationDocumentUrl: fileUrl,
          certificationDocumentFilename: '../../bad"name\r\n.pdf',
        });

      expect(res.status).toBe(200);
      expect(res.body.claim.status).toBe('certified');
      expect(res.body.claim.certificationDocumentId).toBeDefined();

      const document = await prisma.document.findUnique({
        where: { id: res.body.claim.certificationDocumentId },
      });
      expect(document?.projectId).toBe(projectId);
      expect(document?.fileUrl).toBe(fileUrl);
      expect(document?.filename).toBe('bad_name__.pdf');

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

    it('should certify with a configured Supabase document URL', async () => {
      process.env.SUPABASE_URL = 'https://siteproof.supabase.co';
      const claim = await createSubmittedCertificationClaim();
      const fileUrl = `https://siteproof.supabase.co/storage/v1/object/public/documents/${projectId}/certification-${claim.claimNumber}.pdf`;

      try {
        const res = await request(app)
          .post(`/api/projects/${projectId}/claims/${claim.id}/certify`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            certifiedAmount: 975,
            certificationDocumentUrl: fileUrl,
            certificationDocumentFilename: 'supabase-certification.pdf',
          });

        expect(res.status).toBe(200);
        expect(res.body.claim.status).toBe('certified');
        expect(res.body.claim.certificationDocumentId).toBeDefined();

        const document = await prisma.document.findUnique({
          where: { id: res.body.claim.certificationDocumentId },
        });
        expect(document?.projectId).toBe(projectId);
        expect(document?.fileUrl).toBe(fileUrl);
        expect(document?.filename).toBe('supabase-certification.pdf');
      } finally {
        restoreOptionalEnv('SUPABASE_URL', ORIGINAL_SUPABASE_URL);
      }
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
          lotIds: [autoLot.id],
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
            lotIds: [lotId2],
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

    const testEmail = `claim-lots-${Date.now()}@example.com`;
    const regRes = await request(app).post('/api/auth/register').send({
      email: testEmail,
      password: 'SecureP@ssword123!',
      fullName: 'Claim Lots User',
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
        lotIds: [lot.id],
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
        lotIds: [nonConformedLot.id],
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('No valid conformed lots');
  });
});
