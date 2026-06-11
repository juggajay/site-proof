/**
 * Offline database core, extracted from lib/offlineDb.ts.
 *
 * Owns the foundation only: the offline record/sync-queue types, the
 * OfflineDatabase Dexie class with its versioned schema declarations, and the
 * shared `offlineDb` singleton. All behavior (checklist caching/sync, photo
 * capture, diary, dockets, lot edit/conflict resolution) stays in
 * lib/offlineDb.ts, which re-exports this module so the public
 * `@/lib/offlineDb` import path is unchanged.
 *
 * Schema fidelity is the contract here: table names, indexes, Dexie version
 * blocks 1-6, and queue item shapes are moved byte-identically. Never edit a
 * shipped version block — add a new version instead (Dexie upgrades by
 * replaying version history against what a device already has).
 * core.test.ts characterizes the resulting schema.
 */
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

interface SyncQueueBase<TType extends string, TAction extends 'create' | 'update', TData> {
  id?: number;
  type: TType;
  action: TAction;
  data: TData;
  createdAt: string;
  attempts: number;
  lastError?: string;
}

type SyncQueueIdData<TKey extends string> = Record<TKey, string>;

type LotEditSyncData = {
  lotId: string;
  forceOverwrite?: boolean;
};

type LotConflictSyncData = {
  lotId: string;
  lotNumber: string;
  projectId: string;
  message: string;
};

export type SyncQueueItem =
  | SyncQueueBase<'itp_completion', 'update', OfflineITPCompletion>
  | SyncQueueBase<'photo_upload', 'create', SyncQueueIdData<'photoId'>>
  | SyncQueueBase<'diary_save', 'update', SyncQueueIdData<'diaryId'>>
  | SyncQueueBase<'diary_submit', 'update', SyncQueueIdData<'diaryId'>>
  | SyncQueueBase<'docket_create', 'create' | 'update', SyncQueueIdData<'docketId'>>
  | SyncQueueBase<'docket_submit', 'update', SyncQueueIdData<'docketId'>>
  | SyncQueueBase<'lot_edit', 'update', LotEditSyncData>
  | SyncQueueBase<'lot_conflict', 'create', LotConflictSyncData>
  | SyncQueueBase<'delivery_save', 'create' | 'update', SyncQueueIdData<'deliveryId'>>
  | SyncQueueBase<'event_save', 'create' | 'update', SyncQueueIdData<'eventId'>>;

// Feature #313: Offline Docket Creation
export interface OfflineDocket {
  id: string;
  serverId?: string;
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
    // Legacy single reading kept for records already on devices; new offline
    // weather writes store the min/max pair the diary API actually accepts.
    // These are plain nested fields (not Dexie indexes), so adding them needs
    // no schema version bump.
    temperature?: number;
    temperatureMin?: number;
    temperatureMax?: number;
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

export interface OfflineDiaryDelivery {
  id: string;
  diaryId: string;
  description: string;
  supplier?: string;
  docketNumber?: string;
  quantity?: number;
  unit?: string;
  lotId?: string;
  notes?: string;
  syncStatus: 'synced' | 'pending' | 'error';
  localUpdatedAt: string;
}

export interface OfflineDiaryEvent {
  id: string;
  diaryId: string;
  eventType: string;
  description: string;
  notes?: string;
  lotId?: string;
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
  documentType: string;
  category?: string;
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
  originalSize?: number; // Original file size in bytes
  compressedSize?: number; // Compressed size in bytes
  /**
   * Server Document id, recorded as soon as the upload succeeds. Lets the
   * sync executor retry a failed post-upload step (attaching the document as
   * NCR evidence) WITHOUT re-uploading and duplicating the file.
   */
  serverDocumentId?: string;
  uploadedAt?: string;
}

// Loose row shape for the Dexie lots table. The full OfflineLotEdit interface
// (with its narrowed syncStatus union) lives with the lot-edit behavior in
// lib/offlineDb.ts; behavior code casts between the two at the table boundary.
export interface OfflineLotEditTable {
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
    serverVersion: OfflineLotEditTable;
    localVersion: OfflineLotEditTable;
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
  diaryDeliveries!: Table<OfflineDiaryDelivery>;
  diaryEvents!: Table<OfflineDiaryEvent>;

  constructor() {
    super('SiteProofOfflineDB');

    this.version(1).stores({
      itpChecklists: 'id, lotId, templateId, cachedAt',
      itpCompletions: 'id, lotId, checklistItemId, syncStatus, localUpdatedAt',
      syncQueue: '++id, type, action, createdAt',
    });

    // Version 2: Add photos table for Feature #311
    this.version(2).stores({
      itpChecklists: 'id, lotId, templateId, cachedAt',
      itpCompletions: 'id, lotId, checklistItemId, syncStatus, localUpdatedAt',
      syncQueue: '++id, type, action, createdAt',
      photos: 'id, projectId, lotId, entityType, entityId, syncStatus, capturedAt',
    });

    // Version 3: Add diaries table for Feature #312
    this.version(3).stores({
      itpChecklists: 'id, lotId, templateId, cachedAt',
      itpCompletions: 'id, lotId, checklistItemId, syncStatus, localUpdatedAt',
      syncQueue: '++id, type, action, createdAt',
      photos: 'id, projectId, lotId, entityType, entityId, syncStatus, capturedAt',
      diaries: 'id, projectId, date, status, syncStatus, localUpdatedAt',
    });

    // Version 4: Add dockets table for Feature #313
    this.version(4).stores({
      itpChecklists: 'id, lotId, templateId, cachedAt',
      itpCompletions: 'id, lotId, checklistItemId, syncStatus, localUpdatedAt',
      syncQueue: '++id, type, action, createdAt',
      photos: 'id, projectId, lotId, entityType, entityId, syncStatus, capturedAt',
      diaries: 'id, projectId, date, status, syncStatus, localUpdatedAt',
      dockets: 'id, projectId, subcontractorCompanyId, date, status, syncStatus, localUpdatedAt',
    });

    // Version 5: Add lots table for Feature #314 (Sync Conflict Handling)
    this.version(5).stores({
      itpChecklists: 'id, lotId, templateId, cachedAt',
      itpCompletions: 'id, lotId, checklistItemId, syncStatus, localUpdatedAt',
      syncQueue: '++id, type, action, createdAt',
      photos: 'id, projectId, lotId, entityType, entityId, syncStatus, capturedAt',
      diaries: 'id, projectId, date, status, syncStatus, localUpdatedAt',
      dockets: 'id, projectId, subcontractorCompanyId, date, status, syncStatus, localUpdatedAt',
      lots: 'id, projectId, lotNumber, syncStatus, localUpdatedAt',
    });

    // Version 6: Add delivery and event tables for mobile diary timeline
    this.version(6).stores({
      itpChecklists: 'id, lotId, templateId, cachedAt',
      itpCompletions: 'id, lotId, checklistItemId, syncStatus, localUpdatedAt',
      syncQueue: '++id, type, action, createdAt',
      photos: 'id, projectId, lotId, entityType, entityId, syncStatus, capturedAt',
      diaries: 'id, projectId, date, status, syncStatus, localUpdatedAt',
      dockets: 'id, projectId, subcontractorCompanyId, date, status, syncStatus, localUpdatedAt',
      lots: 'id, projectId, lotNumber, syncStatus, localUpdatedAt',
      diaryDeliveries: 'id, diaryId, syncStatus, localUpdatedAt',
      diaryEvents: 'id, diaryId, syncStatus, localUpdatedAt',
    });
  }
}

export const offlineDb = new OfflineDatabase();
