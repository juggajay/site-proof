import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateConformanceReportPDF } from '../../pdfGenerator';
import type { ConformanceReportData } from '../../pdfGenerator';
import { JsPdfRecorder, latestPdf, renderedText } from './pdfTestRecorder';

vi.mock('jspdf', () => ({
  jsPDF: JsPdfRecorder,
}));

const baseReport: ConformanceReportData = {
  lot: {
    lotNumber: 'LOT-001',
    description: 'Subgrade preparation',
    status: 'conformed',
    activityType: 'Earthworks',
    chainageStart: 100,
    chainageEnd: 250,
    layer: 'Layer 1',
    areaZone: 'Zone A',
    conformedAt: '2026-05-30T00:00:00.000Z',
    conformedBy: { fullName: 'Jane Foreman', email: 'jane@example.com' },
  },
  project: {
    name: 'Pacific Highway Upgrade',
    projectNumber: 'PHU-001',
  },
  itp: {
    templateName: 'Earthworks ITP',
    checklistItems: [
      {
        id: 'item-proof-roll',
        order: 1,
        description: 'Proof roll subgrade',
        category: 'earthworks',
        responsibleParty: 'contractor',
        pointType: 'hold_point',
        isHoldPoint: true,
        evidenceRequired: 'photo',
      },
      {
        id: 'item-survey',
        order: 2,
        description: 'Survey set-out not applicable',
        category: 'survey',
        responsibleParty: 'contractor',
        pointType: 'standard',
        isHoldPoint: false,
        evidenceRequired: 'none',
      },
      {
        id: 'item-density',
        order: 3,
        description: 'Density testing awaiting verification',
        category: 'testing',
        responsibleParty: 'contractor',
        pointType: 'witness',
        isHoldPoint: false,
        evidenceRequired: 'test',
      },
    ],
    completions: [
      {
        checklistItemId: 'item-proof-roll',
        isCompleted: true,
        notes: null,
        completedAt: '2026-05-30T01:00:00.000Z',
        completedBy: { fullName: 'Riley Foreman', email: 'riley@example.com' },
        isVerified: true,
        verifiedAt: '2026-05-30T02:00:00.000Z',
        verifiedBy: { fullName: 'Quinn Manager', email: 'qm@example.com' },
      },
      {
        checklistItemId: 'item-survey',
        isCompleted: false,
        isNotApplicable: true,
        notes: 'Not applicable to this lot.',
        completedAt: '2026-05-30T01:05:00.000Z',
        completedBy: { fullName: 'Riley Foreman', email: 'riley@example.com' },
        isVerified: false,
        verifiedAt: null,
        verifiedBy: null,
      },
      {
        checklistItemId: 'item-density',
        isCompleted: true,
        isPendingVerification: true,
        verificationStatus: 'pending_verification',
        notes: null,
        completedAt: '2026-05-30T01:10:00.000Z',
        completedBy: { fullName: 'Riley Foreman', email: 'riley@example.com' },
        isVerified: false,
        verifiedAt: null,
        verifiedBy: null,
      },
    ],
  },
  testResults: [],
  ncrs: [],
  holdPointReleases: [
    {
      checklistItemDescription: 'Proof roll subgrade',
      releasedAt: '',
      releasedBy: null,
    },
  ],
  photoCount: 2,
};

describe('generateConformanceReportPDF', () => {
  beforeEach(() => {
    JsPdfRecorder.instances = [];
    vi.setSystemTime(new Date('2026-05-30T02:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses checklist item ids and accepted completion rules for ITP status', async () => {
    await generateConformanceReportPDF(baseReport);

    const text = renderedText(latestPdf());
    const textContent = text.join('\n');

    expect(latestPdf().savedFilename).toBe('Conformance-Report-LOT-001-2026-05-30.pdf');
    expect(textContent).toContain('Checklist Completion: 2 / 3 items (67%)');
    expect(text).toEqual(
      expect.arrayContaining([
        'Proof roll subgrade',
        'Done',
        'Survey set-out not applicable',
        'N/A',
        'Density testing awaiting verification',
        'Pending Review',
      ]),
    );
    expect(textContent).not.toContain('Checklist Completion: 1 / 3');
    expect(textContent).not.toContain('NaN%');
  });

  it('prints zero completion for empty ITP templates instead of NaN', async () => {
    await generateConformanceReportPDF({
      ...baseReport,
      itp: {
        templateName: 'Empty ITP',
        checklistItems: [],
        completions: [],
      },
    });

    const textContent = renderedText(latestPdf()).join('\n');

    expect(textContent).toContain('Checklist Completion: 0 / 0 items (0%)');
    expect(textContent).not.toContain('NaN%');
  });

  it('does not print Invalid Date for hold point releases without timestamps', async () => {
    await generateConformanceReportPDF(baseReport);

    const textContent = renderedText(latestPdf()).join('\n');

    expect(textContent).toContain('Released: Not recorded by Unknown');
    expect(textContent).not.toContain('Invalid Date');
  });
});
