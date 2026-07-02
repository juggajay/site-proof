import { useRef, useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { flushSync } from 'react-dom';
import { useParams, useSearchParams } from 'react-router-dom';
import { apiFetch, apiUrl } from '@/lib/api';
import { Lock, Sparkles, Mail, Printer, RefreshCw } from 'lucide-react';
import { ScheduleReportModal } from '../../components/reports/ScheduleReportModal';
import { ContextHelp, HELP_CONTENT } from '@/components/ContextHelp';
import type {
  LotStatusReport,
  NCRReport,
  TestReport,
  DiaryReport,
  ClaimsReport,
  ReportPagination,
} from './types';
import { ADVANCED_ANALYTICS_TIERS } from './types';
import { useAuth } from '@/lib/auth';
import { ROLE_GROUPS, hasRoleInGroup, isAdminRole } from '@/lib/roles';
import { getProjectScopedRole } from '@/lib/subcontractorIdentity';
import { logError } from '@/lib/logger';
import { extractErrorMessage } from '@/lib/errorHandling';
import { useDateFormat } from '@/lib/dateFormat';
import { useTimezone } from '@/lib/timezone';
import { formatReportDateTime } from './reportFormatting';

// Lazy-loaded tab components
const LotStatusTab = lazy(() =>
  import('./components/LotStatusTab').then((m) => ({ default: m.LotStatusTab })),
);
const NCRReportTab = lazy(() =>
  import('./components/NCRReportTab').then((m) => ({ default: m.NCRReportTab })),
);
const TestResultsTab = lazy(() =>
  import('./components/TestResultsTab').then((m) => ({ default: m.TestResultsTab })),
);
const DiaryReportTab = lazy(() =>
  import('./components/DiaryReportTab').then((m) => ({ default: m.DiaryReportTab })),
);
const ClaimsReportTab = lazy(() =>
  import('./components/ClaimsReportTab').then((m) => ({ default: m.ClaimsReportTab })),
);
const AdvancedAnalyticsTab = lazy(() =>
  import('./components/AdvancedAnalyticsTab').then((m) => ({ default: m.AdvancedAnalyticsTab })),
);

const REPORT_DATA_TABS = ['lot-status', 'ncr', 'test', 'diary', 'claims'] as const;
const REPORT_TABS = [...REPORT_DATA_TABS, 'advanced'] as const;
type ReportDataTab = (typeof REPORT_DATA_TABS)[number];
type ReportTab = (typeof REPORT_TABS)[number];
type PaginatedReportDataTab = Exclude<ReportDataTab, 'claims'>;
type PaginatedReport = LotStatusReport | NCRReport | TestReport | DiaryReport;
type ReportQueryParams = Record<string, string>;
type ReportFilterParams = Partial<Record<ReportDataTab, ReportQueryParams>>;

const REPORT_DETAIL_PAGE_LIMIT = 500;

function isReportDataTab(tab: string): tab is ReportDataTab {
  return REPORT_DATA_TABS.includes(tab as ReportDataTab);
}

function isReportTab(tab: string): tab is ReportTab {
  return REPORT_TABS.includes(tab as ReportTab);
}

function isPaginatedReportDataTab(tab: ReportDataTab): tab is PaginatedReportDataTab {
  return tab !== 'claims';
}

function areReportQueryParamsEqual(
  left: ReportQueryParams | undefined,
  right: ReportQueryParams,
): boolean {
  const leftEntries = Object.entries(left ?? {});
  const rightEntries = Object.entries(right);
  return (
    leftEntries.length === rightEntries.length &&
    rightEntries.every(([key, value]) => left?.[key] === value)
  );
}

function buildTestReportParams(
  startDate: string,
  endDate: string,
  testTypes: string[],
): ReportQueryParams {
  const extraParams: ReportQueryParams = {};
  if (startDate) extraParams.startDate = startDate;
  if (endDate) extraParams.endDate = endDate;
  if (testTypes.length > 0) extraParams.testTypes = testTypes.join(',');
  return extraParams;
}

function buildDiaryReportParams(
  sections: string[],
  startDate: string,
  endDate: string,
): ReportQueryParams {
  const extraParams: ReportQueryParams = {};
  if (sections.length > 0) extraParams.sections = sections.join(',');
  if (startDate) extraParams.startDate = startDate;
  if (endDate) extraParams.endDate = endDate;
  return extraParams;
}

function buildClaimsReportParams(
  startDate: string,
  endDate: string,
  statuses: string[],
): ReportQueryParams {
  const extraParams: ReportQueryParams = {};
  if (startDate) extraParams.startDate = startDate;
  if (endDate) extraParams.endDate = endDate;
  if (statuses.length > 0) extraParams.status = statuses.join(',');
  return extraParams;
}

function markReportAsFullyLoaded<T extends { pagination?: ReportPagination }>(
  report: T,
  rowCount: number,
): T {
  if (!report.pagination) {
    return report;
  }

  return {
    ...report,
    pagination: {
      ...report.pagination,
      page: 1,
      limit: rowCount,
      totalPages: 1,
    },
  };
}

function mergePaginatedReportPages(
  reportType: PaginatedReportDataTab,
  firstPage: PaginatedReport,
  nextPages: PaginatedReport[],
): PaginatedReport {
  switch (reportType) {
    case 'lot-status': {
      const first = firstPage as LotStatusReport;
      const pages = nextPages as LotStatusReport[];
      const lots = [...first.lots, ...pages.flatMap((page) => page.lots)];
      return markReportAsFullyLoaded({ ...first, lots }, lots.length);
    }
    case 'ncr': {
      const first = firstPage as NCRReport;
      const pages = nextPages as NCRReport[];
      const ncrs = [...first.ncrs, ...pages.flatMap((page) => page.ncrs)];
      return markReportAsFullyLoaded({ ...first, ncrs }, ncrs.length);
    }
    case 'test': {
      const first = firstPage as TestReport;
      const pages = nextPages as TestReport[];
      const tests = [...first.tests, ...pages.flatMap((page) => page.tests)];
      return markReportAsFullyLoaded({ ...first, tests }, tests.length);
    }
    case 'diary': {
      const first = firstPage as DiaryReport;
      const pages = nextPages as DiaryReport[];
      const diaries = [...first.diaries, ...pages.flatMap((page) => page.diaries)];
      return markReportAsFullyLoaded({ ...first, diaries }, diaries.length);
    }
  }
}

async function fetchCompleteReport(
  reportType: ReportDataTab,
  endpoint: string,
  queryParams: URLSearchParams,
): Promise<unknown> {
  if (!isPaginatedReportDataTab(reportType)) {
    return apiFetch<unknown>(`/api/reports/${endpoint}?${queryParams.toString()}`);
  }

  queryParams.set('limit', String(REPORT_DETAIL_PAGE_LIMIT));
  queryParams.set('page', '1');

  const firstPage = await apiFetch<PaginatedReport>(
    `/api/reports/${endpoint}?${queryParams.toString()}`,
  );
  const totalPages = firstPage.pagination?.totalPages ?? 1;

  if (totalPages <= 1) {
    return firstPage;
  }

  const nextPages: PaginatedReport[] = [];
  for (let page = 2; page <= totalPages; page += 1) {
    const pageParams = new URLSearchParams(queryParams);
    pageParams.set('page', String(page));
    nextPages.push(await apiFetch<PaginatedReport>(`/api/reports/${endpoint}?${pageParams}`));
  }

  return mergePaginatedReportPages(reportType, firstPage, nextPages);
}

interface CompanyResponse {
  company?: {
    subscriptionTier?: string | null;
    logoUrl?: string | null;
    name?: string | null;
  } | null;
}

interface ProjectNameResponse {
  name?: string;
  project?: {
    name?: string | null;
    currentUserRole?: string | null;
  } | null;
}

export function ReportsPage() {
  const { projectId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { dateFormat } = useDateFormat();
  const { timezone } = useTimezone();
  const { user } = useAuth();
  const requestedTab = searchParams.get('tab') || 'lot-status';
  const activeTab: ReportTab = isReportTab(requestedTab) ? requestedTab : 'lot-status';
  const reportRequestRef = useRef(0);
  const inFlightReportRequestKeyRef = useRef<string | null>(null);
  const lastAutomaticReportRequestKeyRef = useRef<string | null>(null);

  const [lotReport, setLotReport] = useState<LotStatusReport | null>(null);
  const [ncrReport, setNCRReport] = useState<NCRReport | null>(null);
  const [testReport, setTestReport] = useState<TestReport | null>(null);
  const [diaryReport, setDiaryReport] = useState<DiaryReport | null>(null);
  const [claimsReport, setClaimsReport] = useState<ClaimsReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<string | null>(null);
  // Feature #702: Company logo on reports
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>('');
  const [reportFilterParams, setReportFilterParams] = useState<ReportFilterParams>({});
  const [printRequestedAt, setPrintRequestedAt] = useState(() => new Date());

  // Schedule modal state
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // Project name for print header
  const [projectName, setProjectName] = useState<string>('');
  const [currentProjectRole, setCurrentProjectRole] = useState<string | null | undefined>(
    undefined,
  );

  const setActiveTab = useCallback(
    (tab: string) => {
      lastAutomaticReportRequestKeyRef.current = null;
      setSearchParams({ tab });
    },
    [setSearchParams],
  );

  const normalizedSubscriptionTier = useMemo(
    () => (subscriptionTier ?? 'basic').trim().toLowerCase(),
    [subscriptionTier],
  );
  const subscriptionTierLabel = normalizedSubscriptionTier;
  const subscriptionTierLoaded = subscriptionTier !== null;
  const hasAdvancedAnalytics = useMemo(
    () =>
      subscriptionTier !== null && ADVANCED_ANALYTICS_TIERS.includes(normalizedSubscriptionTier),
    [normalizedSubscriptionTier, subscriptionTier],
  );
  const projectRoleResolved = !projectId || currentProjectRole !== undefined;
  const projectScopedRole = useMemo(
    () => (projectRoleResolved ? (currentProjectRole ?? getProjectScopedRole(user)) : ''),
    [currentProjectRole, projectRoleResolved, user],
  );
  const canViewClaimsReport = useMemo(
    () => projectRoleResolved && hasRoleInGroup(projectScopedRole, ROLE_GROUPS.COMMERCIAL),
    [projectRoleResolved, projectScopedRole],
  );
  const canManageCompanySettings = isAdminRole(user?.roleInCompany || user?.role || '');
  const canManageScheduledReports = canViewClaimsReport;
  const hasPrintableReport =
    (activeTab === 'lot-status' && Boolean(lotReport)) ||
    (activeTab === 'ncr' && Boolean(ncrReport)) ||
    (activeTab === 'test' && Boolean(testReport)) ||
    (activeTab === 'diary' && Boolean(diaryReport)) ||
    (activeTab === 'claims' && Boolean(claimsReport));
  const activeReportGeneratedAt =
    activeTab === 'lot-status'
      ? lotReport?.generatedAt
      : activeTab === 'ncr'
        ? ncrReport?.generatedAt
        : activeTab === 'test'
          ? testReport?.generatedAt
          : activeTab === 'diary'
            ? diaryReport?.generatedAt
            : activeTab === 'claims'
              ? claimsReport?.generatedAt
              : null;
  const printReportGeneratedAt = useMemo(
    () =>
      activeReportGeneratedAt
        ? formatReportDateTime(activeReportGeneratedAt, dateFormat, timezone)
        : null,
    [activeReportGeneratedAt, dateFormat, timezone],
  );
  const printPrintedAt = useMemo(
    () => formatReportDateTime(printRequestedAt, dateFormat, timezone),
    [dateFormat, printRequestedAt, timezone],
  );

  const refreshPrintTimestamp = useCallback(() => {
    setPrintRequestedAt(new Date());
  }, []);

  useEffect(() => {
    window.addEventListener('beforeprint', refreshPrintTimestamp);
    return () => window.removeEventListener('beforeprint', refreshPrintTimestamp);
  }, [refreshPrintTimestamp]);

  const clearReportState = useCallback((reportType?: ReportDataTab) => {
    if (!reportType || reportType === 'lot-status') {
      setLotReport(null);
    }
    if (!reportType || reportType === 'ncr') {
      setNCRReport(null);
    }
    if (!reportType || reportType === 'test') {
      setTestReport(null);
    }
    if (!reportType || reportType === 'diary') {
      setDiaryReport(null);
    }
    if (!reportType || reportType === 'claims') {
      setClaimsReport(null);
    }
  }, []);

  useEffect(() => {
    if (!isReportTab(requestedTab)) {
      setSearchParams({ tab: 'lot-status' }, { replace: true });
    }
  }, [requestedTab, setSearchParams]);

  useEffect(() => {
    reportRequestRef.current += 1;
    inFlightReportRequestKeyRef.current = null;
    lastAutomaticReportRequestKeyRef.current = null;
    clearReportState();
    setError(null);
  }, [projectId, clearReportState]);

  const tabs = useMemo(
    () =>
      [
        { id: 'lot-status', label: 'Lot Status' },
        { id: 'ncr', label: 'NCR Report' },
        { id: 'test', label: 'Test Results' },
        { id: 'diary', label: 'Diary Report' },
        canViewClaimsReport ? { id: 'claims', label: 'Claims' } : null,
        { id: 'advanced', label: 'Advanced Analytics', premium: true },
      ].filter((tab): tab is { id: string; label: string; premium?: boolean } => Boolean(tab)),
    [canViewClaimsReport],
  );

  // Fetch subscription tier for feature gating
  useEffect(() => {
    const fetchSubscriptionTier = async () => {
      try {
        const data = await apiFetch<CompanyResponse>(`/api/company`);
        setSubscriptionTier(data.company?.subscriptionTier || 'basic');
        // Feature #702: Company logo on reports
        if (data.company?.logoUrl) {
          setCompanyLogo(data.company.logoUrl);
        }
        if (data.company?.name) {
          setCompanyName(data.company.name);
        }
      } catch (err) {
        logError('Failed to fetch subscription tier:', err);
        setSubscriptionTier('basic');
      }
    };

    fetchSubscriptionTier();
  }, []);

  // Fetch project name for print header
  useEffect(() => {
    const fetchProjectName = async () => {
      setCurrentProjectRole(undefined);
      if (!projectId) {
        setCurrentProjectRole(null);
        return;
      }

      try {
        const data = await apiFetch<ProjectNameResponse>(
          `/api/projects/${encodeURIComponent(projectId)}`,
        );
        setProjectName(data.name || data.project?.name || 'Project');
        setCurrentProjectRole(data.project?.currentUserRole ?? null);
      } catch (err) {
        logError('Failed to fetch project name:', err);
        setCurrentProjectRole(null);
      }
    };

    fetchProjectName();
  }, [projectId]);

  const fetchReport = useCallback(
    async (reportType: ReportDataTab, extraParams?: ReportQueryParams) => {
      if (!projectId) {
        clearReportState();
        setError('Project not found');
        return;
      }

      if (reportType === 'claims' && !canViewClaimsReport) {
        clearReportState('claims');
        setError('Commercial report access required');
        return;
      }

      let requestId = 0;
      let requestKey: string | null = null;

      try {
        let endpoint = '';
        const queryParams = new URLSearchParams();
        queryParams.set('projectId', projectId);

        switch (reportType) {
          case 'lot-status':
            endpoint = 'lot-status';
            break;
          case 'ncr':
            endpoint = 'ncr';
            break;
          case 'test':
            endpoint = 'test';
            if (extraParams?.startDate) queryParams.set('startDate', extraParams.startDate);
            if (extraParams?.endDate) queryParams.set('endDate', extraParams.endDate);
            if (extraParams?.testTypes) queryParams.set('testTypes', extraParams.testTypes);
            break;
          case 'diary':
            endpoint = 'diary';
            if (extraParams?.sections) queryParams.set('sections', extraParams.sections);
            if (extraParams?.startDate) queryParams.set('startDate', extraParams.startDate);
            if (extraParams?.endDate) queryParams.set('endDate', extraParams.endDate);
            break;
          case 'claims':
            endpoint = 'claims';
            if (extraParams?.startDate) queryParams.set('startDate', extraParams.startDate);
            if (extraParams?.endDate) queryParams.set('endDate', extraParams.endDate);
            if (extraParams?.status) queryParams.set('status', extraParams.status);
            break;
        }

        if (isPaginatedReportDataTab(reportType)) {
          queryParams.set('limit', String(REPORT_DETAIL_PAGE_LIMIT));
          queryParams.set('page', '1');
        }

        requestKey = `${endpoint}?${queryParams.toString()}`;
        if (inFlightReportRequestKeyRef.current === requestKey) {
          return;
        }

        requestId = reportRequestRef.current + 1;
        reportRequestRef.current = requestId;
        inFlightReportRequestKeyRef.current = requestKey;
        clearReportState(reportType);
        setLoading(true);
        setError(null);

        const data = await fetchCompleteReport(reportType, endpoint, queryParams);
        if (requestId !== reportRequestRef.current) return;

        switch (reportType) {
          case 'lot-status':
            setLotReport(data as LotStatusReport);
            break;
          case 'ncr':
            setNCRReport(data as NCRReport);
            break;
          case 'test':
            setTestReport(data as TestReport);
            break;
          case 'diary':
            setDiaryReport(data as DiaryReport);
            break;
          case 'claims':
            setClaimsReport(data as ClaimsReport);
            break;
        }
      } catch (err) {
        if (requestId !== reportRequestRef.current) return;
        logError('Error fetching report:', err);
        setError(extractErrorMessage(err, 'Failed to load report data. Please try again.'));
      } finally {
        if (requestKey && inFlightReportRequestKeyRef.current === requestKey) {
          inFlightReportRequestKeyRef.current = null;
        }
        if (requestId === reportRequestRef.current) {
          setLoading(false);
        }
      }
    },
    [projectId, canViewClaimsReport, clearReportState],
  );

  const handleReportFilterParamsChange = useCallback(
    (reportType: ReportDataTab, extraParams: ReportQueryParams) => {
      setReportFilterParams((prev) => {
        if (areReportQueryParamsEqual(prev[reportType], extraParams)) {
          return prev;
        }

        return { ...prev, [reportType]: extraParams };
      });
    },
    [],
  );

  useEffect(() => {
    if (!projectRoleResolved) {
      return;
    }

    if (activeTab === 'claims' && projectRoleResolved && !canViewClaimsReport) {
      setActiveTab('lot-status');
      return;
    }

    if (projectId && isReportDataTab(activeTab)) {
      const automaticRequestKey = `${projectId}:${activeTab}`;
      if (lastAutomaticReportRequestKeyRef.current === automaticRequestKey) {
        return;
      }
      lastAutomaticReportRequestKeyRef.current = automaticRequestKey;
      fetchReport(activeTab);
    }
  }, [projectId, activeTab, fetchReport, projectRoleResolved, canViewClaimsReport, setActiveTab]);

  const handleRefreshReport = useCallback(() => {
    lastAutomaticReportRequestKeyRef.current = null;
    if (isReportDataTab(activeTab)) {
      fetchReport(activeTab, reportFilterParams[activeTab]);
    } else if (!projectId) {
      setError('Project not found');
    }
  }, [fetchReport, activeTab, projectId, reportFilterParams]);

  const handleOpenScheduleModal = useCallback(() => {
    if (!canManageScheduledReports) {
      return;
    }

    if (!subscriptionTierLoaded) {
      return;
    }

    if (!hasAdvancedAnalytics) {
      setActiveTab('advanced');
      return;
    }

    setShowScheduleModal(true);
  }, [canManageScheduledReports, hasAdvancedAnalytics, setActiveTab, subscriptionTierLoaded]);

  const handlePrintReport = useCallback(() => {
    flushSync(() => {
      setPrintRequestedAt(new Date());
    });
    window.print();
  }, []);

  const handleCloseScheduleModal = useCallback(() => {
    setShowScheduleModal(false);
  }, []);

  // Callback for TestResultsTab to refresh with filters
  const handleTestReportRefresh = useCallback(
    (startDate: string, endDate: string, testTypes: string[]) => {
      const extraParams = buildTestReportParams(startDate, endDate, testTypes);
      handleReportFilterParamsChange('test', extraParams);
      fetchReport('test', extraParams);
    },
    [fetchReport, handleReportFilterParamsChange],
  );

  const handleTestReportFiltersChange = useCallback(
    (startDate: string, endDate: string, testTypes: string[]) => {
      handleReportFilterParamsChange('test', buildTestReportParams(startDate, endDate, testTypes));
    },
    [handleReportFilterParamsChange],
  );

  // Callback for DiaryReportTab to generate report with options
  const handleDiaryReportGenerate = useCallback(
    (sections: string[], startDate: string, endDate: string) => {
      const extraParams = buildDiaryReportParams(sections, startDate, endDate);
      handleReportFilterParamsChange('diary', extraParams);
      fetchReport('diary', extraParams);
    },
    [fetchReport, handleReportFilterParamsChange],
  );

  const handleDiaryReportFiltersChange = useCallback(
    (sections: string[], startDate: string, endDate: string) => {
      handleReportFilterParamsChange('diary', buildDiaryReportParams(sections, startDate, endDate));
    },
    [handleReportFilterParamsChange],
  );

  const handleClaimsReportGenerate = useCallback(
    (startDate: string, endDate: string, statuses: string[]) => {
      const extraParams = buildClaimsReportParams(startDate, endDate, statuses);
      handleReportFilterParamsChange('claims', extraParams);
      fetchReport('claims', extraParams);
    },
    [fetchReport, handleReportFilterParamsChange],
  );

  const handleClaimsReportFiltersChange = useCallback(
    (startDate: string, endDate: string, statuses: string[]) => {
      handleReportFilterParamsChange(
        'claims',
        buildClaimsReportParams(startDate, endDate, statuses),
      );
    },
    [handleReportFilterParamsChange],
  );

  const actionContainerClassName = canManageScheduledReports
    ? hasPrintableReport
      ? 'grid grid-cols-3 gap-2 sm:flex sm:gap-3'
      : 'grid grid-cols-2 gap-2 sm:flex sm:gap-3'
    : 'flex gap-2 sm:gap-3';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h1 className="whitespace-nowrap text-2xl font-bold leading-tight sm:text-3xl">
            Reports & Analytics
          </h1>
          <ContextHelp title={HELP_CONTENT.reports.title} content={HELP_CONTENT.reports.content} />
        </div>
        <div className={actionContainerClassName}>
          {canManageScheduledReports && (
            <button
              type="button"
              aria-label="Schedule Reports"
              disabled={!subscriptionTierLoaded}
              onClick={handleOpenScheduleModal}
              className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium sm:px-4 ${
                hasAdvancedAnalytics
                  ? 'border-primary text-primary hover:bg-primary/5'
                  : 'border-brand text-brand hover:bg-brand/10'
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {hasAdvancedAnalytics ? <Mail className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              <span className="hidden sm:inline">Schedule Reports</span>
              <span className="sm:hidden">Schedule</span>
            </button>
          )}
          {hasPrintableReport && (
            <button
              type="button"
              aria-label="Print / Save PDF"
              onClick={handlePrintReport}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border px-2 py-2 text-sm font-medium hover:bg-muted/50 sm:px-4"
            >
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">Print / Save PDF</span>
              <span className="sm:hidden">Print</span>
            </button>
          )}
          <button
            type="button"
            aria-label="Refresh Report"
            onClick={handleRefreshReport}
            disabled={loading || !isReportDataTab(activeTab)}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 sm:px-4"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{loading ? 'Refreshing...' : 'Refresh Report'}</span>
            <span className="sm:hidden">{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="overflow-x-auto border-b border-border">
        <nav
          className="-mb-px flex min-w-max space-x-6 sm:space-x-8"
          aria-label="Reports"
          role="tablist"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`reports-panel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              } ${tab.premium && !hasAdvancedAnalytics ? 'text-brand hover:text-brand' : ''}`}
            >
              {tab.label}
              {tab.premium && !hasAdvancedAnalytics && <Lock className="h-3.5 w-3.5" />}
              {tab.premium && hasAdvancedAnalytics && (
                <Sparkles className="h-3.5 w-3.5 text-brand" />
              )}
            </button>
          ))}
        </nav>
      </div>

      {error && (
        <div
          className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md"
          role="alert"
        >
          {error}
        </div>
      )}

      {loading && (
        <div
          className="flex items-center justify-center rounded-md border border-border bg-muted/40 py-3"
          role="status"
          aria-live="polite"
        >
          <div className="text-sm text-muted-foreground">Loading report data...</div>
        </div>
      )}

      <>
        {/* Print-only Header - Hidden on screen, shown when printing */}
        <div className="hidden print:block report-header mb-6">
          <div className="flex items-center justify-between border-b-2 border-foreground pb-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {activeTab === 'lot-status' && 'Lot Status Report'}
                {activeTab === 'ncr' && 'NCR Report'}
                {activeTab === 'test' && 'Test Results Report'}
                {activeTab === 'diary' && 'Daily Diary Report'}
                {activeTab === 'claims' && 'Claims Report'}
                {activeTab === 'advanced' && 'Advanced Analytics Report'}
              </h1>
              <p className="text-lg text-foreground mt-1">{projectName}</p>
            </div>
            {/* Feature #702: Company logo on reports */}
            <div className="text-right flex items-center gap-3">
              {companyLogo ? (
                <img
                  src={companyLogo.startsWith('http') ? companyLogo : apiUrl(companyLogo)}
                  alt={companyName || 'Company Logo'}
                  referrerPolicy="no-referrer"
                  className="h-12 w-auto object-contain"
                />
              ) : null}
              <div>
                <div className="text-xl font-semibold text-primary">{companyName || 'CIVOS'}</div>
                <div className="text-sm text-muted-foreground">Quality Management System</div>
              </div>
            </div>
          </div>
          <div className="flex justify-between text-sm text-muted-foreground mt-3">
            <span>
              Report data:{' '}
              {printReportGeneratedAt ?? (hasPrintableReport ? 'Not available' : 'Not loaded')}
            </span>
            <span>Printed: {printPrintedAt}</span>
            <span>Report ID: {projectId?.slice(0, 8)}</span>
          </div>
        </div>

        {/* Tab Content */}
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">Loading tab...</div>
            </div>
          }
        >
          <div id={`reports-panel-${activeTab}`} role="tabpanel">
            {activeTab === 'lot-status' && lotReport && <LotStatusTab report={lotReport} />}

            {activeTab === 'ncr' && ncrReport && <NCRReportTab report={ncrReport} />}

            {activeTab === 'test' && (
              <TestResultsTab
                report={testReport}
                loading={loading}
                onRefresh={handleTestReportRefresh}
                onFiltersChange={handleTestReportFiltersChange}
              />
            )}

            {activeTab === 'diary' && (
              <DiaryReportTab
                report={diaryReport}
                loading={loading}
                onGenerateReport={handleDiaryReportGenerate}
                onFiltersChange={handleDiaryReportFiltersChange}
              />
            )}

            {activeTab === 'claims' && canViewClaimsReport && (
              <ClaimsReportTab
                report={claimsReport}
                loading={loading}
                onGenerateReport={handleClaimsReportGenerate}
                onFiltersChange={handleClaimsReportFiltersChange}
              />
            )}

            {activeTab === 'advanced' && (
              <AdvancedAnalyticsTab
                hasAdvancedAnalytics={hasAdvancedAnalytics}
                subscriptionTier={subscriptionTierLabel}
                canManageCompanySettings={canManageCompanySettings}
              />
            )}
          </div>
        </Suspense>

        {/* Print-only Footer - Hidden on screen, shown when printing */}
        <div className="hidden print:block mt-8 pt-4 border-t border-border text-center">
          <p className="text-sm text-muted-foreground">
            This report was generated by CIVOS Quality Management System.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {new Date().getFullYear()} CIVOS. Confidential - For internal use only.
          </p>
        </div>
      </>

      {/* Schedule Report Modal */}
      {showScheduleModal && projectId && (
        <ScheduleReportModal projectId={projectId} onClose={handleCloseScheduleModal} />
      )}
    </div>
  );
}
