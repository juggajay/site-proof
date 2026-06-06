import { useRef, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { toast } from '@/components/ui/toaster';
import type { HPEvidencePackageData } from '@/lib/pdfGenerator';
import type { HoldPoint, HoldPointDetails, RequestError } from '../types';
import { Modal, ModalHeader, ModalDescription, ModalBody } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { logError } from '@/lib/logger';
import { formatDateKey } from '@/lib/localDate';
import { EvidencePreviewModal } from './EvidencePreviewModal';
import { requestReleaseSchema, type RequestReleaseFormData } from './requestReleaseModalHelpers';

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
  ) => void;
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

  const onFormSubmit = (data: RequestReleaseFormData) => {
    onSubmit(data.scheduledDate, data.scheduledTime, data.notificationSentTo);
  };

  const handleOverrideSubmit = () => {
    const overrideReason = getValues('overrideReason');
    if (!overrideReason?.trim()) {
      toast({
        title: 'Override reason required',
        description: 'Please provide a reason for overriding the notice period',
        variant: 'error',
      });
      return;
    }
    const { scheduledDate, scheduledTime, notificationSentTo } = getValues();
    onSubmit(scheduledDate, scheduledTime, notificationSentTo, true, overrideReason);
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

  const canSubmit = details?.canRequestRelease && !requesting;

  return (
    <>
      <Modal onClose={onClose} className="max-w-lg">
        <ModalHeader>Request Hold Point Release</ModalHeader>
        <ModalDescription>
          Schedule release notification and review prerequisites for this hold point.
        </ModalDescription>
        <ModalBody>
          <div className="mb-4 p-3 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground">Lot</div>
            <div className="font-medium">{holdPoint.lotNumber}</div>
            <div className="text-sm text-muted-foreground mt-2">Hold Point</div>
            <div className="font-medium">{holdPoint.description}</div>
          </div>

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
                            ? 'bg-green-50 text-green-800'
                            : 'bg-red-50 text-red-800'
                        }`}
                      >
                        <span className="text-lg">{prereq.isCompleted ? '\u2713' : '\u2717'}</span>
                        <span className="flex-1">
                          {prereq.sequenceNumber}. {prereq.description}
                          {prereq.isHoldPoint && (
                            <span className="ml-2 text-xs px-1 bg-amber-200 rounded">HP</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Error / Block Message */}
              {error && !hasNoticePeriodWarning && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg" role="alert">
                  <div className="flex items-start gap-2">
                    <span className="text-red-500 text-xl">&#x26a0;&#xfe0f;</span>
                    <div>
                      <div className="font-medium text-red-800">{error.message}</div>
                      {error.incompleteItems && error.incompleteItems.length > 0 && (
                        <div className="mt-2">
                          <div className="text-sm text-red-700 mb-1">Missing prerequisites:</div>
                          <ul className="text-sm text-red-600 list-disc list-inside">
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
                  className="mb-4 p-4 bg-amber-50 border border-amber-300 rounded-lg"
                  role="alert"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-amber-500 text-xl">&#x26a0;&#xfe0f;</span>
                    <div className="flex-1">
                      <div className="font-medium text-amber-800">{error!.message}</div>
                      {error!.details && (
                        <div className="mt-2 text-sm text-amber-700">
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
                          <Label className="text-amber-800">Override Reason (required)</Label>
                          <Textarea
                            {...register('overrideReason')}
                            className="border-amber-300"
                            placeholder="Explain why this short notice is necessary..."
                            rows={2}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            onClick={handleOverrideSubmit}
                            disabled={requesting || !watch('overrideReason')?.trim()}
                            className="bg-amber-600 hover:bg-amber-700"
                          >
                            {requesting ? 'Requesting...' : 'Override & Submit'}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            className="border-amber-300 hover:bg-amber-100"
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
                <form onSubmit={rhfHandleSubmit(onFormSubmit)} className="space-y-4">
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg mb-4">
                    <div className="flex items-center gap-2 text-green-800">
                      <span className="text-lg">&#x2713;</span>
                      <span className="font-medium">All prerequisites completed</span>
                    </div>
                    <p className="text-sm text-green-700 mt-1">
                      You can now request release for this hold point.
                    </p>
                  </div>

                  <div>
                    <Label>Scheduled Date</Label>
                    <Input
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
                    <Label>Scheduled Time</Label>
                    <Input
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
                    <Label>Notify (Emails)</Label>
                    <Input
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

                  <div className="flex justify-between items-center pt-4 border-t">
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
                      <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        disabled={requesting}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={!canSubmit}>
                        {requesting ? 'Requesting...' : 'Request Release'}
                      </Button>
                    </div>
                  </div>
                </form>
              )}

              {/* Cannot Request - Show Block */}
              {details && !details.canRequestRelease && !error && (
                <div className="space-y-4">
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg" role="alert">
                    <div className="flex items-start gap-2">
                      <span className="text-amber-500 text-xl">&#x26a0;&#xfe0f;</span>
                      <div>
                        <div className="font-medium text-amber-800">Cannot request release yet</div>
                        <p className="text-sm text-amber-700 mt-1">
                          Complete all preceding checklist items before requesting hold point
                          release.
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
                            <span className="text-red-500">&#x2717;</span>
                            {item.sequenceNumber}. {item.description}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex justify-end pt-4 border-t">
                    <Button variant="outline" onClick={onClose}>
                      Close
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </ModalBody>
      </Modal>

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
