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
  isDrawingUploadReady,
  type DrawingUploadForm,
} from '../drawingsUploadData';

interface DrawingUploadModalProps {
  form: DrawingUploadForm;
  setForm: Dispatch<SetStateAction<DrawingUploadForm>>;
  selectedFile: File | null;
  onFileSelect: (e: ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: RefObject<HTMLInputElement>;
  uploading: boolean;
  onClose: () => void;
  onUpload: () => void;
}

export function DrawingUploadModal({
  form,
  setForm,
  selectedFile,
  onFileSelect,
  fileInputRef,
  uploading,
  onClose,
  onUpload,
}: DrawingUploadModalProps) {
  return (
    <Modal
      onClose={() => {
        if (!uploading) onClose();
      }}
      className="max-w-lg"
    >
      <ModalHeader>Add Drawing</ModalHeader>
      <ModalDescription>
        Upload a drawing file with its register number, revision, issue date, and status.
      </ModalDescription>
      <ModalBody>
        <div className="space-y-4">
          {/* File Input */}
          <div>
            <Label htmlFor="drawing-upload-file" className="mb-2">
              Select File *
            </Label>
            <Input
              id="drawing-upload-file"
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

          {/* Drawing Number */}
          <div>
            <Label htmlFor="drawing-upload-number" className="mb-2">
              Drawing Number *
            </Label>
            <Input
              id="drawing-upload-number"
              type="text"
              value={form.drawingNumber}
              onChange={(e) => setForm((prev) => ({ ...prev, drawingNumber: e.target.value }))}
              placeholder="e.g., DWG-001"
            />
          </div>

          {/* Title */}
          <div>
            <Label htmlFor="drawing-upload-title" className="mb-2">
              Title
            </Label>
            <Input
              id="drawing-upload-title"
              type="text"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="e.g., Site Plan"
            />
          </div>

          {/* Revision */}
          <div>
            <Label htmlFor="drawing-upload-revision" className="mb-2">
              Revision
            </Label>
            <Input
              id="drawing-upload-revision"
              type="text"
              value={form.revision}
              onChange={(e) => setForm((prev) => ({ ...prev, revision: e.target.value }))}
              placeholder="e.g., A, B, 01"
            />
          </div>

          {/* Issue Date */}
          <div>
            <Label htmlFor="drawing-upload-issue-date" className="mb-2">
              Issue Date
            </Label>
            <Input
              id="drawing-upload-issue-date"
              type="date"
              value={form.issueDate}
              onChange={(e) => setForm((prev) => ({ ...prev, issueDate: e.target.value }))}
            />
          </div>

          {/* Status */}
          <div>
            <Label htmlFor="drawing-upload-status" className="mb-2">
              Status
            </Label>
            <NativeSelect
              id="drawing-upload-status"
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
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={onClose} disabled={uploading}>
          Cancel
        </Button>
        <Button
          onClick={onUpload}
          disabled={!isDrawingUploadReady(selectedFile, form) || uploading}
        >
          {uploading ? 'Uploading...' : 'Upload'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
