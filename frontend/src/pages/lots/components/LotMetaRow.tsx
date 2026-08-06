import { formatActivityLabel } from '@/lib/activityTaxonomy';
import type { Lot } from '../types';

export interface LotMetaRowProps {
  lot: Lot;
}

/**
 * The lot's identifying fields as one inline definition row.
 *
 * This was four bordered stat cards plus a separate created/updated line, which
 * cost ~150px of the first screen to show mostly em-dashes — most lots carry two
 * of the four fields. A field with no value says nothing, so it is omitted
 * entirely rather than rendered as a placeholder.
 */
export function LotMetaRow({ lot }: LotMetaRowProps) {
  const fields: { label: string; value: React.ReactNode }[] = [];

  // Chainage 0 is a real chainage — test for null, never truthiness.
  const chainage =
    lot.chainageStart != null && lot.chainageEnd != null
      ? `${lot.chainageStart} - ${lot.chainageEnd}`
      : (lot.chainageStart ?? lot.chainageEnd);
  if (chainage != null) fields.push({ label: 'Chainage', value: String(chainage) });

  const activity = formatActivityLabel(lot.activityType);
  if (activity) fields.push({ label: 'Activity', value: activity });
  if (lot.layer) fields.push({ label: 'Layer', value: lot.layer });
  if (lot.areaZone) fields.push({ label: 'Area/Zone', value: lot.areaZone });

  // Timestamps fold in here rather than owning their own bordered strip. Date
  // only in the row; the exact instant stays in the tooltip.
  for (const [label, value] of [
    ['Created', lot.createdAt],
    ['Updated', lot.updatedAt],
  ] as const) {
    if (!value) continue;
    fields.push({
      label,
      value: (
        <time dateTime={value} title={new Date(value).toISOString()}>
          {new Date(value).toLocaleString('en-AU', { dateStyle: 'medium' })}
        </time>
      ),
    });
  }

  if (fields.length === 0) return null;

  return (
    <dl className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      {fields.map((field, index) => (
        <div key={field.label} className="flex items-center gap-1.5">
          <dt className="text-muted-foreground">{field.label}</dt>
          <dd className="font-medium text-foreground">{field.value}</dd>
          {/* Separator trails its own item so a wrap never starts a line with it. */}
          {index < fields.length - 1 && (
            <span aria-hidden="true" className="text-muted-foreground/50">
              &middot;
            </span>
          )}
        </div>
      ))}
    </dl>
  );
}
