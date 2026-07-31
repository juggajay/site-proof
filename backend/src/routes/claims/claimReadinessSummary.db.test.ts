// Wave F F1 — the blocked-value aggregate and its drill-down, over the real
// route handlers and a real database.
//
// A separate suite from `routes/claims.test.ts` because these assertions are
// project-TOTAL assertions: they must own every lot in their project, and the
// shared claims fixture accumulates lots from dozens of unrelated tests.
//
// The arithmetic itself is pinned without a database in
// `claimReadinessSummary.test.ts`; what this suite proves is that the endpoint
// reads the SHIPPED readiness computation — the cross-check against the
// paginated claim-readiness endpoint (spec §5.5, "the strongest available
// correctness assertion") is the test that would fail if F1 ever grew a
// readiness computation of its own.

import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '../../lib/prisma.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { registerTestUser } from '../../test/routeTestHarness.js';
import { authRouter } from '../auth.js';
import claimsRouter from '../claims.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/projects', claimsRouter);
app.use(errorHandler);

const tag = `f1-summary-${Date.now()}`;

interface ClaimReadinessSummaryBody {
  totalBudget: number;
  claimableValue: number;
  blockedValue: number;
  lotsInScope: number;
  lotsBlocked: number;
  lotsWithNullBudget: number;
  groups: { code: string; lotCount: number; blockedValue: number }[];
}

describe('GET /api/projects/:projectId/claim-readiness/summary (Wave F F1)', () => {
  let authToken: string;
  let userId: string;
  let companyId: string;
  let projectId: string;
  const lotIds: Record<string, string> = {};

  async function createLot(
    key: string,
    data: { status: string; budgetAmount?: number | null; claimedInId?: string },
  ): Promise<string> {
    const lot = await prisma.lot.create({
      data: {
        projectId,
        // Zero-padded so the keyset order (`lotNumber ASC`) is deterministic.
        lotNumber: `F1-${key}`,
        status: data.status,
        lotType: 'chainage',
        activityType: 'Earthworks',
        budgetAmount: data.budgetAmount ?? null,
        conformedAt: data.status === 'conformed' ? new Date() : null,
        conformedById: data.status === 'conformed' ? userId : null,
        claimedInId: data.claimedInId,
      },
    });
    lotIds[key] = lot.id;
    return lot.id;
  }

  beforeAll(async () => {
    const company = await prisma.company.create({ data: { name: `F1 Summary Co ${tag}` } });
    companyId = company.id;

    const user = await registerTestUser(app, {
      emailPrefix: 'f1-summary',
      fullName: 'F1 Summary PM',
      companyId,
      roleInCompany: 'project_manager',
    });
    authToken = user.token;
    userId = user.userId;

    const project = await prisma.project.create({
      data: {
        name: `F1 Summary Project ${tag}`,
        projectNumber: `F1-${Date.now()}`,
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

    // a: claimable, $5,000.
    await createLot('a-claimable', { status: 'conformed', budgetAmount: 5000 });
    // b: blocked by `not_conformed`, $4,000.
    await createLot('b-not-conformed', { status: 'in_progress', budgetAmount: 4000 });
    // c: blocked by `missing_budget` — counted, never valued.
    await createLot('c-no-budget', { status: 'conformed', budgetAmount: null });
    // d: 40% already claimed, so $1,200 of its $2,000 is still claimable.
    const partialLotId = await createLot('d-partial', {
      status: 'conformed',
      budgetAmount: 2000,
    });

    const claim = await prisma.progressClaim.create({
      data: {
        projectId,
        claimNumber: 1,
        claimPeriodStart: new Date('2026-06-01'),
        claimPeriodEnd: new Date('2026-06-30'),
        status: 'draft',
        totalClaimedAmount: 800,
        preparedById: userId,
      },
    });
    await prisma.claimedLot.create({
      data: {
        claimId: claim.id,
        lotId: partialLotId,
        percentageComplete: 40,
        amountClaimed: 800,
      },
    });

    // e: fully claimed — blocked by `already_claimed`, with $0 left to claim.
    // The `ClaimedLot` row is what makes it 100% claimed; the claim path always
    // writes one, and without it the lot would still read as 100% remaining.
    const claimedLotId = await createLot('e-claimed', {
      status: 'claimed',
      budgetAmount: 3000,
      claimedInId: claim.id,
    });
    await prisma.claimedLot.create({
      data: {
        claimId: claim.id,
        lotId: claimedLotId,
        percentageComplete: 100,
        amountClaimed: 3000,
      },
    });
  });

  afterAll(async () => {
    await prisma.claimedLot.deleteMany({ where: { claim: { projectId } } });
    await prisma.lot.updateMany({ where: { projectId }, data: { claimedInId: null } });
    await prisma.progressClaim.deleteMany({ where: { projectId } });
    await prisma.lot.deleteMany({ where: { projectId } });
    await prisma.projectUser.deleteMany({ where: { projectId } });
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
    await prisma.emailVerificationToken.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  });

  async function getSummary(): Promise<ClaimReadinessSummaryBody> {
    const res = await request(app)
      .get(`/api/projects/${projectId}/claim-readiness/summary`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    return res.body as ClaimReadinessSummaryBody;
  }

  it('aggregates budget, claimable value and blocked value over the whole project', async () => {
    const summary = await getSummary();

    expect(summary.lotsInScope).toBe(5);
    expect(summary.lotsBlocked).toBe(3);
    expect(summary.lotsWithNullBudget).toBe(1);
    // $5,000 + $4,000 + $2,000 + $3,000 — the null-budget lot contributes nothing.
    expect(summary.totalBudget).toBe(14000);
    // Claimable: lot a in full, plus the 60% left on lot d.
    expect(summary.claimableValue).toBe(6200);
    // Blocked: lot b in full; lot c has no budget; lot e has nothing left.
    expect(summary.blockedValue).toBe(4000);
  });

  it('matches the per-lot values the shipped paginated endpoint returns', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/claim-readiness?limit=500`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);

    interface ReadinessItem {
      lotId: string;
      claim: {
        blockers: { blocksAction: boolean }[];
        budgetAmount?: number | null;
        remainingPercentage?: number;
      };
    }
    const items = res.body.items as ReadinessItem[];
    expect(items).toHaveLength(5);

    let totalBudget = 0;
    let claimableValue = 0;
    let blockedValue = 0;
    let lotsBlocked = 0;
    let lotsWithNullBudget = 0;
    for (const item of items) {
      const budget = item.claim.budgetAmount ?? null;
      if (budget === null) lotsWithNullBudget += 1;
      else totalBudget += budget;
      const remaining = (budget ?? 0) * ((item.claim.remainingPercentage ?? 100) / 100);
      if (item.claim.blockers.some((blocker) => blocker.blocksAction)) {
        lotsBlocked += 1;
        blockedValue += remaining;
      } else {
        claimableValue += remaining;
      }
    }

    const summary = await getSummary();
    expect(summary.totalBudget).toBe(totalBudget);
    expect(summary.claimableValue).toBe(claimableValue);
    expect(summary.blockedValue).toBe(blockedValue);
    expect(summary.lotsBlocked).toBe(lotsBlocked);
    expect(summary.lotsWithNullBudget).toBe(lotsWithNullBudget);
  });

  it('groups blocked lots by the shipped reason-code vocabulary', async () => {
    const summary = await getSummary();
    const byCode = new Map(summary.groups.map((group) => [group.code, group]));

    expect(byCode.get('not_conformed')).toEqual({
      code: 'not_conformed',
      lotCount: 1,
      blockedValue: 4000,
    });
    // Counted, but worth nothing — a missing budget cannot be valued.
    expect(byCode.get('missing_budget')).toEqual({
      code: 'missing_budget',
      lotCount: 1,
      blockedValue: 0,
    });
    expect(byCode.get('already_claimed')).toEqual({
      code: 'already_claimed',
      lotCount: 1,
      blockedValue: 0,
    });
  });

  it('drills down to the source lots of one group only', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/claim-readiness/blocked-lots?reasonCode=not_conformed`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.reasonCode).toBe('not_conformed');
    expect(res.body.nextCursor).toBeNull();
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      lotId: lotIds['b-not-conformed'],
      lotNumber: 'F1-b-not-conformed',
      activityType: 'Earthworks',
      budgetAmount: 4000,
      blockedValue: 4000,
    });
    // The engine's own item text, so the drill-down and the lot page agree.
    expect(res.body.items[0].items).toEqual([
      expect.objectContaining({ code: 'not_conformed', blocksAction: true }),
    ]);
  });

  it('pages the drill-down on the shipped cursor and caps the page size', async () => {
    const firstRes = await request(app)
      .get(
        `/api/projects/${projectId}/claim-readiness/blocked-lots?reasonCode=missing_budget&limit=2`,
      )
      .set('Authorization', `Bearer ${authToken}`);
    expect(firstRes.status).toBe(200);
    expect(firstRes.body.nextCursor).toEqual(expect.any(String));
    // Lots a and b sort first, so page one of the REGISTER holds no match even
    // though a later page does. The cursor, not the item count, says whether
    // there is more.
    expect(firstRes.body.items).toHaveLength(0);

    let cursor: string | null = firstRes.body.nextCursor;
    const found: string[] = [];
    while (cursor) {
      const pageRes: request.Response = await request(app)
        .get(
          `/api/projects/${projectId}/claim-readiness/blocked-lots?reasonCode=missing_budget&limit=2&cursor=${encodeURIComponent(cursor)}`,
        )
        .set('Authorization', `Bearer ${authToken}`);
      expect(pageRes.status).toBe(200);
      for (const item of pageRes.body.items as { lotId: string }[]) found.push(item.lotId);
      cursor = pageRes.body.nextCursor as string | null;
    }
    expect(found).toEqual([lotIds['c-no-budget']]);

    // Over the 500 cap: clamped, not rejected (same contract as the readiness route).
    const cappedRes = await request(app)
      .get(
        `/api/projects/${projectId}/claim-readiness/blocked-lots?reasonCode=not_conformed&limit=100000`,
      )
      .set('Authorization', `Bearer ${authToken}`);
    expect(cappedRes.status).toBe(200);
    expect(cappedRes.body.items).toHaveLength(1);
  });

  it('rejects a missing, unknown or malformed drill-down request', async () => {
    const missing = await request(app)
      .get(`/api/projects/${projectId}/claim-readiness/blocked-lots`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(missing.status).toBe(400);

    const unknown = await request(app)
      .get(`/api/projects/${projectId}/claim-readiness/blocked-lots?reasonCode=not_a_real_code`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(unknown.status).toBe(400);

    const badCursor = await request(app)
      .get(
        `/api/projects/${projectId}/claim-readiness/blocked-lots?reasonCode=not_conformed&cursor=nonsense`,
      )
      .set('Authorization', `Bearer ${authToken}`);
    expect(badCursor.status).toBe(400);
  });

  it('denies a non-commercial role and another company entirely', async () => {
    const foreman = await registerTestUser(app, {
      emailPrefix: 'f1-summary-foreman',
      fullName: 'F1 Summary Foreman',
      companyId,
      roleInCompany: 'foreman',
    });
    await prisma.projectUser.create({
      data: { projectId, userId: foreman.userId, role: 'foreman', status: 'active' },
    });

    const outsiderCompany = await prisma.company.create({
      data: { name: `F1 Outsider Co ${tag}` },
    });
    const outsider = await registerTestUser(app, {
      emailPrefix: 'f1-summary-outsider',
      fullName: 'F1 Summary Outsider',
      companyId: outsiderCompany.id,
      roleInCompany: 'project_manager',
    });

    try {
      for (const token of [foreman.token, outsider.token]) {
        const summaryRes = await request(app)
          .get(`/api/projects/${projectId}/claim-readiness/summary`)
          .set('Authorization', `Bearer ${token}`);
        expect(summaryRes.status).toBe(403);

        const drillRes = await request(app)
          .get(`/api/projects/${projectId}/claim-readiness/blocked-lots?reasonCode=not_conformed`)
          .set('Authorization', `Bearer ${token}`);
        expect(drillRes.status).toBe(403);
      }
    } finally {
      await prisma.projectUser.deleteMany({ where: { userId: foreman.userId } });
      for (const id of [foreman.userId, outsider.userId]) {
        await prisma.emailVerificationToken.deleteMany({ where: { userId: id } });
        await prisma.user.delete({ where: { id } }).catch(() => {});
      }
      await prisma.company.delete({ where: { id: outsiderCompany.id } }).catch(() => {});
    }
  });

  it('reports zeroes for a project with no lots', async () => {
    const emptyProject = await prisma.project.create({
      data: {
        name: `F1 Empty Project ${tag}`,
        projectNumber: `F1E-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    await prisma.projectUser.create({
      data: { projectId: emptyProject.id, userId, role: 'project_manager', status: 'active' },
    });

    try {
      const res = await request(app)
        .get(`/api/projects/${emptyProject.id}/claim-readiness/summary`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        totalBudget: 0,
        claimableValue: 0,
        blockedValue: 0,
        lotsInScope: 0,
        lotsBlocked: 0,
        lotsWithNullBudget: 0,
        groups: [],
      });
    } finally {
      await prisma.projectUser.deleteMany({ where: { projectId: emptyProject.id } });
      await prisma.project.delete({ where: { id: emptyProject.id } }).catch(() => {});
    }
  });
});
