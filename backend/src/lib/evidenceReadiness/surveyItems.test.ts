// Wave C5.2 — AT-178's contract half.

import { describe, it, expect } from 'vitest';

import { buildSurveyNotAcceptedItem } from './surveyItems.js';
import {
  HANDOVER_BLOCKING_REASON_CODES,
  READINESS_REASON_CODES,
  REASON_CODE_PROVENANCE,
} from '../readiness/contracts/reasonCodes.js';

describe('buildSurveyNotAcceptedItem', () => {
  it('emits nothing when every survey is accepted', () => {
    expect(buildSurveyNotAcceptedItem(0)).toBeNull();
  });

  it('warns without blocking', () => {
    expect(buildSurveyNotAcceptedItem(2)).toMatchObject({
      code: 'survey_not_accepted',
      severity: 'warning',
      area: 'survey',
      blocksAction: false,
      count: 2,
    });
  });

  it('is a registered code with provenance, and is NOT a handover blocker', () => {
    expect(READINESS_REASON_CODES).toContain('survey_not_accepted');
    expect(REASON_CODE_PROVENANCE.survey_not_accepted).toBeDefined();
    expect(HANDOVER_BLOCKING_REASON_CODES as readonly string[]).not.toContain(
      'survey_not_accepted',
    );
  });
});
