import { useRef, useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { toast } from '@/components/ui/toaster';
import { authFetch } from '@/lib/api';
import { SecureDocumentImage } from '@/components/documents/SecureDocumentImage';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { ITPAttachment, ITPChecklistItem, ITPCompletion, ITPInstance, LotTab } from '../types';
import { logError } from '@/lib/logger';
import { PhotoViewerModal } from './PhotoViewerModal';
import { PhotosEmptyState, PhotosSelectionToolbar } from './PhotosTabSections';

interface PhotosTabProps {
  itpInstance: ITPInstance | null;
  lotId: string;
  onTabChange: (tab: LotTab) => void;
  onItpInstanceUpdate: (instance: ITPInstance) => void;
}

interface ITPPhoto {
  attachment: ITPAttachment;
  checklistItem: ITPChecklistItem;
  completion: ITPCompletion;
}

export function PhotosTab({
  itpInstance,
  lotId,
  onTabChange,
  onItpInstanceUpdate,
}: PhotosTabProps) {
  // Photo viewer state
  const [selectedPhoto, setSelectedPhoto] = useState<ITPAttachment | null>(null);
  const [photoZoom, setPhotoZoom] = useState(1);

  // Batch photo selection state
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [showBatchCaptionModal, setShowBatchCaptionModal] = useState(false);
  const [batchCaption, setBatchCaption] = useState('');
  const [applyingBatchCaption, setApplyingBatchCaption] = useState(false);
  const applyingBatchCaptionRef = useRef(false);

  // Add to Evidence modal state
  const [showAddToEvidenceModal, setShowAddToEvidenceModal] = useState(false);
  const [selectedEvidenceItem, setSelectedEvidenceItem] = useState<string | null>(null);
  const [addingToEvidence, setAddingToEvidence] = useState(false);
  const addingToEvidenceRef = useRef(false);

  // Collect all photos from ITP completions
  const itpPhotos: ITPPhoto[] = [];
  if (itpInstance) {
    itpInstance.completions.forEach((completion) => {
      if (completion.attachments && completion.attachments.length > 0) {
        const checklistItem = itpInstance.template.checklistItems.find(
          (item) => item.id === completion.checklistItemId,
        );
        if (checklistItem) {
          completion.attachments.forEach((attachment) => {
            itpPhotos.push({ attachment, checklistItem, completion });
          });
        }
      }
    });
  }

  // Helper function to toggle photo selection
  const togglePhotoSelection = (photoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPhotos((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(photoId)) {
        newSet.delete(photoId);
      } else {
        newSet.add(photoId);
      }
      return newSet;
    });
  };

  // Helper function to select/deselect all photos
  const toggleSelectAll = () => {
    if (selectedPhotos.size === itpPhotos.length) {
      setSelectedPhotos(new Set());
    } else {
      setSelectedPhotos(new Set(itpPhotos.map((p) => p.attachment.document.id)));
    }
  };

  // Refresh ITP data helper
  const refreshItpData = async () => {
    const itpRes = await authFetch(`/api/itp/instances/lot/${encodeURIComponent(lotId)}`);
    if (itpRes.ok) {
      const data = await itpRes.json();
      onItpInstanceUpdate(data.instance);
    }
  };

  // Function to apply batch caption to selected photos
  const applyBatchCaptionToPhotos = async () => {
    if (selectedPhotos.size === 0 || !batchCaption.trim() || applyingBatchCaptionRef.current)
      return;

    applyingBatchCaptionRef.current = true;
    setApplyingBatchCaption(true);
    try {
      const updatePromises = Array.from(selectedPhotos).map((documentId) =>
        authFetch(`/api/documents/${encodeURIComponent(documentId)}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ caption: batchCaption.trim() }),
        }),
      );

      const results = await Promise.all(updatePromises);
      const failed = results.filter((r) => !r.ok);

      if (failed.length > 0) {
        toast({
          title: 'Partial Success',
          description: `Updated ${results.length - failed.length} of ${results.length} photos`,
          variant: 'warning',
        });
      } else {
        toast({
          title: 'Success',
          description: `Caption applied to ${selectedPhotos.size} photo${selectedPhotos.size !== 1 ? 's' : ''}`,
        });
      }

      // Refresh ITP data to show updated captions
      await refreshItpData();

      // Clear selections and close modal
      setSelectedPhotos(new Set());
      setBatchCaption('');
      setShowBatchCaptionModal(false);
    } catch (error) {
      logError('Error applying batch caption:', error);
      toast({
        title: 'Error',
        description: 'Failed to apply caption to photos',
        variant: 'error',
      });
    } finally {
      applyingBatchCaptionRef.current = false;
      setApplyingBatchCaption(false);
    }
  };

  // Function to add selected photos to an ITP checklist item as evidence
  const addPhotosToEvidence = async () => {
    if (selectedPhotos.size === 0 || !selectedEvidenceItem || addingToEvidenceRef.current) return;

    addingToEvidenceRef.current = true;
    setAddingToEvidence(true);
    try {
      // First, ensure there's a completion for this checklist item
      let completionId: string | null = null;
      const existingCompletion = itpInstance?.completions?.find(
        (c) => c.checklistItemId === selectedEvidenceItem,
      );

      if (existingCompletion) {
        completionId = existingCompletion.id;
      } else {
        // Create a pending completion first
        const createRes = await authFetch('/api/itp/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            itpInstanceId: itpInstance?.id,
            checklistItemId: selectedEvidenceItem,
            isCompleted: false,
            notes: '',
          }),
        });
        if (createRes.ok) {
          const data = await createRes.json();
          completionId = data.completion.id;
        }
      }

      if (!completionId) {
        throw new Error('Could not find or create completion');
      }

      // Now add each selected photo as an attachment
      const attachmentPromises = Array.from(selectedPhotos).map(async (documentId) => {
        // Find the document details
        const photoDoc = itpPhotos.find((p) => p.attachment.document.id === documentId);
        if (!photoDoc) return null;

        const res = await authFetch(
          `/api/itp/completions/${encodeURIComponent(completionId)}/attachments`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              documentId: photoDoc.attachment.document.id,
            }),
          },
        );
        return res.ok;
      });

      const results = await Promise.all(attachmentPromises);
      const successCount = results.filter((r) => r === true).length;

      if (successCount > 0) {
        toast({
          title: 'Success',
          description: `Added ${successCount} photo${successCount !== 1 ? 's' : ''} as evidence`,
        });

        // Refresh ITP data
        await refreshItpData();
      } else {
        toast({
          title: 'Error',
          description: 'Failed to add photos as evidence',
          variant: 'error',
        });
      }

      // Clear selections and close modal
      setSelectedPhotos(new Set());
      setSelectedEvidenceItem(null);
      setShowAddToEvidenceModal(false);
    } catch (error) {
      logError('Error adding photos to evidence:', error);
      toast({
        title: 'Error',
        description: 'Failed to add photos as evidence',
        variant: 'error',
      });
    } finally {
      addingToEvidenceRef.current = false;
      setAddingToEvidence(false);
    }
  };

  // Empty state
  if (itpPhotos.length === 0) {
    return <PhotosEmptyState onOpenItpChecklist={() => onTabChange('itp')} />;
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Photos</h2>
      </div>

      <div className="space-y-4">
        {/* Header with selection controls */}
        <PhotosSelectionToolbar
          photoCount={itpPhotos.length}
          selectedCount={selectedPhotos.size}
          allSelected={selectedPhotos.size === itpPhotos.length && itpPhotos.length > 0}
          onToggleSelectAll={toggleSelectAll}
          onOpenBatchCaption={() => setShowBatchCaptionModal(true)}
          onOpenAddToEvidence={() => setShowAddToEvidenceModal(true)}
        />

        {/* Photo grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {itpPhotos.map(({ attachment, checklistItem }) => {
            const isSelected = selectedPhotos.has(attachment.document.id);
            return (
              <div
                key={attachment.id}
                className={`relative group cursor-pointer rounded-lg border overflow-hidden transition-colors ${
                  isSelected
                    ? 'border-primary border-2 ring-2 ring-primary/20'
                    : 'hover:border-primary'
                }`}
                onClick={() => setSelectedPhoto(attachment)}
              >
                {/* Selection checkbox */}
                <div
                  className="absolute top-2 left-2 z-10"
                  onClick={(e) => togglePhotoSelection(attachment.document.id, e)}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    className="h-5 w-5 rounded border-2 border-white bg-white/80 cursor-pointer"
                  />
                </div>
                <SecureDocumentImage
                  documentId={attachment.document.id}
                  fileUrl={attachment.document.fileUrl}
                  alt={attachment.document.caption || attachment.document.filename}
                  className="w-full h-40 object-cover"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white text-sm font-medium">View</span>
                </div>
                {/* Caption badge if exists */}
                {attachment.document.caption && (
                  <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded">
                    Captioned
                  </div>
                )}
                {/* ITP Reference Badge */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                  <p className="text-xs text-white truncate flex items-center gap-1">
                    <span>📋</span>
                    <span className="font-medium">ITP {checklistItem.order}:</span>
                    <span className="truncate">{checklistItem.description}</span>
                  </p>
                  {attachment.document.caption && (
                    <p className="text-xs text-white/80 truncate mt-0.5">
                      📝 {attachment.document.caption}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Batch Caption Modal */}
        {showBatchCaptionModal && (
          <Modal
            onClose={() => {
              setShowBatchCaptionModal(false);
              setBatchCaption('');
            }}
            className="max-w-md"
          >
            <ModalHeader>Bulk Caption Photos</ModalHeader>
            <ModalBody>
              <p className="text-sm text-muted-foreground mb-4">
                Apply caption to {selectedPhotos.size} selected photo
                {selectedPhotos.size !== 1 ? 's' : ''}
              </p>
              <Textarea
                value={batchCaption}
                onChange={(e) => setBatchCaption(e.target.value)}
                placeholder="Enter caption for all selected photos..."
                className="h-24 resize-none"
                autoFocus
              />
            </ModalBody>
            <ModalFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowBatchCaptionModal(false);
                  setBatchCaption('');
                }}
                disabled={applyingBatchCaption}
              >
                Cancel
              </Button>
              <Button
                onClick={applyBatchCaptionToPhotos}
                disabled={!batchCaption.trim() || applyingBatchCaption}
              >
                {applyingBatchCaption ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Applying...
                  </>
                ) : (
                  'Apply Caption'
                )}
              </Button>
            </ModalFooter>
          </Modal>
        )}

        {/* Add to Evidence Modal */}
        {showAddToEvidenceModal && itpInstance?.template?.checklistItems && (
          <Modal
            onClose={() => {
              setShowAddToEvidenceModal(false);
              setSelectedEvidenceItem(null);
            }}
            className="max-w-lg"
          >
            <ModalHeader>Add Photos to Evidence</ModalHeader>
            <ModalBody className="max-h-[60vh] overflow-y-auto">
              <p className="text-sm text-muted-foreground mb-4">
                Select an ITP checklist item to attach {selectedPhotos.size} photo
                {selectedPhotos.size !== 1 ? 's' : ''} as evidence
              </p>
              <div className="space-y-2">
                {itpInstance.template.checklistItems.map((item: ITPChecklistItem) => {
                  const completion = itpInstance.completions?.find(
                    (c) => c.checklistItemId === item.id,
                  );
                  const isSelected = selectedEvidenceItem === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelectedEvidenceItem(item.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        isSelected
                          ? 'border-green-500 bg-green-50 dark:bg-green-950/30'
                          : 'hover:border-primary hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {item.order}. {item.description}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {item.evidenceRequired !== 'none'
                              ? `Requires: ${item.evidenceRequired}`
                              : 'No evidence required'}
                            {(completion?.attachments?.length ?? 0) > 0 &&
                              ` • ${completion?.attachments?.length ?? 0} attached`}
                          </p>
                        </div>
                        {isSelected && (
                          <CheckCircle className="h-5 w-5 text-green-500 ml-2 flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </ModalBody>
            <ModalFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddToEvidenceModal(false);
                  setSelectedEvidenceItem(null);
                }}
                disabled={addingToEvidence}
              >
                Cancel
              </Button>
              <Button
                variant="success"
                onClick={addPhotosToEvidence}
                disabled={!selectedEvidenceItem || addingToEvidence}
              >
                {addingToEvidence ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Adding...
                  </>
                ) : (
                  'Add to Evidence'
                )}
              </Button>
            </ModalFooter>
          </Modal>
        )}
      </div>

      {/* Photo Viewer Modal with Prev/Next Navigation and Zoom */}
      <PhotoViewerModal
        selectedPhoto={selectedPhoto}
        photoZoom={photoZoom}
        itpInstance={itpInstance}
        onClose={() => {
          setSelectedPhoto(null);
          setPhotoZoom(1);
        }}
        onPhotoChange={(photo) => {
          setSelectedPhoto(photo);
          setPhotoZoom(1);
        }}
        onZoomChange={setPhotoZoom}
      />
    </div>
  );
}
