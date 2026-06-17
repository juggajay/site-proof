import { Plus } from 'lucide-react';
import { AccessDeniedState } from '@/components/AccessDeniedState';
import { ContextHelp, HELP_CONTENT } from '@/components/ContextHelp';
import { LazyCumulativeChart, LazyMonthlyChart } from '@/components/charts/LazyCharts';
import type { Claim } from './types';
import type {
  ClaimSummaryTotals,
  CumulativeClaimChartPoint,
  MonthlyClaimBreakdownPoint,
} from './claimsPageData';
import { formatCurrency } from './utils';
import { ClaimsSummary } from './components/ClaimsSummary';
import { ClaimsTable } from './components/ClaimsTable';

interface ClaimsPageHeaderProps {
  claimCount: number;
  onExportCSV: () => void;
  onCreateClaim: () => void;
}

export function ClaimsPageHeader({
  claimCount,
  onExportCSV,
  onCreateClaim,
}: ClaimsPageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold">Progress Claims</h1>
          <ContextHelp title={HELP_CONTENT.claims.title} content={HELP_CONTENT.claims.content} />
        </div>
        <p className="text-muted-foreground mt-1">
          Progress claims and indicative payment tracking. Confirm SOPA deadlines against your
          contract.
        </p>
      </div>
      <div className="flex gap-2">
        {claimCount > 0 && (
          <button
            type="button"
            onClick={onExportCSV}
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-foreground hover:bg-muted/50"
          >
            Export CSV
          </button>
        )}
        <button
          type="button"
          onClick={onCreateClaim}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> New Claim
        </button>
      </div>
    </div>
  );
}

interface ClaimsLoadErrorAlertProps {
  loadError: string | null;
  onRetry: () => void;
}

export function ClaimsLoadErrorAlert({ loadError, onRetry }: ClaimsLoadErrorAlertProps) {
  if (!loadError) return null;

  return (
    <div
      className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
      role="alert"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-medium">{loadError}</p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md border border-destructive/40 bg-background px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export function ClaimsLoadingState() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
}

interface ClaimsAccessDeniedStateProps {
  message?: string;
}

export function ClaimsAccessDeniedState({ message }: ClaimsAccessDeniedStateProps) {
  return <AccessDeniedState message={message} />;
}

interface ClaimsMainContentProps {
  loadError: string | null;
  totals: ClaimSummaryTotals;
  cumulativeChartData: CumulativeClaimChartPoint[];
  monthlyBreakdownData: MonthlyClaimBreakdownPoint[];
  claims: Claim[];
  loadingCompleteness: boolean;
  showCompletenessModal: string | null;
  generatingEvidence: string | null;
  onExportCumulativeData: () => void;
  onExportMonthlyData: () => void;
  onCreateClaim: () => void;
  onSubmitClaim: (claimId: string) => void;
  onDisputeClaim: (claimId: string) => void;
  onCertifyClaim: (claimId: string) => void;
  onRecordPayment: (claimId: string) => void;
  onCompletenessCheck: (claimId: string) => void;
  onEvidencePackage: (claimId: string) => void;
}

export function ClaimsMainContent({
  loadError,
  totals,
  cumulativeChartData,
  monthlyBreakdownData,
  claims,
  loadingCompleteness,
  showCompletenessModal,
  generatingEvidence,
  onExportCumulativeData,
  onExportMonthlyData,
  onCreateClaim,
  onSubmitClaim,
  onDisputeClaim,
  onCertifyClaim,
  onRecordPayment,
  onCompletenessCheck,
  onEvidencePackage,
}: ClaimsMainContentProps) {
  if (loadError) return null;

  return (
    <>
      <ClaimsSummary
        totalClaimed={totals.totalClaimed}
        totalCertified={totals.totalCertified}
        totalPaid={totals.totalPaid}
        outstanding={totals.outstanding}
      />
      <LazyCumulativeChart
        data={cumulativeChartData}
        formatCurrency={formatCurrency}
        onExport={onExportCumulativeData}
      />
      <LazyMonthlyChart
        data={monthlyBreakdownData}
        formatCurrency={formatCurrency}
        onExport={onExportMonthlyData}
      />
      <ClaimsTable
        claims={claims}
        loadingCompleteness={loadingCompleteness}
        showCompletenessModal={showCompletenessModal}
        generatingEvidence={generatingEvidence}
        onCreateClaim={onCreateClaim}
        onSubmitClaim={onSubmitClaim}
        onDisputeClaim={onDisputeClaim}
        onCertifyClaim={onCertifyClaim}
        onRecordPayment={onRecordPayment}
        onCompletenessCheck={onCompletenessCheck}
        onEvidencePackage={onEvidencePackage}
      />
    </>
  );
}
