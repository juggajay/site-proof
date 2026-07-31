// Wave C5.2 — AT-173's pure half, plus `[C5R-N6]` (the flag parse) and
// `[C5R-A1]` (the non-substantive list is a MODULE-LEVEL EXPORTED const, unlike
// C2's, which is declared inside a route handler and cannot be reached).

import { describe, it, expect, afterEach } from 'vitest';

import {
  NON_SUBSTANTIVE_SURVEY_EDIT_FIELDS,
  SURVEY_KINDS,
  SURVEY_STATUSES,
  SURVEY_TERMINAL_STATUSES,
  SURVEY_VERDICTS,
  VALID_SURVEY_TRANSITIONS,
  surveyRecordsEnabled,
} from './statusWorkflow.js';

describe('VALID_SURVEY_TRANSITIONS', () => {
  it('carries the short paths from day one — retrospective filing is the dominant case', () => {
    // C2 shipped without these and had to widen its map additively later. A user
    // filing one PDF must not click three buttons.
    expect(VALID_SURVEY_TRANSITIONS.requested).toContain('received');
    expect(VALID_SURVEY_TRANSITIONS.requested).toContain('accepted');
    expect(VALID_SURVEY_TRANSITIONS.in_progress).toContain('accepted');
  });

  it('makes accepted and rejected terminal', () => {
    expect(VALID_SURVEY_TRANSITIONS.accepted).toEqual([]);
    expect(VALID_SURVEY_TRANSITIONS.rejected).toEqual([]);
    expect([...SURVEY_TERMINAL_STATUSES].sort()).toEqual(['accepted', 'rejected']);
  });

  it('reaches rejected only from received', () => {
    const reachRejected = SURVEY_STATUSES.filter((from) =>
      VALID_SURVEY_TRANSITIONS[from].includes('rejected'),
    );
    expect(reachRejected).toEqual(['received']);
  });

  it('never names a status outside the CHECK-constrained vocabulary', () => {
    for (const targets of Object.values(VALID_SURVEY_TRANSITIONS)) {
      for (const target of targets) {
        expect(SURVEY_STATUSES).toContain(target);
      }
    }
  });

  it('has no self-edge anywhere in the cross product', () => {
    for (const from of SURVEY_STATUSES) {
      expect(VALID_SURVEY_TRANSITIONS[from]).not.toContain(from);
    }
  });

  it('is the ONLY path — every other pair in the cross product is absent', () => {
    const expected = new Set([
      'requested>in_progress',
      'requested>received',
      'requested>accepted',
      'in_progress>received',
      'in_progress>accepted',
      'received>accepted',
      'received>rejected',
    ]);
    const actual = new Set(
      SURVEY_STATUSES.flatMap((from) =>
        VALID_SURVEY_TRANSITIONS[from].map((to) => `${from}>${to}`),
      ),
    );
    expect(actual).toEqual(expected);
  });
});

describe('the constrained vocabularies', () => {
  it('names three kinds and four verdicts, matching the migration CHECKs', () => {
    expect(SURVEY_KINDS).toEqual(['set_out', 'conformance', 'as_built']);
    expect(SURVEY_VERDICTS).toEqual(['conforms', 'does_not_conform', 'qualified', 'not_stated']);
  });

  it("keeps 'not_stated' first-class so a missing verdict is recordable as a fact", () => {
    expect(SURVEY_VERDICTS).toContain('not_stated');
  });
});

describe('NON_SUBSTANTIVE_SURVEY_EDIT_FIELDS', () => {
  it('is exported at module level and holds only fields that are not evidence', () => {
    expect(Array.isArray(NON_SUBSTANTIVE_SURVEY_EDIT_FIELDS)).toBe(true);
    expect(NON_SUBSTANTIVE_SURVEY_EDIT_FIELDS).toEqual(['notes']);
  });

  it('does NOT exempt the verdict, its citation, or any attribution field', () => {
    for (const evidence of [
      'surveyorVerdict',
      'verdictSourceNote',
      'surveyorName',
      'surveyorCompany',
      'surveyorRegistration',
      'surveyedAt',
      'reportDocumentId',
      'lotId',
      'kind',
      'status',
    ]) {
      expect(NON_SUBSTANTIVE_SURVEY_EDIT_FIELDS).not.toContain(evidence);
    }
  });
});

describe('surveyRecordsEnabled — fail-closed', () => {
  const original = process.env.C5_SURVEY_RECORDS_ENABLED;
  afterEach(() => {
    if (original === undefined) {
      delete process.env.C5_SURVEY_RECORDS_ENABLED;
    } else {
      process.env.C5_SURVEY_RECORDS_ENABLED = original;
    }
  });

  it('is OFF when the variable is absent — the property §11 step 1 depends on', () => {
    delete process.env.C5_SURVEY_RECORDS_ENABLED;
    expect(surveyRecordsEnabled()).toBe(false);
  });

  it('is OFF for anything that is not an explicit affirmative', () => {
    for (const value of ['', ' ', 'false', 'off', '0', 'no', 'maybe', 'TRUEISH']) {
      process.env.C5_SURVEY_RECORDS_ENABLED = value;
      expect(surveyRecordsEnabled()).toBe(false);
    }
  });

  it('is ON only for true/1/yes, case- and whitespace-insensitive', () => {
    for (const value of ['true', 'TRUE', ' True ', '1', 'yes', 'YES']) {
      process.env.C5_SURVEY_RECORDS_ENABLED = value;
      expect(surveyRecordsEnabled()).toBe(true);
    }
  });
});
