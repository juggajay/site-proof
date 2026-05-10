import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useCommercialAccess } from '@/hooks/useCommercialAccess';
import { getAuthToken, getCurrentUser } from '@/lib/auth';
import { apiFetch, ApiError } from '@/lib/api';
import { extractErrorMessage, extractErrorDetails, hasStatus } from '@/lib/errorHandling';
import { useOfflineStatus } from '@/lib/useOfflineStatus';
import { cacheLotForOfflineEdit, saveLotEditOffline, getOfflineLot } from '@/lib/offlineDb';
import { SyncStatusBadge } from '@/components/OfflineIndicator';
import { toast } from '@/components/ui/toaster';
import {
  Modal,
  AlertModalHeader,
  AlertModalDescription,
  ModalBody,
  AlertModalFooter,
} from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { logError } from '@/lib/logger';
import { parseOptionalNonNegativeDecimalInput } from '@/lib/numericInput';

interface Lot {
  id: string;
  lotNumber: string;
  description: string | null;
  status: string;
  activityType: string | null;
  chainageStart: number | null;
  chainageEnd: number | null;
  offset: string | null;
  offsetCustom: string | null;
  layer: string | null;
  areaZone: string | null;
  budgetAmount?: number | null;
  assignedSubcontractorId?: string | null;
}

interface Subcontractor {
  id: string;
  companyName: string;
  status: string;
}

interface LotResponse {
  lot: Lot & { updatedAt: string };
}

interface SubcontractorsResponse {
  subcontractors: Subcontractor[];
}

interface LotUpdatePayload {
  lotNumber: string;
  description: string | null;
  activityType: string | null;
  chainageStart: number | null;
  chainageEnd: number | null;
  offset: string | null;
  offsetCustom: string | null;
  layer: string | null;
  areaZone: string | null;
  status: string | null;
  budgetAmount?: number;
  assignedSubcontractorId?: string | null;
  expectedUpdatedAt?: string;
}

function getOptionalDecimalValidationError(value: string, fieldLabel: string): string | null {
  if (!value.trim()) return null;
  return parseOptionalNonNegativeDecimalInput(value) === null
    ? `${fieldLabel} must be a non-negative decimal number.`
    : null;
}

const ACTIVITY_TYPES = [
  'Earthworks',
  'Drainage',
  'Pavement',
  'Concrete',
  'Structures',
  'Landscaping',
  'Services',
  'Other',
];

const OFFSET_OPTIONS = ['left', 'right', 'full', 'custom'];

const STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'awaiting_test', label: 'Awaiting Test' },
  { value: 'hold_point', label: 'Hold Point' },
  { value: 'ncr_raised', label: 'NCR Raised' },
];

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
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [offlineSyncStatus, setOfflineSyncStatus] = useState<
    'synced' | 'pending' | 'conflict' | 'error'
  >('synced');
  const [serverUpdatedAt, setServerUpdatedAt] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
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
        // Note: OfflineLotEdit stores offset as number but we display as string option
        const offlineOffsetStr = offlineLot.offset !== undefined ? String(offlineLot.offset) : '';
        const initialData = {
          lotNumber: offlineLot.lotNumber || '',
          description: offlineLot.description || '',
          activityType: offlineLot.activityType || '',
          chainageStart: offlineLot.chainageStart?.toString() || '',
          chainageEnd: offlineLot.chainageEnd?.toString() || '',
          offset: offlineOffsetStr,
          offsetCustom: '', // OfflineLotEdit uses offsetLeft/offsetRight instead
          layer: offlineLot.layer || '',
          areaZone: offlineLot.areaZone || '',
          status: offlineLot.status || '',
          budgetAmount: offlineLot.budget?.toString() || '',
          assignedSubcontractorId: '',
        };
        setFormData(initialData);
        initialFormData.current = initialData;
        setLot({
          id: offlineLot.id,
          lotNumber: offlineLot.lotNumber,
          description: offlineLot.description || null,
          status: offlineLot.status || 'not_started',
          activityType: offlineLot.activityType || null,
          chainageStart: offlineLot.chainageStart ?? null,
          chainageEnd: offlineLot.chainageEnd ?? null,
          offset: offlineOffsetStr || null,
          offsetCustom: null, // OfflineLotEdit uses offsetLeft/offsetRight instead
          layer: offlineLot.layer || null,
          areaZone: offlineLot.areaZone || null,
          budgetAmount: offlineLot.budget,
          assignedSubcontractorId: null,
        });
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
        const data = await apiFetch<LotResponse>(`/api/lots/${lotId}`);
        const loadedLot = data.lot;
        setLot(loadedLot);
        setServerUpdatedAt(loadedLot.updatedAt);

        // Cache lot for offline editing
        if (user) {
          await cacheLotForOfflineEdit(
            {
              id: loadedLot.id,
              projectId,
              lotNumber: loadedLot.lotNumber,
              description: loadedLot.description ?? undefined,
              chainageStart: loadedLot.chainageStart ?? undefined,
              chainageEnd: loadedLot.chainageEnd ?? undefined,
              layer: loadedLot.layer ?? undefined,
              areaZone: loadedLot.areaZone ?? undefined,
              activityType: loadedLot.activityType ?? undefined,
              status: loadedLot.status ?? undefined,
              budget: loadedLot.budgetAmount ?? undefined,
            },
            loadedLot.updatedAt,
            user.id,
          );
        }

        // Populate form with lot data
        const initialData = {
          lotNumber: loadedLot.lotNumber || '',
          description: loadedLot.description || '',
          activityType: loadedLot.activityType || '',
          chainageStart: loadedLot.chainageStart?.toString() || '',
          chainageEnd: loadedLot.chainageEnd?.toString() || '',
          offset: loadedLot.offset || '',
          offsetCustom: loadedLot.offsetCustom || '',
          layer: loadedLot.layer || '',
          areaZone: loadedLot.areaZone || '',
          status: loadedLot.status || '',
          budgetAmount: loadedLot.budgetAmount?.toString() || '',
          assignedSubcontractorId: loadedLot.assignedSubcontractorId || '',
        };
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

  // Fetch subcontractors for this project
  useEffect(() => {
    async function fetchSubcontractors() {
      if (!projectId) return;

      try {
        const data = await apiFetch<SubcontractorsResponse>(
          `/api/subcontractors/for-project/${projectId}`,
        );
        setSubcontractors(data.subcontractors || []);
      } catch (err) {
        logError('Failed to fetch subcontractors:', err);
      }
    }

    fetchSubcontractors();
  }, [projectId]);

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

    if (
      parsedChainageStart !== null &&
      parsedChainageEnd !== null &&
      parsedChainageStart > parsedChainageEnd
    ) {
      setSaveError('Chainage start must be less than or equal to chainage end.');
      return;
    }

    setSaving(true);

    const token = getAuthToken();
    const user = getCurrentUser();

    // Build update payload
    const updatePayload: LotUpdatePayload = {
      lotNumber: formData.lotNumber,
      description: formData.description || null,
      activityType: formData.activityType || null,
      chainageStart: parsedChainageStart,
      chainageEnd: parsedChainageEnd,
      offset: formData.offset || null,
      offsetCustom: formData.offset === 'custom' ? formData.offsetCustom || null : null,
      layer: formData.layer || null,
      areaZone: formData.areaZone || null,
      status: formData.status || null,
    };

    // Only include budget if user has access
    if (canViewBudgets && parsedBudgetAmount !== null) {
      updatePayload.budgetAmount = parsedBudgetAmount;
    }

    // Include subcontractor assignment (can be null to unassign)
    if (canViewBudgets) {
      updatePayload.assignedSubcontractorId = formData.assignedSubcontractorId || null;
    }

    // Feature #871: Include expected version for concurrent edit detection
    if (serverUpdatedAt) {
      updatePayload.expectedUpdatedAt = serverUpdatedAt;
    }

    // If offline, save to IndexedDB and queue for sync
    if (!isOnline && lotId && projectId && user) {
      try {
        await saveLotEditOffline({
          id: lotId,
          projectId,
          lotNumber: formData.lotNumber,
          description: formData.description || undefined,
          chainage: parsedChainageStart ?? undefined,
          chainageStart: parsedChainageStart ?? undefined,
          chainageEnd: parsedChainageEnd ?? undefined,
          offset: formData.offset ? parseFloat(formData.offset) || undefined : undefined,
          layer: formData.layer || undefined,
          areaZone: formData.areaZone || undefined,
          activityType: formData.activityType || undefined,
          status: formData.status || undefined,
          budget: parsedBudgetAmount ?? undefined,
          notes: undefined,
          syncStatus: 'pending',
          localUpdatedAt: new Date().toISOString(),
          serverUpdatedAt: serverUpdatedAt || undefined,
          editedBy: user.id,
        });

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
      // If network error and we're actually offline, save offline
      if (!navigator.onLine && lotId && projectId && user) {
        try {
          await saveLotEditOffline({
            id: lotId,
            projectId,
            lotNumber: formData.lotNumber,
            description: formData.description || undefined,
            chainage: parsedChainageStart ?? undefined,
            chainageStart: parsedChainageStart ?? undefined,
            chainageEnd: parsedChainageEnd ?? undefined,
            offset: formData.offset ? parseFloat(formData.offset) || undefined : undefined,
            layer: formData.layer || undefined,
            areaZone: formData.areaZone || undefined,
            activityType: formData.activityType || undefined,
            status: formData.status || undefined,
            budget: parsedBudgetAmount ?? undefined,
            notes: undefined,
            syncStatus: 'pending',
            localUpdatedAt: new Date().toISOString(),
            serverUpdatedAt: serverUpdatedAt || undefined,
            editedBy: user.id,
          });

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
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
        <div className="text-6xl">!</div>
        <h1 className="text-2xl font-bold text-destructive">Error</h1>
        <p className="text-muted-foreground text-center max-w-md">{error}</p>
        <button
          type="button"
          onClick={() => navigate(-1)}
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

  // Check if lot is in a non-editable state
  const isLocked = lot.status === 'conformed' || lot.status === 'claimed';

  return (
    <div className="space-y-6 p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Edit Lot</h1>
            {offlineSyncStatus !== 'synced' && <SyncStatusBadge status={offlineSyncStatus} />}
            {!isOnline && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                Offline Mode
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">Editing lot {lot.lotNumber}</p>
        </div>
        <button
          type="button"
          onClick={() => safeNavigate(`/projects/${projectId}/lots/${lotId}`)}
          className="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
        >
          Cancel
        </button>
      </div>

      {/* Locked Warning */}
      {isLocked && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
          <strong>Note:</strong> This lot is {lot.status} and cannot be edited.
        </div>
      )}

      {/* Save Error */}
      {saveError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {saveError}
        </div>
      )}

      {/* Unsaved Changes Dialog */}
      {showUnsavedDialog && (
        <Modal alert onClose={handleCancelLeave} className="max-w-md">
          <AlertModalHeader>Unsaved Changes</AlertModalHeader>
          <AlertModalDescription>
            You have unsaved changes. Are you sure you want to leave this page? Your changes will be
            lost.
          </AlertModalDescription>
          <AlertModalFooter>
            <Button variant="outline" onClick={handleCancelLeave}>
              Stay on Page
            </Button>
            <Button variant="destructive" onClick={handleConfirmLeave}>
              Leave Page
            </Button>
          </AlertModalFooter>
        </Modal>
      )}

      {/* Feature #871: Concurrent Edit Warning Dialog */}
      {showConcurrentEditWarning && (
        <Modal alert onClose={() => setShowConcurrentEditWarning(false)} className="max-w-md">
          <AlertModalHeader>
            <span className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-amber-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </span>
              Concurrent Edit Detected
            </span>
          </AlertModalHeader>
          <AlertModalDescription>
            This lot has been modified by another user while you were editing.
          </AlertModalDescription>
          <ModalBody>
            <p className="text-sm text-muted-foreground mb-4">
              Last modified:{' '}
              {concurrentEditInfo?.serverUpdatedAt
                ? new Date(concurrentEditInfo.serverUpdatedAt).toLocaleString()
                : 'Unknown'}
            </p>
            <p className="text-sm">
              Your changes could not be saved. Please refresh the page to see the latest version,
              then re-apply your changes.
            </p>
          </ModalBody>
          <AlertModalFooter>
            <Button variant="outline" onClick={() => setShowConcurrentEditWarning(false)}>
              Continue Editing
            </Button>
            <Button onClick={() => window.location.reload()}>Refresh Page</Button>
          </AlertModalFooter>
        </Modal>
      )}

      {/* Edit Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="rounded-lg border p-6 space-y-4">
          <h2 className="text-lg font-semibold">Basic Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="lotNumber" className="block text-sm font-medium mb-1">
                Lot Number *
              </label>
              <input
                type="text"
                id="lotNumber"
                name="lotNumber"
                value={formData.lotNumber}
                onChange={handleInputChange}
                disabled={isLocked}
                required
                className="w-full rounded-lg border px-3 py-2 disabled:bg-muted disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label htmlFor="status" className="block text-sm font-medium mb-1">
                Status
              </label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                disabled={isLocked}
                className="w-full rounded-lg border px-3 py-2 disabled:bg-muted disabled:cursor-not-allowed"
              >
                <option value="">Select status</option>
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-1">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              disabled={isLocked}
              rows={3}
              className="w-full rounded-lg border px-3 py-2 disabled:bg-muted disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label htmlFor="activityType" className="block text-sm font-medium mb-1">
              Activity Type
            </label>
            <select
              id="activityType"
              name="activityType"
              value={formData.activityType}
              onChange={handleInputChange}
              disabled={isLocked}
              className="w-full rounded-lg border px-3 py-2 disabled:bg-muted disabled:cursor-not-allowed"
            >
              <option value="">Select activity type</option>
              {ACTIVITY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Location */}
        <div className="rounded-lg border p-6 space-y-4">
          <h2 className="text-lg font-semibold">Location</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="chainageStart" className="block text-sm font-medium mb-1">
                Chainage Start
              </label>
              <input
                type="number"
                id="chainageStart"
                name="chainageStart"
                value={formData.chainageStart}
                onChange={handleInputChange}
                disabled={isLocked}
                step="0.01"
                className="w-full rounded-lg border px-3 py-2 disabled:bg-muted disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label htmlFor="chainageEnd" className="block text-sm font-medium mb-1">
                Chainage End
              </label>
              <input
                type="number"
                id="chainageEnd"
                name="chainageEnd"
                value={formData.chainageEnd}
                onChange={handleInputChange}
                disabled={isLocked}
                step="0.01"
                className="w-full rounded-lg border px-3 py-2 disabled:bg-muted disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label htmlFor="offset" className="block text-sm font-medium mb-1">
                Offset
              </label>
              <select
                id="offset"
                name="offset"
                value={formData.offset}
                onChange={handleInputChange}
                disabled={isLocked}
                className="w-full rounded-lg border px-3 py-2 disabled:bg-muted disabled:cursor-not-allowed"
              >
                <option value="">Select offset</option>
                {OFFSET_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {formData.offset === 'custom' && (
              <div>
                <label htmlFor="offsetCustom" className="block text-sm font-medium mb-1">
                  Custom Offset Value
                </label>
                <input
                  type="text"
                  id="offsetCustom"
                  name="offsetCustom"
                  value={formData.offsetCustom}
                  onChange={handleInputChange}
                  disabled={isLocked}
                  placeholder="e.g., +2.5m, -1.0m CL"
                  className="w-full rounded-lg border px-3 py-2 disabled:bg-muted disabled:cursor-not-allowed"
                />
              </div>
            )}

            <div>
              <label htmlFor="layer" className="block text-sm font-medium mb-1">
                Layer
              </label>
              <input
                type="text"
                id="layer"
                name="layer"
                value={formData.layer}
                onChange={handleInputChange}
                disabled={isLocked}
                className="w-full rounded-lg border px-3 py-2 disabled:bg-muted disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label htmlFor="areaZone" className="block text-sm font-medium mb-1">
                Area/Zone
              </label>
              <input
                type="text"
                id="areaZone"
                name="areaZone"
                value={formData.areaZone}
                onChange={handleInputChange}
                disabled={isLocked}
                className="w-full rounded-lg border px-3 py-2 disabled:bg-muted disabled:cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {/* Commercial (only for users with budget access) */}
        {canViewBudgets && (
          <div className="rounded-lg border p-6 space-y-4">
            <h2 className="text-lg font-semibold">Commercial</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="budgetAmount" className="block text-sm font-medium mb-1">
                  Budget Amount ($)
                </label>
                <input
                  type="number"
                  id="budgetAmount"
                  name="budgetAmount"
                  value={formData.budgetAmount}
                  onChange={handleInputChange}
                  disabled={isLocked}
                  step="0.01"
                  className="w-full rounded-lg border px-3 py-2 disabled:bg-muted disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label htmlFor="assignedSubcontractorId" className="block text-sm font-medium mb-1">
                  Assigned Subcontractor
                </label>
                <select
                  id="assignedSubcontractorId"
                  name="assignedSubcontractorId"
                  value={formData.assignedSubcontractorId}
                  onChange={handleInputChange}
                  disabled={isLocked}
                  className="w-full rounded-lg border px-3 py-2 disabled:bg-muted disabled:cursor-not-allowed"
                >
                  <option value="">No subcontractor assigned</option>
                  {subcontractors.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.companyName} {sub.status === 'pending' ? '(Pending)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => safeNavigate(`/projects/${projectId}/lots/${lotId}`)}
            className="rounded-lg border px-6 py-2 hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLocked || saving}
            className="rounded-lg bg-primary px-6 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
