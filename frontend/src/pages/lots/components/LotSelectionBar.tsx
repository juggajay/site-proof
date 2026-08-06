import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LotSelectionBarProps {
  selectedCount: number;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  isSubcontractor: boolean;
  /** A shipped frequency ruleset governs this project (Wave C1 §9.4). */
  hasGoverningRuleset: boolean;
  rulesetLoadFailed: boolean;
  onRetryRulesetLoad: () => void;
  onClearSelection: () => void;
  onOpenBulkStatus: () => void;
  onOpenBulkAssign: () => void;
  onOpenBulkTestAttributes: () => void;
  onOpenBulkDelete: () => void;
  onOpenPrintLabels: () => void;
}

/**
 * Bulk action bar for the lot register. It appears the moment a row is ticked
 * and carries only verbs that already exist elsewhere in the page.
 *
 * A verb the current *state* cannot support is shown disabled with the reason on
 * the button, never hidden — a greyed "Set Testing Attributes" teaches that the
 * project has no governing ruleset, where a missing button teaches nothing.
 * Verbs a role may not use are still omitted entirely: role gating is a
 * permission boundary, not a teaching moment.
 */
export function LotSelectionBar({
  selectedCount,
  canCreate,
  canEdit,
  canDelete,
  isSubcontractor,
  hasGoverningRuleset,
  rulesetLoadFailed,
  onRetryRulesetLoad,
  onClearSelection,
  onOpenBulkStatus,
  onOpenBulkAssign,
  onOpenBulkTestAttributes,
  onOpenBulkDelete,
  onOpenPrintLabels,
}: LotSelectionBarProps) {
  if (selectedCount === 0) return null;

  const testAttributesReason = rulesetLoadFailed
    ? 'Testing attributes could not be loaded for this project.'
    : 'No frequency ruleset governs this project, so testing attributes have nothing to feed.';

  return (
    <div
      className="sticky top-0 z-20 flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3"
      role="region"
      aria-label="Bulk actions for selected lots"
      data-testid="lot-selection-bar"
    >
      <span className="text-sm font-semibold text-foreground" data-testid="lot-selection-count">
        {selectedCount} selected
      </span>

      {canCreate && (
        <Button variant="outline" size="sm" onClick={onOpenBulkStatus}>
          Update Status
        </Button>
      )}

      {canCreate && !isSubcontractor && (
        <Button variant="outline" size="sm" onClick={onOpenBulkAssign}>
          Assign Subcontractor
        </Button>
      )}

      {/* Wave C1: gated on canEdit, NOT canCreate — the backend bulk route
          enforces LOT_EDITORS (F8). */}
      {canEdit && !isSubcontractor && (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenBulkTestAttributes}
            disabled={!hasGoverningRuleset}
            title={hasGoverningRuleset ? undefined : testAttributesReason}
            data-testid="bulk-test-attributes-action"
          >
            Set Testing Attributes
          </Button>
          {/* C1 (F14): the pack lookup failed — offer the retry rather than
              silently behaving like an unsupported project. */}
          {!hasGoverningRuleset && rulesetLoadFailed && (
            <Button variant="ghost" size="sm" onClick={onRetryRulesetLoad}>
              Retry
            </Button>
          )}
        </>
      )}

      <Button variant="outline" size="sm" onClick={onOpenPrintLabels}>
        Print Labels
      </Button>

      {canDelete && (
        <Button
          variant="outline"
          size="sm"
          className="border-destructive text-destructive hover:bg-destructive/10"
          onClick={onOpenBulkDelete}
        >
          Delete Selected
        </Button>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="ml-auto text-muted-foreground"
        onClick={onClearSelection}
      >
        <X className="h-4 w-4" />
        Clear selection
      </Button>
    </div>
  );
}
