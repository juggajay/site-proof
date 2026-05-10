import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCommercialAccess } from '@/hooks/useCommercialAccess';
import { useViewerAccess } from '@/hooks/useViewerAccess';
import { apiFetch, ApiError, authFetch } from '@/lib/api';
import { extractErrorMessage, extractErrorDetails, handleApiError } from '@/lib/errorHandling';
import { devLog, devWarn, logError } from '@/lib/logger';
import { toast } from '@/components/ui/toaster';
import { CommentsSection } from '@/components/comments/CommentsSection';
import { AssignSubcontractorModal } from '@/components/lots/AssignSubcontractorModal';
import { AlertTriangle, SearchX, ShieldAlert, Users } from 'lucide-react';
import type {
  ConformanceReportData,
  ConformanceFormat,
  ConformanceFormatOptions,
} from '@/lib/pdfGenerator';
import { useOfflineStatus } from '@/lib/useOfflineStatus';
import {
  cacheITPChecklist,
  getCachedITPChecklist,
  updateChecklistItemOffline,
  getPendingSyncCount,
  OfflineChecklistItem,
} from '@/lib/offlineDb';
import { useIsMobile } from '@/hooks/useMediaQuery';

// Types and constants extracted to separate files
import type {
  LotTab,
  QualityAccess,
  Lot,
  SubcontractorCompany,
  TestResult,
  NCR,
  ITPChecklistItem,
  ITPAttachment,
  ITPCompletion,
  ITPInstance,
  ITPTemplate,
  ConformStatus,
  ActivityLog,
  LocationState,
  LotSubcontractorAssignment,
} from './types';
import { LOT_TABS as tabs } from './constants';
import { TestsTabContent, NCRsTabContent, HistoryTabContent } from '@/components/lots';
import { MarkAsNAModal } from './components/MarkAsNAModal';
import { MarkAsFailedModal } from './components/MarkAsFailedModal';
import { EvidenceWarningModal } from './components/EvidenceWarningModal';
import { WitnessPointModal } from './components/WitnessPointModal';
import { AIClassificationModal, ClassificationModalData } from './components/AIClassificationModal';
import { StatusOverrideModal } from './components/StatusOverrideModal';
import { QualityManagementSection } from './components/QualityManagementSection';
import { LotHeader } from './components/LotHeader';
import { LotTabNavigation } from './components/LotTabNavigation';
import { PhotosTab } from './components/PhotosTab';
import { ITPChecklistTab } from './components/ITPChecklistTab';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface ProjectResponse {
  project?: {
    name?: string | null;
    projectNumber?: string | null;
    clientName?: string | null;
  };
}

interface ItpInstanceResponse {
  instance: ITPInstance | null;
}

interface TestResultsResponse {
  testResults?: ConformanceReportData['testResults'];
}

interface NcrsResponse {
  ncrs?: ConformanceReportData['ncrs'];
}

const normalizeResponsibleParty = (value: string): ITPChecklistItem['responsibleParty'] => {
  if (
    value === 'contractor' ||
    value === 'subcontractor' ||
    value === 'superintendent' ||
    value === 'general'
  ) {
    return value;
  }
  return 'general';
};

const MAX_ITP_PHOTO_SIZE = 10 * 1024 * 1024;
const ALLOWED_ITP_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const getItpPhotoValidationError = (file: File): string | null => {
  if (file.size > MAX_ITP_PHOTO_SIZE) {
    return `The file "${file.name}" exceeds the 10MB limit. Please select a smaller file.`;
  }

  if (!ALLOWED_ITP_PHOTO_TYPES.includes(file.type)) {
    return `The file "${file.name}" is not a supported image format. Please use JPEG, PNG, GIF, or WebP.`;
  }

  return null;
};

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
  const { canViewBudgets: _canViewBudgets } = useCommercialAccess();
  const { canCreate: canEdit } = useViewerAccess();
  const isMobile = useIsMobile();
  const [lot, setLot] = useState<Lot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{
    type: 'not_found' | 'forbidden' | 'error';
    message: string;
  } | null>(null);
  const [conforming, setConforming] = useState(false);
  const [showConformConfirm, setShowConformConfirm] = useState(false);
  const [qualityAccess, setQualityAccess] = useState<QualityAccess | null>(null);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [loadingTests, setLoadingTests] = useState(false);
  const [ncrs, setNcrs] = useState<NCR[]>([]);
  const [loadingNcrs, setLoadingNcrs] = useState(false);
  // Tab counts for badges
  const [testsCount, setTestsCount] = useState<number | null>(null);
  const [ncrsCount, setNcrsCount] = useState<number | null>(null);
  const [itpInstance, setItpInstance] = useState<ITPInstance | null>(null);
  const [loadingItp, setLoadingItp] = useState(false);
  const [itpLoadError, setItpLoadError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<ITPTemplate[]>([]);
  // Offline state
  const { isOnline, pendingSyncCount: _pendingSyncCount } = useOfflineStatus();
  const [isOfflineData, setIsOfflineData] = useState(false);
  const [offlinePendingCount, setOfflinePendingCount] = useState(0);
  const [assigningTemplate, setAssigningTemplate] = useState(false);
  const [updatingCompletion, setUpdatingCompletion] = useState<string | null>(null);
  const updatingCompletionRef = useRef<string | null>(null);
  const [conformStatus, setConformStatus] = useState<ConformStatus | null>(null);
  const [loadingConformStatus, setLoadingConformStatus] = useState(false);
  const [_uploadingPhoto, setUploadingPhoto] = useState<string | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overriding, setOverriding] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [showReportFormatDialog, setShowReportFormatDialog] = useState(false);
  const [selectedReportFormat, setSelectedReportFormat] = useState<ConformanceFormat>('standard');
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

  // Handle tab change
  const handleTabChange = (tabId: LotTab) => {
    setSearchParams({ tab: tabId });
  };

  // Fetch quality access permissions for this project
  useEffect(() => {
    async function fetchQualityAccess() {
      if (!projectId) return;

      try {
        const data = await apiFetch<QualityAccess>(
          `/api/lots/check-role/${encodeURIComponent(projectId)}`,
        );
        setQualityAccess(data);
      } catch (err) {
        logError('Failed to fetch quality access:', err);
      }
    }

    fetchQualityAccess();
  }, [projectId]);

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

  // Fetch conformance status when lot is loaded and not yet conformed
  useEffect(() => {
    async function fetchConformStatus() {
      if (!lotId || !lot || lot.status === 'conformed' || lot.status === 'claimed') return;

      setLoadingConformStatus(true);

      try {
        const data = await apiFetch<ConformStatus>(
          `/api/lots/${encodeURIComponent(lotId)}/conform-status`,
        );
        setConformStatus(data);
      } catch (err) {
        logError('Failed to fetch conform status:', err);
      } finally {
        setLoadingConformStatus(false);
      }
    }

    fetchConformStatus();
  }, [lotId, lot]);

  // Fetch tab counts on initial load for badges
  useEffect(() => {
    async function fetchTabCounts() {
      if (!projectId || !lotId) return;

      // Fetch test results count
      try {
        const testsData = await apiFetch<{ testResults: TestResult[] }>(
          `/api/test-results?projectId=${encodeURIComponent(projectId)}&lotId=${encodeURIComponent(lotId)}`,
        );
        setTestsCount(testsData.testResults?.length || 0);
      } catch (err) {
        logError('Failed to fetch tests count:', err);
      }

      // Fetch NCRs count
      try {
        const ncrsData = await apiFetch<{ ncrs: NCR[] }>(
          `/api/ncrs?projectId=${encodeURIComponent(projectId)}&lotId=${encodeURIComponent(lotId)}`,
        );
        setNcrsCount(ncrsData.ncrs?.length || 0);
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
          `/api/test-results?projectId=${encodeURIComponent(projectId)}&lotId=${encodeURIComponent(lotId)}`,
        );
        setTestResults(data.testResults || []);
        setTestsCount(data.testResults?.length || 0);
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
        const data = await apiFetch<{ ncrs: NCR[] }>(
          `/api/ncrs?projectId=${encodeURIComponent(projectId)}&lotId=${encodeURIComponent(lotId)}`,
        );
        setNcrs(data.ncrs || []);
        setNcrsCount(data.ncrs?.length || 0);
      } catch (err) {
        logError('Failed to fetch NCRs:', err);
      } finally {
        setLoadingNcrs(false);
      }
    }

    fetchNcrs();
  }, [projectId, lotId, currentTab]);

  const fetchItpInstance = useCallback(async () => {
    if (!projectId || !lotId || currentTab !== 'itp') return;

    setLoadingItp(true);
    setItpLoadError(null);
    setIsOfflineData(false);

    const encodedProjectId = encodeURIComponent(projectId);
    const encodedLotId = encodeURIComponent(lotId);

    // Check offline pending count
    const pendingCount = await getPendingSyncCount();
    setOfflinePendingCount(pendingCount);

    try {
      // Try to fetch from server first
      const data = await apiFetch<{ instance: ITPInstance }>(
        `/api/itp/instances/lot/${encodedLotId}`,
      );
      setItpInstance(data.instance);
      setIsOfflineData(false);

      // Cache the ITP data for offline use
      if (data.instance?.template) {
        const items: OfflineChecklistItem[] = data.instance.template.checklistItems.map(
          (item: ITPChecklistItem) => {
            const completion = data.instance.completions.find(
              (c: ITPCompletion) => c.checklistItemId === item.id,
            );
            let status: 'pending' | 'completed' | 'na' | 'failed' = 'pending';
            if (completion?.isCompleted) status = 'completed';
            else if (completion?.isNotApplicable) status = 'na';
            else if (completion?.isFailed) status = 'failed';

            return {
              id: item.id,
              name: item.description,
              description: item.acceptanceCriteria || undefined,
              responsibleParty: item.responsibleParty,
              isHoldPoint: item.isHoldPoint,
              status,
              notes: completion?.notes || undefined,
              completedAt: completion?.completedAt || undefined,
              completedBy: completion?.completedBy?.fullName || undefined,
            };
          },
        );

        await cacheITPChecklist(
          lotId,
          data.instance.template.id,
          data.instance.template.name,
          items,
        );
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setItpInstance(null);
        // No ITP assigned - fetch available templates
        try {
          const templatesData = await apiFetch<{ templates: ITPTemplate[] }>(
            `/api/itp/templates?projectId=${encodedProjectId}`,
          );
          setTemplates(templatesData.templates || []);
        } catch (templateErr) {
          logError('Failed to fetch ITP templates for lot:', templateErr);
          setTemplates([]);
          setItpLoadError(
            extractErrorMessage(
              templateErr,
              'No ITP is assigned, and available templates could not be loaded.',
            ),
          );
        }
      } else {
        logError('Failed to fetch ITP instance, trying offline cache:', err);

        // Try to load from offline cache
        const cachedData = await getCachedITPChecklist(lotId);
        if (cachedData) {
          // Convert cached data to ITPInstance format
          const offlineInstance: ITPInstance = {
            id: `offline-${cachedData.id}`,
            template: {
              id: cachedData.templateId,
              name: cachedData.templateName,
              checklistItems: cachedData.items.map((item, index) => ({
                id: item.id,
                description: item.name,
                category: 'General',
                responsibleParty: normalizeResponsibleParty(item.responsibleParty),
                isHoldPoint: item.isHoldPoint,
                pointType: item.isHoldPoint ? 'hold_point' : 'standard',
                evidenceRequired: 'none',
                order: index,
                acceptanceCriteria: item.description || null,
                testType: null,
              })),
            },
            completions: cachedData.items
              .filter((item) => item.status !== 'pending')
              .map((item) => ({
                id: `offline-${item.id}`,
                checklistItemId: item.id,
                isCompleted: item.status === 'completed',
                isNotApplicable: item.status === 'na',
                isFailed: item.status === 'failed',
                notes: item.notes || null,
                completedAt: item.completedAt || null,
                completedBy: item.completedBy
                  ? { id: 'offline', fullName: item.completedBy, email: '' }
                  : null,
                isVerified: false,
                verifiedAt: null,
                verifiedBy: null,
                attachments: [],
              })),
          };
          setItpInstance(offlineInstance);
          setIsOfflineData(true);
          toast({
            title: 'Offline Mode',
            description: `Showing cached data from ${new Date(cachedData.cachedAt).toLocaleDateString()}`,
            variant: 'default',
          });
        } else {
          setItpInstance(null);
          setItpLoadError(extractErrorMessage(err, 'Failed to load ITP checklist.'));
        }
      }
    } finally {
      setLoadingItp(false);
    }
  }, [projectId, lotId, currentTab]);

  // Fetch ITP instance when ITP tab is selected (with offline support)
  useEffect(() => {
    void fetchItpInstance();
  }, [fetchItpInstance, isOnline]);

  // Feature #734: Real-time HP release notification polling
  // Poll for ITP updates every 20 seconds to catch holdpoint releases quickly
  useEffect(() => {
    if (!lotId || currentTab !== 'itp' || !isOnline) return;

    let pollInterval: NodeJS.Timeout | null = null;

    const silentFetchItpUpdates = async () => {
      try {
        const data = await apiFetch<{ instance: ITPInstance }>(
          `/api/itp/instances/lot/${encodeURIComponent(lotId)}`,
        );
        // Only update if there are actual changes in completions
        setItpInstance((prevInstance) => {
          if (!prevInstance || !data.instance) return data.instance || prevInstance;

          const prevCompletions = prevInstance.completions || [];
          const newCompletions = data.instance.completions || [];

          // Check if completions have changed
          const hasChanges =
            newCompletions.length !== prevCompletions.length ||
            newCompletions.some((newComp: ITPCompletion) => {
              const prevComp = prevCompletions.find(
                (p) => p.checklistItemId === newComp.checklistItemId,
              );
              return (
                !prevComp ||
                prevComp.isCompleted !== newComp.isCompleted ||
                prevComp.isVerified !== newComp.isVerified ||
                prevComp.completedAt !== newComp.completedAt
              );
            });

          return hasChanges ? data.instance : prevInstance;
        });
      } catch (err) {
        // Silent fail for background polling
        devLog('Background ITP fetch failed:', err);
      }
    };

    const startPolling = () => {
      // Poll every 20 seconds for ITP (more frequent for HP releases)
      pollInterval = setInterval(() => {
        if (document.visibilityState === 'visible') {
          silentFetchItpUpdates();
        }
      }, 20000);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        silentFetchItpUpdates();
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [lotId, currentTab, isOnline]);

  // Fetch activity history when History tab is selected
  useEffect(() => {
    async function fetchActivityHistory() {
      if (!lotId || currentTab !== 'history') return;

      setLoadingHistory(true);

      try {
        const data = await apiFetch<{ logs: ActivityLog[] }>(
          `/api/audit-logs?entityType=Lot&search=${encodeURIComponent(lotId)}&limit=100`,
        );
        setActivityLogs(data.logs || []);
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
    return (
      <div
        className="flex h-full items-center justify-center p-6"
        role="status"
        aria-label="Loading lot details"
      >
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    const ErrorIcon =
      error.type === 'forbidden'
        ? ShieldAlert
        : error.type === 'not_found'
          ? SearchX
          : AlertTriangle;

    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ErrorIcon className="h-8 w-8" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold text-destructive">
          {error.type === 'forbidden'
            ? 'Access Denied'
            : error.type === 'not_found'
              ? 'Lot Not Found'
              : 'Error'}
        </h1>
        <p className="text-muted-foreground text-center max-w-md">{error.message}</p>
        {error.type === 'error' && (
          <button
            type="button"
            onClick={() => void fetchLot()}
            className="rounded-lg border px-4 py-2 hover:bg-muted"
          >
            Try again
          </button>
        )}
        <button
          onClick={navigateToLotRegister}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (!lot) {
    return null;
  }

  // Check if lot can be edited
  const isEditable = lot.status !== 'conformed' && lot.status !== 'claimed';

  const handleAssignTemplate = async (templateId: string) => {
    if (!lotId || assigningTemplate) return false;

    setAssigningTemplate(true);
    setItpLoadError(null);

    try {
      const data = await apiFetch<{ instance: ITPInstance }>('/api/itp/instances', {
        method: 'POST',
        body: JSON.stringify({ lotId, templateId }),
      });
      setItpInstance(data.instance);
      // Modal closing is handled by the ITPChecklistTab component
      return true;
    } catch (err) {
      logError('Failed to assign template:', err);
      toast({
        title: 'Failed to assign ITP template',
        description: extractErrorMessage(err, 'Please try again.'),
        variant: 'error',
      });
      return false;
    } finally {
      setAssigningTemplate(false);
    }
  };

  const handleToggleCompletion = async (
    checklistItemId: string,
    currentlyCompleted: boolean,
    existingNotes: string | null,
    forceComplete = false,
    witnessData?: { witnessPresent: boolean; witnessName?: string; witnessCompany?: string },
  ) => {
    if (!itpInstance || updatingCompletionRef.current === checklistItemId) return;

    const item = itpInstance.template.checklistItems.find((i) => i.id === checklistItemId);
    const completion = itpInstance.completions.find((c) => c.checklistItemId === checklistItemId);

    // Check if this is a witness point and we're completing (not uncompleting)
    if (!currentlyCompleted && !forceComplete && item?.pointType === 'witness' && !witnessData) {
      // Show witness modal to collect witness details
      setWitnessModal({
        checklistItemId,
        itemDescription: item.description,
        existingNotes,
      });
      return;
    }

    // Check if this item requires evidence and doesn't have any yet
    if (!currentlyCompleted && !forceComplete) {
      const hasAttachments = completion?.attachments && completion.attachments.length > 0;

      if (item && item.evidenceRequired !== 'none' && !hasAttachments) {
        // Show evidence warning modal
        const evidenceTypeLabel =
          item.evidenceRequired === 'photo'
            ? 'Photo'
            : item.evidenceRequired === 'test'
              ? 'Test Result'
              : item.evidenceRequired === 'document'
                ? 'Document'
                : 'Evidence';
        setEvidenceWarning({
          checklistItemId,
          itemDescription: item.description,
          evidenceType: evidenceTypeLabel,
          currentNotes: existingNotes,
        });
        return;
      }
    }

    updatingCompletionRef.current = checklistItemId;
    setUpdatingCompletion(checklistItemId);

    try {
      const data = await apiFetch<{ completion: ITPCompletion }>('/api/itp/completions', {
        method: 'POST',
        body: JSON.stringify({
          itpInstanceId: itpInstance.id,
          checklistItemId,
          isCompleted: !currentlyCompleted,
          notes: existingNotes,
          // Include witness data if provided
          ...(witnessData && {
            witnessPresent: witnessData.witnessPresent,
            witnessName: witnessData.witnessName || null,
            witnessCompany: witnessData.witnessCompany || null,
          }),
        }),
      });

      // Update the completions in state
      setItpInstance((prev) => {
        if (!prev) return prev;
        const existingIndex = prev.completions.findIndex(
          (c) => c.checklistItemId === checklistItemId,
        );
        const newCompletions = [...prev.completions];
        if (existingIndex >= 0) {
          newCompletions[existingIndex] = data.completion;
        } else {
          newCompletions.push(data.completion);
        }
        return { ...prev, completions: newCompletions };
      });

      // Update offline cache with the new completion status
      if (lotId) {
        const newStatus = !currentlyCompleted ? 'completed' : 'pending';
        await updateChecklistItemOffline(
          lotId,
          checklistItemId,
          newStatus,
          existingNotes || undefined,
          'Current User',
        );
      }
    } catch (err) {
      logError('Failed to update completion:', err);

      // If offline, save to IndexedDB and update local state
      if (!navigator.onLine && lotId) {
        const newStatus = !currentlyCompleted ? 'completed' : 'pending';
        await updateChecklistItemOffline(
          lotId,
          checklistItemId,
          newStatus,
          existingNotes || undefined,
          'Current User (Offline)',
        );

        // Update local state optimistically
        setItpInstance((prev) => {
          if (!prev) return prev;
          const existingIndex = prev.completions.findIndex(
            (c) => c.checklistItemId === checklistItemId,
          );
          const newCompletions = [...prev.completions];
          const newCompletion: ITPCompletion = {
            id: `offline-${checklistItemId}-${Date.now()}`,
            checklistItemId,
            isCompleted: !currentlyCompleted,
            isNotApplicable: false,
            isFailed: false,
            notes: existingNotes,
            completedAt: !currentlyCompleted ? new Date().toISOString() : null,
            completedBy: !currentlyCompleted
              ? { id: 'offline', fullName: 'You (Offline)', email: '' }
              : null,
            isVerified: false,
            verifiedAt: null,
            verifiedBy: null,
            attachments: [],
          };
          if (existingIndex >= 0) {
            newCompletions[existingIndex] = newCompletion;
          } else {
            newCompletions.push(newCompletion);
          }
          return { ...prev, completions: newCompletions };
        });

        // Update offline pending count
        const pendingCount = await getPendingSyncCount();
        setOfflinePendingCount(pendingCount);

        toast({
          title: 'Saved Offline',
          description: "Your change will sync when you're back online.",
          variant: 'default',
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to update checklist item. Please try again.',
          variant: 'error',
        });
      }
    } finally {
      updatingCompletionRef.current = null;
      setUpdatingCompletion(null);
      setEvidenceWarning(null);
    }
  };

  const handleUpdateNotes = async (checklistItemId: string, notes: string) => {
    if (!itpInstance) return;

    const existingCompletion = itpInstance.completions.find(
      (c) => c.checklistItemId === checklistItemId,
    );

    try {
      const data = await apiFetch<{ completion: ITPCompletion }>('/api/itp/completions', {
        method: 'POST',
        body: JSON.stringify({
          itpInstanceId: itpInstance.id,
          checklistItemId,
          isCompleted: existingCompletion?.isCompleted || false,
          notes,
        }),
      });

      setItpInstance((prev) => {
        if (!prev) return prev;
        const existingIndex = prev.completions.findIndex(
          (c) => c.checklistItemId === checklistItemId,
        );
        const newCompletions = [...prev.completions];
        if (existingIndex >= 0) {
          newCompletions[existingIndex] = data.completion;
        } else {
          newCompletions.push(data.completion);
        }
        return { ...prev, completions: newCompletions };
      });
    } catch (err) {
      logError('Failed to update notes:', err);
    }
  };

  // Handle marking an ITP item as Not Applicable
  const handleMarkAsNA = async (reason: string) => {
    if (!naModal || !itpInstance || !reason.trim()) {
      toast({
        title: 'Reason required',
        description: 'Please provide a reason for marking this item as N/A.',
        variant: 'error',
      });
      return;
    }

    setSubmittingNa(true);

    try {
      const data = await apiFetch<{ completion: ITPCompletion }>('/api/itp/completions', {
        method: 'POST',
        body: JSON.stringify({
          itpInstanceId: itpInstance.id,
          checklistItemId: naModal.checklistItemId,
          status: 'not_applicable',
          notes: reason.trim(),
        }),
      });

      // Update the completions in state
      setItpInstance((prev) => {
        if (!prev) return prev;
        const existingIndex = prev.completions.findIndex(
          (c) => c.checklistItemId === naModal.checklistItemId,
        );
        const newCompletions = [...prev.completions];
        if (existingIndex >= 0) {
          newCompletions[existingIndex] = data.completion;
        } else {
          newCompletions.push(data.completion);
        }
        return { ...prev, completions: newCompletions };
      });
      toast({
        title: 'Item marked as N/A',
        description: 'The checklist item has been marked as not applicable.',
      });
      setNaModal(null);
    } catch (err) {
      handleApiError(err, 'Failed to mark as N/A');
    } finally {
      setSubmittingNa(false);
    }
  };

  // Handle marking an ITP item as Failed (triggers NCR creation)
  const handleMarkAsFailed = async (description: string, category: string, severity: string) => {
    if (!failedModal || !itpInstance) {
      return;
    }

    setSubmittingFailed(true);

    try {
      const data = await apiFetch<{ completion: ITPCompletion; ncr?: { ncrNumber: string } }>(
        '/api/itp/completions',
        {
          method: 'POST',
          body: JSON.stringify({
            itpInstanceId: itpInstance.id,
            checklistItemId: failedModal.checklistItemId,
            status: 'failed',
            notes: `Failed: ${description}`,
            ncrDescription: description,
            ncrCategory: category,
            ncrSeverity: severity,
          }),
        },
      );

      // Update the completions in state
      setItpInstance((prev) => {
        if (!prev) return prev;
        const existingIndex = prev.completions.findIndex(
          (c) => c.checklistItemId === failedModal.checklistItemId,
        );
        const newCompletions = [...prev.completions];
        if (existingIndex >= 0) {
          newCompletions[existingIndex] = data.completion;
        } else {
          newCompletions.push(data.completion);
        }
        return { ...prev, completions: newCompletions };
      });

      // Refresh the lot data to reflect status change
      try {
        const lotData = await apiFetch<{ lot: Lot }>(
          `/api/lots/${encodeURIComponent(lotId || '')}`,
        );
        setLot(lotData.lot);
      } catch {
        /* ignore */
      }

      // Refresh NCRs list
      try {
        const ncrsData = await apiFetch<{ ncrs: NCR[] }>(
          `/api/ncrs?projectId=${encodeURIComponent(projectId || '')}&lotId=${encodeURIComponent(lotId || '')}`,
        );
        setNcrs(ncrsData.ncrs || []);
        setNcrsCount(ncrsData.ncrs?.length || 0);
      } catch {
        /* ignore */
      }

      toast({
        title: 'Item marked as Failed - NCR created',
        description: data.ncr
          ? `NCR ${data.ncr.ncrNumber} has been raised for this item.`
          : 'The item has been marked as failed.',
      });
      setFailedModal(null);
    } catch (err) {
      handleApiError(err, 'Failed to mark item');
    } finally {
      setSubmittingFailed(false);
    }
  };

  // Mobile-specific handlers for MobileITPChecklist
  const handleMobileMarkNA = async (checklistItemId: string, reason: string) => {
    if (!itpInstance || updatingCompletionRef.current === checklistItemId) return;

    try {
      updatingCompletionRef.current = checklistItemId;
      setUpdatingCompletion(checklistItemId);
      const data = await apiFetch<{ completion: ITPCompletion }>('/api/itp/completions', {
        method: 'POST',
        body: JSON.stringify({
          itpInstanceId: itpInstance.id,
          checklistItemId,
          status: 'not_applicable',
          notes: reason.trim() || 'Marked as N/A',
        }),
      });

      setItpInstance((prev) => {
        if (!prev) return prev;
        const existingIndex = prev.completions.findIndex(
          (c) => c.checklistItemId === checklistItemId,
        );
        const newCompletions = [...prev.completions];
        if (existingIndex >= 0) {
          newCompletions[existingIndex] = data.completion;
        } else {
          newCompletions.push(data.completion);
        }
        return { ...prev, completions: newCompletions };
      });
      toast({
        title: 'Item marked as N/A',
        description: 'The checklist item has been marked as not applicable.',
      });
    } catch (err) {
      handleApiError(err, 'Failed to mark as N/A');
    } finally {
      updatingCompletionRef.current = null;
      setUpdatingCompletion(null);
    }
  };

  const handleMobileMarkFailed = async (checklistItemId: string, reason: string) => {
    if (!itpInstance || updatingCompletionRef.current === checklistItemId) return;

    try {
      updatingCompletionRef.current = checklistItemId;
      setUpdatingCompletion(checklistItemId);
      const data = await apiFetch<{ completion: ITPCompletion; ncr?: { ncrNumber: string } }>(
        '/api/itp/completions',
        {
          method: 'POST',
          body: JSON.stringify({
            itpInstanceId: itpInstance.id,
            checklistItemId,
            status: 'failed',
            notes: `Failed: ${reason.trim() || 'Item failed inspection'}`,
            ncrDescription: reason.trim() || 'Item failed ITP inspection',
            ncrCategory: 'workmanship',
            ncrSeverity: 'minor',
          }),
        },
      );

      setItpInstance((prev) => {
        if (!prev) return prev;
        const existingIndex = prev.completions.findIndex(
          (c) => c.checklistItemId === checklistItemId,
        );
        const newCompletions = [...prev.completions];
        if (existingIndex >= 0) {
          newCompletions[existingIndex] = data.completion;
        } else {
          newCompletions.push(data.completion);
        }
        return { ...prev, completions: newCompletions };
      });

      // Refresh NCRs list
      try {
        const ncrsData = await apiFetch<{ ncrs: NCR[] }>(
          `/api/ncrs?projectId=${encodeURIComponent(projectId || '')}&lotId=${encodeURIComponent(lotId || '')}`,
        );
        setNcrs(ncrsData.ncrs || []);
        setNcrsCount(ncrsData.ncrs?.length || 0);
      } catch {
        /* ignore */
      }

      toast({
        title: 'Item marked as Failed',
        description: data.ncr
          ? `NCR ${data.ncr.ncrNumber} has been raised for this item.`
          : 'The item has been marked as failed.',
      });
    } catch (err) {
      handleApiError(err, 'Failed to mark item');
    } finally {
      updatingCompletionRef.current = null;
      setUpdatingCompletion(null);
    }
  };

  const getGPSLocation = (): Promise<{ latitude: number; longitude: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        () => {
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
      );
    });
  };

  const uploadItpEvidencePhoto = async (
    completionId: string,
    file: File,
  ): Promise<ITPAttachment> => {
    if (!projectId || !lotId) {
      throw new Error('Project and lot are required to upload ITP evidence.');
    }

    const gpsLocation = await getGPSLocation();
    const caption = `ITP Evidence Photo - ${new Date().toLocaleString()}`;
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

  // Handle completing a witness point with witness details
  const handleCompleteWitnessPoint = async (
    witnessPresent: boolean,
    witnessName?: string,
    witnessCompany?: string,
  ) => {
    if (!witnessModal || !itpInstance) {
      return;
    }

    setSubmittingWitness(true);

    try {
      // Call handleToggleCompletion with witness data
      await handleToggleCompletion(
        witnessModal.checklistItemId,
        false, // currentlyCompleted - we're completing it
        witnessModal.existingNotes,
        true, // forceComplete to skip the modal check
        {
          witnessPresent,
          witnessName,
          witnessCompany,
        },
      );

      toast({
        title: 'Witness point completed',
        description: witnessPresent
          ? `Witness details recorded: ${witnessName}${witnessCompany ? ` (${witnessCompany})` : ''}`
          : 'Noted that notification was given but witness not present.',
      });

      setWitnessModal(null);
    } catch (err) {
      handleApiError(err, 'Failed to complete witness point');
    } finally {
      setSubmittingWitness(false);
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

  const handleConformLot = async () => {
    if (conforming || !lotId) return;

    setConforming(true);
    try {
      await apiFetch(`/api/lots/${encodeURIComponent(lotId)}/conform`, {
        method: 'POST',
      });
      setShowConformConfirm(false);
      setLot((prev) => (prev ? { ...prev, status: 'conformed' } : null));
      toast({
        title: 'Lot conformed',
        description: 'The lot has been marked as quality-approved.',
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

  // Show format selection dialog before generating report
  const handleShowReportDialog = () => {
    // Allow generating report for conformed or claimed lots (claimed lots were previously conformed)
    if (!lot || (lot.status !== 'conformed' && lot.status !== 'claimed')) return;
    setShowReportFormatDialog(true);
  };

  // Handle generating conformance report PDF with selected format
  const handleGenerateReport = async () => {
    // Allow generating report for conformed or claimed lots (claimed lots were previously conformed)
    if (!lot || (lot.status !== 'conformed' && lot.status !== 'claimed')) return;

    setShowReportFormatDialog(false);
    setGeneratingReport(true);

    try {
      // Fetch all data needed for the report
      const encodedProjectId = encodeURIComponent(projectId || '');
      const encodedLotId = encodeURIComponent(lotId || '');
      const [projectData, itpData, testsData, ncrsData] = await Promise.all([
        apiFetch<ProjectResponse>(`/api/projects/${encodedProjectId}`),
        itpInstance
          ? Promise.resolve<ItpInstanceResponse>({ instance: itpInstance })
          : apiFetch<ItpInstanceResponse>(`/api/itp/instances/lot/${encodedLotId}`),
        apiFetch<TestResultsResponse>(
          `/api/test-results?projectId=${encodedProjectId}&lotId=${encodedLotId}`,
        ),
        apiFetch<NcrsResponse>(`/api/ncrs?projectId=${encodedProjectId}&lotId=${encodedLotId}`),
      ]);
      const project = projectData.project;
      if (!project?.name) {
        throw new Error('Project details are required before generating a conformance report.');
      }
      const reportItpInstance = itpData.instance;

      // Count photos from ITP completions
      let photoCount = 0;
      if (reportItpInstance?.completions) {
        reportItpInstance.completions.forEach((completion) => {
          if (completion.attachments) {
            photoCount += completion.attachments.length;
          }
        });
      }

      // Extract hold point releases (completions of hold_point items that are verified)
      const holdPointReleases: ConformanceReportData['holdPointReleases'] = [];
      if (reportItpInstance?.template?.checklistItems && reportItpInstance.completions) {
        const holdPointItems = reportItpInstance.template.checklistItems.filter(
          (item) => item.pointType === 'hold_point',
        );
        holdPointItems.forEach((item) => {
          const completion = reportItpInstance.completions.find(
            (c) => c.checklistItemId === item.id && c.isVerified,
          );
          if (completion) {
            holdPointReleases.push({
              checklistItemDescription: item.description,
              releasedAt: completion.verifiedAt || completion.completedAt || '',
              releasedBy: completion.verifiedBy || completion.completedBy,
            });
          }
        });
      }

      // Prepare data for PDF
      const reportData: ConformanceReportData = {
        lot: {
          lotNumber: lot.lotNumber,
          description: lot.description,
          status: lot.status,
          activityType: lot.activityType,
          chainageStart: lot.chainageStart,
          chainageEnd: lot.chainageEnd,
          layer: lot.layer,
          areaZone: lot.areaZone,
          conformedAt: lot.conformedAt,
          conformedBy: lot.conformedBy,
        },
        project: {
          name: project.name,
          projectNumber: project.projectNumber || null,
        },
        itp: reportItpInstance
          ? {
              templateName: reportItpInstance.template?.name || 'Unknown Template',
              checklistItems: reportItpInstance.template?.checklistItems || [],
              completions: reportItpInstance.completions || [],
            }
          : null,
        testResults: testsData.testResults || [],
        ncrs: ncrsData.ncrs || [],
        holdPointReleases,
        photoCount,
      };

      // Generate PDF with selected format
      const { defaultConformanceOptions, generateConformanceReportPDF } =
        await import('@/lib/pdfGenerator');
      const formatOptions: ConformanceFormatOptions = {
        ...defaultConformanceOptions,
        format: selectedReportFormat,
        clientName: project.clientName || undefined,
        contractNumber: project.projectNumber || undefined,
      };
      await generateConformanceReportPDF(reportData, formatOptions);

      const formatName =
        selectedReportFormat === 'standard'
          ? ''
          : ` (${selectedReportFormat.toUpperCase()} format)`;
      toast({
        title: 'Report generated',
        description: `The conformance report PDF${formatName} has been downloaded.`,
      });
    } catch (err) {
      handleApiError(err, 'Failed to generate conformance report');
    } finally {
      setGeneratingReport(false);
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

  // Valid statuses for override
  const validStatuses = [
    { value: 'not_started', label: 'Not Started' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'awaiting_test', label: 'Awaiting Test' },
    { value: 'hold_point', label: 'Hold Point' },
    { value: 'ncr_raised', label: 'NCR Raised' },
    { value: 'completed', label: 'Completed' },
  ];

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

      {/* Tab Navigation */}
      <LotTabNavigation
        tabs={tabs}
        currentTab={currentTab}
        onTabChange={handleTabChange}
        counts={{ tests: testsCount, ncrs: ncrsCount }}
      />

      {/* Tab Content */}
      <div className="min-h-[300px]" role="tabpanel">
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
              onToggleCompletion={handleToggleCompletion}
              onUpdateNotes={handleUpdateNotes}
              onMarkAsNA={handleMobileMarkNA}
              onMarkAsFailed={handleMobileMarkFailed}
              onAddPhoto={handleMobileAddPhoto}
              onAddPhotoDesktop={handleAddPhoto}
              onAssignTemplate={handleAssignTemplate}
              onRetryItp={() => void fetchItpInstance()}
              assigningTemplate={assigningTemplate}
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
        canVerifyTestResults={canVerifyTestResults}
        conforming={conforming}
        generatingReport={generatingReport}
        showReportFormatDialog={showReportFormatDialog}
        selectedReportFormat={selectedReportFormat}
        onConformLot={() => setShowConformConfirm(true)}
        onTabChange={handleTabChange}
        onShowReportDialog={handleShowReportDialog}
        onGenerateReport={handleGenerateReport}
        onCloseReportDialog={() => setShowReportFormatDialog(false)}
        onReportFormatChange={setSelectedReportFormat}
      />

      {/* Status Override Modal */}
      <StatusOverrideModal
        isOpen={showOverrideModal}
        currentStatus={lot.status}
        validStatuses={validStatuses}
        onClose={() => setShowOverrideModal(false)}
        onSubmit={handleOverrideStatus}
        isSubmitting={overriding}
      />

      {/* Assign Subcontractor Modal */}
      {showSubcontractorModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Assign Subcontractor</h2>
                <p className="text-sm text-muted-foreground">
                  Assign this lot to a subcontractor company
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Lot</label>
                <div className="px-3 py-2 rounded border bg-muted/50">
                  <span className="font-medium">{lot.lotNumber}</span>
                  {lot.description && (
                    <span className="text-muted-foreground"> - {lot.description}</span>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="subcontractor-select" className="block text-sm font-medium mb-1">
                  Subcontractor Company
                </label>
                <select
                  id="subcontractor-select"
                  value={selectedSubcontractor}
                  onChange={(e) => setSelectedSubcontractor(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg bg-background"
                >
                  <option value="">No subcontractor assigned</option>
                  {subcontractors
                    .filter((sub) => sub.status === 'approved')
                    .map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.companyName}
                      </option>
                    ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  Only approved subcontractors are shown. The subcontractor users will be notified.
                </p>
              </div>

              {lot.assignedSubcontractorId &&
                selectedSubcontractor !== lot.assignedSubcontractorId && (
                  <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <strong>Note:</strong> This will change the assigned subcontractor from{' '}
                    <span className="font-medium">
                      {lot.assignedSubcontractor?.companyName || 'current'}
                    </span>{' '}
                    to{' '}
                    <span className="font-medium">
                      {selectedSubcontractor
                        ? subcontractors.find((s) => s.id === selectedSubcontractor)?.companyName
                        : 'none'}
                    </span>
                    .
                  </div>
                )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowSubcontractorModal(false);
                  setSelectedSubcontractor('');
                }}
                className="px-4 py-2 border rounded-lg hover:bg-muted"
                disabled={assigningSubcontractor}
              >
                Cancel
              </button>
              <button
                onClick={handleAssignSubcontractor}
                disabled={assigningSubcontractor}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {assigningSubcontractor
                  ? 'Assigning...'
                  : selectedSubcontractor
                    ? 'Assign Subcontractor'
                    : 'Remove Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}

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
            handleToggleCompletion(
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
        onSubmit={handleMarkAsNA}
        isSubmitting={submittingNa}
      />

      {/* Mark as Failed Modal - Creates NCR */}
      <MarkAsFailedModal
        isOpen={!!failedModal}
        itemDescription={failedModal?.itemDescription || ''}
        onClose={() => setFailedModal(null)}
        onSubmit={handleMarkAsFailed}
        isSubmitting={submittingFailed}
      />

      {/* Witness Point Completion Modal */}
      <WitnessPointModal
        isOpen={!!witnessModal}
        itemDescription={witnessModal?.itemDescription || ''}
        onClose={() => setWitnessModal(null)}
        onSubmit={handleCompleteWitnessPoint}
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

      <ConfirmDialog
        open={showConformConfirm}
        title="Conform Lot"
        description={
          <>
            <p>Mark {lot?.lotNumber || 'this lot'} as quality-approved?</p>
            <p>This changes the lot status to conformed.</p>
          </>
        }
        confirmLabel="Conform Lot"
        onCancel={() => setShowConformConfirm(false)}
        onConfirm={() => void handleConformLot()}
      />
    </div>
  );
}
