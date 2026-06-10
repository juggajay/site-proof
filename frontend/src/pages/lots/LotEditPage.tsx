import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useCommercialAccess } from '@/hooks/useCommercialAccess';
import { getAuthToken, getCurrentUser } from '@/lib/auth';
import { apiFetch, ApiError, isRetriableNetworkFailure } from '@/lib/api';
import { extractErrorMessage, extractErrorDetails, hasStatus } from '@/lib/errorHandling';
import { useOfflineStatus } from '@/lib/useOfflineStatus';
import { cacheLotForOfflineEdit, saveLotEditOffline, getOfflineLot } from '@/lib/offlineDb';
import { toast } from '@/components/ui/toaster';
import { parseOptionalNonNegativeDecimalInput } from '@/lib/numericInput';
import {
  buildLotDetailPath,
  buildLotUpdatePayload,
  buildOfflineLotCacheInput,
  buildOfflineLotEditInput,
  deriveLotEditLocks,
  getOptionalDecimalValidationError,
  mapLotToFormData,
  mapOfflineLotToFormData,
  mapOfflineLotToLot,
  useProjectSubcontractorsQuery,
  type Lot,
  type LotEditFormData,
  type LotResponse,
} from './lotEditData';
import { LotEditFormFields } from './components/LotEditFormFields';
import { LotEditDialogs } from './components/LotEditDialogs';
import {
  LotEditErrorState,
  LotEditFormActions,
  LotEditHeader,
  LotEditLoadingState,
  LotEditLockedWarning,
  LotEditSaveError,
  type LotEditOfflineSyncStatus,
} from './components/LotEditPageChrome';

export function LotEditPage() {
  const { projectId, lotId } = useParams();
  const navigate = useNavigate();
  const { canViewBudgets } = useCommercialAccess();
  const { isOnline } = useOfflineStatus();
  const [lot, setLot] = useState<Lot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const subcontractorsQuery = useProjectSubcontractorsQuery(projectId);
  const subcontractors = subcontractorsQuery.data ?? [];
  const [offlineSyncStatus, setOfflineSyncStatus] = useState<LotEditOfflineSyncStatus>('synced');
  const [serverUpdatedAt, setServerUpdatedAt] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<LotEditFormData>({
    lotNumber: '',
    description: '',
    activityType: '',
    chainageStart: '',
    chainageEnd: '',
    offset: '',
    offsetCustom: '',
    layer: '',
    areaZone: '',
    status: '',
    budgetAmount: '',
    assignedSubcontractorId: '',
  });

  // Track if form has unsaved changes
  const [isDirty, setIsDirty] = useState(false);
  const initialFormData = useRef<typeof formData | null>(null);

  // State for showing unsaved changes dialog
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const pendingNavigationRef = useRef<string | null>(null);

  // Feature #871: State for concurrent edit warning
  const [showConcurrentEditWarning, setShowConcurrentEditWarning] = useState(false);
  const [concurrentEditInfo, setConcurrentEditInfo] = useState<{ serverUpdatedAt: string } | null>(
    null,
  );

  // Handle browser refresh/close
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Safe navigation function that checks for unsaved changes
  const safeNavigate = useCallback(
    (path: string) => {
      if (isDirty) {
        pendingNavigationRef.current = path;
        setShowUnsavedDialog(true);
      } else {
        navigate(path);
      }
    },
    [isDirty, navigate],
  );

  // Handle dialog confirmation
  const handleConfirmLeave = () => {
    setShowUnsavedDialog(false);
    setIsDirty(false);
    if (pendingNavigationRef.current) {
      navigate(pendingNavigationRef.current);
    }
  };

  const handleCancelLeave = () => {
    setShowUnsavedDialog(false);
    pendingNavigationRef.current = null;
  };

  useEffect(() => {
    async function fetchLot() {
      if (!lotId || !projectId) return;

      const token = getAuthToken();
      const user = getCurrentUser();

      // First, check if we have an offline version with pending changes
      const offlineLot = await getOfflineLot(lotId);
      if (offlineLot && offlineLot.syncStatus !== 'synced') {
        // We have pending offline changes
        setOfflineSyncStatus(offlineLot.syncStatus);

        // Populate form with offline data
        const initialData = mapOfflineLotToFormData(offlineLot);
        setFormData(initialData);
        initialFormData.current = initialData;
        setLot(mapOfflineLotToLot(offlineLot));
        setLoading(false);

        // If online, still try to fetch from server to check for conflicts
        if (!isOnline) {
          return;
        }
      }

      if (!token) {
        if (!isOnline && offlineLot) {
          // Offline mode with cached data - already handled above
          return;
        }
        navigate('/login');
        return;
      }

      try {
        const data = await apiFetch<LotResponse>(buildLotDetailPath(lotId));
        const loadedLot = data.lot;
        setLot(loadedLot);
        setServerUpdatedAt(loadedLot.updatedAt);

        // Cache lot for offline editing
        if (user) {
          await cacheLotForOfflineEdit(
            buildOfflineLotCacheInput(loadedLot, projectId),
            loadedLot.updatedAt,
            user.id,
          );
        }

        // Populate form with lot data
        const initialData = mapLotToFormData(loadedLot);
        setFormData(initialData);
        initialFormData.current = initialData;
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.status === 404) {
            setError('Lot not found');
            setLoading(false);
            return;
          }
          if (err.status === 403) {
            setError('You do not have access to this lot');
            setLoading(false);
            return;
          }
        }
        // If offline and we have cached data, use it
        if (!isOnline && offlineLot) {
          toast({
            title: 'Offline mode',
            description: 'Working with cached data',
          });
          return;
        }
        setError('Failed to load lot');
      } finally {
        setLoading(false);
      }
    }

    fetchLot();
  }, [lotId, projectId, navigate, isOnline]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const newData = { ...prev, [name]: value };
      // Check if form is dirty by comparing to initial data
      if (initialFormData.current) {
        const hasChanges = Object.keys(newData).some(
          (key) =>
            newData[key as keyof typeof newData] !==
            initialFormData.current![key as keyof typeof newData],
        );
        setIsDirty(hasChanges);
      }
      return newData;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);

    const chainageStartError = getOptionalDecimalValidationError(
      formData.chainageStart,
      'Chainage start',
    );
    if (chainageStartError) {
      setSaveError(chainageStartError);
      return;
    }

    const chainageEndError = getOptionalDecimalValidationError(
      formData.chainageEnd,
      'Chainage end',
    );
    if (chainageEndError) {
      setSaveError(chainageEndError);
      return;
    }

    const budgetError = canViewBudgets
      ? getOptionalDecimalValidationError(formData.budgetAmount, 'Budget amount')
      : null;
    if (budgetError) {
      setSaveError(budgetError);
      return;
    }

    const parsedChainageStart = parseOptionalNonNegativeDecimalInput(formData.chainageStart);
    const parsedChainageEnd = parseOptionalNonNegativeDecimalInput(formData.chainageEnd);
    const parsedBudgetAmount = parseOptionalNonNegativeDecimalInput(formData.budgetAmount);
    const isConformedBudgetOnlyMode = lot?.status === 'conformed' && canViewBudgets;

    if (
      parsedChainageStart !== null &&
      parsedChainageEnd !== null &&
      parsedChainageStart > parsedChainageEnd
    ) {
      setSaveError('Chainage start must be less than or equal to chainage end.');
      return;
    }

    if (isConformedBudgetOnlyMode && parsedBudgetAmount === null) {
      setSaveError('Budget amount is required before this conformed lot can be claimed.');
      return;
    }

    setSaving(true);

    const token = getAuthToken();
    const user = getCurrentUser();

    // Build update payload
    const updatePayload = buildLotUpdatePayload({
      formData,
      parsedChainageStart,
      parsedChainageEnd,
      parsedBudgetAmount,
      isConformedBudgetOnlyMode,
      canViewBudgets,
      serverUpdatedAt,
    });

    // If offline, save to IndexedDB and queue for sync
    if (!isOnline && isConformedBudgetOnlyMode) {
      setSaveError('Budget updates on conformed lots require an internet connection.');
      setSaving(false);
      return;
    }

    if (!isOnline && lotId && projectId && user) {
      try {
        await saveLotEditOffline(
          buildOfflineLotEditInput({
            lotId,
            projectId,
            formData,
            parsedChainageStart,
            parsedChainageEnd,
            parsedBudgetAmount,
            serverUpdatedAt,
            userId: user.id,
          }),
        );

        toast({
          title: 'Changes saved offline',
          description: "Your changes will sync when you're back online.",
          variant: 'success',
        });
        setOfflineSyncStatus('pending');
        setIsDirty(false);
        navigate(`/projects/${projectId}/lots/${lotId}`);
        return;
      } catch {
        setSaveError('Failed to save changes offline');
        setSaving(false);
        return;
      }
    }

    if (!token) {
      navigate('/login');
      return;
    }

    try {
      await apiFetch(`/api/lots/${lotId}`, {
        method: 'PATCH',
        body: JSON.stringify(updatePayload),
      });

      // Clear dirty state before navigating
      setIsDirty(false);
      // Navigate back to lot detail page
      navigate(`/projects/${projectId}/lots/${lotId}`);
    } catch (err) {
      // Feature #871: Handle concurrent edit conflict
      if (hasStatus(err, 409)) {
        const details = extractErrorDetails(err);
        const serverUpdatedAt =
          typeof details?.serverUpdatedAt === 'string' ? details.serverUpdatedAt : '';
        setConcurrentEditInfo({ serverUpdatedAt });
        setShowConcurrentEditWarning(true);
        setSaving(false);
        return;
      }
      // On a retriable network failure (browser offline, timeout, fetch-level
      // failure, or 5xx) save offline; definitive 4xx rejections surface below.
      if (isRetriableNetworkFailure(err) && lotId && projectId && user) {
        try {
          await saveLotEditOffline(
            buildOfflineLotEditInput({
              lotId,
              projectId,
              formData,
              parsedChainageStart,
              parsedChainageEnd,
              parsedBudgetAmount,
              serverUpdatedAt,
              userId: user.id,
            }),
          );

          toast({
            title: 'Changes saved offline',
            description: "Your changes will sync when you're back online.",
            variant: 'success',
          });
          setOfflineSyncStatus('pending');
          setIsDirty(false);
          navigate(`/projects/${projectId}/lots/${lotId}`);
          return;
        } catch {
          // Fall through to regular error
        }
      }
      setSaveError(extractErrorMessage(err, 'Failed to save changes'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LotEditLoadingState />;
  }

  if (error) {
    return <LotEditErrorState error={error} onGoBack={() => navigate(-1)} />;
  }

  if (!lot) {
    return null;
  }

  // Conformed lots keep QA fields locked but allow commercial budget repair before claiming.
  const { canEditConformedBudget, detailsLocked, budgetLocked, canSubmit } = deriveLotEditLocks(
    lot,
    canViewBudgets,
  );

  return (
    <div className="space-y-6 p-6 max-w-3xl mx-auto pb-32 md:pb-6">
      <LotEditHeader
        lotNumber={lot.lotNumber}
        offlineSyncStatus={offlineSyncStatus}
        isOnline={isOnline}
        onCancel={() => safeNavigate(`/projects/${projectId}/lots/${lotId}`)}
      />

      <LotEditLockedWarning
        detailsLocked={detailsLocked}
        canEditConformedBudget={canEditConformedBudget}
        lotStatus={lot.status}
      />
      <LotEditSaveError saveError={saveError} />

      <LotEditDialogs
        showUnsavedDialog={showUnsavedDialog}
        onCancelLeave={handleCancelLeave}
        onConfirmLeave={handleConfirmLeave}
        showConcurrentEditWarning={showConcurrentEditWarning}
        serverUpdatedAt={concurrentEditInfo?.serverUpdatedAt ?? null}
        onCloseConcurrentWarning={() => setShowConcurrentEditWarning(false)}
        onRefreshPage={() => window.location.reload()}
      />

      {/* Edit Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <LotEditFormFields
          formData={formData}
          onInputChange={handleInputChange}
          detailsLocked={detailsLocked}
          budgetLocked={budgetLocked}
          canViewBudgets={canViewBudgets}
          subcontractors={subcontractors}
        />

        <LotEditFormActions
          canSubmit={canSubmit}
          saving={saving}
          onCancel={() => safeNavigate(`/projects/${projectId}/lots/${lotId}`)}
        />
      </form>
    </div>
  );
}
