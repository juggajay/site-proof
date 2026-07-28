import { describe, expect, it } from 'vitest';

import { HELP_TOPICS, HELP_TOPIC_SLUGS, getHelpTopic } from './productKnowledge.js';

// ---------------------------------------------------------------------------
// PINNED MIRROR — this list must equal documentationSections in
// frontend/src/pages/docs/documentationContent.ts, pinned there in
// documentationContent.test.ts. Backend vitest cannot import the frontend
// module, so the two pins are the drift guard: change the docs sections and
// both this test and the frontend one fail until updated together. Keep the
// slug (= section id) and title in the same order as the frontend sections.
// ---------------------------------------------------------------------------
const PINNED_TOPICS: ReadonlyArray<[slug: string, title: string]> = [
  ['projects-lots', 'Projects and lots'],
  ['site-map', 'Site map and lot geometry'],
  ['readiness', 'Evidence Readiness'],
  ['itp-holdpoints-tests', 'ITPs, hold points, and test results'],
  ['subbie-dockets', 'Subcontractor portal and dockets'],
  ['documents-drawings', 'Documents, drawings, and photos'],
  ['ncr-diary', 'NCRs and daily diary'],
  ['claims-reports', 'Claims, variations, costs, and reports'],
  ['admin', 'Admin, audit, and settings'],
  ['ai-copilot', 'AI in CIVOS: setup copilot and Clancy'],
  ['integrations', 'Integrations: API keys and webhooks'],
];

describe('product knowledge — pinned mirror of the docs sections', () => {
  it('has the exact topics in the same order as documentationSections', () => {
    expect(HELP_TOPICS.map((t) => [t.slug, t.title])).toEqual(PINNED_TOPICS);
  });

  it('exposes the slugs for the get_help enum', () => {
    expect(HELP_TOPIC_SLUGS).toEqual(PINNED_TOPICS.map(([slug]) => slug));
  });

  it('has unique slugs and a non-empty body per topic', () => {
    expect(new Set(HELP_TOPIC_SLUGS).size).toBe(HELP_TOPIC_SLUGS.length);
    for (const topic of HELP_TOPICS) {
      expect(topic.body.trim().length).toBeGreaterThan(0);
    }
  });

  it('resolves a known slug and returns undefined for an unknown one', () => {
    expect(getHelpTopic('readiness')?.title).toBe('Evidence Readiness');
    expect(getHelpTopic('nope')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Wave C1 — the test-frequency facts Clancy answers from. Each expectation is a
// claim about the SHIPPED engine, cited to the code that makes it true. This is
// user-facing copy delivered by an AI, so a fact that quietly drifts out of the
// body is a fabrication with no other guard. If one of these fails, recheck the
// engine and correct the copy — do not delete the assertion.
// ---------------------------------------------------------------------------
describe('product knowledge — test sufficiency facts', () => {
  const body = (slug: string) => getHelpTopic(slug)?.body ?? '';

  it('names both shipped rulesets and what they govern', () => {
    // rulesets/vicroads-204.v2.ts (vic/vicroads, earthworks activity slugs) and
    // rulesets/tfnsw-q6.v1.ts (nsw/tfnsw, earthworks + pavement rules).
    expect(body('readiness')).toContain(
      'VicRoads Section 204 for Victorian earthworks, TfNSW Q6 for NSW earthworks and pavements',
    );
  });

  it('states the VicRoads counts and default scale exactly', () => {
    // vicroads-204.v2.ts `minCountByScale: { A: 6, B: 6, C: 3 }`, `defaultScale: 'A'`.
    expect(body('readiness')).toContain(
      '6 compaction tests on Compaction Scale A or B and 3 on Scale C',
    );
    expect(body('readiness')).toContain(
      'Scale A applies where the specification does not state one',
    );
  });

  it('uses the NSW pack label for the scale field', () => {
    // tfnsw-q6.v1.ts `scaleLabel: 'Specified relative compaction'`.
    expect(body('readiness')).toContain('Specified relative compaction');
  });

  it('keeps frequency checking advisory and block per-project', () => {
    // schema.prisma testSufficiencyMode @default("warn"); resolve.ts never
    // falls back to 'block'; evaluate.ts sufficiencyBlocks gates conformance.
    expect(body('readiness')).toContain('advisory on every project today');
    expect(body('admin')).toContain('off, warn, or block, and is set per project');
  });

  it('states what counts and that lab reference tests never do', () => {
    // testCategories.ts maps 'density ratio' / 'as 1289.5.4.1' / 'rc 316.00' to
    // `compaction`; LAB_REFERENCE_TOKENS + candidateCategories exclude MDD.
    const itp = body('itp-holdpoints-tests');
    expect(itp).toContain('Density Ratio, AS 1289.5.4.1, and RC 316.00 all count as compaction');
    expect(itp).toContain('never count toward the field test number');
  });

  it('states the lab wait honestly — no invented turnaround (Wave C2 Phase 3, J5)', () => {
    // constants.ts getLabWait: overdue requires a USER-supplied expectedResultDate.
    // A blank date must never read as late in Clancy's copy either.
    const itp = body('itp-holdpoints-tests');
    expect(itp).toContain('Send to lab records that a sample went to a laboratory');
    expect(itp).toContain('CIVOS never assumes a turnaround');
    expect(itp).toContain('a blank date shows elapsed days only and is never flagged late');
  });

  it('explains "Verified tests not counted" as an unrecognised type, not a missing link', () => {
    // conformanceItems.ts `tests_unlinked_to_itp_item` detail — the "not linked
    // to a checklist item" copy was retired at F1.2.
    expect(body('itp-holdpoints-tests')).toContain(
      'means the test type is not recognised, not that the test is unlinked',
    );
  });

  it('routes the unknown state to the lot edit inputs', () => {
    // conformanceItems.ts `test_sufficiency_unknown` + unknownCausePrompt.
    expect(body('readiness')).toContain('"Test frequency cannot be checked"');
    expect(body('readiness')).toContain(
      'Set the lot activity, testing scale, and quantity, or draw the lot geometry, on the lot edit page',
    );
  });

  // -------------------------------------------------------------------------
  // Wave C3 exit item 12. Same discipline as the C1 block above: every sentence
  // is a claim about shipped code, cited to the file that makes it true. The
  // overlay and the sample point are the two things a QM asks Clancy about the
  // moment they arm the layer, and a fabricated answer here has no other guard.
  // -------------------------------------------------------------------------
  it('names the overlay layers on the map tool list', () => {
    // LotMapView.tsx toolbar items 9 and 10: `label="Testing"`, `label="Test pins"`.
    expect(body('site-map')).toContain('Use Testing to recolour drawn lots by test frequency');
    expect(body('site-map')).toContain('Test pins to show where samples were taken');
  });

  it('states the overlay verdict labels and that grey is a verdict, not a gap', () => {
    // frontend testCoverageData.ts TEST_COVERAGE_LEGEND — the three shipped
    // labels, Okabe-Ito palette; the state union has no fourth value.
    const map = body('site-map');
    expect(map).toContain('green for Testing satisfied');
    expect(map).toContain('amber for Fewer tests than required');
    expect(map).toContain('grey for No rule');
  });

  it('keeps undrawn lots counted-not-coloured and the overlay internal-only', () => {
    // projectTestCoverage.ts: `requireInternalProjectAccess` (J3, spec §10.1) and
    // `lotsWithoutGeometry`, rendered as "N lots not on the map — not drawn, so
    // not coloured." LotMapView hides both toggles while History is armed.
    const map = body('site-map');
    expect(map).toContain('Lots that are not drawn are counted, not coloured');
    expect(map).toContain('internal layer that subcontractors never see');
    expect(map).toContain('unavailable in History');
  });

  it('states that no sample location is ever derived — the [C3S-B1] honesty rule', () => {
    // frontend lib/samplePoint.ts `readSamplePoint` returning null is the only
    // gate for a pin (LotMapView AT-84): no centroid, no parse of the
    // `sampleLocation` free text, no default.
    const map = body('site-map');
    expect(map).toContain('shows a pin only where someone captured a sample point');
    expect(map).toContain('counted toward the frequency but never drawn');
    expect(body('itp-holdpoints-tests')).toContain('CIVOS never derives a sample location');
  });

  it('states capture is optional and names the GPS accuracy refusal', () => {
    // samplePoint.ts MAX_ACCURACY_M = 30 + tooCoarseMessage(); a map pick writes
    // `accuracyM: null` (SampleLocationCapture.tsx CapturedSamplePoint).
    const itp = body('itp-holdpoints-tests');
    expect(itp).toContain('optional and blocks nothing');
    expect(itp).toContain('a GPS fix coarser than 30 m is refused');
    expect(itp).toContain('a map pick carries no accuracy figure');
  });

  it('keeps reduced frequency advisory and VicRoads-only', () => {
    // vicroads-204.v2.ts `reducedFrequencyEligibility.consecutiveConformingLots: 3`;
    // tfnsw-q6.v1.ts ships no reduced limb.
    expect(body('readiness')).toContain(
      'After three consecutive conforming lots a VicRoads lot can become eligible to request a reduced frequency',
    );
    expect(body('readiness')).toContain('never reduces the count itself');
  });
});
