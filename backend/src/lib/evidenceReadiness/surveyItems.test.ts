// Wave C5.2 — AT-178's contract half.

import { describe, it, expect } from 'vitest';

import { buildSurveyNotReceivedItem } from './surveyItems.js';
import {
  HANDOVER_BLOCKING_REASON_CODES,
  READINESS_REASON_CODES,
  REASON_CODE_PROVENANCE,
} from '../readiness/contracts/reasonCodes.js';

describe('buildSurveyNotReceivedItem', () => {
  it('emits nothing when every current survey report has arrived', () => {
    expect(buildSurveyNotReceivedItem(0)).toBeNull();
  });

  it('warns without blocking', () => {
    expect(buildSurveyNotReceivedItem(2)).toMatchObject({
      code: 'survey_not_received',
      severity: 'warning',
      area: 'survey',
      blocksAction: false,
      count: 2,
    });
  });

  it('is a registered code with provenance, and is NOT a handover blocker', () => {
    expect(READINESS_REASON_CODES).toContain('survey_not_received');
    expect(REASON_CODE_PROVENANCE.survey_not_received).toBeDefined();
    expect(HANDOVER_BLOCKING_REASON_CODES as readonly string[]).not.toContain(
      'survey_not_received',
    );
  });

  it('retires `survey_not_accepted` outright — the record has no acceptance act', () => {
    // The 2026-07-31 restructure removed acceptance from the survey record
    // (research §4.6). No alias, no deprecation window: the flag has never been
    // on, so nothing stored or emitted anywhere carries the old string.
    expect(READINESS_REASON_CODES as readonly string[]).not.toContain('survey_not_accepted');
    expect(REASON_CODE_PROVENANCE).not.toHaveProperty('survey_not_accepted');
  });
});
