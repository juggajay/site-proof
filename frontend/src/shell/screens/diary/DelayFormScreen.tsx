/**
 * DelayFormScreen — /m/diary/work/delay
 *
 * Full-screen form reusing AddDelaySheet's form logic including auto-draft,
 * dictation-friendly attrs, useSheetSave haptic, offline fallback.
 *
 * Design spec: docs/design-foreman-shell-mock-v4.html #activity (form pattern)
 */

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ShellScreen } from '../../components/ShellScreen';
import { withProjectQuery } from '../../shellPaths';
import { useDiaryShellData } from './useDiaryShellData';
import { useDiaryEntryEdit } from './useDiaryEntryEdit';
import { useEffectiveProjectId } from '@/hooks/useEffectiveProjectId';
import {
  readSheetDraft,
  useSheetDraft,
  sheetDraftKey,
} from '@/components/foreman/sheets/useSheetDraft';
import { useSheetSave } from '@/components/foreman/sheets/useSheetSave';
import {
  getOptionalDiaryHoursError,
  parseOptionalDiaryHoursInput,
} from '@/pages/diary/diaryNumericInput';
import { SheetDraftRestoredHint } from '@/components/foreman/sheets/SheetDraftRestoredHint';
import { SheetErrorBanner } from '@/components/foreman/sheets/SheetErrorBanner';
import { DictationMicButton } from '@/components/ui/DictationMicButton';
import { formatDateKey } from '@/lib/localDate';

const DELAY_TYPES = ['Weather', 'Equipment', 'Material', 'Subcontractor', 'Safety', 'Other'];

export function DelayFormScreen() {
  const navigate = useNavigate();
  const { projectId } = useEffectiveProjectId();
  const { lots, timeline, handlers } = useDiaryShellData();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');

  const todayKey = formatDateKey();
  const draftKey = projectId && !editId ? sheetDraftKey(projectId, todayKey, 'delay') : undefined;
  const defaultLotId = handlers.activeLotId;

  const [restoredDraft] = useState(() => readSheetDraft(draftKey));
  const [delayType, setDelayType] = useState(restoredDraft?.delayType ?? '');
  const [description, setDescription] = useState(restoredDraft?.description ?? '');
  const [durationHours, setDurationHours] = useState(restoredDraft?.durationHours ?? '');
  const [impact, setImpact] = useState(restoredDraft?.impact ?? '');
  const [lotId, setLotId] = useState(
    restoredDraft ? restoredDraft.lotId || '' : defaultLotId || '',
  );
  const [showMore, setShowMore] = useState(
    Boolean(restoredDraft && (restoredDraft.durationHours || restoredDraft.impact)),
  );

  const { saving, saveError, runSave } = useSheetSave();
  const draft = useSheetDraft({
    draftKey,
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
  const hoursError = getOptionalDiaryHoursError(durationHours);

  useDiaryEntryEdit({
    editId,
    type: 'delay',
    timeline,
    setEditingEntry: handlers.setEditingEntry,
    seed: (e) => {
      setDelayType(
        DELAY_TYPES.find((t) => t.toLowerCase() === (e.data.delayType ?? '').toLowerCase()) ??
          e.data.delayType ??
          '',
      );
      setDescription(e.description);
      setDurationHours(e.data.durationHours != null ? String(e.data.durationHours) : '');
      setImpact(e.data.impact ?? '');
      setLotId(e.lot?.id ?? '');
      setShowMore(Boolean(e.data.durationHours || e.data.impact));
    },
  });

  const backPath = withProjectQuery('/m/diary/work', projectId);

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
    if (!delayType || !description.trim() || hoursError) return;
    const parsedHours = parseOptionalDiaryHoursInput(durationHours);
    void runSave(
      () =>
        handlers.addDelayFromSheet({
          delayType,
          description: description.trim(),
          durationHours: parsedHours ?? undefined,
          impact: impact || undefined,
          lotId: lotId || undefined,
        }),
      () => {
        draft.clearDraft();
        navigate(backPath);
      },
    );
  };

  const canSave = !!delayType && !!description.trim() && !hoursError;

  return (
    <ShellScreen
      variant="inner"
      title={editId ? 'Edit Delay' : 'Add Delay'}
      parent={backPath}
      sub={<span className="text-muted-foreground">Auto-saves as you type</span>}
      bottom={
        <div className="shell-cambar">
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || saving}
            className={cn('shell-cambar-btn', (!canSave || saving) && 'opacity-50')}
            aria-label="Save delay"
          >
            {saving ? (
              <>
                <Loader2 size={20} className="animate-spin" aria-hidden="true" /> Saving…
              </>
            ) : (
              'Save delay'
            )}
          </button>
        </div>
      }
    >
      {draft.draftHintVisible && (
        <SheetDraftRestoredHint onDiscard={handleDiscardDraft} onDismiss={draft.dismissDraftHint} />
      )}

      {/* Delay type chips */}
      <div>
        <label className="mb-2 block text-[12px] font-semibold uppercase tracking-[.07em] text-muted-foreground">
          Type *
        </label>
        <div className="flex flex-wrap gap-2">
          {DELAY_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setDelayType(t)}
              className={cn(
                'min-h-[44px] rounded-full px-3 py-2 text-sm font-medium touch-manipulation',
                delayType === t
                  ? 'bg-foreground text-[hsl(40_33%_98%)]'
                  : 'bg-secondary text-muted-foreground',
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <label className="block text-[12px] font-semibold uppercase tracking-[.07em] text-muted-foreground">
            Description *
          </label>
          <DictationMicButton
            onTranscript={(text) => setDescription((prev) => (prev ? prev + ' ' + text : text))}
          />
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What caused the delay?"
          rows={3}
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
        {showMore ? 'Less details' : 'Duration / impact'}
      </button>

      {showMore && (
        <>
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[.07em] text-muted-foreground">
              Duration (hours)
            </label>
            <input
              type="number"
              value={durationHours}
              onChange={(e) => setDurationHours(e.target.value)}
              placeholder="0"
              step="0.5"
              inputMode="decimal"
              className={cn(
                'w-full min-h-[52px] rounded-xl border border-border bg-card px-3 py-3 text-[15px] text-foreground touch-manipulation',
                hoursError && 'border-destructive',
              )}
            />
            {hoursError && (
              <p className="mt-1 text-xs text-destructive" role="alert" aria-live="assertive">
                {hoursError}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[.07em] text-muted-foreground">
              Impact
            </label>
            <input
              type="text"
              value={impact}
              onChange={(e) => setImpact(e.target.value)}
              placeholder="e.g. No work possible on embankment"
              autoCapitalize="sentences"
              enterKeyHint="done"
              className="w-full min-h-[52px] rounded-xl border border-border bg-card px-3 py-3 text-[15px] text-foreground touch-manipulation"
            />
          </div>

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
        </>
      )}

      {saveError && <SheetErrorBanner onRetry={handleSave} retrying={saving} />}
    </ShellScreen>
  );
}
