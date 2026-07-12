/**
 * Unit test for the shared ITP-run copy helpers. These render identically on the
 * foreman (ItpRunScreen) and subbie (SubbieItpRunScreen) runs, so pinning them
 * here guards both surfaces at once.
 */
import { describe, it, expect } from 'vitest';
import type { ITPChecklistItem } from '@/pages/lots/types';
import { subline, stripStateLine } from '../itpRunPresentation';

function item(over: Partial<ITPChecklistItem> = {}): ITPChecklistItem {
  return {
    id: 'i1',
    description: 'Check',
    category: 'General',
    responsibleParty: 'contractor',
    isHoldPoint: false,
    pointType: 'standard',
    evidenceRequired: 'photo',
    order: 0,
    ...over,
  };
}

describe('subline', () => {
  it('names the responsible party and the evidence suffix', () => {
    expect(subline(item({ responsibleParty: 'subcontractor', evidenceRequired: 'photo' }))).toBe(
      'Responsible: Subcontractor · photo evidence can be attached',
    );
  });

  it('omits the suffix when no evidence can be attached', () => {
    expect(subline(item({ responsibleParty: 'contractor', evidenceRequired: 'none' }))).toBe(
      'Responsible: Contractor',
    );
  });
});

describe('stripStateLine', () => {
  it('uses the plain state copy for ordinary items', () => {
    expect(stripStateLine(item(), 'done')).toBe('✓ Passed — saved');
    expect(stripStateLine(item(), 'hold')).toBe('Awaiting hold point release');
  });

  it('swaps in superintendent sign-off wording for signoff-only items', () => {
    // A superintendent-owned standard item is signoff-only for field users.
    const signoff = item({ responsibleParty: 'superintendent', pointType: 'standard' });
    expect(stripStateLine(signoff, 'done')).toBe('Superintendent sign-off recorded');
    expect(stripStateLine(signoff, 'open')).toBe('Superintendent sign-off required');
    // FAIL / N-A keep their plain copy even on a signoff item.
    expect(stripStateLine(signoff, 'failed')).toBe('✕ Failed — needs attention');
  });
});
