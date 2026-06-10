import { useState } from 'react';
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BottomSheet } from './BottomSheet';
import { SheetDraftRestoredHint } from './SheetDraftRestoredHint';
import { SheetErrorBanner } from './SheetErrorBanner';
import { readSheetDraft, useSheetDraft } from './useSheetDraft';
import { useSheetSave } from './useSheetSave';
import {
  getOptionalDiaryHoursError,
  parseOptionalDiaryHoursInput,
} from '@/pages/diary/diaryNumericInput';

const DELAY_TYPES = ['Weather', 'Equipment', 'Material', 'Subcontractor', 'Safety', 'Other'];

interface AddDelaySheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    delayType: string;
    description: string;
    durationHours?: number;
    impact?: string;
    lotId?: string;
  }) => Promise<void>;
  defaultLotId: string | null;
  lots: Array<{ id: string; lotNumber: string }>;
  initialData?: {
    delayType?: string;
    description?: string;
    durationHours?: number;
    impact?: string;
    lotId?: string;
  };
  /** Enables auto-draft of typed state; omitted when editing an existing entry. */
  draftKey?: string;
}

export function AddDelaySheet({
  isOpen,
  onClose,
  onSave,
  defaultLotId,
  lots,
  initialData,
  draftKey,
}: AddDelaySheetProps) {
  // An interrupted entry restored from the auto-draft; edits never draft.
  const [restoredDraft] = useState(() => (initialData ? null : readSheetDraft(draftKey)));
  const [delayType, setDelayType] = useState(
    restoredDraft?.delayType ?? (initialData?.delayType || ''),
  );
  const [description, setDescription] = useState(
    restoredDraft?.description ?? (initialData?.description || ''),
  );
  const [durationHours, setDurationHours] = useState(
    restoredDraft?.durationHours ?? (initialData?.durationHours?.toString() || ''),
  );
  const [impact, setImpact] = useState(restoredDraft?.impact ?? (initialData?.impact || ''));
  const [lotId, setLotId] = useState(
    restoredDraft ? restoredDraft.lotId || '' : initialData?.lotId || defaultLotId || '',
  );
  const [showMore, setShowMore] = useState(
    !!initialData ||
      Boolean(
        restoredDraft &&
        (restoredDraft.durationHours ||
          restoredDraft.impact ||
          (restoredDraft.lotId || '') !== (defaultLotId || '')),
      ),
  );
  const { saving, saveError, runSave } = useSheetSave();
  const draft = useSheetDraft({
    draftKey: initialData ? undefined : draftKey,
    restored: restoredDraft,
    fields: { delayType, description, durationHours, impact, lotId },
    baseline: {
      delayType: '',
      description: '',
      durationHours: '',
      impact: '',
      lotId: defaultLotId || '',
    },
  });
  const durationHoursError = getOptionalDiaryHoursError(durationHours, 'Duration');

  const handleDiscardDraft = () => {
    setDelayType('');
    setDescription('');
    setDurationHours('');
    setImpact('');
    setLotId(defaultLotId || '');
    setShowMore(false);
    draft.discardDraft();
  };

  const handleSave = () => {
    if (!delayType || !description.trim() || durationHoursError) return;
    const parsedDurationHours = parseOptionalDiaryHoursInput(durationHours);
    void runSave(
      () =>
        onSave({
          delayType,
          description: description.trim(),
          durationHours: parsedDurationHours ?? undefined,
          impact: impact || undefined,
          lotId: lotId || undefined,
        }),
      () => {
        // The entry is recorded (online or queued offline) — drop the draft.
        draft.clearDraft();
        setDelayType('');
        setDescription('');
        setDurationHours('');
        setImpact('');
        setShowMore(false);
        onClose();
      },
    );
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Add Delay">
      <div className="space-y-4">
        {draft.draftHintVisible && (
          <SheetDraftRestoredHint
            onDiscard={handleDiscardDraft}
            onDismiss={draft.dismissDraftHint}
          />
        )}
        <div>
          <label className="text-sm font-medium text-muted-foreground">Delay Type *</label>
          <div className="flex flex-wrap gap-2 mt-2">
            {DELAY_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => setDelayType(type)}
                className={cn(
                  'px-3 py-2 rounded-full text-sm font-medium touch-manipulation min-h-[44px]',
                  delayType === type
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
            placeholder="What caused the delay?"
            className="w-full mt-1 px-3 py-3 border border-border bg-background text-foreground rounded-lg text-base touch-manipulation"
            autoCapitalize="sentences"
            autoComplete="off"
            enterKeyHint="done"
            spellCheck={true}
          />
        </div>

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
              <label className="text-sm font-medium text-muted-foreground">Duration (hours)</label>
              <input
                type="number"
                value={durationHours}
                onChange={(e) => setDurationHours(e.target.value)}
                placeholder="0"
                step="0.5"
                inputMode="decimal"
                className={cn(
                  'w-full mt-1 px-3 py-3 border border-border bg-background text-foreground rounded-lg text-base touch-manipulation',
                  durationHoursError && 'border-destructive',
                )}
              />
              {durationHoursError && (
                <p className="mt-1 text-xs text-destructive" role="alert" aria-live="assertive">
                  {durationHoursError}
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Impact</label>
              <input
                type="text"
                value={impact}
                onChange={(e) => setImpact(e.target.value)}
                placeholder="Impact on schedule..."
                className="w-full mt-1 px-3 py-3 border border-border bg-background text-foreground rounded-lg text-base touch-manipulation"
                autoCapitalize="sentences"
                autoComplete="off"
                enterKeyHint="done"
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
          </div>
        )}

        {saveError && <SheetErrorBanner onRetry={handleSave} retrying={saving} />}

        <button
          onClick={handleSave}
          disabled={!delayType || !description.trim() || Boolean(durationHoursError) || saving}
          className={cn(
            'w-full py-4 rounded-lg font-semibold text-primary-foreground',
            'bg-primary active:bg-primary/90',
            'touch-manipulation min-h-[56px]',
            'flex items-center justify-center gap-2',
            (!delayType || !description.trim() || durationHoursError || saving) && 'opacity-50',
          )}
        >
          {saving ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" /> Saving...
            </>
          ) : (
            'Save Delay'
          )}
        </button>
      </div>
    </BottomSheet>
  );
}
