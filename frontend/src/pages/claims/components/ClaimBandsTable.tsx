import { useState } from 'react';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { formatCents } from '../utils';
import type { ClaimBandAmount, ClaimBandLine, ClaimBands } from '../types';

/**
 * The per-lot money bands behind one claim.
 *
 * The three column labels are deliberately unambiguous. "To date" on its own is
 * the label that starts arguments — it reads as either "including this claim"
 * or "before it" depending on who is looking — so the bands are always
 * "Previously claimed", "This claim" and "Claimed to date", and the last one
 * says explicitly that it includes this claim.
 *
 * On mobile the bands do not scroll sideways: a segmented control picks ONE
 * band and the rows render as cards. Annotating a screenshot with "scroll right
 * for more columns" is the failure mode this avoids.
 */

export const CLAIM_BANDS = [
  {
    key: 'previouslyClaimed',
    label: 'Previously claimed',
    hint: 'Claimed on earlier claims, before this one.',
  },
  { key: 'thisClaim', label: 'This claim', hint: 'Claimed on this claim only.' },
  {
    key: 'claimedToDate',
    label: 'Claimed to date',
    hint: 'Previously claimed plus this claim.',
  },
] as const;

type BandKey = (typeof CLAIM_BANDS)[number]['key'];

/** A band cell. An underivable figure is an em-dash carrying its reason, never
 * a confident $0 — see `ClaimBandAmount`. */
function BandCell({
  amount,
  align = 'right',
}: {
  amount: ClaimBandAmount;
  align?: 'left' | 'right';
}) {
  if (amount.cents === null) {
    return (
      <span
        className="text-muted-foreground"
        title={amount.unavailableReason ?? 'Not available.'}
        aria-label={amount.unavailableReason ?? 'Not available.'}
      >
        —
      </span>
    );
  }

  return (
    <span className={align === 'right' ? 'block text-right' : undefined}>
      <span className="font-medium tabular-nums">{formatCents(amount.cents)}</span>
      {amount.percentage !== null && (
        <span className="ml-2 text-xs text-muted-foreground tabular-nums">
          {amount.percentage}%
        </span>
      )}
    </span>
  );
}

function LotIdentity({ line }: { line: ClaimBandLine }) {
  const chainage =
    line.chainageStart !== null && line.chainageEnd !== null
      ? `Ch ${line.chainageStart} – ${line.chainageEnd}`
      : null;

  return (
    <div className="min-w-0">
      <div className="font-medium">{line.lotNumber}</div>
      {line.description && <div className="text-sm text-muted-foreground">{line.description}</div>}
      <div className="text-xs text-muted-foreground">
        {line.activityType}
        {chainage && <span className="ml-2">{chainage}</span>}
      </div>
    </div>
  );
}

/**
 * The two independent facts under a line, never joined into one expression.
 *
 * The dollar figure comes from a percentage a person typed against the lot
 * budget; the ITP count comes from signed checklist items. Writing
 * "$42,000 × 65% (ITP 13/20) = $27,300" would assert that the checklist
 * produced the percentage, which it did not.
 */
function LineFacts({ line }: { line: ClaimBandLine }) {
  const { derivation, itp } = line;
  const derivationText =
    derivation.basis === 'percent_of_lot_budget' &&
    derivation.percentage !== null &&
    derivation.lotBudgetCents !== null
      ? `${derivation.percentage}% of the ${formatCents(derivation.lotBudgetCents)} lot budget`
      : 'Amount as recorded on this claim';

  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <span
        title={
          derivation.basis === 'percent_of_lot_budget'
            ? undefined
            : 'The lot budget no longer reproduces this amount (it was edited after the claim, or was never set), so the working is not shown.'
        }
      >
        {derivationText}
      </span>
      {itp && (
        <span title="Signed ITP checklist items. Shown as a separate fact — it is not what produced the claimed amount.">
          ITP {itp.completed}/{itp.total}
        </span>
      )}
    </div>
  );
}

function BandSegmentedControl({
  value,
  onChange,
}: {
  value: BandKey;
  onChange: (key: BandKey) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Claim band"
      className="flex rounded-lg border bg-muted/40 p-1 text-sm"
    >
      {CLAIM_BANDS.map((band) => (
        <button
          key={band.key}
          type="button"
          role="tab"
          aria-selected={value === band.key}
          onClick={() => onChange(band.key)}
          className={`flex-1 rounded-md px-2 py-2 font-medium ${
            value === band.key ? 'bg-background shadow-sm' : 'text-muted-foreground'
          }`}
        >
          {band.label}
        </button>
      ))}
    </div>
  );
}

export function ClaimBandsTable({ bands }: { bands: ClaimBands }) {
  const isMobile = useIsMobile();
  const [visibleBand, setVisibleBand] = useState<BandKey>('thisClaim');

  if (bands.lines.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-6 text-center">
        <p className="font-medium">No lot lines on this claim</p>
        <p className="mt-1 text-sm text-muted-foreground">
          This claim carries approved variations only, so there is nothing to break down by lot.
        </p>
      </div>
    );
  }

  if (isMobile) {
    const activeBand = CLAIM_BANDS.find((band) => band.key === visibleBand) ?? CLAIM_BANDS[1];
    return (
      <div className="space-y-3">
        <BandSegmentedControl value={visibleBand} onChange={setVisibleBand} />
        <p className="text-xs text-muted-foreground">{activeBand.hint}</p>
        <ul className="divide-y rounded-lg border">
          {bands.lines.map((line) => (
            <li key={line.claimedLotId} className="p-3">
              <div className="flex items-start justify-between gap-3">
                <LotIdentity line={line} />
                <BandCell amount={line[activeBand.key]} align="left" />
              </div>
              <LineFacts line={line} />
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3 text-sm">
          <span className="font-medium">Lot lines subtotal</span>
          <BandCell amount={bands.lineTotals[activeBand.key]} align="left" />
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full">
        <thead className="bg-muted/50">
          <tr>
            <th rowSpan={2} className="p-3 text-left align-bottom font-medium">
              Lot
            </th>
            {CLAIM_BANDS.map((band) => (
              <th key={band.key} className="border-l p-3 text-right font-medium" title={band.hint}>
                {band.label}
              </th>
            ))}
          </tr>
          <tr className="text-xs font-normal text-muted-foreground">
            {CLAIM_BANDS.map((band) => (
              <th key={band.key} className="border-l px-3 pb-2 text-right font-normal">
                {band.hint}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bands.lines.map((line) => (
            <tr key={line.claimedLotId} className="border-t align-top">
              <td className="p-3">
                <LotIdentity line={line} />
                <LineFacts line={line} />
              </td>
              {CLAIM_BANDS.map((band) => (
                <td key={band.key} className="border-l p-3 text-right">
                  <BandCell amount={line[band.key]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t bg-muted/40">
            <th className="p-3 text-left font-medium">Lot lines subtotal</th>
            {CLAIM_BANDS.map((band) => (
              <td key={band.key} className="border-l p-3 text-right">
                <BandCell amount={bands.lineTotals[band.key]} />
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
