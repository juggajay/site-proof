// Wave C5.2 §4.6 — the survey record's one readiness contribution.
//
// `[C5S-B5]`: `warning`, `blocksAction: false`, and NOT a member of
// `HANDOVER_BLOCKING_REASON_CODES`. A lot with an unaccepted survey still
// conforms and still claims. C5 exposes a gap; it does not gate on one — the
// whole wave is a filing structure, and a filing structure that starts refusing
// things is a domain claim nobody has validated.

import type { EvidenceReadinessItem } from './core.js';

export function buildSurveyNotAcceptedItem(count: number): EvidenceReadinessItem | null {
  if (count <= 0) {
    return null;
  }

  return {
    code: 'survey_not_accepted',
    severity: 'warning',
    area: 'survey',
    title: 'Surveys not yet accepted',
    detail:
      count === 1
        ? '1 survey record has not been accepted yet.'
        : `${count} survey records have not been accepted yet.`,
    blocksAction: false,
    actionLabel: 'Review surveys',
    count,
  };
}
