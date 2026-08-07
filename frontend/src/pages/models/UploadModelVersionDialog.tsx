import { useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { extractErrorMessage } from '@/lib/errorHandling';
import { logError } from '@/lib/logger';
import {
  MAX_SOURCE_SIZE_BYTES,
  createDesignModel,
  createDesignModelVersion,
  sendDesignModelVersionParts,
  type DesignModelVersion,
  type UploadHandle,
} from '@/lib/models/designModelsApi';
import { formatDocumentFileSize } from '@/pages/documents/documentsDisplayData';

type DialogMode =
  | { kind: 'new-model' }
  | { kind: 'new-version'; modelId: string; modelName: string };

type Phase =
  | { step: 'form' }
  | { step: 'preparing' }
  | { step: 'uploading'; partsDone: number; partCount: number }
  | { step: 'error'; message: string };

interface UploadModelVersionDialogProps {
  projectId: string;
  mode: DialogMode;
  onClose: () => void;
  onUploaded: (version: DesignModelVersion) => void;
}

function defaultModelName(file: File): string {
  return file.name.replace(/\.ifc$/i, '').slice(0, 200);
}

/**
 * IFC upload dialog for both flows: create-model-and-upload, and upload a new
 * version to an existing model. Uploads are chunked and resumable — a failure
 * keeps the server-issued upload session so Retry only re-sends what's missing.
 */
export function UploadModelVersionDialog({
  projectId,
  mode,
  onClose,
  onUploaded,
}: UploadModelVersionDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [phase, setPhase] = useState<Phase>({ step: 'form' });
  // Survives a failed attempt: the model row (once created) and the upload
  // session (once declared), so Retry never duplicates either.
  const modelIdRef = useRef<string | null>(mode.kind === 'new-version' ? mode.modelId : null);
  const handleRef = useRef<UploadHandle | null>(null);

  const busy = phase.step === 'preparing' || phase.step === 'uploading';
  const validationError = (() => {
    if (!file) return null;
    if (!/\.ifc$/i.test(file.name)) return 'Only IFC files (.ifc) can be converted for 3D viewing.';
    if (file.size > MAX_SOURCE_SIZE_BYTES) {
      return `IFC files are limited to ${formatDocumentFileSize(MAX_SOURCE_SIZE_BYTES)} — this one is ${formatDocumentFileSize(file.size)}.`;
    }
    return null;
  })();
  const canSubmit =
    Boolean(file) && !validationError && (mode.kind === 'new-version' || name.trim().length > 0);

  const runUpload = async () => {
    if (!file) return;
    try {
      if (!modelIdRef.current) {
        setPhase({ step: 'preparing' });
        const model = await createDesignModel(projectId, name.trim());
        modelIdRef.current = model.id;
      }
      const modelId = modelIdRef.current;
      if (!handleRef.current) {
        setPhase({ step: 'preparing' });
        handleRef.current = await createDesignModelVersion(projectId, modelId, file);
      }
      const handle = handleRef.current;
      setPhase({ step: 'uploading', partsDone: 0, partCount: handle.partCount });
      const version = await sendDesignModelVersionParts(
        projectId,
        modelId,
        handle,
        file,
        (partsDone, partCount) => setPhase({ step: 'uploading', partsDone, partCount }),
      );
      onUploaded(version);
    } catch (err) {
      logError('Design model upload failed:', err);
      setPhase({ step: 'error', message: extractErrorMessage(err, 'The upload failed.') });
    }
  };

  const title = mode.kind === 'new-model' ? 'Upload design model' : 'Upload new version';

  return (
    <Modal onClose={() => !busy && onClose()}>
      <ModalHeader>{title}</ModalHeader>
      <ModalBody>
        <div className="space-y-4">
          {mode.kind === 'new-version' && (
            <p className="text-sm text-muted-foreground">
              A new version of <span className="font-medium">{mode.modelName}</span>. Earlier
              versions are kept.
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="design-model-file">IFC file</Label>
            <Input
              id="design-model-file"
              type="file"
              accept=".ifc"
              disabled={busy}
              onChange={(event) => {
                const selected = event.target.files?.[0] ?? null;
                setFile(selected);
                // A failed session belongs to the previously selected file.
                handleRef.current = null;
                if (selected && !nameTouched) setName(defaultModelName(selected));
                if (phase.step === 'error') setPhase({ step: 'form' });
              }}
            />
            {file && !validationError && (
              <p className="text-xs text-muted-foreground">
                {file.name} · {formatDocumentFileSize(file.size)}
              </p>
            )}
            {validationError && <p className="text-xs text-destructive">{validationError}</p>}
          </div>

          {mode.kind === 'new-model' && (
            <div className="space-y-1.5">
              <Label htmlFor="design-model-name">Model name</Label>
              <Input
                id="design-model-name"
                value={name}
                maxLength={200}
                disabled={busy || Boolean(modelIdRef.current)}
                placeholder="e.g. Stage 2 drainage design"
                onChange={(event) => {
                  setNameTouched(true);
                  setName(event.target.value);
                }}
              />
            </div>
          )}

          {phase.step === 'preparing' && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Preparing upload…
            </div>
          )}

          {phase.step === 'uploading' && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Uploading</span>
                <span>{Math.round((phase.partsDone / Math.max(phase.partCount, 1)) * 100)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{
                    width: `${(phase.partsDone / Math.max(phase.partCount, 1)) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {phase.step === 'error' && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {phase.message}
            </div>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" disabled={!canSubmit || busy} onClick={() => void runUpload()}>
          {phase.step === 'error' ? 'Retry upload' : 'Upload'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
