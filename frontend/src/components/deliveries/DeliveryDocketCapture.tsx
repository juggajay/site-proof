/**
 * Wave C5-a — the ONE delivery docket capture control.
 *
 * Mounted in three places and implemented once: the shell's DeliveryFormScreen
 * (/m/diary/work/delivery, canonical), the diary page's AddDeliverySheet, and
 * DeliveryEvidenceSheet (filing against a delivery that already exists). It
 * lives outside `shell/**` precisely so those three cannot drift apart.
 *
 * It owns the two inputs and the state line; it does NOT own the queue. The
 * caller decides which delivery the photo belongs to and hands it to
 * `queueDeliveryDocket`, because in the create flow the delivery does not exist
 * yet when the photo is taken.
 *
 * Sizes are the shell's, not the defaults: `QuickPhotoCapture`'s buttons are
 * 44px and this is the primary action of a gloved one-handed screen, so it
 * renders `shell-photobtn` at 62px and every secondary control clears 48px.
 */

import { useEffect, useRef, useState } from 'react';
import { Camera, Image as ImageIcon, X } from 'lucide-react';

import { toast } from '@/components/ui/toaster';
import { formatStatusLabel } from '@/lib/statusLabels';
import { cn } from '@/lib/utils';
import type { DocketFilingStatusKey } from './docketFilingState';

/** Matches QuickPhotoCapture's shipped limit so both paths refuse the same files. */
const MAX_FILE_BYTES = 10 * 1024 * 1024;

/**
 * Sync copy sits at 14px in a state colour, never `muted-foreground` at 12px:
 * this line is the only thing telling a foreman whether his evidence has
 * actually left the phone.
 */
const STATE_TONE: Record<DocketFilingStatusKey, string> = {
  delivery_docket_filed: 'text-success',
  delivery_docket_uploading: 'text-info',
  delivery_docket_saved_on_device: 'text-warning',
  delivery_docket_filing_failed: 'text-destructive',
  delivery_docket_not_filed: 'text-foreground',
};

export interface DeliveryDocketCaptureProps {
  /** The captured file, held by the caller so it survives this control. */
  file: File | null;
  /**
   * A docket photo ALREADY queued on this device (its stored data URL). Lets
   * the evidence sheet show the same card for a capture that is mid-flight or
   * has failed to file, instead of a second card that would drift.
   */
  queuedDataUrl?: string | null;
  onSelect: (file: File) => void;
  onRemove: () => void;
  /** Filing state of the docket, when the caller knows it. */
  statusKey?: DocketFilingStatusKey | null;
  /** Copy shown under the capture button while nothing is captured. */
  hint?: string;
  /** Offer the gallery as well as the camera (the evidence sheet does). */
  allowGallery?: boolean;
  disabled?: boolean;
  className?: string;
}

export function DeliveryDocketCapture({
  file,
  queuedDataUrl,
  onSelect,
  onRemove,
  statusKey,
  hint,
  allowGallery = false,
  disabled = false,
  className,
}: DeliveryDocketCaptureProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const picked = input.files?.[0];
    // Reset immediately so re-picking the SAME file still fires a change event.
    input.value = '';
    if (!picked) return;

    if (!picked.type.startsWith('image/')) {
      toast({ title: 'Select an image file', variant: 'warning' });
      return;
    }
    if (picked.size > MAX_FILE_BYTES) {
      toast({
        title: 'Image too large',
        description: 'Image must be smaller than 10MB.',
        variant: 'warning',
      });
      return;
    }
    onSelect(picked);
  };

  const thumbSrc = previewUrl ?? queuedDataUrl ?? null;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {file || queuedDataUrl ? (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5">
          {thumbSrc ? (
            <img
              src={thumbSrc}
              alt=""
              className="h-14 w-14 shrink-0 rounded-lg border border-border object-cover"
            />
          ) : (
            <span className="h-14 w-14 shrink-0 rounded-lg border border-border bg-muted" />
          )}
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-foreground">Docket photo</span>
            {statusKey && (
              <span
                className={cn('mt-1 block text-[14px] font-medium', STATE_TONE[statusKey])}
                aria-live="polite"
              >
                {formatStatusLabel(statusKey)}
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            aria-label="Remove docket photo"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground touch-manipulation active:bg-secondary"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={disabled}
            className="shell-photobtn min-h-[62px] w-full text-[16px] text-foreground"
          >
            <Camera size={22} aria-hidden="true" />
            Photograph docket
          </button>
          {allowGallery && (
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              disabled={disabled}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-border bg-card text-[15px] font-semibold text-foreground touch-manipulation"
            >
              <ImageIcon size={18} aria-hidden="true" />
              Choose from photos
            </button>
          )}
          {hint && <p className="text-[14px] leading-[1.45] text-muted-foreground">{hint}</p>}
        </>
      )}

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
        data-testid="docket-camera-input"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        data-testid="docket-gallery-input"
      />
    </div>
  );
}
