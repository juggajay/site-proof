/**
 * WorkScreen — /m/diary/work
 *
 * Big-add 2×2 grid (Activity/Delay/Delivery/Event) + today's entries listed below.
 * Tapping a grid button navigates to the full-screen form at /m/diary/work/{type}.
 * Entries are tappable to edit (if the existing logic supports edit, else display-only).
 *
 * Design spec: docs/design-foreman-shell-mock-v4.html #work
 * Reuses: timeline entries, useDiaryMobileHandlers (delete + edit)
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wrench, Clock, Truck, Flag, ChevronRight, Lock, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ShellScreen } from '../../components/ShellScreen';
import { withProjectQuery } from '../../shellPaths';
import { useDiaryShellData } from './useDiaryShellData';
import { useEffectiveProjectId } from '@/hooks/useEffectiveProjectId';
import type { TimelineEntry } from '@/components/foreman/DiaryTimelineEntry';
import { DeliveryEvidenceSheet } from '@/components/deliveries/DeliveryEvidenceSheet';
import { DocketChip } from '@/components/deliveries/DocketChip';
import {
  docketFilingStatusKey,
  type DocketFilingStatusKey,
} from '@/components/deliveries/docketFilingState';
import { useDeliveryDocketPhotos } from '@/components/deliveries/useDeliveryDocketPhotos';

const ADD_ITEMS = [
  { type: 'activity' as const, icon: Wrench, label: 'Activity' },
  { type: 'delay' as const, icon: Clock, label: 'Delay' },
  { type: 'delivery' as const, icon: Truck, label: 'Delivery' },
  { type: 'event' as const, icon: Flag, label: 'Event' },
];

export function WorkScreen() {
  const navigate = useNavigate();
  const { projectId } = useEffectiveProjectId();
  const { diary, timeline, handlers } = useDiaryShellData();
  const { byDeliveryId, isOnline } = useDeliveryDocketPhotos();
  // The delivery whose evidence sheet is open. Only ever a delivery — the sheet
  // files a docket and nothing else can carry one.
  const [evidenceFor, setEvidenceFor] = useState<TimelineEntry | null>(null);

  const isSubmitted = diary?.status === 'submitted';

  // Only work entries (not crew/plant)
  const workEntries = timeline.filter(
    (e) =>
      e.type === 'activity' || e.type === 'delay' || e.type === 'delivery' || e.type === 'event',
  );

  const backPath = withProjectQuery('/m/diary', projectId);

  const navToForm = (type: string) => {
    if (isSubmitted) return;
    navigate(withProjectQuery(`/m/diary/work/${type}`, projectId));
  };

  // Edit opens the matching form pre-filled (?edit=<id>); the form seeds from the
  // entry and the existing save path PATCHes it. Replaces the old no-op that set
  // sheet state nothing in the shell renders.
  //
  // C5-a: once the diary is submitted a delivery row is no longer dead. Its
  // CONTENT stays locked — the row never reopens the edit form — but filing its
  // docket is evidence, not an edit, so the row opens the evidence sheet.
  const openEntry = (entry: TimelineEntry) => {
    if (isSubmitted) {
      if (entry.type === 'delivery') setEvidenceFor(entry);
      return;
    }
    navigate(withProjectQuery(`/m/diary/work/${entry.type}`, projectId, { edit: entry.id }));
  };

  const navToReview = () => {
    navigate(withProjectQuery('/m/diary/review', projectId));
  };

  const sub = (
    <span className="flex items-center gap-2">
      <span className="text-muted-foreground">Daily Diary</span>
      <span className="font-mono text-[11.5px] font-semibold tracking-[.12em] text-warning">
        STEP 3/4
      </span>
    </span>
  );

  return (
    <ShellScreen
      variant="inner"
      title="Today's Work"
      parent={backPath}
      sub={sub}
      bottom={
        // Step 3 of 4 always needs a way forward. Gating this on
        // `workEntries.length > 0` stranded any day that legitimately has no
        // work to log (rained out, stood down) with no control but the back
        // chevron — the diary could never be reviewed or submitted.
        !isSubmitted ? (
          <div className="shell-cambar">
            <button
              type="button"
              onClick={navToReview}
              className="shell-cambar-btn"
              aria-label={
                workEntries.length > 0 ? 'Done — review and submit' : 'Next: review and submit'
              }
            >
              {workEntries.length > 0 ? 'Done — review & submit' : 'Next: Review & submit'}
            </button>
          </div>
        ) : undefined
      }
    >
      {/* Big-add 2×2 grid — hidden when submitted */}
      {!isSubmitted && (
        <div className="grid grid-cols-2 gap-3" role="group" aria-label="Add a work entry">
          {ADD_ITEMS.map(({ type, icon: Icon, label }) => (
            <button
              key={type}
              type="button"
              onClick={() => navToForm(type)}
              aria-label={`Add ${label}`}
              className={cn(
                'flex min-h-[88px] flex-col items-center justify-center gap-2',
                'rounded-2xl border border-border bg-card shadow-sm',
                'font-condensed text-[17px] font-bold text-foreground',
                'touch-manipulation',
                'transition-transform duration-150 [transition-timing-function:cubic-bezier(.32,1.15,.35,1)]',
                'active:scale-[.96]',
              )}
              style={{
                fontFamily: "'IBM Plex Sans Condensed', 'IBM Plex Sans', sans-serif",
              }}
            >
              <Icon size={24} strokeWidth={1.8} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Submitted diaries used to be a dead end. Say what is still possible. */}
      {isSubmitted && workEntries.length > 0 && (
        <div className="flex gap-2.5 rounded-2xl bg-secondary px-4 py-3.5 text-[14px] leading-[1.5] text-muted-foreground">
          <Lock size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            The diary is submitted, so entries can&rsquo;t be changed. Dockets can still be filed
            against them.
          </span>
        </div>
      )}

      {/* Work entries list */}
      {workEntries.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {workEntries.map((entry) => (
            <WorkEntry
              key={entry.id}
              entry={entry}
              isSubmitted={isSubmitted}
              docketStatusKey={
                entry.type === 'delivery'
                  ? docketFilingStatusKey({
                      docketDocumentId: entry.data?.docketDocumentId,
                      photo: byDeliveryId.get(entry.id),
                      isOnline,
                    })
                  : undefined
              }
              onOpen={openEntry}
              onDelete={(e) => void handlers.handleDeleteEntry(e)}
            />
          ))}
        </div>
      ) : (
        !isSubmitted && (
          <p className="py-6 text-center text-[14px] leading-relaxed text-muted-foreground">
            Nothing yet. Each entry takes about 20 seconds —{'\n'}
            use the keyboard mic and just say it.
          </p>
        )
      )}

      {evidenceFor && projectId && (
        <DeliveryEvidenceSheet
          isOpen
          onClose={() => setEvidenceFor(null)}
          projectId={projectId}
          lotId={evidenceFor.lot?.id}
          queuedPhoto={byDeliveryId.get(evidenceFor.id) ?? null}
          delivery={{
            id: evidenceFor.id,
            description: evidenceFor.description,
            supplier: evidenceFor.data?.supplier,
            docketNumber: evidenceFor.data?.docketNumber,
            quantity: evidenceFor.data?.quantity,
            unit: evidenceFor.data?.unit,
            lotLabel: evidenceFor.lot ? `Lot ${evidenceFor.lot.lotNumber}` : null,
            recordedAt: evidenceFor.createdAt,
            docketDocumentId: evidenceFor.data?.docketDocumentId,
          }}
        />
      )}
    </ShellScreen>
  );
}

// ── Work entry row ────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  activity: 'Activity',
  delay: 'Delay',
  delivery: 'Delivery',
  event: 'Event',
};

interface WorkEntryProps {
  entry: TimelineEntry;
  isSubmitted: boolean;
  /** Deliveries only — the filing state of this row's docket. */
  docketStatusKey?: DocketFilingStatusKey;
  onOpen: (entry: TimelineEntry) => void;
  onDelete: (entry: TimelineEntry) => void;
}

function WorkEntry({ entry, isSubmitted, docketStatusKey, onOpen, onDelete }: WorkEntryProps) {
  const typeLabel = TYPE_LABELS[entry.type] ?? entry.type;
  const meta = [
    entry.lot ? `Lot ${entry.lot.lotNumber}` : null,
    entry.data?.durationHours != null ? `${entry.data.durationHours}h` : null,
    entry.data?.delayType ?? null,
    entry.data?.eventType ?? null,
  ]
    .filter(Boolean)
    .join(' · ');

  // Two-tap delete (no blocking window.confirm, matching the docket shell): first
  // tap arms "Remove?", a second within 4s deletes; anything else disarms.
  const [armed, setArmed] = useState(false);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (armTimer.current) clearTimeout(armTimer.current);
    },
    [],
  );
  const handleDeleteTap = () => {
    if (armed) {
      if (armTimer.current) clearTimeout(armTimer.current);
      setArmed(false);
      onDelete(entry);
      return;
    }
    setArmed(true);
    armTimer.current = setTimeout(() => setArmed(false), 4000);
  };

  // A submitted delivery row stays TAPPABLE — not to edit it, but to file its
  // docket. Every other type is genuinely finished once the diary is in.
  const canOpen = !isSubmitted || entry.type === 'delivery';
  // Only the row that can actually file a docket says so. A locked activity row
  // keeps its Edit label (and its disabled button) — announcing "File docket
  // for" on it would be a screen reader promising an action that does not exist.
  const actionLabel = isSubmitted && canOpen ? 'File docket for' : `Edit ${typeLabel}:`;

  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-xl border border-border bg-card px-1 shadow-sm',
        isSubmitted && !canOpen && 'opacity-60',
        isSubmitted &&
          docketStatusKey &&
          docketStatusKey !== 'delivery_docket_filed' &&
          'border-warning/50',
      )}
    >
      <button
        type="button"
        disabled={!canOpen}
        onClick={() => canOpen && onOpen(entry)}
        aria-label={`${actionLabel} ${entry.description}${meta ? ` — ${meta}` : ''}`}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-3',
          'min-h-[52px] text-left touch-manipulation transition-transform duration-150',
          canOpen && 'active:scale-[.98]',
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-semibold uppercase tracking-[.07em] text-muted-foreground">
            {typeLabel}
          </span>
          <span className="block text-[15px] font-semibold text-foreground">
            {entry.description}
          </span>
          {meta && <span className="mt-0.5 block text-[13px] text-muted-foreground">{meta}</span>}
        </span>
        {docketStatusKey && <DocketChip statusKey={docketStatusKey} />}
        {canOpen && (
          <ChevronRight
            size={16}
            className="flex-shrink-0 text-muted-foreground/50"
            aria-hidden="true"
          />
        )}
      </button>
      {!isSubmitted && (
        <button
          type="button"
          onClick={handleDeleteTap}
          aria-label={armed ? `Confirm delete ${typeLabel}` : `Delete ${typeLabel}`}
          className={cn(
            'flex min-h-[48px] shrink-0 items-center justify-center rounded-lg active:bg-secondary',
            armed
              ? 'px-2 text-[12px] font-semibold text-destructive'
              : 'w-11 text-muted-foreground',
          )}
        >
          {armed ? 'Remove?' : <Trash2 size={17} aria-hidden="true" />}
        </button>
      )}
    </div>
  );
}
