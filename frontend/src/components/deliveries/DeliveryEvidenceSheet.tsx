/**
 * Wave C5-a — file a docket against a delivery that ALREADY EXISTS.
 *
 * This is the post-submission path, and it is the whole reason the evidence
 * route bypasses the diary lock. The foreman submits the diary at 5pm; the
 * supplier's paper docket turns up the next morning. The delivery he recorded
 * is not editable any more — and must not be — but the docket that proves it is
 * evidence, not a diary edit, so it can still be filed.
 *
 * The sheet therefore never offers to change description / quantity / supplier.
 * It states what was recorded, and offers exactly one action: file the docket.
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';

import { BottomSheet } from '@/components/foreman/sheets/BottomSheet';
import { toast } from '@/components/ui/toaster';
import { useAuth } from '@/lib/auth';
import { deleteOfflinePhoto, type OfflinePhoto } from '@/lib/offlineDb';
import { formatStatusLabel } from '@/lib/statusLabels';
import { useOfflineStatus } from '@/lib/useOfflineStatus';
import { DeliveryDocketCapture } from './DeliveryDocketCapture';
import { docketFilingStatusKey, type DocketFilingStatusKey } from './docketFilingState';
import { queueDeliveryDocket } from './queueDeliveryDocket';

export interface DeliveryEvidenceSheetDelivery {
  id: string;
  description: string;
  supplier?: string | null;
  docketNumber?: string | null;
  quantity?: number | string | null;
  unit?: string | null;
  lotLabel?: string | null;
  recordedAt?: string | null;
  docketDocumentId?: string | null;
}

export interface DeliveryEvidenceSheetProps {
  isOpen: boolean;
  onClose: () => void;
  delivery: DeliveryEvidenceSheetDelivery;
  projectId: string;
  lotId?: string;
  /** The docket photo already queued on this device for this delivery, if any. */
  queuedPhoto?: OfflinePhoto | null;
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2 text-[14px] leading-[1.5]">
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 text-foreground">{value}</span>
    </div>
  );
}

export function DeliveryEvidenceSheet({
  isOpen,
  onClose,
  delivery,
  projectId,
  lotId,
  queuedPhoto,
}: DeliveryEvidenceSheetProps) {
  const { user } = useAuth();
  const { isOnline, retryFailedSyncs, syncPendingChanges } = useOfflineStatus();
  const [file, setFile] = useState<File | null>(null);
  const [filing, setFiling] = useState(false);

  // A fresh open must not inherit the previous delivery's pick.
  useEffect(() => {
    if (!isOpen) setFile(null);
  }, [isOpen]);

  const statusKey: DocketFilingStatusKey = docketFilingStatusKey({
    docketDocumentId: delivery.docketDocumentId,
    photo: queuedPhoto,
    isOnline,
  });
  const hasFailed = statusKey === 'delivery_docket_filing_failed';

  const meta: Array<[string, string | null | undefined]> = [
    ['Supplier', delivery.supplier],
    ['Docket no.', delivery.docketNumber],
    [
      'Quantity',
      delivery.quantity != null && delivery.quantity !== ''
        ? [delivery.quantity, delivery.unit].filter(Boolean).join(' ')
        : null,
    ],
    ['Lot', delivery.lotLabel],
    [
      'Recorded',
      delivery.recordedAt
        ? new Date(delivery.recordedAt).toLocaleString('en-AU', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            hour: 'numeric',
            minute: '2-digit',
          })
        : null,
    ],
  ];

  const handleFile = async () => {
    if (!file) return;
    setFiling(true);
    try {
      await queueDeliveryDocket({
        projectId,
        deliveryId: delivery.id,
        file,
        lotId,
        capturedBy: user?.id ?? 'unknown',
      });
      // Never "Filed" here: the queue has it, the server does not yet.
      toast({
        title: 'Docket saved on this device',
        description: isOnline
          ? 'It is filing against this delivery now.'
          : 'It files against this delivery once you are back on signal.',
      });
      setFile(null);
      onClose();
    } catch (error) {
      toast({
        title: 'Could not save the docket',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'error',
      });
    } finally {
      setFiling(false);
    }
  };

  const handleRetry = async () => {
    setFiling(true);
    try {
      // The shipped retry path. The photo already carries its serverDocumentId,
      // so this re-runs the evidence PATCH ONLY — the file is never uploaded a
      // second time.
      await retryFailedSyncs();
      await syncPendingChanges();
    } finally {
      setFiling(false);
    }
  };

  const handleRemoveQueued = async () => {
    if (!queuedPhoto) {
      setFile(null);
      return;
    }
    await deleteOfflinePhoto(queuedPhoto.id);
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={delivery.description}>
      <div className="space-y-4">
        <div className="space-y-1">
          {meta
            .filter(([, value]) => Boolean(value))
            .map(([label, value]) => (
              <MetaRow key={label} label={label} value={String(value)} />
            ))}
        </div>

        {hasFailed ? (
          <div className="flex gap-2.5 rounded-2xl bg-destructive/[.07] px-4 py-3.5 text-[14px] leading-[1.5] text-destructive">
            <AlertTriangle size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              The photo uploaded but wouldn&rsquo;t attach to this delivery. It&rsquo;s still on
              your phone — nothing is lost.
            </span>
          </div>
        ) : (
          statusKey !== 'delivery_docket_filed' && (
            <div className="flex gap-2.5 rounded-2xl bg-warning/[.09] px-4 py-3.5 text-[14px] leading-[1.5] text-warning">
              <AlertTriangle size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                {formatStatusLabel('delivery_docket_not_filed')}. The delivery is recorded; its
                docket isn&rsquo;t.
              </span>
            </div>
          )
        )}

        {statusKey !== 'delivery_docket_filed' && (
          <DeliveryDocketCapture
            file={file}
            queuedDataUrl={file ? null : queuedPhoto?.dataUrl}
            statusKey={file ? null : queuedPhoto ? statusKey : null}
            onSelect={setFile}
            onRemove={() => void handleRemoveQueued()}
            allowGallery
            disabled={filing}
          />
        )}

        {hasFailed ? (
          <button
            type="button"
            onClick={() => void handleRetry()}
            disabled={filing}
            className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-xl bg-primary text-[16px] font-semibold text-primary-foreground touch-manipulation disabled:opacity-50"
          >
            {filing ? (
              <Loader2 size={20} className="animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw size={20} aria-hidden="true" />
            )}
            Try filing again
          </button>
        ) : (
          statusKey !== 'delivery_docket_filed' && (
            <button
              type="button"
              onClick={() => void handleFile()}
              disabled={!file || filing}
              className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-xl bg-primary text-[16px] font-semibold text-primary-foreground touch-manipulation disabled:opacity-50"
            >
              {filing && <Loader2 size={20} className="animate-spin" aria-hidden="true" />}
              File docket
            </button>
          )
        )}
      </div>
    </BottomSheet>
  );
}
