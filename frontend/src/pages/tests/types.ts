export interface Lot {
  id: string
  lotNumber: string
}

export interface TestResult {
  id: string
  testType: string
  testRequestNumber: string | null
  laboratoryName: string | null
  laboratoryReportNumber: string | null
  sampleDate: string | null
  sampleLocation: string | null
  testDate: string | null
  resultDate: string | null
  resultValue: number | null
  resultUnit: string | null
  specificationMin: number | null
  specificationMax: number | null
  passFail: string
  status: string
  lotId: string | null
  lot: Lot | null
  aiExtracted?: boolean
  createdAt: string
  updatedAt: string
}

// Feature #200: AI Extraction types
export interface ExtractedField {
  value: string
  confidence: number
}

export interface ExtractionResult {
  success: boolean
  extractedFields: Record<string, ExtractedField>
  confidence: Record<string, number>
  lowConfidenceFields: { field: string; confidence: number }[]
  needsReview: boolean
  reviewMessage: string
}

export interface NcrFormData {
  description: string
  category: string
  severity: string
  specificationReference: string
}

export interface FailedTestForNcr {
  testId: string
  testType: string
  resultValue: string
  lotId: string | null
}

export interface CreateTestFormData {
  testType: string
  testMethod: string
  testRequestNumber: string
  laboratoryName: string
  laboratoryReportNumber: string
  nataSiteNumber: string
  sampleLocation: string
  sampleDepth: string
  materialType: string
  layerLift: string
  sampledBy: string
  sampleDate: string
  testDate: string
  resultDate: string
  lotId: string
  resultValue: string
  resultUnit: string
  specificationMin: string
  specificationMax: string
  specificationRef: string
  passFail: string
}
