import { useEffect, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { SecureDocumentImage } from '@/components/documents/SecureDocumentImage';
import { BottomSheet } from './sheets/BottomSheet';
import type { ITPChecklistItem, ITPCompletion } from './MobileITPChecklist';

interface MobileITPItemSheetProps {
  isOpen: boolean;
  item: ITPChecklistItem | null;
  completion?: ITPCompletion;
  canComplete: boolean;
  onClose: () => void;
  onPass: (notes: string | null) => void;
  onNA: (reason: string) => void;
  onFail: (reason: string) => void;
  onUpdateNotes: (notes: string) => void;
  onAddPhoto: (file: File) => void;
}

export function MobileITPItemSheet({
  isOpen,
  item,
  completion,
  canComplete,
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when item changes
  useEffect(() => {
    if (item) {
      setNotes(completion?.notes || '');
      setNaReason('');
      setFailReason('');
      setShowNAInput(false);
      setShowFailInput(false);
    }
  }, [item, completion]);

  if (!isOpen || !item) return null;

  const isCompleted = completion?.isCompleted;
  const isNA = completion?.isNotApplicable;
  const isFailed = completion?.isFailed;
  const photos = completion?.attachments || [];

  const pointTypeLabel = {
    standard: 'Standard Point',
    witness: 'Witness Point',
    hold_point: 'Hold Point',
  };

  const responsiblePartyLabel = {
    contractor: 'Contractor',
    subcontractor: 'Subcontractor',
    superintendent: 'Superintendent',
    general: 'General',
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={`Item ${item.order}`}>
      <div className="space-y-4">
        {/* No permission banner */}
        {!canComplete && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">View Only</p>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Contact head contractor for completion access
              </p>
            </div>
          </div>
        )}

        {/* Item description */}
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium ${
                item.pointType === 'hold_point'
                  ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                  : item.pointType === 'witness'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                    : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
              }`}
            >
              {pointTypeLabel[item.pointType]}
            </span>
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-muted">
              {responsiblePartyLabel[item.responsibleParty]}
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
            onClick={() => canComplete && onPass(notes || null)}
            disabled={!canComplete}
            className={`py-4 rounded-lg font-bold text-center transition-all touch-manipulation min-h-[72px] ${
              !canComplete
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : isCompleted
                  ? 'bg-green-500 text-white ring-2 ring-green-600 ring-offset-2'
                  : 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/50 dark:text-green-200'
            }`}
          >
            <span className="text-2xl block mb-1">✓</span>
            <span className="text-sm">PASS</span>
          </button>
          <button
            onClick={() => {
              if (!canComplete || isNA) return;
              if (!showNAInput) {
                setShowNAInput(true);
                setShowFailInput(false);
              }
            }}
            disabled={!canComplete}
            className={`py-4 rounded-lg font-bold text-center transition-all touch-manipulation min-h-[72px] ${
              !canComplete
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : isNA
                  ? 'bg-gray-500 text-white ring-2 ring-gray-600 ring-offset-2'
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200'
            }`}
          >
            <span className="text-2xl block mb-1">—</span>
            <span className="text-sm">N/A</span>
          </button>
          <button
            onClick={() => {
              if (!canComplete || isFailed) return;
              if (!showFailInput) {
                setShowFailInput(true);
                setShowNAInput(false);
              }
            }}
            disabled={!canComplete}
            className={`py-4 rounded-lg font-bold text-center transition-all touch-manipulation min-h-[72px] ${
              !canComplete
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : isFailed
                  ? 'bg-red-500 text-white ring-2 ring-red-600 ring-offset-2'
                  : 'bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-200'
            }`}
          >
            <span className="text-2xl block mb-1">✗</span>
            <span className="text-sm">FAIL</span>
          </button>
        </div>

        {/* N/A reason input */}
        {showNAInput && (
          <div className="p-3 bg-muted/50 dark:bg-muted rounded-lg space-y-2">
            <label className="text-sm font-medium">Reason for N/A:</label>
            <textarea
              value={naReason}
              onChange={(e) => setNaReason(e.target.value)}
              placeholder="Why is this item not applicable?"
              className="w-full px-3 py-2 border rounded-lg text-sm min-h-[80px] bg-background"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowNAInput(false)}
                className="flex-1 py-3 border rounded-lg text-sm font-medium touch-manipulation"
              >
                Cancel
              </button>
              <button
                onClick={() => onNA(naReason)}
                className="flex-1 py-3 bg-gray-500 text-white rounded-lg text-sm font-medium touch-manipulation"
              >
                Mark as N/A
              </button>
            </div>
          </div>
        )}

        {/* Fail reason input */}
        {showFailInput && (
          <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg space-y-2">
            <label className="text-sm font-medium text-red-800 dark:text-red-200">
              Reason for failure:
            </label>
            <textarea
              value={failReason}
              onChange={(e) => setFailReason(e.target.value)}
              placeholder="Describe the issue..."
              className="w-full px-3 py-2 border border-red-200 dark:border-red-800 rounded-lg text-sm min-h-[80px] bg-background"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowFailInput(false)}
                className="flex-1 py-3 border rounded-lg text-sm font-medium touch-manipulation"
              >
                Cancel
              </button>
              <button
                onClick={() => onFail(failReason)}
                className="flex-1 py-3 bg-red-500 text-white rounded-lg text-sm font-medium touch-manipulation"
              >
                Mark as Failed
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
              className="w-full px-3 py-2 border rounded-lg text-sm min-h-[80px] bg-background disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
        )}

        {/* Photos section */}
        {!showNAInput && !showFailInput && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Photos</label>
              {canComplete && (
                <>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-sm text-primary font-medium flex items-center gap-1 py-2 px-3 bg-primary/10 rounded-lg touch-manipulation"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Add Photo</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        onAddPhoto(file);
                        e.target.value = ''; // Reset for next upload
                      }
                    }}
                  />
                </>
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
