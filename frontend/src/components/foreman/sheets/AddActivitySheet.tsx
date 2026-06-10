import { useState } from 'react';
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BottomSheet } from './BottomSheet';
import { SheetDraftRestoredHint } from './SheetDraftRestoredHint';
import { SheetErrorBanner } from './SheetErrorBanner';
import { readSheetDraft, useSheetDraft } from './useSheetDraft';
import { useSheetSave } from './useSheetSave';
import {
  getOptionalDiaryQuantityError,
  parseOptionalDiaryQuantityInput,
} from '@/pages/diary/diaryNumericInput';

interface AddActivitySheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    description: string;
    lotId?: string;
    quantity?: number;
    unit?: string;
    notes?: string;
  }) => Promise<void>;
  defaultLotId: string | null;
  lots: Array<{ id: string; lotNumber: string }>;
  suggestions?: string[];
  initialData?: {
    description?: string;
    lotId?: string;
    quantity?: number;
    unit?: string;
    notes?: string;
  };
  /** Enables auto-draft of typed state; omitted when editing an existing entry. */
  draftKey?: string;
}

export function AddActivitySheet({
  isOpen,
  onClose,
  onSave,
  defaultLotId,
  lots,
  suggestions = [],
  initialData,
  draftKey,
}: AddActivitySheetProps) {
  // An interrupted entry restored from the auto-draft; edits never draft.
  const [restoredDraft] = useState(() => (initialData ? null : readSheetDraft(draftKey)));
  const [description, setDescription] = useState(
    restoredDraft?.description ?? (initialData?.description || ''),
  );
  const [lotId, setLotId] = useState(
    restoredDraft ? restoredDraft.lotId || '' : initialData?.lotId || defaultLotId || '',
  );
  const [quantity, setQuantity] = useState(
    restoredDraft?.quantity ?? (initialData?.quantity?.toString() || ''),
  );
  const [unit, setUnit] = useState(restoredDraft?.unit ?? (initialData?.unit || ''));
  const [notes, setNotes] = useState(restoredDraft?.notes ?? (initialData?.notes || ''));
  const [showMore, setShowMore] = useState(
    !!initialData ||
      Boolean(
        restoredDraft &&
        (restoredDraft.quantity ||
          restoredDraft.unit ||
          restoredDraft.notes ||
          (restoredDraft.lotId || '') !== (defaultLotId || '')),
      ),
  );
  const { saving, saveError, runSave } = useSheetSave();
  const draft = useSheetDraft({
    draftKey: initialData ? undefined : draftKey,
    restored: restoredDraft,
    fields: { description, lotId, quantity, unit, notes },
    baseline: { description: '', lotId: defaultLotId || '', quantity: '', unit: '', notes: '' },
  });
  const quantityError = getOptionalDiaryQuantityError(quantity);

  const handleDiscardDraft = () => {
    setDescription('');
    setLotId(defaultLotId || '');
    setQuantity('');
    setUnit('');
    setNotes('');
    setShowMore(false);
    draft.discardDraft();
  };

  const handleSave = () => {
    if (!description.trim() || quantityError) return;
    const parsedQuantity = parseOptionalDiaryQuantityInput(quantity);
    void runSave(
      () =>
        onSave({
          description: description.trim(),
          lotId: lotId || undefined,
          quantity: parsedQuantity ?? undefined,
          unit: unit || undefined,
          notes: notes || undefined,
        }),
      () => {
        // The entry is recorded (online or queued offline) — drop the draft.
        draft.clearDraft();
        // Reset form
        setDescription('');
        setQuantity('');
        setUnit('');
        setNotes('');
        setShowMore(false);
        onClose();
      },
    );
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Add Activity">
      <div className="space-y-4">
        {draft.draftHintVisible && (
          <SheetDraftRestoredHint
            onDiscard={handleDiscardDraft}
            onDismiss={draft.dismissDraftHint}
          />
        )}
        <div>
          <label className="text-sm font-medium text-muted-foreground">Description *</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What work was done?"
            className="w-full mt-1 px-3 py-3 border border-border bg-background text-foreground rounded-lg text-base touch-manipulation"
            autoFocus
            autoCapitalize="sentences"
            autoComplete="off"
            enterKeyHint="done"
            spellCheck={true}
          />
        </div>

        {suggestions.length > 0 && !description && (
          <div className="flex flex-wrap gap-2">
            {suggestions.slice(0, 6).map((s, i) => (
              <button
                key={i}
                onClick={() => setDescription(s)}
                className="px-3 py-1.5 bg-muted rounded-full text-sm touch-manipulation min-h-[44px]"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => setShowMore(!showMore)}
          className="flex items-center gap-1 text-sm text-primary touch-manipulation"
        >
          {showMore ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {showMore ? 'Less details' : 'More details'}
        </button>

        {showMore && (
          <div className="space-y-3">
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Quantity</label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                  inputMode="decimal"
                  className={cn(
                    'w-full mt-1 px-3 py-3 border border-border bg-background text-foreground rounded-lg text-base touch-manipulation',
                    quantityError && 'border-destructive',
                  )}
                />
                {quantityError && (
                  <p className="mt-1 text-xs text-destructive" role="alert" aria-live="assertive">
                    {quantityError}
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Unit</label>
                <input
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="m3, tonnes..."
                  className="w-full mt-1 px-3 py-3 border border-border bg-background text-foreground rounded-lg text-base touch-manipulation"
                  autoCapitalize="off"
                  autoComplete="off"
                  enterKeyHint="done"
                  spellCheck={false}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full mt-1 px-3 py-3 border border-border bg-background text-foreground rounded-lg text-base touch-manipulation resize-none"
                autoCapitalize="sentences"
                autoComplete="off"
                spellCheck={true}
              />
            </div>
          </div>
        )}

        {saveError && <SheetErrorBanner onRetry={handleSave} retrying={saving} />}

        <button
          onClick={handleSave}
          disabled={!description.trim() || Boolean(quantityError) || saving}
          className={cn(
            'w-full py-4 rounded-lg font-semibold text-primary-foreground',
            'bg-primary active:bg-primary/90',
            'touch-manipulation min-h-[56px]',
            'flex items-center justify-center gap-2',
            (!description.trim() || quantityError || saving) && 'opacity-50',
          )}
        >
          {saving ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" /> Saving...
            </>
          ) : (
            'Save Activity'
          )}
        </button>
      </div>
    </BottomSheet>
  );
}
