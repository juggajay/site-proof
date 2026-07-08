import { Check, Link2 } from 'lucide-react';
import { formatAud } from '@/lib/formatAud';
import type { Variation, VariationLot } from '../types';
import { VariationStatusBadge } from './VariationStatusBadge';

interface VariationTableProps {
  variations: Variation[];
  lotsById: Map<string, VariationLot>;
  highlightedVariationId: string | null;
  copiedVariationId: string | null;
  onSelect: (variation: Variation) => void;
  onCopyLink: (variationId: string, variationNumber: string) => void;
}

function getLotNumber(variation: Variation, lotsById: Map<string, VariationLot>): string {
  if (!variation.lotId) return '-';
  return lotsById.get(variation.lotId)?.lotNumber ?? 'Linked lot';
}

export function VariationTable({
  variations,
  lotsById,
  highlightedVariationId,
  copiedVariationId,
  onSelect,
  onCopyLink,
}: VariationTableProps) {
  return (
    <div
      className="overflow-auto rounded-lg border bg-card"
      style={{ maxHeight: 'calc(100vh - 300px)' }}
    >
      <table className="w-full">
        <thead className="sticky top-0 z-10 bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium">VAR #</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Title</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Client ref</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Lot</th>
            <th className="px-4 py-3 text-right text-sm font-medium">Amount</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Updated</th>
            <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {variations.map((variation) => (
            <tr
              key={variation.id}
              data-deep-linked={variation.id === highlightedVariationId ? 'true' : undefined}
              className={variation.id === highlightedVariationId ? 'bg-primary/10' : undefined}
            >
              <td className="px-4 py-3 font-mono text-sm">{variation.variationNumber}</td>
              <td className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => onSelect(variation)}
                  className="max-w-xs truncate text-left font-medium hover:underline"
                >
                  {variation.title}
                </button>
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground">
                {variation.clientReference || '-'}
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground">
                {getLotNumber(variation, lotsById)}
              </td>
              <td className="px-4 py-3 text-right text-sm font-medium">
                {variation.approvedAmount == null ? '-' : formatAud(variation.approvedAmount)}
              </td>
              <td className="px-4 py-3">
                <VariationStatusBadge status={variation.status} />
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground">
                {new Date(variation.updatedAt).toLocaleDateString('en-AU')}
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => onCopyLink(variation.id, variation.variationNumber)}
                    className="rounded border p-1.5 hover:bg-muted"
                    title="Copy link to this variation"
                    aria-label={`Copy link to ${variation.variationNumber}`}
                  >
                    {copiedVariationId === variation.id ? (
                      <Check className="h-3.5 w-3.5 text-success" />
                    ) : (
                      <Link2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelect(variation)}
                    className="rounded border px-3 py-1 text-xs hover:bg-muted"
                  >
                    View
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
