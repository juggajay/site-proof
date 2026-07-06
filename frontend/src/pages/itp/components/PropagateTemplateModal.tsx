// Offered after a successful template edit when the template is assigned to
// in-progress lots: applies the edit to those lots' ITP checklists via the
// existing POST /templates/:id/propagate endpoint.
//
// Honest semantics (verified against the backend): editing a template's
// checklist items is rejected up-front (409) whenever any lot has recorded a
// sign-off, hold point, or test result against it, so a template that reached
// this dialog after a checklist change has no recorded inspections on any lot —
// propagate only rewrites each instance's stored snapshot, it never deletes a
// completion. The endpoint already excludes completed (conformed) lots. That is
// why the copy below promises recorded work is kept.
export function PropagateTemplateModal({
  isOpen,
  lotNumbers,
  loading,
  onConfirm,
  onSkip,
}: {
  isOpen: boolean;
  lotNumbers: string[];
  loading: boolean;
  onConfirm: () => void;
  onSkip: () => void;
}) {
  if (!isOpen) return null;

  const lotCount = lotNumbers.length;
  const lotLabel = lotCount === 1 ? 'lot' : 'lots';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        className="bg-background rounded-lg p-6 w-full max-w-md"
        role="dialog"
        aria-modal="true"
        aria-label="Apply template changes to assigned lots"
      >
        <h2 className="text-xl font-semibold mb-2">Apply changes to assigned {lotLabel}?</h2>
        <p className="text-sm text-muted-foreground mb-4">
          This template is assigned to {lotCount} in-progress {lotLabel}. Applying updates their
          inspection checklist to match the changes you just saved. Recorded inspections and
          sign-offs are kept, and completed lots are left unchanged.
        </p>

        <div className="mb-4 max-h-40 overflow-y-auto rounded-lg border bg-muted/30 p-3">
          <ul className="space-y-1 text-sm">
            {lotNumbers.map((lotNumber) => (
              <li key={lotNumber} className="font-mono">
                {lotNumber}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onSkip}
            className="px-4 py-2 border rounded-lg hover:bg-muted disabled:opacity-50"
            disabled={loading}
          >
            Not now
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Applying...' : `Apply to ${lotCount} ${lotLabel}`}
          </button>
        </div>
      </div>
    </div>
  );
}
