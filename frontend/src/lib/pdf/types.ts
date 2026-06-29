// Conformance package format types for Australian road authorities
export type ConformanceFormat = 'standard' | 'tmr' | 'tfnsw' | 'vicroads' | 'dit';

export interface ConformanceFormatOptions {
  format: ConformanceFormat;
  includeITPChecklist: boolean;
  includeTestResults: boolean;
  includeHoldPoints: boolean;
  includeNCRs: boolean;
  includePhotos: boolean;
  clientName?: string;
  contractNumber?: string;
}

// Default format options
export const defaultConformanceOptions: ConformanceFormatOptions = {
  format: 'standard',
  includeITPChecklist: true,
  includeTestResults: true,
  includeHoldPoints: true,
  includeNCRs: true,
  includePhotos: true,
};

export interface DashboardPDFAttentionItem {
  id: string;
  type: 'ncr' | 'holdpoint';
  title: string;
  description: string;
  status: string;
  daysOverdue?: number;
  daysStale?: number;
  dueDate?: string;
  project: {
    id: string;
    name: string;
    projectNumber: string;
  };
}

export interface DashboardPDFData {
  generatedAt: string;
  exportedBy?: string | null;
  dateRange: {
    label: string;
    startDate: string;
    endDate: string;
  };
  stats: {
    totalProjects: number;
    activeProjects: number;
    totalLots: number;
    openHoldPoints: number;
    openNCRs: number;
    attentionItems: {
      overdueNCRs: DashboardPDFAttentionItem[];
      staleHoldPoints: DashboardPDFAttentionItem[];
      total: number;
    };
    recentActivities: Array<{
      id: string;
      type: string;
      description: string;
      timestamp: string;
    }>;
  };
}

export interface ITPChecklistItem {
  order: number;
  description: string;
  category: string;
  responsibleParty: string;
  pointType: string;
  isHoldPoint: boolean;
  evidenceRequired: string;
}

export interface ITPCompletion {
  checklistItemId: string;
  isCompleted: boolean;
  notes: string | null;
  completedAt: string | null;
  completedBy: { fullName: string | null; email: string } | null;
  isVerified: boolean;
  verifiedAt: string | null;
  verifiedBy: { fullName: string | null; email: string } | null;
}

export interface TestResult {
  testType: string;
  testRequestNumber: string | null;
  laboratoryName: string | null;
  resultValue: number | null;
  resultUnit: string | null;
  passFail: string;
  status: string;
  sampleDate: string | null;
  resultDate: string | null;
}

export interface NCR {
  ncrNumber: string;
  description: string;
  category: string;
  severity: string;
  status: string;
  createdAt: string;
  closedAt: string | null;
}

export interface HoldPointRelease {
  checklistItemDescription: string;
  releasedAt: string;
  releasedBy: { fullName: string | null; email: string } | null;
}

export interface ConformanceReportData {
  lot: {
    lotNumber: string;
    description: string | null;
    status: string;
    activityType: string | null;
    chainageStart: number | null;
    chainageEnd: number | null;
    layer: string | null;
    areaZone: string | null;
    conformedAt: string | null;
    conformedBy: { fullName: string | null; email: string } | null;
  };
  project: {
    name: string;
    projectNumber: string | null;
  };
  itp: {
    templateName: string;
    checklistItems: ITPChecklistItem[];
    completions: ITPCompletion[];
  } | null;
  testResults: TestResult[];
  ncrs: NCR[];
  holdPointReleases: HoldPointRelease[];
  photoCount: number;
}

// Options for customizing the HP evidence package (Feature #466)
export interface HPPackageOptions {
  includeChecklistDetails: boolean;
  includeTestResults: boolean;
  includePhotos: boolean;
  includeReleaseDetails: boolean;
  includeSummary: boolean;
}

export const defaultHPPackageOptions: HPPackageOptions = {
  includeChecklistDetails: true,
  includeTestResults: true,
  includePhotos: true,
  includeReleaseDetails: true,
  includeSummary: true,
};

export interface HPEvidencePackageData {
  holdPoint: {
    id: string;
    description: string;
    itpChecklistItemId?: string | null;
    status: string;
    notificationSentAt: string | null;
    scheduledDate: string | null;
    releasedAt: string | null;
    releasedByName: string | null;
    releaseNotes: string | null;
  };
  lot: {
    id: string;
    lotNumber: string;
    description: string | null;
    activityType: string | null;
    chainageStart: number | null;
    chainageEnd: number | null;
  };
  project: {
    id: string;
    name: string;
    projectNumber: string | null;
  };
  itpTemplate: {
    id: string;
    name: string;
    activityType: string | null;
  };
  checklist: {
    itpChecklistItemId?: string | null;
    sequenceNumber: number;
    description: string;
    pointType: string | null;
    responsibleParty: string | null;
    isCompleted: boolean;
    completedAt: string | null;
    completedBy: string | null;
    isVerified: boolean;
    verifiedAt: string | null;
    verifiedBy: string | null;
    notes: string | null;
    attachments: {
      id: string;
      documentId?: string | null;
      filename: string;
      fileUrl?: string | null;
      caption: string | null;
    }[];
  }[];
  testResults: {
    id: string;
    testType: string;
    testRequestNumber: string | null;
    laboratoryName: string | null;
    resultValue: number | null;
    resultUnit: string | null;
    passFail: string | null;
    status: string;
    isVerified: boolean;
    verifiedBy: string | null;
    createdAt: string;
  }[];
  photos: {
    id: string;
    filename: string;
    fileUrl?: string | null;
    caption: string | null;
    uploadedAt: string | null;
  }[];
  summary: {
    totalChecklistItems: number;
    completedItems: number;
    verifiedItems: number;
    totalTestResults: number;
    passingTests: number;
    totalPhotos: number;
    totalAttachments: number;
  };
  generatedAt: string;
}

export interface ClaimItpCompletion {
  isCompleted?: boolean;
  isNotApplicable?: boolean;
}

export interface ClaimHoldPoint {
  status?: string;
}

export interface ClaimTestResult {
  testType: string;
  resultValue: number | string | null;
  resultUnit?: string | null;
  passFail?: string | null;
}

export interface ClaimNcr {
  ncrNumber: string;
  severity: string;
  status: string;
}

export interface ClaimEvidenceDocument {
  id: string;
  filename: string;
  documentType: string;
  caption: string | null;
  uploadedAt: string | null;
}

export interface ClaimEvidencePackageData {
  claim: {
    id: string;
    claimNumber: number;
    periodStart: string;
    periodEnd: string;
    status: string;
    totalClaimedAmount: number;
    certifiedAmount: number | null;
    submittedAt: string | null;
    preparedBy: { name: string; email: string } | null;
    preparedAt: string | null;
  };
  project: {
    id: string;
    name: string;
    projectNumber: string | null;
    clientName: string | null;
    state: string;
  };
  lots: {
    id: string;
    lotNumber: string;
    description: string | null;
    activityType: string | null;
    chainageStart: number | null;
    chainageEnd: number | null;
    layer: string | null;
    areaZone: string | null;
    status: string;
    conformedAt: string | null;
    conformedBy: { name: string; email: string } | null;
    claimAmount: number;
    percentComplete: number;
    itp: {
      templateName: string;
      checklistItems: unknown[];
      completions: ClaimItpCompletion[];
    } | null;
    holdPoints: ClaimHoldPoint[];
    testResults: ClaimTestResult[];
    ncrs: ClaimNcr[];
    documents: ClaimEvidenceDocument[];
    summary: {
      testResultCount: number;
      passedTestCount: number;
      ncrCount: number;
      openNcrCount: number;
      photoCount: number;
      itpCompletionPercentage: number;
    };
  }[];
  summary: {
    totalLots: number;
    totalClaimedAmount: number;
    totalTestResults: number;
    totalPassedTests: number;
    totalNCRs: number;
    totalOpenNCRs: number;
    totalPhotos: number;
    conformedLots: number;
  };
  generatedAt: string;
  generationTimeMs: number;
}

// Options for customizing the claim evidence package
export interface ClaimPackageOptions {
  includeLotSummary: boolean;
  includeLotDetails: boolean;
  includeITPChecklists: boolean;
  includeTestResults: boolean;
  includeNCRs: boolean;
  includeHoldPoints: boolean;
  includePhotos: boolean;
  includeDeclaration: boolean;
}

export const defaultPackageOptions: ClaimPackageOptions = {
  includeLotSummary: true,
  includeLotDetails: true,
  includeITPChecklists: true,
  includeTestResults: true,
  includeNCRs: true,
  includeHoldPoints: true,
  includePhotos: true,
  includeDeclaration: true,
};

export interface NCRDetailData {
  ncr: {
    ncrNumber: string;
    description: string;
    category: string;
    severity: 'minor' | 'major';
    status: string;
    rootCause?: string | null;
    proposedAction?: string | null;
    actionTaken?: string | null;
    preventativeMeasures?: string | null;
    lessonsLearned?: string | null; // Feature #474
    qmApprovalRequired: boolean;
    qmApprovedAt: string | null;
    qmApprovedBy?: { id?: string; fullName: string; email: string } | null;
    raisedBy: { fullName: string; email: string };
    responsibleUser?: { fullName: string; email: string } | null;
    dueDate?: string | null;
    closedAt?: string | null;
    closedBy?: { fullName: string; email: string } | null;
    createdAt: string;
  };
  project: {
    name: string;
    projectNumber: string;
  };
  lots: Array<{
    lotNumber: string;
    description: string | null;
  }>;
  timeline?: Array<{
    action: string;
    performedBy: string;
    performedAt: string;
    notes?: string;
  }>;
}

export interface TestCertificateData {
  test: {
    id: string;
    testType: string;
    testRequestNumber: string | null;
    laboratoryName: string | null;
    laboratoryReportNumber: string | null;
    sampleDate: string | null;
    sampleLocation: string | null;
    testDate: string | null;
    resultDate: string | null;
    resultValue: number | null;
    resultUnit: string | null;
    specificationMin: number | null;
    specificationMax: number | null;
    passFail: string;
    status: string;
    aiExtracted?: boolean;
    createdAt: string;
  };
  lot: {
    lotNumber: string;
    description: string | null;
    activityType: string | null;
    chainageStart: number | null;
    chainageEnd: number | null;
  } | null;
  project: {
    name: string;
    projectNumber: string;
  };
}

export interface DailyDiaryPDFData {
  diary: {
    id: string;
    date: string;
    status: 'draft' | 'submitted';
    weatherConditions?: string | null;
    temperatureMin?: number | null;
    temperatureMax?: number | null;
    rainfallMm?: number | null;
    weatherNotes?: string | null;
    generalNotes?: string | null;
    isLate?: boolean;
    submittedBy?: { fullName: string; email: string } | null;
    submittedAt?: string | null;
    createdAt: string;
    updatedAt: string;
  };
  project: {
    name: string;
    projectNumber: string | null;
  };
  personnel: Array<{
    id: string;
    name: string;
    company?: string | null;
    role?: string | null;
    startTime?: string | null;
    finishTime?: string | null;
    hours?: number | null;
  }>;
  plant: Array<{
    id: string;
    description: string;
    idRego?: string | null;
    company?: string | null;
    hoursOperated?: number | null;
    notes?: string | null;
  }>;
  activities: Array<{
    id: string;
    description: string;
    lot?: { lotNumber: string } | null;
    quantity?: number | null;
    unit?: string | null;
    notes?: string | null;
  }>;
  delays: Array<{
    id: string;
    delayType: string;
    description: string;
    startTime?: string | null;
    endTime?: string | null;
    durationHours?: number | null;
    impact?: string | null;
  }>;
  addendums?: Array<{
    id: string;
    content: string;
    addedBy: { fullName: string; email: string };
    addedAt: string;
  }>;
}

export interface DocketDetailPDFData {
  docket: {
    id: string;
    docketNumber: string;
    date: string;
    status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'queried';
    notes: string | null;
    labourHours: number;
    plantHours: number;
    totalLabourSubmitted: number | null;
    totalLabourApproved: number;
    totalPlantSubmitted: number | null;
    totalPlantApproved: number;
    totalLabourApprovedCost?: number | null;
    totalPlantApprovedCost?: number | null;
    submittedAt: string | null;
    approvedAt: string | null;
    foremanNotes: string | null;
    rejectionReason?: string | null;
    adjustmentReason?: string | null;
  };
  subcontractor: {
    name: string;
    abn?: string | null;
  };
  project: {
    name: string;
    projectNumber: string | null;
  };
}
