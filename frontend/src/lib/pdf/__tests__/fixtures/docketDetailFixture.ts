import type { DocketDetailPDFData } from '../../../pdfGenerator';

export const approvedDocketDetailFixture: DocketDetailPDFData = {
  docket: {
    id: 'docket-1',
    docketNumber: 'SD-0042',
    date: '2026-05-28T12:00:00.000Z',
    status: 'approved',
    notes: 'Completed drainage trenching and bedding placement for eastern run.',
    labourHours: 42,
    plantHours: 12,
    totalLabourSubmitted: 4200,
    totalLabourApproved: 40,
    totalPlantSubmitted: 1800,
    totalPlantApproved: 13,
    submittedAt: '2026-05-28T05:30:00.000Z',
    approvedAt: '2026-05-28T07:45:00.000Z',
    foremanNotes: 'Reduced labour by two hours after duplicate spotter entry was removed.',
    rejectionReason: null,
    adjustmentReason: 'Plant time increased for excavator standby during services potholing.',
  },
  subcontractor: {
    name: 'Precision Drainage Pty Ltd',
    abn: '12 345 678 901',
  },
  project: {
    name: 'Pacific Highway Upgrade',
    projectNumber: 'PHU-001',
  },
};
