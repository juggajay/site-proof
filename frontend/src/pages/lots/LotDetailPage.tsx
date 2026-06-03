import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCommercialAccess } from '@/hooks/useCommercialAccess';
import { useViewerAccess } from '@/hooks/useViewerAccess';
import { apiFetch, ApiError, authFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { extractErrorMessage, extractErrorDetails, handleApiError } from '@/lib/errorHandling';
import { devWarn, logError } from '@/lib/logger';
import { formatDateTime } from '@/lib/utils';
import { toast } from '@/components/ui/toaster';
import { CommentsSection } from '@/components/comments/CommentsSection';
import { AssignSubcontractorModal } from '@/components/lots/AssignSubcontractorModal';
import { useOfflineStatus } from '@/lib/useOfflineStatus';
import { useIsMobile } from '@/hooks/useMediaQuery';

// Types and constants extracted to separate files
import type {
  LotTab,
  Lot,
  SubcontractorCompany,
  TestResult,
  NCR,
  ITPAttachment,
  ITPCompletion,
  ConformStatus,
  ActivityLog,
  LocationState,
  LotSubcontractorAssignment,
} from './types';
import { LOT_TABS as tabs, LOT_OVERRIDE_STATUSES } from './constants';
import { getGPSLocation, getItpPhotoValidationError } from './lib/itpEvidence';
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
import { TestsTabContent, NCRsTabContent, HistoryTabContent } from '@/components/lots';
import { MarkAsNAModal } from './components/MarkAsNAModal';
import { MarkAsFailedModal } from './components/MarkAsFailedModal';
import { EvidenceWarningModal } from './components/EvidenceWarningModal';
import { WitnessPointModal } from './components/WitnessPointModal';
import { AIClassificationModal, ClassificationModalData } from './components/AIClassificationModal';
import { StatusOverrideModal } from './components/StatusOverrideModal';
import { LegacyAssignSubcontractorModal } from './components/LegacyAssignSubcontractorModal';
import { QualityManagementSection } from './components/QualityManagementSection';
import { LotHeader } from './components/LotHeader';
import { LotTabNavigation } from './components/LotTabNavigation';
import { LotReadinessPanel } from './components/LotReadinessPanel';
import { PhotosTab } from './components/PhotosTab';
import { ITPChecklistTab } from './components/ITPChecklistTab';
import { ConformLotDialogs } from './components/ConformLotDialogs';
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
  const { canCreate: canEdit } = useViewerAccess();
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
  const [_uploadingPhoto, setUploadingPhoto] = useState<string | null>(null);
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

  // AI Photo Classification modal state (Feature #247)
  const [classificationModal, setClassificationModal] = useState<ClassificationModalData | null>(
    null,
  );
  const [savingClassification, setSavingClassification] = useState(false);
  const [_classifying, setClassifying] = useState(false);

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

  // Get current tab from URL or default to 'itp'
  const currentTab = (searchParams.get('tab') as LotTab) || 'itp';
  const shouldOpenAssignItp = searchParams.get('action') === 'assign-itp';
  const currentTabLabel = tabs.find((tab) => tab.id === currentTab)?.label ?? 'Lot detail';
  const [readinessFocusTarget, setReadinessFocusTarget] = useState<{
    tab: LotTab;
    requestedAt: number;
  } | null>(null);
  const [highlightedReadinessTab, setHighlightedReadinessTab] = useState<LotTab | null>(null);

  // Handle tab change
  const handleTabChange = (tabId: LotTab) => {
    setReadinessFocusTarget(null);
    setHighlightedReadinessTab(null);
    const params = new URLSearchParams(searchParams);
    params.set('tab', tabId);
    params.delete('action');
    setSearchParams(params);
  };

  const handleReadinessTabChange = (tabId: LotTab, actionCode?: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', tabId);
    if (tabId === 'itp' && (actionCode === 'no_itp_assigned' || actionCode === 'no_itp')) {
      params.set('action', 'assign-itp');
    } else {
      params.delete('action');
    }
    setReadinessFocusTarget({ tab: tabId, requestedAt: Date.now() });
    setHighlightedReadinessTab(tabId);
    setSearchParams(params);
  };

  const handleAssignItpActionHandled = useCallback(() => {
    if (searchParams.get('action') !== 'assign-itp') return;
    const params = new URLSearchParams(searchParams);
    params.delete('action');
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!readinessFocusTarget || readinessFocusTarget.tab !== currentTab) return;

    const frame = window.requestAnimationFrame(() => {
      const target = tabSectionRef.current;
      if (!target) return;

      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({
        block: 'start',
        inline: 'nearest',
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      });
      target.focus({ preventScroll: true });
    });
    const highlightTimeout = window.setTimeout(() => {
      setHighlightedReadinessTab((tab) => (tab === readinessFocusTarget.tab ? null : tab));
    }, 3000);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(highlightTimeout);
    };
  }, [currentTab, readinessFocusTarget]);

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

  // Permission check for managing lot (assign subcontractors)
  const canManageLot = ['owner', 'admin', 'project_manager', 'site_manager'].includes(
    qualityAccess?.role || '',
  );

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

  const uploadItpEvidencePhoto = async (
    completionId: string,
    file: File,
  ): Promise<ITPAttachment> => {
    if (!projectId || !lotId) {
      throw new Error('Project and lot are required to upload ITP evidence.');
    }

    const gpsLocation = await getGPSLocation();
    const caption = `ITP Evidence Photo - ${formatDateTime(new Date())}`;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectId', projectId);
    formData.append('lotId', lotId);
    formData.append('documentType', 'photo');
    formData.append('category', 'itp_evidence');
    formData.append('caption', caption);

    const uploadResponse = await authFetch('/api/documents/upload', {
      method: 'POST',
      body: formData,
    });

    if (!uploadResponse.ok) {
      const body = await uploadResponse.text();
      throw new ApiError(uploadResponse.status, body);
    }

    const document = (await uploadResponse.json()) as { id: string };
    const data = await apiFetch<{ attachment: ITPAttachment }>(
      `/api/itp/completions/${encodeURIComponent(completionId)}/attachments`,
      {
        method: 'POST',
        body: JSON.stringify({
          documentId: document.id,
          caption,
          gpsLatitude: gpsLocation?.latitude ?? null,
          gpsLongitude: gpsLocation?.longitude ?? null,
        }),
      },
    );

    return data.attachment;
  };

  const handleMobileAddPhoto = async (checklistItemId: string, file: File) => {
    if (!itpInstance || updatingCompletionRef.current === checklistItemId) return;

    const validationError = getItpPhotoValidationError(file);
    if (validationError) {
      toast({
        title: validationError.includes('10MB') ? 'File too large' : 'Invalid file type',
        description: validationError,
        variant: 'error',
      });
      return;
    }

    try {
      updatingCompletionRef.current = checklistItemId;
      setUpdatingCompletion(checklistItemId);

      // First ensure there's a completion for this item
      let completion = itpInstance.completions.find((c) => c.checklistItemId === checklistItemId);

      if (!completion?.id) {
        // Create completion first
        try {
          const data = await apiFetch<{ completion: ITPCompletion }>('/api/itp/completions', {
            method: 'POST',
            body: JSON.stringify({
              itpInstanceId: itpInstance.id,
              checklistItemId,
              status: 'pending',
              notes: '',
            }),
          });
          completion = data.completion;
          // Update local state
          setItpInstance((prev) => {
            if (!prev) return prev;
            return { ...prev, completions: [...prev.completions, data.completion] };
          });
        } catch {
          // creation failed
        }
      }

      if (!completion?.id) {
        toast({
          title: 'Cannot add photo',
          description: 'Unable to create completion record.',
          variant: 'error',
        });
        return;
      }

      const attachment = await uploadItpEvidencePhoto(completion.id, file);

      // Update local state with new attachment
      setItpInstance((prev) => {
        if (!prev) return prev;
        const newCompletions = prev.completions.map((c) => {
          if (c.checklistItemId === checklistItemId) {
            return {
              ...c,
              attachments: c.attachments?.some((existing) => existing.id === attachment.id)
                ? c.attachments
                : [...(c.attachments || []), attachment],
            };
          }
          return c;
        });
        return { ...prev, completions: newCompletions };
      });
      toast({
        title: 'Photo uploaded',
        description: 'Photo has been attached to the checklist item.',
      });
    } catch (err) {
      handleApiError(err, 'Failed to upload photo');
    } finally {
      updatingCompletionRef.current = null;
      setUpdatingCompletion(null);
    }
  };

  // Handle adding a photo to an ITP completion
  const handleAddPhoto = async (
    completionId: string,
    checklistItemId: string,
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file || !itpInstance) return;

    const validationError = getItpPhotoValidationError(file);
    if (validationError) {
      toast({
        title: validationError.includes('10MB') ? 'File too large' : 'Invalid file type',
        description: validationError,
        variant: 'error',
      });
      event.target.value = ''; // Reset input
      return;
    }

    setUploadingPhoto(checklistItemId);

    try {
      const attachment = await uploadItpEvidencePhoto(completionId, file);

      // Update the ITP instance with the new attachment
      setItpInstance((prev) => {
        if (!prev) return prev;
        const completionIndex = prev.completions.findIndex((c) => c.id === completionId);
        if (completionIndex >= 0) {
          const newCompletions = [...prev.completions];
          const completion = newCompletions[completionIndex];
          newCompletions[completionIndex] = {
            ...completion,
            attachments: completion.attachments?.some((existing) => existing.id === attachment.id)
              ? completion.attachments
              : [...(completion.attachments || []), attachment],
          };
          return { ...prev, completions: newCompletions };
        }
        return prev;
      });

      // Feature #247: AI Photo Classification
      // Call the AI classification endpoint after successful upload
      setClassifying(true);
      try {
        const classificationData = await apiFetch<ClassificationModalData>(
          `/api/documents/${encodeURIComponent(attachment.documentId)}/classify`,
          {
            method: 'POST',
          },
        );

        // Show the classification modal
        setClassificationModal({
          documentId: classificationData.documentId,
          filename: file.name,
          suggestedClassification: classificationData.suggestedClassification,
          confidence: classificationData.confidence,
          categories: classificationData.categories,
        });
      } catch (classifyErr) {
        devWarn('AI classification error:', classifyErr);
        toast({
          title: 'Photo uploaded',
          description: 'Photo was uploaded but AI classification failed.',
        });
      } finally {
        setClassifying(false);
      }
    } catch (err) {
      handleApiError(err, 'Failed to upload photo');
    } finally {
      setUploadingPhoto(null);
      event.target.value = '';
    }
  };

  // Feature #247: Handle saving the photo classification
  const handleSaveClassification = async (classification: string) => {
    if (!classificationModal) return;

    setSavingClassification(true);

    try {
      await apiFetch(
        `/api/documents/${encodeURIComponent(classificationModal.documentId)}/save-classification`,
        {
          method: 'POST',
          body: JSON.stringify({
            classification,
          }),
        },
      );

      toast({
        title: 'Classification saved',
        description: `Photo classified as "${classification}"`,
      });
      setClassificationModal(null);
    } catch (err) {
      handleApiError(err, 'Failed to save classification');
    } finally {
      setSavingClassification(false);
    }
  };

  // Skip classification and just close the modal
  const handleSkipClassification = () => {
    setClassificationModal(null);
    toast({
      title: 'Photo uploaded',
      description: 'Photo was uploaded without classification.',
    });
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
        description: `Status changed from "${data.previousStatus.replace('_', ' ')}" to "${data.lot.status.replace('_', ' ')}".`,
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
        canEdit={canEdit}
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
        readiness={readinessData?.readiness ?? null}
        loading={loadingReadiness}
        error={readinessError ? 'Could not load evidence readiness.' : null}
        onRetry={() => void refetchReadiness()}
        onTabChange={handleReadinessTabChange}
      />

      {/* Tab Navigation */}
      <LotTabNavigation
        tabs={tabs}
        currentTab={currentTab}
        onTabChange={handleTabChange}
        counts={{ tests: testsCount, ncrs: ncrsCount }}
      />

      {/* Tab Content */}
      <div
        ref={tabSectionRef}
        className={`min-h-[300px] rounded-lg outline-none transition-shadow duration-200 ${
          highlightedReadinessTab === currentTab
            ? 'ring-2 ring-primary/50 ring-offset-2 ring-offset-background'
            : ''
        }`}
        role="tabpanel"
        tabIndex={-1}
        aria-label={`${currentTabLabel} section`}
        data-testid="lot-tab-panel"
        data-readiness-highlighted={highlightedReadinessTab === currentTab ? 'true' : 'false'}
      >
        {/* ITP Checklist Tab */}
        {currentTab === 'itp' && lot && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <ITPChecklistTab
              lot={lot}
              projectId={projectId!}
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
              onToggleCompletion={toggleCompletion}
              onUpdateNotes={updateNotes}
              onMarkAsNA={mobileMarkNA}
              onMarkAsFailed={mobileMarkFailed}
              onAddPhoto={handleMobileAddPhoto}
              onAddPhotoDesktop={handleAddPhoto}
              onAssignTemplate={assignTemplate}
              onRetryItp={() => void refetchItp()}
              assigningTemplate={assigningTemplate}
              autoOpenAssignTemplate={shouldOpenAssignItp}
              onAutoOpenAssignTemplateHandled={handleAssignItpActionHandled}
              onOpenNaModal={(data) => setNaModal(data)}
              onOpenFailedModal={(data) => setFailedModal(data)}
            />
          </div>
        )}

        {/* Test Results Tab */}
        {currentTab === 'tests' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Test Results</h2>
              <button
                onClick={() => navigate(`/projects/${encodeURIComponent(projectId || '')}/tests`)}
                className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
              >
                View All Tests
              </button>
            </div>
            <TestsTabContent
              projectId={projectId!}
              testResults={testResults}
              loading={loadingTests}
            />
          </div>
        )}

        {/* NCRs Tab */}
        {currentTab === 'ncrs' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Non-Conformance Reports</h2>
              <button
                onClick={() => navigate(`/projects/${encodeURIComponent(projectId || '')}/ncr`)}
                className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
              >
                View All NCRs
              </button>
            </div>
            <NCRsTabContent projectId={projectId!} ncrs={ncrs} loading={loadingNcrs} />
          </div>
        )}

        {/* Photos Tab */}
        {currentTab === 'photos' && lotId && (
          <PhotosTab
            itpInstance={itpInstance}
            lotId={lotId}
            onTabChange={handleTabChange}
            onItpInstanceUpdate={setItpInstance}
          />
        )}

        {/* Documents Tab */}
        {currentTab === 'documents' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Documents</h2>
              <button className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">
                Upload Document
              </button>
            </div>
            <div className="rounded-lg border p-6 text-center">
              <div className="text-4xl mb-2">📄</div>
              <h3 className="text-lg font-semibold mb-2">No Documents</h3>
              <p className="text-muted-foreground">
                No documents have been attached to this lot yet. Upload drawings, specifications, or
                other documents.
              </p>
            </div>
          </div>
        )}

        {/* Comments Tab */}
        {currentTab === 'comments' && lotId && (
          <div className="animate-in fade-in duration-200">
            <CommentsSection entityType="Lot" entityId={lotId} />
          </div>
        )}

        {/* History Tab */}
        {currentTab === 'history' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Activity History</h2>
            </div>
            <HistoryTabContent activityLogs={activityLogs} loading={loadingHistory} />
          </div>
        )}
      </div>

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

      {/* Status Override Modal */}
      <StatusOverrideModal
        isOpen={showOverrideModal}
        currentStatus={lot.status}
        validStatuses={LOT_OVERRIDE_STATUSES}
        onClose={() => setShowOverrideModal(false)}
        onSubmit={handleOverrideStatus}
        isSubmitting={overriding}
      />

      {/* Assign Subcontractor Modal */}
      <LegacyAssignSubcontractorModal
        isOpen={showSubcontractorModal}
        lot={lot}
        subcontractors={subcontractors}
        selectedSubcontractor={selectedSubcontractor}
        isAssigning={assigningSubcontractor}
        onSelectedChange={setSelectedSubcontractor}
        onClose={() => {
          setShowSubcontractorModal(false);
          setSelectedSubcontractor('');
        }}
        onSubmit={handleAssignSubcontractor}
      />

      {/* Assign Subcontractor Modal (new permission system) */}
      {showAssignSubcontractorModal && (
        <AssignSubcontractorModal
          lotId={lotId!}
          lotNumber={lot?.lotNumber || ''}
          projectId={projectId || ''}
          existingAssignment={editingAssignment}
          onClose={() => {
            setShowAssignSubcontractorModal(false);
            setEditingAssignment(null);
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['lot-assignments', lotId] });
          }}
        />
      )}

      {/* Evidence Warning Modal */}
      <EvidenceWarningModal
        isOpen={!!evidenceWarning}
        warning={evidenceWarning}
        onClose={() => setEvidenceWarning(null)}
        onConfirm={() => {
          if (evidenceWarning) {
            toggleCompletion(
              evidenceWarning.checklistItemId,
              false, // Currently not completed
              evidenceWarning.currentNotes,
              true, // Force complete without evidence
            );
          }
        }}
        isLoading={updatingCompletion === evidenceWarning?.checklistItemId}
      />

      {/* Mark as N/A Modal */}
      <MarkAsNAModal
        isOpen={!!naModal}
        itemDescription={naModal?.itemDescription || ''}
        onClose={() => setNaModal(null)}
        onSubmit={handleSubmitNA}
        isSubmitting={submittingNa}
      />

      {/* Mark as Failed Modal - Creates NCR */}
      <MarkAsFailedModal
        isOpen={!!failedModal}
        itemDescription={failedModal?.itemDescription || ''}
        onClose={() => setFailedModal(null)}
        onSubmit={handleSubmitFailed}
        isSubmitting={submittingFailed}
      />

      {/* Witness Point Completion Modal */}
      <WitnessPointModal
        isOpen={!!witnessModal}
        itemDescription={witnessModal?.itemDescription || ''}
        onClose={() => setWitnessModal(null)}
        onSubmit={handleSubmitWitness}
        isSubmitting={submittingWitness}
      />

      {/* Feature #247: AI Photo Classification Modal */}
      <AIClassificationModal
        isOpen={!!classificationModal}
        data={classificationModal}
        onSave={handleSaveClassification}
        onSkip={handleSkipClassification}
        isSaving={savingClassification}
      />

      <ConformLotDialogs
        lotNumber={lot?.lotNumber}
        showConformConfirm={showConformConfirm}
        onConformCancel={() => setShowConformConfirm(false)}
        onConformConfirm={() => void handleConformLot(false)}
        showForceConformConfirm={showForceConformConfirm}
        forceConformReason={forceConformReason}
        onForceConformReasonChange={setForceConformReason}
        onForceConformCancel={() => {
          setShowForceConformConfirm(false);
          setForceConformReason('');
        }}
        onForceConformConfirm={() => void handleConformLot(true, forceConformReason)}
        isConforming={conforming}
      />
    </div>
  );
}
