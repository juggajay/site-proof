import { prisma } from '../../prisma.js';
import { activitySlugForWrite } from '../../activityTaxonomy.js';

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
const testPoint = (key: string, testType = 'compaction'): ItemSpec => ({
  key,
  pointType: 'standard',
  evidenceRequired: 'test',
  testType,
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

// ---------------------------------------------------------------------------
// Wave F1.1 — the REAL-VOCABULARY corpus [F1C-B7].
//
// Every lot in CORPUS above writes the literal `'compaction'` — the IDENTITY
// case for the F1 alias registry. A corpus made entirely of identity cases
// regenerates byte-identically when F1.2 switches the engine to categories, so
// the characterization diff would prove nothing. These lots carry the strings
// the product ACTUALLY writes (§5.1): the Create Test modal's `Density Ratio`,
// the sample project's `density_ratio`, and the shipped VicRoads earthworks ITP
// item type. Under F1.1 they all count ZERO — the corpus records today's wrong
// numbers deliberately, so F1.2's diff IS the behaviour change.
//
// They live on a SEPARATE VIC/`vicroads` project, because only a project whose
// pack resolves can exercise a rule at all. The main corpus project is
// NSW/TfNSW and resolves NO ruleset (see the note in `seedLot`), and changing
// that is out of scope.
//
// Shipped strings, cited:
//   `AS 1289.5.4.1 or AS 1289.5.7.1, RC 316.00` — seed-itp-templates-vic-earthworks.js:206
//   `AS 1289.5.4.1, RC 316.00, RC 316.10`       — seed-itp-templates-vic-earthworks.js:242
//   `Density Ratio` / `MDD Standard`            — CreateTestModal.tsx:261 / :265
//   `density_ratio`                             — prod (18 rows), sampleProjectData.ts:80,217,229
const VIC_ITEM_TYPE = 'AS 1289.5.4.1 or AS 1289.5.7.1, RC 316.00';
const VIC_MDD_ITEM_TYPE = 'AS 1289.5.4.1, RC 316.00, RC 316.10';

const verifiedTests = (n: number, testType: string, itemKey?: string): TestSpec[] =>
  Array.from({ length: n }, () => ({ itemKey, testType, passFail: 'pass', status: 'verified' }));

export const VIC_CORPUS: LotSpec[] = [
  {
    // Six modal-vocabulary tests, UNLINKED, against the shipped VIC item type.
    // F1.1: 0 of 6, `insufficient`, six ids in `unlinkedPassingTestIds`.
    // F1.2: 6 of 6, `satisfied` — the review's acceptance-gate item 2.
    lotNumber: 'V01-vic-density-ratio-unlinked',
    status: 'completed',
    itp: {
      items: [testPoint('t', VIC_ITEM_TYPE)],
      completions: [{ itemKey: 't', status: 'completed' }],
    },
    tests: verifiedTests(6, 'Density Ratio'),
  },
  {
    // The same six, LINKED to the item, in the snake_case vocabulary the sample
    // project and 18 production rows use.
    lotNumber: 'V02-vic-density-ratio-linked',
    status: 'completed',
    itp: {
      items: [testPoint('t', VIC_ITEM_TYPE)],
      completions: [{ itemKey: 't', status: 'completed' }],
    },
    tests: verifiedTests(6, 'density_ratio', 't'),
  },
  {
    // §5.3 / AT-57. Six LABORATORY MDD tests, each LINKED to a shipped
    // compaction item. This lot must read 0 of 6 BEFORE AND AFTER F1.2 — it is
    // the lot whose absence of movement proves the lab-reference exclusion is
    // enforced on the item limb and not merely absent from the alias table.
    lotNumber: 'V03-vic-mdd-standard-linked',
    status: 'completed',
    itp: {
      items: [testPoint('t', VIC_MDD_ITEM_TYPE)],
      completions: [{ itemKey: 't', status: 'completed' }],
    },
    tests: verifiedTests(6, 'MDD Standard', 't'),
  },
  {
    // Five of six: the shortfall arithmetic on real vocabulary. F1.1: 0 of 6.
    // F1.2: 5 of 6, still `insufficient`.
    lotNumber: 'V04-vic-density-ratio-five',
    status: 'completed',
    itp: {
      items: [testPoint('t', VIC_ITEM_TYPE)],
      completions: [{ itemKey: 't', status: 'completed' }],
    },
    tests: verifiedTests(5, 'Density Ratio'),
  },
  {
    // The IDENTITY control: legacy `compaction` on both sides (25 production
    // rows are in this vocabulary). It reads 6 of 6 today and must read 6 of 6
    // after — any movement here is a bug, not an expected change.
    lotNumber: 'V05-vic-legacy-compaction',
    status: 'completed',
    itp: { items: [testPoint('t')], completions: [{ itemKey: 't', status: 'completed' }] },
    tests: verifiedTests(6, 'compaction', 't'),
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
      // Wave C1: the fixture writes the folded slug exactly as every production
      // write path does (`activitySlugForWrite`), so the corpus pins the
      // CLASSIFIED-lot branch rather than a lot that looks unclassified.
      //
      // D14.3: the main corpus project (NSW/TfNSW) now resolves the CONFIRMED
      // `tfnsw-q6.v1`, which replaced the deleted `tfnsw-r44.v1`. These lots
      // therefore carry a matching earthworks rule and read `unknown` /
      // `scale_not_selected` — Q6 declares no `defaultScale` and the corpus
      // records no band — which surfaces as ONE advisory, non-blocking warning
      // per lot in the committed snapshot. Lots exercising a SATISFIED or
      // INSUFFICIENT verdict still live on the VIC/`vicroads` project
      // (VIC_CORPUS), which has a default scale and real counts.
      activitySlug: activitySlugForWrite('Earthworks'),
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
  /** VIC/`vicroads` project for {@link VIC_CORPUS} — the lots that resolve a pack (F1.1). */
  vicProjectId: string;
}): Promise<SeededCorpus['lots']> {
  const seeded: SeededCorpus['lots'] = [];
  for (const spec of CORPUS) {
    seeded.push(await seedLot(options.projectId, options.userId, spec));
  }
  for (const spec of VIC_CORPUS) {
    seeded.push(await seedLot(options.vicProjectId, options.userId, spec));
  }
  return seeded;
}
