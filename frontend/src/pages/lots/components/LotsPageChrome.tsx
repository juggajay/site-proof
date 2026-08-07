// Presentation-only pieces of the lot register page: the desktop table skeleton
// and the load-failure banner. Split out of LotsPage.tsx — neither touches
// register state, so keeping them inline just buried the page's structure.
//
// The print-media report header and footer that used to live here went with the
// "Print Register" button: with no screen-print action, they dressed an output
// the product no longer offers. Paper comes from Export CSV or a generated PDF.
import { Button } from '@/components/ui/button';

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
