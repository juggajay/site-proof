import { useMemo, useRef, useState } from 'react';
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
import {
  useCreateControlLine,
  useImportAlignments,
  type AlignmentImportPreview,
  type ImportedAlignmentSummary,
} from './controlLinesData';

interface RowState {
  selected: boolean;
  name: string;
}

interface ControlLineImportModalProps {
  projectId: string;
  /** Zone to default the CRS picker to (usually the project's existing lines'). */
  defaultCoordinateSystem?: string;
  onClose: () => void;
}

const ACCEPT = '.xml,.landxml,.dxf';

export function ControlLineImportModal({
  projectId,
  defaultCoordinateSystem,
  onClose,
}: ControlLineImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<AlignmentImportPreview | null>(null);
  const [rows, setRows] = useState<RowState[]>([]);
  const [coordinateSystem, setCoordinateSystem] = useState(
    defaultCoordinateSystem ?? DEFAULT_COORDINATE_SYSTEM,
  );

  const importMutation = useImportAlignments(projectId);
  const createMutation = useCreateControlLine(projectId);
  const [importing, setImporting] = useState(false);

  const busy = importMutation.isLoading || importing;
  const selectedCount = useMemo(() => rows.filter((r) => r.selected).length, [rows]);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setPreview(null);
    setRows([]);
    try {
      const result = await importMutation.mutateAsync(file);
      setPreview(result);
      setRows(result.alignments.map((a) => ({ selected: true, name: a.name })));
    } catch (error) {
      logError('Failed to parse alignment file:', error);
      toast({
        title: 'Could not read that file',
        description: extractErrorMessage(error, 'Check it is a valid LandXML or DXF file.'),
        variant: 'error',
      });
    }
  };

  const updateRow = (index: number, patch: Partial<RowState>) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const handleImport = async () => {
    if (!preview) return;
    const chosen = preview.alignments
      .map((alignment, index) => ({ alignment, row: rows[index] }))
      .filter(({ row }) => row?.selected);
    if (chosen.length === 0) return;

    setImporting(true);
    let created = 0;
    const failures: string[] = [];
    for (const { alignment, row } of chosen) {
      try {
        await createMutation.mutateAsync({
          name: row.name.trim() || alignment.name,
          coordinateSystem,
          points: alignment.points,
        });
        created += 1;
      } catch (error) {
        logError('Failed to create imported control line:', error);
        failures.push(
          `${row.name.trim() || alignment.name}: ${extractErrorMessage(error, 'failed')}`,
        );
      }
    }
    setImporting(false);

    if (created > 0) {
      toast({
        title: `Imported ${created} control line${created === 1 ? '' : 's'}`,
        description: failures.length ? `${failures.length} could not be imported.` : undefined,
      });
    }
    if (failures.length > 0 && created === 0) {
      toast({
        title: 'Import failed',
        description: failures[0],
        variant: 'error',
      });
      return;
    }
    onClose();
  };

  return (
    <Modal
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <ModalHeader>Import Control Lines</ModalHeader>
      <ModalDescription>
        Upload a LandXML (12d, Civil3D) or DXF file. Straight lines and circular curves are
        supported; spirals (clothoids) are not.
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
            <p className="mt-2 text-sm text-muted-foreground">
              Drag a .xml / .landxml / .dxf file here, or
            </p>
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
                {importMutation.isLoading ? 'Reading ' : ''}
                <span className="font-medium">{fileName}</span>
              </p>
            )}
          </div>

          {importMutation.isLoading && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Parsing alignments…
            </div>
          )}

          {preview && (
            <>
              <div>
                <Label htmlFor="import-crs" className="mb-1">
                  Coordinate system *
                </Label>
                <NativeSelect
                  id="import-crs"
                  value={coordinateSystem}
                  onChange={(e) => setCoordinateSystem(e.target.value)}
                >
                  {COORDINATE_SYSTEM_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </NativeSelect>
                <p className="mt-1 text-xs text-muted-foreground">
                  {preview.format === 'dxf' ? 'DXF' : 'LandXML'} files carry no datum — set the zone
                  your survey coordinates are in.
                </p>
              </div>

              {preview.warnings.length > 0 && (
                <div
                  role="status"
                  className="rounded-md bg-warning/10 p-3 text-xs text-warning"
                  data-testid="import-warnings"
                >
                  <ul className="list-disc space-y-1 pl-4">
                    {preview.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {preview.alignments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No importable alignments were found in this file.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead className="border-b bg-muted/50">
                      <tr>
                        <th className="w-10 px-3 py-2" />
                        <th className="px-3 py-2 text-left font-medium">Name</th>
                        <th className="px-3 py-2 text-left font-medium">Points</th>
                        <th className="px-3 py-2 text-left font-medium">Chainage</th>
                        <th className="px-3 py-2 text-left font-medium">Length</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {preview.alignments.map((alignment: ImportedAlignmentSummary, index) => (
                        <tr key={`${alignment.name}-${index}`}>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={rows[index]?.selected ?? false}
                              onChange={(e) => updateRow(index, { selected: e.target.checked })}
                              aria-label={`Import ${alignment.name}`}
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input
                              type="text"
                              value={rows[index]?.name ?? ''}
                              onChange={(e) => updateRow(index, { name: e.target.value })}
                              aria-label={`Name for ${alignment.name}`}
                            />
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {alignment.pointCount}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {Math.round(alignment.chainageStart).toLocaleString()} –{' '}
                            {Math.round(alignment.chainageEnd).toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {Math.round(alignment.lengthM).toLocaleString()} m
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={() => void handleImport()}
          disabled={busy || selectedCount === 0}
        >
          {importing
            ? 'Importing…'
            : `Import ${selectedCount || ''} ${selectedCount === 1 ? 'line' : 'lines'}`.trim()}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
