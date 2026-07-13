import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

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
import {
  COORDINATE_SYSTEM_OPTIONS,
  DEFAULT_COORDINATE_SYSTEM,
} from '@/lib/spatial/coordinateSystems';
import type { ControlLine, ControlLineInput } from './controlLinesData';
import {
  controlLineFormSchema,
  parsePastedControlPoints,
  type ControlPoint,
} from './controlPointsParsing';

interface PointRow {
  chainage: string;
  easting: string;
  northing: string;
}

const EMPTY_ROW: PointRow = { chainage: '', easting: '', northing: '' };

function pointsToRows(points: ControlPoint[]): PointRow[] {
  if (points.length === 0) return [{ ...EMPTY_ROW }, { ...EMPTY_ROW }];
  return points.map((p) => ({
    chainage: String(p.chainage),
    easting: String(p.easting),
    northing: String(p.northing),
  }));
}

// Blank rows are dropped before validation so a trailing empty row is not an
// error; remaining rows are coerced to numbers (NaN when blank/non-numeric) and
// the zod schema rejects any non-finite value.
function rowsToPoints(rows: PointRow[]): ControlPoint[] {
  return rows
    .filter((r) => r.chainage.trim() || r.easting.trim() || r.northing.trim())
    .map((r) => ({
      chainage: Number(r.chainage),
      easting: Number(r.easting),
      northing: Number(r.northing),
    }));
}

interface ControlLineFormModalProps {
  initial: ControlLine | null;
  saving: boolean;
  onSubmit: (input: ControlLineInput) => void;
  onClose: () => void;
}

export function ControlLineFormModal({
  initial,
  saving,
  onSubmit,
  onClose,
}: ControlLineFormModalProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [coordinateSystem, setCoordinateSystem] = useState(
    initial?.coordinateSystem ?? DEFAULT_COORDINATE_SYSTEM,
  );
  const [rows, setRows] = useState<PointRow[]>(() => pointsToRows(initial?.points ?? []));
  const [pasteText, setPasteText] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const pastePreview = useMemo(
    () => (pasteText.trim() ? parsePastedControlPoints(pasteText) : null),
    [pasteText],
  );

  const updateRow = (index: number, field: keyof PointRow, value: string) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const addRow = () => setRows((prev) => [...prev, { ...EMPTY_ROW }]);

  const removeRow = (index: number) => {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const applyPastedRows = () => {
    if (!pastePreview || pastePreview.points.length === 0) return;
    setRows(pointsToRows(pastePreview.points));
    setPasteText('');
    setFormError(null);
  };

  const handleSubmit = () => {
    const validation = controlLineFormSchema.safeParse({
      name,
      coordinateSystem,
      points: rowsToPoints(rows),
    });

    if (!validation.success) {
      setFormError(validation.error.issues[0]?.message ?? 'Please fix the highlighted fields.');
      return;
    }

    setFormError(null);
    onSubmit(validation.data);
  };

  return (
    <Modal
      onClose={() => {
        if (!saving) onClose();
      }}
    >
      <ModalHeader>{initial ? 'Edit Control Line' : 'Add Control Line'}</ModalHeader>
      <ModalDescription>
        A control line needs a name, a coordinate system, and at least two points (chainage,
        easting, northing).
      </ModalDescription>
      <ModalBody>
        <div className="space-y-5">
          <div>
            <Label htmlFor="control-line-name" className="mb-1">
              Name *
            </Label>
            <Input
              id="control-line-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., MC00 Mainline"
            />
          </div>

          <div>
            <Label htmlFor="control-line-crs" className="mb-1">
              Coordinate system *
            </Label>
            <NativeSelect
              id="control-line-crs"
              value={coordinateSystem}
              onChange={(e) => setCoordinateSystem(e.target.value)}
            >
              {COORDINATE_SYSTEM_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div>
            <Label className="mb-1">Paste from Excel / CSV</Label>
            <p className="mb-2 text-xs text-muted-foreground">
              Paste rows as <code>chainage, easting, northing</code> (comma or tab separated). A
              header row and blank lines are ignored.
            </p>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder={'chainage,easting,northing\n0,500000,6250000\n100,500010,6250100'}
              aria-label="Paste control points"
            />
            {pastePreview && (
              <div className="mt-2 rounded-md border">
                <div className="flex items-center justify-between gap-2 border-b bg-muted/50 px-3 py-2">
                  <span className="text-xs text-muted-foreground">
                    {pastePreview.points.length} valid ·{' '}
                    {pastePreview.rows.length - pastePreview.points.length} with errors
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    onClick={applyPastedRows}
                    disabled={pastePreview.points.length < 1}
                  >
                    Use {pastePreview.points.length} row
                    {pastePreview.points.length === 1 ? '' : 's'}
                  </Button>
                </div>
                <div className="max-h-40 overflow-y-auto">
                  <table className="w-full text-sm">
                    <tbody className="divide-y">
                      {pastePreview.rows.map((row) => (
                        <tr key={row.line} className={row.error ? 'bg-destructive/5' : undefined}>
                          <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground">
                            {row.raw}
                          </td>
                          <td className="px-3 py-1.5 text-xs">
                            {row.error ? (
                              <span className="text-destructive">{row.error}</span>
                            ) : (
                              <span className="text-success">ok</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label className="mb-0">Points *</Label>
              <Button type="button" variant="outline" size="sm" onClick={addRow}>
                <Plus className="h-4 w-4" />
                Add row
              </Button>
            </div>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[420px] text-sm">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Chainage</th>
                    <th className="px-3 py-2 text-left font-medium">Easting</th>
                    <th className="px-3 py-2 text-left font-medium">Northing</th>
                    <th className="w-10 px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((row, index) => (
                    <tr key={index}>
                      <td className="px-2 py-1.5">
                        <Input
                          type="number"
                          step="any"
                          value={row.chainage}
                          onChange={(e) => updateRow(index, 'chainage', e.target.value)}
                          aria-label={`Chainage row ${index + 1}`}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          type="number"
                          step="any"
                          value={row.easting}
                          onChange={(e) => updateRow(index, 'easting', e.target.value)}
                          aria-label={`Easting row ${index + 1}`}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          type="number"
                          step="any"
                          value={row.northing}
                          onChange={(e) => updateRow(index, 'northing', e.target.value)}
                          aria-label={`Northing row ${index + 1}`}
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeRow(index)}
                          disabled={rows.length <= 1}
                          className="text-destructive hover:bg-destructive/10"
                          aria-label={`Remove row ${index + 1}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {formError && (
            <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {formError}
            </div>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={saving || !name.trim()}>
          {saving ? 'Saving...' : initial ? 'Update Control Line' : 'Add Control Line'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
