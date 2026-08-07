import { FormEvent, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { extractErrorMessage } from '@/lib/errorHandling';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { SignaturePad } from '@/components/ui/SignaturePad';

export type PublicHoldPointOutcome = 'release' | 'release_with_conditions' | 'reject';

export interface PublicHoldPointDecisionResult {
  success: boolean;
  message: string;
  holdPoint: {
    status: string;
    itpChecklistItemId?: string | null;
    releasedAt?: string | null;
    releasedByName?: string | null;
    releasedByOrg?: string | null;
    releaseMethod?: string | null;
    releaseNotes?: string | null;
  };
  ncr?: { id: string; ncrNumber: string; status: string };
  conditions?: string[];
}

interface PublicHoldPointDecisionFormProps {
  token: string;
  holdPointDescription: string;
  lotNumber: string;
  recipientName: string;
  canDecide: boolean;
  onDecided: (outcome: PublicHoldPointOutcome, result: PublicHoldPointDecisionResult) => void;
}

const OUTCOME_LABELS: Record<PublicHoldPointOutcome, string> = {
  release: 'Release',
  release_with_conditions: 'Release with conditions (a CIVOS convention)',
  reject: 'Reject',
};

function parseConditions(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((condition) => condition.trim())
    .filter(Boolean);
}

function confirmationCopy(
  outcome: PublicHoldPointOutcome,
  description: string,
  lotNumber: string,
  conditionCount: number,
): string {
  if (outcome === 'reject') {
    return `You are rejecting ${description}; the contractor will be able to re-request once the non-conformance is closed.`;
  }
  if (outcome === 'release_with_conditions') {
    return `You are granting permission to proceed for ${description} on ${lotNumber}, subject to ${conditionCount} recorded condition${conditionCount === 1 ? '' : 's'}.`;
  }
  return `You are granting permission to proceed for ${description} on ${lotNumber}.`;
}

export function PublicHoldPointDecisionForm({
  token,
  holdPointDescription,
  lotNumber,
  recipientName,
  canDecide,
  onDecided,
}: PublicHoldPointDecisionFormProps) {
  const [outcome, setOutcome] = useState<PublicHoldPointOutcome>('release');
  const [name, setName] = useState(recipientName);
  const [org, setOrg] = useState('');
  const [notes, setNotes] = useState('');
  const [conditionsInput, setConditionsInput] = useState('');
  const [reason, setReason] = useState('');
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const conditions = useMemo(() => parseConditions(conditionsInput), [conditionsInput]);

  const validate = (): string | null => {
    if (!name.trim()) return 'Your name is required.';
    if (name.trim().length > 160) return 'Your name must be 160 characters or fewer.';
    if (org.trim().length > 160) return 'Organisation must be 160 characters or fewer.';
    if (!signatureDataUrl) return 'A signature is required to record this decision.';
    if (notes.trim().length > 5000) return 'Notes must be 5000 characters or fewer.';
    if (outcome === 'reject') {
      if (reason.trim().length < 25) return 'Reason must be at least 25 characters.';
      if (reason.trim().length > 5000) return 'Reason must be 5000 characters or fewer.';
    }
    if (outcome === 'release_with_conditions') {
      if (conditions.length === 0) return 'Enter at least one condition.';
      if (conditions.length > 20) return 'No more than 20 conditions are allowed.';
      if (conditions.some((condition) => condition.length > 500)) {
        return 'Each condition must be 500 characters or fewer.';
      }
    }
    return null;
  };

  const reviewDecision = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validate();
    setFormError(validationError);
    if (!validationError) setConfirming(true);
  };

  const submitDecision = async () => {
    const validationError = validate();
    if (validationError || submittingRef.current) {
      setFormError(validationError);
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setFormError(null);
    const endpoint =
      outcome === 'release'
        ? 'release'
        : outcome === 'reject'
          ? 'reject'
          : 'release-with-conditions';
    const body =
      outcome === 'release'
        ? {
            releasedByName: name.trim(),
            releasedByOrg: org.trim() || undefined,
            releaseNotes: notes.trim() || undefined,
            signatureDataUrl,
          }
        : outcome === 'reject'
          ? {
              name: name.trim(),
              org: org.trim() || undefined,
              reason: reason.trim(),
              signatureDataUrl,
            }
          : {
              name: name.trim(),
              org: org.trim() || undefined,
              conditions,
              notes: notes.trim() || undefined,
              signatureDataUrl,
            };

    try {
      const result = await apiFetch<PublicHoldPointDecisionResult>(
        `/api/holdpoints/public/${encodeURIComponent(token)}/${endpoint}`,
        { method: 'POST', body: JSON.stringify(body) },
      );
      onDecided(outcome, result);
    } catch (error) {
      setFormError(extractErrorMessage(error, 'Could not record this hold point decision.'));
      setConfirming(false);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (confirming) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="font-semibold">Confirm {OUTCOME_LABELS[outcome]}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {confirmationCopy(outcome, holdPointDescription, lotNumber, conditions.length)}
          </p>
        </div>
        {outcome === 'reject' && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">
            <span className="font-medium">Reason:</span> {reason.trim()}
          </div>
        )}
        {outcome === 'release_with_conditions' && (
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {conditions.map((condition) => (
              <li key={condition}>{condition}</li>
            ))}
          </ol>
        )}
        {formError && (
          <p className="text-sm text-destructive" role="alert">
            {formError}
          </p>
        )}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => setConfirming(false)}
            disabled={submitting}
          >
            Back
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={() => void submitDecision()}
            disabled={submitting}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Confirm decision
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={reviewDecision} className="space-y-4">
      <div>
        <h2 className="font-semibold">Record decision</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose the outcome before entering its decision terms.
        </p>
      </div>
      {!canDecide && (
        <div
          className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning"
          role="alert"
        >
          This link can no longer record a decision.
        </div>
      )}
      <label className="block text-sm font-medium">
        Outcome
        <NativeSelect
          aria-label="Outcome"
          value={outcome}
          onChange={(event) => {
            setOutcome(event.target.value as PublicHoldPointOutcome);
            setFormError(null);
          }}
          disabled={!canDecide}
          className="mt-1"
        >
          <option value="release">Release</option>
          <option value="release_with_conditions">
            Release with conditions (a CIVOS convention)
          </option>
          <option value="reject">Reject</option>
        </NativeSelect>
      </label>
      {outcome === 'release_with_conditions' && (
        <label className="block text-sm font-medium">
          Conditions (one per line)
          <textarea
            aria-label="Conditions (one per line)"
            value={conditionsInput}
            onChange={(event) => setConditionsInput(event.target.value)}
            rows={6}
            disabled={!canDecide}
            className="mt-1 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="mt-1 block text-xs text-muted-foreground">
            {conditions.length}/20 conditions
          </span>
          {conditions.length > 0 && conditions.length <= 20 && (
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
              {conditions.map((condition, index) => (
                <li key={`${index}-${condition}`}>{condition}</li>
              ))}
            </ol>
          )}
        </label>
      )}
      {outcome === 'reject' && (
        <label className="block text-sm font-medium">
          Reason for refusing release
          <textarea
            aria-label="Reason for refusing release"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            minLength={25}
            maxLength={5000}
            rows={5}
            required
            disabled={!canDecide}
            className="mt-1 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <span
            className={`mt-1 block text-xs ${reason.trim().length > 0 && reason.trim().length < 25 ? 'text-destructive' : 'text-muted-foreground'}`}
          >
            {reason.trim().length}/5000 characters (minimum 25)
          </span>
        </label>
      )}
      <label className="block text-sm font-medium">
        Name
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={160}
          required
          disabled={Boolean(recipientName) || !canDecide}
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        {recipientName && (
          <span className="mt-1 block text-xs text-muted-foreground">
            This secure link is assigned to {recipientName}.
          </span>
        )}
      </label>
      <label className="block text-sm font-medium">
        Organisation
        <input
          value={org}
          onChange={(event) => setOrg(event.target.value)}
          maxLength={160}
          disabled={!canDecide}
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </label>
      {outcome !== 'reject' && (
        <label className="block text-sm font-medium">
          {outcome === 'release' ? 'Release notes' : 'Notes'}
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={5000}
            rows={3}
            disabled={!canDecide}
            className="mt-1 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
      )}
      <div>
        <SignaturePad
          onChange={setSignatureDataUrl}
          required
          fullWidth
          disabled={!canDecide}
          label="Signature"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          This signature records the signer&rsquo;s asserted identity for this decision.
        </p>
      </div>
      {formError && (
        <p
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {formError}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={!canDecide}>
        Review decision
      </Button>
    </form>
  );
}
