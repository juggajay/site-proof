import { useRef, useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { apiFetch, apiUrl } from '@/lib/api';
import { Lock, Sparkles, Mail, RefreshCw } from 'lucide-react';
import { ScheduleReportModal } from '../../components/reports/ScheduleReportModal';
import { ContextHelp, HELP_CONTENT } from '@/components/ContextHelp';
import type { LotStatusReport, NCRReport, TestReport, DiaryReport, ClaimsReport } from './types';
import { ADVANCED_ANALYTICS_TIERS } from './types';
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
type ReportDataTab = (typeof REPORT_DATA_TABS)[number];

function isReportDataTab(tab: string): tab is ReportDataTab {
  return REPORT_DATA_TABS.includes(tab as ReportDataTab);
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
  } | null;
}

export function ReportsPage() {
  const { projectId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { dateFormat } = useDateFormat();
  const { timezone } = useTimezone();
  const activeTab = searchParams.get('tab') || 'lot-status';
  const reportRequestRef = useRef(0);

  const [lotReport, setLotReport] = useState<LotStatusReport | null>(null);
  const [ncrReport, setNCRReport] = useState<NCRReport | null>(null);
  const [testReport, setTestReport] = useState<TestReport | null>(null);
  const [diaryReport, setDiaryReport] = useState<DiaryReport | null>(null);
  const [claimsReport, setClaimsReport] = useState<ClaimsReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<string>('basic');
  // Feature #702: Company logo on reports
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>('');

  // Schedule modal state
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // Project name for print header
  const [projectName, setProjectName] = useState<string>('');

  const setActiveTab = useCallback(
    (tab: string) => {
      setSearchParams({ tab });
    },
    [setSearchParams],
  );

  const hasAdvancedAnalytics = useMemo(
    () => ADVANCED_ANALYTICS_TIERS.includes(subscriptionTier),
    [subscriptionTier],
  );
  const printGeneratedAt = useMemo(
    () => formatReportDateTime(new Date(), dateFormat, timezone),
    [dateFormat, timezone],
  );

  const tabs = useMemo(
    () => [
      { id: 'lot-status', label: 'Lot Status' },
      { id: 'ncr', label: 'NCR Report' },
      { id: 'test', label: 'Test Results' },
      { id: 'diary', label: 'Diary Report' },
      { id: 'claims', label: 'Claims' },
      { id: 'advanced', label: 'Advanced Analytics', premium: true },
    ],
    [],
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
      }
    };

    fetchSubscriptionTier();
  }, []);

  // Fetch project name for print header
  useEffect(() => {
    const fetchProjectName = async () => {
      if (!projectId) return;

      try {
        const data = await apiFetch<ProjectNameResponse>(
          `/api/projects/${encodeURIComponent(projectId)}`,
        );
        setProjectName(data.name || data.project?.name || 'Project');
      } catch (err) {
        logError('Failed to fetch project name:', err);
      }
    };

    fetchProjectName();
  }, [projectId]);

  const fetchReport = useCallback(
    async (reportType: ReportDataTab, extraParams?: Record<string, string>) => {
      if (!projectId) {
        setError('Project not found');
        return;
      }

      const requestId = reportRequestRef.current + 1;
      reportRequestRef.current = requestId;
      setLoading(true);
      setError(null);

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
            break;
        }

        const data = await apiFetch<unknown>(`/api/reports/${endpoint}?${queryParams.toString()}`);
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
        if (requestId === reportRequestRef.current) {
          setLoading(false);
        }
      }
    },
    [projectId],
  );

  useEffect(() => {
    if (projectId && isReportDataTab(activeTab)) {
      fetchReport(activeTab);
    }
  }, [projectId, activeTab, fetchReport]);

  const handleRefreshReport = useCallback(() => {
    if (isReportDataTab(activeTab)) {
      fetchReport(activeTab);
    } else if (!projectId) {
      setError('Project not found');
    }
  }, [fetchReport, activeTab, projectId]);

  const handleOpenScheduleModal = useCallback(() => {
    if (!hasAdvancedAnalytics) {
      setActiveTab('advanced');
      return;
    }

    setShowScheduleModal(true);
  }, [hasAdvancedAnalytics, setActiveTab]);

  const handleCloseScheduleModal = useCallback(() => {
    setShowScheduleModal(false);
  }, []);

  // Callback for TestResultsTab to refresh with filters
  const handleTestReportRefresh = useCallback(
    (startDate: string, endDate: string, testTypes: string[]) => {
      const extraParams: Record<string, string> = {};
      if (startDate) extraParams.startDate = startDate;
      if (endDate) extraParams.endDate = endDate;
      if (testTypes.length > 0) extraParams.testTypes = testTypes.join(',');
      fetchReport('test', extraParams);
    },
    [fetchReport],
  );

  // Callback for DiaryReportTab to generate report with options
  const handleDiaryReportGenerate = useCallback(
    (sections: string[], startDate: string, endDate: string) => {
      const extraParams: Record<string, string> = {};
      if (sections.length > 0) extraParams.sections = sections.join(',');
      if (startDate) extraParams.startDate = startDate;
      if (endDate) extraParams.endDate = endDate;
      fetchReport('diary', extraParams);
    },
    [fetchReport],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h1 className="whitespace-nowrap text-2xl font-bold leading-tight sm:text-3xl">
            Reports & Analytics
          </h1>
          <ContextHelp title={HELP_CONTENT.reports.title} content={HELP_CONTENT.reports.content} />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
          <button
            type="button"
            aria-label="Schedule Reports"
            onClick={handleOpenScheduleModal}
            className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium sm:px-4 ${
              hasAdvancedAnalytics
                ? 'border-primary text-primary hover:bg-primary/5'
                : 'border-brand text-brand hover:bg-brand/10'
            }`}
          >
            {hasAdvancedAnalytics ? <Mail className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            <span className="hidden sm:inline">Schedule Reports</span>
            <span className="sm:hidden">Schedule</span>
          </button>
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
      <div className="border-b border-border">
        <nav className="-mb-px flex space-x-8" aria-label="Reports" role="tablist">
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

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading report data...</div>
        </div>
      ) : (
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
                    className="h-12 w-auto object-contain"
                  />
                ) : null}
                <div>
                  <div className="text-xl font-semibold text-primary">
                    {companyName || 'SiteProof'}
                  </div>
                  <div className="text-sm text-muted-foreground">Quality Management System</div>
                </div>
              </div>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground mt-3">
              <span>Generated: {printGeneratedAt}</span>
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
                />
              )}

              {activeTab === 'diary' && (
                <DiaryReportTab
                  report={diaryReport}
                  loading={loading}
                  onGenerateReport={handleDiaryReportGenerate}
                />
              )}

              {activeTab === 'claims' && claimsReport && <ClaimsReportTab report={claimsReport} />}

              {activeTab === 'advanced' && (
                <AdvancedAnalyticsTab
                  hasAdvancedAnalytics={hasAdvancedAnalytics}
                  subscriptionTier={subscriptionTier}
                />
              )}
            </div>
          </Suspense>

          {/* Print-only Footer - Hidden on screen, shown when printing */}
          <div className="hidden print:block mt-8 pt-4 border-t border-border text-center">
            <p className="text-sm text-muted-foreground">
              This report was generated by SiteProof Quality Management System.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {new Date().getFullYear()} SiteProof. Confidential - For internal use only.
            </p>
          </div>
        </>
      )}

      {/* Schedule Report Modal */}
      {showScheduleModal && projectId && (
        <ScheduleReportModal projectId={projectId} onClose={handleCloseScheduleModal} />
      )}
    </div>
  );
}
