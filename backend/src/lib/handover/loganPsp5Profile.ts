// Wave D `D1b.0` — `LoganPsp5RequirementProfile` and its per-item resolvers
// (spec `docs/plans/wave-d-handover-spec-2026-07-28.md` Rev 3, §2.2, §2.3,
// §4.3.2, `[DR2-B1]`). **AT-144**, **AT-145**.
//
// WHY IT EXISTS. Rev 2 scored the Logan pack "four fed, one partial, two gaps"
// over a PROSE TABLE, and three of the cells it counted as fed said *partial*,
// *no crosswalk exists* or *nothing can be uploaded* in their own text. A folio
// cannot read a markdown table, and a score nothing executes is a score nobody
// can be wrong about. This module is that table made executable: the coverage
// verdicts are data, the per-item verdicts are functions, and both are tested.
//
// THE HONESTY CONTRACT, which is the whole design (spec §0.2, `[DH-B1]`,
// `[DH-B8]`):
//   * An item CIVOS cannot feed SAYS SO. Items 1 and 6 are structurally
//     incapable of returning `present` — they are the consultant's certificate
//     and the surveyor's asset list, and neither is ours to produce.
//   * `not_assessable` is a first-class verdict and is NOT a synonym for
//     `missing`. "CIVOS cannot yet hold this file type" is our gap; "you did not
//     supply it" is the customer's. Printing the second when the first is true
//     is the worst thing a compilation document can do.
//   * No resolver decides that a PSP5 category is REQUIRED for a lot. CIVOS has
//     no evidence-backed mapping from a lot's work to the pack items that apply
//     to it, so completeness stays the certifying consultant's determination and
//     the folio says that out loud.
//
// PURE, in the shape `evidenceReadiness.ts` established: functions over
// passed-in inputs, no Prisma, no clock, no I/O. D1b builds the query and freezes
// the result into `FolioSnapshot.payload`; nothing here reaches a database.
//
// SCOPE. `D1b.0` is groundwork: no route, no renderer, no reservation row, no
// migration. The profile is code-resident data, versioned by `profileVersion` so
// a second authority (§4.9 D1e) is additive rather than a rewrite.

import {
  LAB_REFERENCE,
  resolveTestCategory,
  candidateCategories,
  type TestCategory,
} from '../readiness/sufficiency/testCategories.js';
import {
  LOGAN_18,
  LOGAN_18_CLAUSE,
  isAmbiguouslyAttributed,
  logan18EntriesForCategory,
  type Logan18Entry,
} from './loganPsp5Crosswalk.js';

export const LOGAN_PSP5_PROFILE_VERSION = 'logan-psp5.v1';

// ---------------------------------------------------------------------------
// The profile — §2.2's table, as data
// ---------------------------------------------------------------------------

/**
 * §2.2's re-scored verdict per pack item. The vocabulary is the spec's, verbatim,
 * so a reader can diff this file against §2.2 without translating.
 *
 * At `logan-psp5.v1` the distribution is **one `storage_only`, three `partial`,
 * two `gap_deliberate`, one `gap_closable`** — Rev 3's honest re-score of Rev 2's
 * false "four fed". Nothing here is `shipped`; the value exists because a later
 * profile version may earn it, not because anything holds it today.
 */
export type LoganPsp5Coverage =
  | 'shipped'
  | 'storage_only'
  | 'partial'
  | 'gap_deliberate'
  | 'gap_closable';

export type LoganPsp5ItemId =
  | 'inspection_testing_certificate'
  | 'test_results'
  | 'retest_rectification'
  | 'cctv_stormwater'
  | 'concealed_works_photos'
  | 'asset_list'
  | 'om_manuals';

export interface LoganPsp5RequirementItem {
  readonly number: number;
  readonly id: LoganPsp5ItemId;
  /**
   * The PSP5 clause. Only items 1 and 4 carry a sub-clause letter, because those
   * are the only two D.0 records one for. See `loganPsp5Crosswalk.ts`
   * `LOGAN_18_CLAUSE`.
   */
  readonly clause: string;
  /** The clause text. Quoted verbatim where D.0 quotes it; summarised otherwise, and marked. */
  readonly clauseText: string;
  /** True when `clauseText` is a verbatim quotation from the grade-A read. */
  readonly clauseTextVerbatim: boolean;
  readonly coverage: LoganPsp5Coverage;
  /** Why this coverage — the shipped feature that feeds it, or the reason nothing does. */
  readonly coverageNote: string;
}

/**
 * The seven mandatory pack items of Logan PSP5 §5.6.5, in clause order.
 *
 * Sourced from `docs/research/d0-adac-handover-research-2026-07-28.md:23` (grade
 * A — downloaded, text-extracted and read by the D.0 author) and re-scored by
 * spec §2.2 under `[DR2-B1]`.
 */
export const LOGAN_PSP5_ITEMS: readonly LoganPsp5RequirementItem[] = Object.freeze([
  {
    number: 1,
    id: 'inspection_testing_certificate',
    clause: '5.6.5(1)(a)',
    clauseText: 'an inspection and testing certificate signed by the consultant',
    clauseTextVerbatim: true,
    coverage: 'gap_deliberate',
    coverageNote:
      'Nothing, by design. The certificate is signed by the consulting engineer (RPEQ), ' +
      'who is also the submitting party. CIVOS compiles the evidence the consultant ' +
      'certifies OVER; it is the input to this item, never the item. Permanent.',
  },
  {
    number: 2,
    id: 'test_results',
    clause: LOGAN_18_CLAUSE,
    clauseText:
      'test results across 18 named categories (fill and trench compaction, sub-grade ' +
      'CBR and compaction, CBR 15 quality and compaction, sub-soil drain filter grading, ' +
      'bedding grading, base and sub-base course quality and compaction, prime/primer ' +
      'seal rates, AC core tests, concrete testing, sewer and water main pressure tests, ' +
      'water quality)',
    clauseTextVerbatim: true,
    coverage: 'partial',
    coverageNote:
      'Storing and verifying a test result is shipped (`TestResult`, C1 sufficiency, ' +
      "F1's canonical categoriser, verified-only counting since #1658). RESOLVING a " +
      'Logan category is partial: 11 of the 18 map to a canonical category and 7 do ' +
      'not (`loganPsp5Crosswalk.ts`), and six of the eleven share one undiscriminated ' +
      '`compaction` category.',
  },
  {
    number: 3,
    id: 'retest_rectification',
    clause: LOGAN_18_CLAUSE,
    clauseText: 'details of the retesting or rectification carried out where any test result fails',
    clauseTextVerbatim: true,
    coverage: 'partial',
    coverageNote:
      'The NCR limb is real: `NCR.linkedTestResultId` (schema.prisma:947), ' +
      '`rectificationNotes` / `rectificationSubmittedAt` (:960-961) and `NCREvidence` ' +
      '(:1035-1046). The NO-NCR path is the gap — there is no retest -> original-test ' +
      'link on `TestResult`, so a failed test followed by a passing retest with no NCR ' +
      'raised leaves the two rows unassociated. Closing it is a C2-family column.',
  },
  {
    number: 4,
    id: 'cctv_stormwater',
    clause: '5.6.5(1)(e)',
    clauseText: 'CCTV video for underground stormwater infrastructure work',
    clauseTextVerbatim: true,
    coverage: 'gap_closable',
    coverageNote:
      'The upload path rejects the deliverable twice: `ALLOWED_DOCUMENT_MIME_TYPES` ' +
      '(routes/documents/fileHelpers.ts:35-47) contains no video type, and multer caps ' +
      'document uploads at 50 MB (documents.ts) against a routinely GB-scale run. ' +
      'D1d owns the capability (spec §4.8, AT-149). Until then the verdict is ours, ' +
      "not the customer's.",
  },
  {
    number: 5,
    id: 'concealed_works_photos',
    clause: LOGAN_18_CLAUSE,
    clauseText:
      'date-stamped photographs of work that will not be visible after construction, ' +
      'taken prior to backfilling, with a chainage or exact location reference in the ' +
      'filename',
    clauseTextVerbatim: true,
    coverage: 'partial',
    coverageNote:
      'Date-stamp and location are shipped (`Document.captureTimestamp`, ' +
      '`gpsLatitude`/`gpsLongitude`, schema.prisma:1609-1611; photo pins; the chainage ' +
      'generator). NEITHER qualifying clause is: nothing records that a photo depicts ' +
      'work that will not be visible after construction, or that it was taken prior to ' +
      'backfilling. The `documentType` value is D1d (spec §4.8); the filename rule is ' +
      'D1c.2 (§4.7.3, AT-140).',
  },
  {
    number: 6,
    id: 'asset_list',
    clause: LOGAN_18_CLAUSE,
    clauseText: 'an asset list in editable spreadsheet format',
    clauseTextVerbatim: true,
    coverage: 'gap_deliberate',
    coverageNote:
      'Nothing, and deliberately not closed. The 78-model schema has no `Asset`, `Pit`, ' +
      '`Pipe`, `Manhole`, `Node` or `Conduit` model (spec §3.6). This is the surveyor ' +
      "and consultant's deliverable, produced from the same survey that produces the " +
      'XML. Building an asset register to fill it is the forbidden over-build (§11).',
  },
  {
    number: 7,
    id: 'om_manuals',
    clause: LOGAN_18_CLAUSE,
    clauseText: 'vendor operation and maintenance (O&M) manuals',
    clauseTextVerbatim: false,
    coverage: 'storage_only',
    coverageNote:
      'A PDF manual uploads and files correctly today under the existing MIME ' +
      'allowance. CIVOS stores and lists it; it does not assemble, index or validate ' +
      'it, and is explicitly not an O&M manual builder. The folio says "present, as ' +
      'supplied" and never implies review.',
  },
] as const satisfies readonly LoganPsp5RequirementItem[]);

// ---------------------------------------------------------------------------
// Resolver input — the evidence a folio snapshot carries, per lot
// ---------------------------------------------------------------------------

/** `TestResult.status === 'verified'` is the shipped verified predicate (`conformanceReportPdf.ts` `isVerifiedTest`). */
export const VERIFIED_TEST_STATUS = 'verified';

/**
 * `Document.documentType` values the resolvers key off.
 *
 * The first two DO NOT EXIST YET — D1d creates them (spec §4.8). They are named
 * here, once, so D1d writes the same strings the resolvers already read instead
 * of picking new ones and silently leaving these resolvers blind.
 */
export const CCTV_DOCUMENT_TYPE = 'cctv_stormwater';
export const CONCEALED_WORKS_DOCUMENT_TYPE = 'concealed_works_photo';
export const OM_MANUAL_DOCUMENT_TYPE = 'om_manual';

/**
 * Whether the shipped upload path can hold a CCTV video at all.
 *
 * `false` at this SHA, and it is a CONSTANT rather than a probe because
 * production code in `lib/` must not import from `routes/`. The premise is
 * asserted instead — `loganPsp5Profile.test.ts` calls the shipped
 * `isAllowedDocumentMimeType('video/mp4')` and fails when D1d widens the allow
 * set, which is what forces this line to flip in the same change.
 */
export const CCTV_UPLOAD_SUPPORTED = false;

export interface LoganPsp5TestInput {
  readonly id: string;
  /** `TestResult.testType` — free text (§2.3 of the F1 spec). */
  readonly testType: string | null;
  /** The linked ITP checklist item's `testType`, for F1's attribution rule. */
  readonly linkedItemTestType?: string | null;
  /** `TestResult.status`. Only {@link VERIFIED_TEST_STATUS} is counted. */
  readonly status: string;
  /** `TestResult.passFail`. */
  readonly passFail: string | null;
}

export interface LoganPsp5NcrInput {
  readonly id: string;
  readonly ncrNumber?: string | null;
  readonly linkedTestResultId: string | null;
  readonly rectificationNotes: string | null;
  readonly rectificationSubmittedAt: string | null;
  /** `NCREvidence` rows on this NCR. */
  readonly evidenceCount: number;
}

export interface LoganPsp5DocumentInput {
  readonly id: string;
  readonly documentType: string | null;
  readonly mimeType?: string | null;
  /** `Document.captureTimestamp` — the date-stamp limb of item 5. */
  readonly captureTimestamp: string | null;
}

export interface LoganPsp5ResolverInput {
  readonly lotId: string;
  readonly tests: readonly LoganPsp5TestInput[];
  readonly ncrs: readonly LoganPsp5NcrInput[];
  readonly documents: readonly LoganPsp5DocumentInput[];
}

// ---------------------------------------------------------------------------
// Resolver output
// ---------------------------------------------------------------------------

/**
 * §2.3's four verdicts.
 *
 * `not_applicable` — the item is not CIVOS's to produce (1, 6), or the condition
 *   it depends on did not occur (3, when nothing failed).
 * `not_assessable` — CIVOS cannot tell. Always carries the reason it cannot, and
 *   never implies the customer failed to supply anything.
 */
export type LoganPsp5ItemStatus = 'present' | 'missing' | 'not_applicable' | 'not_assessable';

export interface LoganPsp5ItemResult {
  readonly number: number;
  readonly id: LoganPsp5ItemId;
  readonly clause: string;
  readonly coverage: LoganPsp5Coverage;
  readonly status: LoganPsp5ItemStatus;
  /** Never empty. Every verdict states its reason — that is what makes the folio a compilation. */
  readonly reason: string;
  /** Ids of the rows that evidence a `present` verdict. */
  readonly evidenceIds: readonly string[];
  /**
   * The things this verdict NAMES: a missing category, an unresolvable test-type
   * string, an unlinked failed test. `[DH-B1]`'s "two missing, BY NAME".
   */
  readonly named: readonly string[];
}

export interface Logan18CategoryCoverage {
  readonly number: number;
  readonly id: string;
  readonly psp5Name: string;
  /**
   * `evidenced` — at least one verified test resolves to a canonical category
   *   this PSP5 category maps to. NOT "satisfied": see `attribution`.
   * `no_evidence` — mapped, but no verified test resolves to it.
   * `unmappable` — CIVOS has no canonical category for it at all. Never
   *   `no_evidence`, because absence of a mapping is not absence of a test.
   */
  readonly state: 'evidenced' | 'no_evidence' | 'unmappable';
  /**
   * `exact` — a matching test can only be evidence toward this category.
   * `ambiguous` — the canonical category is shared with other PSP5 categories
   *   (six compaction entries, two grading entries) and CIVOS cannot attribute a
   *   test to one of them.
   */
  readonly attribution: 'exact' | 'ambiguous' | 'unmappable';
  readonly reason?: string;
  readonly evidenceIds: readonly string[];
}

export interface Logan18Coverage {
  readonly categories: readonly Logan18CategoryCoverage[];
  /** Verified tests whose type string resolves to no canonical category. Named, never dropped. */
  readonly unresolvedTestTypes: readonly string[];
  /** Verified tests whose type names a laboratory reference determination, not a field test. */
  readonly labReferenceTestTypes: readonly string[];
  readonly verifiedTestCount: number;
}

export interface LoganPsp5ProfileResult {
  readonly profileVersion: string;
  readonly lotId: string;
  readonly items: readonly LoganPsp5ItemResult[];
  /** Item 2's detail, hoisted so the folio can print the per-category table. */
  readonly logan18: Logan18Coverage;
}

// ---------------------------------------------------------------------------
// The Logan-18 coverage pass (item 2's engine)
// ---------------------------------------------------------------------------

const isVerified = (test: LoganPsp5TestInput): boolean => test.status === VERIFIED_TEST_STATUS;

/**
 * Resolve a lot's verified tests against the crosswalk.
 *
 * Attribution routes through F1's shipped `candidateCategories` — the single
 * attribution rule (`[F1C-B1]`), not a second one. A test whose OWN type is a
 * laboratory reference never attributes, however it is linked.
 */
export function resolveLogan18Coverage(input: LoganPsp5ResolverInput): Logan18Coverage {
  const verified = input.tests.filter(isVerified);
  const evidenceByCategory = new Map<TestCategory, string[]>();
  const unresolved: string[] = [];
  const labReferences: string[] = [];

  for (const test of verified) {
    const own = resolveTestCategory(test.testType);
    const linked = resolveTestCategory(test.linkedItemTestType ?? null);
    const categories = candidateCategories(own, linked);
    if (categories.length === 0) {
      // A lab reference is KNOWN and deliberately not countable — it is not
      // "CIVOS cannot map this string", and conflating the two would name a
      // correctly-classified MDD as an unknown (`[F1C-B2]`).
      const bucket = own === LAB_REFERENCE ? labReferences : unresolved;
      bucket.push(test.testType ?? '');
      continue;
    }
    for (const category of categories) {
      const bucket = evidenceByCategory.get(category);
      if (bucket) bucket.push(test.id);
      else evidenceByCategory.set(category, [test.id]);
    }
  }

  const categories = LOGAN_18.map((entry) => describeCategory(entry, evidenceByCategory));

  return {
    categories,
    unresolvedTestTypes: [...new Set(unresolved)],
    labReferenceTestTypes: [...new Set(labReferences)],
    verifiedTestCount: verified.length,
  };
}

function describeCategory(
  entry: Logan18Entry,
  evidenceByCategory: ReadonlyMap<TestCategory, readonly string[]>,
): Logan18CategoryCoverage {
  if (entry.canonicalCategories.length === 0) {
    return {
      number: entry.number,
      id: entry.id,
      psp5Name: entry.psp5Name,
      state: 'unmappable',
      attribution: 'unmappable',
      reason: entry.unmappedReason,
      evidenceIds: [],
    };
  }
  const evidenceIds = [
    ...new Set(entry.canonicalCategories.flatMap((c) => evidenceByCategory.get(c) ?? [])),
  ];
  const ambiguous = isAmbiguouslyAttributed(entry);
  const sharedWith = new Set(
    entry.canonicalCategories.flatMap((c) => logan18EntriesForCategory(c)).map((e) => e.id),
  );
  return {
    number: entry.number,
    id: entry.id,
    psp5Name: entry.psp5Name,
    state: evidenceIds.length > 0 ? 'evidenced' : 'no_evidence',
    attribution: ambiguous ? 'ambiguous' : 'exact',
    reason: ambiguous
      ? `a matching test is evidence toward ${sharedWith.size} PSP5 categories and cannot ` +
        'be attributed to this one'
      : undefined,
    evidenceIds,
  };
}

// ---------------------------------------------------------------------------
// The seven per-item resolvers
// ---------------------------------------------------------------------------

type Resolver = (
  input: LoganPsp5ResolverInput,
  logan18: Logan18Coverage,
) => Omit<LoganPsp5ItemResult, 'number' | 'id' | 'clause' | 'coverage'>;

const documentsOfType = (
  input: LoganPsp5ResolverInput,
  documentType: string,
): readonly LoganPsp5DocumentInput[] =>
  input.documents.filter((document) => document.documentType === documentType);

/**
 * Item 1 — the consultant's certificate. A constant, and structurally incapable
 * of returning `present`: it takes no input at all.
 */
const resolveItem1: Resolver = () => ({
  status: 'not_applicable',
  reason:
    'Not produced by CIVOS. Logan PSP5 §5.6.5(1)(a) assigns this certificate to the ' +
    'consultant, who is also the submitting party. This folio is an input to that ' +
    'certificate and is not a certification.',
  evidenceIds: [],
  named: [],
});

/**
 * Item 2 — the 18 categories.
 *
 * NEVER RETURNS `missing` FOR A CATEGORY, and that is deliberate. CIVOS has no
 * evidence-backed mapping from a lot's work to the PSP5 categories that apply to
 * it, so "sub-grade CBR missing" on a stormwater lot would be a fabricated
 * requirement. Completeness is the consultant's determination and the reason
 * string says so on every verdict.
 *
 * `ponytail:` ceiling named rather than hidden — an applicability model (lot
 * activity -> required PSP5 categories) is the upgrade path, and it needs
 * grade-A evidence that does not exist today.
 */
const resolveItem2: Resolver = (_input, logan18) => {
  const evidenced = logan18.categories.filter((c) => c.state === 'evidenced');
  const evidenceIds = [...new Set(evidenced.flatMap((c) => c.evidenceIds))];
  const scope =
    'CIVOS does not determine which of the 18 categories this lot requires; ' +
    "completeness is the certifying consultant's determination.";

  if (logan18.verifiedTestCount === 0) {
    return {
      status: 'missing',
      reason: `No verified test result of any kind is held for this lot. ${scope}`,
      evidenceIds: [],
      named: ['no verified test result'],
    };
  }
  if (logan18.unresolvedTestTypes.length > 0) {
    return {
      status: 'not_assessable',
      reason:
        `${logan18.verifiedTestCount} verified result(s) held; ` +
        `${logan18.unresolvedTestTypes.length} test type(s) resolve to no canonical ` +
        `category, so the coverage picture is incomplete. ${scope}`,
      evidenceIds,
      named: [...logan18.unresolvedTestTypes],
    };
  }
  if (evidenced.length === 0) {
    return {
      status: 'not_assessable',
      reason:
        `${logan18.verifiedTestCount} verified result(s) held, none of which resolve to ` +
        `a category the Logan crosswalk maps. ${scope}`,
      evidenceIds: [],
      named: [],
    };
  }
  return {
    status: 'present',
    reason:
      `${logan18.verifiedTestCount} verified result(s) are evidence toward ` +
      `${evidenced.length} of the 18 PSP5 categories. ${scope}`,
    evidenceIds,
    named: [],
  };
};

/**
 * Item 3 — retest and rectification where a test fails.
 *
 * The §2.2 item-3 hole, printed rather than papered over: a failed verified test
 * with no linked NCR yields `not_assessable` naming the test, because there is no
 * retest -> original-test link on `TestResult` and CIVOS genuinely cannot tell
 * whether a rectification happened.
 */
const resolveItem3: Resolver = (input) => {
  const failed = input.tests.filter((t) => isVerified(t) && t.passFail === 'fail');
  if (failed.length === 0) {
    return {
      status: 'not_applicable',
      reason: 'No verified test result on this lot has failed, so no rectification is required.',
      evidenceIds: [],
      named: [],
    };
  }

  const ncrByTest = new Map<string, LoganPsp5NcrInput[]>();
  for (const ncr of input.ncrs) {
    if (!ncr.linkedTestResultId) continue;
    const bucket = ncrByTest.get(ncr.linkedTestResultId);
    if (bucket) bucket.push(ncr);
    else ncrByTest.set(ncr.linkedTestResultId, [ncr]);
  }

  const unlinked: string[] = [];
  const linkedWithoutDetail: string[] = [];
  const evidenceIds: string[] = [];

  for (const test of failed) {
    const ncrs = ncrByTest.get(test.id) ?? [];
    if (ncrs.length === 0) {
      unlinked.push(test.id);
      continue;
    }
    const detailed = ncrs.filter(
      (n) =>
        Boolean(n.rectificationNotes) || Boolean(n.rectificationSubmittedAt) || n.evidenceCount > 0,
    );
    if (detailed.length === 0) {
      linkedWithoutDetail.push(ncrs.map((n) => n.ncrNumber || n.id).join(', '));
      continue;
    }
    evidenceIds.push(...detailed.map((n) => n.id));
  }

  if (unlinked.length > 0) {
    return {
      status: 'not_assessable',
      reason:
        `${unlinked.length} of ${failed.length} failed verified test(s) have no linked NCR. ` +
        'CIVOS holds no retest -> original-test link, so it cannot tell whether a ' +
        'rectification was carried out: failed — rectification not linked.',
      evidenceIds: [...new Set(evidenceIds)],
      named: unlinked,
    };
  }
  if (linkedWithoutDetail.length > 0) {
    return {
      status: 'missing',
      reason:
        `Every failed verified test links to an NCR, but ${linkedWithoutDetail.length} ` +
        'carries no rectification note, no submission date and no evidence file.',
      evidenceIds: [...new Set(evidenceIds)],
      named: linkedWithoutDetail,
    };
  }
  return {
    status: 'present',
    reason:
      `All ${failed.length} failed verified test(s) link to an NCR carrying rectification ` +
      'detail.',
    evidenceIds: [...new Set(evidenceIds)],
    named: [],
  };
};

/**
 * Item 4 — CCTV. `not_assessable` unconditionally while
 * {@link CCTV_UPLOAD_SUPPORTED} is false, and the reason blames the right party.
 * Spec §2.3: "the folio says 'CIVOS cannot yet hold this file type', not
 * 'missing'. Blaming the customer for a gap we own is the worst thing this
 * document could do."
 */
const resolveItem4: Resolver = (input) => {
  if (!CCTV_UPLOAD_SUPPORTED) {
    return {
      status: 'not_assessable',
      reason:
        'CIVOS cannot yet hold this file type: no video MIME type is accepted on the ' +
        'document upload path, and a stormwater CCTV run exceeds the 50 MB upload ' +
        'ceiling. This is a CIVOS capability gap, not a missing deliverable.',
      evidenceIds: [],
      named: [],
    };
  }
  /* c8 ignore start -- unreachable until D1d flips CCTV_UPLOAD_SUPPORTED; AT-149 covers it there. */
  const held = documentsOfType(input, CCTV_DOCUMENT_TYPE);
  return held.length > 0
    ? {
        status: 'present',
        reason: `${held.length} CCTV file(s) held for this lot, as supplied.`,
        evidenceIds: held.map((d) => d.id),
        named: [],
      }
    : {
        status: 'not_assessable',
        reason:
          'No CCTV file is held. CIVOS cannot determine whether this lot contains ' +
          'underground stormwater infrastructure requiring one.',
        evidenceIds: [],
        named: [],
      };
  /* c8 ignore stop */
};

/**
 * Item 5 — concealed-works photographs.
 *
 * Two qualifying clauses PSP5 imposes and the schema cannot express (work not
 * visible after construction; taken prior to backfilling) collapse into one
 * `documentType` value D1d ships. Until then no photo can carry it, so a lot with
 * photos reads "photos present, none classified as concealed works" — never
 * "missing", which would assert the customer failed to photograph.
 */
const resolveItem5: Resolver = (input) => {
  const classified = documentsOfType(input, CONCEALED_WORKS_DOCUMENT_TYPE);
  const anyPhotos = input.documents.filter(
    (d) => d.documentType === 'photo' || d.documentType === 'image' || Boolean(d.captureTimestamp),
  );

  if (classified.length === 0) {
    return {
      status: 'not_assessable',
      reason:
        anyPhotos.length > 0
          ? `${anyPhotos.length} photograph(s) present, none classified as concealed works. ` +
            'CIVOS holds no field recording that a photo depicts work not visible after ' +
            'construction or was taken prior to backfilling.'
          : 'No photographs are held for this lot, and CIVOS cannot determine whether this ' +
            'lot contains work that will not be visible after construction.',
      evidenceIds: [],
      named: [],
    };
  }
  const undated = classified.filter((d) => !d.captureTimestamp);
  if (undated.length > 0) {
    return {
      status: 'missing',
      reason:
        `${undated.length} of ${classified.length} concealed-works photograph(s) carry no ` +
        'capture timestamp; PSP5 requires them date-stamped.',
      evidenceIds: classified.filter((d) => d.captureTimestamp).map((d) => d.id),
      named: undated.map((d) => d.id),
    };
  }
  return {
    status: 'present',
    reason:
      `${classified.length} date-stamped concealed-works photograph(s) held. The chainage ` +
      'reference required in the filename is applied when the archive is built.',
    evidenceIds: classified.map((d) => d.id),
    named: [],
  };
};

/** Item 6 — the asset list. A constant, like item 1, and never `present`. */
const resolveItem6: Resolver = () => ({
  status: 'not_applicable',
  reason:
    'Not produced by CIVOS. The editable asset list is the surveyor and consultant ' +
    'deliverable, produced from the same survey that produces the as-constructed data ' +
    'file. CIVOS holds no asset model and will not infer one.',
  evidenceIds: [],
  named: [],
});

/** Item 7 — vendor O&M manuals. `storage_only`: present as supplied, never reviewed. */
const resolveItem7: Resolver = (input) => {
  const held = documentsOfType(input, OM_MANUAL_DOCUMENT_TYPE);
  return held.length > 0
    ? {
        status: 'present',
        reason:
          `${held.length} vendor O&M manual(s) held, as supplied. CIVOS stores and lists ` +
          'them; it does not assemble, index or validate them.',
        evidenceIds: held.map((d) => d.id),
        named: [],
      }
    : {
        status: 'not_assessable',
        reason:
          'No vendor O&M manual is held, and CIVOS cannot determine whether this lot ' +
          'includes vendor-supplied equipment requiring one.',
        evidenceIds: [],
        named: [],
      };
};

/**
 * One resolver per item, exhaustive by type. Adding an item id without a resolver
 * is a compile error — the mapping cannot go stale the way §2.2's prose table did.
 */
const RESOLVERS: Readonly<Record<LoganPsp5ItemId, Resolver>> = Object.freeze({
  inspection_testing_certificate: resolveItem1,
  test_results: resolveItem2,
  retest_rectification: resolveItem3,
  cctv_stormwater: resolveItem4,
  concealed_works_photos: resolveItem5,
  asset_list: resolveItem6,
  om_manuals: resolveItem7,
});

/**
 * Resolve the whole profile for one lot. Deterministic: no clock, no I/O, no
 * randomness — the precondition `FolioSnapshot` immutability depends on.
 */
export function resolveLoganPsp5Profile(input: LoganPsp5ResolverInput): LoganPsp5ProfileResult {
  const logan18 = resolveLogan18Coverage(input);
  return {
    profileVersion: LOGAN_PSP5_PROFILE_VERSION,
    lotId: input.lotId,
    items: LOGAN_PSP5_ITEMS.map((item) => ({
      number: item.number,
      id: item.id,
      clause: item.clause,
      coverage: item.coverage,
      ...RESOLVERS[item.id](input, logan18),
    })),
    logan18,
  };
}
