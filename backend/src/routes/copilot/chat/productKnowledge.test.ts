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
  ['deliveries', 'Deliveries and materials'],
  ['claims-reports', 'Claims, variations, costs, and reports'],
  ['handover', 'Handover and the evidence folio'],
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

  // -------------------------------------------------------------------------
  // Wave E exit item 13 — the automatic chase reaches the mirror. Before this,
  // `grep -inE "chase|remind|digest|daily limit|awaiting"` returned ZERO hits in
  // this file, so Clancy described the manual flow with total confidence and did
  // not know an automatic one had shipped. Every sentence below is cited to the
  // code that makes it true.
  // -------------------------------------------------------------------------
  it('names the ONE awaiting-release status, not a second list', () => {
    // predicates.ts:143 AWAITING_RELEASE_HOLD_POINT_STATUSES = ['notified'].
    // `[E-B1]`: one definition, imported by the scan and the chase alike.
    expect(body('itp-holdpoints-tests')).toContain('sits at Notified until it is released');
  });

  it('states the canary gate — the automation is inert until a project is named', () => {
    // holdPointChaseAutomation.ts:57 + :313 `if (scopedIds.length === 0) return`,
    // and systemAutomation.ts:61 for the alert arm. Unset/blank/separator-only
    // all parse to [] (AT-113). Promising the chase unconditionally would be
    // false on every project today.
    const itp = body('itp-holdpoints-tests');
    expect(itp).toContain('only on projects that have been switched on for it by name');
    expect(itp).toContain('nothing is sent automatically and you chase manually as before');
  });

  it('states the cadence and the per-request cap exactly', () => {
    // REMINDER_DUE_LEAD_WORKING_DAYS = 1 (:60),
    // REMINDER_OVERDUE_INTERVAL_WORKING_DAYS = 2 (:63),
    // chaseCore.ts:44 MAX_CHASES_PER_REQUEST = 3, capped PER GENERATION —
    // a new release request resets it (AT-114 case 3).
    const itp = body('itp-holdpoints-tests');
    expect(itp).toContain('one working day before the scheduled release date');
    expect(itp).toContain('every two working days while it stays overdue');
    expect(itp).toContain('up to three reminders per release request');
    expect(itp).toContain('Requesting release again starts a fresh request with a fresh three');
  });

  it('states the digest and the daily limit as ONE email, not N', () => {
    // MAX_REMINDER_EMAILS_PER_RECIPIENT_PER_PROJECT_PER_DAY = 1 (:66) enforced by
    // isWithinDailyLimit (:277); the digest is one envelope with per-item tokens
    // (holdPointChaseAutomationGroup.ts:140). AT-116 measured 7 -> 1.
    const itp = body('itp-holdpoints-tests');
    expect(itp).toContain('one email per recipient per project per day');
    expect(itp).toContain('each with its own live release link');
    expect(itp).toContain('They never get a second message that day');
  });

  it('names the four things that stop the reminders', () => {
    // E.0 item 11's four termination events, one test each in
    // holdPointChaseAutomation.db.test.ts: released, new generation, closed
    // project, address removed from notificationSentTo.
    expect(body('itp-holdpoints-tests')).toContain(
      'Releasing the hold point, re-requesting it, closing the project, or removing that address from the notification list all stop the reminders',
    );
  });

  it('states the post-E.0a disclosure limits on a public link', () => {
    // publicReleasePayload.ts:137 no longer passes notificationSentTo (row 4a),
    // which also starves the PDF's "Recipient of Record" row (4c), and
    // publicBatchRoutes.ts:144 resolves requestedBy to `fullName || 'Site Team'`
    // with the email no longer selected (4d). The single public payload carries
    // no requester field at all.
    const itp = body('itp-holdpoints-tests');
    expect(itp).toContain('It does not show them the other addresses the request went to');
    expect(itp).toContain('never shows the email address of the person who requested release');
    expect(itp).toContain('name that person or say Site Team');
  });

  it('states where a reply goes, and names the fallback rather than faking it', () => {
    // chaseCore.ts resolveHoldPointRequester (:401) — audit lookup, company
    // support on a missing/inactive/deleted user, and `[E-B8b]` forbids
    // attributing the request to someone who did not make it (AT-115).
    expect(body('itp-holdpoints-tests')).toContain(
      'Replies to a hold point email reach the person who requested the release',
    );
    expect(body('itp-holdpoints-tests')).toContain('company support, and the email says so');
  });

  it('states the internal stale alert and its severities', () => {
    // systemAutomation.ts:307-310 — hoursStale from scheduledDate, >48 critical,
    // >24 high. The scan threshold is one day (:252), so `medium` is unreachable
    // on this path and the copy must not promise it.
    expect(body('itp-holdpoints-tests')).toContain(
      'raises an internal Hold Point stale alert to the project team, at high severity and critical once it is two days past',
    );
  });

  it('says the recipient-scoped queue is NOT built — the anti-fabrication line', () => {
    // E3 was specified, costed and deferred (`[E-g]`). No HoldPointReviewQueue
    // model exists. Without this sentence Clancy invents a superintendent portal
    // on request, which is the exact failure the mirror exists to prevent.
    expect(body('itp-holdpoints-tests')).toContain(
      'There is no CIVOS inbox or queue for them to sign into',
    );
    // The clause after it, which neither this pin nor the frontend mirror
    // guarded until now: "no inbox" was covered, "no cross-project list" was
    // not — and a list of everything a superintendent owes across projects is
    // precisely the plausible-sounding feature Clancy would invent.
    expect(body('itp-holdpoints-tests')).toContain(
      'no list of everything they owe you across projects',
    );
  });
});

// ---------------------------------------------------------------------------
// Deliveries and handover. Same discipline as the blocks above: Clancy could
// not answer "is that load's docket on file?" or "how do I hand the job over?"
// at all before this, and an AI filling a knowledge gap from plausibility is
// the exact failure the mirror exists to prevent. Every expectation is cited to
// the code that makes it true.
// ---------------------------------------------------------------------------
describe('product knowledge — deliveries and handover facts', () => {
  const body = (slug: string) => getHelpTopic(slug)?.body ?? '';

  it('keeps a typed docket number from reading as filed evidence', () => {
    // deliveries/index.ts:141,179 DOCKET_FILTERS test `docketDocumentId` only;
    // docketFilingState.ts:40-61 names it the ONLY input. `docketNumber` is
    // free text, so conflating the two would report evidence that is not held.
    expect(body('deliveries')).toContain(
      'means the actual supplier docket document is attached. A typed docket number alone does not count',
    );
  });

  it('states the counters are project-wide, not filter-scoped', () => {
    // deliveries/index.ts:249-250 count on `{ diary: { projectId } }` with no
    // filter spread, unlike `total` (:248) which uses the filtered `where`.
    expect(body('deliveries')).toContain('project-wide totals that filters never shrink');
  });

  it('names the exact three fields the after-lock route may touch', () => {
    // deliveries/index.ts:109 EVIDENCE_FIELDS = docketDocumentId, batchRef,
    // lotId, with a `.strict()` body schema (:112-118) — an unknown key is a
    // 400. Widening this copy would promise a diary edit the lock forbids.
    expect(body('deliveries')).toContain(
      'The supplier docket, batch reference, and lot link can be attached to a delivery after the diary has locked — only those three evidence fields',
    );
    expect(body('deliveries')).toContain('every change is written to the audit log');
  });

  it('keeps an unlinked delivery advisory — it gates nothing', () => {
    // evidenceReadiness/deliveryItems.ts:16-30 severity 'support',
    // blocksAction: false, and it is absent from HANDOVER_BLOCKING_REASON_CODES.
    expect(body('deliveries')).toContain(
      'raises a support-level readiness prompt. It never blocks conformance or a claim',
    );
  });

  it('states the NCR delivery link is create-only', () => {
    // ncrCoreValidation.ts:124-126 — linkedDeliveryId is in createNcrSchema and
    // deliberately absent from updateNcrSchema; no update path references it.
    expect(body('deliveries')).toContain('The link is set at creation only');
  });

  it('states the register sorts by diary date, not created-at', () => {
    // deliveries/index.ts:244 orderBy [{ diary: { date: 'desc' } }, { id: 'asc' }].
    expect(body('deliveries')).toContain(
      'sorts by the diary date the delivery was recorded against',
    );
  });

  it('keeps the register internal-only', () => {
    // Both register endpoints call requireInternalProjectAccess
    // (deliveries/index.ts:203,227), which 403s a portal identity.
    expect(body('deliveries')).toContain('Deliveries are internal. Subcontractors never see');
  });

  it('describes what a folio actually contains, without overstating it', () => {
    // folioPayload.ts:176-191 collections; folioRenderer.ts:286-402 prints ALL
    // hold points with a Released column, and documents/photos are a
    // filename/type/captured TABLE — nothing is embedded. Survey records are
    // omitted on purpose: they are gated on C5_SURVEY_RECORDS_ENABLED, off in
    // production, so naming them would describe a feature no user can see.
    const handover = body('handover');
    expect(handover).toContain('a listing of the documents and photos held');
    expect(handover).not.toContain('survey');
  });

  it('states the folio hash and that versions are append-only', () => {
    // folioStorage.ts:64-66 sha256 over the PDF bytes, surfaced in
    // EvidenceFolioSection.tsx:132-138. issuance.ts:104-108 takes MAX+1 under a
    // @@unique([lotId, version]); the folio_issues_reject_update trigger makes
    // an overwrite impossible at the database level.
    const handover = body('handover');
    expect(handover).toContain('SHA-256 hash shown in the app');
    expect(handover).toContain('Version numbers are never reused and old versions are never');
  });

  it('states the row ceiling as a refusal, not a truncation', () => {
    // assemble.ts:52 FOLIO_EVIDENCE_ROW_CEILING_DEFAULT = 5000; :509-520 throws
    // FOLIO_EVIDENCE_CEILING_EXCEEDED inside the session transaction, so no
    // partial folio is ever issued. Silently omitting records is the failure.
    expect(body('handover')).toContain(
      'above 5,000 evidence rows it refuses to issue rather than silently omit records',
    );
  });

  it('keeps the closeout nudge a nudge', () => {
    // HandoverExportPage.tsx:139-158 — "a nudge, never a gate"; the request
    // button never disables on folio coverage and the manifest records
    // lotsWithoutFolio (exportRunner.ts:202).
    expect(body('handover')).toContain('nudges when lots lack an evidence folio, but it never');
  });

  it('states expiry as a download-time refusal that a legal hold overrides', () => {
    // download.ts:161-168 — expiry is consulted ON READ, not only by the
    // sweeper, and `!(await isOnHold('handover_export', row.id))` is the last
    // conjunct, so a held export skips the check and still streams. Copy that
    // said "expires" without the hold would send someone hunting for a file
    // they can still download.
    expect(body('handover')).toContain(
      'expires on its stated date and can no longer be downloaded after that — unless a legal hold has been placed on it, which keeps it downloadable',
    );
  });

  it('separates who can request an export from who can download one', () => {
    // folio/access.ts:23 FOLIO_ISSUERS and handoverExports/access.ts:27
    // HANDOVER_EXPORT_REQUESTERS are the same four. Downloading is NARROWER:
    // download.ts:50 HANDOVER_EXPORT_DOWNLOADERS omits quality_manager, and
    // :145 admits the requester by id — `row.requestedById !== user.id &&
    // !DOWNLOADERS.includes(role)` is the 403. Collapsing the two into one
    // four-role sentence tells a QM they can take the package away when they
    // cannot, unless they requested it themselves.
    const handover = body('handover');
    expect(handover).toContain(
      'Requesting an export and issuing folios is owner, admin, project manager, and quality manager',
    );
    expect(handover).toContain(
      'Downloading a handover export is owner, admin, and project manager — plus the person who requested that export',
    );
  });
});
