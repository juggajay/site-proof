import { useParams } from 'react-router-dom';
import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { Plus } from 'lucide-react';
import { LazyCumulativeChart, LazyMonthlyChart } from '@/components/charts/LazyCharts';
import { downloadCsv } from '@/lib/csv';
import { toast } from '@/components/ui/toaster';
import { extractErrorMessage } from '@/lib/errorHandling';
import type { ClaimEvidencePackageData, ClaimPackageOptions } from '@/lib/pdfGenerator';

import type {
  Claim,
  ClaimCertificationFormData,
  ClaimPaymentFormData,
  CompletenessData,
  SubmitMethod,
} from './types';
import { formatCurrency, calculatePaymentDueDate, exportChartDataToCSV } from './utils';

import { ClaimsSummary } from './components/ClaimsSummary';
import { ClaimsTable } from './components/ClaimsTable';
import { CreateClaimModal } from './components/CreateClaimModal';
import { SubmitClaimModal } from './components/SubmitClaimModal';
import { DisputeModal } from './components/DisputeModal';
import { RecordCertificationModal } from './components/RecordCertificationModal';
import { RecordPaymentModal } from './components/RecordPaymentModal';
import { CompletenessCheckModal } from './components/CompletenessCheckModal';
import { EvidencePackageModal } from './components/EvidencePackageModal';
import { logError } from '@/lib/logger';
import { CLAIM_DISPUTE_NOTES_MAX_LENGTH } from './constants';

export function ClaimsPage() {
  const { projectId } = useParams();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modal visibility state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState<string | null>(null);
  const [showDisputeModal, setShowDisputeModal] = useState<string | null>(null);
  const [showCertificationModal, setShowCertificationModal] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState<string | null>(null);
  const [showPackageModal, setShowPackageModal] = useState<string | null>(null);
  const [showCompletenessModal, setShowCompletenessModal] = useState<string | null>(null);

  // Async operation state
  const [generatingEvidence, setGeneratingEvidence] = useState<string | null>(null);
  const [loadingCompleteness, setLoadingCompleteness] = useState(false);
  const [completenessData, setCompletenessData] = useState<CompletenessData | null>(null);
  const submittingClaimsRef = useRef(new Set<string>());
  const disputingClaimsRef = useRef(new Set<string>());
  const certifyingClaimsRef = useRef(new Set<string>());
  const recordingPaymentsRef = useRef(new Set<string>());
  const completenessRef = useRef<string | null>(null);
  const evidenceRef = useRef<string | null>(null);

  const fetchClaims = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      setLoadError('Project not found');
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const data = await apiFetch<{ claims?: Claim[] }>(
        `/api/projects/${encodeURIComponent(projectId)}/claims`,
      );
      setClaims(data.claims || []);
    } catch (error) {
      logError('Error fetching claims:', error);
      setClaims([]);
      setLoadError(extractErrorMessage(error, 'Could not load progress claims. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  // --- Summary computations ---
  const totalClaimed = useMemo(
    () => claims.reduce((sum, c) => sum + c.totalClaimedAmount, 0),
    [claims],
  );
  const totalCertified = useMemo(
    () => claims.reduce((sum, c) => sum + (c.certifiedAmount || 0), 0),
    [claims],
  );
  const totalPaid = useMemo(
    () => claims.reduce((sum, c) => sum + (c.paidAmount || 0), 0),
    [claims],
  );
  const outstanding = useMemo(() => totalCertified - totalPaid, [totalCertified, totalPaid]);

  // --- Chart data ---
  const cumulativeChartData = useMemo(() => {
    if (claims.length === 0) return [];
    const sorted = [...claims].sort(
      (a, b) => new Date(a.periodEnd).getTime() - new Date(b.periodEnd).getTime(),
    );
    let cumClaimed = 0,
      cumCertified = 0,
      cumPaid = 0;
    return sorted.map((c) => {
      cumClaimed += c.totalClaimedAmount;
      cumCertified += c.certifiedAmount || 0;
      cumPaid += c.paidAmount || 0;
      return {
        name: new Date(c.periodEnd).toLocaleDateString('en-AU', {
          month: 'short',
          year: '2-digit',
        }),
        claimNumber: c.claimNumber,
        claimed: cumClaimed,
        certified: cumCertified,
        paid: cumPaid,
        claimAmount: c.totalClaimedAmount,
        certifiedAmount: c.certifiedAmount,
        paidAmount: c.paidAmount,
      };
    });
  }, [claims]);

  const monthlyBreakdownData = useMemo(() => {
    if (claims.length === 0) return [];
    return [...claims]
      .sort((a, b) => new Date(a.periodEnd).getTime() - new Date(b.periodEnd).getTime())
      .map((c) => ({
        name: new Date(c.periodEnd).toLocaleDateString('en-AU', {
          month: 'short',
          year: '2-digit',
        }),
        claimNumber: c.claimNumber,
        claimed: c.totalClaimedAmount,
        certified: c.certifiedAmount || 0,
        paid: c.paidAmount || 0,
        status: c.status,
      }));
  }, [claims]);

  // --- Handlers ---
  const handleExportCSV = useCallback(() => {
    const headers = [
      'Claim #',
      'Period Start',
      'Period End',
      'Status',
      'Lots',
      'Claimed Amount',
      'Certified Amount',
      'Paid Amount',
      'Submitted At',
      'Payment Due Date',
    ];
    const rows = claims.map((c) => [
      `Claim ${c.claimNumber}`,
      new Date(c.periodStart).toLocaleDateString(),
      new Date(c.periodEnd).toLocaleDateString(),
      c.status,
      c.lotCount,
      c.totalClaimedAmount,
      c.certifiedAmount ?? '-',
      c.paidAmount ?? '-',
      c.submittedAt ? new Date(c.submittedAt).toLocaleDateString() : '-',
      c.paymentDueDate
        ? new Date(c.paymentDueDate).toLocaleDateString()
        : c.submittedAt
          ? new Date(calculatePaymentDueDate(c.submittedAt)).toLocaleDateString()
          : '-',
    ]);
    downloadCsv(`progress-claims-${projectId}-${new Date().toISOString().split('T')[0]}.csv`, [
      headers,
      ...rows,
    ]);
  }, [claims, projectId]);

  const handleExportCumulativeData = useCallback(() => {
    exportChartDataToCSV(
      cumulativeChartData.map((i) => ({
        name: i.name,
        claimed: i.claimed,
        certified: i.certified,
        paid: i.paid,
      })),
      'cumulative-claims',
      ['Name', 'Claimed', 'Certified', 'Paid'],
    );
  }, [cumulativeChartData]);

  const handleExportMonthlyData = useCallback(() => {
    exportChartDataToCSV(
      monthlyBreakdownData.map((i) => ({
        name: i.name,
        claimed: i.claimed,
        certified: i.certified,
        paid: i.paid,
      })),
      'monthly-claims-breakdown',
      ['Name', 'Claimed', 'Certified', 'Paid'],
    );
  }, [monthlyBreakdownData]);

  const handleClaimCreated = useCallback(() => {
    fetchClaims();
  }, [fetchClaims]);

  const handleSubmitClaim = useCallback(
    async (claimId: string, _method: SubmitMethod) => {
      const claim = claims.find((c) => c.id === claimId);
      if (!claim || !projectId || submittingClaimsRef.current.has(claimId)) return;

      submittingClaimsRef.current.add(claimId);
      try {
        await apiFetch(
          `/api/projects/${encodeURIComponent(projectId)}/claims/${encodeURIComponent(claimId)}`,
          {
            method: 'PUT',
            body: JSON.stringify({ status: 'submitted' }),
          },
        );
        const submittedAt = new Date().toISOString();
        setClaims((prev) =>
          prev.map((c) =>
            c.id === claimId ? { ...c, status: 'submitted' as const, submittedAt } : c,
          ),
        );

        downloadCsv(`claim-${claim.claimNumber}.csv`, [
          ['Claim Number', claim.claimNumber],
          ['Period', `${claim.periodStart} to ${claim.periodEnd}`],
          ['Total Amount', `$${claim.totalClaimedAmount.toLocaleString()}`],
          ['Lots', claim.lotCount],
          ['Status', 'Submitted'],
        ]);
        toast({
          title: 'Claim submitted',
          description: `Claim ${claim.claimNumber} was downloaded and marked as submitted.`,
          variant: 'success',
        });
        setShowSubmitModal(null);
      } catch (error) {
        logError('Error submitting claim:', error);
        toast({
          title: 'Submission failed',
          description: extractErrorMessage(
            error,
            'Failed to mark claim as submitted. Please try again.',
          ),
          variant: 'error',
        });
      } finally {
        submittingClaimsRef.current.delete(claimId);
      }
    },
    [claims, projectId],
  );

  const handleDisputeClaim = useCallback(
    async (claimId: string, notes: string) => {
      if (!projectId || disputingClaimsRef.current.has(claimId)) return;

      const disputeNotes = notes.trim();
      if (disputeNotes.length > CLAIM_DISPUTE_NOTES_MAX_LENGTH) {
        toast({
          title: 'Dispute notes too long',
          description: `Use ${CLAIM_DISPUTE_NOTES_MAX_LENGTH.toLocaleString()} characters or less.`,
          variant: 'error',
        });
        return;
      }

      disputingClaimsRef.current.add(claimId);
      try {
        await apiFetch(
          `/api/projects/${encodeURIComponent(projectId)}/claims/${encodeURIComponent(claimId)}`,
          { method: 'PUT', body: JSON.stringify({ status: 'disputed', disputeNotes }) },
        );
        setClaims((prev) =>
          prev.map((c) =>
            c.id === claimId
              ? {
                  ...c,
                  status: 'disputed' as const,
                  disputeNotes,
                  disputedAt: new Date().toISOString().split('T')[0],
                }
              : c,
          ),
        );
        toast({
          title: 'Claim disputed',
          description: 'The claim has been marked as disputed.',
          variant: 'success',
        });
        setShowDisputeModal(null);
      } catch (error) {
        logError('Error disputing claim:', error);
        toast({
          title: 'Dispute failed',
          description: extractErrorMessage(
            error,
            'Failed to mark claim as disputed. Please try again.',
          ),
          variant: 'error',
        });
      } finally {
        disputingClaimsRef.current.delete(claimId);
      }
    },
    [projectId],
  );

  const handleCertifyClaim = useCallback(
    async (claimId: string, certification: ClaimCertificationFormData) => {
      if (!projectId || certifyingClaimsRef.current.has(claimId)) return;

      certifyingClaimsRef.current.add(claimId);
      try {
        const data = await apiFetch<{ claim: Partial<Claim>; message?: string }>(
          `/api/projects/${encodeURIComponent(projectId)}/claims/${encodeURIComponent(claimId)}/certify`,
          {
            method: 'POST',
            body: JSON.stringify(certification),
          },
        );

        setClaims((prev) =>
          prev.map((c) =>
            c.id === claimId
              ? {
                  ...c,
                  ...data.claim,
                  status: 'certified',
                }
              : c,
          ),
        );
        toast({
          title: 'Claim certified',
          description: data.message || 'The claim has been certified.',
          variant: 'success',
        });
        setShowCertificationModal(null);
      } catch (error) {
        logError('Error certifying claim:', error);
        toast({
          title: 'Certification failed',
          description: extractErrorMessage(error, 'Failed to certify claim. Please try again.'),
          variant: 'error',
        });
      } finally {
        certifyingClaimsRef.current.delete(claimId);
      }
    },
    [projectId],
  );

  const handleRecordPayment = useCallback(
    async (claimId: string, payment: ClaimPaymentFormData) => {
      if (!projectId || recordingPaymentsRef.current.has(claimId)) return;

      recordingPaymentsRef.current.add(claimId);
      try {
        const data = await apiFetch<{ claim: Claim; message?: string }>(
          `/api/projects/${encodeURIComponent(projectId)}/claims/${encodeURIComponent(claimId)}/payment`,
          {
            method: 'POST',
            body: JSON.stringify(payment),
          },
        );

        setClaims((prev) => prev.map((c) => (c.id === claimId ? { ...c, ...data.claim } : c)));
        toast({
          title: 'Payment recorded',
          description: data.message || 'The payment has been recorded against this claim.',
          variant: 'success',
        });
        setShowPaymentModal(null);
      } catch (error) {
        logError('Error recording claim payment:', error);
        toast({
          title: 'Payment failed',
          description: extractErrorMessage(error, 'Failed to record payment. Please try again.'),
          variant: 'error',
        });
      } finally {
        recordingPaymentsRef.current.delete(claimId);
      }
    },
    [projectId],
  );

  const handleCompletenessCheck = useCallback(
    async (claimId: string) => {
      if (!projectId || completenessRef.current === claimId) return;

      completenessRef.current = claimId;
      setShowCompletenessModal(claimId);
      setLoadingCompleteness(true);
      setCompletenessData(null);
      try {
        const data = await apiFetch<CompletenessData>(
          `/api/projects/${encodeURIComponent(projectId)}/claims/${encodeURIComponent(claimId)}/completeness-check`,
        );
        setCompletenessData(data);
      } catch (error) {
        logError('Error running completeness check:', error);
        toast({
          title: 'Completeness check failed',
          description: extractErrorMessage(
            error,
            'Failed to run completeness check. Please try again.',
          ),
          variant: 'error',
        });
        setShowCompletenessModal(null);
      } finally {
        completenessRef.current = null;
        setLoadingCompleteness(false);
      }
    },
    [projectId],
  );

  const handleGenerateEvidencePackage = useCallback(
    async (claimId: string, options: ClaimPackageOptions) => {
      if (!projectId || evidenceRef.current === claimId) return;

      evidenceRef.current = claimId;
      setShowPackageModal(null);
      setGeneratingEvidence(claimId);
      const startTime = Date.now();
      try {
        const data = await apiFetch<ClaimEvidencePackageData>(
          `/api/projects/${encodeURIComponent(projectId)}/claims/${encodeURIComponent(claimId)}/evidence-package`,
        );
        const { generateClaimEvidencePackagePDF } = await import('@/lib/pdfGenerator');
        await generateClaimEvidencePackagePDF(data, options);
        const totalTime = Date.now() - startTime;
        toast({
          title: 'Evidence package generated',
          description: `Generated in ${(totalTime / 1000).toFixed(1)} seconds for ${data.summary.totalLots} lots.`,
          variant: 'success',
        });
      } catch (error) {
        logError('Error generating evidence package', error);
        toast({
          title: 'Evidence package failed',
          description: extractErrorMessage(
            error,
            'Failed to generate evidence package. Please try again.',
          ),
          variant: 'error',
        });
      } finally {
        evidenceRef.current = null;
        setGeneratingEvidence(null);
      }
    },
    [projectId],
  );

  // --- Find claim for submit modal ---
  const submitClaim = useMemo(
    () => (showSubmitModal ? claims.find((c) => c.id === showSubmitModal) : null),
    [showSubmitModal, claims],
  );
  const paymentClaim = useMemo(
    () => (showPaymentModal ? claims.find((c) => c.id === showPaymentModal) : null),
    [showPaymentModal, claims],
  );
  const certificationClaim = useMemo(
    () => (showCertificationModal ? claims.find((c) => c.id === showCertificationModal) : null),
    [showCertificationModal, claims],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Progress Claims</h1>
          <p className="text-muted-foreground mt-1">
            SOPA-compliant progress claims and payment tracking
          </p>
        </div>
        <div className="flex gap-2">
          {claims.length > 0 && (
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-foreground hover:bg-muted/50"
            >
              Export CSV
            </button>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> New Claim
          </button>
        </div>
      </div>
      {loadError && (
        <div
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          role="alert"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-medium">{loadError}</p>
            <button
              type="button"
              onClick={() => void fetchClaims()}
              className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {!loadError && (
        <>
          <ClaimsSummary
            totalClaimed={totalClaimed}
            totalCertified={totalCertified}
            totalPaid={totalPaid}
            outstanding={outstanding}
          />
          <LazyCumulativeChart
            data={cumulativeChartData}
            formatCurrency={formatCurrency}
            onExport={handleExportCumulativeData}
          />
          <LazyMonthlyChart
            data={monthlyBreakdownData}
            formatCurrency={formatCurrency}
            onExport={handleExportMonthlyData}
          />
          <ClaimsTable
            claims={claims}
            loadingCompleteness={loadingCompleteness}
            showCompletenessModal={showCompletenessModal}
            generatingEvidence={generatingEvidence}
            onCreateClaim={() => setShowCreateModal(true)}
            onSubmitClaim={setShowSubmitModal}
            onDisputeClaim={setShowDisputeModal}
            onCertifyClaim={setShowCertificationModal}
            onRecordPayment={setShowPaymentModal}
            onCompletenessCheck={handleCompletenessCheck}
            onEvidencePackage={setShowPackageModal}
          />
        </>
      )}

      {/* Modals */}
      {showCreateModal && projectId && (
        <CreateClaimModal
          projectId={projectId}
          onClose={() => setShowCreateModal(false)}
          onClaimCreated={handleClaimCreated}
        />
      )}
      {submitClaim && (
        <SubmitClaimModal
          claim={submitClaim}
          onClose={() => setShowSubmitModal(null)}
          onSubmitted={handleSubmitClaim}
        />
      )}
      {showDisputeModal && (
        <DisputeModal
          claimId={showDisputeModal}
          onClose={() => setShowDisputeModal(null)}
          onDisputed={handleDisputeClaim}
        />
      )}
      {certificationClaim && (
        <RecordCertificationModal
          claim={certificationClaim}
          onClose={() => setShowCertificationModal(null)}
          onCertify={handleCertifyClaim}
        />
      )}
      {paymentClaim && (
        <RecordPaymentModal
          claim={paymentClaim}
          onClose={() => setShowPaymentModal(null)}
          onRecordPayment={handleRecordPayment}
        />
      )}
      {showPackageModal && (
        <EvidencePackageModal
          claimId={showPackageModal}
          onClose={() => setShowPackageModal(null)}
          onGenerate={handleGenerateEvidencePackage}
        />
      )}
      {showCompletenessModal && (
        <CompletenessCheckModal
          loading={loadingCompleteness}
          data={completenessData}
          onClose={() => setShowCompletenessModal(null)}
        />
      )}
    </div>
  );
}
