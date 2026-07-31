/**
 * Wave C5-c — the deliveries linked to this lot.
 *
 * A read surface over C5.1's `GET /api/lots/:lotId/deliveries`. It states what
 * material went into the lot and whether the docket that proves it has been
 * filed; it does not compute a value, a rate or a total, because a delivery
 * record is evidence and CIVOS does not price evidence.
 */

import { useState } from 'react';
import { Check, Copy, FileText } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { LotDelivery } from '../lib/surveyRecords';

/** Rows shown before the reader has to ask for the rest (§7 scale gate). */
const INITIAL_ROW_LIMIT = 10;

function formatQuantity(delivery: LotDelivery): string {
  if (delivery.quantity === null || delivery.quantity === '') return '—';
  return [delivery.quantity, delivery.unit].filter(Boolean).join(' ');
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-AU', { dateStyle: 'medium' });
}

/**
 * Batch / mix refs are machine strings ("MIX-32-14-BCB") that a user needs to
 * quote back to a supplier verbatim. Monospaced so characters are
 * distinguishable, truncated so one long ref cannot blow the column out, and
 * copyable so nobody has to retype it from a tooltip.
 */
function BatchRef({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is permission-gated and absent over plain HTTP. The `title`
      // still shows the full value, so the user is never stuck.
    }
  };

  return (
    <button
      type="button"
      onClick={() => void copy()}
      title={value}
      aria-label={copied ? `${value} copied` : `Copy batch reference ${value}`}
      className="flex w-full min-w-0 items-center gap-1.5 text-left font-mono text-xs text-foreground hover:text-primary"
    >
      <span className="truncate">{value}</span>
      {copied ? (
        <Check aria-hidden="true" className="h-3 w-3 shrink-0 text-success" />
      ) : (
        <Copy aria-hidden="true" className="h-3 w-3 shrink-0 text-muted-foreground" />
      )}
    </button>
  );
}

export function LotDeliveriesTable({ deliveries }: { deliveries: LotDelivery[] }) {
  const [showAll, setShowAll] = useState(false);

  const visible = showAll ? deliveries : deliveries.slice(0, INITIAL_ROW_LIMIT);
  const hidden = deliveries.length - visible.length;
  // Counted over ALL deliveries, not the visible page — a "2 without a docket"
  // that silently means "2 of the 10 you can see" is worse than no count.
  const notFiled = deliveries.filter((delivery) => !delivery.docketDocument).length;

  return (
    <div>
      <div className="overflow-x-auto">
        {/* `table-fixed` so column widths come from the header and one long
            supplier name cannot reflow every other column. */}
        <table className="w-full table-fixed text-sm">
          <thead>
            <tr className="border-t border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="w-28 px-4 py-2 font-medium">
                Date
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                Material
              </th>
              <th scope="col" className="w-44 px-4 py-2 font-medium">
                Supplier
              </th>
              <th scope="col" className="w-24 px-4 py-2 text-right font-medium">
                Qty
              </th>
              <th scope="col" className="w-36 px-4 py-2 font-medium">
                Batch / mix ref
              </th>
              <th scope="col" className="w-44 px-4 py-2 font-medium">
                Docket
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((delivery) => (
              <tr key={delivery.id} className="border-t border-border align-top">
                <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                  {formatDate(delivery.diary?.date)}
                </td>
                <td className="px-4 py-2.5 font-medium text-foreground">
                  <span className="line-clamp-2">{delivery.description ?? '—'}</span>
                </td>
                <td className="px-4 py-2.5 text-foreground">
                  {/* Two lines, then ellipsis. Australian supplier names run
                      long ("Hanson Quarry Narangba") and the full string stays
                      available on hover. */}
                  <span className="line-clamp-2" title={delivery.supplier ?? undefined}>
                    {delivery.supplier ?? '—'}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs text-foreground">
                  {formatQuantity(delivery)}
                </td>
                <td className="min-w-0 px-4 py-2.5">
                  {delivery.batchRef ? (
                    <BatchRef value={delivery.batchRef} />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  {delivery.docketDocument ? (
                    <span className="flex items-center gap-1.5 text-xs text-foreground">
                      <FileText aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate font-mono" title={delivery.docketDocument.filename}>
                        {delivery.docketDocument.filename}
                      </span>
                    </span>
                  ) : (
                    // Not "NO DOCKET". The docket almost certainly exists on
                    // paper in somebody's ute — what is missing is the filing,
                    // and the label should say the thing that is actually true.
                    <span className="inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      Not filed in CIVOS
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-xs text-muted-foreground',
        )}
      >
        <span>
          {deliveries.length === 1 ? '1 delivery' : `${deliveries.length} deliveries`}
          {notFiled > 0 && ` · ${notFiled} without a docket filed in CIVOS`}
        </span>
        {hidden > 0 && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="font-medium text-primary hover:underline"
          >
            Show remaining {hidden}
          </button>
        )}
      </div>
    </div>
  );
}
