// Pure decision/builder helpers for the POST /api/itp/completions handler.
//
// These are extracted verbatim from the route so the branchy "what status, does
// this need verification, what NCR/notifications get built" logic can be unit
// tested without a database, mirroring the sibling pure-helper modules
// (completionValidation.ts, completionResponses.ts, instances/ncrLinks.ts).
//
// Every function here is side-effect free: the express handler still owns all
// Prisma reads/writes, the transaction, and the response. Inputs are structural
// (plain shapes) rather than Prisma row types so the helpers stay DB-free.
import { AppError } from '../../lib/AppError.js';

/**
 * Resolve the completion status from the request, applying the two
 * required-reason validations first.
 *
 * - `not_applicable` requires a non-blank `notes` reason.
 * - `failed` requires a non-blank `ncrDescription`.
 *
 * The explicit `status` (directStatus) takes precedence; otherwise the boolean
 * `isCompleted` flag maps to `completed` / `pending`.
 */
export function deriveItpCompletionStatus(input: {
  directStatus?: string;
  isCompleted?: boolean;
  notes?: string | null;
  ncrDescription?: string;
}): string {
  const { directStatus, isCompleted, notes, ncrDescription } = input;

  // Validate N/A status requires a reason
  if (directStatus === 'not_applicable' && !notes?.trim()) {
    throw AppError.badRequest('A reason is required when marking an item as N/A');
  }

  // Validate failed status requires NCR description
  if (directStatus === 'failed' && !ncrDescription?.trim()) {
    throw AppError.badRequest('NCR description is required when marking an item as Failed');
  }

  // Determine status - direct status takes precedence, then isCompleted flag
  let newStatus: string;
  if (directStatus) {
    newStatus = directStatus;
  } else {
    newStatus = isCompleted ? 'completed' : 'pending';
  }

  return newStatus;
}

/** A completion is "finished" (stamps completedAt/By) for completed/N-A/failed. */
export function isItpCompletionFinished(status: string): boolean {
  return status === 'completed' || status === 'not_applicable' || status === 'failed';
}

/**
 * Enforce that a witness point cannot be FINISHED as `completed` without a
 * recorded witness decision. Mirrors the WitnessPointModal contract: the
 * completer must state whether the client witness was present; when present a
 * witness name is required; "notification given, witness not present"
 * (witnessPresent === false) is a valid completion. The decision may come from
 * this request or already be persisted on the existing completion (so editing
 * notes on an already-witnessed item is not blocked). Only fires for
 * newStatus === 'completed' on a witness item; N/A, failed, and pending saves
 * are unaffected.
 */
export function assertWitnessDecisionForCompletion(input: {
  isWitnessItem: boolean;
  newStatus: string;
  requestWitnessPresent?: boolean;
  requestWitnessName?: string | null;
  existingWitnessPresent?: boolean | null;
  existingWitnessName?: string | null;
}): void {
  if (!input.isWitnessItem || input.newStatus !== 'completed') {
    return;
  }

  const effectiveWitnessPresent =
    input.requestWitnessPresent !== undefined
      ? input.requestWitnessPresent
      : (input.existingWitnessPresent ?? null);

  if (effectiveWitnessPresent === null || effectiveWitnessPresent === undefined) {
    throw AppError.badRequest(
      'This is a witness point. Record whether the client witness was present (or that ' +
        'notification was given) before completing it.',
      { code: 'WITNESS_DECISION_REQUIRED' },
    );
  }

  if (effectiveWitnessPresent === true) {
    const effectiveWitnessName =
      input.requestWitnessName !== undefined
        ? input.requestWitnessName
        : (input.existingWitnessName ?? null);
    if (!effectiveWitnessName || !effectiveWitnessName.trim()) {
      throw AppError.badRequest('Witness name is required when the witness was present.', {
        code: 'WITNESS_NAME_REQUIRED',
      });
    }
  }
}

/**
 * Read the project-level `requireSubcontractorVerification` flag from the
 * project's `settings` column. Settings may be a JSON string or an already
 * parsed object; invalid JSON falls back to the default (no verification).
 */
export function parseProjectRequiresSubcontractorVerification(projectSettings: unknown): boolean {
  let projectRequiresVerification = false; // Default: no verification needed
  if (projectSettings) {
    try {
      const settings =
        typeof projectSettings === 'string' ? JSON.parse(projectSettings) : projectSettings;
      projectRequiresVerification = settings.requireSubcontractorVerification === true;
    } catch (_e) {
      // Invalid JSON, use default (no verification)
    }
  }
  return projectRequiresVerification;
}

/**
 * Resolve the verification status for a subcontractor completion.
 *
 * - If the project does not require verification, auto-verify.
 * - If the project requires verification, the lot assignment's
 *   `itpRequiresVerification` decides between pending_verification and verified.
 */
export function resolveSubcontractorVerificationStatus(input: {
  projectRequiresVerification: boolean;
  itpRequiresVerification: boolean;
}): 'verified' | 'pending_verification' {
  // Set verification status: project setting controls default, lot assignment can override
  // If project doesn't require verification, auto-verify
  // If project requires verification, use lot assignment setting
  if (!input.projectRequiresVerification) {
    return 'verified';
  }
  return input.itpRequiresVerification ? 'pending_verification' : 'verified';
}

/**
 * Build the witness data patch applied to the completion write. Only fields that
 * were supplied in the request are included; empty strings coerce to null.
 */
export function buildItpCompletionWitnessData(input: {
  witnessPresent?: boolean;
  witnessName?: string | null;
  witnessCompany?: string | null;
}): Record<string, unknown> {
  const { witnessPresent, witnessName, witnessCompany } = input;
  const witnessData: Record<string, unknown> = {};
  if (witnessPresent !== undefined) {
    witnessData.witnessPresent = witnessPresent;
  }
  if (witnessName !== undefined) {
    witnessData.witnessName = witnessName || null;
  }
  if (witnessCompany !== undefined) {
    witnessData.witnessCompany = witnessCompany || null;
  }
  return witnessData;
}

/**
 * An NCR should be created for a `failed` ITP item only when the item does not
 * already have one linked. Keying on NCR existence (rather than the previous
 * completion status) makes the create idempotent AND self-healing: a first
 * failure creates the NCR, a retry after a successful create skips it, and a
 * `failed` row that was orphaned without an NCR (e.g. a mid-request crash) gets
 * its NCR created on the next touch.
 */
export function shouldCreateFailedItpNcr(newStatus: string, hasExistingItemNcr: boolean): boolean {
  return newStatus === 'failed' && !hasExistingItemNcr;
}

export interface ExpectedPreviousItpCompletion {
  exists: boolean;
  id?: string | null;
  status?: string | null;
  notes?: string | null;
  completedAt?: string | null;
}

export interface ItpCompletionForExpectedPrevious {
  id: string;
  status: string;
  notes?: string | null;
  completedAt?: Date | string | null;
}

function normalizeNullableDate(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

function throwStaleItpCompletionConflict(
  currentCompletion: ItpCompletionForExpectedPrevious | null | undefined,
): never {
  throw AppError.conflict('ITP completion changed while this offline update was queued', {
    currentCompletionId: currentCompletion?.id ?? null,
    currentStatus: currentCompletion?.status ?? null,
  });
}

function hasExpectedBaseField(
  expectedPreviousCompletion: ExpectedPreviousItpCompletion,
  field: keyof ExpectedPreviousItpCompletion,
): boolean {
  return Object.prototype.hasOwnProperty.call(expectedPreviousCompletion, field);
}

/**
 * Offline ITP sync uses optimistic concurrency: the queued request includes
 * the completion row the user saw before going offline. If the server row no
 * longer matches that base, replaying the queued write would overwrite newer
 * field work, so the route rejects with 409 and the client reconciles from the
 * current instance snapshot.
 */
export function assertExpectedPreviousItpCompletion(
  currentCompletion: ItpCompletionForExpectedPrevious | null | undefined,
  expectedPreviousCompletion?: ExpectedPreviousItpCompletion,
): void {
  if (!expectedPreviousCompletion) {
    return;
  }

  if (!expectedPreviousCompletion.exists) {
    if (currentCompletion) {
      throwStaleItpCompletionConflict(currentCompletion);
    }
    return;
  }

  if (!currentCompletion) {
    throwStaleItpCompletionConflict(currentCompletion);
  }

  if (expectedPreviousCompletion.id && currentCompletion.id !== expectedPreviousCompletion.id) {
    throwStaleItpCompletionConflict(currentCompletion);
  }

  if (
    expectedPreviousCompletion.status &&
    currentCompletion.status !== expectedPreviousCompletion.status
  ) {
    throwStaleItpCompletionConflict(currentCompletion);
  }

  if (
    hasExpectedBaseField(expectedPreviousCompletion, 'notes') &&
    (expectedPreviousCompletion.notes ?? null) !== (currentCompletion.notes ?? null)
  ) {
    throwStaleItpCompletionConflict(currentCompletion);
  }

  if (
    hasExpectedBaseField(expectedPreviousCompletion, 'completedAt') &&
    normalizeNullableDate(expectedPreviousCompletion.completedAt) !==
      normalizeNullableDate(currentCompletion.completedAt)
  ) {
    throwStaleItpCompletionConflict(currentCompletion);
  }
}

/** A project manager / superintendent recipient of the subbie completion notice. */
export interface ItpSubbieNotificationRecipient {
  userId: string;
}

export interface ItpSubbieNotificationContext {
  projectId: string;
  lotId: string;
  lotNumber: string;
  checklistItemId: string;
  itemDescription: string;
  subbieName: string;
  outcomeLabel?: string;
}

export interface ItpSubbieNotificationRow {
  userId: string;
  projectId: string;
  type: string;
  title: string;
  message: string;
  linkUrl: string;
}

export interface ItpSubbieNotificationSummary {
  notificationsSent: number;
  subcontractorCompany: string;
  lotNumber: string;
  itemDescription: string;
}

/**
 * Build the `notification.createMany` rows and the response summary for a
 * subcontractor completion that requires head-contractor verification.
 *
 * Returns `null` when there are no recipients, matching the route's behaviour of
 * leaving `subbieCompletionNotification` null and skipping the createMany.
 */
export function buildItpSubbieCompletionNotifications(
  recipients: ItpSubbieNotificationRecipient[],
  ctx: ItpSubbieNotificationContext,
): { rows: ItpSubbieNotificationRow[]; summary: ItpSubbieNotificationSummary } | null {
  if (recipients.length === 0) {
    return null;
  }

  const outcomeLabel = ctx.outcomeLabel ?? 'completed';
  const title =
    outcomeLabel === 'completed'
      ? 'Subcontractor ITP Item Completed'
      : 'Subcontractor ITP Item Submitted for Review';
  const rows = recipients.map((pm) => ({
    userId: pm.userId,
    projectId: ctx.projectId,
    type: 'itp_subbie_completion',
    title,
    message: `${ctx.subbieName} has marked ITP item "${ctx.itemDescription}" as ${outcomeLabel} on lot ${ctx.lotNumber}. Verification required.`,
    linkUrl: `/projects/${ctx.projectId}/lots/${ctx.lotId}?tab=itp&highlight=${ctx.checklistItemId}`,
  }));

  const summary: ItpSubbieNotificationSummary = {
    notificationsSent: recipients.length,
    subcontractorCompany: ctx.subbieName,
    lotNumber: ctx.lotNumber,
    itemDescription: ctx.itemDescription,
  };

  return { rows, summary };
}

/**
 * M15: derive the verification-state booleans surfaced on every ITP completion
 * the frontend renders. `rejected` is the field worker's signal that the
 * head-contractor sent the item back; it sits alongside the existing
 * verified / pending_verification flags. Anything else ("none"/null/undefined)
 * means the item is not in a verification workflow.
 */
export function deriveItpVerificationFlags(verificationStatus: string | null | undefined): {
  isVerified: boolean;
  isPendingVerification: boolean;
  isRejected: boolean;
} {
  return {
    isVerified: verificationStatus === 'verified',
    isPendingVerification: verificationStatus === 'pending_verification',
    isRejected: verificationStatus === 'rejected',
  };
}

/**
 * Shape of the persisted completion needed to derive the frontend-friendly flags.
 * Kept structural so the builder stays DB-free.
 */
export interface ItpCompletionForTransform {
  status: string;
  verificationStatus?: string | null;
  attachments?: unknown[] | null;
}

/**
 * Build the frontend-friendly completion object returned by POST /completions:
 * the persisted completion spread with derived booleans, normalised attachments,
 * and the (optional) linked NCR from the failed-item path.
 */
export function buildItpCompletionTransform<T extends ItpCompletionForTransform>(
  completion: T,
  createdNcr: unknown,
) {
  return {
    ...completion,
    isCompleted: completion.status === 'completed' || completion.status === 'not_applicable',
    isNotApplicable: completion.status === 'not_applicable',
    isFailed: completion.status === 'failed',
    ...deriveItpVerificationFlags(completion.verificationStatus),
    attachments: completion.attachments || [],
    linkedNcr: createdNcr,
  };
}

/**
 * H6: when an ITP item that was previously `rejected` is re-completed
 * ("resubmitted"), the rejection must be cleared and the prior verifier
 * attribution wiped so the item re-enters the queue as a fresh submission —
 * never silently inheriting the old verifier's identity or rejection note.
 *
 * - A rejected item resets to the freshly computed status (pending_verification
 *   when a subcontractor must be verified, verified when the project/lot needs no
 *   verification) and clears verifiedById / verifiedAt / verificationNotes. When
 *   the completer is not a subcontractor no status is computed, so the rejection
 *   simply clears back to `none`.
 * - A non-rejected item keeps the existing behaviour: only the computed status is
 *   written (if any), and verifier attribution is left untouched.
 */
export function resolveItpRecompletionVerificationFields(input: {
  existingVerificationStatus: string | null | undefined;
  computedVerificationStatus?: string;
}): {
  verificationStatus?: string;
  verifiedById?: null;
  verifiedAt?: null;
  verificationNotes?: null;
} {
  if (input.existingVerificationStatus === 'rejected') {
    return {
      verificationStatus: input.computedVerificationStatus ?? 'none',
      verifiedById: null,
      verifiedAt: null,
      verificationNotes: null,
    };
  }
  return input.computedVerificationStatus
    ? { verificationStatus: input.computedVerificationStatus }
    : {};
}

/**
 * M-OFFLINE: a subcontractor completion that is awaiting head-contractor review
 * (`pending_verification`) must not be silently downgraded through the standard
 * completion path. The offline sync worker reconstructs the replayed payload
 * from the cached row and drops `verificationStatus`, so a re-toggle that
 * un-completes the item (or a non-subcontractor touch) would reset it to plain
 * `pending`, wipe the subbie's attribution, and drop it from the HC verification
 * queue — with no verifier ever having acted.
 *
 * Sibling to the inline `verified`/`failed` guards. A legitimate amend/resubmit
 * by the subcontractor re-computes `pending_verification` (finished outcome on a
 * lot that requires verification), so that write is allowed through; anything
 * that would land the row anywhere other than `pending_verification` is blocked.
 * The verify/reject flows run on their own `/completions/:id/verify|reject`
 * routes and never hit this path.
 */
export function assertPendingVerificationNotDowngraded(input: {
  existingVerificationStatus: string | null | undefined;
  computedVerificationStatus?: string;
}): void {
  if (
    input.existingVerificationStatus === 'pending_verification' &&
    input.computedVerificationStatus !== 'pending_verification'
  ) {
    throw AppError.conflict(
      'ITP completions awaiting verification cannot be changed through the standard completion path',
      { verificationStatus: input.existingVerificationStatus },
    );
  }
}
