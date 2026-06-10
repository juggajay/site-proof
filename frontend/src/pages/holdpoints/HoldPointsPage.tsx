import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { apiFetch, authFetch } from '@/lib/api';
import { getAuthToken } from '@/lib/auth';
import { toast } from '@/components/ui/toaster';
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
  PrerequisiteItem,
  RequestError,
  StatusFilter,
} from './types';

interface HoldPointsResponse {
  holdPoints?: HoldPoint[];
  pagination?: {
    page: number;
    totalPages: number;
    hasNextPage: boolean;
  };
}

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

const HOLD_POINTS_PAGE_LIMIT = 100;

// Extracted components
import { HoldPointSummaryCards } from './components/HoldPointStatusFilter';
import { HoldPointsLoadErrorAlert, HoldPointsPageHeader } from './HoldPointsPageSections';
import { HoldPointsTable } from './components/HoldPointsTable';
import { HoldPointsMobileList } from './components/HoldPointsMobileList';
import { formatHoldPointDate, getStatusLabel } from './components/holdPointTableUtils';
import { buildHoldPointChartData, buildHoldPointStats } from './holdPointsPageData';
import { RequestReleaseModal } from './components/RequestReleaseModal';
import { RecordReleaseModal } from './components/RecordReleaseModal';
import { downloadCsv } from '@/lib/csv';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { useRegisterDeepLink } from '@/hooks/useRegisterDeepLink';

// Read side of the "Copy link" action (?hp=<id>): stable references so the
// deep-link effect doesn't re-run on every render.
const getHoldPointId = (hp: HoldPoint) => hp.id;
const HOLD_POINT_LINK_NOT_FOUND = {
  title: "Couldn't find that hold point",
  description: 'The link may belong to another project, or the hold point may have been removed.',
};

async function fetchAllProjectHoldPoints(projectId: string): Promise<HoldPoint[]> {
  const allHoldPoints: HoldPoint[] = [];
  let page = 1;

  while (true) {
    const data = await apiFetch<HoldPointsResponse>(
      `/api/holdpoints/project/${encodeURIComponent(projectId)}?page=${page}&limit=${HOLD_POINTS_PAGE_LIMIT}`,
    );

    allHoldPoints.push(...(data.holdPoints || []));

    if (!data.pagination?.hasNextPage || page >= data.pagination.totalPages) {
      return allHoldPoints;
    }

    page += 1;
  }
}

export function HoldPointsPage() {
  const { projectId } = useParams();
  const isMobile = useIsMobile();
  const [holdPoints, setHoldPoints] = useState<HoldPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedHoldPoint, setSelectedHoldPoint] = useState<HoldPoint | null>(null);
  const [holdPointDetails, setHoldPointDetails] = useState<HoldPointDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState<RequestError | null>(null);
  const [copiedHpId, setCopiedHpId] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  const [chasingHpId, setChasingHpId] = useState<string | null>(null);
  const [showRecordReleaseModal, setShowRecordReleaseModal] = useState(false);
  const [recordingRelease, setRecordingRelease] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [recordReleaseError, setRecordReleaseError] = useState<string | null>(null);
  const generatingPdfRef = useRef<string | null>(null);
  const chasingHpRef = useRef<string | null>(null);
  const requestingRef = useRef(false);
  const recordingReleaseRef = useRef(false);

  // --- Data fetching ---

  const fetchHoldPoints = useCallback(async () => {
    if (!projectId) {
      setHoldPoints([]);
      setLoadError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      setHoldPoints(await fetchAllProjectHoldPoints(projectId));
    } catch (err) {
      logError('Failed to fetch hold points:', err);
      setHoldPoints([]);
      setLoadError(extractErrorMessage(err, 'Failed to load hold points.'));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void fetchHoldPoints();
  }, [fetchHoldPoints]);

  const refreshHoldPoints = useCallback(async () => {
    if (!projectId) return;
    try {
      setHoldPoints(await fetchAllProjectHoldPoints(projectId));
      setLoadError(null);
    } catch (err) {
      logError('Failed to refresh hold points:', err);
      setLoadError(
        extractErrorMessage(err, 'Hold point updated, but the register could not be refreshed.'),
      );
    }
  }, [projectId]);

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

  const filteredHoldPoints = useMemo(
    () =>
      statusFilter === 'all' ? holdPoints : holdPoints.filter((hp) => hp.status === statusFilter),
    [holdPoints, statusFilter],
  );

  const stats = useMemo(() => buildHoldPointStats(holdPoints), [holdPoints]);

  const chartData = useMemo(() => buildHoldPointChartData(holdPoints), [holdPoints]);

  // --- Handlers ---

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
      recordingReleaseRef.current = true;
      setRecordingRelease(true);
      setRecordReleaseError(null);
      try {
        let finalReleaseNotes = releaseNotes || '';

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
          finalReleaseNotes =
            `${finalReleaseNotes}\nEvidence uploaded: ${evidenceDocument.filename}`.trim();
        }

        await apiFetch(`/api/holdpoints/${encodeURIComponent(selectedHoldPoint.id)}/release`, {
          method: 'POST',
          body: JSON.stringify({
            releasedByName: releasedByName.trim(),
            releasedByOrg: releasedByOrg.trim() || undefined,
            releaseDate: releaseDate || undefined,
            releaseTime: releaseTime || undefined,
            releaseMethod,
            releaseNotes: finalReleaseNotes.trim() || undefined,
            signatureDataUrl: signatureDataUrl || null,
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
    [projectId, selectedHoldPoint, refreshHoldPoints],
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
      'Release Notes',
    ];
    const rows = holdPoints.map((hp) => [
      hp.lotNumber,
      hp.description,
      hp.pointType || '-',
      getStatusLabel(hp.status),
      formatHoldPointDate(hp.scheduledDate),
      formatHoldPointDate(hp.releasedAt),
      hp.releasedByName || '-',
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

  const handleCloseRecordModal = useCallback(() => {
    setShowRecordReleaseModal(false);
    setSelectedHoldPoint(null);
    setHoldPointDetails(null);
    setRequestError(null);
    setRecordReleaseError(null);
  }, []);

  const handleClearFilter = useCallback(() => setStatusFilter('all'), []);

  // --- Render ---

  return (
    <div className="space-y-6">
      <HoldPointsPageHeader
        holdPointCount={holdPoints.length}
        isMobile={isMobile}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onExportCSV={handleExportCSV}
      />

      <HoldPointsLoadErrorAlert loadError={loadError} onRetry={fetchHoldPoints} />

      {!loading && !loadError && holdPoints.length > 0 && <HoldPointSummaryCards stats={stats} />}

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
            highlightedHpId={deepLinkedHpId}
            copiedHpId={copiedHpId}
            generatingPdf={generatingPdf}
            chasingHpId={chasingHpId}
            onCopyLink={handleCopyHpLink}
            onRequestRelease={handleRequestRelease}
            onRecordRelease={handleRecordRelease}
            onChase={handleChaseHoldPoint}
            onGenerateEvidence={handleGenerateEvidencePackage}
            onClearFilter={handleClearFilter}
          />
        ) : (
          <HoldPointsTable
            holdPoints={holdPoints}
            filteredHoldPoints={filteredHoldPoints}
            loading={loading}
            statusFilter={statusFilter}
            highlightedHpId={deepLinkedHpId}
            copiedHpId={copiedHpId}
            generatingPdf={generatingPdf}
            chasingHpId={chasingHpId}
            onCopyLink={handleCopyHpLink}
            onRequestRelease={handleRequestRelease}
            onRecordRelease={handleRecordRelease}
            onChase={handleChaseHoldPoint}
            onGenerateEvidence={handleGenerateEvidencePackage}
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

      {showRecordReleaseModal && selectedHoldPoint && (
        <RecordReleaseModal
          holdPoint={selectedHoldPoint}
          recording={recordingRelease}
          error={recordReleaseError}
          approvalRequirement={holdPointDetails?.approvalRequirement}
          onClose={handleCloseRecordModal}
          onSubmit={handleSubmitRecordRelease}
        />
      )}
    </div>
  );
}
