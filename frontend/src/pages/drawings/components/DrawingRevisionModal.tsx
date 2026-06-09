import type { ChangeEvent, Dispatch, RefObject, SetStateAction } from 'react';
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
  DRAWING_FILE_ACCEPT,
  DRAWING_STATUSES,
  formatFileSize,
  isDrawingRevisionReady,
  type Drawing,
  type DrawingRevisionForm,
} from '../drawingsUploadData';

interface DrawingRevisionModalProps {
  drawing: Drawing;
  form: DrawingRevisionForm;
  setForm: Dispatch<SetStateAction<DrawingRevisionForm>>;
  selectedFile: File | null;
  onFileSelect: (e: ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: RefObject<HTMLInputElement>;
  uploading: boolean;
  onClose: () => void;
  onUpload: () => void;
}

export function DrawingRevisionModal({
  drawing,
  form,
  setForm,
  selectedFile,
  onFileSelect,
  fileInputRef,
  uploading,
  onClose,
  onUpload,
}: DrawingRevisionModalProps) {
  return (
    <Modal
      onClose={() => {
        if (!uploading) onClose();
      }}
      className="max-w-lg"
    >
      <ModalHeader>Upload New Revision</ModalHeader>
      <ModalDescription>
        Upload a new file and revision details. The existing drawing will be marked as superseded.
      </ModalDescription>
      <ModalBody>
        <p className="text-sm text-muted-foreground mb-4">
          Creating new revision for: <strong>{drawing.drawingNumber}</strong>
          {drawing.revision && ` (Current: Rev ${drawing.revision})`}
        </p>

        <div className="space-y-4">
          {/* File Input */}
          <div>
            <Label htmlFor="drawing-revision-file" className="mb-2">
              Select File *
            </Label>
            <Input
              id="drawing-revision-file"
              ref={fileInputRef}
              type="file"
              onChange={onFileSelect}
              accept={DRAWING_FILE_ACCEPT}
            />
            {selectedFile && (
              <p className="mt-1 text-sm text-muted-foreground">
                Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
              </p>
            )}
          </div>

          {/* New Revision */}
          <div>
            <Label htmlFor="drawing-revision-number" className="mb-2">
              New Revision *
            </Label>
            <Input
              id="drawing-revision-number"
              type="text"
              value={form.revision}
              onChange={(e) => setForm((prev) => ({ ...prev, revision: e.target.value }))}
              placeholder="e.g., B, C, 02"
            />
          </div>

          {/* Title */}
          <div>
            <Label htmlFor="drawing-revision-title" className="mb-2">
              Title
            </Label>
            <Input
              id="drawing-revision-title"
              type="text"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            />
          </div>

          {/* Issue Date */}
          <div>
            <Label htmlFor="drawing-revision-issue-date" className="mb-2">
              Issue Date
            </Label>
            <Input
              id="drawing-revision-issue-date"
              type="date"
              value={form.issueDate}
              onChange={(e) => setForm((prev) => ({ ...prev, issueDate: e.target.value }))}
            />
          </div>

          {/* Status */}
          <div>
            <Label htmlFor="drawing-revision-status" className="mb-2">
              Status
            </Label>
            <NativeSelect
              id="drawing-revision-status"
              value={form.status}
              onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
            >
              {DRAWING_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="rounded-lg bg-warning/10 border border-warning/20 p-3 text-sm text-warning">
            <strong>Note:</strong> The previous revision ({drawing.revision || 'original'}) will be
            marked as superseded.
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={onClose} disabled={uploading}>
          Cancel
        </Button>
        <Button
          onClick={onUpload}
          disabled={!isDrawingRevisionReady(selectedFile, form) || uploading}
        >
          {uploading ? 'Uploading...' : 'Upload Revision'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
