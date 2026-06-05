import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCommercialAccess } from '@/hooks/useCommercialAccess';
import { apiFetch, ApiError } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { extractErrorMessage, extractErrorDetails, handleApiError } from '@/lib/errorHandling';
import { logError } from '@/lib/logger';
import { formatStatusLabel } from '@/lib/statusLabels';
import { toast } from '@/components/ui/toaster';
import { useOfflineStatus } from '@/lib/useOfflineStatus';
import { useIsMobile } from '@/hooks/useMediaQuery';

// Types and constants extracted to separate files
import type {
  Lot,
  SubcontractorCompany,
  TestResult,
  NCR,
  ConformStatus,
  ActivityLog,
  LocationState,
  LotSubcontractorAssignment,
} from './types';
import { getLotTabsForRole } from './constants';
import {
  buildConformanceStatusPath,
  buildLotHistoryPath,
  buildLotNcrsPath,
  buildLotTestResultsPath,
  normalizeActivityLogs,
  normalizeNcrs,
  normalizeTestResults,
  useLotQualityAccessQuery,
} from './lotDetailData';
import { useItpInstance } from './hooks/useItpInstance';
import { useConformanceReportGeneration } from './hooks/useConformanceReportGeneration';
import { useLotPhotoUpload } from './hooks/useLotPhotoUpload';
import { useLotReadinessNavigation } from './hooks/useLotReadinessNavigation';
import { QualityManagementSection } from './components/QualityManagementSection';
import { LotHeader } from './components/LotHeader';
import { LotTabNavigation } from './components/LotTabNavigation';
import { LotReadinessPanel } from './components/LotReadinessPanel';
import { LotDetailTabPanel } from './components/LotDetailTabPanel';
import { LotDetailModals } from './components/LotDetailModals';
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
  const [conforming, setConforming] = useState(false);
  const [showConformConfirm, setShowConformConfirm] = useState(false);
  const [showForceConformConfirm, setShowForceConformConfirm] = useState(false);
  const [forceConformReason, setForceConformReason] = useState('');
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [loadingTests, setLoadingTests] = useState(false);
  const [ncrs, setNcrs] = useState<NCR[]>([]);
  const [loadingNcrs, setLoadingNcrs] = useState(false);
  // Tab counts for badges
  const [testsCount, setTestsCount] = useState<number | null>(null);
  const [ncrsCount, setNcrsCount] = useState<number | null>(null);
  // Offline state
  const { isOnline, pendingSyncCount: _pendingSyncCount } = useOfflineStatus();
  const [conformStatus, setConformStatus] = useState<ConformStatus | null>(null);
  const [loadingConformStatus, setLoadingConformStatus] = useState(false);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overriding, setOverriding] = useState(false);
  const [showSubcontractorModal, setShowSubcontractorModal] = useState(false);
  const [subcontractors, setSubcontractors] = useState<SubcontractorCompany[]>([]);
  const [selectedSubcontractor, setSelectedSubcontractor] = useState<string>('');
  const [assigningSubcontractor, setAssigningSubcontractor] = useState(false);
  // Subcontractor assignments (new permission system)
  const [showAssignSubcontractorModal, setShowAssignSubcontractorModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<LotSubcontractorAssignment | null>(
    null,
  );
  const queryClient = useQueryClient();
  const [evidenceWarning, setEvidenceWarning] = useState<{
    checklistItemId: string;
    itemDescription: string;
    evidenceType: string;
    currentNotes: string | null;
  } | null>(null);
  const [naModal, setNaModal] = useState<{
    checklistItemId: string;
    itemDescription: string;
  } | null>(null);
  const [submittingNa, setSubmittingNa] = useState(false);

  // Failed modal state for NCR creation
  const [failedModal, setFailedModal] = useState<{
    checklistItemId: string;
    itemDescription: string;
  } | null>(null);
  const [submittingFailed, setSubmittingFailed] = useState(false);

  // Witness point modal state
  const [witnessModal, setWitnessModal] = useState<{
    checklistItemId: string;
    itemDescription: string;
    existingNotes: string | null;
  } | null>(null);
  const [submittingWitness, setSubmittingWitness] = useState(false);

  // Copy link handler
  const handleCopyLink = async () => {
    const url = `${window.location.origin}/projects/${encodeURIComponent(projectId || '')}/lots/${encodeURIComponent(lotId || '')}`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      toast({
        title: 'Link copied!',
        description: 'The lot link has been copied to your clipboard.',
      });
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setLinkCopied(true);
      toast({
        title: 'Link copied!',
        description: 'The lot link has been copied to your clipboard.',
      });
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

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
    refetchInterval: 20_000,
  });

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

  const fetchConformStatus = useCallback(async () => {
    if (!lotId || !lot || lot.status === 'conformed' || lot.status === 'claimed') return;

    setLoadingConformStatus(true);

    try {
      const data = await apiFetch<ConformStatus>(buildConformanceStatusPath(lotId));
      setConformStatus(data);
    } catch (err) {
      logError('Failed to fetch conform status:', err);
    } finally {
      setLoadingConformStatus(false);
    }
  }, [lotId, lot]);

  // Fetch conformance status when lot is loaded and not yet conformed
  useEffect(() => {
    void fetchConformStatus();
  }, [fetchConformStatus]);

  // Fetch tab counts on initial load for badges
  useEffect(() => {
    async function fetchTabCounts() {
      if (!projectId || !lotId) return;

      // Fetch test results count
      try {
        const testsData = await apiFetch<{ testResults: TestResult[] }>(
          buildLotTestResultsPath(projectId, lotId),
        );
        setTestsCount(normalizeTestResults(testsData).length);
      } catch (err) {
        logError('Failed to fetch tests count:', err);
      }

      // Fetch NCRs count
      try {
        const ncrsData = await apiFetch<{ ncrs: NCR[] }>(buildLotNcrsPath(projectId, lotId));
        setNcrsCount(normalizeNcrs(ncrsData).length);
      } catch (err) {
        logError('Failed to fetch NCRs count:', err);
      }
    }

    fetchTabCounts();
  }, [projectId, lotId]);

  // Fetch test results when Tests tab is selected
  useEffect(() => {
    async function fetchTestResults() {
      if (!projectId || !lotId || currentTab !== 'tests') return;

      setLoadingTests(true);

      try {
        const data = await apiFetch<{ testResults: TestResult[] }>(
          buildLotTestResultsPath(projectId, lotId),
        );
        const results = normalizeTestResults(data);
        setTestResults(results);
        setTestsCount(results.length);
      } catch (err) {
        logError('Failed to fetch test results:', err);
      } finally {
        setLoadingTests(false);
      }
    }

    fetchTestResults();
  }, [projectId, lotId, currentTab]);

  // Fetch NCRs when NCRs tab is selected
  useEffect(() => {
    async function fetchNcrs() {
      if (!projectId || !lotId || currentTab !== 'ncrs') return;

      setLoadingNcrs(true);

      try {
        const data = await apiFetch<{ ncrs: NCR[] }>(buildLotNcrsPath(projectId, lotId));
        const ncrList = normalizeNcrs(data);
        setNcrs(ncrList);
        setNcrsCount(ncrList.length);
      } catch (err) {
        logError('Failed to fetch NCRs:', err);
      } finally {
        setLoadingNcrs(false);
      }
    }

    fetchNcrs();
  }, [projectId, lotId, currentTab]);

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

  const refreshNcrsAfterFailure = useCallback(async () => {
    try {
      const ncrsData = await apiFetch<{ ncrs: NCR[] }>(
        `/api/ncrs?projectId=${encodeURIComponent(projectId || '')}&lotId=${encodeURIComponent(lotId || '')}`,
      );
      setNcrs(ncrsData.ncrs || []);
      setNcrsCount(ncrsData.ncrs?.length || 0);
    } catch {
      /* ignore */
    }
  }, [projectId, lotId]);

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
    toggleCompletion,
    updateNotes,
    markAsNA,
    markAsFailed,
    mobileMarkNA,
    mobileMarkFailed,
    completeWitnessPoint,
  } = useItpInstance({
    projectId,
    lotId,
    currentTab,
    isOnline,
    refetchReadiness,
    refetchConformStatus: fetchConformStatus,
    onRequestWitness: setWitnessModal,
    onRequestEvidenceWarning: setEvidenceWarning,
    onToggleSettled: () => setEvidenceWarning(null),
    refreshLotAfterFailure,
    refreshNcrsAfterFailure,
  });

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

  // Fetch activity history when History tab is selected
  useEffect(() => {
    async function fetchActivityHistory() {
      if (!lotId || currentTab !== 'history') return;

      setLoadingHistory(true);

      try {
        const data = await apiFetch<{ logs: ActivityLog[] }>(buildLotHistoryPath(lotId));
        setActivityLogs(normalizeActivityLogs(data));
      } catch (err) {
        logError('Failed to fetch activity history:', err);
      } finally {
        setLoadingHistory(false);
      }
    }

    fetchActivityHistory();
  }, [lotId, currentTab]);

  // Fetch subcontractors when assign modal opens
  useEffect(() => {
    if (showSubcontractorModal && projectId) {
      const fetchSubcontractors = async () => {
        try {
          const data = await apiFetch<{ subcontractors: SubcontractorCompany[] }>(
            `/api/subcontractors/for-project/${encodeURIComponent(projectId)}`,
          );
          setSubcontractors(data.subcontractors || []);
        } catch (err) {
          logError('Failed to fetch subcontractors:', err);
        }
      };
      fetchSubcontractors();
    }
  }, [showSubcontractorModal, projectId]);

  // Extract quality access permissions
  const canConformLots = qualityAccess?.canConformLots || false;
  const canForceConformLots = qualityAccess?.role === 'owner' || qualityAccess?.role === 'admin';
  const canVerifyTestResults = qualityAccess?.canVerifyTestResults || false;
  const canAssignITPTemplate = qualityAccess?.canManageITPTemplates || false;

  // Permission check for managing lot (assign subcontractors)
  const canManageLot = ['owner', 'admin', 'project_manager', 'site_manager'].includes(
    qualityAccess?.role || '',
  );

  // Foreman is a field-execution role: render lot detail field-first (no
  // commercial claim-readiness language) and order the tabs around field work.
  const isForeman = qualityAccess?.role === 'foreman';
  const lotTabs = getLotTabsForRole(qualityAccess?.role);

  // Check if user is a subcontractor
  const isSubcontractor = ['subcontractor', 'subcontractor_admin'].includes(
    qualityAccess?.role || '',
  );

  // Fetch subcontractor assignments for this lot
  const { data: assignments = [] } = useQuery({
    queryKey: ['lot-assignments', lotId],
    queryFn: () =>
      apiFetch<LotSubcontractorAssignment[]>(
        `/api/lots/${encodeURIComponent(lotId || '')}/subcontractors`,
      ),
    enabled: !!lotId,
  });

  // Fetch current user's assignment (for subcontractors)
  const { data: myAssignment } = useQuery({
    queryKey: ['my-lot-assignment', lotId],
    queryFn: () =>
      apiFetch<LotSubcontractorAssignment>(
        `/api/lots/${encodeURIComponent(lotId || '')}/subcontractors/mine`,
      ).catch(() => null),
    enabled: !!lotId && isSubcontractor,
  });

  // Subcontractors need canCompleteITP permission, others can complete by default
  const canCompleteITPItems = isSubcontractor ? (myAssignment?.canCompleteITP ?? false) : true;

  // Remove assignment mutation
  const removeAssignmentMutation = useMutation({
    mutationFn: (assignmentId: string) =>
      apiFetch(
        `/api/lots/${encodeURIComponent(lotId || '')}/subcontractors/${encodeURIComponent(assignmentId)}`,
        { method: 'DELETE' },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lot-assignments', lotId] });
      toast({ title: 'Subcontractor removed from lot' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove subcontractor',
        variant: 'error',
      });
    },
  });

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

  // Thin modal-confirm wrappers: the hook owns the mutation + toasts; the page
  // keeps the modal open/close state and the submitting flags.
  const handleSubmitNA = async (reason: string) => {
    if (!naModal) return;
    setSubmittingNa(true);
    try {
      const ok = await markAsNA(naModal.checklistItemId, reason);
      if (ok) setNaModal(null);
    } finally {
      setSubmittingNa(false);
    }
  };

  const handleSubmitFailed = async (description: string, category: string, severity: string) => {
    if (!failedModal) return;
    setSubmittingFailed(true);
    try {
      const ok = await markAsFailed({
        checklistItemId: failedModal.checklistItemId,
        description,
        category,
        severity,
      });
      if (ok) setFailedModal(null);
    } finally {
      setSubmittingFailed(false);
    }
  };

  const handleSubmitWitness = async (
    witnessPresent: boolean,
    witnessName?: string,
    witnessCompany?: string,
  ) => {
    if (!witnessModal) return;
    setSubmittingWitness(true);
    try {
      await completeWitnessPoint({
        checklistItemId: witnessModal.checklistItemId,
        existingNotes: witnessModal.existingNotes,
        witnessPresent,
        witnessName,
        witnessCompany,
      });
      setWitnessModal(null);
    } catch (err) {
      handleApiError(err, 'Failed to complete witness point');
    } finally {
      setSubmittingWitness(false);
    }
  };

  const handleConformLot = async (force = false, reason?: string) => {
    if (conforming || !lotId) return;

    const trimmedReason = reason?.trim() ?? '';
    if (force && trimmedReason.length < 5) {
      toast({
        title: 'Reason required',
        description: 'Please provide a reason before force conforming this lot.',
        variant: 'error',
      });
      return;
    }

    setConforming(true);
    try {
      await apiFetch(`/api/lots/${encodeURIComponent(lotId)}/conform`, {
        method: 'POST',
        ...(force ? { body: JSON.stringify({ force: true, reason: trimmedReason }) } : {}),
      });
      setShowConformConfirm(false);
      setShowForceConformConfirm(false);
      setForceConformReason('');
      setLot((prev) => (prev ? { ...prev, status: 'conformed' } : null));
      setConformStatus(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.lotReadiness(lotId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.lot(lotId) }),
        ...(projectId
          ? [
              queryClient.invalidateQueries({ queryKey: queryKeys.lots(projectId) }),
              queryClient.invalidateQueries({ queryKey: queryKeys.claimReadiness(projectId) }),
            ]
          : []),
      ]);
      await refetchReadiness();
      toast({
        title: 'Lot conformed',
        description: force
          ? 'The lot has been force conformed and marked as quality-approved.'
          : 'The lot has been marked as quality-approved.',
        variant: 'success',
      });
    } catch (err) {
      const details = extractErrorDetails(err);
      const blockingReasons = Array.isArray(details?.blockingReasons)
        ? details.blockingReasons.filter((reason): reason is string => typeof reason === 'string')
        : [];
      if (blockingReasons.length > 0) {
        toast({
          title: 'Cannot conform lot',
          description: blockingReasons.join('\n'),
          variant: 'error',
        });
      } else {
        toast({
          title: 'Failed to conform lot',
          description: extractErrorMessage(err, 'Please try again.'),
          variant: 'error',
        });
      }
    } finally {
      setConforming(false);
    }
  };

  // Handle status override
  const handleOverrideStatus = async (newStatus: string, reason: string) => {
    if (!newStatus || !reason.trim()) {
      toast({
        title: 'Missing fields',
        description: 'Please select a status and provide a reason.',
        variant: 'error',
      });
      return;
    }

    if (reason.trim().length < 5) {
      toast({
        title: 'Reason too short',
        description: 'Please provide a more detailed reason (at least 5 characters).',
        variant: 'error',
      });
      return;
    }

    setOverriding(true);

    try {
      const data = await apiFetch<{ lot: Lot; previousStatus: string }>(
        `/api/lots/${encodeURIComponent(lotId || '')}/override-status`,
        {
          method: 'POST',
          body: JSON.stringify({
            status: newStatus,
            reason: reason.trim(),
          }),
        },
      );

      setLot((prev) => (prev ? { ...prev, status: data.lot.status } : null));
      setShowOverrideModal(false);
      toast({
        title: 'Status overridden',
        description: `Status changed from "${formatStatusLabel(data.previousStatus)}" to "${formatStatusLabel(data.lot.status)}".`,
      });
      // Refresh history if we're on that tab
      if (currentTab === 'history') {
        setLoadingHistory(true);
        try {
          const historyData = await apiFetch<{ logs: ActivityLog[] }>(
            `/api/audit-logs?entityType=Lot&search=${encodeURIComponent(lotId || '')}&limit=100`,
          );
          setActivityLogs(historyData.logs || []);
        } catch {
          /* ignore */
        }
        setLoadingHistory(false);
      }
    } catch (err) {
      handleApiError(err, 'Failed to override status');
    } finally {
      setOverriding(false);
    }
  };

  // Handle assigning subcontractor to lot
  const handleAssignSubcontractor = async () => {
    if (!lot) return;

    setAssigningSubcontractor(true);

    try {
      const data = await apiFetch<{ message: string }>(
        `/api/lots/${encodeURIComponent(lot.id)}/assign`,
        {
          method: 'POST',
          body: JSON.stringify({
            subcontractorId: selectedSubcontractor || null,
          }),
        },
      );

      toast({
        title: selectedSubcontractor ? 'Subcontractor assigned' : 'Subcontractor unassigned',
        description: data.message,
      });

      // Refresh lot data
      setShowSubcontractorModal(false);
      setSelectedSubcontractor('');
      // Refetch lot data
      try {
        const lotData = await apiFetch<{ lot: Lot }>(`/api/lots/${encodeURIComponent(lot.id)}`);
        setLot(lotData.lot);
      } catch {
        /* ignore */
      }
    } catch (err) {
      logError('Failed to assign subcontractor:', err);
      toast({
        title: 'Assignment failed',
        description: extractErrorMessage(err, 'An error occurred'),
        variant: 'error',
      });
    } finally {
      setAssigningSubcontractor(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <LotHeader
        lot={lot}
        projectId={projectId!}
        lotId={lotId!}
        canConformLots={canConformLots}
        canManageLot={canManageLot}
        isEditable={isEditable}
        linkCopied={linkCopied}
        assignments={assignments}
        removeAssignmentPending={removeAssignmentMutation.isPending}
        onCopyLink={handleCopyLink}
        onPrint={() => window.print()}
        onEdit={() =>
          navigate(
            `/projects/${encodeURIComponent(projectId || '')}/lots/${encodeURIComponent(lotId || '')}/edit`,
          )
        }
        onAssignSubcontractorLegacy={() => {
          setSelectedSubcontractor(lot.assignedSubcontractorId || '');
          setShowSubcontractorModal(true);
        }}
        onOverrideStatus={() => setShowOverrideModal(true)}
        onAddSubcontractor={() => setShowAssignSubcontractorModal(true)}
        onEditAssignment={(assignment: LotSubcontractorAssignment) => {
          setEditingAssignment(assignment);
          setShowAssignSubcontractorModal(true);
        }}
        onRemoveAssignment={(assignmentId: string) => removeAssignmentMutation.mutate(assignmentId)}
      />

      <LotReadinessPanel
        fieldView={isForeman}
        readiness={readinessData?.readiness ?? null}
        loading={loadingReadiness}
        error={readinessError ? 'Could not load evidence readiness.' : null}
        onRetry={() => void refetchReadiness()}
        onTabChange={handleReadinessTabChange}
      />

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
        refetchItp={refetchItp}
        assigningTemplate={assigningTemplate}
        shouldOpenAssignItp={shouldOpenAssignItp}
        handleAssignItpActionHandled={handleAssignItpActionHandled}
        setNaModal={setNaModal}
        setFailedModal={setFailedModal}
        testResults={testResults}
        loadingTests={loadingTests}
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
        showSubcontractorModal={showSubcontractorModal}
        subcontractors={subcontractors}
        selectedSubcontractor={selectedSubcontractor}
        assigningSubcontractor={assigningSubcontractor}
        setShowSubcontractorModal={setShowSubcontractorModal}
        setSelectedSubcontractor={setSelectedSubcontractor}
        handleAssignSubcontractor={handleAssignSubcontractor}
        showAssignSubcontractorModal={showAssignSubcontractorModal}
        editingAssignment={editingAssignment}
        setShowAssignSubcontractorModal={setShowAssignSubcontractorModal}
        setEditingAssignment={setEditingAssignment}
        onAssignmentSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['lot-assignments', lotId] });
        }}
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
    </div>
  );
}
