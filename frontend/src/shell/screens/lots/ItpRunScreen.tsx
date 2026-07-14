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
 * guard only blocks 'completed') except superintendent-owned sign-off items,
 * which are status-only for field users even after release.
 */
import { useNavigate } from 'react-router-dom';
import { Camera, Check, AlertTriangle, Lock, ChevronLeft } from 'lucide-react';
import { ShellScreen } from '../../components/ShellScreen';
import { withProjectQuery } from '../../shellPaths';
import { useLotsShellContext } from './lotsShellContext';
import { useShellItpRun } from './useShellItpRun';
import { useShellLotParam } from './useShellLotParam';
import { formatItpFinishedCopy } from './lotsShellState';
import { ItpDotTrack, ItpContentStrip } from './ItpDotTrack';
import { subline, stripStateLine } from '@/shell/itpRun/itpRunPresentation';
import { useItpRunController } from '@/shell/itpRun/useItpRunController';

export function ItpRunScreen() {
  const navigate = useNavigate();
  const { projectId } = useLotsShellContext();
  const lotId = useShellLotParam();
  const run = useShellItpRun(projectId ?? undefined, lotId);

  // Shared run state machine (hold-point Pass guard, NCR-on-fail dispatch, offline
  // completion write, evidence guard) — imported, not forked, by both run screens.
  const {
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
  } = useItpRunController(run);

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
    const finishedCopy = formatItpFinishedCopy(progress);
    const FinishedIcon = finishedCopy.hasFailures ? AlertTriangle : Check;
    return (
      <ShellScreen
        variant="inner"
        title="Inspection"
        parent={`/m/lots/${lotId}`}
        sub={
          <span
            className={`shell-mono text-[12px] font-semibold uppercase tracking-[0.1em] ${
              finishedCopy.hasFailures ? 'text-warning' : 'text-success'
            }`}
          >
            {finishedCopy.eyebrow}
          </span>
        }
        bottom={
          <div className="shell-primary">
            <button
              type="button"
              className="shell-primary-btn"
              onClick={() => navigate(withProjectQuery(`/m/lots/${lotId}`, projectId))}
            >
              Back to lot
            </button>
          </div>
        }
      >
        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-12 text-center">
          <div
            className={finishedCopy.hasFailures ? 'shell-bigtick text-warning' : 'shell-bigtick'}
            aria-hidden
          >
            <FinishedIcon size={54} strokeWidth={2.4} />
          </div>
          <div className="shell-display-title">{finishedCopy.title}</div>
          <div className="shell-mono text-[12.5px] text-muted-foreground">
            {finishedCopy.detail}
          </div>
        </div>
      </ShellScreen>
    );
  }

  // ── Active item ───────────────────────────────────────────────────────────
  const item = currentItem!;
  const photoCount = currentCompletion?.attachments?.length ?? 0;
  const busy = submitting || run.updatingItemId === item.id;
  const holdPointsPath = projectId
    ? `/projects/${encodeURIComponent(projectId)}/hold-points`
    : null;

  const sub = (
    <span className="flex items-center gap-2">
      <span className="shell-mono font-semibold text-foreground">{run.instance.template.name}</span>
      <span
        className="shell-mono text-[12px] font-semibold uppercase tracking-[0.1em] text-warning"
        aria-live="polite"
      >
        {/* Live-updates during a scrub (like the mock), snaps on release. */}
        CHECK {scrubbing ? liveCheckNumber : progress.checkNumber}/{progress.total}
      </span>
    </span>
  );

  // Dot track — pinned at the TOP, inside the sticky header (v3 refinement #1).
  // It mirrors the whole-screen content drag via externalFrac so both gestures
  // share one focus model.
  const headerExtra = (
    <ItpDotTrack
      entries={trackEntries}
      currentIndex={currentIndex}
      onCommit={jumpTo}
      onScrubChange={setScrubFrac}
      externalFrac={scrubFrac}
    />
  );

  // The bottom bar — Pass / Fail / N-A stay here AT ALL TIMES (refinement #5),
  // never hidden during a scrub. When a reason is being captured it replaces the
  // tri-state in place (same bottom position). The completion mutations are
  // untouched; an un-released hold point still never offers Pass.
  const bottom = superintendentSignoffOnly ? undefined : (
    <div className="shell-primary">
      {reasonMode ? (
        // Solid card background — this panel sits in the fixed bottom bar OVER
        // the content, so it must be opaque to be legible.
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
          {/* A failed check must carry photo evidence when online. The photo
              attaches to this item's pending completion first; the fail then
              flips it to 'failed'. Offline stays note-only (no attachment path). */}
          {reasonMode === 'fail' &&
            (navigator.onLine ? (
              <button
                type="button"
                className="mt-2 shell-photobtn min-h-[48px] w-full"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                aria-label="Add a photo of the issue (required)"
              >
                <Camera size={17} aria-hidden />
                {photoCount > 0
                  ? `Photo added (${photoCount})`
                  : 'Add a photo of the issue (required)'}
              </button>
            ) : (
              <p className="mt-2 text-[13px] text-muted-foreground">
                Offline — photo can be added after sync.
              </p>
            ))}
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
        // Owner refinement (final): the EVIDENCE button lives in the fixed
        // bottom bar; the tri-state moved UP into the content zone's bottom
        // cluster — the natural one-handed thumb arc — see triStateCluster.
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

  // Tri-state PASS / FAIL / N-A — pinned at the bottom of the content zone,
  // ABOVE the fixed bar: the natural thumb range for one-handed use (owner
  // refinement). Hold points still never offer Pass.
  const triStateCluster =
    awaitingVerification || superintendentSignoffOnly ? null : gate.kind === 'awaiting-release' ? (
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

  // Evidence guard confirmation — replaces the tri-state while active. Copy
  // mirrors the desktop EvidenceWarningModal; "Add photo" is the primary action,
  // "Pass without photo" the explicit secondary.
  const evidencePromptCluster = (
    <div
      className="rounded-2xl border border-warning/40 bg-warning/10 p-4"
      role="alertdialog"
      aria-label="Photo evidence recommended"
    >
      <div className="flex items-center gap-2 text-[14px] font-semibold text-warning">
        <AlertTriangle size={16} strokeWidth={2.2} aria-hidden />
        This check requires photo evidence
      </div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
        No photo has been attached to this item yet. You can still pass without one, but it is
        recommended to attach a photo for quality assurance.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        <button
          type="button"
          className="shell-photobtn min-h-[52px] w-full"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
        >
          <Camera size={19} aria-hidden />
          Add photo
        </button>
        <button
          type="button"
          className="w-full rounded-xl border border-border py-3 text-[14px] font-semibold disabled:opacity-60"
          disabled={busy}
          onClick={() => void doPass()}
        >
          Pass without photo
        </button>
      </div>
    </div>
  );

  return (
    <ShellScreen
      variant="inner"
      title="Inspection"
      parent={`/m/lots/${lotId}`}
      sub={sub}
      headerExtra={headerExtra}
      bottom={bottom}
    >
      {/* Pass-flash on advance */}
      {flash && (
        <div className="shell-passflash" role="status">
          <Check size={16} strokeWidth={2.4} />
          {flash}
        </div>
      )}

      {/* Whole-screen scrub zone (v3 refinement #2): a horizontal drag ANYWHERE
          here slides along the checklist with a velocity fling on release;
          vertical drags pass through to native scrolling (touch-action: pan-y +
          direction lock). The synced content strip translates live
          (translateX(-frac*100%)); it sits in its own isolated transform context
          so the stagger entry animation never clobbers translateX. Taps under the
          10px threshold still reach the photo button. */}
      <div
        data-testid="itp-content-zone"
        ref={contentDrag.zoneRef}
        className="flex flex-1 flex-col"
        style={{ touchAction: 'pan-y', cursor: 'grab' }}
        {...contentDrag.handlers}
        onClickCapture={(e) => {
          // Suppress the click that trails a committed horizontal scrub so a
          // fling doesn't accidentally trigger the photo button underneath.
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
                {/* State line — a scrub preview and the landed item read the same. */}
                <p
                  className={[
                    'text-[13px] font-semibold',
                    cellState === 'done'
                      ? 'text-success'
                      : cellState === 'failed'
                        ? 'text-destructive'
                        : cellState === 'rejected'
                          ? 'text-destructive'
                          : cellState === 'hold' || cellState === 'review'
                            ? 'text-warning'
                            : 'text-muted-foreground',
                  ].join(' ')}
                >
                  {stripStateLine(cell, cellState)}
                </p>
                {cellState === 'review' && (
                  <p className="text-[12px] text-muted-foreground">
                    Awaiting head-contractor verification.
                  </p>
                )}
                {cellState === 'rejected' && trackEntries[i]?.completion?.verificationNotes && (
                  <p className="text-[12px] text-destructive">
                    Rejected: {trackEntries[i]?.completion?.verificationNotes}
                  </p>
                )}
              </>
            );
          }}
        />

        {/* The landed item's actionable extras, pinned at the BOTTOM of the zone
            (the strip above is flex-1) so the evidence button sits in the thumb
            zone just above Pass/Fail — no dead-space chasm between the question
            at the top and the actions at the bottom. They belong to the LANDED
            item; a scrub preview above doesn't change them until release. */}
        <div className="flex flex-col gap-3 pt-3">
          {awaitingVerification && (
            <div className="rounded-2xl border border-warning/40 bg-warning/10 p-4">
              <div className="flex items-center gap-2 text-[14px] font-semibold text-warning">
                Awaiting head-contractor verification
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                This check has been submitted and is waiting for review.
              </p>
            </div>
          )}
          {wasRejected && (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4">
              <div className="flex items-center gap-2 text-[14px] font-semibold text-destructive">
                Rejected by head contractor
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                {currentCompletion?.verificationNotes || 'Update the check and resubmit it.'}
              </p>
            </div>
          )}
          {superintendentSignoffOnly && (
            <div className="rounded-2xl border border-warning/40 bg-warning/10 p-4">
              <div className="flex items-center gap-2 text-[14px] font-semibold text-warning">
                <Lock size={16} strokeWidth={2.2} aria-hidden />
                Superintendent sign-off required
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                This item is for superintendent sign-off. Field users can view the status here;
                request and release status stays managed from the Hold Points screen.
              </p>
            </div>
          )}
          {!superintendentSignoffOnly && gate.kind === 'awaiting-release' && (
            <div className="rounded-2xl border border-warning/40 bg-warning/10 p-4">
              <div className="flex items-center gap-2 text-[14px] font-semibold text-warning">
                <Lock size={16} strokeWidth={2.2} aria-hidden />
                Awaiting hold point release
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                This is a hold point. It can’t be ticked complete until it’s released (which records
                who released it, when, and how). Open the Hold Points register to request or record
                the release — you can still mark it N/A or raise an issue below.
              </p>
              {holdPointsPath && (
                <button
                  type="button"
                  className="mt-3 w-full rounded-xl border border-warning/40 bg-background px-3 py-3 text-[13px] font-semibold text-warning shadow-sm transition-colors active:bg-warning/10"
                  onClick={() => navigate(holdPointsPath)}
                >
                  Open Hold Points
                </button>
              )}
            </div>
          )}
          {run.isOfflineData && (
            <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <ChevronLeft size={12} className="rotate-90" aria-hidden />
              Showing cached checklist — changes sync when you’re back online.
            </p>
          )}
          {evidencePrompt ? evidencePromptCluster : triStateCluster}
        </div>
      </div>

      {!superintendentSignoffOnly && (
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
