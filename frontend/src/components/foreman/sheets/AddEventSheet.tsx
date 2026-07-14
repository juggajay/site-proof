import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BottomSheet } from './BottomSheet';
import { SheetDraftRestoredHint } from './SheetDraftRestoredHint';
import { SheetErrorBanner } from './SheetErrorBanner';
import { readSheetDraft, useSheetDraft } from './useSheetDraft';
import { useSheetSave } from './useSheetSave';
import { DictationMicButton } from '@/components/ui/DictationMicButton';

const EVENT_TYPES = ['Visitor', 'Safety', 'Instruction', 'Variation', 'Other'];

interface AddEventSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    eventType: string;
    description: string;
    notes?: string;
    lotId?: string;
  }) => Promise<void>;
  defaultLotId: string | null;
  lots: Array<{ id: string; lotNumber: string }>;
  initialData?: { eventType?: string; description?: string; notes?: string; lotId?: string };
  /** Enables auto-draft of typed state; omitted when editing an existing entry. */
  draftKey?: string;
}

export function AddEventSheet({
  isOpen,
  onClose,
  onSave,
  defaultLotId,
  lots,
  initialData,
  draftKey,
}: AddEventSheetProps) {
  // An interrupted entry restored from the auto-draft; edits never draft.
  const [restoredDraft] = useState(() => (initialData ? null : readSheetDraft(draftKey)));
  const [eventType, setEventType] = useState(
    restoredDraft?.eventType ?? (initialData?.eventType || ''),
  );
  const [description, setDescription] = useState(
    restoredDraft?.description ?? (initialData?.description || ''),
  );
  const [notes, setNotes] = useState(restoredDraft?.notes ?? (initialData?.notes || ''));
  const [lotId, setLotId] = useState(
    restoredDraft ? restoredDraft.lotId || '' : initialData?.lotId || defaultLotId || '',
  );
  const { saving, saveError, runSave } = useSheetSave();
  const draft = useSheetDraft({
    draftKey: initialData ? undefined : draftKey,
    restored: restoredDraft,
    fields: { eventType, description, notes, lotId },
    baseline: { eventType: '', description: '', notes: '', lotId: defaultLotId || '' },
  });

  const handleDiscardDraft = () => {
    setEventType('');
    setDescription('');
    setNotes('');
    setLotId(defaultLotId || '');
    draft.discardDraft();
  };

  const handleSave = () => {
    if (!eventType || !description.trim()) return;
    void runSave(
      () =>
        onSave({
          eventType: eventType.toLowerCase(),
          description: description.trim(),
          notes: notes || undefined,
          lotId: lotId || undefined,
        }),
      () => {
        // The entry is recorded (online or queued offline) — drop the draft.
        draft.clearDraft();
        setEventType('');
        setDescription('');
        setNotes('');
        onClose();
      },
    );
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Add Event">
      <div className="space-y-4">
        {draft.draftHintVisible && (
          <SheetDraftRestoredHint
            onDiscard={handleDiscardDraft}
            onDismiss={draft.dismissDraftHint}
          />
        )}
        <div>
          <label className="text-sm font-medium text-muted-foreground">Event Type *</label>
          <div className="flex flex-wrap gap-2 mt-2">
            {EVENT_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => setEventType(type)}
                className={cn(
                  'px-3 py-2 rounded-full text-sm font-medium touch-manipulation min-h-[44px]',
                  eventType === type
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground">Description *</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What happened?"
            className="w-full mt-1 px-3 py-3 border border-border bg-background text-foreground rounded-lg text-base touch-manipulation"
            autoCapitalize="sentences"
            autoComplete="off"
            enterKeyHint="done"
            spellCheck={true}
          />
        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <label className="text-sm font-medium text-muted-foreground">Notes</label>
            <DictationMicButton
              onTranscript={(text) => setNotes((prev) => (prev ? prev + ' ' + text : text))}
            />
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Additional details..."
            className="w-full mt-1 px-3 py-3 border border-border bg-background text-foreground rounded-lg text-base touch-manipulation resize-none"
            autoCapitalize="sentences"
            autoComplete="off"
            spellCheck={true}
          />
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground">Lot</label>
          <select
            value={lotId}
            onChange={(e) => setLotId(e.target.value)}
            className="w-full mt-1 px-3 py-3 border border-border rounded-lg text-base touch-manipulation bg-background text-foreground"
          >
            <option value="">No lot</option>
            {lots.map((lot) => (
              <option key={lot.id} value={lot.id}>
                Lot {lot.lotNumber}
              </option>
            ))}
          </select>
        </div>

        {saveError && <SheetErrorBanner onRetry={handleSave} retrying={saving} />}

        <button
          onClick={handleSave}
          disabled={!eventType || !description.trim() || saving}
          className={cn(
            'w-full py-4 rounded-lg font-semibold text-primary-foreground',
            'bg-primary active:bg-primary/90',
            'touch-manipulation min-h-[56px]',
            'flex items-center justify-center gap-2',
            (!eventType || !description.trim() || saving) && 'opacity-50',
          )}
        >
          {saving ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" /> Saving...
            </>
          ) : (
            'Save Event'
          )}
        </button>
      </div>
    </BottomSheet>
  );
}
