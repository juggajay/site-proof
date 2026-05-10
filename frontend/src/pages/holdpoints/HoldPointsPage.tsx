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
import { Button } from '@/components/ui/button';
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

// Extracted components
import { HoldPointStatusFilter, HoldPointSummaryCards } from './components/HoldPointStatusFilter';
import { HoldPointsTable } from './components/HoldPointsTable';
import { formatHoldPointDate, getStatusLabel, isOverdue } from './components/holdPointTableUtils';
import { RequestReleaseModal } from './components/RequestReleaseModal';
import { RecordReleaseModal } from './components/RecordReleaseModal';
import { downloadCsv } from '@/lib/csv';

export function HoldPointsPage() {
  const { projectId } = useParams();
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
      const data = await apiFetch<HoldPointsResponse>(
        `/api/holdpoints/project/${encodeURIComponent(projectId)}`,
      );
      setHoldPoints(data.holdPoints || []);
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
      const data = await apiFetch<HoldPointsResponse>(
        `/api/holdpoints/project/${encodeURIComponent(projectId)}`,
      );
      setHoldPoints(data.holdPoints || []);
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

  // --- Derived data ---

  const filteredHoldPoints = useMemo(
    () =>
      statusFilter === 'all' ? holdPoints : holdPoints.filter((hp) => hp.status === statusFilter),
    [holdPoints, statusFilter],
  );

  const stats = useMemo(
    () => ({
      total: holdPoints.length,
      pending: holdPoints.filter((hp) => hp.status === 'pending').length,
      notified: holdPoints.filter((hp) => hp.status === 'notified').length,
      releasedThisWeek: holdPoints.filter((hp) => {
        if (hp.status !== 'released' || !hp.releasedAt) return false;
        const releasedDate = new Date(hp.releasedAt);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return releasedDate >= weekAgo;
      }).length,
      overdue: holdPoints.filter((hp) => isOverdue(hp)).length,
    }),
    [holdPoints],
  );

  const chartData = useMemo(() => {
    const releasesOverTime: { date: string; releases: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);
      const releases = holdPoints.filter((hp) => {
        if (!hp.releasedAt) return false;
        const releasedDate = new Date(hp.releasedAt);
        return releasedDate >= dayStart && releasedDate <= dayEnd;
      }).length;
      releasesOverTime.push({ date: dateStr, releases });
    }
    const releasedHPs = holdPoints.filter(
      (hp) => hp.status === 'released' && hp.notificationSentAt && hp.releasedAt,
    );
    let avgTimeToRelease = 0;
    if (releasedHPs.length > 0) {
      const totalHours = releasedHPs.reduce((sum, hp) => {
        const notified = new Date(hp.notificationSentAt!).getTime();
        const released = new Date(hp.releasedAt!).getTime();
        return sum + (released - notified) / (1000 * 60 * 60);
      }, 0);
      avgTimeToRelease = Math.round(totalHours / releasedHPs.length);
    }
    return { releasesOverTime, avgTimeToRelease };
  }, [holdPoints]);

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
        handleApiError(err, 'Failed to record hold point release');
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
    downloadCsv(`hold-points-${projectId}-${new Date().toISOString().split('T')[0]}.csv`, [
      headers,
      ...rows,
    ]);
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
  }, []);

  const handleClearFilter = useCallback(() => setStatusFilter('all'), []);

  // --- Render ---

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Hold Points</h1>
          <p className="text-muted-foreground mt-1">
            Track and release hold points requiring third-party inspection
          </p>
        </div>
        {holdPoints.length > 0 && (
          <HoldPointStatusFilter
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            onExportCSV={handleExportCSV}
          />
        )}
      </div>

      {loadError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4" role="alert">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-destructive">{loadError}</p>
            <Button type="button" variant="outline" onClick={fetchHoldPoints}>
              Try again
            </Button>
          </div>
        </div>
      )}

      {!loading && !loadError && holdPoints.length > 0 && <HoldPointSummaryCards stats={stats} />}

      {!loading && !loadError && holdPoints.length > 0 && (
        <LazyHoldPointsChart
          releasesOverTime={chartData.releasesOverTime}
          avgTimeToRelease={chartData.avgTimeToRelease}
          releasedCount={holdPoints.filter((hp) => hp.status === 'released').length}
        />
      )}

      {!loadError && (
        <HoldPointsTable
          holdPoints={holdPoints}
          filteredHoldPoints={filteredHoldPoints}
          loading={loading}
          statusFilter={statusFilter}
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
      )}

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
          approvalRequirement={holdPointDetails?.approvalRequirement}
          onClose={handleCloseRecordModal}
          onSubmit={handleSubmitRecordRelease}
        />
      )}
    </div>
  );
}
