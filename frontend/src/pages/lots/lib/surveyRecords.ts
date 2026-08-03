/**
 * Wave C5-c — the lot page's survey vocabulary and supersession grouping.
 *
 * Pure: no React, no fetch. Everything the section renders that could be got
 * WRONG lives here so it can be tested without a DOM.
 *
 * **The one rule this file exists to hold.** A survey record carries two
 * different judgements and they belong to two different parties:
 *
 * - `status` is CIVOS's — *we asked for it, the report arrived, we sent it back
 *   for correction*. It is a lifecycle of ARRIVAL and nothing more: CIVOS does
 *   not accept a survey, because in AU civil the acceptance act is the
 *   hold-point release and the lot conformance
 *   (`docs/research/c5-surveyor-workflow-practice-2026-07-31.md` §4).
 * - `surveyorVerdict` is a licensed third party's, transcribed off their report
 *   by a named CIVOS user.
 *
 * The second must never be rendered in the visual language of the first. A
 * green "CONFORMS" badge is CIVOS asserting the lot conforms; CIVOS holds no
 * level, no deviation and no tolerance for this lot (the backend refuses to
 * store one — `backend/src/routes/surveys/index.ts:109`) and therefore has no
 * standing to assert it. {@link surveyVerdictLabel} returns a label and
 * deliberately returns no colour, no variant and no severity: there is nothing
 * for a caller to accidentally pass to a badge.
 */

import { formatStatusLabel } from '@/lib/statusLabels';

/** The backend's closed status vocabulary (`surveys/statusWorkflow.ts`). */
export const SURVEY_STATUSES = ['requested', 'received', 'returned_for_correction'] as const;
export type SurveyStatus = (typeof SURVEY_STATUSES)[number];

/**
 * The two steps a survey walks, in order, for the progress indicator.
 *
 * `returned_for_correction` is absent on purpose: it is a branch off `received`,
 * not a third step, and drawing it as one would imply every survey passes
 * through it. A returned record renders its state as a label instead.
 */
export const SURVEY_PROGRESS_STEPS = [
  'requested',
  'received',
] as const satisfies readonly SurveyStatus[];

/**
 * States where the lot is still waiting on something.
 *
 * `returned_for_correction` is IN this set, which is the substantive change from
 * the `rejected` it replaced: a rejected record was terminal and stopped
 * counting, but a returned one is a loop — the surveyor has one business day to
 * fix it (TMR Surveying Standards Part 1 §7.6.4) and the corrected report is
 * still outstanding until it arrives as a new revision.
 */
export const SURVEY_OPEN_STATUSES: readonly SurveyStatus[] = [
  'requested',
  'returned_for_correction',
];

export const SURVEY_KIND_LABELS: Readonly<Record<string, string>> = {
  set_out: 'Set-out',
  conformance: 'Conformance',
  as_built: 'As-built',
};

/** The backend's `SURVEY_KINDS`, derived from the labels so the two cannot drift. */
export const SURVEY_KINDS = Object.keys(SURVEY_KIND_LABELS);

/**
 * The backend's `SURVEY_VERDICTS` (`surveys/statusWorkflow.ts`).
 *
 * `not_stated` is in the list and is not a null: "the report gave no verdict" is
 * a fact somebody read off the report, and leaving it unset says only that
 * nobody has transcribed it yet. The editor offers both.
 */
export const SURVEY_VERDICTS = ['conforms', 'does_not_conform', 'qualified', 'not_stated'];

/**
 * Mirrors the backend `SURVEY_DECIDERS` (`routes/surveys/index.ts`). A client
 * gate is an affordance; the route re-checks it on every call.
 */
export const SURVEY_DECIDER_ROLES = ['owner', 'admin', 'project_manager', 'quality_manager'];

/**
 * Mirrors the backend `SURVEY_CREATORS` (`routes/surveys/index.ts:69`) — who may
 * file, edit and attach a report to a survey record.
 *
 * Wider than {@link SURVEY_DECIDER_ROLES} by exactly `site_engineer`: filing a
 * report is a clerical act and survey coordination sits in the site engineer's
 * duty list, while returning a third party's deliverable and superseding a
 * record are judgements. `foreman` is in neither, and no subcontractor role
 * reaches any survey surface.
 */
export const SURVEY_CREATOR_ROLES = [
  'owner',
  'admin',
  'project_manager',
  'site_engineer',
  'quality_manager',
];

/**
 * The body the create route accepts (`createSurveySchema`). Explicit nulls, not
 * absent keys: the backend normalises absent and null identically, and a form
 * that clears a field must send the clearing.
 */
export interface SurveyDraft {
  kind: string;
  status: string;
  reportDocumentId: string | null;
  surveyorName: string | null;
  surveyorCompany: string | null;
  surveyorRegistration: string | null;
  surveyedAt: string | null;
  surveyorVerdict: string | null;
  verdictSourceNote: string | null;
  notes: string | null;
}

/** What PATCH accepts — a draft minus the three fields it refuses. */
export type SurveyPatch = Omit<SurveyDraft, 'kind' | 'status' | 'reportDocumentId'>;

export interface SurveyRecord {
  id: string;
  lotId: string | null;
  kind: string;
  status: string;
  requestedAt: string | null;
  surveyorName: string | null;
  surveyorCompany: string | null;
  surveyorRegistration: string | null;
  surveyedAt: string | null;
  surveyorVerdict: string | null;
  verdictSourceNote: string | null;
  receivedAt: string | null;
  returnReason: string | null;
  supersededById: string | null;
  supersessionReason: string | null;
  notes: string | null;
  createdAt: string;
  reportDocument: { id: string; filename: string; mimeType: string | null } | null;
  requestedBy: { id: string; fullName: string | null } | null;
  receivedBy: { id: string; fullName: string | null } | null;
}

export interface LotDelivery {
  id: string;
  description: string | null;
  supplier: string | null;
  docketNumber: string | null;
  quantity: string | number | null;
  unit: string | null;
  batchRef: string | null;
  docketDocumentId: string | null;
  docketDocument: { id: string; filename: string } | null;
  // `projectId` is what the evidence route needs to queue a docket against this
  // row; the API has always returned it (`DELIVERY_SELECT`) and nothing read it.
  diary: { id: string; date: string; projectId?: string } | null;
}

/** CIVOS's workflow state. The only survey string entitled to a status colour. */
export function surveyStatusLabel(status: string): string {
  return formatStatusLabel(`survey_${status}`);
}

/**
 * The surveyor's stated verdict, as a label and nothing else.
 *
 * Returns `null` when no verdict has been transcribed — a first-class state,
 * not a gap. The caller renders "Not yet transcribed from the report", which is
 * a statement about CIVOS's filing, not about the survey's outcome.
 */
export function surveyVerdictLabel(verdict: string | null | undefined): string | null {
  if (!verdict) return null;
  return formatStatusLabel(`survey_verdict_${verdict}`);
}

/**
 * `not_stated` is a verdict the surveyor's report genuinely did not give, so it
 * is not quotable — "the report states no verdict" is our sentence about their
 * report, not a phrase they wrote. Everything else is quoted verbatim.
 */
export function isQuotableVerdict(verdict: string | null | undefined): boolean {
  return Boolean(verdict) && verdict !== 'not_stated';
}

export function surveyKindLabel(kind: string): string {
  return SURVEY_KIND_LABELS[kind] ?? formatStatusLabel(kind);
}

export function isSurveyOutstanding(status: string): boolean {
  return (SURVEY_OPEN_STATUSES as readonly string[]).includes(status);
}

/**
 * Which CIVOS user stands behind the transcription, and when they put it there.
 *
 * Mirrors the backend `surveyRecordedBy` (`routes/folio/assemble.ts`) exactly —
 * most recent actor wins — so the lot page and the issued folio name the same
 * person. This is the other half of `[C5S-B1]`: a verdict attributed to a
 * surveyor is only checkable if the reader also knows who typed it in.
 */
export function surveyTranscribedBy(record: SurveyRecord): { name: string | null; at: string } {
  if (record.receivedBy && record.receivedAt) {
    return { name: record.receivedBy.fullName, at: record.receivedAt };
  }
  return { name: record.requestedBy?.fullName ?? null, at: record.createdAt };
}

/** A current record and the prior revisions it replaced, newest first. */
export interface SurveyRevisionGroup {
  current: SurveyRecord;
  earlier: SurveyRecord[];
}

/**
 * Group every superseded record under the record that ultimately replaced it.
 *
 * Supersession chains, so A→B→C must land A and B under C rather than leaving
 * B as a second head. Each superseded row is walked forward until it reaches a
 * record with no `supersededById`.
 *
 * Two things this deliberately does NOT do:
 *
 * - **Drop anything.** A record whose replacement is missing from the fetched
 *   page (or whose chain is cyclic — a `CHECK` forbids self-reference but not a
 *   longer loop) becomes its own group instead of vanishing. Superseded survey
 *   records are the evidence that the first result was bad; a grouping function
 *   that silently loses one is worse than no grouping at all.
 * - **Reorder.** Input order is preserved for both heads and their children, so
 *   the API's `createdAt desc` survives to the screen.
 */
export function groupSurveyRevisions(surveys: readonly SurveyRecord[]): SurveyRevisionGroup[] {
  const byId = new Map(surveys.map((survey) => [survey.id, survey]));
  const groups = new Map<string, SurveyRevisionGroup>();
  const order: string[] = [];

  const ensureGroup = (record: SurveyRecord): SurveyRevisionGroup => {
    const existing = groups.get(record.id);
    if (existing) return existing;
    const created: SurveyRevisionGroup = { current: record, earlier: [] };
    groups.set(record.id, created);
    order.push(record.id);
    return created;
  };

  /**
   * Walk to the end of the chain. Bounded by the record count — never spins.
   *
   * The two failure exits are deliberately different. A chain that leaves the
   * page stops at the last record it could reach, so the visible tail still
   * nests correctly. A CYCLE returns the original record, which makes it its
   * own head: resolving a cycle to some arbitrary node in it would make two
   * records each other's parent and list both twice.
   */
  const resolveHead = (record: SurveyRecord): SurveyRecord => {
    const seen = new Set<string>([record.id]);
    let node = record;
    while (node.supersededById) {
      const next = byId.get(node.supersededById);
      if (!next) return node;
      if (seen.has(next.id)) return record;
      seen.add(next.id);
      node = next;
    }
    return node;
  };

  // Heads first, so an unsuperseded record keeps its position in the input
  // order even when a record it replaced appeared earlier in the list.
  for (const survey of surveys) {
    if (!survey.supersededById) ensureGroup(survey);
  }

  for (const survey of surveys) {
    if (!survey.supersededById) continue;
    const head = resolveHead(survey);
    if (head.id === survey.id) {
      // Chain is broken or cyclic: stands alone rather than disappearing.
      ensureGroup(survey);
      continue;
    }
    ensureGroup(head).earlier.push(survey);
  }

  return order.map((id) => groups.get(id)!);
}

/**
 * How many surveys this lot is still waiting on.
 *
 * CURRENT records only, and OPEN only. A superseded record was replaced
 * precisely so it would stop counting; a returned one has NOT been replaced yet
 * and still counts, because the lot is waiting on the corrected report.
 */
export function countOutstandingSurveys(groups: readonly SurveyRevisionGroup[]): number {
  return groups.filter((group) => isSurveyOutstanding(group.current.status)).length;
}

/**
 * Whether "Return for correction" can be offered on this record.
 *
 * Mirrors the backend's transition map: only a `received` record can be referred
 * back, because you cannot return a deliverable that never arrived. A superseded
 * record is history and cannot change state at all.
 *
 * There is deliberately no "accept" counterpart. CIVOS records that the report
 * arrived; whether it is good enough is decided at the hold point, by the party
 * who releases it (research §4.2).
 */
export function canReturnSurvey(record: SurveyRecord): boolean {
  return record.status === 'received' && record.supersededById === null;
}

/**
 * Whether the editor may be opened against this record.
 *
 * Mirrors `assertEditableWhenSuperseded`, and note which half is frozen: the
 * SUPERSEDED record is closed, the current one stays editable in every state.
 * A superseded record is what the record that replaced it was written against,
 * so changing it rewrites history; fixing a mistyped surveyor name on a live
 * record is filing hygiene.
 */
export function canEditSurvey(record: SurveyRecord): boolean {
  return record.supersededById === null;
}

/**
 * Whether a corrected report can still be filed against this record.
 *
 * `returned_for_correction` has no status edge out — the corrected report is a
 * NEW record that supersedes this one — so this is the continuation of the loop,
 * not a second way to change state. The backend refuses to supersede a record
 * that was already superseded (`Only the current survey revision can be
 * superseded`).
 */
export function canSupersedeSurvey(record: SurveyRecord): boolean {
  return record.status === 'returned_for_correction' && record.supersededById === null;
}
