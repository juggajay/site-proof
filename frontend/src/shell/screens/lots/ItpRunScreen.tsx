/**
 * ItpRunScreen — /m/lots/:lotId/itp — the foreman ITP inspection run.
 *
 * Design spec: docs/design-foreman-shell-mock-v4.html #itp / #itpnext.
 * One check per screen: category pill, the item description as the big question,
 * responsible-party + evidence-required subline, an "Add evidence photo" button,
 * a giant tri-state PASS / FAIL / N-A, a "CHECK n/m" header counter, and a
 * pass-flash on advance to the next incomplete item. When every item is resolved
 * the run shows the "All checks complete" finished state.
 *
 * NEW PRESENTATION over EXISTING LOGIC (see useShellItpRun.ts):
 *   - PASS reuses the shared online+offline completion write primitive.
 *   - N/A + FAIL reuse the existing mobile reason-capture (mobileMarkNA /
 *     mobileMarkFailed) — including FAIL's existing server-side NCR link. No new
 *     NCR flow is invented here.
 *   - Evidence photo reuses the entityType 'itp' upload (offline-queued fallback).
 *
 * Hold-point trap (completions.ts:209-228): a hold_point sign-off item cannot be
 * completed until its HoldPoint is released. This screen NEVER offers PASS for an
 * un-released hold point — it shows an honest "Awaiting hold point release" state
 * and points the foreman at the Hold Points screen, where the request-release
 * flow lives today. N/A and FAIL stay available on hold-point items (the backend
 * guard only blocks 'completed').
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Check, AlertTriangle, Lock, ChevronLeft } from 'lucide-react';
import { ShellScreen } from '../../components/ShellScreen';
import { useLotsShellContext } from './lotsShellContext';
import { useShellItpRun } from './useShellItpRun';
import { useShellLotParam } from './useShellLotParam';
import {
  advanceToNextIncomplete,
  firstIncompleteIndex,
  holdPointGateDecision,
  runItemOrder,
  runProgress,
} from './lotsShellState';
import type { ITPChecklistItem } from '@/pages/lots/types';

const RESPONSIBLE_LABEL: Record<string, string> = {
  contractor: 'Contractor',
  subcontractor: 'Subcontractor',
  superintendent: 'Superintendent',
  general: 'General',
};

const EVIDENCE_SUFFIX: Record<string, string> = {
  photo: 'photo evidence can be attached',
  test: 'test cert can be attached',
  document: 'document can be attached',
  none: '',
};

function subline(item: ITPChecklistItem): string {
  const who = RESPONSIBLE_LABEL[item.responsibleParty] ?? 'General';
  const suffix = EVIDENCE_SUFFIX[item.evidenceRequired] ?? '';
  return suffix ? `Responsible: ${who} · ${suffix}` : `Responsible: ${who}`;
}

// Pass-flash auto-advance timing — long enough to register the green flash,
// short enough not to stall a foreman moving fast. Reduced-motion users still
// advance; the flash just doesn't animate (handled by CSS).
const FLASH_MS = 650;

export function ItpRunScreen() {
  const navigate = useNavigate();
  const { projectId } = useLotsShellContext();
  const lotId = useShellLotParam();
  const run = useShellItpRun(projectId ?? undefined, lotId);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ordered run items (checklist's own order, stable).
  const orderedItems = useMemo(
    () => (run.instance ? runItemOrder(run.instance.template.checklistItems) : []),
    [run.instance],
  );
  const completions = run.instance?.completions ?? [];

  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [flash, setFlash] = useState<string | null>(null);
  // Inline reason capture for N/A and FAIL (reuses the existing reason semantics).
  const [reasonMode, setReasonMode] = useState<null | 'na' | 'fail'>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
  const gate = currentItem
    ? holdPointGateDecision(currentItem, currentCompletion)
    : { kind: 'open' as const };

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

  const handlePass = async () => {
    if (!currentItem || submitting) return;
    if (gate.kind === 'awaiting-release') return; // never complete an un-released hold point
    setSubmitting(true);
    const ok = await run.pass(currentItem.id, currentCompletion?.notes ?? null);
    setSubmitting(false);
    if (ok) advance(`Check ${progress.checkNumber} passed — saved`);
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
    if (file && currentItem) void run.addPhoto(currentItem.id, file);
    e.target.value = '';
  };

  // ── Loading / error / empty ──────────────────────────────────────────────
  if (run.loading && !run.instance) {
    return (
      <ShellScreen
        variant="inner"
        title="Inspection"
        parent={`/m/lots/${lotId}`}
        sub={<span>Loading checklist…</span>}
      >
        <div className="h-10 animate-pulse rounded-xl bg-muted" />
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
        <div className="h-[92px] animate-pulse rounded-2xl bg-muted" />
      </ShellScreen>
    );
  }

  if (!run.instance || orderedItems.length === 0) {
    return (
      <ShellScreen
        variant="inner"
        title="Inspection"
        parent={`/m/lots/${lotId}`}
        sub={<span>No checklist</span>}
      >
        <div className="py-16 text-center text-[14px] leading-relaxed text-muted-foreground">
          {run.loadError ?? 'No ITP is assigned to this lot yet.'}
          <br />
          The office assigns the inspection template.
        </div>
      </ShellScreen>
    );
  }

  // ── Finished state ────────────────────────────────────────────────────────
  if (currentIndex < 0 || progress.allDone) {
    return (
      <ShellScreen
        variant="inner"
        title="Inspection"
        parent={`/m/lots/${lotId}`}
        sub={
          <span className="shell-mono text-[12px] font-semibold uppercase tracking-[0.1em] text-success">
            ALL CHECKS DONE
          </span>
        }
        bottom={
          <div className="shell-primary">
            <button
              type="button"
              className="shell-primary-btn"
              onClick={() =>
                navigate(`/m/lots/${lotId}${projectId ? `?projectId=${projectId}` : ''}`)
              }
            >
              Back to lot
            </button>
          </div>
        }
      >
        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-12 text-center">
          <div className="shell-bigtick" aria-hidden>
            <Check size={54} strokeWidth={2.4} />
          </div>
          <div className="shell-display-title">All checks complete</div>
          <div className="shell-mono text-[12.5px] text-muted-foreground">
            {progress.total} OF {progress.total} DONE
          </div>
        </div>
      </ShellScreen>
    );
  }

  // ── Active item ───────────────────────────────────────────────────────────
  const item = currentItem!;
  const categoryLabel = (item.category || 'GENERAL').toUpperCase();
  const photoCount = currentCompletion?.attachments?.length ?? 0;
  const busy = submitting || run.updatingItemId === item.id;

  const sub = (
    <span className="flex items-center gap-2">
      <span className="shell-mono font-semibold text-foreground">{run.instance.template.name}</span>
      <span className="shell-mono text-[12px] font-semibold uppercase tracking-[0.1em] text-warning">
        CHECK {progress.checkNumber}/{progress.total}
      </span>
    </span>
  );

  return (
    <ShellScreen variant="inner" title="Inspection" parent={`/m/lots/${lotId}`} sub={sub}>
      {/* Pass-flash on advance */}
      {flash && (
        <div className="shell-passflash" role="status">
          <Check size={16} strokeWidth={2.4} />
          {flash}
        </div>
      )}

      {/* Category pill */}
      <span className="shell-pill shell-pill-attention self-start">{categoryLabel}</span>

      {/* The big question */}
      <p className="shell-itpq">{item.description}</p>

      {/* Responsible + evidence subline */}
      <p className="text-[13px] text-muted-foreground">{subline(item)}</p>
      {item.acceptanceCriteria && (
        <p className="rounded-xl bg-secondary/60 px-3 py-2 text-[13px] text-muted-foreground">
          <span className="font-semibold text-foreground">Criteria:</span> {item.acceptanceCriteria}
        </p>
      )}

      {/* Evidence photo (reuses the entityType 'itp' upload incl. offline) */}
      <button
        type="button"
        className="shell-photobtn"
        onClick={() => fileInputRef.current?.click()}
        disabled={busy}
        aria-label="Add evidence photo"
      >
        <Camera size={19} aria-hidden />
        {photoCount > 0 ? `Evidence added (${photoCount})` : 'Add evidence photo'}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onPhotoSelected}
      />

      {/* Hold-point awaiting-release state — NO complete affordance */}
      {gate.kind === 'awaiting-release' ? (
        <div className="mt-2 rounded-2xl border border-warning/40 bg-warning/10 p-4">
          <div className="flex items-center gap-2 text-[14px] font-semibold text-warning">
            <Lock size={16} strokeWidth={2.2} aria-hidden />
            Awaiting hold point release
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
            This is a hold point. It can’t be ticked complete until it’s released (which records who
            released it, when, and how). Request the release from the Hold Points screen — you can
            still mark it N/A or raise an issue here.
          </p>
          {/* N/A and FAIL stay available even on a hold point. */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              className="shell-tri-btn shell-tri-na min-h-[64px]"
              disabled={busy}
              onClick={() => {
                setReasonMode('na');
                setReason('');
                setReasonError(null);
              }}
            >
              N/A
            </button>
            <button
              type="button"
              className="shell-tri-btn shell-tri-fail min-h-[64px]"
              disabled={busy}
              onClick={() => {
                setReasonMode('fail');
                setReason('');
                setReasonError(null);
              }}
            >
              <AlertTriangle size={20} aria-hidden />
              Fail
            </button>
          </div>
        </div>
      ) : (
        /* Tri-state PASS / FAIL / N-A */
        <div className="shell-tri">
          <button
            type="button"
            className="shell-tri-pass shell-tri-btn"
            disabled={busy}
            onClick={handlePass}
            aria-label="Pass this check"
          >
            <Check size={22} strokeWidth={2.4} aria-hidden />
            Pass
          </button>
          <button
            type="button"
            className="shell-tri-fail shell-tri-btn"
            disabled={busy}
            onClick={() => {
              setReasonMode('fail');
              setReason('');
              setReasonError(null);
            }}
            aria-label="Fail this check"
          >
            <AlertTriangle size={22} aria-hidden />
            Fail
          </button>
          <button
            type="button"
            className="shell-tri-na shell-tri-btn"
            disabled={busy}
            onClick={() => {
              setReasonMode('na');
              setReason('');
              setReasonError(null);
            }}
            aria-label="Mark not applicable"
          >
            N/A
          </button>
        </div>
      )}

      {/* Inline reason capture (N/A or FAIL) — reuses existing reason semantics */}
      {reasonMode && (
        <div
          className={
            reasonMode === 'fail'
              ? 'rounded-2xl border border-destructive/30 bg-destructive/10 p-3'
              : 'rounded-2xl border border-border bg-secondary/40 p-3'
          }
        >
          <label className="mb-1.5 block text-[13px] font-semibold">
            {reasonMode === 'na' ? 'Reason for N/A' : 'What failed?'}
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              reasonMode === 'na' ? 'Why is this not applicable?' : 'Describe the issue…'
            }
            className="min-h-[80px] w-full rounded-xl border border-border bg-background px-3 py-2 text-[14px]"
            autoFocus
            autoCapitalize="sentences"
          />
          {reasonError && (
            <p role="alert" className="mt-1 text-[13px] text-destructive">
              {reasonError}
            </p>
          )}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-xl border border-border py-3 text-[14px] font-semibold"
              disabled={submitting}
              onClick={resetReason}
            >
              Cancel
            </button>
            <button
              type="button"
              className={
                reasonMode === 'fail'
                  ? 'flex-1 rounded-xl bg-destructive py-3 text-[14px] font-semibold text-destructive-foreground disabled:opacity-60'
                  : 'flex-1 rounded-xl bg-foreground py-3 text-[14px] font-semibold text-background disabled:opacity-60'
              }
              disabled={submitting}
              onClick={handleSubmitReason}
            >
              {submitting ? 'Saving…' : reasonMode === 'na' ? 'Mark N/A' : 'Mark failed'}
            </button>
          </div>
        </div>
      )}

      {/* Offline cache banner */}
      {run.isOfflineData && (
        <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <ChevronLeft size={12} className="rotate-90" aria-hidden />
          Showing cached checklist — changes sync when you’re back online.
        </p>
      )}
    </ShellScreen>
  );
}
