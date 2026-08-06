import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Download, Loader2, LockKeyhole } from 'lucide-react';
import { apiFetch, apiUrl } from '@/lib/api';
import { extractErrorMessage } from '@/lib/errorHandling';
import type { HPEvidencePackageData } from '@/lib/pdfGenerator';
import { Button } from '@/components/ui/button';
import { SignaturePad } from '@/components/ui/SignaturePad';
import { getReleaseIdentityParts } from './holdPointReleaseIdentity';
import { HoldPointEvidencePackageCard } from './components/HoldPointEvidencePackageCard';
import { formatDate, formatDateTime, StatusPill } from './components/publicReleaseShared';

interface PublicReleaseResponse {
  evidencePackage: HPEvidencePackageData;
  tokenInfo: {
    recipientEmail: string;
    recipientName: string | null;
    expiresAt: string;
    canRelease: boolean;
  };
}

interface ReleaseResultResponse {
  success: boolean;
  message: string;
  holdPoint: {
    status: string;
    itpChecklistItemId?: string | null;
    releasedAt: string | null;
    releasedByName: string | null;
    releasedByOrg: string | null;
    releaseMethod?: string | null;
    releaseNotes: string | null;
  };
}

function getPublicEvidenceDocumentUrl(token: string, documentId: string): string {
  return apiUrl(
    `/api/holdpoints/public/${encodeURIComponent(token)}/documents/${encodeURIComponent(
      documentId,
    )}?disposition=inline`,
  );
}

function applyReleaseToEvidencePackage(
  evidencePackage: HPEvidencePackageData,
  releasedHoldPoint: ReleaseResultResponse['holdPoint'],
): HPEvidencePackageData {
  const releasedAt = releasedHoldPoint.releasedAt;
  const releasedByName = releasedHoldPoint.releasedByName;
  const releasedChecklistItemId =
    releasedHoldPoint.itpChecklistItemId || evidencePackage.holdPoint.itpChecklistItemId || null;
  const updatedChecklist = evidencePackage.checklist.map((item) => {
    const isReleasedHoldPoint =
      item.pointType === 'hold_point' &&
      ((releasedChecklistItemId && item.itpChecklistItemId === releasedChecklistItemId) ||
        (!releasedChecklistItemId && item.description === evidencePackage.holdPoint.description));

    if (!isReleasedHoldPoint) {
      return item;
    }

    return {
      ...item,
      isCompleted: true,
      completedAt: item.completedAt || releasedAt,
      completedBy: item.completedBy || releasedByName,
      isVerified: true,
      verifiedAt: item.verifiedAt || releasedAt,
      verifiedBy: item.verifiedBy || releasedByName,
    };
  });

  return {
    ...evidencePackage,
    holdPoint: {
      ...evidencePackage.holdPoint,
      status: releasedHoldPoint.status,
      releasedAt: releasedHoldPoint.releasedAt,
      releasedByName: releasedHoldPoint.releasedByName,
      releaseNotes: releasedHoldPoint.releaseNotes,
    },
    checklist: updatedChecklist,
    summary: {
      ...evidencePackage.summary,
      completedItems: updatedChecklist.filter((item) => item.isCompleted).length,
      verifiedItems: updatedChecklist.filter((item) => item.isVerified).length,
    },
  };
}

export function PublicHoldPointReleasePage() {
  const { token } = useParams();
  const [data, setData] = useState<PublicReleaseResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [releasedByName, setReleasedByName] = useState('');
  const [releasedByOrg, setReleasedByOrg] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [releaseResult, setReleaseResult] = useState<ReleaseResultResponse | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function loadReleasePackage() {
      if (!token) {
        setLoadError('Release link is missing its secure token.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setLoadError(null);
      try {
        const response = await apiFetch<PublicReleaseResponse>(
          `/api/holdpoints/public/${encodeURIComponent(token)}`,
          { method: 'GET' },
        );
        if (!cancelled) {
          setData(response);
          setReleasedByName(response.tokenInfo.recipientName || '');
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(extractErrorMessage(error, 'This release link is invalid or has expired.'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadReleasePackage();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const evidencePackage = data?.evidencePackage;
  const currentStatus =
    releaseResult?.holdPoint.status || evidencePackage?.holdPoint.status || 'pending';
  const releasedHoldPoint =
    releaseResult?.holdPoint ||
    (evidencePackage?.holdPoint.status === 'released'
      ? {
          status: evidencePackage.holdPoint.status,
          itpChecklistItemId: evidencePackage.holdPoint.itpChecklistItemId,
          releasedAt: evidencePackage.holdPoint.releasedAt,
          releasedByName: evidencePackage.holdPoint.releasedByName,
          releasedByOrg: evidencePackage.holdPoint.releasedByOrg ?? null,
          releaseMethod: evidencePackage.holdPoint.releaseMethod ?? null,
          releaseNotes: evidencePackage.holdPoint.releaseNotes,
        }
      : null);
  const canRelease =
    Boolean(data?.tokenInfo.canRelease) && currentStatus !== 'released' && !releaseResult;
  const releasedIdentity = releasedHoldPoint ? getReleaseIdentityParts(releasedHoldPoint) : null;
  const releasedIdentityLabel =
    releasedIdentity?.primary && releasedIdentity.primary !== 'Release recorded'
      ? `Released by ${releasedIdentity.primary}`
      : 'Release recorded';
  const tokenRecipientName = data?.tokenInfo.recipientName?.trim() || '';
  const checklistStats = useMemo(() => {
    if (!evidencePackage) return null;
    return {
      complete: evidencePackage.summary.completedItems,
      total: evidencePackage.summary.totalChecklistItems,
      verified: evidencePackage.summary.verifiedItems,
      tests: evidencePackage.summary.totalTestResults,
      photos: evidencePackage.summary.totalPhotos,
    };
  }, [evidencePackage]);

  const handleDownloadPdf = async () => {
    if (!evidencePackage || downloadingPdf) return;

    setPdfError(null);
    setDownloadingPdf(true);
    try {
      const { generateHPEvidencePackagePDF } = await import('@/lib/pdfGenerator');
      await generateHPEvidencePackagePDF(evidencePackage);
    } catch (error) {
      setPdfError(extractErrorMessage(error, 'Could not generate the evidence package PDF.'));
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !releasedByName.trim() || !signatureDataUrl || submittingRef.current) return;

    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await apiFetch<ReleaseResultResponse>(
        `/api/holdpoints/public/${encodeURIComponent(token)}/release`,
        {
          method: 'POST',
          body: JSON.stringify({
            releasedByName: releasedByName.trim(),
            releasedByOrg: releasedByOrg.trim() || undefined,
            releaseNotes: releaseNotes.trim() || undefined,
            signatureDataUrl,
          }),
        },
      );
      setReleaseResult(result);
      setData((current) =>
        current
          ? {
              ...current,
              evidencePackage: applyReleaseToEvidencePackage(
                current.evidencePackage,
                result.holdPoint,
              ),
            }
          : current,
      );
    } catch (error) {
      setSubmitError(extractErrorMessage(error, 'Could not release this hold point.'));
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

  if (loadError || !evidencePackage || !data) {
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

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <LockKeyhole className="h-4 w-4" />
              Secure CIVOS Release
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal">
              {evidencePackage.holdPoint.description}
            </h1>
          </div>
          <StatusPill status={currentStatus} />
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-6">
          <div className="rounded-lg border bg-card p-5 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <div className="text-xs font-medium uppercase text-muted-foreground">Project</div>
                <div className="mt-1 font-medium">{evidencePackage.project.name}</div>
                <div className="text-sm text-muted-foreground">
                  {evidencePackage.project.projectNumber || '-'}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase text-muted-foreground">Lot</div>
                <div className="mt-1 font-medium">{evidencePackage.lot.lotNumber}</div>
                <div className="text-sm text-muted-foreground">
                  {evidencePackage.lot.activityType || '-'}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase text-muted-foreground">Scheduled</div>
                <div className="mt-1 font-medium">
                  {formatDate(evidencePackage.holdPoint.scheduledDate)}
                </div>
                <div className="text-sm text-muted-foreground">
                  Expires {formatDateTime(data.tokenInfo.expiresAt)}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase text-muted-foreground">Evidence</div>
                <div className="mt-1 font-medium">
                  {checklistStats?.complete}/{checklistStats?.total} checklist items
                </div>
                <div className="text-sm text-muted-foreground">
                  {checklistStats?.verified} verified, {checklistStats?.tests} tests
                </div>
              </div>
            </div>
          </div>

          <HoldPointEvidencePackageCard
            evidencePackage={evidencePackage}
            getDocumentUrl={(id) => getPublicEvidenceDocumentUrl(token!, id)}
            onDownloadPdf={handleDownloadPdf}
            downloadingPdf={downloadingPdf}
            pdfError={pdfError}
          />
        </section>

        <aside className="rounded-lg border bg-card p-5 shadow-sm lg:sticky lg:top-6 lg:self-start">
          {releasedHoldPoint ? (
            <div>
              <div className="flex items-center gap-2 text-success" role="status">
                <CheckCircle2 className="h-5 w-5" />
                <h2 className="font-semibold">Hold Point Released</h2>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {releasedIdentityLabel} at {formatDateTime(releasedHoldPoint.releasedAt)}.
              </p>
              {releasedIdentity?.secondary && (
                <p className="mt-1 text-sm text-muted-foreground">{releasedIdentity.secondary}</p>
              )}
              {releasedHoldPoint.releaseNotes && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {releasedHoldPoint.releaseNotes}
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                className="mt-5 w-full"
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
              >
                {downloadingPdf ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Download Evidence PDF
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <h2 className="font-semibold">Release Hold Point</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Confirm the evidence package before releasing this hold point.
                </p>
              </div>

              {!canRelease && (
                <div
                  className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning"
                  role="alert"
                >
                  This link can no longer release the hold point.
                </div>
              )}

              <label className="block text-sm font-medium">
                Released By
                <input
                  value={releasedByName}
                  onChange={(event) => setReleasedByName(event.target.value)}
                  maxLength={120}
                  required
                  disabled={Boolean(tokenRecipientName) || !canRelease || submitting}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                />
                {tokenRecipientName && (
                  <span className="mt-1 block text-xs text-muted-foreground">
                    This secure link is assigned to {tokenRecipientName}.
                  </span>
                )}
              </label>

              <label className="block text-sm font-medium">
                Organisation
                <input
                  value={releasedByOrg}
                  onChange={(event) => setReleasedByOrg(event.target.value)}
                  maxLength={160}
                  disabled={!canRelease || submitting}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                />
              </label>

              <label className="block text-sm font-medium">
                Release Notes
                <textarea
                  value={releaseNotes}
                  onChange={(event) => setReleaseNotes(event.target.value)}
                  maxLength={2000}
                  rows={4}
                  disabled={!canRelease || submitting}
                  className="mt-1 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                />
              </label>

              <div>
                <SignaturePad
                  onChange={setSignatureDataUrl}
                  required
                  fullWidth
                  disabled={!canRelease || submitting}
                  label="Sign to confirm release"
                />
                {!signatureDataUrl && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    A signature is required to release this hold point.
                  </p>
                )}
              </div>

              {submitError && (
                <div
                  className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  role="alert"
                >
                  {submitError}
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={!canRelease || submitting || !releasedByName.trim() || !signatureDataUrl}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Release Hold Point
              </Button>
            </form>
          )}
        </aside>
      </div>
    </main>
  );
}
