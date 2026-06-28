import { Button } from '@/components/ui/button';
import type { HpRecipient } from '../types';

interface SettingsFeedbackMessagesProps {
  error: string;
  status: string;
}

export function SettingsFeedbackMessages({ error, status }: SettingsFeedbackMessagesProps) {
  return (
    <>
      {error && (
        <div role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {status && (
        <div role="status" className="rounded-lg bg-success/10 p-3 text-sm text-success">
          {status}
        </div>
      )}
    </>
  );
}

interface HoldPointRecipientsSectionProps {
  hpRecipients: HpRecipient[];
  savingRecipients: boolean;
  savingSetting: string | null;
  readOnly?: boolean;
  onAddRecipient: () => void;
  onRemoveRecipient: (index: number) => void;
}

export function HoldPointRecipientsSection({
  hpRecipients,
  savingRecipients,
  savingSetting,
  readOnly = false,
  onAddRecipient,
  onRemoveRecipient,
}: HoldPointRecipientsSectionProps) {
  return (
    <div className="rounded-lg border p-4">
      <h2 className="text-lg font-semibold mb-2">Hold Point Recipients</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Default recipients for hold point notifications. These will be pre-filled when requesting a
        hold point release.
      </p>
      <div className="space-y-2">
        {hpRecipients.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No default recipients configured.</p>
        ) : (
          hpRecipients.map((recipient, index) => (
            <div
              key={`${recipient.role}-${recipient.email}`}
              className="flex items-center justify-between gap-2 p-2 rounded bg-muted/50 text-sm"
            >
              <div>
                <span className="font-medium">{recipient.role}:</span>
                <span className="text-muted-foreground ml-2">{recipient.email}</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive/80 text-xs h-auto p-1"
                onClick={() => onRemoveRecipient(index)}
                disabled={readOnly || savingSetting === `removeRecipient-${index}`}
              >
                Remove {recipient.role}
              </Button>
            </div>
          ))
        )}
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={onAddRecipient}
        className="mt-4"
        disabled={readOnly || savingRecipients}
      >
        Add Recipient
      </Button>
    </div>
  );
}

interface SubcontractorVerificationSectionProps {
  requireSubcontractorVerification: boolean;
  savingSetting: string | null;
  readOnly?: boolean;
  onToggle: () => void;
}

export function SubcontractorVerificationSection({
  requireSubcontractorVerification,
  savingSetting,
  readOnly = false,
  onToggle,
}: SubcontractorVerificationSectionProps) {
  return (
    <div className="rounded-lg border p-4">
      <h2 className="text-lg font-semibold mb-2">Subcontractor ITP Verification</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Configure whether subcontractor ITP completions require verification by a supervisor.
      </p>
      <div className="space-y-4">
        <label
          htmlFor="require-subcontractor-verification"
          className="flex items-center justify-between p-3 rounded-lg bg-muted/30 cursor-pointer hover:bg-muted/50"
        >
          <div>
            <p className="font-medium">Require Verification</p>
            <p className="text-sm text-muted-foreground">
              {requireSubcontractorVerification
                ? 'Subcontractor completions need supervisor verification'
                : 'Subcontractor completions are automatically verified'}
            </p>
          </div>
          <input
            id="require-subcontractor-verification"
            type="checkbox"
            checked={requireSubcontractorVerification}
            onChange={onToggle}
            disabled={readOnly || savingSetting !== null}
            className="h-5 w-5 cursor-pointer accent-primary"
          />
        </label>
      </div>
    </div>
  );
}
