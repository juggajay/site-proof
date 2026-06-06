// Offline docket persistence, moved verbatim from ../offlineDb.ts so the
// docket slice lives beside the database core. The public import path is
// unchanged: '@/lib/offlineDb' re-exports everything exported here, so
// callers keep importing from '@/lib/offlineDb'.

import { createLocalId } from '../localIds';
import { offlineDb, type OfflineDocket } from './core';

// ============================================================================
// Feature #313: Offline Docket Creation Functions
// ============================================================================

// Generate docket ID
function generateDocketId(): string {
  return createLocalId('docket');
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
  userId: string,
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
    localUpdatedAt: new Date().toISOString(),
  };

  // Store the docket
  await offlineDb.dockets.put(docket);

  // Add to sync queue
  await offlineDb.syncQueue.add({
    type: 'docket_create',
    action: 'create',
    data: { docketId: id },
    createdAt: new Date().toISOString(),
    attempts: 0,
  });

  return docket;
}

// Submit docket offline
export async function submitDocketOffline(docketId: string): Promise<void> {
  // Update status to pending_approval
  await offlineDb.dockets.update(docketId, {
    status: 'pending_approval',
    syncStatus: 'pending',
    localUpdatedAt: new Date().toISOString(),
  });

  // Add submission to sync queue
  await offlineDb.syncQueue.add({
    type: 'docket_submit',
    action: 'update',
    data: { docketId },
    createdAt: new Date().toISOString(),
    attempts: 0,
  });
}

// Update docket offline
export async function updateDocketOffline(
  docketId: string,
  updates: Partial<Pick<OfflineDocket, 'labourEntries' | 'plantEntries' | 'notes'>>,
): Promise<void> {
  await offlineDb.dockets.update(docketId, {
    ...updates,
    syncStatus: 'pending',
    localUpdatedAt: new Date().toISOString(),
  });

  // Add update to sync queue
  await offlineDb.syncQueue.add({
    type: 'docket_create', // Reuse create for updates
    action: 'update',
    data: { docketId },
    createdAt: new Date().toISOString(),
    attempts: 0,
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
  subcontractorCompanyId: string,
): Promise<OfflineDocket[]> {
  return offlineDb.dockets.where('subcontractorCompanyId').equals(subcontractorCompanyId).toArray();
}

// Get all pending docket syncs
export async function getPendingDockets(): Promise<OfflineDocket[]> {
  return offlineDb.dockets.where('syncStatus').equals('pending').toArray();
}

// Mark docket as synced
export async function markDocketServerId(docketId: string, serverId?: string): Promise<void> {
  if (!serverId) {
    return;
  }

  await offlineDb.dockets.update(docketId, {
    serverId,
  });
}

export async function markDocketSynced(docketId: string, serverId?: string): Promise<void> {
  await offlineDb.dockets.update(docketId, {
    ...(serverId ? { serverId } : {}),
    syncStatus: 'synced',
    localUpdatedAt: new Date().toISOString(),
  });
}

// Mark docket sync error
export async function markDocketSyncError(docketId: string): Promise<void> {
  await offlineDb.dockets.update(docketId, {
    syncStatus: 'error',
    localUpdatedAt: new Date().toISOString(),
  });
}

// Delete offline docket
export async function deleteOfflineDocket(docketId: string): Promise<void> {
  await offlineDb.dockets.delete(docketId);
}
