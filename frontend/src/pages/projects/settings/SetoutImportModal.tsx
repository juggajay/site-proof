import { useRef, useState } from 'react';
import { FileUp, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Modal,
  ModalHeader,
  ModalDescription,
  ModalBody,
  ModalFooter,
} from '@/components/ui/Modal';
import { toast } from '@/components/ui/toaster';
import { extractErrorMessage } from '@/lib/errorHandling';
import { logError } from '@/lib/logger';
import {
  COORDINATE_SYSTEM_OPTIONS,
  DEFAULT_COORDINATE_SYSTEM,
} from '@/lib/spatial/coordinateSystems';
import type { ControlPoint } from './controlPointsParsing';
import { useCreateControlLine, useExtractSetoutPoints } from './controlLinesData';

interface SetoutImportModalProps {
  projectId: string;
  /** Zone to fall back to when the AI cannot read one (usually the project's). */
  defaultCoordinateSystem?: string;
  onClose: () => void;
}

const ACCEPT = '.pdf,.jpg,.jpeg,.png';
const MAX_FILE_MB = 10;

const SUPPORTED_CRS = new Set(COORDINATE_SYSTEM_OPTIONS.map((o) => o.value));

// "MC01 setout.pdf" → "MC01 setout"; a sensible default control-line name.
function fileStem(name: string): string {
  return name.replace(/\.[^./\\]+$/, '').trim();
}

// One editable alignment in the review UI. `status` tracks per-alignment saves so
// a partial failure keeps the failed rows for retry while the saved ones drop out.
interface AlignmentRow {
  name: string;
  coordinateSystem: string;
  points: ControlPoint[];
  warnings: string[];
  checked: boolean;
  status: 'idle' | 'saved' | 'error';
  errorMessage?: string;
}

function PointsTable({ points }: { points: ControlPoint[] }) {
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

function CrsSelect({
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

function WarningList({ warnings, testId }: { warnings: string[]; testId: string }) {
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

export function SetoutImportModal({
  projectId,
  defaultCoordinateSystem,
  onClose,
}: SetoutImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<AlignmentRow[] | null>(null);
  const [documentWarnings, setDocumentWarnings] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const extractMutation = useExtractSetoutPoints(projectId);
  const createMutation = useCreateControlLine(projectId);

  const busy = extractMutation.isLoading || saving;

  const updateRow = (index: number, patch: Partial<AlignmentRow>) =>
    setRows((prev) =>
      prev ? prev.map((row, i) => (i === index ? { ...row, ...patch } : row)) : prev,
    );

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setRows(null);
    setDocumentWarnings([]);
    try {
      const candidate = await extractMutation.mutateAsync(file);
      const stem = fileStem(file.name);
      const multi = candidate.alignments.length > 1;
      setRows(
        candidate.alignments.map((alignment, i) => ({
          name: alignment.name?.trim() || (multi ? `${stem} – ${i + 1}` : stem),
          // The AI's zone wins only if it maps to a zone we support; otherwise keep
          // the project's existing zone so the user starts from a sane default.
          coordinateSystem:
            alignment.coordinateSystem && SUPPORTED_CRS.has(alignment.coordinateSystem)
              ? alignment.coordinateSystem
              : (defaultCoordinateSystem ?? DEFAULT_COORDINATE_SYSTEM),
          points: alignment.points,
          warnings: alignment.warnings,
          checked: true,
          status: 'idle',
        })),
      );
      setDocumentWarnings(candidate.warnings);
    } catch (error) {
      logError('Failed to extract setout points:', error);
      toast({
        title: 'Could not read that setout sheet',
        // The backend 400/503 messages are user-facing and useful ("AI setout
        // extraction is not configured…", "Could not extract any alignment…").
        description: extractErrorMessage(error, 'Try another file or enter the points manually.'),
        variant: 'error',
      });
    }
  };

  const handleSave = async () => {
    if (!rows) return;
    const targets = rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => row.checked && row.status !== 'saved');
    if (targets.length === 0 || targets.some(({ row }) => row.name.trim() === '')) return;

    setSaving(true);
    let saved = 0;
    let failed = 0;
    for (const { row, index } of targets) {
      try {
        await createMutation.mutateAsync({
          name: row.name.trim(),
          coordinateSystem: row.coordinateSystem,
          points: row.points,
        });
        updateRow(index, { status: 'saved', checked: false, errorMessage: undefined });
        saved += 1;
      } catch (error) {
        logError('Failed to save extracted control line:', error);
        updateRow(index, {
          status: 'error',
          errorMessage: extractErrorMessage(error, 'Please try again.'),
        });
        failed += 1;
      }
    }
    setSaving(false);

    if (failed === 0) {
      const single = rows.length === 1;
      toast({
        title: single ? 'Control line created' : 'Control lines created',
        description: single
          ? `${targets[0].row.name.trim()} has been added.`
          : `${saved} control line${saved === 1 ? '' : 's'} added.`,
      });
      onClose();
    } else {
      toast({
        title: 'Some control lines failed to save',
        description: `Saved ${saved}, ${failed} failed. Fix the flagged rows and try again.`,
        variant: 'error',
      });
    }
  };

  const savableRows = rows?.filter((row) => row.checked && row.status !== 'saved') ?? [];
  const canSave = savableRows.length > 0 && savableRows.every((row) => row.name.trim() !== '');
  const isMulti = (rows?.length ?? 0) > 1;
  const saveLabel = saving
    ? 'Saving…'
    : isMulti
      ? `Save ${savableRows.length} control line${savableRows.length === 1 ? '' : 's'}`
      : 'Save control line';

  return (
    <Modal
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <ModalHeader>Import from setout sheet</ModalHeader>
      <ModalDescription>
        Upload a Geometric Setout Details sheet (PDF or photo). The coordinate table is read by AI,
        so check the points against the drawing before saving. Files up to {MAX_FILE_MB} MB.
      </ModalDescription>
      <ModalBody>
        <div className="space-y-5">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file && !busy) void handleFile(file);
            }}
            className="rounded-lg border border-dashed p-6 text-center"
          >
            <FileUp className="mx-auto h-8 w-8 text-muted-foreground/60" />
            <p className="mt-2 text-sm text-muted-foreground">Drag a PDF or photo here, or</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              Choose file
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                e.target.value = '';
              }}
            />
            {fileName && (
              <p className="mt-3 text-xs text-muted-foreground">
                {extractMutation.isLoading ? 'Reading ' : ''}
                <span className="font-medium">{fileName}</span>
              </p>
            )}
          </div>

          {extractMutation.isLoading && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Reading the setout sheet…
            </div>
          )}

          {rows && rows.length === 1 && (
            <>
              <div>
                <Label htmlFor="setout-name" className="mb-1">
                  Name *
                </Label>
                <Input
                  id="setout-name"
                  type="text"
                  value={rows[0].name}
                  onChange={(e) => updateRow(0, { name: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="setout-crs" className="mb-1">
                  Coordinate system *
                </Label>
                <CrsSelect
                  id="setout-crs"
                  value={rows[0].coordinateSystem}
                  onChange={(value) => updateRow(0, { coordinateSystem: value })}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Confirm the zone matches your survey datum before saving.
                </p>
              </div>

              <WarningList
                warnings={[...documentWarnings, ...rows[0].warnings]}
                testId="setout-warnings"
              />

              <div>
                <p className="mb-2 text-sm text-muted-foreground">
                  {rows[0].points.length} point{rows[0].points.length === 1 ? '' : 's'} read from
                  the sheet. Check these against the drawing before saving.
                </p>
                <PointsTable points={rows[0].points} />
              </div>
            </>
          )}

          {rows && rows.length > 1 && (
            <>
              <p className="text-sm text-muted-foreground">
                {rows.length} alignments found on this sheet. Each becomes its own control line —
                untick any you do not want, and check the points against the drawing before saving.
              </p>

              <WarningList warnings={documentWarnings} testId="setout-document-warnings" />

              <div className="space-y-3">
                {rows.map((row, index) => (
                  <div
                    key={index}
                    className="rounded-lg border p-4"
                    data-testid={`setout-alignment-${index}`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-2.5 h-4 w-4"
                        checked={row.checked}
                        disabled={row.status === 'saved' || busy}
                        onChange={(e) => updateRow(index, { checked: e.target.checked })}
                        aria-label={`Include ${row.name || `alignment ${index + 1}`}`}
                      />
                      <div className="flex-1 space-y-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <Label htmlFor={`setout-name-${index}`} className="mb-1">
                              Name *
                            </Label>
                            <Input
                              id={`setout-name-${index}`}
                              type="text"
                              value={row.name}
                              disabled={row.status === 'saved'}
                              onChange={(e) => updateRow(index, { name: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label htmlFor={`setout-crs-${index}`} className="mb-1">
                              Coordinate system *
                            </Label>
                            <CrsSelect
                              id={`setout-crs-${index}`}
                              value={row.coordinateSystem}
                              onChange={(value) => updateRow(index, { coordinateSystem: value })}
                            />
                          </div>
                        </div>

                        <WarningList warnings={row.warnings} testId={`setout-warnings-${index}`} />

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
                            {row.points.length} point{row.points.length === 1 ? '' : 's'} — show
                            table
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
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button type="button" onClick={() => void handleSave()} disabled={busy || !canSave}>
          {saveLabel}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
