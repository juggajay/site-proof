import type { HoldPoint } from '../types';

export function formatHoldPointDate(value: string | null | undefined): string {
  if (!value) return '-';

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '-';

  return date.toLocaleDateString('en-AU');
}

/** Check if HP is overdue (Feature #190) */
export function isOverdue(hp: HoldPoint): boolean {
  if (hp.status !== 'notified') return false;
  if (!hp.scheduledDate) return false;
  const scheduled = new Date(hp.scheduledDate);
  if (!Number.isFinite(scheduled.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return scheduled < today;
}

export function getStatusBadge(status: string): string {
  const styles: Record<string, string> = {
    pending: 'bg-muted text-muted-foreground',
    notified: 'bg-warning/10 text-warning',
    released: 'bg-muted text-muted-foreground',
  };
  return styles[status] || styles.pending;
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Pending',
    notified: 'Awaiting Release',
    released: 'Released',
  };
  return labels[status] || status;
}
