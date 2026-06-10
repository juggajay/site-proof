import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isRecord,
  parseJsonPreference,
  readSessionStorageItem,
  removeSessionStorageItem,
  writeSessionStorageItem,
} from '@/lib/storagePreferences';

/**
 * Auto-draft persistence for the diary bottom sheets.
 *
 * Field research: every form fill on site WILL be interrupted (phone call, app
 * backgrounded, accidental overlay tap). #776 made save FAILURES keep the
 * sheet open; this module protects the DISMISSAL path — typed state is
 * persisted (debounced) while the foreman types and flushed synchronously on
 * unmount, so any dismissal can be undone by simply reopening the sheet.
 *
 * Storage tier: session storage via the safe @/lib/storagePreferences helpers
 * (the only sanctioned storage access — the readiness suite scans every file,
 * tests included, for raw access). Drafts are same-shift scratch state:
 * session storage survives interruptions, backgrounding, and reloads within
 * the tab, but never leaks half-typed entries across users on a shared device
 * the way local storage would.
 */

export type SheetDraftFields = Record<string, string>;

export type SheetDraftType = 'activity' | 'delay' | 'delivery' | 'event' | 'manual' | 'weather';

/** Drafts are scoped per project + diary date + sheet so days never bleed. */
export function sheetDraftKey(projectId: string, diaryDate: string, sheetType: SheetDraftType) {
  return `siteproof_diary_sheet_draft:${projectId}:${diaryDate}:${sheetType}`;
}

function isDraftFields(value: unknown): SheetDraftFields | null {
  if (!isRecord(value)) return null;
  const fields: SheetDraftFields = {};
  for (const [key, fieldValue] of Object.entries(value)) {
    if (typeof fieldValue !== 'string') return null;
    fields[key] = fieldValue;
  }
  return fields;
}

/** Reads a previously persisted draft; null when absent, invalid, or disabled. */
export function readSheetDraft(draftKey: string | undefined): SheetDraftFields | null {
  if (!draftKey) return null;
  return parseJsonPreference<SheetDraftFields | null>(
    readSessionStorageItem(draftKey),
    null,
    isDraftFields,
  );
}

/**
 * A draft is pristine when every field matches the sheet's baseline (empty
 * fields plus auto-populated values like the default lot or fetched weather).
 * Pristine state is never persisted — auto-populated values must not create
 * phantom "Draft restored" hints.
 */
export function isSheetDraftPristine(fields: SheetDraftFields, baseline: SheetDraftFields) {
  const keys = new Set([...Object.keys(fields), ...Object.keys(baseline)]);
  for (const key of keys) {
    if ((fields[key] ?? '') !== (baseline[key] ?? '')) return false;
  }
  return true;
}

function persistSheetDraft(draftKey: string, fields: SheetDraftFields, baseline: SheetDraftFields) {
  if (isSheetDraftPristine(fields, baseline)) {
    // Hand-clearing every field back to its baseline is an explicit discard.
    removeSessionStorageItem(draftKey);
  } else {
    writeSessionStorageItem(draftKey, JSON.stringify(fields));
  }
}

const DRAFT_WRITE_DEBOUNCE_MS = 400;

interface UseSheetDraftParams {
  /** Undefined disables drafting entirely (e.g. editing an existing entry). */
  draftKey: string | undefined;
  /** The draft read at mount (via readSheetDraft) that seeded the fields. */
  restored: SheetDraftFields | null;
  /** Current typed state, serialized to strings by the sheet each render. */
  fields: SheetDraftFields;
  /** Pristine state: empty fields plus auto-populated defaults. */
  baseline: SheetDraftFields;
}

export function useSheetDraft({ draftKey, restored, fields, baseline }: UseSheetDraftParams) {
  const [draftHintVisible, setDraftHintVisible] = useState(restored !== null);
  const serializedFields = JSON.stringify(fields);

  const draftKeyRef = useRef(draftKey);
  const fieldsRef = useRef(fields);
  const baselineRef = useRef(baseline);
  useEffect(() => {
    draftKeyRef.current = draftKey;
    fieldsRef.current = fields;
    baselineRef.current = baseline;
  });

  // Disarmed after a successful save so the unmount flush cannot resurrect
  // the entry that was just recorded; any subsequent field change re-arms.
  const armedRef = useRef(restored !== null);
  const pendingWriteRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelPendingWrite = () => {
    if (pendingWriteRef.current !== null) {
      clearTimeout(pendingWriteRef.current);
      pendingWriteRef.current = null;
    }
  };

  // Debounced persist as the foreman types. Keyed off the serialized fields
  // so parent re-renders (new object identities, same values) never reset the
  // debounce window.
  useEffect(() => {
    if (!draftKey) return;
    armedRef.current = true;
    pendingWriteRef.current = setTimeout(() => {
      pendingWriteRef.current = null;
      persistSheetDraft(draftKey, fieldsRef.current, baselineRef.current);
    }, DRAFT_WRITE_DEBOUNCE_MS);
    return cancelPendingWrite;
  }, [draftKey, serializedFields]);

  // Synchronous flush on unmount: an overlay tap within the debounce window
  // must never cost the foreman their last keystrokes.
  useEffect(() => {
    return () => {
      if (!draftKeyRef.current || !armedRef.current) return;
      persistSheetDraft(draftKeyRef.current, fieldsRef.current, baselineRef.current);
    };
  }, []);

  /** Call on save success (online or queued offline) — the entry is recorded. */
  const clearDraft = useCallback(() => {
    cancelPendingWrite();
    armedRef.current = false;
    if (draftKeyRef.current) removeSessionStorageItem(draftKeyRef.current);
  }, []);

  /** Explicit user discard from the "Draft restored" hint. */
  const discardDraft = useCallback(() => {
    clearDraft();
    setDraftHintVisible(false);
  }, [clearDraft]);

  const dismissDraftHint = useCallback(() => setDraftHintVisible(false), []);

  return { draftHintVisible, dismissDraftHint, clearDraft, discardDraft };
}
