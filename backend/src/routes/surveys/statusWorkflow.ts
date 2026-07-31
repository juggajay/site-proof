/**
 * Wave C5.2 — the survey record's contract, as pure reference data.
 * (`docs/plans/wave-c5-survey-material-traceability-spec-2026-07-31.md` §4.5,
 * restructured 2026-07-31 against
 * `docs/research/c5-surveyor-workflow-practice-2026-07-31.md`.)
 *
 * No DB, no auth, no HTTP. The routes read these; the migration's `CHECK`
 * constraints enforce the vocabularies at the database, which is where a claim
 * like "CIVOS never accepts on its own" has to live if it is to be true.
 *
 * **The survey record is evidence with a lifecycle of ARRIVAL, not a workpiece
 * with a lifecycle of approval** (research §7.1). That single sentence is why
 * this file has three states where C5.2 shipped five.
 */

/**
 * `requested → received`, with `returned_for_correction` reachable from
 * `received`, and **the short paths in the map from day one** `[C5R-A2]`.
 *
 * Retrospective filing is the DOMINANT real case for a survey — the report
 * arrives, and only then does anyone create the record — so a user filing one
 * PDF must not click three buttons. `requested` is optional by construction:
 * the contractual trigger is a lot state ("not later than one working day after
 * the lot has become accessible for survey" — AUS-SPEC C02 cl. 2.7.1, TfNSW G71
 * cl. 5.6.3), not a person, and real requests are verbal (research §1.5, §1.6).
 *
 * Three states the research deleted, and why:
 *
 * - **`in_progress` is gone.** No competitor, no survey software, no AU
 *   specification and no training unit anywhere defines an in-progress survey
 *   state — five independent source types, all negative (research §2.4). What is
 *   partial is COVERAGE, not the job, and coverage is an attribute of a report
 *   nobody has asked CIVOS to hold yet. Deleted rather than renamed: a state no
 *   counterpart system produces a signal for is a state nobody ever sets.
 * - **`accepted` is gone.** Acceptance is real, but it happens on the hold point
 *   and on the lot, never on the survey document. A real AU conformance report
 *   has a surveyor signature block and no approval field at all; MRWA states the
 *   report is *"evidence for the release of hold points"*; CivilPro has no accept
 *   state on its Survey Request and puts `Conformed` on the Lot (research §4.6).
 *   CIVOS already ships both acceptance acts, so this one duplicated them — and
 *   asked a non-surveyor to countersign a document that in Queensland only a
 *   registered surveyor signs.
 * - **`rejected` is now `returned_for_correction`, and is NOT terminal.** No
 *   captured AU document uses "reject" for a survey deliverable; the published
 *   act is *"referred back to the Surveyor responsible for correction or
 *   clarification… actioned within one business day"* (TMR Surveying Standards
 *   Part 1 §7.6.4), and three receiving entities publish *"returned for
 *   correction and re-submission"* (research §5.6). In AU civil `Rejected` is a
 *   LOT status.
 *
 * **There is deliberately no edge OUT of `returned_for_correction`.** The AU
 * idiom for a redo is a new, renumbered artifact cross-referenced to its
 * predecessor — *"Reworked or subdivided lots shall be renumbered and shall be
 * cross referenced to the original lot number"* (MRTS50 cl. 7.2); *"Each
 * revision of an ADAC Submission must be accompanied by a newly completed
 * checklist"* (Moreton Bay). So a corrected report is a NEW record that
 * SUPERSEDES the returned one (`POST /api/surveys/:id/supersede`), not the same
 * row flipped back to `received`. Letting the row flip back would overwrite the
 * evidence that the first result was wrong, which is the one thing the
 * supersession chain exists to prevent.
 */
export const VALID_SURVEY_TRANSITIONS: Record<string, string[]> = {
  requested: ['received'],
  received: ['returned_for_correction'],
  // Not terminal — continued by a NEW record that supersedes this one.
  returned_for_correction: [],
};

export const SURVEY_STATUSES = Object.keys(VALID_SURVEY_TRANSITIONS);

/** Three, because they are three different contractual acts. */
export const SURVEY_KINDS = ['set_out', 'conformance', 'as_built'];

/**
 * `[C5S-B1]`. This is a TRANSCRIPTION of what the report says, never a CIVOS
 * finding. `'not_stated'` is first-class so "the report gave no verdict" is a
 * recordable fact rather than a gap somebody backfills with a guess.
 *
 * Deliberately NOT required at `received`. The one real AU conformance report in
 * the corpus was 20% within tolerance and 70% too high — it is a trim
 * instruction, not a verdict (research §3.3) — and transcribing a verdict is a
 * later reading act than recording that the report arrived.
 */
export const SURVEY_VERDICTS = ['conforms', 'does_not_conform', 'qualified', 'not_stated'];

/**
 * Statuses at or past "the report is in", which therefore need the report.
 *
 * `returned_for_correction` is here because you can only return a deliverable
 * that arrived — and the state is reachable directly on create `[C5R-A2]`.
 */
export const SURVEY_STATUSES_REQUIRING_REPORT = new Set(['received', 'returned_for_correction']);

/**
 * Statuses that require a named surveyor.
 *
 * Inherited from the deleted `accepted` gate and re-aimed at arrival: the
 * certifying party on an AU conformance report is the surveyor, full stop
 * (research §4.1 — the artifact's signature block is `Surveyor / Date /
 * Signature`, and certification is registration-gated). A received report
 * attributed to nobody is not evidence.
 */
export const SURVEY_STATUSES_REQUIRING_SURVEYOR = SURVEY_STATUSES_REQUIRING_REPORT;

/**
 * States where the lot is still waiting on something.
 *
 * This replaces `SURVEY_TERMINAL_STATUSES`, and the swap is the point:
 * `rejected` used to close a record, so a rejected survey stopped counting.
 * A returned one has NOT stopped — the corrected report is still outstanding
 * (research §5.6: the return is a loop with a one-business-day clock, not a dead
 * end). `received` is the end of the arrival lifecycle; what happens next is the
 * hold point's business, not this record's.
 */
export const SURVEY_OPEN_STATUSES = new Set(['requested', 'returned_for_correction']);

/**
 * Fields that are ABOUT a survey record but say nothing about the evidence it
 * files. Editing one must not be refused on a frozen record; editing anything
 * else must be.
 *
 * A MODULE-LEVEL EXPORTED CONST, deliberately. C2's equivalent
 * (`testResults/crudRoutes.ts`) is declared **inside** its PATCH handler and
 * nothing imports it, so it cannot be reused or asserted — `[C5R-A1]`, and it
 * is what cost C3 a review round.
 *
 * It has exactly one member, and that is not an oversight. Everything else on
 * this row is attribution, verdict, file link or lifecycle — all of which the
 * record that replaced this one was written against. `verdictSourceNote` is
 * deliberately NOT here: it is the citation for the verdict, so editing it after
 * the record became history changes what the successor was written against.
 * Adding a field here is asserting "this is not evidence"; add one only with
 * that sentence in mind.
 */
export const NON_SUBSTANTIVE_SURVEY_EDIT_FIELDS = ['notes'];

/**
 * §11 `[C5R-N6]` — copied verbatim from `readinessSnapshotsEnabled()`
 * (`lib/readiness/recordDecision.ts`), whose header mandates exactly this:
 * "default FALSE everywhere, including production. Enabling is an explicit,
 * logged rollout step — never an implicit environment default."
 *
 * A `!== 'false'` idiom would default the flag ON in every environment that has
 * not set it, which inverts the gate `[C5S-B4]` depends on.
 */
export function surveyRecordsEnabled(): boolean {
  const configured = process.env.C5_SURVEY_RECORDS_ENABLED?.trim().toLowerCase();
  return configured === 'true' || configured === '1' || configured === 'yes';
}
