/**
 * The NCR register's "who owes what" strip.
 *
 * A status chip says how far an NCR got. It does not say *when* each step
 * happened, who did it, or — on a closed record — which steps were never
 * recorded at all. Four gates, derived from timestamps the API already returns,
 * put that on the row.
 *
 * The gates are the four transitions the shipped workflow can distinguish
 * (`routes/ncrs/ncrWorkflow.ts`, `ncrVerificationSubmission.ts`,
 * `ncrClosureWorkflow.ts`):
 *
 *   open ──respond──▶ investigating ──QM review──▶ rectification
 *        ──rectify──▶ verification ──close──▶ closed / closed_concession
 *
 * `verifiedAt` is deliberately **not** a gate. The close route writes
 * `verifiedAt` and `closedAt` in the same update with the same value
 * (`ncrClosureWorkflow.ts`), so a "Verified" dot could never disagree with
 * "Closed" — it would be a dot that carries no information.
 *
 * Requesting a revision clears `responseSubmittedAt` and sends the NCR back to
 * `open` while leaving `qmReviewedAt` set, so gates can legitimately fill out
 * of order. Nothing here assumes a monotonic sequence.
 */

import { requiresQmApproval } from './ncrActions';
import type { NCR } from './types';

export const NCR_GATE_KEYS = ['responded', 'reviewed', 'rectified', 'closed'] as const;
export type NcrGateKey = (typeof NCR_GATE_KEYS)[number];

/**
 * `done` — the step has a timestamp.
 * `pending` — the step is still owed by someone.
 * `not_required` — the step has no record and never will, because the NCR is
 *   already closed. Legacy and imported NCRs reach a terminal status with
 *   earlier gates blank; rendering those as `pending` would claim someone still
 *   owes work on a finished record.
 */
export type NcrGateState = 'done' | 'pending' | 'not_required';

export interface NcrGate {
  key: NcrGateKey;
  /** Short column-style label, e.g. "Rectified". */
  label: string;
  state: NcrGateState;
  /** Full sentence for the tooltip and the accessible name. */
  detail: string;
}

const GATE_LABELS: Record<NcrGateKey, string> = {
  responded: 'Responded',
  reviewed: 'Reviewed',
  rectified: 'Rectified',
  closed: 'Closed',
};

const NCR_TERMINAL_STATUSES = ['closed', 'closed_concession'];

export const isNcrTerminal = (ncr: Pick<NCR, 'status'>): boolean =>
  NCR_TERMINAL_STATUSES.includes(ncr.status);

// Plain numeric en-AU, matching the Due column beside it. Month names are
// avoided deliberately: ICU builds disagree on whether en-AU's `month: 'short'`
// is "Jul" or "July", which makes the rendered string untestable.
const formatGateDate = (timestamp: string): string =>
  new Date(timestamp).toLocaleDateString('en-AU');

/**
 * Build one gate. `actor` is passed only where the record actually names who
 * did it — `closedBy` is stored, but nothing records who submitted a response
 * or a rectification (any of the responsible party, a QM or a PM may have),
 * so those tooltips carry the date alone rather than a plausible guess.
 */
function buildGate(
  key: NcrGateKey,
  timestamp: string | null | undefined,
  terminal: boolean,
  options: { actor?: string | null; blockedNote?: string } = {},
): NcrGate {
  const label = GATE_LABELS[key];

  if (timestamp) {
    const by = options.actor ? ` by ${options.actor}` : '';
    return { key, label, state: 'done', detail: `${label}${by} · ${formatGateDate(timestamp)}` };
  }

  if (terminal) {
    return { key, label, state: 'not_required', detail: `${label} · not recorded` };
  }

  return {
    key,
    label,
    state: 'pending',
    detail: options.blockedNote ? `${label} · ${options.blockedNote}` : `${label} · not yet`,
  };
}

/**
 * Derive the four-gate strip for one NCR. Pure — safe to call per row inside a
 * virtualised list.
 */
export function deriveNcrGates(ncr: NCR): NcrGate[] {
  const terminal = isNcrTerminal(ncr);

  // A major NCR that still needs QM approval cannot be closed at all
  // (`getAvailableNcrActions`' `closeBlockedPendingQmApproval`). Saying so on
  // the Closed dot answers "why is this sitting in verification?" from the row.
  const blockedNote =
    requiresQmApproval(ncr) && !ncr.qmApprovedAt ? 'blocked, awaiting QM approval' : undefined;

  return [
    buildGate('responded', ncr.responseSubmittedAt, terminal),
    buildGate('reviewed', ncr.qmReviewedAt, terminal),
    buildGate('rectified', ncr.rectificationSubmittedAt, terminal),
    buildGate('closed', ncr.closedAt, terminal, {
      actor: ncr.closedBy?.fullName || ncr.closedBy?.email,
      blockedNote,
    }),
  ];
}
