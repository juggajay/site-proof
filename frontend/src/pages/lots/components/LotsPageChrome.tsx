// Presentation-only pieces of the lot register page: the print-media header and
// footer, the desktop table skeleton, and the load-failure banner. Split out of
// LotsPage.tsx — none of them touch register state, so keeping them inline just
// buried the page's actual structure.
import { Button } from '@/components/ui/button';

/** Report chrome that only exists on the printed page. */
export function LotsPrintHeader({ projectName }: { projectName: string }) {
  return (
    <>
      <div className="hidden print:block report-header mb-6 text-center">
        <h1 className="text-2xl font-bold mb-2">Lot Register</h1>
        {projectName && <p className="text-muted-foreground mb-1">{projectName}</p>}
        <div className="text-sm text-muted-foreground">
          Generated:{' '}
          {new Date().toLocaleDateString('en-AU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
        <div className="text-xs text-muted-foreground mt-2">CIVOS - Quality Management System</div>
      </div>

      <div className="hidden print:block report-footer fixed bottom-0 left-0 right-0 text-center text-xs text-muted-foreground py-2 bg-card border-t">
        &copy; {new Date().getFullYear()} CIVOS - Confidential
      </div>
    </>
  );
}

/**
 * Desktop table skeleton. Mobile and card view render LotMobileList with
 * isLoading, which shows its own layout-matched card skeleton instead.
 */
export function LotTableSkeleton() {
  return (
    <div className="rounded-lg border overflow-hidden" role="status" aria-label="Loading lots">
      <div className="bg-muted/50 border-b px-4 py-3">
        <div className="flex gap-4">
          {[16, 96, 128, 80, 80, 96, 80].map((w, i) => (
            <div key={i} className="h-4 rounded bg-muted animate-pulse" style={{ width: w }} />
          ))}
        </div>
      </div>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="px-4 py-3 border-b border-border last:border-b-0">
          <div className="flex gap-4 items-center">
            {[16, 80, 160, 64, 80, 96, 80].map((w, j) => (
              <div
                key={j}
                className={`h-4 rounded bg-muted animate-pulse ${j === 4 ? 'rounded-full h-6' : ''}`}
                style={{ width: w }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function LotsLoadErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive"
      role="alert"
      aria-live="assertive"
    >
      <p className="font-medium">Could not load lots</p>
      <p className="mt-1 text-sm">{message}</p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3 border-destructive/30 bg-card text-destructive hover:bg-destructive/10"
        onClick={onRetry}
      >
        Try again
      </Button>
    </div>
  );
}
