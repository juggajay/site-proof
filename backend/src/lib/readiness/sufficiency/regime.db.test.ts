// Wave C1.1 — the DB-BACKED regime pin (spec §3.4.3, §14 AT-5, AT-6, AT-8, AT-18).
//
// C1.0 shipped `regime.test.ts` against a FAKE fetcher, which proves the fold
// and the query SHAPE but not that Prisma honours it. The two-mode contract is
// specifically about Postgres semantics — a compound cursor with `skip: 1` over a
// three-column total order, and an index-covered `take: N` — so a fake fetcher
// cannot tell a correct query from one that silently returns the wrong window.
// This suite runs the real `prismaRegimeStreamFetcher` against real rows.
//
// DB-backed, local disposable database only (`src/test/databaseSafety.ts`
// refuses anything else). Never point it at Railway.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '../../prisma.js';
import { prismaRegimeStreamFetcher } from './prismaStream.js';
import { resolveRegimeForRule, type RegimeStreamKey } from './regime.js';
import { VICROADS_204_V1 } from './rulesets/vicroads-204.v1.js';
import type { FrequencyRule } from './types.js';

const tag = `regime-db-${Date.now()}`;
const ACTIVITY_SLUG = 'earthworks_general';

// The shipped VicRoads compaction rule: eligibility-only, three consecutive
// conforming lots (clause 204.14(c)).
const ELIGIBILITY_RULE = VICROADS_204_V1.rules[0];

// A synthetic CONFIRMED rule that carries reduced FIGURES, so the operative
// `reduced` regime is exercised too. Nothing shipped declares one — 204.14(c)
// makes a reduction conditional on the Superintendent's agreement, and CIVOS has
// no approval input [C1C-6].
const REDUCED_FIGURES_RULE: FrequencyRule = {
  ...ELIGIBILITY_RULE,
  id: 'synthetic/reduced-figures',
  reducedFrequencyEligibility: undefined,
  reduced: {
    minCountByScale: { A: 3, B: 3, C: 2 },
    consecutiveConformingLots: 3,
    escalationShape: 'reset_on_any_failure',
  },
};

let companyId: string;
let userId: string;
let projectId: string;
let otherProjectId: string;
let sequence = 0;

/**
 * Each test overrides `activitySlug` to get its OWN stream. The value is an
 * isolation key, not a taxonomy assertion — these tests call
 * `resolveRegimeForRule` with an explicit key, so rule/activity matching is
 * bypassed and any distinct string works. Sharing a stream would let one test's
 * fixtures land in another's 3-row window, and the total order's last tiebreaker
 * is `id`, a random uuid, so that contamination would be non-deterministic.
 */
function streamKey(overrides: Partial<RegimeStreamKey> = {}): RegimeStreamKey {
  return {
    projectId,
    rulesetId: VICROADS_204_V1.id,
    ruleId: ELIGIBILITY_RULE.id,
    activitySlug: ACTIVITY_SLUG,
    layerBucket: '*',
    ...overrides,
  };
}

interface LotSpec {
  conforming: boolean;
  /** A force-conform is NON-conforming for regime purposes (§3.4.2). */
  overridden?: boolean;
  /** An UNVERIFIED failing test must NOT reset the stream [C1R-B8]. */
  failStatus?: 'verified' | 'entered';
  activitySlug?: string | null;
  inProject?: string;
}

// Conform times are spaced so the total order (conformedAt, createdAt, id) is
// unambiguous and the assertions read in stream order.
const BASE_TIME = Date.parse('2026-01-01T00:00:00.000Z');

async function seedLot(spec: LotSpec): Promise<{ id: string; conformedAt: Date }> {
  sequence += 1;
  const conformedAt = new Date(BASE_TIME + sequence * 60_000);
  const lot = await prisma.lot.create({
    data: {
      projectId: spec.inProject ?? projectId,
      lotNumber: `${tag}-L${sequence}`,
      lotType: 'chainage',
      activityType: 'Earthworks',
      activitySlug: spec.activitySlug === undefined ? ACTIVITY_SLUG : spec.activitySlug,
      status: 'conformed',
      conformedAt,
      conformedById: userId,
      ...(spec.overridden
        ? {
            conformanceOverriddenAt: conformedAt,
            conformanceOverriddenById: userId,
            conformanceOverrideReason: 'Fixture override',
          }
        : {}),
    },
  });
  if (!spec.conforming) {
    await prisma.testResult.create({
      data: {
        projectId: spec.inProject ?? projectId,
        lotId: lot.id,
        testType: 'compaction',
        passFail: 'fail',
        status: spec.failStatus ?? 'verified',
        testDate: conformedAt,
        enteredById: userId,
      },
    });
  }
  return { id: lot.id, conformedAt };
}

async function resolve(
  rule: FrequencyRule,
  subject: { id: string; conformedAt: Date | null },
  key: RegimeStreamKey = streamKey(),
) {
  return resolveRegimeForRule(prismaRegimeStreamFetcher(prisma), rule, key, subject);
}

beforeAll(async () => {
  const company = await prisma.company.create({ data: { name: `Co ${tag}` } });
  companyId = company.id;
  const user = await prisma.user.create({
    data: {
      email: `${tag}@example.test`,
      passwordHash: 'x',
      fullName: 'Regime DB User',
      companyId,
      roleInCompany: 'project_manager',
    },
  });
  userId = user.id;
  const project = await prisma.project.create({
    data: {
      name: `Project ${tag}`,
      projectNumber: `${tag}-P1`,
      companyId,
      state: 'VIC',
      specificationSet: 'VicRoads',
    },
  });
  projectId = project.id;
  const other = await prisma.project.create({
    data: {
      name: `Other ${tag}`,
      projectNumber: `${tag}-P2`,
      companyId,
      state: 'VIC',
      specificationSet: 'VicRoads',
    },
  });
  otherProjectId = other.id;
}, 60_000);

afterAll(async () => {
  await prisma.testResult.deleteMany({ where: { projectId: { in: [projectId, otherProjectId] } } });
  await prisma.lot.deleteMany({ where: { projectId: { in: [projectId, otherProjectId] } } });
  await prisma.project.deleteMany({ where: { id: { in: [projectId, otherProjectId] } } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.company.deleteMany({ where: { id: companyId } });
});

describe('AT-5 / AT-6 the two-mode query contract against real rows', () => {
  it('unconformed subject: no cursor, take N, most-recent-N semantics', async () => {
    await seedLot({ conforming: false });
    const a = await seedLot({ conforming: true });
    const b = await seedLot({ conforming: true });
    const c = await seedLot({ conforming: true });

    // Subject not yet conformed → mode 1. The old failing lot is OUTSIDE the
    // 3-row window, so the streak stands.
    const resolved = await resolve(ELIGIBILITY_RULE, { id: 'not-yet-created', conformedAt: null });
    expect(resolved).toMatchObject({ regime: 'full', eligible: true });
    expect(resolved?.basisLotIds).toEqual([a.id, b.id, c.id]);
  });

  it('conformed subject: strictly-before compound cursor, NOT most-recent-N', async () => {
    // The subject conformed BEFORE three later lots. "Most recent N" would
    // return those later lots; the cursor must return the three preceding it.
    const p1 = await seedLot({ conforming: true });
    const p2 = await seedLot({ conforming: true });
    const p3 = await seedLot({ conforming: true });
    const subject = await seedLot({ conforming: true });
    await seedLot({ conforming: false });
    await seedLot({ conforming: false });
    await seedLot({ conforming: false });

    const resolved = await resolve(ELIGIBILITY_RULE, subject);
    // Three failing lots follow the subject; if the cursor were ignored the
    // window would contain them and `eligible` would be false.
    expect(resolved).toMatchObject({ eligible: true });
    expect(resolved?.basisLotIds).toEqual([p1.id, p2.id, p3.id]);
  });

  it('the cursor is compound: lots sharing a conformedAt are still ordered totally', async () => {
    // Its OWN activitySlug, like the tests below. The default stream already
    // holds the failing lots the two tests above seeded, and the total order's
    // last tiebreaker is `id` — a random uuid — so sharing the stream would make
    // WHICH rows land in the 3-row window depend on uuid sort order.
    const key = streamKey({ activitySlug: 'earthworks_bulk_fill' });
    const shared = new Date(BASE_TIME + 900_000);
    const ids: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      sequence += 1;
      const lot = await prisma.lot.create({
        data: {
          projectId,
          lotNumber: `${tag}-TIE${i}`,
          lotType: 'chainage',
          activityType: 'Earthworks',
          activitySlug: 'earthworks_bulk_fill',
          status: 'conformed',
          conformedAt: shared,
          conformedById: userId,
        },
      });
      ids.push(lot.id);
    }
    // Four rows, one conformedAt. A plain `lt` on conformedAt would return
    // nothing (no row is strictly earlier) or all four (including the subject);
    // the compound cursor + skip:1 returns exactly the other three.
    const resolved = await resolve(ELIGIBILITY_RULE, { id: ids[3], conformedAt: shared }, key);
    expect(resolved?.basisLotIds).not.toContain(ids[3]);
    expect(resolved?.basisLotIds).toHaveLength(3);
    expect([...(resolved?.basisLotIds ?? [])].sort()).toEqual([...ids.slice(0, 3)].sort());
  });

  it('the LENGTH GUARD: a stream shorter than N is `full` and NOT eligible', async () => {
    const key = streamKey({ activitySlug: 'earthworks_subgrade_prep' });
    const only = await seedLot({ conforming: true, activitySlug: 'earthworks_subgrade_prep' });
    const resolved = await resolve(ELIGIBILITY_RULE, { id: only.id, conformedAt: null }, key);
    expect(resolved).toMatchObject({ regime: 'full', eligible: false });
    expect(resolved?.basisLotIds).toEqual([]);
  });
});

describe('AT-8 regime asymmetries, against real rows', () => {
  it('a FORCE-conformed lot is non-conforming: an override is not evidence', async () => {
    const key = streamKey({ activitySlug: 'drainage_pits' });
    await seedLot({ conforming: true, activitySlug: 'drainage_pits' });
    await seedLot({ conforming: true, activitySlug: 'drainage_pits' });
    await seedLot({ conforming: true, overridden: true, activitySlug: 'drainage_pits' });
    const resolved = await resolve(ELIGIBILITY_RULE, { id: 'x', conformedAt: null }, key);
    expect(resolved).toMatchObject({ eligible: false });
  });

  it('an UNVERIFIED failing test does NOT reset the stream; a verified one does', async () => {
    const unverifiedKey = streamKey({ activitySlug: 'pavement_base' });
    await seedLot({ conforming: true, activitySlug: 'pavement_base' });
    await seedLot({ conforming: true, activitySlug: 'pavement_base' });
    await seedLot({ conforming: false, failStatus: 'entered', activitySlug: 'pavement_base' });
    expect(
      await resolve(ELIGIBILITY_RULE, { id: 'x', conformedAt: null }, unverifiedKey),
    ).toMatchObject({ eligible: true });

    const verifiedKey = streamKey({ activitySlug: 'pavement_seal' });
    await seedLot({ conforming: true, activitySlug: 'pavement_seal' });
    await seedLot({ conforming: true, activitySlug: 'pavement_seal' });
    await seedLot({ conforming: false, failStatus: 'verified', activitySlug: 'pavement_seal' });
    expect(
      await resolve(ELIGIBILITY_RULE, { id: 'x', conformedAt: null }, verifiedKey),
    ).toMatchObject({ eligible: false });
  });

  it('an UNCLASSIFIED lot inside the window makes it incomplete (§16 D7)', async () => {
    const key = streamKey({ activitySlug: 'structural_concrete' });
    await seedLot({ conforming: true, activitySlug: 'structural_concrete' });
    await seedLot({ conforming: true, activitySlug: 'structural_concrete' });
    await seedLot({ conforming: true, activitySlug: null });
    // `reduced` cannot be EARNED across a history entry CIVOS cannot read —
    // that is exactly "treating unknown as satisfied".
    expect(await resolve(ELIGIBILITY_RULE, { id: 'x', conformedAt: null }, key)).toMatchObject({
      eligible: false,
    });
  });
});

describe('AT-8b the regime never lowers a count without a recorded approval [C1C-6]', () => {
  it('the shipped vicroads rule reports ELIGIBILITY at regime `full`, not a reduction', async () => {
    const key = streamKey({ activitySlug: 'earthworks_batters' });
    await seedLot({ conforming: true, activitySlug: 'earthworks_batters' });
    await seedLot({ conforming: true, activitySlug: 'earthworks_batters' });
    await seedLot({ conforming: true, activitySlug: 'earthworks_batters' });

    const resolved = await resolve(ELIGIBILITY_RULE, { id: 'x', conformedAt: null }, key);
    // The streak IS met — three consecutive conforming lots, clause 204.14(c).
    expect(resolved?.eligible).toBe(true);
    // …and the OPERATIVE regime is still `full`, because 204.14(c) requires the
    // Superintendent's agreement and CIVOS has no approval input. If a future
    // change ever turns eligibility into a reduction, this assertion fails.
    expect(resolved?.regime).toBe('full');
    expect(ELIGIBILITY_RULE.reduced).toBeUndefined();
  });

  it('only a rule carrying reduced FIGURES ever goes operative', async () => {
    const key = streamKey({ ruleId: REDUCED_FIGURES_RULE.id, activitySlug: 'earthworks_batters' });
    const resolved = await resolve(REDUCED_FIGURES_RULE, { id: 'x', conformedAt: null }, key);
    expect(resolved).toMatchObject({ regime: 'reduced', eligible: true });
  });
});

describe('AT-18 tenant isolation on the only new cross-lot query', () => {
  it('a lot in project B never appears in project A stream, even sharing a slug', async () => {
    const key = streamKey({ activitySlug: 'landscaping' });
    await seedLot({ conforming: true, activitySlug: 'landscaping', inProject: otherProjectId });
    await seedLot({ conforming: true, activitySlug: 'landscaping', inProject: otherProjectId });
    await seedLot({ conforming: true, activitySlug: 'landscaping', inProject: otherProjectId });

    // Project A has no `landscaping` lots at all, so the window is empty and the
    // length guard holds. If projectId leaked out of the `where`, the three
    // project-B lots would earn the streak here.
    const resolved = await resolve(ELIGIBILITY_RULE, { id: 'x', conformedAt: null }, key);
    expect(resolved).toMatchObject({ eligible: false });
    expect(resolved?.basisLotIds).toEqual([]);
  });
});
