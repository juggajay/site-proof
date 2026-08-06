// The claim detail band projection, end to end against real rows.
//
// DB-backed on purpose: the load-bearing behaviour is WHICH claims feed the
// "Previously claimed" band, and that is a Prisma filter over the
// `ClaimedLot -> ProgressClaim` join (`priorClaimedLotsWhere`). Its shape is
// unit-tested in `claimBands.test.ts`; only a real query proves that a draft
// claim and a later claim actually fail to match. The arithmetic itself, the
// unavailable-band rules and the variation-only case are pure and live in the
// unit suite.

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

const tag = `claim-bands-${Date.now()}`;

interface Fixture {
  companyId: string;
  userId: string;
  token: string;
  viewerId: string;
  viewerToken: string;
  projectId: string;
  lotId: string;
  /** Claim 3 — the one under test. */
  currentClaimId: string;
}

let fixture: Fixture;

async function createClaim(
  projectId: string,
  lotId: string,
  claimNumber: number,
  status: string,
  amountClaimed: number,
  percentageComplete: number,
) {
  return prisma.progressClaim.create({
    data: {
      projectId,
      claimNumber,
      claimPeriodStart: new Date('2026-06-01T00:00:00.000Z'),
      claimPeriodEnd: new Date('2026-06-30T00:00:00.000Z'),
      status,
      totalClaimedAmount: amountClaimed,
      claimedLots: { create: [{ lotId, amountClaimed, percentageComplete }] },
    },
  });
}

beforeAll(async () => {
  const company = await prisma.company.create({ data: { name: `Co ${tag}` } });
  const user = await registerTestUser(app, {
    emailPrefix: 'claim-bands-pm',
    fullName: 'Claim Bands PM',
    companyId: company.id,
    roleInCompany: 'project_manager',
  });
  const viewer = await registerTestUser(app, {
    emailPrefix: 'claim-bands-viewer',
    fullName: 'Claim Bands Viewer',
    companyId: company.id,
    roleInCompany: 'viewer',
  });
  const project = await prisma.project.create({
    data: {
      name: `Project ${tag}`,
      projectNumber: `${tag}-P1`,
      companyId: company.id,
      status: 'active',
      state: 'NSW',
      specificationSet: 'TfNSW',
    },
  });
  await prisma.projectUser.createMany({
    data: [
      { projectId: project.id, userId: user.userId, role: 'project_manager', status: 'active' },
      { projectId: project.id, userId: viewer.userId, role: 'viewer', status: 'active' },
    ],
  });
  const lot = await prisma.lot.create({
    data: {
      projectId: project.id,
      lotNumber: `${tag}-LOT`,
      description: 'Subgrade preparation',
      status: 'conformed',
      lotType: 'chainage',
      activityType: 'Earthworks',
      budgetAmount: 42000,
    },
  });

  // Claim 1: submitted -> counts as history.
  await createClaim(project.id, lot.id, 1, 'submitted', 8400, 20);
  // Claim 2: DRAFT -> must not count as history (it reserves, it does not claim).
  await createClaim(project.id, lot.id, 2, 'draft', 4200, 10);
  // Claim 3: the claim under test.
  const current = await createClaim(project.id, lot.id, 3, 'submitted', 27300, 65);
  // Claim 4: a LATER claim -> must not count as history for claim 3.
  await createClaim(project.id, lot.id, 4, 'submitted', 2100, 5);

  fixture = {
    companyId: company.id,
    userId: user.userId,
    token: user.token,
    viewerId: viewer.userId,
    viewerToken: viewer.token,
    projectId: project.id,
    lotId: lot.id,
    currentClaimId: current.id,
  };
});

afterAll(async () => {
  if (!fixture) return;
  await prisma.claimedLot.deleteMany({ where: { claim: { projectId: fixture.projectId } } });
  await prisma.progressClaim.deleteMany({ where: { projectId: fixture.projectId } });
  await prisma.lot.deleteMany({ where: { projectId: fixture.projectId } });
  await prisma.projectUser.deleteMany({ where: { projectId: fixture.projectId } });
  await prisma.auditLog.deleteMany({ where: { projectId: fixture.projectId } });
  await prisma.project.delete({ where: { id: fixture.projectId } }).catch(() => {});
  await prisma.emailVerificationToken.deleteMany({
    where: { userId: { in: [fixture.userId, fixture.viewerId] } },
  });
  await prisma.user.deleteMany({ where: { id: { in: [fixture.userId, fixture.viewerId] } } });
  await prisma.company.delete({ where: { id: fixture.companyId } }).catch(() => {});
});

function getClaim(claimId: string, token: string) {
  return request(app)
    .get(`/api/projects/${fixture.projectId}/claims/${claimId}`)
    .set('Authorization', `Bearer ${token}`);
}

describe('GET /api/projects/:projectId/claims/:claimId — band projection', () => {
  it('derives Previously claimed from earlier non-draft claims only', async () => {
    const response = await getClaim(fixture.currentClaimId, fixture.token).expect(200);
    const bands = response.body.claim.bands;

    expect(bands.lines).toHaveLength(1);
    const [line] = bands.lines;

    // Only claim 1 ($8,400) qualifies: claim 2 is a draft, claim 4 is later.
    expect(line.previouslyClaimed.cents).toBe(840000);
    expect(line.previouslyClaimed.percentage).toBe(20);
    expect(line.priorClaimCount).toBe(1);
    expect(bands.priorClaimCount).toBe(1);

    expect(line.thisClaim.cents).toBe(2730000);
    expect(line.claimedToDate.cents).toBe(3570000);
    expect(line.lotNumber).toBe(`${tag}-LOT`);
  });

  it('reports the actual derivation of the line amount, not an ITP-based formula', async () => {
    const response = await getClaim(fixture.currentClaimId, fixture.token).expect(200);
    const [line] = response.body.claim.bands.lines;

    // 65% of the $42,000 lot budget IS how 27,300 was computed.
    expect(line.derivation).toEqual({
      basis: 'percent_of_lot_budget',
      percentage: 65,
      lotBudgetCents: 4200000,
    });
    // The lot has no ITP assigned, so no ITP fact is fabricated.
    expect(line.itp).toBeNull();
  });

  it('exposes claim-level certification only — no per-line certified figure', async () => {
    const response = await getClaim(fixture.currentClaimId, fixture.token).expect(200);
    const claim = response.body.claim;
    const [line] = claim.bands.lines;

    expect(line).not.toHaveProperty('certified');
    expect(claim.bands.lineTotals).not.toHaveProperty('certified');
    // Certification lives on the claim, where it was actually recorded.
    expect(claim).toHaveProperty('certifiedAmount');
  });

  it('states which statuses count as claim history', async () => {
    const response = await getClaim(fixture.currentClaimId, fixture.token).expect(200);
    expect(response.body.claim.bands.historyStatuses).toEqual([
      'submitted',
      'disputed',
      'certified',
      'partially_paid',
      'paid',
    ]);
  });

  it('denies a non-commercial role the same way the claims register does', async () => {
    await getClaim(fixture.currentClaimId, fixture.viewerToken).expect(403);
  });
});
