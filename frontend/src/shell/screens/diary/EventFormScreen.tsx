/**
 * EventFormScreen — /m/diary/work/event
 *
 * Full-screen form reusing AddEventSheet's form logic including auto-draft,
 * dictation-friendly attrs, useSheetSave haptic, offline fallback.
 *
 * Design spec: docs/design-foreman-shell-mock-v4.html #activity (form pattern)
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
import { SheetDraftRestoredHint } from '@/components/foreman/sheets/SheetDraftRestoredHint';
import { SheetErrorBanner } from '@/components/foreman/sheets/SheetErrorBanner';
import { formatDateKey } from '@/lib/localDate';

const EVENT_TYPES = ['Visitor', 'Safety', 'Instruction', 'Variation', 'Other'];

export function EventFormScreen() {
  const navigate = useNavigate();
  const { projectId } = useEffectiveProjectId();
  const { lots, handlers } = useDiaryShellData();

  const todayKey = formatDateKey();
  const draftKey = projectId ? sheetDraftKey(projectId, todayKey, 'event') : undefined;
  const defaultLotId = handlers.activeLotId;

  const [restoredDraft] = useState(() => readSheetDraft(draftKey));
  const [eventType, setEventType] = useState(restoredDraft?.eventType ?? '');
  const [description, setDescription] = useState(restoredDraft?.description ?? '');
  const [notes, setNotes] = useState(restoredDraft?.notes ?? '');
  const [lotId, setLotId] = useState(
    restoredDraft ? restoredDraft.lotId || '' : defaultLotId || '',
  );
  const [showMore, setShowMore] = useState(Boolean(restoredDraft && restoredDraft.notes));

  const { saving, saveError, runSave } = useSheetSave();
  const draft = useSheetDraft({
    draftKey,
    restored: restoredDraft,
    fields: { eventType, description, notes, lotId },
    baseline: { eventType: '', description: '', notes: '', lotId: defaultLotId || '' },
  });

  const backPath = projectId ? `/m/diary/work?projectId=${projectId}` : '/m/diary/work';

  const handleDiscardDraft = () => {
    setEventType('');
    setDescription('');
    setNotes('');
    setLotId(defaultLotId || '');
    setShowMore(false);
    draft.discardDraft();
  };

  const handleSave = () => {
    if (!eventType || !description.trim()) return;
    void runSave(
      () =>
        handlers.addEventFromSheet({
          eventType,
          description: description.trim(),
          notes: notes || undefined,
          lotId: lotId || undefined,
        }),
      () => {
        draft.clearDraft();
        navigate(backPath);
      },
    );
  };

  const canSave = !!eventType && !!description.trim();

  return (
    <ShellScreen
      variant="inner"
      title="Add Event"
      parent={backPath}
      sub={<span className="text-muted-foreground">Auto-saves as you type</span>}
      bottom={
        <div className="shell-cambar">
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || saving}
            className={cn('shell-cambar-btn', (!canSave || saving) && 'opacity-50')}
            aria-label="Save event"
          >
            {saving ? (
              <>
                <Loader2 size={20} className="animate-spin" aria-hidden="true" /> Saving…
              </>
            ) : (
              'Save event'
            )}
          </button>
        </div>
      }
    >
      {draft.draftHintVisible && (
        <SheetDraftRestoredHint onDiscard={handleDiscardDraft} onDismiss={draft.dismissDraftHint} />
      )}

      {/* Event type chips */}
      <div>
        <label className="mb-2 block text-[12px] font-semibold uppercase tracking-[.07em] text-muted-foreground">
          Type *
        </label>
        <div className="flex flex-wrap gap-2">
          {EVENT_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setEventType(t)}
              className={cn(
                'min-h-[44px] rounded-full px-3 py-2 text-sm font-medium touch-manipulation',
                eventType === t
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
        <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[.07em] text-muted-foreground">
          Description *
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What happened?"
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
        {showMore ? 'Less details' : 'Notes / lot'}
      </button>

      {showMore && (
        <>
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
