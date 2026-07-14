import { useEffect, useRef, useState } from 'react';
import { Camera, Image as ImageIcon } from 'lucide-react';
import { SecureDocumentImage } from '@/components/documents/SecureDocumentImage';
import { isReleaseGatedChecklistItem } from '@/lib/itpReleaseGating';
import { BottomSheet } from './sheets/BottomSheet';
import type { ITPChecklistItem, ITPCompletion } from './MobileITPChecklist';

interface MobileITPItemSheetProps {
  isOpen: boolean;
  item: ITPChecklistItem | null;
  completion?: ITPCompletion;
  canComplete: boolean;
  releaseRequired?: boolean;
  onClose: () => void;
  /** Resolves true when saved; false keeps the sheet open with an inline error. */
  onPass: (notes: string | null) => Promise<boolean>;
  /** Resolves true when saved; false keeps the sheet open with the reason intact. */
  onNA: (reason: string) => Promise<boolean>;
  /** Resolves true when saved; false keeps the sheet open with the reason intact. */
  onFail: (reason: string) => Promise<boolean>;
  onUpdateNotes: (notes: string) => void;
  onAddPhoto: (file: File) => void;
}

export function MobileITPItemSheet({
  isOpen,
  item,
  completion,
  canComplete,
  releaseRequired = false,
  onClose,
  onPass,
  onNA,
  onFail,
  onUpdateNotes,
  onAddPhoto,
}: MobileITPItemSheetProps) {
  const [notes, setNotes] = useState('');
  const [naReason, setNaReason] = useState('');
  const [failReason, setFailReason] = useState('');
  const [showNAInput, setShowNAInput] = useState(false);
  const [showFailInput, setShowFailInput] = useState(false);
  // In-flight + failure state for the N/A / Fail saves. On failure the sheet
  // stays open with the typed reason intact and an inline error.
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  // Separate input for the required-evidence capture inside the FAIL panel (the
  // main Photos section — and its inputs — are hidden while a reason is typed).
  const failPhotoInputRef = useRef<HTMLInputElement>(null);

  // Reset state when item changes
  useEffect(() => {
    if (item) {
      setNotes(completion?.notes || '');
      setNaReason('');
      setFailReason('');
      setShowNAInput(false);
      setShowFailInput(false);
      setSavingStatus(false);
      setStatusError(null);
    }
  }, [item, completion]);

  if (!isOpen || !item) return null;

  // Await the save; only a successful save closes the sheet (the parent owns
  // that). On failure keep everything as typed and show an inline error.
  const runSave = async (action: () => Promise<boolean>, failMessage: string) => {
    setSavingStatus(true);
    setStatusError(null);
    let saved = false;
    try {
      saved = await action();
    } catch {
      saved = false;
    }
    setSavingStatus(false);
    if (!saved) {
      setStatusError(failMessage);
    }
  };

  const submitStatus = (action: (reason: string) => Promise<boolean>, reason: string) =>
    runSave(
      () => action(reason),
      'Could not save this item. Your reason is kept - please try again.',
    );

  // M57: PASS awaits the completion write and closes only on a successful save.
  // On failure the sheet stays open with an inline error so the tap is honest.
  const submitPass = () =>
    runSave(() => onPass(notes || null), 'Could not save this item. Please try again.');

  const handlePhotoSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onAddPhoto(file);
      e.target.value = ''; // Reset for next upload
    }
  };

  const isRejected =
    completion?.isRejected || completion?.verificationStatus === 'rejected' || false;
  const isPendingVerification =
    !isRejected &&
    (completion?.isPendingVerification ||
      completion?.verificationStatus === 'pending_verification');
  const isAcceptedCompletion = !isRejected && !isPendingVerification;
  const isCompleted = completion?.isCompleted && isAcceptedCompletion;
  const isNA = completion?.isNotApplicable && isAcceptedCompletion;
  const isFailed = completion?.isFailed;
  const photos = completion?.attachments || [];
  const isReleaseGated = isReleaseGatedChecklistItem(item);

  const pointTypeLabel = {
    standard: 'Standard Point',
    verification: 'Verification Point',
    witness: 'Witness Point',
    hold_point: 'Hold Point',
    unknown: 'Checklist Point',
  };

  const responsiblePartyLabel = {
    contractor: 'Contractor',
    subcontractor: 'Subcontractor',
    superintendent: 'Superintendent',
    general: 'General',
    unknown: 'General',
  };

  const pointTypeText = isReleaseGated
    ? pointTypeLabel.hold_point
    : (pointTypeLabel[item.pointType] ?? pointTypeLabel.unknown);
  const responsiblePartyText =
    responsiblePartyLabel[item.responsibleParty] ?? responsiblePartyLabel.unknown;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={`Item ${item.order}`}>
      <div className="space-y-4">
        {/* No permission banner */}
        {!canComplete && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
            <div>
              <p className="text-sm font-medium text-warning-foreground">
                {releaseRequired ? 'Release Required' : 'View Only'}
              </p>
              <p className="text-xs text-muted-foreground">
                {releaseRequired
                  ? 'This item must be released through the hold-point flow before it can pass.'
                  : 'Contact head contractor for completion access'}
              </p>
            </div>
          </div>
        )}

        {isRejected && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
            <div>
              <p className="text-sm font-medium text-destructive">Rejected by head contractor</p>
              <p className="text-xs text-muted-foreground">
                {completion?.verificationNotes || 'Update the item and resubmit it for review.'}
              </p>
              {completion?.verificationNotes && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Update the item and resubmit it for review.
                </p>
              )}
            </div>
          </div>
        )}

        {isPendingVerification && (
          <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3">
            <div>
              <p className="text-sm font-medium text-warning-foreground">
                Awaiting head-contractor verification
              </p>
              <p className="text-xs text-muted-foreground">
                This item has been submitted and is waiting for review.
              </p>
            </div>
          </div>
        )}

        {/* Item description */}
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium ${
                isReleaseGated
                  ? 'bg-destructive/10 text-destructive'
                  : item.pointType === 'witness'
                    ? 'bg-warning/10 text-warning'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {pointTypeText}
            </span>
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-muted">
              {responsiblePartyText}
            </span>
          </div>
          <p className="text-base font-medium">{item.description}</p>
          {item.acceptanceCriteria && (
            <p className="text-sm text-muted-foreground mt-2 p-2 bg-primary/5 dark:bg-primary/10 rounded">
              <span className="font-medium">Criteria:</span> {item.acceptanceCriteria}
            </p>
          )}
        </div>

        {/* Status buttons - large touch targets */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => {
              if (canComplete && !savingStatus) void submitPass();
            }}
            disabled={!canComplete || savingStatus}
            className={`py-4 rounded-lg font-bold text-center transition-all touch-manipulation min-h-[72px] disabled:opacity-60 ${
              !canComplete
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : isCompleted
                  ? 'bg-success text-success-foreground ring-2 ring-success ring-offset-2'
                  : 'bg-success/10 text-success hover:bg-success/20'
            }`}
          >
            <span className="text-2xl block mb-1">✓</span>
            <span className="text-sm">
              {savingStatus && !showNAInput && !showFailInput ? 'Saving…' : 'PASS'}
            </span>
          </button>
          <button
            onClick={() => {
              if (!canComplete || isNA || savingStatus) return;
              if (!showNAInput) {
                setShowNAInput(true);
                setShowFailInput(false);
                setStatusError(null);
              }
            }}
            disabled={!canComplete || savingStatus}
            className={`py-4 rounded-lg font-bold text-center transition-all touch-manipulation min-h-[72px] ${
              !canComplete
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : isNA
                  ? 'bg-muted-foreground text-background ring-2 ring-muted-foreground ring-offset-2'
                  : 'bg-muted text-foreground hover:bg-accent'
            }`}
          >
            <span className="text-2xl block mb-1">—</span>
            <span className="text-sm">N/A</span>
          </button>
          <button
            onClick={() => {
              if (!canComplete || isFailed || savingStatus) return;
              if (!showFailInput) {
                setShowFailInput(true);
                setShowNAInput(false);
                setStatusError(null);
              }
            }}
            disabled={!canComplete || savingStatus}
            className={`py-4 rounded-lg font-bold text-center transition-all touch-manipulation min-h-[72px] ${
              !canComplete
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : isFailed
                  ? 'bg-destructive text-destructive-foreground ring-2 ring-destructive ring-offset-2'
                  : 'bg-destructive/10 text-destructive hover:bg-destructive/20'
            }`}
          >
            <span className="text-2xl block mb-1">✗</span>
            <span className="text-sm">FAIL</span>
          </button>
        </div>

        {/* M57: inline error for a failed PASS save (the N/A / Fail panels render
            their own copy of this error within their reason inputs). */}
        {statusError && !showNAInput && !showFailInput && (
          <p role="alert" className="text-sm text-destructive">
            {statusError}
          </p>
        )}

        {/* N/A reason input */}
        {showNAInput && (
          <div className="p-3 bg-muted/50 dark:bg-muted rounded-lg space-y-2">
            <label className="text-sm font-medium">Reason for N/A:</label>
            <textarea
              value={naReason}
              onChange={(e) => setNaReason(e.target.value)}
              placeholder="Why is this item not applicable?"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm min-h-[80px] bg-background text-foreground"
              autoFocus
              autoCapitalize="sentences"
              autoComplete="off"
              spellCheck={true}
            />
            {statusError && (
              <p role="alert" className="text-sm text-destructive">
                {statusError}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowNAInput(false);
                  setStatusError(null);
                }}
                disabled={savingStatus}
                className="flex-1 py-3 border border-border rounded-lg text-sm font-medium touch-manipulation disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={() => submitStatus(onNA, naReason)}
                disabled={savingStatus}
                className="flex-1 py-3 bg-muted-foreground text-background rounded-lg text-sm font-medium touch-manipulation disabled:opacity-60"
              >
                {savingStatus ? 'Saving...' : 'Mark as N/A'}
              </button>
            </div>
          </div>
        )}

        {/* Fail reason input */}
        {showFailInput && (
          <div className="p-3 bg-destructive/10 rounded-lg space-y-2">
            <label className="text-sm font-medium text-destructive">Reason for failure:</label>
            <textarea
              value={failReason}
              onChange={(e) => setFailReason(e.target.value)}
              placeholder="Describe the issue..."
              className="w-full px-3 py-2 border border-destructive/20 rounded-lg text-sm min-h-[80px] bg-background text-foreground"
              autoFocus
              autoCapitalize="sentences"
              autoComplete="off"
              spellCheck={true}
            />
            {statusError && (
              <p role="alert" className="text-sm text-destructive">
                {statusError}
              </p>
            )}
            {/* A failed item must carry photo evidence when online. The photo
                attaches to this item's pending completion first; the fail then
                flips it to 'failed'. Offline stays note-only (the ITP offline
                sync path carries no attachments). */}
            {navigator.onLine ? (
              <>
                <button
                  type="button"
                  onClick={() => failPhotoInputRef.current?.click()}
                  disabled={savingStatus}
                  className="w-full min-h-[44px] flex items-center justify-center gap-2 py-2 px-3 bg-primary/10 text-primary rounded-lg text-sm font-medium touch-manipulation disabled:opacity-60"
                >
                  <Camera className="w-4 h-4" />
                  {photos.length > 0
                    ? `Photo added (${photos.length})`
                    : 'Add a photo of the issue (required)'}
                </button>
                <input
                  ref={failPhotoInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handlePhotoSelected}
                />
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Offline — photo can be added after sync.
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowFailInput(false);
                  setStatusError(null);
                }}
                disabled={savingStatus}
                className="flex-1 py-3 border border-border rounded-lg text-sm font-medium touch-manipulation disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={() => submitStatus(onFail, failReason)}
                disabled={savingStatus || (navigator.onLine && photos.length === 0)}
                className="flex-1 py-3 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium touch-manipulation disabled:opacity-60"
              >
                {savingStatus ? 'Saving...' : 'Mark as Failed'}
              </button>
            </div>
          </div>
        )}

        {/* Notes section */}
        {!showNAInput && !showFailInput && (
          <div>
            <label className="text-sm font-medium mb-1 block">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => {
                if (canComplete && notes !== (completion?.notes || '')) {
                  onUpdateNotes(notes);
                }
              }}
              placeholder="Add notes about this item..."
              disabled={!canComplete}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm min-h-[80px] bg-background text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              autoCapitalize="sentences"
              autoComplete="off"
              spellCheck={true}
            />
          </div>
        )}

        {/* Photos section */}
        {!showNAInput && !showFailInput && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Photos</label>
              {canComplete && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="min-h-[44px] text-sm text-primary font-medium flex items-center gap-1 py-2 px-3 bg-primary/10 rounded-lg touch-manipulation"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Add Photo</span>
                  </button>
                  {/* Gallery alternative: same handler, no capture attribute, so
                      photos taken earlier can be attached. */}
                  <button
                    onClick={() => galleryInputRef.current?.click()}
                    className="min-h-[44px] text-sm text-primary font-medium flex items-center gap-1 py-2 px-3 bg-primary/10 rounded-lg touch-manipulation"
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span>Gallery</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handlePhotoSelected}
                  />
                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoSelected}
                  />
                </div>
              )}
            </div>
            {photos.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((photo) => (
                  <div key={photo.id} className="aspect-square rounded-lg overflow-hidden border">
                    <SecureDocumentImage
                      documentId={photo.document.id}
                      fileUrl={photo.document.fileUrl}
                      alt={photo.document.caption || photo.document.filename}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6 bg-muted/30 rounded-lg">
                No photos yet
              </p>
            )}
          </div>
        )}

        {/* Completion info */}
        {completion?.completedBy && (
          <p className="text-xs text-muted-foreground pt-2 border-t">
            {isCompleted
              ? 'Completed'
              : isNA
                ? 'Marked N/A'
                : isFailed
                  ? 'Marked Failed'
                  : 'Updated'}{' '}
            by {completion.completedBy.fullName || completion.completedBy.email}
            {completion.completedAt &&
              ` on ${new Date(completion.completedAt).toLocaleDateString('en-AU')}`}
          </p>
        )}
      </div>
    </BottomSheet>
  );
}
