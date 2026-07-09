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
  defaultConformanceOptions,
  generateConformanceReportPDF,
  generateClaimEvidencePackagePDF,
  generateDailyDiaryPDF,
  generateDashboardPDF,
  generateDocketDetailPDF,
  generateHPEvidencePackagePDF,
  generateNCRDetailPDF,
  generateTestCertificatePDF,
} from '../../pdfGenerator';
import type { ConformanceReportData } from '../../pdfGenerator';
import type { ClaimEvidencePackageData } from '../../pdfGenerator';

import { JsPdfRecorder, latestPdf, renderedText } from './pdfTestRecorder';
vi.mock('jspdf', () => ({
  jsPDF: JsPdfRecorder,
}));

describe('pdfGenerator characterization', () => {
  beforeEach(() => {
    JsPdfRecorder.instances = [];
    vi.setSystemTime(new Date('2026-05-28T02:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('renders dashboard company branding and continues when the logo URL cannot be loaded', async () => {
    const failingFetch = vi.fn().mockRejectedValue(new Error('expired logo URL'));
    vi.stubGlobal('fetch', failingFetch);

    await generateDashboardPDF({
      ...dashboardPdfFixture,
      branding: {
        companyName: 'Gateway Civil Pty Ltd',
        logoUrl: '/api/company/logo/file/company-1?token=expired',
      },
    });

    const doc = latestPdf();
    const text = renderedText(doc);

    expect(failingFetch).toHaveBeenCalledWith(
      '/api/company/logo/file/company-1?token=expired',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(text).toEqual(expect.arrayContaining(['Dashboard Summary', 'Gateway Civil Pty Ltd']));
    expect(doc.operations.some((operation) => operation.name === 'addImage')).toBe(false);
    expect(doc.savedFilename).toBe('Dashboard-Summary-2026-05-28.pdf');
    // Shared per-page document footer identity (replaces the old CIVOS footer line).
    const textContent = text.join('\n');
    expect(textContent).toContain('Page 1 of');
    expect(textContent).toContain('Dashboard · Last 30 days');
    expect(textContent).not.toContain('Generated from CIVOS on');
  });

  it('renders a bounded dashboard logo when branding provides an image data URL', async () => {
    const logoDataUrl = 'data:image/png;base64,iVBORw0KGgo=';

    await generateDashboardPDF({
      ...dashboardPdfFixture,
      branding: {
        companyName: 'Gateway Civil Pty Ltd',
        logoUrl: logoDataUrl,
      },
    });

    const doc = latestPdf();
    const logo = doc.operations.find((operation) => operation.name === 'addImage');

    // Aspect-fit: a 2:1 logo (recorder getImageProperties → 200×100) fits the
    // 30×18 box to 30×15, right-aligned within it.
    expect(logo?.args).toEqual([logoDataUrl, 'PNG', 160, 8, 30, 15]);
    expect(renderedText(doc)).toContain('Gateway Civil Pty Ltd');
  });

  it('renders company branding without a logo across creatable PDF report families', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const company = { name: 'Gateway Civil Pty Ltd', logoUrl: null };
    const withProjectCompany = <
      TData extends { project: Record<string, unknown>; company?: unknown },
    >(
      data: TData,
    ): TData => ({
      ...data,
      company: undefined,
      project: {
        ...data.project,
        company,
      },
    });
    const conformanceFixture: ConformanceReportData = {
      lot: {
        lotNumber: 'EW-001',
        description: 'Bulk earthworks to subgrade level',
        status: 'conformed',
        activityType: 'Earthworks',
        chainageStart: 100,
        chainageEnd: 350,
        layer: 'Subgrade',
        areaZone: null,
        conformedAt: '2026-05-28T01:00:00.000Z',
        conformedBy: { fullName: 'Jordan Surveyor', email: 'jordan@example.com' },
      },
      project: {
        name: 'Pacific Highway Upgrade',
        projectNumber: 'PHU-001',
      },
      itp: null,
      testResults: [],
      ncrs: [],
      holdPointReleases: [],
      photoCount: 0,
    };

    const brandedCases = [
      {
        label: 'conformance report',
        generate: () =>
          generateConformanceReportPDF(withProjectCompany(conformanceFixture), {
            ...defaultConformanceOptions,
            format: 'standard',
          }),
      },
      {
        label: 'docket detail',
        generate: () => generateDocketDetailPDF(withProjectCompany(approvedDocketDetailFixture)),
      },
      {
        label: 'hold-point evidence',
        generate: () =>
          generateHPEvidencePackagePDF(withProjectCompany(releasedHpEvidencePackageFixture)),
      },
      {
        label: 'claim evidence',
        generate: () =>
          generateClaimEvidencePackagePDF({ ...submittedClaimEvidencePackageFixture, company }),
      },
      {
        label: 'daily diary',
        generate: () => generateDailyDiaryPDF(withProjectCompany(submittedDailyDiaryFixture)),
      },
      {
        label: 'NCR detail',
        generate: () => generateNCRDetailPDF(withProjectCompany(majorNcrDetailFixture)),
      },
      {
        label: 'test certificate',
        generate: () =>
          generateTestCertificatePDF(withProjectCompany(passingTestCertificateFixture)),
      },
    ];

    for (const pdfCase of brandedCases) {
      await pdfCase.generate();
      const doc = latestPdf();
      expect(renderedText(doc), pdfCase.label).toContain('Gateway Civil Pty Ltd');
      expect(
        doc.operations.some((operation) => operation.name === 'addImage'),
        pdfCase.label,
      ).toBe(false);
      expect(doc.savedFilename, pdfCase.label).toBeTruthy();
    }

    expect(fetchSpy).not.toHaveBeenCalled();
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
        'Pending Review',
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
        'Root Cause Category:',
        'Work method',
        'Root Cause:',
        'Insufficient vibration around congested reinforcement.',
        'Proposed Action:',
        'Break out defective concrete and reinstate with approved repair mortar.',
        'Action Taken:',
        'Repair methodology submitted for superintendent review.',
        'Preventative Measures:',
        'Brief crew on vibration pattern and add pre-pour checklist hold point.',
        'Verification Notes:',
        'QM requested photo evidence before final closure.',
        'Lessons Learned:',
        'Increase inspection frequency when reinforcement congestion is high.',
        'Quality Manager Approval',
        'QM Approval Required:',
        'Yes',
        'QM Approval Status:',
        'Pending',
        'Evidence Register',
        '1. headwall-repair-photo.jpg',
        'Activity Timeline',
        '1. NCR raised',
      ]),
    );
    // Shared per-page document footer identity (replaces the old CIVOS platform line).
    expect(textContent).toContain('Page 1 of');
    expect(textContent).toContain('Pacific Highway Upgrade / NCR-0009');
    expect(textContent).not.toContain('Civil Execution and Conformance Platform');
    expect(textContent).toContain('Type: Rectification Photo | MIME: image/jpeg');
    expect(textContent).not.toContain('4200 hrs');
    expect(textContent).not.toContain('1800 hrs');
    expect(textContent).not.toContain('SiteProof v2');
  });

  it('sanitizes unsafe generated PDF filenames before saving', async () => {
    const assertSafeFilename = (filename: string | null) => {
      expect(filename).toBeTruthy();
      const characters = Array.from(filename ?? '');
      expect(
        characters.some((char) => '<>:"/\\|?*'.includes(char) || char.charCodeAt(0) < 32),
      ).toBe(false);
    };

    await generateNCRDetailPDF({
      ...majorNcrDetailFixture,
      ncr: { ...majorNcrDetailFixture.ncr, ncrNumber: '../NCR:bad?name\r\n' },
    });
    assertSafeFilename(latestPdf().savedFilename);
    expect(latestPdf().savedFilename).toContain('NCR-..-NCR-bad-name');
    expect(latestPdf().savedFilename).toMatch(/-2026-05-28\.pdf$/);

    await generateDocketDetailPDF({
      ...approvedDocketDetailFixture,
      docket: {
        ...approvedDocketDetailFixture.docket,
        docketNumber: '..\\SD:0042*',
      },
    });
    expect(latestPdf().savedFilename).toBe('Docket-..-SD-0042--2026-05-28.pdf');
    assertSafeFilename(latestPdf().savedFilename);

    await generateHPEvidencePackagePDF({
      ...notifiedHpEvidencePackageFixture,
      lot: {
        ...notifiedHpEvidencePackageFixture.lot,
        lotNumber: 'LOT/01:bad*name',
      },
    });
    expect(latestPdf().savedFilename).toBe('HP-Evidence-Package-LOT-01-bad-name-2026-05-28.pdf');
    assertSafeFilename(latestPdf().savedFilename);

    await generateTestCertificatePDF({
      ...passingTestCertificateFixture,
      test: {
        ...passingTestCertificateFixture.test,
        testRequestNumber: 'TR/001:bad*name',
      },
    });
    expect(latestPdf().savedFilename).toBe('Test-Certificate-TR-001-bad-name-2026-05-28.pdf');
    assertSafeFilename(latestPdf().savedFilename);
  });

  it('preserves docket detail PDF headings, totals, approval fields, and filename', async () => {
    await generateDocketDetailPDF({
      ...approvedDocketDetailFixture,
      docket: {
        ...approvedDocketDetailFixture.docket,
        submittedBy: { fullName: 'Sasha Subbie', email: 'sasha@example.com' },
        approvedBy: { fullName: 'Riley Foreman', email: 'riley@example.com' },
      },
    } as typeof approvedDocketDetailFixture);

    const doc = latestPdf();
    const text = renderedText(doc);
    const textContent = text.join('\n');

    expect(doc.constructorArgs).toEqual([]);
    expect(doc.savedFilename).toBe('Docket-SD-0042-2026-05-28.pdf');
    expect(text).toEqual(
      expect.arrayContaining([
        'SUBCONTRACTOR DOCKET',
        'SD-0042',
        'APPROVED',
        'Docket Details',
        'Docket Number:',
        'Status:',
        'Submitted By:',
        'Sasha Subbie',
        'Approved By:',
        'Riley Foreman',
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
        'Cost Summary',
        'Labour Cost',
        '$4,200.00',
        '$4,000.00',
        '-$200.00',
        'Plant Cost',
        '$1,800.00',
        '$1,950.00',
        '+$150.00',
        'Total Cost',
        '$6,000.00',
        '$5,950.00',
        '-$50.00',
        'Docket Notes',
        'Completed drainage trenching and bedding placement for eastern run.',
        'Foreman Notes',
        'Reduced labour by two hours after duplicate spotter entry was removed.',
        'Adjustment Reason',
        'Plant time increased for excavator standby during services potholing.',
        'APPROVAL CERTIFICATION',
        'I certify that the hours claimed in this docket have been verified and approved.',
        'Approved By:',
        'Riley Foreman',
        'Signature',
      ]),
    );
    // Shared per-page document footer identity.
    expect(textContent).toContain('Page 1 of');
    expect(textContent).toContain('Pacific Highway Upgrade / Docket SD-0042');
    expect(textContent).not.toContain('Civil Execution and Conformance Platform');
    expect(textContent).not.toContain('SiteProof v2');
  });

  it('preserves daily diary PDF sections, field values, notes, and filename', async () => {
    await generateDailyDiaryPDF(submittedDailyDiaryFixture);

    const doc = latestPdf();
    const text = renderedText(doc);
    const textContent = text.join('\n');

    expect(doc.constructorArgs).toEqual([]);
    expect(doc.savedFilename).toBe('Daily-Diary-2026-05-28.pdf');
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
        // Contemporaneity block (top of document).
        'Contemporaneous Record',
        'Record Locked:',
        // Docket-provenance column on personnel/plant.
        'Source',
        'Docket',
        'Manual',
        // Deliveries section.
        'Deliveries (1)',
        'Class 3 road base',
        'Boral Quarries',
        'BQ-88421',
        // Safety & site events (occurrence + reference, no raw narrative note).
        'Safety & Site Events (1)',
        'Near miss reported at trench edge',
        // Visitors section.
        'Visitors (1)',
        'Dana Superintendent',
        'Hold point inspection',
        'Addendums (1)',
        'Addendum 1',
        'Client requested photo set attached after inspection.',
        'Daily Summary',
        'Personnel: 2 (16.0 hrs)',
        'Plant: 1 items (7.0 hrs)',
        'Activities: 1',
        'Delays: 1 (0.8 hrs)',
      ]),
    );
    // Contemporaneity status line carries the same-day/late flag.
    expect(textContent).toContain('Late entry');
    // Shared per-page document footer identity.
    expect(textContent).toContain('Page 1 of');
    expect(textContent).toContain('Pacific Highway Upgrade / Diary 2026-05-28');
    expect(textContent).not.toContain('Civil Execution and Conformance Platform');
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
        'Status: Submitted',
        'Prepared by: Morgan Estimator',
        'This evidence package supports your payment claim evidence record.',
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
        'Conformed',
        '100%',
        '3/3',
        '$185,000',
        'DR-014',
        'Drainage',
        'In Progress',
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
        'Status: Conformed | Claim Amount: $185,000',
        'ITP Checklist',
        'Template: Earthworks ITP - Subgrade',
        'Completion: 4/4 items (100%)',
        'Hold Points: 2/2 released',
        'Test Results',
        'Total: 3 | Passed: 3 | Pending: 0 | Failed: 0',
        'Conformance',
        'By: Jordan Surveyor',
        'Photos recorded: 6',
        'LOT: DR-014',
        'Stormwater drainage line and pits',
        'Activity: Drainage',
        'Status: In Progress | Claim Amount: $63,500',
        'Template: Drainage ITP - Pipe Laying',
        'Completion: 3/4 items (75%)',
        'Hold Points: 1/2 released',
        'Total: 2 | Passed: 1 | Pending: 0 | Failed: 1',
        'Non-Conformance Reports',
        'Total: 1 | Open: 1 | Closed: 0',
        'Photos recorded: 3',
        'EVIDENCE MANIFEST',
        'LOT EW-001',
        'EW-001-proof-photo.jpg',
        'photo | Conformed subgrade proof photo',
        'EW-001-compaction-certificate.pdf',
        'test_result | Compaction certificate',
        'LOT DR-014',
        'DR-014-pit-photo.jpg',
        'photo',
      ]),
    );

    // Test-result and NCR detail lines (assert stable tails; pass/fail glyphs are a prefix)
    expect(textContent).toContain('Compaction: 98 %');
    expect(textContent).toContain('Moisture: 12 %');
    expect(textContent).toContain('CBR: 45 %');
    expect(textContent).toContain('Concrete Slump: 80 mm');
    expect(textContent).toContain('Pipe Joint: pending');
    expect(textContent).toContain('NCR-0021 (minor): Open');

    expect(text).toEqual(
      expect.arrayContaining([
        'DECLARATION',
        'This evidence package contains the supporting documentation for Progress Claim',
        '#7 in the amount of $248,500.',
        'knowledge. It describes the work claimed in this package and the evidence available',
        'at generation time. Lot status and percentage complete are shown in the lot sections.',
        'Signature',
        'Name',
        'Date',
      ]),
    );
    // Shared per-page document footer identity (replaces the cover + declaration CIVOS lines).
    expect(textContent).toContain('Page 1 of');
    expect(textContent).toContain('Pacific Highway Upgrade / Claim #7');
    expect(textContent).not.toContain('CIVOS - Civil Execution and Conformance Platform');
    expect(textContent).not.toContain('All lots included have been completed');
    expect(textContent).not.toContain('SiteProof v2');
  });

  it('includes ITP completion attachment documents in the claim evidence manifest', async () => {
    const lotWithAttachmentOnlyEvidence = {
      ...submittedClaimEvidencePackageFixture.lots[0],
      lotNumber: 'ITP-ATTACH',
      documents: [],
      itp: {
        ...submittedClaimEvidencePackageFixture.lots[0].itp!,
        completions: [
          {
            isCompleted: true,
            attachments: [
              {
                id: 'attachment-1',
                documentId: 'doc-itp-attachment-1',
                document: {
                  id: 'doc-itp-attachment-1',
                  filename: 'itp-completion-photo.jpg',
                  documentType: 'photo',
                  caption: 'Checklist item evidence photo',
                  uploadedAt: '2026-05-20T05:10:00.000Z',
                },
              },
            ],
          },
        ],
      },
    };

    await generateClaimEvidencePackagePDF({
      ...submittedClaimEvidencePackageFixture,
      lots: [lotWithAttachmentOnlyEvidence],
      summary: {
        ...submittedClaimEvidencePackageFixture.summary,
        totalLots: 1,
      },
    });

    const textContent = renderedText(latestPdf()).join('\n');
    expect(textContent).toContain('LOT ITP-ATTACH');
    expect(textContent).toContain('itp-completion-photo.jpg');
    expect(textContent).toContain('photo | Checklist item evidence photo');
    expect(textContent).toContain('Document ID: doc-itp-attachment-1');
  });

  it('renders claim variations and their evidence documents when included', async () => {
    const claimWithVariations: ClaimEvidencePackageData = {
      ...submittedClaimEvidencePackageFixture,
      claim: {
        ...submittedClaimEvidencePackageFixture.claim,
        totalClaimedAmount: 260500,
      },
      variations: [
        {
          id: 'variation-1',
          variationNumber: 'VAR-001',
          title: 'Additional drainage excavation',
          clientReference: 'TFNSW-CVO-14',
          approvedAmount: 12000,
          evidence: [
            {
              id: 'variation-evidence-1',
              documentId: 'doc-var-1',
              filename: 'VAR-001-client-approval.pdf',
              fileUrl: 'supabase://documents/variations/VAR-001-client-approval.pdf',
              evidenceType: 'client_approval',
              uploadedAt: '2026-05-22T01:10:00.000Z',
            },
          ],
        },
      ],
      summary: {
        ...submittedClaimEvidencePackageFixture.summary,
        totalClaimedAmount: 260500,
        lotsTotalClaimedAmount: 248500,
        variationsTotal: 12000,
      },
    };

    await generateClaimEvidencePackagePDF(claimWithVariations);

    const textContent = renderedText(latestPdf()).join('\n');
    expect(textContent).toContain('Claimed Amount: $260,500');
    expect(textContent).toContain('VARIATIONS');
    expect(textContent).toContain('VAR #');
    expect(textContent).toContain('VAR-001');
    expect(textContent).toContain('Additional drainage excavation');
    expect(textContent).toContain('TFNSW-CVO-14');
    expect(textContent).toContain('$12,000');
    expect(textContent).toContain('Subtotal');
    expect(textContent).toContain('VARIATION VAR-001');
    expect(textContent).toContain('VAR-001-client-approval.pdf');
    expect(textContent).toContain('client_approval');
    expect(textContent).toContain('Document ID: doc-var-1');
    expect(textContent).toContain('#7 in the amount of $260,500.');
  });

  it('omits claim variations and their manifest evidence when the option is disabled', async () => {
    const claimWithVariations: ClaimEvidencePackageData = {
      ...submittedClaimEvidencePackageFixture,
      variations: [
        {
          id: 'variation-1',
          variationNumber: 'VAR-001',
          title: 'Additional drainage excavation',
          clientReference: 'TFNSW-CVO-14',
          approvedAmount: 12000,
          evidence: [
            {
              id: 'variation-evidence-1',
              documentId: 'doc-var-1',
              filename: 'VAR-001-client-approval.pdf',
              fileUrl: 'supabase://documents/variations/VAR-001-client-approval.pdf',
              evidenceType: 'client_approval',
              uploadedAt: '2026-05-22T01:10:00.000Z',
            },
          ],
        },
      ],
      summary: {
        ...submittedClaimEvidencePackageFixture.summary,
        variationsTotal: 12000,
      },
    };

    await generateClaimEvidencePackagePDF(claimWithVariations, {
      includeLotSummary: true,
      includeLotDetails: true,
      includeITPChecklists: true,
      includeTestResults: true,
      includeNCRs: true,
      includeHoldPoints: true,
      includePhotos: true,
      includeVariations: false,
      includeDeclaration: true,
    });

    const textContent = renderedText(latestPdf()).join('\n');
    expect(textContent).not.toContain('VARIATIONS');
    expect(textContent).not.toContain('Additional drainage excavation');
    expect(textContent).not.toContain('VAR-001-client-approval.pdf');
    expect(textContent).not.toContain('Document ID: doc-var-1');
  });

  it('does not throw when the claim evidence payload has no variations field', async () => {
    const olderPayload = { ...submittedClaimEvidencePackageFixture };
    delete (olderPayload as Partial<ClaimEvidencePackageData>).variations;

    await expect(generateClaimEvidencePackagePDF(olderPayload)).resolves.toBeUndefined();

    const textContent = renderedText(latestPdf()).join('\n');
    expect(textContent).toContain('PROGRESS CLAIM');
    expect(textContent).not.toContain('VARIATIONS');
  });

  it('keeps claim evidence ITP detail counts aligned with accepted completion percentage', async () => {
    const reviewSensitiveLot = {
      ...submittedClaimEvidencePackageFixture.lots[1],
      lotNumber: 'QA-REVIEW',
      description: 'Verification-sensitive checklist',
      itp: {
        ...submittedClaimEvidencePackageFixture.lots[1].itp!,
        checklistItems: [{}, {}, {}],
        completions: [
          { isCompleted: true },
          { isCompleted: false },
          { isCompleted: false, isNotApplicable: true },
        ],
      },
      summary: {
        ...submittedClaimEvidencePackageFixture.lots[1].summary,
        itpCompletionPercentage: 67,
      },
    };

    await generateClaimEvidencePackagePDF({
      ...submittedClaimEvidencePackageFixture,
      lots: [reviewSensitiveLot],
      summary: {
        ...submittedClaimEvidencePackageFixture.summary,
        totalLots: 1,
        conformedLots: 0,
      },
    });

    const textContent = renderedText(latestPdf()).join('\n');
    expect(textContent).toContain('Completion: 2/3 items (67%)');
    expect(textContent).not.toContain('Completion: 3/3 items (67%)');
  });

  it('renders selected claim evidence sections when detailed lot metadata is excluded', async () => {
    await generateClaimEvidencePackagePDF(submittedClaimEvidencePackageFixture, {
      includeLotSummary: false,
      includeLotDetails: false,
      includeITPChecklists: false,
      includeTestResults: true,
      includeNCRs: true,
      includeHoldPoints: true,
      includePhotos: false,
      includeVariations: false,
      includeDeclaration: false,
    });

    const text = renderedText(latestPdf());
    const textContent = text.join('\n');

    expect(text).toEqual(
      expect.arrayContaining([
        'LOT: EW-001',
        'Status: Conformed | Claim Amount: $185,000',
        'Hold Points',
        'Hold Points: 2/2 released',
        'Test Results',
        'Total: 3 | Passed: 3 | Pending: 0 | Failed: 0',
        'LOT: DR-014',
        'Hold Points: 1/2 released',
        'Non-Conformance Reports',
      ]),
    );
    expect(textContent).toContain('NCR-0021 (minor): Open');
    expect(textContent).not.toContain('Bulk earthworks to subgrade level');
    expect(textContent).not.toContain('Chainage: 100 - 350');
  });

  it('preserves released hold point evidence package sections, checklist, tests, photos, and filename', async () => {
    // Local variant carrying the release signature + recipient of record so the
    // Release Authorisation block renders. The shared fixture stays
    // signature-free so the branding test can still assert no addImage.
    const signedFixture: typeof releasedHpEvidencePackageFixture = {
      ...releasedHpEvidencePackageFixture,
      holdPoint: {
        ...releasedHpEvidencePackageFixture.holdPoint,
        releaseSignatureUrl: 'data:image/png;base64,ZmFrZS1zaWduYXR1cmU=',
        notificationSentTo: 'super@client.example',
      },
    };
    await generateHPEvidencePackagePDF(signedFixture);

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
        'Released By: Sam Supervisor, Client Superintendent Org',
        'Release Method: Secure Link',
        'Recipient of Record: super@client.example',
        'Release Notes: Released after surveyor confirmed level tolerance.',
        'Release Signature:',
        'Signed electronically by Sam Supervisor',
      ]),
    );
    // The signature image is embedded.
    expect(doc.operations.some((operation) => operation.name === 'addImage')).toBe(true);
    // Date labels render (locale-formatted values intentionally not asserted)
    expect(textContent).toContain('Scheduled Date:');
    expect(textContent).toContain('Released:');
    // Per-page document footer identity.
    expect(textContent).toContain('Page 1 of');
    // Checklist accountability second line (who verified).
    expect(textContent).toContain('Verified by Sam Supervisor');

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
        '6. Survey Data',
        'Chainage Range: 100 - 350',
        '7. Evidence Summary',
        'Checklist Items Completed: 2 / 3',
        'Items Verified: 1',
        'Test Results: 2 (1 passing)',
        'Attachments: 1',
        // Platform attribution moved to the shared per-page footer.
        'Generated by CIVOS · civos.com.au',
      ]),
    );
    expect(textContent).not.toContain(
      'This evidence package was generated by CIVOS - Civil Execution and Conformance Platform',
    );
    // Photo rows append a locale date; assert the stable filename/caption only
    expect(textContent).toContain('subgrade-east.jpg');
    expect(textContent).toContain('East end after proof roll');
    expect(textContent).toContain('level-check.jpg');

    expect(textContent).not.toContain('SiteProof v2');
    // Placeholder noise is gone.
    expect(textContent).not.toContain('available in CIVOS system');
  });

  it('reserves a header band so the logo and title do not collide', async () => {
    await generateHPEvidencePackagePDF({
      ...releasedHpEvidencePackageFixture,
      project: {
        ...releasedHpEvidencePackageFixture.project,
        company: { name: 'RYOX Carpentry', logoUrl: 'data:image/png;base64,iVBORw0KGgo=' },
      },
    });

    const doc = latestPdf();
    // Logo embedded top-right.
    expect(doc.operations.some((operation) => operation.name === 'addImage')).toBe(true);
    // Title is pushed below the logo band (band bottom 8+14=22, +6 gap = 28).
    const titleOp = doc.operations.find(
      (operation) =>
        operation.name === 'text' &&
        Array.isArray(operation.args[0]) &&
        (operation.args[0] as string[])[0] === 'HOLD POINT EVIDENCE PACKAGE',
    );
    expect(titleOp).toBeDefined();
    expect(titleOp!.args[2]).toBeGreaterThanOrEqual(28);
    expect(renderedText(doc)).toContain('RYOX Carpentry');
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
        'None recorded for this lot.',
        'Checklist Items Completed: 0 / 0',
      ]),
    );

    // Optional lines for absent data are not emitted
    expect(textContent).not.toContain('Released By:');
    expect(textContent).not.toContain('Release Notes:');
    expect(textContent).not.toContain('Release Signature:');
    expect(textContent).not.toContain('Scheduled Date:');
    expect(textContent).not.toContain('Project Number:');
    expect(textContent).not.toContain('Activity Type:');
    expect(textContent).not.toContain('Photo List:');
    expect(textContent).not.toContain('Chainage');
    expect(textContent).not.toContain('SiteProof v2');
    expect(textContent).not.toContain('available in CIVOS system');
    // Per-page document footer identity still stamps the (single) page.
    expect(textContent).toContain('Page 1 of');
  });

  it('preserves standard conformance report sections, empty-state fallbacks, and filename', async () => {
    const conformanceFixture: ConformanceReportData = {
      lot: {
        lotNumber: 'EW-001',
        description: 'Bulk earthworks to subgrade level',
        status: 'conformed',
        activityType: 'Earthworks',
        chainageStart: 100,
        chainageEnd: 350,
        layer: 'Subgrade',
        areaZone: null,
        conformedAt: '2026-05-28T01:00:00.000Z',
        conformedBy: { fullName: 'Jordan Surveyor', email: 'jordan@example.com' },
      },
      project: {
        name: 'Pacific Highway Upgrade',
        projectNumber: 'PHU-001',
      },
      itp: null,
      testResults: [],
      ncrs: [],
      holdPointReleases: [],
      photoCount: 0,
    };

    await generateConformanceReportPDF(conformanceFixture, {
      ...defaultConformanceOptions,
      format: 'standard',
    });

    const doc = latestPdf();
    const text = renderedText(doc);
    const textContent = text.join('\n');

    expect(doc.savedFilename).toBe('Conformance-Report-EW-001-2026-05-28.pdf');
    expect(text).toEqual(
      expect.arrayContaining([
        'LOT CONFORMANCE REPORT',
        'Project Information',
        'Project: Pacific Highway Upgrade',
        'Lot Information',
        'Lot Number: EW-001',
        'STATUS: CONFORMED',
        'ITP Checklist Summary',
        'No ITP assigned to this lot.',
        'Test Results Summary',
        'No test results recorded for this lot.',
        'Hold Point Releases',
        'NCR Summary',
        'No NCRs raised for this lot.',
        'Photo Evidence',
        // Photo placeholder noise replaced by the shared empty-section copy.
        'None recorded for this lot.',
        // Platform attribution moved to the shared per-page footer.
        'Generated by CIVOS · civos.com.au',
      ]),
    );
    // Shared per-page document footer identity.
    expect(textContent).toContain('Page 1 of');
    expect(textContent).toContain('Pacific Highway Upgrade / Lot EW-001');
    expect(textContent).not.toContain(
      'This report was generated by CIVOS - Construction Quality Management System',
    );
    expect(textContent).not.toContain('available in the CIVOS system');
  });
});
