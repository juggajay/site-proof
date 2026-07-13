import { Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { PointResidual } from './planSheetRegistration';

export const WARN_RESIDUAL_M = 2;

export interface EditablePoint {
  px: number;
  py: number;
  eastingText: string;
  northingText: string;
}

/** Live registration fit summary passed down from the modal. */
export interface FitSummary {
  ok: boolean;
  mode?: 'similarity' | 'affine';
  error?: string;
  rmsErrorM?: number;
  fitPointCount: number;
}

interface PointRowProps {
  point: EditablePoint;
  index: number;
  residual: PointResidual | undefined;
  onRemove: (index: number) => void;
  onUpdateCoord: (index: number, field: 'eastingText' | 'northingText', value: string) => void;
}

function PointRow({ point, index, residual, onRemove, onUpdateCoord }: PointRowProps) {
  const warn = residual != null && residual.residualM > WARN_RESIDUAL_M;
  return (
    <li className="rounded-md border p-2">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
            {index + 1}
          </span>
          px {Math.round(point.px)}, {Math.round(point.py)}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onRemove(index)}
          className="text-destructive hover:bg-destructive/10"
          aria-label={`Remove point ${index + 1}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input
          type="number"
          step="any"
          value={point.eastingText}
          onChange={(e) => onUpdateCoord(index, 'eastingText', e.target.value)}
          placeholder="Easting"
          aria-label={`Easting for point ${index + 1}`}
        />
        <Input
          type="number"
          step="any"
          value={point.northingText}
          onChange={(e) => onUpdateCoord(index, 'northingText', e.target.value)}
          placeholder="Northing"
          aria-label={`Northing for point ${index + 1}`}
        />
      </div>
      {residual != null && (
        <p className={`mt-1 text-xs ${warn ? 'text-warning' : 'text-muted-foreground'}`}>
          Residual: {residual.residualM.toFixed(2)} m{warn ? ' — high' : ''}
        </p>
      )}
    </li>
  );
}

interface RegistrationSidePanelProps {
  points: EditablePoint[];
  fit: FitSummary | null;
  residualByIndex: Map<number, PointResidual>;
  loadingSheet: boolean;
  allPlacedComplete: boolean;
  canSave: boolean;
  saving: boolean;
  hasRegistration: boolean;
  onRemovePoint: (index: number) => void;
  onUpdateCoord: (index: number, field: 'eastingText' | 'northingText', value: string) => void;
  onSave: () => void;
  onClear: () => void;
}

/**
 * The registration modal's right-hand column: per-point coordinate inputs, live
 * residuals, the active-mode label, RMS summary, and save/clear actions. Split
 * out of the modal so each function stays small and the live-residual display
 * (our differentiator) is easy to read.
 */
export function RegistrationSidePanel({
  points,
  fit,
  residualByIndex,
  loadingSheet,
  allPlacedComplete,
  canSave,
  saving,
  hasRegistration,
  onRemovePoint,
  onUpdateCoord,
  onSave,
  onClear,
}: RegistrationSidePanelProps) {
  const overWarn = fit?.ok && (fit.rmsErrorM ?? 0) > WARN_RESIDUAL_M;
  return (
    <div className="w-full overflow-y-auto border-t p-4 md:w-96 md:border-l md:border-t-0">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">Control points ({points.length}/12)</h3>
        {fit?.ok && (
          <span className="text-xs text-muted-foreground">
            {fit.mode === 'similarity'
              ? '2-point fit'
              : `Least-squares fit, ${fit.fitPointCount} points`}
          </span>
        )}
      </div>

      {loadingSheet ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : points.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Click a known location on the drawing (survey mark, lot corner, control point) to start.
          You need at least 2.
        </p>
      ) : (
        <ul className="space-y-3">
          {points.map((point, index) => (
            <PointRow
              key={index}
              point={point}
              index={index}
              residual={residualByIndex.get(index)}
              onRemove={onRemovePoint}
              onUpdateCoord={onUpdateCoord}
            />
          ))}
        </ul>
      )}

      {fit && !fit.ok && fit.error && (
        <p className="mt-3 rounded-md bg-destructive/10 p-2 text-sm text-destructive" role="alert">
          {fit.error}
        </p>
      )}

      {fit?.ok && (
        <div
          className={`mt-4 rounded-md p-3 text-sm ${overWarn ? 'bg-warning/10 text-warning' : 'bg-muted'}`}
          data-testid="rms-summary"
        >
          <span className="font-semibold">RMS error: {(fit.rmsErrorM ?? 0).toFixed(2)} m</span>
          {overWarn && (
            <p className="mt-1 text-xs">
              Over {WARN_RESIDUAL_M} m — check your points. You can still save; the choice is yours.
            </p>
          )}
        </div>
      )}

      {!allPlacedComplete && points.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Enter easting and northing for every point to enable saving.
        </p>
      )}

      <div className="mt-4 flex flex-col gap-2">
        <Button type="button" onClick={onSave} disabled={!canSave}>
          {saving ? 'Saving…' : 'Save registration'}
        </Button>
        {hasRegistration && (
          <Button
            type="button"
            variant="outline"
            onClick={onClear}
            disabled={saving}
            className="text-destructive"
          >
            Clear registration
          </Button>
        )}
      </div>
    </div>
  );
}
