import { useRef, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Eye, Upload, X } from 'lucide-react';
import { apiFetch, authFetch } from '@/lib/api';
import { toast } from '@/components/ui/toaster';
import type { HPEvidencePackageData } from '@/lib/pdfGenerator';
import type { HoldPoint, HoldPointDetails, RequestError } from '../types';
import { ResponsiveSheet } from '@/components/ui/ResponsiveSheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { logError } from '@/lib/logger';
import { formatDateKey } from '@/lib/localDate';
import { EvidencePreviewModal } from './EvidencePreviewModal';
import { requestReleaseSchema, type RequestReleaseFormData } from './requestReleaseModalHelpers';

interface UploadedEvidenceDocument {
  id: string;
  filename: string;
}

interface RequestReleaseModalProps {
  holdPoint: HoldPoint;
  details: HoldPointDetails | null;
  loading: boolean;
  requesting: boolean;
  error: RequestError | null;
  onClose: () => void;
  onSubmit: (
    scheduledDate: string,
    scheduledTime: string,
    notificationSentTo: string,
    overrideNoticePeriod?: boolean,
    overrideReason?: string,
    evidenceDocumentIds?: string[],
  ) => void;
}

function getCurrentProjectId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const match = window.location.pathname.match(/\/projects\/([^/?#]+)/);
  if (!match) {
    return null;
  }

  try {
    return decodeURIComponent(match[1]);
  } catch (_error) {
    return match[1];
  }
}

async function getUploadErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as {
      error?: string | { message?: string };
      message?: string;
    };
    if (typeof data.error === 'string') return data.error;
    if (typeof data.error === 'object' && data.error?.message) return data.error.message;
    return data.message || 'Evidence upload failed';
  } catch (_error) {
    return 'Evidence upload failed';
  }
}

export function RequestReleaseModal({
  holdPoint,
  details,
  loading,
  requesting,
  error,
  onClose,
  onSubmit,
}: RequestReleaseModalProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<HPEvidencePackageData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [uploadedEvidenceDocuments, setUploadedEvidenceDocuments] = useState<
    UploadedEvidenceDocument[]
  >([]);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const loadingPreviewRef = useRef(false);

  const {
    register,
    handleSubmit: rhfHandleSubmit,
    setValue,
    getValues,
    watch,
    formState: { errors },
  } = useForm<RequestReleaseFormData>({
    resolver: zodResolver(requestReleaseSchema),
    mode: 'onBlur',
    defaultValues: {
      scheduledDate: '',
      scheduledTime: '',
      notificationSentTo: '',
      overrideReason: '',
    },
  });

  const notificationSentTo = watch('notificationSentTo');

  // Feature #697 - Pre-fill notification email with default recipients from project settings
  useEffect(() => {
    if (details?.defaultRecipients && details.defaultRecipients.length > 0 && !notificationSentTo) {
      setValue('notificationSentTo', details.defaultRecipients.join(', '));
    }
  }, [details?.defaultRecipients, notificationSentTo, setValue]);

  // Check if we have a notice period warning that needs override
  const hasNoticePeriodWarning = error?.code === 'NOTICE_PERIOD_WARNING';
  const evidenceDocumentIds = uploadedEvidenceDocuments.map((document) => document.id);

  const onFormSubmit = (data: RequestReleaseFormData) => {
    if (uploadingEvidence) {
      toast({
        title: 'Evidence upload in progress',
        description: 'Wait for the upload to finish before requesting release.',
        variant: 'warning',
      });
      return;
    }

    onSubmit(
      data.scheduledDate,
      data.scheduledTime,
      data.notificationSentTo,
      undefined,
      undefined,
      evidenceDocumentIds,
    );
  };

  const handleOverrideSubmit = () => {
    if (uploadingEvidence) {
      toast({
        title: 'Evidence upload in progress',
        description: 'Wait for the upload to finish before requesting release.',
        variant: 'warning',
      });
      return;
    }

    const overrideReason = getValues('overrideReason');
    if (!overrideReason?.trim()) {
      toast({
        title: 'Override reason required',
        description: 'Please provide a reason for overriding the notice period',
        variant: 'error',
      });
      return;
    }
    const { scheduledDate, scheduledTime, notificationSentTo: sentTo } = getValues();
    onSubmit(scheduledDate, scheduledTime, sentTo, true, overrideReason, evidenceDocumentIds);
  };

  const handleEvidenceUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';

    if (files.length === 0) {
      return;
    }

    const projectId = getCurrentProjectId();
    if (!projectId) {
      setUploadError('Unable to determine the project for this evidence upload.');
      toast({
        title: 'Evidence upload failed',
        description: 'Unable to determine the project for this evidence upload.',
        variant: 'error',
      });
      return;
    }

    setUploadingEvidence(true);
    setUploadError(null);

    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('projectId', projectId);
        formData.append('lotId', holdPoint.lotId);
        formData.append('documentType', 'hold_point_request_evidence');
        formData.append('category', 'itp_evidence');
        formData.append('caption', `Release request evidence - ${holdPoint.lotNumber}`);

        const response = await authFetch('/api/documents/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(await getUploadErrorMessage(response));
        }

        const uploadedDocument = (await response.json()) as {
          id?: string;
          filename?: string;
        };
        if (!uploadedDocument.id) {
          throw new Error('Evidence upload did not return a document id');
        }
        const uploadedDocumentId = uploadedDocument.id;

        setUploadedEvidenceDocuments((current) => [
          ...current,
          {
            id: uploadedDocumentId,
            filename: uploadedDocument.filename || file.name,
          },
        ]);
      }
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : 'Evidence upload failed';
      setUploadError(message);
      toast({
        title: 'Evidence upload failed',
        description: message,
        variant: 'error',
      });
    } finally {
      setUploadingEvidence(false);
    }
  };

  const removeEvidenceDocument = (documentId: string) => {
    setUploadedEvidenceDocuments((current) =>
      current.filter((document) => document.id !== documentId),
    );
  };

  const handlePreviewPackage = async () => {
    if (loadingPreviewRef.current) return;

    loadingPreviewRef.current = true;
    setLoadingPreview(true);
    try {
      const data = await apiFetch<{ evidencePackage: HPEvidencePackageData }>(
        '/api/holdpoints/preview-evidence-package',
        {
          method: 'POST',
          body: JSON.stringify({
            lotId: holdPoint.lotId,
            itpChecklistItemId: holdPoint.itpChecklistItemId,
          }),
        },
      );
      setPreviewData(data.evidencePackage);
      setShowPreview(true);
    } catch (err) {
      logError('Failed to fetch preview:', err);
      toast({
        title: 'Error',
        description: 'Failed to load evidence package preview',
        variant: 'error',
      });
    } finally {
      loadingPreviewRef.current = false;
      setLoadingPreview(false);
    }
  };

  const handleDownloadPreviewPDF = async () => {
    if (previewData) {
      try {
        const { generateHPEvidencePackagePDF } = await import('@/lib/pdfGenerator');
        await generateHPEvidencePackagePDF(previewData);
      } catch (err) {
        logError('Failed to generate evidence package preview PDF:', err);
        toast({
          title: 'PDF failed',
          description: 'Failed to generate evidence package preview PDF',
          variant: 'error',
        });
        return;
      }
      toast({
        title: 'PDF Downloaded',
        description: 'Evidence package preview PDF has been downloaded',
      });
    }
  };

  const canSubmit = details?.canRequestRelease && !requesting && !uploadingEvidence;

  // Footer for the "can request" happy-path form — rendered in the sticky footer
  // of the sheet so Submit is always in reach without scrolling.
  const formFooter =
    details?.canRequestRelease && !error ? (
      <>
        <Button
          type="button"
          variant="outline"
          onClick={handlePreviewPackage}
          disabled={loadingPreview}
          className="border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
        >
          {loadingPreview ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span>Loading...</span>
            </>
          ) : (
            <>
              <Eye className="h-4 w-4" />
              <span>Preview Package</span>
            </>
          )}
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={requesting}>
            Cancel
          </Button>
          <Button type="submit" form="request-release-form" disabled={!canSubmit}>
            {requesting ? 'Requesting...' : 'Request Release'}
          </Button>
        </div>
      </>
    ) : (
      <Button variant="outline" onClick={onClose}>
        Close
      </Button>
    );

  return (
    <>
      <ResponsiveSheet
        open={true}
        onClose={onClose}
        title="Request Hold Point Release"
        footer={formFooter}
        className="max-w-lg"
      >
        {/* Hold-point summary */}
        <div className="mb-4 p-3 bg-muted rounded-lg">
          <div className="text-sm text-muted-foreground">Lot</div>
          <div className="font-medium">{holdPoint.lotNumber}</div>
          <div className="text-sm text-muted-foreground mt-2">Hold Point</div>
          <div className="font-medium">{holdPoint.description}</div>
        </div>

        {/* Description (visible to screen readers) */}
        <p className="sr-only">
          Schedule release notification and review prerequisites for this hold point.
        </p>

        {loading ? (
          <div
            className="flex justify-center p-8"
            role="status"
            aria-label="Loading hold point details"
          >
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <>
            {/* Prerequisites Section */}
            {details && details.prerequisites.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium mb-2">Prerequisites</h3>
                <div className="space-y-2">
                  {details.prerequisites.map((prereq) => (
                    <div
                      key={prereq.id}
                      className={`flex items-center gap-2 p-2 rounded text-sm ${
                        prereq.isCompleted
                          ? 'bg-success/10 text-success'
                          : 'bg-destructive/10 text-destructive'
                      }`}
                    >
                      <span className="text-lg">{prereq.isCompleted ? '✓' : '✗'}</span>
                      <span className="flex-1">
                        {prereq.sequenceNumber}. {prereq.description}
                        {prereq.isHoldPoint && (
                          <span className="ml-2 text-xs px-1 bg-brand/15 text-brand rounded">
                            HP
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error / Block Message */}
            {error && !hasNoticePeriodWarning && (
              <div
                className="mb-4 p-4 bg-destructive/10 border border-destructive/30 rounded-lg"
                role="alert"
              >
                <div className="flex items-start gap-2">
                  <span className="text-destructive text-xl">&#x26a0;&#xfe0f;</span>
                  <div>
                    <div className="font-medium text-destructive">{error.message}</div>
                    {error.incompleteItems && error.incompleteItems.length > 0 && (
                      <div className="mt-2">
                        <div className="text-sm text-destructive mb-1">Missing prerequisites:</div>
                        <ul className="text-sm text-destructive list-disc list-inside">
                          {error.incompleteItems.map((item) => (
                            <li key={item.id}>
                              {item.sequenceNumber}. {item.description}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Notice Period Warning - Allow Override (Feature #180) */}
            {hasNoticePeriodWarning && (
              <div
                className="mb-4 p-4 bg-warning/10 border border-warning/30 rounded-lg"
                role="alert"
              >
                <div className="flex items-start gap-2">
                  <span className="text-warning text-xl">&#x26a0;&#xfe0f;</span>
                  <div className="flex-1">
                    <div className="font-medium text-warning">{error!.message}</div>
                    {error!.details && (
                      <div className="mt-2 text-sm text-warning">
                        <p>
                          Scheduled date provides only {error!.details.workingDaysNotice} working
                          day{error!.details.workingDaysNotice !== 1 ? 's' : ''} notice.
                        </p>
                        <p>
                          Minimum required: {error!.details.minimumNoticeDays} working day
                          {error!.details.minimumNoticeDays !== 1 ? 's' : ''}.
                        </p>
                      </div>
                    )}
                    <div className="mt-4 space-y-3">
                      <div>
                        <Label className="text-warning">Override Reason (required)</Label>
                        <Textarea
                          {...register('overrideReason')}
                          className="border-warning/40"
                          placeholder="Explain why this short notice is necessary..."
                          rows={2}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          onClick={handleOverrideSubmit}
                          disabled={
                            requesting || uploadingEvidence || !watch('overrideReason')?.trim()
                          }
                          className="bg-warning text-warning-foreground hover:bg-warning/90 min-h-[44px]"
                        >
                          {requesting ? 'Requesting...' : 'Override & Submit'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={onClose}
                          className="border-warning/40 hover:bg-warning/10 min-h-[44px]"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Can Request - Show Form */}
            {details?.canRequestRelease && !error && (
              <form
                id="request-release-form"
                onSubmit={rhfHandleSubmit(onFormSubmit)}
                className="space-y-4"
              >
                <div className="p-3 bg-success/10 border border-success/20 rounded-lg mb-4">
                  <div className="flex items-center gap-2 text-success">
                    <span className="text-lg">&#x2713;</span>
                    <span className="font-medium">All prerequisites completed</span>
                  </div>
                  <p className="text-sm text-success mt-1">
                    You can now request release for this hold point.
                  </p>
                </div>

                <div>
                  <Label htmlFor="request-release-scheduled-date">Scheduled Date</Label>
                  <Input
                    id="request-release-scheduled-date"
                    type="date"
                    {...register('scheduledDate')}
                    min={formatDateKey()}
                    className={errors.scheduledDate ? 'border-destructive' : ''}
                  />
                  {errors.scheduledDate && (
                    <p className="mt-1 text-sm text-destructive" role="alert">
                      {errors.scheduledDate.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="request-release-scheduled-time">Scheduled Time</Label>
                  <Input
                    id="request-release-scheduled-time"
                    type="time"
                    {...register('scheduledTime')}
                    className={errors.scheduledTime ? 'border-destructive' : ''}
                  />
                  {errors.scheduledTime && (
                    <p className="mt-1 text-sm text-destructive" role="alert">
                      {errors.scheduledTime.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="request-release-notification-emails">Notify (Emails)</Label>
                  <Input
                    id="request-release-notification-emails"
                    type="text"
                    {...register('notificationSentTo')}
                    className={errors.notificationSentTo ? 'border-destructive' : ''}
                    placeholder="inspector@example.com, superintendent@example.com"
                  />
                  {errors.notificationSentTo && (
                    <p className="mt-1 text-sm text-destructive" role="alert">
                      {errors.notificationSentTo.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="request-release-evidence">Release Evidence</Label>
                  <div className="rounded-lg border border-dashed border-border bg-muted p-3">
                    <div className="flex items-center gap-3">
                      <Upload className="h-4 w-4 text-muted-foreground" />
                      <Input
                        id="request-release-evidence"
                        type="file"
                        multiple
                        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.csv"
                        onChange={handleEvidenceUpload}
                        disabled={uploadingEvidence || requesting}
                        className="min-h-[44px] bg-background"
                      />
                    </div>
                    {uploadingEvidence && (
                      <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        <span>Uploading...</span>
                      </div>
                    )}
                    {uploadError && (
                      <p className="mt-2 text-sm text-destructive" role="alert">
                        {uploadError}
                      </p>
                    )}
                    {uploadedEvidenceDocuments.length > 0 && (
                      <ul className="mt-3 space-y-2">
                        {uploadedEvidenceDocuments.map((document) => (
                          <li
                            key={document.id}
                            className="flex items-center justify-between gap-2 rounded bg-success/10 px-2 py-1 text-sm text-success"
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <Check className="h-4 w-4 shrink-0" />
                              <span className="truncate">Uploaded: {document.filename}</span>
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-success hover:bg-success/10"
                              aria-label={`Remove ${document.filename}`}
                              onClick={() => removeEvidenceDocument(document.id)}
                              disabled={requesting}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </form>
            )}

            {/* Cannot Request - Show Block */}
            {details && !details.canRequestRelease && !error && (
              <div className="space-y-4">
                <div className="p-4 bg-warning/10 border border-warning/30 rounded-lg" role="alert">
                  <div className="flex items-start gap-2">
                    <span className="text-warning text-xl">&#x26a0;&#xfe0f;</span>
                    <div>
                      <div className="font-medium text-warning">Cannot request release yet</div>
                      <p className="text-sm text-warning mt-1">
                        Complete all preceding checklist items before requesting hold point release.
                      </p>
                    </div>
                  </div>
                </div>

                {details.incompletePrerequisites.length > 0 && (
                  <div>
                    <div className="text-sm font-medium mb-2">Items to complete:</div>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {details.incompletePrerequisites.map((item) => (
                        <li key={item.id} className="flex items-center gap-2">
                          <span className="text-destructive">&#x2717;</span>
                          {item.sequenceNumber}. {item.description}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </ResponsiveSheet>

      {/* Evidence Package Preview Modal */}
      {showPreview && previewData && (
        <EvidencePreviewModal
          previewData={previewData}
          onClose={() => setShowPreview(false)}
          onDownload={handleDownloadPreviewPDF}
        />
      )}
    </>
  );
}
