import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  emptyClaimEvidencePackageFixture,
  noLotsClaimEvidencePackageFixture,
} from './fixtures/claimEvidenceFixture';
import { JsPdfRecorder, latestPdf, renderedText } from './pdfTestRecorder';
import { generateClaimEvidencePackagePDF } from '../../pdfGenerator';

vi.mock('jspdf', () => ({
  jsPDF: JsPdfRecorder,
}));

// B1 regression: "Generate Evidence Package" crashed with
// "Cannot read properties of undefined (reading 'filter')" when a lot's itp /
// completions / holdPoints / testResults / ncrs were undefined (or lots itself
// was undefined). These tests exercise the crash path and assert generation
// completes and saves a document. Against the pre-fix builder they throw.
describe('claim evidence package PDF — empty / undefined collections (B1)', () => {
  beforeEach(() => {
    JsPdfRecorder.instances = [];
    // TZ-stable system time so formatDateKey() in the filename is deterministic.
    vi.setSystemTime(new Date('2026-05-28T02:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not throw when a lot has undefined itp and undefined collections', async () => {
    await expect(
      generateClaimEvidencePackagePDF(emptyClaimEvidencePackageFixture),
    ).resolves.toBeUndefined();

    const doc = latestPdf();
    const text = renderedText(doc);

    // A document was produced and saved with the TZ-stable formatDateKey filename.
    expect(doc.constructorArgs).toEqual([]);
    expect(doc.savedFilename).toBe('Claim-7-Evidence-Package-2026-05-28.pdf');

    // Cover page and structural sections still render (TZ-stable text only).
    expect(text).toEqual(
      expect.arrayContaining([
        'PROGRESS CLAIM',
        'EVIDENCE PACKAGE',
        'Claim #7',
        'Pacific Highway Upgrade',
        'LOT SUMMARY',
        'LOT: EMPTY-01',
        'LOT: EMPTY-02',
        'DECLARATION',
      ]),
    );
  });

  it('does not throw when the top-level lots array is undefined', async () => {
    await expect(
      generateClaimEvidencePackagePDF(noLotsClaimEvidencePackageFixture),
    ).resolves.toBeUndefined();

    const doc = latestPdf();
    const text = renderedText(doc);

    expect(doc.savedFilename).toBe('Claim-7-Evidence-Package-2026-05-28.pdf');
    expect(text).toEqual(
      expect.arrayContaining(['PROGRESS CLAIM', 'EVIDENCE PACKAGE', 'LOT SUMMARY', 'TOTAL']),
    );
  });
});
