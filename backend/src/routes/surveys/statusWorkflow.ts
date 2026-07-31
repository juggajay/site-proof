/**
 * Wave C5.2 — the survey record's contract, as pure reference data.
 * (`docs/plans/wave-c5-survey-material-traceability-spec-2026-07-31.md` §4.5.)
 *
 * No DB, no auth, no HTTP. The routes read these; the migration's `CHECK`
 * constraints enforce the vocabularies at the database, which is where a claim
 * like "CIVOS never accepts on its own" has to live if it is to be true.
 */

/**
 * `requested → in_progress → received → accepted`, with `rejected` reachable
 * from `received`, and **the short paths in the map from day one** `[C5R-A2]`.
 *
 * C2 shipped its equivalent without them and had to widen it additively later.
 * Retrospective filing is the DOMINANT real case for a survey — the report
 * arrives, and only then does anyone create the record — so a user filing one
 * PDF must not click three buttons. The gates below still apply to every edge,
 * so a short path cannot skip the report or the verdict.
 */
export const VALID_SURVEY_TRANSITIONS: Record<string, string[]> = {
  requested: ['in_progress', 'received', 'accepted'],
  in_progress: ['received', 'accepted'],
  received: ['accepted', 'rejected'],
  accepted: [], // Terminal
  rejected: [], // Terminal
};

export const SURVEY_STATUSES = Object.keys(VALID_SURVEY_TRANSITIONS);

/** Three, because they are three different contractual acts. */
export const SURVEY_KINDS = ['set_out', 'conformance', 'as_built'];

/**
 * `[C5S-B1]`. This is a TRANSCRIPTION of what the report says, never a CIVOS
 * finding. `'not_stated'` is first-class so "the report gave no verdict" is a
 * recordable fact rather than a gap somebody backfills with a guess.
 */
export const SURVEY_VERDICTS = ['conforms', 'does_not_conform', 'qualified', 'not_stated'];

/** Statuses at or past "the report is in", which therefore need the report. */
export const SURVEY_STATUSES_REQUIRING_REPORT = new Set(['received', 'accepted']);

export const SURVEY_TERMINAL_STATUSES = new Set(['accepted', 'rejected']);

/**
 * Fields that are ABOUT a survey record but say nothing about the evidence it
 * files. Editing one must not be refused on an accepted record; editing
 * anything else must be.
 *
 * A MODULE-LEVEL EXPORTED CONST, deliberately. C2's equivalent
 * (`testResults/crudRoutes.ts`) is declared **inside** its PATCH handler and
 * nothing imports it, so it cannot be reused or asserted — `[C5R-A1]`, and it
 * is what cost C3 a review round.
 *
 * It has exactly one member, and that is not an oversight. Everything else on
 * this row is attribution, verdict, file link or lifecycle — all of which an
 * accepted record's acceptance rests on. `verdictSourceNote` is deliberately
 * NOT here: it is the citation for the verdict, so editing it after acceptance
 * changes what the acceptance was made against. Adding a field here is
 * asserting "this is not evidence"; add one only with that sentence in mind.
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
