import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, Loader2, LockKeyhole } from 'lucide-react';
import { apiFetch, apiUrl } from '@/lib/api';
import { extractErrorMessage } from '@/lib/errorHandling';
import type { HPEvidencePackageData } from '@/lib/pdfGenerator';
import { Button } from '@/components/ui/button';
import { formatDate, formatDateTime, isHoldPointReleased } from './components/publicReleaseShared';
import {
  BatchHoldPointRow,
  type BatchHoldPoint,
  type HoldPointPackageState,
} from './components/BatchHoldPointRow';
import { BatchReleaseIdentityPanel } from './components/BatchReleaseIdentityPanel';

interface BatchResponse {
  isPublicAccess: true;
  batch: {
    project: { name: string; projectNumber: string };
    lot: { lotNumber: string; activityType: string | null };
    requestedBy: string | null;
    scheduledDate: string | null;
    scheduledTime: string | null;
    recipient: { email: string; name: string | null };
    expiresAt: string;
    holdPoints: BatchHoldPoint[];
  };
}

interface HoldPointPackageResponse {
  evidencePackage: HPEvidencePackageData;
  tokenInfo: {
    recipientEmail: string;
    recipientName: string | null;
    expiresAt: string;
    canRelease: boolean;
  };
  isPublicAccess: true;
}

interface BatchReleaseResponse {
  success: true;
  message: string;
  released: Array<{
    id: string;
    description: string;
    itpChecklistItemId: string | null;
    status: string;
    releasedAt: string | null;
    releasedByName: string | null;
    releasedByOrg: string | null;
    releaseMethod: string | null;
    releaseNotes: string | null;
    lot: { id: string; lotNumber: string };
  }>;
}

function batchDocumentUrl(token: string, holdPointId: string, documentId: string): string {
  return apiUrl(
    `/api/holdpoints/public/batch/${encodeURIComponent(token)}/holdpoints/${encodeURIComponent(
      holdPointId,
    )}/documents/${encodeURIComponent(documentId)}?disposition=inline`,
  );
}

export function PublicHoldPointBatchReleasePage() {
  const { token } = useParams();
  const [batch, setBatch] = useState<BatchResponse['batch'] | null>(null);
  const [holdPoints, setHoldPoints] = useState<BatchHoldPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [packages, setPackages] = useState<Record<string, HoldPointPackageState>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [releasedByName, setReleasedByName] = useState('');
  const [releasedByOrg, setReleasedByOrg] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function loadBatch() {
      if (!token) {
        setLoadError('Release link is missing its secure token.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setLoadError(null);
      try {
        const response = await apiFetch<BatchResponse>(
          `/api/holdpoints/public/batch/${encodeURIComponent(token)}`,
          { method: 'GET' },
        );
        if (!cancelled) {
          setBatch(response.batch);
          setHoldPoints(response.batch.holdPoints);
          setReleasedByName(response.batch.recipient.name || '');
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(extractErrorMessage(error, 'This release link is invalid or has expired.'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadBatch();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const loadPackage = useCallback(
    async (holdPointId: string) => {
      if (!token) return;
      setPackages((current) => ({
        ...current,
        [holdPointId]: { loading: true, error: null },
      }));
      try {
        const response = await apiFetch<HoldPointPackageResponse>(
          `/api/holdpoints/public/batch/${encodeURIComponent(token)}/holdpoints/${encodeURIComponent(
            holdPointId,
          )}`,
          { method: 'GET' },
        );
        setPackages((current) => ({
          ...current,
          [holdPointId]: { loading: false, error: null, data: response.evidencePackage },
        }));
      } catch (error) {
        setPackages((current) => ({
          ...current,
          [holdPointId]: {
            loading: false,
            error: extractErrorMessage(error, 'Could not load this evidence package.'),
          },
        }));
      }
    },
    [token],
  );

  const handleToggleExpand = (holdPointId: string) => {
    const next = expandedId === holdPointId ? null : holdPointId;
    setExpandedId(next);
    if (next && !packages[holdPointId]) {
      void loadPackage(holdPointId);
    }
  };

  const handleToggleSelect = (holdPointId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(holdPointId)) {
        next.delete(holdPointId);
      } else {
        next.add(holdPointId);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!token || submittingRef.current) return;
    const ids = Array.from(selectedIds);
    if (ids.length === 0 || !releasedByName.trim() || !signatureDataUrl) return;

    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);
    try {
      const result = await apiFetch<BatchReleaseResponse>(
        `/api/holdpoints/public/batch/${encodeURIComponent(token)}/release`,
        {
          method: 'POST',
          body: JSON.stringify({
            holdPointIds: ids,
            releasedByName: releasedByName.trim(),
            releasedByOrg: releasedByOrg.trim() || undefined,
            releaseNotes: releaseNotes.trim() || undefined,
            signatureDataUrl,
          }),
        },
      );

      const releasedById = new Map(result.released.map((item) => [item.id, item]));
      setHoldPoints((current) =>
        current.map((hp) => {
          const released = releasedById.get(hp.holdPointId);
          if (!released) return hp;
          return {
            ...hp,
            status: released.status,
            releasedAt: released.releasedAt,
            releasedByName: released.releasedByName,
          };
        }),
      );
      setSelectedIds(new Set());
      setSuccessMessage(result.message);
    } catch (error) {
      setSubmitError(extractErrorMessage(error, 'Could not release the selected hold points.'));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-4">
          <div className="flex items-center gap-3 text-muted-foreground" role="status">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading secure release link</span>
          </div>
        </div>
      </main>
    );
  }

  if (loadError || !batch) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
          <section className="w-full rounded-lg border bg-card p-6 shadow-sm" role="alert">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
              <div>
                <h1 className="text-xl font-semibold">Release Link Unavailable</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {loadError || 'This secure release link could not be loaded.'}
                </p>
                <Button asChild variant="outline" className="mt-5">
                  <Link to="/login">Go to CIVOS</Link>
                </Button>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const releasedCount = holdPoints.filter((hp) => isHoldPointReleased(hp.status)).length;
  const tokenRecipientName = batch.recipient.name?.trim() || '';
  const scheduled = batch.scheduledTime
    ? `${formatDate(batch.scheduledDate)}, ${batch.scheduledTime}`
    : formatDate(batch.scheduledDate);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="border-b bg-card">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <LockKeyhole className="h-4 w-4" />
            Secure CIVOS Release
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal">
            {batch.project.name}
            {batch.project.projectNumber ? ` (${batch.project.projectNumber})` : ''}
          </h1>
          <div className="mt-1 text-sm text-muted-foreground">
            Lot {batch.lot.lotNumber}
            {batch.lot.activityType ? ` · ${batch.lot.activityType}` : ''}
            {batch.requestedBy ? ` · Requested by ${batch.requestedBy}` : ''}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            Scheduled {scheduled} · Expires {formatDateTime(batch.expiresAt)}
          </div>
          <div className="mt-2 text-sm font-medium">
            {releasedCount} of {holdPoints.length} released
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-4">
          {holdPoints.map((hp) => (
            <BatchHoldPointRow
              key={hp.holdPointId}
              holdPoint={hp}
              selected={selectedIds.has(hp.holdPointId)}
              onToggleSelect={() => handleToggleSelect(hp.holdPointId)}
              expanded={expandedId === hp.holdPointId}
              onToggleExpand={() => handleToggleExpand(hp.holdPointId)}
              packageState={packages[hp.holdPointId]}
              getDocumentUrl={(documentId) => batchDocumentUrl(token!, hp.holdPointId, documentId)}
            />
          ))}
        </section>

        <aside className="rounded-lg border bg-card p-5 shadow-sm lg:sticky lg:top-6 lg:self-start">
          <BatchReleaseIdentityPanel
            selectedCount={selectedIds.size}
            releasedByName={releasedByName}
            onReleasedByNameChange={setReleasedByName}
            releasedByOrg={releasedByOrg}
            onReleasedByOrgChange={setReleasedByOrg}
            releaseNotes={releaseNotes}
            onReleaseNotesChange={setReleaseNotes}
            onSignatureChange={setSignatureDataUrl}
            signatureDataUrl={signatureDataUrl}
            tokenRecipientName={tokenRecipientName}
            submitting={submitting}
            submitError={submitError}
            successMessage={successMessage}
            onSubmit={handleSubmit}
          />
        </aside>
      </div>
    </main>
  );
}
