// Wave D `D1c.3` — the job list: progress, download, cancel, and honest
// end states (§4.7.5, §10.5).
//
// EVERY END STATE READS AS ITSELF. A failed job shows the server's
// `lastFailureReason`; a cancelled job says cancelled; an expired archive says
// it expired and what to do — expiry is the retention policy working, not a
// fault, and rendering it as an error teaches people to distrust the screen.

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';
import { formatStatusLabel } from '@/lib/statusLabels';
import {
  describeScope,
  formatArchiveBytes,
  isHandoverExportActive,
  isHandoverExportExpired,
  type HandoverExportRow,
} from '../handoverExportData';

const STATUS_CHIP_CLASSES: Record<string, string> = {
  queued: 'bg-muted text-muted-foreground',
  snapshotting: 'bg-muted text-muted-foreground',
  processing: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
  complete: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200',
  failed: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
  cancelled: 'bg-muted text-muted-foreground',
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-AU', { dateStyle: 'medium' });
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' });
}

function StatusChip({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium',
        STATUS_CHIP_CLASSES[status] ?? 'bg-muted text-muted-foreground',
      )}
    >
      {formatStatusLabel(status)}
    </span>
  );
}

interface HandoverExportListProps {
  rows: HandoverExportRow[];
  isLoading: boolean;
  downloadingId: string | null;
  cancellingId: string | null;
  onDownload: (row: HandoverExportRow) => void;
  onCancel: (row: HandoverExportRow) => void;
}

export function HandoverExportList({
  rows,
  isLoading,
  downloadingId,
  cancellingId,
  onDownload,
  onCancel,
}: HandoverExportListProps) {
  const isMobile = useIsMobile();
  const [pendingCancel, setPendingCancel] = useState<HandoverExportRow | null>(null);

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading handover exports…
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No handover export has been requested for this project yet.
      </p>
    );
  }

  return (
    <>
      <ul className={cn('space-y-3', !isMobile && 'divide-y divide-border space-y-0')}>
        {rows.map((row) => {
          const active = isHandoverExportActive(row);
          const expired = isHandoverExportExpired(row);
          const total = row.totalMembers ?? 0;
          const percent = total > 0 ? Math.round((row.processedMembers / total) * 100) : 0;

          return (
            <li
              key={row.id}
              className={cn(
                isMobile
                  ? 'rounded-lg border border-border bg-card p-3'
                  : 'flex flex-wrap items-center gap-4 py-3',
              )}
            >
              <div className={cn('min-w-0', !isMobile && 'flex-1')}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {describeScope(row.scope)}
                  </span>
                  <StatusChip status={row.status} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Requested{' '}
                  <time dateTime={row.requestedAt}>{formatDateTime(row.requestedAt)}</time>
                </p>

                {active && (
                  <div className="mt-2 max-w-sm">
                    <span className="text-xs text-muted-foreground">
                      {row.processedMembers} of {total} files
                    </span>
                    <div
                      className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-valuenow={percent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="Archive progress"
                    >
                      <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                )}

                {row.status === 'failed' && row.lastFailureReason && (
                  <p className="mt-2 text-xs text-red-700 dark:text-red-300">
                    {row.lastFailureReason}
                  </p>
                )}

                {row.status === 'cancelled' && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Cancelled before the archive was written. Nothing was stored.
                  </p>
                )}

                {expired && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Archive expired {formatDate(row.expiresAt!)} — request again to get a fresh one.
                  </p>
                )}

                {row.status === 'complete' && !expired && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {formatArchiveBytes(row.fileSize)}
                    {row.expiresAt ? ` · available until ${formatDate(row.expiresAt)}` : ''}
                  </p>
                )}
              </div>

              <div className="mt-3 flex shrink-0 gap-2 sm:mt-0">
                {row.status === 'complete' && !expired && (
                  <button
                    type="button"
                    onClick={() => onDownload(row)}
                    disabled={downloadingId === row.id}
                    className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    <Download className="h-4 w-4" />
                    {downloadingId === row.id ? 'Downloading…' : 'Download archive'}
                  </button>
                )}
                {active && (
                  <button
                    type="button"
                    onClick={() => setPendingCancel(row)}
                    disabled={cancellingId === row.id}
                    className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    Cancel export
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={pendingCancel !== null}
        title="Cancel this handover export?"
        description="The job stops and nothing is stored. You can request the same scope again at any time."
        confirmLabel="Cancel export"
        cancelLabel="Keep going"
        variant="destructive"
        onCancel={() => setPendingCancel(null)}
        onConfirm={() => {
          if (pendingCancel) onCancel(pendingCancel);
          setPendingCancel(null);
        }}
      />
    </>
  );
}
