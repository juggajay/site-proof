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
  aiExtracted?: boolean
  createdAt: string
  updatedAt: string
}

// Feature #200: AI Extraction types
interface ExtractedField {
  value: string
  confidence: number
}

interface ExtractionResult {
  success: boolean
  extractedFields: Record<string, ExtractedField>
  confidence: Record<string, number>
  lowConfidenceFields: { field: string; confidence: number }[]
  needsReview: boolean
  reviewMessage: string
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

  // Feature #200: Upload Certificate state
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null)
  const [extractedTestId, setExtractedTestId] = useState<string | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [reviewFormData, setReviewFormData] = useState<Record<string, string>>({})
  const [confirmingExtraction, setConfirmingExtraction] = useState(false)

  // Feature #202: Batch Upload state
  const [showBatchUploadModal, setShowBatchUploadModal] = useState(false)
  const [batchUploading, setBatchUploading] = useState(false)
  const [batchFiles, setBatchFiles] = useState<File[]>([])
  const [batchResults, setBatchResults] = useState<any[]>([])
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null)
  const [selectedBatchResult, setSelectedBatchResult] = useState<number | null>(null)
  const [batchReviewData, setBatchReviewData] = useState<Record<string, Record<string, string>>>({})
  const [batchConfirming, setBatchConfirming] = useState(false)

  // Feature #204: Reject test verification state
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectingTestId, setRejectingTestId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejecting, setRejecting] = useState(false)

  // Feature #205: Test register filtering state
  const [filterTestType, setFilterTestType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPassFail, setFilterPassFail] = useState('')
  const [filterLot, setFilterLot] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [showFilters, setShowFilters] = useState(false)

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

  // Feature #205: Filter test results
  const filteredTestResults = testResults.filter(test => {
    // Filter by test type
    if (filterTestType && !test.testType.toLowerCase().includes(filterTestType.toLowerCase())) {
      return false
    }
    // Filter by status
    if (filterStatus && test.status !== filterStatus) {
      return false
    }
    // Filter by pass/fail
    if (filterPassFail && test.passFail !== filterPassFail) {
      return false
    }
    // Filter by lot
    if (filterLot && test.lot?.id !== filterLot) {
      return false
    }
    // Filter by date range (using sample date or created date)
    if (filterDateFrom) {
      const testDate = test.sampleDate ? new Date(test.sampleDate) : new Date(test.createdAt)
      const fromDate = new Date(filterDateFrom)
      if (testDate < fromDate) return false
    }
    if (filterDateTo) {
      const testDate = test.sampleDate ? new Date(test.sampleDate) : new Date(test.createdAt)
      const toDate = new Date(filterDateTo)
      toDate.setHours(23, 59, 59, 999) // Include the entire "to" day
      if (testDate > toDate) return false
    }
    return true
  })

  // Get unique test types for filter dropdown
  const uniqueTestTypes = [...new Set(testResults.map(t => t.testType))].sort()

  // Reset all filters
  const clearFilters = () => {
    setFilterTestType('')
    setFilterStatus('')
    setFilterPassFail('')
    setFilterLot('')
    setFilterDateFrom('')
    setFilterDateTo('')
  }

  // Check if any filters are active
  const hasActiveFilters = filterTestType || filterStatus || filterPassFail || filterLot || filterDateFrom || filterDateTo

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

  // Feature #204: Open reject modal
  const openRejectModal = (testId: string) => {
    setRejectingTestId(testId)
    setRejectReason('')
    setShowRejectModal(true)
  }

  // Feature #204: Handle reject test verification
  const handleRejectTest = async () => {
    if (!rejectingTestId || !rejectReason.trim()) {
      alert('Rejection reason is required')
      return
    }

    setRejecting(true)
    const token = getAuthToken()
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

    try {
      const response = await fetch(`${apiUrl}/api/test-results/${rejectingTestId}/reject`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: rejectReason.trim() }),
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
        setShowRejectModal(false)
        setRejectingTestId(null)
        setRejectReason('')
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to reject test result')
      }
    } catch (err) {
      alert('Failed to reject test result')
    } finally {
      setRejecting(false)
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

  // Feature #200: Handle certificate upload with AI extraction
  const handleUploadCertificate = async () => {
    if (!uploadedFile) {
      alert('Please select a file first')
      return
    }

    setUploading(true)
    const token = getAuthToken()
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

    try {
      const formData = new FormData()
      formData.append('certificate', uploadedFile)
      formData.append('projectId', projectId || '')

      const response = await fetch(`${apiUrl}/api/test-results/upload-certificate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        setExtractionResult(data.extraction)
        setExtractedTestId(data.testResult.id)

        // Set form data for review from extracted values
        const extractedFields = data.extraction.extractedFields
        setReviewFormData({
          testType: extractedFields.testType?.value || '',
          laboratoryName: extractedFields.laboratoryName?.value || '',
          laboratoryReportNumber: extractedFields.laboratoryReportNumber?.value || '',
          sampleDate: extractedFields.sampleDate?.value || '',
          testDate: extractedFields.testDate?.value || '',
          sampleLocation: extractedFields.sampleLocation?.value || '',
          resultValue: extractedFields.resultValue?.value || '',
          resultUnit: extractedFields.resultUnit?.value || '',
          specificationMin: extractedFields.specificationMin?.value || '',
          specificationMax: extractedFields.specificationMax?.value || '',
        })

        // Create preview URL for the PDF
        const previewUrl = URL.createObjectURL(uploadedFile)
        setPdfUrl(previewUrl)

        // Refresh test results list
        const testsResponse = await fetch(`${apiUrl}/api/test-results?projectId=${projectId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (testsResponse.ok) {
          const testsData = await testsResponse.json()
          setTestResults(testsData.testResults || [])
        }
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to upload certificate')
      }
    } catch (err) {
      alert('Failed to upload certificate')
    } finally {
      setUploading(false)
    }
  }

  // Feature #200: Confirm extraction and save corrections
  const handleConfirmExtraction = async () => {
    if (!extractedTestId) return

    setConfirmingExtraction(true)
    const token = getAuthToken()
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

    try {
      const response = await fetch(`${apiUrl}/api/test-results/${extractedTestId}/confirm-extraction`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ corrections: reviewFormData }),
      })

      if (response.ok) {
        // Close modal and refresh
        setShowUploadModal(false)
        setUploadedFile(null)
        setExtractionResult(null)
        setExtractedTestId(null)
        setPdfUrl(null)
        setReviewFormData({})

        // Refresh test results
        const testsResponse = await fetch(`${apiUrl}/api/test-results?projectId=${projectId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (testsResponse.ok) {
          const testsData = await testsResponse.json()
          setTestResults(testsData.testResults || [])
        }
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to confirm extraction')
      }
    } catch (err) {
      alert('Failed to confirm extraction')
    } finally {
      setConfirmingExtraction(false)
    }
  }

  // Feature #200: Get confidence indicator color/style
  const getConfidenceIndicator = (field: string): { color: string; text: string } => {
    if (!extractionResult) return { color: '', text: '' }
    const confidence = extractionResult.confidence[field]
    if (!confidence) return { color: '', text: '' }

    if (confidence < 0.80) {
      return { color: 'border-red-500 bg-red-50 dark:bg-red-900/30', text: `${Math.round(confidence * 100)}% - Low confidence, please verify` }
    } else if (confidence < 0.90) {
      return { color: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20', text: `${Math.round(confidence * 100)}% confidence` }
    }
    return { color: 'border-green-500 bg-green-50 dark:bg-green-900/20', text: `${Math.round(confidence * 100)}% confidence` }
  }

  // Feature #202: Batch upload handler
  const handleBatchUpload = async () => {
    if (batchFiles.length === 0) {
      alert('Please select files first')
      return
    }

    setBatchUploading(true)
    setBatchProgress({ current: 0, total: batchFiles.length })

    const token = getAuthToken()
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

    try {
      const formData = new FormData()
      for (const file of batchFiles) {
        formData.append('certificates', file)
      }
      formData.append('projectId', projectId || '')

      const response = await fetch(`${apiUrl}/api/test-results/batch-upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        setBatchResults(data.results)
        setBatchProgress(null)

        // Initialize review data for each result
        const reviewData: Record<string, Record<string, string>> = {}
        for (const result of data.results) {
          if (result.success) {
            const extracted = result.extraction.extractedFields
            reviewData[result.testResult.id] = {
              testType: extracted.testType?.value || '',
              laboratoryName: extracted.laboratoryName?.value || '',
              laboratoryReportNumber: extracted.laboratoryReportNumber?.value || '',
              sampleDate: extracted.sampleDate?.value || '',
              testDate: extracted.testDate?.value || '',
              sampleLocation: extracted.sampleLocation?.value || '',
              resultValue: extracted.resultValue?.value || '',
              resultUnit: extracted.resultUnit?.value || '',
              specificationMin: extracted.specificationMin?.value || '',
              specificationMax: extracted.specificationMax?.value || '',
            }
          }
        }
        setBatchReviewData(reviewData)

        // Refresh test results list
        const testsResponse = await fetch(`${apiUrl}/api/test-results?projectId=${projectId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (testsResponse.ok) {
          const testsData = await testsResponse.json()
          setTestResults(testsData.testResults || [])
        }
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to upload certificates')
        setBatchProgress(null)
      }
    } catch (err) {
      alert('Failed to upload certificates')
      setBatchProgress(null)
    } finally {
      setBatchUploading(false)
    }
  }

  // Feature #202: Batch confirm all handler
  const handleBatchConfirmAll = async () => {
    setBatchConfirming(true)
    const token = getAuthToken()
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

    try {
      const confirmations = batchResults
        .filter(r => r.success)
        .map(r => ({
          testResultId: r.testResult.id,
          corrections: batchReviewData[r.testResult.id] || {}
        }))

      const response = await fetch(`${apiUrl}/api/test-results/batch-confirm`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ confirmations }),
      })

      if (response.ok) {
        // Close modal and reset
        setShowBatchUploadModal(false)
        setBatchFiles([])
        setBatchResults([])
        setBatchReviewData({})
        setSelectedBatchResult(null)

        // Refresh test results
        const testsResponse = await fetch(`${apiUrl}/api/test-results?projectId=${projectId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (testsResponse.ok) {
          const testsData = await testsResponse.json()
          setTestResults(testsData.testResults || [])
        }
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to confirm extractions')
      }
    } catch (err) {
      alert('Failed to confirm extractions')
    } finally {
      setBatchConfirming(false)
    }
  }

  // Feature #202: Get batch confidence indicator
  const getBatchConfidenceIndicator = (result: any, field: string): { color: string; text: string } => {
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
          {/* Feature #200: Upload Certificate button */}
          <button
            onClick={() => setShowUploadModal(true)}
            className="rounded-lg border border-primary px-4 py-2 text-primary hover:bg-primary/10"
          >
            📄 Upload Certificate
          </button>
          {/* Feature #202: Batch Upload button */}
          <button
            onClick={() => setShowBatchUploadModal(true)}
            className="rounded-lg border border-purple-500 px-4 py-2 text-purple-600 hover:bg-purple-50"
          >
            📁 Batch Upload
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

      {/* Feature #205: Filter Bar */}
      {testResults.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border hover:bg-muted"
          >
            🔍 Filters {hasActiveFilters && <span className="bg-primary text-primary-foreground px-1.5 py-0.5 rounded text-xs">{filteredTestResults.length}/{testResults.length}</span>}
          </button>

          {showFilters && (
            <div className="mt-3 p-4 rounded-lg border bg-muted/30 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* Test Type Filter */}
                <div>
                  <label className="block text-xs font-medium mb-1">Test Type</label>
                  <select
                    value={filterTestType}
                    onChange={(e) => setFilterTestType(e.target.value)}
                    className="w-full rounded border px-2 py-1.5 text-sm"
                  >
                    <option value="">All Types</option>
                    {uniqueTestTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                {/* Status Filter */}
                <div>
                  <label className="block text-xs font-medium mb-1">Status</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full rounded border px-2 py-1.5 text-sm"
                  >
                    <option value="">All Statuses</option>
                    <option value="requested">Requested</option>
                    <option value="at_lab">At Lab</option>
                    <option value="results_received">Results Received</option>
                    <option value="entered">Entered</option>
                    <option value="verified">Verified</option>
                  </select>
                </div>

                {/* Pass/Fail Filter */}
                <div>
                  <label className="block text-xs font-medium mb-1">Pass/Fail</label>
                  <select
                    value={filterPassFail}
                    onChange={(e) => setFilterPassFail(e.target.value)}
                    className="w-full rounded border px-2 py-1.5 text-sm"
                  >
                    <option value="">All</option>
                    <option value="pass">Pass</option>
                    <option value="fail">Fail</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>

                {/* Lot Filter */}
                <div>
                  <label className="block text-xs font-medium mb-1">Linked Lot</label>
                  <select
                    value={filterLot}
                    onChange={(e) => setFilterLot(e.target.value)}
                    className="w-full rounded border px-2 py-1.5 text-sm"
                  >
                    <option value="">All Lots</option>
                    {lots.map(lot => (
                      <option key={lot.id} value={lot.id}>{lot.lotNumber}</option>
                    ))}
                  </select>
                </div>

                {/* Date From */}
                <div>
                  <label className="block text-xs font-medium mb-1">From Date</label>
                  <input
                    type="date"
                    value={filterDateFrom}
                    onChange={(e) => setFilterDateFrom(e.target.value)}
                    className="w-full rounded border px-2 py-1.5 text-sm"
                  />
                </div>

                {/* Date To */}
                <div>
                  <label className="block text-xs font-medium mb-1">To Date</label>
                  <input
                    type="date"
                    value={filterDateTo}
                    onChange={(e) => setFilterDateTo(e.target.value)}
                    className="w-full rounded border px-2 py-1.5 text-sm"
                  />
                </div>
              </div>

              {hasActiveFilters && (
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-sm text-muted-foreground">
                    Showing {filteredTestResults.length} of {testResults.length} results
                  </span>
                  <button
                    onClick={clearFilters}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Clear all filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
              {filteredTestResults.length === 0 && hasActiveFilters ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    <div className="text-3xl mb-2">🔍</div>
                    <p>No test results match your filters.</p>
                    <button
                      onClick={clearFilters}
                      className="mt-2 text-sm text-primary hover:underline"
                    >
                      Clear all filters
                    </button>
                  </td>
                </tr>
              ) : null}
              {filteredTestResults.map((test) => {
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
                      {/* Feature #200: AI extracted indicator */}
                      {test.aiExtracted && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-purple-500 text-white rounded font-bold" title="AI Extracted from certificate">
                          AI
                        </span>
                      )}
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
                    <div className="flex gap-2 items-center">
                      {nextStatusMap[test.status] && (
                        <button
                          onClick={() => handleUpdateStatus(test.id, nextStatusMap[test.status])}
                          disabled={updatingStatusId === test.id}
                          className="px-3 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                        >
                          {updatingStatusId === test.id ? 'Updating...' : nextStatusButtonLabels[test.status]}
                        </button>
                      )}
                      {/* Feature #204: Reject button for tests in "entered" status */}
                      {test.status === 'entered' && (
                        <button
                          onClick={() => openRejectModal(test.id)}
                          className="px-3 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200"
                        >
                          Reject
                        </button>
                      )}
                      {test.status === 'verified' && (
                        <span className="text-green-600 text-xs font-medium">✓ Complete</span>
                      )}
                    </div>
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

      {/* Feature #200: Upload Certificate Modal with AI Extraction */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-5xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold">
                {extractionResult ? '📊 Review AI Extracted Data' : '📄 Upload Test Certificate'}
              </h2>
              <button
                onClick={() => {
                  setShowUploadModal(false)
                  setUploadedFile(null)
                  setExtractionResult(null)
                  setExtractedTestId(null)
                  setPdfUrl(null)
                  setReviewFormData({})
                }}
                className="text-muted-foreground hover:text-foreground text-2xl"
              >
                ×
              </button>
            </div>

            {/* Before extraction - File upload */}
            {!extractionResult ? (
              <div className="p-6">
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <div className="text-5xl mb-4">📄</div>
                  <h3 className="text-lg font-semibold mb-2">Upload Test Certificate PDF</h3>
                  <p className="text-muted-foreground mb-4">
                    Upload a test certificate and our AI will automatically extract the test data
                  </p>
                  <input
                    type="file"
                    accept=".pdf,image/jpeg,image/png"
                    onChange={(e) => setUploadedFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="certificate-upload"
                  />
                  <label
                    htmlFor="certificate-upload"
                    className="inline-block px-4 py-2 rounded-lg bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90"
                  >
                    Select File
                  </label>
                  {uploadedFile && (
                    <div className="mt-4 p-3 bg-muted rounded-lg">
                      <p className="text-sm font-medium">{uploadedFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShowUploadModal(false)
                      setUploadedFile(null)
                    }}
                    className="px-4 py-2 text-sm rounded-lg border hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUploadCertificate}
                    disabled={!uploadedFile || uploading}
                    className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {uploading ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Processing with AI...
                      </span>
                    ) : (
                      '🤖 Extract with AI'
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* After extraction - Side-by-side view */
              <div className="flex-1 flex overflow-hidden">
                {/* Left side - PDF Preview */}
                <div className="w-1/2 border-r flex flex-col">
                  <div className="p-3 bg-muted/50 border-b">
                    <h3 className="font-medium">Certificate Preview</h3>
                  </div>
                  <div className="flex-1 overflow-auto p-4">
                    {pdfUrl && uploadedFile?.type === 'application/pdf' ? (
                      <iframe
                        src={pdfUrl}
                        className="w-full h-full min-h-[500px] rounded border"
                        title="Certificate Preview"
                      />
                    ) : pdfUrl ? (
                      <img src={pdfUrl} alt="Certificate" className="max-w-full rounded border" />
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        No preview available
                      </div>
                    )}
                  </div>
                </div>

                {/* Right side - Extracted Data */}
                <div className="w-1/2 flex flex-col">
                  <div className="p-3 bg-muted/50 border-b">
                    <h3 className="font-medium">Extracted Data</h3>
                    {extractionResult.needsReview && (
                      <p className="text-xs text-amber-600 mt-1">
                        ⚠️ {extractionResult.reviewMessage}
                      </p>
                    )}
                  </div>
                  <div className="flex-1 overflow-auto p-4 space-y-4">
                    {/* Confidence Summary */}
                    <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                      <div className="flex items-center gap-2 text-sm font-medium text-purple-800 dark:text-purple-200">
                        <span>🤖</span>
                        <span>AI Extraction Complete</span>
                      </div>
                      <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                        {extractionResult.lowConfidenceFields.length === 0
                          ? 'All fields extracted with high confidence'
                          : `${extractionResult.lowConfidenceFields.length} field(s) need verification (highlighted in red)`}
                      </p>
                    </div>

                    {/* Editable Fields */}
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium mb-1">Test Type</label>
                        <input
                          type="text"
                          value={reviewFormData.testType || ''}
                          onChange={(e) => setReviewFormData({ ...reviewFormData, testType: e.target.value })}
                          className={`w-full rounded-lg border px-3 py-2 ${getConfidenceIndicator('testType').color}`}
                        />
                        <p className="text-xs text-muted-foreground mt-0.5">{getConfidenceIndicator('testType').text}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Laboratory Name</label>
                        <input
                          type="text"
                          value={reviewFormData.laboratoryName || ''}
                          onChange={(e) => setReviewFormData({ ...reviewFormData, laboratoryName: e.target.value })}
                          className={`w-full rounded-lg border px-3 py-2 ${getConfidenceIndicator('laboratoryName').color}`}
                        />
                        <p className="text-xs text-muted-foreground mt-0.5">{getConfidenceIndicator('laboratoryName').text}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Lab Report Number</label>
                        <input
                          type="text"
                          value={reviewFormData.laboratoryReportNumber || ''}
                          onChange={(e) => setReviewFormData({ ...reviewFormData, laboratoryReportNumber: e.target.value })}
                          className={`w-full rounded-lg border px-3 py-2 ${getConfidenceIndicator('laboratoryReportNumber').color}`}
                        />
                        <p className="text-xs text-muted-foreground mt-0.5">{getConfidenceIndicator('laboratoryReportNumber').text}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium mb-1">Sample Date</label>
                          <input
                            type="date"
                            value={reviewFormData.sampleDate || ''}
                            onChange={(e) => setReviewFormData({ ...reviewFormData, sampleDate: e.target.value })}
                            className={`w-full rounded-lg border px-3 py-2 ${getConfidenceIndicator('sampleDate').color}`}
                          />
                          <p className="text-xs text-muted-foreground mt-0.5">{getConfidenceIndicator('sampleDate').text}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Test Date</label>
                          <input
                            type="date"
                            value={reviewFormData.testDate || ''}
                            onChange={(e) => setReviewFormData({ ...reviewFormData, testDate: e.target.value })}
                            className={`w-full rounded-lg border px-3 py-2 ${getConfidenceIndicator('testDate').color}`}
                          />
                          <p className="text-xs text-muted-foreground mt-0.5">{getConfidenceIndicator('testDate').text}</p>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Sample Location</label>
                        <input
                          type="text"
                          value={reviewFormData.sampleLocation || ''}
                          onChange={(e) => setReviewFormData({ ...reviewFormData, sampleLocation: e.target.value })}
                          className={`w-full rounded-lg border px-3 py-2 ${getConfidenceIndicator('sampleLocation').color}`}
                        />
                        <p className="text-xs text-muted-foreground mt-0.5">{getConfidenceIndicator('sampleLocation').text}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium mb-1">Result Value</label>
                          <input
                            type="number"
                            step="any"
                            value={reviewFormData.resultValue || ''}
                            onChange={(e) => setReviewFormData({ ...reviewFormData, resultValue: e.target.value })}
                            className={`w-full rounded-lg border px-3 py-2 ${getConfidenceIndicator('resultValue').color}`}
                          />
                          <p className="text-xs text-muted-foreground mt-0.5">{getConfidenceIndicator('resultValue').text}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Unit</label>
                          <input
                            type="text"
                            value={reviewFormData.resultUnit || ''}
                            onChange={(e) => setReviewFormData({ ...reviewFormData, resultUnit: e.target.value })}
                            className={`w-full rounded-lg border px-3 py-2 ${getConfidenceIndicator('resultUnit').color}`}
                          />
                          <p className="text-xs text-muted-foreground mt-0.5">{getConfidenceIndicator('resultUnit').text}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium mb-1">Spec Min</label>
                          <input
                            type="number"
                            step="any"
                            value={reviewFormData.specificationMin || ''}
                            onChange={(e) => setReviewFormData({ ...reviewFormData, specificationMin: e.target.value })}
                            className={`w-full rounded-lg border px-3 py-2 ${getConfidenceIndicator('specificationMin').color}`}
                          />
                          <p className="text-xs text-muted-foreground mt-0.5">{getConfidenceIndicator('specificationMin').text}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Spec Max</label>
                          <input
                            type="number"
                            step="any"
                            value={reviewFormData.specificationMax || ''}
                            onChange={(e) => setReviewFormData({ ...reviewFormData, specificationMax: e.target.value })}
                            className={`w-full rounded-lg border px-3 py-2 ${getConfidenceIndicator('specificationMax').color}`}
                          />
                          <p className="text-xs text-muted-foreground mt-0.5">{getConfidenceIndicator('specificationMax').text}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer actions */}
                  <div className="p-4 border-t flex justify-end gap-3">
                    <button
                      onClick={() => {
                        setShowUploadModal(false)
                        setUploadedFile(null)
                        setExtractionResult(null)
                        setExtractedTestId(null)
                        setPdfUrl(null)
                        setReviewFormData({})
                      }}
                      className="px-4 py-2 text-sm rounded-lg border hover:bg-muted"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmExtraction}
                      disabled={confirmingExtraction}
                      className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      {confirmingExtraction ? 'Saving...' : '✓ Confirm & Save'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Feature #202: Batch Upload Modal */}
      {showBatchUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-6xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold">
                📁 Batch Upload Test Certificates
              </h2>
              <button
                onClick={() => {
                  setShowBatchUploadModal(false)
                  setBatchFiles([])
                  setBatchResults([])
                  setBatchReviewData({})
                  setSelectedBatchResult(null)
                }}
                className="text-muted-foreground hover:text-foreground text-2xl"
              >
                ×
              </button>
            </div>

            {/* Before processing - File selection */}
            {batchResults.length === 0 ? (
              <div className="p-6">
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <div className="text-5xl mb-4">📁</div>
                  <h3 className="text-lg font-semibold mb-2">Upload Multiple Test Certificates</h3>
                  <p className="text-muted-foreground mb-4">
                    Select up to 10 PDF files to process with AI extraction
                  </p>
                  <input
                    type="file"
                    accept=".pdf,image/jpeg,image/png"
                    multiple
                    onChange={(e) => setBatchFiles(Array.from(e.target.files || []))}
                    className="hidden"
                    id="batch-certificate-upload"
                  />
                  <label
                    htmlFor="batch-certificate-upload"
                    className="inline-block px-4 py-2 rounded-lg bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90"
                  >
                    Select Files
                  </label>
                  {batchFiles.length > 0 && (
                    <div className="mt-4 text-left">
                      <p className="text-sm font-medium mb-2">{batchFiles.length} file(s) selected:</p>
                      <div className="max-h-40 overflow-auto space-y-1">
                        {batchFiles.map((file, i) => (
                          <div key={i} className="p-2 bg-muted rounded text-sm flex justify-between">
                            <span>{file.name}</span>
                            <span className="text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Progress indicator */}
                {batchProgress && (
                  <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Processing certificates...</span>
                      <span className="text-sm text-muted-foreground">
                        {batchProgress.current} / {batchProgress.total}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-purple-500 h-2 rounded-full transition-all"
                        style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShowBatchUploadModal(false)
                      setBatchFiles([])
                    }}
                    className="px-4 py-2 text-sm rounded-lg border hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBatchUpload}
                    disabled={batchFiles.length === 0 || batchUploading}
                    className="px-4 py-2 text-sm rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
                  >
                    {batchUploading ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Processing...
                      </span>
                    ) : (
                      `🤖 Process ${batchFiles.length} File${batchFiles.length !== 1 ? 's' : ''}`
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* After processing - Review queue */
              <div className="flex-1 flex overflow-hidden">
                {/* Left side - Results list */}
                <div className="w-1/3 border-r flex flex-col">
                  <div className="p-3 bg-muted/50 border-b">
                    <h3 className="font-medium">Extraction Results</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {batchResults.filter(r => r.success).length} of {batchResults.length} processed successfully
                    </p>
                  </div>
                  <div className="flex-1 overflow-auto">
                    {batchResults.map((result, index) => (
                      <div
                        key={index}
                        onClick={() => result.success && setSelectedBatchResult(index)}
                        className={`p-3 border-b cursor-pointer hover:bg-muted/50 ${
                          selectedBatchResult === index ? 'bg-purple-50 dark:bg-purple-900/20 border-l-4 border-l-purple-500' : ''
                        } ${!result.success ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium truncate">
                            {result.filename}
                          </span>
                          {result.success ? (
                            result.extraction?.needsReview ? (
                              <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded">Review</span>
                            ) : (
                              <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-800 rounded">✓ Good</span>
                            )
                          ) : (
                            <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-800 rounded">Failed</span>
                          )}
                        </div>
                        {result.success && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {result.testResult.testType}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right side - Selected result details */}
                <div className="w-2/3 flex flex-col">
                  {selectedBatchResult !== null && batchResults[selectedBatchResult]?.success ? (
                    <>
                      <div className="p-3 bg-muted/50 border-b">
                        <h3 className="font-medium">Review Extracted Data</h3>
                        <p className="text-xs text-muted-foreground">
                          {batchResults[selectedBatchResult].filename}
                        </p>
                      </div>
                      <div className="flex-1 overflow-auto p-4 space-y-3">
                        {/* Editable fields for selected result */}
                        {(() => {
                          const result = batchResults[selectedBatchResult]
                          const testId = result.testResult.id
                          const formData = batchReviewData[testId] || {}
                          const updateField = (field: string, value: string) => {
                            setBatchReviewData(prev => ({
                              ...prev,
                              [testId]: { ...prev[testId], [field]: value }
                            }))
                          }

                          return (
                            <>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-medium mb-1">Test Type</label>
                                  <input
                                    type="text"
                                    value={formData.testType || ''}
                                    onChange={(e) => updateField('testType', e.target.value)}
                                    className={`w-full rounded border px-2 py-1 text-sm ${getBatchConfidenceIndicator(result, 'testType').color}`}
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium mb-1">Laboratory</label>
                                  <input
                                    type="text"
                                    value={formData.laboratoryName || ''}
                                    onChange={(e) => updateField('laboratoryName', e.target.value)}
                                    className={`w-full rounded border px-2 py-1 text-sm ${getBatchConfidenceIndicator(result, 'laboratoryName').color}`}
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="block text-xs font-medium mb-1">Lab Report #</label>
                                <input
                                  type="text"
                                  value={formData.laboratoryReportNumber || ''}
                                  onChange={(e) => updateField('laboratoryReportNumber', e.target.value)}
                                  className={`w-full rounded border px-2 py-1 text-sm ${getBatchConfidenceIndicator(result, 'laboratoryReportNumber').color}`}
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-medium mb-1">Sample Date</label>
                                  <input
                                    type="date"
                                    value={formData.sampleDate || ''}
                                    onChange={(e) => updateField('sampleDate', e.target.value)}
                                    className={`w-full rounded border px-2 py-1 text-sm ${getBatchConfidenceIndicator(result, 'sampleDate').color}`}
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium mb-1">Test Date</label>
                                  <input
                                    type="date"
                                    value={formData.testDate || ''}
                                    onChange={(e) => updateField('testDate', e.target.value)}
                                    className={`w-full rounded border px-2 py-1 text-sm ${getBatchConfidenceIndicator(result, 'testDate').color}`}
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="block text-xs font-medium mb-1">Sample Location</label>
                                <input
                                  type="text"
                                  value={formData.sampleLocation || ''}
                                  onChange={(e) => updateField('sampleLocation', e.target.value)}
                                  className={`w-full rounded border px-2 py-1 text-sm ${getBatchConfidenceIndicator(result, 'sampleLocation').color}`}
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-medium mb-1">Result Value</label>
                                  <input
                                    type="number"
                                    step="any"
                                    value={formData.resultValue || ''}
                                    onChange={(e) => updateField('resultValue', e.target.value)}
                                    className={`w-full rounded border px-2 py-1 text-sm ${getBatchConfidenceIndicator(result, 'resultValue').color}`}
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium mb-1">Unit</label>
                                  <input
                                    type="text"
                                    value={formData.resultUnit || ''}
                                    onChange={(e) => updateField('resultUnit', e.target.value)}
                                    className={`w-full rounded border px-2 py-1 text-sm ${getBatchConfidenceIndicator(result, 'resultUnit').color}`}
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-medium mb-1">Spec Min</label>
                                  <input
                                    type="number"
                                    step="any"
                                    value={formData.specificationMin || ''}
                                    onChange={(e) => updateField('specificationMin', e.target.value)}
                                    className={`w-full rounded border px-2 py-1 text-sm ${getBatchConfidenceIndicator(result, 'specificationMin').color}`}
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium mb-1">Spec Max</label>
                                  <input
                                    type="number"
                                    step="any"
                                    value={formData.specificationMax || ''}
                                    onChange={(e) => updateField('specificationMax', e.target.value)}
                                    className={`w-full rounded border px-2 py-1 text-sm ${getBatchConfidenceIndicator(result, 'specificationMax').color}`}
                                  />
                                </div>
                              </div>
                            </>
                          )
                        })()}
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground">
                      Select a result from the list to review
                    </div>
                  )}

                  {/* Footer actions */}
                  <div className="p-4 border-t flex justify-between">
                    <button
                      onClick={() => {
                        setShowBatchUploadModal(false)
                        setBatchFiles([])
                        setBatchResults([])
                        setBatchReviewData({})
                        setSelectedBatchResult(null)
                      }}
                      className="px-4 py-2 text-sm rounded-lg border hover:bg-muted"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleBatchConfirmAll}
                      disabled={batchConfirming}
                      className="px-4 py-2 text-sm rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
                    >
                      {batchConfirming ? 'Saving...' : `✓ Confirm All (${batchResults.filter(r => r.success).length})`}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Feature #204: Reject Test Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-2 text-red-600">Reject Test Verification</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Please provide a reason for rejecting this test result. The engineer will be notified and can re-enter the data.
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Rejection Reason *</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Enter the reason for rejection (e.g., incorrect values, missing data, doesn't match certificate)"
                  rows={4}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowRejectModal(false)
                    setRejectingTestId(null)
                    setRejectReason('')
                  }}
                  className="px-4 py-2 text-sm rounded-lg border hover:bg-muted"
                  disabled={rejecting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleRejectTest}
                  disabled={rejecting || !rejectReason.trim()}
                  className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {rejecting ? 'Rejecting...' : 'Reject Test'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
