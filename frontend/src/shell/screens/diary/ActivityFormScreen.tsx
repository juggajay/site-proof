/**
 * ActivityFormScreen — /m/diary/work/activity
 *
 * Full-screen form reusing AddActivitySheet's form logic including:
 *   - auto-draft (useSheetDraft) — interruptions lose nothing
 *   - dictation-friendly attrs (autoCapitalize, enterKeyHint, spellCheck)
 *   - useSheetSave haptic pattern
 *   - offline fallback via handlers.addActivityFromSheet
 *
 * Design spec: docs/design-foreman-shell-mock-v4.html #activity
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ShellScreen } from '../../components/ShellScreen';
import { useDiaryShellData } from './useDiaryShellData';
import { useEffectiveProjectId } from '@/hooks/useEffectiveProjectId';
import {
  readSheetDraft,
  useSheetDraft,
  sheetDraftKey,
} from '@/components/foreman/sheets/useSheetDraft';
import { useSheetSave } from '@/components/foreman/sheets/useSheetSave';
import {
  getOptionalDiaryQuantityError,
  parseOptionalDiaryQuantityInput,
} from '@/pages/diary/diaryNumericInput';
import { SheetDraftRestoredHint } from '@/components/foreman/sheets/SheetDraftRestoredHint';
import { SheetErrorBanner } from '@/components/foreman/sheets/SheetErrorBanner';
import { formatDateKey } from '@/lib/localDate';

export function ActivityFormScreen() {
  const navigate = useNavigate();
  const { projectId } = useEffectiveProjectId();
  const { lots, handlers } = useDiaryShellData();

  const todayKey = formatDateKey();
  const draftKey = projectId ? sheetDraftKey(projectId, todayKey, 'activity') : undefined;
  const defaultLotId = handlers.activeLotId;

  const [restoredDraft] = useState(() => readSheetDraft(draftKey));
  const [description, setDescription] = useState(restoredDraft?.description ?? '');
  const [lotId, setLotId] = useState(
    restoredDraft ? restoredDraft.lotId || '' : defaultLotId || '',
  );
  const [quantity, setQuantity] = useState(restoredDraft?.quantity ?? '');
  const [unit, setUnit] = useState(restoredDraft?.unit ?? '');
  const [notes, setNotes] = useState(restoredDraft?.notes ?? '');
  const [showMore, setShowMore] = useState(
    Boolean(restoredDraft && (restoredDraft.quantity || restoredDraft.unit || restoredDraft.notes)),
  );

  const { saving, saveError, runSave } = useSheetSave();
  const draft = useSheetDraft({
    draftKey,
    restored: restoredDraft,
    fields: { description, lotId, quantity, unit, notes },
    baseline: { description: '', lotId: defaultLotId || '', quantity: '', unit: '', notes: '' },
  });
  const quantityError = getOptionalDiaryQuantityError(quantity);

  const backPath = projectId ? `/m/diary/work?projectId=${projectId}` : '/m/diary/work';

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
        handlers.addActivityFromSheet({
          description: description.trim(),
          lotId: lotId || undefined,
          quantity: parsedQuantity ?? undefined,
          unit: unit || undefined,
          notes: notes || undefined,
        }),
      () => {
        draft.clearDraft();
        navigate(backPath);
      },
    );
  };

  const sub = (
    <span className="text-muted-foreground">
      Auto-saves as you type — interruptions lose nothing
    </span>
  );

  return (
    <ShellScreen
      variant="inner"
      title="Add Activity"
      parent={backPath}
      sub={sub}
      bottom={
        <div className="shell-cambar">
          <button
            type="button"
            onClick={handleSave}
            disabled={!description.trim() || Boolean(quantityError) || saving}
            className={cn(
              'shell-cambar-btn',
              (!description.trim() || quantityError || saving) && 'opacity-50',
            )}
            aria-label="Save activity"
          >
            {saving ? (
              <>
                <Loader2 size={20} className="animate-spin" aria-hidden="true" />
                Saving…
              </>
            ) : (
              'Save activity'
            )}
          </button>
        </div>
      }
    >
      {draft.draftHintVisible && (
        <SheetDraftRestoredHint onDiscard={handleDiscardDraft} onDismiss={draft.dismissDraftHint} />
      )}

      <div>
        <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[.07em] text-muted-foreground">
          What was done *
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Placed and compacted select fill, layer 3"
          rows={3}
          autoFocus
          autoCapitalize="sentences"
          autoComplete="off"
          spellCheck
          enterKeyHint="done"
          className="w-full min-h-[96px] resize-none rounded-xl border border-border bg-card px-3 py-3 text-[15px] text-foreground leading-[1.5] touch-manipulation focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
        />
      </div>

      <button
        type="button"
        onClick={() => setShowMore(!showMore)}
        className="flex items-center gap-1 text-sm text-muted-foreground touch-manipulation"
      >
        {showMore ? (
          <ChevronUp size={16} aria-hidden="true" />
        ) : (
          <ChevronDown size={16} aria-hidden="true" />
        )}
        {showMore ? 'Less details' : 'Add lot / quantity'}
      </button>

      {showMore && (
        <>
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[.07em] text-muted-foreground">
              Lot
            </label>
            <select
              value={lotId}
              onChange={(e) => setLotId(e.target.value)}
              className="w-full min-h-[52px] rounded-xl border border-border bg-card px-3 py-3 text-[15px] text-foreground touch-manipulation"
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
              <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[.07em] text-muted-foreground">
                Quantity
              </label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
                inputMode="decimal"
                className={cn(
                  'w-full min-h-[52px] rounded-xl border border-border bg-card px-3 py-3 text-[15px] text-foreground touch-manipulation',
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
              <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[.07em] text-muted-foreground">
                Unit
              </label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="m³, tonnes…"
                autoCapitalize="off"
                autoComplete="off"
                enterKeyHint="done"
                spellCheck={false}
                className="w-full min-h-[52px] rounded-xl border border-border bg-card px-3 py-3 text-[15px] text-foreground touch-manipulation"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[.07em] text-muted-foreground">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes…"
              rows={2}
              autoCapitalize="sentences"
              spellCheck
              className="w-full min-h-[72px] resize-none rounded-xl border border-border bg-card px-3 py-3 text-[15px] text-foreground leading-[1.5] touch-manipulation"
            />
          </div>
        </>
      )}

      {saveError && <SheetErrorBanner onRetry={handleSave} retrying={saving} />}
    </ShellScreen>
  );
}
