import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { submittedClaimEvidencePackageFixture } from './fixtures';
import { JsPdfRecorder, latestPdf, renderedText } from './pdfTestRecorder';
import { generateClaimEvidencePackagePDF } from '../../pdfGenerator';
import { conformanceOverrideNote } from '../claimEvidencePackagePdf';
import type { ClaimEvidencePackageData } from '../types';

vi.mock('jspdf', () => ({
  jsPDF: JsPdfRecorder,
}));

/**
 * A force-conformed lot printed "Status: Conformed" directly above
 * "Completion: 0/33 items" with nothing to explain the gap — a client reads
 * that as either a lie or a broken system. These tests pin the override
 * context onto every place the pack says "Conformed".
 */
const forceConformedFixture: ClaimEvidencePackageData = {
  ...submittedClaimEvidencePackageFixture,
  lots: submittedClaimEvidencePackageFixture.lots.map((lot, index) =>
    index === 0
      ? {
          ...lot,
          conformanceOverriddenAt: '2026-05-20T05:00:00.000Z',
          conformanceOverrideReason: 'Client accepted as-built deviation under SI-114.',
          summary: { ...lot.summary, itpCompletionPercentage: 0 },
        }
      : lot,
  ),
};

describe('claim evidence package — force-conformance context', () => {
  beforeEach(() => {
    JsPdfRecorder.instances = [];
    vi.setSystemTime(new Date('2026-05-28T02:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('conformanceOverrideNote', () => {
    it('is silent for a normally conformed lot', () => {
      expect(conformanceOverrideNote({ conformanceOverriddenAt: null })).toBeNull();
      expect(conformanceOverrideNote({})).toBeNull();
    });

    it('states the override and its date, matching the lot page wording', () => {
      // Timezone-stable: the date is the raw ISO day, exactly as the readiness
      // item on the lot page renders it.
      expect(conformanceOverrideNote({ conformanceOverriddenAt: '2026-05-20T05:00:00.000Z' })).toBe(
        'Conformance accepted by override — an owner or admin force-conformed this lot on 2026-05-20.',
      );
    });
  });

  it('prints the override note and the reason beside the lot status', async () => {
    await generateClaimEvidencePackagePDF(forceConformedFixture);
    const text = renderedText(latestPdf());

    expect(text).toEqual(
      expect.arrayContaining([
        'Status: Conformed | Claim Amount: $185,000',
        'Conformance accepted by override — an owner or admin force-conformed this lot on 2026-05-20.',
        'Reason given: Client accepted as-built deviation under SI-114.',
        // The pairing that made this necessary still prints; it is now explained.
        'Completion: 4/4 items (0%)',
      ]),
    );
  });

  it('marks the overridden lot in the summary table and footnotes the asterisk', async () => {
    await generateClaimEvidencePackagePDF(forceConformedFixture);
    const text = renderedText(latestPdf());

    // Lot 1 was force-conformed, lot 2 is in progress and carries no marker.
    expect(text).toContain('Conformed *');
    expect(text).toContain('In Progress');
    expect(text.join('\n')).toContain(
      '* Conformance accepted by override — an owner or admin force-conformed this lot despite outstanding prerequisites.',
    );
  });

  it('repeats the caveat in the lot conformance block', async () => {
    await generateClaimEvidencePackagePDF(forceConformedFixture);
    const text = renderedText(latestPdf());

    expect(text).toContain('Accepted by override, not by meeting all prerequisites.');
  });

  it('adds nothing to a pack with no overridden lot', async () => {
    await generateClaimEvidencePackagePDF(submittedClaimEvidencePackageFixture);
    const joined = renderedText(latestPdf()).join('\n');

    expect(joined).toContain('Status: Conformed | Claim Amount: $185,000');
    expect(joined).not.toContain('override');
    expect(joined).not.toContain('Conformed *');
  });
});
