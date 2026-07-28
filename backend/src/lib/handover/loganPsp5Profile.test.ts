// Wave D `D1b.0` acceptance tests — **AT-144** (the requirement profile is
// executable) and **AT-145** (the crosswalk names what it cannot resolve), spec
// `docs/plans/wave-d-handover-spec-2026-07-28.md` Rev 3 §14.
//
// Pure: no DB, no Prisma, no clock. Every test-type string in a fixture is a REAL
// string — a `TEST_TYPE_ALIASES` key or a plainly-written type the alias table
// deliberately does not carry. Inventing a vocabulary the product never writes is
// the defect F1 exists to fix.
//
// PROOF-OF-CATCH. Several assertions pin a NUMBER or a LITERAL rather than a
// shape, deliberately: `[DR2-B1]` was a false SCORE over a rendering of a clause,
// so the tests that matter are the ones that fail when the score changes without
// the clause changing.

import { describe, expect, it } from 'vitest';
import { testTypeSpecifications } from '../../routes/testResults/specifications.js';
import {
  CCTV_UPLOAD_MAX_BYTES,
  DOCUMENT_UPLOAD_MAX_BYTES,
  isAllowedCctvVideoMimeType,
  isAllowedDocumentMimeType,
} from '../../routes/documents/fileHelpers.js';
import { TEST_TYPE_ALIASES } from '../readiness/sufficiency/testCategories.js';
import {
  LOGAN_18,
  LOGAN_18_CLAUSE,
  LOGAN_18_OPEN_ENDED,
  isAmbiguouslyAttributed,
} from './loganPsp5Crosswalk.js';
import {
  CCTV_DOCUMENT_TYPE,
  CCTV_UPLOAD_MAX_BYTES_NOTE,
  CCTV_UPLOAD_SUPPORTED,
  CONCEALED_WORKS_DOCUMENT_TYPE,
  LOGAN_PSP5_ITEMS,
  LOGAN_PSP5_PROFILE_VERSION,
  OM_MANUAL_DOCUMENT_TYPE,
  PSP5_PHOTO_MIN_BYTES,
  resolveLogan18Coverage,
  resolveLoganPsp5Profile,
  type LoganPsp5ItemId,
  type LoganPsp5ResolverInput,
} from './loganPsp5Profile.js';

const EMPTY: LoganPsp5ResolverInput = { lotId: 'lot-1', tests: [], ncrs: [], documents: [] };

const input = (over: Partial<LoganPsp5ResolverInput>): LoganPsp5ResolverInput => ({
  ...EMPTY,
  ...over,
});

/** `TEST_TYPE_ALIASES` key — resolves `compaction`. */
const COMPACTION_TEST = {
  id: 'test-compaction',
  testType: 'Density Ratio',
  status: 'verified',
  passFail: 'pass',
} as const;

/** A plainly-written type the alias table deliberately does not carry today. */
const UNRESOLVABLE_TEST = {
  id: 'test-cbr',
  testType: 'CBR',
  status: 'verified',
  passFail: 'pass',
} as const;

/** `LAB_REFERENCE_TOKENS` key — known, and deliberately not a countable field test. */
const LAB_REFERENCE_TEST = {
  id: 'test-mdd',
  testType: 'MDD Standard',
  status: 'verified',
  passFail: 'pass',
} as const;

/** A photo satisfying clauses (f)(iv) and (f)(v) outright. */
const COMPLIANT_PHOTO = {
  id: 'doc-cw',
  documentType: CONCEALED_WORKS_DOCUMENT_TYPE,
  mimeType: 'image/jpeg',
  fileSize: PSP5_PHOTO_MIN_BYTES + 1,
  captureTimestamp: '2026-07-01T00:00:00.000Z',
} as const;

const byId = (result: ReturnType<typeof resolveLoganPsp5Profile>, id: LoganPsp5ItemId) => {
  const item = result.items.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`no result for ${id}`);
  return item;
};

const byLetter = (letter: string) => {
  const item = LOGAN_PSP5_ITEMS.find((candidate) => candidate.letter === letter);
  if (!item) throw new Error(`no pack item ${letter}`);
  return item;
};

// ---------------------------------------------------------------------------
// Premises — the shipped and published facts the profile encodes
// ---------------------------------------------------------------------------
describe('premises', () => {
  // D1d, AT-149. The pin did its job: flipping `CCTV_UPLOAD_SUPPORTED` failed
  // the previous version of this test, which asserted `false` alongside
  // `isAllowedDocumentMimeType('video/mp4') === false`.
  //
  // It is REPLACED, not deleted, and it now pins BOTH halves of what D1d
  // actually shipped — because spec §4.8 item 1 required a SEPARATE allow-set,
  // not a widening. `isAllowedDocumentMimeType('video/mp4')` is still false and
  // must stay false: widening the general document set would let video onto
  // every upload surface in the product, which is the thing §4.8 forbids.
  it('video is accepted on the CCTV surface and STILL rejected on the general document surface', () => {
    // The separation IS the design (spec §4.8 item 1).
    expect(isAllowedDocumentMimeType('video/mp4')).toBe(false);
    expect(isAllowedDocumentMimeType('video/x-msvideo')).toBe(false);

    // …and the CCTV surface holds the clause's named containers.
    expect(isAllowedCctvVideoMimeType('video/mp4')).toBe(true);
    expect(isAllowedCctvVideoMimeType('video/x-msvideo')).toBe(true);
    // A document type is not a video type: the CCTV set is not a superset.
    expect(isAllowedCctvVideoMimeType('application/pdf')).toBe(false);
    expect(isAllowedCctvVideoMimeType('image/jpeg')).toBe(false);

    expect(CCTV_UPLOAD_SUPPORTED).toBe(true);
  });

  // `lib/` must not import from `routes/`, so item (e)'s coverageNote states the
  // ceiling as prose. This is what stops the prose and the enforced number from
  // drifting apart.
  it('the ceiling item (e) states in prose is the ceiling the upload path enforces', () => {
    expect(CCTV_UPLOAD_MAX_BYTES).toBe(256 * 1024 * 1024);
    expect(CCTV_UPLOAD_MAX_BYTES_NOTE).toBe('256 MiB');
    expect(byLetter('e').coverageNote).toContain(CCTV_UPLOAD_MAX_BYTES_NOTE);
    // Separately governed: well above the 50 MB document cap, and not equal to it.
    expect(CCTV_UPLOAD_MAX_BYTES).toBeGreaterThan(DOCUMENT_UPLOAD_MAX_BYTES);
  });

  // `[LP5-DELTA]`. The clause enumerates (a) through (h); spec §2.2 tabulates
  // seven items and drops (b). Pinned so a future agent reconciling this file
  // against §2.2 changes §2.2, not this.
  it('the pack has EIGHT items, lettered a through h, including the (b) spec §2.2 omits', () => {
    expect(LOGAN_PSP5_ITEMS).toHaveLength(8);
    expect(LOGAN_PSP5_ITEMS.map((item) => item.letter)).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
      'f',
      'g',
      'h',
    ]);
    expect(LOGAN_PSP5_ITEMS.map((item) => item.clause)).toEqual([
      '5.6.5(1)(a)',
      '5.6.5(1)(b)',
      '5.6.5(1)(c)',
      '5.6.5(1)(d)',
      '5.6.5(1)(e)',
      '5.6.5(1)(f)',
      '5.6.5(1)(g)',
      '5.6.5(1)(h)',
    ]);
    const foundation = LOGAN_PSP5_ITEMS[1];
    expect(foundation.id).toBe('foundation_conditions_certification');
    expect(foundation.clauseText).toBe(
      'a certification of foundation conditions signed by the consultant where relevant',
    );
  });

  it('the eighteen matters carry the clause’s own roman numerals, in order', () => {
    expect(LOGAN_18).toHaveLength(18);
    expect(LOGAN_18_CLAUSE).toBe('5.6.5(1)(c)');
    expect(LOGAN_18.map((entry) => entry.numeral)).toEqual([
      'i',
      'ii',
      'iii',
      'iv',
      'v',
      'vi',
      'vii',
      'viii',
      'ix',
      'x',
      'xi',
      'xii',
      'xiii',
      'xiv',
      'xv',
      'xvi',
      'xvii',
      'xviii',
    ]);
    // `[LP5-DELTA]`: the clause makes fill and trench backfill ONE matter — the
    // prose rendering the spec was written against split them — and closes with
    // an open-ended catch-all the rendering drops entirely.
    expect(LOGAN_18[0].psp5Name).toBe(
      'the compaction of fill including compaction of trench backfill',
    );
    expect(LOGAN_18_OPEN_ENDED.map((entry) => entry.numeral)).toEqual(['xviii']);
  });
});

// ---------------------------------------------------------------------------
// AT-144 — the requirement profile is executable
// ---------------------------------------------------------------------------
describe('AT-144 the requirement profile is executable', () => {
  it('resolves every pack item, each with a status and a reason', () => {
    const result = resolveLoganPsp5Profile(input({ tests: [COMPACTION_TEST] }));
    expect(result.profileVersion).toBe(LOGAN_PSP5_PROFILE_VERSION);
    expect(result.items).toHaveLength(8);
    expect(result.items.map((item) => item.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (const item of result.items) {
      expect(['present', 'missing', 'not_applicable', 'not_assessable']).toContain(item.status);
      expect(item.reason.length).toBeGreaterThan(0);
    }
  });

  // The `[DR2-B1]` guard. A profile whose item count or version changes without a
  // test change fails; so does one that promotes a gap to a fed status.
  it('pins the item count, the profile version and the honest coverage distribution', () => {
    expect(LOGAN_PSP5_PROFILE_VERSION).toBe('logan-psp5.v1');
    const distribution = LOGAN_PSP5_ITEMS.reduce<Record<string, number>>((counts, item) => {
      counts[item.coverage] = (counts[item.coverage] ?? 0) + 1;
      return counts;
    }, {});
    // D1d moved item (e) from `gap_closable` to `storage_only` — the ONLY
    // coverage change this phase makes, and the pin above forced it to be
    // stated. CIVOS can now hold, file and list a CCTV run; it does not decode,
    // index or validate one, which is exactly item (h)'s verdict and word.
    //
    // TWO storage-only, three partial, three deliberate-and-permanent gaps, and
    // ZERO closable gaps left in the pack. NOTHING is `shipped` and D1d did not
    // promote anything to it: the classification value is operator-applied and
    // the ceiling is 256 MiB, neither of which is a finished requirement.
    expect(distribution).toEqual({
      storage_only: 2,
      partial: 3,
      gap_deliberate: 3,
    });
    expect(distribution.shipped).toBeUndefined();
    expect(distribution.gap_closable).toBeUndefined();
    expect(byLetter('e').coverage).toBe('storage_only');
  });

  it('every item carries a clause and transcribed clause text', () => {
    for (const item of LOGAN_PSP5_ITEMS) {
      expect(item.clause).toMatch(/^5\.6\.5\(1\)\([a-h]\)$/);
      expect(item.clauseText.length).toBeGreaterThan(10);
      expect(item.coverageNote.length).toBeGreaterThan(10);
    }
  });

  // The load-bearing honesty assertion: the three permanent gaps take no input at
  // all, so no fixture and no future data can make the folio imply CIVOS produced
  // a consultant's certification or the surveyor's asset list.
  it('items (a), (b) and (g) are structurally incapable of returning present', () => {
    const maximal = input({
      tests: [COMPACTION_TEST],
      ncrs: [
        {
          id: 'ncr-1',
          linkedTestResultId: COMPACTION_TEST.id,
          rectificationNotes: 'rectified',
          rectificationSubmittedAt: '2026-07-01T00:00:00.000Z',
          evidenceCount: 2,
        },
      ],
      documents: [
        COMPLIANT_PHOTO,
        { id: 'doc-cert', documentType: 'certificate', captureTimestamp: null },
        {
          id: 'doc-om',
          documentType: OM_MANUAL_DOCUMENT_TYPE,
          mimeType: 'application/pdf',
          captureTimestamp: null,
        },
      ],
    });
    const permanent: LoganPsp5ItemId[] = [
      'inspection_testing_certificate',
      'foundation_conditions_certification',
      'asset_list',
    ];
    for (const result of [resolveLoganPsp5Profile(EMPTY), resolveLoganPsp5Profile(maximal)]) {
      for (const id of permanent) expect(byId(result, id).status).toBe('not_applicable');
    }
    // And each verdict is identical whatever the input, i.e. a constant.
    for (const id of permanent) {
      expect(byId(resolveLoganPsp5Profile(EMPTY), id)).toEqual(
        byId(resolveLoganPsp5Profile(maximal), id),
      );
    }
  });

  // Spec §2.3's rule SURVIVES D1d; only its reason changes. The old assertion
  // ("CIVOS cannot yet hold this file type") failed against the shipped
  // capability and is replaced by the new truth. What must never change is the
  // status: still `not_assessable`, never `missing`, because CIVOS records
  // nothing that says a given lot contains underground stormwater
  // infrastructure. Blaming the customer for a gap we own is the worst thing
  // this document could do — and now that we CAN hold the file, blaming them
  // for not supplying one we cannot know is owed would be the same failure.
  it('item (e) (CCTV) never reports a missing deliverable, before or after D1d', () => {
    const item = byId(resolveLoganPsp5Profile(EMPTY), 'cctv_stormwater');
    expect(item.status).toBe('not_assessable');
    expect(item.status).not.toBe('missing');
    expect(item.reason).toContain('CIVOS can hold one since D1d');
    expect(item.reason).toContain('cannot yet be uploaded');
    expect(item.evidenceIds).toEqual([]);
  });

  // AT-149. Unreachable before D1d (the resolver was behind a `c8 ignore` for
  // exactly that reason); this is the test the spec said would cover it here.
  it('item (e) reports a held CCTV run as present, as supplied, without reviewing it', () => {
    const item = byId(
      resolveLoganPsp5Profile(
        input({
          documents: [
            {
              id: 'doc-cctv',
              documentType: CCTV_DOCUMENT_TYPE,
              mimeType: 'video/mp4',
              captureTimestamp: null,
            },
          ],
        }),
      ),
      'cctv_stormwater',
    );
    expect(item.status).toBe('present');
    expect(item.evidenceIds).toEqual(['doc-cctv']);
    expect(item.reason).toContain('1 CCTV file(s) held');
    // The honesty limb: holding is not reviewing.
    expect(item.reason).toContain('does not decode or review the footage');
  });

  it('item (d) is not_applicable when nothing failed, and names unlinked failures when something did', () => {
    expect(
      byId(resolveLoganPsp5Profile(input({ tests: [COMPACTION_TEST] })), 'retest_rectification')
        .status,
    ).toBe('not_applicable');

    const failed = { ...COMPACTION_TEST, id: 'test-failed', passFail: 'fail' };
    const unlinked = byId(
      resolveLoganPsp5Profile(input({ tests: [failed] })),
      'retest_rectification',
    );
    expect(unlinked.status).toBe('not_assessable');
    expect(unlinked.named).toEqual(['test-failed']);
    expect(unlinked.reason).toContain('rectification not linked');

    const linkedNoDetail = byId(
      resolveLoganPsp5Profile(
        input({
          tests: [failed],
          ncrs: [
            {
              id: 'ncr-bare',
              ncrNumber: 'NCR-004',
              linkedTestResultId: 'test-failed',
              rectificationNotes: null,
              rectificationSubmittedAt: null,
              evidenceCount: 0,
            },
          ],
        }),
      ),
      'retest_rectification',
    );
    expect(linkedNoDetail.status).toBe('missing');
    expect(linkedNoDetail.named).toEqual(['NCR-004']);

    const complete = byId(
      resolveLoganPsp5Profile(
        input({
          tests: [failed],
          ncrs: [
            {
              id: 'ncr-full',
              linkedTestResultId: 'test-failed',
              rectificationNotes: 'retested and passed',
              rectificationSubmittedAt: '2026-07-02T00:00:00.000Z',
              evidenceCount: 1,
            },
          ],
        }),
      ),
      'retest_rectification',
    );
    expect(complete.status).toBe('present');
    expect(complete.evidenceIds).toEqual(['ncr-full']);
  });

  it('item (f) distinguishes "no photos" from "photos, none classified"', () => {
    expect(byId(resolveLoganPsp5Profile(EMPTY), 'asset_attribute_imagery').reason).toContain(
      'No photographs are held',
    );

    const unclassified = byId(
      resolveLoganPsp5Profile(
        input({
          documents: [
            {
              id: 'doc-photo',
              documentType: 'photo',
              mimeType: 'image/jpeg',
              captureTimestamp: '2026-07-01T00:00:00.000Z',
            },
          ],
        }),
      ),
      'asset_attribute_imagery',
    );
    expect(unclassified.status).toBe('not_assessable');
    expect(unclassified.reason).toContain('none classified under clause (f)(i)-(ii)');
  });

  it('item (f) enforces the clause’s own date-stamp and .jpg conditions', () => {
    const undated = byId(
      resolveLoganPsp5Profile(
        input({ documents: [{ ...COMPLIANT_PHOTO, captureTimestamp: null }] }),
      ),
      'asset_attribute_imagery',
    );
    expect(undated.status).toBe('missing');
    expect(undated.named).toEqual(['doc-cw']);
    expect(undated.reason).toContain('(f)(iv)');

    const notJpeg = byId(
      resolveLoganPsp5Profile(
        input({ documents: [{ ...COMPLIANT_PHOTO, mimeType: 'image/png' }] }),
      ),
      'asset_attribute_imagery',
    );
    expect(notJpeg.status).toBe('missing');
    expect(notJpeg.reason).toContain('(f)(v)');

    const compliant = byId(
      resolveLoganPsp5Profile(input({ documents: [COMPLIANT_PHOTO] })),
      'asset_attribute_imagery',
    );
    expect(compliant.status).toBe('present');
    expect(compliant.evidenceIds).toEqual(['doc-cw']);
    expect(compliant.reason).not.toContain('unconfirmed');
  });

  // Clause (f)(v) is a DISJUNCTION and CIVOS stores no image dimensions, so a
  // small file is reported unconfirmed rather than failed. Reporting it as
  // `missing` would accuse a compliant 720x576 photo.
  it('item (f) reports the size limb as unconfirmed, never as a failure', () => {
    const small = byId(
      resolveLoganPsp5Profile(input({ documents: [{ ...COMPLIANT_PHOTO, fileSize: 900_000 }] })),
      'asset_attribute_imagery',
    );
    expect(small.status).toBe('present');
    expect(small.reason).toContain('unconfirmed');
    expect(small.reason).toContain('720x576');
    expect(small.named).toEqual(['doc-cw']);
  });

  it('item (h) is present-as-supplied, enforces clause (2)(b) pdf, and never implies review', () => {
    const held = byId(
      resolveLoganPsp5Profile(
        input({
          documents: [
            {
              id: 'doc-om',
              documentType: OM_MANUAL_DOCUMENT_TYPE,
              mimeType: 'application/pdf',
              captureTimestamp: null,
            },
          ],
        }),
      ),
      'om_manuals',
    );
    expect(held.status).toBe('present');
    expect(held.reason).toContain('as supplied');
    expect(held.reason).toContain('does not assemble, index or validate');

    const notPdf = byId(
      resolveLoganPsp5Profile(
        input({
          documents: [
            {
              id: 'doc-om-docx',
              documentType: OM_MANUAL_DOCUMENT_TYPE,
              mimeType: 'application/msword',
              captureTimestamp: null,
            },
          ],
        }),
      ),
      'om_manuals',
    );
    expect(notPdf.status).toBe('missing');
    expect(notPdf.reason).toContain('5.6.5(2)(b)');

    expect(byId(resolveLoganPsp5Profile(EMPTY), 'om_manuals').status).toBe('not_assessable');
  });

  it('is deterministic — two resolutions of one input are equal', () => {
    const fixture = input({ tests: [COMPACTION_TEST, UNRESOLVABLE_TEST] });
    expect(resolveLoganPsp5Profile(fixture)).toEqual(resolveLoganPsp5Profile(fixture));
  });
});

// ---------------------------------------------------------------------------
// AT-145 — the crosswalk names what it cannot resolve
// ---------------------------------------------------------------------------
describe('AT-145 the crosswalk names what it cannot resolve', () => {
  // The spec's AT-145 asks that every one of the 18 map to at least one
  // `TestCategory`. EIGHT CANNOT — three name a material "quality" whose
  // constituent tests the clause does not enumerate, one names spray and
  // application rates, three name hydraulic/water tests CIVOS has no canonical
  // category for, and one is the clause's own open-ended catch-all. Mapping them
  // anyway is precisely the fake coverage `[DR2-B1]` caught. So the assertion is
  // the honest form of AT-145: mapped, or explicitly unmappable with a reason —
  // never silently empty.
  it('every matter is mapped or explicitly unmappable with a reason', () => {
    for (const entry of LOGAN_18) {
      if (entry.canonicalCategories.length === 0) {
        expect(entry.unmappedReason, `${entry.id} has no mapping and no reason`).toBeTruthy();
      } else {
        expect(
          entry.unmappedReason,
          `${entry.id} is mapped AND claims to be unmappable`,
        ).toBeUndefined();
      }
    }
    const mapped = LOGAN_18.filter((entry) => entry.canonicalCategories.length > 0);
    expect(mapped).toHaveLength(10);
    expect(LOGAN_18.length - mapped.length).toBe(8);
  });

  // AT-22's namespace contract, applied to this table: the crosswalk declares
  // plain strings and imports nothing from `routes/`, so the linkage is asserted
  // here rather than typed.
  it('every canonical category named is a key of testTypeSpecifications', () => {
    const specKeys = new Set(Object.keys(testTypeSpecifications));
    for (const entry of LOGAN_18) {
      for (const category of entry.canonicalCategories) {
        expect(specKeys.has(category), `${entry.id} -> ${category}`).toBe(true);
      }
    }
  });

  // The most important limitation in the table, DERIVED from the table rather
  // than declared per entry, so it cannot drift.
  it('marks as ambiguous every matter whose canonical category is shared', () => {
    expect(LOGAN_18.filter(isAmbiguouslyAttributed).map((entry) => entry.numeral)).toEqual([
      'i',
      'iii',
      'v',
      'vi',
      'vii',
      'ix',
      'xi',
    ]);
    // Sole owners of their canonical categories.
    for (const id of ['subgrade_cbr', 'ac_core_tests', 'concrete_testing']) {
      expect(LOGAN_18.filter((e) => e.id === id).every(isAmbiguouslyAttributed)).toBe(false);
    }
  });

  it('a test type outside the crosswalk yields not_assessable NAMING that string', () => {
    const result = resolveLoganPsp5Profile(input({ tests: [COMPACTION_TEST, UNRESOLVABLE_TEST] }));
    const item = byId(result, 'test_results');
    expect(item.status).toBe('not_assessable');
    expect(item.named).toEqual(['CBR']);
    expect(result.logan18.unresolvedTestTypes).toEqual(['CBR']);
    // And it is not reported as outside the pack: clause (c)(xviii) admits it.
    expect(item.reason).toContain('(c)(xviii)');
  });

  it('never reports a matter as missing — CIVOS does not decide which apply', () => {
    for (const fixture of [
      input({ tests: [COMPACTION_TEST] }),
      input({ tests: [COMPACTION_TEST, UNRESOLVABLE_TEST] }),
      input({ tests: [LAB_REFERENCE_TEST] }),
    ]) {
      const item = byId(resolveLoganPsp5Profile(fixture), 'test_results');
      expect(item.status).not.toBe('missing');
      expect(item.reason).toContain("certifying consultant's determination");
    }
    // The one `missing` item (c) may return is "no verified result at all", which
    // names no matter.
    const none = byId(resolveLoganPsp5Profile(EMPTY), 'test_results');
    expect(none.status).toBe('missing');
    expect(none.named).toEqual(['no verified test result']);
  });

  it('a laboratory reference is not an unresolved string, and evidences nothing', () => {
    const coverage = resolveLogan18Coverage(input({ tests: [LAB_REFERENCE_TEST] }));
    expect(coverage.labReferenceTestTypes).toEqual(['MDD Standard']);
    expect(coverage.unresolvedTestTypes).toEqual([]);
    expect(coverage.categories.filter((c) => c.state === 'evidenced')).toEqual([]);
  });

  it('counts only verified results', () => {
    const coverage = resolveLogan18Coverage(
      input({ tests: [{ ...COMPACTION_TEST, id: 'pending', status: 'pending' }] }),
    );
    expect(coverage.verifiedTestCount).toBe(0);
    expect(coverage.categories.every((c) => c.evidenceIds.length === 0)).toBe(true);
  });

  it('a compaction test evidences all five compaction matters and attributes to none', () => {
    const coverage = resolveLogan18Coverage(input({ tests: [COMPACTION_TEST] }));
    const evidenced = coverage.categories.filter((c) => c.state === 'evidenced');
    expect(evidenced.map((c) => c.numeral)).toEqual(['i', 'iii', 'v', 'ix', 'xi']);
    for (const category of evidenced) {
      expect(category.attribution).toBe('ambiguous');
      expect(category.reason).toContain('cannot be attributed to this one');
      expect(category.evidenceIds).toEqual(['test-compaction']);
    }
    // Unmappable matters never read as "no evidence" — absence of a mapping is
    // not absence of a test.
    const unmappable = coverage.categories.filter((c) => c.state === 'unmappable');
    expect(unmappable).toHaveLength(8);
    for (const category of unmappable) expect(category.reason).toBeTruthy();
  });

  // A pinned ceiling, not a wish. `TEST_TYPE_ALIASES` resolves ONLY `compaction`
  // at this SHA (its own SCOPE note: an alias ships only for a string a lot under
  // a RESOLVED pack can carry). So five of the ten mapped matters are unreachable
  // through resolution today. When F1 adds a non-compaction alias this fails,
  // which is the prompt to re-read this crosswalk rather than assume it already
  // worked.
  it('records that only compaction-family matters are reachable at this SHA', () => {
    expect([...new Set(Object.values(TEST_TYPE_ALIASES))]).toEqual(['compaction']);
    expect(
      LOGAN_18.filter((entry) => entry.canonicalCategories.includes('compaction')),
    ).toHaveLength(5);
  });
});
