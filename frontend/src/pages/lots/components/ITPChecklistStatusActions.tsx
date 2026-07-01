import { AlertTriangle, Check, Lock } from 'lucide-react';

interface ITPChecklistStatusActionsProps {
  isCompleted: boolean;
  isNotApplicable: boolean;
  isFailed: boolean;
  isUpdating: boolean;
  canPass: boolean;
  holdPointBlocked: boolean;
  onPass: () => void;
  onFail: () => void;
  onMarkNotApplicable: () => void;
}

const ACTION_BUTTON_CLASS =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50';

export function ITPChecklistStatusActions({
  isCompleted,
  isNotApplicable,
  isFailed,
  isUpdating,
  canPass,
  holdPointBlocked,
  onPass,
  onFail,
  onMarkNotApplicable,
}: ITPChecklistStatusActionsProps) {
  if (isCompleted || isNotApplicable || isFailed) {
    return null;
  }

  return (
    <div className="mt-3 space-y-2">
      {holdPointBlocked && (
        <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-warning">
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Awaiting hold point release</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            This hold point cannot be passed until release is recorded. You can still mark it N/A or
            fail it.
          </p>
        </div>
      )}
      <div
        className={`grid gap-2 ${canPass ? 'grid-cols-3' : 'grid-cols-2'}`}
        role="group"
        aria-label="Checklist status actions"
      >
        {canPass && (
          <button
            type="button"
            onClick={onPass}
            disabled={isUpdating}
            aria-label="Pass this check"
            className={`${ACTION_BUTTON_CLASS} border-success/50 bg-success/10 text-success hover:bg-success/20`}
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            <span>Pass</span>
          </button>
        )}
        <button
          type="button"
          onClick={onFail}
          disabled={isUpdating}
          aria-label="Fail this check"
          className={`${ACTION_BUTTON_CLASS} border-destructive/50 bg-destructive/10 text-destructive hover:bg-destructive/20`}
        >
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <span>Fail</span>
        </button>
        <button
          type="button"
          onClick={onMarkNotApplicable}
          disabled={isUpdating}
          aria-label="Mark not applicable"
          className={`${ACTION_BUTTON_CLASS} border-border bg-muted text-muted-foreground hover:bg-muted/70`}
        >
          <span aria-hidden="true">N/A</span>
          <span className="sr-only">Mark not applicable</span>
        </button>
      </div>
    </div>
  );
}
