import { useRef, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, Download } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { toast } from '@/components/ui/toaster';
import type { HPEvidencePackageData } from '@/lib/pdfGenerator';
import type { HoldPoint, HoldPointDetails, RequestError } from '../types';
import {
  Modal,
  ModalHeader,
  ModalDescription,
  ModalBody,
  ModalFooter,
} from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { logError } from '@/lib/logger';

const emailAddressSchema = z.string().trim().email();

function parseNotificationEmails(value: string): string[] {
  return value
    .split(/[,\n;]/)
    .map((email) => email.trim())
    .filter(Boolean);
}

const requestReleaseSchema = z.object({
  scheduledDate: z.string().min(1, 'Scheduled date is required'),
  scheduledTime: z.string().min(1, 'Scheduled time is required'),
  notificationSentTo: z
    .string()
    .min(1, 'At least one notification email is required')
    .refine((value) => {
      const emails = parseNotificationEmails(value);
      return (
        emails.length > 0 && emails.every((email) => emailAddressSchema.safeParse(email).success)
      );
    }, 'Enter valid email addresses separated by commas or semicolons'),
  overrideReason: z.string().optional(),
});

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

type RequestReleaseFormData = z.infer<typeof requestReleaseSchema>;

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
                      min={new Date().toISOString().split('T')[0]}
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

/** Nested preview modal for evidence package */
function EvidencePreviewModal({
  previewData,
  onClose,
  onDownload,
}: {
  previewData: HPEvidencePackageData;
  onClose: () => void;
  onDownload: () => void;
}) {
  return (
    <Modal onClose={onClose} className="max-w-4xl">
      {/* Preview Header */}
      <div className="flex items-center justify-between p-4 border-b bg-primary/5">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Evidence Package Preview</h3>
          <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded">PREVIEW</span>
        </div>
      </div>

      {/* Preview Content */}
      <ModalBody className="space-y-6">
        {/* Hold Point Info */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-muted/30 rounded-lg">
            <div className="text-sm text-muted-foreground">Hold Point</div>
            <div className="font-medium">{previewData.holdPoint.description}</div>
          </div>
          <div className="p-4 bg-muted/30 rounded-lg">
            <div className="text-sm text-muted-foreground">Lot</div>
            <div className="font-medium">{previewData.lot.lotNumber}</div>
            {previewData.lot.activityType && (
              <div className="text-sm text-muted-foreground">{previewData.lot.activityType}</div>
            )}
          </div>
        </div>

        {/* Project & ITP Info */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-muted/30 rounded-lg">
            <div className="text-sm text-muted-foreground">Project</div>
            <div className="font-medium">{previewData.project.name}</div>
            <div className="text-sm text-muted-foreground">{previewData.project.projectNumber}</div>
          </div>
          <div className="p-4 bg-muted/30 rounded-lg">
            <div className="text-sm text-muted-foreground">ITP Template</div>
            <div className="font-medium">{previewData.itpTemplate.name}</div>
          </div>
        </div>

        {/* Checklist Items */}
        <div>
          <h4 className="font-medium mb-3">
            Checklist Items ({previewData.summary.completedItems}/
            {previewData.summary.totalChecklistItems} completed)
          </h4>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Description</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Completed By</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {previewData.checklist.map((item) => (
                  <tr
                    key={item.sequenceNumber}
                    className={item.isCompleted ? 'bg-green-50/50' : 'bg-red-50/50'}
                  >
                    <td className="px-3 py-2">{item.sequenceNumber}</td>
                    <td className="px-3 py-2">{item.description}</td>
                    <td className="px-3 py-2">
                      {item.pointType === 'hold' && (
                        <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded">
                          HP
                        </span>
                      )}
                      {item.pointType === 'witness' && (
                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded">
                          WP
                        </span>
                      )}
                      {item.pointType === 'standard' && (
                        <span className="px-1.5 py-0.5 bg-muted text-foreground text-xs rounded">
                          Std
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {item.isCompleted ? (
                        <span className="text-green-600">&#x2713; Completed</span>
                      ) : (
                        <span className="text-red-600">&#x2717; Incomplete</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{item.completedBy || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Test Results */}
        {previewData.testResults.length > 0 && (
          <div>
            <h4 className="font-medium mb-3">
              Test Results ({previewData.summary.passingTests}/
              {previewData.summary.totalTestResults} passing)
            </h4>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left">Test Type</th>
                    <th className="px-3 py-2 text-left">Lab</th>
                    <th className="px-3 py-2 text-left">Result</th>
                    <th className="px-3 py-2 text-left">Pass/Fail</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {previewData.testResults.map((test) => (
                    <tr key={test.id}>
                      <td className="px-3 py-2">{test.testType}</td>
                      <td className="px-3 py-2">{test.laboratoryName || '-'}</td>
                      <td className="px-3 py-2">
                        {test.resultValue} {test.resultUnit}
                      </td>
                      <td className="px-3 py-2">
                        {test.passFail === 'pass' ? (
                          <span className="text-green-600">&#x2713; Pass</span>
                        ) : (
                          <span className="text-red-600">&#x2717; Fail</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
          <h4 className="font-medium text-foreground mb-2">Evidence Summary</h4>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-primary">Checklist Items</div>
              <div className="font-semibold text-foreground">
                {previewData.summary.completedItems}/{previewData.summary.totalChecklistItems}
              </div>
            </div>
            <div>
              <div className="text-primary">Verified Items</div>
              <div className="font-semibold text-foreground">
                {previewData.summary.verifiedItems}
              </div>
            </div>
            <div>
              <div className="text-primary">Test Results</div>
              <div className="font-semibold text-foreground">
                {previewData.summary.passingTests}/{previewData.summary.totalTestResults}
              </div>
            </div>
            <div>
              <div className="text-primary">Photos/Attachments</div>
              <div className="font-semibold text-foreground">
                {previewData.summary.totalPhotos + previewData.summary.totalAttachments}
              </div>
            </div>
          </div>
        </div>
      </ModalBody>

      {/* Preview Footer */}
      <ModalFooter>
        <p className="text-sm text-muted-foreground mr-auto">
          This is a preview of the evidence package that will be generated.
        </p>
        <Button
          variant="outline"
          onClick={onDownload}
          className="border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
        >
          <Download className="h-4 w-4" />
          Download PDF
        </Button>
        <Button onClick={onClose}>Continue to Request</Button>
      </ModalFooter>
    </Modal>
  );
}
