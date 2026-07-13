import { Suspense, lazy, useEffect, useState } from 'react';
import { Loader2, Undo2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';
import { extractErrorMessage } from '@/lib/errorHandling';
import { logError } from '@/lib/logger';
import { fetchPlanSheet, useUpdatePlanSheet, type PlanSheetListItem } from './planSheetsData';
import { usePlanSheetImage } from './usePlanSheetImage';
import type { ImagePoint } from './PlanSheetImageMap';

// Same lazy Leaflet split as the registration modal.
const PlanSheetImageMap = lazy(() =>
  import('./PlanSheetImageMap').then((m) => ({ default: m.PlanSheetImageMap })),
);

interface PlanSheetPerimeterModalProps {
  projectId: string;
  sheet: PlanSheetListItem;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Draw-once perimeter clip for a plan sheet: click to add polygon vertices over
 * the drawing, drag to adjust, undo/clear, then save (≥3 points) or remove. The
 * ring is stored in image pixel space and clips the overlay on the lot map.
 */
export function PlanSheetPerimeterModal({
  projectId,
  sheet,
  onClose,
  onSaved,
}: PlanSheetPerimeterModalProps) {
  const [points, setPoints] = useState<ImagePoint[]>([]);
  const [hasPerimeter, setHasPerimeter] = useState(false);
  const [loadingSheet, setLoadingSheet] = useState(true);
  const { url: imageUrl, error: imageError } = usePlanSheetImage(projectId, sheet.id);
  const updateMutation = useUpdatePlanSheet(projectId);

  useEffect(() => {
    let cancelled = false;
    setLoadingSheet(true);
    void (async () => {
      try {
        const full = await fetchPlanSheet(projectId, sheet.id);
        if (cancelled) return;
        setPoints((full.perimeter ?? []).map(([px, py]) => ({ px, py })));
        setHasPerimeter((full.perimeter ?? []).length > 0);
      } catch (err) {
        logError('Failed to load plan sheet perimeter:', err);
      } finally {
        if (!cancelled) setLoadingSheet(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, sheet.id]);

  const addPoint = (point: ImagePoint) => setPoints((prev) => [...prev, point]);
  const movePoint = (index: number, point: ImagePoint) =>
    setPoints((prev) => prev.map((p, i) => (i === index ? point : p)));
  const undo = () => setPoints((prev) => prev.slice(0, -1));
  const clear = () => setPoints([]);

  const canSave = points.length >= 3 && !updateMutation.isLoading;

  const handleSave = async () => {
    if (!canSave) return;
    try {
      await updateMutation.mutateAsync({
        id: sheet.id,
        input: { perimeter: points.map((p) => [p.px, p.py] as [number, number]) },
      });
      toast({ title: 'Perimeter saved', description: `${sheet.name} will clip to its outline.` });
      onSaved();
      onClose();
    } catch (err) {
      logError('Failed to save perimeter:', err);
      toast({
        title: 'Could not save perimeter',
        description: extractErrorMessage(err, 'Please try again.'),
        variant: 'error',
      });
    }
  };

  const handleRemove = async () => {
    try {
      await updateMutation.mutateAsync({ id: sheet.id, input: { perimeter: null } });
      toast({ title: 'Perimeter removed', description: `${sheet.name} is no longer clipped.` });
      onSaved();
      onClose();
    } catch (err) {
      logError('Failed to remove perimeter:', err);
      toast({
        title: 'Could not remove perimeter',
        description: extractErrorMessage(err, 'Please try again.'),
        variant: 'error',
      });
    }
  };

  return (
    // Full-screen editor — same intended pattern as the registration modal.
    <div
      className="fixed inset-0 z-[2000] flex flex-col bg-background"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 className="text-lg font-semibold">Perimeter for &quot;{sheet.name}&quot;</h2>
          <p className="text-xs text-muted-foreground">
            Click the drawing to trace the area to keep. Everything outside is hidden on the map.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={updateMutation.isLoading}
        >
          Close
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="relative min-h-[300px] flex-1 bg-muted">
          {imageError ? (
            <div className="flex h-full items-center justify-center p-6 text-sm text-destructive">
              Could not load the sheet image.
            </div>
          ) : imageUrl ? (
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading map…
                </div>
              }
            >
              <PlanSheetImageMap
                imageUrl={imageUrl}
                imageWidth={sheet.imageWidth}
                imageHeight={sheet.imageHeight}
                points={points}
                onAddPoint={addPoint}
                onMovePoint={movePoint}
                polygon
              />
            </Suspense>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading image…
            </div>
          )}
        </div>

        <div className="w-full overflow-y-auto border-t p-4 md:w-80 md:border-l md:border-t-0">
          <h3 className="mb-2 font-semibold">Perimeter points ({points.length})</h3>
          {loadingSheet ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {points.length < 3
                ? 'Add at least 3 points to trace the drawing area.'
                : 'Drag a point to fine-tune. Save when the outline looks right.'}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={undo}
              disabled={points.length === 0 || updateMutation.isLoading}
            >
              <Undo2 className="h-4 w-4" /> Undo
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={clear}
              disabled={points.length === 0 || updateMutation.isLoading}
            >
              Clear
            </Button>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <Button type="button" onClick={() => void handleSave()} disabled={!canSave}>
              {updateMutation.isLoading ? 'Saving…' : 'Save perimeter'}
            </Button>
            {hasPerimeter && (
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleRemove()}
                disabled={updateMutation.isLoading}
                className="text-destructive"
              >
                Remove perimeter
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
