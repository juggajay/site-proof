export interface Lot {
  id: string;
  lotNumber: string;
}

export interface TestResult {
  id: string;
  testType: string;
  testRequestNumber: string | null;
  laboratoryName: string | null;
  laboratoryReportNumber: string | null;
  sampleDate: string | null;
  sampleLocation: string | null;
  // Wave C3 Phase B2: WHERE the sample was taken, captured by a human (spec §5.2).
  // Prisma Decimal serialises as a string; read them through `readSamplePoint`.
  sampleLatitude?: number | string | null;
  sampleLongitude?: number | string | null;
  sampleLocationSource?: string | null;
  sampleLocationAccuracyM?: number | string | null;
  testDate: string | null;
  resultDate: string | null;
  resultValue: number | null;
  resultUnit: string | null;
  specificationMin: number | null;
  specificationMax: number | null;
  // Batch C: optional contractor-annotated test method (nullable; entered on the
  // result form). The lab report remains the authoritative statement of method.
  testMethod?: string | null;
  passFail: string;
  status: string;
  verifiedBy?: { id: string; fullName: string | null; email: string } | null;
  verifiedAt?: string | null;
  // Wave C2 Phase 3: system-stamped when the sample was sent to the lab.
  sentToLabAt?: string | null;
  // Wave C2 Phase 3: user-supplied, optional. Blank is the normal case (J5).
  expectedResultDate?: string | null;
  lotId: string | null;
  lot: Lot | null;
  aiExtracted?: boolean;
  // Feature B2: set when a certificate Document is linked to this test. The
  // verification gate requires it, and the UI uses it to label the per-row
  // action "Attach" vs "Replace certificate".
  certificateDocId?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Feature #200: AI Extraction types
export interface ExtractedField {
  value: string;
  confidence: number;
}

export interface ExtractionResult {
  success: boolean;
  extractedFields: Record<string, ExtractedField>;
  confidence: Record<string, number>;
  lowConfidenceFields: { field: string; confidence: number }[];
  needsReview: boolean;
  reviewMessage: string;
}

export interface NcrFormData {
  description: string;
  category: string;
  severity: string;
  specificationReference: string;
  responsibleUserId?: string;
  responsibleSubcontractorId?: string;
}

export interface FailedTestForNcr {
  testId: string;
  testType: string;
  resultValue: string;
  lotId: string | null;
}

export interface CreateTestFormData {
  testType: string;
  testMethod: string;
  testRequestNumber: string;
  laboratoryName: string;
  laboratoryReportNumber: string;
  expectedResultDate: string;
  sampleLocation: string;
  sampleDepth: string;
  materialType: string;
  layerLift: string;
  sampledBy: string;
  sampleDate: string;
  testDate: string;
  resultDate: string;
  lotId: string;
  resultValue: string;
  resultUnit: string;
  specificationMin: string;
  specificationMax: string;
  specificationRef: string;
  passFail: string;
  // Optional link to the ITP checklist item this test satisfies. Set from the
  // Test Type picker / satisfiesItem flow; backend validates it against the lot.
  itpChecklistItemId?: string;
  // Wave C3 Phase B2. Present ONLY when a human captured a sample point in the
  // create form; absent means NULL, which is what "no location" is `[C3S-B1]`.
  // Numbers, not strings — they never go through the form's string trim.
  sampleLatitude?: number;
  sampleLongitude?: number;
  sampleLocationSource?: 'gps' | 'map_pick';
  sampleLocationAccuracyM?: number | null;
}
