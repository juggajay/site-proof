import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  approvedDocketDetailFixture,
  dashboardPdfFixture,
  majorNcrDetailFixture,
  passingTestCertificateFixture,
} from './fixtures';
import {
  generateDashboardPDF,
  generateDocketDetailPDF,
  generateNCRDetailPDF,
  generateTestCertificatePDF,
} from '../../pdfGenerator';
import type { DashboardPDFData } from '../../pdfGenerator';

type PdfOperation = {
  name: string;
  args: unknown[];
};

class JsPdfRecorder {
  static instances: JsPdfRecorder[] = [];

  readonly constructorArgs: unknown[];
  readonly operations: PdfOperation[] = [];
  readonly internal = {
    pageSize: {
      getWidth: () => 210,
      getHeight: () => 297,
    },
  };
  savedFilename: string | null = null;

  constructor(...args: unknown[]) {
    this.constructorArgs = args;
    JsPdfRecorder.instances.push(this);
  }

  addPage() {
    this.operations.push({ name: 'addPage', args: [] });
  }

  getTextWidth(text: string) {
    return String(text).length * 2;
  }

  line(...args: unknown[]) {
    this.operations.push({ name: 'line', args });
  }

  rect(...args: unknown[]) {
    this.operations.push({ name: 'rect', args });
  }

  roundedRect(...args: unknown[]) {
    this.operations.push({ name: 'roundedRect', args });
  }

  save(filename: string) {
    this.savedFilename = filename;
    this.operations.push({ name: 'save', args: [filename] });
  }

  setDrawColor(...args: unknown[]) {
    this.operations.push({ name: 'setDrawColor', args });
  }

  setFillColor(...args: unknown[]) {
    this.operations.push({ name: 'setFillColor', args });
  }

  setFont(...args: unknown[]) {
    this.operations.push({ name: 'setFont', args });
  }

  setFontSize(...args: unknown[]) {
    this.operations.push({ name: 'setFontSize', args });
  }

  setTextColor(...args: unknown[]) {
    this.operations.push({ name: 'setTextColor', args });
  }

  splitTextToSize(text: string, _width: number) {
    return String(text).split('\n');
  }

  text(text: string | string[], ...args: unknown[]) {
    const lines = Array.isArray(text) ? text : [text];
    this.operations.push({ name: 'text', args: [lines, ...args] });
  }
}

vi.mock('jspdf', () => ({
  jsPDF: JsPdfRecorder,
}));

function latestPdf(): JsPdfRecorder {
  const doc = JsPdfRecorder.instances.at(-1);
  if (!doc) {
    throw new Error('Expected a PDF recorder instance to be created');
  }
  return doc;
}

function renderedText(doc: JsPdfRecorder): string[] {
  return doc.operations
    .filter((operation) => operation.name === 'text')
    .flatMap((operation) => operation.args[0] as string[]);
}

describe('pdfGenerator characterization', () => {
  beforeEach(() => {
    JsPdfRecorder.instances = [];
    vi.setSystemTime(new Date('2026-05-28T02:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('preserves dashboard summary PDF headings, metrics, and filename', async () => {
    await generateDashboardPDF(dashboardPdfFixture);

    const doc = latestPdf();
    const text = renderedText(doc);

    expect(doc.constructorArgs).toEqual(['portrait', 'mm', 'a4']);
    expect(doc.savedFilename).toBe('siteproof-dashboard-2026-05-28.pdf');
    expect(text).toEqual(
      expect.arrayContaining([
        'Dashboard Summary',
        'SiteProof Civil Execution and Conformance Platform',
        'Report Details',
        'Date range',
        'Last 30 days',
        'Exported by',
        'Pat Owner',
        'Key Metrics',
        'Total projects',
        '3',
        'Active projects',
        '2',
        'Total lots',
        '18',
        'Open hold points',
        '4',
        'Open NCRs',
        '1',
        'Attention items',
        'Overdue NCRs',
        '1. NCR-0007 pavement thickness (PHU-001 - Pacific Highway Upgrade)',
        '5 days overdue. Corrective action overdue for pavement lot.',
        'Stale Hold Points',
        '1. Release concrete pour hold point (PHU-001 - Pacific Highway Upgrade)',
        '3 days waiting. Awaiting client release before pour.',
        'Recent Activity',
        '1. Lot EW-001 changed to conformed',
      ]),
    );
    expect(text.join('\n')).not.toContain('SiteProof v2');
  });

  it('renders dashboard fallback copy when attention and activity sections are empty', async () => {
    const dashboardFixtureWithEmptySections: DashboardPDFData = {
      ...dashboardPdfFixture,
      stats: {
        ...dashboardPdfFixture.stats,
        attentionItems: { total: 0, overdueNCRs: [], staleHoldPoints: [] },
        recentActivities: [],
      },
    };

    await generateDashboardPDF(dashboardFixtureWithEmptySections);

    const doc = latestPdf();
    const text = renderedText(doc);

    expect(doc.constructorArgs).toEqual(['portrait', 'mm', 'a4']);
    expect(text).toEqual(
      expect.arrayContaining([
        'Overdue NCRs',
        'Stale Hold Points',
        'Recent Activity',
        'None',
        'No recent activity in this period.',
      ]),
    );
  });

  it('preserves test certificate PDF labels, compliance wording, and filename', async () => {
    await generateTestCertificatePDF(passingTestCertificateFixture);

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
        'Civil Execution and Conformance Platform',
      ]),
    );
  });

  it('preserves major NCR detail PDF sections, resolution fields, and filename', async () => {
    await generateNCRDetailPDF(majorNcrDetailFixture);

    const doc = latestPdf();
    const text = renderedText(doc);
    const textContent = text.join('\n');

    expect(doc.constructorArgs).toEqual([]);
    expect(doc.savedFilename).toBe('NCR-NCR-0009-2026-05-28.pdf');
    expect(textContent).toContain('STR-042 - Headwall concrete repair');
    expect(text).toEqual(
      expect.arrayContaining([
        'NON-CONFORMANCE REPORT',
        'NCR-0009',
        '[MAJOR]',
        'NCR Identification',
        'NCR Number:',
        'Status:',
        'PENDING REVIEW',
        'Category:',
        'workmanship',
        'Severity:',
        'MAJOR',
        'Raised By:',
        'Quinn Manager',
        'Responsible:',
        'Sam Supervisor',
        'Project & Affected Lots',
        'Project:',
        'Pacific Highway Upgrade (PHU-001)',
        'Affected Lots:',
        'Non-Conformance Description',
        'Honeycombing identified on headwall concrete face after formwork strip.',
        'Investigation & Resolution',
        'Root Cause:',
        'Insufficient vibration around congested reinforcement.',
        'Proposed Action:',
        'Break out defective concrete and reinstate with approved repair mortar.',
        'Action Taken:',
        'Repair methodology submitted for superintendent review.',
        'Preventative Measures:',
        'Brief crew on vibration pattern and add pre-pour checklist hold point.',
        'Lessons Learned:',
        'Increase inspection frequency when reinforcement congestion is high.',
        'Quality Manager Approval',
        'QM Approval Required:',
        'Yes',
        'QM Approval Status:',
        'Pending',
        'Activity Timeline',
        '1. NCR raised',
        'Civil Execution and Conformance Platform',
      ]),
    );
    expect(textContent).not.toContain('SiteProof v2');
  });

  it('preserves docket detail PDF headings, totals, approval fields, and filename', async () => {
    await generateDocketDetailPDF(approvedDocketDetailFixture);

    const doc = latestPdf();
    const text = renderedText(doc);
    const textContent = text.join('\n');

    expect(doc.constructorArgs).toEqual([]);
    expect(doc.savedFilename).toBe('Docket-SD-0042-approved.pdf');
    expect(text).toEqual(
      expect.arrayContaining([
        'SUBCONTRACTOR DOCKET',
        'SD-0042',
        'APPROVED',
        'Docket Details',
        'Docket Number:',
        'Status:',
        'Project & Subcontractor',
        'Project:',
        'Pacific Highway Upgrade',
        'Project Number:',
        'PHU-001',
        'Subcontractor:',
        'Precision Drainage Pty Ltd',
        'ABN:',
        '12 345 678 901',
        'Hours Summary',
        'Category',
        'Submitted',
        'Approved',
        'Variance',
        'Labour Hours',
        '42 hrs',
        '40 hrs',
        '-2 hrs',
        'Plant Hours',
        '12 hrs',
        '13 hrs',
        '+1 hrs',
        'Docket Notes',
        'Completed drainage trenching and bedding placement for eastern run.',
        'Foreman Notes',
        'Reduced labour by two hours after duplicate spotter entry was removed.',
        'Adjustment Reason',
        'Plant time increased for excavator standby during services potholing.',
        'APPROVAL CERTIFICATION',
        'I certify that the hours claimed in this docket have been verified and approved.',
        'Approved By:',
        'Signature',
        'Civil Execution and Conformance Platform',
      ]),
    );
    expect(textContent).not.toContain('SiteProof v2');
  });
});
