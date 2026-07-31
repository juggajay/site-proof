/**
 * Wave C5-c — the lot page's survey vocabulary and supersession grouping.
 *
 * Pure: no React, no fetch. Everything the section renders that could be got
 * WRONG lives here so it can be tested without a DOM.
 *
 * **The one rule this file exists to hold.** A survey record carries two
 * different judgements and they belong to two different parties:
 *
 * - `status` is CIVOS's — *we received the report, we accepted it as evidence*.
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
export const SURVEY_STATUSES = [
  'requested',
  'in_progress',
  'received',
  'accepted',
  'rejected',
] as const;
export type SurveyStatus = (typeof SURVEY_STATUSES)[number];

/**
 * The four steps a survey walks, in order, for the progress indicator.
 *
 * `rejected` is absent on purpose: it is a terminal branch off `received`, not
 * a fifth step, and drawing it as one would imply every survey passes through
 * it. A rejected record renders its state as a label instead of a stepper.
 */
export const SURVEY_PROGRESS_STEPS = [
  'requested',
  'in_progress',
  'received',
  'accepted',
] as const satisfies readonly SurveyStatus[];

/** Terminal states — the record is done and nothing is outstanding on it. */
export const SURVEY_TERMINAL_STATUSES: readonly SurveyStatus[] = ['accepted', 'rejected'];

export const SURVEY_KIND_LABELS: Readonly<Record<string, string>> = {
  set_out: 'Set-out',
  conformance: 'Conformance',
  as_built: 'As-built',
};

/**
 * Mirrors the backend `SURVEY_ACCEPTORS` (`routes/surveys/index.ts`). A client
 * gate is an affordance; the route re-checks it on every call.
 */
export const SURVEY_ACCEPTOR_ROLES = ['owner', 'admin', 'project_manager', 'quality_manager'];

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
  reviewedAt: string | null;
  acceptedAt: string | null;
  rejectionReason: string | null;
  supersededById: string | null;
  supersessionReason: string | null;
  notes: string | null;
  createdAt: string;
  reportDocument: { id: string; filename: string; mimeType: string | null } | null;
  requestedBy: { id: string; fullName: string | null } | null;
  reviewedBy: { id: string; fullName: string | null } | null;
  acceptedBy: { id: string; fullName: string | null } | null;
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
  diary: { id: string; date: string } | null;
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

export function isTerminalSurvey(status: string): boolean {
  return (SURVEY_TERMINAL_STATUSES as readonly string[]).includes(status);
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
  if (record.acceptedBy && record.acceptedAt) {
    return { name: record.acceptedBy.fullName, at: record.acceptedAt };
  }
  if (record.reviewedBy && record.reviewedAt) {
    return { name: record.reviewedBy.fullName, at: record.reviewedAt };
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
 * CURRENT records only, and NON-TERMINAL only. A superseded record was replaced
 * precisely so it would stop counting, and a rejected one is closed — counting
 * either would make the badge a number nobody can act on.
 */
export function countOutstandingSurveys(groups: readonly SurveyRevisionGroup[]): number {
  return groups.filter((group) => !isTerminalSurvey(group.current.status)).length;
}

/**
 * Whether "Accept evidence record" can be offered.
 *
 * Mirrors the backend's `assertAcceptable` (`routes/surveys/index.ts`): a
 * surveyor AND a transcribed verdict. `not_stated` satisfies the second — the
 * requirement is that a human read the report and recorded what it said, and
 * "it said nothing" is a real answer to that.
 */
export function canAcceptSurvey(record: SurveyRecord): boolean {
  return (
    record.status === 'received' && Boolean(record.surveyorName) && Boolean(record.surveyorVerdict)
  );
}

/** Why the Accept button is disabled, in the reader's words. */
export function acceptBlockedReason(record: SurveyRecord): string | null {
  if (record.status !== 'received') return null;
  if (!record.surveyorName) return 'Record who performed the survey before accepting.';
  if (!record.surveyorVerdict) {
    return "Transcribe the surveyor's stated verdict before accepting (use “the report states no verdict” if it gave none).";
  }
  return null;
}
