import { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, authFetch } from '@/lib/api';
import { getAuthToken } from '@/lib/auth';
import { queryKeys } from '@/lib/queryKeys';
import { toast } from '@/components/ui/toaster';
import { Button } from '@/components/ui/button';
import {
  extractErrorMessage,
  extractErrorDetails,
  extractErrorCode,
  handleApiError,
} from '@/lib/errorHandling';
import type { HPEvidencePackageData } from '@/lib/pdfGenerator';
import { LazyHoldPointsChart } from '@/components/charts/LazyCharts';
import { formatDateKey } from '@/lib/localDate';
import { logError } from '@/lib/logger';

// Types
import type {
  HoldPoint,
  HoldPointDetails,
  HoldPointSortField,
  PrerequisiteItem,
  RequestError,
  StatusFilter,
} from './types';

interface EvidencePackageResponse {
  evidencePackage: HPEvidencePackageData;
}

interface ChaseHoldPointResponse {
  holdPoint?: {
    chaseCount?: number | null;
  };
}

interface UploadedEvidenceDocument {
  id: string;
  filename: string;
  fileUrl: string;
}

// Extracted components
import { HoldPointSummaryCards } from './components/HoldPointStatusFilter';
import { HoldPointsLoadErrorAlert, HoldPointsPageHeader } from './HoldPointsPageSections';
import { HoldPointsTable } from './components/HoldPointsTable';
import { HoldPointsMobileList } from './components/HoldPointsMobileList';
import { formatHoldPointDate, getStatusLabel } from './components/holdPointTableUtils';
import {
  buildHoldPointChartData,
  buildHoldPointLotOptions,
  buildHoldPointStats,
  filterHoldPoints,
  parseSortDirectionParam,
  parseSortFieldParam,
  parseStatusFilterParam,
  sortHoldPoints,
} from './holdPointsPageData';
import { fetchAllProjectHoldPoints } from './holdPointsApi';
import { RequestReleaseModal } from './components/RequestReleaseModal';
import { RecordReleaseModal } from './components/RecordReleaseModal';
import {
  BatchRequestReleaseModal,
  type BatchRequestReleaseSubmitData,
} from './components/BatchRequestReleaseModal';
import { downloadCsv } from '@/lib/csv';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { getReleaseIdentityText, getReleaseMethodLabel } from './holdPointReleaseIdentity';
import { isHoldPointBatchRequestReady } from './holdPointBatchSelection';
import { useRegisterDeepLink } from '@/hooks/useRegisterDeepLink';
import { useCurrentProjectRole } from '@/hooks/useCurrentProjectRole';

// Read side of the "Copy link" action (?hp=<id>): stable references so the
// deep-link effect doesn't re-run on every render.
const getHoldPointId = (hp: HoldPoint) => hp.id;
const HOLD_POINT_LINK_NOT_FOUND = {
  title: "Couldn't find that hold point",
  description: 'The link may belong to another project, or the hold point may have been removed.',
};

// Stable empty register so a disabled/loading query never churns hook deps.
const NO_HOLD_POINTS: HoldPoint[] = [];
const SUPERINTENDENT_RELEASE_ROLES = new Set([
  'owner',
  'admin',
  'project_manager',
  'superintendent',
]);
const SUPERINTENDENT_RELEASE_PERMISSION_MESSAGE =
  'This project requires superintendent, project manager, admin, or owner authorization before a manual release can be recorded.';

export function HoldPointsPage() {
  const { projectId } = useParams();
  const isMobile = useIsMobile();
  const currentProjectRole = useCurrentProjectRole(projectId);
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showBatchRequestModal, setShowBatchRequestModal] = useState(false);
  const [selectedHoldPoint, setSelectedHoldPoint] = useState<HoldPoint | null>(null);
  const [selectedBatchHoldPointIds, setSelectedBatchHoldPointIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [holdPointDetails, setHoldPointDetails] = useState<HoldPointDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [batchRequesting, setBatchRequesting] = useState(false);
  const [requestError, setRequestError] = useState<RequestError | null>(null);
  const [batchRequestError, setBatchRequestError] = useState<string | null>(null);
  const [copiedHpId, setCopiedHpId] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  const [chasingHpId, setChasingHpId] = useState<string | null>(null);
  const [showRecordReleaseModal, setShowRecordReleaseModal] = useState(false);
  const [recordingRelease, setRecordingRelease] = useState(false);
  const [recordReleaseError, setRecordReleaseError] = useState<string | null>(null);
  const generatingPdfRef = useRef<string | null>(null);
  const chasingHpRef = useRef<string | null>(null);
  const requestingRef = useRef(false);
  const batchRequestingRef = useRef(false);
  const recordingReleaseRef = useRef(false);

  // URL-persisted filter/sort state (LotsPage idiom) so register views survive
  // refresh and can be shared as links.
  const statusFilter = parseStatusFilterParam(searchParams.get('status'));
  const searchQuery = searchParams.get('search') || '';
  const requestedLotId = searchParams.get('lotId') || 'all';
  const sortField = parseSortFieldParam(searchParams.get('sort'));
  const sortDirection = parseSortDirectionParam(searchParams.get('dir'));

  // --- Data fetching ---

  const {
    data: holdPointsData,
    isLoading: loading,
    error: holdPointsError,
    refetch: refetchHoldPoints,
  } = useQuery({
    queryKey: queryKeys.holdPoints(projectId ?? ''),
    queryFn: () => fetchAllProjectHoldPoints(projectId!),
    enabled: Boolean(projectId),
    // Hold points are hard production gates: revisits render the cached
    // register instantly, and returning to the tab refreshes anything stale.
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    // Single attempt, like the bespoke fetch this replaced: failures surface
    // the register-level alert with its manual "Try again" immediately.
    retry: false,
  });
  const holdPoints = holdPointsData ?? NO_HOLD_POINTS;
  const loadError = holdPointsError
    ? extractErrorMessage(holdPointsError, 'Failed to load hold points.')
    : null;
  const requiresSuperintendentRelease = holdPointDetails?.approvalRequirement === 'superintendent';
  const currentUserCanRecordSuperintendentRelease =
    currentProjectRole !== null && SUPERINTENDENT_RELEASE_ROLES.has(currentProjectRole);
  const recordReleasePermissionMessage = loadingDetails
    ? 'Checking release permissions...'
    : requiresSuperintendentRelease && !currentUserCanRecordSuperintendentRelease
      ? SUPERINTENDENT_RELEASE_PERMISSION_MESSAGE
      : null;
  const canSubmitRecordRelease = !recordReleasePermissionMessage;

  // Mutation handlers await this so modals close only once the register
  // reflects the change. A failed refetch surfaces via the query error state
  // (the register-level alert) instead of rejecting here.
  const refreshHoldPoints = useCallback(async () => {
    if (!projectId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.holdPoints(projectId) }),
      queryClient.invalidateQueries({ queryKey: ['lot'] }),
      queryClient.invalidateQueries({ queryKey: ['lot-readiness'] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.lots(projectId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.claimReadiness(projectId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.foremanBadges(projectId) }),
    ]);
  }, [projectId, queryClient]);

  const handleRetryLoad = useCallback(() => {
    void refetchHoldPoints();
  }, [refetchHoldPoints]);

  const fetchHoldPointDetails = useCallback(async (hp: HoldPoint) => {
    setLoadingDetails(true);
    setRequestError(null);
    setHoldPointDetails(null);
    try {
      const data = await apiFetch<HoldPointDetails>(
        `/api/holdpoints/lot/${encodeURIComponent(hp.lotId)}/item/${encodeURIComponent(hp.itpChecklistItemId)}`,
      );
      setHoldPointDetails(data);
    } catch (err) {
      logError('Failed to fetch hold point details:', err);
      setRequestError({ message: extractErrorMessage(err, 'Could not load hold point details.') });
    } finally {
      setLoadingDetails(false);
    }
  }, []);

  // Deep link from a copied register link (?hp=<id>): scroll to + highlight
  // the linked hold point once the register has loaded, or toast if it isn't here.
  const { highlightedId: deepLinkedHpId } = useRegisterDeepLink({
    param: 'hp',
    loading: loading || Boolean(loadError),
    records: holdPoints,
    getRecordId: getHoldPointId,
    notFound: HOLD_POINT_LINK_NOT_FOUND,
  });

  // --- Derived data ---

  const lotOptions = useMemo(() => buildHoldPointLotOptions(holdPoints), [holdPoints]);

  const selectedLotId = useMemo(() => {
    if (requestedLotId === 'all') return 'all';
    return lotOptions.some((lot) => lot.lotId === requestedLotId) ? requestedLotId : 'all';
  }, [lotOptions, requestedLotId]);

  const filteredHoldPoints = useMemo(
    () =>
      sortHoldPoints(
        filterHoldPoints(holdPoints, statusFilter, searchQuery, new Date(), selectedLotId),
        sortField,
        sortDirection,
      ),
    [holdPoints, statusFilter, searchQuery, selectedLotId, sortField, sortDirection],
  );

  const batchEligibleHoldPoints = useMemo(
    () =>
      selectedLotId === 'all'
        ? []
        : filteredHoldPoints.filter(
            (hp) =>
              hp.lotId === selectedLotId &&
              hp.status === 'pending' &&
              isHoldPointBatchRequestReady(hp),
          ),
    [filteredHoldPoints, selectedLotId],
  );

  const batchBlockedHoldPointCount = useMemo(
    () =>
      selectedLotId === 'all'
        ? 0
        : filteredHoldPoints.filter(
            (hp) =>
              hp.lotId === selectedLotId &&
              hp.status === 'pending' &&
              !isHoldPointBatchRequestReady(hp),
          ).length,
    [filteredHoldPoints, selectedLotId],
  );

  const batchSelectableHoldPointIds = useMemo(
    () => new Set(batchEligibleHoldPoints.map((hp) => hp.id)),
    [batchEligibleHoldPoints],
  );

  const selectedBatchHoldPoints = useMemo(
    () => filteredHoldPoints.filter((hp) => selectedBatchHoldPointIds.has(hp.id)),
    [filteredHoldPoints, selectedBatchHoldPointIds],
  );

  const stats = useMemo(() => buildHoldPointStats(holdPoints), [holdPoints]);

  const chartData = useMemo(() => buildHoldPointChartData(holdPoints), [holdPoints]);

  useEffect(() => {
    setSelectedBatchHoldPointIds((current) => {
      const next = new Set(
        Array.from(current).filter((holdPointId) => batchSelectableHoldPointIds.has(holdPointId)),
      );
      return next.size === current.size ? current : next;
    });
  }, [batchSelectableHoldPointIds]);

  // --- Handlers ---

  const updateFilters = useCallback(
    (newParams: Record<string, string>) => {
      const params = new URLSearchParams(searchParams);
      Object.entries(newParams).forEach(([key, value]) => {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      });
      setSearchParams(params);
    },
    [searchParams, setSearchParams],
  );

  const handleStatusFilterChange = useCallback(
    (filter: StatusFilter) => updateFilters({ status: filter === 'all' ? '' : filter }),
    [updateFilters],
  );

  const handleLotFilterChange = useCallback(
    (lotId: string) => updateFilters({ lotId: lotId === 'all' ? '' : lotId }),
    [updateFilters],
  );

  const handleSearchChange = useCallback(
    (query: string) => updateFilters({ search: query }),
    [updateFilters],
  );

  const handleSort = useCallback(
    (field: HoldPointSortField) => {
      if (field === sortField) {
        updateFilters({ sort: field, dir: sortDirection === 'asc' ? 'desc' : 'asc' });
      } else {
        updateFilters({ sort: field, dir: 'asc' });
      }
    },
    [sortField, sortDirection, updateFilters],
  );

  const handleGenerateEvidencePackage = useCallback(async (hp: HoldPoint) => {
    if (hp.id.startsWith('virtual-') || generatingPdfRef.current === hp.id) return;
    generatingPdfRef.current = hp.id;
    setGeneratingPdf(hp.id);
    try {
      const data = await apiFetch<EvidencePackageResponse>(
        `/api/holdpoints/${encodeURIComponent(hp.id)}/evidence-package`,
      );
      const { generateHPEvidencePackagePDF } = await import('@/lib/pdfGenerator');
      await generateHPEvidencePackagePDF(data.evidencePackage);
      toast({
        title: 'Evidence Package Generated',
        description: `PDF downloaded for ${hp.lotNumber}`,
      });
    } catch (err) {
      handleApiError(err, 'Failed to generate evidence package PDF');
    } finally {
      generatingPdfRef.current = null;
      setGeneratingPdf(null);
    }
  }, []);

  const handleCopyHpLink = useCallback(
    async (hpId: string, lotNumber: string, _description: string) => {
      if (!projectId) return;

      const url = `${window.location.origin}/projects/${encodeURIComponent(projectId)}/hold-points?hp=${encodeURIComponent(hpId)}`;
      try {
        await navigator.clipboard.writeText(url);
        setCopiedHpId(hpId);
        toast({
          title: 'Link copied!',
          description: `Link to HP for ${lotNumber} has been copied.`,
        });
        setTimeout(() => setCopiedHpId(null), 2000);
      } catch {
        const textArea = document.createElement('textarea');
        textArea.value = url;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopiedHpId(hpId);
        toast({
          title: 'Link copied!',
          description: `Link to HP for ${lotNumber} has been copied.`,
        });
        setTimeout(() => setCopiedHpId(null), 2000);
      }
    },
    [projectId],
  );

  const handleRequestRelease = useCallback(
    (hp: HoldPoint) => {
      setSelectedHoldPoint(hp);
      setHoldPointDetails(null);
      setShowRequestModal(true);
      fetchHoldPointDetails(hp);
    },
    [fetchHoldPointDetails],
  );

  const handleToggleBatchSelection = useCallback(
    (hp: HoldPoint) => {
      if (!batchSelectableHoldPointIds.has(hp.id)) return;

      setSelectedBatchHoldPointIds((current) => {
        const next = new Set(current);
        if (next.has(hp.id)) {
          next.delete(hp.id);
        } else {
          next.add(hp.id);
        }
        return next;
      });
    },
    [batchSelectableHoldPointIds],
  );

  const handleSelectAllBatchEligible = useCallback(() => {
    setSelectedBatchHoldPointIds(new Set(batchEligibleHoldPoints.map((hp) => hp.id)));
  }, [batchEligibleHoldPoints]);

  const handleClearBatchSelection = useCallback(() => {
    setSelectedBatchHoldPointIds(new Set());
  }, []);

  const handleRecordRelease = useCallback(
    (hp: HoldPoint) => {
      setSelectedHoldPoint(hp);
      setHoldPointDetails(null);
      setRequestError(null);
      setRecordReleaseError(null);
      setShowRecordReleaseModal(true);
      fetchHoldPointDetails(hp);
    },
    [fetchHoldPointDetails],
  );

  const handleChaseHoldPoint = useCallback(
    async (hp: HoldPoint) => {
      if (hp.id.startsWith('virtual-') || chasingHpRef.current === hp.id) return;
      chasingHpRef.current = hp.id;
      setChasingHpId(hp.id);
      try {
        const data = await apiFetch<ChaseHoldPointResponse>(
          `/api/holdpoints/${encodeURIComponent(hp.id)}/chase`,
          { method: 'POST' },
        );
        await refreshHoldPoints();
        toast({
          title: 'Chase sent',
          description: `Follow-up notification sent for ${hp.lotNumber}. Chase count: ${data.holdPoint?.chaseCount || 1}`,
        });
      } catch (err) {
        handleApiError(err, 'Failed to send chase notification');
      } finally {
        chasingHpRef.current = null;
        setChasingHpId(null);
      }
    },
    [refreshHoldPoints],
  );

  const handleSubmitRequest = useCallback(
    async (
      scheduledDate: string,
      scheduledTime: string,
      notificationSentTo: string,
      overrideNoticePeriod?: boolean,
      overrideReason?: string,
      evidenceDocumentIds?: string[],
    ) => {
      if (!selectedHoldPoint || requestingRef.current) return;
      requestingRef.current = true;
      setRequesting(true);
      setRequestError(null);
      try {
        await apiFetch(`/api/holdpoints/request-release`, {
          method: 'POST',
          body: JSON.stringify({
            lotId: selectedHoldPoint.lotId,
            itpChecklistItemId: selectedHoldPoint.itpChecklistItemId,
            scheduledDate: scheduledDate || null,
            scheduledTime: scheduledTime || null,
            notificationSentTo: notificationSentTo.trim() || null,
            evidenceDocumentIds: evidenceDocumentIds || [],
            noticePeriodOverride: overrideNoticePeriod || false,
            noticePeriodOverrideReason: overrideReason?.trim() || null,
          }),
        });
        await refreshHoldPoints();
        setShowRequestModal(false);
        setSelectedHoldPoint(null);
        setHoldPointDetails(null);
      } catch (err) {
        const details = extractErrorDetails(err);
        const code = extractErrorCode(err);
        const incompleteItems = Array.isArray(details?.incompleteItems)
          ? (details.incompleteItems as PrerequisiteItem[])
          : undefined;
        if (incompleteItems) {
          setRequestError({
            message: extractErrorMessage(err, 'Failed to request release'),
            incompleteItems,
          });
        } else if (code === 'NOTICE_PERIOD_WARNING') {
          setRequestError({
            message: extractErrorMessage(err, 'Failed to request release'),
            code,
            details: details || undefined,
          });
        } else {
          setRequestError({ message: extractErrorMessage(err, 'Failed to request release') });
        }
      } finally {
        requestingRef.current = false;
        setRequesting(false);
      }
    },
    [selectedHoldPoint, refreshHoldPoints],
  );

  const handleSubmitBatchRequest = useCallback(
    async (data: BatchRequestReleaseSubmitData) => {
      if (selectedBatchHoldPoints.length === 0 || batchRequestingRef.current) return;
      const lotId = selectedBatchHoldPoints[0].lotId;
      batchRequestingRef.current = true;
      setBatchRequesting(true);
      setBatchRequestError(null);

      try {
        await apiFetch('/api/holdpoints/request-release/batch', {
          method: 'POST',
          body: JSON.stringify({
            lotId,
            items: selectedBatchHoldPoints.map((hp) => ({
              itpChecklistItemId: hp.itpChecklistItemId,
            })),
            sharedEvidenceDocumentIds: data.sharedEvidenceDocumentIds,
            scheduledDate: data.scheduledDate || null,
            scheduledTime: data.scheduledTime || null,
            recipientEmail: data.recipientEmail,
            recipientName: data.recipientName || null,
            noticeHours: 24,
          }),
        });
        await refreshHoldPoints();
        toast({
          title: 'Batch request sent',
          description: `${selectedBatchHoldPoints.length} hold point release requests sent for ${selectedBatchHoldPoints[0].lotNumber}.`,
        });
        setShowBatchRequestModal(false);
        setSelectedBatchHoldPointIds(new Set());
      } catch (err) {
        setBatchRequestError(extractErrorMessage(err, 'Failed to send batch release request'));
      } finally {
        batchRequestingRef.current = false;
        setBatchRequesting(false);
      }
    },
    [selectedBatchHoldPoints, refreshHoldPoints],
  );

  const handleSubmitRecordRelease = useCallback(
    async (
      releasedByName: string,
      releasedByOrg: string,
      releaseDate: string,
      releaseTime: string,
      releaseNotes: string,
      releaseMethod: string = 'digital',
      signatureDataUrl: string | null = null,
      evidenceFile: File | null = null,
    ) => {
      if (
        !selectedHoldPoint ||
        selectedHoldPoint.id.startsWith('virtual-') ||
        !projectId ||
        recordingReleaseRef.current
      )
        return;
      if (recordReleasePermissionMessage) {
        setRecordReleaseError(recordReleasePermissionMessage);
        return;
      }
      recordingReleaseRef.current = true;
      setRecordingRelease(true);
      setRecordReleaseError(null);
      try {
        let finalReleaseNotes = releaseNotes || '';
        let releaseEvidenceDocumentId: string | undefined;

        if (evidenceFile && (releaseMethod === 'email' || releaseMethod === 'paper')) {
          const token = getAuthToken();
          if (!token) {
            throw new Error('Authentication required');
          }

          const formData = new FormData();
          formData.append('file', evidenceFile);
          formData.append('projectId', projectId);
          formData.append('lotId', selectedHoldPoint.lotId);
          formData.append('documentType', 'hold_point_release_evidence');
          formData.append('category', 'itp_evidence');
          formData.append(
            'caption',
            `Hold point release evidence for ${selectedHoldPoint.lotNumber}: ${selectedHoldPoint.description}`,
          );

          const uploadResponse = await authFetch('/api/documents/upload', {
            method: 'POST',
            body: formData,
          });

          if (!uploadResponse.ok) {
            throw new Error('Failed to upload release evidence');
          }

          const evidenceDocument = (await uploadResponse.json()) as UploadedEvidenceDocument;
          releaseEvidenceDocumentId = evidenceDocument.id;
          finalReleaseNotes =
            `${finalReleaseNotes}\nEvidence uploaded: ${evidenceDocument.filename}`.trim();
        }

        await apiFetch(`/api/holdpoints/${encodeURIComponent(selectedHoldPoint.id)}/release`, {
          method: 'POST',
          body: JSON.stringify({
            releasedByName: releasedByName.trim(),
            releasedByOrg: releasedByOrg.trim(),
            releaseDate: releaseDate || undefined,
            releaseTime: releaseTime || undefined,
            releaseMethod,
            releaseNotes: finalReleaseNotes.trim() || undefined,
            signatureDataUrl: signatureDataUrl || null,
            releaseEvidenceDocumentId,
          }),
        });
        await refreshHoldPoints();
        toast({
          title: 'Release Recorded',
          description: `Hold point for ${selectedHoldPoint.lotNumber} has been released`,
        });
        setShowRecordReleaseModal(false);
        setSelectedHoldPoint(null);
        setHoldPointDetails(null);
      } catch (err) {
        const message = handleApiError(err, 'Failed to record hold point release');
        setRecordReleaseError(message);
      } finally {
        recordingReleaseRef.current = false;
        setRecordingRelease(false);
      }
    },
    [projectId, selectedHoldPoint, recordReleasePermissionMessage, refreshHoldPoints],
  );

  const handleExportCSV = useCallback(() => {
    const headers = [
      'Lot',
      'Description',
      'Point Type',
      'Status',
      'Scheduled Date',
      'Released At',
      'Released By',
      'Release Method',
      'Release Notes',
    ];
    const rows = holdPoints.map((hp) => [
      hp.lotNumber,
      hp.description,
      hp.pointType || '-',
      getStatusLabel(hp.status),
      formatHoldPointDate(hp.scheduledDate),
      formatHoldPointDate(hp.releasedAt),
      hp.releasedAt ? getReleaseIdentityText(hp) : '-',
      getReleaseMethodLabel(hp.releaseMethod) || '-',
      hp.releaseNotes || '-',
    ]);
    downloadCsv(`hold-points-${projectId}-${formatDateKey()}.csv`, [headers, ...rows]);
  }, [holdPoints, projectId]);

  const handleCloseRequestModal = useCallback(() => {
    setShowRequestModal(false);
    setSelectedHoldPoint(null);
    setHoldPointDetails(null);
    setRequestError(null);
  }, []);

  const handleCloseBatchRequestModal = useCallback(() => {
    setShowBatchRequestModal(false);
    setBatchRequestError(null);
  }, []);

  const handleCloseRecordModal = useCallback(() => {
    setShowRecordReleaseModal(false);
    setSelectedHoldPoint(null);
    setHoldPointDetails(null);
    setRequestError(null);
    setRecordReleaseError(null);
  }, []);

  const handleClearFilter = useCallback(
    () => updateFilters({ status: '', search: '', lotId: '' }),
    [updateFilters],
  );

  // --- Render ---

  return (
    <div className="space-y-6">
      <HoldPointsPageHeader
        holdPointCount={holdPoints.length}
        isMobile={isMobile}
        statusFilter={statusFilter}
        selectedLotId={selectedLotId}
        searchQuery={searchQuery}
        lotOptions={lotOptions}
        onStatusFilterChange={handleStatusFilterChange}
        onLotFilterChange={handleLotFilterChange}
        onSearchChange={handleSearchChange}
        onExportCSV={handleExportCSV}
      />

      <HoldPointsLoadErrorAlert loadError={loadError} onRetry={handleRetryLoad} />

      {!loading && !loadError && holdPoints.length > 0 && <HoldPointSummaryCards stats={stats} />}

      {!loading && !loadError && holdPoints.length > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium">Batch release request</div>
            <div className="text-sm text-muted-foreground">
              {selectedLotId === 'all'
                ? 'Select one lot to request multiple hold point releases together.'
                : `${batchEligibleHoldPoints.length} request-ready pending hold point${batchEligibleHoldPoints.length === 1 ? '' : 's'} in this lot.${batchBlockedHoldPointCount > 0 ? ` ${batchBlockedHoldPointCount} blocked until earlier checklist items are complete.` : ''}`}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleSelectAllBatchEligible}
              disabled={batchEligibleHoldPoints.length === 0}
            >
              Select all ready
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleClearBatchSelection}
              disabled={selectedBatchHoldPointIds.size === 0}
            >
              Clear
            </Button>
            <Button
              type="button"
              onClick={() => {
                setBatchRequestError(null);
                setShowBatchRequestModal(true);
              }}
              disabled={selectedBatchHoldPoints.length === 0}
            >
              Request selected ({selectedBatchHoldPoints.length})
            </Button>
          </div>
        </div>
      )}

      {!isMobile && !loading && !loadError && holdPoints.length > 0 && (
        <LazyHoldPointsChart
          releasesOverTime={chartData.releasesOverTime}
          avgTimeToRelease={chartData.avgTimeToRelease}
          releasedCount={holdPoints.filter((hp) => hp.status === 'released').length}
        />
      )}

      {!loadError &&
        (isMobile ? (
          <HoldPointsMobileList
            holdPoints={holdPoints}
            filteredHoldPoints={filteredHoldPoints}
            loading={loading}
            statusFilter={statusFilter}
            searchQuery={searchQuery}
            highlightedHpId={deepLinkedHpId}
            copiedHpId={copiedHpId}
            generatingPdf={generatingPdf}
            chasingHpId={chasingHpId}
            batchSelectableHoldPointIds={batchSelectableHoldPointIds}
            selectedBatchHoldPointIds={selectedBatchHoldPointIds}
            onCopyLink={handleCopyHpLink}
            onRequestRelease={handleRequestRelease}
            onRecordRelease={handleRecordRelease}
            onChase={handleChaseHoldPoint}
            onGenerateEvidence={handleGenerateEvidencePackage}
            onToggleBatchSelection={handleToggleBatchSelection}
            onClearFilter={handleClearFilter}
          />
        ) : (
          <HoldPointsTable
            holdPoints={holdPoints}
            filteredHoldPoints={filteredHoldPoints}
            loading={loading}
            statusFilter={statusFilter}
            searchQuery={searchQuery}
            sortField={sortField}
            sortDirection={sortDirection}
            highlightedHpId={deepLinkedHpId}
            copiedHpId={copiedHpId}
            generatingPdf={generatingPdf}
            chasingHpId={chasingHpId}
            batchSelectableHoldPointIds={batchSelectableHoldPointIds}
            selectedBatchHoldPointIds={selectedBatchHoldPointIds}
            onSort={handleSort}
            onCopyLink={handleCopyHpLink}
            onRequestRelease={handleRequestRelease}
            onRecordRelease={handleRecordRelease}
            onChase={handleChaseHoldPoint}
            onGenerateEvidence={handleGenerateEvidencePackage}
            onToggleBatchSelection={handleToggleBatchSelection}
            onClearFilter={handleClearFilter}
          />
        ))}

      {showRequestModal && selectedHoldPoint && (
        <RequestReleaseModal
          holdPoint={selectedHoldPoint}
          details={holdPointDetails}
          loading={loadingDetails}
          requesting={requesting}
          error={requestError}
          onClose={handleCloseRequestModal}
          onSubmit={handleSubmitRequest}
        />
      )}

      {showBatchRequestModal && projectId && selectedBatchHoldPoints.length > 0 && (
        <BatchRequestReleaseModal
          holdPoints={selectedBatchHoldPoints}
          projectId={projectId}
          requesting={batchRequesting}
          error={batchRequestError}
          onClose={handleCloseBatchRequestModal}
          onSubmit={handleSubmitBatchRequest}
        />
      )}

      {showRecordReleaseModal && selectedHoldPoint && (
        <RecordReleaseModal
          holdPoint={selectedHoldPoint}
          recording={recordingRelease}
          error={recordReleaseError}
          approvalRequirement={holdPointDetails?.approvalRequirement}
          canSubmitRelease={canSubmitRecordRelease}
          releasePermissionMessage={recordReleasePermissionMessage}
          onClose={handleCloseRecordModal}
          onSubmit={handleSubmitRecordRelease}
        />
      )}
    </div>
  );
}
