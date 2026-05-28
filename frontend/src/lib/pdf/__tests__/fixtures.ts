import type { DashboardPDFData, TestCertificateData } from '../../pdfGenerator';

export const dashboardPdfFixture: DashboardPDFData = {
  generatedAt: '2026-05-28T03:15:00.000Z',
  exportedBy: 'Pat Owner',
  dateRange: {
    label: 'Last 30 days',
    startDate: '2026-05-01',
    endDate: '2026-05-28',
  },
  stats: {
    totalProjects: 3,
    activeProjects: 2,
    totalLots: 18,
    openHoldPoints: 4,
    openNCRs: 1,
    attentionItems: {
      total: 2,
      overdueNCRs: [
        {
          id: 'ncr-1',
          type: 'ncr',
          title: 'NCR-0007 pavement thickness',
          description: 'Corrective action overdue for pavement lot.',
          status: 'open',
          daysOverdue: 5,
          project: {
            id: 'project-1',
            name: 'Pacific Highway Upgrade',
            projectNumber: 'PHU-001',
          },
        },
      ],
      staleHoldPoints: [
        {
          id: 'hp-1',
          type: 'holdpoint',
          title: 'Release concrete pour hold point',
          description: 'Awaiting client release before pour.',
          status: 'requested',
          daysStale: 3,
          project: {
            id: 'project-1',
            name: 'Pacific Highway Upgrade',
            projectNumber: 'PHU-001',
          },
        },
      ],
    },
    recentActivities: [
      {
        id: 'activity-1',
        type: 'lot_status_changed',
        description: 'Lot EW-001 changed to conformed',
        timestamp: '2026-05-27T22:00:00.000Z',
      },
    ],
  },
};

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
