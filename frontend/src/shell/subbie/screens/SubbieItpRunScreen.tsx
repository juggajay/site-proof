/**
 * SubbieItpRunScreen — /p/lots/:lotId/itp — the subbie ITP inspection run.
 *
 * The centerpiece of the subbie shell rebuild. It mirrors the owner-approved
 * foreman run (ItpRunScreen) layout law VERBATIM and IMPORTS — never forks — the
 * foreman scrubber trio: the dot-track at the top, halo focus, whole-screen
 * content drag, tri-state at the bottom of the content zone, evidence button in
 * the fixed bottom bar, reason capture in the fixed bar, and the hold-point rule
 * (never offer Pass while unreleased).
 *
 * It differs from the foreman run ONLY where the subbie surface differs, and in
 * every such place CLASSIC (SubcontractorLotITPPage) WINS:
 *   - Data + actions come from useSubbieItpRun, which wires the SHARED
 *     `useItpCompletionActions` hook and the `subcontractorView=true` reads, just
 *     like the classic page.
 *   - canCompleteITP === false → READ-ONLY: the scrubber + item states stay
 *     browsable, the tri-state cluster is hidden, a persistent quiet banner shows
 *     the classic "view only — contact your PM/HC" wording, and there is no
 *     evidence-photo button.
 *   - Hold-point items follow the SAME rule as foreman (never Pass while
 *     unreleased) via the shared holdPointGateDecision; the subbie instance
 *     payload marks hold points with the same pointType + holdPointRelease shape,
 *     so no divergence.
 *   - Pending-verification state is whatever the shared completion exposes
 *     (`isVerified`); we surface it quietly, never invent a state.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Camera, Check, AlertTriangle, Lock, Eye } from 'lucide-react';
import { ShellScreen } from '@/shell/components/ShellScreen';
import {
  advanceToNextIncomplete,
  firstIncompleteIndex,
  holdPointGateDecision,
  runItemOrder,
  runProgress,
} from '@/shell/screens/lots/lotsShellState';
import {
  ItpDotTrack,
  ItpContentStrip,
  type ItpDotTrackItem,
} from '@/shell/screens/lots/ItpDotTrack';
import { dotStateFor, snapFrac } from '@/shell/screens/lots/itpTrackPhysics';
import { useItpContentDrag } from '@/shell/screens/lots/useItpContentDrag';
import type { ITPChecklistItem } from '@/pages/lots/types';
import { buildPortalCompanyQuery } from '@/pages/subcontractor-portal/portalCompanyScope';
import { useSubbieShellContext } from '../subbieShellContext';
import { useSubbieItpRun } from './useSubbieItpRun';

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

const STRIP_STATE_LINE: Record<string, string> = {
  done: '✓ Passed — saved',
  failed: '✕ Failed — needs attention',
  na: 'N/A — reason recorded',
  hold: 'Awaiting hold point release',
  open: 'Not started',
};

const FLASH_MS = 650;

export function SubbieItpRunScreen() {
  const navigate = useNavigate();
  const { lotId } = useParams<{ lotId: string }>();
  const { projectId, subcontractorCompanyId } = useSubbieShellContext();
  const run = useSubbieItpRun(lotId, { projectId, subcontractorCompanyId });
  const projectQuery = buildPortalCompanyQuery({ projectId, subcontractorCompanyId });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const orderedItems = useMemo(
    () => (run.instance ? runItemOrder(run.instance.template.checklistItems) : []),
    [run.instance],
  );
  const completions = run.instance?.completions ?? [];

  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [scrubFrac, setScrubFrac] = useState<number | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [reasonMode, setReasonMode] = useState<null | 'na' | 'fail'>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Land on the first incomplete item once the instance loads.
  const landedRef = useRef(false);
  useEffect(() => {
    if (!run.instance || landedRef.current) return;
    landedRef.current = true;
    setCurrentIndex(firstIncompleteIndex(orderedItems, completions));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.instance]);

  useEffect(
    () => () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    },
    [],
  );

  const lotHref = `/p/itps${projectQuery}`;

  const progress = runProgress(orderedItems, completions, currentIndex);
  const currentItem = currentIndex >= 0 ? orderedItems[currentIndex] : undefined;
  const currentCompletion = currentItem ? run.completionFor(currentItem.id) : undefined;
  const gate = currentItem
    ? holdPointGateDecision(currentItem, currentCompletion)
    : { kind: 'open' as const };

  const trackEntries: ItpDotTrackItem[] = useMemo(
    () =>
      orderedItems.map((it) => {
        const completion = run.completionFor(it.id);
        return { item: it, completion, state: dotStateFor(it, completion) };
      }),
    [orderedItems, run],
  );

  const jumpTo = (index: number) => {
    if (index < 0 || index >= orderedItems.length) return;
    setScrubFrac(null);
    setReasonMode(null);
    setReason('');
    setReasonError(null);
    setCurrentIndex(index);
  };

  const scrubbing = scrubFrac !== null;
  const liveFrac = scrubFrac ?? currentIndex;
  const liveIndex = scrubbing ? snapFrac(scrubFrac, orderedItems.length) : currentIndex;
  const liveCheckNumber =
    orderedItems.length === 0 ? 0 : Math.min(Math.max(liveIndex + 1, 1), orderedItems.length);

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

  const readOnly = !run.canComplete;

  // ── Loading / error / empty ──────────────────────────────────────────────
  if (run.loading && !run.instance) {
    return (
      <ShellScreen
        variant="inner"
        title="Inspection"
        parent={lotHref}
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
        parent={lotHref}
        sub={<span>No checklist</span>}
      >
        <div className="py-16 text-center text-[14px] leading-relaxed text-muted-foreground">
          {run.loadError ?? 'No ITP is assigned to this lot yet.'}
          <br />
          The head contractor assigns the inspection template.
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
        parent={lotHref}
        sub={
          <span className="shell-mono text-[12px] font-semibold uppercase tracking-[0.1em] text-success">
            ALL CHECKS DONE
          </span>
        }
        bottom={
          <div className="shell-primary">
            <button type="button" className="shell-primary-btn" onClick={() => navigate(lotHref)}>
              Back to inspections
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
  const photoCount = currentCompletion?.attachments?.length ?? 0;
  const busy = submitting || run.updatingItemId === item.id;

  const sub = (
    <span className="flex items-center gap-2">
      <span className="shell-mono font-semibold text-foreground">{run.instance.template.name}</span>
      <span
        className="shell-mono text-[12px] font-semibold uppercase tracking-[0.1em] text-warning"
        aria-live="polite"
      >
        CHECK {scrubbing ? liveCheckNumber : progress.checkNumber}/{progress.total}
      </span>
    </span>
  );

  const headerExtra = (
    <ItpDotTrack
      entries={trackEntries}
      currentIndex={currentIndex}
      onCommit={jumpTo}
      onScrubChange={setScrubFrac}
      externalFrac={scrubFrac}
    />
  );

  // Fixed bottom bar. Read-only subbies get NO evidence button (classic: photos
  // require completion access). When a reason is being captured it replaces the
  // evidence button in place.
  const bottom = readOnly ? undefined : (
    <div className="shell-primary">
      {reasonMode ? (
        <div
          className={
            reasonMode === 'fail'
              ? 'rounded-2xl border border-destructive/40 bg-card p-3 shadow-lg'
              : 'rounded-2xl border border-border bg-card p-3 shadow-lg'
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
      ) : (
        <button
          type="button"
          className="shell-photobtn min-h-[58px] w-full"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          aria-label="Add evidence photo"
        >
          <Camera size={19} aria-hidden />
          {photoCount > 0 ? `Evidence added (${photoCount})` : 'Add evidence photo'}
        </button>
      )}
    </div>
  );

  // Tri-state cluster — hidden entirely for read-only subbies. Hold points still
  // never offer Pass.
  const triStateCluster = readOnly ? null : gate.kind === 'awaiting-release' ? (
    <div className="grid grid-cols-2 gap-3">
      <button
        type="button"
        className="shell-tri-btn shell-tri-na min-h-[58px]"
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
      <button
        type="button"
        className="shell-tri-btn shell-tri-fail min-h-[58px]"
        disabled={busy}
        onClick={() => {
          setReasonMode('fail');
          setReason('');
          setReasonError(null);
        }}
        aria-label="Fail this check"
      >
        <AlertTriangle size={20} aria-hidden />
        Fail
      </button>
    </div>
  ) : (
    <div className="grid grid-cols-3 gap-3">
      <button
        type="button"
        className="shell-tri-pass shell-tri-btn min-h-[58px]"
        disabled={busy}
        onClick={handlePass}
        aria-label="Pass this check"
      >
        <Check size={22} strokeWidth={2.4} aria-hidden />
        Pass
      </button>
      <button
        type="button"
        className="shell-tri-fail shell-tri-btn min-h-[58px]"
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
        className="shell-tri-na shell-tri-btn min-h-[58px]"
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
  );

  return (
    <ShellScreen
      variant="inner"
      title="Inspection"
      parent={lotHref}
      sub={sub}
      headerExtra={headerExtra}
      bottom={bottom}
    >
      {flash && (
        <div className="shell-passflash" role="status">
          <Check size={16} strokeWidth={2.4} />
          {flash}
        </div>
      )}

      <div
        data-testid="itp-content-zone"
        className="flex flex-1 flex-col"
        style={{ touchAction: 'pan-y', cursor: 'grab' }}
        {...contentDrag.handlers}
        onClickCapture={(e) => {
          if (contentDrag.engaged) {
            e.stopPropagation();
            e.preventDefault();
          }
        }}
      >
        <ItpContentStrip
          count={orderedItems.length}
          frac={liveFrac}
          scrubbing={scrubbing}
          renderCell={(i) => {
            const cell = orderedItems[i];
            const cellState = trackEntries[i]?.state ?? 'open';
            const cellCompletion = run.completionFor(cell.id);
            return (
              <>
                <span className="shell-pill shell-pill-attention self-start">
                  {(cell.category || 'GENERAL').toUpperCase()}
                </span>
                <p className="shell-itpq">{cell.description}</p>
                <p className="text-[13px] text-muted-foreground">{subline(cell)}</p>
                {cell.acceptanceCriteria && (
                  <p className="rounded-xl bg-secondary/60 px-3 py-2 text-[13px] text-muted-foreground">
                    <span className="font-semibold text-foreground">Criteria:</span>{' '}
                    {cell.acceptanceCriteria}
                  </p>
                )}
                <p
                  className={[
                    'text-[13px] font-semibold',
                    cellState === 'done'
                      ? 'text-success'
                      : cellState === 'failed'
                        ? 'text-destructive'
                        : cellState === 'hold'
                          ? 'text-warning'
                          : 'text-muted-foreground',
                  ].join(' ')}
                >
                  {STRIP_STATE_LINE[cellState]}
                </p>
                {/* Pending-verification — surfaced from the shared completion, not
                    invented. A resolved-but-unverified completion shows the quiet
                    "awaiting HC verification" line the classic surface exposes. */}
                {cellState === 'done' && cellCompletion && !cellCompletion.isVerified && (
                  <p className="text-[12px] text-muted-foreground">
                    Awaiting head-contractor verification.
                  </p>
                )}
              </>
            );
          }}
        />

        <div className="flex flex-col gap-3 pt-3">
          {/* Persistent read-only banner — classic wording. */}
          {readOnly && (
            <div className="flex items-start gap-2 rounded-2xl border border-warning/30 bg-warning/10 p-4">
              <Eye
                size={16}
                strokeWidth={2.2}
                className="mt-px shrink-0 text-warning"
                aria-hidden
              />
              <p className="text-[13px] leading-relaxed text-warning-foreground">
                View only — contact your PM for completion access.
              </p>
            </div>
          )}
          {!readOnly && gate.kind === 'awaiting-release' && (
            <div className="rounded-2xl border border-warning/40 bg-warning/10 p-4">
              <div className="flex items-center gap-2 text-[14px] font-semibold text-warning">
                <Lock size={16} strokeWidth={2.2} aria-hidden />
                Awaiting hold point release
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                This is a hold point. It can’t be ticked complete until the head contractor releases
                it. You can still mark it N/A or raise an issue below.
              </p>
            </div>
          )}
          {triStateCluster}
        </div>
      </div>

      {!readOnly && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onPhotoSelected}
        />
      )}
    </ShellScreen>
  );
}
