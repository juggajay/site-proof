import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCommercialAccess } from '@/hooks/useCommercialAccess';
import { useAuth } from '@/lib/auth';
import { apiFetch, ApiError } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { extractErrorMessage } from '@/lib/errorHandling';
import { useOfflineStatus } from '@/lib/useOfflineStatus';
import { useIsMobile } from '@/hooks/useMediaQuery';

// Types and constants extracted to separate files
import type { Lot, LocationState, LotSubcontractorAssignment } from './types';
import { getLotTabsForRole } from './constants';
import { canReviewItpByRole } from './components/itpChecklistTabHelpers';
import { useLotQualityAccessQuery } from './lotDetailData';
import { useItpInstance } from './hooks/useItpInstance';
import { useConformanceReportGeneration } from './hooks/useConformanceReportGeneration';
import { useLotPhotoUpload } from './hooks/useLotPhotoUpload';
import { useLotReadinessNavigation } from './hooks/useLotReadinessNavigation';
import { useLotLinkCopy } from './hooks/useLotLinkCopy';
import { useLotTabData } from './hooks/useLotTabData';
import { useLotTestCreation, buildAddTestPrefillForItem } from './hooks/useLotTestCreation';
import { useLotConformanceActions } from './hooks/useLotConformanceActions';
import { useLotSubcontractorAssignments } from './hooks/useLotSubcontractorAssignments';
import { useItpActionModals, type ItpActionModalHandlers } from './hooks/useItpActionModals';
import { QualityManagementSection } from './components/QualityManagementSection';
import { LotHeader } from './components/LotHeader';
import { LotTabNavigation } from './components/LotTabNavigation';
import { LotReadinessPanel } from './components/LotReadinessPanel';
import { LotDetailTabPanel } from './components/LotDetailTabPanel';
import { LotDetailModals } from './components/LotDetailModals';
import { CreateTestModal } from '@/pages/tests/components/CreateTestModal';
import {
  LotDetailEmptyState,
  LotDetailErrorState,
  LotDetailLoadingState,
  type LotDetailPageError,
} from './components/LotDetailPageStates';
import type { LotEvidenceReadiness } from '@/types/evidenceReadiness';

export function LotDetailPage() {
  const { projectId, lotId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  // Get return filters from navigation state (passed from LotsPage)
  const locationState = location.state as LocationState | null;
  const returnFilters = locationState?.returnFilters || '';

  // Navigate back to lot register with preserved filters
  const navigateToLotRegister = () => {
    const basePath = `/projects/${encodeURIComponent(projectId || '')}/lots`;
    if (returnFilters) {
      navigate(`${basePath}?${returnFilters}`);
    } else {
      navigate(basePath);
    }
  };
  const { canViewBudgets } = useCommercialAccess();
  const isMobile = useIsMobile();
  const tabSectionRef = useRef<HTMLDivElement>(null);
  const [lot, setLot] = useState<Lot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<LotDetailPageError | null>(null);
  // Offline state
  const { isOnline, pendingSyncCount: _pendingSyncCount } = useOfflineStatus();
  // Copy-link workflow (URL build, clipboard write + textarea fallback, toast,
  // 2-second reset) lives in useLotLinkCopy; the page only wires it into the
  // header button.
  const { linkCopied, copyLotLink } = useLotLinkCopy({ projectId, lotId });

  // Readiness-driven tab navigation: the URL `tab`/`action` params, the
  // readiness focus/highlight state, and the scroll-focus-highlight effect
  // live in the hook. The page keeps owning tabSectionRef because it renders
  // the tab panel the hook scrolls and focuses.
  const {
    currentTab,
    shouldOpenAssignItp,
    currentTabLabel,
    highlightedReadinessTab,
    handleTabChange,
    handleReadinessTabChange,
    handleAssignItpActionHandled,
  } = useLotReadinessNavigation({ searchParams, setSearchParams, tabSectionRef });

  const {
    testResults,
    loadingTests,
    ncrs,
    loadingNcrs,
    testsCount,
    ncrsCount,
    activityLogs,
    loadingHistory,
    refreshNcrsAfterFailure,
    refreshActivityHistory,
    refreshTests,
  } = useLotTabData({ projectId, lotId, currentTab });

  const {
    data: readinessData,
    isLoading: loadingReadiness,
    error: readinessError,
    refetch: refetchReadiness,
  } = useQuery({
    queryKey: queryKeys.lotReadiness(lotId || ''),
    queryFn: () =>
      apiFetch<{ readiness: LotEvidenceReadiness }>(
        `/api/lots/${encodeURIComponent(lotId!)}/readiness`,
      ),
    enabled: Boolean(lotId),
  });
  const conformStatus = readinessData?.readiness.conformStatus ?? null;
  const loadingConformStatus = loadingReadiness;

  const { isAddTestOpen, addTestPrefill, openAddTest, closeAddTest, createTestResult } =
    useLotTestCreation({ projectId, lotId, refreshTests, refetchReadiness });

  // Quality access permissions for this project (read-only; drives the derived
  // permissions below). Single-attempt fetch that logs on failure, preserving
  // the prior inline effect's behavior — see useLotQualityAccessQuery.
  const { data: qualityAccess } = useLotQualityAccessQuery(projectId);

  const fetchLot = useCallback(async () => {
    if (!lotId) {
      setLot(null);
      setError({ type: 'error', message: 'Missing lot id' });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<{ lot: Lot }>(`/api/lots/${encodeURIComponent(lotId)}`);
      setLot(data.lot);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 404) {
          setError({ type: 'not_found', message: 'Lot not found' });
        } else if (err.status === 403) {
          setError({ type: 'forbidden', message: 'You do not have access to this lot' });
        } else {
          setError({ type: 'error', message: extractErrorMessage(err, 'Failed to load lot') });
        }
      } else {
        setError({ type: 'error', message: extractErrorMessage(err, 'Failed to load lot') });
      }
    } finally {
      setLoading(false);
    }
  }, [lotId]);

  useEffect(() => {
    void fetchLot();
  }, [fetchLot]);

  // Lightweight page-owned refreshers run after an ITP item is marked failed.
  // Each swallows its own errors (matching the original inline refreshes) so the
  // failed-item toast still fires even if a refresh fails.
  const refreshLotAfterFailure = useCallback(async () => {
    try {
      const lotData = await apiFetch<{ lot: Lot }>(`/api/lots/${encodeURIComponent(lotId || '')}`);
      setLot(lotData.lot);
    } catch {
      /* ignore */
    }
  }, [lotId]);

  const itpActionHandlersRef = useRef<Partial<ItpActionModalHandlers>>({});
  const {
    evidenceWarning,
    setEvidenceWarning,
    naModal,
    setNaModal,
    submittingNa,
    failedModal,
    setFailedModal,
    submittingFailed,
    witnessModal,
    setWitnessModal,
    submittingWitness,
    handleSubmitNA,
    handleSubmitFailed,
    handleSubmitWitness,
  } = useItpActionModals(itpActionHandlersRef);

  const {
    itpInstance,
    setItpInstance,
    loadingItp,
    itpLoadError,
    templates,
    isOfflineData,
    offlinePendingCount,
    assigningTemplate,
    updatingCompletion,
    setUpdatingCompletion,
    updatingCompletionRef,
    refetchItp,
    assignTemplate,
    unassignTemplate,
    toggleCompletion,
    updateNotes,
    markAsNA,
    markAsFailed,
    mobileMarkNA,
    mobileMarkFailed,
    completeWitnessPoint,
    verifyCompletion,
    rejectCompletion,
  } = useItpInstance({
    projectId,
    lotId,
    currentTab,
    isOnline,
    refetchReadiness,
    onRequestWitness: setWitnessModal,
    onRequestEvidenceWarning: setEvidenceWarning,
    onToggleSettled: () => setEvidenceWarning(null),
    refreshLotAfterFailure,
    refreshNcrsAfterFailure,
  });

  itpActionHandlersRef.current = { markAsNA, markAsFailed, completeWitnessPoint };

  // Photo upload + AI-classification workflow (Feature #247). Lives in a hook
  // that owns the classification modal state; it shares useItpInstance's
  // updatingCompletion double-submit guard and merges uploaded attachments into
  // the same ITP instance state. The page keeps rendering the modal.
  const {
    classificationModal,
    savingClassification,
    handleMobileAddPhoto,
    handleAddPhoto,
    handleSaveClassification,
    handleSkipClassification,
  } = useLotPhotoUpload({
    projectId,
    lotId,
    itpInstance,
    setItpInstance,
    setUpdatingCompletion,
    updatingCompletionRef,
    refetchReadiness,
  });

  // Conformance report generation workflow (format dialog + lazy PDF import).
  // Lives in a hook because it owns its own dialog/generating state; it reuses
  // the already-loaded itpInstance to avoid an extra fetch.
  const {
    generatingReport,
    showReportFormatDialog,
    selectedReportFormat,
    setSelectedReportFormat,
    setShowReportFormatDialog,
    showReportDialog,
    generateReport,
  } = useConformanceReportGeneration({ lot, projectId, lotId, itpInstance });

  const {
    conforming,
    showConformConfirm,
    setShowConformConfirm,
    showForceConformConfirm,
    setShowForceConformConfirm,
    forceConformReason,
    setForceConformReason,
    showOverrideModal,
    setShowOverrideModal,
    overriding,
    handleConformLot,
    handleOverrideStatus,
  } = useLotConformanceActions({
    lotId,
    projectId,
    currentTab,
    setLot,
    refetchReadiness,
    refreshActivityHistory,
  });

  // Extract quality access permissions
  const canConformLots = qualityAccess?.canConformLots || false;
  const canForceConformLots = qualityAccess?.role === 'owner' || qualityAccess?.role === 'admin';
  const canVerifyTestResults = qualityAccess?.canVerifyTestResults || false;
  const canAssignITPTemplate = qualityAccess?.canManageITPTemplates || false;

  const effectiveRole = qualityAccess?.role || '';
  // Mirrors the backend TEST_CREATORS set. effectiveRole is the trusted
  // server-derived project role (not user.role, which RoleSwitcher can override).
  const canCreateTests = [
    'owner',
    'admin',
    'project_manager',
    'site_engineer',
    'quality_manager',
    'foreman',
  ].includes(effectiveRole);
  // Requirement-first test entry: prefill from an ITP checklist item when given.
  const handleAddTestResult = useCallback(
    (item?: { id: string; description: string; testType?: string | null }) => {
      if (item) openAddTest(buildAddTestPrefillForItem(item, lotId));
      else openAddTest({ initialValues: { lotId: lotId ?? '' } });
    },
    [openAddTest, lotId],
  );
  // H4: head-contractor verify/reject affordance gate (backend enforces too).
  const canReviewITP = canReviewItpByRole(effectiveRole);
  const canEditLot = [
    'owner',
    'admin',
    'project_manager',
    'quality_manager',
    'site_engineer',
  ].includes(effectiveRole);
  const canManageAssignments = ['owner', 'admin', 'project_manager', 'site_manager'].includes(
    effectiveRole,
  );

  // Foreman is a field-execution role: render lot detail field-first (no
  // commercial claim-readiness language) and order the tabs around field work.
  const isForeman = qualityAccess?.role === 'foreman';
  const lotTabs = getLotTabsForRole(qualityAccess?.role);

  // Check if user is a subcontractor
  const isSubcontractor = ['subcontractor', 'subcontractor_admin'].includes(
    qualityAccess?.role || '',
  );

  const {
    assignments,
    myAssignment,
    showAssignSubcontractorModal,
    setShowAssignSubcontractorModal,
    editingAssignment,
    setEditingAssignment,
    removeAssignmentPending,
    removeAssignment,
    handleAssignmentSuccess,
  } = useLotSubcontractorAssignments({
    lotId,
    isSubcontractor,
    canManageAssignments,
  });

  // Subcontractors need canCompleteITP permission, others can complete by default
  const canCompleteITPItems = isSubcontractor ? (myAssignment?.canCompleteITP ?? false) : true;

  if (loading) {
    return <LotDetailLoadingState />;
  }

  if (error) {
    return (
      <LotDetailErrorState
        error={error}
        onRetry={() => void fetchLot()}
        onGoBack={navigateToLotRegister}
      />
    );
  }

  if (!lot) {
    return <LotDetailEmptyState />;
  }

  // Conformed lots keep QA fields locked, but commercial users can still add a budget before claiming.
  const isEditable =
    lot.status !== 'claimed' && (lot.status !== 'conformed' || Boolean(canViewBudgets));

  return (
    <div className="space-y-6 p-6">
      <LotHeader
        lot={lot}
        projectId={projectId!}
        lotId={lotId!}
        canConformLots={canConformLots}
        canManageLot={canManageAssignments}
        canEditLot={canEditLot}
        isEditable={isEditable}
        linkCopied={linkCopied}
        assignments={assignments}
        removeAssignmentPending={removeAssignmentPending}
        onCopyLink={copyLotLink}
        onPrint={() => window.print()}
        onEdit={() =>
          navigate(
            `/projects/${encodeURIComponent(projectId || '')}/lots/${encodeURIComponent(lotId || '')}/edit`,
          )
        }
        onOverrideStatus={() => setShowOverrideModal(true)}
        onAddSubcontractor={() => setShowAssignSubcontractorModal(true)}
        onEditAssignment={(assignment: LotSubcontractorAssignment) => {
          setEditingAssignment(assignment);
          setShowAssignSubcontractorModal(true);
        }}
        onRemoveAssignment={removeAssignment}
      />

      <LotReadinessPanel
        fieldView={isForeman}
        readiness={readinessData?.readiness ?? null}
        loading={loadingReadiness}
        error={readinessError ? 'Could not load evidence readiness.' : null}
        onRetry={() => void refetchReadiness()}
        onTabChange={handleReadinessTabChange}
        onAddTestForItem={canCreateTests ? handleAddTestResult : undefined}
      />

      {/* Conform CTA next to the readiness panel — the full checklist + force
          conform stay in the Quality Management section below the tabs; this
          surfaces the actionable "Conform lot" the moment prerequisites are met
          so conformers don't have to scroll past every tab to find it. Reuses
          the same conform flow (setShowConformConfirm) and the canConformLots
          gate (owner/admin/project_manager/quality_manager). */}
      {canConformLots &&
        conformStatus?.canConform &&
        lot.status !== 'conformed' &&
        lot.status !== 'claimed' && (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-success/30 bg-success/10 p-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Ready to conform</h3>
              <p className="text-sm text-muted-foreground">
                All conformance prerequisites are met for this lot.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowConformConfirm(true)}
              disabled={conforming}
              className="shrink-0 rounded-lg bg-success px-4 py-2 text-sm font-medium text-success-foreground hover:bg-success/90 disabled:opacity-50"
            >
              {conforming ? 'Conforming...' : 'Conform lot'}
            </button>
          </div>
        )}

      {/* Tab Navigation */}
      <LotTabNavigation
        tabs={lotTabs}
        currentTab={currentTab}
        onTabChange={handleTabChange}
        counts={{ tests: testsCount, ncrs: ncrsCount }}
      />

      {/* Tab Content */}
      <LotDetailTabPanel
        tabSectionRef={tabSectionRef}
        currentTab={currentTab}
        currentTabLabel={currentTabLabel}
        highlightedReadinessTab={highlightedReadinessTab}
        lot={lot}
        projectId={projectId}
        lotId={lotId}
        itpInstance={itpInstance}
        setItpInstance={setItpInstance}
        templates={templates}
        loadingItp={loadingItp}
        itpLoadError={itpLoadError}
        isOnline={isOnline}
        isOfflineData={isOfflineData}
        offlinePendingCount={offlinePendingCount}
        isMobile={isMobile}
        updatingCompletion={updatingCompletion}
        canCompleteITPItems={canCompleteITPItems}
        canAssignITPTemplate={canAssignITPTemplate}
        toggleCompletion={toggleCompletion}
        updateNotes={updateNotes}
        mobileMarkNA={mobileMarkNA}
        mobileMarkFailed={mobileMarkFailed}
        handleMobileAddPhoto={handleMobileAddPhoto}
        handleAddPhoto={handleAddPhoto}
        assignTemplate={assignTemplate}
        unassignTemplate={unassignTemplate}
        refetchItp={refetchItp}
        assigningTemplate={assigningTemplate}
        shouldOpenAssignItp={shouldOpenAssignItp}
        handleAssignItpActionHandled={handleAssignItpActionHandled}
        setNaModal={setNaModal}
        setFailedModal={setFailedModal}
        canReviewITP={canReviewITP}
        currentUserId={user?.id}
        verifyCompletion={verifyCompletion}
        rejectCompletion={rejectCompletion}
        testResults={testResults}
        loadingTests={loadingTests}
        canCreateTests={canCreateTests}
        onAddTestResult={handleAddTestResult}
        ncrs={ncrs}
        loadingNcrs={loadingNcrs}
        handleTabChange={handleTabChange}
        activityLogs={activityLogs}
        loadingHistory={loadingHistory}
      />

      {/* Quality Management Section */}
      <QualityManagementSection
        lot={lot}
        conformStatus={conformStatus}
        loadingConformStatus={loadingConformStatus}
        canConformLots={canConformLots}
        canForceConformLots={canForceConformLots}
        canVerifyTestResults={canVerifyTestResults}
        conforming={conforming}
        generatingReport={generatingReport}
        showReportFormatDialog={showReportFormatDialog}
        selectedReportFormat={selectedReportFormat}
        onConformLot={() => setShowConformConfirm(true)}
        onForceConformLot={() => setShowForceConformConfirm(true)}
        onTabChange={handleTabChange}
        onShowReportDialog={showReportDialog}
        onGenerateReport={generateReport}
        onCloseReportDialog={() => setShowReportFormatDialog(false)}
        onReportFormatChange={setSelectedReportFormat}
      />

      <LotDetailModals
        lot={lot}
        lotId={lotId!}
        projectId={projectId}
        showOverrideModal={showOverrideModal}
        overriding={overriding}
        setShowOverrideModal={setShowOverrideModal}
        handleOverrideStatus={handleOverrideStatus}
        showAssignSubcontractorModal={showAssignSubcontractorModal}
        editingAssignment={editingAssignment}
        setShowAssignSubcontractorModal={setShowAssignSubcontractorModal}
        setEditingAssignment={setEditingAssignment}
        onAssignmentSuccess={handleAssignmentSuccess}
        evidenceWarning={evidenceWarning}
        updatingCompletion={updatingCompletion}
        setEvidenceWarning={setEvidenceWarning}
        toggleCompletion={toggleCompletion}
        naModal={naModal}
        submittingNa={submittingNa}
        setNaModal={setNaModal}
        handleSubmitNA={handleSubmitNA}
        failedModal={failedModal}
        submittingFailed={submittingFailed}
        setFailedModal={setFailedModal}
        handleSubmitFailed={handleSubmitFailed}
        failedModalAddPhoto={(file) =>
          failedModal ? handleMobileAddPhoto(failedModal.checklistItemId, file) : undefined
        }
        failedModalPhotoCount={
          failedModal
            ? (itpInstance?.completions.find(
                (c) => c.checklistItemId === failedModal.checklistItemId,
              )?.attachments?.length ?? 0)
            : 0
        }
        witnessModal={witnessModal}
        submittingWitness={submittingWitness}
        setWitnessModal={setWitnessModal}
        handleSubmitWitness={handleSubmitWitness}
        classificationModal={classificationModal}
        savingClassification={savingClassification}
        handleSaveClassification={handleSaveClassification}
        handleSkipClassification={handleSkipClassification}
        showConformConfirm={showConformConfirm}
        showForceConformConfirm={showForceConformConfirm}
        forceConformReason={forceConformReason}
        conforming={conforming}
        setShowConformConfirm={setShowConformConfirm}
        setShowForceConformConfirm={setShowForceConformConfirm}
        setForceConformReason={setForceConformReason}
        handleConformLot={handleConformLot}
      />

      <CreateTestModal
        isOpen={isAddTestOpen}
        onClose={closeAddTest}
        onSuccess={createTestResult}
        lots={lot ? [{ id: lot.id, lotNumber: lot.lotNumber }] : []}
        projectState=""
        initialValues={addTestPrefill.initialValues}
        satisfiesItem={addTestPrefill.satisfiesItem}
      />
    </div>
  );
}
