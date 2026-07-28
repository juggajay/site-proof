// Wave D `D1b.0` acceptance tests — **AT-144** (the requirement profile is
// executable) and **AT-145** (the crosswalk names what it cannot resolve), spec
// `docs/plans/wave-d-handover-spec-2026-07-28.md` Rev 3 §14.
//
// Pure: no DB, no Prisma, no clock. Every test-type string in a fixture is a REAL
// string — a `TEST_TYPE_ALIASES` key or a plainly-written type the alias table
// deliberately does not carry. Inventing a vocabulary the product never writes is
// the defect F1 exists to fix.
//
// PROOF-OF-CATCH. Several assertions below pin a NUMBER or a LITERAL rather than
// a shape, deliberately: `[DR2-B1]` was a false SCORE over a table whose own
// cells contradicted it, so the tests that matter are the ones that fail when the
// score changes without the evidence changing.

import { describe, expect, it } from 'vitest';
import { testTypeSpecifications } from '../../routes/testResults/specifications.js';
import { isAllowedDocumentMimeType } from '../../routes/documents/fileHelpers.js';
import { TEST_TYPE_ALIASES } from '../readiness/sufficiency/testCategories.js';
import {
  LOGAN_18,
  LOGAN_18_CLAUSE,
  LOGAN_18_SOURCE_PROSE,
  isAmbiguouslyAttributed,
} from './loganPsp5Crosswalk.js';
import {
  CCTV_UPLOAD_SUPPORTED,
  CONCEALED_WORKS_DOCUMENT_TYPE,
  LOGAN_PSP5_ITEMS,
  LOGAN_PSP5_PROFILE_VERSION,
  OM_MANUAL_DOCUMENT_TYPE,
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

const byId = (result: ReturnType<typeof resolveLoganPsp5Profile>, id: LoganPsp5ItemId) => {
  const item = result.items.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`no result for ${id}`);
  return item;
};

// ---------------------------------------------------------------------------
// Premises this module asserts about code it must not import
// ---------------------------------------------------------------------------
describe('premises (the shipped facts the profile encodes)', () => {
  // `CCTV_UPLOAD_SUPPORTED = false` is a constant because production code in
  // `lib/` must not import from `routes/`. This is the assertion that makes the
  // constant honest: when D1d widens the allow set, THIS fails, which is what
  // forces the constant to flip in the same change (AT-149).
  it('the document upload path still accepts no video type, so CCTV_UPLOAD_SUPPORTED is false', () => {
    expect(isAllowedDocumentMimeType('video/mp4')).toBe(false);
    expect(isAllowedDocumentMimeType('video/x-msvideo')).toBe(false);
    expect(CCTV_UPLOAD_SUPPORTED).toBe(false);
  });

  it('the crosswalk expands a source string that says 18, into 18', () => {
    expect(LOGAN_18_SOURCE_PROSE).toContain('18 named categories');
    expect(LOGAN_18).toHaveLength(18);
    expect(LOGAN_18.map((entry) => entry.number)).toEqual(
      Array.from({ length: 18 }, (_, index) => index + 1),
    );
  });

  // Only two sub-clause letters are recorded in D.0. A future agent inventing a
  // plausible `(b)` for the rest is the citation-fabrication this fails on.
  it('only the two items D.0 records a sub-clause letter for carry one', () => {
    const withLetter = LOGAN_PSP5_ITEMS.filter((item) => /\([a-z]\)$/.test(item.clause));
    expect(withLetter.map((item) => item.id)).toEqual([
      'inspection_testing_certificate',
      'cctv_stormwater',
    ]);
    expect(withLetter.map((item) => item.clause)).toEqual(['5.6.5(1)(a)', '5.6.5(1)(e)']);
    expect(LOGAN_18_CLAUSE).toBe('5.6.5(1)');
  });
});

// ---------------------------------------------------------------------------
// AT-144 — the requirement profile is executable
// ---------------------------------------------------------------------------
describe('AT-144 the requirement profile is executable', () => {
  it('resolves all seven PSP5 items, each with a status and a reason', () => {
    const result = resolveLoganPsp5Profile(input({ tests: [COMPACTION_TEST] }));
    expect(result.profileVersion).toBe(LOGAN_PSP5_PROFILE_VERSION);
    expect(result.items).toHaveLength(7);
    expect(result.items.map((item) => item.number)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    for (const item of result.items) {
      expect(['present', 'missing', 'not_applicable', 'not_assessable']).toContain(item.status);
      expect(item.reason.length).toBeGreaterThan(0);
    }
  });

  // The `[DR2-B1]` guard. A profile whose item count or version changes without a
  // test change fails; so does one that promotes a gap to a fed status.
  it('pins the item count, the profile version and the honest coverage distribution', () => {
    expect(LOGAN_PSP5_ITEMS).toHaveLength(7);
    expect(LOGAN_PSP5_PROFILE_VERSION).toBe('logan-psp5.v1');
    const distribution = LOGAN_PSP5_ITEMS.reduce<Record<string, number>>((counts, item) => {
      counts[item.coverage] = (counts[item.coverage] ?? 0) + 1;
      return counts;
    }, {});
    // Spec §2.2, re-scored: one shipped-as-storage, three partial, three gaps
    // (two deliberate, one closable). NOTHING is `shipped`.
    expect(distribution).toEqual({
      storage_only: 1,
      partial: 3,
      gap_deliberate: 2,
      gap_closable: 1,
    });
    expect(distribution.shipped).toBeUndefined();
  });

  it('every item carries a clause and clause text', () => {
    for (const item of LOGAN_PSP5_ITEMS) {
      expect(item.clause).toMatch(/^5\.6\.5/);
      expect(item.clauseText.length).toBeGreaterThan(10);
      expect(item.coverageNote.length).toBeGreaterThan(10);
    }
  });

  // The load-bearing honesty assertion: the two permanent gaps cannot be fed by
  // ANY input, so no fixture and no future data can make the folio imply CIVOS
  // produced the consultant's certificate or the surveyor's asset list.
  it('items 1 and 6 are structurally incapable of returning present', () => {
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
        { id: 'doc-cert', documentType: 'certificate', captureTimestamp: null },
        { id: 'doc-asset', documentType: 'general', captureTimestamp: null },
        { id: 'doc-om', documentType: OM_MANUAL_DOCUMENT_TYPE, captureTimestamp: null },
      ],
    });
    for (const result of [resolveLoganPsp5Profile(EMPTY), resolveLoganPsp5Profile(maximal)]) {
      expect(byId(result, 'inspection_testing_certificate').status).toBe('not_applicable');
      expect(byId(result, 'asset_list').status).toBe('not_applicable');
    }
    // And the verdicts are identical whatever the input, i.e. constants.
    expect(byId(resolveLoganPsp5Profile(EMPTY), 'asset_list')).toEqual(
      byId(resolveLoganPsp5Profile(maximal), 'asset_list'),
    );
  });

  // Spec §2.3: "the folio says 'CIVOS cannot yet hold this file type', not
  // 'missing'. Blaming the customer for a gap we own is the worst thing this
  // document could do."
  it('item 4 (CCTV) reports a CIVOS capability gap, never a missing deliverable', () => {
    const item = byId(resolveLoganPsp5Profile(EMPTY), 'cctv_stormwater');
    expect(item.status).toBe('not_assessable');
    expect(item.status).not.toBe('missing');
    expect(item.reason).toContain('CIVOS cannot yet hold this file type');
  });

  it('item 3 is not_applicable when nothing failed, and names unlinked failures when something did', () => {
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

  it('item 5 distinguishes "no photos" from "photos, none classified as concealed works"', () => {
    expect(byId(resolveLoganPsp5Profile(EMPTY), 'concealed_works_photos').reason).toContain(
      'No photographs are held',
    );

    const unclassified = byId(
      resolveLoganPsp5Profile(
        input({
          documents: [
            {
              id: 'doc-photo',
              documentType: 'photo',
              captureTimestamp: '2026-07-01T00:00:00.000Z',
            },
          ],
        }),
      ),
      'concealed_works_photos',
    );
    expect(unclassified.status).toBe('not_assessable');
    expect(unclassified.reason).toContain('none classified as concealed works');

    const undated = byId(
      resolveLoganPsp5Profile(
        input({
          documents: [
            { id: 'doc-cw', documentType: CONCEALED_WORKS_DOCUMENT_TYPE, captureTimestamp: null },
          ],
        }),
      ),
      'concealed_works_photos',
    );
    expect(undated.status).toBe('missing');
    expect(undated.named).toEqual(['doc-cw']);

    const good = byId(
      resolveLoganPsp5Profile(
        input({
          documents: [
            {
              id: 'doc-cw',
              documentType: CONCEALED_WORKS_DOCUMENT_TYPE,
              captureTimestamp: '2026-07-01T00:00:00.000Z',
            },
          ],
        }),
      ),
      'concealed_works_photos',
    );
    expect(good.status).toBe('present');
    expect(good.evidenceIds).toEqual(['doc-cw']);
  });

  it('item 7 (O&M) is present-as-supplied, and never implies review', () => {
    const held = byId(
      resolveLoganPsp5Profile(
        input({
          documents: [
            { id: 'doc-om', documentType: OM_MANUAL_DOCUMENT_TYPE, captureTimestamp: null },
          ],
        }),
      ),
      'om_manuals',
    );
    expect(held.status).toBe('present');
    expect(held.reason).toContain('as supplied');
    expect(held.reason).toContain('does not assemble, index or validate');
    expect(byId(resolveLoganPsp5Profile(EMPTY), 'om_manuals').status).toBe('not_assessable');
  });

  it('is deterministic — two resolutions of one input are equal', () => {
    const fixture = input({ tests: [COMPACTION_TEST, UNRESOLVABLE_TEST] });
    expect(resolveLoganPsp5Profile(fixture)).toEqual(resolveLoganPsp5Profile(fixture));
  });
});

// ---------------------------------------------------------------------------
// AT-145 — the Logan-18 crosswalk names what it cannot resolve
// ---------------------------------------------------------------------------
describe('AT-145 the crosswalk names what it cannot resolve', () => {
  // The spec's AT-145 asks that every one of the 18 map to at least one
  // `TestCategory`. SEVEN CANNOT — three name a material "quality" whose
  // constituent tests the clause does not enumerate, one names an application
  // rate, three name hydraulic/water tests CIVOS has no canonical category for.
  // Mapping them anyway is precisely the fake coverage `[DR2-B1]` caught. So the
  // assertion is the honest form of AT-145: mapped, or explicitly unmappable with
  // a reason — never silently empty.
  it('every category is mapped or explicitly unmappable with a reason', () => {
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
    expect(mapped).toHaveLength(11);
    expect(LOGAN_18.length - mapped.length).toBe(7);
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

  // The most important limitation in the table, and it is DERIVED from the table
  // rather than declared per entry, so it cannot drift.
  it('marks as ambiguous every category whose canonical category is shared', () => {
    const ambiguous = LOGAN_18.filter(isAmbiguouslyAttributed).map((entry) => entry.id);
    expect(ambiguous).toEqual([
      'fill_compaction',
      'trench_compaction',
      'subgrade_compaction',
      'cbr15_compaction',
      'subsoil_drain_filter_grading',
      'bedding_grading',
      'base_compaction',
      'subbase_compaction',
    ]);
    // Sole owners of their canonical categories.
    expect(LOGAN_18.filter((e) => e.id === 'subgrade_cbr').every(isAmbiguouslyAttributed)).toBe(
      false,
    );
    expect(LOGAN_18.filter((e) => e.id === 'ac_core_tests').every(isAmbiguouslyAttributed)).toBe(
      false,
    );
  });

  it('a test type outside the crosswalk yields not_assessable NAMING that string', () => {
    const result = resolveLoganPsp5Profile(input({ tests: [COMPACTION_TEST, UNRESOLVABLE_TEST] }));
    const item = byId(result, 'test_results');
    expect(item.status).toBe('not_assessable');
    expect(item.named).toEqual(['CBR']);
    expect(result.logan18.unresolvedTestTypes).toEqual(['CBR']);
  });

  it('never reports a category as missing — CIVOS does not decide which apply', () => {
    for (const fixture of [
      input({ tests: [COMPACTION_TEST] }),
      input({ tests: [COMPACTION_TEST, UNRESOLVABLE_TEST] }),
      input({ tests: [LAB_REFERENCE_TEST] }),
    ]) {
      const item = byId(resolveLoganPsp5Profile(fixture), 'test_results');
      expect(item.status).not.toBe('missing');
      expect(item.reason).toContain("certifying consultant's determination");
    }
    // The one `missing` item 2 may return is "no verified result at all", which
    // names no category.
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

  it('a compaction test evidences all six compaction categories and attributes to none', () => {
    const coverage = resolveLogan18Coverage(input({ tests: [COMPACTION_TEST] }));
    const evidenced = coverage.categories.filter((c) => c.state === 'evidenced');
    expect(evidenced.map((c) => c.id)).toEqual([
      'fill_compaction',
      'trench_compaction',
      'subgrade_compaction',
      'cbr15_compaction',
      'base_compaction',
      'subbase_compaction',
    ]);
    for (const category of evidenced) {
      expect(category.attribution).toBe('ambiguous');
      expect(category.reason).toContain('cannot');
      expect(category.evidenceIds).toEqual(['test-compaction']);
    }
    // Unmappable categories never read as "no evidence" — absence of a mapping is
    // not absence of a test.
    expect(coverage.categories.filter((c) => c.state === 'unmappable')).toHaveLength(7);
    for (const category of coverage.categories.filter((c) => c.state === 'unmappable')) {
      expect(category.reason).toBeTruthy();
    }
  });

  // A pinned ceiling, not a wish. `TEST_TYPE_ALIASES` resolves ONLY `compaction`
  // at this SHA (its own SCOPE note: an alias ships only for a string a lot under
  // a RESOLVED pack can carry). So five of the eleven mapped Logan categories are
  // unreachable through resolution today. When F1 adds a non-compaction alias
  // this fails, which is the prompt to re-read this crosswalk rather than assume
  // it already worked.
  it('records that only compaction-family categories are reachable at this SHA', () => {
    expect([...new Set(Object.values(TEST_TYPE_ALIASES))]).toEqual(['compaction']);
    const reachableEntries = LOGAN_18.filter((entry) =>
      entry.canonicalCategories.includes('compaction'),
    );
    expect(reachableEntries).toHaveLength(6);
  });
});
