import type { DashboardPDFData } from '../../../pdfGenerator';

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
