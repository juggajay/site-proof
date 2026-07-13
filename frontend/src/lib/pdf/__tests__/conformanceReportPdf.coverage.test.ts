import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateConformanceReportPDF } from '../../pdfGenerator';
import type { ConformanceCoverage, ConformanceReportData } from '../../pdfGenerator';
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
    layer: null,
    areaZone: null,
    conformedAt: null,
    conformedBy: null,
  },
  project: { name: 'Pacific Highway Upgrade', projectNumber: 'PHU-001' },
  itp: null,
  testResults: [],
  ncrs: [],
  holdPointReleases: [],
  photoCount: 0,
};

const goldenCoverage: ConformanceCoverage = {
  controlLines: [
    {
      id: 'cl-1',
      name: 'Mainline CL',
      extentStart: 1000,
      extentEnd: 2000,
      unmappedLotCount: 3,
      groups: [
        {
          activityType: 'All work types',
          lotCount: 6,
          percentLotted: 86,
          percentConformed: 60,
          coveredLengthM: 860,
          conformedLengthM: 600,
          gaps: [{ start: 1240, end: 1380, lengthM: 140 }],
        },
        {
          activityType: 'Subbase',
          lotCount: 2,
          percentLotted: 50,
          percentConformed: 50,
          coveredLengthM: 500,
          conformedLengthM: 500,
          gaps: [],
        },
      ],
    },
  ],
};

describe('conformance report — chainage coverage section', () => {
  beforeEach(() => {
    JsPdfRecorder.instances = [];
    vi.setSystemTime(new Date('2026-05-30T02:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the coverage table, gaps, and unmapped disclosure from golden data', async () => {
    await generateConformanceReportPDF({ ...baseReport, coverage: goldenCoverage });

    const text = renderedText(latestPdf());
    const content = text.join('\n');

    expect(text).toEqual(
      expect.arrayContaining([
        'Chainage Coverage',
        'Mainline CL  (Ch 1000 - 2000)',
        'Activity',
        '% Lotted',
        '% Conformed',
        'Covered/Extent (m)',
        'All work types',
        'Subbase',
      ]),
    );
    // Group cells (rounded ints, TZ-stable) and covered/extent metres.
    expect(content).toContain('86%');
    expect(content).toContain('60%');
    expect(content).toContain('860 / 1000');
    // Aggregate gap list + unmapped disclosure.
    expect(content).toContain('Ch 1240 - 1380  (140 m)');
    expect(content).toContain('3 lots have no mapped geometry and are excluded from coverage.');
  });

  it('omits the whole section when the toggle is off, leaving other sections intact', async () => {
    await generateConformanceReportPDF(
      { ...baseReport, coverage: goldenCoverage },
      {
        format: 'standard',
        includeITPChecklist: true,
        includeTestResults: true,
        includeHoldPoints: true,
        includeNCRs: true,
        includePhotos: true,
        includeChainageCoverage: false,
      },
    );

    const content = renderedText(latestPdf()).join('\n');
    expect(content).not.toContain('Chainage Coverage');
    expect(content).not.toContain('Mainline CL');
    // Neighbouring sections still render — no gap left by the omission.
    expect(content).toContain('Photo Evidence');
    expect(content).toContain('NCR Summary');
  });

  it('renders a note (not a failure) when there are no control lines', async () => {
    await generateConformanceReportPDF({ ...baseReport, coverage: { controlLines: [] } });

    const content = renderedText(latestPdf()).join('\n');
    expect(content).toContain('Chainage Coverage');
    expect(content).toContain(
      'No control lines are defined for this project, so chainage coverage is unavailable.',
    );
  });

  it('renders the note when coverage is null (best-effort fetch failed)', async () => {
    await generateConformanceReportPDF({ ...baseReport, coverage: null });

    const content = renderedText(latestPdf()).join('\n');
    expect(content).toContain('Chainage Coverage');
    expect(content).toContain('chainage coverage is unavailable');
  });
});
