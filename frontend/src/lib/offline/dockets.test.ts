// DB-free behavior characterization for the offline docket slice. The Dexie
// singleton (./core) and local id helper are replaced with focused module
// mocks, so no IndexedDB is needed; the functions under test run their real
// bodies and are imported through the public '@/lib/offlineDb' path to pin
// that the re-export surface stays intact.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./core', () => ({
  offlineDb: {
    dockets: {
      put: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      get: vi.fn(),
      where: vi.fn(),
    },
    syncQueue: {
      add: vi.fn(),
    },
  },
}));

vi.mock('../localIds', () => ({
  createLocalId: vi.fn(() => 'docket-local-1'),
}));

import {
  createDocketOffline,
  deleteOfflineDocket,
  getOfflineDocket,
  getOfflineDocketsForProject,
  getOfflineDocketsForSubcontractor,
  getPendingDockets,
  markDocketServerId,
  markDocketSynced,
  markDocketSyncError,
  offlineDb,
  submitDocketOffline,
  updateDocketOffline,
  type OfflineDocket,
} from '@/lib/offlineDb';
import { createLocalId } from '../localIds';

const labourEntries: OfflineDocket['labourEntries'] = [
  {
    id: 'labour-1',
    description: 'QA Labourer',
    numberOfWorkers: 1,
    hoursWorked: 8,
    hourlyRate: 95,
    totalAmount: 760,
  },
];

const plantEntries: OfflineDocket['plantEntries'] = [
  {
    id: 'plant-1',
    equipmentType: 'Excavator',
    hoursUsed: 6,
    hourlyRate: 180,
    totalAmount: 1080,
  },
];

function mockWhereChain(rows: OfflineDocket[]) {
  const equals = vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue(rows) });
  vi.mocked(offlineDb.dockets.where).mockReturnValue({ equals } as unknown as ReturnType<
    typeof offlineDb.dockets.where
  >);
  return equals;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createLocalId).mockReturnValue('docket-local-1');
});

describe('createDocketOffline', () => {
  it('stores a draft docket and queues a docket_create sync', async () => {
    const docket = await createDocketOffline(
      'project-1',
      'subbie-1',
      '2026-06-06',
      {
        labourEntries,
        plantEntries,
        notes: 'Trenching complete',
      },
      'user-1',
    );

    expect(createLocalId).toHaveBeenCalledWith('docket');
    expect(docket).toMatchObject({
      id: 'docket-local-1',
      projectId: 'project-1',
      subcontractorCompanyId: 'subbie-1',
      date: '2026-06-06',
      status: 'draft',
      labourEntries,
      plantEntries,
      notes: 'Trenching complete',
      createdBy: 'user-1',
      syncStatus: 'pending',
      localUpdatedAt: expect.any(String),
    });

    expect(offlineDb.dockets.put).toHaveBeenCalledWith(docket);
    expect(offlineDb.syncQueue.add).toHaveBeenCalledWith({
      type: 'docket_create',
      action: 'create',
      data: { docketId: 'docket-local-1' },
      createdAt: expect.any(String),
      attempts: 0,
    });
  });
});

describe('submitDocketOffline', () => {
  it('marks the docket pending approval and queues a docket_submit sync', async () => {
    await submitDocketOffline('docket-1');

    expect(offlineDb.dockets.update).toHaveBeenCalledWith('docket-1', {
      status: 'pending_approval',
      syncStatus: 'pending',
      localUpdatedAt: expect.any(String),
    });
    expect(offlineDb.syncQueue.add).toHaveBeenCalledWith({
      type: 'docket_submit',
      action: 'update',
      data: { docketId: 'docket-1' },
      createdAt: expect.any(String),
      attempts: 0,
    });
  });
});

describe('updateDocketOffline', () => {
  it('applies mutable fields and reuses docket_create as the update sync type', async () => {
    await updateDocketOffline('docket-1', {
      labourEntries,
      plantEntries: [],
      notes: 'Updated hours',
    });

    expect(offlineDb.dockets.update).toHaveBeenCalledWith('docket-1', {
      labourEntries,
      plantEntries: [],
      notes: 'Updated hours',
      syncStatus: 'pending',
      localUpdatedAt: expect.any(String),
    });
    expect(offlineDb.syncQueue.add).toHaveBeenCalledWith({
      type: 'docket_create',
      action: 'update',
      data: { docketId: 'docket-1' },
      createdAt: expect.any(String),
      attempts: 0,
    });
  });
});

describe('docket queries', () => {
  it('getOfflineDocket reads by id', async () => {
    const stored = { id: 'docket-1' } as OfflineDocket;
    vi.mocked(offlineDb.dockets.get).mockResolvedValue(stored);

    await expect(getOfflineDocket('docket-1')).resolves.toBe(stored);
    expect(offlineDb.dockets.get).toHaveBeenCalledWith('docket-1');
  });

  it('getOfflineDocketsForProject queries the projectId index', async () => {
    const rows = [{ id: 'docket-1' } as OfflineDocket];
    const equals = mockWhereChain(rows);

    await expect(getOfflineDocketsForProject('project-1')).resolves.toBe(rows);
    expect(offlineDb.dockets.where).toHaveBeenCalledWith('projectId');
    expect(equals).toHaveBeenCalledWith('project-1');
  });

  it('getOfflineDocketsForSubcontractor queries the subcontractorCompanyId index', async () => {
    const rows = [{ id: 'docket-1' } as OfflineDocket];
    const equals = mockWhereChain(rows);

    await expect(getOfflineDocketsForSubcontractor('subbie-1')).resolves.toBe(rows);
    expect(offlineDb.dockets.where).toHaveBeenCalledWith('subcontractorCompanyId');
    expect(equals).toHaveBeenCalledWith('subbie-1');
  });

  it('getPendingDockets queries the syncStatus index for pending rows', async () => {
    const rows = [{ id: 'docket-1' } as OfflineDocket];
    const equals = mockWhereChain(rows);

    await expect(getPendingDockets()).resolves.toBe(rows);
    expect(offlineDb.dockets.where).toHaveBeenCalledWith('syncStatus');
    expect(equals).toHaveBeenCalledWith('pending');
  });
});

describe('docket sync-status markers', () => {
  it('markDocketServerId stores the server id only when one is provided', async () => {
    await markDocketServerId('docket-1');
    expect(offlineDb.dockets.update).not.toHaveBeenCalled();

    await markDocketServerId('docket-1', 'server-docket-1');
    expect(offlineDb.dockets.update).toHaveBeenCalledWith('docket-1', {
      serverId: 'server-docket-1',
    });
  });

  it('markDocketSynced marks the docket synced and preserves an optional server id', async () => {
    await markDocketSynced('docket-1', 'server-docket-1');

    expect(offlineDb.dockets.update).toHaveBeenCalledWith('docket-1', {
      serverId: 'server-docket-1',
      syncStatus: 'synced',
      localUpdatedAt: expect.any(String),
    });
  });

  it('markDocketSyncError marks the docket errored', async () => {
    await markDocketSyncError('docket-1');

    expect(offlineDb.dockets.update).toHaveBeenCalledWith('docket-1', {
      syncStatus: 'error',
      localUpdatedAt: expect.any(String),
    });
  });

  it('deleteOfflineDocket deletes by id', async () => {
    await deleteOfflineDocket('docket-1');
    expect(offlineDb.dockets.delete).toHaveBeenCalledWith('docket-1');
  });
});
