import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  FlaskConical,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { apiFetch } from '@/lib/api'

interface TestResult {
  id: string
  lotId: string
  lotNumber: string
  testType: string
  result: 'pass' | 'fail' | 'pending'
  value?: string
  testedAt: string
  testedBy?: { fullName: string }
  notes?: string
}

interface SubcontractorCompany {
  id: string
  companyName: string
  projectId: string
  projectName: string
}

function getResultBadge(result: string) {
  switch (result) {
    case 'pass':
      return (
        <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
          <CheckCircle2 className="h-3 w-3" />
          Pass
        </span>
      )
    case 'fail':
      return (
        <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">
          <XCircle className="h-3 w-3" />
          Fail
        </span>
      )
    default:
      return (
        <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
          <Clock className="h-3 w-3" />
          Pending
        </span>
      )
  }
}

export function SubcontractorTestResultsPage() {
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [company, setCompany] = useState<SubcontractorCompany | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        // Get company info
        const companyData = await apiFetch<{ company: SubcontractorCompany }>(`/api/subcontractors/my-company`)
        setCompany(companyData.company)

        // Fetch test results for assigned lots
        const testsData = await apiFetch<{ testResults?: TestResult[]; tests?: TestResult[] }>(
          `/api/tests?projectId=${companyData.company.projectId}&subcontractorView=true`
        )
        setTestResults(testsData.testResults || testsData.tests || [])
      } catch (err) {
        console.error('Error fetching data:', err)
        setError('Failed to load test results')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const passed = testResults.filter(t => t.result === 'pass')
  const failed = testResults.filter(t => t.result === 'fail')
  const pending = testResults.filter(t => t.result === 'pending' || !t.result)

  if (loading) {
    return (
      <div className="container max-w-2xl mx-auto p-4 pb-20 md:pb-4 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-6 w-32" />
        </div>
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="container max-w-2xl mx-auto p-4">
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
        <Link
          to="/subcontractor-portal"
          className="inline-flex items-center gap-2 mt-4 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Portal
        </Link>
      </div>
    )
  }

  return (
    <div className="container max-w-2xl mx-auto p-4 pb-20 md:pb-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/subcontractor-portal"
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-300" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Test Results</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{company?.projectName}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 p-3">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{passed.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Passed</p>
        </div>
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 p-3">
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{failed.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Failed</p>
        </div>
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 p-3">
          <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">{pending.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Pending</p>
        </div>
      </div>

      {testResults.length === 0 ? (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
          <div className="p-8 text-center">
            <FlaskConical className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 mb-2">No test results</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Test results from your assigned lots will appear here
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Failed - show first as priority */}
          {failed.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-red-500 dark:text-red-400 mb-2">
                Failed ({failed.length})
              </h2>
              <div className="space-y-2">
                {failed.map((test) => (
                  <TestResultCard key={test.id} testResult={test} />
                ))}
              </div>
            </div>
          )}

          {/* Pending */}
          {pending.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                Pending ({pending.length})
              </h2>
              <div className="space-y-2">
                {pending.map((test) => (
                  <TestResultCard key={test.id} testResult={test} />
                ))}
              </div>
            </div>
          )}

          {/* Passed */}
          {passed.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                Passed ({passed.length})
              </h2>
              <div className="space-y-2">
                {passed.map((test) => (
                  <TestResultCard key={test.id} testResult={test} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function TestResultCard({ testResult }: { testResult: TestResult }) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
              <FlaskConical className="h-4 w-4 text-blue-600 dark:text-blue-300" />
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">{testResult.lotNumber}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{testResult.testType}</p>
              {testResult.value && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Value: {testResult.value}
                </p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {new Date(testResult.testedAt).toLocaleDateString()}
                {testResult.testedBy && ` by ${testResult.testedBy.fullName}`}
              </p>
            </div>
          </div>
          {getResultBadge(testResult.result)}
        </div>
      </div>
    </div>
  )
}
