import { FileSpreadsheet } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { ImportBatchSummary, ImportBatchStatus } from './importData';

interface ImportPanelProps {
  batches: ImportBatchSummary[];
  /** Omitted where the panel is shown INSIDE an import flow — there is nothing
   *  to start from there, only earlier batches to resume or roll back. */
  onStartImport?: () => void;
  onResume: (batchId: string) => void;
  onRollback: (proposalId: string) => void;
  rollbackBusy: boolean;
  title?: string;
  description?: string;
  ctaLabel?: string;
}

const STATUS_LABEL: Record<ImportBatchStatus, string> = {
  uploaded: 'Reading',
  parsed: 'Ready to map',
  mapped: 'Ready to map',
  dry_run: 'Review ready',
  review: 'Review ready',
  applied: 'Imported',
  rolled_back: 'Rolled back',
  cancelled: 'Discarded',
  failed: 'Could not read',
};

const STATUS_CHIP: Record<ImportBatchStatus, string> = {
  uploaded: 'bg-muted text-muted-foreground',
  parsed: 'bg-primary/10 text-primary',
  mapped: 'bg-primary/10 text-primary',
  dry_run: 'bg-primary/10 text-primary',
  review: 'bg-primary/10 text-primary',
  applied: 'bg-success/10 text-success',
  rolled_back: 'bg-muted text-muted-foreground',
  cancelled: 'bg-muted text-muted-foreground',
  failed: 'bg-destructive/10 text-destructive',
};

const OPEN_STATUSES: ImportBatchStatus[] = ['parsed', 'mapped', 'dry_run', 'review'];

/**
 * The migration rail: bring an existing ITP library across from a spreadsheet.
 * Same quiet-card grammar as the setup copilot above it — status chip, one
 * action, roll-back offered only once a batch has actually been applied.
 */
export function ImportPanel({
  batches,
  onStartImport,
  onResume,
  onRollback,
  rollbackBusy,
  title = 'Bring your ITPs across',
  description = 'Import an existing ITP spreadsheet. You see every ITP beside its source sheet, and the counts, before anything is written.',
  ctaLabel = 'Import a spreadsheet',
}: ImportPanelProps) {
  return (
    <section aria-label={title} className="mt-6 rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b p-4">
        <FileSpreadsheet className="h-4 w-4 text-primary" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
        {onStartImport && (
          <Button type="button" size="sm" onClick={onStartImport}>
            {ctaLabel}
          </Button>
        )}
      </div>

      {batches.length > 0 && (
        <ol className="divide-y">
          {batches.map((batch) => (
            <li key={batch.id} className="flex items-center gap-4 p-4">
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="min-w-0 truncate text-sm font-medium">
                    {batch.sourceFileName ?? 'Spreadsheet'}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CHIP[batch.status]}`}
                  >
                    {STATUS_LABEL[batch.status]}
                  </span>
                </span>
                {batch.failedReason && (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {batch.failedReason}
                  </span>
                )}
              </span>

              {OPEN_STATUSES.includes(batch.status) && (
                <Button type="button" size="sm" onClick={() => onResume(batch.id)}>
                  Review
                </Button>
              )}
              {batch.status === 'applied' && batch.proposalId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={rollbackBusy}
                  onClick={() => onRollback(batch.proposalId!)}
                >
                  Roll back
                </Button>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
