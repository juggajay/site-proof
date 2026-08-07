import { FormEvent, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { extractErrorMessage } from '@/lib/errorHandling';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ResponsiveSheet } from '@/components/ui/ResponsiveSheet';
import { Textarea } from '@/components/ui/textarea';
import type { HoldPoint } from '../types';

interface WithdrawHoldPointRequestDialogProps {
  holdPoint: HoldPoint;
  onClose: () => void;
  onWithdrawn: () => Promise<void> | void;
}

export function WithdrawHoldPointRequestDialog({
  holdPoint,
  onClose,
  onWithdrawn,
}: WithdrawHoldPointRequestDialogProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedReason = reason.trim();
    if (!trimmedReason || submittingRef.current) return;

    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/api/holdpoints/${encodeURIComponent(holdPoint.id)}/withdraw-request`, {
        method: 'POST',
        body: JSON.stringify({ reason: trimmedReason }),
      });
      await onWithdrawn();
      onClose();
    } catch (requestError) {
      setError(extractErrorMessage(requestError, 'Could not withdraw this release request.'));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <ResponsiveSheet
      open
      onClose={onClose}
      title="Withdraw release request"
      className="max-w-md"
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="withdraw-hold-point-request-form"
            variant="destructive"
            disabled={submitting || !reason.trim()}
          >
            {submitting ? 'Withdrawing...' : 'Withdraw request'}
          </Button>
        </div>
      }
    >
      <form id="withdraw-hold-point-request-form" onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Withdraw the undecided release request for {holdPoint.description} on{' '}
          {holdPoint.lotNumber}. The reason will be retained on the decision round.
        </p>
        <div>
          <Label htmlFor="withdraw-hold-point-reason">Reason (required)</Label>
          <Textarea
            id="withdraw-hold-point-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={5000}
            rows={4}
            required
          />
          <p className="mt-1 text-xs text-muted-foreground">{reason.length}/5000 characters</p>
        </div>
        {error && (
          <p
            className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        )}
      </form>
    </ResponsiveSheet>
  );
}
