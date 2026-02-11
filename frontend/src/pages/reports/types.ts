/**
 * Type definitions for Report-related pages and components.
 * Extracted from ReportsPage.tsx for reusability.
 */

export interface LotStatusReport {
  generatedAt: string
  projectId: string
  totalLots: number
  statusCounts: Record<string, number>
  activityCounts: Record<string, number>
  lots: Array<{
    id: string
    lotNumber: string
    description: string
    status: string
    activityType: string
    chainageStart: number | null
    chainageEnd: number | null
    offset: string | null
    layer: string | null
    areaZone: string | null
    createdAt: string
    conformedAt: string | null
  }>
  summary: {
    notStarted: number
    inProgress: number
    awaitingTest: number
    holdPoint: number
    ncrRaised: number
    conformed: number
    claimed: number
  }
  periodComparison?: {
    conformedThisPeriod: number
    conformedLastPeriod: number
    periodChange: number
    periodChangePercent: string
    currentPeriodLabel: string
    previousPeriodLabel: string
  }
}

export interface NCRReport {
  generatedAt: string
  projectId: string
  totalNCRs: number
  statusCounts: Record<string, number>
  categoryCounts: Record<string, number>
  rootCauseCounts: Record<string, number>
  responsiblePartyCounts: Record<string, number>
  overdueCount: number
  closedThisMonth: number
  averageClosureTime: number
  closureRate: string
  ncrs: Array<{
    id: string
    ncrNumber: string
    description: string
    category: string
    status: string
    raisedAt: string
    closedAt: string | null
    dueDate: string | null
    rootCauseCategory: string | null
  }>
  summary: {
    open: number
    investigating: number
    rectification: number
    verification: number
    closed: number
    closedConcession: number
    minor: number
    major: number
  }
}

export interface TestReport {
  generatedAt: string
  projectId: string
  totalTests: number
  passFailCounts: Record<string, number>
  testTypeCounts: Record<string, number>
  statusCounts: Record<string, number>
  tests: Array<{
    id: string
    testRequestNumber: string | null
    testType: string
    laboratoryName: string | null
    laboratoryReportNumber: string | null
    sampleDate: string | null
    resultDate: string | null
    resultValue: number | null
    resultUnit: string | null
    specificationMin: number | null
    specificationMax: number | null
    passFail: string | null
    status: string
    lotId: string | null
  }>
  summary: {
    pass: number
    fail: number
    pending: number
    passRate: string
  }
}

export interface DiaryReport {
  generatedAt: string
  projectId: string
  dateRange: {
    startDate: string | null
    endDate: string | null
  }
  selectedSections: string[]
  totalDiaries: number
  submittedCount: number
  draftCount: number
  diaries: Array<{
    id: string
    date: string
    status: string
    isLate: boolean
    submittedBy?: { id: string; fullName: string; email: string } | null
    submittedAt?: string | null
    weatherConditions?: string | null
    temperatureMin?: number | null
    temperatureMax?: number | null
    rainfallMm?: number | null
    weatherNotes?: string | null
    generalNotes?: string | null
    personnel?: Array<{
      id: string
      name: string
      company?: string | null
      role?: string | null
      hours?: number | null
    }>
    plant?: Array<{
      id: string
      description: string
      company?: string | null
      hoursOperated?: number | null
    }>
    activities?: Array<{
      id: string
      description: string
      lot?: { id: string; lotNumber: string } | null
      quantity?: number | null
      unit?: string | null
    }>
    delays?: Array<{
      id: string
      delayType: string
      durationHours?: number | null
      description: string
    }>
  }>
  summary: {
    weather?: Record<string, number>
    personnel?: {
      totalPersonnel: number
      totalHours: number
      byCompany: Record<string, { count: number; hours: number }>
    }
    plant?: {
      totalPlant: number
      totalHours: number
      byCompany: Record<string, { count: number; hours: number }>
    }
    activities?: {
      totalActivities: number
      byLot: Record<string, number>
    }
    delays?: {
      totalDelays: number
      totalHours: number
      byType: Record<string, { count: number; hours: number }>
    }
  }
}

export const STATUS_COLORS: Record<string, string> = {
  not_started: 'bg-gray-200 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  awaiting_test: 'bg-amber-100 text-amber-700',
  hold_point: 'bg-amber-200 text-amber-800',
  ncr_raised: 'bg-red-100 text-red-700',
  conformed: 'bg-green-100 text-green-700',
  claimed: 'bg-green-200 text-green-800',
}

export const STATUS_LABELS: Record<string, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  awaiting_test: 'Awaiting Test',
  hold_point: 'Hold Point',
  ncr_raised: 'NCR Raised',
  conformed: 'Conformed',
  claimed: 'Claimed',
}

export const DIARY_SECTIONS = [
  { id: 'weather', label: 'Weather & Notes' },
  { id: 'personnel', label: 'Personnel' },
  { id: 'plant', label: 'Plant & Equipment' },
  { id: 'activities', label: 'Activities' },
  { id: 'delays', label: 'Delays' },
] as const

// Feature gating tiers
export const ADVANCED_ANALYTICS_TIERS = ['professional', 'enterprise', 'unlimited']

export type DatePreset = 'today' | 'this-week' | 'this-month'

/** Helper function to apply date range presets */
export function applyDatePreset(
  preset: DatePreset,
  setStart: (d: string) => void,
  setEnd: (d: string) => void
) {
  const today = new Date()
  const formatDate = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  switch (preset) {
    case 'today':
      setStart(formatDate(today))
      setEnd(formatDate(today))
      break
    case 'this-week': {
      const dayOfWeek = today.getDay()
      const startOfWeek = new Date(today)
      startOfWeek.setDate(today.getDate() - dayOfWeek) // Sunday
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6) // Saturday
      setStart(formatDate(startOfWeek))
      setEnd(formatDate(endOfWeek))
      break
    }
    case 'this-month': {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      setStart(formatDate(startOfMonth))
      setEnd(formatDate(endOfMonth))
      break
    }
  }
}
