// Unit tests for the Storage Persistence API wrappers.
// navigator.storage is mocked per-test so these run without a real browser.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getStorageEstimate,
  isStoragePersisted,
  requestPersistentStorage,
} from './storagePersistence';

type MockStorage = {
  persist?: () => Promise<boolean>;
  persisted?: () => Promise<boolean>;
  estimate?: () => Promise<{ quota?: number; usage?: number }>;
};

let mockStorage: MockStorage = {};

beforeEach(() => {
  mockStorage = {};
  Object.defineProperty(navigator, 'storage', {
    get: () => mockStorage,
    configurable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('requestPersistentStorage', () => {
  it('returns true when the browser grants persistence', async () => {
    mockStorage.persist = vi.fn().mockResolvedValue(true);
    await expect(requestPersistentStorage()).resolves.toBe(true);
    expect(mockStorage.persist).toHaveBeenCalledTimes(1);
  });

  it('returns false when the browser denies persistence', async () => {
    mockStorage.persist = vi.fn().mockResolvedValue(false);
    await expect(requestPersistentStorage()).resolves.toBe(false);
  });

  it('returns false when navigator.storage is undefined', async () => {
    Object.defineProperty(navigator, 'storage', {
      get: () => undefined,
      configurable: true,
    });
    await expect(requestPersistentStorage()).resolves.toBe(false);
  });

  it('returns false when navigator.storage.persist is absent', async () => {
    mockStorage = {}; // no persist method
    await expect(requestPersistentStorage()).resolves.toBe(false);
  });

  it('returns false and does not throw when persist() rejects', async () => {
    mockStorage.persist = vi.fn().mockRejectedValue(new Error('SecurityError'));
    await expect(requestPersistentStorage()).resolves.toBe(false);
  });
});

describe('isStoragePersisted', () => {
  it('returns true when persistence is already granted', async () => {
    mockStorage.persisted = vi.fn().mockResolvedValue(true);
    await expect(isStoragePersisted()).resolves.toBe(true);
  });

  it('returns false when persistence has not been granted', async () => {
    mockStorage.persisted = vi.fn().mockResolvedValue(false);
    await expect(isStoragePersisted()).resolves.toBe(false);
  });

  it('returns false when navigator.storage.persisted is absent', async () => {
    mockStorage = {};
    await expect(isStoragePersisted()).resolves.toBe(false);
  });

  it('returns false and does not throw when persisted() rejects', async () => {
    mockStorage.persisted = vi.fn().mockRejectedValue(new Error('SecurityError'));
    await expect(isStoragePersisted()).resolves.toBe(false);
  });
});

describe('getStorageEstimate', () => {
  it('returns quota and usage when the API is available', async () => {
    mockStorage.estimate = vi.fn().mockResolvedValue({ quota: 1_000_000, usage: 4096 });
    await expect(getStorageEstimate()).resolves.toEqual({ quota: 1_000_000, usage: 4096 });
  });

  it('returns null when navigator.storage.estimate is absent', async () => {
    mockStorage = {};
    await expect(getStorageEstimate()).resolves.toBeNull();
  });

  it('returns null and does not throw when estimate() rejects', async () => {
    mockStorage.estimate = vi.fn().mockRejectedValue(new Error('SecurityError'));
    await expect(getStorageEstimate()).resolves.toBeNull();
  });
});
