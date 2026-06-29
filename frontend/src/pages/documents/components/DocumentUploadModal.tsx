import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Modal,
  ModalHeader,
  ModalDescription,
  ModalBody,
  ModalFooter,
} from '@/components/ui/Modal';
import {
  CATEGORIES,
  DOCUMENT_TYPES,
  type ImageDimensions,
  type UploadDocumentForm,
} from '../documentsUploadData';

const DOCUMENT_UPLOAD_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.eml,.msg';

interface DocumentUploadLot {
  id: string;
  lotNumber: string;
  description: string;
}

interface DocumentUploadModalProps {
  selectedFiles: File[];
  uploadForm: UploadDocumentForm;
  uploading: boolean;
  uploadProgress: number;
  uploadedCount: number;
  imageDimensions: ImageDimensions | null;
  dimensionWarning: string | null;
  fileInputRef: React.RefObject<HTMLInputElement>;
  lots: DocumentUploadLot[];
  formatFileSize: (bytes: number | null) => string;
  onClose: () => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onModalDrop: (e: React.DragEvent) => void;
  onFormChange: (patch: Partial<UploadDocumentForm>) => void;
  onUpload: () => void;
}

export function DocumentUploadModal({
  selectedFiles,
  uploadForm,
  uploading,
  uploadProgress,
  uploadedCount,
  imageDimensions,
  dimensionWarning,
  fileInputRef,
  lots,
  formatFileSize,
  onClose,
  onFileSelect,
  onModalDrop,
  onFormChange,
  onUpload,
}: DocumentUploadModalProps) {
  return (
    <Modal onClose={onClose} className="max-w-lg">
      <ModalHeader>Upload Document</ModalHeader>
      <ModalDescription>
        Upload project documents, photos, certificates, or drawings with optional metadata.
      </ModalDescription>
      <ModalBody>
        <div className="space-y-4">
          {/* File Input with Drag-Drop Zone */}
          <div>
            <Label htmlFor="document-upload-file-input" className="mb-2">
              Select Files
            </Label>
            <div
              className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                selectedFiles.length > 0
                  ? 'border-primary bg-muted'
                  : 'border-input bg-background hover:border-primary hover:bg-muted'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={onModalDrop}
            >
              <input
                id="document-upload-file-input"
                ref={fileInputRef}
                type="file"
                multiple
                onChange={onFileSelect}
                accept={DOCUMENT_UPLOAD_ACCEPT}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              {selectedFiles.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <svg
                      className="h-8 w-8 text-foreground"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span className="font-medium text-foreground">
                      {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected
                    </span>
                  </div>
                  <div className="max-h-32 overflow-y-auto text-left">
                    {selectedFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-sm py-1 px-2 hover:bg-muted rounded"
                      >
                        <span className="truncate text-foreground">{file.name}</span>
                        <span className="text-muted-foreground ml-2 flex-shrink-0">
                          {formatFileSize(file.size)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Total: {formatFileSize(selectedFiles.reduce((sum, f) => sum + f.size, 0))}
                  </p>
                </div>
              ) : (
                <>
                  <svg
                    className="mx-auto h-10 w-10 text-muted-foreground"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <p className="mt-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Click to browse</span> or drag and
                    drop
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    PDF, DOC, XLS, JPG, PNG, EML, MSG up to 50MB (select multiple files)
                  </p>
                </>
              )}
            </div>

            {/* Image dimension info and warning (for single image) */}
            {imageDimensions && selectedFiles.length === 1 && (
              <p className="mt-2 text-sm text-muted-foreground">
                Image dimensions: {imageDimensions.width} x {imageDimensions.height} pixels
              </p>
            )}
            {dimensionWarning && (
              <div className="mt-2 p-2 bg-warning/10 border border-warning/30 rounded-lg">
                <p className="text-sm text-warning flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span>{dimensionWarning}</span>
                </p>
              </div>
            )}
          </div>

          {/* Document Type */}
          <div>
            <Label htmlFor="document-upload-type" className="mb-2">
              Document Type *
            </Label>
            <NativeSelect
              id="document-upload-type"
              value={uploadForm.documentType}
              onChange={(e) => onFormChange({ documentType: e.target.value })}
            >
              <option value="">Select type...</option>
              {DOCUMENT_TYPES.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </NativeSelect>
          </div>

          {/* Category */}
          <div>
            <Label htmlFor="document-upload-category" className="mb-2">
              Category
            </Label>
            <NativeSelect
              id="document-upload-category"
              value={uploadForm.category}
              onChange={(e) => onFormChange({ category: e.target.value })}
            >
              <option value="">Select category...</option>
              {CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </NativeSelect>
          </div>

          {/* Link to Lot */}
          <div>
            <Label htmlFor="document-upload-lot" className="mb-2">
              Link to Lot (optional)
            </Label>
            <NativeSelect
              id="document-upload-lot"
              value={uploadForm.lotId}
              onChange={(e) => onFormChange({ lotId: e.target.value })}
            >
              <option value="">No lot selected</option>
              {lots.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {lot.lotNumber} - {lot.description}
                </option>
              ))}
            </NativeSelect>
          </div>

          {/* Description/Caption */}
          <div>
            <Label htmlFor="document-upload-description" className="mb-2">
              Description
            </Label>
            <Textarea
              id="document-upload-description"
              value={uploadForm.caption}
              onChange={(e) => onFormChange({ caption: e.target.value })}
              placeholder="Add a description..."
              rows={3}
            />
          </div>

          {/* Upload Progress */}
          {uploading && (
            <div className="space-y-2">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-sm text-center text-muted-foreground">
                Uploading {uploadedCount} of {selectedFiles.length} files... {uploadProgress}%
              </p>
            </div>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={onClose} disabled={uploading}>
          Cancel
        </Button>
        <Button
          onClick={onUpload}
          disabled={selectedFiles.length === 0 || !uploadForm.documentType || uploading}
        >
          {uploading
            ? 'Uploading...'
            : selectedFiles.length > 1
              ? `Upload ${selectedFiles.length} Files`
              : 'Upload'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
