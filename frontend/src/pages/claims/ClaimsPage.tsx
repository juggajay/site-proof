import { useParams } from 'react-router-dom';
import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { downloadCsv } from '@/lib/csv';
import { formatDateKey } from '@/lib/localDate';
import { toast } from '@/components/ui/toaster';
import { extractErrorMessage, isForbidden } from '@/lib/errorHandling';
import type { ClaimEvidencePackageData, ClaimPackageOptions } from '@/lib/pdfGenerator';

import type {
  Claim,
  ClaimCertificationFormData,
  ClaimPaymentFormData,
  CompletenessData,
  SubmitMethod,
} from './types';
import { calculatePaymentDueDate, exportChartDataToCSV } from './utils';

import { CreateClaimModal } from './components/CreateClaimModal';
import { SubmitClaimModal } from './components/SubmitClaimModal';
import { DisputeModal } from './components/DisputeModal';
import { RecordCertificationModal } from './components/RecordCertificationModal';
import { RecordPaymentModal } from './components/RecordPaymentModal';
import { CompletenessCheckModal } from './components/CompletenessCheckModal';
import { EvidencePackageModal } from './components/EvidencePackageModal';
import { logError } from '@/lib/logger';
import { CLAIM_DISPUTE_NOTES_MAX_LENGTH } from './constants';
import {
  buildClaimSummaryTotals,
  buildCumulativeClaimChartData,
  buildMonthlyClaimBreakdownData,
  findClaimById,
} from './claimsPageData';
import {
  ClaimsAccessDeniedState,
  ClaimsLoadErrorAlert,
  ClaimsLoadingState,
  ClaimsMainContent,
  ClaimsPageHeader,
} from './ClaimsPageSections';

export function ClaimsPage() {
  const { projectId } = useParams();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

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
      setAccessDenied(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    setAccessDenied(false);
    try {
      const data = await apiFetch<{ claims?: Claim[] }>(
        `/api/projects/${encodeURIComponent(projectId)}/claims`,
      );
      setClaims(data.claims || []);
    } catch (error) {
      logError('Error fetching claims:', error);
      setClaims([]);
      setAccessDenied(isForbidden(error));
      setLoadError(extractErrorMessage(error, 'Could not load progress claims. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  const totals = useMemo(() => buildClaimSummaryTotals(claims), [claims]);

  const cumulativeChartData = useMemo(() => buildCumulativeClaimChartData(claims), [claims]);

  const monthlyBreakdownData = useMemo(() => buildMonthlyClaimBreakdownData(claims), [claims]);

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
      new Date(c.periodStart).toLocaleDateString('en-AU'),
      new Date(c.periodEnd).toLocaleDateString('en-AU'),
      c.status,
      c.lotCount,
      c.totalClaimedAmount,
      c.certifiedAmount ?? '-',
      c.paidAmount ?? '-',
      c.submittedAt ? new Date(c.submittedAt).toLocaleDateString('en-AU') : '-',
      c.paymentDueDate
        ? new Date(c.paymentDueDate).toLocaleDateString('en-AU')
        : c.submittedAt
          ? new Date(calculatePaymentDueDate(c.submittedAt)).toLocaleDateString('en-AU')
          : '-',
    ]);
    downloadCsv(`progress-claims-${projectId}-${formatDateKey()}.csv`, [headers, ...rows]);
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
          ['Total Amount', `$${claim.totalClaimedAmount.toLocaleString('en-AU')}`],
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
          description: `Use ${CLAIM_DISPUTE_NOTES_MAX_LENGTH.toLocaleString('en-AU')} characters or less.`,
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
                  disputedAt: formatDateKey(),
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
        logError('Error running claim evidence review:', error);
        toast({
          title: 'Claim evidence review failed',
          description: extractErrorMessage(
            error,
            'Failed to review claim evidence. Please try again.',
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

  const submitClaim = useMemo(
    () => findClaimById(claims, showSubmitModal),
    [claims, showSubmitModal],
  );
  const paymentClaim = useMemo(
    () => findClaimById(claims, showPaymentModal),
    [claims, showPaymentModal],
  );
  const certificationClaim = useMemo(
    () => findClaimById(claims, showCertificationModal),
    [claims, showCertificationModal],
  );

  if (loading) {
    return <ClaimsLoadingState />;
  }

  if (accessDenied) {
    return <ClaimsAccessDeniedState message={loadError ?? undefined} />;
  }

  return (
    <div className="space-y-6">
      <ClaimsPageHeader
        claimCount={claims.length}
        onExportCSV={handleExportCSV}
        onCreateClaim={() => setShowCreateModal(true)}
      />

      <ClaimsLoadErrorAlert loadError={loadError} onRetry={() => void fetchClaims()} />

      <ClaimsMainContent
        loadError={loadError}
        totals={totals}
        cumulativeChartData={cumulativeChartData}
        monthlyBreakdownData={monthlyBreakdownData}
        claims={claims}
        loadingCompleteness={loadingCompleteness}
        showCompletenessModal={showCompletenessModal}
        generatingEvidence={generatingEvidence}
        onExportCumulativeData={handleExportCumulativeData}
        onExportMonthlyData={handleExportMonthlyData}
        onCreateClaim={() => setShowCreateModal(true)}
        onSubmitClaim={setShowSubmitModal}
        onDisputeClaim={setShowDisputeModal}
        onCertifyClaim={setShowCertificationModal}
        onRecordPayment={setShowPaymentModal}
        onCompletenessCheck={handleCompletenessCheck}
        onEvidencePackage={setShowPackageModal}
      />

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
