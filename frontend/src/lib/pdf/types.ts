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

export interface PDFCompanyBranding {
  name?: string | null;
  logoUrl?: string | null;
  abn?: string | null;
  address?: string | null;
}

export interface PDFBrandingData {
  companyName?: string | null;
  logoUrl?: string | null;
  abn?: string | null;
  address?: string | null;
}

export interface PDFBrandableData {
  company?: PDFCompanyBranding | null;
  branding?: PDFBrandingData | null;
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

export interface DashboardPDFData extends PDFBrandableData {
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
  id?: string;
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
  isNotApplicable?: boolean;
  isFailed?: boolean;
  isPendingVerification?: boolean;
  isRejected?: boolean;
  verificationStatus?: string | null;
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
  releasedByName?: string | null;
  releasedByOrg?: string | null;
  releaseMethod?: string | null;
}

export interface ConformanceReportData extends PDFBrandableData {
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

export interface HPEvidencePackageData extends PDFBrandableData {
  holdPoint: {
    id: string;
    description: string;
    itpChecklistItemId?: string | null;
    status: string;
    notificationSentAt: string | null;
    notificationSentTo?: string | null;
    scheduledDate: string | null;
    releasedAt: string | null;
    releasedByName: string | null;
    releasedByOrg?: string | null;
    releaseMethod?: string | null;
    releaseSignatureUrl?: string | null;
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
    company?: PDFCompanyBranding | null;
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

// One ITP checklist item as sent by the evidence payload. Only id/description
// are relied on for itemised rendering; the rest are optional passthrough.
export interface ClaimItpChecklistItem {
  id?: string;
  sequenceNumber?: number;
  description?: string;
  responsibleParty?: string;
  pointType?: string;
  isHoldPoint?: boolean;
  evidenceRequired?: string;
}

export interface ClaimPersonRef {
  name: string;
  email?: string;
}

export interface ClaimItpCompletion {
  checklistItemId?: string;
  isCompleted?: boolean;
  isNotApplicable?: boolean;
  completedAt?: string | null;
  completedBy?: ClaimPersonRef | null;
  isVerified?: boolean;
  verifiedAt?: string | null;
  verifiedBy?: ClaimPersonRef | null;
  attachments?: {
    id: string;
    documentId: string;
    document: ClaimEvidenceDocument | null;
  }[];
}

export interface ClaimHoldPoint {
  status?: string;
  description?: string;
  releasedAt?: string | null;
  releasedBy?: { name: string; organization?: string | null } | null;
}

export interface ClaimTestResult {
  testType: string;
  resultValue: number | string | null;
  resultUnit?: string | null;
  passFail?: string | null;
  status?: string | null;
  testRequestNumber?: string | null;
  laboratoryName?: string | null;
  resultDate?: string | null;
  sampleDate?: string | null;
  isVerified?: boolean;
  verifiedBy?: ClaimPersonRef | null;
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

export interface ClaimVariationEvidenceDocument {
  id?: string;
  documentId: string;
  filename: string;
  fileUrl?: string | null;
  evidenceType?: string | null;
  uploadedAt?: string | null;
}

export interface ClaimVariation {
  id: string;
  variationNumber: string;
  title: string;
  clientReference: string | null;
  approvedAmount: number;
  evidence?: ClaimVariationEvidenceDocument[];
}

export interface ClaimEvidencePackageData extends PDFBrandableData {
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
    // Physical position (%), no dollars. Optional so older payloads/tests fall
    // back to percentComplete.
    percentThisClaim?: number;
    percentPrevious?: number;
    percentCumulative?: number;
    itp: {
      templateName: string;
      checklistItems: ClaimItpChecklistItem[];
      completions: ClaimItpCompletion[];
    } | null;
    holdPoints: ClaimHoldPoint[];
    testResults: ClaimTestResult[];
    ncrs: ClaimNcr[];
    documents: ClaimEvidenceDocument[];
    summary: {
      testResultCount: number;
      passedTestCount: number;
      failedTestCount?: number;
      pendingTestCount?: number;
      ncrCount: number;
      openNcrCount: number;
      photoCount: number;
      itpCompletionPercentage: number;
    };
  }[];
  variations?: ClaimVariation[];
  // Activity-type subtotals computed server-side. subtotal is a pass-through sum
  // of this claim's own lot line amounts (not a CIVOS-derived contract value).
  lotsByActivity?: {
    activityType: string;
    lotCount: number;
    subtotal: number;
    lots: { id: string; lotNumber: string; amount: number }[];
  }[];
  summary: {
    totalLots: number;
    totalClaimedAmount: number;
    lotsTotalClaimedAmount?: number;
    variationsTotal?: number;
    totalTestResults: number;
    totalPassedTests: number;
    totalFailedTests?: number;
    totalPendingTests?: number;
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
  includeVariations: boolean;
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
  includeVariations: true,
  includeDeclaration: true,
};

export interface NCRDetailData extends PDFBrandableData {
  ncr: {
    ncrNumber: string;
    description: string;
    category: string;
    severity: 'minor' | 'major';
    status: string;
    rootCauseCategory?: string | null;
    rootCause?: string | null;
    proposedAction?: string | null;
    actionTaken?: string | null;
    preventativeMeasures?: string | null;
    verificationNotes?: string | null;
    lessonsLearned?: string | null; // Feature #474
    qmApprovalRequired: boolean;
    qmApprovedAt: string | null;
    qmApprovedBy?: { id?: string; fullName: string; email: string } | null;
    raisedBy: { fullName: string; email: string };
    responsibleUser?: { fullName: string; email: string } | null;
    responsibleSubcontractor?: { companyName: string } | null;
    dueDate?: string | null;
    closedAt?: string | null;
    closedBy?: { fullName: string; email: string } | null;
    createdAt: string;
    evidence?: Array<{
      id: string;
      evidenceType: string;
      uploadedAt?: string | null;
      document: {
        id: string;
        filename: string;
        mimeType?: string | null;
        uploadedAt?: string | null;
      } | null;
    }>;
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

export interface TestCertificateData extends PDFBrandableData {
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
    verifiedBy?: { fullName: string | null; email: string } | null;
    verifiedAt?: string | null;
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

export interface DailyDiaryPDFData extends PDFBrandableData {
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
    // Contemporaneity: server-set lock timestamp (present once submitted). Its
    // presence is the "record is closed to edits" fact a reviewer relies on.
    lockedAt?: string | null;
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
    // Provenance: 'docket' = pulled from an approved subcontractor docket;
    // 'manual' = hand-entered. Load-bearing for who attested the row.
    source?: string | null;
    lot?: { lotNumber: string } | null;
  }>;
  plant: Array<{
    id: string;
    description: string;
    idRego?: string | null;
    company?: string | null;
    hoursOperated?: number | null;
    notes?: string | null;
    source?: string | null;
    lot?: { lotNumber: string } | null;
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
    lot?: { lotNumber: string } | null;
  }>;
  deliveries?: Array<{
    id: string;
    description: string;
    supplier?: string | null;
    docketNumber?: string | null;
    quantity?: number | null;
    unit?: string | null;
    lot?: { lotNumber: string } | null;
    notes?: string | null;
  }>;
  // Safety / site events. Rendered as occurrence + reference (type, short
  // description, lot) — not the raw narrative note.
  events?: Array<{
    id: string;
    eventType: string;
    description: string;
    lot?: { lotNumber: string } | null;
  }>;
  visitors?: Array<{
    id: string;
    name: string;
    company?: string | null;
    purpose?: string | null;
    timeInOut?: string | null;
  }>;
  addendums?: Array<{
    id: string;
    content: string;
    addedBy: { fullName: string; email: string };
    addedAt: string;
  }>;
}

export interface DocketDetailPDFData extends PDFBrandableData {
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
    submittedBy?: { fullName: string | null; email: string } | null;
    approvedBy?: { fullName: string | null; email: string } | null;
    // Itemised lines (optional; absent on older callers that only had totals).
    // Costs/rates are permission-gated server-side (null when restricted).
    labourEntries?: DocketLabourLine[];
    plantEntries?: DocketPlantLine[];
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

export interface DocketLabourLine {
  employee: { name: string; role?: string | null };
  submittedHours: number;
  approvedHours?: number | null;
  hourlyRate?: number | null;
  submittedCost?: number | null;
  approvedCost?: number | null;
  adjustmentReason?: string | null;
}

export interface DocketPlantLine {
  plant: { type: string; description?: string | null; idRego?: string | null };
  hoursOperated: number;
  wetOrDry?: string | null;
  hourlyRate?: number | null;
  submittedCost?: number | null;
  approvedCost?: number | null;
  adjustmentReason?: string | null;
}
