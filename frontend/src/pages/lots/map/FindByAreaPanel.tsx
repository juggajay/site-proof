import { Link } from 'react-router-dom';
import { MapPin, X } from 'lucide-react';

import { SecureDocumentImage } from '@/components/documents/SecureDocumentImage';
import { getLotStatusBadgeClass } from '@/lib/lotStatusOverview';
import { formatStatusLabel } from '@/lib/statusLabels';
import { cn } from '@/lib/utils';

import type { SpatialSearchResult } from './spatialSearchData';

interface FindByAreaPanelProps {
  projectId: string;
  result: SpatialSearchResult | undefined;
  isLoading: boolean;
  error: unknown;
  isMobile: boolean;
  onClear: () => void;
  onRetry: () => void;
}

function TruncatedNote({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <p className="px-3 py-1.5 text-xs text-muted-foreground">
      Showing the first 500 results — draw a smaller area to narrow the search.
    </p>
  );
}

function chainageLabel(start: number | null, end: number | null): string | null {
  if (start == null && end == null) return null;
  const fmt = (n: number) => Math.round(n).toLocaleString();
  if (start != null && end != null) return `Ch ${fmt(start)}–${fmt(end)}`;
  return `Ch ${fmt((start ?? end) as number)}`;
}

export function FindByAreaPanel({
  projectId,
  result,
  isLoading,
  error,
  isMobile,
  onClear,
  onRetry,
}: FindByAreaPanelProps) {
  const containerClass = isMobile
    ? 'absolute inset-x-0 bottom-0 max-h-[70%] rounded-t-2xl border-t shadow-2xl'
    : 'absolute inset-y-0 right-0 w-80 max-w-[85%] border-l shadow-xl';

  return (
    <div
      className={cn('z-[1000] flex flex-col bg-background pointer-events-auto', containerClass)}
      data-testid="find-by-area-panel"
      role="dialog"
      aria-label="Find by area results"
    >
      <div className="flex items-center justify-between border-b px-3 py-2">
        <h3 className="text-sm font-semibold">Results in area</h3>
        <button
          type="button"
          onClick={onClear}
          className="rounded p-1 text-muted-foreground hover:bg-muted"
          aria-label="Clear search"
          data-testid="find-by-area-clear"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading && (
          <p className="p-4 text-sm text-muted-foreground" role="status">
            Searching…
          </p>
        )}

        {!isLoading && error != null && (
          <div className="p-4 text-sm" role="alert">
            <p className="font-medium text-destructive">Search failed</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
            >
              Try again
            </button>
          </div>
        )}

        {!isLoading && !error && result && (
          <>
            {/* Lots */}
            <section data-testid="find-by-area-lots">
              <header className="sticky top-0 bg-muted/40 px-3 py-1.5 text-xs font-medium">
                Lots ({result.lots.length})
              </header>
              <TruncatedNote show={result.lotsTruncated} />
              {result.lots.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">No lots in this area.</p>
              ) : (
                <ul>
                  {result.lots.map((lot) => (
                    <li key={lot.lotId} className="border-b">
                      <Link
                        to={`/projects/${encodeURIComponent(projectId)}/lots/${encodeURIComponent(
                          lot.lotId,
                        )}`}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-muted"
                        data-testid={`find-by-area-lot-${lot.lotId}`}
                      >
                        <span className="font-medium">{lot.lotNumber}</span>
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs',
                            getLotStatusBadgeClass(lot.status),
                          )}
                        >
                          {formatStatusLabel(lot.status)}
                        </span>
                        <span className="ml-auto truncate text-xs text-muted-foreground">
                          {[lot.activityType, chainageLabel(lot.chainageStart, lot.chainageEnd)]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Photos */}
            <section data-testid="find-by-area-photos">
              <header className="sticky top-0 bg-muted/40 px-3 py-1.5 text-xs font-medium">
                Photos ({result.photos.length})
              </header>
              <TruncatedNote show={result.photosTruncated} />
              {result.photos.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">No photos in this area.</p>
              ) : (
                <div className="grid grid-cols-3 gap-1 p-2">
                  {result.photos.map((photo) => (
                    <Link
                      key={photo.id}
                      to={`/projects/${encodeURIComponent(projectId)}/documents${
                        photo.lotId ? `?lotId=${encodeURIComponent(photo.lotId)}` : ''
                      }`}
                      className="group relative aspect-square overflow-hidden rounded border"
                      title={photo.caption ?? photo.filename}
                      data-testid={`find-by-area-photo-${photo.id}`}
                    >
                      <SecureDocumentImage
                        documentId={photo.id}
                        variant="thumb"
                        alt={photo.caption ?? photo.filename}
                        className="h-full w-full object-cover"
                      />
                    </Link>
                  ))}
                </div>
              )}
            </section>

            {/* Test results */}
            <section data-testid="find-by-area-tests">
              <header className="sticky top-0 bg-muted/40 px-3 py-1.5 text-xs font-medium">
                Test results ({result.testResults.length})
              </header>
              <TruncatedNote show={result.testResultsTruncated} />
              {result.testResults.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">
                  No test results in this area.
                </p>
              ) : (
                <ul>
                  {result.testResults.map((tr) => (
                    <li key={tr.id} className="border-b">
                      <Link
                        to={`/projects/${encodeURIComponent(projectId)}/tests?test=${encodeURIComponent(
                          tr.id,
                        )}`}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-muted"
                        data-testid={`find-by-area-test-${tr.id}`}
                      >
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="font-medium">{tr.testType}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatStatusLabel(tr.status)}
                        </span>
                        <span className="ml-auto truncate text-xs text-muted-foreground">
                          {tr.lotNumber ?? tr.testRequestNumber ?? ''}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

export default FindByAreaPanel;
