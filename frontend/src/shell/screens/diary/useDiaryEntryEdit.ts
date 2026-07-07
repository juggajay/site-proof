import { useEffect, useRef } from 'react';
import type { TimelineEntry } from '@/components/foreman/DiaryTimelineEntry';

/**
 * Wires a diary work-form screen into edit mode. When `editId` names an entry of
 * this `type` in the loaded timeline, it points the shared handlers at that entry
 * (so the existing save path PATCHes instead of creating a duplicate) and seeds
 * the form fields once via `seed`. Seeding waits for the timeline to load, so it
 * is safe when the form mounts before the entry list is fetched. The editing
 * pointer is cleared on unmount so a later create isn't mistaken for an edit.
 */
export function useDiaryEntryEdit({
  editId,
  type,
  timeline,
  setEditingEntry,
  seed,
}: {
  editId: string | null;
  type: TimelineEntry['type'];
  timeline: TimelineEntry[];
  setEditingEntry: (entry: TimelineEntry | null) => void;
  seed: (entry: TimelineEntry) => void;
}) {
  const seededRef = useRef(false);
  // Keep the latest seed closure without making it an effect dependency (a fresh
  // function each render would otherwise re-run the effect).
  const seedRef = useRef(seed);
  seedRef.current = seed;

  useEffect(() => {
    if (seededRef.current || !editId) return;
    const entry = timeline.find((e) => e.id === editId && e.type === type);
    if (!entry) return;
    seededRef.current = true;
    setEditingEntry(entry);
    seedRef.current(entry);
  }, [editId, type, timeline, setEditingEntry]);

  useEffect(() => () => setEditingEntry(null), [setEditingEntry]);
}
