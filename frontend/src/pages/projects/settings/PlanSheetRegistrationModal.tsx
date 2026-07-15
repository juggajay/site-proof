import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';
import { extractErrorMessage } from '@/lib/errorHandling';
import { logError } from '@/lib/logger';
import {
  fetchPlanSheet,
  useUpdatePlanSheet,
  type PlanSheetListItem,
  type PlanSheetRegistration,
} from './planSheetsData';
import { useControlLines } from './controlLinesData';
import { usePlanSheetImage } from './usePlanSheetImage';
import {
  computeRegistration,
  type PointResidual,
  type RegistrationPoint,
} from './planSheetRegistration';
import type { ImagePoint } from './PlanSheetImageMap';
import {
  RegistrationSidePanel,
  type EditablePoint,
  type FitSummary,
} from './RegistrationSidePanel';

// Leaflet is heavy — load the map (and leaflet itself) only when the modal opens.
const PlanSheetImageMap = lazy(() =>
  import('./PlanSheetImageMap').then((m) => ({ default: m.PlanSheetImageMap })),
);

interface PlanSheetRegistrationModalProps {
  projectId: string;
  sheet: PlanSheetListItem;
  onClose: () => void;
  onSaved: () => void;
  /** Fires only after a successful register (not clear), for the guided perimeter step. */
  onRegistered?: () => void;
  /**
   * Copilot review mode. When set, the editor seeds its control points from
   * `initialPoints` (the AI's approximate marker positions) instead of the
   * sheet's stored registration, and Save routes the fitted registration through
   * `onSubmitRegistration` (the proposal decision endpoint) rather than the manual
   * PATCH. All three are optional so the manual flow is unchanged.
   */
  initialPoints?: EditablePoint[];
  onSubmitRegistration?: (registration: PlanSheetRegistration) => Promise<void>;
  /** Reject the suggestion (copilot mode); renders a Dismiss action in the header. */
  onDismiss?: () => void;
  /** Whether the external decision mutation is in flight (copilot mode). */
  submitting?: boolean;
}

function toNumber(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/** Points that have both grid coordinates entered, mapped to the fit payload. */
function completePoints(points: EditablePoint[]): {
  fitPoints: RegistrationPoint[];
  indexMap: number[];
} {
  const fitPoints: RegistrationPoint[] = [];
  const indexMap: number[] = [];
  points.forEach((p, i) => {
    const easting = toNumber(p.eastingText);
    const northing = toNumber(p.northingText);
    if (easting != null && northing != null) {
      fitPoints.push({ px: p.px, py: p.py, easting, northing });
      indexMap.push(i);
    }
  });
  return { fitPoints, indexMap };
}

export function PlanSheetRegistrationModal({
  projectId,
  sheet,
  onClose,
  onSaved,
  onRegistered,
  initialPoints,
  onSubmitRegistration,
  onDismiss,
  submitting = false,
}: PlanSheetRegistrationModalProps) {
  const copilotMode = onSubmitRegistration != null;
  const [points, setPoints] = useState<EditablePoint[]>(() => initialPoints ?? []);
  const [loadingSheet, setLoadingSheet] = useState(!initialPoints);
  const { url: imageUrl, error: imageError } = usePlanSheetImage(projectId, sheet.id);
  const updateMutation = useUpdatePlanSheet(projectId);
  const busy = updateMutation.isLoading || submitting;

  // Copilot mode seeds points from the AI candidate (initialPoints); the manual
  // flow prefills existing registration points from the full sheet.
  useEffect(() => {
    if (initialPoints) return;
    let cancelled = false;
    setLoadingSheet(true);
    void (async () => {
      try {
        const full = await fetchPlanSheet(projectId, sheet.id);
        if (cancelled) return;
        setPoints(
          (full.registration?.points ?? []).map((p) => ({
            px: p.px,
            py: p.py,
            eastingText: String(p.easting),
            northingText: String(p.northing),
          })),
        );
      } catch (err) {
        logError('Failed to load plan sheet registration:', err);
      } finally {
        if (!cancelled) setLoadingSheet(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, sheet.id, initialPoints]);

  const addPoint = (point: ImagePoint) => {
    setPoints((prev) =>
      prev.length >= 12 ? prev : [...prev, { ...point, eastingText: '', northingText: '' }],
    );
  };
  const movePoint = (index: number, point: ImagePoint) => {
    setPoints((prev) => prev.map((p, i) => (i === index ? { ...p, ...point } : p)));
  };
  const removePoint = (index: number) => {
    setPoints((prev) => prev.filter((_, i) => i !== index));
  };
  const updateCoord = (index: number, field: 'eastingText' | 'northingText', value: string) => {
    setPoints((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  };

  // CivilPro flags "click a chainage on a control line" as the fastest way to
  // set a control point — offer it as an optional per-point entry mode.
  const controlLinesQuery = useControlLines(projectId);

  const { fitPoints, indexMap } = useMemo(() => completePoints(points), [points]);

  const registration = useMemo(
    () => (fitPoints.length >= 2 ? computeRegistration(fitPoints) : null),
    [fitPoints],
  );

  // Residual per editable-point index (only complete points have one).
  const residualByIndex = useMemo(() => {
    const map = new Map<number, PointResidual>();
    if (registration?.ok) {
      registration.residuals.forEach((r, i) => map.set(indexMap[i], r));
    }
    return map;
  }, [registration, indexMap]);

  const fitSummary: FitSummary | null = registration
    ? registration.ok
      ? {
          ok: true,
          mode: registration.mode,
          rmsErrorM: registration.rmsErrorM,
          fitPointCount: fitPoints.length,
        }
      : { ok: false, error: registration.error, fitPointCount: fitPoints.length }
    : null;

  const allPlacedComplete = fitPoints.length === points.length;
  const canSave =
    registration?.ok === true &&
    points.length >= 2 &&
    points.length <= 12 &&
    allPlacedComplete &&
    !busy;

  const handleSave = async () => {
    if (!registration?.ok || !canSave) return;
    const registrationPayload: PlanSheetRegistration = {
      points: fitPoints,
      transform: registration.transform,
      rmsErrorM: registration.rmsErrorM,
    };
    try {
      if (onSubmitRegistration) {
        // Copilot review: the decision endpoint applies the registration and the
        // wrapper owns the success toast. We just close on success.
        await onSubmitRegistration(registrationPayload);
        onSaved();
        onRegistered?.();
        onClose();
        return;
      }
      await updateMutation.mutateAsync({
        id: sheet.id,
        input: { registration: registrationPayload },
      });
      toast({ title: 'Sheet registered', description: `${sheet.name} is now georeferenced.` });
      onSaved();
      onRegistered?.();
      onClose();
    } catch (err) {
      logError('Failed to save registration:', err);
      toast({
        title: 'Could not save registration',
        description: extractErrorMessage(err, 'Please try again.'),
        variant: 'error',
      });
    }
  };

  const handleClear = async () => {
    try {
      await updateMutation.mutateAsync({ id: sheet.id, input: { registration: null } });
      toast({
        title: 'Registration cleared',
        description: `${sheet.name} is no longer georeferenced.`,
      });
      onSaved();
      onClose();
    } catch (err) {
      logError('Failed to clear registration:', err);
      toast({
        title: 'Could not clear registration',
        description: extractErrorMessage(err, 'Please try again.'),
        variant: 'error',
      });
    }
  };

  return (
    // Full-screen registration surface — bypasses the standard Modal so the map
    // gets the whole viewport. fixed inset-0 is the intended pattern for
    // full-screen capture/editor UIs in this codebase.
    <div
      className="fixed inset-0 z-[2000] flex flex-col bg-background"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 className="text-lg font-semibold">Register &quot;{sheet.name}&quot;</h2>
          <p className="text-xs text-muted-foreground">
            {copilotMode
              ? 'The AI dropped these markers approximately — drag each one exactly onto its mark, then apply. A few pixels here is metres on the ground.'
              : 'Click the drawing to drop a control point, then enter its grid easting/northing.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onDismiss && (
            <Button type="button" variant="ghost" onClick={onDismiss} disabled={busy}>
              Dismiss suggestion
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Close
          </Button>
        </div>
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
              />
            </Suspense>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading image…
            </div>
          )}
        </div>

        <RegistrationSidePanel
          points={points}
          fit={fitSummary}
          residualByIndex={residualByIndex}
          loadingSheet={loadingSheet}
          allPlacedComplete={allPlacedComplete}
          canSave={canSave}
          saving={busy}
          submitLabel={copilotMode ? 'Apply registration' : undefined}
          hasRegistration={!copilotMode && sheet.hasRegistration}
          controlLines={controlLinesQuery.data ?? []}
          sheetCoordinateSystem={sheet.coordinateSystem}
          onRemovePoint={removePoint}
          onUpdateCoord={updateCoord}
          onSave={() => void handleSave()}
          onClear={() => void handleClear()}
        />
      </div>
    </div>
  );
}
