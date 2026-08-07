import { useEffect, useRef, useState } from 'react';
import { Loader2, RotateCcw, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { fetchDesignModelFragments } from '@/lib/models/designModelsApi';
import { extractErrorMessage } from '@/lib/errorHandling';
import { logError } from '@/lib/logger';
import { createFragmentsViewer, type FragmentsViewer, type PickedElement } from './fragmentsViewer';

type CanvasState = 'downloading' | 'preparing' | 'ready' | 'error';

interface ModelViewerCanvasProps {
  projectId: string;
  modelId: string;
  versionId: string;
}

/**
 * The 3D surface: downloads the version's fragments through the authed API,
 * boots the ThatOpen viewer, and owns the in-canvas affordances (reset view,
 * tap-to-inspect). Mounted lazily — and only after the mobile budget check —
 * so the vendor-3d chunk is never fetched for a blocked or non-viewer visit.
 */
export function ModelViewerCanvas({ projectId, modelId, versionId }: ModelViewerCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<FragmentsViewer | null>(null);
  const [state, setState] = useState<CanvasState>('downloading');
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<PickedElement | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    const abort = new AbortController();
    let viewer: FragmentsViewer | null = null;

    (async () => {
      setState('downloading');
      setError(null);
      setPicked(null);
      const buffer = await fetchDesignModelFragments(projectId, modelId, versionId, abort.signal);
      if (cancelled) return;
      setState('preparing');
      viewer = await createFragmentsViewer(container);
      if (cancelled) {
        viewer.dispose();
        return;
      }
      viewerRef.current = viewer;
      await viewer.loadModel(buffer, versionId);
      if (cancelled) return;
      setState('ready');
    })().catch((err) => {
      if (cancelled || abort.signal.aborted) return;
      logError('3D viewer failed to load model:', err);
      setError(extractErrorMessage(err, 'The 3D view could not be loaded.'));
      setState('error');
    });

    return () => {
      cancelled = true;
      abort.abort();
      viewerRef.current = null;
      viewer?.dispose();
      // The renderer appends its canvas to the container; clear it so a
      // re-mount (retry) starts from an empty element.
      container.replaceChildren();
    };
  }, [projectId, modelId, versionId, attempt]);

  const handleClick = async (event: React.MouseEvent<HTMLDivElement>) => {
    const viewer = viewerRef.current;
    if (!viewer || state !== 'ready') return;
    try {
      setPicked(await viewer.pickAt(event.clientX, event.clientY));
    } catch (err) {
      logError('3D viewer element inspection failed:', err);
    }
  };

  return (
    <div className="relative h-full w-full" data-viewer-state={state}>
      <div ref={containerRef} className="h-full w-full" onClick={handleClick} />

      {(state === 'downloading' || state === 'preparing') && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/80">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {state === 'downloading' ? 'Downloading model…' : 'Preparing 3D view…'}
          </p>
        </div>
      )}

      {state === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <div className="max-w-md rounded-lg border bg-card p-6 text-center shadow-sm">
            <h3 className="text-base font-semibold">3D view unavailable</h3>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              onClick={() => setAttempt((current) => current + 1)}
            >
              Try again
            </Button>
          </div>
        </div>
      )}

      {state === 'ready' && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="absolute bottom-4 right-4 shadow-sm"
          onClick={() => void viewerRef.current?.resetView()}
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          Reset view
        </Button>
      )}

      {picked && (
        <div className="absolute right-4 top-4 flex max-h-[70%] w-80 max-w-[calc(100%-2rem)] flex-col overflow-hidden rounded-lg border bg-card shadow-md">
          <div className="flex items-start justify-between gap-2 border-b px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{picked.name ?? 'Element'}</p>
              <p className="text-xs text-muted-foreground">Tapped element properties</p>
            </div>
            <button
              type="button"
              aria-label="Close element properties"
              className="rounded p-1 text-muted-foreground hover:bg-muted"
              onClick={() => setPicked(null)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="overflow-y-auto px-4 py-3">
            {Object.keys(picked.psets).length === 0 ? (
              <p className="text-sm text-muted-foreground">No property sets on this element.</p>
            ) : (
              Object.entries(picked.psets).map(([psetName, props]) => (
                <div key={psetName} className="mb-3 last:mb-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {psetName}
                  </p>
                  <dl className="mt-1 space-y-1">
                    {Object.entries(props).map(([propName, value]) => (
                      <div key={propName} className="flex justify-between gap-3 text-sm">
                        <dt className="min-w-0 truncate text-muted-foreground">{propName}</dt>
                        <dd className="text-right font-medium">{String(value ?? '—')}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
