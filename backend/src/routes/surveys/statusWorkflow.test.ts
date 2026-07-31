// Wave C5.2 — AT-173's pure half, plus `[C5R-N6]` (the flag parse) and
// `[C5R-A1]` (the non-substantive list is a MODULE-LEVEL EXPORTED const, unlike
// C2's, which is declared inside a route handler and cannot be reached).

import { describe, it, expect, afterEach } from 'vitest';

import {
  NON_SUBSTANTIVE_SURVEY_EDIT_FIELDS,
  SURVEY_KINDS,
  SURVEY_OPEN_STATUSES,
  SURVEY_STATUSES,
  SURVEY_STATUSES_REQUIRING_REPORT,
  SURVEY_STATUSES_REQUIRING_SURVEYOR,
  SURVEY_VERDICTS,
  VALID_SURVEY_TRANSITIONS,
  surveyRecordsEnabled,
} from './statusWorkflow.js';

describe('VALID_SURVEY_TRANSITIONS — the evidence-of-arrival machine', () => {
  it('is three states, not five: no in_progress, no accepted', () => {
    // research §2.4 — five independent source types, none with an in-progress
    // state; §4.6 — nothing anywhere accepts a survey record itself.
    expect(SURVEY_STATUSES.sort()).toEqual(['received', 'requested', 'returned_for_correction']);
    expect(VALID_SURVEY_TRANSITIONS).not.toHaveProperty('in_progress');
    expect(VALID_SURVEY_TRANSITIONS).not.toHaveProperty('accepted');
    expect(VALID_SURVEY_TRANSITIONS).not.toHaveProperty('rejected');
  });

  it('carries the short path from day one — retrospective filing is the dominant case', () => {
    // A user filing one arrived PDF must not click through a request first, and
    // `requested` is optional because the contractual trigger is a lot state
    // (AUS-SPEC C02 cl. 2.7.1), not a person.
    expect(VALID_SURVEY_TRANSITIONS.requested).toEqual(['received']);
  });

  it('reaches returned_for_correction only from received', () => {
    // You can only refer back a deliverable that arrived.
    const reachReturn = SURVEY_STATUSES.filter((from) =>
      VALID_SURVEY_TRANSITIONS[from].includes('returned_for_correction'),
    );
    expect(reachReturn).toEqual(['received']);
  });

  it('gives returned_for_correction no way back — the loop is a NEW record', () => {
    // NOT terminal in the workflow: the AU idiom for a redo is a new,
    // cross-referenced artifact (MRTS50 cl. 7.2), so the corrected report
    // supersedes this record rather than overwriting its state. Flipping the row
    // back to `received` would erase the evidence that the first result was bad.
    expect(VALID_SURVEY_TRANSITIONS.returned_for_correction).toEqual([]);
  });

  it('counts a returned record as still outstanding, unlike the rejected it replaced', () => {
    // `rejected` used to be terminal, so a bad survey stopped counting. A return
    // is a loop with a one-business-day clock (TMR Part 1 §7.6.4), so it does
    // not: the lot is still waiting on a report.
    expect([...SURVEY_OPEN_STATUSES].sort()).toEqual(['requested', 'returned_for_correction']);
    expect(SURVEY_OPEN_STATUSES.has('received')).toBe(false);
  });

  it('requires the report and a named surveyor at arrival, and at the return', () => {
    expect([...SURVEY_STATUSES_REQUIRING_REPORT].sort()).toEqual([
      'received',
      'returned_for_correction',
    ]);
    // The certifying party on an AU conformance report is the surveyor, full
    // stop (research §4.1) — evidence attributed to nobody is not evidence.
    expect([...SURVEY_STATUSES_REQUIRING_SURVEYOR].sort()).toEqual([
      'received',
      'returned_for_correction',
    ]);
    expect(SURVEY_STATUSES_REQUIRING_REPORT.has('requested')).toBe(false);
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
    const expected = new Set(['requested>received', 'received>returned_for_correction']);
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
