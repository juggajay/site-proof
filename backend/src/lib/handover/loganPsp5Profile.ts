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
// SOURCE. **Grade A, primary, read verbatim** — `Logan Planning Scheme 2015 —
// Planning Scheme Policy 5 (Infrastructure), 2019 Amendment`, §5.6.5 "As
// constructed documentation", clause (1)(a)–(h) and clause (2). Every
// `clauseText` below is the clause's own wording, transcribed.
//
// `[LP5-DELTA]` THE PACK HAS EIGHT ITEMS, NOT SEVEN. Spec §2.2 tabulated seven
// and scored them "one shipped-as-storage, three partial, three gaps". Read
// against the source, §5.6.5(1) enumerates **(a) through (h)**, and the item the
// prose rendering dropped is **(b), "a certification of foundation conditions
// signed by the consultant where relevant"** — a third permanent, deliberate gap
// of exactly the same species as (a). This is recorded rather than quietly
// absorbed, because a score derived from a rendering of a clause is what
// `[DR2-B1]` was about, and the fix is to read the clause. §2.2 is regenerated
// from this file, which is the direction §2.3 asks for anyway.
//
// THE SCORE AT `logan-psp5.v1`, AFTER D1d. **Of EIGHT mandatory pack items,
// CIVOS ships TWO as storage (e, h), partially feeds THREE (c, d, f), and does
// not feed THREE (a, b, g) — all three deliberate and permanent.** D1b.0 shipped
// this file scoring (e) `gap_closable`; **D1d closed it** (§4.8, AT-149), which
// is the only coverage value this profile has ever changed. Nothing is closable
// any more, because the one closable gap was closed rather than re-described.
// `loganPsp5Profile.test.ts` pins the distribution, so this paragraph and the
// data below cannot drift apart silently.
//
// THE HONESTY CONTRACT, which is the whole design (spec §0.2, `[DH-B1]`,
// `[DH-B8]`):
//   * An item CIVOS cannot feed SAYS SO. Items (a), (b) and (g) are structurally
//     incapable of returning `present` — two consultant-signed certifications and
//     the surveyor's asset list, none of them ours to produce.
//   * `not_assessable` is a first-class verdict and is NOT a synonym for
//     `missing`. "CIVOS cannot yet hold this file type" is our gap; "you did not
//     supply it" is the customer's. Printing the second when the first is true
//     is the worst thing a compilation document can do.
//   * No resolver decides that a pack matter is REQUIRED for a lot. CIVOS has no
//     evidence-backed mapping from a lot's work to the matters that apply to it,
//     so completeness stays the certifying consultant's determination and the
//     folio says that out loud.
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
// The profile — the pack, as data
// ---------------------------------------------------------------------------

/**
 * §2.2's verdict vocabulary, verbatim, so a reader can diff this file against the
 * spec without translating.
 *
 * At `logan-psp5.v1`, after D1d, the distribution is **two `storage_only`, three
 * `partial`, three `gap_deliberate`, and NO `gap_closable`** — D1d moved (e) out
 * of `gap_closable` by shipping the capability. Nothing is `shipped`; that value
 * exists because a later profile version may earn it, not because anything holds
 * it today. `gap_closable` likewise stays in the vocabulary because a future pack
 * item may be closable, not because one is.
 */
export type LoganPsp5Coverage =
  | 'shipped'
  | 'storage_only'
  | 'partial'
  | 'gap_deliberate'
  | 'gap_closable';

export type LoganPsp5ItemId =
  | 'inspection_testing_certificate'
  | 'foundation_conditions_certification'
  | 'test_results'
  | 'retest_rectification'
  | 'cctv_stormwater'
  | 'asset_attribute_imagery'
  | 'asset_list'
  | 'om_manuals';

export interface LoganPsp5RequirementItem {
  /** The clause's own sub-clause letter, `a` … `h`. The citation, not a label. */
  readonly letter: string;
  readonly number: number;
  readonly id: LoganPsp5ItemId;
  /** Full clause reference, e.g. `5.6.5(1)(a)`. */
  readonly clause: string;
  /** The clause's own wording, transcribed. */
  readonly clauseText: string;
  readonly coverage: LoganPsp5Coverage;
  /** Why this coverage — the shipped feature that feeds it, or the reason nothing does. */
  readonly coverageNote: string;
}

const clauseOf = (letter: string): string => `5.6.5(1)(${letter})`;

/** The eight mandatory pack items of Logan PSP5 §5.6.5(1), in clause order. */
export const LOGAN_PSP5_ITEMS: readonly LoganPsp5RequirementItem[] = Object.freeze([
  {
    letter: 'a',
    number: 1,
    id: 'inspection_testing_certificate',
    clause: clauseOf('a'),
    clauseText: 'an inspection and testing certificate signed by the consultant',
    coverage: 'gap_deliberate',
    coverageNote:
      'Nothing, by design. The certificate is signed by the consulting engineer (RPEQ), ' +
      'who is also the submitting party. CIVOS compiles the evidence the consultant ' +
      'certifies OVER; the folio is the input to this item, never the item. Permanent.',
  },
  {
    letter: 'b',
    number: 2,
    id: 'foundation_conditions_certification',
    clause: clauseOf('b'),
    clauseText: 'a certification of foundation conditions signed by the consultant where relevant',
    coverage: 'gap_deliberate',
    coverageNote:
      'Nothing, by design, and MISSING FROM SPEC §2.2 ENTIRELY (`[LP5-DELTA]`). Same ' +
      'species as (a): consultant-signed, therefore never ours. CIVOS also holds no ' +
      'foundation-condition record from which relevance could be judged. Permanent.',
  },
  {
    letter: 'c',
    number: 3,
    id: 'test_results',
    clause: LOGAN_18_CLAUSE,
    clauseText:
      'copies of test results in respect of eighteen enumerated matters, (i) to (xviii) ' +
      '— transcribed individually in `loganPsp5Crosswalk.ts`',
    coverage: 'partial',
    coverageNote:
      'Storing and verifying a test result is shipped (`TestResult`, C1 sufficiency, ' +
      "F1's canonical categoriser, verified-only counting since #1658). RESOLVING a " +
      'matter is partial: 10 of the 18 map to a canonical category and 8 do not, and ' +
      'five of the ten share one undiscriminated `compaction` category.',
  },
  {
    letter: 'd',
    number: 4,
    id: 'retest_rectification',
    clause: clauseOf('d'),
    clauseText:
      'details of the retesting or rectification actions carried out where any test results ' +
      'specified in paragraph (c) fail to meet the standard specifications',
    coverage: 'partial',
    coverageNote:
      'The NCR limb is real: `NCR.linkedTestResultId` (schema.prisma:947), ' +
      '`rectificationNotes` / `rectificationSubmittedAt` (:960-961) and `NCREvidence` ' +
      '(:1035-1046). The NO-NCR path is the gap — there is no retest -> original-test ' +
      'link on `TestResult`, so a failed test followed by a passing retest with no NCR ' +
      'raised leaves the two rows unassociated. Closing it is a C2-family column.',
  },
  {
    letter: 'e',
    number: 5,
    id: 'cctv_stormwater',
    clause: clauseOf('e'),
    clauseText: 'CCTV video for underground stormwater infrastructure work',
    coverage: 'storage_only',
    coverageNote:
      'D1d shipped the capability (spec §4.8, AT-149): a SEPARATE video allow-set ' +
      '(`isAllowedCctvVideoMimeType`, routes/documents/fileHelpers.ts) covering the ' +
      "clause's named containers, and its own 256 MiB ceiling on " +
      '`POST /api/documents/upload/cctv`, enforced independently of the 50 MB document ' +
      'limit which is unchanged. CIVOS now HOLDS, files and lists a CCTV run against a ' +
      'lot; it does not decode, index or validate one, and never will — the coded ' +
      "observation record is the CCTV specialist's deliverable, produced in WinCan or " +
      'PipeTech. "storage_only", the same verdict as (h), and for the same reason. ' +
      'TWO limits remain and are stated rather than hidden: a run larger than 256 MiB ' +
      'cannot be uploaded until a resumable/streaming path exists (the shipped path ' +
      'buffers whole files in memory), and 31 runs at the ceiling fill the entire ' +
      '8 GiB folio archive admission cap on their own.',
  },
  {
    letter: 'f',
    number: 6,
    id: 'asset_attribute_imagery',
    clause: clauseOf('f'),
    clauseText:
      'photographs, video or digital imagery covering major asset attributes for local ' +
      'government infrastructure work not covered in (e). During construction, digital ' +
      'photographs must: (i) be taken of complex constructions or installations which will ' +
      'be below ground level or not visible after construction completion; (ii) be taken ' +
      'prior to backfilling; (iii) include a chainage or exact location reference in the ' +
      'title of the digital photo file; (iv) be date stamped; (v) be submitted ' +
      'electronically in .jpg format, no less than 4MB per file or 720x576 resolution',
    coverage: 'partial',
    coverageNote:
      'Date stamp (iv) and file format (v) are assessable today from ' +
      '`Document.captureTimestamp` and `mimeType` (schema.prisma:1609-1611); location is ' +
      'shipped via GPS and the photo-pin and chainage-generator work. Qualifying clauses ' +
      '(i) and (ii) became RECORDABLE in D1d (spec §4.8 item 3): the ' +
      '`concealed_works_photo` classification shipped as a `documentType` value on the ' +
      'upload surface, with no `Document` column added ([DH-e]). It stays `partial`, not ' +
      '`shipped`, for two reasons that are the customer-visible truth: the value is ' +
      'OPERATOR-APPLIED, so an unclassified lot means "not classified", never "not ' +
      'concealed"; and the filename rule (iii) is D1c.2 (§4.7.3, AT-140). Clause (v) is a ' +
      'disjunction CIVOS cannot fully evaluate — no image dimensions are stored.',
  },
  {
    letter: 'g',
    number: 7,
    id: 'asset_list',
    clause: clauseOf('g'),
    clauseText:
      'a list of assets and/or major components in editable spreadsheet format comprising ' +
      'assets with design life, geographical, geometrical attributes consistent with the ' +
      'as-constructed drawings',
    coverage: 'gap_deliberate',
    coverageNote:
      'Nothing, and deliberately not closed. The 78-model schema has no `Asset`, `Pit`, ' +
      '`Pipe`, `Manhole`, `Node` or `Conduit` model (spec §3.6). This is the surveyor and ' +
      "consultant's deliverable, produced from the same survey that produces the " +
      'as-constructed data file. Building an asset register to fill it is the forbidden ' +
      'over-build (§11).',
  },
  {
    letter: 'h',
    number: 8,
    id: 'om_manuals',
    clause: clauseOf('h'),
    clauseText:
      'copies of maintenance and operation or vendor manuals for the following (but not ' +
      'limited to) asset types: bridges; street lighting, traffic lights, electrical ' +
      'assets; gross pollutant traps (GPT); water sensitive urban design assets (WSUD). ' +
      'Clause (2): the manuals must be finalised on completion of commissioning, be in pdf ' +
      'format, and cover design, construction, operations, maintenance routines and ' +
      'procedures',
    coverage: 'storage_only',
    coverageNote:
      'A PDF manual uploads and files correctly today under the existing MIME allowance, ' +
      "and clause (2)(b)'s pdf requirement is assessable from `mimeType`. CIVOS stores " +
      'and lists it; it does not assemble, index or validate it, and is explicitly not an ' +
      'O&M manual builder. The folio says "present, as supplied" and never implies review.',
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
 * The first two were named here BEFORE the upload surface offered them, so D1d
 * would write the same strings the resolvers already read instead of picking new
 * ones and silently leaving these resolvers blind. All four now exist as options
 * in `frontend/src/pages/documents/documentsUploadData.ts`.
 *
 * `om_manual` was the one that got away: item (h) has read it since D1b.0, but no
 * option wrote it until the D1d follow-up, so (h) resolved `not_assessable` for
 * every lot regardless of what the customer uploaded. A resolver keyed to a value
 * no surface can produce is a gap that scores itself as customer fault.
 */
export const CCTV_DOCUMENT_TYPE = 'cctv_stormwater';
export const CONCEALED_WORKS_DOCUMENT_TYPE = 'concealed_works_photo';
/** Shipped today: `documentType: 'photo'` / `'image'` are both live values. */
export const PHOTO_DOCUMENT_TYPES: readonly string[] = ['photo', 'image'];
export const OM_MANUAL_DOCUMENT_TYPE = 'om_manual';

/**
 * Clause (1)(f)(v)'s "no less than 4MB per file".
 *
 * DECIMAL, not binary, deliberately. "4MB" is ambiguous and the two readings
 * differ by 4.9%; the decimal reading is the LOOSER bound, so a file between the
 * two is never accused of failing a requirement Logan may well consider met.
 * Over-stating a shortfall on a compilation document blames the customer for our
 * ambiguity — the same failure direction `vicroads-204.v1.ts:32-44` refuses.
 */
export const PSP5_PHOTO_MIN_BYTES = 4_000_000;

/**
 * Whether the shipped upload path can hold a CCTV video at all.
 *
 * **`true` since D1d** (spec §4.8, AT-149). It is still a CONSTANT rather than a
 * probe because production code in `lib/` must not import from `routes/`; the
 * premise is asserted instead. `loganPsp5Profile.test.ts` now pins BOTH halves
 * of the shipped design — `isAllowedCctvVideoMimeType('video/mp4')` is true on
 * the CCTV surface AND `isAllowedDocumentMimeType('video/mp4')` is still false
 * on the general document surface, because §4.8 item 1 required a separate
 * allow-set rather than a widening. Narrowing either one fails a test here.
 *
 * What it does NOT mean: that every run fits. The ceiling is
 * {@link CCTV_UPLOAD_MAX_BYTES_NOTE} — 256 MiB — and a larger run still cannot
 * be uploaded. That is recorded in item (e)'s `coverageNote`, not smuggled into
 * this boolean.
 */
export const CCTV_UPLOAD_SUPPORTED = true;

/**
 * The D1d ceiling, restated here as prose because `lib/` must not import from
 * `routes/`. A test asserts this string against the shipped
 * `CCTV_UPLOAD_MAX_BYTES` so the two cannot drift.
 */
export const CCTV_UPLOAD_MAX_BYTES_NOTE = '256 MiB';

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
  /** `Document.fileSize`, bytes. Null when unrecorded — clause (1)(f)(v). */
  readonly fileSize?: number | null;
  /** `Document.captureTimestamp` — clause (1)(f)(iv)'s date stamp. */
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
 * `not_applicable` — the item is not CIVOS's to produce ((a), (b), (g)), or the
 *   condition it depends on did not occur ((d), when nothing failed).
 * `not_assessable` — CIVOS cannot tell. Always carries the reason it cannot, and
 *   never implies the customer failed to supply anything.
 */
export type LoganPsp5ItemStatus = 'present' | 'missing' | 'not_applicable' | 'not_assessable';

export interface LoganPsp5ItemResult {
  readonly letter: string;
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
   * The things this verdict NAMES: an unresolvable test-type string, an unlinked
   * failed test, an undated photo. `[DH-B1]`'s "two missing, BY NAME".
   */
  readonly named: readonly string[];
}

export interface Logan18CategoryCoverage {
  readonly numeral: string;
  readonly number: number;
  readonly id: string;
  readonly psp5Name: string;
  /**
   * `evidenced` — at least one verified test resolves to a canonical category
   *   this matter maps to. NOT "satisfied": see `attribution`.
   * `no_evidence` — mapped, but no verified test resolves to it.
   * `unmappable` — CIVOS has no canonical category for it at all. Never
   *   `no_evidence`, because absence of a mapping is not absence of a test.
   */
  readonly state: 'evidenced' | 'no_evidence' | 'unmappable';
  /**
   * `exact` — a matching test can only be evidence toward this matter.
   * `ambiguous` — the canonical category is shared with other matters (five
   *   compaction entries, two grading entries) and CIVOS cannot attribute a test
   *   to one of them.
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
  /** Item (c)'s detail, hoisted so the folio can print the per-matter table. */
  readonly logan18: Logan18Coverage;
}

// ---------------------------------------------------------------------------
// The Logan-18 coverage pass (item (c)'s engine)
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

  return {
    categories: LOGAN_18.map((entry) => describeCategory(entry, evidenceByCategory)),
    unresolvedTestTypes: [...new Set(unresolved)],
    labReferenceTestTypes: [...new Set(labReferences)],
    verifiedTestCount: verified.length,
  };
}

function describeCategory(
  entry: Logan18Entry,
  evidenceByCategory: ReadonlyMap<TestCategory, readonly string[]>,
): Logan18CategoryCoverage {
  const base = {
    numeral: entry.numeral,
    number: entry.number,
    id: entry.id,
    psp5Name: entry.psp5Name,
  };
  if (entry.canonicalCategories.length === 0) {
    return {
      ...base,
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
    ...base,
    state: evidenceIds.length > 0 ? 'evidenced' : 'no_evidence',
    attribution: ambiguous ? 'ambiguous' : 'exact',
    reason: ambiguous
      ? `a matching test is evidence toward ${sharedWith.size} of the eighteen matters and ` +
        'cannot be attributed to this one'
      : undefined,
    evidenceIds,
  };
}

// ---------------------------------------------------------------------------
// The eight per-item resolvers
// ---------------------------------------------------------------------------

type Resolver = (
  input: LoganPsp5ResolverInput,
  logan18: Logan18Coverage,
) => Omit<LoganPsp5ItemResult, 'letter' | 'number' | 'id' | 'clause' | 'coverage'>;

const documentsOfType = (
  input: LoganPsp5ResolverInput,
  documentType: string,
): readonly LoganPsp5DocumentInput[] =>
  input.documents.filter((document) => document.documentType === documentType);

/**
 * Items (a) and (b) — the two consultant-signed certifications. Constants: they
 * take no input, so they are structurally incapable of returning `present`.
 */
const CONSULTANT_SIGNED_REASON =
  'Not produced by CIVOS. Logan PSP5 §5.6.5(1) assigns this certification to the ' +
  'consultant, who is also the submitting party. This folio is an input to it and is ' +
  'not itself a certification.';

const resolveCertificate: Resolver = () => ({
  status: 'not_applicable',
  reason: CONSULTANT_SIGNED_REASON,
  evidenceIds: [],
  named: [],
});

const resolveFoundationCertification: Resolver = () => ({
  status: 'not_applicable',
  reason: `${CONSULTANT_SIGNED_REASON} CIVOS also holds no foundation-condition record from which the clause's "where relevant" could be judged.`,
  evidenceIds: [],
  named: [],
});

/**
 * Item (c) — the eighteen matters.
 *
 * NEVER RETURNS `missing` FOR A MATTER, and that is deliberate on two grounds.
 * CIVOS has no evidence-backed mapping from a lot's work to the matters that
 * apply to it, so "sub-grade CBR missing" on a stormwater lot would be a
 * fabricated requirement. And clause (c)(xviii) — "any other job specific testing
 * carried out or required by the engineer" — is open-ended, so the pack's own
 * boundary is not enumerable.
 *
 * `ponytail:` ceiling named rather than hidden — an applicability model (lot
 * activity -> required matters) is the upgrade path, and it needs grade-A
 * evidence that does not exist today.
 */
const resolveTestResults: Resolver = (_input, logan18) => {
  const evidenced = logan18.categories.filter((c) => c.state === 'evidenced');
  const evidenceIds = [...new Set(evidenced.flatMap((c) => c.evidenceIds))];
  const scope =
    'CIVOS does not determine which of the eighteen matters this lot requires; ' +
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
        'category. They may be evidence toward clause (c)(xviii), "any other job specific ' +
        `testing", which CIVOS cannot enumerate. ${scope}`,
      evidenceIds,
      named: [...logan18.unresolvedTestTypes],
    };
  }
  if (evidenced.length === 0) {
    return {
      status: 'not_assessable',
      reason:
        `${logan18.verifiedTestCount} verified result(s) held, none of which resolve to a ` +
        `matter the crosswalk maps. ${scope}`,
      evidenceIds: [],
      named: [],
    };
  }
  return {
    status: 'present',
    reason:
      `${logan18.verifiedTestCount} verified result(s) are evidence toward ` +
      `${evidenced.length} of the eighteen matters. ${scope}`,
    evidenceIds,
    named: [],
  };
};

/**
 * Sort a lot's failed verified tests into the three states item (d)
 * distinguishes: no NCR at all (CIVOS cannot tell), an NCR with no rectification
 * detail (the detail is genuinely absent), and a complete trail.
 */
function triageFailedTests(
  failed: readonly LoganPsp5TestInput[],
  ncrs: readonly LoganPsp5NcrInput[],
): { unlinked: string[]; linkedWithoutDetail: string[]; evidenceIds: string[] } {
  const byTest = new Map<string, LoganPsp5NcrInput[]>();
  for (const ncr of ncrs) {
    if (!ncr.linkedTestResultId) continue;
    const bucket = byTest.get(ncr.linkedTestResultId);
    if (bucket) bucket.push(ncr);
    else byTest.set(ncr.linkedTestResultId, [ncr]);
  }

  const unlinked: string[] = [];
  const linkedWithoutDetail: string[] = [];
  const evidenceIds: string[] = [];
  for (const test of failed) {
    const linked = byTest.get(test.id) ?? [];
    const detailed = linked.filter(
      (n) =>
        Boolean(n.rectificationNotes) || Boolean(n.rectificationSubmittedAt) || n.evidenceCount > 0,
    );
    if (linked.length === 0) unlinked.push(test.id);
    else if (detailed.length === 0)
      linkedWithoutDetail.push(linked.map((n) => n.ncrNumber || n.id).join(', '));
    else evidenceIds.push(...detailed.map((n) => n.id));
  }
  return { unlinked, linkedWithoutDetail, evidenceIds };
}

/**
 * Item (d) — retesting or rectification where a test fails.
 *
 * The §2.2 item-3 hole, printed rather than papered over: a failed verified test
 * with no linked NCR yields `not_assessable` naming the test, because there is no
 * retest -> original-test link on `TestResult` and CIVOS genuinely cannot tell
 * whether a rectification happened.
 */
const resolveRetestRectification: Resolver = (input) => {
  const failed = input.tests.filter((t) => isVerified(t) && t.passFail === 'fail');
  if (failed.length === 0) {
    return {
      status: 'not_applicable',
      reason: 'No verified test result on this lot has failed, so no rectification is required.',
      evidenceIds: [],
      named: [],
    };
  }

  const { unlinked, linkedWithoutDetail, evidenceIds } = triageFailedTests(failed, input.ncrs);

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
    reason: `All ${failed.length} failed verified test(s) link to an NCR carrying rectification detail.`,
    evidenceIds: [...new Set(evidenceIds)],
    named: [],
  };
};

/**
 * Item (e) — CCTV. D1d flipped {@link CCTV_UPLOAD_SUPPORTED}, so this resolver
 * now reports the held files.
 *
 * It still never returns `missing`. Spec §2.3's rule survives the capability
 * change, only its reason changes: CIVOS has no record of which lots contain
 * underground stormwater infrastructure, so "no CCTV file held" is a fact about
 * CIVOS's knowledge, not a finding against the customer. Whether a run was owed
 * remains the certifying consultant's determination.
 *
 * The `!CCTV_UPLOAD_SUPPORTED` branch is retained: it is the honest output if
 * the capability is ever rolled back, and the constant is what the spec pins.
 */
const resolveCctv: Resolver = (input) => {
  /* c8 ignore start -- CCTV_UPLOAD_SUPPORTED is true since D1d; the branch is the rollback path. */
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
  /* c8 ignore stop */
  const held = documentsOfType(input, CCTV_DOCUMENT_TYPE);
  return held.length > 0
    ? {
        status: 'present',
        reason:
          `${held.length} CCTV file(s) held for this lot, as supplied. CIVOS stores and ` +
          'lists the run; it does not decode or review the footage, and the coded ' +
          "observation record remains the CCTV specialist's deliverable.",
        evidenceIds: held.map((d) => d.id),
        named: [],
      }
    : {
        status: 'not_assessable',
        reason:
          'No CCTV file is held. CIVOS can hold one since D1d, but records nothing that ' +
          'says whether this lot contains underground stormwater infrastructure ' +
          `requiring one, and a run larger than ${CCTV_UPLOAD_MAX_BYTES_NOTE} cannot yet ` +
          'be uploaded.',
        evidenceIds: [],
        named: [],
      };
};

/**
 * Item (f) — imagery of major asset attributes, with the clause's five conditions.
 *
 * (i) and (ii) — "below ground level or not visible after construction
 * completion" and "prior to backfilling" — collapse into one `documentType` value
 * D1d ships. Until then no photo can carry it, so a lot with photos reads "photos
 * present, none classified", never "missing", which would assert the customer
 * failed to photograph. (iv) and (v) ARE assessable today.
 */
const resolveAssetImagery: Resolver = (input) => {
  const classified = documentsOfType(input, CONCEALED_WORKS_DOCUMENT_TYPE);
  if (classified.length === 0) {
    const photos = input.documents.filter(
      (d) =>
        (d.documentType !== null && PHOTO_DOCUMENT_TYPES.includes(d.documentType)) ||
        Boolean(d.captureTimestamp),
    );
    return {
      status: 'not_assessable',
      reason:
        photos.length > 0
          ? `${photos.length} photograph(s) present, none classified under clause (f)(i)-(ii). ` +
            'CIVOS holds no field recording that a photo depicts work below ground level or ' +
            'not visible after construction completion, or was taken prior to backfilling.'
          : 'No photographs are held for this lot, and CIVOS cannot determine whether this ' +
            'lot contains work that will not be visible after construction.',
      evidenceIds: [],
      named: [],
    };
  }

  const undated = classified.filter((d) => !d.captureTimestamp);
  const notJpeg = classified.filter((d) => d.mimeType !== 'image/jpeg');
  if (undated.length > 0 || notJpeg.length > 0) {
    return {
      status: 'missing',
      reason:
        `Of ${classified.length} classified photograph(s), ${undated.length} carry no capture ` +
        `timestamp (clause (f)(iv)) and ${notJpeg.length} are not .jpg (clause (f)(v)).`,
      evidenceIds: classified
        .filter((d) => d.captureTimestamp && d.mimeType === 'image/jpeg')
        .map((d) => d.id),
      named: [...new Set([...undated, ...notJpeg].map((d) => d.id))],
    };
  }

  // Clause (f)(v) is a DISJUNCTION — 4MB per file OR 720x576 resolution. CIVOS
  // stores no image dimensions, so a smaller file may still satisfy it and is
  // reported as unconfirmed rather than failed.
  const unconfirmedSize = classified.filter(
    (d) => typeof d.fileSize !== 'number' || d.fileSize < PSP5_PHOTO_MIN_BYTES,
  );
  const sizeNote = unconfirmedSize.length
    ? ` Clause (f)(v)'s size limb is unconfirmed for ${unconfirmedSize.length} file(s): they are ` +
      'under 4MB and CIVOS stores no image dimensions, so the 720x576 alternative cannot be ' +
      'checked.'
    : '';
  return {
    status: 'present',
    reason:
      `${classified.length} classified photograph(s) held, date-stamped and in .jpg format. ` +
      'The chainage reference clause (f)(iii) requires in the filename is applied when the ' +
      `archive is built.${sizeNote}`,
    evidenceIds: classified.map((d) => d.id),
    named: unconfirmedSize.map((d) => d.id),
  };
};

/** Item (g) — the asset list. A constant, like (a) and (b), and never `present`. */
const resolveAssetList: Resolver = () => ({
  status: 'not_applicable',
  reason:
    'Not produced by CIVOS. The editable asset list is the surveyor and consultant ' +
    'deliverable, produced from the same survey that produces the as-constructed data ' +
    'file. CIVOS holds no asset model and will not infer one.',
  evidenceIds: [],
  named: [],
});

/** Item (h) — vendor O&M manuals. `storage_only`: present as supplied, never reviewed. */
const resolveOmManuals: Resolver = (input) => {
  const held = documentsOfType(input, OM_MANUAL_DOCUMENT_TYPE);
  if (held.length === 0) {
    return {
      status: 'not_assessable',
      reason:
        'No vendor O&M manual is held, and CIVOS cannot determine whether this lot includes ' +
        'the asset types clause (h) enumerates.',
      evidenceIds: [],
      named: [],
    };
  }
  const notPdf = held.filter((d) => d.mimeType !== 'application/pdf');
  if (notPdf.length > 0) {
    return {
      status: 'missing',
      reason:
        `${notPdf.length} of ${held.length} manual(s) are not in pdf format, which clause ` +
        '5.6.5(2)(b) requires.',
      evidenceIds: held.filter((d) => d.mimeType === 'application/pdf').map((d) => d.id),
      named: notPdf.map((d) => d.id),
    };
  }
  return {
    status: 'present',
    reason:
      `${held.length} vendor O&M manual(s) held in pdf format, as supplied. CIVOS stores and ` +
      'lists them; it does not assemble, index or validate them, so clause (2)(a) ' +
      '(finalised on commissioning) and (2)(c) (content coverage) are not assessed here.',
    evidenceIds: held.map((d) => d.id),
    named: [],
  };
};

/**
 * One resolver per item, exhaustive by type. Adding an item id without a resolver
 * is a compile error — the mapping cannot go stale the way §2.2's prose table did.
 */
const RESOLVERS: Readonly<Record<LoganPsp5ItemId, Resolver>> = Object.freeze({
  inspection_testing_certificate: resolveCertificate,
  foundation_conditions_certification: resolveFoundationCertification,
  test_results: resolveTestResults,
  retest_rectification: resolveRetestRectification,
  cctv_stormwater: resolveCctv,
  asset_attribute_imagery: resolveAssetImagery,
  asset_list: resolveAssetList,
  om_manuals: resolveOmManuals,
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
      letter: item.letter,
      number: item.number,
      id: item.id,
      clause: item.clause,
      coverage: item.coverage,
      ...RESOLVERS[item.id](input, logan18),
    })),
    logan18,
  };
}
