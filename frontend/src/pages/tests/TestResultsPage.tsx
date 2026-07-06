import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MoreVertical, FileDown, FolderOpen, FlaskConical } from 'lucide-react';
import { getAuthToken } from '@/lib/auth';
import { apiFetch, authFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useRegisterDeepLink } from '@/hooks/useRegisterDeepLink';
import { getResponseErrorMessage } from './utils';
import type { TestResult, Lot, FailedTestForNcr, NcrFormData, CreateTestFormData } from './types';
import { TestFilters } from './components/TestFilters';
import { TestResultsTable } from './components/TestResultsTable';
import { TestResultsMobileList } from './components/TestResultsMobileList';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { CreateTestModal } from './components/CreateTestModal';
import { LinkItpItemModal } from './components/LinkItpItemModal';
import { EnterResultsModal, type EnterResultsValues } from './components/EnterResultsModal';
import { UploadCertificateModal } from './components/UploadCertificateModal';
import { BatchUploadModal } from './components/BatchUploadModal';
import { RejectTestModal } from './components/RejectTestModal';
import { NcrPromptModal, NcrCreateModal } from './components/NcrModals';
import { buildFailedTestNcrContext, type FailedTestNcrInput } from './failedTestNcr';
import { BottomSheet } from '@/components/foreman/sheets/BottomSheet';
import { downloadCsv } from '@/lib/csv';
import { formatDateKey } from '@/lib/localDate';
import { toast } from '@/components/ui/toaster';
import { extractErrorMessage } from '@/lib/errorHandling';
import { ContextHelp, HELP_CONTENT } from '@/components/ContextHelp';
import { TEST_REJECTION_REASON_MAX_LENGTH } from './constants';
import {
  buildTestResultsCsvRows,
  filterTestResults,
  getUniqueTestTypes,
  hasActiveTestFilters,
  TEST_RESULTS_CSV_HEADERS,
  type TestResultFilterState,
} from './testResultsPageHelpers';

// Register APIs default to 20 rows per page (backend lib/pagination.ts); pull
// every page so the register shows all tests, not just the newest 20. Mirrors
// fetchAllLotPages in pages/lots/hooks/useLotsData.ts.
const TESTS_API_PAGE_LIMIT = 100;
const TESTS_API_MAX_PAGES = 100;

interface TestResultsApiResponse {
  testResults?: TestResult[];
  pagination?: {
    hasNextPage?: boolean;
    totalPages?: number;
  };
}

async function fetchAllTestResultPages(projectId: string): Promise<TestResult[]> {
  const allResults: TestResult[] = [];
  let page = 1;

  while (page <= TESTS_API_MAX_PAGES) {
    const data = await apiFetch<TestResultsApiResponse>(
      `/api/test-results?projectId=${encodeURIComponent(projectId)}&page=${page}&limit=${TESTS_API_PAGE_LIMIT}`,
    );

    allResults.push(...(data.testResults ?? []));

    if (!data.pagination?.hasNextPage || page >= (data.pagination.totalPages ?? page)) {
      return allResults;
    }

    page += 1;
  }

  throw new Error('Test results register exceeded the maximum page count');
}

// Read side of GlobalSearch's test links (?test=<id>): stable references so the
// deep-link effect doesn't re-run on every render.
const getTestId = (test: TestResult) => test.id;
const TEST_LINK_NOT_FOUND = {
  title: "Couldn't find that test result",
  description: 'The link may belong to another project, or the test may have been deleted.',
};

export function TestResultsPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  // Core data state
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectState, setProjectState] = useState<string>('NSW');

  // Mobile overflow sheet state (PR-L: header "More" button)
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);

  // Modal visibility state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [linkItpTest, setLinkItpTest] = useState<TestResult | null>(null);
  const [enterResultsTest, setEnterResultsTest] = useState<TestResult | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showBatchUploadModal, setShowBatchUploadModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showNcrPromptModal, setShowNcrPromptModal] = useState(false);
  const [showNcrModal, setShowNcrModal] = useState(false);

  // Status update tracking
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const updatingStatusRef = useRef<string | null>(null);
  const enteringResultsRef = useRef<string | null>(null);
  const rejectingTestRef = useRef<string | null>(null);
  const creatingTestRef = useRef(false);
  const creatingNcrRef = useRef(false);

  // Reject test state
  const [rejectingTestId, setRejectingTestId] = useState<string | null>(null);

  // NCR state
  const [failedTestForNcr, setFailedTestForNcr] = useState<FailedTestForNcr | null>(null);
  const [ncrInitialDescription, setNcrInitialDescription] = useState('');

  // Filter state
  const [filterTestType, setFilterTestType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPassFail, setFilterPassFail] = useState('');
  const [filterLot, setFilterLot] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Data fetching
  const fetchData = useCallback(async () => {
    if (!projectId) {
      setTestResults([]);
      setLots([]);
      setError(null);
      setLoading(false);
      return;
    }

    const token = getAuthToken();
    if (!token) {
      navigate('/login');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const encodedProjectId = encodeURIComponent(projectId);
      const [testsData, lotsData, projectData] = await Promise.all([
        fetchAllTestResultPages(projectId),
        apiFetch<{ lots: Lot[] }>(`/api/lots?projectId=${encodedProjectId}`),
        apiFetch<{ project?: { state?: string } }>(`/api/projects/${encodedProjectId}`),
      ]);

      setTestResults(testsData);
      setLots(lotsData.lots || []);
      setProjectState(projectData.project?.state || 'NSW');
    } catch (err) {
      setTestResults([]);
      setLots([]);
      setError(extractErrorMessage(err, 'Failed to load test results.'));
    } finally {
      setLoading(false);
    }
  }, [projectId, navigate]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Deep link from a GlobalSearch test result (?test=<id>): scroll to + highlight
  // the linked test once the register has loaded, or toast if it isn't here.
  const { highlightedId: deepLinkedTestId } = useRegisterDeepLink({
    param: 'test',
    loading: loading || Boolean(error),
    records: testResults,
    getRecordId: getTestId,
    notFound: TEST_LINK_NOT_FOUND,
  });

  const invalidateTestResultCaches = useCallback(
    async (lotIds: Array<string | null | undefined> = []) => {
      if (!projectId) return;

      const affectedLotIds = Array.from(new Set(lotIds.filter(Boolean))) as string[];
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.testResults(projectId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.lots(projectId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.claimReadiness(projectId) }),
        ...affectedLotIds.flatMap((lotId) => [
          queryClient.invalidateQueries({ queryKey: queryKeys.lot(lotId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.lotReadiness(lotId) }),
        ]),
      ]);
    },
    [projectId, queryClient],
  );

  const getTestLotId = useCallback(
    (testId: string) => testResults.find((test) => test.id === testId)?.lotId,
    [testResults],
  );

  const getTestById = useCallback(
    (testId: string) => testResults.find((test) => test.id === testId),
    [testResults],
  );

  // M45: open the "raise an NCR?" prompt for a failed test result, used by the
  // manual-create, enter-results, and AI certificate confirm paths alike.
  const promptNcrForFailedTest = useCallback((input: FailedTestNcrInput) => {
    const { failedTest, description } = buildFailedTestNcrContext(input);
    setFailedTestForNcr(failedTest);
    setNcrInitialDescription(description);
    setShowNcrPromptModal(true);
  }, []);

  // Refresh helper
  const refreshTestResults = useCallback(
    async (lotIds: Array<string | null | undefined> = []) => {
      if (!projectId) return;

      const testsData = await fetchAllTestResultPages(projectId);
      setTestResults(testsData);
      await invalidateTestResultCaches(lotIds);
    },
    [projectId, invalidateTestResultCaches],
  );

  // Filtered and sorted results
  const filterState = useMemo<TestResultFilterState>(
    () => ({
      searchQuery,
      filterTestType,
      filterStatus,
      filterPassFail,
      filterLot,
      filterDateFrom,
      filterDateTo,
    }),
    [
      searchQuery,
      filterTestType,
      filterStatus,
      filterPassFail,
      filterLot,
      filterDateFrom,
      filterDateTo,
    ],
  );

  const filteredTestResults = useMemo(() => {
    return filterTestResults(testResults, filterState);
  }, [testResults, filterState]);

  const uniqueTestTypes = useMemo(() => {
    return getUniqueTestTypes(testResults);
  }, [testResults]);

  const hasActiveFilters = hasActiveTestFilters(filterState);

  const clearFilters = useCallback(() => {
    setFilterTestType('');
    setFilterStatus('');
    setFilterPassFail('');
    setFilterLot('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setSearchQuery('');
  }, []);

  // Status workflow handler
  const handleUpdateStatus = useCallback(
    async (testId: string, newStatus: string) => {
      if (updatingStatusRef.current === testId) return;

      updatingStatusRef.current = testId;
      setUpdatingStatusId(testId);
      try {
        await apiFetch(`/api/test-results/${encodeURIComponent(testId)}/status`, {
          method: 'POST',
          body: JSON.stringify({ status: newStatus }),
        });
        await refreshTestResults([getTestLotId(testId)]);
      } catch (err) {
        toast({
          title: 'Failed to update test status',
          description: extractErrorMessage(err, 'Please try again.'),
          variant: 'error',
        });
      } finally {
        updatingStatusRef.current = null;
        setUpdatingStatusId(null);
      }
    },
    [getTestLotId, refreshTestResults],
  );

  // Ticket T2: open the Enter Results form for a test (replaces the old no-data
  // "Enter Results" status click).
  const openEnterResultsModal = useCallback((test: TestResult) => {
    setEnterResultsTest(test);
  }, []);

  // Migration: open the "link to ITP item" picker for an existing test.
  const openLinkItpModal = useCallback((test: TestResult) => {
    setLinkItpTest(test);
  }, []);

  // Ticket T2: record the actual result value + pass/fail on the test (PATCH),
  // then advance it to 'entered' (status POST). Two requests, one user action:
  // this is the single mandatory click that gets a test with a cert to 'entered',
  // leaving only Verify before it is complete (<=2 clicks from "have a cert").
  const handleEnterResults = useCallback(
    async (testId: string, values: EnterResultsValues) => {
      if (enteringResultsRef.current === testId) return;

      enteringResultsRef.current = testId;
      try {
        await apiFetch(`/api/test-results/${encodeURIComponent(testId)}`, {
          method: 'PATCH',
          body: JSON.stringify({
            resultValue: values.resultValue.trim(),
            resultUnit: values.resultUnit.trim(),
            specificationMin: values.specificationMin.trim(),
            specificationMax: values.specificationMax.trim(),
            passFail: values.passFail,
          }),
        });

        await apiFetch(`/api/test-results/${encodeURIComponent(testId)}/status`, {
          method: 'POST',
          body: JSON.stringify({ status: 'entered' }),
        });

        await refreshTestResults([getTestLotId(testId)]);
        setEnterResultsTest(null);

        // M45: entering a failing result prompts to raise an NCR, just like the
        // manual-create and AI-import paths.
        if (values.passFail === 'fail') {
          const test = getTestById(testId);
          promptNcrForFailedTest({
            testId,
            testType: test?.testType || 'Test',
            resultValue: values.resultValue,
            resultUnit: values.resultUnit,
            specificationMin: values.specificationMin,
            specificationMax: values.specificationMax,
            lotId: test?.lotId ?? null,
          });
        }
      } finally {
        // On failure the error propagates to the modal (which stays open); the
        // finally always clears the in-flight guard.
        enteringResultsRef.current = null;
      }
    },
    [getTestLotId, getTestById, promptNcrForFailedTest, refreshTestResults],
  );

  // Reject handler
  const openRejectModal = useCallback((testId: string) => {
    setRejectingTestId(testId);
    setShowRejectModal(true);
  }, []);

  const handleRejectTest = useCallback(
    async (testId: string, reason: string) => {
      if (rejectingTestRef.current === testId) return;

      const rejectionReason = reason.trim();
      if (rejectionReason.length > TEST_REJECTION_REASON_MAX_LENGTH) {
        toast({
          title: 'Rejection reason too long',
          description: `Use ${TEST_REJECTION_REASON_MAX_LENGTH.toLocaleString()} characters or less.`,
          variant: 'error',
        });
        return;
      }

      rejectingTestRef.current = testId;
      try {
        await apiFetch(`/api/test-results/${encodeURIComponent(testId)}/reject`, {
          method: 'POST',
          body: JSON.stringify({ reason: rejectionReason }),
        });
        await refreshTestResults([getTestLotId(testId)]);
        setShowRejectModal(false);
        setRejectingTestId(null);
      } catch (err) {
        toast({
          title: 'Failed to reject test',
          description: extractErrorMessage(err, 'Please try again.'),
          variant: 'error',
        });
        throw err;
      } finally {
        rejectingTestRef.current = null;
      }
    },
    [getTestLotId, refreshTestResults],
  );

  // Feature B2: attach (or replace) a certificate on an EXISTING test result so a
  // manually-created test can satisfy the verification gate. Mirrors the
  // UploadCertificateModal upload pattern (FormData + authFetch for multipart),
  // then refreshes the list so the now-attachable Verify action unblocks.
  const handleAttachCertificate = useCallback(
    async (testId: string, file: File) => {
      try {
        const formData = new FormData();
        formData.append('certificate', file);

        const response = await authFetch(
          `/api/test-results/${encodeURIComponent(testId)}/certificate`,
          {
            method: 'POST',
            body: formData,
          },
        );

        if (!response.ok) {
          toast({
            title: 'Failed to attach certificate',
            description: await getResponseErrorMessage(response, 'Please try again.'),
            variant: 'error',
          });
          return;
        }

        await refreshTestResults([getTestLotId(testId)]);
        toast({
          title: 'Certificate attached',
          description: 'You can now verify this test result.',
          variant: 'success',
        });
      } catch (err) {
        toast({
          title: 'Failed to attach certificate',
          description: extractErrorMessage(err, 'Please try again.'),
          variant: 'error',
        });
      }
    },
    [getTestLotId, refreshTestResults],
  );

  // Create test handler
  const handleCreateTestResult = useCallback(
    async (formData: CreateTestFormData) => {
      if (creatingTestRef.current) return;

      creatingTestRef.current = true;
      try {
        const sanitizedFormData = Object.fromEntries(
          Object.entries(formData).map(([key, value]) => [
            key,
            typeof value === 'string' ? value.trim() : value,
          ]),
        ) as CreateTestFormData;

        const data = await apiFetch<{ testResult: { id: string } }>('/api/test-results', {
          method: 'POST',
          body: JSON.stringify({
            projectId,
            ...sanitizedFormData,
            lotId: sanitizedFormData.lotId || null,
          }),
        });

        await refreshTestResults([sanitizedFormData.lotId]);
        setShowCreateModal(false);

        // Feature #210: If test failed, prompt to raise NCR
        if (sanitizedFormData.passFail === 'fail') {
          promptNcrForFailedTest({
            testId: data.testResult.id,
            testType: sanitizedFormData.testType,
            resultValue: sanitizedFormData.resultValue,
            resultUnit: sanitizedFormData.resultUnit,
            specificationMin: sanitizedFormData.specificationMin,
            specificationMax: sanitizedFormData.specificationMax,
            lotId: sanitizedFormData.lotId || null,
          });
        }
      } finally {
        creatingTestRef.current = false;
      }
    },
    [projectId, refreshTestResults, promptNcrForFailedTest],
  );

  // NCR handlers
  const handleNcrPromptClose = useCallback(() => {
    setShowNcrPromptModal(false);
    setFailedTestForNcr(null);
  }, []);

  const handleNcrPromptRaise = useCallback(() => {
    setShowNcrPromptModal(false);
    setShowNcrModal(true);
  }, []);

  const handleCreateNcrFromTest = useCallback(
    async (ncrFormData: NcrFormData) => {
      if (!failedTestForNcr || creatingNcrRef.current) return;

      creatingNcrRef.current = true;
      try {
        const data = await apiFetch<{ ncr: { ncrNumber: string } }>('/api/ncrs', {
          method: 'POST',
          body: JSON.stringify({
            projectId,
            description: ncrFormData.description.trim(),
            category: ncrFormData.category,
            severity: ncrFormData.severity,
            specificationReference: ncrFormData.specificationReference.trim() || undefined,
            lotIds: failedTestForNcr.lotId ? [failedTestForNcr.lotId] : undefined,
            linkedTestResultId: failedTestForNcr.testId,
          }),
        });

        toast({
          title: 'NCR created',
          description: `NCR ${data.ncr.ncrNumber} was created successfully.`,
          variant: 'success',
        });
        setShowNcrModal(false);
        setShowNcrPromptModal(false);
        setFailedTestForNcr(null);
      } finally {
        creatingNcrRef.current = false;
      }
    },
    [projectId, failedTestForNcr],
  );

  const handleNcrModalClose = useCallback(() => {
    setShowNcrModal(false);
    setFailedTestForNcr(null);
  }, []);

  // Test results updated callback (shared by upload modals)
  const handleTestResultsUpdated = useCallback(
    (results: TestResult[]) => {
      setTestResults(results);
      void invalidateTestResultCaches(results.map((result) => result.lotId));
    },
    [invalidateTestResultCaches],
  );

  // Export CSV handler
  const handleExportCSV = useCallback(() => {
    downloadCsv(`test-results-${projectId}-${formatDateKey()}.csv`, [
      TEST_RESULTS_CSV_HEADERS,
      ...buildTestResultsCsvRows(testResults),
    ]);
  }, [testResults, projectId]);

  // Loading state
  if (loading) {
    return (
      <div
        className="flex h-full items-center justify-center p-6"
        role="status"
        aria-label="Loading test results"
      >
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4" role="alert">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-destructive">{error}</p>
          <button
            type="button"
            onClick={fetchData}
            className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-muted/50"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold">Test Results</h1>
          <ContextHelp title={HELP_CONTENT.tests.title} content={HELP_CONTENT.tests.content} />
        </div>
        {isMobile ? (
          /* PR-L: Mobile \u2014 one primary action + More overflow BottomSheet */
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-primary-foreground hover:bg-primary/90 min-h-[44px]"
            >
              {'📄'} Upload Certificate
            </button>
            <button
              type="button"
              onClick={() => setMoreSheetOpen(true)}
              className="rounded-lg border border-border p-2.5 hover:bg-muted/50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="More actions"
              data-testid="tests-header-more-button"
            >
              <MoreVertical className="h-5 w-5" />
            </button>
          </div>
        ) : (
          /* Desktop \u2014 all buttons visible; Upload Certificate is the primary action */
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowUploadModal(true)}
              className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
            >
              {'\uD83D\uDCC4'} Upload Certificate
            </button>
            {testResults.length > 0 && (
              <button
                onClick={handleExportCSV}
                className="rounded-lg border border-border px-4 py-2 text-foreground hover:bg-muted/50"
              >
                Export CSV
              </button>
            )}
            <button
              onClick={() => setShowBatchUploadModal(true)}
              className="rounded-lg border border-border px-4 py-2 text-foreground hover:bg-muted/50"
            >
              {'\uD83D\uDCC1'} Batch Upload
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="rounded-lg border border-border px-4 py-2 text-foreground hover:bg-muted/50"
            >
              Add Test Result
            </button>
          </div>
        )}
      </div>

      {/* PR-L: Mobile overflow sheet \u2014 secondary header actions */}
      {isMobile && (
        <BottomSheet
          isOpen={moreSheetOpen}
          onClose={() => setMoreSheetOpen(false)}
          title="More actions"
        >
          <div className="space-y-1">
            {testResults.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  handleExportCSV();
                  setMoreSheetOpen(false);
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-muted/50 active:bg-muted/70 transition-colors rounded-lg min-h-[48px]"
              >
                <span className="flex-shrink-0 text-muted-foreground">
                  <FileDown className="h-5 w-5" />
                </span>
                <span>Export CSV</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setShowCreateModal(true);
                setMoreSheetOpen(false);
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-muted/50 active:bg-muted/70 transition-colors rounded-lg min-h-[48px]"
            >
              <span className="flex-shrink-0 text-muted-foreground">
                <FlaskConical className="h-5 w-5" />
              </span>
              <span>Add Test Result</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowBatchUploadModal(true);
                setMoreSheetOpen(false);
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-muted/50 active:bg-muted/70 transition-colors rounded-lg min-h-[48px]"
            >
              <span className="flex-shrink-0 text-muted-foreground">
                <FolderOpen className="h-5 w-5" />
              </span>
              <span>Batch Upload</span>
            </button>
          </div>
        </BottomSheet>
      )}
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

      {/* Results: mobile card list on phones, virtualized table on desktop */}
      {isMobile ? (
        <TestResultsMobileList
          projectId={projectId || ''}
          filteredTestResults={testResults.length === 0 ? [] : filteredTestResults}
          hasActiveFilters={testResults.length > 0 && hasActiveFilters}
          updatingStatusId={updatingStatusId}
          onUpdateStatus={handleUpdateStatus}
          onOpenEnterResults={openEnterResultsModal}
          onRejectTest={openRejectModal}
          onAttachCertificate={handleAttachCertificate}
          onClearFilters={clearFilters}
          onOpenCreateModal={() => setShowCreateModal(true)}
          highlightedTestId={deepLinkedTestId}
        />
      ) : (
        <TestResultsTable
          projectId={projectId || ''}
          filteredTestResults={testResults.length === 0 ? [] : filteredTestResults}
          hasActiveFilters={testResults.length > 0 && hasActiveFilters}
          updatingStatusId={updatingStatusId}
          onUpdateStatus={handleUpdateStatus}
          onOpenEnterResults={openEnterResultsModal}
          onRejectTest={openRejectModal}
          onAttachCertificate={handleAttachCertificate}
          onClearFilters={clearFilters}
          onOpenCreateModal={() => setShowCreateModal(true)}
          onLinkItpItem={openLinkItpModal}
          highlightedTestId={deepLinkedTestId}
        />
      )}

      {/* Modals */}
      <CreateTestModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateTestResult}
        lots={lots}
        projectState={projectState}
      />

      <LinkItpItemModal
        isOpen={linkItpTest !== null}
        test={linkItpTest}
        onClose={() => setLinkItpTest(null)}
        onLinked={(lotId) => refreshTestResults([lotId])}
      />

      <EnterResultsModal
        isOpen={enterResultsTest !== null}
        test={enterResultsTest}
        onClose={() => setEnterResultsTest(null)}
        onSubmit={handleEnterResults}
      />

      <UploadCertificateModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        projectId={projectId || ''}
        onTestResultsUpdated={handleTestResultsUpdated}
        onFailedResult={promptNcrForFailedTest}
      />

      <BatchUploadModal
        isOpen={showBatchUploadModal}
        onClose={() => setShowBatchUploadModal(false)}
        projectId={projectId || ''}
        onTestResultsUpdated={handleTestResultsUpdated}
        onFailedResult={promptNcrForFailedTest}
      />

      <RejectTestModal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          setRejectingTestId(null);
        }}
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
  );
}
