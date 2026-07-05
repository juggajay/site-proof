import { CheckCircle2, ClipboardCheck } from 'lucide-react';
import { formatStatusLabel } from '@/lib/statusLabels';

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-';

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '-';

  return new Intl.DateTimeFormat('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '-';

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '-';

  return new Intl.DateTimeFormat('en-AU', {
    dateStyle: 'medium',
  }).format(date);
}

// A hold point reads as released once it is either released or completed.
export function isHoldPointReleased(status: string | null | undefined): boolean {
  return status === 'released' || status === 'completed';
}

export function StatusPill({ status }: { status: string }) {
  const released = isHoldPointReleased(status);
  const label = formatStatusLabel(status);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
        released ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
      }`}
    >
      {released ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : (
        <ClipboardCheck className="h-3.5 w-3.5" />
      )}
      {label}
    </span>
  );
}
