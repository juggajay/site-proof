import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { getAuthToken } from '../../lib/auth'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

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

export function ReportsPage() {
  const { projectId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'lot-status'

  const [lotReport, setLotReport] = useState<LotStatusReport | null>(null)
  const [ncrReport, setNCRReport] = useState<NCRReport | null>(null)
  const [testReport, setTestReport] = useState<TestReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setActiveTab = (tab: string) => {
    setSearchParams({ tab })
  }

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

      switch (reportType) {
        case 'lot-status':
          endpoint = 'lot-status'
          break
        case 'ncr':
          endpoint = 'ncr'
          break
        case 'test':
          endpoint = 'test'
          break
        default:
          endpoint = 'lot-status'
      }

      const response = await fetch(`${API_URL}/api/reports/${endpoint}?projectId=${projectId}`, {
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
      }
    } catch (err) {
      console.error('Error fetching report:', err)
      setError('Failed to load report data')
    } finally {
      setLoading(false)
    }
  }

  const tabs = [
    { id: 'lot-status', label: 'Lot Status' },
    { id: 'ncr', label: 'NCR Report' },
    { id: 'test', label: 'Test Results' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Reports & Analytics</h1>
        <button
          onClick={() => fetchReport(activeTab)}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh Report'}
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
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
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                <div className="bg-gray-100 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-gray-700">{lotReport.summary.notStarted}</div>
                  <div className="text-sm text-gray-500">Not Started</div>
                </div>
                <div className="bg-blue-100 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-700">{lotReport.summary.inProgress}</div>
                  <div className="text-sm text-blue-600">In Progress</div>
                </div>
                <div className="bg-amber-100 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-amber-700">{lotReport.summary.awaitingTest}</div>
                  <div className="text-sm text-amber-600">Awaiting Test</div>
                </div>
                <div className="bg-amber-200 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-amber-800">{lotReport.summary.holdPoint}</div>
                  <div className="text-sm text-amber-700">Hold Point</div>
                </div>
                <div className="bg-red-100 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-red-700">{lotReport.summary.ncrRaised}</div>
                  <div className="text-sm text-red-600">NCR Raised</div>
                </div>
                <div className="bg-green-100 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-700">{lotReport.summary.conformed}</div>
                  <div className="text-sm text-green-600">Conformed</div>
                </div>
                <div className="bg-green-200 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-800">{lotReport.summary.claimed}</div>
                  <div className="text-sm text-green-700">Claimed</div>
                </div>
              </div>

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
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
          {activeTab === 'test' && testReport && (
            <div className="space-y-6">
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
            </div>
          )}
        </>
      )}
    </div>
  )
}
