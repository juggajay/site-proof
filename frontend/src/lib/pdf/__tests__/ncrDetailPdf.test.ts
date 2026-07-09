import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { majorNcrDetailFixture } from './fixtures/ncrDetailFixture';
import { JsPdfRecorder, latestPdf, renderedText } from './pdfTestRecorder';
import { generateNCRDetailPDF } from '../../pdfGenerator';
import type { NCRDetailData } from '../../pdfGenerator';

vi.mock('jspdf', () => ({
  jsPDF: JsPdfRecorder,
}));

describe('NCR detail PDF — Batch C disposition + concession block', () => {
  beforeEach(() => {
    JsPdfRecorder.instances = [];
    vi.setSystemTime(new Date('2026-05-30T02:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders disposition, spec reference and linked failed test in identification', async () => {
    const data: NCRDetailData = {
      ...majorNcrDetailFixture,
      ncr: {
        ...majorNcrDetailFixture.ncr,
        specificationReference: 'MRTS70 Cl 14.3 / DWG C-102 Rev B',
        linkedTestResult: {
          testType: 'Compaction',
          testRequestNumber: 'TR-014',
          laboratoryReportNumber: 'LAB-88',
        },
      },
    };

    await generateNCRDetailPDF(data);
    const textContent = renderedText(latestPdf()).join('\n');

    expect(textContent).toContain('Disposition:');
    expect(textContent).toContain('Open — under management');
    expect(textContent).toContain('Specification Reference:');
    expect(textContent).toContain('MRTS70 Cl 14.3 / DWG C-102 Rev B');
    expect(textContent).toContain('Linked Failed Test:');
    expect(textContent).toContain('Lab Report LAB-88');
    // No money on quality records.
    expect(textContent).not.toContain('$');
  });

  it('renders the concession block when disposition = concession', async () => {
    const data: NCRDetailData = {
      ...majorNcrDetailFixture,
      ncr: {
        ...majorNcrDetailFixture.ncr,
        status: 'closed_concession',
        concessionJustification:
          'Minor cover shortfall within durability tolerance per RPEQ review.',
        concessionRiskAssessment:
          'No durability impact over design life; monitored at next inspection.',
        clientApprovalReference: 'SUP-APP-2291',
        qmApprovedBy: { fullName: 'Quinn Manager', email: 'quinn@example.com' },
        qmApprovedAt: '2026-05-29T06:00:00.000Z',
      },
    };

    await generateNCRDetailPDF(data);
    const textContent = renderedText(latestPdf()).join('\n');

    expect(textContent).toContain('Concession / Disposition');
    expect(textContent).toContain('Accepted by concession (use-as-is)');
    expect(textContent).toContain('Client Approval Reference:');
    expect(textContent).toContain('SUP-APP-2291');
    expect(textContent).toContain('Approved By:');
    expect(textContent).toContain('Quinn Manager');
    expect(textContent).not.toContain('$');
  });
});
