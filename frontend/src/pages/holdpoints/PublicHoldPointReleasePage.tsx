import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileText,
  Loader2,
  LockKeyhole,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { extractErrorMessage } from '@/lib/errorHandling';
import type { HPEvidencePackageData } from '@/lib/pdfGenerator';
import { Button } from '@/components/ui/button';

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
    releasedAt: string | null;
    releasedByName: string | null;
    releasedByOrg: string | null;
    releaseNotes: string | null;
  };
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-';

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '-';

  return new Intl.DateTimeFormat('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '-';

  return new Intl.DateTimeFormat('en-AU', {
    dateStyle: 'medium',
  }).format(date);
}

function StatusPill({ status }: { status: string }) {
  const released = status === 'released';
  const label = status.replace(/_/g, ' ');

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
        released ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
      }`}
    >
      {released ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : (
        <ClipboardCheck className="h-3.5 w-3.5" />
      )}
      {label}
    </span>
  );
}

export function PublicHoldPointReleasePage() {
  const { token } = useParams();
  const [data, setData] = useState<PublicReleaseResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [releasedByName, setReleasedByName] = useState('');
  const [releasedByOrg, setReleasedByOrg] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
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
  const canRelease =
    Boolean(data?.tokenInfo.canRelease) && currentStatus !== 'released' && !releaseResult;
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
    if (!token || !releasedByName.trim() || submittingRef.current) return;

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
          }),
        },
      );
      setReleaseResult(result);
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
                  <Link to="/login">Go to SiteProof</Link>
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
              Secure SiteProof Release
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

          <div className="rounded-lg border bg-card shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
              <div>
                <h2 className="font-semibold">Evidence Package</h2>
                <p className="text-sm text-muted-foreground">
                  Checklist, verification, test, and photo summary for this hold point.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
              >
                {downloadingPdf ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                PDF
              </Button>
            </div>
            {pdfError && (
              <div
                className="mx-5 mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                role="alert"
              >
                {pdfError}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-medium">Item</th>
                    <th className="px-5 py-3 font-medium">Completed</th>
                    <th className="px-5 py-3 font-medium">Verified</th>
                    <th className="px-5 py-3 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {evidencePackage.checklist.map((item) => (
                    <tr
                      key={`${item.sequenceNumber}-${item.description}`}
                      className="border-b last:border-0"
                    >
                      <td className="px-5 py-3 align-top">
                        <div className="font-medium">
                          {item.sequenceNumber}. {item.description}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {item.responsibleParty || '-'}
                        </div>
                      </td>
                      <td className="px-5 py-3 align-top">{item.isCompleted ? 'Yes' : 'No'}</td>
                      <td className="px-5 py-3 align-top">{item.isVerified ? 'Yes' : 'No'}</td>
                      <td className="max-w-sm px-5 py-3 align-top text-muted-foreground">
                        {item.notes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-lg border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-semibold">Test Results</h2>
              </div>
              {evidencePackage.testResults.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No test results are linked to this lot.
                </p>
              ) : (
                <div className="space-y-3">
                  {evidencePackage.testResults.map((test) => (
                    <div key={test.id} className="border-b pb-3 last:border-0 last:pb-0">
                      <div className="font-medium">{test.testType}</div>
                      <div className="text-sm text-muted-foreground">
                        {test.passFail || 'pending'} · {test.resultValue ?? '-'}{' '}
                        {test.resultUnit || ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-semibold">Photos And Attachments</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                {checklistStats?.photos || 0} photo(s), {evidencePackage.summary.totalAttachments}{' '}
                checklist attachment(s).
              </p>
              <div className="mt-3 space-y-2">
                {evidencePackage.photos.slice(0, 5).map((photo) => (
                  <div key={photo.id} className="truncate text-sm">
                    {photo.filename}
                  </div>
                ))}
                {evidencePackage.photos.length > 5 && (
                  <div className="text-sm text-muted-foreground">
                    +{evidencePackage.photos.length - 5} more
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <aside className="rounded-lg border bg-card p-5 shadow-sm lg:sticky lg:top-6 lg:self-start">
          {releaseResult ? (
            <div>
              <div className="flex items-center gap-2 text-emerald-700" role="status">
                <CheckCircle2 className="h-5 w-5" />
                <h2 className="font-semibold">Hold Point Released</h2>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Released by {releaseResult.holdPoint.releasedByName || releasedByName} at{' '}
                {formatDateTime(releaseResult.holdPoint.releasedAt)}.
              </p>
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
                  className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
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
                  disabled={!canRelease || submitting}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </label>

              <label className="block text-sm font-medium">
                Organisation
                <input
                  value={releasedByOrg}
                  onChange={(event) => setReleasedByOrg(event.target.value)}
                  maxLength={160}
                  disabled={!canRelease || submitting}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
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
                  className="mt-1 w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </label>

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
                disabled={!canRelease || submitting || !releasedByName.trim()}
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
