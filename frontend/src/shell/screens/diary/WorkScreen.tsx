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

import { useNavigate } from 'react-router-dom';
import { Wrench, Clock, Truck, Flag, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ShellScreen } from '../../components/ShellScreen';
import { withProjectQuery } from '../../shellPaths';
import { useDiaryShellData } from './useDiaryShellData';
import { useEffectiveProjectId } from '@/hooks/useEffectiveProjectId';
import type { TimelineEntry } from '@/components/foreman/DiaryTimelineEntry';

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
        !isSubmitted && workEntries.length > 0 ? (
          <div className="shell-cambar">
            <button
              type="button"
              onClick={navToReview}
              className="shell-cambar-btn"
              aria-label="Done — review and submit"
            >
              Done — review &amp; submit
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

      {/* Work entries list */}
      {workEntries.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {workEntries.map((entry) => (
            <WorkEntry
              key={entry.id}
              entry={entry}
              isSubmitted={isSubmitted}
              onEdit={(e) => handlers.handleEditEntry(e)}
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
  onEdit: (entry: TimelineEntry) => void;
}

function WorkEntry({ entry, isSubmitted, onEdit }: WorkEntryProps) {
  const typeLabel = TYPE_LABELS[entry.type] ?? entry.type;
  const meta = [
    entry.lot ? `Lot ${entry.lot.lotNumber}` : null,
    entry.data?.durationHours != null ? `${entry.data.durationHours}h` : null,
    entry.data?.delayType ?? null,
    entry.data?.eventType ?? null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <button
      type="button"
      disabled={isSubmitted}
      onClick={() => !isSubmitted && onEdit(entry)}
      aria-label={`${typeLabel}: ${entry.description}${meta ? ` — ${meta}` : ''}`}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3',
        'min-h-[52px] text-left shadow-sm touch-manipulation',
        'transition-transform duration-150',
        !isSubmitted && 'active:scale-[.98]',
        isSubmitted && 'opacity-60',
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-semibold uppercase tracking-[.07em] text-muted-foreground">
          {typeLabel}
        </span>
        <span className="block text-[15px] font-semibold text-foreground">{entry.description}</span>
        {meta && <span className="mt-0.5 block text-[13px] text-muted-foreground">{meta}</span>}
      </span>
      {!isSubmitted && (
        <ChevronRight
          size={16}
          className="flex-shrink-0 text-muted-foreground/50"
          aria-hidden="true"
        />
      )}
    </button>
  );
}
