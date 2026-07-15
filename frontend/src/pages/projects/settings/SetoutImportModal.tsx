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
import {
  useCreateControlLine,
  useExtractSetoutPoints,
  type SetoutExtractionCandidate,
} from './controlLinesData';

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

export function SetoutImportModal({
  projectId,
  defaultCoordinateSystem,
  onClose,
}: SetoutImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<SetoutExtractionCandidate | null>(null);
  const [name, setName] = useState('');
  const [coordinateSystem, setCoordinateSystem] = useState(
    defaultCoordinateSystem ?? DEFAULT_COORDINATE_SYSTEM,
  );

  const extractMutation = useExtractSetoutPoints(projectId);
  const createMutation = useCreateControlLine(projectId);

  const busy = extractMutation.isLoading || createMutation.isLoading;

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setCandidate(null);
    try {
      const result = await extractMutation.mutateAsync(file);
      setCandidate(result);
      setName(fileStem(file.name));
      // The AI's zone wins only if it maps to a zone we support; otherwise keep
      // the project's existing zone so the user starts from a sane default.
      if (result.coordinateSystem && SUPPORTED_CRS.has(result.coordinateSystem)) {
        setCoordinateSystem(result.coordinateSystem);
      }
    } catch (error) {
      logError('Failed to extract setout points:', error);
      toast({
        title: 'Could not read that setout sheet',
        // The backend 400/503 messages are user-facing and useful ("AI setout
        // extraction is not configured…", "Could not extract at least 2…").
        description: extractErrorMessage(error, 'Try another file or enter the points manually.'),
        variant: 'error',
      });
    }
  };

  const handleSave = async () => {
    if (!candidate) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await createMutation.mutateAsync({
        name: trimmed,
        coordinateSystem,
        points: candidate.points,
      });
      toast({ title: 'Control line created', description: `${trimmed} has been added.` });
      onClose();
    } catch (error) {
      logError('Failed to save extracted control line:', error);
      toast({
        title: 'Failed to save control line',
        description: extractErrorMessage(error, 'Please try again.'),
        variant: 'error',
      });
    }
  };

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

          {candidate && (
            <>
              <div>
                <Label htmlFor="setout-name" className="mb-1">
                  Name *
                </Label>
                <Input
                  id="setout-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="setout-crs" className="mb-1">
                  Coordinate system *
                </Label>
                <NativeSelect
                  id="setout-crs"
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
                  {candidate.coordinateSystem
                    ? 'Read from the sheet — confirm it matches your survey datum.'
                    : 'The sheet did not state a datum — set the zone your coordinates are in.'}
                </p>
              </div>

              {candidate.warnings.length > 0 && (
                <div
                  role="status"
                  className="rounded-md bg-warning/10 p-3 text-xs text-warning"
                  data-testid="setout-warnings"
                >
                  <ul className="list-disc space-y-1 pl-4">
                    {candidate.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <p className="mb-2 text-sm text-muted-foreground">
                  {candidate.points.length} point{candidate.points.length === 1 ? '' : 's'} read
                  from the sheet. Check these against the drawing before saving.
                </p>
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
                      {candidate.points.map((point, index) => (
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
              </div>
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
          onClick={() => void handleSave()}
          disabled={busy || !candidate || name.trim() === ''}
        >
          {createMutation.isLoading ? 'Saving…' : 'Save control line'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
