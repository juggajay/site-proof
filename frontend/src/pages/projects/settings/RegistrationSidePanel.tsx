import { useState } from 'react';
import { MapPin, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import type { PointResidual } from './planSheetRegistration';
import { positionFromChainage, type ControlPoint } from './controlPointsParsing';

export const WARN_RESIDUAL_M = 2;

export interface EditablePoint {
  px: number;
  py: number;
  eastingText: string;
  northingText: string;
}

/** Minimal control-line shape needed to interpolate a grid position. */
export interface ChainageControlLine {
  id: string;
  name: string;
  coordinateSystem: string;
  points: ControlPoint[];
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
  controlLines: ChainageControlLine[];
  sheetCoordinateSystem: string;
  onRemove: (index: number) => void;
  onUpdateCoord: (index: number, field: 'eastingText' | 'northingText', value: string) => void;
}

// Optional per-point entry: pick a control line + chainage (+ offset) and fill
// the grid easting/northing by interpolating the line. The fields stay editable
// afterwards; grid-coordinate typing remains the default.
function ChainageEntry({
  index,
  controlLines,
  sheetCoordinateSystem,
  onUpdateCoord,
}: {
  index: number;
  controlLines: ChainageControlLine[];
  sheetCoordinateSystem: string;
  onUpdateCoord: (index: number, field: 'eastingText' | 'northingText', value: string) => void;
}) {
  const [lineId, setLineId] = useState(controlLines[0]?.id ?? '');
  const [chainageText, setChainageText] = useState('');
  const [offsetText, setOffsetText] = useState('0');
  const [error, setError] = useState<string | null>(null);

  const selectedLine = controlLines.find((l) => l.id === lineId) ?? controlLines[0];
  const crsMismatch =
    selectedLine != null && selectedLine.coordinateSystem !== sheetCoordinateSystem;

  const apply = () => {
    if (!selectedLine) return;
    const chainage = Number(chainageText.trim());
    const offset = offsetText.trim() === '' ? 0 : Number(offsetText.trim());
    if (!Number.isFinite(chainage)) {
      setError('Enter a numeric chainage.');
      return;
    }
    if (!Number.isFinite(offset)) {
      setError('Offset must be a number.');
      return;
    }
    const position = positionFromChainage(selectedLine.points, chainage, offset);
    if (!position) {
      setError('Chainage is outside this control line’s range.');
      return;
    }
    setError(null);
    onUpdateCoord(index, 'eastingText', position.easting.toFixed(3));
    onUpdateCoord(index, 'northingText', position.northing.toFixed(3));
  };

  return (
    <div className="mt-2 rounded-md border border-dashed p-2">
      <NativeSelect
        value={lineId}
        onChange={(e) => setLineId(e.target.value)}
        aria-label={`Control line for point ${index + 1}`}
        className="mb-2"
      >
        {controlLines.map((line) => (
          <option key={line.id} value={line.id}>
            {line.name}
          </option>
        ))}
      </NativeSelect>
      <div className="grid grid-cols-2 gap-2">
        <Input
          type="number"
          step="any"
          value={chainageText}
          onChange={(e) => setChainageText(e.target.value)}
          placeholder="Chainage"
          aria-label={`Chainage for point ${index + 1}`}
        />
        <Input
          type="number"
          step="any"
          value={offsetText}
          onChange={(e) => setOffsetText(e.target.value)}
          placeholder="Offset (+left)"
          aria-label={`Offset for point ${index + 1}`}
        />
      </div>
      <Button type="button" size="sm" variant="outline" className="mt-2" onClick={apply}>
        Fill easting / northing
      </Button>
      {crsMismatch && (
        <p className="mt-1 text-xs text-warning">
          Control line CRS ({selectedLine.coordinateSystem}) differs from this sheet&apos;s (
          {sheetCoordinateSystem}). Check they match.
        </p>
      )}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function PointRow({
  point,
  index,
  residual,
  controlLines,
  sheetCoordinateSystem,
  onRemove,
  onUpdateCoord,
}: PointRowProps) {
  const warn = residual != null && residual.residualM > WARN_RESIDUAL_M;
  const [showChainage, setShowChainage] = useState(false);
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
      {controlLines.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowChainage((open) => !open)}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <MapPin className="h-3 w-3" />
            {showChainage ? 'Hide chainage entry' : 'From chainage…'}
          </button>
          {showChainage && (
            <ChainageEntry
              index={index}
              controlLines={controlLines}
              sheetCoordinateSystem={sheetCoordinateSystem}
              onUpdateCoord={onUpdateCoord}
            />
          )}
        </>
      )}
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
  /** Save-button copy when idle (defaults to "Save registration"). */
  submitLabel?: string;
  hasRegistration: boolean;
  controlLines: ChainageControlLine[];
  sheetCoordinateSystem: string;
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
  submitLabel = 'Save registration',
  hasRegistration,
  controlLines,
  sheetCoordinateSystem,
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
          Click a known location on the drawing (survey mark, grid cross, title-block corner) to
          start. You need at least 2.{' '}
          {controlLines.length > 0 ? (
            <>
              No coordinates printed on the drawing? Click a chainage tick on the control line, then
              use &ldquo;From chainage&rdquo; to fill them in.
            </>
          ) : (
            <>
              No control line yet? Add one under Control Lines to enter points by chainage and
              offset.
            </>
          )}
        </p>
      ) : (
        <ul className="space-y-3">
          {points.map((point, index) => (
            <PointRow
              key={index}
              point={point}
              index={index}
              residual={residualByIndex.get(index)}
              controlLines={controlLines}
              sheetCoordinateSystem={sheetCoordinateSystem}
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
              Over {WARN_RESIDUAL_M} m — zoom in and re-drop each marker exactly on its mark. A few
              pixels off here is metres on the ground. You can still save; the choice is yours.
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
          {saving ? 'Saving…' : submitLabel}
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
