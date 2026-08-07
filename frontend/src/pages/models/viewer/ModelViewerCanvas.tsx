import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, Loader2, RotateCcw, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { fetchDesignModelFragments, fetchModelElementLinks } from '@/lib/models/designModelsApi';
import { extractErrorMessage } from '@/lib/errorHandling';
import { logError } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import { DEFAULT_APP_TIME_ZONE, formatDateKey } from '@/lib/localDate';
import { useCurrentProjectRole } from '@/hooks/useCurrentProjectRole';
import { canManageProjectForRole } from '@/pages/projects/settings/projectPageAccess';
import { historicalStatusByLot, useLotStatusTimeline } from '@/pages/lots/map/statusTimelineData';
import { createFragmentsViewer, type FragmentsViewer, type PickedElement } from './fragmentsViewer';
import { buildPaintPlan, currentStatusByLot, type PaintPlan } from './playbackPaint';
import { PlaybackBar } from './PlaybackBar';

type CanvasState = 'downloading' | 'preparing' | 'ready' | 'error';

interface ModelViewerCanvasProps {
  projectId: string;
  modelId: string;
  versionId: string;
}

/**
 * 4D playback state + paint application. The join and bucketing are pure
 * (`playbackPaint.ts`); this hook owns the queries (timeline shares the 2D
 * scrubber's cache key by construction), the guid index, and serialised
 * repaints (a scrub drag fires faster than the async highlight pass — only the
 * latest plan is ever applied, never interleaved).
 */
function usePlayback(
  projectId: string,
  modelId: string,
  versionId: string,
  viewerRef: React.RefObject<FragmentsViewer | null>,
  viewerReady: boolean,
) {
  const todayKey = formatDateKey(new Date(), DEFAULT_APP_TIME_ZONE);
  const [open, setOpen] = useState(false);
  const [dateKey, setDateKey] = useState(todayKey);
  const [compare, setCompare] = useState(false);
  const [guidIndex, setGuidIndex] = useState<Map<string, number> | null>(null);

  // A different version = a different fragments model = new localIds.
  useEffect(() => setGuidIndex(null), [versionId]);

  const timelineQuery = useLotStatusTimeline(projectId, open);
  const linksQuery = useQuery({
    queryKey: queryKeys.modelElementLinks(versionId),
    queryFn: () => fetchModelElementLinks(projectId, modelId, versionId),
    enabled: open,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!open || !viewerReady || guidIndex) return;
    let cancelled = false;
    viewerRef.current
      ?.getElementGuidIndex()
      .then((index) => {
        if (!cancelled) setGuidIndex(index);
      })
      .catch((err) => logError('4D playback failed to index element GUIDs:', err));
    return () => {
      cancelled = true;
    };
  }, [open, viewerReady, guidIndex, viewerRef]);

  const timeline = timelineQuery.data;
  const links = linksQuery.data;

  const plan: PaintPlan | null = useMemo(() => {
    if (!open || !timeline || !links) return null;
    const statusAtDate = historicalStatusByLot(timeline, dateKey);
    return buildPaintPlan(
      links.links,
      guidIndex ?? new Map(),
      statusAtDate,
      compare ? currentStatusByLot(timeline.lots) : undefined,
    );
  }, [open, timeline, links, guidIndex, dateKey, compare]);

  // Serialised painter: apply the newest plan; coalesce anything that arrived
  // while a pass was in flight. On close, restore original materials.
  const paintingRef = useRef(false);
  const latestPlanRef = useRef<PaintPlan | null>(null);
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !viewerReady) return;
    latestPlanRef.current = open ? plan : null;
    if (paintingRef.current) return;
    paintingRef.current = true;
    (async () => {
      // Loop until the latest intent has been applied.
      let applied: PaintPlan | null | undefined;
      while (applied !== latestPlanRef.current) {
        applied = latestPlanRef.current;
        if (applied) await viewer.applyPaint(applied.layers);
        else await viewer.clearPaint();
      }
    })()
      .catch((err) => logError('4D playback repaint failed:', err))
      .finally(() => {
        paintingRef.current = false;
      });
  }, [open, plan, viewerReady, viewerRef]);

  return {
    open,
    setOpen,
    todayKey,
    dateKey,
    setDateKey,
    compare,
    setCompare,
    plan,
    timelineQuery,
    linksQuery,
  };
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

  const role = useCurrentProjectRole(projectId);
  const playback = usePlayback(projectId, modelId, versionId, viewerRef, state === 'ready');

  // Local-only test hook: the real-3D Playwright smoke reads the model's GUIDs
  // to mock element-links against real geometry. Dev server only — never built.
  useEffect(() => {
    if (!import.meta.env.DEV || state !== 'ready') return;
    const debugWindow = window as { __civosViewerDebug?: { listGuids(): Promise<string[]> } };
    debugWindow.__civosViewerDebug = {
      listGuids: async () => [
        ...((await viewerRef.current?.getElementGuidIndex()) ?? new Map<string, number>()).keys(),
      ],
    };
    return () => {
      delete debugWindow.__civosViewerDebug;
    };
  }, [state]);

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

      {state === 'ready' && !playback.open && (
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

      {!playback.open && state !== 'error' && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="absolute bottom-4 left-4 shadow-sm"
          onClick={() => playback.setOpen(true)}
          data-testid="playback-toggle"
        >
          <History className="mr-1.5 h-3.5 w-3.5" />
          QA playback
        </Button>
      )}

      {playback.open && (
        <div className="pointer-events-none absolute inset-x-4 bottom-4">
          <PlaybackBar
            projectId={projectId}
            earliestKey={
              playback.timelineQuery.data?.earliest
                ? formatDateKey(new Date(playback.timelineQuery.data.earliest))
                : null
            }
            todayKey={playback.todayKey}
            dateKey={playback.dateKey}
            onDateChange={playback.setDateKey}
            compare={playback.compare}
            onCompareChange={playback.setCompare}
            plan={playback.plan}
            linkCounts={playback.linksQuery.data?.counts ?? null}
            canLinkLots={canManageProjectForRole(role)}
            isLoading={playback.timelineQuery.isLoading || playback.linksQuery.isLoading}
            error={playback.timelineQuery.error ?? playback.linksQuery.error}
            onRetry={() => {
              void playback.timelineQuery.refetch();
              void playback.linksQuery.refetch();
            }}
            onResetView={() => void viewerRef.current?.resetView()}
            onClose={() => playback.setOpen(false)}
          />
        </div>
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
