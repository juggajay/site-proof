import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getAuthToken } from '@/lib/auth'

interface Lot {
  id: string
  lotNumber: string
}

interface TestResult {
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
  createdAt: string
  updatedAt: string
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  pass: 'bg-green-100 text-green-800',
  fail: 'bg-red-100 text-red-800',
}

const testStatusColors: Record<string, string> = {
  requested: 'bg-gray-100 text-gray-800',
  at_lab: 'bg-yellow-100 text-yellow-800',
  results_received: 'bg-purple-100 text-purple-800',
  entered: 'bg-blue-100 text-blue-800',
  verified: 'bg-green-100 text-green-800',
}

const testStatusLabels: Record<string, string> = {
  requested: 'Requested',
  at_lab: 'At Lab',
  results_received: 'Results Received',
  entered: 'Entered',
  verified: 'Verified',
}

// Feature #196: Valid status transitions
const nextStatusMap: Record<string, string> = {
  requested: 'at_lab',
  at_lab: 'results_received',
  results_received: 'entered',
  entered: 'verified',
}

const nextStatusButtonLabels: Record<string, string> = {
  requested: 'Mark as At Lab',
  at_lab: 'Mark Results Received',
  results_received: 'Enter Results',
  entered: 'Verify',
}

// Feature #197: Check if test is overdue (14+ days since creation and not verified)
const OVERDUE_DAYS = 14
const isTestOverdue = (test: TestResult): boolean => {
  if (test.status === 'verified') return false
  const created = new Date(test.createdAt)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const daysSinceCreated = Math.floor((today.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
  return daysSinceCreated >= OVERDUE_DAYS
}

// Feature #197: Calculate days since sample/creation
const getDaysSince = (dateStr: string | null, fallbackDateStr: string): number => {
  const date = dateStr ? new Date(dateStr) : new Date(fallbackDateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
}

export function TestResultsPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [lots, setLots] = useState<Lot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null)

  // Feature #198: Test type specifications for auto-populate
  const testTypeSpecs: Record<string, { min: string; max: string; unit: string }> = {
    'compaction': { min: '95', max: '100', unit: '% MDD' },
    'cbr': { min: '15', max: '', unit: '%' },
    'moisture_content': { min: '', max: '', unit: '%' },
    'plasticity_index': { min: '', max: '25', unit: '%' },
    'liquid_limit': { min: '', max: '45', unit: '%' },
    'grading': { min: '', max: '', unit: 'envelope' },
    'sand_equivalent': { min: '30', max: '', unit: '%' },
    'concrete_slump': { min: '50', max: '120', unit: 'mm' },
    'concrete_strength': { min: '32', max: '', unit: 'MPa' },
    'asphalt_density': { min: '93', max: '100', unit: '%' },
    'dcp': { min: '', max: '10', unit: 'mm/blow' },
  }

  // Form state for creating test results
  const [formData, setFormData] = useState({
    testType: '',
    testRequestNumber: '',
    laboratoryName: '',
    laboratoryReportNumber: '',
    sampleLocation: '',
    sampleDate: '',
    testDate: '',
    resultDate: '',
    lotId: '',
    resultValue: '',
    resultUnit: '',
    specificationMin: '',
    specificationMax: '',
    passFail: 'pending',
  })

  // Feature #198: Auto-populate spec values when test type changes
  const handleTestTypeChange = (testType: string) => {
    const normalizedType = testType.toLowerCase().replace(/\s+/g, '_')
    const specs = testTypeSpecs[normalizedType]

    if (specs) {
      setFormData(prev => ({
        ...prev,
        testType,
        specificationMin: specs.min,
        specificationMax: specs.max,
        resultUnit: specs.unit,
      }))
    } else {
      setFormData(prev => ({ ...prev, testType }))
    }
  }

  // Feature #198: Auto-calculate pass/fail when result or specs change
  const calculatePassFail = (value: string, min: string, max: string): string => {
    if (!value) return 'pending'
    const numValue = parseFloat(value)
    const numMin = min ? parseFloat(min) : null
    const numMax = max ? parseFloat(max) : null

    if (numMin !== null && numValue < numMin) return 'fail'
    if (numMax !== null && numValue > numMax) return 'fail'
    if (numMin !== null || numMax !== null) return 'pass'
    return 'pending'
  }

  const handleResultValueChange = (value: string) => {
    const passFail = calculatePassFail(value, formData.specificationMin, formData.specificationMax)
    setFormData(prev => ({ ...prev, resultValue: value, passFail }))
  }

  useEffect(() => {
    async function fetchData() {
      if (!projectId) return

      const token = getAuthToken()
      if (!token) {
        navigate('/login')
        return
      }

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

      try {
        // Fetch test results and lots in parallel
        const [testsResponse, lotsResponse] = await Promise.all([
          fetch(`${apiUrl}/api/test-results?projectId=${projectId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${apiUrl}/api/lots?projectId=${projectId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ])

        if (testsResponse.ok) {
          const testsData = await testsResponse.json()
          setTestResults(testsData.testResults || [])
        }

        if (lotsResponse.ok) {
          const lotsData = await lotsResponse.json()
          setLots(lotsData.lots || [])
        }
      } catch (err) {
        setError('Failed to load test results')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [projectId, navigate])

  // Feature #196: Update test status workflow
  const handleUpdateStatus = async (testId: string, newStatus: string) => {
    setUpdatingStatusId(testId)
    const token = getAuthToken()
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

    try {
      const response = await fetch(`${apiUrl}/api/test-results/${testId}/status`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (response.ok) {
        // Refetch to get updated test results
        const testsResponse = await fetch(`${apiUrl}/api/test-results?projectId=${projectId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (testsResponse.ok) {
          const testsData = await testsResponse.json()
          setTestResults(testsData.testResults || [])
        }
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to update status')
      }
    } catch (err) {
      alert('Failed to update test status')
    } finally {
      setUpdatingStatusId(null)
    }
  }

  const handleCreateTestResult = async () => {
    if (!formData.testType) {
      alert('Test type is required')
      return
    }

    setCreating(true)
    const token = getAuthToken()
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

    try {
      const response = await fetch(`${apiUrl}/api/test-results`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          ...formData,
          lotId: formData.lotId || null,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        // Refetch to get the full test result with lot info
        const testsResponse = await fetch(`${apiUrl}/api/test-results?projectId=${projectId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (testsResponse.ok) {
          const testsData = await testsResponse.json()
          setTestResults(testsData.testResults || [])
        }
        setShowCreateModal(false)
        setFormData({
          testType: '',
          testRequestNumber: '',
          laboratoryName: '',
          laboratoryReportNumber: '',
          sampleLocation: '',
          sampleDate: '',
          testDate: '',
          resultDate: '',
          lotId: '',
          resultValue: '',
          resultUnit: '',
          specificationMin: '',
          specificationMax: '',
          passFail: 'pending',
        })
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to create test result')
      }
    } catch (err) {
      alert('Failed to create test result')
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 text-center text-destructive">{error}</div>
    )
  }

  // Export test results to CSV
  const handleExportCSV = () => {
    const headers = ['Test Type', 'Request #', 'Linked Lot', 'Laboratory', 'Sample Location', 'Result', 'Spec Min', 'Spec Max', 'Pass/Fail', 'Status', 'Test Date']
    const rows = testResults.map(test => [
      test.testType,
      test.testRequestNumber || '-',
      test.lot?.lotNumber || '-',
      test.laboratoryName || '-',
      test.sampleLocation || '-',
      test.resultValue != null ? `${test.resultValue}${test.resultUnit ? ' ' + test.resultUnit : ''}` : '-',
      test.specificationMin != null ? test.specificationMin : '-',
      test.specificationMax != null ? test.specificationMax : '-',
      test.passFail,
      test.status,
      test.testDate ? new Date(test.testDate).toLocaleDateString() : '-'
    ])

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute('download', `test-results-${projectId}-${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Test Results</h1>
        <div className="flex gap-2">
          {testResults.length > 0 && (
            <button
              onClick={handleExportCSV}
              className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
            >
              Export CSV
            </button>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
          >
            Add Test Result
          </button>
        </div>
      </div>
      <p className="text-muted-foreground">
        Manage test results and certificates for this project.
      </p>

      {/* Test Results Table */}
      {testResults.length === 0 ? (
        <div className="rounded-lg border p-8 text-center">
          <div className="text-5xl mb-4">🧪</div>
          <h3 className="text-lg font-semibold mb-2">No Test Results</h3>
          <p className="text-muted-foreground mb-4">
            No test results have been recorded yet. Add test results to track quality compliance.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            Add your first test result
          </button>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">Test Type</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Request #</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Linked Lot</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Laboratory</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Result</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Pass/Fail</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {testResults.map((test) => {
                const overdue = isTestOverdue(test)
                const daysSince = getDaysSince(test.sampleDate, test.createdAt)
                return (
                <tr
                  key={test.id}
                  className={`hover:bg-muted/30 ${overdue ? 'bg-red-50 dark:bg-red-900/20 border-l-4 border-l-red-500' : ''}`}
                >
                  <td className="px-4 py-3 text-sm font-medium">
                    <div className="flex items-center gap-2">
                      {test.testType}
                      {overdue && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-red-500 text-white rounded font-bold">
                          OVERDUE
                        </span>
                      )}
                    </div>
                    {/* Feature #197: Show days since sample/created */}
                    <div className={`text-xs mt-0.5 ${overdue ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                      {daysSince} days since {test.sampleDate ? 'sample' : 'request'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">{test.testRequestNumber || '—'}</td>
                  <td className="px-4 py-3 text-sm">
                    {test.lot ? (
                      <button
                        onClick={() => navigate(`/projects/${projectId}/lots/${test.lotId}`)}
                        className="text-primary hover:underline"
                      >
                        {test.lot.lotNumber}
                      </button>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">{test.laboratoryName || '—'}</td>
                  <td className="px-4 py-3 text-sm">
                    {test.resultValue != null
                      ? `${test.resultValue}${test.resultUnit ? ` ${test.resultUnit}` : ''}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[test.passFail] || 'bg-gray-100'}`}>
                      {test.passFail}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${testStatusColors[test.status] || 'bg-gray-100'}`}>
                      {testStatusLabels[test.status] || test.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {nextStatusMap[test.status] && (
                      <button
                        onClick={() => handleUpdateStatus(test.id, nextStatusMap[test.status])}
                        disabled={updatingStatusId === test.id}
                        className="px-3 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        {updatingStatusId === test.id ? 'Updating...' : nextStatusButtonLabels[test.status]}
                      </button>
                    )}
                    {test.status === 'verified' && (
                      <span className="text-green-600 text-xs font-medium">✓ Complete</span>
                    )}
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Test Result Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">Add Test Result</h2>
              <div className="space-y-4">
                {/* Feature #198: Enhanced form with all fields */}
                <div>
                  <label className="block text-sm font-medium mb-1">Test Type *</label>
                  <input
                    type="text"
                    value={formData.testType}
                    onChange={(e) => handleTestTypeChange(e.target.value)}
                    placeholder="e.g., Compaction, CBR, Grading"
                    className="w-full rounded-lg border px-3 py-2"
                    list="test-types"
                  />
                  <datalist id="test-types">
                    <option value="Compaction" />
                    <option value="CBR" />
                    <option value="Moisture Content" />
                    <option value="Plasticity Index" />
                    <option value="Liquid Limit" />
                    <option value="Grading" />
                    <option value="Sand Equivalent" />
                    <option value="Concrete Slump" />
                    <option value="Concrete Strength" />
                    <option value="Asphalt Density" />
                    <option value="DCP" />
                  </datalist>
                  <p className="text-xs text-muted-foreground mt-1">Select a standard type to auto-populate specs</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Test Request Number</label>
                    <input
                      type="text"
                      value={formData.testRequestNumber}
                      onChange={(e) => setFormData({ ...formData, testRequestNumber: e.target.value })}
                      placeholder="e.g., TR-001"
                      className="w-full rounded-lg border px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Lab Report Number</label>
                    <input
                      type="text"
                      value={formData.laboratoryReportNumber}
                      onChange={(e) => setFormData({ ...formData, laboratoryReportNumber: e.target.value })}
                      placeholder="e.g., LAB-2024-0001"
                      className="w-full rounded-lg border px-3 py-2"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Link to Lot</label>
                  <select
                    value={formData.lotId}
                    onChange={(e) => setFormData({ ...formData, lotId: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2"
                  >
                    <option value="">No lot linked</option>
                    {lots.map((lot) => (
                      <option key={lot.id} value={lot.id}>
                        {lot.lotNumber}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Laboratory Name</label>
                  <input
                    type="text"
                    value={formData.laboratoryName}
                    onChange={(e) => setFormData({ ...formData, laboratoryName: e.target.value })}
                    placeholder="e.g., ABC Testing Labs"
                    className="w-full rounded-lg border px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Sample Location</label>
                  <input
                    type="text"
                    value={formData.sampleLocation}
                    onChange={(e) => setFormData({ ...formData, sampleLocation: e.target.value })}
                    placeholder="e.g., CH 1000+50, 2m LHS"
                    className="w-full rounded-lg border px-3 py-2"
                  />
                </div>
                {/* Dates Section */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Sample Date</label>
                    <input
                      type="date"
                      value={formData.sampleDate}
                      onChange={(e) => setFormData({ ...formData, sampleDate: e.target.value })}
                      className="w-full rounded-lg border px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Test Date</label>
                    <input
                      type="date"
                      value={formData.testDate}
                      onChange={(e) => setFormData({ ...formData, testDate: e.target.value })}
                      className="w-full rounded-lg border px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Result Date</label>
                    <input
                      type="date"
                      value={formData.resultDate}
                      onChange={(e) => setFormData({ ...formData, resultDate: e.target.value })}
                      className="w-full rounded-lg border px-3 py-2"
                    />
                  </div>
                </div>
                {/* Result Section */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Result Value</label>
                    <input
                      type="number"
                      step="any"
                      value={formData.resultValue}
                      onChange={(e) => handleResultValueChange(e.target.value)}
                      placeholder="e.g., 98.5"
                      className="w-full rounded-lg border px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Unit</label>
                    <input
                      type="text"
                      value={formData.resultUnit}
                      onChange={(e) => setFormData({ ...formData, resultUnit: e.target.value })}
                      placeholder="e.g., %"
                      className="w-full rounded-lg border px-3 py-2"
                    />
                  </div>
                </div>
                {/* Specification Section */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Spec Min</label>
                    <input
                      type="number"
                      step="any"
                      value={formData.specificationMin}
                      onChange={(e) => {
                        const newMin = e.target.value
                        const passFail = calculatePassFail(formData.resultValue, newMin, formData.specificationMax)
                        setFormData({ ...formData, specificationMin: newMin, passFail })
                      }}
                      placeholder="e.g., 95"
                      className="w-full rounded-lg border px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Spec Max</label>
                    <input
                      type="number"
                      step="any"
                      value={formData.specificationMax}
                      onChange={(e) => {
                        const newMax = e.target.value
                        const passFail = calculatePassFail(formData.resultValue, formData.specificationMin, newMax)
                        setFormData({ ...formData, specificationMax: newMax, passFail })
                      }}
                      placeholder="e.g., 100"
                      className="w-full rounded-lg border px-3 py-2"
                    />
                  </div>
                </div>
                {/* Pass/Fail with auto-calculated indicator */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Pass/Fail Status
                    {formData.resultValue && (formData.specificationMin || formData.specificationMax) && (
                      <span className="ml-2 text-xs text-muted-foreground">(auto-calculated)</span>
                    )}
                  </label>
                  <select
                    value={formData.passFail}
                    onChange={(e) => setFormData({ ...formData, passFail: e.target.value })}
                    className={`w-full rounded-lg border px-3 py-2 ${
                      formData.passFail === 'pass' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' :
                      formData.passFail === 'fail' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' :
                      ''
                    }`}
                  >
                    <option value="pending">Pending</option>
                    <option value="pass">Pass</option>
                    <option value="fail">Fail</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm rounded-lg border hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateTestResult}
                  disabled={creating}
                  className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Test Result'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
