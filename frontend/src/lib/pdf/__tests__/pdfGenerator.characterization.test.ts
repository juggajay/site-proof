import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  approvedDocketDetailFixture,
  dashboardPdfFixture,
  majorNcrDetailFixture,
  notifiedHpEvidencePackageFixture,
  passingTestCertificateFixture,
  releasedHpEvidencePackageFixture,
  submittedClaimEvidencePackageFixture,
  submittedDailyDiaryFixture,
} from './fixtures';
import {
  generateClaimEvidencePackagePDF,
  generateDashboardPDF,
  generateDailyDiaryPDF,
  generateDocketDetailPDF,
  generateHPEvidencePackagePDF,
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

  it('preserves daily diary PDF sections, field values, notes, and filename', async () => {
    await generateDailyDiaryPDF(submittedDailyDiaryFixture);

    const doc = latestPdf();
    const text = renderedText(doc);
    const textContent = text.join('\n');

    expect(doc.constructorArgs).toEqual([]);
    expect(doc.savedFilename).toBe('Daily-Diary-2026-05-28-submitted.pdf');
    expect(text).toEqual(
      expect.arrayContaining([
        'DAILY DIARY',
        'SUBMITTED (LATE)',
        'Project Information',
        'Project:',
        'Pacific Highway Upgrade',
        'Project Number:',
        'PHU-001',
        'Diary Date:',
        'Status:',
        'Submitted',
        'Submitted By:',
        'Riley Foreman',
        'Weather Conditions',
        'Conditions:',
        'Cloudy with light rain',
        'Rainfall:',
        '6 mm',
        'Weather Notes:',
        'Light rain paused excavation around lunch.',
        'General Notes',
        'Morning toolbox completed before crews opened drainage trench. Inspection photos uploaded.',
        'Personnel on Site (2)',
        'Name',
        'Company',
        'Role',
        'Start',
        'Finish',
        'Hours',
        'Nina Foreman',
        'SiteProof Civil',
        'Foreman',
        '06:30',
        '15:00',
        '8.5',
        'Drainage Crew A',
        'Drainage Crew',
        'Pipe layer',
        '07:00',
        '14:30',
        '7.5',
        'TOTAL: 2 people, 16.0 hrs',
        'Plant & Equipment (1)',
        'Description',
        'ID/Rego',
        'Excavator 20t',
        'EX-204',
        'Trimmed trench invert',
        'Activities (1)',
        'Qty',
        'Unit',
        'Drainage trench excavation',
        'DR-010',
        '24',
        'm',
        'Reached inspection hold p',
        'Delays (1)',
        'Type',
        'Duration',
        'Weather',
        'Short rain delay during bedding',
        '11:15',
        '12:00',
        '0.75h',
        'Total Delay: 0.8 hours',
        'Addendums (1)',
        'Addendum 1',
        'Client requested photo set attached after inspection.',
        'Daily Summary',
        'Personnel: 2 (16.0 hrs)',
        'Plant: 1 items (7.0 hrs)',
        'Activities: 1',
        'Delays: 1 (0.8 hrs)',
        'Civil Execution and Conformance Platform',
      ]),
    );
    expect(textContent).not.toContain('SiteProof v2');
  });

  it('preserves claim evidence package PDF cover, lot summary, detail sections, declaration, and filename', async () => {
    await generateClaimEvidencePackagePDF(submittedClaimEvidencePackageFixture);

    const doc = latestPdf();
    const text = renderedText(doc);
    const textContent = text.join('\n');

    expect(doc.constructorArgs).toEqual([]);
    expect(doc.savedFilename).toBe('Claim-7-Evidence-Package-2026-05-28.pdf');

    // Cover page: titles, claim summary box, SOPA note, prepared-by
    expect(text).toEqual(
      expect.arrayContaining([
        'PROGRESS CLAIM',
        'EVIDENCE PACKAGE',
        'Claim #7',
        'Pacific Highway Upgrade',
        'Project #: PHU-001',
        'Claim Summary',
        'Total Lots: 2',
        'Claimed Amount: $248,500',
        'Test Results: 5 (4 passed)',
        'NCRs: 1 (1 open)',
        'Photos: 9',
        'Conformed Lots: 1',
        'Status: SUBMITTED',
        'Prepared by: Morgan Estimator',
        'This evidence package is prepared for Security of Payment Act compliance.',
        'State: NSW',
      ]),
    );
    // Claim period label renders (locale-formatted dates intentionally not asserted)
    expect(textContent).toContain('Claim Period:');

    // Lot summary table: headers, per-lot rows, and totals
    expect(text).toEqual(
      expect.arrayContaining([
        'LOT SUMMARY',
        'Lot #',
        'Activity',
        'Status',
        'ITP %',
        'Tests',
        'NCRs',
        'Claim Amount',
        'EW-001',
        'Earthworks',
        'conformed',
        '100%',
        '3/3',
        '$185,000',
        'DR-014',
        'Drainage',
        'in_progres', // status.slice(0, 10) truncates 'in_progress'
        '75%',
        '1/2',
        'TOTAL',
        '2 lots',
      ]),
    );

    // Individual lot detail sections (conformed lot + in-progress lot)
    expect(text).toEqual(
      expect.arrayContaining([
        'LOT: EW-001',
        'Bulk earthworks to subgrade level',
        'Activity: Earthworks',
        'Chainage: 100 - 350',
        'Layer: Subgrade',
        'Status: conformed | Claim Amount: $185,000',
        'ITP Checklist',
        'Template: Earthworks ITP - Subgrade',
        'Completion: 4/4 items (100%)',
        'Hold Points: 2/2 released',
        'Test Results',
        'Total: 3 | Passed: 3 | Failed: 0',
        'Conformance',
        'By: Jordan Surveyor',
        'Photos: 6 attached to lot',
        'LOT: DR-014',
        'Stormwater drainage line and pits',
        'Activity: Drainage',
        'Status: in_progress | Claim Amount: $63,500',
        'Template: Drainage ITP - Pipe Laying',
        'Completion: 3/4 items (75%)',
        'Hold Points: 1/2 released',
        'Total: 2 | Passed: 1 | Failed: 1',
        'Non-Conformance Reports',
        'Total: 1 | Open: 1 | Closed: 0',
        'Photos: 3 attached to lot',
      ]),
    );

    // Test-result and NCR detail lines (assert stable tails; pass/fail glyphs are a prefix)
    expect(textContent).toContain('Compaction: 98 %');
    expect(textContent).toContain('Moisture: 12 %');
    expect(textContent).toContain('CBR: 45 %');
    expect(textContent).toContain('Concrete Slump: 80 mm');
    expect(textContent).toContain('Pipe Joint: pending');
    expect(textContent).toContain('NCR-0021 (minor): open');

    // Declaration page
    expect(text).toEqual(
      expect.arrayContaining([
        'DECLARATION',
        'This evidence package contains the supporting documentation for Progress Claim',
        '#7 in the amount of $248,500.',
        'Signature',
        'Name',
        'Date',
        'SiteProof - Civil Execution and Conformance Platform',
      ]),
    );
    expect(textContent).not.toContain('SiteProof v2');
  });

  it('preserves released hold point evidence package sections, checklist, tests, photos, and filename', async () => {
    await generateHPEvidencePackagePDF(releasedHpEvidencePackageFixture);

    const doc = latestPdf();
    const text = renderedText(doc);
    const textContent = text.join('\n');

    expect(doc.constructorArgs).toEqual([]);
    expect(doc.savedFilename).toBe('HP-Evidence-Package-EW-001-2026-05-28.pdf');

    // Header + hold point identification (released status box, release details)
    expect(text).toEqual(
      expect.arrayContaining([
        'HOLD POINT EVIDENCE PACKAGE',
        'Lot: EW-001',
        '1. Hold Point Identification',
        'STATUS: RELEASED',
        'Hold Point Description: Subgrade proof roll prior to pavement layer',
        'Released By: Sam Supervisor',
        'Release Notes: Released after surveyor confirmed level tolerance.',
      ]),
    );
    // Date labels render (locale-formatted values intentionally not asserted)
    expect(textContent).toContain('Scheduled Date:');
    expect(textContent).toContain('Released:');

    // Lot details (all optional fields populated)
    expect(text).toEqual(
      expect.arrayContaining([
        '2. Lot Details',
        'Project: Pacific Highway Upgrade',
        'Project Number: PHU-001',
        'Lot Number: EW-001',
        'Description: Bulk earthworks to subgrade level',
        'Activity Type: Earthworks',
        'Chainage: 100 - 350',
        'ITP Template: Earthworks ITP - Subgrade',
      ]),
    );

    // Checklist table: heading, completion count, column headers, and row cells
    expect(text).toEqual(
      expect.arrayContaining([
        '3. Completed Checklist Items',
        'Completion Status: 2 / 3 items completed',
        '#',
        'Description',
        'Type',
        'Status',
        'Completed By',
        'Confirm survey set-out',
        'S', // standard point type
        'Verified',
        'Jordan Surveyor',
        'Proof roll subgrade',
        'HP', // hold point type
        'Done',
        'Riley Foreman',
        'Witness density testing',
        'W', // witness point type
        'Pending',
      ]),
    );

    // Test results table (populated branch)
    expect(text).toEqual(
      expect.arrayContaining([
        '4. Test Results',
        'Total Tests: 2 | Passing: 1',
        'Test Type',
        'Lab',
        'Result',
        'Pass/Fail',
        'Verified',
        'Compaction',
        'Moisture',
        'Civil Lab',
        '98 %',
        '12 %',
        'pass',
        'fail',
        'Yes',
        'No',
      ]),
    );

    // Photos (populated branch), survey data, evidence summary, footer
    expect(text).toEqual(
      expect.arrayContaining([
        '5. Photos & Evidence',
        'Photos: 2',
        'Checklist Attachments: 1',
        'Photo List:',
        '(Full photo images available in SiteProof system)',
        '6. Survey Data',
        'Chainage Range: 100 - 350',
        '(Survey coordinates and as-built data available in SiteProof system)',
        '7. Evidence Summary',
        'Checklist Items Completed: 2 / 3',
        'Items Verified: 1',
        'Test Results: 2 (1 passing)',
        'Attachments: 1',
        'This evidence package was generated by SiteProof - Civil Execution and Conformance Platform',
      ]),
    );
    // Photo rows append a locale date; assert the stable filename/caption only
    expect(textContent).toContain('subgrade-east.jpg');
    expect(textContent).toContain('East end after proof roll');
    expect(textContent).toContain('level-check.jpg');

    expect(textContent).not.toContain('SiteProof v2');
  });

  it('omits empty hold point sections and renders fallbacks for a not-yet-released hold point', async () => {
    await generateHPEvidencePackagePDF(notifiedHpEvidencePackageFixture);

    const doc = latestPdf();
    const text = renderedText(doc);
    const textContent = text.join('\n');

    expect(doc.savedFilename).toBe('HP-Evidence-Package-STR-101-2026-05-28.pdf');

    // Core headings still render, with the non-released status badge and fallbacks
    expect(text).toEqual(
      expect.arrayContaining([
        'HOLD POINT EVIDENCE PACKAGE',
        'Lot: STR-101',
        'STATUS: NOTIFIED',
        'Hold Point Description: Concrete pour hold point awaiting release',
        'Lot Number: STR-101',
        'ITP Template: Structures ITP - Headwall',
        'Completion Status: 0 / 0 items completed',
        'No test results recorded for this lot.',
        '(Full photo images available in SiteProof system)',
        '(Survey coordinates and as-built data available in SiteProof system)',
        'Checklist Items Completed: 0 / 0',
      ]),
    );

    // Optional lines for absent data are not emitted
    expect(textContent).not.toContain('Released By:');
    expect(textContent).not.toContain('Release Notes:');
    expect(textContent).not.toContain('Scheduled Date:');
    expect(textContent).not.toContain('Project Number:');
    expect(textContent).not.toContain('Activity Type:');
    expect(textContent).not.toContain('Photo List:');
    expect(textContent).not.toContain('Chainage');
    expect(textContent).not.toContain('SiteProof v2');
  });
});
