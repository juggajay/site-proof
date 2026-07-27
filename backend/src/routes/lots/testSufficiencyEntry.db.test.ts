// Wave C1.1 — the data-entry surfaces (spec §9.1, §9.2, §14 AT-19, AT-20).
//
// Without these paths the engine has no data and the launch is dead [C1R-B10]:
// every lot created after C1 would be born with NULL scale and quantity, and a
// PM on a 500-lot project would open 500 forms.
//
// Covers:
//   * `bulkCreateCore` persists scale/quantity AND the folded `activitySlug` —
//     it is the shared core behind POST /api/lots/bulk and the copilot
//     lot_breakdown apply handler, i.e. the two ways lots are really created;
//   * POST /api/lots/bulk-set-test-attributes — the guard, the whole-batch
//     rejection of an invalid scale, and the role gate;
//   * PATCH /api/lots/:id — the three fields, and the slug re-fold on activity
//     change;
//   * AT-19 GET /api/test-sufficiency/rulesets — authenticated, and byte-
//     identical across two companies.
//
// DB-backed, local disposable database only (`src/test/databaseSafety.ts`).

import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { parseAuditLogChanges } from '../../lib/auditLog.js';
import {
  CONFORMANCE_LOT_SELECT,
  checkConformancePrerequisites,
  resolveSufficiencyForLot,
} from '../../lib/conformancePrerequisites.js';
import { prisma } from '../../lib/prisma.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { registerTestUser } from '../../test/routeTestHarness.js';
import { authRouter } from '../auth.js';
import { lotsRouter } from '../lots.js';
import { testSufficiencyRouter } from '../testSufficiency.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/lots', lotsRouter);
app.use('/api/test-sufficiency', testSufficiencyRouter);
app.use(errorHandler);

const tag = `suff-entry-${Date.now()}`;

let adminToken: string;
let adminUserId: string;
let foremanToken: string;
let foremanUserId: string;
let qualityManagerToken: string;
let qualityManagerUserId: string;
let companyId: string;
let projectId: string;

// A second company, so AT-19's tenant-isolation assertion is real.
let otherCompanyId: string;
let otherToken: string;
let otherUserId: string;

beforeAll(async () => {
  const company = await prisma.company.create({ data: { name: `Co ${tag}` } });
  companyId = company.id;

  const admin = await registerTestUser(app, {
    emailPrefix: `${tag}-admin`,
    fullName: 'Suff Admin',
    companyId,
    roleInCompany: 'admin',
  });
  adminToken = admin.token;
  adminUserId = admin.userId;

  const foreman = await registerTestUser(app, {
    emailPrefix: `${tag}-foreman`,
    fullName: 'Suff Foreman',
    companyId,
    roleInCompany: 'member',
  });
  foremanToken = foreman.token;
  foremanUserId = foreman.userId;

  // AT-50b: a quality_manager may edit and conform but may NOT force-conform,
  // which is what makes the missing whitelist a privilege bypass rather than a
  // tidiness problem.
  const qualityManager = await registerTestUser(app, {
    emailPrefix: `${tag}-qm`,
    fullName: 'Suff Quality Manager',
    companyId,
    roleInCompany: 'member',
  });
  qualityManagerToken = qualityManager.token;
  qualityManagerUserId = qualityManager.userId;

  // VIC / VicRoads, so the CONFIRMED `vicroads-204.v2` pack resolves and its
  // scaleKeys ['A','B','C'] are what the route validates against.
  const project = await prisma.project.create({
    data: {
      name: `Project ${tag}`,
      projectNumber: `${tag}-P1`,
      companyId,
      status: 'active',
      state: 'VIC',
      specificationSet: 'VicRoads',
    },
  });
  projectId = project.id;

  await prisma.projectUser.createMany({
    data: [
      { projectId, userId: adminUserId, role: 'admin', status: 'active' },
      // Foreman is deliberately NOT a lot setup manager (§10.2).
      { projectId, userId: foremanUserId, role: 'foreman', status: 'active' },
      { projectId, userId: qualityManagerUserId, role: 'quality_manager', status: 'active' },
    ],
  });

  const otherCompany = await prisma.company.create({ data: { name: `Other Co ${tag}` } });
  otherCompanyId = otherCompany.id;
  const other = await registerTestUser(app, {
    emailPrefix: `${tag}-other`,
    fullName: 'Other Company User',
    companyId: otherCompanyId,
    roleInCompany: 'admin',
  });
  otherToken = other.token;
  otherUserId = other.userId;
}, 60_000);

afterAll(async () => {
  await prisma.testResult.deleteMany({ where: { projectId } });
  await prisma.iTPInstance.deleteMany({ where: { lot: { projectId } } });
  await prisma.lot.deleteMany({ where: { projectId } });
  await prisma.iTPTemplate.deleteMany({ where: { projectId } });
  await prisma.projectUser.deleteMany({ where: { projectId } });
  await prisma.project.deleteMany({ where: { id: projectId } });
  await prisma.user.deleteMany({
    where: { id: { in: [adminUserId, foremanUserId, qualityManagerUserId, otherUserId] } },
  });
  await prisma.company.deleteMany({ where: { id: { in: [companyId, otherCompanyId] } } });
});

function post(path: string, token: string) {
  return request(app).post(path).set('Authorization', `Bearer ${token}`);
}

describe('AT-20 bulk create carries scale, quantity and the folded activitySlug', () => {
  it('persists all three plus the slug through the shared bulk core', async () => {
    const res = await post('/api/lots/bulk', adminToken).send({
      projectId,
      lots: [
        {
          lotNumber: `${tag}-BULK-1`,
          activityType: 'Earthworks',
          testScale: 'B',
          quantityValue: 3200.5,
          quantityUnit: 'm2',
        },
        // A FAMILY-level fold ('Pavement' → `pavements`, confidence 'family')
        // must store NULL, not the family slug (§16 D7).
        { lotNumber: `${tag}-BULK-2`, activityType: 'Pavement' },
      ],
    });
    expect(res.status, JSON.stringify(res.body)).toBe(201);

    const first = await prisma.lot.findFirst({ where: { projectId, lotNumber: `${tag}-BULK-1` } });
    expect(first?.activitySlug).toBe('earthworks_general');
    expect(first?.testScale).toBe('B');
    expect(Number(first?.quantityValue)).toBe(3200.5);
    expect(first?.quantityUnit).toBe('m2');

    const second = await prisma.lot.findFirst({ where: { projectId, lotNumber: `${tag}-BULK-2` } });
    expect(second?.activitySlug).toBeNull();
  });

  it('rejects a quantity unit outside the vocabulary', async () => {
    const res = await post('/api/lots/bulk', adminToken).send({
      projectId,
      lots: [{ lotNumber: `${tag}-BAD`, quantityValue: 10, quantityUnit: 'acres' }],
    });
    expect(res.status).toBe(400);
  });
});

describe('AT-20 POST /api/lots/bulk-set-test-attributes', () => {
  async function seedLot(lotNumber: string, status = 'in_progress') {
    return prisma.lot.create({
      data: {
        projectId,
        lotNumber,
        lotType: 'chainage',
        activityType: 'Earthworks',
        activitySlug: 'earthworks_general',
        status,
      },
    });
  }

  it('sets scale and quantity across a selection', async () => {
    const a = await seedLot(`${tag}-SET-A`);
    const b = await seedLot(`${tag}-SET-B`);
    const res = await post('/api/lots/bulk-set-test-attributes', adminToken).send({
      lotIds: [a.id, b.id],
      testScale: 'C',
      quantityValue: 900,
      quantityUnit: 'm2',
    });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.count).toBe(2);

    const rows = await prisma.lot.findMany({ where: { id: { in: [a.id, b.id] } } });
    for (const row of rows) {
      expect(row.testScale).toBe('C');
      expect(Number(row.quantityValue)).toBe(900);
      expect(row.quantityUnit).toBe('m2');
    }
  });

  it('rejects an invalid testScale for the WHOLE batch, writing nothing', async () => {
    const a = await seedLot(`${tag}-SET-BADSCALE`);
    const res = await post('/api/lots/bulk-set-test-attributes', adminToken).send({
      lotIds: [a.id],
      testScale: 'Z',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Valid scales: A, B, C');
    const after = await prisma.lot.findUnique({ where: { id: a.id } });
    expect(after?.testScale).toBeNull();
  });

  it('respects assertLotsBulkMutable — a conformed lot refuses the whole batch', async () => {
    const open = await seedLot(`${tag}-SET-OPEN`);
    const conformed = await seedLot(`${tag}-SET-CONFORMED`, 'conformed');
    const res = await post('/api/lots/bulk-set-test-attributes', adminToken).send({
      lotIds: [open.id, conformed.id],
      testScale: 'A',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('conformed or claimed');
    const after = await prisma.lot.findUnique({ where: { id: open.id } });
    expect(after?.testScale).toBeNull();
  });

  it('refuses an empty payload rather than silently NULLing a selection', async () => {
    const a = await seedLot(`${tag}-SET-EMPTY`);
    const res = await post('/api/lots/bulk-set-test-attributes', adminToken).send({
      lotIds: [a.id],
    });
    expect(res.status).toBe(400);
  });

  it('refuses half a quantity (a value with no unit)', async () => {
    const a = await seedLot(`${tag}-SET-HALF`);
    const res = await post('/api/lots/bulk-set-test-attributes', adminToken).send({
      lotIds: [a.id],
      quantityValue: 100,
    });
    expect(res.status).toBe(400);
  });

  it('a foreman cannot set lot setup attributes (§10.2)', async () => {
    const a = await seedLot(`${tag}-SET-FOREMAN`);
    const res = await post('/api/lots/bulk-set-test-attributes', foremanToken).send({
      lotIds: [a.id],
      testScale: 'A',
    });
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/lots/:id carries the three fields and re-folds the slug', () => {
  it('writes scale/quantity and re-derives activitySlug when activityType changes', async () => {
    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `${tag}-PATCH`,
        lotType: 'chainage',
        activityType: 'Earthworks',
        activitySlug: 'earthworks_general',
        status: 'in_progress',
      },
    });
    const res = await request(app)
      .patch(`/api/lots/${lot.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        testScale: 'A',
        quantityValue: 1250,
        quantityUnit: 'm3',
        activityType: 'Landscaping',
      });
    expect(res.status, JSON.stringify(res.body)).toBe(200);

    const after = await prisma.lot.findUnique({ where: { id: lot.id } });
    expect(after?.testScale).toBe('A');
    expect(Number(after?.quantityValue)).toBe(1250);
    expect(after?.quantityUnit).toBe('m3');
    // The slug never drifts from the free text it folds (§6).
    expect(after?.activitySlug).toBe('landscaping');
  });

  // F7 (external review 2026-07-27): a field-name list cannot prove which way a
  // requirement moved. Scale A -> C halves the required test count, so the audit
  // record has to carry from/to or it is not a detection control.
  it('records from/to for scale, quantity (as a pair) and activity classification', async () => {
    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `${tag}-PATCH-AUDIT`,
        lotType: 'chainage',
        activityType: 'Earthworks',
        activitySlug: 'earthworks_general',
        status: 'in_progress',
        testScale: 'A',
        quantityValue: 900,
        quantityUnit: 'm2',
      },
    });
    const res = await request(app)
      .patch(`/api/lots/${lot.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ testScale: 'C', quantityValue: 300, activityType: 'Landscaping' });
    expect(res.status, JSON.stringify(res.body)).toBe(200);

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: 'lot', entityId: lot.id, action: 'lot_updated' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).not.toBeNull();
    expect(parseAuditLogChanges(audit!.changes)).toMatchObject({
      testScale: { from: 'A', to: 'C' },
      // The unit was not sent, so the pair reports the unchanged unit rather
      // than a naked number with no dimension.
      quantity: { from: { value: 900, unit: 'm2' }, to: { value: 300, unit: 'm2' } },
      activity: {
        from: { type: 'Earthworks', slug: 'earthworks_general' },
        to: { type: 'Landscaping', slug: 'landscaping' },
      },
    });
  });

  it('rejects a non-positive quantity — NULL means unknown, zero is nonsense', async () => {
    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `${tag}-PATCH-ZERO`,
        lotType: 'chainage',
        activityType: 'Earthworks',
        status: 'in_progress',
      },
    });
    const res = await request(app)
      .patch(`/api/lots/${lot.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantityValue: 0, quantityUnit: 'm2' });
    expect(res.status).toBe(400);
  });
});

// §5.1.3 [C1R-B2] is the wave's payoff, and C1.1's stated exit criterion: a
// shortfall must be visible on an ALREADY-CONFORMED lot, because that is when it
// costs money. Before this change `buildConformanceItems` returned a single
// support item and nothing else for a conformed or claimed lot, which made the
// retroactive-visibility argument unreachable through the shipped surface.
describe('§5.1.3 the conformed and claimed short circuits carry advisory items', () => {
  async function seedShortfallLot(lotNumber: string, status: string) {
    const template = await prisma.iTPTemplate.create({
      data: { projectId, name: `Tpl ${lotNumber}`, activityType: 'Earthworks' },
    });
    const item = await prisma.iTPChecklistItem.create({
      data: {
        templateId: template.id,
        description: 'Compaction test point',
        sequenceNumber: 1,
        pointType: 'standard',
        responsibleParty: 'contractor',
        evidenceRequired: 'test',
        testType: 'compaction',
      },
    });
    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber,
        lotType: 'chainage',
        activityType: 'Earthworks',
        activitySlug: 'earthworks_general',
        status,
        budgetAmount: 5000,
        ...(status === 'conformed' ? { conformedAt: new Date(), conformedById: adminUserId } : {}),
      },
    });
    await prisma.iTPInstance.create({
      data: {
        lotId: lot.id,
        templateId: template.id,
        completions: { create: [{ checklistItemId: item.id, status: 'completed' }] },
      },
    });
    await prisma.testResult.create({
      data: {
        projectId,
        lotId: lot.id,
        itpChecklistItemId: item.id,
        testType: 'compaction',
        passFail: 'pass',
        status: 'verified',
        enteredById: adminUserId,
      },
    });
    return lot;
  }

  it.each(['conformed', 'claimed'])(
    'a %s lot short on tests still shows the shortfall, and it never blocks',
    async (status) => {
      const lot = await seedShortfallLot(`${tag}-RETRO-${status}`, status);
      const res = await request(app)
        .get(`/api/lots/${lot.id}/readiness`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status, JSON.stringify(res.body)).toBe(200);

      const conformance = res.body.readiness.conformance;
      const items = [...conformance.blockers, ...conformance.warnings, ...conformance.support];
      // The short-circuit support item is still emitted…
      expect(conformance.support.map((item: { code: string }) => item.code)).toContain(
        status === 'claimed' ? 'lot_already_claimed' : 'lot_already_conformed',
      );
      // …and the shortfall is now visible beside it, with the numbers.
      const shortfall = items.find(
        (item: { code: string }) => item.code === 'insufficient_test_count',
      );
      expect(shortfall).toBeDefined();
      expect(shortfall.detail).toContain('Requires 6 compaction tests');
      expect(shortfall.detail).toContain('clause 204.13(a)');
      // Advisory BY CONSTRUCTION on these branches — never blocking, so a
      // retroactive shortfall can never un-claim a previously claimable lot.
      for (const item of items) expect(item.blocksAction).toBe(false);
    },
  );
});

// ---------------------------------------------------------------------------
// D14 §9.2 `[D14R-B5]` `[D14X-2]` — AT-50a and AT-50b.
//
// `assertTestScaleValidForLots` shipped module-private with ONE call site, so
// four of the five write paths accepted any string at all. Two reviews found the
// hole independently; the external one named its cost — it is a PRIVILEGE
// BYPASS, because `unknown` does not block and a `quality_manager` may conform
// but may not force-conform, so the gate is defeated with no override record.
// ---------------------------------------------------------------------------
describe('AT-50a the pack whitelist reaches every write path, not one of five', () => {
  it('single create rejects a scale outside scaleKeys, naming the valid list', async () => {
    const res = await post('/api/lots', adminToken).send({
      projectId,
      lotNumber: `${tag}-W-CREATE-BAD`,
      activityType: 'Earthworks',
      testScale: 'Z',
    });
    expect(res.status, JSON.stringify(res.body)).toBe(400);
    expect(res.body.error.message).toContain('Valid scales: A, B, C');
    expect(
      await prisma.lot.findFirst({ where: { projectId, lotNumber: `${tag}-W-CREATE-BAD` } }),
    ).toBeNull();
  });

  // The copilot lot-breakdown executor re-validates and then calls straight into
  // `createBulkLots`, so this placement covers the fifth path too.
  it('bulk create rejects the WHOLE batch on one bad row, writing nothing', async () => {
    const res = await post('/api/lots/bulk', adminToken).send({
      projectId,
      lots: [
        { lotNumber: `${tag}-W-BULK-OK`, activityType: 'Earthworks', testScale: 'A' },
        { lotNumber: `${tag}-W-BULK-BAD`, activityType: 'Earthworks', testScale: 'Z' },
      ],
    });
    expect(res.status, JSON.stringify(res.body)).toBe(400);
    expect(res.body.error.message).toContain(`on lot ${tag}-W-BULK-BAD`);
    // Whole-batch: the GOOD row is not written either.
    expect(
      await prisma.lot.count({
        where: { projectId, lotNumber: { in: [`${tag}-W-BULK-OK`, `${tag}-W-BULK-BAD`] } },
      }),
    ).toBe(0);
  });

  it('PATCH rejects it, and the stored value is untouched', async () => {
    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `${tag}-W-PATCH`,
        lotType: 'chainage',
        activityType: 'Earthworks',
        activitySlug: 'earthworks_general',
        status: 'in_progress',
        testScale: 'A',
      },
    });
    const res = await request(app)
      .patch(`/api/lots/${lot.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ testScale: 'Z' });
    expect(res.status).toBe(400);
    expect((await prisma.lot.findUnique({ where: { id: lot.id } }))?.testScale).toBe('A');
  });

  it('a materialType outside the pack vocabulary is refused on every path (D14.2)', async () => {
    // The pack declares Type A/B/C from D14.2 on, so "Type A" is now storable and
    // "Type Z" is the out-of-vocabulary case the whitelist exists for.
    const created = await post('/api/lots', adminToken).send({
      projectId,
      lotNumber: `${tag}-W-MAT`,
      activityType: 'Earthworks',
      materialType: 'Type Z',
    });
    expect(created.status).toBe(400);
    expect(created.body.error.message).toContain('Valid material types: Type A, Type B, Type C');

    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `${tag}-W-MAT-PATCH`,
        lotType: 'chainage',
        activityType: 'Earthworks',
        status: 'in_progress',
      },
    });
    const patched = await request(app)
      .patch(`/api/lots/${lot.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ materialType: 'Type Z' });
    expect(patched.status).toBe(400);

    const bulkSet = await post('/api/lots/bulk-set-test-attributes', adminToken).send({
      lotIds: [lot.id],
      materialType: 'Type Z',
    });
    expect(bulkSet.status).toBe(400);

    // And the declared value now round-trips rather than 400ing.
    const accepted = await post('/api/lots', adminToken).send({
      projectId,
      lotNumber: `${tag}-W-MAT-OK`,
      activityType: 'Earthworks',
      materialType: 'Type A',
    });
    expect(accepted.status, JSON.stringify(accepted.body)).toBe(201);
    // Asserted on the row, not the response: `POST /api/lots` returns a narrow
    // projection that carries none of the sufficiency attributes (not `testScale`
    // or the quantity either), and widening it is not this phase's business.
    expect(
      (await prisma.lot.findUniqueOrThrow({ where: { id: accepted.body.lot.id } })).materialType,
    ).toBe('Type A');
  });

  it('null is accepted on every path — clearing a field is not a vocabulary question', async () => {
    const created = await post('/api/lots', adminToken).send({
      projectId,
      lotNumber: `${tag}-W-NULL`,
      activityType: 'Earthworks',
      testScale: null,
      materialType: null,
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);

    const patched = await request(app)
      .patch(`/api/lots/${created.body.lot.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ testScale: null, materialType: null });
    expect(patched.status, JSON.stringify(patched.body)).toBe(200);
  });
});

// AT-50b — the block-mode bypass, end to end, with a REAL role. Written at route
// level deliberately: the evaluator behaves correctly in both worlds and would
// pass either way, so an evaluator-level test proves nothing about the hole.
describe('AT-50b an invalid scale cannot be used to escape block mode', () => {
  let blockLotId: string;

  beforeAll(async () => {
    const template = await prisma.iTPTemplate.create({
      data: { projectId, name: `Tpl ${tag}-BLOCK`, activityType: 'Earthworks' },
    });
    const checklistItem = await prisma.iTPChecklistItem.create({
      data: {
        templateId: template.id,
        description: 'Compaction test point',
        sequenceNumber: 1,
        pointType: 'standard',
        responsibleParty: 'contractor',
        evidenceRequired: 'test',
        testType: 'compaction',
      },
    });
    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `${tag}-BLOCK`,
        lotType: 'chainage',
        activityType: 'Earthworks',
        activitySlug: 'earthworks_general',
        status: 'in_progress',
      },
    });
    blockLotId = lot.id;
    await prisma.iTPInstance.create({
      data: {
        lotId: blockLotId,
        templateId: template.id,
        completions: { create: [{ checklistItemId: checklistItem.id, status: 'completed' }] },
      },
    });
    // 1 of the 6 clause 204.13(a) requires at the Scale A default.
    await prisma.testResult.create({
      data: {
        projectId,
        lotId: blockLotId,
        itpChecklistItemId: checklistItem.id,
        testType: 'compaction',
        passFail: 'pass',
        status: 'verified',
        enteredById: adminUserId,
      },
    });
    await prisma.project.update({
      where: { id: projectId },
      data: { testSufficiencyMode: 'block' },
    });
  }, 60_000);

  afterAll(async () => {
    await prisma.project.update({
      where: { id: projectId },
      data: { testSufficiencyMode: 'warn' },
    });
  });

  it('the lot is genuinely blocked to begin with — 1 of 6, canConform false', async () => {
    const result = await checkConformancePrerequisites(blockLotId);
    expect(result.sufficiency?.rules[0]).toMatchObject({
      state: 'insufficient',
      requiredCount: 6,
      passingCount: 1,
    });
    expect(result.canConform).toBe(false);
  });

  it('THE FIX: a quality_manager cannot PATCH an unrecognised scale onto it', async () => {
    // A quality_manager may edit and conform but may NOT force-conform, so
    // before D14.1 this PATCH converted an insufficient verdict into a
    // non-blocking `unknown` with no override record of any kind.
    const res = await request(app)
      .patch(`/api/lots/${blockLotId}`)
      .set('Authorization', `Bearer ${qualityManagerToken}`)
      .send({ testScale: 'Z' });
    expect(res.status, JSON.stringify(res.body)).toBe(400);

    const after = await checkConformancePrerequisites(blockLotId);
    expect(after.canConform).toBe(false);
  });

  it('a row written BEFORE the whitelist still degrades HONESTLY, not silently', async () => {
    // The validator cannot retroactively clean rows, and `scale_not_recognised`
    // stays a live state by design. What matters is that the transition is
    // VISIBLE as unrecognised data rather than looking like a satisfied lot —
    // and that it does not 500 the claim path (`[D14R-B2]`).
    await prisma.lot.update({ where: { id: blockLotId }, data: { testScale: 'Z' } });
    const result = await checkConformancePrerequisites(blockLotId);
    expect(result.sufficiency?.rules[0]).toMatchObject({
      state: 'unknown',
      requiredCount: null,
      unknownCauses: ['scale_not_recognised'],
    });
    // `unknown` does not block — the honest consequence of unrecognised data,
    // which is exactly why the value must be unreachable through the API.
    expect(result.canConform).toBe(true);
    await prisma.lot.update({ where: { id: blockLotId }, data: { testScale: null } });
  });
});

// AT-50 — the persistence half, through the REAL `sufficiencyInput()` mapper
// (`conformancePrerequisites.ts` §8.1 edit 3), never a stub. A stub passes with
// that edit missing, which is exactly the silent failure it exists to prevent:
// `materialType` persisted, returned by the API and visible in the form while
// being never seen by the evaluator.
describe('AT-50 materialType reaches the evaluator, not just the database', () => {
  it('the conformance mapper carries materialType into the resolved inputs', async () => {
    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `${tag}-MAT-MAPPER`,
        lotType: 'chainage',
        activityType: 'Earthworks',
        activitySlug: 'earthworks_general',
        status: 'in_progress',
        materialType: 'Type A',
      },
    });
    const resolved = await resolveSufficiencyForLot(
      await prisma.lot.findUniqueOrThrow({
        where: { id: lot.id },
        select: CONFORMANCE_LOT_SELECT,
      }),
      undefined,
    );
    expect(resolved?.materialType).toBe('Type A');
  });

  it('GET /api/lots/:id returns it, so the edit form cannot NULL it on the next save', async () => {
    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `${tag}-MAT-READ`,
        lotType: 'chainage',
        activityType: 'Earthworks',
        status: 'in_progress',
        materialType: 'Type B',
      },
    });
    const res = await request(app)
      .get(`/api/lots/${lot.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.lot.materialType).toBe('Type B');
  });
});

describe('AT-19 GET /api/test-sufficiency/rulesets', () => {
  it('requires authentication', async () => {
    expect((await request(app).get('/api/test-sufficiency/rulesets')).status).toBe(401);
  });

  it('returns byte-identical payloads to two users in different companies', async () => {
    const mine = await request(app)
      .get('/api/test-sufficiency/rulesets')
      .set('Authorization', `Bearer ${adminToken}`);
    const theirs = await request(app)
      .get('/api/test-sufficiency/rulesets')
      .set('Authorization', `Bearer ${otherToken}`);
    expect(mine.status).toBe(200);
    expect(theirs.status).toBe(200);
    expect(JSON.stringify(mine.body)).toBe(JSON.stringify(theirs.body));
  });

  it('exposes the scaleKeys the lot-edit control needs, and no free prose', async () => {
    const res = await request(app)
      .get('/api/test-sufficiency/rulesets')
      .set('Authorization', `Bearer ${adminToken}`);
    const vicroads = res.body.rulesets.find(
      (ruleset: { id: string }) => ruleset.id === 'vicroads-204.v2',
    );
    expect(vicroads.scaleKeys).toEqual(['A', 'B', 'C']);
    expect(vicroads.defaultScale).toBe('A');
    expect(vicroads.status).toBe('confirmed');
    // D14.2 — the material control's option list rides the same payload.
    expect(vicroads.materialTypes).toEqual(['Type A', 'Type B', 'Type C']);
    // A rule carries a label, a clause and its activity slugs; there is no
    // free-prose field on the type at all, so no specification text can reach
    // this payload (§8.4). `activitySlugs` is shipped product data — D14.3 §9.3
    // gates the lot-edit Testing card on it.
    expect(Object.keys(vicroads.rules[0]).sort()).toEqual([
      'activitySlugs',
      'clause',
      'id',
      'label',
      'scaleIndependent',
      'testType',
    ]);
    expect(vicroads.rules[0].activitySlugs).toEqual([
      'earthworks_general',
      'earthworks_subgrade_prep',
    ]);
  });

  it('D14.3 serves the NSW pack with its own band vocabulary and label', async () => {
    const res = await request(app)
      .get('/api/test-sufficiency/rulesets')
      .set('Authorization', `Bearer ${adminToken}`);
    const q6 = res.body.rulesets.find((ruleset: { id: string }) => ruleset.id === 'tfnsw-q6.v1');
    expect(q6.scaleKeys).toEqual([
      '<=90.0%',
      '>90.0-95.0%',
      '>95.0-98.0%',
      '>98.0-100.0%',
      '>100.0%',
    ]);
    // The form must stop saying "Testing Scale" on an NSW project (AT-55).
    expect(q6.scaleLabel).toBe('Specified relative compaction');
    // Q6 publishes no default and no material classification.
    expect(q6.defaultScale).toBeNull();
    expect(q6.materialTypes).toBeNull();
    // J2 — the Major Works scope reaches the user through the citation.
    expect(q6.document).toContain('Major Works');
  });

  // D14.5 — the lot-edit card must know WHICH rules read a scale, or it asks a
  // pavement lot for a band that provably cannot change its count and tells the
  // user CIVOS cannot check the lot without one. Derived from the rule shape
  // (`countByAreaBand.bands` vs `byScale`), never declared by a pack.
  it('flags the scale-independent rules so the form can stop asking', async () => {
    const res = await request(app)
      .get('/api/test-sufficiency/rulesets')
      .set('Authorization', `Bearer ${adminToken}`);
    const rulesById = new Map<string, { scaleIndependent: boolean }>(
      res.body.rulesets.flatMap((ruleset: { rules: { id: string }[] }) =>
        ruleset.rules.map((rule) => [rule.id, rule] as const),
      ),
    );
    expect(rulesById.get('tfnsw-q6.v1/pavement-compaction-density')?.scaleIndependent).toBe(true);
    // Same pack, `byScale` table — the band is a real question there.
    expect(rulesById.get('tfnsw-q6.v1/compaction-density')?.scaleIndependent).toBe(false);
    expect(rulesById.get('vicroads-204.v2/compaction-density')?.scaleIndependent).toBe(false);
  });

  // D14.2 §6.5 — the regression minting `.v2` would otherwise have shipped.
  it('serves LIVE packs only — a superseded pack is evidence, not a form vocabulary', async () => {
    // `frontend/src/lib/testSufficiency.ts` `resolveProjectRuleset` matches on
    // state + spec set with `.find()` and NO date window, so a superseded pack in
    // this payload would win by array order and the VIC lot form would offer
    // `vicroads-204.v1`'s vocabulary — no material control at all — while the
    // route-level whitelist enforced v2's. One authority, one entry.
    const res = await request(app)
      .get('/api/test-sufficiency/rulesets')
      .set('Authorization', `Bearer ${adminToken}`);
    const vic = res.body.rulesets.filter(
      (ruleset: { state: string; specSet: string }) =>
        ruleset.state === 'vic' && ruleset.specSet === 'vicroads',
    );
    expect(vic.map((ruleset: { id: string }) => ruleset.id)).toEqual(['vicroads-204.v2']);
  });
});
