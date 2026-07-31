/**
 * Wave C5-a — the one chip that reports a delivery's docket filing state.
 *
 * Lives beside `docketFilingState` rather than in the shell so the tone table
 * and the state machine that picks it cannot drift, and so a second surface
 * showing this state renders the identical chip instead of re-deriving colours.
 *
 * The label always comes from `formatStatusLabel`; nothing here spells a status
 * inline.
 */

import { formatStatusLabel } from '@/lib/statusLabels';
import { cn } from '@/lib/utils';
import { docketChipTone, type DocketFilingStatusKey } from './docketFilingState';

const TONE_CLASS: Record<ReturnType<typeof docketChipTone>, string> = {
  neutral: 'bg-secondary text-muted-foreground',
  warning: 'bg-warning/[.13] text-warning',
  danger: 'bg-destructive/10 text-destructive',
  success: 'bg-success/10 text-success',
  info: 'bg-info/10 text-info',
};

export function DocketChip({
  statusKey,
  className,
}: {
  statusKey: DocketFilingStatusKey;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 font-mono text-[11px] font-semibold',
        TONE_CLASS[docketChipTone(statusKey)],
        className,
      )}
    >
      {formatStatusLabel(statusKey)}
    </span>
  );
}
