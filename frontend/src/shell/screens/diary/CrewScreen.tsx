/**
 * CrewScreen — /m/diary/crew
 *
 * Personnel + plant lists with ≥48px rows, add via the existing
 * AddManualLabourPlantSheet form logic.
 * "Carry yesterday's crew & plant forward?" affordance reusing
 * useCopyFromYesterday exactly (incl. its no-diary guard and dedupe).
 *
 * Design spec: docs/design-foreman-shell-mock-v4.html (crew & plant pattern)
 * Reuses: AddManualLabourPlantSheet, useCopyFromYesterday via useDiaryMobileHandlers
 */

import { useState } from 'react';
import { Plus, Users, Wrench, Loader2, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ShellScreen } from '../../components/ShellScreen';
import { withProjectQuery } from '../../shellPaths';
import { useDiaryShellData } from './useDiaryShellData';
import { useEffectiveProjectId } from '@/hooks/useEffectiveProjectId';
import { AddManualLabourPlantSheet } from '@/components/foreman/sheets/AddManualLabourPlantSheet';
import { sheetDraftKey } from '@/components/foreman/sheets/useSheetDraft';
import { formatDateKey } from '@/lib/localDate';
import type { TimelineEntry } from '@/components/foreman/DiaryTimelineEntry';

export function CrewScreen() {
  const { projectId } = useEffectiveProjectId();
  const { diary, timeline, lots, handlers } = useDiaryShellData();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimelineEntry | null>(null);

  const todayKey = formatDateKey();
  const draftKey =
    projectId && !editingEntry ? sheetDraftKey(projectId, todayKey, 'manual') : undefined;

  const backPath = withProjectQuery('/m/diary', projectId);

  const personnel = timeline.filter((e) => e.type === 'personnel');
  const plant = timeline.filter((e) => e.type === 'plant');

  const handleEdit = (entry: TimelineEntry) => {
    setEditingEntry(entry);
    setSheetOpen(true);
  };

  const handleCloseSheet = () => {
    setSheetOpen(false);
    setEditingEntry(null);
  };

  const sub = <span className="text-muted-foreground">Daily Diary</span>;

  return (
    <>
      <ShellScreen
        variant="inner"
        title="Crew & Plant"
        parent={backPath}
        sub={sub}
        bottom={
          <div className="shell-cambar">
            <button
              type="button"
              onClick={() => {
                setEditingEntry(null);
                setSheetOpen(true);
              }}
              className="shell-cambar-btn"
              aria-label="Add person or plant"
            >
              <Plus size={20} aria-hidden="true" />
              Add person or plant
            </button>
          </div>
        }
      >
        {/* Copy from yesterday affordance — only when diary exists */}
        {handlers.canCopyFromYesterday && (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={handlers.copyingPersonnel}
              onClick={handlers.copyPersonnelFromYesterday}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border',
                'min-h-[48px] px-3 py-2 text-[13px] font-semibold touch-manipulation',
                'bg-card text-muted-foreground shadow-sm',
                'transition-transform duration-150 active:scale-[.98]',
                handlers.copyingPersonnel && 'opacity-50',
              )}
              aria-label="Copy yesterday's crew"
            >
              {handlers.copyingPersonnel ? (
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              ) : (
                <Copy size={14} aria-hidden="true" />
              )}
              Carry yesterday's crew
            </button>
            <button
              type="button"
              disabled={handlers.copyingPlant}
              onClick={handlers.copyPlantFromYesterday}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border',
                'min-h-[48px] px-3 py-2 text-[13px] font-semibold touch-manipulation',
                'bg-card text-muted-foreground shadow-sm',
                'transition-transform duration-150 active:scale-[.98]',
                handlers.copyingPlant && 'opacity-50',
              )}
              aria-label="Copy yesterday's plant"
            >
              {handlers.copyingPlant ? (
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              ) : (
                <Copy size={14} aria-hidden="true" />
              )}
              Carry yesterday's plant
            </button>
          </div>
        )}

        {/* Personnel list */}
        {personnel.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Users size={14} className="text-muted-foreground" aria-hidden="true" />
              <span className="text-[12px] font-semibold uppercase tracking-[.07em] text-muted-foreground">
                People ({personnel.length})
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {personnel.map((entry) => (
                <CrewRow
                  key={entry.id}
                  entry={entry}
                  isSubmitted={diary?.status === 'submitted'}
                  onEdit={handleEdit}
                />
              ))}
            </div>
          </div>
        )}

        {/* Plant list */}
        {plant.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Wrench size={14} className="text-muted-foreground" aria-hidden="true" />
              <span className="text-[12px] font-semibold uppercase tracking-[.07em] text-muted-foreground">
                Plant & Equipment ({plant.length})
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {plant.map((entry) => (
                <CrewRow
                  key={entry.id}
                  entry={entry}
                  isSubmitted={diary?.status === 'submitted'}
                  onEdit={handleEdit}
                />
              ))}
            </div>
          </div>
        )}

        {personnel.length === 0 && plant.length === 0 && (
          <p className="py-8 text-center text-[14px] leading-relaxed text-muted-foreground">
            No crew or plant yet.{'\n'}
            Use the button below to add, or carry from yesterday.
          </p>
        )}
      </ShellScreen>

      <AddManualLabourPlantSheet
        isOpen={sheetOpen}
        onClose={handleCloseSheet}
        onSavePersonnel={handlers.handleSavePersonnel}
        onSavePlant={handlers.handleSavePlant}
        defaultLotId={handlers.activeLotId}
        lots={lots}
        initialPersonnelData={
          editingEntry?.type === 'personnel'
            ? {
                name: editingEntry.description,
                company: editingEntry.data?.company,
                role: editingEntry.data?.role,
                hours:
                  typeof editingEntry.data?.hours === 'number'
                    ? editingEntry.data.hours
                    : undefined,
                lotId: editingEntry.lot?.id,
              }
            : undefined
        }
        initialPlantData={
          editingEntry?.type === 'plant'
            ? {
                description: editingEntry.description,
                idRego: editingEntry.data?.idRego,
                company: editingEntry.data?.company,
                hoursOperated:
                  typeof editingEntry.data?.hoursOperated === 'number'
                    ? editingEntry.data.hoursOperated
                    : undefined,
                lotId: editingEntry.lot?.id,
              }
            : undefined
        }
        draftKey={draftKey}
      />
    </>
  );
}

// ── Crew row ──────────────────────────────────────────────────────────────────

interface CrewRowProps {
  entry: TimelineEntry;
  isSubmitted: boolean;
  onEdit: (entry: TimelineEntry) => void;
}

function CrewRow({ entry, isSubmitted, onEdit }: CrewRowProps) {
  const meta =
    entry.type === 'personnel'
      ? [
          entry.data?.role,
          entry.data?.company,
          entry.data?.hours != null ? `${entry.data.hours}h` : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : [
          entry.data?.idRego,
          entry.data?.company,
          entry.data?.hoursOperated != null ? `${entry.data.hoursOperated}h` : null,
        ]
          .filter(Boolean)
          .join(' · ');

  return (
    <button
      type="button"
      disabled={isSubmitted}
      onClick={() => !isSubmitted && onEdit(entry)}
      aria-label={`${entry.description}${meta ? ` — ${meta}` : ''}`}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3',
        'min-h-[52px] text-left shadow-sm touch-manipulation',
        'transition-transform duration-150',
        !isSubmitted && 'active:scale-[.98]',
        isSubmitted && 'opacity-60',
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-foreground">{entry.description}</span>
        {meta && <span className="mt-0.5 block text-[13px] text-muted-foreground">{meta}</span>}
      </span>
    </button>
  );
}
