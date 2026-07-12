/**
 * useItpRunController — the shared correctness core of the one-check-per-screen
 * ITP run, imported (never forked) by BOTH the foreman run (ItpRunScreen) and the
 * subbie run (SubbieItpRunScreen).
 *
 * The two screens keep their own JSX (routing, role gating, read-only banners and
 * copy differ per surface), but the run STATE MACHINE below was byte-identical in
 * both. It carries the correctness-critical rules that a fix to one screen used to
 * silently miss in the other:
 *
 *   - HOLD-POINT PASS GUARD: `handlePass` refuses to `pass()` an un-released hold
 *     point (`gate.kind === 'awaiting-release'`) and never surfaces Pass for a
 *     superintendent sign-off item — the decision itself is the shared
 *     `holdPointGateDecision` / `isSuperintendentSignoffOnlyItem` from lotsShellState.
 *   - NCR-ON-FAIL LINKAGE: `handleSubmitReason` routes a FAIL through the run's
 *     `markFailed`, which each screen wires to the server-side action that raises
 *     the linked NCR. This controller only dispatches; it never invents an NCR flow.
 *   - OFFLINE COMPLETION WRITE: `doPass` / photo attach dispatch through the run's
 *     `pass` / `addPhoto`, whose offline-queue behaviour lives in the per-side hook.
 *   - EVIDENCE GUARD: a photo-required check with no photo must confirm before
 *     passing (`evidencePrompt`), exactly like the desktop EvidenceWarningModal.
 *
 * The controller is agnostic to which run hook feeds it: it depends only on the
 * `ItpRunSource` slice below, which both `useShellItpRun` and `useSubbieItpRun`
 * structurally satisfy. Read-only / canComplete gating stays in the subbie SCREEN
 * (it only hides affordances; the controller's guards are unconditional).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  advanceToNextIncomplete,
  firstIncompleteIndex,
  holdPointGateDecision,
  itpCompletionDisposition,
  isSuperintendentSignoffOnlyItem,
  runItemOrder,
  runProgress,
} from '@/shell/screens/lots/lotsShellState';
import { dotStateFor, snapFrac } from '@/shell/screens/lots/itpTrackPhysics';
import { useItpContentDrag } from '@/shell/screens/lots/useItpContentDrag';
import type { ItpDotTrackItem } from '@/shell/screens/lots/ItpDotTrack';
import type { ITPCompletion, ITPInstance } from '@/pages/lots/types';

// Pass-flash auto-advance timing — long enough to register the green flash, short
// enough not to stall a foreman moving fast. Reduced-motion users still advance;
// the flash just doesn't animate (handled by CSS).
const FLASH_MS = 650;

/**
 * The slice of a run hook the controller needs. Both `useShellItpRun` (foreman)
 * and `useSubbieItpRun` (subbie) return supersets of this — the hooks own the very
 * different data-loading + completion-write plumbing behind these methods.
 */
export interface ItpRunSource {
  instance: ITPInstance | null;
  /** Per-item in-flight id (disables the tri-state while a write is settling). */
  updatingItemId: string | null;
  completionFor: (checklistItemId: string) => ITPCompletion | undefined;
  /** PASS / mark complete. Caller must NOT invoke for un-released hold points. */
  pass: (checklistItemId: string, notes: string | null) => Promise<boolean>;
  markNA: (checklistItemId: string, reason: string) => Promise<boolean>;
  markFailed: (checklistItemId: string, reason: string) => Promise<boolean>;
  addPhoto: (checklistItemId: string, file: File) => Promise<void>;
}

export function useItpRunController(run: ItpRunSource) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ordered run items (checklist's own order, stable).
  const orderedItems = useMemo(
    () => (run.instance ? runItemOrder(run.instance.template.checklistItems) : []),
    [run.instance],
  );
  const completions = run.instance?.completions ?? [];

  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  // Live fractional scrub position while the dot track is being dragged; null when
  // idle. Drives the synced content-strip preview + the live CHECK n/m.
  const [scrubFrac, setScrubFrac] = useState<number | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  // Inline reason capture for N/A and FAIL (reuses the existing reason semantics).
  const [reasonMode, setReasonMode] = useState<null | 'na' | 'fail'>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Confirm-before-pass when a photo-required check has no photo yet (mirrors the
  // desktop EvidenceWarningModal so an evidence gap is deliberate).
  const [evidencePrompt, setEvidencePrompt] = useState(false);

  // Once the instance loads, land on the first incomplete item.
  const landedRef = useRef(false);
  useEffect(() => {
    if (!run.instance || landedRef.current) return;
    landedRef.current = true;
    setCurrentIndex(firstIncompleteIndex(orderedItems, completions));
    // orderedItems/completions intentionally read once at landing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.instance]);

  useEffect(
    () => () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    },
    [],
  );

  const progress = runProgress(orderedItems, completions, currentIndex);
  const currentItem = currentIndex >= 0 ? orderedItems[currentIndex] : undefined;
  const currentCompletion = currentItem ? run.completionFor(currentItem.id) : undefined;
  const currentDisposition = itpCompletionDisposition(currentCompletion);
  const awaitingVerification = currentDisposition === 'review';
  const wasRejected = currentDisposition === 'rejected';
  const gate = currentItem
    ? holdPointGateDecision(currentItem, currentCompletion)
    : { kind: 'open' as const };
  const superintendentSignoffOnly = currentItem
    ? isSuperintendentSignoffOnlyItem(currentItem)
    : false;

  // Dot-track entries: each run item + its completion + derived on-track state,
  // straight from the run's EXISTING data (no new fetch / no behavior change).
  const trackEntries: ItpDotTrackItem[] = useMemo(
    () =>
      orderedItems.map((it) => {
        const completion = run.completionFor(it.id);
        return { item: it, completion, state: dotStateFor(it, completion) };
      }),
    [orderedItems, run],
  );

  // Jump to a track index (tap or snap-on-release). Cancels any in-flight reason
  // capture so the landed item starts clean; never mutates completions.
  const jumpTo = (index: number) => {
    if (index < 0 || index >= orderedItems.length) return;
    setScrubFrac(null);
    setReasonMode(null);
    setReason('');
    setReasonError(null);
    setEvidencePrompt(false);
    setCurrentIndex(index);
  };

  // While scrubbing, the header counter + content strip follow the finger.
  const scrubbing = scrubFrac !== null;
  const liveFrac = scrubFrac ?? currentIndex;
  const liveIndex = scrubbing ? snapFrac(scrubFrac, orderedItems.length) : currentIndex;
  const liveCheckNumber =
    orderedItems.length === 0 ? 0 : Math.min(Math.max(liveIndex + 1, 1), orderedItems.length);

  // Whole-screen content drag (v3 refinement #2). Shares the scrubFrac channel with
  // the dot track so both gestures drive one focus model. Commits the landed index
  // (fling-projected) on release; never mutates completions.
  const contentDrag = useItpContentDrag({
    count: orderedItems.length,
    currentIndex,
    onCommit: jumpTo,
    onScrubChange: setScrubFrac,
  });

  const resetReason = () => {
    setReasonMode(null);
    setReason('');
    setReasonError(null);
  };

  const advance = (flashMsg: string) => {
    resetReason();
    const next = advanceToNextIncomplete(orderedItems, completions, currentIndex);
    setFlash(flashMsg);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlash(null), FLASH_MS * 2);
    setCurrentIndex(next);
  };

  // The actual pass write, shared by the direct tap and the "Pass without photo"
  // confirmation. Clears the evidence prompt first so it never lingers.
  const doPass = async () => {
    if (!currentItem) return;
    setEvidencePrompt(false);
    setSubmitting(true);
    const ok = await run.pass(currentItem.id, currentCompletion?.notes ?? null);
    setSubmitting(false);
    if (ok) advance(`Check ${progress.checkNumber} passed — saved`);
  };

  const handlePass = () => {
    if (!currentItem || submitting) return;
    if (awaitingVerification || superintendentSignoffOnly) return;
    if (gate.kind === 'awaiting-release') return; // never complete an un-released hold point
    // Evidence guard: a photo-required check with no photo attached must confirm
    // before passing, exactly like the desktop EvidenceWarningModal — so passing
    // without evidence is an explicit choice, not a silent one.
    const attachedPhotos = currentCompletion?.attachments?.length ?? 0;
    if (currentItem.evidenceRequired === 'photo' && attachedPhotos === 0) {
      setEvidencePrompt(true);
      return;
    }
    void doPass();
  };

  const handleSubmitReason = async () => {
    if (!currentItem || submitting) return;
    if (!reason.trim()) {
      setReasonError(
        reasonMode === 'na' ? 'Add a reason for marking N/A.' : 'Describe what failed.',
      );
      return;
    }
    setSubmitting(true);
    const ok =
      reasonMode === 'na'
        ? await run.markNA(currentItem.id, reason)
        : await run.markFailed(currentItem.id, reason);
    setSubmitting(false);
    if (ok) {
      advance(
        reasonMode === 'na'
          ? `Check ${progress.checkNumber} marked N/A`
          : `Check ${progress.checkNumber} failed — issue raised`,
      );
    } else {
      setReasonError('Could not save — your reason is kept. Try again.');
    }
  };

  const onPhotoSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && currentItem && !superintendentSignoffOnly) {
      // A photo is being attached, so the evidence prompt no longer applies.
      setEvidencePrompt(false);
      void run.addPhoto(currentItem.id, file);
    }
    e.target.value = '';
  };

  return {
    fileInputRef,
    orderedItems,
    currentIndex,
    scrubFrac,
    setScrubFrac,
    flash,
    reasonMode,
    setReasonMode,
    reason,
    setReason,
    reasonError,
    setReasonError,
    submitting,
    evidencePrompt,
    progress,
    currentItem,
    currentCompletion,
    awaitingVerification,
    wasRejected,
    gate,
    superintendentSignoffOnly,
    trackEntries,
    jumpTo,
    scrubbing,
    liveFrac,
    liveCheckNumber,
    contentDrag,
    resetReason,
    doPass,
    handlePass,
    handleSubmitReason,
    onPhotoSelected,
  };
}
