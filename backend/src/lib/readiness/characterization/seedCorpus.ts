import { prisma } from '../../prisma.js';

// Characterization corpus seeder (F0.1). Builds a fixed set of fixture lots in
// the LOCAL test database that spans the readiness permutation space, so the
// two live endpoints (GET /lots/:id/readiness and /claim-readiness) can be
// snapshotted. The snapshots are the F0.2 gate: the re-expressed engine must
// reproduce them byte-identically.
//
// DB-backed — runs only against the local disposable test DB (databaseSafety.ts
// enforces). Never point at Railway.

// A fixed override timestamp so the "force-conformed on <date>" detail string in
// the readiness output is deterministic across runs.
export const FIXED_OVERRIDE_AT = new Date('2026-01-15T00:00:00.000Z');

interface ItemSpec {
  key: string;
  pointType?: string;
  evidenceRequired?: string;
  testType?: string;
}
interface CompletionSpec {
  itemKey: string;
  status: string;
  verificationStatus?: string;
}
interface TestSpec {
  itemKey?: string;
  testType: string;
  passFail: string;
  status: string;
}
interface NcrSpec {
  severity: string;
  category: string;
  status: string;
}
interface HoldPointSpec {
  itemKey: string;
  status: string;
}
interface LotSpec {
  lotNumber: string;
  status: string;
  budgetAmount?: number | null;
  conformedAt?: Date | null;
  conformanceOverriddenAt?: Date | null;
  itp?: { items: ItemSpec[]; completions: CompletionSpec[] } | null;
  tests?: TestSpec[];
  ncrs?: NcrSpec[];
  holdPoints?: HoldPointSpec[];
}

const std = (key: string): ItemSpec => ({ key, pointType: 'standard' });
const testPoint = (key: string): ItemSpec => ({
  key,
  pointType: 'standard',
  evidenceRequired: 'test',
  testType: 'compaction',
});
const hpPoint = (key: string): ItemSpec => ({ key, pointType: 'hold_point' });

// The corpus. lotNumbers are descriptive AND lexicographically ordered so the
// claim-readiness list (orderBy lotNumber asc) is deterministic.
export const CORPUS: LotSpec[] = [
  { lotNumber: 'L01-no-itp', status: 'not_started', itp: null },
  {
    lotNumber: 'L02-itp-unstarted',
    status: 'not_started',
    itp: { items: [std('a'), std('b')], completions: [] },
  },
  {
    lotNumber: 'L03-itp-partial',
    status: 'in_progress',
    itp: { items: [std('a'), std('b')], completions: [{ itemKey: 'a', status: 'completed' }] },
  },
  {
    lotNumber: 'L04-itp-complete-notest',
    status: 'completed',
    itp: { items: [std('a')], completions: [{ itemKey: 'a', status: 'completed' }] },
  },
  {
    lotNumber: 'L05-test-required-none',
    status: 'awaiting_test',
    itp: { items: [testPoint('t')], completions: [{ itemKey: 't', status: 'completed' }] },
  },
  {
    lotNumber: 'L06-test-pending',
    status: 'awaiting_test',
    itp: { items: [testPoint('t')], completions: [{ itemKey: 't', status: 'completed' }] },
    tests: [{ itemKey: 't', testType: 'compaction', passFail: 'pending', status: 'requested' }],
  },
  {
    lotNumber: 'L07-test-failed',
    status: 'awaiting_test',
    itp: { items: [testPoint('t')], completions: [{ itemKey: 't', status: 'completed' }] },
    tests: [{ itemKey: 't', testType: 'compaction', passFail: 'fail', status: 'entered' }],
  },
  {
    lotNumber: 'L08-test-passing-unverified',
    status: 'awaiting_test',
    itp: { items: [testPoint('t')], completions: [{ itemKey: 't', status: 'completed' }] },
    tests: [{ itemKey: 't', testType: 'compaction', passFail: 'pass', status: 'entered' }],
  },
  {
    lotNumber: 'L09-test-passing-verified',
    status: 'completed',
    itp: { items: [testPoint('t')], completions: [{ itemKey: 't', status: 'completed' }] },
    tests: [{ itemKey: 't', testType: 'compaction', passFail: 'pass', status: 'verified' }],
  },
  {
    lotNumber: 'L10-ncr-minor-open',
    status: 'ncr_raised',
    itp: { items: [std('a')], completions: [{ itemKey: 'a', status: 'completed' }] },
    ncrs: [{ severity: 'minor', category: 'workmanship', status: 'open' }],
  },
  {
    lotNumber: 'L11-ncr-major-open',
    status: 'ncr_raised',
    itp: { items: [std('a')], completions: [{ itemKey: 'a', status: 'completed' }] },
    ncrs: [{ severity: 'major', category: 'major', status: 'open' }],
  },
  {
    lotNumber: 'L12-hp-pending',
    status: 'hold_point',
    itp: { items: [hpPoint('h')], completions: [{ itemKey: 'h', status: 'completed' }] },
    holdPoints: [{ itemKey: 'h', status: 'pending' }],
  },
  {
    lotNumber: 'L13-hp-released',
    status: 'hold_point',
    itp: { items: [hpPoint('h')], completions: [{ itemKey: 'h', status: 'completed' }] },
    holdPoints: [{ itemKey: 'h', status: 'released' }],
  },
  {
    lotNumber: 'L14-hp-completed',
    status: 'hold_point',
    itp: { items: [hpPoint('h')], completions: [{ itemKey: 'h', status: 'completed' }] },
    holdPoints: [{ itemKey: 'h', status: 'completed' }],
  },
  {
    lotNumber: 'L15-hp-na-bypass',
    status: 'hold_point',
    itp: { items: [hpPoint('h')], completions: [{ itemKey: 'h', status: 'not_applicable' }] },
    holdPoints: [{ itemKey: 'h', status: 'pending' }],
  },
  {
    lotNumber: 'L16-conformed',
    status: 'conformed',
    budgetAmount: 5000,
    conformedAt: FIXED_OVERRIDE_AT,
    itp: { items: [testPoint('t')], completions: [{ itemKey: 't', status: 'completed' }] },
    tests: [{ itemKey: 't', testType: 'compaction', passFail: 'pass', status: 'verified' }],
  },
  {
    lotNumber: 'L17-conformed-override',
    status: 'conformed',
    budgetAmount: 5000,
    conformedAt: FIXED_OVERRIDE_AT,
    conformanceOverriddenAt: FIXED_OVERRIDE_AT,
    itp: {
      items: [std('a'), std('b')],
      completions: [{ itemKey: 'a', status: 'completed' }],
    },
  },
  {
    lotNumber: 'L18-conformed-regressed',
    status: 'conformed',
    budgetAmount: 5000,
    conformedAt: FIXED_OVERRIDE_AT,
    itp: { items: [std('a')], completions: [{ itemKey: 'a', status: 'completed' }] },
    ncrs: [{ severity: 'major', category: 'major', status: 'open' }],
  },
  { lotNumber: 'L19-claimed', status: 'claimed', budgetAmount: 5000 },
  {
    lotNumber: 'L20-conformed-no-budget',
    status: 'conformed',
    budgetAmount: null,
    conformedAt: FIXED_OVERRIDE_AT,
    itp: { items: [std('a')], completions: [{ itemKey: 'a', status: 'completed' }] },
  },
];

export interface SeededCorpus {
  projectId: string;
  companyId: string;
  userId: string;
  lots: Array<{ lotNumber: string; id: string }>;
}

// Create the lot's ITP (template + items + instance + completions) and return a
// key→checklistItemId map so tests/hold-points/NCRs can reference the items.
async function seedLotItp(
  projectId: string,
  lotId: string,
  lotNumber: string,
  itp: NonNullable<LotSpec['itp']>,
): Promise<Map<string, string>> {
  const itemIdByKey = new Map<string, string>();
  const template = await prisma.iTPTemplate.create({
    data: { projectId, name: `Tpl ${lotNumber}`, activityType: 'Earthworks' },
  });
  let seq = 1;
  for (const itemSpec of itp.items) {
    const created = await prisma.iTPChecklistItem.create({
      data: {
        templateId: template.id,
        sequenceNumber: seq++,
        description: `Item ${itemSpec.key}`,
        pointType: itemSpec.pointType ?? 'standard',
        responsibleParty: 'contractor',
        evidenceRequired: itemSpec.evidenceRequired ?? 'none',
        testType: itemSpec.testType ?? null,
      },
    });
    itemIdByKey.set(itemSpec.key, created.id);
  }

  const instance = await prisma.iTPInstance.create({
    data: { lotId, templateId: template.id, status: 'in_progress' },
  });
  for (const completion of itp.completions) {
    const checklistItemId = itemIdByKey.get(completion.itemKey);
    if (!checklistItemId) continue;
    await prisma.iTPCompletion.create({
      data: {
        itpInstanceId: instance.id,
        checklistItemId,
        status: completion.status,
        verificationStatus: completion.verificationStatus ?? 'none',
      },
    });
  }
  return itemIdByKey;
}

async function seedLotEvidence(
  projectId: string,
  lotId: string,
  userId: string,
  spec: LotSpec,
  itemIdByKey: Map<string, string>,
): Promise<void> {
  for (const test of spec.tests ?? []) {
    await prisma.testResult.create({
      data: {
        projectId,
        lotId,
        itpChecklistItemId: test.itemKey ? (itemIdByKey.get(test.itemKey) ?? null) : null,
        testType: test.testType,
        passFail: test.passFail,
        status: test.status,
      },
    });
  }
  for (const [i, ncrSpec] of (spec.ncrs ?? []).entries()) {
    const ncr = await prisma.nCR.create({
      data: {
        projectId,
        ncrNumber: `${spec.lotNumber}-NCR-${i + 1}`,
        description: `Fixture NCR ${i + 1}`,
        category: ncrSpec.category,
        severity: ncrSpec.severity,
        status: ncrSpec.status,
        raisedById: userId,
      },
    });
    await prisma.nCRLot.create({ data: { ncrId: ncr.id, lotId } });
  }
  for (const hp of spec.holdPoints ?? []) {
    const checklistItemId = itemIdByKey.get(hp.itemKey);
    if (!checklistItemId) continue;
    await prisma.holdPoint.create({
      data: {
        lotId,
        itpChecklistItemId: checklistItemId,
        pointType: 'hold_point',
        status: hp.status,
      },
    });
  }
}

async function seedLot(
  projectId: string,
  userId: string,
  spec: LotSpec,
): Promise<{ lotNumber: string; id: string }> {
  const lot = await prisma.lot.create({
    data: {
      projectId,
      lotNumber: spec.lotNumber,
      lotType: 'roadworks',
      description: `Fixture ${spec.lotNumber}`,
      status: spec.status,
      activityType: 'Earthworks',
      budgetAmount: spec.budgetAmount ?? null,
      conformedAt: spec.conformedAt ?? null,
      conformedById: spec.conformedAt ? userId : null,
      conformanceOverriddenAt: spec.conformanceOverriddenAt ?? null,
      conformanceOverriddenById: spec.conformanceOverriddenAt ? userId : null,
      conformanceOverrideReason: spec.conformanceOverriddenAt ? 'Fixture override' : null,
    },
  });
  const itemIdByKey = spec.itp
    ? await seedLotItp(projectId, lot.id, spec.lotNumber, spec.itp)
    : new Map<string, string>();
  await seedLotEvidence(projectId, lot.id, userId, spec, itemIdByKey);
  return { lotNumber: spec.lotNumber, id: lot.id };
}

export async function seedCorpus(options: {
  projectId: string;
  companyId: string;
  userId: string;
}): Promise<SeededCorpus['lots']> {
  const seeded: SeededCorpus['lots'] = [];
  for (const spec of CORPUS) {
    seeded.push(await seedLot(options.projectId, options.userId, spec));
  }
  return seeded;
}
