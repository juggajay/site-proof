import { FormEvent } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SignaturePad } from '@/components/ui/SignaturePad';

// Benchmark T3 — the approver used to get one button, "Release Hold Point". A
// superintendent who wanted to say "no", or "yes, subject to the 28-day break",
// had to pick up the phone, and whatever they said never reached the record.
//
// Every verb here still goes through the same token-authenticated door, still
// captures a signature, and still lands in the register.

export type PublicReleaseDecision = 'release' | 'release_with_conditions' | 'reject';

/**
 * Mirrors MIN_PUBLIC_RELEASE_COMMENT_LENGTH in
 * backend/src/routes/holdpoints/validation.ts. The server enforces it; this
 * only drives the counter and the disabled state.
 */
export const MIN_DECISION_COMMENT_LENGTH = 25;

interface DecisionCopy {
  label: string;
  /** Read-only "Status after Action" preview, so nobody commits blind. */
  statusAfter: string;
  commentLabel: string;
  commentPlaceholder: string;
  submitLabel: string;
  commentRequired: boolean;
}

export const DECISION_COPY: Record<PublicReleaseDecision, DecisionCopy> = {
  release: {
    label: 'Release',
    statusAfter: 'Released — the contractor may proceed.',
    commentLabel: 'Release notes (optional)',
    commentPlaceholder: 'Anything the site team should know.',
    submitLabel: 'Release hold point',
    commentRequired: false,
  },
  release_with_conditions: {
    label: 'Release with conditions',
    statusAfter: 'Released, with your conditions recorded against the hold point.',
    commentLabel: 'Conditions',
    commentPlaceholder: 'State exactly what the release is conditional on.',
    submitLabel: 'Release with conditions',
    commentRequired: true,
  },
  reject: {
    label: 'Reject',
    statusAfter: 'Rejected — sent back to the contractor with your reason. Nothing is released.',
    commentLabel: 'Reason for rejection',
    commentPlaceholder: 'State what must be corrected before this can be released.',
    submitLabel: 'Reject hold point',
    commentRequired: true,
  },
};

export function isDecisionCommentSufficient(
  decision: PublicReleaseDecision,
  comment: string,
): boolean {
  if (!DECISION_COPY[decision].commentRequired) return true;
  return comment.trim().length >= MIN_DECISION_COMMENT_LENGTH;
}

interface PublicReleaseDecisionFormProps {
  decision: PublicReleaseDecision;
  onDecisionChange: (decision: PublicReleaseDecision) => void;
  releasedByName: string;
  onReleasedByNameChange: (name: string) => void;
  releasedByOrg: string;
  onReleasedByOrgChange: (org: string) => void;
  comment: string;
  onCommentChange: (comment: string) => void;
  signatureDataUrl: string | null;
  onSignatureChange: (signature: string | null) => void;
  /** Locked to the invited recipient when the link carries a name. */
  tokenRecipientName: string;
  canAction: boolean;
  submitting: boolean;
  submitError: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function PublicReleaseDecisionForm({
  decision,
  onDecisionChange,
  releasedByName,
  onReleasedByNameChange,
  releasedByOrg,
  onReleasedByOrgChange,
  comment,
  onCommentChange,
  signatureDataUrl,
  onSignatureChange,
  tokenRecipientName,
  canAction,
  submitting,
  submitError,
  onSubmit,
}: PublicReleaseDecisionFormProps) {
  const copy = DECISION_COPY[decision];
  const commentLength = comment.trim().length;
  const commentSufficient = isDecisionCommentSufficient(decision, comment);
  const isReject = decision === 'reject';

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <h2 className="font-semibold">Action this hold point</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review the evidence package, then record your decision.
        </p>
      </div>

      {!canAction && (
        <div
          className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning"
          role="alert"
        >
          This link can no longer action the hold point.
        </div>
      )}

      <fieldset disabled={!canAction || submitting}>
        <legend className="text-sm font-medium">Decision</legend>
        <div className="mt-2 space-y-2">
          {(Object.keys(DECISION_COPY) as PublicReleaseDecision[]).map((value) => (
            <label
              key={value}
              className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm ${
                decision === value ? 'border-primary bg-primary/5 font-medium' : 'border-border'
              }`}
            >
              <input
                type="radio"
                name="hold-point-decision"
                value={value}
                checked={decision === value}
                onChange={() => onDecisionChange(value)}
                className="h-4 w-4 accent-primary"
              />
              {DECISION_COPY[value].label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="rounded-md border border-border bg-muted/50 px-3 py-2">
        <div className="text-xs font-medium uppercase text-muted-foreground">Status after</div>
        <p className="mt-0.5 text-sm">{copy.statusAfter}</p>
      </div>

      <label className="block text-sm font-medium">
        Actioned by
        <input
          value={releasedByName}
          onChange={(event) => onReleasedByNameChange(event.target.value)}
          maxLength={120}
          required
          disabled={Boolean(tokenRecipientName) || !canAction || submitting}
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
        />
        {tokenRecipientName && (
          <span className="mt-1 block text-xs text-muted-foreground">
            This secure link is assigned to {tokenRecipientName}.
          </span>
        )}
      </label>

      <label className="block text-sm font-medium">
        Organisation
        <input
          value={releasedByOrg}
          onChange={(event) => onReleasedByOrgChange(event.target.value)}
          maxLength={160}
          disabled={!canAction || submitting}
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
        />
      </label>

      <label className="block text-sm font-medium">
        {copy.commentLabel}
        <textarea
          value={comment}
          onChange={(event) => onCommentChange(event.target.value)}
          maxLength={2000}
          rows={4}
          required={copy.commentRequired}
          placeholder={copy.commentPlaceholder}
          disabled={!canAction || submitting}
          className="mt-1 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
        />
        {copy.commentRequired && (
          <span
            className={`mt-1 block text-xs ${commentSufficient ? 'text-muted-foreground' : 'text-warning'}`}
            aria-live="polite"
          >
            {commentLength} character{commentLength === 1 ? '' : 's'} - min{' '}
            {MIN_DECISION_COMMENT_LENGTH}
          </span>
        )}
      </label>

      <div>
        <SignaturePad
          onChange={onSignatureChange}
          required
          fullWidth
          disabled={!canAction || submitting}
          label="Sign to confirm this decision"
        />
        {!signatureDataUrl && (
          <p className="mt-1 text-xs text-muted-foreground">
            A signature is required to record this decision.
          </p>
        )}
      </div>

      {submitError && (
        <div
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {submitError}
        </div>
      )}

      <Button
        type="submit"
        variant={isReject ? 'destructive' : 'default'}
        className="w-full"
        disabled={
          !canAction ||
          submitting ||
          !releasedByName.trim() ||
          !signatureDataUrl ||
          !commentSufficient
        }
      >
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        {copy.submitLabel}
      </Button>
    </form>
  );
}
