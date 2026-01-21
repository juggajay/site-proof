import Dexie, { Table } from 'dexie';

// Define types for offline storage
export interface OfflineITPCompletion {
  id: string;
  lotId: string;
  checklistItemId: string;
  status: 'pending' | 'completed' | 'na' | 'failed';
  notes?: string;
  completedAt?: string;
  completedBy?: string;
  syncStatus: 'synced' | 'pending' | 'error';
  localUpdatedAt: string;
}

export interface OfflineITPChecklist {
  id: string;
  lotId: string;
  templateId: string;
  templateName: string;
  items: OfflineChecklistItem[];
  cachedAt: string;
}

export interface OfflineChecklistItem {
  id: string;
  name: string;
  description?: string;
  responsibleParty: string;
  isHoldPoint: boolean;
  status: 'pending' | 'completed' | 'na' | 'failed';
  notes?: string;
  completedAt?: string;
  completedBy?: string;
}

export interface SyncQueueItem {
  id?: number;
  type: 'itp_completion' | 'photo_upload' | 'diary_save' | 'diary_submit' | 'docket_create' | 'docket_submit' | 'lot_edit' | 'lot_conflict';
  action: 'create' | 'update';
  data: any;
  createdAt: string;
  attempts: number;
  lastError?: string;
}

// Feature #313: Offline Docket Creation
export interface OfflineDocket {
  id: string;
  projectId: string;
  subcontractorCompanyId: string;
  date: string;
  status: 'draft' | 'pending_approval';
  labourEntries: Array<{
    id: string;
    description: string;
    numberOfWorkers: number;
    hoursWorked: number;
    hourlyRate?: number;
    totalAmount?: number;
    notes?: string;
  }>;
  plantEntries: Array<{
    id: string;
    equipmentType: string;
    hoursUsed: number;
    hourlyRate?: number;
    totalAmount?: number;
    notes?: string;
  }>;
  notes?: string;
  createdBy: string;
  syncStatus: 'synced' | 'pending' | 'error';
  localUpdatedAt: string;
}

// Feature #312: Offline Daily Diary
export interface OfflineDailyDiary {
  id: string;
  projectId: string;
  date: string; // ISO date string (YYYY-MM-DD)
  status: 'draft' | 'submitted';
  weather: {
    conditions?: string;
    temperature?: number;
    rainfall?: number;
    notes?: string;
  };
  workforce: {
    contractors: number;
    subcontractors: number;
    visitors: number;
    notes?: string;
  };
  activities: Array<{
    id: string;
    description: string;
    lotIds?: string[];
    progress?: string;
  }>;
  delays: Array<{
    id: string;
    type: string;
    description: string;
    duration?: number;
    impact?: string;
  }>;
  equipment: Array<{
    id: string;
    name: string;
    hours?: number;
    status?: string;
  }>;
  notes?: string;
  createdBy: string;
  syncStatus: 'synced' | 'pending' | 'error';
  localUpdatedAt: string;
}

// Feature #311: Offline Photo Capture
// Feature #317: Photo Compression
export interface OfflinePhoto {
  id: string;
  projectId: string;
  lotId?: string;
  entityType: 'lot' | 'ncr' | 'holdpoint' | 'itp' | 'test' | 'general';
  entityId?: string;
  fileName: string;
  mimeType: string;
  dataUrl: string; // Base64 encoded image data (compressed)
  caption?: string;
  tags?: string[];
  gpsLatitude?: number;
  gpsLongitude?: number;
  capturedAt: string;
  capturedBy: string;
  syncStatus: 'synced' | 'pending' | 'error';
  localUpdatedAt: string;
  // Feature #317: Compression stats
  originalSize?: number;   // Original file size in bytes
  compressedSize?: number; // Compressed size in bytes
}

// Forward declaration for OfflineLotEdit (defined below)
// The full interface is exported later - this is just for the Table type
interface OfflineLotEditTable {
  id: string;
  projectId: string;
  lotNumber: string;
  description?: string;
  chainage?: number;
  chainageStart?: number;
  chainageEnd?: number;
  offset?: number;
  offsetLeft?: number;
  offsetRight?: number;
  layer?: string;
  areaZone?: string;
  activityType?: string;
  status?: string;
  budget?: number;
  notes?: string;
  syncStatus: string;
  localUpdatedAt: string;
  serverUpdatedAt?: string;
  conflictData?: {
    serverVersion: any;
    localVersion: any;
    detectedAt: string;
    resolved: boolean;
    resolution?: 'local' | 'server' | 'merged';
  };
  editedBy: string;
}

// Dexie database class
class OfflineDatabase extends Dexie {
  itpChecklists!: Table<OfflineITPChecklist>;
  itpCompletions!: Table<OfflineITPCompletion>;
  syncQueue!: Table<SyncQueueItem>;
  photos!: Table<OfflinePhoto>;
  diaries!: Table<OfflineDailyDiary>;
  dockets!: Table<OfflineDocket>;
  lots!: Table<OfflineLotEditTable>;

  constructor() {
    super('SiteProofOfflineDB');

    this.version(1).stores({
      itpChecklists: 'id, lotId, templateId, cachedAt',
      itpCompletions: 'id, lotId, checklistItemId, syncStatus, localUpdatedAt',
      syncQueue: '++id, type, action, createdAt'
    });

    // Version 2: Add photos table for Feature #311
    this.version(2).stores({
      itpChecklists: 'id, lotId, templateId, cachedAt',
      itpCompletions: 'id, lotId, checklistItemId, syncStatus, localUpdatedAt',
      syncQueue: '++id, type, action, createdAt',
      photos: 'id, projectId, lotId, entityType, entityId, syncStatus, capturedAt'
    });

    // Version 3: Add diaries table for Feature #312
    this.version(3).stores({
      itpChecklists: 'id, lotId, templateId, cachedAt',
      itpCompletions: 'id, lotId, checklistItemId, syncStatus, localUpdatedAt',
      syncQueue: '++id, type, action, createdAt',
      photos: 'id, projectId, lotId, entityType, entityId, syncStatus, capturedAt',
      diaries: 'id, projectId, date, status, syncStatus, localUpdatedAt'
    });

    // Version 4: Add dockets table for Feature #313
    this.version(4).stores({
      itpChecklists: 'id, lotId, templateId, cachedAt',
      itpCompletions: 'id, lotId, checklistItemId, syncStatus, localUpdatedAt',
      syncQueue: '++id, type, action, createdAt',
      photos: 'id, projectId, lotId, entityType, entityId, syncStatus, capturedAt',
      diaries: 'id, projectId, date, status, syncStatus, localUpdatedAt',
      dockets: 'id, projectId, subcontractorCompanyId, date, status, syncStatus, localUpdatedAt'
    });

    // Version 5: Add lots table for Feature #314 (Sync Conflict Handling)
    this.version(5).stores({
      itpChecklists: 'id, lotId, templateId, cachedAt',
      itpCompletions: 'id, lotId, checklistItemId, syncStatus, localUpdatedAt',
      syncQueue: '++id, type, action, createdAt',
      photos: 'id, projectId, lotId, entityType, entityId, syncStatus, capturedAt',
      diaries: 'id, projectId, date, status, syncStatus, localUpdatedAt',
      dockets: 'id, projectId, subcontractorCompanyId, date, status, syncStatus, localUpdatedAt',
      lots: 'id, projectId, lotNumber, syncStatus, localUpdatedAt'
    });
  }
}

export const offlineDb = new OfflineDatabase();

// Utility functions for offline ITP management
export async function cacheITPChecklist(
  lotId: string,
  templateId: string,
  templateName: string,
  items: OfflineChecklistItem[]
): Promise<void> {
  const checklist: OfflineITPChecklist = {
    id: `${lotId}-${templateId}`,
    lotId,
    templateId,
    templateName,
    items,
    cachedAt: new Date().toISOString()
  };

  await offlineDb.itpChecklists.put(checklist);
}

export async function getCachedITPChecklist(lotId: string): Promise<OfflineITPChecklist | undefined> {
  return offlineDb.itpChecklists.where('lotId').equals(lotId).first();
}

export async function updateChecklistItemOffline(
  lotId: string,
  checklistItemId: string,
  status: 'pending' | 'completed' | 'na' | 'failed',
  notes?: string,
  completedBy?: string
): Promise<void> {
  const completion: OfflineITPCompletion = {
    id: `${lotId}-${checklistItemId}`,
    lotId,
    checklistItemId,
    status,
    notes,
    completedAt: status === 'completed' ? new Date().toISOString() : undefined,
    completedBy,
    syncStatus: 'pending',
    localUpdatedAt: new Date().toISOString()
  };

  // Store the completion
  await offlineDb.itpCompletions.put(completion);

  // Add to sync queue
  await offlineDb.syncQueue.add({
    type: 'itp_completion',
    action: 'update',
    data: completion,
    createdAt: new Date().toISOString(),
    attempts: 0
  });

  // Update the cached checklist item
  const cachedChecklist = await getCachedITPChecklist(lotId);
  if (cachedChecklist) {
    const updatedItems = cachedChecklist.items.map(item => {
      if (item.id === checklistItemId) {
        return {
          ...item,
          status,
          notes,
          completedAt: status === 'completed' ? new Date().toISOString() : undefined,
          completedBy
        };
      }
      return item;
    });

    await offlineDb.itpChecklists.update(cachedChecklist.id, {
      items: updatedItems,
      cachedAt: new Date().toISOString()
    });
  }
}

export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  return offlineDb.syncQueue.toArray();
}

export async function getPendingSyncCount(): Promise<number> {
  return offlineDb.syncQueue.count();
}

export async function removeSyncQueueItem(id: number): Promise<void> {
  await offlineDb.syncQueue.delete(id);
}

export async function markSyncItemError(id: number, error: string): Promise<void> {
  const item = await offlineDb.syncQueue.get(id);
  if (item) {
    await offlineDb.syncQueue.update(id, {
      attempts: item.attempts + 1,
      lastError: error
    });
  }
}

export async function markCompletionSynced(lotId: string, checklistItemId: string): Promise<void> {
  const id = `${lotId}-${checklistItemId}`;
  await offlineDb.itpCompletions.update(id, { syncStatus: 'synced' });
}

export async function clearAllOfflineData(): Promise<void> {
  await offlineDb.itpChecklists.clear();
  await offlineDb.itpCompletions.clear();
  await offlineDb.syncQueue.clear();
  await offlineDb.photos.clear();
  await offlineDb.diaries.clear();
  await offlineDb.dockets.clear();
}

// ============================================================================
// Feature #311: Offline Photo Capture Functions
// Feature #317: Photo Compression
// ============================================================================

// Compression configuration
const COMPRESSION_CONFIG = {
  maxWidth: 1920,      // Maximum width in pixels
  maxHeight: 1080,     // Maximum height in pixels
  quality: 0.8,        // JPEG quality (0-1)
  maxSizeKB: 500       // Target max file size in KB
};

// Generate unique photo ID
function generatePhotoId(): string {
  return `photo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Feature #317: Compress and resize image
export async function compressImage(file: File): Promise<{ dataUrl: string; originalSize: number; compressedSize: number }> {
  const originalSize = file.size;

  // Skip compression for already small files (< 100KB) or non-image files
  if (originalSize < 100 * 1024 || !file.type.startsWith('image/')) {
    const dataUrl = await fileToDataUrl(file);
    return { dataUrl, originalSize, compressedSize: originalSize };
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    img.onload = () => {
      // Calculate new dimensions while maintaining aspect ratio
      let { width, height } = img;
      const { maxWidth, maxHeight, quality } = COMPRESSION_CONFIG;

      // Scale down if needed
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      // Set canvas dimensions
      canvas.width = width;
      canvas.height = height;

      // Draw image with smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to JPEG with compression
      const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const compressedDataUrl = canvas.toDataURL(mimeType, quality);

      // Calculate compressed size (base64 is ~1.37x larger than binary)
      const base64Length = compressedDataUrl.split(',')[1]?.length || 0;
      const compressedSize = Math.round(base64Length * 0.75);

      console.log(`[Compression] Original: ${(originalSize / 1024).toFixed(1)}KB -> Compressed: ${(compressedSize / 1024).toFixed(1)}KB (${Math.round((1 - compressedSize / originalSize) * 100)}% reduction)`);

      resolve({ dataUrl: compressedDataUrl, originalSize, compressedSize });

      // Cleanup
      URL.revokeObjectURL(img.src);
    };

    img.onerror = () => {
      reject(new Error('Failed to load image for compression'));
    };

    // Load the image
    img.src = URL.createObjectURL(file);
  });
}

// Convert File to base64 data URL (without compression)
export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Capture and store a photo offline (with compression - Feature #317)
export async function capturePhotoOffline(
  projectId: string,
  file: File,
  options: {
    lotId?: string;
    entityType: OfflinePhoto['entityType'];
    entityId?: string;
    caption?: string;
    tags?: string[];
    capturedBy: string;
    gpsLatitude?: number;
    gpsLongitude?: number;
  }
): Promise<OfflinePhoto> {
  // Feature #317: Apply compression before storing
  const { dataUrl, originalSize, compressedSize } = await compressImage(file);

  const photo: OfflinePhoto = {
    id: generatePhotoId(),
    projectId,
    lotId: options.lotId,
    entityType: options.entityType,
    entityId: options.entityId,
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
    compressedSize
  };

  // Store the photo
  await offlineDb.photos.put(photo);

  // Add to sync queue
  await offlineDb.syncQueue.add({
    type: 'photo_upload',
    action: 'create',
    data: { photoId: photo.id },
    createdAt: new Date().toISOString(),
    attempts: 0
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
  entityId: string
): Promise<OfflinePhoto[]> {
  return offlineDb.photos
    .where('entityType').equals(entityType)
    .and(p => p.entityId === entityId)
    .toArray();
}

// Get all pending photos
export async function getPendingPhotos(): Promise<OfflinePhoto[]> {
  return offlineDb.photos.where('syncStatus').equals('pending').toArray();
}

// Get pending photos count
export async function getPendingPhotosCount(): Promise<number> {
  return offlineDb.photos.where('syncStatus').equals('pending').count();
}

// Mark photo as synced
export async function markPhotoSynced(photoId: string, _serverDocumentId?: string): Promise<void> {
  await offlineDb.photos.update(photoId, {
    syncStatus: 'synced',
    localUpdatedAt: new Date().toISOString()
  });
}

// Mark photo sync error
export async function markPhotoSyncError(photoId: string): Promise<void> {
  await offlineDb.photos.update(photoId, {
    syncStatus: 'error',
    localUpdatedAt: new Date().toISOString()
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

// Update photo caption/tags
export async function updateOfflinePhotoMeta(
  photoId: string,
  updates: { caption?: string; tags?: string[]; lotId?: string; entityId?: string }
): Promise<void> {
  await offlineDb.photos.update(photoId, {
    ...updates,
    localUpdatedAt: new Date().toISOString()
  });
}

// ============================================================================
// Feature #312: Offline Daily Diary Functions
// ============================================================================

// Generate diary ID
function generateDiaryId(projectId: string, date: string): string {
  return `diary-${projectId}-${date}`;
}

// Save diary offline (draft)
export async function saveDiaryOffline(
  projectId: string,
  date: string,
  data: Omit<OfflineDailyDiary, 'id' | 'projectId' | 'date' | 'syncStatus' | 'localUpdatedAt'>,
  userId: string
): Promise<OfflineDailyDiary> {
  const id = generateDiaryId(projectId, date);

  const diary: OfflineDailyDiary = {
    id,
    projectId,
    date,
    status: data.status,
    weather: data.weather,
    workforce: data.workforce,
    activities: data.activities,
    delays: data.delays,
    equipment: data.equipment,
    notes: data.notes,
    createdBy: userId,
    syncStatus: 'pending',
    localUpdatedAt: new Date().toISOString()
  };

  // Store the diary
  await offlineDb.diaries.put(diary);

  // Add to sync queue
  await offlineDb.syncQueue.add({
    type: 'diary_save',
    action: 'update',
    data: { diaryId: id },
    createdAt: new Date().toISOString(),
    attempts: 0
  });

  return diary;
}

// Submit diary offline
export async function submitDiaryOffline(
  projectId: string,
  date: string
): Promise<void> {
  const id = generateDiaryId(projectId, date);

  // Update status to submitted
  await offlineDb.diaries.update(id, {
    status: 'submitted',
    syncStatus: 'pending',
    localUpdatedAt: new Date().toISOString()
  });

  // Add submission to sync queue
  await offlineDb.syncQueue.add({
    type: 'diary_submit',
    action: 'update',
    data: { diaryId: id },
    createdAt: new Date().toISOString(),
    attempts: 0
  });
}

// Get diary for a date
export async function getOfflineDiary(projectId: string, date: string): Promise<OfflineDailyDiary | undefined> {
  const id = generateDiaryId(projectId, date);
  return offlineDb.diaries.get(id);
}

// Get all offline diaries for a project
export async function getOfflineDiariesForProject(projectId: string): Promise<OfflineDailyDiary[]> {
  return offlineDb.diaries.where('projectId').equals(projectId).toArray();
}

// Get all pending diary syncs
export async function getPendingDiaries(): Promise<OfflineDailyDiary[]> {
  return offlineDb.diaries.where('syncStatus').equals('pending').toArray();
}

// Mark diary as synced
export async function markDiarySynced(diaryId: string): Promise<void> {
  await offlineDb.diaries.update(diaryId, {
    syncStatus: 'synced',
    localUpdatedAt: new Date().toISOString()
  });
}

// Mark diary sync error
export async function markDiarySyncError(diaryId: string): Promise<void> {
  await offlineDb.diaries.update(diaryId, {
    syncStatus: 'error',
    localUpdatedAt: new Date().toISOString()
  });
}

// Delete offline diary
export async function deleteOfflineDiary(diaryId: string): Promise<void> {
  await offlineDb.diaries.delete(diaryId);
}

// Cache diary data from server
export async function cacheDiaryFromServer(
  projectId: string,
  date: string,
  serverData: any,
  userId: string
): Promise<void> {
  const id = generateDiaryId(projectId, date);

  const diary: OfflineDailyDiary = {
    id,
    projectId,
    date,
    status: serverData.status || 'draft',
    weather: serverData.weather || { conditions: '', temperature: undefined, rainfall: undefined, notes: '' },
    workforce: serverData.workforce || { contractors: 0, subcontractors: 0, visitors: 0, notes: '' },
    activities: serverData.activities || [],
    delays: serverData.delays || [],
    equipment: serverData.equipment || [],
    notes: serverData.notes || '',
    createdBy: serverData.createdById || userId,
    syncStatus: 'synced', // Already on server
    localUpdatedAt: new Date().toISOString()
  };

  await offlineDb.diaries.put(diary);
}

// ============================================================================
// Feature #313: Offline Docket Creation Functions
// ============================================================================

// Generate docket ID
function generateDocketId(): string {
  return `docket-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Create docket offline
export async function createDocketOffline(
  projectId: string,
  subcontractorCompanyId: string,
  date: string,
  data: {
    labourEntries: OfflineDocket['labourEntries'];
    plantEntries: OfflineDocket['plantEntries'];
    notes?: string;
  },
  userId: string
): Promise<OfflineDocket> {
  const id = generateDocketId();

  const docket: OfflineDocket = {
    id,
    projectId,
    subcontractorCompanyId,
    date,
    status: 'draft',
    labourEntries: data.labourEntries,
    plantEntries: data.plantEntries,
    notes: data.notes,
    createdBy: userId,
    syncStatus: 'pending',
    localUpdatedAt: new Date().toISOString()
  };

  // Store the docket
  await offlineDb.dockets.put(docket);

  // Add to sync queue
  await offlineDb.syncQueue.add({
    type: 'docket_create',
    action: 'create',
    data: { docketId: id },
    createdAt: new Date().toISOString(),
    attempts: 0
  });

  return docket;
}

// Submit docket offline
export async function submitDocketOffline(docketId: string): Promise<void> {
  // Update status to pending_approval
  await offlineDb.dockets.update(docketId, {
    status: 'pending_approval',
    syncStatus: 'pending',
    localUpdatedAt: new Date().toISOString()
  });

  // Add submission to sync queue
  await offlineDb.syncQueue.add({
    type: 'docket_submit',
    action: 'update',
    data: { docketId },
    createdAt: new Date().toISOString(),
    attempts: 0
  });
}

// Update docket offline
export async function updateDocketOffline(
  docketId: string,
  updates: Partial<Pick<OfflineDocket, 'labourEntries' | 'plantEntries' | 'notes'>>
): Promise<void> {
  await offlineDb.dockets.update(docketId, {
    ...updates,
    syncStatus: 'pending',
    localUpdatedAt: new Date().toISOString()
  });

  // Add update to sync queue
  await offlineDb.syncQueue.add({
    type: 'docket_create', // Reuse create for updates
    action: 'update',
    data: { docketId },
    createdAt: new Date().toISOString(),
    attempts: 0
  });
}

// Get docket by ID
export async function getOfflineDocket(docketId: string): Promise<OfflineDocket | undefined> {
  return offlineDb.dockets.get(docketId);
}

// Get all offline dockets for a project
export async function getOfflineDocketsForProject(projectId: string): Promise<OfflineDocket[]> {
  return offlineDb.dockets.where('projectId').equals(projectId).toArray();
}

// Get offline dockets for a subcontractor
export async function getOfflineDocketsForSubcontractor(
  subcontractorCompanyId: string
): Promise<OfflineDocket[]> {
  return offlineDb.dockets
    .where('subcontractorCompanyId')
    .equals(subcontractorCompanyId)
    .toArray();
}

// Get all pending docket syncs
export async function getPendingDockets(): Promise<OfflineDocket[]> {
  return offlineDb.dockets.where('syncStatus').equals('pending').toArray();
}

// Mark docket as synced
export async function markDocketSynced(docketId: string, _serverId?: string): Promise<void> {
  await offlineDb.dockets.update(docketId, {
    syncStatus: 'synced',
    localUpdatedAt: new Date().toISOString()
  });
}

// Mark docket sync error
export async function markDocketSyncError(docketId: string): Promise<void> {
  await offlineDb.dockets.update(docketId, {
    syncStatus: 'error',
    localUpdatedAt: new Date().toISOString()
  });
}

// Delete offline docket
export async function deleteOfflineDocket(docketId: string): Promise<void> {
  await offlineDb.dockets.delete(docketId);
}

// ============================================================================
// Feature #314: Offline Lot Editing & Sync Conflict Handling
// ============================================================================

// Type for offline lot edit
export interface OfflineLotEdit {
  id: string; // lotId
  projectId: string;
  lotNumber: string;
  description?: string;
  chainage?: number;
  chainageStart?: number;
  chainageEnd?: number;
  offset?: number;
  offsetLeft?: number;
  offsetRight?: number;
  layer?: string;
  areaZone?: string;
  activityType?: string;
  status?: string;
  budget?: number;
  notes?: string;
  // Sync tracking
  syncStatus: 'synced' | 'pending' | 'conflict' | 'error';
  localUpdatedAt: string;
  serverUpdatedAt?: string; // Last known server timestamp
  conflictData?: {
    serverVersion: OfflineLotEdit;
    localVersion: OfflineLotEdit;
    detectedAt: string;
    resolved: boolean;
    resolution?: 'local' | 'server' | 'merged';
  };
  editedBy: string;
}

// Type for sync conflict notification
export interface SyncConflictNotification {
  id: string;
  entityType: 'lot' | 'diary' | 'docket';
  entityId: string;
  entityName: string;
  message: string;
  createdAt: string;
  read: boolean;
  resolved: boolean;
}

// Add lots table to database schema - we need to update the Dexie class
// This is handled by version upgrade below

// Cache lot data from server for offline editing
export async function cacheLotForOfflineEdit(
  lotData: Partial<OfflineLotEdit> & { id: string; projectId: string; lotNumber: string },
  serverUpdatedAt: string,
  userId: string
): Promise<OfflineLotEdit> {
  const lot: OfflineLotEdit = {
    id: lotData.id,
    projectId: lotData.projectId,
    lotNumber: lotData.lotNumber,
    description: lotData.description,
    chainage: lotData.chainage,
    chainageStart: lotData.chainageStart,
    chainageEnd: lotData.chainageEnd,
    offset: lotData.offset,
    offsetLeft: lotData.offsetLeft,
    offsetRight: lotData.offsetRight,
    layer: lotData.layer,
    areaZone: lotData.areaZone,
    activityType: lotData.activityType,
    status: lotData.status,
    budget: lotData.budget,
    notes: lotData.notes,
    syncStatus: 'synced',
    localUpdatedAt: new Date().toISOString(),
    serverUpdatedAt,
    editedBy: userId
  };

  await offlineDb.lots.put(lot);
  return lot;
}

// Save lot edit offline - accepts full lot object or lotId with updates
export async function saveLotEditOffline(
  lotDataOrId: OfflineLotEdit | string,
  updatesOrUserId?: Partial<OfflineLotEdit> | string,
  userId?: string
): Promise<OfflineLotEdit> {
  let updatedLot: OfflineLotEdit;
  let lotId: string;

  // Handle overloaded function signature
  if (typeof lotDataOrId === 'string') {
    // Old signature: saveLotEditOffline(lotId, updates, userId)
    lotId = lotDataOrId;
    const updates = updatesOrUserId as Partial<OfflineLotEdit>;
    const editedBy = userId as string;

    const existing = await offlineDb.lots.get(lotId);
    if (!existing) {
      throw new Error('Lot not cached for offline editing');
    }

    updatedLot = {
      ...existing,
      ...updates,
      syncStatus: 'pending',
      localUpdatedAt: new Date().toISOString(),
      editedBy
    } as OfflineLotEdit;
  } else {
    // New signature: saveLotEditOffline(lotData) - full lot object
    lotId = lotDataOrId.id;
    updatedLot = {
      ...lotDataOrId,
      syncStatus: 'pending',
      localUpdatedAt: new Date().toISOString()
    };
  }

  // Store the updated lot
  await offlineDb.lots.put(updatedLot as OfflineLotEditTable);

  // Add to sync queue
  await offlineDb.syncQueue.add({
    type: 'lot_edit',
    action: 'update',
    data: { lotId },
    createdAt: new Date().toISOString(),
    attempts: 0
  });

  return updatedLot;
}

// Get offline lot
export async function getOfflineLot(lotId: string): Promise<OfflineLotEdit | undefined> {
  return offlineDb.lots.get(lotId) as Promise<OfflineLotEdit | undefined>;
}

// Get all offline lots for a project
export async function getOfflineLotsForProject(projectId: string): Promise<OfflineLotEdit[]> {
  return offlineDb.lots.where('projectId').equals(projectId).toArray() as Promise<OfflineLotEdit[]>;
}

// Get pending lot edits
export async function getPendingLotEdits(): Promise<OfflineLotEdit[]> {
  return offlineDb.lots.where('syncStatus').equals('pending').toArray() as Promise<OfflineLotEdit[]>;
}

// Get lots with conflicts
export async function getConflictedLots(): Promise<OfflineLotEdit[]> {
  return offlineDb.lots.where('syncStatus').equals('conflict').toArray() as Promise<OfflineLotEdit[]>;
}

// Detect and handle sync conflict
export async function detectLotSyncConflict(
  lotId: string,
  serverData: {
    updatedAt: string;
    lotNumber: string;
    description?: string;
    chainage?: number;
    chainageStart?: number;
    chainageEnd?: number;
    offset?: number;
    offsetLeft?: number;
    offsetRight?: number;
    layer?: string;
    areaZone?: string;
    activityType?: string;
    status?: string;
    budget?: number;
    notes?: string;
  }
): Promise<{ hasConflict: boolean; conflictDetails?: OfflineLotEdit['conflictData'] }> {
  const localLot = await offlineDb.lots.get(lotId) as OfflineLotEdit | undefined;

  if (!localLot || localLot.syncStatus !== 'pending') {
    return { hasConflict: false };
  }

  // Compare server updatedAt with our last known server timestamp
  if (localLot.serverUpdatedAt && new Date(serverData.updatedAt) > new Date(localLot.serverUpdatedAt)) {
    // Server has been updated since we cached - CONFLICT!
    const conflictData: OfflineLotEdit['conflictData'] = {
      serverVersion: {
        id: lotId,
        projectId: localLot.projectId,
        lotNumber: serverData.lotNumber,
        description: serverData.description,
        chainage: serverData.chainage,
        chainageStart: serverData.chainageStart,
        chainageEnd: serverData.chainageEnd,
        offset: serverData.offset,
        offsetLeft: serverData.offsetLeft,
        offsetRight: serverData.offsetRight,
        layer: serverData.layer,
        areaZone: serverData.areaZone,
        activityType: serverData.activityType,
        status: serverData.status,
        budget: serverData.budget,
        notes: serverData.notes,
        syncStatus: 'synced',
        localUpdatedAt: serverData.updatedAt,
        serverUpdatedAt: serverData.updatedAt,
        editedBy: 'server'
      },
      localVersion: { ...localLot },
      detectedAt: new Date().toISOString(),
      resolved: false
    };

    // Update the lot with conflict status
    await offlineDb.lots.update(lotId, {
      syncStatus: 'conflict',
      conflictData
    });

    // Add conflict notification to sync queue
    await offlineDb.syncQueue.add({
      type: 'lot_conflict' as any,
      action: 'create',
      data: {
        lotId,
        lotNumber: localLot.lotNumber,
        projectId: localLot.projectId,
        message: `Sync conflict detected for lot ${localLot.lotNumber}. Another user edited this lot while you were offline.`
      },
      createdAt: new Date().toISOString(),
      attempts: 0
    });

    return { hasConflict: true, conflictDetails: conflictData };
  }

  return { hasConflict: false };
}

// Resolve conflict - choose local version
export async function resolveConflictWithLocal(lotId: string): Promise<void> {
  const lot = await offlineDb.lots.get(lotId) as OfflineLotEdit | undefined;
  if (!lot || lot.syncStatus !== 'conflict') {
    throw new Error('No conflict to resolve');
  }

  // Mark conflict as resolved with local choice
  await offlineDb.lots.update(lotId, {
    syncStatus: 'pending', // Will be synced
    conflictData: {
      ...lot.conflictData!,
      resolved: true,
      resolution: 'local'
    }
  } as Partial<OfflineLotEditTable>);

  // Add back to sync queue to push local changes
  await offlineDb.syncQueue.add({
    type: 'lot_edit',
    action: 'update',
    data: { lotId, forceOverwrite: true },
    createdAt: new Date().toISOString(),
    attempts: 0
  });
}

// Resolve conflict - choose server version
export async function resolveConflictWithServer(lotId: string): Promise<void> {
  const lot = await offlineDb.lots.get(lotId) as OfflineLotEdit | undefined;
  if (!lot || lot.syncStatus !== 'conflict' || !lot.conflictData) {
    throw new Error('No conflict to resolve');
  }

  // Replace local with server version
  const serverVersion = lot.conflictData.serverVersion;
  await offlineDb.lots.update(lotId, {
    ...serverVersion,
    syncStatus: 'synced',
    conflictData: {
      ...lot.conflictData,
      resolved: true,
      resolution: 'server'
    }
  });
}

// Resolve conflict - merge versions
export async function resolveConflictWithMerge(
  lotId: string,
  mergedData: Partial<OfflineLotEdit>
): Promise<void> {
  const lot = await offlineDb.lots.get(lotId) as OfflineLotEdit | undefined;
  if (!lot || lot.syncStatus !== 'conflict') {
    throw new Error('No conflict to resolve');
  }

  // Apply merged data
  await offlineDb.lots.update(lotId, {
    ...mergedData,
    syncStatus: 'pending',
    localUpdatedAt: new Date().toISOString(),
    conflictData: {
      ...lot.conflictData!,
      resolved: true,
      resolution: 'merged'
    }
  } as Partial<OfflineLotEditTable>);

  // Add to sync queue to push merged version
  await offlineDb.syncQueue.add({
    type: 'lot_edit',
    action: 'update',
    data: { lotId, forceOverwrite: true },
    createdAt: new Date().toISOString(),
    attempts: 0
  });
}

// Mark lot as synced
export async function markLotSynced(lotId: string, serverUpdatedAt: string): Promise<void> {
  await offlineDb.lots.update(lotId, {
    syncStatus: 'synced',
    serverUpdatedAt,
    localUpdatedAt: new Date().toISOString()
  });
}

// Mark lot sync error
export async function markLotSyncError(lotId: string): Promise<void> {
  await offlineDb.lots.update(lotId, {
    syncStatus: 'error',
    localUpdatedAt: new Date().toISOString()
  });
}

// Delete offline lot
export async function deleteOfflineLot(lotId: string): Promise<void> {
  await offlineDb.lots.delete(lotId);
}

// Get count of lots with conflicts
export async function getConflictedLotsCount(): Promise<number> {
  return offlineDb.lots.where('syncStatus').equals('conflict').count();
}
