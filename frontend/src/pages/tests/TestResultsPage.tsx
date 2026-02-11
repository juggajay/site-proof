import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState, useMemo, useCallback } from 'react'
import { getAuthToken } from '@/lib/auth'
import { apiFetch } from '@/lib/api'
import type { TestResult, Lot, FailedTestForNcr, NcrFormData, CreateTestFormData } from './types'
import { TestFilters } from './components/TestFilters'
import { TestResultsTable } from './components/TestResultsTable'
import { CreateTestModal } from './components/CreateTestModal'
import { UploadCertificateModal } from './components/UploadCertificateModal'
import { BatchUploadModal } from './components/BatchUploadModal'
import { RejectTestModal } from './components/RejectTestModal'
import { NcrPromptModal, NcrCreateModal } from './components/NcrModals'

export function TestResultsPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()

  // Core data state
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [lots, setLots] = useState<Lot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projectState, setProjectState] = useState<string>('NSW')

  // Modal visibility state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showBatchUploadModal, setShowBatchUploadModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showNcrPromptModal, setShowNcrPromptModal] = useState(false)
  const [showNcrModal, setShowNcrModal] = useState(false)

  // Status update tracking
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null)

  // Reject test state
  const [rejectingTestId, setRejectingTestId] = useState<string | null>(null)

  // NCR state
  const [failedTestForNcr, setFailedTestForNcr] = useState<FailedTestForNcr | null>(null)
  const [ncrInitialDescription, setNcrInitialDescription] = useState('')

  // Filter state
  const [filterTestType, setFilterTestType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPassFail, setFilterPassFail] = useState('')
  const [filterLot, setFilterLot] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Data fetching
  useEffect(() => {
    async function fetchData() {
      if (!projectId) return

      const token = getAuthToken()
      if (!token) {
        navigate('/login')
        return
      }

      try {
        const [testsData, lotsData, projectData] = await Promise.all([
          apiFetch<{ testResults: TestResult[] }>(`/api/test-results?projectId=${projectId}`),
          apiFetch<{ lots: Lot[] }>(`/api/lots?projectId=${projectId}`),
          apiFetch<{ project?: { state?: string } }>(`/api/projects/${projectId}`),
        ])

        setTestResults(testsData.testResults || [])
        setLots(lotsData.lots || [])
        setProjectState(projectData.project?.state || 'NSW')
      } catch (err) {
        setError('Failed to load test results')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [projectId, navigate])

  // Refresh helper
  const refreshTestResults = useCallback(async () => {
    const testsData = await apiFetch<{ testResults: TestResult[] }>(`/api/test-results?projectId=${projectId}`)
    setTestResults(testsData.testResults || [])
  }, [projectId])

  // Filtered and sorted results
  const filteredTestResults = useMemo(() => {
    return testResults.filter(test => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesTestType = test.testType.toLowerCase().includes(query)
        const matchesReportNumber = test.testRequestNumber?.toLowerCase().includes(query) || false
        const matchesLabReportNumber = test.laboratoryReportNumber?.toLowerCase().includes(query) || false
        const matchesLotNumber = test.lot?.lotNumber?.toLowerCase().includes(query) || false
        const matchesLabName = test.laboratoryName?.toLowerCase().includes(query) || false
        const matchesSampleLocation = test.sampleLocation?.toLowerCase().includes(query) || false

        if (!matchesTestType && !matchesReportNumber && !matchesLabReportNumber &&
            !matchesLotNumber && !matchesLabName && !matchesSampleLocation) {
          return false
        }
      }
      if (filterTestType && !test.testType.toLowerCase().includes(filterTestType.toLowerCase())) {
        return false
      }
      if (filterStatus && test.status !== filterStatus) {
        return false
      }
      if (filterPassFail && test.passFail !== filterPassFail) {
        return false
      }
      if (filterLot && test.lot?.id !== filterLot) {
        return false
      }
      if (filterDateFrom) {
        const testDate = test.sampleDate ? new Date(test.sampleDate) : new Date(test.createdAt)
        const fromDate = new Date(filterDateFrom)
        if (testDate < fromDate) return false
      }
      if (filterDateTo) {
        const testDate = test.sampleDate ? new Date(test.sampleDate) : new Date(test.createdAt)
        const toDate = new Date(filterDateTo)
        toDate.setHours(23, 59, 59, 999)
        if (testDate > toDate) return false
      }
      return true
    })
  }, [testResults, searchQuery, filterTestType, filterStatus, filterPassFail, filterLot, filterDateFrom, filterDateTo])

  const uniqueTestTypes = useMemo(() => {
    return [...new Set(testResults.map(t => t.testType))].sort()
  }, [testResults])

  const hasActiveFilters = !!(filterTestType || filterStatus || filterPassFail || filterLot || filterDateFrom || filterDateTo || searchQuery)

  const clearFilters = useCallback(() => {
    setFilterTestType('')
    setFilterStatus('')
    setFilterPassFail('')
    setFilterLot('')
    setFilterDateFrom('')
    setFilterDateTo('')
    setSearchQuery('')
  }, [])

  // Status workflow handler
  const handleUpdateStatus = useCallback(async (testId: string, newStatus: string) => {
    setUpdatingStatusId(testId)
    try {
      await apiFetch(`/api/test-results/${testId}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: newStatus }),
      })
      await refreshTestResults()
    } catch (err) {
      alert('Failed to update test status')
    } finally {
      setUpdatingStatusId(null)
    }
  }, [refreshTestResults])

  // Reject handler
  const openRejectModal = useCallback((testId: string) => {
    setRejectingTestId(testId)
    setShowRejectModal(true)
  }, [])

  const handleRejectTest = useCallback(async (testId: string, reason: string) => {
    await apiFetch(`/api/test-results/${testId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    })
    await refreshTestResults()
    setShowRejectModal(false)
    setRejectingTestId(null)
  }, [refreshTestResults])

  // Create test handler
  const handleCreateTestResult = useCallback(async (formData: CreateTestFormData) => {
    const data = await apiFetch<{ testResult: { id: string } }>('/api/test-results', {
      method: 'POST',
      body: JSON.stringify({
        projectId,
        ...formData,
        lotId: formData.lotId || null,
      }),
    })

    await refreshTestResults()
    setShowCreateModal(false)

    // Feature #210: If test failed, prompt to raise NCR
    if (formData.passFail === 'fail') {
      setFailedTestForNcr({
        testId: data.testResult.id,
        testType: formData.testType,
        resultValue: formData.resultValue,
        lotId: formData.lotId || null,
      })
      setNcrInitialDescription(
        `Test failure: ${formData.testType} result (${formData.resultValue} ${formData.resultUnit}) is outside specification (min: ${formData.specificationMin || 'N/A'}, max: ${formData.specificationMax || 'N/A'})`
      )
      setShowNcrPromptModal(true)
    }
  }, [projectId, refreshTestResults])

  // NCR handlers
  const handleNcrPromptClose = useCallback(() => {
    setShowNcrPromptModal(false)
    setFailedTestForNcr(null)
  }, [])

  const handleNcrPromptRaise = useCallback(() => {
    setShowNcrPromptModal(false)
    setShowNcrModal(true)
  }, [])

  const handleCreateNcrFromTest = useCallback(async (ncrFormData: NcrFormData) => {
    if (!failedTestForNcr) return

    const data = await apiFetch<{ ncr: { ncrNumber: string } }>('/api/ncrs', {
      method: 'POST',
      body: JSON.stringify({
        projectId,
        description: ncrFormData.description,
        category: ncrFormData.category,
        severity: ncrFormData.severity,
        specificationReference: ncrFormData.specificationReference || undefined,
        lotIds: failedTestForNcr.lotId ? [failedTestForNcr.lotId] : undefined,
        linkedTestResultId: failedTestForNcr.testId,
      }),
    })

    alert(`NCR ${data.ncr.ncrNumber} created successfully`)
    setShowNcrModal(false)
    setShowNcrPromptModal(false)
    setFailedTestForNcr(null)
  }, [projectId, failedTestForNcr])

  const handleNcrModalClose = useCallback(() => {
    setShowNcrModal(false)
    setFailedTestForNcr(null)
  }, [])

  // Test results updated callback (shared by upload modals)
  const handleTestResultsUpdated = useCallback((results: TestResult[]) => {
    setTestResults(results)
  }, [])

  // Export CSV handler
  const handleExportCSV = useCallback(() => {
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
  }, [testResults, projectId])

  // Loading state
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="p-6 text-center text-destructive">{error}</div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
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
            onClick={() => setShowUploadModal(true)}
            className="rounded-lg border border-primary px-4 py-2 text-primary hover:bg-primary/10"
          >
            {'\uD83D\uDCC4'} Upload Certificate
          </button>
          <button
            onClick={() => setShowBatchUploadModal(true)}
            className="rounded-lg border border-purple-500 px-4 py-2 text-purple-600 hover:bg-purple-50"
          >
            {'\uD83D\uDCC1'} Batch Upload
          </button>
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

      {/* Filters */}
      {testResults.length > 0 && (
        <TestFilters
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          filterTestType={filterTestType}
          onFilterTestTypeChange={setFilterTestType}
          filterStatus={filterStatus}
          onFilterStatusChange={setFilterStatus}
          filterPassFail={filterPassFail}
          onFilterPassFailChange={setFilterPassFail}
          filterLot={filterLot}
          onFilterLotChange={setFilterLot}
          filterDateFrom={filterDateFrom}
          onFilterDateFromChange={setFilterDateFrom}
          filterDateTo={filterDateTo}
          onFilterDateToChange={setFilterDateTo}
          uniqueTestTypes={uniqueTestTypes}
          lots={lots}
          filteredCount={filteredTestResults.length}
          totalCount={testResults.length}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearFilters}
        />
      )}

      {/* Table */}
      <TestResultsTable
        projectId={projectId || ''}
        filteredTestResults={testResults.length === 0 ? [] : filteredTestResults}
        hasActiveFilters={testResults.length > 0 && hasActiveFilters}
        updatingStatusId={updatingStatusId}
        onUpdateStatus={handleUpdateStatus}
        onRejectTest={openRejectModal}
        onClearFilters={clearFilters}
        onOpenCreateModal={() => setShowCreateModal(true)}
      />

      {/* Modals */}
      <CreateTestModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateTestResult}
        lots={lots}
        projectState={projectState}
      />

      <UploadCertificateModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        projectId={projectId || ''}
        onTestResultsUpdated={handleTestResultsUpdated}
      />

      <BatchUploadModal
        isOpen={showBatchUploadModal}
        onClose={() => setShowBatchUploadModal(false)}
        projectId={projectId || ''}
        onTestResultsUpdated={handleTestResultsUpdated}
      />

      <RejectTestModal
        isOpen={showRejectModal}
        onClose={() => { setShowRejectModal(false); setRejectingTestId(null) }}
        onSubmit={handleRejectTest}
        rejectingTestId={rejectingTestId}
      />

      <NcrPromptModal
        isOpen={showNcrPromptModal}
        onClose={handleNcrPromptClose}
        onRaiseNcr={handleNcrPromptRaise}
        failedTestForNcr={failedTestForNcr}
      />

      <NcrCreateModal
        isOpen={showNcrModal}
        onClose={handleNcrModalClose}
        onSubmit={handleCreateNcrFromTest}
        failedTestForNcr={failedTestForNcr}
        initialDescription={ncrInitialDescription}
      />
    </div>
  )
}
