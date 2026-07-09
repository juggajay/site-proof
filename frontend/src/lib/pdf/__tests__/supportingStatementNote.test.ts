import { describe, expect, it } from 'vitest';

import { supportingStatementNote } from '../claimEvidencePackagePdf';

describe('supportingStatementNote', () => {
  it('reminds head contractors of the approved-form statement in NSW/QLD/VIC/ACT', () => {
    for (const state of ['NSW', 'QLD', 'VIC', 'ACT', 'nsw', ' vic ']) {
      expect(supportingStatementNote(state)).toMatch(/supporting statement in the approved form/i);
    }
  });

  it('gives SA the softer DIT statutory-declaration note', () => {
    expect(supportingStatementNote('SA')).toMatch(/Subcontractor Payment Statutory Declaration/i);
  });

  it('emits no note for WA/TAS/NT', () => {
    for (const state of ['WA', 'TAS', 'NT']) {
      expect(supportingStatementNote(state)).toBeNull();
    }
  });

  it('defaults an absent state to the NSW-style reminder', () => {
    expect(supportingStatementNote(null)).toMatch(/supporting statement in the approved form/i);
    expect(supportingStatementNote(undefined)).toMatch(
      /supporting statement in the approved form/i,
    );
  });
});
