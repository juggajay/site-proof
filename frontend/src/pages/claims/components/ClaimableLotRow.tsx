import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { ConformedLot } from '../types';
import type { EvidenceReadinessItem } from '@/types/evidenceReadiness';
import {
  calculateLotClaimAmount,
  formatCurrency,
  getClaimIncrementError,
  parseClaimPercentageInput,
} from '../utils';

export type ClaimableLot = ConformedLot & {
  actionBlocked: boolean;
  readinessItems: EvidenceReadinessItem[];
};

/**
 * The percentage the row is pre-filled with, and the value the "Claim
 * remaining" shortcut and the revert control restore.
 *
 * IMPORTANT — this is `remainingPercentage` from the claim-readiness endpoint,
 * which is derived from the RESERVATION rule (`cumulativeClaims.ts`: every
 * claim including drafts). That is deliberately NOT the claim-history rule the
 * claim detail page's "Previously claimed" band uses, which excludes drafts.
 * Here the number has to match what the server will accept: claim create
 * validates the increment against the reservation rule and returns
 * `OVER_CLAIM`, so a shortcut offering the history-derived remainder would hand
 * the user a value the save then rejects. Reservation answers "what can I still
 * claim"; history answers "what has been claimed".
 *
 * ponytail: no separate "computed value" field on the row — the computed value
 * IS `remainingPercentage`, so this derives it and there is nothing to keep in
 * sync.
 */
export function computedPercentage(lot: ClaimableLot): string {
  return String(Number(lot.remainingPercentage.toFixed(2)));
}

/** True when the user has typed something other than the computed default. */
export function isOverridden(lot: ClaimableLot): boolean {
  return lot.percentComplete.trim() !== computedPercentage(lot);
}

export function getSelectedLotClaimIncrementError(
  value: string,
  remainingPercentage: number,
): string | null {
  const incrementError = getClaimIncrementError(value, remainingPercentage);
  if (incrementError) return incrementError;

  const parsed = parseClaimPercentageInput(value);
  return parsed !== null && parsed <= 0 ? 'Claim percentage must be greater than 0.' : null;
}

interface ClaimableLotRowProps {
  lot: ClaimableLot;
  onToggleSelection: (lotId: string) => void;
  onPercentageChange: (lotId: string, percent: string) => void;
}

/** The readiness signals shown under a lot: blockers and warnings, or the first
 * supporting item when there is nothing to flag. */
function LotReadinessNotes({
  lot,
  actionBlockers,
  evidenceIssues,
  supportItems,
}: {
  lot: ClaimableLot;
  actionBlockers: EvidenceReadinessItem[];
  evidenceIssues: EvidenceReadinessItem[];
  supportItems: EvidenceReadinessItem[];
}) {
  if (actionBlockers.length > 0 || evidenceIssues.length > 0) {
    return (
      <div className="mt-2 ml-7 space-y-1">
        {[...actionBlockers, ...evidenceIssues].slice(0, 3).map((item) => (
          <p
            key={`${lot.id}-${item.code}`}
            className={`flex items-start gap-1.5 text-xs ${
              item.blocksAction ? 'text-destructive' : 'text-warning'
            }`}
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>
              <span className="font-medium">{item.title}</span>
              <span> - {item.detail}</span>
            </span>
          </p>
        ))}
      </div>
    );
  }

  if (supportItems.length > 0) {
    return (
      <p className="mt-2 ml-7 flex items-start gap-1.5 text-xs text-success">
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
        <span>{supportItems[0].title}</span>
      </p>
    );
  }

  return null;
}

/** The percentage input, its shortcut, and the override marker. */
function LotClaimPercentageField({
  lot,
  onPercentageChange,
}: {
  lot: ClaimableLot;
  onPercentageChange: (lotId: string, percent: string) => void;
}) {
  const inputId = `claim-percent-${lot.id}`;
  const error = getSelectedLotClaimIncrementError(lot.percentComplete, lot.remainingPercentage);
  const computedValue = computedPercentage(lot);
  const overridden = isOverridden(lot);
  const lotClaimAmount = calculateLotClaimAmount(lot);

  return (
    <div className="mt-2 ml-7 space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={inputId} className="text-sm text-muted-foreground">
          % to claim this time:
          <span className="sr-only"> for {lot.lotNumber}</span>
        </label>
        <Input
          id={inputId}
          type="number"
          min={0.01}
          max={lot.remainingPercentage}
          step="0.01"
          required
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
          value={lot.percentComplete}
          onChange={(e) => onPercentageChange(lot.id, e.target.value)}
          className={`w-20 h-8 text-sm text-center ${
            error ? 'border-destructive' : overridden ? 'border-warning text-warning' : ''
          }`}
        />
        <span className="text-sm">%</span>
        {/* Colour is never the only carrier of meaning: the amber border is
            reinforced by a text chip and a named revert control. */}
        {overridden && (
          <>
            <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
              Edited
            </span>
            <button
              type="button"
              onClick={() => onPercentageChange(lot.id, computedValue)}
              className="text-xs text-primary underline-offset-2 hover:underline"
            >
              Revert to {computedValue}%
            </button>
          </>
        )}
        <span className="ml-auto font-semibold text-primary">
          {lotClaimAmount === null ? 'No budget' : formatCurrency(lotClaimAmount)}
        </span>
        {error && (
          <span
            id={`${inputId}-error`}
            className="text-sm text-destructive"
            role="alert"
            aria-live="assertive"
          >
            {error}
          </span>
        )}
      </div>
      {/* The value lives IN the label, so the number is readable without
          clicking to find out what it is. */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onPercentageChange(lot.id, computedValue)}
          className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
        >
          Claim remaining ({computedValue}%)
        </button>
        {lot.budgetAmount !== null && (
          <span className="self-center text-xs text-muted-foreground">
            {formatCurrency(lot.budgetAmount)} lot budget
          </span>
        )}
      </div>
    </div>
  );
}

export function ClaimableLotRow({
  lot,
  onToggleSelection,
  onPercentageChange,
}: ClaimableLotRowProps) {
  const actionBlockers = lot.readinessItems.filter((item) => item.blocksAction);
  const evidenceIssues = lot.readinessItems.filter(
    (item) => !item.blocksAction && item.severity !== 'support',
  );
  const supportItems = lot.readinessItems.filter((item) => item.severity === 'support');

  return (
    <div className="p-3 hover:bg-muted/30">
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          aria-label={`Select ${lot.lotNumber}`}
          checked={lot.selected}
          onChange={() => onToggleSelection(lot.id)}
          disabled={lot.actionBlocked}
          className="h-4 w-4 rounded border-border accent-primary"
        />
        <div className="flex-1">
          <span className="font-medium">{lot.lotNumber}</span>
          <span className="text-muted-foreground ml-2">{lot.activity}</span>
        </div>
        <span className="text-muted-foreground text-sm">{formatCurrency(lot.budgetAmount)}</span>
      </div>
      {lot.claimedPercentage > 0 && (
        <p className="mt-1 ml-7 text-xs text-muted-foreground">
          Previously claimed {Number(lot.claimedPercentage.toFixed(2))}% -{' '}
          {Number(lot.remainingPercentage.toFixed(2))}% still available
        </p>
      )}
      <LotReadinessNotes
        lot={lot}
        actionBlockers={actionBlockers}
        evidenceIssues={evidenceIssues}
        supportItems={supportItems}
      />
      {lot.selected && (
        <LotClaimPercentageField lot={lot} onPercentageChange={onPercentageChange} />
      )}
    </div>
  );
}
