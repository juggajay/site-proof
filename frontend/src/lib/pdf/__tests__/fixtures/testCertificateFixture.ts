import type { TestCertificateData } from '../../../pdfGenerator';

export const passingTestCertificateFixture: TestCertificateData = {
  test: {
    id: 'test-result-1',
    testType: 'Compaction',
    testRequestNumber: 'TR-001',
    laboratoryName: 'Civil Lab Australia',
    laboratoryReportNumber: 'LAB-9931',
    sampleDate: '2026-05-20T00:00:00.000Z',
    sampleLocation: 'CH 100-120 LHS',
    testDate: '2026-05-21T00:00:00.000Z',
    resultDate: '2026-05-22T00:00:00.000Z',
    resultValue: 98,
    resultUnit: '%',
    specificationMin: 95,
    specificationMax: 100,
    passFail: 'pass',
    status: 'verified',
    aiExtracted: true,
    createdAt: '2026-05-22T04:30:00.000Z',
  },
  lot: {
    lotNumber: 'EW-001',
    description: 'Earthworks test section',
    activityType: 'Earthworks',
    chainageStart: 100,
    chainageEnd: 120,
  },
  project: {
    name: 'Pacific Highway Upgrade',
    projectNumber: 'PHU-001',
  },
};
