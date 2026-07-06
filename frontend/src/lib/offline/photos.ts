// Offline photo capture behavior, moved verbatim from ../offlineDb.ts so the
// photo slice lives beside the database core. The public import path is
// unchanged: '@/lib/offlineDb' re-exports everything exported here, so
// callers keep importing from '@/lib/offlineDb'.

import { createLocalId } from '../localIds';
import { compressImage } from '../offlinePhotoCompression';
import { offlineDb, type OfflinePhoto } from './core';

// ============================================================================
// Feature #311: Offline Photo Capture Functions
// Feature #317: Photo Compression
// ============================================================================

// Generate unique photo ID
function generatePhotoId(): string {
  return createLocalId('photo');
}

// Capture and store a photo offline (with compression - Feature #317)
export async function capturePhotoOffline(
  projectId: string,
  file: File,
  options: {
    lotId?: string;
    entityType: OfflinePhoto['entityType'];
    entityId?: string;
    completionId?: string;
    checklistItemId?: string;
    attachAs?: OfflinePhoto['attachAs'];
    documentType?: string;
    category?: string;
    caption?: string;
    tags?: string[];
    capturedBy: string;
    gpsLatitude?: number;
    gpsLongitude?: number;
    serverDocumentId?: string;
  },
): Promise<OfflinePhoto> {
  // Feature #317: Apply compression before storing
  const { dataUrl, originalSize, compressedSize } = await compressImage(file);

  const photo: OfflinePhoto = {
    id: generatePhotoId(),
    projectId,
    lotId: options.lotId,
    entityType: options.entityType,
    entityId: options.entityId,
    completionId: options.completionId,
    checklistItemId: options.checklistItemId,
    attachAs: options.attachAs,
    documentType: options.documentType ?? 'photo',
    category: options.category,
    fileName: file.name,
    mimeType: file.type.startsWith('image/png') ? 'image/png' : 'image/jpeg',
    dataUrl,
    caption: options.caption,
    tags: options.tags,
    gpsLatitude: options.gpsLatitude,
    gpsLongitude: options.gpsLongitude,
    capturedAt: new Date().toISOString(),
    capturedBy: options.capturedBy,
    syncStatus: 'pending',
    localUpdatedAt: new Date().toISOString(),
    // Feature #317: Store compression stats
    originalSize,
    compressedSize,
    serverDocumentId: options.serverDocumentId,
  };

  // Store the photo
  await offlineDb.photos.put(photo);

  // Add to sync queue
  await offlineDb.syncQueue.add({
    type: 'photo_upload',
    action: 'create',
    data: { photoId: photo.id },
    createdAt: new Date().toISOString(),
    attempts: 0,
  });

  return photo;
}

// Get all photos for a lot
export async function getOfflinePhotosForLot(lotId: string): Promise<OfflinePhoto[]> {
  return offlineDb.photos.where('lotId').equals(lotId).toArray();
}

// Get all photos for an entity
export async function getOfflinePhotosForEntity(
  entityType: OfflinePhoto['entityType'],
  entityId: string,
): Promise<OfflinePhoto[]> {
  return offlineDb.photos
    .where('entityType')
    .equals(entityType)
    .and((p) => p.entityId === entityId)
    .toArray();
}

// Get all pending photos
export async function getPendingPhotos(): Promise<OfflinePhoto[]> {
  return offlineDb.photos.where('syncStatus').equals('pending').toArray();
}

// Get photos that still need attention in the UI: new pending captures plus
// dead-lettered/error captures that should remain visible for retry/removal.
export async function getUnsyncedPhotos(): Promise<OfflinePhoto[]> {
  return offlineDb.photos
    .filter((photo) => photo.syncStatus === 'pending' || photo.syncStatus === 'error')
    .toArray();
}

// Get pending photos count
export async function getPendingPhotosCount(): Promise<number> {
  return offlineDb.photos.where('syncStatus').equals('pending').count();
}

// Mark photo as synced
export async function markPhotoSynced(photoId: string, serverDocumentId?: string): Promise<void> {
  const now = new Date().toISOString();

  await offlineDb.photos.update(photoId, {
    syncStatus: 'synced',
    ...(serverDocumentId ? { serverDocumentId } : {}),
    uploadedAt: now,
    localUpdatedAt: now,
  });
}

// Record the server Document id after a successful upload while a follow-up
// step (attaching the document as NCR evidence) is still outstanding.
// syncStatus stays 'pending' so the sync pill stays honest, and the executor
// can retry the follow-up WITHOUT re-uploading the file.
export async function markPhotoUploadedAwaitingAttach(
  photoId: string,
  serverDocumentId: string,
): Promise<void> {
  await offlineDb.photos.update(photoId, {
    serverDocumentId,
    syncStatus: 'pending',
    localUpdatedAt: new Date().toISOString(),
  });
}

// Mark photo sync error
export async function markPhotoSyncError(photoId: string): Promise<void> {
  await offlineDb.photos.update(photoId, {
    syncStatus: 'error',
    localUpdatedAt: new Date().toISOString(),
  });
}

// Delete offline photo
export async function deleteOfflinePhoto(photoId: string): Promise<void> {
  await offlineDb.photos.delete(photoId);
}

// Get photo by ID
export async function getOfflinePhoto(photoId: string): Promise<OfflinePhoto | undefined> {
  return offlineDb.photos.get(photoId);
}

// Repoint every queued evidence photo from a local placeholder NCR id to the
// real server id once an offline-created NCR syncs, so the photo_upload attach
// step (POST /api/ncrs/:id/evidence) targets the NCR that now exists. entityId
// is a Dexie index, so this queries directly. Returns how many photos moved.
export async function relinkOfflineNcrPhotos(
  localNcrId: string,
  serverNcrId: string,
): Promise<number> {
  return offlineDb.photos.where('entityId').equals(localNcrId).modify({
    entityId: serverNcrId,
    localUpdatedAt: new Date().toISOString(),
  });
}

// Update photo caption/tags
export async function updateOfflinePhotoMeta(
  photoId: string,
  updates: { caption?: string; tags?: string[]; lotId?: string; entityId?: string },
): Promise<void> {
  await offlineDb.photos.update(photoId, {
    ...updates,
    localUpdatedAt: new Date().toISOString(),
  });
}
