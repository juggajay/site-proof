/**
 * Wave `C5.3` — the survey collection a hold-point release package carries
 * (`docs/plans/wave-c5-survey-material-traceability-spec-2026-07-31.md` §4.6).
 *
 * ONE function, called by all three consumers of `buildHoldPointEvidencePackage`
 * — the authenticated `/:id/evidence-package`, `POST /preview-evidence-package`
 * and the public token/batch page. The gate lives here rather than in each
 * caller because "fail-closed" that is written out three times is a gate with
 * three chances to be forgotten.
 *
 * FAIL-CLOSED: with `C5_SURVEY_RECORDS_ENABLED` absent or off there is no query
 * at all, so a tenant that has not been switched on cannot leak a survey into a
 * release package even if rows exist in its database `[C5S-B4]`.
 *
 * `supersededById: null` is the `Drawing` read rule: a re-survey is a new
 * record, and the superseded one stays retrievable through the chain rather
 * than appearing beside its own replacement in a package sent to a
 * superintendent.
 *
 * DELIVERIES ARE NOT HERE, and that is `[C5S-e]`, not an omission: a
 * superintendent releasing a hold point is deciding about workmanship and
 * testing, and a delivery register at that moment is noise. Deliveries reach
 * the folio instead. Flip it when a real superintendent asks.
 */

import { prisma } from '../../lib/prisma.js';
import { surveyRecordsEnabled } from '../surveys/statusWorkflow.js';
import type { EvidenceSurveyInput } from './evidencePackage.js';

/** The select is the shape `EvidenceSurveyInput` needs and nothing wider. */
const SURVEY_EVIDENCE_SELECT = {
  id: true,
  kind: true,
  status: true,
  surveyorName: true,
  surveyorCompany: true,
  surveyorRegistration: true,
  surveyedAt: true,
  surveyorVerdict: true,
  verdictSourceNote: true,
  acceptedAt: true,
  acceptedBy: { select: { fullName: true } },
  reportDocument: { select: { filename: true } },
} as const;

/** A bound, in the `[C3R-B1]` shape: a package is a read surface, not a dump. */
export const HOLD_POINT_EVIDENCE_SURVEY_LIMIT = 100;

export async function loadHoldPointEvidenceSurveys(lotId: string): Promise<EvidenceSurveyInput[]> {
  if (!surveyRecordsEnabled()) {
    return [];
  }

  return prisma.surveyRecord.findMany({
    where: { lotId, supersededById: null },
    orderBy: [{ surveyedAt: 'asc' }, { id: 'asc' }],
    take: HOLD_POINT_EVIDENCE_SURVEY_LIMIT,
    select: SURVEY_EVIDENCE_SELECT,
  });
}
