/**
 * lotsShellState.ts — Pure state derivation for the Lots shell surface.
 *
 * SINGLE SOURCE OF TRUTH for:
 *   - how lot cards sort (actionable first),
 *   - the status-pill tone for a lot,
 *   - the ITP run item ordering + advance-to-next-incomplete,
 *   - the hold-point gate decision (awaiting release vs completable).
 *
 * Every function here is pure — no React, no fetch, no IndexedDB — so the shell
 * screens stay thin and these decisions are exhaustively unit-tested.
 *
 * Semantic traps frozen here (see PR body):
 *   - Hold-point gating mirrors backend completions.ts:209-228 and the existing
 *     ITPChecklistItemRow gate: a hold_point (or superintendent non-witness) item
 *     can only be completed once the matching HoldPoint is released, which the
 *     completion surfaces via `holdPointRelease.releasedByName`. We NEVER offer
 *     Complete/PASS otherwise.
 *   - Witness points are NOT blocked (witness is not a hard blocker) — they pass
 *     through as completable, matching the backend guard.
 */

import type { ITPChecklistItem, ITPCompletion, ITPInstance } from '@/pages/lots/types';
import type { Lot } from '@/pages/lots/lotsPageTypes';
import { formatStatusLabel } from '@/lib/statusLabels';

// ── Lot card meta ──────────────────────────────────────────────────────────────

/** Pill tone for a lot status: amber = needs attention, red = NCR, green = done. */
export type LotPillTone = 'attention' | 'bad' | 'good' | 'neutral';

const ATTENTION_STATUSES = new Set(['hold_point', 'on_hold', 'awaiting_test']);
const BAD_STATUSES = new Set(['ncr_raised']);
const GOOD_STATUSES = new Set(['conformed', 'claimed', 'completed']);

export function lotStatusTone(status: string): LotPillTone {
  const key = (status || '').toLowerCase();
  if (BAD_STATUSES.has(key)) return 'bad';
  if (ATTENTION_STATUSES.has(key)) return 'attention';
  if (GOOD_STATUSES.has(key)) return 'good';
  return 'neutral';
}

/**
 * Per-lot shell view-model. `checksDue` is the count of foreman worklist items
 * (blocking + due_today) for this lot, supplied from the foreman/today payload —
 * the lot register itself does not carry completion progress, so a missing count
 * is treated as 0 and simply shows no "due" chip rather than fake data.
 */
export interface LotShellMeta {
  id: string;
  lotNumber: string;
  description: string;
  status: string;
  statusLabel: string;
  tone: LotPillTone;
  itpCount: number;
  ncrCount: number;
  holdPointCount: number;
  checksDue: number;
  /** A lot is actionable when it has checks due or is sitting on a hold point. */
  isActionable: boolean;
}

export function deriveLotShellMeta(lot: Lot, checksDue: number): LotShellMeta {
  const status = lot.status ?? '';
  const tone = lotStatusTone(status);
  const holdPointCount = lot.holdPointCount ?? 0;
  const isActionable = checksDue > 0 || tone === 'attention' || tone === 'bad';

  return {
    id: lot.id,
    lotNumber: lot.lotNumber,
    description: lot.description ?? '',
    status,
    statusLabel: formatStatusLabel(status),
    tone,
    itpCount: lot.itpCount ?? 0,
    ncrCount: lot.ncrCount ?? 0,
    holdPointCount,
    checksDue,
    isActionable,
  };
}

/**
 * Sort lots actionable-first for the shell list: most checks due first, then
 * attention/bad-tone lots, then everything else by lot number (stable, natural).
 * Pure + total-order (returns a new array; does not mutate input).
 */
export function sortLotsForShell(metas: LotShellMeta[]): LotShellMeta[] {
  const toneRank: Record<LotPillTone, number> = { bad: 0, attention: 1, neutral: 2, good: 3 };

  return [...metas].sort((a, b) => {
    // 1. More checks due ranks first.
    if (a.checksDue !== b.checksDue) return b.checksDue - a.checksDue;
    // 2. Attention/NCR tone ranks before benign/done.
    if (toneRank[a.tone] !== toneRank[b.tone]) return toneRank[a.tone] - toneRank[b.tone];
    // 3. Stable tiebreak: natural lot-number order.
    return a.lotNumber.localeCompare(b.lotNumber, undefined, { numeric: true });
  });
}

// ── ITP run item ordering + advance ─────────────────────────────────────────────

export type ItpItemDisposition = 'pending' | 'completed' | 'na' | 'failed';

export function itpCompletionDisposition(
  completion: ITPCompletion | undefined,
): ItpItemDisposition {
  if (!completion) return 'pending';
  if (completion.isCompleted) return 'completed';
  if (completion.isNotApplicable) return 'na';
  if (completion.isFailed) return 'failed';
  return 'pending';
}

/** An item is "resolved" (no longer in the run) once it is completed, N/A, or failed. */
export function isItpItemResolved(completion: ITPCompletion | undefined): boolean {
  return itpCompletionDisposition(completion) !== 'pending';
}

/**
 * The run's item order: the checklist's own `order`, with a stable index tiebreak
 * so equal/absent orders keep their original sequence. Returns a new array.
 */
export function runItemOrder(items: ITPChecklistItem[]): ITPChecklistItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const ao = a.item.order ?? a.index;
      const bo = b.item.order ?? b.index;
      if (ao !== bo) return ao - bo;
      return a.index - b.index;
    })
    .map((entry) => entry.item);
}

function completionFor(completions: ITPCompletion[], itemId: string): ITPCompletion | undefined {
  return completions.find((c) => c.checklistItemId === itemId);
}

/**
 * Index (into `orderedItems`) of the first item that is still pending, or -1 when
 * every item is resolved. The run opens here and advances from here.
 */
export function firstIncompleteIndex(
  orderedItems: ITPChecklistItem[],
  completions: ITPCompletion[],
): number {
  return orderedItems.findIndex((item) => !isItpItemResolved(completionFor(completions, item.id)));
}

/**
 * Given the index just acted on, find the next still-pending item index, wrapping
 * to earlier pending items if the tail is done. Returns -1 when the run is fully
 * resolved (caller shows the "All checks complete" finished state).
 */
export function advanceToNextIncomplete(
  orderedItems: ITPChecklistItem[],
  completions: ITPCompletion[],
  currentIndex: number,
): number {
  const n = orderedItems.length;
  if (n === 0) return -1;

  // Look forward first (current+1 .. end), then wrap (0 .. current) so a foreman
  // who jumped back to fix an item is still carried to whatever remains.
  for (let step = 1; step <= n; step += 1) {
    const idx = (currentIndex + step) % n;
    if (!isItpItemResolved(completionFor(completions, orderedItems[idx].id))) return idx;
  }
  return -1;
}

export interface RunProgress {
  /** Resolved items (completed + na + failed). */
  resolved: number;
  total: number;
  /** 1-based human counter for "CHECK n/m" — clamped to [1, total]. */
  checkNumber: number;
  allDone: boolean;
}

export function runProgress(
  orderedItems: ITPChecklistItem[],
  completions: ITPCompletion[],
  currentIndex: number,
): RunProgress {
  const total = orderedItems.length;
  const resolved = orderedItems.reduce(
    (acc, item) => acc + (isItpItemResolved(completionFor(completions, item.id)) ? 1 : 0),
    0,
  );
  const allDone = total > 0 && resolved === total;
  // "CHECK n/m": the human position of the item on screen (1-based), clamped.
  const checkNumber = total === 0 ? 0 : Math.min(Math.max(currentIndex + 1, 1), total);
  return { resolved, total, checkNumber, allDone };
}

// ── Hold-point gate ──────────────────────────────────────────────────────────────

export type HoldPointGate =
  | { kind: 'open' } // not a hold-point sign-off item — normal tri-state
  | { kind: 'released' } // hold-point that has been released — completable
  | { kind: 'awaiting-release' }; // hold-point not yet released — NEVER offer complete

/**
 * Decide the hold-point gate for an item, mirroring the backend guard
 * (completions.ts:209-228) and the existing ITPChecklistItemRow logic:
 *   - hold_point items (and superintendent non-witness items) are sign-off items;
 *   - they are completable only once the HoldPoint is released, which the
 *     completion surfaces as `holdPointRelease.releasedByName`;
 *   - witness items are NOT gated (witness is not a hard blocker);
 *   - everything else is "open".
 *
 * The offline round-trip only preserves `isHoldPoint` (pointType collapses to
 * `hold_point`/`standard`), so an offline-cached hold-point item is still gated
 * here exactly as online — the gate keys off pointType which the cache mapper
 * derives from `isHoldPoint`.
 */
export function holdPointGateDecision(
  item: Pick<ITPChecklistItem, 'pointType' | 'responsibleParty'>,
  completion: ITPCompletion | undefined,
): HoldPointGate {
  const isSignoffItem =
    item.pointType === 'hold_point' ||
    (item.responsibleParty === 'superintendent' && item.pointType !== 'witness');

  if (!isSignoffItem) return { kind: 'open' };

  const released = !!completion?.holdPointRelease?.releasedByName;
  return released ? { kind: 'released' } : { kind: 'awaiting-release' };
}

/** Convenience: may the foreman mark this item PASS/complete right now? */
export function canCompleteItem(
  item: Pick<ITPChecklistItem, 'pointType' | 'responsibleParty'>,
  completion: ITPCompletion | undefined,
): boolean {
  return holdPointGateDecision(item, completion).kind !== 'awaiting-release';
}

// ── Lot-hub + details derivations ────────────────────────────────────────────────

export interface ItpHubSummary {
  total: number;
  resolved: number;
  due: number;
}

/**
 * Inspections-tile summary from a loaded ITP instance + the lot's checks-due
 * count. `resolved` counts completed/na/failed; `due` is the foreman worklist
 * count for the lot (not derived from the instance, which has no due dates here).
 */
export function itpHubSummary(instance: ITPInstance | null, checksDue: number): ItpHubSummary {
  if (!instance) return { total: 0, resolved: 0, due: Math.max(checksDue, 0) };
  const total = instance.template.checklistItems.length;
  const resolved = instance.template.checklistItems.reduce(
    (acc, item) => acc + (isItpItemResolved(completionFor(instance.completions, item.id)) ? 1 : 0),
    0,
  );
  return { total, resolved, due: Math.max(checksDue, 0) };
}

export interface LotReadinessLine {
  /** Honest "what's left" derived from ITP counts + open NCRs — NOT the gated
   * commercial readiness endpoint (foreman can't fetch it). */
  conformable: boolean;
  remainingItp: number;
  openNcrs: number;
  summary: string;
}

/**
 * Derive a read-only "what's left before conformance" line WITHOUT calling the
 * commercial readiness endpoint (which is role-gated away from the foreman, per
 * doc 14). Uses only data the foreman can already see: ITP resolution + open NCR
 * count. Conformance itself stays the office's call.
 */
export function deriveLotReadinessLine(summary: ItpHubSummary, openNcrs: number): LotReadinessLine {
  const remainingItp = Math.max(summary.total - summary.resolved, 0);
  const conformable = summary.total > 0 && remainingItp === 0 && openNcrs === 0;

  let line: string;
  if (summary.total === 0) {
    line = 'No ITP assigned yet.';
  } else if (conformable) {
    line = 'All checks done, no open issues — ready for the office to review.';
  } else {
    const parts: string[] = [];
    if (remainingItp > 0) {
      parts.push(`${remainingItp} check${remainingItp === 1 ? '' : 's'} left`);
    }
    if (openNcrs > 0) {
      parts.push(`${openNcrs} open issue${openNcrs === 1 ? '' : 's'}`);
    }
    line = `${parts.join(' · ')} before this lot can be conformed.`;
  }

  return { conformable, remainingItp, openNcrs, summary: line };
}
