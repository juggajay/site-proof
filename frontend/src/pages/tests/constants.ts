import type { TestResult } from './types'

export const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  pass: 'bg-green-100 text-green-800',
  fail: 'bg-red-100 text-red-800',
}

export const testStatusColors: Record<string, string> = {
  requested: 'bg-gray-100 text-gray-800',
  at_lab: 'bg-yellow-100 text-yellow-800',
  results_received: 'bg-purple-100 text-purple-800',
  entered: 'bg-blue-100 text-blue-800',
  verified: 'bg-green-100 text-green-800',
}

export const testStatusLabels: Record<string, string> = {
  requested: 'Requested',
  at_lab: 'At Lab',
  results_received: 'Results Received',
  entered: 'Entered',
  verified: 'Verified',
}

// Feature #196: Valid status transitions
export const nextStatusMap: Record<string, string> = {
  requested: 'at_lab',
  at_lab: 'results_received',
  results_received: 'entered',
  entered: 'verified',
}

export const nextStatusButtonLabels: Record<string, string> = {
  requested: 'Mark as At Lab',
  at_lab: 'Mark Results Received',
  results_received: 'Enter Results',
  entered: 'Verify',
}

// Feature #197: Check if test is overdue (14+ days since creation and not verified)
export const OVERDUE_DAYS = 14

export const isTestOverdue = (test: TestResult): boolean => {
  if (test.status === 'verified') return false
  const created = new Date(test.createdAt)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const daysSinceCreated = Math.floor((today.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
  return daysSinceCreated >= OVERDUE_DAYS
}

// Feature #197: Calculate days since sample/creation
export const getDaysSince = (dateStr: string | null, fallbackDateStr: string): number => {
  const date = dateStr ? new Date(dateStr) : new Date(fallbackDateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
}

// Feature #198: Auto-calculate pass/fail when result or specs change
export const calculatePassFail = (value: string, min: string, max: string): string => {
  if (!value) return 'pending'
  const numValue = parseFloat(value)
  const numMin = min ? parseFloat(min) : null
  const numMax = max ? parseFloat(max) : null

  if (numMin !== null && numValue < numMin) return 'fail'
  if (numMax !== null && numValue > numMax) return 'fail'
  if (numMin !== null || numMax !== null) return 'pass'
  return 'pending'
}

// Feature #198: Test type specifications for auto-populate (Australian civil standards)
export const testTypeSpecs: Record<string, { min: string; max: string; unit: string; method?: string }> = {
  // Compaction/Density Tests
  'density_ratio': { min: '95', max: '100', unit: '% DDR', method: 'AS 1289.5.4.1' },
  'dry_density_ratio': { min: '95', max: '100', unit: '% DDR', method: 'AS 1289.5.4.1' },
  'field_density_nuclear': { min: '95', max: '100', unit: '% DDR', method: 'AS 1289.5.8.1' },
  'field_density_sand': { min: '95', max: '100', unit: '% DDR', method: 'AS 1289.5.3.1' },
  'mdd_standard': { min: '', max: '', unit: 't/m\u00B3', method: 'AS 1289.5.1.1' },
  'mdd_modified': { min: '', max: '', unit: 't/m\u00B3', method: 'AS 1289.5.2.1' },
  'hilf_rapid': { min: '95', max: '100', unit: '% MCWD', method: 'AS 1289.5.7.1' },
  // Strength Tests
  'cbr_laboratory': { min: '15', max: '', unit: '%', method: 'AS 1289.6.1.1' },
  'cbr_4day_soaked': { min: '10', max: '', unit: '%', method: 'AS 1289.6.1.1' },
  'cbr_field_dcp': { min: '', max: '10', unit: 'mm/blow', method: 'AS 1289.6.7.1' },
  'ucs': { min: '', max: '', unit: 'MPa', method: 'AS 5101.4' },
  // Classification Tests
  'particle_size_distribution': { min: '', max: '', unit: 'envelope', method: 'AS 1289.3.6.1' },
  'liquid_limit': { min: '', max: '45', unit: '%', method: 'AS 1289.3.1.1' },
  'plastic_limit': { min: '', max: '', unit: '%', method: 'AS 1289.3.2.1' },
  'plasticity_index': { min: '', max: '25', unit: '%', method: 'AS 1289.3.3.1' },
  'linear_shrinkage': { min: '', max: '10', unit: '%', method: 'AS 1289.3.4.1' },
  'moisture_content': { min: '', max: '', unit: '%', method: 'AS 1289.2.1.1' },
  // Aggregate Tests
  'flakiness_index': { min: '', max: '35', unit: '%', method: 'AS 1141.15' },
  'los_angeles_abrasion': { min: '', max: '35', unit: '%', method: 'AS 1141.23' },
  'aggregate_crushing_value': { min: '', max: '30', unit: '%', method: 'AS 1141.21' },
  'wet_dry_strength': { min: '', max: '35', unit: '%', method: 'AS 1141.22' },
  // Concrete Tests
  'concrete_slump': { min: '50', max: '120', unit: 'mm', method: 'AS 1012.3.1' },
  'concrete_strength': { min: '32', max: '', unit: 'MPa', method: 'AS 1012.9' },
  // Asphalt Tests
  'asphalt_density': { min: '93', max: '100', unit: '%', method: 'AS 2891.9.2' },
}

// State-based configuration for test methods and specifications
export const stateTestMethods: Record<string, { label: string; methods: string[] }> = {
  NSW: {
    label: 'NSW (TfNSW)',
    methods: ['TfNSW T111', 'TfNSW T112', 'TfNSW T117', 'TfNSW T162', 'TfNSW T166', 'TfNSW T173'],
  },
  QLD: {
    label: 'QLD (TMR)',
    methods: ['TMR Q102A', 'TMR Q103A', 'TMR Q113A', 'TMR Q113B', 'TMR Q114A', 'TMR Q114B', 'TMR Q117'],
  },
  VIC: {
    label: 'VIC (VicRoads)',
    methods: ['RC 500.01', 'RC 500.02', 'RC 500.03', 'RC 500.04', 'RC 500.05'],
  },
  SA: {
    label: 'SA (DIT)',
    methods: ['TP 320', 'TP 060', 'TP 913', 'AS 1289.5.4.1', 'AS 2891.8', 'AS 1012.9'],
  },
}

export const stateSpecRefs: Record<string, { label: string; specs: string[] }> = {
  NSW: {
    label: 'NSW (TfNSW)',
    specs: ['TfNSW R44', 'TfNSW R117', 'TfNSW 3051'],
  },
  QLD: {
    label: 'QLD (TMR)',
    specs: ['MRTS04', 'MRTS05', 'MRTS06', 'MRTS21', 'MRTS35'],
  },
  VIC: {
    label: 'VIC (VicRoads)',
    specs: ['Section 204', 'Section 812', 'Section 173'],
  },
  SA: {
    label: 'SA (DIT)',
    specs: ['RD-EW-C1', 'RD-PV-C1', 'RD-BP-C3', 'RD-DK-C1', 'ST-SC-C7'],
  },
}

export const INITIAL_FORM_DATA = {
  testType: '',
  testMethod: '',
  testRequestNumber: '',
  laboratoryName: '',
  laboratoryReportNumber: '',
  nataSiteNumber: '',
  sampleLocation: '',
  sampleDepth: '',
  materialType: '',
  layerLift: '',
  sampledBy: '',
  sampleDate: '',
  testDate: '',
  resultDate: '',
  lotId: '',
  resultValue: '',
  resultUnit: '',
  specificationMin: '',
  specificationMax: '',
  specificationRef: '',
  passFail: 'pending',
} as const

export const INITIAL_NCR_FORM_DATA = {
  description: '',
  category: 'materials',
  severity: 'minor',
  specificationReference: '',
} as const

// Feature #200: Get confidence indicator color/style
export const getConfidenceIndicator = (
  confidence: Record<string, number> | undefined,
  field: string
): { color: string; text: string } => {
  if (!confidence) return { color: '', text: '' }
  const conf = confidence[field]
  if (!conf) return { color: '', text: '' }

  if (conf < 0.80) {
    return { color: 'border-red-500 bg-red-50 dark:bg-red-900/30', text: `${Math.round(conf * 100)}% - Low confidence, please verify` }
  } else if (conf < 0.90) {
    return { color: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20', text: `${Math.round(conf * 100)}% confidence` }
  }
  return { color: 'border-green-500 bg-green-50 dark:bg-green-900/20', text: `${Math.round(conf * 100)}% confidence` }
}

// Feature #202: Get batch confidence indicator
export const getBatchConfidenceIndicator = (
  result: any,
  field: string
): { color: string; text: string } => {
  if (!result?.extraction?.confidence) return { color: '', text: '' }
  const confidence = result.extraction.confidence[field]
  if (!confidence) return { color: '', text: '' }

  if (confidence < 0.80) {
    return { color: 'border-red-500 bg-red-50', text: `${Math.round(confidence * 100)}%` }
  } else if (confidence < 0.90) {
    return { color: 'border-yellow-500 bg-yellow-50', text: `${Math.round(confidence * 100)}%` }
  }
  return { color: 'border-green-500 bg-green-50', text: `${Math.round(confidence * 100)}%` }
}
