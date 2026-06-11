// DB-free behavior characterization for the offline photo slice. The Dexie
// singleton (./core) and the canvas-backed image compressor are replaced with
// focused module mocks, so no IndexedDB or canvas is needed; the functions
// under test run their real bodies and are imported through the public
// '@/lib/offlineDb' path to pin that the re-export surface stays intact.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./core', () => ({
  offlineDb: {
    photos: {
      put: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      get: vi.fn(),
    },
    syncQueue: {
      add: vi.fn(),
    },
  },
}));

vi.mock('../offlinePhotoCompression', () => ({
  compressImage: vi.fn(),
  fileToDataUrl: vi.fn(),
}));

import {
  capturePhotoOffline,
  compressImage,
  deleteOfflinePhoto,
  markPhotoSynced,
  markPhotoUploadedAwaitingAttach,
  markPhotoSyncError,
  offlineDb,
  updateOfflinePhotoMeta,
} from '@/lib/offlineDb';

const compressImageMock = vi.mocked(compressImage);

beforeEach(() => {
  vi.clearAllMocks();
  compressImageMock.mockResolvedValue({
    dataUrl: 'data:image/jpeg;base64,compressed',
    originalSize: 2048,
    compressedSize: 512,
  });
});

describe('capturePhotoOffline', () => {
  it('applies the capture defaults and queues a photo_upload sync entry', async () => {
    const file = new File(['photo-bytes'], 'site-visit.jpg', { type: 'image/jpeg' });

    const photo = await capturePhotoOffline('project-1', file, {
      entityType: 'lot',
      capturedBy: 'user-1',
    });

    expect(compressImageMock).toHaveBeenCalledWith(file);
    expect(photo.id).toMatch(/^photo-/);
    expect(photo).toMatchObject({
      projectId: 'project-1',
      entityType: 'lot',
      documentType: 'photo',
      category: undefined,
      fileName: 'site-visit.jpg',
      mimeType: 'image/jpeg',
      dataUrl: 'data:image/jpeg;base64,compressed',
      capturedBy: 'user-1',
      syncStatus: 'pending',
      originalSize: 2048,
      compressedSize: 512,
    });

    expect(offlineDb.photos.put).toHaveBeenCalledTimes(1);
    expect(offlineDb.photos.put).toHaveBeenCalledWith(photo);
    expect(offlineDb.syncQueue.add).toHaveBeenCalledTimes(1);
    expect(offlineDb.syncQueue.add).toHaveBeenCalledWith({
      type: 'photo_upload',
      action: 'create',
      data: { photoId: photo.id },
      createdAt: expect.any(String),
      attempts: 0,
    });
  });

  it('keeps caller-provided document type/category and stores PNG files as image/png', async () => {
    const file = new File(['png-bytes'], 'defect.png', { type: 'image/png' });

    const photo = await capturePhotoOffline('project-1', file, {
      lotId: 'lot-1',
      entityType: 'ncr',
      entityId: 'ncr-1',
      documentType: 'ncr_evidence',
      category: 'quality',
      capturedBy: 'user-2',
    });

    expect(photo).toMatchObject({
      lotId: 'lot-1',
      entityType: 'ncr',
      entityId: 'ncr-1',
      documentType: 'ncr_evidence',
      category: 'quality',
      mimeType: 'image/png',
    });
  });
});

describe('photo sync-status markers', () => {
  // Behavior re-pin (NCR evidence fix): the server document id is now STORED
  // on sync so retried follow-up steps (NCR evidence attach) never re-upload.
  it('marks a photo synced with a refreshed localUpdatedAt and stores the server document id', async () => {
    await markPhotoSynced('photo-1', 'server-doc-9');

    expect(offlineDb.photos.update).toHaveBeenCalledWith('photo-1', {
      syncStatus: 'synced',
      serverDocumentId: 'server-doc-9',
      uploadedAt: expect.any(String),
      localUpdatedAt: expect.any(String),
    });
  });

  it('marks a photo synced without a server document id (field omitted)', async () => {
    await markPhotoSynced('photo-1');

    expect(offlineDb.photos.update).toHaveBeenCalledWith('photo-1', {
      syncStatus: 'synced',
      uploadedAt: expect.any(String),
      localUpdatedAt: expect.any(String),
    });
  });

  it('records an uploaded-awaiting-attach photo: document id stored, still pending', async () => {
    await markPhotoUploadedAwaitingAttach('photo-1', 'server-doc-9');

    expect(offlineDb.photos.update).toHaveBeenCalledWith('photo-1', {
      serverDocumentId: 'server-doc-9',
      syncStatus: 'pending',
      localUpdatedAt: expect.any(String),
    });
  });

  it('marks a photo errored with a refreshed localUpdatedAt', async () => {
    await markPhotoSyncError('photo-2');

    expect(offlineDb.photos.update).toHaveBeenCalledWith('photo-2', {
      syncStatus: 'error',
      localUpdatedAt: expect.any(String),
    });
  });
});

describe('photo metadata updates and deletion', () => {
  it('merges metadata updates and refreshes localUpdatedAt', async () => {
    await updateOfflinePhotoMeta('photo-3', {
      caption: 'Footing pour',
      tags: ['structures'],
      lotId: 'lot-2',
      entityId: 'entity-2',
    });

    expect(offlineDb.photos.update).toHaveBeenCalledWith('photo-3', {
      caption: 'Footing pour',
      tags: ['structures'],
      lotId: 'lot-2',
      entityId: 'entity-2',
      localUpdatedAt: expect.any(String),
    });
  });

  it('deletes a photo by id', async () => {
    await deleteOfflinePhoto('photo-4');

    expect(offlineDb.photos.delete).toHaveBeenCalledWith('photo-4');
  });
});
