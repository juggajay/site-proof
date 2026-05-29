import type {
  DashboardPDFData,
  DailyDiaryPDFData,
  DocketDetailPDFData,
  NCRDetailData,
  TestCertificateData,
} from '../../pdfGenerator';

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

export const majorNcrDetailFixture: NCRDetailData = {
  ncr: {
    ncrNumber: 'NCR-0009',
    description: 'Honeycombing identified on headwall concrete face after formwork strip.',
    category: 'workmanship',
    severity: 'major',
    status: 'pending_review',
    rootCause: 'Insufficient vibration around congested reinforcement.',
    proposedAction: 'Break out defective concrete and reinstate with approved repair mortar.',
    actionTaken: 'Repair methodology submitted for superintendent review.',
    preventativeMeasures: 'Brief crew on vibration pattern and add pre-pour checklist hold point.',
    lessonsLearned: 'Increase inspection frequency when reinforcement congestion is high.',
    qmApprovalRequired: true,
    qmApprovedAt: null,
    qmApprovedBy: null,
    raisedBy: {
      fullName: 'Quinn Manager',
      email: 'quinn@example.com',
    },
    responsibleUser: {
      fullName: 'Sam Supervisor',
      email: 'sam@example.com',
    },
    dueDate: '2026-06-04T00:00:00.000Z',
    closedAt: null,
    closedBy: null,
    createdAt: '2026-05-28T01:30:00.000Z',
  },
  project: {
    name: 'Pacific Highway Upgrade',
    projectNumber: 'PHU-001',
  },
  lots: [
    {
      lotNumber: 'STR-042',
      description: 'Headwall concrete repair',
    },
  ],
  timeline: [
    {
      action: 'NCR raised',
      performedBy: 'Quinn Manager',
      performedAt: '2026-05-28T01:30:00.000Z',
      notes: 'Photos attached in document register.',
    },
  ],
};

export const approvedDocketDetailFixture: DocketDetailPDFData = {
  docket: {
    id: 'docket-1',
    docketNumber: 'SD-0042',
    date: '2026-05-28T12:00:00.000Z',
    status: 'approved',
    notes: 'Completed drainage trenching and bedding placement for eastern run.',
    labourHours: 42,
    plantHours: 12,
    totalLabourSubmitted: 42,
    totalLabourApproved: 40,
    totalPlantSubmitted: 12,
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

export const submittedDailyDiaryFixture: DailyDiaryPDFData = {
  diary: {
    id: 'diary-1',
    date: '2026-05-28T12:00:00.000Z',
    status: 'submitted',
    weatherConditions: 'Cloudy with light rain',
    temperatureMin: 14,
    temperatureMax: 22,
    rainfallMm: 6,
    weatherNotes: 'Light rain paused excavation around lunch.',
    generalNotes:
      '<p>Morning toolbox completed before crews opened drainage trench.</p><p>Inspection photos uploaded.</p>',
    isLate: true,
    submittedBy: {
      fullName: 'Riley Foreman',
      email: 'riley@example.com',
    },
    submittedAt: '2026-05-28T08:30:00.000Z',
    createdAt: '2026-05-28T00:30:00.000Z',
    updatedAt: '2026-05-28T08:30:00.000Z',
  },
  project: {
    name: 'Pacific Highway Upgrade',
    projectNumber: 'PHU-001',
  },
  personnel: [
    {
      id: 'person-1',
      name: 'Nina Foreman',
      company: 'SiteProof Civil',
      role: 'Foreman',
      startTime: '06:30',
      finishTime: '15:00',
      hours: 8.5,
    },
    {
      id: 'person-2',
      name: 'Drainage Crew A',
      company: 'Drainage Crew',
      role: 'Pipe layer',
      startTime: '07:00',
      finishTime: '14:30',
      hours: 7.5,
    },
  ],
  plant: [
    {
      id: 'plant-1',
      description: 'Excavator 20t',
      idRego: 'EX-204',
      company: 'Drainage Crew',
      hoursOperated: 7,
      notes: 'Trimmed trench invert',
    },
  ],
  activities: [
    {
      id: 'activity-1',
      description: 'Drainage trench excavation',
      lot: { lotNumber: 'DR-010' },
      quantity: 24,
      unit: 'm',
      notes: 'Reached inspection hold point',
    },
  ],
  delays: [
    {
      id: 'delay-1',
      delayType: 'Weather',
      description: 'Short rain delay during bedding',
      startTime: '11:15',
      endTime: '12:00',
      durationHours: 0.75,
      impact: 'Delayed bedding compaction',
    },
  ],
  addendums: [
    {
      id: 'addendum-1',
      content: 'Client requested photo set attached after inspection.',
      addedBy: {
        fullName: 'Riley Reviewer',
        email: 'reviewer@example.com',
      },
      addedAt: '2026-05-28T09:10:00.000Z',
    },
  ],
};
