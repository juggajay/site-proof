/**
 * Stateful hook backing the Documents page upload workflow. It owns the upload
 * modal state, the selected files + form buffer, the multi-file upload mutation
 * (with progress + partial-failure handling), the image-dimension hint, and the
 * page-level drag/drop that opens the modal preloaded.
 *
 * It must be instantiated once by the page (not inside the modal) because the
 * page-level drop zone and the modal share the same upload state. Behaviour is
 * preserved verbatim from the previous inline DocumentsPage.tsx implementation,
 * including the synchronous `uploadingRef` guard that blocks a same-tick double
 * submit before `uploading` re-renders.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { extractErrorMessage } from '@/lib/errorHandling';
import { queryKeys } from '@/lib/queryKeys';
import { toast } from '@/components/ui/toaster';
import {
  buildPartialFailureMessage,
  buildUploadSuccessMessage,
  detectDocumentTypeFromFile,
  EMPTY_UPLOAD_FORM,
  evaluateImageDimensions,
  uploadDocuments,
  type ImageDimensions,
  type UploadDocumentForm,
  type UploadedDocument,
} from './documentsUploadData';

export interface ContainerDragHandlers {
  onDragEnter: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

export interface UseDocumentUploadResult {
  showUploadModal: boolean;
  openUploadModal: () => void;
  closeUploadModal: () => void;
  selectedFiles: File[];
  uploadForm: UploadDocumentForm;
  updateUploadForm: (patch: Partial<UploadDocumentForm>) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleModalDrop: (e: React.DragEvent) => void;
  uploading: boolean;
  uploadProgress: number;
  uploadedCount: number;
  handleUpload: () => void;
  imageDimensions: ImageDimensions | null;
  dimensionWarning: string | null;
  isDragging: boolean;
  dropZoneRef: React.RefObject<HTMLDivElement>;
  containerDragHandlers: ContainerDragHandlers;
}

export function useDocumentUpload(projectId: string | undefined): UseDocumentUploadResult {
  const queryClient = useQueryClient();
  const uploadingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const imageDimensionObjectUrlRef = useRef<string | null>(null);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadForm, setUploadForm] = useState<UploadDocumentForm>(EMPTY_UPLOAD_FORM);
  const [isDragging, setIsDragging] = useState(false);
  const [imageDimensions, setImageDimensions] = useState<ImageDimensions | null>(null);
  const [dimensionWarning, setDimensionWarning] = useState<string | null>(null);

  const revokeImageDimensionObjectUrl = useCallback((expectedUrl?: string) => {
    const objectUrl = imageDimensionObjectUrlRef.current;
    if (!objectUrl || (expectedUrl && objectUrl !== expectedUrl)) return;
    URL.revokeObjectURL(objectUrl);
    imageDimensionObjectUrlRef.current = null;
  }, []);

  useEffect(() => () => revokeImageDimensionObjectUrl(), [revokeImageDimensionObjectUrl]);

  const updateUploadForm = useCallback((patch: Partial<UploadDocumentForm>) => {
    setUploadForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const applySelectedFiles = useCallback((fileArray: File[]) => {
    setSelectedFiles(fileArray);
    setImageDimensions(null);
    setDimensionWarning(null);

    const firstFile = fileArray[0];
    const detected = firstFile ? detectDocumentTypeFromFile(firstFile) : null;
    if (detected) setUploadForm((prev) => ({ ...prev, documentType: detected }));
    return firstFile;
  }, []);

  const openUploadModal = useCallback(() => setShowUploadModal(true), []);

  const closeUploadModal = useCallback(() => {
    revokeImageDimensionObjectUrl();
    setShowUploadModal(false);
    setSelectedFiles([]);
    setUploadForm(EMPTY_UPLOAD_FORM);
    setImageDimensions(null);
    setDimensionWarning(null);
  }, [revokeImageDimensionObjectUrl]);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        revokeImageDimensionObjectUrl();
        const fileArray = Array.from(files);
        const firstFile = applySelectedFiles(fileArray);

        // Check image dimensions for a single image selection.
        if (firstFile?.type.startsWith('image/') && fileArray.length === 1) {
          const objectUrl = URL.createObjectURL(firstFile);
          imageDimensionObjectUrlRef.current = objectUrl;
          const img = new window.Image();
          img.onload = () => {
            if (imageDimensionObjectUrlRef.current !== objectUrl) return;
            const width = img.naturalWidth;
            const height = img.naturalHeight;
            setImageDimensions({ width, height });
            const warning = evaluateImageDimensions(width, height);
            if (warning) setDimensionWarning(warning);
            revokeImageDimensionObjectUrl(objectUrl);
          };
          img.onerror = () => {
            revokeImageDimensionObjectUrl(objectUrl);
          };
          img.src = objectUrl;
        }
      }
    },
    [applySelectedFiles, revokeImageDimensionObjectUrl],
  );

  const handleModalDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        revokeImageDimensionObjectUrl();
        applySelectedFiles(Array.from(files));
      }
    },
    [applySelectedFiles, revokeImageDimensionObjectUrl],
  );

  const uploadDocsMutation = useMutation({
    mutationFn: async ({ files, form }: { files: File[]; form: UploadDocumentForm }) => {
      const { uploadedDocs, failedUploads } = await uploadDocuments({
        files,
        projectId,
        form,
        onProgress: (count, percent) => {
          setUploadedCount(count);
          setUploadProgress(percent);
        },
      });

      if (failedUploads.length > 0) {
        const description = buildPartialFailureMessage(
          uploadedDocs.length,
          files.length,
          failedUploads,
        );
        if (uploadedDocs.length === 0) {
          throw new Error(description);
        }
        toast({
          title: 'Some files failed',
          description,
          variant: 'warning',
        });
      }

      return uploadedDocs;
    },
    onSuccess: (uploadedDocs: UploadedDocument[]) => {
      revokeImageDimensionObjectUrl();
      queryClient.invalidateQueries({ queryKey: queryKeys.documents(projectId!) });
      setShowUploadModal(false);
      setSelectedFiles([]);
      setUploadForm(EMPTY_UPLOAD_FORM);
      setImageDimensions(null);
      setDimensionWarning(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setUploading(false);
      uploadingRef.current = false;
      setUploadProgress(0);
      setUploadedCount(0);
      toast({
        title: 'Documents uploaded',
        description: buildUploadSuccessMessage(uploadedDocs.length),
        variant: 'success',
      });
    },
    onError: (error) => {
      setUploading(false);
      uploadingRef.current = false;
      setUploadProgress(0);
      setUploadedCount(0);
      toast({
        title: 'Upload failed',
        description: extractErrorMessage(error, 'Failed to upload documents. Please try again.'),
        variant: 'error',
      });
    },
  });

  const handleUpload = useCallback(() => {
    if (uploadingRef.current) return;

    if (selectedFiles.length === 0 || !uploadForm.documentType) {
      toast({
        title: 'Document details required',
        description: 'Select file(s) and choose a document type before uploading.',
        variant: 'error',
      });
      return;
    }
    // Synchronous guard so a same-tick double submit only fires one upload run.
    uploadingRef.current = true;
    setUploading(true);
    setUploadProgress(0);
    setUploadedCount(0);
    uploadDocsMutation.mutate({ files: selectedFiles, form: uploadForm });
  }, [selectedFiles, uploadForm, uploadDocsMutation]);

  // Page-level drag/drop: dropping a file anywhere opens the modal preloaded.
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only stop dragging if leaving the drop zone entirely.
    if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        revokeImageDimensionObjectUrl();
        applySelectedFiles(Array.from(files));
        setShowUploadModal(true);
      }
    },
    [applySelectedFiles, revokeImageDimensionObjectUrl],
  );

  return {
    showUploadModal,
    openUploadModal,
    closeUploadModal,
    selectedFiles,
    uploadForm,
    updateUploadForm,
    fileInputRef,
    handleFileSelect,
    handleModalDrop,
    uploading,
    uploadProgress,
    uploadedCount,
    handleUpload,
    imageDimensions,
    dimensionWarning,
    isDragging,
    dropZoneRef,
    containerDragHandlers: {
      onDragEnter: handleDragEnter,
      onDragLeave: handleDragLeave,
      onDragOver: handleDragOver,
      onDrop: handleDrop,
    },
  };
}
