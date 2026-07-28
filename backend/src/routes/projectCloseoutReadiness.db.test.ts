// Wave D `D1a` — quality closeout readiness, DB-backed (spec Rev 3 §14).
//
//   AT-119  set parity over EVERY registered handover code, against the lot page
//   AT-120  nothing is stored `[DH-B4]`
//   AT-132  tenancy — the readiness endpoint refuses a cross-tenant project
//   AT-134  commercial redaction `[DH-B7]`
//   AT-139  filters disclose what they could not place, they do not hide it
//
// AT-119 does not compare the endpoint against a hand-written expectation. It
// compares it against the OTHER ENDPOINT — `GET /api/lots/:id/readiness`, the
// thing the user is looking at when they disbelieve the panel — over a project
// seeded to provoke all nine registered codes.
//
// DB-backed: local disposable database only (`src/test/databaseSafety.ts`).

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '../lib/prisma.js';
import type { CloseoutReadinessResponse } from '../lib/readiness/contracts/futureConsumers.js';
import { HANDOVER_BLOCKING_REASON_CODES } from '../lib/readiness/contracts/reasonCodes.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { registerTestUser } from '../test/routeTestHarness.js';
import { authRouter } from './auth.js';
import { lotsRouter } from './lots.js';
import { projectCloseoutReadinessRouter } from './projectCloseoutReadiness.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/lots', lotsRouter);
app.use('/api/projects', projectCloseoutReadinessRouter);
app.use(errorHandler);

const tag = `closeout-${Date.now()}`;

let token: string;
let viewerToken: string;
let outsiderToken: string;
let subbieToken: string;
let companyId: string;
let userId: string;
let projectId: string;
let otherProjectId: string;
let areaId: string;
let emptyAreaId: string;
const lotIdByNumber = new Map<string, string>();
/** The fixtures whose only NCR is MAJOR — the one code the lot page cannot emit. */
const MAJOR_NCR_LOTS = new Set(['L05-ncr-major']);

function lotId(lotNumber: string): string {
  return lotIdByNumber.get(lotNumber)!;
}

interface ItemSpec {
  key: string;
  pointType?: string;
  evidenceRequired?: string;
  testType?: string;
}

interface LotSpec {
  lotNumber: string;
  status?: string;
  chainageStart?: number | null;
  chainageEnd?: number | null;
  activitySlug?: string | null;
  items?: ItemSpec[];
  /** Item keys whose completion is recorded, and with what status. */
  completions?: { itemKey: string; status: string }[];
  ncrs?: { severity: string; status: string }[];
  holdPoints?: { itemKey: string; status: string }[];
  verifiedTests?: number;
}

/** Template + items + instance + completions. Returns key -> checklistItemId. */
async function seedItp(lotId: string, spec: LotSpec): Promise<Map<string, string>> {
  const itemIdByKey = new Map<string, string>();
  if (!spec.items || spec.items.length === 0) return itemIdByKey;

  const template = await prisma.iTPTemplate.create({
    data: { projectId, name: `Tpl ${spec.lotNumber}`, activityType: 'Earthworks' },
  });
  let sequenceNumber = 1;
  for (const item of spec.items) {
    const created = await prisma.iTPChecklistItem.create({
      data: {
        templateId: template.id,
        sequenceNumber: sequenceNumber++,
        description: `Item ${item.key}`,
        pointType: item.pointType ?? 'standard',
        responsibleParty: 'contractor',
        evidenceRequired: item.evidenceRequired ?? 'none',
        testType: item.testType ?? null,
      },
    });
    itemIdByKey.set(item.key, created.id);
  }
  await prisma.iTPInstance.create({
    data: {
      lotId,
      templateId: template.id,
      completions: {
        create: (spec.completions ?? []).map((completion) => ({
          checklistItemId: itemIdByKey.get(completion.itemKey)!,
          status: completion.status,
        })),
      },
    },
  });
  return itemIdByKey;
}

async function seedLotEvidence(
  lotId: string,
  spec: LotSpec,
  itemIdByKey: Map<string, string>,
): Promise<void> {
  for (const [index, ncrSpec] of (spec.ncrs ?? []).entries()) {
    const ncr = await prisma.nCR.create({
      data: {
        projectId,
        ncrNumber: `${spec.lotNumber}-NCR-${index + 1}`,
        description: 'Fixture NCR',
        category: 'workmanship',
        severity: ncrSpec.severity,
        status: ncrSpec.status,
        raisedById: userId,
      },
    });
    await prisma.nCRLot.create({ data: { ncrId: ncr.id, lotId } });
  }

  for (const holdPoint of spec.holdPoints ?? []) {
    await prisma.holdPoint.create({
      data: {
        lotId,
        itpChecklistItemId: itemIdByKey.get(holdPoint.itemKey)!,
        pointType: 'hold_point',
        status: holdPoint.status,
      },
    });
  }

  for (let i = 0; i < (spec.verifiedTests ?? 0); i += 1) {
    await prisma.testResult.create({
      data: {
        projectId,
        lotId,
        itpChecklistItemId: itemIdByKey.get('t') ?? null,
        testType: 'compaction',
        passFail: 'pass',
        status: 'verified',
        enteredById: userId,
      },
    });
  }
}

async function seedLot(spec: LotSpec): Promise<void> {
  const lot = await prisma.lot.create({
    data: {
      projectId,
      lotNumber: spec.lotNumber,
      lotType: 'roadworks',
      activityType: 'Earthworks',
      status: spec.status ?? 'in_progress',
      chainageStart: spec.chainageStart ?? null,
      chainageEnd: spec.chainageEnd ?? null,
      activitySlug: spec.activitySlug ?? null,
    },
  });
  lotIdByNumber.set(spec.lotNumber, lot.id);
  await seedLotEvidence(lot.id, spec, await seedItp(lot.id, spec));
}

beforeAll(async () => {
  companyId = (await prisma.company.create({ data: { name: `Co ${tag}` } })).id;
  const pm = await registerTestUser(app, {
    emailPrefix: 'co-pm',
    fullName: 'Closeout PM',
    companyId,
    roleInCompany: 'owner',
  });
  token = pm.token;
  userId = pm.userId;

  // VIC/VicRoads at `testSufficiencyMode: 'block'`, so the CONFIRMED
  // `vicroads-204.v2` pack can make `insufficient_test_count` a real blocker
  // rather than a code nothing in the fixture can reach.
  const project = await prisma.project.create({
    data: {
      name: `Project ${tag}`,
      projectNumber: `${tag}-P1`,
      companyId,
      state: 'VIC',
      specificationSet: 'VicRoads',
      testSufficiencyMode: 'block',
    },
  });
  projectId = project.id;
  await prisma.projectUser.create({
    data: { projectId, userId, role: 'project_manager', status: 'active' },
  });

  areaId = (
    await prisma.projectArea.create({
      data: { projectId, name: `Area ${tag}`, chainageStart: 0, chainageEnd: 150 },
    })
  ).id;
  emptyAreaId = (await prisma.projectArea.create({ data: { projectId, name: `Unbounded ${tag}` } }))
    .id;

  const complete = { key: 'a', pointType: 'standard' };
  const testPoint = {
    key: 't',
    pointType: 'standard',
    evidenceRequired: 'test',
    testType: 'compaction',
  };
  const holdPointItem = { key: 'h', pointType: 'hold_point' };

  // Every lot below carries a NULL `activitySlug` except L08 — at
  // `testSufficiencyMode: 'block'` a resolvable slug would put
  // `insufficient_test_count` on lots that are meant to isolate other codes.
  const specs: LotSpec[] = [
    // no_itp_assigned. Placed on the chainage line, inside the area window.
    { lotNumber: 'L01-no-itp', chainageStart: 0, chainageEnd: 100 },
    // itp_incomplete. Placed, but OUTSIDE the area window.
    {
      lotNumber: 'L02-itp-incomplete',
      chainageStart: 200,
      chainageEnd: 300,
      items: [complete, { key: 'b', pointType: 'standard' }],
      completions: [{ itemKey: 'a', status: 'completed' }],
    },
    // no_passing_verified_test.
    {
      lotNumber: 'L03-no-test',
      items: [testPoint],
      completions: [{ itemKey: 't', status: 'completed' }],
    },
    // open_ncrs alone — a MINOR NCR is open but not serious.
    {
      lotNumber: 'L04-ncr-minor',
      items: [complete],
      completions: [{ itemKey: 'a', status: 'completed' }],
      ncrs: [{ severity: 'minor', status: 'open' }],
    },
    // open_ncrs + open_major_ncrs. `[DR2-B2]`: one open major NCR necessarily
    // emits both, which is why AT-119 is set membership and not isolation.
    {
      lotNumber: 'L05-ncr-major',
      items: [complete],
      completions: [{ itemKey: 'a', status: 'completed' }],
      ncrs: [{ severity: 'major', status: 'open' }],
    },
    // na_hold_point_not_released + unreleased_hold_points.
    {
      lotNumber: 'L06-na-hp',
      items: [holdPointItem],
      completions: [{ itemKey: 'h', status: 'not_applicable' }],
      holdPoints: [{ itemKey: 'h', status: 'pending' }],
    },
    // unreleased_hold_points alone — the sign-off item is genuinely completed.
    {
      lotNumber: 'L07-hp-pending',
      items: [holdPointItem],
      completions: [{ itemKey: 'h', status: 'completed' }],
      holdPoints: [{ itemKey: 'h', status: 'pending' }],
    },
    // insufficient_test_count — 1 of the pack's 6, ITP complete, test satisfied.
    {
      lotNumber: 'L08-insufficient',
      activitySlug: 'earthworks_general',
      items: [testPoint],
      completions: [{ itemKey: 't', status: 'completed' }],
      verifiedTests: 1,
    },
    // Ready: conformed, complete, nothing outstanding.
    {
      lotNumber: 'L09-conformed-clean',
      status: 'conformed',
      items: [complete],
      completions: [{ itemKey: 'a', status: 'completed' }],
    },
  ];
  for (const spec of specs) {
    await seedLot(spec);
  }

  // A viewer: project read access, no commercial access — AT-134.
  const viewer = await registerTestUser(app, {
    emailPrefix: 'co-viewer',
    fullName: 'Closeout Viewer',
    companyId,
    roleInCompany: 'member',
  });
  viewerToken = viewer.token;
  await prisma.projectUser.create({
    data: { projectId, userId: viewer.userId, role: 'viewer', status: 'active' },
  });

  // AT-132: an internal user of ANOTHER company, plus this company's own
  // subcontractor-portal user — §9 gives subcontractors no handover surface.
  const otherCompany = await prisma.company.create({ data: { name: `Other ${tag}` } });
  const outsider = await registerTestUser(app, {
    emailPrefix: 'co-outsider',
    fullName: 'Closeout Outsider',
    companyId: otherCompany.id,
    roleInCompany: 'owner',
  });
  outsiderToken = outsider.token;
  const otherProject = await prisma.project.create({
    data: {
      name: `Other Project ${tag}`,
      projectNumber: `${tag}-P2`,
      companyId: otherCompany.id,
      state: 'VIC',
      specificationSet: 'VicRoads',
    },
  });
  otherProjectId = otherProject.id;
  await prisma.projectUser.create({
    data: { projectId: otherProjectId, userId: outsider.userId, role: 'owner', status: 'active' },
  });

  const subbieCompany = await prisma.company.create({ data: { name: `Subbie ${tag}` } });
  const subbie = await registerTestUser(app, {
    emailPrefix: 'co-subbie',
    fullName: 'Closeout Subbie',
    companyId: subbieCompany.id,
    roleInCompany: 'subcontractor',
  });
  subbieToken = subbie.token;
  await prisma.projectUser.create({
    data: { projectId, userId: subbie.userId, role: 'subcontractor', status: 'active' },
  });
}, 180_000);

afterAll(async () => {
  // Filtered: a failure inside `beforeAll` leaves the later ids undefined, and
  // an undefined inside a Prisma `in` throws over the top of the real error.
  const projectIds = [projectId, otherProjectId].filter(Boolean);
  await prisma.testResult.deleteMany({ where: { projectId: { in: projectIds } } });
  await prisma.holdPoint.deleteMany({ where: { lot: { projectId: { in: projectIds } } } });
  await prisma.nCRLot.deleteMany({ where: { lot: { projectId: { in: projectIds } } } });
  await prisma.nCR.deleteMany({ where: { projectId: { in: projectIds } } });
  await prisma.iTPInstance.deleteMany({ where: { lot: { projectId: { in: projectIds } } } });
  await prisma.lot.deleteMany({ where: { projectId: { in: projectIds } } });
  await prisma.iTPTemplate.deleteMany({ where: { projectId: { in: projectIds } } });
  await prisma.projectArea.deleteMany({ where: { projectId: { in: projectIds } } });
  await prisma.projectUser.deleteMany({ where: { projectId: { in: projectIds } } });
  await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
  await prisma.user.deleteMany({ where: { company: { name: { contains: tag } } } });
  await prisma.company.deleteMany({ where: { name: { contains: tag } } });
});

async function fetchCloseout(query = '', authToken = token): Promise<CloseoutReadinessResponse> {
  const res = await request(app)
    .get(`/api/projects/${projectId}/closeout-readiness${query}`)
    .set('Authorization', `Bearer ${authToken}`);
  expect(res.status).toBe(200);
  return res.body as CloseoutReadinessResponse;
}

/** The lot page's own emitted blocker codes, narrowed to the registry. */
async function lotPageHandoverCodes(id: string): Promise<string[]> {
  const res = await request(app)
    .get(`/api/lots/${id}/readiness`)
    .set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);
  const readiness = res.body.readiness;
  const blockers: { code: string }[] = [
    ...readiness.conformance.blockers,
    ...readiness.claim.blockers,
  ];
  const registry: readonly string[] = HANDOVER_BLOCKING_REASON_CODES;
  return [...new Set(blockers.map((b) => b.code))].filter((code) => registry.includes(code));
}

describe('AT-119 — set parity with the lot page, over every registered code [DH-B5]', () => {
  it('every registered handover code is provoked by the fixture, and none is left over', async () => {
    const body = await fetchCloseout();
    const emitted = new Set(
      body.verdicts.filter((v) => v.subjectType === 'lot').flatMap((v) => v.reasonCodes),
    );

    // Exhaustive: the parity assertion below is only worth anything if every
    // code in the registry is actually exercised by a fixture lot.
    expect([...emitted].sort()).toEqual([...HANDOVER_BLOCKING_REASON_CODES].sort());
  });

  it("each lot's closeout codes equal its lot-page codes, modulo one declared divergence", async () => {
    const body = await fetchCloseout();
    const lotVerdicts = body.verdicts.filter((v) => v.subjectType === 'lot');
    expect(lotVerdicts).toHaveLength(9);

    const divergences = new Set<string>();
    for (const verdict of lotVerdicts) {
      const pageCodes = await lotPageHandoverCodes(verdict.subjectId);
      for (const code of verdict.reasonCodes) {
        if (!pageCodes.includes(code)) divergences.add(code);
      }

      // The lot page can never emit `open_major_ncrs` (its only shipped emitter
      // is claimReview, which needs a whole claim), so parity is asserted with
      // that ONE code named — never with a wildcard.
      const expected = new Set(pageCodes);
      const lotNumber = [...lotIdByNumber].find(([, id]) => id === verdict.subjectId)![0];
      if (MAJOR_NCR_LOTS.has(lotNumber)) expected.add('open_major_ncrs');

      expect([...verdict.reasonCodes].sort()).toEqual([...expected].sort());
      // And nothing the lot page calls a blocker is silently dropped.
      expect(pageCodes.filter((code) => !verdict.reasonCodes.includes(code as never))).toEqual([]);
    }

    // PROOF OF CATCH: a second divergence appearing fails here, named.
    expect([...divergences]).toEqual(['open_major_ncrs']);
  }, 60_000);

  it('the project rollup is the union of its lots, and is not ready while any lot is not', async () => {
    const body = await fetchCloseout();
    const lotVerdicts = body.verdicts.filter((v) => v.subjectType === 'lot');
    const rollups = body.verdicts.filter((v) => v.subjectType === 'project');

    expect(rollups).toHaveLength(1);
    expect(rollups[0].subjectId).toBe(projectId);
    expect([...rollups[0].reasonCodes].sort()).toEqual(
      [...new Set(lotVerdicts.flatMap((v) => v.reasonCodes))].sort(),
    );
    expect(rollups[0].ready).toBe(false);
    expect(lotVerdicts.find((v) => v.subjectId === lotId('L09-conformed-clean'))).toEqual({
      subjectType: 'lot',
      subjectId: lotId('L09-conformed-clean'),
      ready: true,
      reasonCodes: [],
    });
  });
});

describe('AT-120 — nothing is stored [DH-B4]', () => {
  it('the route module contains no write call at all', () => {
    const source = readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), 'projectCloseoutReadiness.ts'),
      'utf8',
    );
    for (const write of ['.create(', '.createMany(', '.update(', '.updateMany(', '.upsert(']) {
      expect(source).not.toContain(write);
    }
  });

  it('a blocker clearing is reflected on the next read, with no invalidation step', async () => {
    const target = lotId('L04-ncr-minor');
    const before = await fetchCloseout();
    expect(before.verdicts.find((v) => v.subjectId === target)!.reasonCodes).toContain('open_ncrs');

    // Two consecutive reads of unchanged data are identical — there is no
    // generated-at or verdict id to make them differ.
    expect(await fetchCloseout()).toEqual(before);

    await prisma.nCR.updateMany({
      where: { ncrLots: { some: { lotId: target } } },
      data: { status: 'closed' },
    });
    try {
      const after = await fetchCloseout();
      const verdict = after.verdicts.find((v) => v.subjectId === target)!;
      expect(verdict.reasonCodes).not.toContain('open_ncrs');
      expect(verdict.reasonCodes).toEqual(['not_conformed']);
    } finally {
      await prisma.nCR.updateMany({
        where: { ncrLots: { some: { lotId: target } } },
        data: { status: 'open' },
      });
    }
  });
});

describe('AT-132 — tenancy', () => {
  it('refuses a cross-tenant project, an unknown project and every subcontractor role', async () => {
    for (const [label, authToken] of [
      ['outsider', outsiderToken],
      ['subcontractor', subbieToken],
    ] as const) {
      const res = await request(app)
        .get(`/api/projects/${projectId}/closeout-readiness`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status, label).toBe(403);
    }

    const other = await request(app)
      .get(`/api/projects/${otherProjectId}/closeout-readiness`)
      .set('Authorization', `Bearer ${token}`);
    expect(other.status).toBe(403);

    const anonymous = await request(app).get(`/api/projects/${projectId}/closeout-readiness`);
    expect(anonymous.status).toBe(401);
  });

  it('an areaId from another project is not found, not silently ignored', async () => {
    const foreignArea = await prisma.projectArea.create({
      data: { projectId: otherProjectId, name: `Foreign ${tag}`, chainageStart: 0, chainageEnd: 1 },
    });
    const res = await request(app)
      .get(`/api/projects/${projectId}/closeout-readiness?areaId=${foreignArea.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('AT-134 — commercial redaction [DH-B7]', () => {
  it('a non-commercial role sees the same verdicts, and no budget-area code exists to leak', async () => {
    const asOwner = await fetchCloseout();
    const asViewer = await fetchCloseout('', viewerToken);
    expect(asViewer).toEqual(asOwner);

    // Structural, not a filter someone can forget: the registry carries no
    // `area: 'budget'` code at all (§4.2 / `[DR-A1]`).
    const all = asOwner.verdicts.flatMap((v) => v.reasonCodes);
    expect(all).not.toContain('missing_budget');
    expect(all).not.toContain('already_claimed');
    expect([...HANDOVER_BLOCKING_REASON_CODES]).not.toContain('missing_budget');
  });
});

describe('AT-139 — filters disclose what they cannot place', () => {
  it('areaId returns only chainage-overlapping lots and counts the unplaced', async () => {
    const body = await fetchCloseout(`?areaId=${areaId}`);
    const lots = body.verdicts.filter((v) => v.subjectType === 'lot');

    // 0–150 overlaps L01 (0–100) and not L02 (200–300).
    expect(lots.map((v) => v.subjectId)).toEqual([lotId('L01-no-itp')]);
    // The seven lots with no chainage are reported, never dropped in silence.
    expect(body.unplacedLots).toBe(7);
    expect(body.unclassifiedLots).toBe(0);
  });

  it('activitySlug returns only classified lots and counts the unclassified', async () => {
    const body = await fetchCloseout('?activitySlug=earthworks_general');
    const lots = body.verdicts.filter((v) => v.subjectType === 'lot');

    expect(lots.map((v) => v.subjectId)).toEqual([lotId('L08-insufficient')]);
    expect(lots[0].reasonCodes).toContain('insufficient_test_count');
    expect(body.unclassifiedLots).toBe(8);
    expect(body.unplacedLots).toBe(0);
  });

  it('an area with no chainage window is refused rather than treated as everything', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/closeout-readiness?areaId=${emptyAreaId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe(
      'This area has no chainage window, so it cannot select lots.',
    );
  });
});
