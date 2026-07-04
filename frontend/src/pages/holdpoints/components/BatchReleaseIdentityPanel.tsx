import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SignaturePad } from '@/components/ui/SignaturePad';

interface BatchReleaseIdentityPanelProps {
  selectedCount: number;
  releasedByName: string;
  onReleasedByNameChange: (value: string) => void;
  releasedByOrg: string;
  onReleasedByOrgChange: (value: string) => void;
  releaseNotes: string;
  onReleaseNotesChange: (value: string) => void;
  onSignatureChange: (dataUrl: string | null) => void;
  signatureDataUrl: string | null;
  tokenRecipientName: string;
  submitting: boolean;
  submitError: string | null;
  successMessage: string | null;
  onSubmit: () => void;
}

export function BatchReleaseIdentityPanel({
  selectedCount,
  releasedByName,
  onReleasedByNameChange,
  releasedByOrg,
  onReleasedByOrgChange,
  releaseNotes,
  onReleaseNotesChange,
  onSignatureChange,
  signatureDataUrl,
  tokenRecipientName,
  submitting,
  submitError,
  successMessage,
  onSubmit,
}: BatchReleaseIdentityPanelProps) {
  const canSubmit =
    selectedCount > 0 && Boolean(releasedByName.trim()) && Boolean(signatureDataUrl) && !submitting;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSubmit) return;
        onSubmit();
      }}
      className="space-y-4"
    >
      <div>
        <h2 className="font-semibold">Release Hold Points</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Select the hold points to release, then sign to confirm.
        </p>
      </div>

      {successMessage && (
        <div
          className="flex items-start gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success"
          role="status"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      <label className="block text-sm font-medium">
        Released By
        <input
          value={releasedByName}
          onChange={(event) => onReleasedByNameChange(event.target.value)}
          maxLength={120}
          required
          disabled={Boolean(tokenRecipientName) || submitting}
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
          disabled={submitting}
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
        />
      </label>

      <label className="block text-sm font-medium">
        Release Notes
        <textarea
          value={releaseNotes}
          onChange={(event) => onReleaseNotesChange(event.target.value)}
          maxLength={2000}
          rows={4}
          disabled={submitting}
          className="mt-1 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
        />
      </label>

      <div>
        <SignaturePad
          onChange={onSignatureChange}
          required
          fullWidth
          disabled={submitting}
          label="Sign to confirm release"
        />
        {!signatureDataUrl && (
          <p className="mt-1 text-xs text-muted-foreground">
            A signature is required to release hold points.
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

      <Button type="submit" className="w-full" disabled={!canSubmit}>
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        Release selected ({selectedCount})
      </Button>
    </form>
  );
}
