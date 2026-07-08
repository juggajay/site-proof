import { formatStatusLabel } from '@/lib/statusLabels';
import { cn } from '@/lib/utils';
import type { VariationStatus } from '../types';

const STATUS_BADGE_CLASSES: Record<VariationStatus, string> = {
  proposed: 'bg-muted text-muted-foreground',
  submitted: 'bg-primary/10 text-primary',
  approved: 'bg-success/10 text-success',
  rejected: 'bg-destructive/10 text-destructive',
  claimed: 'bg-muted text-foreground',
};

export function VariationStatusBadge({ status }: { status: VariationStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium',
        STATUS_BADGE_CLASSES[status],
      )}
    >
      {formatStatusLabel(status)}
    </span>
  );
}
