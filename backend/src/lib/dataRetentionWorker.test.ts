import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  applyRetentionPolicies: vi.fn(),
  prisma: { __brand: 'app-prisma-singleton' },
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('./dataRetention.js', () => ({ applyRetentionPolicies: mocks.applyRetentionPolicies }));
vi.mock('./prisma.js', () => ({ prisma: mocks.prisma }));
vi.mock('./serverLogger.js', () => ({ logInfo: mocks.logInfo, logError: mocks.logError }));

import { startDataRetentionWorker } from './dataRetentionWorker.js';

beforeEach(() => {
  vi.useFakeTimers();
  mocks.applyRetentionPolicies.mockReset();
  mocks.applyRetentionPolicies.mockResolvedValue({ totalDeleted: 0 });
  mocks.logInfo.mockReset();
  mocks.logError.mockReset();
  delete process.env.DATA_RETENTION_WORKER_ENABLED;
  delete process.env.DATA_RETENTION_WORKER_INTERVAL_MS;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('startDataRetentionWorker (GAP-B/C)', () => {
  it('returns null and never runs the sweep when explicitly disabled', () => {
    process.env.DATA_RETENTION_WORKER_ENABLED = 'false';

    const worker = startDataRetentionWorker();

    expect(worker).toBeNull();
    expect(mocks.applyRetentionPolicies).not.toHaveBeenCalled();
  });

  it('runs the retention sweep against the app prisma client when enabled', async () => {
    process.env.DATA_RETENTION_WORKER_ENABLED = 'true';

    const worker = startDataRetentionWorker();
    expect(worker).not.toBeNull();

    // The initial run is scheduled within the first few seconds.
    await vi.advanceTimersByTimeAsync(5000);

    expect(mocks.applyRetentionPolicies).toHaveBeenCalledWith(mocks.prisma);

    worker?.stop();
  });

  it('stops scheduling further sweeps after stop()', async () => {
    process.env.DATA_RETENTION_WORKER_ENABLED = 'true';
    process.env.DATA_RETENTION_WORKER_INTERVAL_MS = '1000';

    const worker = startDataRetentionWorker();
    await vi.advanceTimersByTimeAsync(1000);
    const callsBeforeStop = mocks.applyRetentionPolicies.mock.calls.length;

    worker?.stop();
    await vi.advanceTimersByTimeAsync(5000);

    expect(mocks.applyRetentionPolicies.mock.calls.length).toBe(callsBeforeStop);
  });
});
