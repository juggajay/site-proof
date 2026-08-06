// H4 — the head-contractor's reject-reason dialog for an ITP item awaiting
// verification. Extracted from ITPChecklistTab unchanged.

interface ITPRejectItemModalProps {
  itemDescription: string;
  reason: string;
  submitting: boolean;
  onReasonChange: (reason: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

export function ITPRejectItemModal({
  itemDescription,
  reason,
  submitting,
  onReasonChange,
  onCancel,
  onSubmit,
}: ITPRejectItemModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-label="Reject ITP item"
    >
      <div className="bg-background rounded-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold mb-1">Reject ITP item</h2>
        <p className="text-sm text-muted-foreground mb-3">{itemDescription}</p>
        <label htmlFor="itp-reject-reason" className="block text-sm font-medium mb-1">
          Reason for rejection <span className="text-destructive">*</span>
        </label>
        <textarea
          id="itp-reject-reason"
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          maxLength={3000}
          rows={4}
          className="w-full px-2 py-1 text-sm border border-border rounded bg-background text-foreground"
          placeholder="Explain what needs to be corrected before this item can be verified..."
        />
        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-4 py-2 border rounded-lg hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting || !reason.trim()}
            className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
          >
            {submitting ? 'Rejecting...' : 'Reject item'}
          </button>
        </div>
      </div>
    </div>
  );
}
