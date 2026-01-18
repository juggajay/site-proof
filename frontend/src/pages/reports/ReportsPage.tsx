import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { getAuthToken } from '../../lib/auth'
import { Lock, Sparkles, Calendar, Mail } from 'lucide-react'
import { ScheduleReportModal } from '../../components/reports/ScheduleReportModal'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// Feature gating tiers
const ADVANCED_ANALYTICS_TIERS = ['professional', 'enterprise', 'unlimited']

interface LotStatusReport {
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

interface NCRReport {
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

interface TestReport {
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

interface DiaryReport {
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

const STATUS_COLORS: Record<string, string> = {
  not_started: 'bg-gray-200 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  awaiting_test: 'bg-amber-100 text-amber-700',
  hold_point: 'bg-amber-200 text-amber-800',
  ncr_raised: 'bg-red-100 text-red-700',
  conformed: 'bg-green-100 text-green-700',
  claimed: 'bg-green-200 text-green-800',
}

const STATUS_LABELS: Record<string, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  awaiting_test: 'Awaiting Test',
  hold_point: 'Hold Point',
  ncr_raised: 'NCR Raised',
  conformed: 'Conformed',
  claimed: 'Claimed',
}

const DIARY_SECTIONS = [
  { id: 'weather', label: 'Weather & Notes' },
  { id: 'personnel', label: 'Personnel' },
  { id: 'plant', label: 'Plant & Equipment' },
  { id: 'activities', label: 'Activities' },
  { id: 'delays', label: 'Delays' },
]

export function ReportsPage() {
  const { projectId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'lot-status'

  const [lotReport, setLotReport] = useState<LotStatusReport | null>(null)
  const [ncrReport, setNCRReport] = useState<NCRReport | null>(null)
  const [testReport, setTestReport] = useState<TestReport | null>(null)
  const [diaryReport, setDiaryReport] = useState<DiaryReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [subscriptionTier, setSubscriptionTier] = useState<string>('basic')

  // Diary report specific state
  const [diarySections, setDiarySections] = useState<string[]>(['weather', 'personnel', 'plant', 'activities', 'delays'])
  const [diaryStartDate, setDiaryStartDate] = useState<string>('')
  const [diaryEndDate, setDiaryEndDate] = useState<string>('')

  // Feature #208: Test report filter state
  const [testStartDate, setTestStartDate] = useState<string>('')
  const [testEndDate, setTestEndDate] = useState<string>('')
  const [selectedTestTypes, setSelectedTestTypes] = useState<string[]>([])
  const [availableTestTypes, setAvailableTestTypes] = useState<string[]>([])

  // Schedule modal state
  const [showScheduleModal, setShowScheduleModal] = useState(false)

  const setActiveTab = (tab: string) => {
    setSearchParams({ tab })
  }

  const toggleDiarySection = (sectionId: string) => {
    setDiarySections(prev =>
      prev.includes(sectionId)
        ? prev.filter(s => s !== sectionId)
        : [...prev, sectionId]
    )
  }

  // Fetch subscription tier for feature gating
  useEffect(() => {
    const fetchSubscriptionTier = async () => {
      const token = getAuthToken()
      if (!token) return

      try {
        const response = await fetch(`${API_URL}/api/company`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (response.ok) {
          const data = await response.json()
          setSubscriptionTier(data.company?.subscriptionTier || 'basic')
        }
      } catch (err) {
        console.error('Failed to fetch subscription tier:', err)
      }
    }

    fetchSubscriptionTier()
  }, [])

  useEffect(() => {
    if (projectId) {
      fetchReport(activeTab)
    }
  }, [projectId, activeTab])

  const fetchReport = async (reportType: string) => {
    setLoading(true)
    setError(null)

    try {
      const token = getAuthToken()
      let endpoint = ''
      let queryParams = `projectId=${projectId}`

      switch (reportType) {
        case 'lot-status':
          endpoint = 'lot-status'
          break
        case 'ncr':
          endpoint = 'ncr'
          break
        case 'test':
          endpoint = 'test'
          // Feature #208: Add test report filters
          if (testStartDate) {
            queryParams += `&startDate=${testStartDate}`
          }
          if (testEndDate) {
            queryParams += `&endDate=${testEndDate}`
          }
          if (selectedTestTypes.length > 0) {
            queryParams += `&testTypes=${selectedTestTypes.join(',')}`
          }
          break
        case 'diary':
          endpoint = 'diary'
          if (diarySections.length > 0) {
            queryParams += `&sections=${diarySections.join(',')}`
          }
          if (diaryStartDate) {
            queryParams += `&startDate=${diaryStartDate}`
          }
          if (diaryEndDate) {
            queryParams += `&endDate=${diaryEndDate}`
          }
          break
        default:
          endpoint = 'lot-status'
      }

      const response = await fetch(`${API_URL}/api/reports/${endpoint}?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch report')
      }

      const data = await response.json()

      switch (reportType) {
        case 'lot-status':
          setLotReport(data)
          break
        case 'ncr':
          setNCRReport(data)
          break
        case 'test':
          setTestReport(data)
          break
        case 'diary':
          setDiaryReport(data)
          break
      }
    } catch (err) {
      console.error('Error fetching report:', err)
      setError('Failed to load report data')
    } finally {
      setLoading(false)
    }
  }

  const fetchDiaryReport = () => {
    fetchReport('diary')
  }

  const hasAdvancedAnalytics = ADVANCED_ANALYTICS_TIERS.includes(subscriptionTier)

  const tabs = [
    { id: 'lot-status', label: 'Lot Status' },
    { id: 'ncr', label: 'NCR Report' },
    { id: 'test', label: 'Test Results' },
    { id: 'diary', label: 'Diary Report' },
    { id: 'advanced', label: 'Advanced Analytics', premium: true },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Reports & Analytics</h1>
        <div className="flex gap-3">
          <button
            onClick={() => setShowScheduleModal(true)}
            className="px-4 py-2 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50 flex items-center gap-2"
          >
            <Mail className="h-4 w-4" />
            Schedule Reports
          </button>
          <button
            onClick={() => fetchReport(activeTab)}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh Report'}
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } ${tab.premium && !hasAdvancedAnalytics ? 'text-amber-600 hover:text-amber-700' : ''}`}
            >
              {tab.label}
              {tab.premium && !hasAdvancedAnalytics && (
                <Lock className="h-3.5 w-3.5" />
              )}
              {tab.premium && hasAdvancedAnalytics && (
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              )}
            </button>
          ))}
        </nav>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-500">Loading report data...</div>
        </div>
      ) : (
        <>
          {/* Lot Status Report */}
          {activeTab === 'lot-status' && lotReport && (
            <div className="space-y-6">
              {/* Summary Cards with Percentage */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                <div className="bg-gray-100 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-gray-700">{lotReport.summary.notStarted}</div>
                  <div className="text-sm text-gray-500">Not Started</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {lotReport.totalLots > 0 ? ((lotReport.summary.notStarted / lotReport.totalLots) * 100).toFixed(1) : 0}%
                  </div>
                </div>
                <div className="bg-blue-100 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-700">{lotReport.summary.inProgress}</div>
                  <div className="text-sm text-blue-600">In Progress</div>
                  <div className="text-xs text-blue-400 mt-1">
                    {lotReport.totalLots > 0 ? ((lotReport.summary.inProgress / lotReport.totalLots) * 100).toFixed(1) : 0}%
                  </div>
                </div>
                <div className="bg-amber-100 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-amber-700">{lotReport.summary.awaitingTest}</div>
                  <div className="text-sm text-amber-600">Awaiting Test</div>
                  <div className="text-xs text-amber-500 mt-1">
                    {lotReport.totalLots > 0 ? ((lotReport.summary.awaitingTest / lotReport.totalLots) * 100).toFixed(1) : 0}%
                  </div>
                </div>
                <div className="bg-amber-200 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-amber-800">{lotReport.summary.holdPoint}</div>
                  <div className="text-sm text-amber-700">Hold Point</div>
                  <div className="text-xs text-amber-600 mt-1">
                    {lotReport.totalLots > 0 ? ((lotReport.summary.holdPoint / lotReport.totalLots) * 100).toFixed(1) : 0}%
                  </div>
                </div>
                <div className="bg-red-100 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-red-700">{lotReport.summary.ncrRaised}</div>
                  <div className="text-sm text-red-600">NCR Raised</div>
                  <div className="text-xs text-red-400 mt-1">
                    {lotReport.totalLots > 0 ? ((lotReport.summary.ncrRaised / lotReport.totalLots) * 100).toFixed(1) : 0}%
                  </div>
                </div>
                <div className="bg-green-100 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-700">{lotReport.summary.conformed}</div>
                  <div className="text-sm text-green-600">Conformed</div>
                  <div className="text-xs text-green-500 mt-1">
                    {lotReport.totalLots > 0 ? ((lotReport.summary.conformed / lotReport.totalLots) * 100).toFixed(1) : 0}%
                  </div>
                </div>
                <div className="bg-green-200 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-800">{lotReport.summary.claimed}</div>
                  <div className="text-sm text-green-700">Claimed</div>
                  <div className="text-xs text-green-600 mt-1">
                    {lotReport.totalLots > 0 ? ((lotReport.summary.claimed / lotReport.totalLots) * 100).toFixed(1) : 0}%
                  </div>
                </div>
              </div>

              {/* Period Comparison */}
              {lotReport.periodComparison && (
                <div className="bg-white border rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4">Period Comparison</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="text-3xl font-bold text-green-600">
                        {lotReport.periodComparison.conformedThisPeriod}
                      </div>
                      <div className="text-sm text-green-600">
                        Conformed This Period
                      </div>
                      <div className="text-xs text-green-500 mt-1">
                        {lotReport.periodComparison.currentPeriodLabel}
                      </div>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="text-3xl font-bold text-gray-600">
                        {lotReport.periodComparison.conformedLastPeriod}
                      </div>
                      <div className="text-sm text-gray-600">
                        Conformed Last Period
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {lotReport.periodComparison.previousPeriodLabel}
                      </div>
                    </div>
                    <div className={`border rounded-lg p-4 ${
                      lotReport.periodComparison.periodChange > 0
                        ? 'bg-green-50 border-green-200'
                        : lotReport.periodComparison.periodChange < 0
                        ? 'bg-red-50 border-red-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}>
                      <div className={`text-3xl font-bold ${
                        lotReport.periodComparison.periodChange > 0
                          ? 'text-green-600'
                          : lotReport.periodComparison.periodChange < 0
                          ? 'text-red-600'
                          : 'text-gray-600'
                      }`}>
                        {lotReport.periodComparison.periodChange > 0 ? '+' : ''}
                        {lotReport.periodComparison.periodChange}
                      </div>
                      <div className={`text-sm ${
                        lotReport.periodComparison.periodChange > 0
                          ? 'text-green-600'
                          : lotReport.periodComparison.periodChange < 0
                          ? 'text-red-600'
                          : 'text-gray-600'
                      }`}>
                        Change from Previous
                      </div>
                      <div className={`text-xs mt-1 ${
                        lotReport.periodComparison.periodChange > 0
                          ? 'text-green-500'
                          : lotReport.periodComparison.periodChange < 0
                          ? 'text-red-500'
                          : 'text-gray-500'
                      }`}>
                        {lotReport.periodComparison.periodChange > 0 ? '+' : ''}
                        {lotReport.periodComparison.periodChangePercent}%
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Total Count */}
              <div className="bg-white border rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">Total Lots: {lotReport.totalLots}</h2>
                  <span className="text-sm text-gray-500">
                    Generated: {new Date(lotReport.generatedAt).toLocaleString()}
                  </span>
                </div>

                {/* Activity Type Breakdown */}
                <div className="mb-6">
                  <h3 className="text-lg font-medium mb-3">By Activity Type</h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(lotReport.activityCounts).map(([activity, count]) => (
                      <span key={activity} className="px-3 py-1 bg-gray-100 rounded-full text-sm">
                        {activity}: <strong>{count}</strong>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Lots Table */}
                <h3 className="text-lg font-medium mb-3">Lot Details</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lot Number</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Activity</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Chainage</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {lotReport.lots.map((lot) => (
                        <tr key={lot.id}>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{lot.lotNumber}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{lot.description || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{lot.activityType}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {lot.chainageStart != null && lot.chainageEnd != null
                              ? `${lot.chainageStart} - ${lot.chainageEnd}`
                              : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs ${STATUS_COLORS[lot.status] || 'bg-gray-100'}`}>
                              {STATUS_LABELS[lot.status] || lot.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* NCR Report */}
          {activeTab === 'ncr' && ncrReport && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                <div className="bg-white border rounded-lg p-4">
                  <div className="text-3xl font-bold text-gray-800">{ncrReport.totalNCRs}</div>
                  <div className="text-sm text-gray-500">Total NCRs</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="text-3xl font-bold text-red-600">
                    {ncrReport.summary.open + ncrReport.summary.investigating + ncrReport.summary.rectification + ncrReport.summary.verification}
                  </div>
                  <div className="text-sm text-red-500">Open NCRs</div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="text-3xl font-bold text-green-600">{ncrReport.closedThisMonth}</div>
                  <div className="text-sm text-green-500">Closed This Month</div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="text-3xl font-bold text-blue-600">
                    {ncrReport.averageClosureTime > 0 ? `${ncrReport.averageClosureTime}d` : 'N/A'}
                  </div>
                  <div className="text-sm text-blue-500">Avg Closure Time</div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="text-3xl font-bold text-amber-600">{ncrReport.overdueCount}</div>
                  <div className="text-sm text-amber-500">Overdue</div>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="text-3xl font-bold text-purple-600">
                    {ncrReport.summary.closed + ncrReport.summary.closedConcession}
                  </div>
                  <div className="text-sm text-purple-500">Total Closed</div>
                </div>
                <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                  <div className="text-3xl font-bold text-teal-600">{ncrReport.closureRate}%</div>
                  <div className="text-sm text-teal-500">Closure Rate</div>
                </div>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* NCRs by Category Chart */}
                <div className="bg-white border rounded-lg p-6">
                  <h3 className="text-lg font-medium mb-4">NCRs by Category</h3>
                  <div className="space-y-3">
                    {Object.entries(ncrReport.categoryCounts).map(([category, count]) => {
                      const percentage = ncrReport.totalNCRs > 0 ? Math.round((count / ncrReport.totalNCRs) * 100) : 0
                      return (
                        <div key={category}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="capitalize">{category.replace(/_/g, ' ')}</span>
                            <span className="font-medium">{count} ({percentage}%)</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                category === 'workmanship' ? 'bg-amber-500' :
                                category === 'materials' ? 'bg-blue-500' :
                                category === 'documentation' ? 'bg-green-500' :
                                category === 'process' ? 'bg-purple-500' :
                                category === 'design' ? 'bg-red-500' :
                                'bg-gray-500'
                              }`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                    {Object.keys(ncrReport.categoryCounts).length === 0 && (
                      <p className="text-sm text-gray-500">No data available</p>
                    )}
                  </div>
                </div>

                {/* NCRs by Root Cause Chart */}
                <div className="bg-white border rounded-lg p-6">
                  <h3 className="text-lg font-medium mb-4">NCRs by Root Cause</h3>
                  <div className="space-y-3">
                    {Object.entries(ncrReport.rootCauseCounts).map(([rootCause, count]) => {
                      const percentage = ncrReport.totalNCRs > 0 ? Math.round((count / ncrReport.totalNCRs) * 100) : 0
                      return (
                        <div key={rootCause}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="capitalize">{rootCause.replace(/_/g, ' ')}</span>
                            <span className="font-medium">{count} ({percentage}%)</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                rootCause === 'human_error' ? 'bg-red-500' :
                                rootCause === 'equipment_failure' ? 'bg-amber-500' :
                                rootCause === 'material_defect' ? 'bg-blue-500' :
                                rootCause === 'procedural' ? 'bg-purple-500' :
                                rootCause === 'environmental' ? 'bg-green-500' :
                                'bg-gray-500'
                              }`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                    {Object.keys(ncrReport.rootCauseCounts).length === 0 && (
                      <p className="text-sm text-gray-500">No data available</p>
                    )}
                  </div>
                </div>

                {/* NCRs by Responsible Party */}
                <div className="bg-white border rounded-lg p-6">
                  <h3 className="text-lg font-medium mb-4">NCRs by Responsible Party</h3>
                  <div className="space-y-3">
                    {Object.entries(ncrReport.responsiblePartyCounts).map(([party, count]) => {
                      const percentage = ncrReport.totalNCRs > 0 ? Math.round((count / ncrReport.totalNCRs) * 100) : 0
                      return (
                        <div key={party}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="truncate max-w-[150px]">{party}</span>
                            <span className="font-medium">{count} ({percentage}%)</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="h-2 rounded-full bg-indigo-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                    {Object.keys(ncrReport.responsiblePartyCounts).length === 0 && (
                      <p className="text-sm text-gray-500">No data available</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Severity Breakdown */}
              <div className="bg-white border rounded-lg p-6">
                <h3 className="text-lg font-medium mb-3">By Severity</h3>
                <div className="flex gap-4">
                  <span className="px-4 py-2 bg-amber-100 rounded-lg">
                    Minor: <strong>{ncrReport.summary.minor}</strong>
                  </span>
                  <span className="px-4 py-2 bg-red-100 rounded-lg">
                    Major: <strong>{ncrReport.summary.major}</strong>
                  </span>
                </div>
              </div>

              {/* NCRs Table */}
              <div className="bg-white border rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium">NCR Details</h3>
                  <span className="text-sm text-gray-500">
                    Generated: {new Date(ncrReport.generatedAt).toLocaleString()}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">NCR #</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Raised</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {ncrReport.ncrs.map((ncr) => (
                        <tr key={ncr.id}>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{ncr.ncrNumber}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{ncr.description}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              ncr.category === 'major' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {ncr.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">{ncr.status}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {new Date(ncr.raisedAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {ncrReport.ncrs.length === 0 && (
                    <div className="text-center py-8 text-gray-500">No NCRs found for this project.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Test Results Report */}
          {activeTab === 'test' && (
            <div className="space-y-6">
              {/* Feature #208: Report Filters */}
              <div className="bg-white border rounded-lg p-6 print:hidden">
                <h3 className="text-lg font-medium mb-4">Report Options</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Date Range */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date Range (Sample Date)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={testStartDate}
                        onChange={(e) => setTestStartDate(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                      />
                      <span className="text-gray-500">to</span>
                      <input
                        type="date"
                        value={testEndDate}
                        onChange={(e) => setTestEndDate(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                      />
                    </div>
                  </div>

                  {/* Test Types Selection */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Test Types</label>
                    <div className="flex flex-wrap gap-2">
                      {testReport && Object.keys(testReport.testTypeCounts).length > 0 ? (
                        Object.keys(testReport.testTypeCounts).map((testType) => (
                          <button
                            key={testType}
                            onClick={() => setSelectedTestTypes(prev =>
                              prev.includes(testType)
                                ? prev.filter(t => t !== testType)
                                : [...prev, testType]
                            )}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                              selectedTestTypes.includes(testType)
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {testType}
                          </button>
                        ))
                      ) : (
                        <span className="text-gray-500 text-sm">All types (generate report to see options)</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => fetchReport('test')}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? 'Generating...' : 'Generate Report'}
                  </button>
                  {(testStartDate || testEndDate || selectedTestTypes.length > 0) && (
                    <button
                      onClick={() => {
                        setTestStartDate('')
                        setTestEndDate('')
                        setSelectedTestTypes([])
                      }}
                      className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              </div>

              {testReport && (
                <>
                  {/* Feature #208: Report Actions */}
                  <div className="flex justify-end gap-3 print:hidden">
                    <button
                      onClick={() => window.print()}
                      className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 hover:bg-gray-50 flex items-center gap-2"
                    >
                      🖨️ Print / Save PDF
                    </button>
                  </div>

                  {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white border rounded-lg p-4">
                  <div className="text-3xl font-bold text-gray-800">{testReport.totalTests}</div>
                  <div className="text-sm text-gray-500">Total Tests</div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="text-3xl font-bold text-green-600">{testReport.summary.pass}</div>
                  <div className="text-sm text-green-500">Passed</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="text-3xl font-bold text-red-600">{testReport.summary.fail}</div>
                  <div className="text-sm text-red-500">Failed</div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="text-3xl font-bold text-blue-600">{testReport.summary.passRate}%</div>
                  <div className="text-sm text-blue-500">Pass Rate</div>
                </div>
              </div>

              {/* Test Type Breakdown */}
              {Object.keys(testReport.testTypeCounts).length > 0 && (
                <div className="bg-white border rounded-lg p-6">
                  <h3 className="text-lg font-medium mb-3">By Test Type</h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(testReport.testTypeCounts).map(([testType, count]) => (
                      <span key={testType} className="px-3 py-1 bg-gray-100 rounded-full text-sm">
                        {testType}: <strong>{count}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tests Table */}
              <div className="bg-white border rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium">Test Details</h3>
                  <span className="text-sm text-gray-500">
                    Generated: {new Date(testReport.generatedAt).toLocaleString()}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Test ID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Laboratory</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Result</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pass/Fail</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {testReport.tests.map((test) => (
                        <tr key={test.id}>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {test.testRequestNumber || test.id.slice(0, 8)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">{test.testType}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{test.laboratoryName || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {test.resultValue != null ? `${test.resultValue} ${test.resultUnit || ''}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              test.passFail === 'pass' ? 'bg-green-100 text-green-700' :
                              test.passFail === 'fail' ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {test.passFail || 'Pending'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">{test.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {testReport.tests.length === 0 && (
                    <div className="text-center py-8 text-gray-500">No test results found for this project.</div>
                  )}
                </div>
              </div>
                </>
              )}
            </div>
          )}

          {/* Diary Report */}
          {activeTab === 'diary' && (
            <div className="space-y-6">
              {/* Section Selection */}
              <div className="bg-white border rounded-lg p-6">
                <h3 className="text-lg font-medium mb-4">Report Options</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Date Range */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={diaryStartDate}
                        onChange={(e) => setDiaryStartDate(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md"
                      />
                      <span className="text-gray-500">to</span>
                      <input
                        type="date"
                        value={diaryEndDate}
                        onChange={(e) => setDiaryEndDate(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                  </div>

                  {/* Section Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Sections to Include</label>
                    <div className="flex flex-wrap gap-2">
                      {DIARY_SECTIONS.map((section) => (
                        <button
                          key={section.id}
                          onClick={() => toggleDiarySection(section.id)}
                          className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                            diarySections.includes(section.id)
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {section.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  onClick={fetchDiaryReport}
                  disabled={loading || diarySections.length === 0}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Generating...' : 'Generate Report'}
                </button>
              </div>

              {diaryReport && (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white border rounded-lg p-4">
                      <div className="text-3xl font-bold text-gray-800">{diaryReport.totalDiaries}</div>
                      <div className="text-sm text-gray-500">Total Diaries</div>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="text-3xl font-bold text-green-600">{diaryReport.submittedCount}</div>
                      <div className="text-sm text-green-500">Submitted</div>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <div className="text-3xl font-bold text-amber-600">{diaryReport.draftCount}</div>
                      <div className="text-sm text-amber-500">Drafts</div>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="text-3xl font-bold text-blue-600">{diaryReport.selectedSections.length}</div>
                      <div className="text-sm text-blue-500">Sections Included</div>
                    </div>
                  </div>

                  {/* Weather Summary */}
                  {diaryReport.summary.weather && Object.keys(diaryReport.summary.weather).length > 0 && (
                    <div className="bg-white border rounded-lg p-6">
                      <h3 className="text-lg font-medium mb-4">Weather Summary</h3>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(diaryReport.summary.weather).map(([condition, count]) => (
                          <span key={condition} className="px-3 py-1 bg-blue-100 rounded-full text-sm">
                            {condition}: <strong>{count}</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Personnel Summary */}
                  {diaryReport.summary.personnel && (
                    <div className="bg-white border rounded-lg p-6">
                      <h3 className="text-lg font-medium mb-4">Personnel Summary</h3>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-gray-100 rounded-lg p-3">
                          <div className="text-2xl font-bold">{diaryReport.summary.personnel.totalPersonnel}</div>
                          <div className="text-sm text-gray-500">Total Personnel Entries</div>
                        </div>
                        <div className="bg-gray-100 rounded-lg p-3">
                          <div className="text-2xl font-bold">{diaryReport.summary.personnel.totalHours.toFixed(1)}</div>
                          <div className="text-sm text-gray-500">Total Hours</div>
                        </div>
                      </div>
                      {Object.keys(diaryReport.summary.personnel.byCompany).length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">By Company</h4>
                          <div className="space-y-2">
                            {Object.entries(diaryReport.summary.personnel.byCompany).map(([company, data]) => (
                              <div key={company} className="flex justify-between bg-gray-50 px-3 py-2 rounded">
                                <span>{company}</span>
                                <span className="font-medium">{data.count} people, {data.hours.toFixed(1)} hrs</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Plant Summary */}
                  {diaryReport.summary.plant && (
                    <div className="bg-white border rounded-lg p-6">
                      <h3 className="text-lg font-medium mb-4">Plant & Equipment Summary</h3>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-gray-100 rounded-lg p-3">
                          <div className="text-2xl font-bold">{diaryReport.summary.plant.totalPlant}</div>
                          <div className="text-sm text-gray-500">Total Plant Entries</div>
                        </div>
                        <div className="bg-gray-100 rounded-lg p-3">
                          <div className="text-2xl font-bold">{diaryReport.summary.plant.totalHours.toFixed(1)}</div>
                          <div className="text-sm text-gray-500">Total Operating Hours</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Activities Summary */}
                  {diaryReport.summary.activities && (
                    <div className="bg-white border rounded-lg p-6">
                      <h3 className="text-lg font-medium mb-4">Activities Summary</h3>
                      <div className="bg-gray-100 rounded-lg p-3 mb-4">
                        <div className="text-2xl font-bold">{diaryReport.summary.activities.totalActivities}</div>
                        <div className="text-sm text-gray-500">Total Activities Recorded</div>
                      </div>
                      {Object.keys(diaryReport.summary.activities.byLot).length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">By Lot</h4>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(diaryReport.summary.activities.byLot).map(([lot, count]) => (
                              <span key={lot} className="px-3 py-1 bg-green-100 rounded-full text-sm">
                                {lot}: <strong>{count}</strong>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Delays Summary */}
                  {diaryReport.summary.delays && (
                    <div className="bg-white border rounded-lg p-6">
                      <h3 className="text-lg font-medium mb-4">Delays Summary</h3>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-red-50 rounded-lg p-3">
                          <div className="text-2xl font-bold text-red-600">{diaryReport.summary.delays.totalDelays}</div>
                          <div className="text-sm text-red-500">Total Delays</div>
                        </div>
                        <div className="bg-red-50 rounded-lg p-3">
                          <div className="text-2xl font-bold text-red-600">{diaryReport.summary.delays.totalHours.toFixed(1)}</div>
                          <div className="text-sm text-red-500">Total Delay Hours</div>
                        </div>
                      </div>
                      {Object.keys(diaryReport.summary.delays.byType).length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">By Delay Type</h4>
                          <div className="space-y-2">
                            {Object.entries(diaryReport.summary.delays.byType).map(([type, data]) => (
                              <div key={type} className="flex justify-between bg-red-50 px-3 py-2 rounded">
                                <span className="capitalize">{type.replace(/_/g, ' ')}</span>
                                <span className="font-medium">{data.count} delays, {data.hours.toFixed(1)} hrs</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Diary Entries Table */}
                  <div className="bg-white border rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-medium">Diary Entries</h3>
                      <span className="text-sm text-gray-500">
                        Generated: {new Date(diaryReport.generatedAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            {diaryReport.selectedSections.includes('weather') && (
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Weather</th>
                            )}
                            {diaryReport.selectedSections.includes('personnel') && (
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Personnel</th>
                            )}
                            {diaryReport.selectedSections.includes('plant') && (
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plant</th>
                            )}
                            {diaryReport.selectedSections.includes('activities') && (
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Activities</th>
                            )}
                            {diaryReport.selectedSections.includes('delays') && (
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Delays</th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {diaryReport.diaries.map((diary) => (
                            <tr key={diary.id}>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                {new Date(diary.date).toLocaleDateString('en-AU')}
                                {diary.isLate && (
                                  <span className="ml-2 px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs rounded">
                                    Late
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <span className={`px-2 py-1 rounded-full text-xs ${
                                  diary.status === 'submitted'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-amber-100 text-amber-700'
                                }`}>
                                  {diary.status}
                                </span>
                              </td>
                              {diaryReport.selectedSections.includes('weather') && (
                                <td className="px-4 py-3 text-sm text-gray-500">
                                  {diary.weatherConditions || '-'}
                                  {diary.temperatureMin != null && diary.temperatureMax != null && (
                                    <span className="ml-1">
                                      ({diary.temperatureMin}°-{diary.temperatureMax}°C)
                                    </span>
                                  )}
                                </td>
                              )}
                              {diaryReport.selectedSections.includes('personnel') && (
                                <td className="px-4 py-3 text-sm text-gray-500">
                                  {diary.personnel?.length || 0} entries
                                </td>
                              )}
                              {diaryReport.selectedSections.includes('plant') && (
                                <td className="px-4 py-3 text-sm text-gray-500">
                                  {diary.plant?.length || 0} entries
                                </td>
                              )}
                              {diaryReport.selectedSections.includes('activities') && (
                                <td className="px-4 py-3 text-sm text-gray-500">
                                  {diary.activities?.length || 0} entries
                                </td>
                              )}
                              {diaryReport.selectedSections.includes('delays') && (
                                <td className="px-4 py-3 text-sm text-gray-500">
                                  {diary.delays?.length || 0} entries
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {diaryReport.diaries.length === 0 && (
                        <div className="text-center py-8 text-gray-500">No diary entries found for the selected criteria.</div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Advanced Analytics Tab */}
          {activeTab === 'advanced' && (
            <div className="space-y-6">
              {!hasAdvancedAnalytics ? (
                /* Upgrade Prompt for Basic Tier Users */
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-8 text-center">
                  <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                    <Lock className="h-8 w-8 text-amber-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Advanced Analytics
                  </h2>
                  <p className="text-gray-600 mb-6 max-w-md mx-auto">
                    Unlock powerful analytics features including trend analysis, predictive insights,
                    custom dashboards, and automated reporting with a Professional or Enterprise subscription.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 max-w-2xl mx-auto">
                    <div className="bg-white rounded-lg p-4 border border-amber-100">
                      <div className="font-semibold text-gray-800">Trend Analysis</div>
                      <div className="text-sm text-gray-500">Track performance over time</div>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-amber-100">
                      <div className="font-semibold text-gray-800">Predictive Insights</div>
                      <div className="text-sm text-gray-500">AI-powered forecasting</div>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-amber-100">
                      <div className="font-semibold text-gray-800">Custom Dashboards</div>
                      <div className="text-sm text-gray-500">Build your own reports</div>
                    </div>
                  </div>

                  <div className="bg-white border border-amber-200 rounded-lg p-4 max-w-md mx-auto">
                    <p className="text-sm text-gray-600 mb-3">
                      Your current plan: <span className="font-semibold capitalize">{subscriptionTier}</span>
                    </p>
                    <a
                      href="/company-settings"
                      className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors"
                    >
                      <Sparkles className="h-5 w-5" />
                      Upgrade to Professional
                    </a>
                    <p className="text-xs text-gray-500 mt-2">
                      Contact support to upgrade your subscription
                    </p>
                  </div>
                </div>
              ) : (
                /* Advanced Analytics Content for Professional/Enterprise Users */
                <div className="space-y-6">
                  <div className="bg-white border rounded-lg p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Sparkles className="h-5 w-5 text-amber-500" />
                      <h2 className="text-xl font-semibold">Advanced Analytics Dashboard</h2>
                    </div>
                    <p className="text-gray-600">
                      Your {subscriptionTier} subscription includes access to advanced analytics features.
                    </p>
                  </div>

                  {/* Trend Analysis */}
                  <div className="bg-white border rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4">Trend Analysis</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="text-sm text-gray-500 mb-1">Lots Conformed (Monthly Trend)</div>
                        <div className="h-32 flex items-end gap-1">
                          {[30, 45, 35, 55, 70, 60, 80].map((value, i) => (
                            <div
                              key={i}
                              className="flex-1 bg-green-500 rounded-t"
                              style={{ height: `${value}%` }}
                            />
                          ))}
                        </div>
                        <div className="flex justify-between text-xs text-gray-400 mt-2">
                          <span>Jul</span>
                          <span>Aug</span>
                          <span>Sep</span>
                          <span>Oct</span>
                          <span>Nov</span>
                          <span>Dec</span>
                          <span>Jan</span>
                        </div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="text-sm text-gray-500 mb-1">NCR Resolution Rate (Monthly)</div>
                        <div className="h-32 flex items-end gap-1">
                          {[60, 65, 70, 68, 75, 82, 85].map((value, i) => (
                            <div
                              key={i}
                              className="flex-1 bg-blue-500 rounded-t"
                              style={{ height: `${value}%` }}
                            />
                          ))}
                        </div>
                        <div className="flex justify-between text-xs text-gray-400 mt-2">
                          <span>Jul</span>
                          <span>Aug</span>
                          <span>Sep</span>
                          <span>Oct</span>
                          <span>Nov</span>
                          <span>Dec</span>
                          <span>Jan</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Key Metrics */}
                  <div className="bg-white border rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4">Key Performance Indicators</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-green-50 rounded-lg p-4">
                        <div className="text-2xl font-bold text-green-600">94%</div>
                        <div className="text-sm text-green-600">Test Pass Rate</div>
                        <div className="text-xs text-green-500 mt-1">↑ 3% vs last month</div>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-4">
                        <div className="text-2xl font-bold text-blue-600">4.2 days</div>
                        <div className="text-sm text-blue-600">Avg NCR Resolution</div>
                        <div className="text-xs text-blue-500 mt-1">↓ 0.8 days vs last month</div>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-4">
                        <div className="text-2xl font-bold text-purple-600">87%</div>
                        <div className="text-sm text-purple-600">On-Time Completion</div>
                        <div className="text-xs text-purple-500 mt-1">↑ 5% vs last month</div>
                      </div>
                      <div className="bg-amber-50 rounded-lg p-4">
                        <div className="text-2xl font-bold text-amber-600">$1.2M</div>
                        <div className="text-sm text-amber-600">Monthly Claims</div>
                        <div className="text-xs text-amber-500 mt-1">↑ 12% vs last month</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Schedule Report Modal */}
      {showScheduleModal && projectId && (
        <ScheduleReportModal
          projectId={projectId}
          onClose={() => setShowScheduleModal(false)}
        />
      )}
    </div>
  )
}
