import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { apiFetch, API_URL } from '@/lib/api'
import { Lock, Sparkles, Mail } from 'lucide-react'
import { ScheduleReportModal } from '../../components/reports/ScheduleReportModal'
import type { LotStatusReport, NCRReport, TestReport, DiaryReport } from './types'
import { ADVANCED_ANALYTICS_TIERS } from './types'

// Lazy-loaded tab components
const LotStatusTab = lazy(() => import('./components/LotStatusTab').then(m => ({ default: m.LotStatusTab })))
const NCRReportTab = lazy(() => import('./components/NCRReportTab').then(m => ({ default: m.NCRReportTab })))
const TestResultsTab = lazy(() => import('./components/TestResultsTab').then(m => ({ default: m.TestResultsTab })))
const DiaryReportTab = lazy(() => import('./components/DiaryReportTab').then(m => ({ default: m.DiaryReportTab })))
const AdvancedAnalyticsTab = lazy(() => import('./components/AdvancedAnalyticsTab').then(m => ({ default: m.AdvancedAnalyticsTab })))

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
  // Feature #702: Company logo on reports
  const [companyLogo, setCompanyLogo] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState<string>('')

  // Schedule modal state
  const [showScheduleModal, setShowScheduleModal] = useState(false)

  // Project name for print header
  const [projectName, setProjectName] = useState<string>('')

  const setActiveTab = useCallback((tab: string) => {
    setSearchParams({ tab })
  }, [setSearchParams])

  const hasAdvancedAnalytics = useMemo(
    () => ADVANCED_ANALYTICS_TIERS.includes(subscriptionTier),
    [subscriptionTier]
  )

  const tabs = useMemo(() => [
    { id: 'lot-status', label: 'Lot Status' },
    { id: 'ncr', label: 'NCR Report' },
    { id: 'test', label: 'Test Results' },
    { id: 'diary', label: 'Diary Report' },
    { id: 'advanced', label: 'Advanced Analytics', premium: true },
  ], [])

  // Fetch subscription tier for feature gating
  useEffect(() => {
    const fetchSubscriptionTier = async () => {
      try {
        const data = await apiFetch<any>(`/api/company`)
        setSubscriptionTier(data.company?.subscriptionTier || 'basic')
        // Feature #702: Company logo on reports
        if (data.company?.logoUrl) {
          setCompanyLogo(data.company.logoUrl)
        }
        if (data.company?.name) {
          setCompanyName(data.company.name)
        }
      } catch (err) {
        console.error('Failed to fetch subscription tier:', err)
      }
    }

    fetchSubscriptionTier()
  }, [])

  // Fetch project name for print header
  useEffect(() => {
    const fetchProjectName = async () => {
      if (!projectId) return

      try {
        const data = await apiFetch<any>(`/api/projects/${projectId}`)
        setProjectName(data.name || data.project?.name || 'Project')
      } catch (err) {
        console.error('Failed to fetch project name:', err)
      }
    }

    fetchProjectName()
  }, [projectId])

  const fetchReport = useCallback(async (reportType: string, extraParams?: Record<string, string>) => {
    setLoading(true)
    setError(null)

    try {
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
          if (extraParams?.startDate) queryParams += `&startDate=${extraParams.startDate}`
          if (extraParams?.endDate) queryParams += `&endDate=${extraParams.endDate}`
          if (extraParams?.testTypes) queryParams += `&testTypes=${extraParams.testTypes}`
          break
        case 'diary':
          endpoint = 'diary'
          if (extraParams?.sections) queryParams += `&sections=${extraParams.sections}`
          if (extraParams?.startDate) queryParams += `&startDate=${extraParams.startDate}`
          if (extraParams?.endDate) queryParams += `&endDate=${extraParams.endDate}`
          break
        default:
          endpoint = 'lot-status'
      }

      const data = await apiFetch<any>(`/api/reports/${endpoint}?${queryParams}`)

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
  }, [projectId])

  useEffect(() => {
    if (projectId) {
      fetchReport(activeTab)
    }
  }, [projectId, activeTab, fetchReport])

  const handleRefreshReport = useCallback(() => {
    fetchReport(activeTab)
  }, [fetchReport, activeTab])

  const handleOpenScheduleModal = useCallback(() => {
    setShowScheduleModal(true)
  }, [])

  const handleCloseScheduleModal = useCallback(() => {
    setShowScheduleModal(false)
  }, [])

  // Callback for TestResultsTab to refresh with filters
  const handleTestReportRefresh = useCallback((startDate: string, endDate: string, testTypes: string[]) => {
    const extraParams: Record<string, string> = {}
    if (startDate) extraParams.startDate = startDate
    if (endDate) extraParams.endDate = endDate
    if (testTypes.length > 0) extraParams.testTypes = testTypes.join(',')
    fetchReport('test', extraParams)
  }, [fetchReport])

  // Callback for DiaryReportTab to generate report with options
  const handleDiaryReportGenerate = useCallback((sections: string[], startDate: string, endDate: string) => {
    const extraParams: Record<string, string> = {}
    if (sections.length > 0) extraParams.sections = sections.join(',')
    if (startDate) extraParams.startDate = startDate
    if (endDate) extraParams.endDate = endDate
    fetchReport('diary', extraParams)
  }, [fetchReport])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Reports & Analytics</h1>
        <div className="flex gap-3">
          <button
            onClick={handleOpenScheduleModal}
            className="px-4 py-2 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50 flex items-center gap-2"
          >
            <Mail className="h-4 w-4" />
            Schedule Reports
          </button>
          <button
            onClick={handleRefreshReport}
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
          {/* Print-only Header - Hidden on screen, shown when printing */}
          <div className="hidden print:block report-header mb-6">
            <div className="flex items-center justify-between border-b-2 border-gray-800 pb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {activeTab === 'lot-status' && 'Lot Status Report'}
                  {activeTab === 'ncr' && 'NCR Report'}
                  {activeTab === 'test' && 'Test Results Report'}
                  {activeTab === 'diary' && 'Daily Diary Report'}
                  {activeTab === 'advanced' && 'Advanced Analytics Report'}
                </h1>
                <p className="text-lg text-gray-700 mt-1">{projectName}</p>
              </div>
              {/* Feature #702: Company logo on reports */}
              <div className="text-right flex items-center gap-3">
                {companyLogo ? (
                  <img
                    src={companyLogo.startsWith('http') ? companyLogo : `${API_URL}${companyLogo}`}
                    alt={companyName || 'Company Logo'}
                    className="h-12 w-auto object-contain"
                  />
                ) : null}
                <div>
                  <div className="text-xl font-semibold text-blue-700">{companyName || 'SiteProof'}</div>
                  <div className="text-sm text-gray-500">Quality Management System</div>
                </div>
              </div>
            </div>
            <div className="flex justify-between text-sm text-gray-600 mt-3">
              <span>Generated: {new Date().toLocaleString()}</span>
              <span>Report ID: {projectId?.slice(0, 8)}</span>
            </div>
          </div>

          {/* Tab Content */}
          <Suspense fallback={<div className="flex items-center justify-center py-12"><div className="text-gray-500">Loading tab...</div></div>}>
            {activeTab === 'lot-status' && lotReport && (
              <LotStatusTab report={lotReport} />
            )}

            {activeTab === 'ncr' && ncrReport && (
              <NCRReportTab report={ncrReport} />
            )}

            {activeTab === 'test' && (
              <TestResultsTab
                report={testReport}
                loading={loading}
                onRefresh={handleTestReportRefresh}
              />
            )}

            {activeTab === 'diary' && (
              <DiaryReportTab
                report={diaryReport}
                loading={loading}
                onGenerateReport={handleDiaryReportGenerate}
              />
            )}

            {activeTab === 'advanced' && (
              <AdvancedAnalyticsTab
                hasAdvancedAnalytics={hasAdvancedAnalytics}
                subscriptionTier={subscriptionTier}
              />
            )}
          </Suspense>

          {/* Print-only Footer - Hidden on screen, shown when printing */}
          <div className="hidden print:block mt-8 pt-4 border-t border-gray-300 text-center">
            <p className="text-sm text-gray-500">
              This report was generated by SiteProof Quality Management System.
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {new Date().getFullYear()} SiteProof. Confidential - For internal use only.
            </p>
          </div>
        </>
      )}

      {/* Schedule Report Modal */}
      {showScheduleModal && projectId && (
        <ScheduleReportModal
          projectId={projectId}
          onClose={handleCloseScheduleModal}
        />
      )}
    </div>
  )
}
