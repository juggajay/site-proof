import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { passingTestCertificateFixture } from './fixtures';
import { JsPdfRecorder, latestPdf, renderedText } from './pdfTestRecorder';
import { generateTestCertificatePDF } from '../../pdfGenerator';

vi.mock('jspdf', () => ({
  jsPDF: JsPdfRecorder,
}));

describe('test certificate PDF characterization', () => {
  beforeEach(() => {
    JsPdfRecorder.instances = [];
    vi.setSystemTime(new Date('2026-05-28T02:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('preserves test certificate PDF labels, compliance wording, and filename', async () => {
    await generateTestCertificatePDF({
      ...passingTestCertificateFixture,
      test: {
        ...passingTestCertificateFixture.test,
        verifiedBy: { fullName: 'Quinn Manager', email: 'quinn@example.com' },
        verifiedAt: '2026-05-23T02:00:00.000Z',
      },
    } as typeof passingTestCertificateFixture);

    const doc = latestPdf();
    const text = renderedText(doc);
    const textContent = text.join('\n');

    expect(doc.constructorArgs).toEqual([]);
    expect(doc.savedFilename).toBe('Test-Certificate-TR-001-2026-05-28.pdf');
    expect(textContent).toContain('This test result COMPLIES with the specified requirements.');
    expect(text).toEqual(
      expect.arrayContaining([
        'TEST CERTIFICATE',
        'Compaction',
        'PASS',
        'Test Identification',
        'Request Number:',
        'TR-001',
        'Lab Report Number:',
        'LAB-9931',
        'Data Source:',
        'AI Extracted from Certificate',
        'Project & Location',
        'Project:',
        'Pacific Highway Upgrade (PHU-001)',
        'Lot Number:',
        'EW-001',
        'Chainage:',
        'CH 100 - 120',
        'Test Results',
        '98 %',
        'Specification: 95 - 100 %',
        'Verified By:',
        'Quinn Manager',
      ]),
    );
    // Shared per-page document footer identity (replaces the old CIVOS platform line).
    expect(textContent).toContain('Page 1 of');
    expect(textContent).toContain('Pacific Highway Upgrade / Test TR-001');
    expect(textContent).not.toContain('Civil Execution and Conformance Platform');
  });
});
