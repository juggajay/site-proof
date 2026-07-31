// Wave C5.2 §4.6 — the survey record's one readiness contribution.
//
// `[C5S-B5]`: `warning`, `blocksAction: false`, and NOT a member of
// `HANDOVER_BLOCKING_REASON_CODES`. A lot with an outstanding survey still
// conforms and still claims. C5 exposes a gap; it does not gate on one — the
// whole wave is a filing structure, and a filing structure that starts refusing
// things is a domain claim nobody has validated.
//
// Restructured 2026-07-31 from `survey_not_accepted`. The survey-side readiness
// signal is ARRIVAL — is a current report in? — because acceptance is not an act
// on this record at all: it is the hold-point release and the lot conformance,
// which consume the report as evidence and already have their own readiness
// items (`docs/research/c5-surveyor-workflow-practice-2026-07-31.md` §4.6, §7.2).

import type { EvidenceReadinessItem } from './core.js';

export function buildSurveyNotReceivedItem(count: number): EvidenceReadinessItem | null {
  if (count <= 0) {
    return null;
  }

  return {
    code: 'survey_not_received',
    severity: 'warning',
    area: 'survey',
    title: 'Survey reports not yet received',
    detail:
      count === 1
        ? '1 survey record is still waiting on the surveyor’s report.'
        : `${count} survey records are still waiting on the surveyor’s report.`,
    blocksAction: false,
    actionLabel: 'Review surveys',
    count,
  };
}
