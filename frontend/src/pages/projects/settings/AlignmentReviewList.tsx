import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { COORDINATE_SYSTEM_OPTIONS } from '@/lib/spatial/coordinateSystems';
import type { ControlPoint } from './controlPointsParsing';

// One editable alignment in the review UI. `status`/`errorMessage` track a
// per-alignment save (SetoutImportModal saves one line at a time); the copilot
// review applies atomically, so it leaves status 'idle' and the save/error
// branches stay inert. `page` is the optional sheet-page citation.
export interface AlignmentReviewRow {
  name: string;
  coordinateSystem: string;
  points: ControlPoint[];
  warnings: string[];
  page?: number | null;
  checked: boolean;
  status?: 'idle' | 'saved' | 'error';
  errorMessage?: string;
}

export function PointsTable({ points }: { points: ControlPoint[] }) {
  return (
    <div className="max-h-64 overflow-auto rounded-md border">
      <table className="w-full min-w-[420px] text-sm">
        <thead className="sticky top-0 border-b bg-muted/50">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Chainage</th>
            <th className="px-3 py-2 text-left font-medium">Easting</th>
            <th className="px-3 py-2 text-left font-medium">Northing</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {points.map((point, index) => (
            <tr key={`${point.chainage}-${index}`}>
              <td className="px-3 py-1.5">{point.chainage.toLocaleString()}</td>
              <td className="px-3 py-1.5 text-muted-foreground">
                {point.easting.toLocaleString()}
              </td>
              <td className="px-3 py-1.5 text-muted-foreground">
                {point.northing.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CrsSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <NativeSelect id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      {COORDINATE_SYSTEM_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </NativeSelect>
  );
}

export function WarningList({ warnings, testId }: { warnings: string[]; testId: string }) {
  if (warnings.length === 0) return null;
  return (
    <div
      role="status"
      className="rounded-md bg-warning/10 p-3 text-xs text-warning"
      data-testid={testId}
    >
      <ul className="list-disc space-y-1 pl-4">
        {warnings.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
    </div>
  );
}

interface AlignmentReviewListProps {
  rows: AlignmentReviewRow[];
  documentWarnings: string[];
  onUpdateRow: (index: number, patch: Partial<AlignmentReviewRow>) => void;
  busy: boolean;
  /** Prefixes element ids/testids so two mounts never collide. Default 'setout'. */
  testIdPrefix?: string;
}

/**
 * The per-alignment review list: one card per alignment with a keep/drop
 * checkbox, editable name + coordinate system, warnings, and a collapsible
 * points table. Shared by the setout-sheet import (settings) and the setup
 * copilot's control-line stage so both review extracted alignments identically.
 */
export function AlignmentReviewList({
  rows,
  documentWarnings,
  onUpdateRow,
  busy,
  testIdPrefix = 'setout',
}: AlignmentReviewListProps) {
  return (
    <>
      <p className="text-sm text-muted-foreground">
        {rows.length} alignment{rows.length === 1 ? '' : 's'} found on this sheet. Each becomes its
        own control line — untick any you do not want, and check the points against the drawing
        before saving.
      </p>

      <WarningList warnings={documentWarnings} testId={`${testIdPrefix}-document-warnings`} />

      <div className="space-y-3">
        {rows.map((row, index) => (
          <div
            key={index}
            className="rounded-lg border p-4"
            data-testid={`${testIdPrefix}-alignment-${index}`}
          >
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-2.5 h-4 w-4"
                checked={row.checked}
                disabled={row.status === 'saved' || busy}
                onChange={(e) => onUpdateRow(index, { checked: e.target.checked })}
                aria-label={`Include ${row.name || `alignment ${index + 1}`}`}
              />
              <div className="flex-1 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor={`${testIdPrefix}-name-${index}`} className="mb-1">
                      Name *
                    </Label>
                    <Input
                      id={`${testIdPrefix}-name-${index}`}
                      type="text"
                      value={row.name}
                      disabled={row.status === 'saved'}
                      onChange={(e) => onUpdateRow(index, { name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`${testIdPrefix}-crs-${index}`} className="mb-1">
                      Coordinate system *
                    </Label>
                    <CrsSelect
                      id={`${testIdPrefix}-crs-${index}`}
                      value={row.coordinateSystem}
                      onChange={(value) => onUpdateRow(index, { coordinateSystem: value })}
                    />
                  </div>
                </div>

                <WarningList warnings={row.warnings} testId={`${testIdPrefix}-warnings-${index}`} />

                {row.status === 'saved' && (
                  <p className="text-xs font-medium text-emerald-600">Saved.</p>
                )}
                {row.status === 'error' && (
                  <p className="text-xs font-medium text-destructive">
                    {row.errorMessage ?? 'Failed to save — try again.'}
                  </p>
                )}

                <details>
                  <summary className="cursor-pointer text-sm text-muted-foreground">
                    {row.points.length} point{row.points.length === 1 ? '' : 's'}
                    {row.page ? ` · p.${row.page}` : ''} — show table
                  </summary>
                  <div className="mt-2">
                    <PointsTable points={row.points} />
                  </div>
                </details>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
